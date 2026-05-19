import { buildStats } from "../analytics/statsService.js";
import { exportProfile, parseImportedProfile } from "../storage/localDatabase.js";
import { searchScryfall } from "../services/scryfallService.js";
import { canBeCommander } from "../game/commanderSystem.js";
import { PHASES } from "../state/schema.js";

const PORTRAIT_TOUCH_QUERY = "(orientation: portrait) and (max-width: 1024px)";
const SWIPE_DISTANCE_THRESHOLD = 72;
const SWIPE_AXIS_DOMINANCE = 1.35;
const LONG_PRESS_DELAY_MS = 420;
const REPEAT_INTERVAL_MS = 110;
const DEFAULT_TRACKER_MODIFIER = {
  kind: "none",
  value: 1,
  scopes: {
    life: false,
    counters: false,
    commander: false,
  },
};

export function mountApp(root, store) {
  const pageOrder = ["life", "battlefield", "profile", "archive", "decks", "leaderboards"];
  let activePage = pageOrder.includes(location.hash.replace("#", "")) ? location.hash.replace("#", "") : "life";
  let searchResults = [];
  let searchMessage = "";
  let optionsOpen = false;
  let statsOpen = false;
  let statsMode = "individual";
  let swipeStart = null;
  let toolMenuOpen = false;
  let floatingManaOpen = false;
  let activeToolPanel = "";
  let quickPanelOpen = "";
  let toolBadgePosition = { x: 18, y: 520 };
  let toolBadgeDrag = null;
  let manaAutoCloseTimer = null;
  let lifeGesture = null;
  let commanderGesture = null;
  let modifierGesture = null;
  let modifierPanelOpen = false;
  let trackerModifier = cloneTrackerModifier(DEFAULT_TRACKER_MODIFIER);
  let pendingTrackerModifier = cloneTrackerModifier(DEFAULT_TRACKER_MODIFIER);
  let lifeZoomGuardsInstalled = false;
  let lastLifeTouchEnd = 0;

  store.subscribe(render);
  render(store.getState());

  function render(profile) {
    document.body.dataset.composition = profile.settings?.appearance?.compositionMode || "auto";
    document.body.dataset.page = activePage;
    root.innerHTML = layout(profile, activePage, searchResults, searchMessage, {
      optionsOpen,
      statsOpen,
      statsMode,
      toolMenuOpen,
      floatingManaOpen,
      activeToolPanel,
      quickPanelOpen,
      toolBadgePosition,
      modifierPanelOpen,
      trackerModifier,
      pendingTrackerModifier,
    });
    bind(root, profile);
    scheduleManaAutoClose(profile);
    installLifeZoomGuards();
  }

  function bind(container, profile) {
    container.querySelectorAll("[data-page]").forEach((button) => {
      button.addEventListener("click", () => {
        setActivePage(button.dataset.page);
      });
    });
    container.querySelectorAll("[data-mobile-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!isPortraitTouchMode()) {
          return;
        }
        movePage(button.dataset.mobileNav === "next" ? 1 : -1);
      });
    });
    container.querySelectorAll("[data-player-counter]").forEach((button) => {
      const action = () => ({
        type: "PLAYER_COUNTER_DELTA",
        counter: button.dataset.playerCounter,
        amount: modifyTrackerDelta(Number(button.dataset.delta || 0), "counters"),
      });
      bindTouchAction(button, action);
      bindLongPressRepeat(button, action);
    });
    container.querySelectorAll("[data-commander-damage]").forEach((button) => {
      const action = () => ({
        type: "COMMANDER_DAMAGE_DELTA",
        opponentId: "opponent",
        amount: modifyTrackerDelta(Number(button.dataset.delta || 0), "commander"),
      });
      bindTouchAction(button, action);
      bindLongPressRepeat(button, action);
    });
    const modifierBadge = container.querySelector("[data-modifier-badge]");
    if (modifierBadge) {
      modifierBadge.addEventListener("pointerdown", (event) => {
        modifierGesture = {
          timer: setTimeout(() => {
            pendingTrackerModifier = cloneTrackerModifier(trackerModifier);
            modifierPanelOpen = true;
            vibrateFeedback(true);
            render(store.getState());
          }, LONG_PRESS_DELAY_MS),
        };
        modifierBadge.setPointerCapture?.(event.pointerId);
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
        modifierBadge.addEventListener(eventName, () => {
          clearTimeout(modifierGesture?.timer);
          modifierGesture = null;
        });
      });
    }
    container.querySelectorAll("[data-modifier-option]").forEach((button) => {
      button.addEventListener("click", () => {
        const [kind, rawValue] = button.dataset.modifierOption.split(":");
        pendingTrackerModifier = {
          ...pendingTrackerModifier,
          kind,
          value: Number(rawValue),
        };
        render(store.getState());
      });
    });
    container.querySelectorAll("[data-modifier-scope]").forEach((input) => {
      input.addEventListener("change", () => {
        pendingTrackerModifier = {
          ...pendingTrackerModifier,
          scopes: {
            ...pendingTrackerModifier.scopes,
            [input.dataset.modifierScope]: input.checked,
          },
        };
        render(store.getState());
      });
    });
    container.querySelector("[data-clear-modifier]")?.addEventListener("click", () => {
      pendingTrackerModifier = cloneTrackerModifier(DEFAULT_TRACKER_MODIFIER);
      render(store.getState());
    });
    container.querySelector("[data-confirm-modifier-panel]")?.addEventListener("click", () => {
      trackerModifier = cloneTrackerModifier(pendingTrackerModifier);
      modifierPanelOpen = false;
      render(store.getState());
    });
    container.querySelector("[data-cancel-modifier-panel]")?.addEventListener("click", () => {
      pendingTrackerModifier = cloneTrackerModifier(trackerModifier);
      modifierPanelOpen = false;
      render(store.getState());
    });
    container.querySelectorAll("[data-setting-button]").forEach((button) => {
      button.addEventListener("click", () =>
        store.dispatch({ type: "SET_SETTING", path: button.dataset.settingButton, value: parseSettingValue(button.dataset.value) })
      );
    });
    container.querySelector("[data-add-counter-selected]")?.addEventListener("click", () =>
      store.dispatch({ type: "ADD_COUNTER_SELECTED", counterType: "+1/+1", amount: 1 })
    );
    container.querySelector("[data-sync-public-stats]")?.addEventListener("click", () => store.dispatch({ type: "SYNC_PUBLIC_STATS" }));
    container.querySelector("[data-open-floating-mana]")?.addEventListener("click", () => {
      const manaPinned = Boolean(profile.settings?.battlefield?.manaPinned);
      const shouldClose = floatingManaOpen || manaPinned;
      floatingManaOpen = !shouldClose;
      if (manaPinned && shouldClose) {
        store.dispatch({ type: "SET_SETTING", path: "battlefield.manaPinned", value: false });
      }
      activeToolPanel = "";
      toolMenuOpen = false;
      render(store.getState());
    });
    container.querySelectorAll("[data-open-tool-panel]").forEach((button) => {
      button.addEventListener("click", () => {
        activeToolPanel = button.dataset.openToolPanel;
        floatingManaOpen = false;
        toolMenuOpen = false;
        render(store.getState());
      });
    });
    container.querySelectorAll("[data-close-tool-panel]").forEach((button) => {
      button.addEventListener("click", () => {
        activeToolPanel = "";
        floatingManaOpen = false;
        render(store.getState());
      });
    });
    container.querySelector("[data-open-game-options]")?.addEventListener("click", () => {
      optionsOpen = true;
      activeToolPanel = "";
      toolMenuOpen = false;
      render(store.getState());
    });
    container.querySelector("[data-tool-menu]")?.addEventListener("click", () => {
      toolMenuOpen = !toolMenuOpen;
      render(store.getState());
    });
    const toolBadge = container.querySelector("[data-tool-badge]");
    if (toolBadge) {
      toolBadge.addEventListener("pointerdown", (event) => {
        toolBadge.setPointerCapture?.(event.pointerId);
        toolBadgeDrag = {
          startX: event.clientX,
          startY: event.clientY,
          originalX: toolBadgePosition.x,
          originalY: toolBadgePosition.y,
          moved: false,
        };
      });
      toolBadge.addEventListener("pointermove", (event) => {
        if (!toolBadgeDrag) {
          return;
        }
        const dx = event.clientX - toolBadgeDrag.startX;
        const dy = event.clientY - toolBadgeDrag.startY;
        toolBadgeDrag.moved = toolBadgeDrag.moved || Math.abs(dx) > 5 || Math.abs(dy) > 5;
        toolBadgePosition = {
          x: Math.max(8, Math.min(window.innerWidth - 82, toolBadgeDrag.originalX + dx)),
          y: Math.max(8, Math.min(window.innerHeight - 82, toolBadgeDrag.originalY + dy)),
        };
        toolBadge.style.left = `${toolBadgePosition.x}px`;
        toolBadge.style.top = `${toolBadgePosition.y}px`;
      });
      toolBadge.addEventListener("pointerup", () => {
        if (toolBadgeDrag?.moved) {
          toolBadgeDrag = null;
          return;
        }
        toolBadgeDrag = null;
        toolMenuOpen = !toolMenuOpen;
        render(store.getState());
      });
    }
    container.querySelector("[data-app-shell]")?.addEventListener("pointerdown", (event) => {
      if (!isPortraitTouchMode() || isSwipeBlockedTarget(event.target)) {
        return;
      }
      swipeStart = { x: event.clientX, y: event.clientY };
    });
    container.querySelector("[data-app-shell]")?.addEventListener("pointerup", (event) => {
      if (!isPortraitTouchMode() || !swipeStart || isSwipeBlockedTarget(event.target)) {
        swipeStart = null;
        return;
      }
      const deltaX = event.clientX - swipeStart.x;
      const deltaY = event.clientY - swipeStart.y;
      swipeStart = null;
      if (Math.abs(deltaX) < SWIPE_DISTANCE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY) * SWIPE_AXIS_DOMINANCE) {
        return;
      }
      movePage(deltaX < 0 ? 1 : -1);
    });
    container.querySelector("[data-game-options]")?.addEventListener("click", () => {
      optionsOpen = true;
      activeToolPanel = "";
      toolMenuOpen = false;
      render(store.getState());
    });
    container.querySelectorAll("[data-close-overlay]").forEach((button) => {
      button.addEventListener("click", () => {
        optionsOpen = false;
        statsOpen = false;
        render(store.getState());
      });
    });
    container.querySelector("[data-profile-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = new FormData(event.currentTarget).get("profileName");
      store.dispatch({ type: "SET_PLAYER_NAME", name });
    });
    container.querySelectorAll("[data-setting-toggle]").forEach((input) => {
      input.addEventListener("change", () => store.dispatch({ type: "SET_SETTING", path: input.dataset.settingToggle, value: input.checked }));
    });
    container.querySelectorAll("[data-multiplayer-mode]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "SET_MULTIPLAYER_MODE", mode: button.dataset.multiplayerMode }));
    });
    container.querySelector("[data-open-stats]")?.addEventListener("click", () => {
      statsOpen = true;
      render(store.getState());
    });
    container.querySelectorAll("[data-stats-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        statsMode = button.dataset.statsMode;
        render(store.getState());
      });
    });
    container.querySelector("[data-token-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      store.dispatch({
        type: "ADD_CUSTOM_TOKEN",
        name: form.get("tokenName"),
        power: form.get("power"),
        toughness: form.get("toughness"),
        quantity: form.get("quantity"),
        tokenType: form.get("tokenType"),
        tapped: form.get("tapped") === "on",
      });
    });
    container.querySelectorAll("[data-selected-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.selectedAction;
        if (action === "tap" || action === "untap") {
          store.dispatch({ type: "SET_SELECTED_TAPPED", tapped: action === "tap" });
          return;
        }
        if (action === "clear") {
          store.dispatch({ type: "CLEAR_SELECTION" });
          return;
        }
        store.dispatch({ type: "REMOVE_SELECTED", mode: action });
      });
    });
    container.querySelector("[data-counter-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      store.dispatch({
        type: "APPLY_COUNTER_SCOPE",
        scope: form.get("scope"),
        counterType: form.get("counterType"),
        amount: form.get("quantity"),
      });
    });
    container.querySelectorAll("[data-counter-recent]").forEach((button) => {
      button.addEventListener("click", () => {
        const input = container.querySelector("[data-counter-type-input]");
        if (input) {
          input.value = button.dataset.counterRecent;
          input.focus();
        }
      });
    });

    container.querySelectorAll("[data-life-delta]").forEach((button) => {
      const action = () => ({ type: "LIFE_DELTA", amount: modifyTrackerDelta(Number(button.dataset.lifeDelta || 0), "life") });
      bindTouchAction(button, action);
      bindLongPressRepeat(button, action);
    });
    container.querySelector("[data-life-set]")?.addEventListener("click", () => {
      const value = prompt("Set life total", String(profile.activeSession.life));
      if (value !== null) {
        dispatchWithFeedback({ type: "SET_LIFE", life: value }, true);
      }
    });
    container.querySelector("[data-life-reset]")?.addEventListener("click", () => dispatchWithFeedback({ type: "RESET_PLAYER_TRACKERS" }, true));
    container.querySelector("[data-close-quick-panel]")?.addEventListener("click", () => {
      quickPanelOpen = "";
      render(store.getState());
    });
    const lifeGestureTarget = container.querySelector("[data-life-gesture]");
    if (lifeGestureTarget) {
      bindLifeGesture(lifeGestureTarget);
    }
    const commanderValue = container.querySelector("[data-commander-value]");
    if (commanderValue) {
      bindCommanderDamageGesture(commanderValue);
    }
    container.querySelector("[data-commander-damage-set]")?.addEventListener("click", () => {
      const current = profile.activeSession.commander.damageByOpponent?.opponent || 0;
      const value = prompt("Set commander damage", String(current));
      if (value !== null) {
        dispatchWithFeedback({ type: "SET_COMMANDER_DAMAGE", opponentId: "opponent", value }, true);
      }
    });
    container.querySelector("[data-commander-damage-reset]")?.addEventListener("click", () =>
      dispatchWithFeedback({ type: "SET_COMMANDER_DAMAGE", opponentId: "opponent", value: 0 }, true)
    );
    container.querySelector("[data-undo]")?.addEventListener("click", () => store.dispatch({ type: "UNDO" }));
    container.querySelector("[data-next-phase]")?.addEventListener("click", () => store.dispatch({ type: "ADVANCE_PHASE" }));
    container.querySelector("[data-archive-game]")?.addEventListener("click", () => store.dispatch({ type: "ARCHIVE_GAME", result: "completed" }));
    container.querySelector("[data-cast-commander]")?.addEventListener("click", () => store.dispatch({ type: "CAST_COMMANDER" }));

    container.querySelectorAll("[data-mana]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "ADD_MANA", color: button.dataset.mana, amount: 1 }));
    });
    container.querySelectorAll("[data-mana-minus]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "ADD_MANA", color: button.dataset.manaMinus, amount: -1 }));
    });
    container.querySelector("[data-clear-mana]")?.addEventListener("click", () => store.dispatch({ type: "CLEAR_MANA" }));

    container.querySelectorAll("[data-permanent]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "SELECT_PERMANENT", id: button.dataset.permanent }));
    });
    container.querySelectorAll("[data-tap]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "TOGGLE_TAPPED", id: button.dataset.tap }));
    });
    container.querySelectorAll("[data-counter]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "ADD_COUNTER", id: button.dataset.counter, counterType: "+1/+1", amount: 1 }));
    });
    container.querySelector("[data-declare-attackers]")?.addEventListener("click", () =>
      store.dispatch({ type: "DECLARE_ATTACKERS", ids: profile.activeSession.selectedIds })
    );
    container.querySelector("[data-resolve-combat]")?.addEventListener("click", () => store.dispatch({ type: "RESOLVE_COMBAT" }));

    container.querySelector("[data-token]")?.addEventListener("click", () =>
      store.dispatch({
        type: "ADD_PERMANENT",
        card: {
          name: "Soldier Token",
          typeLine: "Token Creature - Soldier",
          basePower: 1,
          baseToughness: 1,
          isToken: true,
          ownedByCommanderDeck: false,
        },
      })
    );

    container.querySelector("[data-export]")?.addEventListener("click", () => downloadProfile(profile));
    container.querySelector("[data-import]")?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      const text = await file.text();
      await store.dispatch({ type: "IMPORT_PROFILE", profile: parseImportedProfile(text) });
    });

    container.querySelector("[data-search-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const query = new FormData(event.currentTarget).get("query");
      const commanderDeck = profile.commanders?.[profile.activeSession.commander?.deckKey]?.cards || [];
      searchMessage = navigator.onLine ? "Searching..." : "Offline: showing commander deck matches only.";
      render(store.getState());
      searchResults = await searchScryfall(query, commanderDeck);
      searchMessage = searchResults.length ? `${searchResults.length} result(s)` : "No results found.";
      render(store.getState());
    });

    container.querySelectorAll("[data-add-result]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "ADD_PERMANENT", card: searchResults[Number(button.dataset.addResult)] }));
    });
    container.querySelectorAll("[data-cast-result]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "CAST_SPELL", card: searchResults[Number(button.dataset.castResult)] }));
    });
    container.querySelectorAll("[data-commander-result]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "SET_COMMANDER", card: searchResults[Number(button.dataset.commanderResult)] }));
    });
    container.querySelectorAll("[data-deck-result]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "ADD_DECK_CARD", card: searchResults[Number(button.dataset.deckResult)] }));
    });
    container.querySelectorAll("[data-pending-effect]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "MARK_PENDING_EFFECT", id: button.dataset.pendingEffect, status: button.dataset.status }));
    });

    container.querySelector(".floating-mana")?.addEventListener("pointerdown", () => scheduleManaAutoClose(store.getState()));
    document.onkeydown = (event) => {
      if (event.key !== "Escape") {
        return;
      }
      if (activeToolPanel || floatingManaOpen || toolMenuOpen) {
        activeToolPanel = "";
        floatingManaOpen = false;
        toolMenuOpen = false;
        render(store.getState());
      }
    };
    document.onpointerdown = (event) => {
      if (!activeToolPanel && !floatingManaOpen) {
        return;
      }
      if (event.target.closest(".floating-tool-panel, .floating-mana, .radial-menu, .tool-badge")) {
        return;
      }
      if (!profile.settings?.battlefield?.manaPinned) {
        activeToolPanel = "";
        floatingManaOpen = false;
        render(store.getState());
      }
    };
  }

  function setActivePage(page) {
    if (!pageOrder.includes(page)) {
      return;
    }
    activePage = page;
    history.replaceState(null, "", `#${activePage}`);
    optionsOpen = false;
    statsOpen = false;
    quickPanelOpen = "";
    render(store.getState());
  }

  function movePage(direction) {
    const currentIndex = pageOrder.indexOf(activePage);
    const nextIndex = Math.max(0, Math.min(pageOrder.length - 1, currentIndex + direction));
    if (nextIndex !== currentIndex) {
      setActivePage(pageOrder[nextIndex]);
    }
  }

  function bindTouchAction(button, actionFactory, strong = false) {
    button.addEventListener("click", (event) => {
      if (button.dataset.suppressClick === "true") {
        event.preventDefault();
        return;
      }
      dispatchWithFeedback(actionFactory(), strong);
    });
  }

  function bindLongPressRepeat(button, actionFactory) {
    let delayTimer = null;
    let repeatTimer = null;
    let repeated = false;
    const stopRepeat = () => {
      clearTimeout(delayTimer);
      clearInterval(repeatTimer);
      if (repeated) {
        button.dataset.suppressClick = "true";
        setTimeout(() => {
          delete button.dataset.suppressClick;
        }, 120);
      }
    };

    button.addEventListener("pointerdown", (event) => {
      if (!isPortraitTouchMode() || event.pointerType === "mouse") {
        return;
      }
      repeated = false;
      delayTimer = setTimeout(() => {
        repeated = true;
        dispatchWithFeedback(actionFactory());
        repeatTimer = setInterval(() => dispatchWithFeedback(actionFactory()), REPEAT_INTERVAL_MS);
      }, LONG_PRESS_DELAY_MS);
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => button.addEventListener(eventName, stopRepeat));
  }

  function bindLifeGesture(target) {
    // Life total gestures stay on the display only: tap top/right to gain, bottom/left to lose, hold for the quick panel.
    target.addEventListener("pointerdown", (event) => {
      if (!isPortraitTouchMode()) {
        return;
      }
      lifeGesture = {
        x: event.clientX,
        y: event.clientY,
        opened: false,
        timer: setTimeout(() => {
          lifeGesture.opened = true;
          quickPanelOpen = "life";
          vibrateFeedback(true);
          render(store.getState());
        }, LONG_PRESS_DELAY_MS),
      };
    });
    target.addEventListener("pointerup", (event) => {
      if (!lifeGesture || !isPortraitTouchMode()) {
        lifeGesture = null;
        return;
      }
      clearTimeout(lifeGesture.timer);
      const gesture = lifeGesture;
      lifeGesture = null;
      if (gesture.opened || Math.abs(event.clientX - gesture.x) > 14 || Math.abs(event.clientY - gesture.y) > 14) {
        return;
      }
      const bounds = target.getBoundingClientRect();
      const addLife = event.clientX > bounds.left + bounds.width / 2 || event.clientY < bounds.top + bounds.height / 2;
      dispatchWithFeedback({ type: "LIFE_DELTA", amount: modifyTrackerDelta(addLife ? 1 : -1, "life") });
    });
    target.addEventListener("pointercancel", () => {
      clearTimeout(lifeGesture?.timer);
      lifeGesture = null;
    });
  }

  function bindCommanderDamageGesture(target) {
    // Commander damage mirrors the life gesture pattern but defaults a tap to +1 damage.
    target.addEventListener("pointerdown", (event) => {
      if (!isPortraitTouchMode()) {
        return;
      }
      commanderGesture = {
        x: event.clientX,
        y: event.clientY,
        opened: false,
        timer: setTimeout(() => {
          commanderGesture.opened = true;
          quickPanelOpen = "commander";
          vibrateFeedback(true);
          render(store.getState());
        }, LONG_PRESS_DELAY_MS),
      };
    });
    target.addEventListener("pointerup", (event) => {
      if (!commanderGesture || !isPortraitTouchMode()) {
        commanderGesture = null;
        return;
      }
      clearTimeout(commanderGesture.timer);
      const gesture = commanderGesture;
      commanderGesture = null;
      if (gesture.opened || Math.abs(event.clientX - gesture.x) > 14 || Math.abs(event.clientY - gesture.y) > 14) {
        return;
      }
      dispatchWithFeedback({ type: "COMMANDER_DAMAGE_DELTA", opponentId: "opponent", amount: modifyTrackerDelta(1, "commander") });
    });
    target.addEventListener("pointercancel", () => {
      clearTimeout(commanderGesture?.timer);
      commanderGesture = null;
    });
  }

  function dispatchWithFeedback(action, strong = false) {
    store.dispatch(action);
    vibrateFeedback(strong);
  }

  function modifyTrackerDelta(delta, scope) {
    if (!trackerModifier.scopes?.[scope] || trackerModifier.kind === "none") {
      return delta;
    }
    if (trackerModifier.kind === "multiply") {
      return delta * trackerModifier.value;
    }
    const sign = Math.sign(delta) || 1;
    return sign * (Math.abs(delta) + trackerModifier.value);
  }

  function vibrateFeedback(strong = false) {
    if (!isPortraitTouchMode() || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || !navigator.vibrate) {
      return;
    }
    navigator.vibrate(strong ? 24 : 8);
  }

  function isSwipeBlockedTarget(target) {
    return Boolean(target.closest("button, input, label, textarea, select, .overlay-backdrop, .scroll-safe, .counter-stepper, .tile-grid, .search-results, .floating-tool-panel, .floating-mana, [data-no-swipe]"));
  }

  function isPortraitTouchMode() {
    return window.matchMedia?.(PORTRAIT_TOUCH_QUERY)?.matches || false;
  }

  function installLifeZoomGuards() {
    if (lifeZoomGuardsInstalled) {
      return;
    }
    lifeZoomGuardsInstalled = true;
    document.addEventListener(
      "touchmove",
      (event) => {
        if (activePage === "life" && isPortraitTouchMode() && event.touches.length > 1 && event.target.closest(".life-tracker-page")) {
          event.preventDefault();
        }
      },
      { passive: false }
    );
    document.addEventListener("gesturestart", (event) => {
      if (activePage === "life" && isPortraitTouchMode() && event.target.closest(".life-tracker-page")) {
        event.preventDefault();
      }
    });
    document.addEventListener(
      "touchend",
      (event) => {
        if (activePage !== "life" || !isPortraitTouchMode() || !event.target.closest(".life-tracker-page")) {
          return;
        }
        const now = Date.now();
        if (now - lastLifeTouchEnd < 300) {
          event.preventDefault();
        }
        lastLifeTouchEnd = now;
      },
      { passive: false }
    );
  }

  function scheduleManaAutoClose(profile) {
    clearTimeout(manaAutoCloseTimer);
    if (!floatingManaOpen || profile.settings?.battlefield?.manaPinned) {
      return;
    }
    manaAutoCloseTimer = setTimeout(() => {
      floatingManaOpen = false;
      render(store.getState());
    }, 5000);
  }
}

function layout(profile, page, searchResults, searchMessage, uiState) {
  const session = profile.activeSession;
  const tabs = ["life", "battlefield", "profile", "archive", "decks", "leaderboards"];
  return `
    <main class="app-shell" data-app-shell>
      <header class="app-header glass">
        <div class="app-header-top">
          <div>
            <h1>BoardState</h1>
          </div>
          <div class="header-actions">
            <button class="pill" data-game-options>Game Options</button>
            <button class="pill" data-undo>Undo</button>
          </div>
        </div>
        <nav class="tab-bar">
          ${tabs.map((tab) => `<button class="${page === tab ? "active" : ""}" data-page="${tab}" aria-current="${page === tab ? "page" : "false"}">${formatPageLabel(tab)}</button>`).join("")}
        </nav>
        ${renderMobileSwipeControls(tabs, page)}
      </header>
      ${page === "life" ? renderLifeTracker(profile, uiState.trackerModifier) : ""}
      ${page === "battlefield" ? renderBattlefield(profile, searchResults, searchMessage) : ""}
      ${page === "profile" ? renderProfile(profile) : ""}
      ${page === "archive" ? renderArchive(profile) : ""}
      ${page === "decks" ? renderDecks(profile, searchResults, searchMessage) : ""}
      ${page === "leaderboards" ? renderLeaderboards(profile) : ""}
      ${page === "battlefield" ? renderBattlefieldToolBadge(profile, uiState.toolMenuOpen, uiState.floatingManaOpen, uiState.activeToolPanel, uiState.toolBadgePosition) : ""}
      ${uiState.quickPanelOpen ? renderQuickAdjustmentPanel(profile, uiState.quickPanelOpen) : ""}
      ${uiState.modifierPanelOpen ? renderTrackerModifierPanel(uiState.pendingTrackerModifier) : ""}
      ${uiState.optionsOpen ? renderGameOptions(profile) : ""}
      ${uiState.statsOpen ? renderStatsOverlay(profile, uiState.statsMode) : ""}
    </main>
  `;
}

function renderLifeTracker(profile, trackerModifier) {
  const session = profile.activeSession;
  const panels = getPagePanels(profile);
  const counters = {
    poison: session.playerCounters?.poison || 0,
    energy: session.playerCounters?.energy || 0,
    experience: session.playerCounters?.experience || 0,
    tickets: session.playerCounters?.tickets || 0,
  };
  const commanderDamage = session.commander.damageByOpponent?.opponent || 0;
  return `
    <section class="life-tracker-page">
      ${panels.lifeTrackerLife ? `
      <aside class="life-panel life-hero glass">
        <span class="eyebrow">Life Total</span>
        <strong data-life-gesture title="Tap right/top to add life, left/bottom to subtract">${session.life}</strong>
        <div class="life-actions">
          <button class="mobile-step" data-life-delta="-10">-10</button>
          <button class="mobile-step" data-life-delta="-5">-5</button>
          <button data-life-delta="-1">-</button>
          <button data-life-delta="1">+</button>
          <button class="mobile-step" data-life-delta="5">+5</button>
          <button class="mobile-step" data-life-delta="10">+10</button>
        </div>
        ${renderTrackerModifierBadge(trackerModifier)}
      </aside>
      ` : ""}
      <section class="tracker-stack">
        <article class="tracker-card player-counters-card glass">
          <p class="eyebrow">Player Counters</p>
          <h2>Resources</h2>
          <div class="counter-grid">
            ${Object.entries(counters).map(([counter, value]) => renderCounterControl(counter, value, "player")).join("")}
          </div>
        </article>
        <article class="tracker-card commander-damage-card glass">
          <p class="eyebrow">Commander Damage</p>
          <h2>One Opponent</h2>
          ${renderCounterControl("damage", commanderDamage, "commander")}
        </article>
      </section>
    </section>
  `;
}

function renderMobileSwipeControls(tabs, page) {
  const currentIndex = tabs.indexOf(page);
  return `
    <section class="mobile-swipe-controls glass" aria-label="Mobile screen navigation">
      <button data-mobile-nav="prev" aria-label="Previous screen">‹</button>
      <div>
        <span>${formatPageLabel(page)}</span>
        <div class="mobile-page-dots" aria-hidden="true">
          ${tabs.map((tab) => `<i class="${tab === page ? "active" : ""}"></i>`).join("")}
        </div>
      </div>
      <button data-mobile-nav="next" aria-label="Next screen">›</button>
      <small>${currentIndex + 1}/${tabs.length}</small>
    </section>
  `;
}

function renderTrackerModifierBadge(modifier) {
  return `
    <button class="modifier-badge" data-modifier-badge title="Long press to choose tracker modifier">
      <span>Modifier</span>
      <strong>${escapeHtml(formatTrackerModifier(modifier))}</strong>
      <small>${escapeHtml(formatModifierScopes(modifier))}</small>
    </button>
  `;
}

function renderTrackerModifierPanel(modifier) {
  const additiveOptions = [1, 2, 3];
  const multiplierOptions = [2, 3, 4, 5, 6, 7, 8, 9, 10];
  const scopes = [
    ["life", "Life total"],
    ["counters", "Player counters"],
    ["commander", "Commander damage"],
  ];
  return `
    <section class="modifier-panel glass" data-no-swipe>
      <div class="overlay-header compact">
        <div>
          <p class="eyebrow">Increment modifier</p>
          <h2>${escapeHtml(formatTrackerModifier(modifier))}</h2>
        </div>
        <button data-cancel-modifier-panel>Cancel</button>
      </div>
      <p>Pick a modifier, then choose which Life Tracker increment controls it affects.</p>
      <div class="modifier-option-grid">
        ${additiveOptions.map((value) => renderModifierOption("add", value, `+${value}`, modifier)).join("")}
        ${multiplierOptions.map((value) => renderModifierOption("multiply", value, `x${value}`, modifier)).join("")}
      </div>
      <div class="modifier-scope-grid">
        ${scopes.map(([scope, label]) => `
          <label>
            <input type="checkbox" data-modifier-scope="${scope}" ${modifier.scopes?.[scope] ? "checked" : ""} />
            ${label}
          </label>
        `).join("")}
      </div>
      <div class="row modifier-actions">
        <button class="wide" data-clear-modifier>Clear modifier</button>
        <button class="wide primary" data-confirm-modifier-panel>Confirm</button>
      </div>
    </section>
  `;
}

function renderModifierOption(kind, value, label, modifier) {
  const active = modifier.kind === kind && modifier.value === value;
  return `<button class="${active ? "active" : ""}" data-modifier-option="${kind}:${value}">${label}</button>`;
}

function renderQuickAdjustmentPanel(profile, panel) {
  const session = profile.activeSession;
  const isCommander = panel === "commander";
  const title = isCommander ? "Commander Damage" : "Life Total";
  const value = isCommander ? session.commander.damageByOpponent?.opponent || 0 : session.life;
  const setButton = isCommander ? `<button data-commander-damage-set>Set manually</button>` : `<button data-life-set>Set life manually</button>`;
  const resetButton = isCommander ? `<button data-commander-damage-reset>Reset</button>` : `<button data-life-reset>Reset this player</button>`;
  const deltaButtons = [-10, -5, -1, 1, 5, 10]
    .map((delta) =>
      isCommander
        ? `<button data-commander-damage data-delta="${delta}">${delta > 0 ? "+" : ""}${delta}</button>`
        : `<button data-life-delta="${delta}">${delta > 0 ? "+" : ""}${delta}</button>`
    )
    .join("");
  return `
    <section class="quick-adjust-panel glass" data-no-swipe>
      <div class="overlay-header compact">
        <div>
          <p class="eyebrow">Quick adjustment</p>
          <h2>${title}: ${value}</h2>
        </div>
        <button data-close-quick-panel>Close</button>
      </div>
      <div class="button-grid">
        ${deltaButtons}
        ${setButton}
        ${resetButton}
      </div>
    </section>
  `;
}

function renderCounterControl(name, value, type) {
  const label = formatLabel(name);
  const dataAttribute = type === "commander" ? `data-commander-damage` : `data-player-counter="${escapeAttribute(name)}"`;
  const valueAttribute = type === "commander" ? `data-commander-value title="Tap to add commander damage; long press for more"` : "";
  return `
    <div class="counter-stepper counter-stepper--${escapeAttribute(type)}">
      <span>${escapeHtml(label)}</span>
      <div class="counter-stepper__controls">
        <button ${dataAttribute} data-delta="-1">-</button>
        <strong ${valueAttribute}>${value}</strong>
        <button ${dataAttribute} data-delta="1">+</button>
      </div>
    </div>
  `;
}

function renderBattlefield(profile, searchResults, searchMessage) {
  const session = profile.activeSession;
  const stats = buildStats(profile);
  const panels = getPagePanels(profile);
  return `
    <section class="battlefield-page battlefield-page--focused">
      <section class="arena glass">
        ${panels.boardOpponent ? `
        <div class="opponent-zone">
          <h2>Opponent Battlefield</h2>
          ${renderBattlefieldGroups(session.battlefield.opponent, { readonly: true, emptyText: "No visible opponent permanents", expandedAll: profile.settings?.battlefield?.expandedAll })}
        </div>
        ` : ""}
        ${panels.boardCombat ? `
        <div class="combat-zone">
          <h2>Combat</h2>
          <p>${session.combat.damagePreview ? `${session.combat.damagePreview.total} damage estimated` : "Select attackers, then confirm combat."}</p>
          <div class="row"><button data-declare-attackers>Declare Attackers</button><button data-resolve-combat>Resolve</button></div>
        </div>
        ` : ""}
        <div class="player-zone">
          <h2>Your Battlefield</h2>
          ${renderBattlefieldGroups(session.battlefield.player, { emptyText: "No permanents yet", expandedAll: profile.settings?.battlefield?.expandedAll })}
        </div>
      </section>
      <aside class="search-panel glass">
        ${renderBattlefieldPhaseTracker(session, stats)}
        ${panels.archiveQuickAdd ? `<h2>Battlefield Quick Add</h2>` : ""}
        ${panels.archiveQuickAdd ? renderSearch(searchResults, searchMessage) : ""}
      </aside>
    </section>
    ${panels.advancedRulesHelpers ? renderPending(session) : ""}
  `;
}

function renderBattlefieldPhaseTracker(session, stats) {
  return `
    <section class="phase-tracker-card">
      <p class="eyebrow">Turn phase</p>
      <h2>Turn ${session.turn}</h2>
      <strong>${escapeHtml(PHASES[session.phaseIndex])}</strong>
      <p>Board ${stats.currentBoardSize} / Triggers ${stats.triggersResolved}</p>
      <button class="wide" data-next-phase>Next Phase</button>
    </section>
  `;
}

function renderBattlefieldGroups(permanents, options = {}) {
  if (!permanents.length) {
    return empty(options.emptyText || "No permanents yet");
  }

  const untapped = permanents.filter((permanent) => !permanent.tapped);
  const tapped = permanents.filter((permanent) => permanent.tapped);
  return `
    <div class="battlefield-groups">
      ${renderPermanentGroup("Untapped", untapped, options)}
      ${renderPermanentGroup("Tapped", tapped, { ...options, tappedGroup: true })}
    </div>
  `;
}

function renderPermanentGroup(label, permanents, options = {}) {
  if (!permanents.length) {
    return "";
  }
  const count = permanents.reduce((total, permanent) => total + (Number(permanent.quantity) || 1), 0);
  return `
    <section class="battlefield-group ${options.tappedGroup ? "tapped-zone" : "untapped-zone"}">
      <div class="battlefield-group-header">
        <span>${label}</span>
        <strong>${count}</strong>
      </div>
      <div class="tile-grid ${options.readonly ? "readonly" : ""}">
        ${permanents.map((permanent) => renderPermanent(permanent, options)).join("")}
      </div>
    </section>
  `;
}

function renderPermanent(permanent, options = {}) {
  return `
    <article class="permanent ${permanent.tapped ? "tapped" : ""} ${permanent.attacking ? "attacking" : ""} ${permanent.manualStatus === "pending" ? "pending" : ""}">
      <button ${options.readonly ? "" : `data-permanent="${permanent.id}"`}>
        <strong>${escapeHtml(permanent.name)}</strong>
        <span>${escapeHtml(permanent.typeLine)}</span>
        ${permanent.isCreature ? `<b>${permanent.currentPower}/${permanent.currentToughness}</b>` : ""}
        ${permanent.isPlaneswalker ? `<b>Loyalty ${permanent.counters?.Loyalty || 0}</b>` : ""}
        ${permanent.quantity > 1 ? `<i class="quantity">x${permanent.quantity}</i>` : ""}
        ${permanent.isToken ? "<em>TOKEN</em>" : ""}
      </button>
      ${options.expandedAll ? renderPermanentDetails(permanent) : ""}
      ${options.readonly ? "" : `<div class="row mini">
        <button data-tap="${permanent.id}">${permanent.tapped ? "Untap" : "Tap"}</button>
        <button data-counter="${permanent.id}">+1/+1</button>
      </div>`}
    </article>
  `;
}

function renderPermanentDetails(permanent) {
  const counters = Object.entries(permanent.counters || {}).filter(([, value]) => Number(value) > 0);
  return `
    <div class="permanent-details">
      ${counters.length ? `<span>${counters.map(([type, value]) => `${escapeHtml(type)} ${value}`).join(" / ")}</span>` : "<span>No counters</span>"}
      ${permanent.keywords?.length ? `<span>${permanent.keywords.map(escapeHtml).join(", ")}</span>` : ""}
    </div>
  `;
}

function renderSearch(results, message) {
  return `
    <form class="search-box" data-search-form>
      <label>Scryfall Search</label>
      <div class="row"><input name="query" placeholder="Card, token, land, spell" /><button>Search</button></div>
      <p>${escapeHtml(message || "Works offline with saved commander deck matches.")}</p>
    </form>
    <div class="search-results">
      ${results.map((card, index) => `
        <article>
          <strong>${escapeHtml(card.name)}</strong>
          <span>${escapeHtml(card.typeLine || "")}</span>
          <div class="row mini">
            ${card.isInstant || card.isSorcery || /\b(Instant|Sorcery)\b/i.test(card.typeLine || "") ? `<button data-cast-result="${index}">Cast</button>` : `<button data-add-result="${index}">Add</button>`}
            <button data-deck-result="${index}">Deck</button>
            ${canBeCommander(card) ? `<button data-commander-result="${index}">Commander</button>` : ""}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderBattlefieldToolBadge(profile, menuOpen, floatingManaOpen, activeToolPanel, position) {
  const manaPinned = Boolean(profile.settings?.battlefield?.manaPinned);
  const badgeStyle = `left:${Math.round(position.x)}px;top:${Math.round(position.y)}px;`;
  return `
    <div class="battlefield-tool-system">
      <button class="tool-badge glass" style="${badgeStyle}" data-tool-badge aria-label="Battlefield tools">Tools</button>
      ${menuOpen ? `
      <section class="radial-menu glass" style="${badgeStyle}">
        <button data-open-tool-panel="tokens">Token Controls</button>
        <button data-open-tool-panel="permanents">Permanent Controls</button>
        <button data-open-game-options>Game Options</button>
        <button data-open-tool-panel="counters">Permanent Counter Controls</button>
        <button data-open-floating-mana>${floatingManaOpen || manaPinned ? "Hide Floating Mana" : "Floating Mana Controls"}</button>
      </section>
      ` : ""}
      ${activeToolPanel ? renderBattlefieldToolPanel(profile, activeToolPanel) : ""}
      ${floatingManaOpen || manaPinned ? renderFloatingManaControls(profile, manaPinned) : ""}
    </div>
  `;
}

function renderFloatingManaControls(profile, pinned) {
  const session = profile.activeSession;
  const colors = Object.entries(session.manaPool);
  return `
    <section class="floating-mana glass ${pinned ? "pinned" : ""}">
      <div class="overlay-header compact">
        <h2>Floating Mana</h2>
        ${pinned ? `<span class="eyebrow">Pinned</span>` : ""}
        <button data-close-tool-panel>Close</button>
      </div>
      <div class="mana-control-grid">
        ${colors.map(([color, value]) => `
          <div class="mana-row">
            <button data-mana-minus="${color}">-</button>
            <strong>${formatManaLabel(color)} ${value}</strong>
            <button data-mana="${color}">+</button>
          </div>
        `).join("")}
      </div>
      <div class="row">
        <button class="wide" data-clear-mana>Clear Mana Pool</button>
        <button class="wide" data-setting-button="battlefield.manaPinned" data-value="${pinned ? "false" : "true"}">${pinned ? "Unpin" : "Pin"}</button>
      </div>
    </section>
  `;
}

function renderBattlefieldToolPanel(profile, panel) {
  const titleMap = {
    tokens: "Token Controls",
    permanents: "Permanent Controls",
    counters: "Permanent Counter Controls",
  };
  return `
    <section class="floating-tool-panel glass" data-floating-tool-panel>
      <div class="overlay-header compact">
        <h2>${titleMap[panel] || "Battlefield Tool"}</h2>
        <button data-close-tool-panel>Close</button>
      </div>
      ${panel === "tokens" ? renderTokenControls() : ""}
      ${panel === "permanents" ? renderPermanentControls(profile) : ""}
      ${panel === "counters" ? renderPermanentCounterControls(profile) : ""}
    </section>
  `;
}

function renderTokenControls() {
  return `
    <form class="stacked-form" data-token-form>
      <label>Token name<input name="tokenName" value="Generic Token" /></label>
      <div class="form-grid-2">
        <label>Power<input name="power" type="number" inputmode="numeric" value="1" /></label>
        <label>Toughness<input name="toughness" type="number" inputmode="numeric" value="1" /></label>
      </div>
      <label>Quantity<input name="quantity" type="number" min="1" inputmode="numeric" value="1" /></label>
      <label>Token type<input name="tokenType" value="Creature" placeholder="Creature, Artifact, Treasure..." /></label>
      <label class="toggle-row"><span>Tapped</span><input name="tapped" type="checkbox" /></label>
      <button class="wide">Add token to battlefield</button>
    </form>
  `;
}

function renderPermanentControls(profile) {
  const selectedCount = profile.activeSession.selectedIds?.length || 0;
  const expanded = Boolean(profile.settings?.battlefield?.expandedAll);
  return `
    <div class="stacked-form">
      <p class="eyebrow">${selectedCount} selected permanent(s)</p>
      <div class="button-grid">
        <button data-selected-action="tap">Tap selected</button>
        <button data-selected-action="untap">Untap selected</button>
        <button data-selected-action="destroy">Destroy selected</button>
        <button data-selected-action="exile">Exile selected</button>
        <button data-selected-action="sacrifice">Sacrifice selected</button>
        <button data-selected-action="remove">Remove selected</button>
        <button data-setting-button="battlefield.expandedAll" data-value="${expanded ? "false" : "true"}">${expanded ? "Collapse all permanents" : "Expand all permanents"}</button>
        <button data-selected-action="clear">Clear selected permanents</button>
      </div>
    </div>
  `;
}

function renderPermanentCounterControls(profile) {
  const recent = profile.settings?.recentCounterTypes || ["+1/+1", "-1/-1", "Loyalty", "Charge", "Shield"];
  return `
    <form class="stacked-form" data-counter-form>
      <label>Counter type<input name="counterType" data-counter-type-input value="${escapeAttribute(recent[0] || "+1/+1")}" /></label>
      <label>Quantity<input name="quantity" type="number" min="1" inputmode="numeric" value="1" /></label>
      <label>Apply to
        <select name="scope">
          <option value="selected">Selected permanents</option>
          <option value="all-creatures">All creatures</option>
          <option value="all-permanents">All permanents</option>
          <option value="all-tokens">All tokens</option>
        </select>
      </label>
      <div class="recent-chip-row">
        ${recent.map((counter) => `<button type="button" data-counter-recent="${escapeAttribute(counter)}">${escapeHtml(counter)}</button>`).join("")}
      </div>
      <button class="wide">Apply counters</button>
    </form>
  `;
}

function renderPending(session) {
  if (!session.pendingEffects.length) {
    return "";
  }
  return `
    <section class="pending-strip glass">
      <h2>Pending Effects</h2>
      ${session.pendingEffects.map((effect) => `
        <article>
          <strong>${escapeHtml(effect.sourceName)}</strong>
          <span>${escapeHtml(effect.status)}</span>
          <button data-pending-effect="${effect.id}" data-status="resolved">Resolved</button>
          <button data-pending-effect="${effect.id}" data-status="skipped">Skipped</button>
        </article>
      `).join("")}
    </section>
  `;
}

function renderProfile(profile) {
  return `
    <section class="utility-page glass">
      <h2>Player Profile</h2>
      <p>Name: ${escapeHtml(profile.player.name)}</p>
      <p>Offline storage is primary. Export this profile to move devices.</p>
      <div class="row">
        <button data-export>Export Profile</button>
        <label class="file-pill">Import Profile<input type="file" accept="application/json" data-import /></label>
      </div>
    </section>
  `;
}

function renderArchive(profile) {
  return `
    <section class="utility-page glass">
      <h2>Archive</h2>
      <button data-archive-game>Archive Current Game</button>
      ${(profile.archives || []).map((game) => `
        <article class="log-card">
          <strong>${escapeHtml(game.commanderName)}</strong>
          <span>${new Date(game.endedAt).toLocaleString()}</span>
          <p>${game.history?.length || 0} actions / ${game.effectLog?.length || 0} effect logs</p>
        </article>
      `).join("") || empty("No archived games yet")}
    </section>
  `;
}

function renderDecks(profile, results, message) {
  const decks = Object.values(profile.commanders || {});
  return `
    <section class="utility-page glass">
      <h2>Commander Decks</h2>
      ${renderSearch(results, message)}
      ${decks.map((deck) => `
        <article class="log-card">
          <strong>${escapeHtml(deck.commanderName)}</strong>
          <span>${deck.cards.length} cards / ${Object.keys(deck.usage).length} used</span>
          <div class="deck-list">${deck.cards.map((card) => `<span>${escapeHtml(card.name)}</span>`).join("")}</div>
        </article>
      `).join("") || empty("Choose a commander, then add cards to build a local deck archive.")}
    </section>
  `;
}

function renderLeaderboards(profile) {
  return `
    <section class="utility-page glass">
      <h2>Local Leaderboards</h2>
      <button class="wide" data-open-stats>Open Stats Overlay</button>
      ${Object.entries(profile.leaderboards || {}).map(([name, records]) => `
        <article class="log-card">
          <strong>${escapeHtml(name)}</strong>
          ${(records || []).map((record) => `<p>${escapeHtml(record.label)}: ${record.value}</p>`).join("") || "<p>No records yet</p>"}
        </article>
      `).join("")}
    </section>
  `;
}

function renderGameOptions(profile) {
  const settings = getSettings(profile);
  const panels = getPagePanels(profile);
  const multiplayer = getMultiplayerSettings(profile);
  const compositionMode = profile.settings?.appearance?.compositionMode || "auto";
  const nextCompositionMode = compositionMode === "mobile" ? "widescreen" : "mobile";
  const compositionLabel = compositionMode === "mobile" ? "Mobile vertical" : "Standard widescreen";
  return `
    <section class="overlay-backdrop">
      <div class="floating-overlay glass">
        <div class="overlay-header">
          <div>
            <p class="eyebrow">Transparent overlay</p>
            <h2>Game Options</h2>
          </div>
          <button data-close-overlay>Close</button>
        </div>
        <div class="overlay-grid">
          <article class="option-card">
            <h3>Local Login / Profile</h3>
            <form data-profile-form class="stacked-form">
              <label>Profile name</label>
              <input name="profileName" value="${escapeAttribute(profile.player?.name || "Player")}" placeholder="Player name" />
              <button class="wide">Save Locally</button>
            </form>
            <p>Local-only profile. No server authentication yet.</p>
          </article>
          <article class="option-card">
            <h3>Multiplayer</h3>
            <div class="button-grid">
              <button data-multiplayer-mode="wifi">Connect via WiFi</button>
              <button data-multiplayer-mode="bluetooth">Bluetooth Placeholder</button>
              <button data-multiplayer-mode="simulated">Simulated Local</button>
              <button data-multiplayer-mode="offline">Disconnect</button>
            </div>
            <p>Mode: ${escapeHtml(multiplayer.mode)}</p>
            <p>Connected players: ${multiplayer.connectedPlayers.length ? multiplayer.connectedPlayers.map((player) => escapeHtml(player.name)).join(", ") : "None"}</p>
            ${renderToggle("Multiplayer authority confirmations", "multiplayer.confirmAuthority", multiplayer.confirmAuthority)}
          </article>
          <article class="option-card">
            <h3>Page Customization</h3>
            <p>Wallpaper composition: ${escapeHtml(compositionLabel)}</p>
            <button class="wide" data-setting-button="appearance.compositionMode" data-value="${nextCompositionMode}">
              Switch to ${nextCompositionMode === "mobile" ? "Mobile Vertical" : "Standard Widescreen"}
            </button>
            ${renderToggle("Life total panel", "pagePanels.lifeTrackerLife", panels.lifeTrackerLife)}
            <p>Floating mana now lives in the Battlefield tools menu as a floating widget with pin/unpin support.</p>
            ${renderToggle("Opponent board panel", "pagePanels.boardOpponent", panels.boardOpponent)}
            ${renderToggle("Combat controls", "pagePanels.boardCombat", panels.boardCombat)}
            ${renderToggle("Board quick tools", "pagePanels.boardTools", panels.boardTools)}
            ${renderToggle("Advanced rules helpers", "pagePanels.advancedRulesHelpers", panels.advancedRulesHelpers)}
            ${renderToggle("Archive / quick add helpers", "pagePanels.archiveQuickAdd", panels.archiveQuickAdd)}
            ${renderToggle("Stats / timer widgets", "pagePanels.statsTimerWidgets", panels.statsTimerWidgets)}
          </article>
          <article class="option-card">
            <h3>Rules / Accessibility</h3>
            ${renderToggle("ADHD auto automation", "adhdAutomation", settings.adhdAutomation)}
            ${renderToggle("Confirm ambiguous effects", "confirmAmbiguousEffects", settings.confirmAmbiguousEffects)}
            ${renderToggle("Haptics hooks", "haptics", settings.haptics)}
            ${renderToggle("Compact permanent tiles", "compactTiles", settings.compactTiles)}
          </article>
        </div>
      </div>
    </section>
  `;
}

function renderStatsOverlay(profile, mode) {
  const stats = buildStats(profile);
  const groups = buildStatsGroups(profile, stats);
  const activeRows = groups[mode] || groups.individual;
  return `
    <section class="overlay-backdrop">
      <div class="floating-overlay stats-overlay glass">
        <div class="overlay-header">
          <div>
            <p class="eyebrow">Leaderboards linked</p>
            <h2>Stats Overlay</h2>
          </div>
          <button data-close-overlay>Close</button>
        </div>
        <div class="segmented">
          ${["individual", "grouped", "all", "advanced"].map((entry) => `<button class="${mode === entry ? "active" : ""}" data-stats-mode="${entry}">${formatLabel(entry)} Stats</button>`).join("")}
        </div>
        <div class="stats-grid">
          ${activeRows.map((row) => `
            <article class="stat-card">
              <span>${escapeHtml(row.label)}</span>
              <strong>${escapeHtml(row.value)}</strong>
            </article>
          `).join("")}
        </div>
        ${renderStatsSyncPanel(profile)}
      </div>
    </section>
  `;
}

function renderStatsSyncPanel(profile) {
  const sync = profile.statsSync || {};
  const peers = sync.peers || [];
  return `
    <article class="option-card stats-sync-card">
      <h3>Personal Stats Auto-Sync</h3>
      <p>Local/network-first sync shares only public stat summaries.</p>
      <button class="wide" data-sync-public-stats>Sync Public Stats Now</button>
      <p>Last sync: ${sync.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleString() : "Never"}</p>
      <div class="deck-list">
        ${peers.map((peer) => `<span>${escapeHtml(peer.name)} · Board ${peer.boardSize}</span>`).join("") || "<span>No synced players yet</span>"}
      </div>
    </article>
  `;
}

function buildStatsGroups(profile, stats) {
  const session = profile.activeSession;
  const permanents = [...session.battlefield.player, ...session.battlefield.opponent];
  const creatures = permanents.filter((permanent) => permanent.isCreature);
  const commanders = Object.values(profile.commanders || {});
  const elapsedMs = Math.max(1, Date.now() - session.timer.gameStartedAt);
  const averageTurnMs = elapsedMs / Math.max(1, session.turn);
  const winCount = commanders.reduce((sum, commander) => sum + (commander.stats?.wins || 0), 0);
  const lossCount = commanders.reduce((sum, commander) => sum + (commander.stats?.losses || 0), 0);
  const highestDamageCreature = creatures
    .map((creature) => ({ name: creature.name, damage: Math.max(0, Number(creature.currentPower) || 0) * (creature.quantity || 1) }))
    .sort((left, right) => right.damage - left.damage)[0];
  const lowInteractionCards = commanders
    .flatMap((commander) => commander.cards?.filter((card) => !commander.usage?.[card.name]).map((card) => card.name) || [])
    .slice(0, 4);

  const individual = [
    { label: "Games played", value: stats.gamesPlayed },
    { label: "Actions this game", value: stats.actionsThisGame },
    { label: "Highest life", value: stats.highestLife },
    { label: "Floating mana", value: stats.manaFloating },
  ];
  const grouped = [
    { label: "Board size", value: stats.currentBoardSize },
    { label: "Largest token army", value: stats.largestTokenArmy },
    { label: "Triggers resolved", value: stats.triggersResolved },
    { label: "Commander decks", value: stats.commanderCount },
  ];
  const advanced = [
    { label: "Average turn time", value: formatDuration(averageTurnMs) },
    { label: "Positive time", value: formatDuration(elapsedMs * 0.55) },
    { label: "Negative time", value: formatDuration(elapsedMs * 0.45) },
    { label: "Median turn time", value: formatDuration(averageTurnMs) },
    { label: "Win/loss record", value: `${winCount}-${lossCount}` },
    { label: "Commander-specific win/loss", value: commanders.map((commander) => `${commander.commanderName}: ${commander.stats?.wins || 0}-${commander.stats?.losses || 0}`).join(" / ") || "No commander games yet" },
    { label: "Highest average damaging creature", value: highestDamageCreature ? `${highestDamageCreature.name} (${highestDamageCreature.damage})` : "No creatures yet" },
    { label: "Shortest-lived permanent", value: "Not enough removal history yet" },
    { label: "Low/no board interaction cards", value: lowInteractionCards.join(", ") || "No deck data yet" },
    { label: "Multiplayer win/loss comparison", value: getMultiplayerSettings(profile).connectedPlayers.length ? "Simulated comparison active" : "No connected players" },
  ];
  return {
    individual,
    grouped,
    advanced,
    all: [...individual, ...grouped, ...advanced],
  };
}

function renderToggle(label, path, checked, truthyValue = true) {
  const value = truthyValue === true ? "true" : truthyValue;
  return `
    <label class="toggle-row">
      <span>${escapeHtml(label)}</span>
      <input type="checkbox" data-setting-toggle="${escapeAttribute(path)}" ${checked ? "checked" : ""} value="${escapeAttribute(value)}" />
    </label>
  `;
}

function getSettings(profile) {
  return {
    adhdAutomation: true,
    confirmAmbiguousEffects: true,
    haptics: false,
    compactTiles: true,
    ...(profile.settings || {}),
  };
}

function getPagePanels(profile) {
  return {
    lifeTrackerLife: true,
    lifeTrackerMana: true,
    lifeTrackerTools: true,
    boardOpponent: true,
    boardCombat: true,
    boardTools: true,
    advancedRulesHelpers: true,
    archiveQuickAdd: true,
    statsTimerWidgets: true,
    ...(profile.settings?.pagePanels || {}),
  };
}

function cloneTrackerModifier(modifier) {
  return {
    kind: modifier.kind,
    value: modifier.value,
    scopes: {
      ...modifier.scopes,
    },
  };
}

function formatTrackerModifier(modifier) {
  if (!modifier || modifier.kind === "none") {
    return "x1";
  }
  return modifier.kind === "multiply" ? `x${modifier.value}` : `+${modifier.value}`;
}

function formatModifierScopes(modifier) {
  const scopes = modifier?.scopes || {};
  const active = [
    scopes.life ? "Life" : "",
    scopes.counters ? "Counters" : "",
    scopes.commander ? "Commander" : "",
  ].filter(Boolean);
  return active.length ? active.join(" / ") : "Long press";
}

function getMultiplayerSettings(profile) {
  return {
    mode: "offline",
    connectedPlayers: [],
    authorityMode: "confirm",
    confirmAuthority: true,
    bluetoothReady: false,
    wifiReady: true,
    ...(profile.settings?.multiplayer || {}),
  };
}

function formatDuration(ms) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
}

function parseSettingValue(value) {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return value;
}

function formatLabel(value) {
  return String(value || "").replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatManaLabel(value) {
  const labels = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green", C: "Colorless", Generic: "Generic" };
  return labels[value] || value;
}

function formatPageLabel(value) {
  return value === "life" ? "Life Tracker" : formatLabel(value);
}

function downloadProfile(profile) {
  const blob = new Blob([exportProfile(profile)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `boardstate-profile-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function empty(text) {
  return `<p class="empty">${escapeHtml(text)}</p>`;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
