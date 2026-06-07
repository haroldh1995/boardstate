import { buildStats } from "../analytics/statsService.js";
import { exportProfile, parseImportedProfile } from "../storage/localDatabase.js";
import { fetchScryfallCardDetails, searchScryfall } from "../services/scryfallService.js";
import { canBeCommander } from "../game/commanderSystem.js";
import { createPermanent, PHASES } from "../state/schema.js";
import { buildPredictiveActions } from "../game/predictiveActions.js";
import { getSimulationDeckById } from "../simulation/decks/index.js";
import {
  buildBugReport,
  buildDebugState,
  buildGameLog,
  collectRulesConfidence,
  confidenceLabel,
  safeJson,
} from "../support/debugExport.js";

const MOBILE_LAYOUT_QUERY = "(max-width: 1279px)";
const SWIPE_DISTANCE_THRESHOLD = 72;
const SWIPE_AXIS_DOMINANCE = 1.35;
const LONG_PRESS_DELAY_MS = 420;
const REPEAT_INTERVAL_MS = 110;
const PERMANENT_DOUBLE_TAP_MS = 260;
const PERMANENT_VERTICAL_SWIPE_THRESHOLD = 42;
const PERMANENT_DRAG_REORDER_THRESHOLD = 46;
const ATTACK_DRAG_TOP_RATIO = 0.34;
const EDGE_ZONE_SIZE = 26;
const HUD_DRAG_THRESHOLD = 7;
const OUTSIDE_DISMISS_DRAG_THRESHOLD = 10;
const TEMPORARY_SCROLL_SELECTORS = [
  ".floating-overlay",
  ".utility-overlay",
  ".floating-tool-panel",
  ".floating-mana",
  ".radial-menu",
  ".utility-dock-menu",
  ".simulation-setup",
  ".simulation-stats-overlay",
  ".synced-turn-order-modal",
  ".stats-overlay",
  ".modifier-panel",
  ".quick-adjust-panel",
  ".confirm-dialog",
  ".search-results",
  ".cast-action-popup",
  ".simulation-log",
  ".manual-choice-panel",
  ".trigger-queue-panel",
  ".history-timeline",
  ".opponent-battlefield-overlay",
  ".tutorial-sample-panel",
  ".adhd-assist-panel",
];
const BACKGROUND_SCROLL_LOCK_SELECTORS = [
  ".floating-overlay",
  ".utility-overlay",
  ".floating-tool-panel",
  ".floating-mana:not(.pinned)",
  ".radial-menu",
  ".utility-dock-menu",
  ".simulation-setup",
  ".simulation-stats-overlay",
  ".synced-turn-order-modal",
  ".stats-overlay",
  ".modifier-panel",
  ".quick-adjust-panel",
  ".confirm-dialog",
  ".cast-action-popup",
  ".manual-choice-panel:not(.manual-choice-panel--collapsed)",
  ".trigger-queue-panel",
  ".opponent-battlefield-overlay",
  ".tutorial-sample-panel",
];
const HUD_BADGE_DEFAULTS = {
  utility: { x: 98, y: 520 },
  helper: { x: 14, y: 420 },
  simulation: { x: 14, y: 182 },
  floatingMana: { x: 14, y: 332 },
};
const DEFAULT_TRACKER_MODIFIER = {
  kind: "delta",
  value: 1,
  scopes: {
    life: true,
    poison: false,
    energy: false,
    experience: false,
    tickets: false,
    commander: false,
  },
};
const STATUS_ICON_META = {
  tapped: { glyph: "T", label: "Tapped" },
  summoningSickness: { glyph: "S", label: "Summoning sickness" },
  flying: { glyph: "F", label: "Flying" },
  trample: { glyph: "Tr", label: "Trample" },
  vigilance: { glyph: "V", label: "Vigilance" },
  menace: { glyph: "Me", label: "Menace" },
  deathtouch: { glyph: "D", label: "Deathtouch" },
  lifelink: { glyph: "L", label: "Lifelink" },
  ward: { glyph: "W", label: "Ward" },
  counters: { glyph: "C", label: "Counters present" },
  commander: { glyph: "Cmd", label: "Commander" },
  token: { glyph: "Tok", label: "Token" },
  monarch: { glyph: "Mon", label: "Monarch" },
  initiative: { glyph: "Init", label: "Initiative" },
  attacking: { glyph: "Atk", label: "Attacking" },
  blocking: { glyph: "Blk", label: "Blocking" },
  modified: { glyph: "Mod", label: "Modified" },
  triggered: { glyph: "Trig", label: "Triggered ability source" },
  staticEffect: { glyph: "Sta", label: "Static effect source" },
  replacementEffect: { glyph: "Rep", label: "Replacement effect source" },
  unresolvedTrigger: { glyph: "!", label: "Unresolved trigger" },
  adhdReminder: { glyph: "ADHD", label: "ADHD reminder active" },
};

export function mountApp(root, store) {
  const allPages = ["life", "battlefield", "profile", "archive", "decks", "leaderboards"];
  let activePage = normalizePageFromHash(location.hash);
  let searchResults = [];
  let searchMessage = "";
  let searchQuery = "";
  let searchLoading = false;
  let searchDebounceTimer = null;
  let searchRequestToken = 0;
  let searchAbortController = null;
  let keepSearchInputFocus = false;
  let searchSelection = { start: null, end: null, direction: "none" };
  let suppressSearchRefocusUntil = 0;
  let optionsOpen = false;
  let statsOpen = false;
  let statsMode = "individual";
  let swipeStart = null;
  let toolMenuOpen = false;
  let floatingManaOpen = false;
  let activeToolPanel = "";
  let utilityDockOpen = false;
  let activeUtilityPanel = "";
  let combatResolving = false;
  let phaseAdvancePending = false;
  let simulationSetupOpen = false;
  let simulationLogOpen = false;
  let simulationSelectedOpponents = new Set(["alpha"]);
  let simulationSelectedSpeed = "normal";
  let simulationRevengeEnabled = true;
  let simulationSetupError = "";
  let simulationStatsOpen = false;
  let simulationSetupSuppressOpenUntil = 0;
  let syncedTurnOrderSetupOpen = false;
  let syncedTurnOrderError = "";
  let syncedTurnOrderPlayers = [];
  let syncedTurnOrderRolls = {};
  let syncedTurnOrderOrder = [];
  let syncedTurnOrderSuggested = [];
  let syncedTurnOrderTiePlayerIds = [];
  let simulationUiHandlersInstalled = false;
  let phaseControlMessage = "";
  let opponentBoardIndex = 0;
  let opponentOverlayOpen = false;
  let opponentSwipeStart = null;
  let toolContextOverride = "";
  let quickPanelOpen = "";
  let hudBadgePositions = cloneHudBadgePositions(HUD_BADGE_DEFAULTS);
  let hudBadgeDrag = null;
  let hudBadgesLocked = false;
  let manaAutoCloseTimer = null;
  const expandedStackIds = new Set();
  const permanentGestureState = new Map();
  let lifeGesture = null;
  let commanderGesture = null;
  let modifierGesture = null;
  let modifierPanelOpen = false;
  let trackerModifier = cloneTrackerModifier(DEFAULT_TRACKER_MODIFIER);
  let pendingTrackerModifier = cloneTrackerModifier(DEFAULT_TRACKER_MODIFIER);
  let lifeZoomGuardsInstalled = false;
  let lastLifeTouchEnd = 0;
  let helperMessage = null;
  let helperFadeTimer = null;
  let helperHideTimer = null;
  let helperDismissCooldown = new Map();
  let confirmationDialog = null;
  let uiNotice = null;
  let manualChoicePanelCollapsed = false;
  let globalDismissHandlersInstalled = false;
  let outsideDismissPointerStart = null;
  let suppressNextOutsideDismissClickUntil = 0;
  let viewportRerenderTimer = null;
  let lastRenderedSearchQuery = searchQuery;
  let castActionPopup = null;
  let backgroundScrollLockY = null;

  normalizeCurrentHash();
  window.addEventListener("hashchange", handleHashChange);
  window.addEventListener("resize", handleViewportChange, { passive: true });
  window.addEventListener("orientationchange", handleViewportChange);
  store.subscribe(render);
  render(store.getState());

  function render(profile) {
    const searchFocusSnapshot = captureSearchFocusState();
    const preserveSearchResultsScroll = searchQuery === lastRenderedSearchQuery;
    const searchResultsScrollTop = preserveSearchResultsScroll ? captureSearchResultsScrollTop(root) : 0;
    const viewportScrollSnapshot = captureViewportScroll(root);
    const temporaryScrollSnapshot = captureTemporaryScrollState(root, { preserveSearchResultsScroll });
    const openDetailsSnapshot = captureOpenDetailsState(root);
    const visiblePages = getVisiblePages(profile);
    const toolContext = resolveToolContext(profile.activeSession, toolContextOverride);
    const uiLayerState = resolveUiLayerState(profile, activePage, {
      activeToolPanel,
      toolMenuOpen,
      floatingManaOpen,
      utilityDockOpen,
      activeUtilityPanel,
      quickPanelOpen,
      optionsOpen,
      statsOpen,
      simulationSetupOpen,
      simulationStatsOpen,
      syncedTurnOrderSetupOpen,
    });
    if (!visiblePages.includes(activePage)) {
      activePage = activePage === "profile" ? "profile" : visiblePages[0] || "life";
    }
    const opponentBoards = getOpponentBoards(profile);
    if (!opponentBoards.length) {
      opponentBoardIndex = 0;
      opponentOverlayOpen = false;
    } else if (opponentBoardIndex >= opponentBoards.length) {
      opponentBoardIndex = 0;
    }
    if (Array.isArray(profile.settings?.multiplayer?.selectedSimulatedOpponents) && profile.settings.multiplayer.selectedSimulatedOpponents.length) {
      simulationSelectedOpponents = new Set(profile.settings.multiplayer.selectedSimulatedOpponents);
    }
    if (profile.settings?.multiplayer?.simulatedSpeed) {
      simulationSelectedSpeed = profile.settings.multiplayer.simulatedSpeed;
    }
    if (typeof profile.settings?.multiplayer?.simulationRevenge === "boolean") {
      simulationRevengeEnabled = Boolean(profile.settings.multiplayer.simulationRevenge);
    }
    const syncedTurnOrderState = profile.activeSession?.syncedMultiplayer || {};
    if (!syncedTurnOrderSetupOpen && !syncedTurnOrderOrder.length && Array.isArray(syncedTurnOrderState.turnOrder) && syncedTurnOrderState.turnOrder.length) {
      syncedTurnOrderOrder = [...syncedTurnOrderState.turnOrder];
    }
    if (!syncedTurnOrderSetupOpen && !Object.keys(syncedTurnOrderRolls).length && syncedTurnOrderState.rolls && Object.keys(syncedTurnOrderState.rolls).length) {
      syncedTurnOrderRolls = { ...syncedTurnOrderState.rolls };
    }
    if (!syncedTurnOrderSetupOpen && !syncedTurnOrderPlayers.length && Array.isArray(syncedTurnOrderState.players) && syncedTurnOrderState.players.length) {
      syncedTurnOrderPlayers = [...syncedTurnOrderState.players];
      syncedTurnOrderSuggested = [...(syncedTurnOrderState.suggestedTurnOrder || [])];
      syncedTurnOrderTiePlayerIds = [...(syncedTurnOrderState.tiePlayerIds || [])];
    }
    if (profile.activeSession?.simulation?.enabled && profile.activeSession?.simulation?.status !== "idle") {
      simulationSetupOpen = false;
      simulationSetupError = "";
    } else {
      simulationLogOpen = false;
    }
    if (
      !(profile.activeSession?.pendingEffects || []).some(
        (entry) => !["resolved", "skipped", "ignored"].includes(entry.status)
      )
    ) {
      manualChoicePanelCollapsed = false;
    }
    const navigationSettings = profile.settings?.navigation || {};
    hudBadgePositions = mergeHudBadgePositions(navigationSettings.hudBadgePositions);
    const resolvedCompositionMode = resolveCompositionMode(profile);
    if (resolvedCompositionMode === "mobile") {
      hudBadgePositions = Object.fromEntries(
        Object.entries(hudBadgePositions).map(([key, position]) => [
          key,
          clampHudBadgePosition(key, Number(position?.x || 0), Number(position?.y || 0)),
        ])
      );
    }
    hudBadgesLocked = Boolean(navigationSettings.hudBadgesLocked);
    helperMessage = resolveHelperSpriteMessage(profile, activePage);
    if (castActionPopup) {
      const popupIndex = searchResults.findIndex(
        (card) => (card.cardId || card.name) === castActionPopup.cardId
      );
      castActionPopup = popupIndex >= 0 ? { ...castActionPopup, index: popupIndex } : null;
    }
    document.body.dataset.composition = resolvedCompositionMode;
    document.body.dataset.compositionPreference = profile.settings?.appearance?.compositionMode || "auto";
    document.body.dataset.page = activePage;
    document.body.dataset.uiLayer = uiLayerState.current;
    root.innerHTML = layout(profile, activePage, searchResults, searchMessage, {
      optionsOpen,
      statsOpen,
      statsMode,
      toolMenuOpen,
      floatingManaOpen,
      activeToolPanel,
      toolContext,
      utilityDockOpen,
      activeUtilityPanel,
      quickPanelOpen,
      modifierPanelOpen,
      trackerModifier,
      pendingTrackerModifier,
      visiblePages,
      expandedStackIds: [...expandedStackIds],
      uiLayerState,
      searchLoading,
      searchQuery,
      combatResolving,
      phaseAdvancePending,
      phaseControlMessage,
      helperMessage,
      simulationSetupOpen,
      simulationLogOpen,
      castActionPopup,
      simulationSelectedOpponents: [...simulationSelectedOpponents],
      simulationSelectedSpeed,
      simulationRevengeEnabled,
      simulationSetupError,
      simulationStatsOpen,
      isMobilePortrait: resolvedCompositionMode === "mobile",
      hudBadgePositions,
      hudBadgesLocked,
      syncedTurnOrderSetupOpen,
      syncedTurnOrderError,
      syncedTurnOrderPlayers,
      syncedTurnOrderRolls,
      syncedTurnOrderOrder,
      syncedTurnOrderSuggested,
      syncedTurnOrderTiePlayerIds,
      opponentBoardIndex,
      opponentOverlayOpen,
      confirmationDialog,
      uiNotice,
      manualChoicePanelCollapsed,
    });
    bind(root, profile);
    installGlobalDismissHandlers();
    installSimulationUiHandlers();
    scheduleManaAutoClose(profile);
    installLifeZoomGuards();
    restoreViewportScroll(root, viewportScrollSnapshot);
    restoreTemporaryScrollState(root, temporaryScrollSnapshot);
    restoreOpenDetailsState(root, openDetailsSnapshot);
    restoreSearchInputFocus(root, searchFocusSnapshot, searchResultsScrollTop);
    syncBackgroundScrollLock();
    lastRenderedSearchQuery = searchQuery;
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
        amount: Number(button.dataset.delta || 0),
      });
      bindTouchAction(button, action);
      bindLongPressRepeat(button, action);
    });
    container.querySelectorAll("[data-commander-damage]").forEach((button) => {
      const action = () => ({
        type: "COMMANDER_DAMAGE_DELTA",
        opponentId: "opponent",
        amount: Number(button.dataset.delta || 0),
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
          if (eventName === "pointerup" && modifierGesture && !modifierPanelOpen) {
            applyTrackerModifier();
          }
          modifierGesture = null;
        });
      });
    }
    container.querySelectorAll("[data-modifier-option]").forEach((button) => {
      button.addEventListener("click", () => {
        pendingTrackerModifier = {
          ...pendingTrackerModifier,
          kind: "delta",
          value: Number(button.dataset.modifierOption),
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
      const custom = Number(container.querySelector("[data-modifier-custom]")?.value);
      if (Number.isFinite(custom) && custom !== 0) {
        pendingTrackerModifier = { ...pendingTrackerModifier, kind: "delta", value: custom };
      }
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
      closeAllTemporaryUi({ renderAfter: false });
      floatingManaOpen = !shouldClose;
      if (manaPinned && shouldClose) {
        store.dispatch({ type: "SET_SETTING", path: "battlefield.manaPinned", value: false });
      }
      render(store.getState());
    });
    container.querySelectorAll("[data-open-tool-panel]").forEach((button) => {
      button.addEventListener("click", () => {
        closeAllTemporaryUi({ renderAfter: false });
        activeToolPanel = button.dataset.openToolPanel;
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
    container.querySelectorAll("[data-set-tool-context]").forEach((button) => {
      button.addEventListener("click", (event) => {
        const enforceDirectTarget = button.matches(".arena, .opponent-zone");
        if (enforceDirectTarget && event.target !== button) {
          return;
        }
        toolContextOverride = button.dataset.setToolContext || "";
        activeToolPanel = "";
        toolMenuOpen = false;
        render(store.getState());
      });
    });
    container.querySelectorAll("[data-open-game-options]").forEach((button) =>
      button.addEventListener("click", () => {
        closeAllTemporaryUi({ renderAfter: false });
        optionsOpen = true;
        render(store.getState());
      })
    );
    container.querySelectorAll("[data-open-simulation-setup]").forEach((button) =>
      button.addEventListener("click", (event) => {
        if (Date.now() < simulationSetupSuppressOpenUntil) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        closeAllTemporaryUi({ renderAfter: false });
        simulationSetupError = "";
        simulationSetupOpen = true;
        render(store.getState());
      })
    );
    container.querySelectorAll("[data-start-game-tracking]").forEach((button) =>
      button.addEventListener("click", () => {
        const tracking = store.getState().activeSession?.gameTracking || {};
        store.dispatch({ type: tracking.active ? "STOP_GAME_TRACKING" : "START_GAME_TRACKING" });
      })
    );
    container.querySelectorAll("[data-close-simulation-setup]").forEach((button) =>
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeSimulationSetup();
      })
    );
    container.querySelectorAll("[data-simulation-setup-backdrop]").forEach((backdrop) =>
      backdrop.addEventListener("click", (event) => {
        if (event.target !== backdrop) {
          return;
        }
        closeSimulationSetup();
      })
    );
    container.querySelectorAll("[data-simulation-log-toggle]").forEach((button) =>
      button.addEventListener("click", () => {
        simulationLogOpen = !simulationLogOpen;
        if (activePage !== "battlefield") {
          activePage = "battlefield";
          normalizeCurrentHash();
        }
        toolMenuOpen = false;
        activeToolPanel = "simulation";
        render(store.getState());
      })
    );
    container.querySelectorAll("[data-simulation-speed-control]").forEach((button) =>
      button.addEventListener("click", () => {
        store.dispatch({ type: "SIMULATION_SET_SPEED", speed: button.dataset.simulationSpeedControl || "normal" });
      })
    );
    container.querySelectorAll("[data-sim-opponent]").forEach((input) =>
      input.addEventListener("change", () => {
        if (input.checked) {
          simulationSelectedOpponents.add(input.dataset.simOpponent);
        } else {
          simulationSelectedOpponents.delete(input.dataset.simOpponent);
        }
      })
    );
    container.querySelectorAll("[data-sim-speed]").forEach((input) =>
      input.addEventListener("change", () => {
        if (input.checked) {
          simulationSelectedSpeed = input.dataset.simSpeed || "normal";
        }
      })
    );
    container.querySelectorAll("[data-sim-revenge]").forEach((input) =>
      input.addEventListener("change", () => {
        simulationRevengeEnabled = input.checked;
      })
    );
    container.querySelectorAll("[data-open-simulation-stats]").forEach((button) =>
      button.addEventListener("click", () => {
        simulationStatsOpen = true;
        render(store.getState());
      })
    );
    container.querySelectorAll("[data-close-simulation-stats]").forEach((button) =>
      button.addEventListener("click", () => {
        simulationStatsOpen = false;
        render(store.getState());
      })
    );
    container.querySelectorAll("[data-start-simulation]").forEach((button) =>
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        startSimulationFromSetup();
      })
    );
    container.querySelectorAll("[data-simulation-pause]").forEach((button) =>
      button.addEventListener("click", () => store.dispatch({ type: "SIMULATION_PAUSE" }))
    );
    container.querySelectorAll("[data-simulation-resume]").forEach((button) =>
      button.addEventListener("click", () => store.dispatch({ type: "SIMULATION_RESUME" }))
    );
    container.querySelectorAll("[data-simulation-stop]").forEach((button) =>
      button.addEventListener("click", () => store.dispatch({ type: "SIMULATION_STOP" }))
    );
    container.querySelectorAll("[data-end-game]").forEach((button) =>
      button.addEventListener("click", () => {
        openConfirmation({
          id: "end-game",
          title: "End active game?",
          message: "This stops active tracking or Dry Run automation while preserving logs and stats.",
          confirmLabel: "End Game",
          danger: true,
        });
      })
    );
    container.querySelectorAll("[data-simulation-pass-turn]").forEach((button) =>
      button.addEventListener("click", () => store.dispatch({ type: "SIMULATION_PASS_TURN" }))
    );
    container.querySelectorAll("[data-opponent-nav]").forEach((button) =>
      button.addEventListener("click", () => {
        const direction = button.dataset.opponentNav === "next" ? 1 : -1;
        const boards = getOpponentBoards(store.getState());
        if (!boards.length) {
          return;
        }
        opponentBoardIndex = (opponentBoardIndex + direction + boards.length) % boards.length;
        render(store.getState());
      })
    );
    container.querySelectorAll("[data-open-opponent-overlay]").forEach((button) =>
      button.addEventListener("click", () => {
        opponentOverlayOpen = true;
        render(store.getState());
      })
    );
    container.querySelectorAll("[data-close-opponent-overlay]").forEach((button) =>
      button.addEventListener("click", () => {
        opponentOverlayOpen = false;
        render(store.getState());
      })
    );
    container.querySelectorAll("[data-opponent-permanent]").forEach((button) =>
      button.addEventListener("click", () => {
        const id = button.dataset.opponentPermanent;
        if (!id) {
          return;
        }
        toolContextOverride = "permanent";
        store.dispatch({ type: "SELECT_PERMANENT", id });
      })
    );
    container.querySelectorAll("[data-opponent-swipe]").forEach((panel) => {
      panel.addEventListener("pointerdown", (event) => {
        opponentSwipeStart = { x: event.clientX, y: event.clientY };
      });
      panel.addEventListener("pointerup", (event) => {
        if (!opponentSwipeStart) {
          return;
        }
        const dx = event.clientX - opponentSwipeStart.x;
        const dy = event.clientY - opponentSwipeStart.y;
        opponentSwipeStart = null;
        if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.2) {
          return;
        }
        const boards = getOpponentBoards(store.getState());
        if (!boards.length) {
          return;
        }
        opponentBoardIndex = (opponentBoardIndex + (dx < 0 ? 1 : -1) + boards.length) % boards.length;
        render(store.getState());
      });
    });
    container.querySelectorAll("[data-tool-menu], [data-open-tool-menu]").forEach((button) =>
      button.addEventListener("click", () => {
        const nextOpen = !toolMenuOpen;
        closeAllTemporaryUi({ renderAfter: false });
        toolMenuOpen = nextOpen;
        render(store.getState());
      })
    );
    bindDraggableHudBadges(container);
    container.querySelector("[data-app-shell]")?.addEventListener("pointerdown", (event) => {
      if (!isMobileViewMode() || isSwipeBlockedTarget(event.target)) {
        return;
      }
      swipeStart = { x: event.clientX, y: event.clientY };
    });
    container.querySelector("[data-app-shell]")?.addEventListener("pointerup", (event) => {
      if (!isMobileViewMode() || !swipeStart || isSwipeBlockedTarget(event.target)) {
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
    container.querySelector("[data-app-shell]")?.addEventListener("pointercancel", () => {
      swipeStart = null;
    });
    container.querySelectorAll("[data-game-options]").forEach((button) =>
      button.addEventListener("click", () => {
        closeAllTemporaryUi({ renderAfter: false });
        optionsOpen = true;
        render(store.getState());
      })
    );
    container.querySelectorAll("[data-close-overlay]").forEach((button) => {
      button.addEventListener("click", () => {
        optionsOpen = false;
        statsOpen = false;
        syncedTurnOrderSetupOpen = false;
        syncedTurnOrderError = "";
        render(store.getState());
      });
    });
    container.querySelector("[data-profile-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = new FormData(event.currentTarget).get("profileName");
      store.dispatch({ type: "SET_PLAYER_NAME", name });
    });
    container.querySelector("[data-create-password-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = String(new FormData(event.currentTarget).get("password") || "");
      if (password.length < 4) {
        alert("Use at least 4 characters for local device protection.");
        return;
      }
      await store.createPassword(password);
    });
    container.querySelector("[data-login-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = String(new FormData(event.currentTarget).get("password") || "");
      try {
        await store.login(password);
      } catch {
        alert("Password did not match this local profile.");
      }
    });
    container.querySelector("[data-guest-mode]")?.addEventListener("click", () => store.continueGuest());
    container.querySelector("[data-lock-profile]")?.addEventListener("click", () => store.lockProfile());
    container.querySelector("[data-open-profile-page]")?.addEventListener("click", () => {
      optionsOpen = false;
      setActivePage("profile");
    });
    container.querySelectorAll("[data-setting-toggle]").forEach((input) => {
      input.addEventListener("change", () => store.dispatch({ type: "SET_SETTING", path: input.dataset.settingToggle, value: input.checked }));
    });
    container.querySelectorAll("[data-reset-hud-layout]").forEach((button) =>
      button.addEventListener("click", () => {
        openConfirmation({
          id: "reset-hud-layout",
          title: "Reset HUD layout?",
          message: "Floating badge positions return to their safe defaults.",
          confirmLabel: "Reset Layout",
        });
      })
    );
    container.querySelector("[data-helper-remind]")?.addEventListener("click", () => {
      const messages = collectHelperCandidateMessages(store.getState(), activePage)
        .slice(0, 8)
        .map((entry) => ({ key: entry.key, text: entry.text, source: entry.source }));
      store.dispatch({ type: "HELPER_REMIND_ME", messages });
    });
    container.querySelectorAll("[data-multiplayer-mode]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "SET_MULTIPLAYER_MODE", mode: button.dataset.multiplayerMode }));
    });
    container.querySelectorAll("[data-mp-setting]").forEach((input) => {
      input.addEventListener("change", () =>
        store.dispatch({
          type: "SET_SETTING",
          path: input.dataset.mpSetting,
          value: input.type === "checkbox" ? input.checked : input.value,
        })
      );
    });
    container.querySelectorAll("[data-open-synced-turn-order-setup]").forEach((button) =>
      button.addEventListener("click", () => {
        openSyncedTurnOrderSetup();
      })
    );
    container.querySelectorAll("[data-close-synced-turn-order-setup]").forEach((button) =>
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeSyncedTurnOrderSetup();
      })
    );
    container.querySelectorAll("[data-synced-turn-order-backdrop]").forEach((backdrop) =>
      backdrop.addEventListener("click", (event) => {
        if (event.target !== backdrop) {
          return;
        }
        closeSyncedTurnOrderSetup();
      })
    );
    container.querySelectorAll("[data-roll-synced-turn-order]").forEach((button) =>
      button.addEventListener("click", () => {
        rollSyncedTurnOrder();
      })
    );
    container.querySelectorAll("[data-reroll-synced-turn-ties]").forEach((button) =>
      button.addEventListener("click", () => {
        rerollSyncedTurnOrderTies();
      })
    );
    container.querySelectorAll("[data-move-synced-turn-order]").forEach((button) =>
      button.addEventListener("click", () => {
        const playerId = button.dataset.playerId;
        const direction = button.dataset.moveSyncedTurnOrder === "up" ? -1 : 1;
        moveSyncedTurnOrderPlayer(playerId, direction);
      })
    );
    container.querySelectorAll("[data-confirm-synced-turn-order]").forEach((button) =>
      button.addEventListener("click", () => {
        confirmSyncedTurnOrder();
      })
    );
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
        if (action === "inspect") {
          activeToolPanel = "inspect";
          render(store.getState());
          return;
        }
        if (action === "tap" || action === "untap") {
          store.dispatch({ type: "SET_SELECTED_TAPPED", tapped: action === "tap" });
          return;
        }
        if (action === "clear") {
          store.dispatch({ type: "CLEAR_SELECTION" });
          return;
        }
        if (["destroy", "exile", "sacrifice", "bounce", "remove", "remove token"].includes(action)) {
          const selectedPermanents = getSelectedPermanents(store.getState().activeSession);
          const stacked = selectedPermanents.filter((permanent) => Number(permanent.quantity || 1) > 1);
          if (!stacked.length) {
            store.dispatch({ type: "REMOVE_SELECTED", mode: action, countMode: "all", count: 1 });
            return;
          }
          const modeFromPanel = container.querySelector("[data-stack-remove-mode]")?.value || action;
          const countMode = button.dataset.countMode || "custom";
          const removalPayload = resolveStackRemovalRequest(stacked, countMode);
          if (!removalPayload) {
            return;
          }
          store.dispatch({
            type: "REMOVE_SELECTED",
            mode: modeFromPanel,
            countMode: removalPayload.countMode,
            count: removalPayload.count,
            countById: removalPayload.countById,
          });
          return;
        }
        store.dispatch({ type: "REMOVE_SELECTED", mode: action });
      });
    });
    container.querySelectorAll("[data-stack-remove]").forEach((button) => {
      button.addEventListener("click", () => {
        const selectedPermanents = getSelectedPermanents(store.getState().activeSession);
        const stacked = selectedPermanents.filter((permanent) => Number(permanent.quantity || 1) > 1);
        if (!stacked.length) {
          return;
        }
        const mode = container.querySelector("[data-stack-remove-mode]")?.value || "destroy";
        const countMode = button.dataset.stackRemove || "custom";
        const removalPayload = resolveStackRemovalRequest(stacked, countMode);
        if (!removalPayload) {
          return;
        }
        store.dispatch({
          type: "REMOVE_SELECTED",
          mode,
          countMode: removalPayload.countMode,
          count: removalPayload.count,
          countById: removalPayload.countById,
        });
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
    container.querySelector("[data-token-remove-selected]")?.addEventListener("click", () => {
      store.dispatch({ type: "REMOVE_SELECTED", mode: "remove token" });
    });
    container.querySelector("[data-open-life-quick]")?.addEventListener("click", () => {
      quickPanelOpen = "life";
      render(store.getState());
    });
    container.querySelector("[data-open-commander-quick]")?.addEventListener("click", () => {
      quickPanelOpen = "commander";
      render(store.getState());
    });
    container.querySelectorAll("[data-player-life-delta]").forEach((button) => {
      const action = () => ({ type: "LIFE_DELTA", amount: Number(button.dataset.playerLifeDelta || 0) });
      bindTouchAction(button, action);
      bindLongPressRepeat(button, action);
    });
    container.querySelectorAll("[data-player-counter-delta]").forEach((button) => {
      const action = () => ({
        type: "PLAYER_COUNTER_DELTA",
        counter: button.dataset.playerCounterDelta,
        amount: Number(button.dataset.delta || 0),
      });
      bindTouchAction(button, action);
      bindLongPressRepeat(button, action);
    });
    container.querySelector("[data-save-player-note]")?.addEventListener("click", () => {
      const note = String(container.querySelector("[data-player-note-input]")?.value || "").trim();
      store.dispatch({ type: "SET_SETTING", path: "playerNotes.session", value: note });
    });
    container.querySelectorAll("[data-activate-board]").forEach((button) => {
      button.addEventListener("click", () => {
        store.dispatch({ type: "ACTIVATE_BOARD" });
        showNotice("Board activation check complete. Review the queue for any available effects.", "info");
      });
    });

    container.querySelectorAll("[data-life-delta]").forEach((button) => {
      const action = () => ({ type: "LIFE_DELTA", amount: Number(button.dataset.lifeDelta || 0) });
      bindTouchAction(button, action);
      bindLongPressRepeat(button, action);
    });
    container.querySelector("[data-life-set]")?.addEventListener("click", () => {
      const value = prompt("Set life total", String(profile.activeSession.life));
      if (value !== null) {
        dispatchWithFeedback({ type: "SET_LIFE", life: value }, true);
      }
    });
    container.querySelector("[data-life-reset]")?.addEventListener("click", () =>
      openConfirmation({
        id: "reset-life-trackers",
        title: "Reset life and trackers?",
        message: "Life returns to 40 and player counters/commander damage are reset.",
        confirmLabel: "Reset Trackers",
        danger: true,
      })
    );
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
    container.querySelector("[data-redo]")?.addEventListener("click", () => store.dispatch({ type: "REDO" }));
    container.querySelectorAll("[data-next-phase]").forEach((button) => {
      if (phaseAdvancePending) {
        button.disabled = true;
        button.dataset.phaseLabel = button.textContent || "Next Phase";
        button.textContent = "Advancing…";
      }
      button.addEventListener("click", () => {
        advancePhaseFromUi();
      });
    });
    container.querySelector(".battlefield-mobile-dock")?.addEventListener("click", (event) => {
      if (event.target.closest("button")) {
        return;
      }
      const centerButton = container.querySelector(".battlefield-wheel-center[data-next-phase]");
      const bounds = centerButton?.getBoundingClientRect();
      if (!bounds) {
        return;
      }
      if (event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom) {
        event.preventDefault();
        advancePhaseFromUi();
      }
    });
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
      button.addEventListener("click", (event) => {
        if (profile.settings?.gestures?.advanced) {
          event.preventDefault();
          return;
        }
        toolContextOverride = "";
        store.dispatch({ type: "SELECT_PERMANENT", id: button.dataset.permanent });
      });
    });
    container.querySelectorAll("[data-toggle-stack]").forEach((button) => {
      button.addEventListener("click", () => {
        const stackId = button.dataset.toggleStack;
        if (!stackId) {
          return;
        }
        if (expandedStackIds.has(stackId)) {
          expandedStackIds.delete(stackId);
        } else {
          expandedStackIds.add(stackId);
        }
        render(store.getState());
      });
    });
    container.querySelectorAll("[data-set-detail-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        store.dispatch({ type: "SET_SETTING", path: "battlefield.detailMode", value: button.dataset.setDetailMode });
      });
    });
    container.querySelectorAll("[data-set-compression-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        store.dispatch({ type: "SET_SETTING", path: "battlefield.compressionMode", value: button.dataset.setCompressionMode });
      });
    });
    container.querySelectorAll("[data-tap]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "TOGGLE_TAPPED", id: button.dataset.tap }));
    });
    container.querySelectorAll("[data-counter]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "ADD_COUNTER", id: button.dataset.counter, counterType: "+1/+1", amount: 1 }));
    });
    container.querySelectorAll("[data-declare-attackers]").forEach((button) => {
      button.addEventListener("click", () => {
        const selectedIds = profile.activeSession.selectedIds || [];
        if (button.dataset.dashboardAction === "attackers" && !selectedIds.length) {
          showNotice("Select one or more attacking creatures, then tap Attackers.", "info");
          return;
        }
        store.dispatch({ type: "DECLARE_ATTACKERS", ids: selectedIds });
      });
    });
    container.querySelectorAll("[data-resolve-combat]").forEach((button) => {
      button.addEventListener("click", () => {
        if (combatResolving) {
          return;
        }
        const session = profile.activeSession;
        const spellStack = session.stack || [];
        const queued = session.triggerQueue || [];
        const pending = session.pendingEffects || [];
        const hasCombatToResolve = Boolean((session.combat?.attackers || []).length || session.combat?.damagePreview);
        if (button.dataset.dashboardAction === "resolve") {
          if (spellStack.length) {
            store.dispatch({ type: "RESOLVE_TOP_SPELL", stackId: spellStack[0].id });
            showNotice("Resolving the top spell on the stack.", "info");
            return;
          }
          if (queued.length) {
            activeUtilityPanel = "stack";
            utilityDockOpen = false;
            showNotice("Stack and trigger queue opened for resolution.", "info");
            render(store.getState());
            return;
          }
          if (pending.length) {
            showNotice("Manual choice required before this effect can resolve.", "warning");
            render(store.getState());
            return;
          }
          if (!hasCombatToResolve) {
            showNotice("Nothing is pending to resolve right now.", "info");
            return;
          }
        }
        combatResolving = true;
        render(store.getState());
        requestAnimationFrame(() => {
          setTimeout(() => {
            store.dispatch({ type: "RESOLVE_COMBAT" });
            combatResolving = false;
            render(store.getState());
          }, 0);
        });
      });
    });

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

    container.querySelectorAll("[data-export]").forEach((button) => button.addEventListener("click", () => downloadProfile(profile)));
    container.querySelectorAll("[data-import]").forEach((input) => input.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      try {
        const text = await file.text();
        const importedProfile = parseImportedProfile(text);
        openConfirmation({
          id: "import-profile",
          title: "Import profile over current data?",
          message: "This replaces the current local profile after validation.",
          confirmLabel: "Import Profile",
          danger: true,
          payload: importedProfile,
        });
      } catch (error) {
        addRecovery({
          source: "Profile Import",
          message: "Import failed because the selected file was not a valid BoardState profile.",
          technicalMessage: error?.message || String(error),
          severity: "error",
          suggestedAction: "Choose a valid exported BoardState profile JSON file.",
        });
      } finally {
        event.target.value = "";
      }
    }));

    container.querySelectorAll("[data-confirm-action]").forEach((button) =>
      button.addEventListener("click", () => runConfirmationAction(button.dataset.confirmAction))
    );
    container.querySelectorAll("[data-cancel-confirmation]").forEach((button) =>
      button.addEventListener("click", () => {
        confirmationDialog = null;
        render(store.getState());
      })
    );
    container.querySelectorAll("[data-dismiss-recovery]").forEach((button) =>
      button.addEventListener("click", () => store.dispatch({ type: "DISMISS_RECOVERY_ENTRY", id: button.dataset.dismissRecovery }))
    );
    container.querySelectorAll("[data-recovery-retry]").forEach((button) =>
      button.addEventListener("click", () => {
        if (searchQuery) {
          runScryfallSearch(searchQuery, store.getState(), true);
        } else {
          showNotice("Retry requested.");
        }
      })
    );
    container.querySelectorAll("[data-recovery-cached]").forEach((button) =>
      button.addEventListener("click", () => showNotice("Using available cached data."))
    );
    container.querySelectorAll("[data-copy-recovery]").forEach((button) =>
      button.addEventListener("click", async () => {
        const entry = (store.getState().activeSession?.recoveryLog || []).find((item) => item.id === button.dataset.copyRecovery);
        await copyOrDownloadText("boardstate-recovery-entry.json", safeJson(entry || {}), "Recovery details copied.");
      })
    );
    container.querySelector("[data-copy-game-log]")?.addEventListener("click", async () => {
      await copyOrDownloadText("boardstate-game-log.json", safeJson(buildGameLog(store.getState())), "Game log copied.");
    });
    container.querySelector("[data-copy-debug-state]")?.addEventListener("click", async () => {
      await copyOrDownloadText("boardstate-debug-state.json", safeJson(buildDebugState(store.getState(), activePage)), "Debug state copied.");
    });
    container.querySelector("[data-export-bug-report]")?.addEventListener("click", async () => {
      const text = safeJson(buildBugReport(store.getState(), activePage));
      downloadText(`boardstate-bug-report-${new Date().toISOString().slice(0, 10)}.json`, text, "application/json");
      await copyOrDownloadText("boardstate-bug-report.json", text, "Bug report exported.");
    });
    container.querySelector("[data-load-tutorial-sample]")?.addEventListener("click", () => {
      const session = store.getState().activeSession;
      const hasBoard = (session.battlefield?.player || []).length || (session.battlefield?.opponent || []).length || session.gameTracking?.active || session.simulation?.enabled;
      if (hasBoard) {
        openConfirmation({
          id: "load-tutorial-sample",
          title: "Load tutorial sample board?",
          message: "This replaces the visible battlefield with a small training board. Active games are not deleted, but the current board view changes.",
          confirmLabel: "Load Tutorial",
          danger: true,
        });
        return;
      }
      store.dispatch({ type: "LOAD_TUTORIAL_SAMPLE_BOARD" });
      setActivePage("battlefield");
      showNotice("Tutorial sample board loaded.");
    });
    container.querySelector("[data-exit-tutorial]")?.addEventListener("click", () => {
      store.dispatch({ type: "CLEAR_TUTORIAL" });
      showNotice("Tutorial closed.");
    });
    container.querySelector("[data-clear-game-history]")?.addEventListener("click", () =>
      openConfirmation({
        id: "clear-game-history",
        title: "Clear game history?",
        message: "This clears current action/effect history without clearing simulation learning.",
        confirmLabel: "Clear History",
        danger: true,
      })
    );
    container.querySelector("[data-clear-simulation-learning]")?.addEventListener("click", () =>
      openConfirmation({
        id: "clear-simulation-learning",
        title: "Clear simulation learning?",
        message: "Dry Run revenge memory resets, but normal game history stays intact.",
        confirmLabel: "Clear Learning",
        danger: true,
      })
    );
    container.querySelector("[data-reset-settings]")?.addEventListener("click", () =>
      openConfirmation({
        id: "reset-settings",
        title: "Reset settings?",
        message: "HUD, accessibility, and page settings return to defaults.",
        confirmLabel: "Reset Settings",
      })
    );
    container.querySelector("[data-reset-all-local-data]")?.addEventListener("click", () =>
      openConfirmation({
        id: "reset-all-local-data",
        title: "Reset all local data?",
        message: "This clears local BoardState data in this profile. Export first if you want a backup.",
        confirmLabel: "Reset Everything",
        danger: true,
      })
    );

    container.querySelectorAll("[data-search-form]").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const query = new FormData(event.currentTarget).get("query");
        searchQuery = String(query || "");
        keepSearchInputFocus = true;
        await runScryfallSearch(query, store.getState(), true);
      });
    });
    const searchInputs = [...container.querySelectorAll("[data-search-query]")];
    const searchInput = searchInputs.find((input) => input === document.activeElement) || searchInputs[0] || null;
    searchInputs.forEach((input) => {
      input.addEventListener("focus", () => {
        keepSearchInputFocus = Date.now() >= suppressSearchRefocusUntil;
      });
      input.addEventListener("blur", () => {
        if (Date.now() >= suppressSearchRefocusUntil) {
          keepSearchInputFocus = false;
        }
      });
      input.addEventListener("input", (event) => {
        const query = event.target.value;
        searchQuery = String(query || "");
        keepSearchInputFocus = true;
        searchSelection = {
          start: event.target.selectionStart,
          end: event.target.selectionEnd,
          direction: event.target.selectionDirection || "none",
        };
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
          runScryfallSearch(query, store.getState(), false);
        }, 220);
      });
    });
    container.querySelector(".search-results")?.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      keepSearchInputFocus = true;
      searchSelection = {
        start: searchInput?.selectionStart,
        end: searchInput?.selectionEnd,
        direction: searchInput?.selectionDirection || "none",
      };
    });
    container.querySelector(".search-results")?.addEventListener("touchstart", (event) => {
      event.stopPropagation();
    });

    container.querySelectorAll("[data-add-result]").forEach((button) => {
      button.addEventListener("click", () => {
        keepSearchInputFocus = false;
        suppressSearchRefocusUntil = Date.now() + 600;
        store.dispatch({ type: "ADD_PERMANENT", card: searchResults[Number(button.dataset.addResult)] });
        showNotice("Card put onto battlefield.");
      });
    });
    container.querySelectorAll("[data-cast-result]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const index = Number(button.dataset.castResult);
        const card = searchResults[index];
        if (!card) {
          showNotice("Card could not be found in the current search results.", "warning");
          return;
        }
        castActionPopup =
          castActionPopup?.index === index
            ? null
            : { index, cardId: card.cardId || card.name, opponent: false };
        render(store.getState());
      });
    });
    container.querySelectorAll("[data-cast-owner-opponent]").forEach((input) => {
      input.addEventListener("change", () => {
        if (!castActionPopup) {
          return;
        }
        castActionPopup = { ...castActionPopup, opponent: Boolean(input.checked) };
        render(store.getState());
      });
    });
    container.querySelectorAll("[data-cast-action-zone]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.castActionIndex);
        const sourceZone = button.dataset.castActionZone || "hand";
        const controller = castActionPopup?.opponent ? "opponent" : "player";
        castActionPopup = null;
        castSearchCard(index, sourceZone, controller);
      });
    });
    container.querySelectorAll("[data-cast-action-put]").forEach((button) => {
      button.addEventListener("click", () => {
        keepSearchInputFocus = false;
        suppressSearchRefocusUntil = Date.now() + 600;
        const index = Number(button.dataset.castActionPut);
        const card = searchResults[index];
        const controller = castActionPopup?.opponent ? "opponent" : "player";
        castActionPopup = null;
        if (!card) {
          showNotice("Card could not be found in the current search results.", "warning");
          return;
        }
        store.dispatch({ type: "ADD_PERMANENT", card, controller });
        showNotice(`Card put onto ${controller === "opponent" ? "opponent " : ""}battlefield without being cast.`);
      });
    });
    container.querySelectorAll("[data-put-result]").forEach((button) => {
      button.addEventListener("click", () => {
        keepSearchInputFocus = false;
        suppressSearchRefocusUntil = Date.now() + 600;
        store.dispatch({ type: "ADD_PERMANENT", card: searchResults[Number(button.dataset.putResult)] });
        showNotice("Card put onto battlefield without being cast.");
      });
    });
    container.querySelectorAll("[data-commander-result]").forEach((button) => {
      button.addEventListener("click", () => {
        keepSearchInputFocus = false;
        suppressSearchRefocusUntil = Date.now() + 600;
        store.dispatch({ type: "SET_COMMANDER", card: searchResults[Number(button.dataset.commanderResult)] });
        showNotice("Commander updated.");
      });
    });
    container.querySelectorAll("[data-deck-result]").forEach((button) => {
      button.addEventListener("click", () => {
        keepSearchInputFocus = false;
        suppressSearchRefocusUntil = Date.now() + 600;
        store.dispatch({ type: "ADD_DECK_CARD", card: searchResults[Number(button.dataset.deckResult)] });
        showNotice("Card added to deck.");
      });
    });
    container.querySelectorAll("[data-inspect-result]").forEach((button) => {
      button.addEventListener("click", async () => {
        const card = searchResults[Number(button.dataset.inspectResult)];
        if (!card?.cardId) {
          return;
        }
        const details = await fetchScryfallCardDetails(card.cardId, true);
        if (!details) {
          return;
        }
        const rulings = (details.rulings || []).slice(0, 3).map((entry) => `- ${entry.comment}`).join("\n") || "- none";
        alert(`${details.name}\n${details.manaCost} ${details.typeLine}\n\n${details.oracleText || ""}\n\nRulings:\n${rulings}\n\nTokens: ${(details.tokenReferences || []).map((entry) => entry.name).join(", ") || "none"}`);
      });
    });
    container.querySelectorAll("[data-pending-effect]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "MARK_PENDING_EFFECT", id: button.dataset.pendingEffect, status: button.dataset.status }));
    });
    container.querySelectorAll("[data-spell-target]").forEach((button) => {
      button.addEventListener("click", () =>
        store.dispatch({ type: "SET_SPELL_TARGET", pendingId: button.dataset.pendingId, targetId: button.dataset.spellTarget })
      );
    });
    container.querySelectorAll("[data-trigger-resolve]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "TRIGGER_QUEUE_RESOLVE", id: button.dataset.triggerResolve }));
    });
    container.querySelectorAll("[data-trigger-delay]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "TRIGGER_QUEUE_DELAY", id: button.dataset.triggerDelay }));
    });
    container.querySelectorAll("[data-trigger-skip]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "TRIGGER_QUEUE_SKIP", id: button.dataset.triggerSkip }));
    });
    container.querySelectorAll("[data-trigger-resolve-all]").forEach((button) => {
      button.addEventListener("click", () => {
        const queue = store.getState().activeSession?.triggerQueue || [];
        queue
          .filter((entry) => entry.status === "pending")
          .forEach((entry) => store.dispatch({ type: "TRIGGER_QUEUE_RESOLVE", id: entry.id }));
        showNotice(queue.length ? "Resolved available trigger queue." : "No trigger queue entries.");
      });
    });
    container.querySelectorAll("[data-stack-resolve-next]").forEach((button) => {
      button.addEventListener("click", () => {
        const spell = (store.getState().activeSession?.stack || [])[0];
        if (spell) {
          store.dispatch({ type: "RESOLVE_TOP_SPELL", stackId: spell.id });
          showNotice("Resolved or advanced the top spell.");
          return;
        }
        const next = (store.getState().activeSession?.triggerQueue || []).find((entry) => entry.status === "pending");
        if (next) {
          store.dispatch({ type: "TRIGGER_QUEUE_RESOLVE", id: next.id });
          showNotice("Resolved next stack item.");
        } else {
          showNotice("Stack is clear.");
        }
      });
    });
    container.querySelectorAll("[data-pass-priority]").forEach((button) => {
      button.addEventListener("click", () => {
        store.dispatch({ type: "PASS_PRIORITY", playerId: "local-player" });
        showNotice("Priority passed.");
      });
    });
    container.querySelectorAll("[data-respond-stack]").forEach((button) => {
      button.addEventListener("click", () => showNotice("Response window noted."));
    });
    container.querySelectorAll("[data-trigger-inspect]").forEach((button) => {
      button.addEventListener("click", () => {
        const triggerId = button.dataset.triggerInspect;
        const entry = (store.getState().activeSession.triggerQueue || []).find((item) => item.id === triggerId);
        if (!entry) {
          return;
        }
        alert(`${entry.sourceName}\n${entry.eventType}\nEffects: ${(entry.effectDefinitions || []).map((effect) => effect.action || "effect").join(", ")}\nModifiers: ${(entry.generatedModifiers || []).map((modifier) => `L${modifier.layer}:${modifier.operation}`).join(" | ") || "none"}`);
      });
    });
    container.querySelectorAll("[data-replay-action]").forEach((button) => {
      button.addEventListener("click", () => {
        store.dispatch({ type: "REPLAY_TO_ACTION", replayActionId: button.dataset.replayAction });
      });
    });
    container.querySelectorAll("[data-prediction-apply]").forEach((button) => {
      button.addEventListener("click", () => {
        const suggestions = buildPredictiveActions(store.getState());
        const suggestion = suggestions.find((entry) => entry.id === button.dataset.predictionApply);
        if (!suggestion?.apply?.actionType) {
          return;
        }
        store.dispatch({
          type: suggestion.apply.actionType,
          ...(suggestion.apply.payload || {}),
        });
      });
    });
    container.querySelector("[data-helper-dismiss]")?.addEventListener("click", () => {
      dismissHelperSpriteMessage(true);
    });
    container.querySelector("[data-helper-open]")?.addEventListener("click", () => {
      if (!helperMessage) {
        return;
      }
      if (helperMessage.source === "trigger-queue") {
        activeUtilityPanel = "triggers";
        utilityDockOpen = true;
      } else if (helperMessage.source === "pending-effects") {
        activeToolPanel = "inspect";
      } else if (helperMessage.source === "phase") {
        advancePhaseFromUi();
        return;
      } else if (helperMessage.source === "stack-removal") {
        activeToolPanel = "permanents";
      } else if (helperMessage.source === "predictive" && helperMessage.predictiveApply?.actionType) {
        store.dispatch({
          type: helperMessage.predictiveApply.actionType,
          ...(helperMessage.predictiveApply.payload || {}),
        });
        dismissHelperSpriteMessage(true);
        return;
      }
      render(store.getState());
    });
    container.querySelectorAll("[data-open-manual-choice-panel]").forEach((button) =>
      button.addEventListener("click", () => {
        manualChoicePanelCollapsed = false;
        render(store.getState());
      })
    );

    container.querySelector("[data-toggle-utility-dock]")?.addEventListener("click", () => {
      const nextOpen = !utilityDockOpen;
      closeAllTemporaryUi({ renderAfter: false });
      utilityDockOpen = nextOpen;
      render(store.getState());
    });
    container.querySelectorAll("[data-open-utility]").forEach((button) => {
      button.addEventListener("click", () => {
        closeAllTemporaryUi({ renderAfter: false });
        activeUtilityPanel = button.dataset.openUtility || "";
        // Open the selected utility panel without forcing the dock menu to stay expanded behind it.
        utilityDockOpen = false;
        render(store.getState());
      });
    });
    container.querySelectorAll("[data-close-utility-panel]").forEach((button) => {
      button.addEventListener("click", () => {
        castActionPopup = null;
        activeUtilityPanel = "";
        render(store.getState());
      });
    });
    container.querySelectorAll("[data-close-cast-popup]").forEach((button) => {
      button.addEventListener("click", () => {
        castActionPopup = null;
        render(store.getState());
      });
    });
    container.querySelectorAll("[data-roll-dice]").forEach((button) => {
      button.addEventListener("click", () => {
        const sides = Math.max(2, Number(button.dataset.rollDice) || 20);
        const roll = Math.floor(Math.random() * sides) + 1;
        store.dispatch({ type: "SET_SETTING", path: "utility.lastDice", value: `d${sides}: ${roll}` });
      });
    });
    container.querySelector("[data-run-calculator]")?.addEventListener("click", () => {
      const expression = String(container.querySelector("[data-utility-calculator]")?.value || "").trim();
      if (!expression) {
        return;
      }
      const safe = expression.replace(/[^0-9+\-*/(). ]/g, "");
      try {
        const result = Function(`"use strict"; return (${safe})`)();
        store.dispatch({ type: "SET_SETTING", path: "utility.calculator", value: `${safe} = ${result}` });
      } catch {
        store.dispatch({ type: "SET_SETTING", path: "utility.calculator", value: `${safe} = error` });
      }
    });
    container.querySelector("[data-save-utility-note]")?.addEventListener("click", () => {
      const note = String(container.querySelector("[data-utility-note]")?.value || "");
      store.dispatch({ type: "SET_SETTING", path: "playerNotes.dock", value: note });
    });
    container.querySelector("[data-mulligan-tracker]")?.addEventListener("click", () => {
      const current = Number(store.getState().settings?.utility?.mulligans || 0);
      store.dispatch({ type: "SET_SETTING", path: "utility.mulligans", value: current + 1 });
      showNotice(`Mulligan count ${current + 1}.`);
    });
    bindPermanentGestures(container, profile);

    container.querySelector(".floating-mana")?.addEventListener("pointerdown", () => scheduleManaAutoClose(store.getState()));
    bindEdgeSwipeZones(container, profile);
  }

  function installGlobalDismissHandlers() {
    if (globalDismissHandlersInstalled) {
      return;
    }
    globalDismissHandlersInstalled = true;
    document.addEventListener("pointerdown", handleGlobalDismissPointerDown, true);
    document.addEventListener("pointermove", handleGlobalDismissPointerMove, true);
    document.addEventListener("pointerup", handleGlobalDismissPointerUp, true);
    document.addEventListener("pointercancel", handleGlobalDismissPointerCancel, true);
    document.addEventListener("click", handleGlobalDismissClick, true);
    document.addEventListener("keydown", handleGlobalDismissKeydown, true);
  }

  function handleGlobalDismissPointerDown(event) {
    if (event.button && event.button !== 0) {
      outsideDismissPointerStart = null;
      return;
    }
    const topLayer = getTopTemporaryLayer();
    if (!topLayer) {
      outsideDismissPointerStart = null;
      return;
    }
    const inside = isInsideLayer(event.target, topLayer);
    const draggable = Boolean(event.target?.closest?.("[data-draggable-hud]"));
    outsideDismissPointerStart = {
      x: event.clientX,
      y: event.clientY,
      layerName: topLayer.name,
      inside,
      draggable,
      moved: false,
    };
  }

  function handleGlobalDismissPointerMove(event) {
    if (!outsideDismissPointerStart) {
      return;
    }
    const dx = Math.abs(event.clientX - outsideDismissPointerStart.x);
    const dy = Math.abs(event.clientY - outsideDismissPointerStart.y);
    if (dx > OUTSIDE_DISMISS_DRAG_THRESHOLD || dy > OUTSIDE_DISMISS_DRAG_THRESHOLD) {
      outsideDismissPointerStart.moved = true;
    }
  }

  function handleGlobalDismissPointerCancel() {
    outsideDismissPointerStart = null;
  }

  function handleGlobalDismissPointerUp(event) {
    if (!outsideDismissPointerStart) {
      return;
    }
    const pointerStart = outsideDismissPointerStart;
    outsideDismissPointerStart = null;
    if (hudBadgeDrag || pointerStart.draggable || pointerStart.moved) {
      return;
    }
    const dx = Math.abs(event.clientX - pointerStart.x);
    const dy = Math.abs(event.clientY - pointerStart.y);
    if (dx > OUTSIDE_DISMISS_DRAG_THRESHOLD || dy > OUTSIDE_DISMISS_DRAG_THRESHOLD) {
      return;
    }
    const topLayer = getTopTemporaryLayer();
    if (!topLayer || topLayer.name !== pointerStart.layerName) {
      return;
    }
    if (pointerStart.inside || isInsideLayer(event.target, topLayer)) {
      return;
    }
    if (closeTopTemporaryLayer(topLayer, "outside")) {
      suppressNextOutsideDismissClickUntil = Date.now() + 350;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      render(store.getState());
    }
  }

  function handleGlobalDismissClick(event) {
    if (Date.now() > suppressNextOutsideDismissClickUntil) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    suppressNextOutsideDismissClickUntil = 0;
  }

  function handleGlobalDismissKeydown(event) {
    if (event.key !== "Escape") {
      return;
    }
    const topLayer = getTopTemporaryLayer();
    if (!topLayer) {
      return;
    }
    if (closeTopTemporaryLayer(topLayer, "escape")) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      render(store.getState());
    }
  }

  function getTopTemporaryLayer() {
    const renderedLayer = (condition, name, selectors) =>
      condition && root.querySelector(selectors.join(",")) ? { name, selectors } : null;
    const layers = [
      renderedLayer(confirmationDialog, "confirmation", [".confirm-dialog"]),
      renderedLayer(simulationStatsOpen, "simulation-stats", [".simulation-stats-overlay"]),
      renderedLayer(syncedTurnOrderSetupOpen, "synced-turn-order", [".synced-turn-order-modal"]),
      renderedLayer(simulationSetupOpen, "simulation-setup", [".simulation-setup"]),
      renderedLayer(opponentOverlayOpen, "opponent-overlay", [".opponent-battlefield-overlay"]),
      renderedLayer(statsOpen, "stats", [".stats-overlay"]),
      renderedLayer(optionsOpen, "options", [".floating-overlay"]),
      renderedLayer(modifierPanelOpen, "modifier", [".modifier-panel"]),
      renderedLayer(quickPanelOpen, "quick-panel", [".quick-adjust-panel"]),
      renderedLayer(activeToolPanel, "tool-panel", [".floating-tool-panel"]),
      renderedLayer(
        floatingManaOpen && !store.getState().settings?.battlefield?.manaPinned,
        "floating-mana",
        [".floating-mana"]
      ),
      renderedLayer(castActionPopup, "cast-popup", [".cast-action-popup"]),
      renderedLayer(activeUtilityPanel, "utility-panel", [".utility-overlay"]),
      renderedLayer(utilityDockOpen, "utility-menu", [".utility-dock-menu"]),
      renderedLayer(toolMenuOpen, "radial-menu", [".radial-menu"]),
    ];
    const topLayer = layers.find(Boolean);
    if (topLayer) {
      return topLayer;
    }
    if (!manualChoicePanelCollapsed && root.querySelector(".manual-choice-panel:not(.manual-choice-panel--collapsed)")) {
      return { name: "manual-choice", selectors: [".manual-choice-panel", ".pending-strip"] };
    }
    return null;
  }

  function isInsideLayer(target, layer) {
    if (!target?.closest || !layer?.selectors?.length) {
      return false;
    }
    return Boolean(target.closest(layer.selectors.join(",")));
  }

  function closeTopTemporaryLayer(layer = getTopTemporaryLayer(), reason = "outside") {
    if (!layer) {
      return false;
    }
    switch (layer.name) {
      case "confirmation":
        confirmationDialog = null;
        return true;
      case "simulation-stats":
        simulationStatsOpen = false;
        return true;
      case "synced-turn-order":
        syncedTurnOrderSetupOpen = false;
        syncedTurnOrderError = "";
        return true;
      case "simulation-setup":
        simulationSetupSuppressOpenUntil = Date.now() + 450;
        simulationSetupError = "";
        simulationSetupOpen = false;
        return true;
      case "opponent-overlay":
        opponentOverlayOpen = false;
        return true;
      case "stats":
        statsOpen = false;
        return true;
      case "options":
        optionsOpen = false;
        return true;
      case "modifier":
        pendingTrackerModifier = cloneTrackerModifier(trackerModifier);
        modifierPanelOpen = false;
        return true;
      case "quick-panel":
        quickPanelOpen = "";
        return true;
      case "tool-panel":
        activeToolPanel = "";
        floatingManaOpen = false;
        return true;
      case "floating-mana":
        floatingManaOpen = false;
        return true;
      case "cast-popup":
        castActionPopup = null;
        return true;
      case "utility-panel":
        activeUtilityPanel = "";
        return true;
      case "utility-menu":
        utilityDockOpen = false;
        return true;
      case "radial-menu":
        toolMenuOpen = false;
        return true;
      case "manual-choice":
        manualChoicePanelCollapsed = true;
        uiNotice = {
          id: `notice-${Date.now()}`,
          message: reason === "escape" ? "Manual choice remains queued." : "Manual choice minimized. It remains queued for resolution.",
          severity: "info",
          timestamp: Date.now(),
        };
        return true;
      case "notice":
        uiNotice = null;
        return true;
      default:
        return false;
    }
  }

  function closeAllTemporaryUi(options = {}) {
    const { renderAfter = true, keepSimulationSetup = false } = options;
    optionsOpen = false;
    statsOpen = false;
    quickPanelOpen = "";
    modifierPanelOpen = false;
    toolMenuOpen = false;
    activeToolPanel = "";
    utilityDockOpen = false;
    activeUtilityPanel = "";
    castActionPopup = null;
    simulationLogOpen = false;
    opponentOverlayOpen = false;
    simulationStatsOpen = false;
    syncedTurnOrderSetupOpen = false;
    syncedTurnOrderError = "";
    confirmationDialog = null;
    if (!keepSimulationSetup) {
      simulationSetupOpen = false;
      simulationSetupError = "";
    }
    if (!store.getState().settings?.battlefield?.manaPinned) {
      floatingManaOpen = false;
    }
    if (renderAfter) {
      render(store.getState());
    }
  }

  function bindDraggableHudBadges(container) {
    container.querySelectorAll("[data-draggable-hud]").forEach((node) => {
      const hudId = node.dataset.draggableHud;
      if (!hudId || hudId === "tools") {
        return;
      }
      const lockState = node.dataset.hudLockState;
      if (lockState === "locked") {
        return;
      }
      node.addEventListener("pointerdown", (event) => {
        if (!isPortraitTouchMode()) {
          return;
        }
        node.setPointerCapture?.(event.pointerId);
        const current = hudBadgePositions[hudId] || HUD_BADGE_DEFAULTS[hudId] || { x: 12, y: 180 };
        hudBadgeDrag = {
          id: hudId,
          startX: event.clientX,
          startY: event.clientY,
          originalX: current.x,
          originalY: current.y,
          moved: false,
        };
      });
      node.addEventListener("pointermove", (event) => {
        if (!hudBadgeDrag || hudBadgeDrag.id !== hudId || hudBadgesLocked) {
          return;
        }
        const dx = event.clientX - hudBadgeDrag.startX;
        const dy = event.clientY - hudBadgeDrag.startY;
        hudBadgeDrag.moved = hudBadgeDrag.moved || Math.abs(dx) > HUD_DRAG_THRESHOLD || Math.abs(dy) > HUD_DRAG_THRESHOLD;
        const next = clampHudBadgePosition(hudId, hudBadgeDrag.originalX + dx, hudBadgeDrag.originalY + dy);
        hudBadgePositions = {
          ...hudBadgePositions,
          [hudId]: next,
        };
        node.style.left = `${next.x}px`;
        node.style.top = `${next.y}px`;
      });
      node.addEventListener("pointerup", () => {
        if (!hudBadgeDrag || hudBadgeDrag.id !== hudId) {
          return;
        }
        const moved = Boolean(hudBadgeDrag.moved);
        hudBadgeDrag = null;
        if (moved) {
          persistHudBadgePositions(hudBadgePositions);
          render(store.getState());
        }
      });
      ["pointercancel", "pointerleave"].forEach((eventName) =>
        node.addEventListener(eventName, () => {
          if (hudBadgeDrag?.id === hudId) {
            hudBadgeDrag = null;
          }
        })
      );
    });
  }

  function clampHudBadgePosition(id, x, y) {
    const widthMap = {
      utility: 110,
      helper: 220,
      simulation: 300,
      floatingMana: 250,
    };
    const heightMap = {
      utility: 52,
      helper: 68,
      simulation: 128,
      floatingMana: 188,
    };
    const width = widthMap[id] || 160;
    const height = heightMap[id] || 80;
    const maxX = Math.max(8, window.innerWidth - width - 8);
    const maxY = Math.max(8, window.innerHeight - height - 8);
    const snappedX = x < window.innerWidth / 2 ? Math.max(8, x) : Math.min(maxX, x);
    return {
      x: Math.round(Math.max(8, Math.min(maxX, snappedX))),
      y: Math.round(Math.max(8, Math.min(maxY, y))),
    };
  }

  function persistHudBadgePositions(nextPositions) {
    store.dispatch({ type: "SET_SETTING", path: "navigation.hudBadgePositions", value: cloneHudBadgePositions(nextPositions) });
  }

  function resetHudLayout() {
    store.dispatch({ type: "SET_SETTING", path: "navigation.hudBadgePositions", value: cloneHudBadgePositions(HUD_BADGE_DEFAULTS) });
    store.dispatch({ type: "SET_SETTING", path: "navigation.hudBadgesLocked", value: false });
  }

  function closeSimulationSetup() {
    simulationSetupSuppressOpenUntil = Date.now() + 450;
    simulationSetupError = "";
    simulationSetupOpen = false;
    render(store.getState());
  }

  function openSyncedTurnOrderSetup() {
    const profile = store.getState();
    const players = getSyncedTurnOrderPlayers(profile);
    if (players.length <= 1) {
      syncedTurnOrderError = "At least one additional synced player is required for multiplayer turn order.";
      syncedTurnOrderPlayers = players;
      syncedTurnOrderOrder = players.map((player) => player.id);
      syncedTurnOrderSuggested = [...syncedTurnOrderOrder];
      syncedTurnOrderRolls = {};
      syncedTurnOrderTiePlayerIds = [];
    } else {
      const existing = profile.activeSession?.syncedMultiplayer || {};
      syncedTurnOrderError = "";
      syncedTurnOrderPlayers = players;
      syncedTurnOrderOrder = (existing.turnOrder || []).filter((id) => players.some((player) => player.id === id));
      if (syncedTurnOrderOrder.length !== players.length) {
        const missing = players.map((player) => player.id).filter((id) => !syncedTurnOrderOrder.includes(id));
        syncedTurnOrderOrder = [...syncedTurnOrderOrder, ...missing];
      }
      syncedTurnOrderSuggested = (existing.suggestedTurnOrder || []).filter((id) => players.some((player) => player.id === id));
      syncedTurnOrderRolls = { ...(existing.rolls || {}) };
      syncedTurnOrderTiePlayerIds = (existing.tiePlayerIds || []).filter((id) => players.some((player) => player.id === id));
    }
    syncedTurnOrderSetupOpen = true;
    render(profile);
  }

  function closeSyncedTurnOrderSetup() {
    syncedTurnOrderSetupOpen = false;
    syncedTurnOrderError = "";
    render(store.getState());
  }

  function rollSyncedTurnOrder() {
    const profile = store.getState();
    const players = syncedTurnOrderPlayers.length ? syncedTurnOrderPlayers : getSyncedTurnOrderPlayers(profile);
    if (players.length <= 1) {
      syncedTurnOrderError = "At least one additional synced player is required for multiplayer turn order.";
      render(profile);
      return;
    }
    const rolls = Object.fromEntries(players.map((player) => [player.id, Math.floor(Math.random() * 20) + 1]));
    const suggestedOrder = computeSuggestedTurnOrder(players, rolls);
    const highestRoll = Math.max(...Object.values(rolls));
    const tiePlayerIds = players.filter((player) => rolls[player.id] === highestRoll).map((player) => player.id);
    syncedTurnOrderPlayers = players;
    syncedTurnOrderRolls = rolls;
    syncedTurnOrderSuggested = suggestedOrder;
    syncedTurnOrderOrder = [...suggestedOrder];
    syncedTurnOrderTiePlayerIds = tiePlayerIds;
    syncedTurnOrderError = "";
    store.dispatch({
      type: "ROLL_MULTIPLAYER_TURN_ORDER",
      players,
      rolls,
      summary:
        tiePlayerIds.length > 1
          ? "d20 turn-order roll completed with a tie for highest roll."
          : `d20 turn-order roll completed. Suggested order: ${formatSyncedTurnOrderNames(players, suggestedOrder)}.`,
    });
    render(profile);
  }

  function rerollSyncedTurnOrderTies() {
    const profile = store.getState();
    const players = syncedTurnOrderPlayers.length ? syncedTurnOrderPlayers : getSyncedTurnOrderPlayers(profile);
    if (!players.length) {
      syncedTurnOrderError = "No synced players available to reroll.";
      render(profile);
      return;
    }
    const tiePlayerIds = syncedTurnOrderTiePlayerIds.length
      ? [...syncedTurnOrderTiePlayerIds]
      : detectHighestRollTie(players, syncedTurnOrderRolls);
    if (!tiePlayerIds.length) {
      syncedTurnOrderError = "No tied highest rolls detected.";
      render(profile);
      return;
    }
    const nextRolls = { ...syncedTurnOrderRolls };
    tiePlayerIds.forEach((playerId) => {
      nextRolls[playerId] = Math.floor(Math.random() * 20) + 1;
    });
    const suggestedOrder = computeSuggestedTurnOrder(players, nextRolls);
    const highest = Math.max(...Object.values(nextRolls));
    syncedTurnOrderRolls = nextRolls;
    syncedTurnOrderSuggested = suggestedOrder;
    syncedTurnOrderOrder = [...suggestedOrder];
    syncedTurnOrderTiePlayerIds = players.filter((player) => nextRolls[player.id] === highest).map((player) => player.id);
    syncedTurnOrderError = "";
    store.dispatch({
      type: "ROLL_MULTIPLAYER_TURN_ORDER",
      players,
      rolls: nextRolls,
      summary:
        syncedTurnOrderTiePlayerIds.length > 1
          ? "Tied players rerolled, but tie persists for highest roll."
          : `Tied players rerolled. Suggested order: ${formatSyncedTurnOrderNames(players, suggestedOrder)}.`,
    });
    render(profile);
  }

  function moveSyncedTurnOrderPlayer(playerId = "", direction = 0) {
    const currentIndex = syncedTurnOrderOrder.indexOf(playerId);
    if (currentIndex < 0) {
      return;
    }
    const nextIndex = currentIndex + Number(direction || 0);
    if (nextIndex < 0 || nextIndex >= syncedTurnOrderOrder.length) {
      return;
    }
    const nextOrder = [...syncedTurnOrderOrder];
    [nextOrder[currentIndex], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[currentIndex]];
    syncedTurnOrderOrder = nextOrder;
    syncedTurnOrderError = "";
    render(store.getState());
  }

  function confirmSyncedTurnOrder() {
    const profile = store.getState();
    const players = syncedTurnOrderPlayers.length ? syncedTurnOrderPlayers : getSyncedTurnOrderPlayers(profile);
    if (players.length <= 1) {
      syncedTurnOrderError = "At least one additional synced player is required for multiplayer turn order.";
      render(profile);
      return;
    }
    const orderedIds = [...syncedTurnOrderOrder].filter((id) => players.some((player) => player.id === id));
    const missing = players.map((player) => player.id).filter((id) => !orderedIds.includes(id));
    const finalOrder = [...orderedIds, ...missing];
    if (!finalOrder.length) {
      syncedTurnOrderError = "Set a valid turn order before confirming.";
      render(profile);
      return;
    }
    syncedTurnOrderError = "";
    syncedTurnOrderSetupOpen = false;
    store.dispatch({
      type: "CONFIRM_MULTIPLAYER_TURN_ORDER",
      players,
      turnOrder: finalOrder,
      rolls: syncedTurnOrderRolls,
      suggestedTurnOrder: syncedTurnOrderSuggested,
      tiePlayerIds: syncedTurnOrderTiePlayerIds,
      summary: `Synced multiplayer turn order confirmed: ${formatSyncedTurnOrderNames(players, finalOrder)}.`,
    });
    render(profile);
  }

  function startSimulationFromSetup() {
    const selectedOpponents = [...simulationSelectedOpponents].filter(Boolean);
    if (!selectedOpponents.length) {
      simulationSetupError = "Select at least one opponent to start a simulation.";
      render(store.getState());
      return;
    }
    simulationSetupError = "";
    simulationSetupSuppressOpenUntil = Date.now() + 450;
    simulationSetupOpen = false;
    simulationStatsOpen = false;
    setActivePage("battlefield");
    store
      .dispatch({
        type: "START_SIMULATION",
        selectedOpponents,
        speed: simulationSelectedSpeed || "normal",
        revengeEnabled: simulationRevengeEnabled,
      })
      .catch(() => {
        simulationSetupError = "Simulation failed to start. Check setup and try again.";
        simulationSetupOpen = true;
        render(store.getState());
      });
  }

  function endActiveGame() {
    const state = store.getState();
    const simulation = state.activeSession?.simulation || {};
    if (simulation.enabled) {
      store.dispatch({ type: "SIMULATION_STOP" });
    } else if (state.activeSession?.gameTracking?.active) {
      store.dispatch({ type: "STOP_GAME_TRACKING" });
    }
    closeAllTemporaryUi({ renderAfter: false });
    render(store.getState());
  }

  function installSimulationUiHandlers() {
    if (simulationUiHandlersInstalled) {
      return;
    }
    simulationUiHandlersInstalled = true;
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") {
        return;
      }
      if (syncedTurnOrderSetupOpen) {
        event.preventDefault();
        closeSyncedTurnOrderSetup();
        return;
      }
      if (!simulationSetupOpen) {
        return;
      }
      event.preventDefault();
      closeSimulationSetup();
    });
  }

  function setActivePage(page) {
    if (!allPages.includes(page)) {
      return;
    }
    const visiblePages = getVisiblePages(store.getState());
    if (page !== "profile" && !visiblePages.includes(page)) {
      return;
    }
    activePage = page;
    normalizeCurrentHash();
    closeAllTemporaryUi({ renderAfter: false });
    toolContextOverride = "";
    render(store.getState());
  }

  function normalizePageFromHash(hashValue = "") {
    const rawPage = String(hashValue || "")
      .replace(/^#/, "")
      .split(/[?&/]/)[0]
      .trim()
      .toLowerCase();
    return allPages.includes(rawPage) ? rawPage : "life";
  }

  function normalizeCurrentHash() {
    const canonicalHash = `#${activePage}`;
    if (location.hash !== canonicalHash) {
      history.replaceState(null, "", canonicalHash);
    }
  }

  function handleHashChange() {
    const nextPage = normalizePageFromHash(location.hash);
    if (nextPage === activePage) {
      normalizeCurrentHash();
      return;
    }
    const visiblePages = getVisiblePages(store.getState());
    if (nextPage !== "profile" && !visiblePages.includes(nextPage)) {
      normalizeCurrentHash();
      return;
    }
    activePage = nextPage;
    normalizeCurrentHash();
    closeAllTemporaryUi({ renderAfter: false });
    toolContextOverride = "";
    render(store.getState());
  }

  function handleViewportChange() {
    window.clearTimeout(viewportRerenderTimer);
    viewportRerenderTimer = window.setTimeout(() => {
      const profile = store.getState();
      if ((profile.settings?.appearance?.compositionMode || "auto") !== "auto") {
        return;
      }
      render(profile);
    }, 120);
  }

  function movePage(direction) {
    const pageOrder = getVisiblePages(store.getState());
    const currentIndex = Math.max(0, pageOrder.indexOf(activePage));
    const nextIndex = Math.max(0, Math.min(pageOrder.length - 1, currentIndex + direction));
    if (nextIndex !== currentIndex) {
      setActivePage(pageOrder[nextIndex]);
    }
  }

  async function advancePhaseFromUi() {
    if (phaseAdvancePending) {
      return;
    }
    const currentState = store.getState();
    const simulation = currentState.activeSession?.simulation || {};
    const currentActor = getSimulationActorName(currentState);
    const multiplayer = getMultiplayerSettings(currentState);
    const syncedTurn = currentState.activeSession?.syncedMultiplayer || {};
    const syncedModeActive =
      currentState.activeSession?.gameTracking?.active &&
      !simulation.enabled &&
      ["local", "wifi"].includes(multiplayer.mode);
    if (syncedModeActive) {
      if (!syncedTurn.confirmed || !Array.isArray(syncedTurn.turnOrder) || !syncedTurn.turnOrder.length) {
        phaseControlMessage = "Confirm synced multiplayer turn order before advancing phases.";
        addRecovery({
          source: "Phase Controls",
          message: phaseControlMessage,
          severity: "warning",
          suggestedAction: "Open Game Options and confirm synced multiplayer turn order.",
        });
        render(store.getState());
        return;
      }
      const activeTurnPlayerId = syncedTurn.currentPlayerId || syncedTurn.turnOrder[0];
      if (activeTurnPlayerId && activeTurnPlayerId !== "local-player" && multiplayer.role === "spectator") {
        phaseControlMessage = `${resolveSyncedPlayerName(syncedTurn.players || [], activeTurnPlayerId)} turn is active. Spectator controls are disabled.`;
        addRecovery({
          source: "Phase Controls",
          message: phaseControlMessage,
          severity: "info",
          suggestedAction: "Wait for the active player or leave spectator mode.",
        });
        render(store.getState());
        return;
      }
      if (activeTurnPlayerId && activeTurnPlayerId !== "local-player") {
        phaseControlMessage = `Advancing ${resolveSyncedPlayerName(syncedTurn.players || [], activeTurnPlayerId)} turn.`;
      }
    }
    if (simulation.enabled && simulation.status === "running") {
      if (simulation.currentPlayerId !== "local-player") {
        phaseControlMessage = `${currentActor} turn is processing.`;
        addRecovery({
          source: "Dry Run",
          message: phaseControlMessage,
          severity: "info",
          suggestedAction: "Wait for NPC automation or pause the simulation.",
        });
        render(store.getState());
        return;
      }
      if (!simulation.waitingForUser) {
        phaseControlMessage = "Waiting for simulation priority before advancing phase.";
        addRecovery({
          source: "Dry Run",
          message: phaseControlMessage,
          severity: "info",
          suggestedAction: "Pause the simulation if you need manual control.",
        });
        render(store.getState());
        return;
      }
    }
    phaseControlMessage = "";
    phaseAdvancePending = true;
    render(store.getState());
    const finalize = () => {
      phaseAdvancePending = false;
      render(store.getState());
    };
    try {
      const dispatchPromise = store.dispatch({ type: "ADVANCE_PHASE" });
      showNotice("Phase advanced.");
      requestAnimationFrame(finalize);
      await dispatchPromise;
    } catch (error) {
      addRecovery({
        source: "Phase Controls",
        message: "Phase could not advance.",
        technicalMessage: error?.message || String(error),
        severity: "error",
        suggestedAction: "Try again, resolve pending triggers, or copy debug state from Game Options.",
      });
      finalize();
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
      dispatchWithFeedback({ type: "LIFE_DELTA", amount: addLife ? 1 : -1 });
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
      dispatchWithFeedback({ type: "COMMANDER_DAMAGE_DELTA", opponentId: "opponent", amount: 1 });
    });
    target.addEventListener("pointercancel", () => {
      clearTimeout(commanderGesture?.timer);
      commanderGesture = null;
    });
  }

  function bindPermanentGestures(container, profile) {
    if (!profile.settings?.gestures?.advanced) {
      return;
    }
    container.querySelectorAll("[data-permanent-card]").forEach((card) => {
      const permanentId = card.dataset.permanentId;
      if (!permanentId || card.dataset.readonly === "true") {
        return;
      }

      card.addEventListener(
        "touchstart",
        (event) => {
          if (event.touches.length === 2) {
            event.preventDefault();
            store.dispatch({ type: "SELECT_PERMANENT", id: permanentId });
            activeToolPanel = "inspect";
            toolMenuOpen = false;
            render(store.getState());
          }
        },
        { passive: false }
      );

      card.addEventListener("pointerdown", (event) => {
        if (event.target.closest("[data-tap], [data-counter], .mini button")) {
          return;
        }
        const startedAt = Date.now();
        const gesture = {
          id: permanentId,
          startX: event.clientX,
          startY: event.clientY,
          moved: false,
          startedAt,
          longPressFired: false,
          reordered: false,
          timer: setTimeout(() => {
            gesture.longPressFired = true;
            store.dispatch({ type: "SELECT_PERMANENT", id: permanentId });
            toolContextOverride = "";
            toolMenuOpen = true;
            activeToolPanel = "";
            vibrateFeedback(true);
            render(store.getState());
          }, LONG_PRESS_DELAY_MS),
        };
        permanentGestureState.set(permanentId, gesture);
      });

      card.addEventListener("pointermove", (event) => {
        const gesture = permanentGestureState.get(permanentId);
        if (!gesture) {
          return;
        }
        const dx = event.clientX - gesture.startX;
        const dy = event.clientY - gesture.startY;
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
          gesture.moved = true;
        }
        if (
          gesture.longPressFired &&
          !gesture.reordered &&
          Math.abs(dx) > PERMANENT_DRAG_REORDER_THRESHOLD &&
          Math.abs(dx) > Math.abs(dy)
        ) {
          gesture.reordered = true;
          store.dispatch({ type: "REORDER_PERMANENT", id: permanentId, direction: dx > 0 ? 1 : -1 });
        }
      });

      const finishGesture = (event) => {
        const gesture = permanentGestureState.get(permanentId);
        if (!gesture) {
          return;
        }
        clearTimeout(gesture.timer);
        permanentGestureState.delete(permanentId);
        if (gesture.longPressFired || gesture.reordered) {
          return;
        }

        const dx = event.clientX - gesture.startX;
        const dy = event.clientY - gesture.startY;
        if (dy < -PERMANENT_VERTICAL_SWIPE_THRESHOLD && event.clientY < window.innerHeight * ATTACK_DRAG_TOP_RATIO) {
          store.dispatch({ type: "DECLARE_ATTACKERS", ids: [permanentId] });
          return;
        }

        if (Math.abs(dy) > PERMANENT_VERTICAL_SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx) * 1.2) {
          store.dispatch({
            type: "ADD_COUNTER",
            id: permanentId,
            counterType: dy < 0 ? "+1/+1" : "-1/-1",
            amount: 1,
          });
          return;
        }

        const lastTap = Number(card.dataset.lastTapAt || 0);
        const now = Date.now();
        if (now - lastTap < PERMANENT_DOUBLE_TAP_MS) {
          card.dataset.lastTapAt = "0";
          store.dispatch({ type: "TOGGLE_TAPPED", id: permanentId });
          return;
        }
        card.dataset.lastTapAt = String(now);
        if (!gesture.moved && now - gesture.startedAt < LONG_PRESS_DELAY_MS) {
          store.dispatch({ type: "SELECT_PERMANENT", id: permanentId });
        }
      };

      card.addEventListener("pointerup", finishGesture);
      card.addEventListener("pointercancel", () => {
        const gesture = permanentGestureState.get(permanentId);
        if (!gesture) {
          return;
        }
        clearTimeout(gesture.timer);
        permanentGestureState.delete(permanentId);
      });
    });
  }

  function bindEdgeSwipeZones(container, profile) {
    if (!profile.settings?.navigation?.edgeSwipeShortcuts) {
      return;
    }
    container.querySelectorAll("[data-edge-zone]").forEach((zone) => {
      zone.addEventListener("pointerdown", (event) => {
        if (getTopTemporaryLayer()) {
          return;
        }
        const edge = zone.dataset.edgeZone;
        if (isMobileViewMode() && (edge === "left" || edge === "right")) {
          event.stopPropagation();
          movePage(edge === "left" ? -1 : 1);
          return;
        }
        if (edge === "left") {
          movePage(-1);
          return;
        }
        if (edge === "right") {
          utilityDockOpen = true;
          activeUtilityPanel = activeUtilityPanel || "triggers";
          render(store.getState());
          return;
        }
        if (edge === "bottom") {
          floatingManaOpen = true;
          activeToolPanel = "";
          toolMenuOpen = false;
          render(store.getState());
          return;
        }
        if (edge === "top") {
          utilityDockOpen = true;
          activeUtilityPanel = "history";
          render(store.getState());
        }
      });
    });
  }

  function resolveHelperSpriteMessage(profile, page) {
    const helperSettings = profile.settings?.helperSprite || {};
    if (!helperSettings.enabled) {
      clearTimeout(helperFadeTimer);
      clearTimeout(helperHideTimer);
      helperMessage = null;
      return null;
    }
    if (optionsOpen || statsOpen || modifierPanelOpen || quickPanelOpen) {
      return helperMessage;
    }
    if (keepSearchInputFocus) {
      return helperMessage;
    }
    const now = Date.now();
    const candidates = collectHelperCandidateMessages(profile, page);
    if (!candidates.length) {
      clearTimeout(helperFadeTimer);
      clearTimeout(helperHideTimer);
      helperMessage = null;
      return null;
    }
    const helperSession = profile.activeSession.helper || {};
    const replayQueue = helperSession.replayQueue || [];
    const replayCandidate = replayQueue[0]
      ? {
          key: replayQueue[0].key,
          text: replayQueue[0].text,
          source: replayQueue[0].source || "remind-me",
          isReminderReplay: true,
        }
      : null;
    const next = replayCandidate || candidates[0];
    if (!next) {
      return helperMessage;
    }
    const cooldownUntil = helperDismissCooldown.get(next.key) || 0;
    if (cooldownUntil > now) {
      return helperMessage;
    }
    if (helperMessage?.key === next.key) {
      return helperMessage;
    }
    const helperDisplayDuration = Math.max(4200, Math.min(9800, 3200 + Math.round(next.text.length * 24)));
    helperMessage = {
      ...next,
      shownAt: now,
      fading: false,
      ttlMs: helperDisplayDuration,
    };
    clearTimeout(helperFadeTimer);
    clearTimeout(helperHideTimer);
    helperFadeTimer = setTimeout(() => {
      if (!helperMessage || helperMessage.key !== next.key) {
        return;
      }
      helperMessage = {
        ...helperMessage,
        fading: true,
      };
      render(store.getState());
    }, Math.max(2200, helperDisplayDuration - 520));
    helperHideTimer = setTimeout(() => {
      dismissHelperSpriteMessage(true);
    }, helperDisplayDuration);
    store.dispatch({ type: "HELPER_MARK_SHOWN", messageKey: next.key });
    return helperMessage;
  }

  function collectHelperCandidateMessages(profile, page) {
    const session = profile.activeSession;
    const messages = [];
    const adhdMode = getAdhdMode(profile);
    const pendingQueue = (session.triggerQueue || []).filter((entry) => entry.status === "pending");
    const pendingEffects = (session.pendingEffects || []).filter((entry) => entry.status === "pending");
    const ignoredEffects = (session.pendingEffects || []).filter((entry) => entry.status === "ignored");
    const selected = getSelectedPermanents(session);
    const stacked = selected.filter((permanent) => Number(permanent.quantity || 1) > 1);
    const manaFloating = Object.values(session.manaPool || {}).reduce((sum, value) => sum + Number(value || 0), 0);

    if (pendingQueue.length) {
      const top = pendingQueue[0];
      messages.push({
        key: `queue:${top.id}`,
        source: "trigger-queue",
        text: `Trigger ready: ${top.sourceName} (${top.eventType}).`,
      });
    }
    if (pendingEffects.length) {
      const top = pendingEffects[0];
      messages.push({
        key: `manual:${top.id}`,
        source: "pending-effects",
        text: `Manual choice required: ${top.summary || top.effect?.summary || top.effect?.reason || "Resolve or skip from pending effects."}`,
      });
    }
    if (ignoredEffects.length && adhdMode.enabled) {
      messages.push({
        key: `ignored:${ignoredEffects[0].id}`,
        source: "pending-effects",
        text: "Ignored manual effect still unresolved. Open pending effects to review.",
      });
    }
    if (stacked.length) {
      messages.push({
        key: `stack:${stacked.map((entry) => entry.id).join(",")}`,
        source: "stack-removal",
        text: "Stack selected: use Remove 1 / Custom / All in Permanent Controls.",
      });
    }
    if (page === "battlefield" && session.phaseIndex === 2 && !session.combat?.attackerIds?.length) {
      messages.push({
        key: `combat:${session.turn}:${session.phaseIndex}`,
        source: "combat",
        text: "Combat reminder: declare attackers or advance phase.",
      });
    }
    if (page === "battlefield" && session.phaseIndex === 0) {
      messages.push({
        key: `phase:${session.turn}:${session.phaseIndex}`,
        source: "phase",
        text: "Beginning phase: resolve upkeep/beginning triggers before moving on.",
      });
    }
    if (adhdMode.enabled && manaFloating > 0) {
      messages.push({
        key: `mana:${session.turn}:${manaFloating}`,
        source: "resource",
        text: `Floating mana reminder: ${manaFloating} mana still available.`,
      });
    }
    if (page === "battlefield" && searchLoading) {
      messages.push({
        key: `search-loading:${searchQuery}`,
        source: "search",
        text: "Scryfall search is loading. You can keep typing.",
      });
    }
    buildPredictiveActions(profile)
      .slice(0, 2)
      .forEach((suggestion) => {
        if (!suggestion?.label) {
          return;
        }
        messages.push({
          key: `predictive:${session.turn}:${session.phaseIndex}:${suggestion.id || suggestion.label}`,
          source: "predictive",
          text: `${suggestion.label}: ${suggestion.detail || "Review suggested action."}`,
          predictiveApply: suggestion.apply?.actionType ? suggestion.apply : null,
        });
      });
    return messages;
  }

  function dismissHelperSpriteMessage(addCooldown = false) {
    if (!helperMessage) {
      return;
    }
    clearTimeout(helperFadeTimer);
    clearTimeout(helperHideTimer);
    if (addCooldown && helperMessage.key) {
      helperDismissCooldown.set(helperMessage.key, Date.now() + 25000);
    }
    if (helperMessage.isReminderReplay) {
      store.dispatch({ type: "HELPER_DISMISS_MESSAGE", messageKey: helperMessage.key });
    }
    helperMessage = null;
    render(store.getState());
  }

  function dispatchWithFeedback(action, strong = false) {
    store.dispatch(action);
    vibrateFeedback(strong);
  }

  function openConfirmation(dialog) {
    confirmationDialog = {
      id: dialog.id,
      title: dialog.title || "Confirm action",
      message: dialog.message || "Please confirm this action.",
      confirmLabel: dialog.confirmLabel || "Confirm",
      cancelLabel: dialog.cancelLabel || "Cancel",
      danger: Boolean(dialog.danger),
      payload: dialog.payload || null,
    };
    render(store.getState());
  }

  function runConfirmationAction(id = "") {
    const payload = confirmationDialog?.payload || null;
    confirmationDialog = null;
    switch (id) {
      case "end-game":
        endActiveGame();
        showNotice("Active game ended.");
        break;
      case "reset-hud-layout":
        resetHudLayout();
        showNotice("HUD layout reset.");
        break;
      case "reset-life-trackers":
        dispatchWithFeedback({ type: "RESET_PLAYER_TRACKERS" }, true);
        showNotice("Life and trackers reset.");
        break;
      case "import-profile":
        if (payload) {
          store.dispatch({ type: "IMPORT_PROFILE", profile: payload });
          showNotice("Profile imported.");
        }
        break;
      case "load-tutorial-sample":
        store.dispatch({ type: "LOAD_TUTORIAL_SAMPLE_BOARD" });
        setActivePage("battlefield");
        showNotice("Tutorial sample board loaded.");
        break;
      case "clear-game-history":
        store.dispatch({ type: "CLEAR_GAME_HISTORY" });
        showNotice("Game history cleared.");
        break;
      case "clear-simulation-learning":
        store.dispatch({ type: "CLEAR_SIMULATION_LEARNING" });
        showNotice("Simulation learning cleared.");
        break;
      case "reset-settings":
        store.dispatch({ type: "RESET_SETTINGS" });
        showNotice("Settings reset.");
        break;
      case "reset-all-local-data":
        store.dispatch({ type: "RESET_ALL_LOCAL_DATA" });
        showNotice("Local data reset.");
        break;
      default:
        showNotice("Action cancelled.");
        break;
    }
    render(store.getState());
  }

  function showNotice(message, severity = "success") {
    uiNotice = {
      id: `notice-${Date.now()}`,
      message,
      severity,
      timestamp: Date.now(),
    };
    clearTimeout(showNotice.timer);
    showNotice.timer = setTimeout(() => {
      uiNotice = null;
      render(store.getState());
    }, 3800);
    render(store.getState());
  }

  function addRecovery(entry) {
    store.dispatch({ type: "ADD_RECOVERY_ENTRY", entry });
  }

  async function copyOrDownloadText(filename, text, successMessage = "Copied.") {
    try {
      await navigator.clipboard.writeText(text);
      showNotice(successMessage);
    } catch {
      downloadText(filename, text, "application/json");
      showNotice(`${successMessage} Download fallback created.`);
    }
  }

  function resolveStackRemovalRequest(stackedPermanents = [], requestedMode = "custom") {
    const mode = String(requestedMode || "custom").toLowerCase();
    const totals = Object.fromEntries(stackedPermanents.map((permanent) => [permanent.id, Math.max(1, Number(permanent.quantity || 1))]));
    if (mode === "all") {
      return {
        countMode: "all",
        count: Math.max(...Object.values(totals)),
        countById: totals,
      };
    }
    if (mode === "single" || mode === "1") {
      return {
        countMode: "single",
        count: 1,
        countById: Object.fromEntries(stackedPermanents.map((permanent) => [permanent.id, 1])),
      };
    }
    const largestStack = Math.max(...Object.values(totals));
    const answer = prompt(`Remove how many from each selected stack? (1-${largestStack}, or "all")`, "1");
    if (answer === null) {
      return null;
    }
    const normalized = String(answer).trim().toLowerCase();
    if (normalized === "all") {
      return {
        countMode: "all",
        count: largestStack,
        countById: totals,
      };
    }
    const numeric = Math.max(1, Math.floor(Number(normalized) || 1));
    return {
      countMode: "custom",
      count: numeric,
      countById: Object.fromEntries(
        stackedPermanents.map((permanent) => [permanent.id, Math.min(totals[permanent.id], numeric)])
      ),
    };
  }

  function applyTrackerModifier() {
    const amount = Number(trackerModifier.value) || 1;
    const scopes = trackerModifier.scopes || {};
    if (scopes.life) {
      dispatchWithFeedback({ type: "LIFE_DELTA", amount });
    }
    ["poison", "energy", "experience", "tickets"].forEach((counter) => {
      if (scopes[counter]) {
        dispatchWithFeedback({ type: "PLAYER_COUNTER_DELTA", counter, amount });
      }
    });
    if (scopes.commander) {
      dispatchWithFeedback({ type: "COMMANDER_DAMAGE_DELTA", opponentId: "opponent", amount });
    }
  }

  function vibrateFeedback(strong = false) {
    if (!isPortraitTouchMode() || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || !navigator.vibrate) {
      return;
    }
    navigator.vibrate(strong ? 24 : 8);
  }

  function isSwipeBlockedTarget(target) {
    return Boolean(target.closest("button, input, label, textarea, select, .overlay-backdrop, .scroll-safe, .counter-stepper, .search-results, .floating-tool-panel, .floating-mana, [data-no-swipe]"));
  }

  function isPortraitTouchMode() {
    return isMobileViewMode();
  }

  function isMobileViewMode() {
    return resolveCompositionMode(store.getState()) === "mobile";
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

  async function runScryfallSearch(query, profile, immediate = false) {
    const trimmed = String(query || "").trim();
    searchQuery = String(query || "");
    const token = ++searchRequestToken;
    if (!trimmed && !immediate) {
      searchLoading = false;
      searchResults = [];
      searchMessage = "Start typing to search Scryfall.";
      render(store.getState());
      return;
    }
    const commanderDeck = profile.commanders?.[profile.activeSession.commander?.deckKey]?.cards || [];
    searchAbortController?.abort();
    searchAbortController = new AbortController();
    searchLoading = true;
    searchMessage = navigator.onLine ? "Searching..." : "Offline: showing commander deck matches only.";
    if (!keepSearchInputFocus) {
      render(store.getState());
    }
    try {
      const results = await searchScryfall(trimmed, commanderDeck, { requestToken: token, signal: searchAbortController.signal });
      if (token !== searchRequestToken) {
        return;
      }
      searchResults = results;
      searchMessage = searchResults.length ? `${searchResults.length} result(s)` : "No results found.";
    } catch (error) {
      if (token !== searchRequestToken) {
        return;
      }
      searchMessage = "Search unavailable right now.";
      addRecovery({
        source: "Scryfall Search",
        message: "Scryfall search is unavailable right now.",
        technicalMessage: error?.message || String(error),
        severity: "warning",
        suggestedAction: "Keep typing, retry search, or add from cached commander deck results if available.",
        action: "retry-search",
      });
    } finally {
      if (token === searchRequestToken) {
        searchLoading = false;
        render(store.getState());
      }
    }
  }

  function captureViewportScroll(container) {
    const shell = container.querySelector?.(".app-shell");
    return {
      pageY: backgroundScrollLockY ?? (window.scrollY || document.documentElement.scrollTop || 0),
      shellY: shell?.scrollTop || 0,
    };
  }

  function syncBackgroundScrollLock() {
    const shouldLock = BACKGROUND_SCROLL_LOCK_SELECTORS.some((selector) => root.querySelector(selector));
    if (shouldLock && backgroundScrollLockY === null) {
      backgroundScrollLockY = window.scrollY || document.documentElement.scrollTop || 0;
      document.body.style.top = `-${backgroundScrollLockY}px`;
      document.body.classList.add("overlay-scroll-locked");
      return;
    }
    if (!shouldLock && backgroundScrollLockY !== null) {
      const restoreY = backgroundScrollLockY;
      backgroundScrollLockY = null;
      document.body.classList.remove("overlay-scroll-locked");
      document.body.style.removeProperty("top");
      window.scrollTo({ top: restoreY, left: 0, behavior: "auto" });
    }
  }

  function captureTemporaryScrollState(container, options = {}) {
    const { preserveSearchResultsScroll = true } = options;
    const snapshot = {};
    TEMPORARY_SCROLL_SELECTORS.forEach((selector) => {
      if (!preserveSearchResultsScroll && selector === ".search-results") {
        return;
      }
      container.querySelectorAll?.(selector).forEach((node, index) => {
        if (node.scrollTop <= 0 && node.scrollLeft <= 0 && node.scrollHeight <= node.clientHeight + 1) {
          return;
        }
        snapshot[`${selector}:${index}`] = {
          top: node.scrollTop || 0,
          left: node.scrollLeft || 0,
          stickToBottom:
            selector === ".simulation-log" &&
            node.scrollHeight - node.clientHeight - node.scrollTop <= 24,
        };
      });
    });
    return snapshot;
  }

  function restoreTemporaryScrollState(container, snapshot = {}) {
    Object.entries(snapshot).forEach(([key, value]) => {
      const separatorIndex = key.lastIndexOf(":");
      const selector = key.slice(0, separatorIndex);
      const index = Number(key.slice(separatorIndex + 1));
      const node = container.querySelectorAll?.(selector)?.[index];
      if (!node) {
        return;
      }
      node.scrollLeft = value.left || 0;
      node.scrollTop = value.stickToBottom ? node.scrollHeight : value.top || 0;
    });
  }

  function captureOpenDetailsState(container) {
    return [...(container.querySelectorAll?.("details") || [])].map((node) => Boolean(node.open));
  }

  function restoreOpenDetailsState(container, snapshot = []) {
    container.querySelectorAll?.("details").forEach((node, index) => {
      node.open = Boolean(snapshot[index]);
    });
  }

  function restoreViewportScroll(container, snapshot) {
    if (!snapshot) {
      return;
    }
    if (Math.abs((window.scrollY || 0) - (snapshot.pageY || 0)) > 1) {
      window.scrollTo({ top: snapshot.pageY || 0, left: 0, behavior: "auto" });
    }
    const shell = container.querySelector?.(".app-shell");
    if (shell && Number.isFinite(snapshot.shellY) && Math.abs((shell.scrollTop || 0) - snapshot.shellY) > 1) {
      shell.scrollTop = snapshot.shellY;
    }
  }

  function captureSearchFocusState() {
    const active = document.activeElement;
    const isFocusedSearch = Boolean(active?.matches?.("[data-search-query]"));
    if (!isFocusedSearch) {
      return {
        shouldFocus: keepSearchInputFocus && Date.now() >= suppressSearchRefocusUntil,
        start: searchSelection.start,
        end: searchSelection.end,
        direction: searchSelection.direction,
      };
    }
    return {
      shouldFocus: Date.now() >= suppressSearchRefocusUntil,
      start: active.selectionStart,
      end: active.selectionEnd,
      direction: active.selectionDirection || "none",
    };
  }

  function restoreSearchInputFocus(container, snapshot, searchResultsScrollTop) {
    const resultList = container.querySelector(".search-results");
    if (resultList && Number.isFinite(searchResultsScrollTop) && searchResultsScrollTop > 0) {
      resultList.scrollTop = searchResultsScrollTop;
    }
    if (!snapshot?.shouldFocus || Date.now() < suppressSearchRefocusUntil) {
      return;
    }
    const input =
      (activeUtilityPanel === "search" ? container.querySelector(".utility-overlay [data-search-query]") : null) ||
      container.querySelector("[data-search-query]");
    if (!input) {
      return;
    }
    input.focus({ preventScroll: true });
    const start = Number.isFinite(snapshot.start) ? snapshot.start : searchQuery.length;
    const end = Number.isFinite(snapshot.end) ? snapshot.end : start;
    try {
      input.setSelectionRange(start, end, snapshot.direction || "none");
    } catch {
      input.setSelectionRange(start, end);
    }
  }

  function castSearchCard(index, sourceZone = "hand", controller = "player") {
    keepSearchInputFocus = false;
    suppressSearchRefocusUntil = Date.now() + 600;
    const card = searchResults[index];
    if (!card) {
      showNotice("Spell could not be found in the current search results.", "warning");
      return;
    }
    let xValue;
    if (/\{X\}|\bX\b/.test(`${card.manaCost || ""} ${card.oracleText || ""}`)) {
      const answer = prompt(`Choose X for ${card.name || "this spell"}.`, "0");
      if (answer === null) {
        showNotice("Cast cancelled.", "info");
        return;
      }
      xValue = Math.max(0, Number(answer) || 0);
    }
    store.dispatch({
      type: "CAST_SPELL",
      card,
      controller,
      owner: controller,
      sourceZone,
      targetIds: store.getState().activeSession?.selectedIds || [],
      xValue,
    });
    showNotice(`${controller === "opponent" ? "Opponent " : ""}spell cast from ${formatLabel(sourceZone)} and placed on the stack.`);
  }

  function captureSearchResultsScrollTop(container) {
    const list = container.querySelector?.(".search-results");
    if (!list) {
      return 0;
    }
    return list.scrollTop || 0;
  }
}

function layout(profile, page, searchResults, searchMessage, uiState) {
  const session = profile.activeSession;
  const tabs = uiState.visiblePages || getVisiblePages(profile);
  const uiLayer = uiState.uiLayerState || resolveUiLayerState(profile, page, uiState);
  const appLayerClasses = [
    `ui-layer-${uiLayer.current}`,
    uiLayer.passive ? "ui-layer-passive" : "",
    uiLayer.active ? "ui-layer-active" : "",
    uiLayer.focus ? "ui-layer-focus" : "",
    uiLayer.inspect ? "ui-layer-inspect" : "",
    uiLayer.adhd ? "ui-layer-adhd" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `
    <main class="app-shell ${appLayerClasses}" data-ui-layer="${escapeAttribute(uiLayer.current)}" data-app-shell>
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
        ${page === "battlefield" ? renderBattlefieldHeaderTurnStatus(profile) : ""}
        ${renderMobileSwipeControls(tabs, page)}
      </header>
      ${page === "life" ? renderLifeTracker(profile, uiState.trackerModifier, uiState) : ""}
      ${page === "battlefield" ? renderBattlefield(profile, searchResults, searchMessage, uiState.searchLoading, uiState.searchQuery, uiState.combatResolving, uiState.toolContext, new Set(uiState.expandedStackIds || []), uiState.activeUtilityPanel, uiLayer.current, { opponentBoardIndex: uiState.opponentBoardIndex || 0, opponentOverlayOpen: Boolean(uiState.opponentOverlayOpen), phaseControlMessage: uiState.phaseControlMessage || "", isMobilePortrait: Boolean(uiState.isMobilePortrait), manualChoicePanelCollapsed: Boolean(uiState.manualChoicePanelCollapsed), utilityDockOpen: Boolean(uiState.utilityDockOpen), castActionPopup: uiState.castActionPopup }) : ""}
      ${page === "profile" ? renderProfile(profile) : ""}
      ${page === "archive" ? renderArchive(profile) : ""}
      ${page === "decks" ? renderDecks(profile, searchResults, searchMessage, uiState.searchLoading, uiState.searchQuery) : ""}
      ${page === "leaderboards" ? renderLeaderboards(profile) : ""}
      ${page === "battlefield" ? renderBattlefieldToolBadge(profile, uiState.toolMenuOpen, uiState.floatingManaOpen, uiState.activeToolPanel, uiState.hudBadgePositions || HUD_BADGE_DEFAULTS, uiState.toolContext, Boolean(uiState.isMobilePortrait), Boolean(uiState.hudBadgesLocked), Boolean(uiState.simulationLogOpen)) : ""}
      ${page === "battlefield" ? renderUtilityDock(profile, uiState.utilityDockOpen, uiState.activeUtilityPanel, uiState.hudBadgePositions || HUD_BADGE_DEFAULTS, Boolean(uiState.isMobilePortrait), Boolean(uiState.hudBadgesLocked), searchResults, searchMessage, uiState.searchLoading, uiState.searchQuery, uiState.castActionPopup) : ""}
      ${uiState.quickPanelOpen ? renderQuickAdjustmentPanel(profile, uiState.quickPanelOpen) : ""}
      ${uiState.modifierPanelOpen ? renderTrackerModifierPanel(uiState.pendingTrackerModifier) : ""}
      ${uiState.optionsOpen ? renderGameOptions(profile, page) : ""}
      ${uiState.statsOpen ? renderStatsOverlay(profile, uiState.statsMode) : ""}
      ${uiState.simulationSetupOpen ? renderSimulationSetupModal(uiState.simulationSelectedOpponents, uiState.simulationSelectedSpeed, uiState.simulationRevengeEnabled, uiState.simulationSetupError) : ""}
      ${uiState.simulationStatsOpen ? renderSimulationStatsOverlay(profile) : ""}
      ${uiState.syncedTurnOrderSetupOpen ? renderSyncedTurnOrderModal(uiState.syncedTurnOrderPlayers || [], uiState.syncedTurnOrderRolls || {}, uiState.syncedTurnOrderOrder || [], uiState.syncedTurnOrderSuggested || [], uiState.syncedTurnOrderTiePlayerIds || [], uiState.syncedTurnOrderError || "") : ""}
      ${renderAdhdAssistPanel(profile, page, uiLayer.current)}
      ${renderHelperSprite(profile, uiState.helperMessage, uiState.hudBadgePositions || HUD_BADGE_DEFAULTS, Boolean(uiState.isMobilePortrait), Boolean(uiState.hudBadgesLocked))}
      ${renderRecoveryToasts(profile, uiState.uiNotice)}
      ${uiState.confirmationDialog ? renderConfirmationDialog(uiState.confirmationDialog) : ""}
      ${renderEdgeSwipeZones(profile)}
    </main>
  `;
}

function resolveCompositionMode(profile = {}) {
  const preference = profile.settings?.appearance?.compositionMode || "auto";
  if (preference === "mobile" || preference === "widescreen") {
    return preference;
  }
  return isAutoMobileDeviceView() ? "mobile" : "widescreen";
}

function isAutoMobileDeviceView() {
  return window.matchMedia?.(MOBILE_LAYOUT_QUERY)?.matches ?? (window.innerWidth || 0) < 1280;
}

function renderLifeTracker(profile, trackerModifier, uiState = {}) {
  const session = profile.activeSession;
  const panels = getPagePanels(profile);
  const counters = {
    poison: session.playerCounters?.poison || 0,
    energy: session.playerCounters?.energy || 0,
    experience: session.playerCounters?.experience || 0,
    tickets: session.playerCounters?.tickets || 0,
  };
  const commanderDamage = session.commander.damageByOpponent?.opponent || 0;
  const gameTracking = session.gameTracking || {};
  const simulation = session.simulation || {};
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
        <div class="button-grid life-start-controls">
          <button data-start-game-tracking>${gameTracking.active ? "Game Tracking Active" : "Start Game"}</button>
          <button data-open-simulation-setup>${simulation.enabled ? "Reconfigure Simulation" : "Dry Run"}</button>
        </div>
      </aside>
      ` : ""}
      <section class="tracker-stack">
        <article class="tracker-card simulation-card glass">
          <p class="eyebrow">Simulated Multiplayer</p>
          <h2>${simulation.enabled ? "Simulation Active" : "Commander Test Mode"}</h2>
          <p>${simulation.enabled ? `Current: ${escapeHtml(getSimulationActorName(profile))}` : "Play against Alpha, Beta, and Omega NPC opponents."}</p>
          <div class="button-grid">
            <button data-open-simulation-setup>${simulation.enabled ? "Reconfigure Simulation" : "Dry Run"}</button>
            ${simulation.enabled ? `<button data-simulation-log-toggle>${uiState.simulationLogOpen ? "Hide Log" : "Show Log"}</button>` : ""}
            <button data-open-simulation-stats>Simulation Stats</button>
          </div>
        </article>
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

function renderSimulationSetupModal(selectedOpponents = [], selectedSpeed = "normal", revengeEnabled = true, setupError = "") {
  const selected = new Set(selectedOpponents || []);
  const speed = selectedSpeed || "normal";
  const alphaDeck = getSimulationDeckById("alpha");
  const betaDeck = getSimulationDeckById("beta");
  const omegaDeck = getSimulationDeckById("omega");
  return `
    <section class="overlay-backdrop" data-simulation-setup-backdrop>
      <div class="floating-overlay glass simulation-setup">
        <div class="overlay-header">
          <div>
            <p class="eyebrow">Commander NPC Setup</p>
            <h2>Dry Run Setup</h2>
          </div>
          <button type="button" data-close-simulation-setup>Cancel</button>
        </div>
        <article class="option-card">
          <h3>Choose Opponents</h3>
          <label class="toggle-row"><span>Alpha · ${escapeHtml(alphaDeck?.deckName || "Deck")}</span><input type="checkbox" data-sim-opponent="alpha" ${selected.has("alpha") ? "checked" : ""} /></label>
          <label class="toggle-row"><span>Beta · ${escapeHtml(betaDeck?.deckName || "Deck")}</span><input type="checkbox" data-sim-opponent="beta" ${selected.has("beta") ? "checked" : ""} /></label>
          <label class="toggle-row"><span>Omega · ${escapeHtml(omegaDeck?.deckName || "Deck")}</span><input type="checkbox" data-sim-opponent="omega" ${selected.has("omega") ? "checked" : ""} /></label>
          <p class="eyebrow">Deck status: ${escapeHtml(alphaDeck?.status || "unknown")} / ${escapeHtml(betaDeck?.status || "unknown")} / ${escapeHtml(omegaDeck?.status || "unknown")}</p>
        </article>
        <article class="option-card">
          <h3>Simulation Speed</h3>
          <label class="toggle-row"><span>Step</span><input type="radio" name="sim-speed" data-sim-speed="step" ${speed === "step" ? "checked" : ""} /></label>
          <label class="toggle-row"><span>Normal</span><input type="radio" name="sim-speed" data-sim-speed="normal" ${speed === "normal" ? "checked" : ""} /></label>
          <label class="toggle-row"><span>Fast</span><input type="radio" name="sim-speed" data-sim-speed="fast" ${speed === "fast" ? "checked" : ""} /></label>
        </article>
        <article class="option-card">
          <h3>Revenge Learning</h3>
          <label class="toggle-row"><span>Revenge ON</span><input type="checkbox" data-sim-revenge ${revengeEnabled ? "checked" : ""} /></label>
          <p class="eyebrow">ON: NPCs adapt against the winner and each other. OFF: base strategies only.</p>
        </article>
        ${setupError ? `<p class="simulation-setup-error">${escapeHtml(setupError)}</p>` : ""}
        <div class="button-grid">
          <button type="button" data-start-simulation>Start Game</button>
          <button type="button" data-open-simulation-stats>Simulation Stats</button>
          <button type="button" data-close-simulation-setup>Cancel</button>
        </div>
      </div>
    </section>
  `;
}

function renderSyncedTurnOrderModal(players = [], rolls = {}, turnOrder = [], suggestedTurnOrder = [], tiePlayerIds = [], setupError = "") {
  const byId = Object.fromEntries(players.map((player) => [player.id, player]));
  const hasRolls = Object.keys(rolls || {}).length > 0;
  const highestRoll = hasRolls ? Math.max(...Object.values(rolls).map((value) => Number(value) || 0)) : 0;
  const suggested = suggestedTurnOrder.length ? suggestedTurnOrder : turnOrder;
  return `
    <section class="overlay-backdrop" data-synced-turn-order-backdrop>
      <div class="floating-overlay glass simulation-setup synced-turn-order-modal">
        <div class="overlay-header">
          <div>
            <p class="eyebrow">Synced Multiplayer</p>
            <h2>d20 Turn Order</h2>
          </div>
          <button type="button" data-close-synced-turn-order-setup>Close</button>
        </div>
        <article class="option-card">
          <h3>Rolls</h3>
          ${
            players.length
              ? players
                  .map((player) => {
                    const roll = Number(rolls?.[player.id] || 0);
                    const highest = hasRolls && roll === highestRoll;
                    return `<p><strong>${escapeHtml(resolveSyncedPlayerName(players, player.id))}</strong>: ${roll || "—"}${highest ? " (highest)" : ""}</p>`;
                  })
                  .join("")
              : "<p>No synced players detected.</p>"
          }
          ${hasRolls ? `<p class="eyebrow">Suggested order: ${escapeHtml(formatSyncedTurnOrderNames(players, suggested))}</p>` : "<p class=\"eyebrow\">Roll d20 for each player to generate suggested order.</p>"}
          ${tiePlayerIds.length > 1 ? `<p class="simulation-setup-error">Highest-roll tie: ${escapeHtml(formatSyncedTurnOrderNames(players, tiePlayerIds))}. Reroll tied players or confirm manual order.</p>` : ""}
        </article>
        <article class="option-card">
          <h3>Confirm / Adjust</h3>
          <div class="stacked-form">
            ${
              turnOrder.length
                ? turnOrder
                    .map((playerId, index) => `
                      <div class="row mini">
                        <span>${index + 1}. ${escapeHtml(resolveSyncedPlayerName(players, playerId))}</span>
                        <div class="row mini">
                          <button type="button" data-move-synced-turn-order="up" data-player-id="${escapeAttribute(playerId)}">↑</button>
                          <button type="button" data-move-synced-turn-order="down" data-player-id="${escapeAttribute(playerId)}">↓</button>
                        </div>
                      </div>
                    `)
                    .join("")
                : "<p>Roll first to populate order.</p>"
            }
          </div>
        </article>
        ${setupError ? `<p class="simulation-setup-error">${escapeHtml(setupError)}</p>` : ""}
        <div class="button-grid">
          <button type="button" data-roll-synced-turn-order>Roll d20</button>
          <button type="button" data-reroll-synced-turn-ties ${tiePlayerIds.length > 1 ? "" : "disabled"}>Reroll Tied Players</button>
          <button type="button" data-confirm-synced-turn-order>Confirm Turn Order</button>
          <button type="button" data-close-synced-turn-order-setup>Cancel</button>
        </div>
      </div>
    </section>
  `;
}

function renderSimulationStatsOverlay(profile) {
  const stats = profile.simulationStats || {};
  const history = stats.history || [];
  const latest = history[0];
  const topThreats = summarizeRecordEntries(stats.mostThreateningCards, 5);
  const topTargets = summarizeRecordEntries(stats.mostTargetedCards, 5);
  const topValue = summarizeRecordEntries(stats.mostValuableCards, 5);
  return `
    <section class="overlay-backdrop">
      <div class="floating-overlay glass simulation-stats-overlay">
        <div class="overlay-header">
          <div>
            <p class="eyebrow">Simulation-only tracking</p>
            <h2>Simulation Stats</h2>
          </div>
          <button data-close-simulation-stats>Close</button>
        </div>
        <div class="stats-grid">
          <article class="stat-card"><span>Games played</span><strong>${escapeHtml(Number(stats.gamesPlayed || 0))}</strong></article>
          <article class="stat-card"><span>Average game length (turns)</span><strong>${escapeHtml(Number(stats.averageTurnCount || 0).toFixed(2))}</strong></article>
          <article class="stat-card"><span>Commander damage eliminations</span><strong>${escapeHtml(Number(stats.commanderDamageEliminations || 0))}</strong></article>
          <article class="stat-card"><span>Strategy adjustments applied</span><strong>${escapeHtml(Number(stats.strategyAdjustmentsApplied || 0))}</strong></article>
          <article class="stat-card"><span>User W-L</span><strong>${escapeHtml(`${stats.user?.wins || 0}-${stats.user?.losses || 0}`)}</strong></article>
          <article class="stat-card"><span>Alpha W-L</span><strong>${escapeHtml(`${stats.alpha?.wins || 0}-${stats.alpha?.losses || 0}`)}</strong></article>
          <article class="stat-card"><span>Beta W-L</span><strong>${escapeHtml(`${stats.beta?.wins || 0}-${stats.beta?.losses || 0}`)}</strong></article>
          <article class="stat-card"><span>Omega W-L</span><strong>${escapeHtml(`${stats.omega?.wins || 0}-${stats.omega?.losses || 0}`)}</strong></article>
        </div>
        <div class="overlay-grid">
          <article class="option-card">
            <h3>Top Threat Signals</h3>
            <div class="deck-list">${topThreats.map((entry) => `<span>${escapeHtml(entry)}</span>`).join("") || "<span>No threat data yet</span>"}</div>
          </article>
          <article class="option-card">
            <h3>Most Targeted</h3>
            <div class="deck-list">${topTargets.map((entry) => `<span>${escapeHtml(entry)}</span>`).join("") || "<span>No target data yet</span>"}</div>
          </article>
          <article class="option-card">
            <h3>Most Valuable</h3>
            <div class="deck-list">${topValue.map((entry) => `<span>${escapeHtml(entry)}</span>`).join("") || "<span>No value data yet</span>"}</div>
          </article>
          <article class="option-card">
            <h3>Latest Result</h3>
            <p>${latest ? `${escapeHtml(latest.format || "Commander")} · Winner: ${escapeHtml(latest.winnerName || latest.winnerId || "Unknown")} · Turns: ${escapeHtml(latest.turnCount || 0)} · Revenge: ${latest.revengeEnabled ? "ON" : "OFF"}` : "No simulation result recorded yet."}</p>
          </article>
        </div>
      </div>
    </section>
  `;
}

function getSimulationActorName(profile) {
  const simulation = profile.activeSession?.simulation || {};
  if (!simulation.enabled) {
    const multiplayer = getMultiplayerSettings(profile);
    const synced = profile.activeSession?.syncedMultiplayer || {};
    const syncedMode = ["local", "wifi"].includes(multiplayer.mode);
    if (syncedMode && synced.confirmed && Array.isArray(synced.turnOrder) && synced.turnOrder.length) {
      return resolveSyncedPlayerName(synced.players || [], synced.currentPlayerId || synced.turnOrder[0]);
    }
    return "No simulation";
  }
  if (simulation.currentPlayerId === "local-player") {
    return `${profile.player?.name || "Player"} (You)`;
  }
  return simulation.opponents?.[simulation.currentPlayerId]?.name || simulation.currentPlayerId || "NPC";
}

function resolveSyncedPlayerName(players = [], playerId = "") {
  if (playerId === "local-player") {
    const local = players.find((entry) => entry.id === "local-player");
    return `${local?.name || "Player"} (You)`;
  }
  return players.find((entry) => entry.id === playerId)?.name || playerId || "Player";
}

function getSyncedTurnOrderPlayers(profile) {
  const localName = profile.player?.name || "Player";
  const entries = profile.settings?.multiplayer?.connectedPlayers || [];
  const byId = new Map();
  byId.set("local-player", { id: "local-player", name: localName });
  entries.forEach((entry) => {
    if (!entry?.id || entry.id === "local-player") {
      return;
    }
    if (entry.id.startsWith("peer-") && (entry.name || "").trim() === localName.trim()) {
      return;
    }
    byId.set(entry.id, {
      id: entry.id,
      name: entry.name || entry.id,
    });
  });
  return [...byId.values()];
}

function computeSuggestedTurnOrder(players = [], rolls = {}) {
  return [...players]
    .sort((left, right) => {
      const rightRoll = Number(rolls?.[right.id] || 0);
      const leftRoll = Number(rolls?.[left.id] || 0);
      if (rightRoll !== leftRoll) {
        return rightRoll - leftRoll;
      }
      return left.name.localeCompare(right.name);
    })
    .map((player) => player.id);
}

function detectHighestRollTie(players = [], rolls = {}) {
  const values = players.map((player) => Number(rolls?.[player.id] || 0));
  if (!values.length) {
    return [];
  }
  const highest = Math.max(...values);
  const tied = players.filter((player) => Number(rolls?.[player.id] || 0) === highest).map((player) => player.id);
  return tied.length > 1 ? tied : [];
}

function formatSyncedTurnOrderNames(players = [], turnOrder = []) {
  return turnOrder.map((id) => resolveSyncedPlayerName(players, id)).join(" -> ");
}

function renderMobileSwipeControls(tabs, page) {
  const currentIndex = tabs.indexOf(page);
  return `
    <section class="mobile-swipe-controls glass" aria-label="Mobile screen navigation">
      <button data-mobile-nav="prev" aria-label="Previous screen">&lsaquo;</button>
      <div>
        <span>${formatPageLabel(page)}</span>
        <div class="mobile-page-dots" aria-hidden="true">
          ${tabs.map((tab) => `<i class="${tab === page ? "active" : ""}"></i>`).join("")}
        </div>
      </div>
      <button data-mobile-nav="next" aria-label="Next screen">&rsaquo;</button>
      <small>${currentIndex + 1}/${tabs.length}</small>
    </section>
  `;
}

function renderTrackerModifierBadge(modifier) {
  return `
    <button class="modifier-badge" data-modifier-badge title="Long press to choose tracker modifier">
      <span>Modifier</span>
      <span class="modifier-value-row">
        <strong>${escapeHtml(formatTrackerModifier(modifier))}</strong>
        <small>${escapeHtml(formatModifierScopes(modifier))}</small>
      </span>
    </button>
  `;
}

function renderTrackerModifierPanel(modifier) {
  const modifierOptions = [-10, -5, -1, 1, 5, 10];
  const scopes = [
    ["life", "Life total"],
    ["poison", "Poison"],
    ["energy", "Energy"],
    ["experience", "Experience"],
    ["tickets", "Tickets"],
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
      <p>Pick the modifier amount, then choose which Life Tracker increment badges it affects. Tap the Modifier button to apply it.</p>
      <div class="modifier-option-grid">
        ${modifierOptions.map((value) => renderModifierOption(value, `${value > 0 ? "+" : ""}${value}`, modifier)).join("")}
      </div>
      <label class="modifier-custom-row">Custom/manual
        <input type="number" inputmode="numeric" data-modifier-custom placeholder="Amount" />
      </label>
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

function renderModifierOption(value, label, modifier) {
  const active = Number(modifier.value) === value;
  return `<button class="${active ? "active" : ""}" data-modifier-option="${value}">${label}</button>`;
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

function renderBattlefield(profile, searchResults, searchMessage, searchLoading, searchQuery, combatResolving, toolContext, expandedStackIds, activeUtilityPanel, uiLayer = "passive", uiState = {}) {
  const session = profile.activeSession;
  const panels = getPagePanels(profile);
  const adhdMode = getAdhdMode(profile);
  const isMobilePortrait = Boolean(uiState.isMobilePortrait);
  const mobileFocusView = Boolean(profile.settings?.navigation?.mobileFocusView ?? true);
  const detailMode = profile.settings?.battlefield?.detailMode || "standard";
  const compressionMode = profile.settings?.battlefield?.compressionMode || "adaptive";
  const selectedIds = new Set(session.selectedIds || []);
  const playerDensityClass = getDensityClass(session.battlefield.player, compressionMode);
  const opponentDensityClass = getDensityClass(session.battlefield.opponent, compressionMode);
  const opponentBoards = getOpponentBoards(profile);
  const hasOpponentBoards = opponentBoards.length > 0;
  const showOpponentZone = Boolean(panels.boardOpponent && hasOpponentBoards);
  const activeOpponentIndex = hasOpponentBoards ? Math.max(0, Math.min(opponentBoards.length - 1, Number(uiState.opponentBoardIndex) || 0)) : 0;
  const activeOpponent = hasOpponentBoards ? opponentBoards[activeOpponentIndex] : null;
  return `
    <section class="battlefield-page battlefield-page--focused ui-layer-surface-${escapeAttribute(uiLayer)} ${adhdMode.enabled && adhdMode.reducedNoise ? "adhd-reduced-noise" : ""} ${isMobilePortrait && mobileFocusView ? "mobile-focus-view" : ""}">
      <div class="battlefield-state-strip">
        <div>
          <strong>Turn ${escapeHtml(session.turn)} · ${escapeHtml(PHASES[session.phaseIndex] || "Beginning")} · ${escapeHtml(resolvePhaseTrackerActorLabel(session).replace(/^Active turn:\s*/i, ""))}</strong>
          <span>${escapeHtml(resolveBattlefieldActionHint(session))}</span>
        </div>
        <button data-setting-button="battlefield.focusMode" data-value="${profile.settings?.battlefield?.focusMode ? "false" : "true"}">Focus View</button>
      </div>
      <section class="arena glass ${playerDensityClass} ${profile.settings?.battlefield?.focusMode && session.selectedIds?.length ? "focus-mode" : ""} ${adhdMode.enabled && adhdMode.reducedNoise ? "adhd-reduced-noise" : ""} ${showOpponentZone ? "" : "arena--opponent-hidden"} ${panels.boardCombat ? "" : "arena--combat-hidden"}" data-set-tool-context="empty">
        ${showOpponentZone ? `
        <div class="opponent-zone ${opponentDensityClass}" data-opponent-swipe data-set-tool-context="empty">
          ${renderOpponentZoneHeader(opponentBoards, activeOpponentIndex, activeOpponent)}
          ${activeOpponent ? renderBattlefieldGroups(activeOpponent.permanents, {
            readonly: true,
            allowTargeting: true,
            emptyText: "No visible opponent permanents",
            expandedAll: profile.settings?.battlefield?.expandedAll,
            selectedIds,
            detailMode,
            compressionMode,
            expandedStackIds,
            session,
            settings: profile.settings,
          }) : empty("No visible opponent permanents")}
        </div>
        ` : ""}
        ${panels.boardCombat ? `
        <div class="combat-zone">
          ${session.combat.damagePreview ? `<p>${session.combat.damagePreview.total} damage estimated</p>` : ""}
          <div class="row">
            <button data-declare-attackers ${combatResolving ? "disabled" : ""}>Declare Attackers</button>
            <button data-resolve-combat ${combatResolving ? "disabled" : ""}>${combatResolving ? "Resolving…" : "Resolve"}</button>
          </div>
        </div>
        ` : ""}
        <div class="player-zone">
          <h2>${showOpponentZone ? "Your Battlefield" : "Battlefield"}</h2>
          ${renderBattlefieldGroups(session.battlefield.player, {
            emptyText: "No permanents yet",
            expandedAll: profile.settings?.battlefield?.expandedAll,
            selectedIds,
            detailMode,
            compressionMode,
            expandedStackIds,
            session,
            settings: profile.settings,
          })}
        </div>
      </section>
      <aside class="search-panel glass ${isMobilePortrait ? "mobile-hud-column" : ""}">
        ${!isMobilePortrait && panels.archiveQuickAdd ? `<h2>Battlefield Quick Add</h2>` : ""}
        ${!isMobilePortrait && panels.archiveQuickAdd ? renderSearch(searchResults, searchMessage, searchLoading, searchQuery, "battlefield", activeUtilityPanel === "search" ? null : uiState.castActionPopup) : ""}
      </aside>
    </section>
    ${renderMobileBattlefieldDock(profile, activeUtilityPanel, uiState.utilityDockOpen, Boolean(panels.boardCombat), Boolean(combatResolving), isMobilePortrait)}
    ${panels.advancedRulesHelpers || (session.pendingEffects || []).some((entry) => !["resolved", "skipped", "ignored"].includes(entry.status)) ? renderPending(session, Boolean(uiState.manualChoicePanelCollapsed)) : ""}
    ${session.tutorial?.active ? renderTutorialSamplePanel(session) : ""}
    ${activeUtilityPanel === "history" ? renderActionTimeline(profile) : ""}
    ${activeUtilityPanel === "triggers" ? renderTriggerQueuePanel(profile) : ""}
    ${uiState.opponentOverlayOpen && activeOpponent ? renderOpponentBattlefieldOverlay(profile, activeOpponent, activeOpponentIndex, opponentBoards.length, detailMode, compressionMode, selectedIds, expandedStackIds) : ""}
  `;
}

function resolveBattlefieldActionHint(session) {
  const phaseLabel = String(PHASES[session.phaseIndex] || "").toLowerCase();
  if ((session.triggerQueue || []).some((entry) => entry.status === "pending")) {
    return "Resolve queued triggers, respond, or use the stack tools.";
  }
  if ((session.pendingEffects || []).some((entry) => !["resolved", "skipped", "ignored"].includes(entry.status))) {
    return "Manual choice required before this effect can finish.";
  }
  if (phaseLabel.includes("combat")) {
    return "Declare attackers, resolve combat, or move to the next phase.";
  }
  if (phaseLabel.includes("main")) {
    return "Cast spells, activate abilities, or play lands.";
  }
  if (phaseLabel.includes("draw")) {
    return "Draw, review triggers, then continue when ready.";
  }
  return "Review the board, use tools, or advance when ready.";
}

function renderBattlefieldHeaderTurnStatus(profile) {
  const session = profile.activeSession;
  const phaseLabel = PHASES[session.phaseIndex] || "Beginning";
  const actor = resolvePhaseTrackerActorLabel(session).replace(/^Active turn:\s*/i, "");
  return `<p class="battlefield-header-turn-status">${session.simulation?.enabled ? `<span class="dry-run-inline-badge">Dry Run</span>` : ""}Turn ${session.turn} · ${escapeHtml(phaseLabel)} · ${escapeHtml(actor)}</p>`;
}

function renderOpponentZoneHeader(opponentBoards, activeIndex, activeOpponent) {
  if (!opponentBoards.length) {
    return "<h2>Opponent Battlefield</h2>";
  }
  return `
    <div class="opponent-zone-header">
      <div>
        <h2>${escapeHtml(activeOpponent?.name || "Opponent Battlefield")}</h2>
        <p class="eyebrow">${activeIndex + 1}/${opponentBoards.length} · ${escapeHtml(activeOpponent?.deckName || "Opponent")}</p>
      </div>
      <div class="opponent-swipe-rail" aria-label="Opponent battlefield selector">
        ${opponentBoards.map((opponent, index) => `
          <button class="${index === activeIndex ? "active" : ""}" data-opponent-nav="${index < activeIndex ? "prev" : index > activeIndex ? "next" : "current"}" ${index === activeIndex ? "disabled" : ""}>
            <strong>${escapeHtml(getInitials(opponent.name || "OP"))}</strong>
            <span>${escapeHtml(opponent.name || "Opponent")}</span>
            <b>${escapeHtml(opponent.life ?? 40)}</b>
          </button>
        `).join("")}
      </div>
      <div class="row mini">
        ${opponentBoards.length > 1 ? `<button data-opponent-nav="prev">‹</button><button data-opponent-nav="next">›</button>` : ""}
        <button data-open-opponent-overlay>Expand Battlefield</button>
      </div>
    </div>
  `;
}

function getInitials(name = "") {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "OP";
}

function renderOpponentBattlefieldOverlay(profile, opponentBoard, activeIndex, totalOpponents, detailMode, compressionMode, selectedIds, expandedStackIds) {
  return `
    <section class="overlay-backdrop">
      <div class="floating-overlay glass opponent-battlefield-overlay" data-opponent-swipe>
        <div class="overlay-header">
          <div>
            <p class="eyebrow">Opponent Battlefield</p>
            <h2>${escapeHtml(opponentBoard.name)}</h2>
            <strong>${activeIndex + 1}/${totalOpponents}</strong>
          </div>
          <div class="row mini">
            ${totalOpponents > 1 ? `<button data-opponent-nav="prev">‹</button><button data-opponent-nav="next">›</button>` : ""}
            <button data-close-opponent-overlay>Close</button>
          </div>
        </div>
        ${renderBattlefieldGroups(opponentBoard.permanents, {
          readonly: true,
          allowTargeting: true,
          emptyText: "No visible permanents",
          expandedAll: profile.settings?.battlefield?.expandedAll,
          selectedIds,
          detailMode: detailMode === "compact" ? "standard" : detailMode,
          compressionMode,
          expandedStackIds,
          session: profile.activeSession,
          settings: profile.settings,
        })}
      </div>
    </section>
  `;
}

function getOpponentBoards(profile) {
  const session = profile.activeSession;
  const permanentGroups = new Map();
  (session.battlefield?.opponent || []).forEach((permanent) => {
    const key = permanent.controller || "opponent";
    if (!permanentGroups.has(key)) {
      permanentGroups.set(key, []);
    }
    permanentGroups.get(key).push(permanent);
  });
  const byId = new Map();
  const peers = (profile.settings?.multiplayer?.connectedPlayers || []).filter((player) => player.id !== "local-player");
  peers.forEach((peer) => {
    const snapshotEntries = normalizePeerSnapshotEntries(peer.publicBoardSnapshot);
    const snapshotPermanents = snapshotEntries.map((entry) =>
      createPermanent({
        id: entry.id || `snapshot-${peer.id}-${entry.name}`,
        name: entry.name || "Permanent",
        typeLine: entry.typeLine || "Permanent",
        tapped: Boolean(entry.tapped),
        quantity: Number(entry.quantity || 1),
        counters: entry.counters || {},
        controller: peer.id,
        owner: peer.id,
      })
    );
    byId.set(peer.id, {
      id: peer.id,
      name: peer.name || peer.id,
      deckName: peer.deckName || peer.publicBoardSnapshot?.deckName || "Opponent",
      permanents: permanentGroups.get(peer.id) || snapshotPermanents,
      life: Number(peer.life ?? 40),
    });
  });
  Object.values(session.simulation?.opponents || {}).forEach((npc) => {
    byId.set(npc.id, {
      id: npc.id,
      name: npc.name,
      deckName: npc.deckName || "Simulation Deck",
      permanents: permanentGroups.get(npc.id) || [],
      life: Number(npc.life ?? 40),
    });
  });
  permanentGroups.forEach((permanents, id) => {
    if (byId.has(id)) {
      return;
    }
    byId.set(id, {
      id,
      name: id === "opponent" ? "Opponent" : id,
      deckName: "Opponent",
      permanents,
      life: 40,
    });
  });
  return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function normalizePeerSnapshotEntries(snapshot) {
  if (Array.isArray(snapshot)) {
    return snapshot;
  }
  if (Array.isArray(snapshot?.battlefield)) {
    return snapshot.battlefield;
  }
  if (Array.isArray(snapshot?.publicBoardSnapshot)) {
    return snapshot.publicBoardSnapshot;
  }
  return [];
}

function renderBattlefieldPhaseTracker(session, stats, phaseControlMessage = "") {
  const activeTurnLabel = resolvePhaseTrackerActorLabel(session);
  return `
    <section class="phase-tracker-card">
      <p class="eyebrow">Turn phase</p>
      <h2>Turn ${session.turn}</h2>
      <strong>${escapeHtml(PHASES[session.phaseIndex])}</strong>
      <p class="eyebrow">${escapeHtml(activeTurnLabel)}</p>
      <p>Board ${stats.currentBoardSize} / Triggers ${stats.triggersResolved}</p>
      ${phaseControlMessage ? `<p class="eyebrow phase-control-message">${escapeHtml(phaseControlMessage)}</p>` : ""}
      <button class="wide" data-set-tool-context="player">Player Tool Context</button>
      <button class="wide" data-next-phase>Next Phase</button>
    </section>
  `;
}

function resolvePhaseTrackerActorLabel(session) {
  const simulation = session?.simulation || {};
  if (simulation.enabled) {
    if (simulation.currentPlayerId === "local-player") {
      return "Active turn: You";
    }
    return `Active turn: ${simulation.opponents?.[simulation.currentPlayerId]?.name || simulation.currentPlayerId || "NPC"}`;
  }
  const synced = session?.syncedMultiplayer || {};
  if (synced.confirmed && Array.isArray(synced.turnOrder) && synced.turnOrder.length) {
    return `Active turn: ${resolveSyncedPlayerName(synced.players || [], synced.currentPlayerId || synced.turnOrder[0])}`;
  }
  if (synced.pendingConfirmation) {
    return "Active turn: confirm synced turn order";
  }
  return "Active turn: You";
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
      <div class="tile-grid ${options.readonly ? "readonly" : ""} ${options.compressionMode === "compact" ? "density-high" : ""}">
        ${permanents.map((permanent) => renderPermanent(permanent, options)).join("")}
      </div>
    </section>
  `;
}

function renderPermanent(permanent, options = {}) {
  const selected = options.selectedIds?.has(permanent.id);
  const stackExpanded = options.expandedAll || options.expandedStackIds?.has(permanent.id);
  const detailMode = options.detailMode || "standard";
  const stackMembers = permanent.stackMembers || [];
  const statusIcons = collectPermanentStatusIcons(permanent, options.session, options.settings);
  const imageUrl = getBattlefieldCardImageUrl(permanent);
  const fallbackClass = getBattlefieldCardFallbackClass(permanent);
  const targetAttr = options.readonly
    ? options.allowTargeting
      ? `data-opponent-permanent="${escapeAttribute(permanent.id)}"`
      : ""
    : `data-permanent="${permanent.id}"`;
  return `
    <article class="permanent detail-${detailMode} ${selected ? "selected" : ""} ${permanent.tapped ? "tapped" : ""} ${permanent.attacking ? "attacking" : ""} ${permanent.manualStatus === "pending" ? "pending" : ""}" data-permanent-card data-permanent-id="${permanent.id}" data-readonly="${options.readonly ? "true" : "false"}">
      <div class="permanent-art-layer ${fallbackClass} ${imageUrl ? "has-card-art" : "uses-fallback"}" ${imageUrl ? `style="background-image:url(&quot;${escapeAttribute(imageUrl)}&quot;)"` : ""} data-card-image="${imageUrl ? "available" : "fallback"}" aria-hidden="true"></div>
      <div class="permanent-readability-layer" aria-hidden="true"></div>
      <div class="permanent-content">
        <button ${targetAttr}>
          <strong>${escapeHtml(permanent.name)}</strong>
          ${permanent.manaCost ? `<span class="permanent-mana-cost">${escapeHtml(permanent.manaCost)}</span>` : ""}
          ${detailMode !== "compact" ? `<span>${escapeHtml(permanent.typeLine)}</span>` : `<span>MV ${permanent.manaValue || 0}</span>`}
          ${permanent.isCreature ? `<b>${permanent.currentPower}/${permanent.currentToughness}</b>` : ""}
          ${permanent.isPlaneswalker ? `<b>Loyalty ${permanent.counters?.Loyalty || 0}</b>` : ""}
          ${permanent.quantity > 1 ? `<i class="quantity">x${permanent.quantity}</i>` : ""}
          ${permanent.isToken ? "<em>TOKEN</em>" : ""}
          ${permanent.isCopy ? "<em>COPY</em>" : ""}
          ${permanent.isCommander ? "<em>COMMANDER</em>" : ""}
        </button>
        ${renderStatusIconRow(statusIcons)}
        ${detailMode !== "compact" ? renderPermanentDetails(permanent, detailMode) : ""}
        ${permanent.quantity > 1 ? `<button class="stack-toggle" type="button" data-toggle-stack="${permanent.id}">${stackExpanded ? "Collapse Stack" : "Expand Stack"}</button>` : ""}
        ${stackExpanded ? renderStackMemberDetails(stackMembers, detailMode, permanent) : ""}
        ${options.readonly ? "" : `<div class="row mini">
          <button data-tap="${permanent.id}">${permanent.tapped ? "Untap" : "Tap"}</button>
          <button data-counter="${permanent.id}">+1/+1</button>
        </div>`}
      </div>
    </article>
  `;
}

function getBattlefieldCardImageUrl(card = {}) {
  const direct =
    card.imageArt ||
    card.metadata?.imageArt ||
    card.imageUrl ||
    card.metadata?.imageUrl ||
    card.imageSmall ||
    card.metadata?.imageSmall ||
    "";
  if (direct) {
    return direct;
  }
  if (card.isToken && !card.isCopy) {
    return "";
  }
  const name = String(card.name || "").trim();
  if (!name || /^unknown|generic token|token$/i.test(name)) {
    return "";
  }
  return `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=art_crop`;
}

function getBattlefieldCardFallbackClass(card = {}) {
  if (card.isToken) {
    return "fallback-token";
  }
  if (card.isLand) {
    return "fallback-land";
  }
  if (card.isCreature) {
    return "fallback-creature";
  }
  if (card.isArtifact) {
    return "fallback-artifact";
  }
  if (card.isEnchantment) {
    return "fallback-enchantment";
  }
  if (card.isPlaneswalker) {
    return "fallback-planeswalker";
  }
  return "fallback-permanent";
}

function renderPermanentDetails(permanent, detailMode = "standard") {
  const counters = Object.entries(permanent.counters || {}).filter(([, value]) => Number(value) > 0);
  const layerInfo = detailMode === "inspect" ? renderLayerBreakdown(permanent.layerBreakdown || []) : "";
  const triggerInfo =
    detailMode === "inspect"
      ? `<span>Triggers: ${(permanent.triggeredAbilities || []).length} · Static: ${(permanent.staticAbilities || []).length}</span>`
      : "";
  return `
    <div class="permanent-details">
      ${counters.length ? `<span>${counters.map(([type, value]) => `${escapeHtml(type)} ${value}`).join(" / ")}</span>` : ""}
      ${permanent.keywords?.length ? `<span>${permanent.keywords.map(escapeHtml).join(", ")}</span>` : ""}
      ${detailMode === "inspect" ? `<span>${escapeHtml(permanent.rulesText || permanent.oracleText || "No rules text")}</span>` : ""}
      ${triggerInfo}
      ${layerInfo}
    </div>
  `;
}

function renderStatusIconRow(statusIcons = []) {
  if (!statusIcons.length) {
    return "";
  }
  return `
    <div class="status-icon-row">
      ${statusIcons
        .map(
          (status) => `
        <span class="status-icon status-${escapeAttribute(status.key)}" title="${escapeAttribute(status.label)}" aria-label="${escapeAttribute(status.label)}">
          ${escapeHtml(status.glyph)}
        </span>
      `
        )
        .join("")}
    </div>
  `;
}

function collectPermanentStatusIcons(permanent, session, settings) {
  const keywordSet = new Set((permanent.keywords || []).map((keyword) => String(keyword || "").toLowerCase()));
  const hasCounters = Object.values(permanent.counters || {}).some((value) => Number(value) > 0);
  const adhdEnabled = Boolean(settings?.adhdMode?.enabled);
  const unresolvedTrigger =
    (session?.triggerQueue || []).some((entry) => entry.status === "pending" && entry.sourceId === permanent.id) ||
    (session?.pendingEffects || []).some((entry) => entry.status === "pending" && entry.sourceId === permanent.id);
  const hasMonarch = keywordSet.has("monarch") || Number(session?.playerCounters?.monarch || 0) > 0;
  const hasInitiative = keywordSet.has("initiative") || Number(session?.playerCounters?.initiative || 0) > 0;
  const modified = hasCounters || (permanent.temporaryModifiers || []).length > 0 || (permanent.layerBreakdown || []).length > 0;

  const statusOrder = [
    ["tapped", Boolean(permanent.tapped)],
    ["summoningSickness", Boolean(permanent.summoningSick)],
    ["flying", keywordSet.has("flying")],
    ["trample", keywordSet.has("trample")],
    ["vigilance", keywordSet.has("vigilance")],
    ["menace", keywordSet.has("menace")],
    ["deathtouch", keywordSet.has("deathtouch")],
    ["lifelink", keywordSet.has("lifelink")],
    ["ward", keywordSet.has("ward")],
    ["counters", hasCounters],
    ["commander", Boolean(permanent.isCommander)],
    ["token", Boolean(permanent.isToken)],
    ["monarch", hasMonarch],
    ["initiative", hasInitiative],
    ["attacking", Boolean(permanent.attacking)],
    ["blocking", Boolean(permanent.blocking)],
    ["modified", modified],
    ["triggered", (permanent.triggeredAbilities || []).length > 0],
    ["staticEffect", (permanent.staticAbilities || []).length > 0],
    ["replacementEffect", (permanent.replacementEffects || []).length > 0],
    ["unresolvedTrigger", unresolvedTrigger],
    ["adhdReminder", adhdEnabled && unresolvedTrigger],
  ];

  return statusOrder
    .filter(([, enabled]) => enabled)
    .map(([key]) => ({
      key,
      glyph: STATUS_ICON_META[key]?.glyph || key.slice(0, 3).toUpperCase(),
      label: STATUS_ICON_META[key]?.label || key,
    }));
}

function renderLayerBreakdown(layerBreakdown = []) {
  if (!layerBreakdown.length) {
    return "<span>Layers: no active modifiers</span>";
  }
  return `<span>Layers: ${layerBreakdown.map((entry) => `L${entry.layer}:${entry.operation}`).join(" · ")}</span>`;
}

function renderStackMemberDetails(stackMembers = [], detailMode = "standard", permanent = {}) {
  if (!stackMembers.length || detailMode === "compact") {
    return "";
  }
  const imageUrl = getBattlefieldCardImageUrl(permanent);
  return `
    <div class="stack-member-list">
      ${stackMembers.map((member) => `
        <span class="stack-member-card">
          <i class="stack-member-art" ${imageUrl ? `style="background-image:url(&quot;${escapeAttribute(imageUrl)}&quot;)"` : ""} aria-hidden="true"></i>
          <b>${escapeHtml(permanent.name || "Permanent")}</b>
          <small>${escapeHtml(member.instanceId)}${member.tapped ? " · tapped" : ""}${Object.keys(member.counters || {}).length ? ` · ${Object.entries(member.counters).map(([counter, value]) => `${escapeHtml(counter)} ${value}`).join(", ")}` : ""}</small>
        </span>
      `).join("")}
    </div>
  `;
}

function renderBattlefieldViewControls(detailMode, compressionMode, uiLayer = "passive") {
  const detailModes = ["compact", "standard", "inspect"];
  const compressionModes = ["adaptive", "compact", "expanded"];
  return `
    <section class="phase-tracker-card">
      <p class="eyebrow">Battlefield display</p>
      <span>UI layer: ${escapeHtml(formatLabel(uiLayer))}</span>
      <div class="button-grid">
        ${detailModes.map((mode) => `<button class="${detailMode === mode ? "active" : ""}" data-set-detail-mode="${mode}">${formatLabel(mode)}</button>`).join("")}
      </div>
      <div class="button-grid">
        ${compressionModes.map((mode) => `<button class="${compressionMode === mode ? "active" : ""}" data-set-compression-mode="${mode}">${formatLabel(mode)}</button>`).join("")}
      </div>
      <div class="button-grid">
        <button data-setting-button="battlefield.expandedAll" data-value="true">Expand Board Stacks</button>
        <button data-setting-button="battlefield.expandedAll" data-value="false">Collapse Board Stacks</button>
      </div>
    </section>
  `;
}

function renderPredictiveSuggestions(profile) {
  const suggestions = buildPredictiveActions(profile);
  if (!suggestions.length) {
    return `
      <section class="phase-tracker-card">
        <p class="eyebrow">Predictive Actions</p>
        <p>No immediate suggestions.</p>
      </section>
    `;
  }
  return `
    <section class="phase-tracker-card">
      <p class="eyebrow">Predictive Actions</p>
      ${suggestions
        .map(
          (suggestion) => `
        <article class="prediction-row">
          <strong>${escapeHtml(suggestion.label)}</strong>
          <span>${escapeHtml(suggestion.detail)}</span>
          ${
            suggestion.apply
              ? `<button data-prediction-apply="${escapeAttribute(suggestion.id)}">Apply</button>`
              : ""
          }
        </article>
      `
        )
        .join("")}
    </section>
  `;
}

function renderActionTimeline(profile) {
  const entries = profile.activeSession.actionHistory || [];
  return `
    <section class="utility-overlay glass history-timeline" data-no-swipe>
      <div class="overlay-header compact">
        <h2>Action Timeline</h2>
        <button data-close-utility-panel>Close</button>
      </div>
      <div class="timeline-controls row">
        <button data-undo>Undo</button>
        <button data-redo>Redo</button>
      </div>
      <div class="timeline-list scroll-safe">
        ${entries
          .slice(0, 140)
          .map(
            (entry) => `
          <article class="log-card">
            <strong>${escapeHtml(entry.actionType)}</strong>
            <span>${new Date(entry.timestamp).toLocaleTimeString()} · ${escapeHtml(entry.playerId || "local-player")}</span>
            <p>${escapeHtml(JSON.stringify(entry.payload || {}))}</p>
            <button data-replay-action="${entry.actionId}">Replay To Here</button>
          </article>
        `
          )
          .join("") || "<p>No actions yet.</p>"}
      </div>
    </section>
  `;
}

function renderTriggerQueuePanel(profile) {
  const queue = profile.activeSession.triggerQueue || [];
  return `
    <section class="utility-overlay glass trigger-queue-panel mockup-panel" data-no-swipe>
      <div class="overlay-header compact">
        <h2>Trigger Queue</h2>
        <button data-close-utility-panel>Close</button>
      </div>
      <div class="timeline-list scroll-safe">
        ${queue
          .map(
            (entry) => `
          <article class="log-card trigger-row ${entry.status === "pending" ? "pending-trigger" : ""}">
            <b class="trigger-index"></b>
            <div>
            <strong>${escapeHtml(entry.sourceName)}</strong>
            <span>${escapeHtml(entry.eventType)} · Chain ${escapeHtml(entry.chainId)}</span>
            <p>Status: ${escapeHtml(entry.status)} <span class="confidence-pill ${confidenceClass(entry.rulesConfidence)}">${escapeHtml(confidenceLabel(entry.rulesConfidence))}</span></p>
            ${entry.effectDefinitions?.some((effect) => effect.manual) ? `<p><strong>manual choice required</strong></p>` : ""}
            <p>Effects: ${(entry.effectDefinitions || []).map((effect) => escapeHtml(effect.action || "effect")).join(", ")}</p>
            <p>Modifiers: ${(entry.generatedModifiers || []).map((modifier) => `L${modifier.layer}:${modifier.operation}`).join(" · ") || "none"}</p>
            <div class="row mini">
              <button data-trigger-resolve="${entry.id}">Resolve</button>
              <button data-trigger-delay="${entry.id}">Delay</button>
              <button data-trigger-skip="${entry.id}">Skip</button>
              <button data-trigger-inspect="${entry.id}">Inspect</button>
            </div>
            </div>
          </article>
        `
          )
          .join("") || "<p>No queued triggers.</p>"}
      </div>
      <button class="wide resolve-button" data-trigger-resolve-all>Resolve All Possible</button>
    </section>
  `;
}

function renderStackPriorityPanel(profile) {
  const spells = profile.activeSession.stack || [];
  const queue = profile.activeSession.triggerQueue || [];
  const stackItems = [...spells, ...queue, ...(profile.activeSession.pendingEffects || []).filter((entry) => !entry.stackObjectId)];
  return `
    <section class="stack-priority-panel">
      <p class="eyebrow">The Stack</p>
      <div class="timeline-list scroll-safe">
        ${stackItems
          .slice(0, 8)
          .map((entry, index) => `
            <article class="stack-priority-row">
              <div class="stack-thumb">${index + 1}</div>
              <div>
                <strong>${escapeHtml(entry.name || entry.sourceName || entry.summary || "Stack item")}</strong>
                <span>${escapeHtml(entry.typeLine || entry.eventType || entry.status || "Pending")} ${entry.controller ? `(${escapeHtml(entry.controller)})` : ""}</span>
                <p>${escapeHtml(entry.summary || entry.effect?.summary || entry.oracleText || "Waiting for priority.")}</p>
                ${entry.targetIds?.length ? `<small>Targets: ${entry.targetIds.map(escapeHtml).join(", ")}</small>` : ""}
                ${entry.selectedModes?.length ? `<small>Modes: ${entry.selectedModes.map(escapeHtml).join(", ")}</small>` : ""}
                ${entry.xValue !== null && entry.xValue !== undefined ? `<small>X = ${escapeHtml(entry.xValue)}</small>` : ""}
                ${entry.rulesConfidence ? `<span class="confidence-pill ${confidenceClass(entry.rulesConfidence)}">${escapeHtml(confidenceLabel(entry.rulesConfidence))}</span>` : ""}
              </div>
            </article>
          `)
          .join("") || `<article class="stack-priority-row"><div class="stack-thumb">0</div><div><strong>Stack is empty</strong><span>No spells or abilities waiting.</span></div></article>`}
      </div>
      <article class="priority-message">
        <strong>Priority: You</strong>
        <span>Waiting for your action...</span>
      </article>
      <div class="stack-priority-actions">
        <button data-pass-priority>Pass Priority</button>
        <button data-respond-stack>Respond...</button>
        <button class="resolve-button" data-stack-resolve-next>Resolve Next</button>
      </div>
    </section>
  `;
}

function renderTutorialSamplePanel(session) {
  const sampleCards = (session.battlefield?.player || []).slice(0, 4);
  return `
    <section class="tutorial-sample-panel glass" data-no-swipe>
      <div class="tutorial-hero">
        <p class="eyebrow">Tutorial</p>
        <strong>Welcome to BoardState!</strong>
        <span>This sample board shows the core features.</span>
        <small>Step ${escapeHtml(session.tutorial?.step || 1)} of 7</small>
        <button data-helper-remind>Let's Begin</button>
      </div>
      <div class="tutorial-sample-board">
        <p class="eyebrow">Sample Board</p>
        <div class="tutorial-card-grid">
          ${sampleCards
            .map(
              (card) => `
                <article>
                  <strong>${escapeHtml(card.name)}</strong>
                  <span>${escapeHtml(card.typeLine || card.type || "Permanent")}</span>
                  ${card.power || card.toughness ? `<b>${escapeHtml(card.power || "0")}/${escapeHtml(card.toughness || "0")}</b>` : ""}
                </article>
              `
            )
            .join("")}
        </div>
        <label class="tutorial-check"><input type="checkbox" /> Don't show tips</label>
        <button data-exit-tutorial>Exit Tutorial</button>
      </div>
    </section>
  `;
}

function renderUtilityDock(
  profile,
  open,
  activeUtilityPanel,
  hudBadgePositions = HUD_BADGE_DEFAULTS,
  isMobilePortrait = false,
  hudBadgesLocked = false,
  searchResults = [],
  searchMessage = "",
  searchLoading = false,
  searchQuery = "",
  castActionPopup = null
) {
  if (!open && !activeUtilityPanel) {
    return "";
  }
  const manaTotal = Object.values(profile.activeSession.manaPool || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  return `
    <section class="utility-dock ${open ? "open" : ""}">
      ${open ? `
        <div class="utility-dock-menu glass">
          <button data-open-utility="dice">Dice</button>
          <button data-open-utility="tokens">Token Gen</button>
          <button data-open-utility="mana">Mana ${manaTotal ? `(${manaTotal})` : ""}</button>
          <button data-open-utility="display">Display</button>
          <button data-open-utility="search">Search/Add</button>
          <button data-open-utility="stack">Stack/Priority</button>
          <button data-open-utility="calculator">Calculator</button>
          <button data-open-utility="notes">Notes</button>
          <button data-open-utility="phase">Phase</button>
          <button data-open-utility="triggers">Queue</button>
          <button data-open-utility="history">History</button>
          <button data-open-utility="rules">Rules</button>
        </div>
      ` : ""}
      ${renderUtilityPanel(profile, activeUtilityPanel, isMobilePortrait, searchResults, searchMessage, searchLoading, searchQuery, castActionPopup)}
    </section>
  `;
}

function renderMobileBattlefieldDock(profile, activeUtilityPanel = "", utilityDockOpen = false, includeCombat = true, combatResolving = false, isMobilePortrait = true) {
  const hasQueuedTriggers = Boolean((profile.activeSession?.triggerQueue || []).length);
  return `
    <section class="battlefield-mobile-dock battlefield-command-console ${isMobilePortrait ? "is-mobile" : "is-desktop"} glass" data-no-swipe>
      <div class="battlefield-mobile-dock__status">
        ${hasQueuedTriggers ? `<button data-open-utility="triggers" class="${activeUtilityPanel === "triggers" ? "active" : ""}">Queue</button>` : ""}
      </div>
      <div class="battlefield-mobile-wheel battlefield-command-grid">
        <div class="battlefield-command-column battlefield-command-column--left" aria-label="Left battlefield dashboard commands">
          <button class="battlefield-wheel-action action-tools" data-dashboard-action="tools" data-open-tool-menu aria-label="Open tools">
            <span class="dock-icon" aria-hidden="true">&#9874;</span>
            <span>Tools</span>
          </button>
          <button class="battlefield-wheel-action action-utility ${utilityDockOpen ? "active" : ""}" data-dashboard-action="utility" data-toggle-utility-dock aria-label="Open utility menu">
            <span class="dock-icon" aria-hidden="true">&#9881;</span>
            <span>Utility</span>
          </button>
          <button class="battlefield-wheel-action action-attackers ${includeCombat ? "" : "is-unavailable"}" data-dashboard-action="attackers" data-combat-available="${includeCombat ? "true" : "false"}" data-declare-attackers aria-label="Declare attackers">
            <span class="dock-icon" aria-hidden="true">&#9876;</span>
            <span>Attackers</span>
          </button>
        </div>
        <button class="battlefield-wheel-center battlefield-wheel-center--raised" data-next-phase aria-label="Next Phase">
          <span class="dock-icon" aria-hidden="true">&#9193;</span>
          <span>Next</span>
          <span>Phase</span>
        </button>
        <div class="battlefield-command-column battlefield-command-column--right" aria-label="Right battlefield dashboard commands">
          <button class="battlefield-wheel-action action-search" data-dashboard-action="search" data-open-utility="search" aria-label="Search Scryfall">
            <span class="dock-icon" aria-hidden="true">&#128269;</span>
            <span>Search</span>
          </button>
          <button class="battlefield-wheel-action action-activate" data-dashboard-action="activate" data-activate-board aria-label="Activate board">
            <span class="dock-icon" aria-hidden="true">&#9889;</span>
            <span>Activate</span>
          </button>
          <button class="battlefield-wheel-action action-resolve" data-dashboard-action="resolve" data-combat-available="${includeCombat ? "true" : "false"}" data-resolve-combat ${combatResolving ? "disabled" : ""} aria-label="Resolve stack or combat">
            <span class="dock-icon" aria-hidden="true">&#128737;</span>
            <span>${combatResolving ? "Resolving..." : "Resolve"}</span>
          </button>
        </div>
      </div>
    </section>
  `;
}

function renderUtilityPanel(profile, panel, isMobilePortrait = false, searchResults = [], searchMessage = "", searchLoading = false, searchQuery = "", castActionPopup = null) {
  if (!panel || panel === "history" || panel === "triggers") {
    return "";
  }
  const session = profile.activeSession;
  const note = profile.settings?.playerNotes?.dock || "";
  const diceValue = profile.settings?.utility?.lastDice || "d20: 1";
  const calcValue = profile.settings?.utility?.calculator || "";
  const rulesText = (getSelectedPermanents(session)[0]?.rulesText || getSelectedPermanents(session)[0]?.oracleText || "Select a permanent to inspect rules.");
  const utilityTitle = panel === "search" ? "Search/Add Card" : panel === "stack" ? "Stack & Priority" : formatLabel(panel);
  const mobileSheetClass = isMobilePortrait ? "mobile-bottom-sheet" : "";
  return `
    <section class="utility-overlay glass ${mobileSheetClass}" data-no-swipe>
      <div class="overlay-header compact">
        <h2>${escapeHtml(utilityTitle)}</h2>
        <button data-close-utility-panel>Close</button>
      </div>
      ${panel === "dice" ? `
        <div class="button-grid">
          <button data-roll-dice="6">Roll d6</button>
          <button data-roll-dice="20">Roll d20</button>
          <button data-roll-dice="100">Roll d100</button>
        </div>
        <p>${escapeHtml(diceValue)}</p>
      ` : ""}
      ${panel === "tokens" ? `
        <button class="wide" data-open-tool-panel="tokens">Open Token Generator</button>
      ` : ""}
      ${panel === "mana" ? `
        <button class="wide" data-open-floating-mana>Open Floating Mana</button>
      ` : ""}
      ${panel === "display" ? `
        ${renderBattlefieldViewControls(
          profile.settings?.battlefield?.detailMode || "standard",
          profile.settings?.battlefield?.compressionMode || "adaptive",
          resolveUiLayerState(profile, "battlefield").current
        )}
      ` : ""}
      ${panel === "calculator" ? `
        <input data-utility-calculator value="${escapeAttribute(calcValue)}" placeholder="e.g. (6+4)*2-3" />
        <button class="wide" data-run-calculator>Calculate</button>
      ` : ""}
      ${panel === "notes" ? `
        <textarea data-utility-note rows="5" placeholder="Game notes">${escapeHtml(note)}</textarea>
        <button class="wide" data-save-utility-note>Save Note</button>
      ` : ""}
      ${panel === "phase" ? `
        <p>FSM ${escapeHtml(session.fsm?.current || "setup")} · Turn ${session.turn}</p>
        <button class="wide" data-next-phase>Advance Phase</button>
      ` : ""}
      ${panel === "stack" ? renderStackPriorityPanel(profile) : ""}
      ${panel === "rules" ? `
        <p>${escapeHtml(rulesText)}</p>
        <button class="wide" data-open-tool-panel="inspect">Inspect Selected Permanent</button>
      ` : ""}
      ${panel === "search" ? renderSearch(searchResults, searchMessage, searchLoading, searchQuery, "battlefield", castActionPopup) : ""}
      ${panel === "simulation" ? `
        <div class="simulation-log scroll-safe">
          ${(session.simulation?.log || [])
            .slice(0, 26)
            .map((entry) => `<p><strong>${escapeHtml(entry.actorId || "system")}</strong> · ${escapeHtml(entry.text || "")}</p>`)
            .join("") || "<p>No simulation actions yet.</p>"}
        </div>
      ` : ""}
    </section>
  `;
}

function renderEdgeSwipeZones(profile) {
  if (!profile.settings?.navigation?.edgeSwipeShortcuts) {
    return "";
  }
  return `
    <div class="edge-swipe-zone edge-left" data-edge-zone="left" aria-hidden="true"></div>
    <div class="edge-swipe-zone edge-right" data-edge-zone="right" aria-hidden="true"></div>
    <div class="edge-swipe-zone edge-bottom" data-edge-zone="bottom" aria-hidden="true"></div>
    <div class="edge-swipe-zone edge-top" data-edge-zone="top" aria-hidden="true"></div>
  `;
}

function getDensityClass(permanents = [], compressionMode = "adaptive") {
  if (compressionMode === "compact") {
    return "density-high";
  }
  if (compressionMode === "expanded") {
    return "density-low";
  }
  const count = permanents.reduce((sum, permanent) => sum + (Number(permanent.quantity) || 1), 0);
  if (count >= 18) {
    return "density-high";
  }
  if (count >= 10) {
    return "density-medium";
  }
  return "density-low";
}

function renderSearch(results, message, loading = false, query = "", mode = "battlefield", castActionPopup = null) {
  const deckMode = mode === "decks";
  return `
    <form class="search-box search-box--mockup" data-search-form>
      <label><span class="search-label-icon" aria-hidden="true">&#128269;</span>Scryfall Search</label>
      <div class="search-input-row">
        <input name="query" data-search-query value="${escapeAttribute(query)}" placeholder="Search for a card..." />
        <button aria-label="Search Scryfall" ${loading ? "disabled" : ""}>${loading ? "Searching…" : "Search"}</button>
      </div>
      <div class="search-tabs" aria-label="Search result categories">
        <span class="active">Search Results</span>
        <span>Recent</span>
        <span>Favorites</span>
      </div>
      <p>${escapeHtml(message || "Works offline with saved commander deck matches.")}</p>
    </form>
    <div class="search-layout">
    <div class="search-results scroll-safe" data-no-swipe>
      ${results
        .map((card, index) => {
          const commanderEligible =
            canBeCommander(card) ||
            (/\blegendary\b/i.test(card.typeLine || "") &&
              (/\bcreature\b/i.test(card.typeLine || "") ||
                (/\bplaneswalker\b/i.test(card.typeLine || "") && /can be your commander/i.test(card.oracleText || ""))));
          return `
        <article class="search-result-card">
          ${card.imageSmall ? `<img class="search-card-thumb" src="${escapeAttribute(card.imageSmall)}" alt="" loading="lazy" />` : `<div class="search-card-thumb placeholder" aria-hidden="true"></div>`}
          <div class="search-card-copy">
          <strong>${escapeHtml(card.name)}</strong>
          <span>${escapeHtml(card.typeLine || "")}</span>
          <p>${escapeHtml(truncateText(card.oracleText || "", 84))}</p>
          </div>
          <div class="row mini search-result-actions">
            ${deckMode ? `
              <button data-deck-result="${index}">Add to deck</button>
              ${commanderEligible ? `<button data-commander-result="${index}">Make commander</button>` : ""}
            ` : `
              <button class="cast-badge ${castActionPopup?.index === index ? "active" : ""}" data-cast-result="${index}" aria-expanded="${castActionPopup?.index === index ? "true" : "false"}">Cast</button>
            `}
          </div>
        </article>
      `;
        })
        .join("")}
    </div>
    ${deckMode ? "" : renderCastActionPopup(results, castActionPopup)}
    </div>
  `;
}

function renderCastActionPopup(results = [], popup = null) {
  if (!popup || !results[popup.index]) {
    return "";
  }
  const card = results[popup.index];
  return `
    <aside class="cast-action-popup glass scroll-safe" data-no-swipe role="dialog" aria-label="Cast options for ${escapeAttribute(card.name)}">
      <div class="overlay-header compact">
        <div>
          <p class="eyebrow">Cast / Action</p>
          <strong>${escapeHtml(card.name)}</strong>
        </div>
        <button type="button" data-close-cast-popup aria-label="Close cast options">Close</button>
      </div>
      <div class="cast-action-popup__grid">
        <button type="button" data-cast-action-zone="hand" data-cast-action-index="${popup.index}"><span aria-hidden="true">&#9995;</span>Cast from Hand</button>
        <button type="button" data-cast-action-zone="graveyard" data-cast-action-index="${popup.index}"><span aria-hidden="true">&#9760;</span>Cast from Graveyard</button>
        <button type="button" data-cast-action-zone="exile" data-cast-action-index="${popup.index}"><span aria-hidden="true">&#128274;</span>Cast from Exile</button>
        <button type="button" data-cast-action-zone="command" data-cast-action-index="${popup.index}"><span aria-hidden="true">&#128737;</span>Cast from Command Zone</button>
        <button type="button" class="put-battlefield-action" data-cast-action-put="${popup.index}"><span aria-hidden="true">&#10148;</span>Put onto Battlefield <small>Not casting</small></button>
      </div>
      <label class="cast-action-owner-toggle">
        <span>Card belongs to opponent</span>
        <input type="checkbox" data-cast-owner-opponent ${popup.opponent ? "checked" : ""} />
      </label>
    </aside>
  `;
}

function renderBattlefieldToolBadge(profile, menuOpen, floatingManaOpen, activeToolPanel, positions, toolContext, isMobilePortrait = false, hudBadgesLocked = false, simulationLogOpen = false) {
  const manaPinned = Boolean(profile.settings?.battlefield?.manaPinned);
  const radialActions = getContextualRadialActions(toolContext, floatingManaOpen || manaPinned);
  const simulation = profile.activeSession?.simulation || {};
  return `
    <div class="battlefield-tool-system">
      ${menuOpen ? `
      <section class="radial-menu glass">
        <p class="radial-context-label">Context: ${escapeHtml(formatLabel(toolContext))}</p>
        ${simulation.enabled ? `
          <div class="tools-dry-run-section">
            <p class="eyebrow">Dry Run Controls</p>
            <strong>${escapeHtml(getSimulationActorName(profile))} · Turn ${escapeHtml(profile.activeSession?.turn || 1)} · ${escapeHtml(PHASES[profile.activeSession?.phaseIndex] || "Beginning")}</strong>
            <button data-open-tool-panel="simulation">Open controls &amp; log</button>
          </div>
        ` : ""}
        ${radialActions.map((entry) => renderRadialAction(entry)).join("")}
      </section>
      ` : ""}
      ${activeToolPanel ? renderBattlefieldToolPanel(profile, activeToolPanel, toolContext, isMobilePortrait, simulationLogOpen) : ""}
      ${floatingManaOpen || manaPinned ? renderFloatingManaControls(profile, manaPinned, positions, isMobilePortrait, hudBadgesLocked) : ""}
    </div>
  `;
}

function getContextualRadialActions(toolContext, manaOpen) {
  const base = [
    { type: "panel", panel: "player", label: "Player Controls" },
    { type: "utility", panel: "triggers", label: "Utility Dock" },
    { type: "options", label: "Game Options" },
    { type: "mana", label: manaOpen ? "Hide Floating Mana" : "Floating Mana Controls" },
  ];
  if (toolContext === "player") {
    return base;
  }
  if (toolContext === "empty") {
    return [{ type: "panel", panel: "tokens", label: "Token Controls" }, ...base];
  }
  if (toolContext === "token") {
    return [
      { type: "panel", panel: "tokens", label: "Token Controls" },
      { type: "panel", panel: "counters", label: "Permanent Counter Controls" },
      { type: "panel", panel: "permanents", label: "Permanent Controls" },
      { type: "panel", panel: "inspect", label: "Inspect" },
      ...base,
    ];
  }
  if (toolContext === "stack") {
    return [
      { type: "panel", panel: "tokens", label: "Token Stack Controls" },
      { type: "panel", panel: "permanents", label: "Permanent Controls" },
      { type: "panel", panel: "inspect", label: "Inspect Stack" },
      ...base,
    ];
  }
  if (toolContext === "commander") {
    return [
      { type: "panel", panel: "commander", label: "Commander Tools" },
      { type: "panel", panel: "counters", label: "Permanent Counter Controls" },
      { type: "panel", panel: "permanents", label: "Permanent Controls" },
      { type: "panel", panel: "inspect", label: "Inspect" },
      ...base,
    ];
  }
  if (toolContext === "creature" || toolContext === "permanent") {
    return [
      { type: "panel", panel: "permanents", label: "Permanent Controls" },
      { type: "panel", panel: "counters", label: "Permanent Counter Controls" },
      { type: "panel", panel: "inspect", label: "Inspect" },
      ...base,
    ];
  }
  return base;
}

function renderRadialAction(entry) {
  if (entry.type === "panel") {
    return `<button data-open-tool-panel="${escapeAttribute(entry.panel)}">${escapeHtml(entry.label)}</button>`;
  }
  if (entry.type === "options") {
    return `<button data-open-game-options>${escapeHtml(entry.label)}</button>`;
  }
  if (entry.type === "utility") {
    return `<button data-open-utility="${escapeAttribute(entry.panel || "triggers")}">${escapeHtml(entry.label)}</button>`;
  }
  return `<button data-open-floating-mana>${escapeHtml(entry.label)}</button>`;
}

function renderFloatingManaControls(profile, pinned, positions = HUD_BADGE_DEFAULTS, isMobilePortrait = false, hudBadgesLocked = false) {
  const session = profile.activeSession;
  const colors = Object.entries(session.manaPool);
  const position = positions.floatingMana || HUD_BADGE_DEFAULTS.floatingMana;
  const inlineStyle = isMobilePortrait && !pinned ? `style="left:${Math.round(position.x)}px;top:${Math.round(position.y)}px;"` : "";
  const draggableAttrs = isMobilePortrait && !pinned
    ? `data-draggable-hud="floatingMana" data-hud-lock-state="${hudBadgesLocked ? "locked" : "unlocked"}"`
    : "";
  return `
    <section class="floating-mana glass ${pinned ? "pinned" : ""} ${isMobilePortrait ? "mobile-bottom-sheet" : ""}" ${inlineStyle} ${draggableAttrs}>
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

function renderBattlefieldToolPanel(profile, panel, toolContext = "empty", isMobilePortrait = false, simulationLogOpen = false) {
  const titleMap = {
    tokens: "Token Controls",
    permanents: "Permanent Controls",
    player: "Player Controls",
    counters: "Permanent Counter Controls",
    inspect: "Inspect",
    commander: "Commander Tools",
    simulation: "Dry Run Controls",
  };
  return `
    <section class="floating-tool-panel glass ${isMobilePortrait ? "mobile-bottom-sheet" : ""}" data-floating-tool-panel data-tool-context="${escapeAttribute(toolContext)}">
      <div class="overlay-header compact">
        <h2>${titleMap[panel] || "Battlefield Tool"}</h2>
        <button data-close-tool-panel>Close</button>
      </div>
      ${panel === "tokens" ? renderTokenControls() : ""}
      ${panel === "permanents" ? renderPermanentControls(profile) : ""}
      ${panel === "player" ? renderPlayerControls(profile) : ""}
      ${panel === "counters" ? renderPermanentCounterControls(profile) : ""}
      ${panel === "inspect" ? renderInspectPanel(profile) : ""}
      ${panel === "commander" ? renderCommanderTools(profile) : ""}
      ${panel === "simulation" ? renderSimulationToolsPanel(profile, simulationLogOpen) : ""}
    </section>
  `;
}

function renderSimulationToolsPanel(profile, simulationLogOpen = false) {
  const session = profile.activeSession || {};
  const simulation = session.simulation || {};
  if (!simulation.enabled) {
    return `<p class="eyebrow">Dry Run is not active.</p>`;
  }
  const running = simulation.status === "running";
  const opponents = (simulation.selectedOpponents || [])
    .map((id) => simulation.opponents?.[id]?.name || formatLabel(id))
    .join(" / ");
  return `
    <div class="simulation-tools-panel">
      <article class="simulation-tools-status">
        <p class="eyebrow">Dry Run · ${escapeHtml(opponents || "NPC match")}</p>
        <h3>${running ? "Running" : escapeHtml(formatLabel(simulation.status || "paused"))}</h3>
        <strong>${escapeHtml(getSimulationActorName(profile))} · Turn ${escapeHtml(session.turn || 1)} · ${escapeHtml(PHASES[session.phaseIndex] || "Beginning")}</strong>
        <span>Revenge learning ${simulation.revengeEnabled === false ? "OFF" : "ON"} · ${escapeHtml(simulation.format || "Commander")}</span>
      </article>
      <div class="button-grid">
        ${running ? `<button data-simulation-pause>Pause</button>` : `<button data-simulation-resume>Resume</button>`}
        <button data-simulation-pass-turn>Pass Turn</button>
        <button data-simulation-log-toggle>${simulationLogOpen ? "Hide Log" : "Show Log"}</button>
        <button data-simulation-stop>End Dry Run</button>
      </div>
      <div class="simulation-speed-controls" aria-label="Simulation speed">
        ${["step", "normal", "fast"]
          .map((speed) => `<button class="${simulation.speed === speed ? "active" : ""}" data-simulation-speed-control="${speed}">${formatLabel(speed)}</button>`)
          .join("")}
      </div>
      ${simulationLogOpen ? `
        <article class="simulation-log scroll-safe" data-no-swipe>
          ${(simulation.log || [])
            .slice(0, 60)
            .map((entry) => `<p><strong>${escapeHtml(entry.actorId || "system")}</strong> · ${escapeHtml(entry.text || "")}</p>`)
            .join("") || "<p>No simulation actions yet.</p>"}
        </article>
      ` : ""}
    </div>
  `;
}

function renderPlayerControls(profile) {
  const session = profile.activeSession;
  const note = profile.settings?.playerNotes?.session || "";
  const zoneCounts = getVisibleZoneCounts(session);
  return `
    <div class="player-control-widget">
      <article class="phase-tracker-card">
        <p class="eyebrow">Current turn</p>
        <h2>Turn ${session.turn}</h2>
        <strong>${escapeHtml(PHASES[session.phaseIndex])}</strong>
      </article>
      <div class="zone-count-grid">
        <article><span>Hand</span><strong>${escapeHtml(formatZoneCount(zoneCounts.hand))}</strong></article>
        <article><span>Library</span><strong>${escapeHtml(formatZoneCount(zoneCounts.library))}</strong></article>
        <article><span>Graveyard</span><strong>${escapeHtml(formatZoneCount(zoneCounts.graveyard))}</strong></article>
        <article><span>Exile</span><strong>${escapeHtml(formatZoneCount(zoneCounts.exile))}</strong></article>
      </div>
      <div class="tool-action-section">
        <strong>Actions</strong>
        <div class="player-action-grid">
          <button data-mulligan-tracker><span class="action-icon">&#128400;</span>Mulligan Tracker</button>
          <button data-open-tool-panel="commander"><span class="action-icon">&#9812;</span>Commander Tax</button>
          <button data-next-phase><span class="action-icon">&#128228;</span>End Step</button>
          <button data-next-phase><span class="action-icon">&#8635;</span>Pass Turn</button>
        </div>
      </div>
      <div class="tool-action-section">
        <strong>Game</strong>
        <div class="player-action-grid">
          <button data-undo><span class="action-icon">&#8630;</span>Undo</button>
          <button data-open-utility="history"><span class="action-icon">&#128203;</span>History Log</button>
          <button data-open-utility="triggers"><span class="action-icon">&#9888;</span>Manual Choice</button>
          <button data-setting-button="battlefield.locked" data-value="true"><span class="action-icon">&#128274;</span>Lock Board</button>
        </div>
      </div>
      <details class="player-extra-controls">
        <summary>Life, counters, and notes</summary>
        <div class="button-grid">
          <button data-open-life-quick>Life</button>
          <button data-open-commander-quick>Commander Damage</button>
          <button data-player-counter-delta="poison" data-delta="1">Poison +1</button>
          <button data-player-counter-delta="energy" data-delta="1">Energy +1</button>
          <button data-player-life-delta="-1">Life -1</button>
          <button data-player-life-delta="1">Life +1</button>
          <button data-player-life-delta="-5">Life -5</button>
          <button data-player-life-delta="5">Life +5</button>
        </div>
        <label class="stacked-form">Notes
          <textarea rows="3" data-player-note-input placeholder="Table notes, reminders, politics...">${escapeHtml(note)}</textarea>
        </label>
        <button class="wide" data-save-player-note>Save notes</button>
      </details>
    </div>
  `;
}

function getVisibleZoneCounts(session = {}) {
  const legacyCounts = session.zoneCounts || session.hiddenZones?.localPlayer || {};
  const zones = session.zones || {};
  const unknownCounts = zones.unknownCounts || {};
  return Object.fromEntries(
    ["hand", "library", "graveyard", "exile"].map((zone) => {
      if (Number.isFinite(Number(legacyCounts[zone]))) {
        return [zone, Number(legacyCounts[zone])];
      }
      return [zone, (Array.isArray(zones[zone]) ? zones[zone].length : 0) + Math.max(0, Number(unknownCounts[zone]) || 0)];
    })
  );
}

function formatZoneCount(value) {
  return Number.isFinite(Number(value)) ? String(Number(value)) : "-";
}

function renderTokenControls() {
  return `
    <div class="stacked-form">
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
      <div class="button-grid">
        <button data-token-remove-selected>Remove selected token(s)</button>
        <button data-setting-button="battlefield.expandedAll" data-value="true">Expand token stacks</button>
        <button data-setting-button="battlefield.expandedAll" data-value="false">Collapse token stacks</button>
      </div>
    </div>
  `;
}

function renderPermanentControls(profile) {
  const selectedCount = profile.activeSession.selectedIds?.length || 0;
  const expanded = Boolean(profile.settings?.battlefield?.expandedAll);
  const selected = getSelectedPermanents(profile.activeSession);
  const selectedStacks = selected.filter((permanent) => Number(permanent.quantity || 1) > 1);
  const maxStackQuantity = selectedStacks.reduce((max, permanent) => Math.max(max, Number(permanent.quantity || 1)), 0);
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
        <button data-selected-action="inspect">Inspect selected</button>
        <button data-setting-button="battlefield.expandedAll" data-value="${expanded ? "false" : "true"}">${expanded ? "Collapse all permanents" : "Expand all permanents"}</button>
        <button data-selected-action="clear">Clear selected permanents</button>
      </div>
      ${
        selectedStacks.length
          ? `
        <div class="stacked-form stack-removal-card">
          <p class="eyebrow">Stack quantity removal (${selectedStacks.length} stack${selectedStacks.length === 1 ? "" : "s"} selected, max ${maxStackQuantity})</p>
          <label>Removal mode
            <select data-stack-remove-mode>
              <option value="destroy">Destroy</option>
              <option value="exile">Exile</option>
              <option value="sacrifice">Sacrifice</option>
              <option value="bounce">Bounce / Return</option>
              <option value="remove">Generic Remove</option>
            </select>
          </label>
          <div class="button-grid">
            <button data-stack-remove="single">Remove 1</button>
            <button data-stack-remove="custom">Remove Custom</button>
            <button data-stack-remove="all">Remove All</button>
          </div>
        </div>
      `
          : ""
      }
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

function renderInspectPanelLegacy(profile) {
  const selected = getSelectedPermanents(profile.activeSession);
  const recentEvents = (profile.activeSession.eventHistory || []).slice(0, 8);
  if (!selected.length) {
    return `<p class="eyebrow">Select one or more permanents to inspect details and active modifications.</p>`;
  }
  return `
    <div class="stacked-form">
      ${selected.map((permanent) => `
        <article class="log-card">
          <strong>${escapeHtml(permanent.name)}</strong>
          <span>${escapeHtml(permanent.typeLine)}</span>
          <p>${permanent.isCreature ? `${permanent.currentPower}/${permanent.currentToughness}` : "Non-creature permanent"}</p>
          ${
            Object.entries(permanent.counters || {}).filter(([, value]) => Number(value) > 0).length
              ? `<p>${Object.entries(permanent.counters || {}).filter(([, value]) => Number(value) > 0).map(([type, value]) => `${escapeHtml(type)} ${value}`).join(" / ")}</p>`
              : ""
          }
          ${permanent.keywords?.length ? `<p>${permanent.keywords.map(escapeHtml).join(", ")}</p>` : ""}
          <p>${escapeHtml(permanent.rulesText || permanent.oracleText || "No rules text")}</p>
          <p>Triggers ${(permanent.triggeredAbilities || []).length} · Static ${(permanent.staticAbilities || []).length}</p>
          <p>${(permanent.layerBreakdown || []).map((entry) => `L${entry.layer}:${entry.operation}`).join(" · ") || "No active layer modifiers"}</p>
        </article>
      `).join("")}
      <article class="log-card">
        <strong>Trigger History</strong>
        ${recentEvents.map((event) => `<p>${escapeHtml(event.eventType)} · ${new Date(event.timestamp).toLocaleTimeString()}</p>`).join("") || "<p>No recent events</p>"}
      </article>
    </div>
  `;
}

function renderCommanderTools(profile) {
  const commander = profile.activeSession.commander || {};
  const opponentDamage = commander.damageByOpponent?.opponent || 0;
  return `
    <div class="stacked-form">
      <article class="phase-tracker-card">
        <p class="eyebrow">Commander status</p>
        <h2>${escapeHtml(commander.name || "No commander selected")}</h2>
        <strong>Tax ${commander.commanderTax || 0}</strong>
        <p>Cast count ${commander.castCount || 0} · Damage ${opponentDamage}</p>
      </article>
      <div class="button-grid">
        <button data-cast-commander>Cast Commander</button>
        <button data-commander-damage data-delta="1">Damage +1</button>
        <button data-commander-damage data-delta="-1">Damage -1</button>
        <button data-open-commander-quick>Adjust damage</button>
      </div>
    </div>
  `;
}

function renderPending(session, collapsed = false) {
  const activeEffects = (session.pendingEffects || []).filter((effect) => !["resolved", "skipped", "ignored"].includes(effect.status));
  if (!activeEffects.length) {
    return "";
  }
  if (collapsed) {
    const pendingCount = activeEffects.filter((effect) => effect.status === "pending").length || activeEffects.length;
    return `
    <section class="pending-strip glass manual-choice-panel manual-choice-panel--collapsed" data-no-swipe>
      <button class="wide" data-open-manual-choice-panel>Manual choice required (${pendingCount}) · Open</button>
    </section>
  `;
  }
  return `
    <section class="pending-strip glass manual-choice-panel">
      <div class="overlay-header compact">
        <h2>Manual Choice Required</h2>
        <button data-helper-remind>Remind Me</button>
      </div>
      ${activeEffects.map((effect) => `
        <article>
          <strong>${escapeHtml(effect.sourceName)}</strong>
          <span>${escapeHtml(effect.status === "pending" ? "manual choice required" : effect.status)} <i class="confidence-pill ${confidenceClass(effect.rulesConfidence)}">${escapeHtml(confidenceLabel(effect.rulesConfidence))}</i></span>
          <p>${escapeHtml(effect.summary || effect.effect?.summary || effect.effect?.reason || effect.effect?.action || "Manual decision required.")}</p>
          ${effect.oracleText ? `<small>${escapeHtml(effect.oracleText)}</small>` : ""}
          ${effect.stackObjectId ? `<small>Stack object: ${escapeHtml(effect.stackObjectId)} · Controller: ${escapeHtml(effect.controller || "player")}</small>` : ""}
          ${renderSpellTargetChoices(session, effect)}
          <button data-pending-effect="${effect.id}" data-status="resolved">Resolved</button>
          <button data-pending-effect="${effect.id}" data-status="skipped">Skipped</button>
          <button data-pending-effect="${effect.id}" data-status="ignored">Ignored</button>
          <button data-helper-remind>Remind Me</button>
        </article>
      `).join("")}
    </section>
  `;
}

function renderSpellTargetChoices(session, pending) {
  if (pending.effect?.choiceKind !== "targets" || !pending.stackObjectId || pending.status !== "pending") {
    return "";
  }
  const spell = (session.stack || []).find((entry) => entry.id === pending.stackObjectId);
  const targetKind = (spell?.card?.parsedEffects || []).find((effect) => effect.manual && effect.target)?.target || "selected";
  const playerTargets = [
    { id: "local-player", name: "You" },
    ...(session.simulation?.enabled
      ? Object.values(session.simulation.players || {})
          .filter((player) => player.id !== "local-player")
          .map((player) => ({ id: player.id, name: player.name || player.id }))
      : [{ id: "opponent", name: "Opponent" }]),
  ];
  const permanents = [...(session.battlefield?.player || []), ...(session.battlefield?.opponent || [])].filter((permanent) => {
    if (targetKind.includes("creature")) return permanent.isCreature;
    if (targetKind.includes("artifact-enchantment")) return permanent.isArtifact || permanent.isEnchantment;
    if (targetKind.includes("artifact-creature")) return permanent.isArtifact || permanent.isCreature;
    if (targetKind.includes("artifact")) return permanent.isArtifact;
    if (targetKind.includes("enchantment")) return permanent.isEnchantment;
    if (targetKind.includes("nonland")) return !permanent.isLand;
    return true;
  });
  const includePlayers = targetKind === "selected" || targetKind.includes("player") || targetKind.includes("opponent");
  const choices = [
    ...(includePlayers ? playerTargets : []),
    ...permanents.map((permanent) => ({ id: permanent.id, name: permanent.name })),
  ];
  return choices.length
    ? `<div class="manual-target-grid" aria-label="Valid spell targets">${choices
        .map(
          (choice) =>
            `<button data-pending-id="${escapeAttribute(pending.id)}" data-spell-target="${escapeAttribute(choice.id)}">${escapeHtml(choice.name)}</button>`
        )
        .join("")}</div>`
    : `<small>No known legal targets are currently visible. Keep this choice pending or resolve it manually.</small>`;
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

function renderDecks(profile, results, message, searchLoading, searchQuery) {
  const decks = Object.values(profile.commanders || {});
  return `
    <section class="utility-page glass">
      <h2>Commander Decks</h2>
      ${renderSearch(results, message, searchLoading, searchQuery, "decks")}
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
  const sections = Object.entries(profile.leaderboards || {});
  return `
    <section class="utility-page glass">
      <h2>Local Leaderboards</h2>
      <button class="wide" data-open-stats>Open Stats Overlay</button>
      ${sections.map(([name, records]) => `
        <article class="leaderboard-hud-block">
          <strong>${escapeHtml(name)}</strong>
          ${(records || []).length
            ? (records || [])
                .map(
                  (record) => `
              <div class="leaderboard-hud-row">
                <span>${escapeHtml(record.label)}</span>
                <b>${escapeHtml(record.value)}</b>
              </div>
            `
                )
                .join("")
            : `<p class="eyebrow">No records yet</p>`}
        </article>
      `).join("")}
    </section>
  `;
}

function renderGameOptions(profile, page = "life") {
  const settings = getSettings(profile);
  const panels = getPagePanels(profile);
  const multiplayer = getMultiplayerSettings(profile);
  const compositionMode = profile.settings?.appearance?.compositionMode || "auto";
  const resolvedCompositionMode = resolveCompositionMode(profile);
  const compositionLabel =
    compositionMode === "auto"
      ? `Auto detect (${resolvedCompositionMode === "mobile" ? "Mobile view" : "Widescreen view"})`
      : resolvedCompositionMode === "mobile"
        ? "Mobile view"
        : "Widescreen view";
  const localAuth = profile.localAuth || {};
  const simulation = profile.activeSession?.simulation || {};
  const gameTracking = profile.activeSession?.gameTracking || {};
  const showEndGame = page === "battlefield" && (Boolean(simulation.enabled) || Boolean(gameTracking.active));
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
        <div class="overlay-grid options-menu-grid">
          ${showEndGame ? `
          <article class="option-card">
            <h3>Active Game</h3>
            <p>Simulation: ${simulation.enabled ? "Active" : "Inactive"} · Tracking: ${gameTracking.active ? "Active" : "Inactive"}</p>
            <button class="wide" data-end-game>End Game</button>
          </article>
          ` : ""}
          <article class="option-card">
            <h3>Profile & Local Storage</h3>
            <p>Status: ${localAuth.mode === "protected" ? "Password profile loaded" : "Guest / fresh mode"}${localAuth.hasPassword ? " · Password profile available" : ""}</p>
            <div class="button-grid">
              <button data-open-profile-page>Open Profile Page</button>
              <button data-guest-mode>Continue as Guest/Fresh</button>
              ${localAuth.mode === "protected" ? `<button data-lock-profile>Logout / Lock Profile</button>` : ""}
            </div>
            <form data-profile-form class="stacked-form">
              <label>Profile name</label>
              <input name="profileName" value="${escapeAttribute(profile.player?.name || "Player")}" placeholder="Player name" />
              <button class="wide">Save Locally</button>
            </form>
            <form data-create-password-form class="stacked-form">
              <label>Create Password</label>
              <input name="password" type="password" autocomplete="new-password" placeholder="Create local password" />
              <button class="wide">Create / Save Protected Profile</button>
            </form>
            <form data-login-form class="stacked-form">
              <label>Login</label>
              <input name="password" type="password" autocomplete="current-password" placeholder="Local password" />
              <button class="wide">Login and Load Saved Data</button>
            </form>
            <p>Local device protection only. No cloud authentication, and plaintext passwords are never stored.</p>
          </article>
          <article class="option-card">
            <h3>Gameplay / Multiplayer</h3>
            <div class="button-grid">
              <button data-multiplayer-mode="local">Local Multiplayer</button>
              <button data-multiplayer-mode="wifi">Connect via WiFi</button>
              <button data-multiplayer-mode="bluetooth">Bluetooth Placeholder</button>
              <button data-multiplayer-mode="simulated">Simulated Local</button>
              <button data-multiplayer-mode="offline">Disconnect</button>
              <button data-open-synced-turn-order-setup>d20 Turn Order</button>
              <button data-open-simulation-setup>Dry Run Setup</button>
              <button data-open-simulation-stats>Simulation Stats</button>
            </div>
            <p>Mode: ${escapeHtml(multiplayer.mode)}</p>
            <p>Connected players: ${multiplayer.connectedPlayers.length ? multiplayer.connectedPlayers.map((player) => escapeHtml(player.name)).join(", ") : "None"}</p>
            <p>Confirmed turn order: ${multiplayer.confirmedTurnOrder?.length ? multiplayer.confirmedTurnOrder.map((id) => escapeHtml(id === "local-player" ? `${profile.player?.name || "Player"} (You)` : id)).join(" → ") : "Not confirmed"}</p>
            ${renderToggle("Simulation Revenge Learning", "multiplayer.simulationRevenge", Boolean(multiplayer.simulationRevenge ?? true))}
            <label class="stacked-form">Room ID
              <input data-mp-setting="multiplayer.roomId" value="${escapeAttribute(multiplayer.roomId || "boardstate-room")}" />
            </label>
            <label class="stacked-form">WiFi Sync URL
              <input data-mp-setting="multiplayer.wsUrl" value="${escapeAttribute(multiplayer.wsUrl || "ws://localhost:8787")}" />
            </label>
            <label class="stacked-form">Role
              <select data-mp-setting="multiplayer.role">
                <option value="player" ${multiplayer.role === "player" ? "selected" : ""}>Player</option>
                <option value="spectator" ${multiplayer.role === "spectator" ? "selected" : ""}>Spectator</option>
              </select>
            </label>
            ${renderToggle("Spectator view mode", "multiplayer.spectatorMode", Boolean(multiplayer.spectatorMode))}
            ${renderToggle("Multiplayer authority confirmations", "multiplayer.confirmAuthority", multiplayer.confirmAuthority)}
          </article>
          <article class="option-card">
            <h3>HUD Layout</h3>
            <p>Device view: ${escapeHtml(compositionLabel)}</p>
            <div class="button-grid">
              <button class="${compositionMode === "auto" ? "active" : ""}" data-setting-button="appearance.compositionMode" data-value="auto">Auto Detect</button>
              <button class="${compositionMode === "mobile" ? "active" : ""}" data-setting-button="appearance.compositionMode" data-value="mobile">Mobile View</button>
              <button class="${compositionMode === "widescreen" ? "active" : ""}" data-setting-button="appearance.compositionMode" data-value="widescreen">Widescreen View</button>
            </div>
            ${renderToggle("Life total panel", "pagePanels.lifeTrackerLife", panels.lifeTrackerLife)}
            ${renderToggle("Show Profile in Main UI", "navigation.showProfileInMainUi", Boolean(profile.settings?.navigation?.showProfileInMainUi))}
            ${renderToggle("Enable Edge Swipe Shortcuts", "navigation.edgeSwipeShortcuts", Boolean(profile.settings?.navigation?.edgeSwipeShortcuts))}
            ${renderToggle("Compact Mobile HUD", "navigation.compactMobileHud", Boolean(profile.settings?.navigation?.compactMobileHud ?? true))}
            ${renderToggle("Mobile Focus View", "navigation.mobileFocusView", Boolean(profile.settings?.navigation?.mobileFocusView ?? true))}
            ${renderToggle("Lock HUD Badges", "navigation.hudBadgesLocked", Boolean(profile.settings?.navigation?.hudBadgesLocked))}
            <button class="wide" data-reset-hud-layout>Reset HUD Layout</button>
            <p>Floating mana now lives in the Battlefield tools menu as a floating widget with pin/unpin support.</p>
            ${renderToggle("Opponent board panel", "pagePanels.boardOpponent", panels.boardOpponent)}
            ${renderToggle("Combat controls", "pagePanels.boardCombat", panels.boardCombat)}
            ${renderToggle("Board quick tools", "pagePanels.boardTools", panels.boardTools)}
            ${renderToggle("Advanced rules helpers", "pagePanels.advancedRulesHelpers", panels.advancedRulesHelpers)}
            ${renderToggle("Archive / quick add helpers", "pagePanels.archiveQuickAdd", panels.archiveQuickAdd)}
            ${renderToggle("Stats / timer widgets", "pagePanels.statsTimerWidgets", panels.statsTimerWidgets)}
          </article>
          <article class="option-card">
            <h3>Accessibility</h3>
            <p>ADHD Mode is a companion assistance layer for reminders and clarity, not official judging or full rules enforcement.</p>
            ${renderToggle("Helper Sprite", "helperSprite.enabled", Boolean(profile.settings?.helperSprite?.enabled))}
            <button class="wide" data-helper-remind>Remind me</button>
            ${renderToggle("ADHD Mode", "adhdMode.enabled", Boolean(settings.adhdMode?.enabled))}
            ${renderToggle("ADHD trigger reminders", "adhdMode.triggerReminders", Boolean(settings.adhdMode?.triggerReminders))}
            ${renderToggle("ADHD missed trigger reminders", "adhdMode.missedTriggerReminders", Boolean(settings.adhdMode?.missedTriggerReminders))}
            ${renderToggle("ADHD targeting reminders", "adhdMode.targetingReminders", Boolean(settings.adhdMode?.targetingReminders))}
            ${renderToggle("ADHD layer explanation", "adhdMode.layerExplanation", Boolean(settings.adhdMode?.layerExplanation))}
            ${renderToggle("ADHD step-by-step prompts", "adhdMode.stepByStepPrompts", Boolean(settings.adhdMode?.stepByStepPrompts))}
            ${renderToggle("ADHD reduced visual noise", "adhdMode.reducedNoise", Boolean(settings.adhdMode?.reducedNoise))}
            ${renderToggle("ADHD highlight likely actions", "adhdMode.highlightLikelyActions", Boolean(settings.adhdMode?.highlightLikelyActions))}
            ${renderToggle("ADHD resource reminders", "adhdMode.resourceReminders", Boolean(settings.adhdMode?.resourceReminders))}
            ${renderToggle("ADHD deterministic auto-assist", "adhdAutomation", settings.adhdAutomation)}
            ${renderToggle("Confirm ambiguous effects", "confirmAmbiguousEffects", settings.confirmAmbiguousEffects)}
            ${renderToggle("Haptics hooks", "haptics", settings.haptics)}
            ${renderToggle("Compact permanent tiles", "compactTiles", settings.compactTiles)}
            ${renderToggle("Enable Advanced Gestures", "gestures.advanced", Boolean(profile.settings?.gestures?.advanced))}
            ${renderToggle("Focus mode", "battlefield.focusMode", Boolean(profile.settings?.battlefield?.focusMode))}
          </article>
          <article class="option-card">
            <h3>Diagnostics & Support</h3>
            <p>Copy clean diagnostics without passwords or private tokens.</p>
            <div class="button-grid">
              <button data-copy-game-log>Copy Game Log</button>
              <button data-copy-debug-state>Copy Debug State</button>
              <button data-export-bug-report>Export Bug Report</button>
              <button data-load-tutorial-sample>Load Tutorial Sample Board</button>
            </div>
            <div class="rules-confidence-mini">
              ${collectRulesConfidence(profile)
                .slice(0, 4)
                .map((entry) => `<span class="confidence-pill ${confidenceClass(entry.rulesConfidence)}">${escapeHtml(confidenceLabel(entry.rulesConfidence))}</span>`)
                .join("") || `<span class="confidence-pill info">No rules events yet</span>`}
            </div>
            ${renderRulesConfidenceLegend()}
          </article>
          <article class="option-card">
            <h3>Data Management</h3>
            <p>Destructive actions ask before changing local data.</p>
            <div class="button-grid">
              <button data-export>Export Profile</button>
              <label class="file-pill">Import Profile<input type="file" accept="application/json" data-import /></label>
              <button data-clear-game-history>Clear Game History</button>
              <button data-clear-simulation-learning>Clear Simulation Learning</button>
              <button data-reset-settings>Reset Settings</button>
              <button class="danger-soft" data-reset-all-local-data>Reset All Local Data</button>
            </div>
          </article>
          <article class="option-card">
            <h3>About BoardState</h3>
            <p>BoardState is a local-first MTG companion for life tracking, battlefield testing, Dry Run simulation, manual-choice reminders, and debug-friendly game history.</p>
            ${renderImportantNotes()}
          </article>
        </div>
      </div>
    </section>
  `;
}

function renderRecoveryToasts(profile, notice = null) {
  const entries = (profile.activeSession?.recoveryLog || []).filter((entry) => !entry.dismissed).slice(0, 3);
  if (!entries.length && !notice) {
    return "";
  }
  return `
    <section class="recovery-toast-stack" data-no-swipe>
      ${notice ? `
        <article class="recovery-toast ${escapeAttribute(notice.severity || "success")}">
          <strong>${escapeHtml(notice.severity === "error" ? "Needs attention" : "BoardState")}</strong>
          <p>${escapeHtml(notice.message)}</p>
        </article>
      ` : ""}
      ${entries.map((entry) => `
        <article class="recovery-toast ${escapeAttribute(entry.severity || "info")}">
          <strong>${escapeHtml(entry.source || "Recovery")}</strong>
          <p>${escapeHtml(entry.message || "Something needs attention.")}</p>
          ${entry.suggestedAction ? `<span>${escapeHtml(entry.suggestedAction)}</span>` : ""}
          <div class="recovery-actions mini">
            <button data-recovery-retry="${escapeAttribute(entry.id)}">Retry</button>
            <button data-recovery-cached="${escapeAttribute(entry.id)}">Use Cached Data</button>
            <button data-open-game-options>Open Game Options</button>
            <button data-copy-recovery="${escapeAttribute(entry.id)}">Copy Details</button>
            <button data-dismiss-recovery="${escapeAttribute(entry.id)}">Dismiss</button>
          </div>
        </article>
      `).join("")}
    </section>
  `;
}

function renderRulesConfidenceLegend() {
  return `
    <section class="rules-legend-card">
      <p class="eyebrow">Rules Confidence Legend</p>
      <div class="rules-confidence-mini">
        <span class="confidence-pill success">Auto-resolved</span>
        <span class="confidence-pill warning">Manual choice required</span>
        <span class="confidence-pill info">Partially supported</span>
        <span class="confidence-pill warning">Needs review</span>
        <span class="confidence-pill error">Failed / recovery needed</span>
      </div>
    </section>
  `;
}

function renderImportantNotes() {
  return `
    <section class="important-notes-card">
      <p class="eyebrow">Important Notes</p>
      <div class="important-notes-grid">
        <article><strong>&#10067;</strong><span>All destructive actions require confirmation.</span></article>
        <article><strong>&#10022;</strong><span>All zones are tracked invisibly in the background.</span></article>
        <article><strong>&#128221;</strong><span>You can export logs or a debug report anytime.</span></article>
      </div>
    </section>
  `;
}

function renderConfirmationDialog(dialog) {
  return `
    <section class="overlay-backdrop confirm-backdrop" data-no-swipe>
      <div class="confirm-dialog glass">
        <p class="eyebrow">${dialog.danger ? "Safety confirmation" : "Please confirm"}</p>
        <h2>${escapeHtml(dialog.title)}</h2>
        <p>${escapeHtml(dialog.message)}</p>
        <div class="row">
          <button data-cancel-confirmation>${escapeHtml(dialog.cancelLabel || "Cancel")}</button>
          <button class="${dialog.danger ? "danger-soft" : ""}" data-confirm-action="${escapeAttribute(dialog.id)}">${escapeHtml(dialog.confirmLabel || "Confirm")}</button>
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

function renderInspectPanel(profile) {
  const selected = getSelectedPermanents(profile.activeSession);
  const recentEvents = (profile.activeSession.eventHistory || []).slice(0, 8);
  const adhdMode = getAdhdMode(profile);
  const unresolvedQueue = profile.activeSession.triggerQueue || [];
  if (!selected.length) {
    return `<p class="eyebrow">Select one or more permanents to inspect details and active modifications.</p>`;
  }
  return `
    <div class="stacked-form">
      ${selected
        .map(
          (permanent) => `
        <article class="log-card">
          <strong>${escapeHtml(permanent.name)}</strong>
          <span>${escapeHtml(permanent.typeLine)}</span>
          ${renderPermanentLayerInspector(permanent, profile)}
          ${
            adhdMode.enabled
              ? `
            <div class="inspect-reminder-block">
              <strong>ADHD reminders</strong>
              <p>${escapeHtml(buildAdhdReminderText(profile, permanent) || "No active ADHD reminders for this object.")}</p>
              <p>${escapeHtml(buildTriggerChainSummary(unresolvedQueue, permanent.id) || "No unresolved trigger chain links.")}</p>
            </div>
          `
              : ""
          }
        </article>
      `
        )
        .join("")}
      <article class="log-card">
        <strong>Trigger History</strong>
        ${
          recentEvents.map((event) => `<p>${escapeHtml(event.eventType)} · ${new Date(event.timestamp).toLocaleTimeString()}</p>`).join("") ||
          "<p>No recent events</p>"
        }
      </article>
    </div>
  `;
}

function renderPermanentLayerInspector(permanent, profile) {
  const counters = Object.entries(permanent.counters || {})
    .filter(([, value]) => Number(value) > 0)
    .map(([type, value]) => `${type} ${value}`);
  const layerBreakdown = permanent.layerBreakdown || [];
  const typeChanges = layerBreakdown.filter((entry) => entry.operation === "set-type");
  const colorChanges = layerBreakdown.filter((entry) => entry.operation === "set-color");
  const abilityChanges = layerBreakdown.filter((entry) => entry.operation === "add-keywords");
  const statChanges = layerBreakdown.filter((entry) => entry.operation === "add-pt" || entry.operation === "set-base-pt");
  const unresolvedLinks = (profile.activeSession.triggerQueue || []).filter(
    (entry) => entry.sourceId === permanent.id && entry.status === "pending"
  );
  const unresolvedButtons = unresolvedLinks
    .slice(0, 4)
    .map((entry) => `<button data-trigger-inspect="${escapeAttribute(entry.id)}">Inspect ${escapeHtml(entry.id)}</button>`)
    .join("");
  const copySource =
    permanent.relationships?.copiedFromId ||
    permanent.metadata?.copiedFrom ||
    (permanent.isCopy ? "Copy source tracked in token metadata" : "None");

  return `
    <div class="layer-inspector-grid">
      <p><strong>Base:</strong> ${permanent.basePower}/${permanent.baseToughness} · MV ${permanent.manaValue || 0}</p>
      <p><strong>Copied values:</strong> ${escapeHtml(copySource)}</p>
      <p><strong>Control:</strong> Owner ${escapeHtml(permanent.owner || "player")} · Controller ${escapeHtml(permanent.controller || "player")}</p>
      <p><strong>Type changes:</strong> ${
        typeChanges.length
          ? typeChanges.map((entry) => `L${entry.layer}:${entry.operation}`).join(" · ")
          : "No type overrides"
      }</p>
      <p><strong>Color changes:</strong> ${
        colorChanges.length
          ? colorChanges.map((entry) => `L${entry.layer}:${entry.operation}`).join(" · ")
          : "No color overrides"
      }</p>
      <p><strong>Ability changes:</strong> ${
        abilityChanges.length
          ? abilityChanges
              .map((entry) => `${entry.keywordDelta?.length ? entry.keywordDelta.join(", ") : `L${entry.layer}:${entry.operation}`}`)
              .join(" · ")
          : "No ability overrides"
      }</p>
      <p><strong>Modifiers:</strong> ${
        statChanges.length
          ? statChanges
              .map((entry) => {
                const p = Number(entry.powerDelta || 0);
                const t = Number(entry.toughnessDelta || 0);
                return `L${entry.layer}:${entry.operation} (${p >= 0 ? "+" : ""}${p}/${t >= 0 ? "+" : ""}${t})`;
              })
              .join(" · ")
          : "No active stat modifiers"
      }</p>
      ${counters.length ? `<p><strong>Counters:</strong> ${counters.map(escapeHtml).join(" / ")}</p>` : ""}
      <p><strong>Final stats:</strong> ${
        permanent.isCreature ? `${permanent.currentPower}/${permanent.currentToughness}` : "Non-creature permanent"
      }</p>
      <p><strong>Oracle text:</strong> ${escapeHtml(permanent.rulesText || permanent.oracleText || "No rules text")}</p>
      <p><strong>Unresolved trigger links:</strong> ${
        unresolvedLinks.length
          ? unresolvedLinks.map((entry) => `${entry.id} (${entry.eventType})`).join(", ")
          : "None"
      }</p>
      ${unresolvedButtons ? `<div class="row mini">${unresolvedButtons}</div>` : ""}
    </div>
  `;
}

function buildAdhdReminderText(profile, permanent) {
  const session = profile.activeSession;
  const reminders = [];
  const adhdMode = getAdhdMode(profile);
  if (!adhdMode.enabled) {
    return "";
  }
  if (permanent?.summoningSick) {
    reminders.push("Summoning sickness reminder");
  }
  if ((session.triggerQueue || []).some((entry) => entry.status === "pending")) {
    reminders.push("Resolve pending trigger queue entries");
  }
  if ((session.pendingEffects || []).some((entry) => entry.status === "pending")) {
    reminders.push("Manual effect confirmations pending");
  }
  if ((session.pendingEffects || []).some((entry) => entry.status === "ignored")) {
    reminders.push("Ignored manual effects still need review");
  }
  if (session.manaPool && Object.values(session.manaPool).some((value) => Number(value) > 0)) {
    reminders.push("Floating mana still available");
  }
  if (Number(session.commander?.damageByOpponent?.opponent || 0) > 0) {
    reminders.push("Commander damage tracker has active value");
  }
  if (Object.values(session.playerCounters || {}).some((value) => Number(value) > 0)) {
    reminders.push("Player counters are non-zero");
  }
  if (adhdMode.phaseActionReminders) {
    reminders.push(`Phase action check: ${PHASES[session.phaseIndex] || "Unknown phase"}`);
  }
  return reminders.join(" · ");
}

function buildTriggerChainSummary(queue = [], sourceId = "") {
  const pending = queue.filter((entry) => entry.status === "pending" && (!sourceId || entry.sourceId === sourceId));
  if (!pending.length) {
    return "";
  }
  return pending.map((entry) => `${entry.chainId}:${entry.eventType}`).join(" · ");
}

function resolveUiLayerState(profile, page, uiState = {}) {
  const session = profile.activeSession || {};
  const adhdMode = getAdhdMode(profile);
  const inspectOpen =
    uiState.activeToolPanel === "inspect" ||
    profile.settings?.battlefield?.detailMode === "inspect" ||
    page === "leaderboards" && uiState.statsOpen;
  const focusActive = Boolean(profile.settings?.battlefield?.focusMode && (session.selectedIds || []).length);
  const active =
    Boolean((session.selectedIds || []).length) ||
    Boolean(uiState.toolMenuOpen) ||
    Boolean(uiState.activeToolPanel) ||
    Boolean(uiState.floatingManaOpen) ||
    Boolean(uiState.utilityDockOpen) ||
    Boolean(uiState.activeUtilityPanel) ||
    Boolean(uiState.quickPanelOpen) ||
    Boolean(uiState.optionsOpen) ||
    Boolean(uiState.statsOpen) ||
    Boolean(uiState.simulationSetupOpen) ||
    Boolean(uiState.simulationStatsOpen) ||
    Boolean(uiState.syncedTurnOrderSetupOpen);
  const current = adhdMode.enabled
    ? "adhd"
    : inspectOpen
      ? "inspect"
      : focusActive
        ? "focus"
        : active
          ? "active"
          : "passive";
  return {
    current,
    passive: current === "passive",
    active: current === "active",
    focus: current === "focus",
    inspect: current === "inspect",
    adhd: current === "adhd",
  };
}

function getAdhdMode(profile) {
  const settings = profile.settings || {};
  const defaults = {
    enabled: false,
    triggerReminders: true,
    missedTriggerReminders: true,
    legalityHints: true,
    targetingReminders: true,
    stackExplanation: true,
    layerExplanation: true,
    triggerChainView: true,
    replayDebugInfo: true,
    stateInspector: true,
    focusedGuidance: true,
    reducedNoise: true,
    highlightLikelyActions: true,
    phaseActionReminders: true,
    unresolvedReminders: true,
    resourceReminders: true,
    stepByStepPrompts: false,
  };
  const legacyEnabled = Boolean(settings.adhdAutomation);
  return {
    ...defaults,
    ...(settings.adhdMode || {}),
    enabled: Boolean(settings.adhdMode?.enabled ?? legacyEnabled),
  };
}

function renderAdhdAssistPanel(profile, page, uiLayer) {
  const adhdMode = getAdhdMode(profile);
  if (!adhdMode.enabled) {
    return "";
  }
  const session = profile.activeSession;
  const selected = getSelectedPermanents(session)[0] || null;
  const queue = session.triggerQueue || [];
  const pendingQueue = queue.filter((entry) => entry.status === "pending");
  const missedQueue = queue.filter((entry) => entry.status === "skipped" || entry.status === "delayed");
  const manualPending = (session.pendingEffects || []).filter((entry) => entry.status === "pending");
  const manualIgnored = (session.pendingEffects || []).filter((entry) => entry.status === "ignored");
  const likelyActions = adhdMode.highlightLikelyActions ? buildPredictiveActions(profile).slice(0, 4) : [];
  const phaseLabel = PHASES[session.phaseIndex] || "Unknown";

  return `
    <section class="adhd-assist-panel glass" data-no-swipe data-page="${escapeAttribute(page)}" data-ui-layer="${escapeAttribute(uiLayer)}">
      <div class="overlay-header compact">
        <div>
          <p class="eyebrow">ADHD Mode</p>
          <h2>Assistance Layer</h2>
        </div>
        <span class="eyebrow">${escapeHtml(phaseLabel)} · Turn ${session.turn}</span>
      </div>
      <p>${escapeHtml(
        [
          adhdMode.focusedGuidance ? `Current focus: ${selected ? selected.name : "Select a permanent or player tool"}` : "",
          adhdMode.phaseActionReminders ? `Phase reminder: resolve actions before leaving ${phaseLabel}` : "",
        ]
          .filter(Boolean)
          .join(" · ") || "Assistance layer active."
      )}</p>
      <div class="adhd-assist-grid">
        ${adhdMode.triggerReminders ? `<article><strong>Trigger reminders</strong><p>${pendingQueue.length} unresolved</p></article>` : ""}
        ${adhdMode.unresolvedReminders ? `<article><strong>Manual choices</strong><p>${manualPending.length} pending Â· ${manualIgnored.length} ignored</p></article>` : ""}
        ${adhdMode.missedTriggerReminders ? `<article><strong>Missed trigger reminders</strong><p>${missedQueue.length} flagged</p></article>` : ""}
        ${adhdMode.resourceReminders ? `<article><strong>Resource reminders</strong><p>Mana ${Object.values(session.manaPool || {}).reduce((sum, value) => sum + Number(value || 0), 0)} · Counters ${Object.values(session.playerCounters || {}).reduce((sum, value) => sum + Number(value || 0), 0)}</p></article>` : ""}
        ${
          adhdMode.replayDebugInfo
            ? `<article><strong>Action / replay debug</strong><p>Actions ${(session.actionHistory || []).length} · Undo ${(session.undoStack || []).length} · Redo ${(session.redoStack || []).length}</p></article>`
            : ""
        }
      </div>
      ${
        adhdMode.stackExplanation && pendingQueue.length
          ? `<div class="adhd-mini-list"><strong>Stack explanation</strong>${pendingQueue
              .slice(0, 4)
              .map((entry) => `<p>${escapeHtml(entry.sourceName)} · ${escapeHtml(entry.eventType)} · Chain ${escapeHtml(entry.chainId)}</p>`)
              .join("")}</div>`
          : ""
      }
      ${
        adhdMode.layerExplanation && selected
          ? `<div class="adhd-mini-list"><strong>Modifier / layer explanation</strong><p>${escapeHtml(
              (selected.layerBreakdown || []).map((entry) => `L${entry.layer}:${entry.operation}`).join(" · ") || "No active modifiers"
            )}</p></div>`
          : ""
      }
      ${
        adhdMode.stateInspector && selected
          ? `<div class="adhd-mini-list"><strong>Battlefield state inspector</strong><p>${escapeHtml(
              `${selected.name} · ${selected.typeLine} · ${selected.currentPower}/${selected.currentToughness}`
            )}</p><p>${escapeHtml(selected.rulesText || selected.oracleText || "No oracle text available")}</p></div>`
          : ""
      }
      ${
        adhdMode.targetingReminders && selected
          ? `<div class="adhd-mini-list"><strong>Targeting reminders</strong><p>${escapeHtml(
              selected.isAura || selected.isEquipment
                ? "Attachment target check recommended."
                : selected.isCreature
                  ? "Attack/block legality check recommended."
                  : "Confirm target selectors before resolving effects."
            )}</p></div>`
          : ""
      }
      ${
        adhdMode.legalityHints && profile.activeSession.commander?.name
          ? `<div class="adhd-mini-list"><strong>Legality hints</strong><p>Commander identity: ${escapeHtml(
              (profile.activeSession.commander.colorIdentity || []).join("") || "Colorless"
            )}</p></div>`
          : ""
      }
      ${
        adhdMode.highlightLikelyActions && likelyActions.length
          ? `<div class="adhd-mini-list"><strong>Likely next actions</strong>${likelyActions
              .map((suggestion) => `<p>${escapeHtml(suggestion.label)} · ${escapeHtml(suggestion.detail)}</p>`)
              .join("")}</div>`
          : ""
      }
      ${
        adhdMode.stepByStepPrompts
          ? `<div class="adhd-mini-list"><strong>Step-by-step prompt</strong><p>1) Resolve pending triggers 2) Confirm modifiers 3) Update combat declarations 4) Advance phase</p></div>`
          : ""
      }
    </section>
  `;
}

function renderHelperSprite(profile, helperMessage, positions = HUD_BADGE_DEFAULTS, isMobilePortrait = false, hudBadgesLocked = false) {
  if (!profile.settings?.helperSprite?.enabled || !helperMessage) {
    return "";
  }
  const position = positions.helper || HUD_BADGE_DEFAULTS.helper;
  const styleParts = [`--helper-ttl:${Math.round(Number(helperMessage.ttlMs) || 5200)}ms`];
  if (isMobilePortrait) {
    styleParts.push(`left:${Math.round(position.x)}px`, `top:${Math.round(position.y)}px`);
  }
  const inlineStyle = `style="${styleParts.join(";")};"`;
  const draggableAttrs = isMobilePortrait
    ? `data-draggable-hud="helper" data-hud-lock-state="${hudBadgesLocked ? "locked" : "unlocked"}"`
    : "";
  return `
    <section class="helper-sprite-widget ${helperMessage.fading ? "is-fading" : ""} glass" data-no-swipe ${inlineStyle} ${draggableAttrs}>
      <button class="helper-sprite-avatar" data-helper-dismiss title="Dismiss helper sprite">✨</button>
      <button class="helper-sprite-bubble" data-helper-open>
        <strong>Helper Sprite</strong>
        <span>${escapeHtml(helperMessage.text)}</span>
      </button>
    </section>
  `;
}

function cloneHudBadgePositions(positions = HUD_BADGE_DEFAULTS) {
  return Object.fromEntries(
    Object.entries(positions || {}).map(([key, value]) => [
      key,
      {
        x: Number(value?.x ?? HUD_BADGE_DEFAULTS[key]?.x ?? 12),
        y: Number(value?.y ?? HUD_BADGE_DEFAULTS[key]?.y ?? 12),
      },
    ])
  );
}

function mergeHudBadgePositions(rawPositions = {}) {
  return Object.fromEntries(
    Object.entries(HUD_BADGE_DEFAULTS).map(([key, defaults]) => {
      const incoming = rawPositions?.[key] || {};
      return [
        key,
        {
          x: Number.isFinite(Number(incoming.x)) ? Number(incoming.x) : defaults.x,
          y: Number.isFinite(Number(incoming.y)) ? Number(incoming.y) : defaults.y,
        },
      ];
    })
  );
}

function summarizeRecordEntries(record = {}, limit = 5) {
  return Object.entries(record || {})
    .sort((left, right) => Number(right[1] || 0) - Number(left[1] || 0))
    .slice(0, Math.max(1, limit))
    .map(([name, value]) => `${name}: ${value}`);
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
  const adhdMode = getAdhdMode(profile);
  return {
    adhdAutomation: adhdMode.enabled,
    adhdMode,
    helperSprite: {
      enabled: false,
      remindersAtUpkeep: true,
      ...(profile.settings?.helperSprite || {}),
    },
    confirmAmbiguousEffects: true,
    haptics: false,
    compactTiles: true,
    gestures: { advanced: true },
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

function getVisiblePages(profile) {
  const pages = ["life", "battlefield", "archive", "decks", "leaderboards"];
  return profile.settings?.navigation?.showProfileInMainUi ? ["life", "battlefield", "profile", "archive", "decks", "leaderboards"] : pages;
}

function getSelectedPermanents(session) {
  const selected = new Set(session.selectedIds || []);
  if (!selected.size) {
    return [];
  }
  return [...session.battlefield.player, ...session.battlefield.opponent].filter((permanent) => selected.has(permanent.id));
}

function resolveToolContext(session, override = "") {
  if (override === "player") {
    return "player";
  }
  const selected = getSelectedPermanents(session);
  if (!selected.length) {
    return override === "empty" ? "empty" : "empty";
  }
  if (selected.some((permanent) => (Number(permanent.quantity) || 1) > 1)) {
    return "stack";
  }
  if (selected.some((permanent) => permanent.isCommander)) {
    return "commander";
  }
  if (selected.every((permanent) => permanent.isToken)) {
    return "token";
  }
  if (selected.every((permanent) => permanent.isCreature)) {
    return "creature";
  }
  return "permanent";
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
    return "+1";
  }
  const value = Number(modifier.value) || 1;
  return `${value > 0 ? "+" : ""}${value}`;
}

function formatModifierScopes(modifier) {
  const scopes = modifier?.scopes || {};
  const active = [
    scopes.life ? "LIFE" : "",
    scopes.poison ? "PSN" : "",
    scopes.energy ? "ENR" : "",
    scopes.experience ? "XP" : "",
    scopes.tickets ? "TIX" : "",
    scopes.commander ? "CMDR" : "",
  ].filter(Boolean);
  if (!active.length) {
    return "LIFE";
  }
  if (active.length === 1) {
    return active[0];
  }
  if (active.length === 2) {
    return `${active[0]}/${active[1]}`;
  }
  return "MULTI";
}

function getMultiplayerSettings(profile) {
  return {
    mode: "offline",
    connectedPlayers: [],
    authorityMode: "confirm",
    confirmAuthority: true,
    bluetoothReady: false,
    wifiReady: true,
    roomId: "boardstate-room",
    wsUrl: "ws://localhost:8787",
    role: "player",
    spectatorMode: false,
    turnOrderRolls: {},
    suggestedTurnOrder: [],
    confirmedTurnOrder: [],
    needsTurnOrderConfirmation: false,
    lastTurnOrderConfirmedAt: 0,
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

function truncateText(value, maxLength = 80) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function confidenceClass(value = "") {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("auto")) return "success";
  if (normalized.includes("manual") || normalized.includes("partial")) return "warning";
  if (normalized.includes("ignored") || normalized.includes("review")) return "info";
  if (normalized.includes("failed")) return "error";
  return "info";
}

function formatManaLabel(value) {
  const labels = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green", C: "Colorless", Generic: "Generic" };
  return labels[value] || value;
}

function formatPageLabel(value) {
  return value === "life" ? "Life Tracker" : formatLabel(value);
}

function downloadProfile(profile) {
  downloadText(`boardstate-profile-${new Date().toISOString().slice(0, 10)}.json`, exportProfile(profile), "application/json");
}

function downloadText(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
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
