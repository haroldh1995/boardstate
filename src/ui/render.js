import { buildStats } from "../analytics/statsService.js";
import { exportProfile, parseImportedProfile } from "../storage/localDatabase.js";
import { fetchScryfallCardDetails, searchScryfall } from "../services/scryfallService.js";
import { buildFriendInviteLink } from "../social/friendSystem.js";
import { buildTutorialHelperMessage, buildTutorialScreenReaderText, getTutorialProgress, shouldShowFirstLaunch } from "../onboarding/tutorialSystem.js";
import { exportLocalSave } from "../storage/saveState.js";
import { canBeCommander } from "../game/commanderSystem.js";
import { getPermanentManaOptions } from "../rules-engine/index.js";
import { createPermanent, PHASES } from "../state/schema.js";
import { buildPredictiveActions } from "../game/predictiveActions.js";
import { getSimulationDeckById } from "../simulation/decks/index.js";
import {
  DEFAULT_RULES_ENGINE_VERSION,
  SHARED_CONTRACT_SCHEMA_VERSION,
  SHARED_SAVE_FORMAT_VERSION,
  SHARED_SYNC_PROTOCOL_VERSION,
  boardStateProfileToSharedSession,
} from "../shared-contracts/index.js";
import {
  createSharedSessionExport,
  buildSessionDetailsModel,
  getLinkedSessionRecords,
  parseLinkedSessionSnapshot,
} from "../shared-session/handoff.js";
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
  ".battlefield-groups",
  ".selected-permanent-menu",
  ".manual-choice-panel",
  ".trigger-queue-panel",
  ".history-timeline",
  ".opponent-battlefield-overlay",
  ".blocker-declaration",
  ".tutorial-sample-panel",
  ".adhd-assist-panel",
  ".tournament-invite-modal",
  ".notification-window",
  ".first-launch-onboarding",
  ".guided-tutorial-panel",
  ".local-saves-panel",
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
  ".blocker-declaration",
  ".tutorial-sample-panel",
  ".tournament-invite-modal",
  ".notification-window",
  ".first-launch-onboarding",
  ".guided-tutorial-panel",
  ".local-saves-panel",
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

export function isScryfallSearchInput(element) {
  return Boolean(element?.matches?.("[data-search-query]"));
}

export function shouldRestoreScryfallSearchFocus(element, keepFocus = false) {
  return Boolean(keepFocus && isScryfallSearchInput(element));
}

export function blurScryfallSearchInput(element = globalThis.document?.activeElement) {
  if (!isScryfallSearchInput(element)) {
    return false;
  }
  element.blur();
  return true;
}

export function buildTournamentInviteLink(joinCode = "", locationLike = globalThis.location) {
  const code = String(joinCode || "").trim().toUpperCase();
  if (!code) {
    return "";
  }
  const origin = locationLike?.origin || "";
  const pathname = locationLike?.pathname || "/";
  return `${origin}${pathname}#tournament/join/${encodeURIComponent(code)}`;
}

export function parseTournamentInviteFromLocation(locationLike = globalThis.location) {
  const hash = String(locationLike?.hash || "");
  const search = String(locationLike?.search || "");
  const fromHashRoute = hash.match(/^#\/?tournament\/join\/([^?&#/]+)/i);
  const hashQueryIndex = hash.indexOf("?");
  const hashParams =
    hashQueryIndex >= 0
      ? new URLSearchParams(hash.slice(hashQueryIndex + 1).replace(/^#/, ""))
      : new URLSearchParams();
  const searchParams = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const code =
    fromHashRoute?.[1] ||
    hashParams.get("tournamentJoin") ||
    hashParams.get("joinTournament") ||
    searchParams.get("tournamentJoin") ||
    searchParams.get("joinTournament") ||
    "";
  const joinCode = String(code || "").trim().toUpperCase();
  return joinCode ? { joinCode, source: "invite-link" } : null;
}

export function mountApp(root, store) {
  const allPages = ["home", "life", "battlefield", "tournament", "profile", "archive", "decks", "leaderboards"];
  const initialTournamentInvite = parseTournamentInviteFromLocation(location);
  let activePage = initialTournamentInvite ? "tournament" : normalizePageFromHash(location.hash);
  let searchResults = [];
  let searchMessage = "";
  let searchQuery = "";
  const searchContexts = {
    battlefield: { results: [], message: "", query: "" },
    decks: { results: [], message: "", query: "" },
  };
  let activeSearchContext = activePage === "decks" ? "decks" : "battlefield";
  let searchLoading = false;
  let searchDebounceTimer = null;
  let searchRequestToken = 0;
  let searchAbortController = null;
  let keepSearchInputFocus = false;
  let searchSelection = { start: null, end: null, direction: "none" };
  let optionsOpen = false;
  let activeOptionsCategory = "";
  let tournamentInvite = initialTournamentInvite;
  let inviteNotificationCode = "";
  const notificationFeedbackDeliveredIds = new Set();
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
  let lastSimulationVisualSignature = "";
  let presentationRefreshTimer = null;
  let autoStackTimer = null;

  normalizeCurrentHash();
  window.addEventListener("hashchange", handleHashChange);
  window.addEventListener("resize", handleViewportChange, { passive: true });
  window.addEventListener("orientationchange", handleViewportChange);
  store.subscribe(render);
  render(store.getState());

  function render(profile, action = null) {
    if (shouldDeferSimulationVisualUpdate(profile, action)) {
      return;
    }
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
    if (!allPages.includes(activePage)) {
      activePage = visiblePages[0] || "home";
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
    if (tournamentInvite?.joinCode && inviteNotificationCode !== tournamentInvite.joinCode) {
      inviteNotificationCode = tournamentInvite.joinCode;
      queueMicrotask(() =>
        store.dispatch({
          type: "NOTIFICATION_ADD",
          category: "tournament",
          eventKey: "inviteOpened",
          severity: "info",
          title: "Tournament Invite Opened",
          body: `Join code ${tournamentInvite.joinCode} is ready. Enter your player name to join this tournament.`,
          actionLabel: "Join Tournament",
          actionPage: "tournament",
          internalOnly: true,
        })
      );
    }
    const activeNotification = getActiveFullWindowNotification(profile);
    document.body.dataset.composition = resolvedCompositionMode;
    document.body.dataset.compositionPreference = profile.settings?.appearance?.compositionMode || "auto";
    document.body.dataset.page = activePage;
    document.body.dataset.uiLayer = uiLayerState.current;
    document.body.dataset.simulationActive = profile.activeSession?.simulation?.enabled ? "true" : "false";
    root.innerHTML = layout(profile, activePage, searchResults, searchMessage, {
      optionsOpen,
      activeOptionsCategory,
      tournamentInvite,
      activeNotification,
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
    deliverNotificationFeedback(profile, activeNotification);
    schedulePresentationRefresh(profile);
    scheduleAutoStackProcessing(profile);
    lastRenderedSearchQuery = searchQuery;
    lastSimulationVisualSignature = getSimulationVisualSignature(profile);
  }

  function schedulePresentationRefresh(profile) {
    clearTimeout(presentationRefreshTimer);
    const presentation = profile.activeSession?.presentation;
    if (!presentation?.expiresAt || presentation.expiresAt <= Date.now()) {
      return;
    }
    presentationRefreshTimer = setTimeout(() => render(store.getState()), Math.max(40, presentation.expiresAt - Date.now() + 20));
  }

  function scheduleAutoStackProcessing(profile) {
    clearTimeout(autoStackTimer);
    const session = profile.activeSession;
    const top = session?.stack?.[0];
    const hasPendingChoice = (session?.pendingEffects || []).some(
      (entry) => entry.stackObjectId === top?.id && !["resolved", "skipped", "ignored"].includes(entry.status)
    );
    if (!top || hasPendingChoice || profile.settings?.manualStackConfirmation) {
      return;
    }
    const userHasPriority = session.priority?.waiting && ["local-player", "player"].includes(session.priority?.activePlayerId);
    if (userHasPriority && top.controller !== "player" && top.controller !== "local-player") {
      return;
    }
    const delay = session.simulation?.enabled && session.simulation?.speed === "fast" ? 180 : 620;
    autoStackTimer = setTimeout(() => {
      const current = store.getState();
      const currentTop = current.activeSession?.stack?.[0];
      if (currentTop?.id !== top.id) {
        return;
      }
      store.dispatch({ type: "RESOLVE_TOP_SPELL", stackId: top.id, autoChoose: top.controller !== "player" && top.controller !== "local-player" });
    }, delay);
  }

  function shouldDeferSimulationVisualUpdate(profile, action = null) {
    const actionType = action?.actionType || action?.type || "";
    if (actionType !== "SIMULATION_TICK" || !profile.activeSession?.simulation?.enabled) {
      return false;
    }
    const nextSignature = getSimulationVisualSignature(profile);
    return Boolean(lastSimulationVisualSignature && nextSignature === lastSimulationVisualSignature);
  }

  function getSimulationVisualSignature(profile) {
    const simulation = profile.activeSession?.simulation;
    if (!simulation?.enabled) {
      return "";
    }
    return [
      simulation.status || "",
      simulation.currentPlayerId || "",
      profile.activeSession?.turn || 0,
      simulation.round || 0,
      simulation.winnerId || "",
      simulation.waitingForUser ? "waiting" : "acting",
    ].join(":");
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
    container.querySelectorAll("[data-home-action]").forEach((button) => {
      button.addEventListener("click", () => handleHomeAction(button.dataset.homeAction || ""));
    });
    container.querySelectorAll("[data-rules-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        store.dispatch({ type: "SET_ENFORCEMENT_MODE", mode: button.dataset.rulesMode || "enforced" });
        showNotice(button.dataset.rulesMode === "waived" ? "Rules Waived mode enabled." : "Rules Enforced mode enabled.");
      });
    });
    container.querySelector("[data-revoke-waivers]")?.addEventListener("click", () => {
      store.dispatch({ type: "REVOKE_RULE_WAIVERS" });
      showNotice("Active rule waivers revoked.");
    });
    container.querySelectorAll("[data-home-load-save]").forEach((button) =>
      button.addEventListener("click", () =>
        openConfirmation({
          id: "local-save-load",
          title: "Load game state?",
          message: "This replaces the current active session. Save the current game first if needed.",
          confirmLabel: "Load Save",
          payload: { saveId: button.dataset.homeLoadSave },
        })
      )
    );
    container.querySelectorAll("[data-home-legacy-page]").forEach((button) =>
      button.addEventListener("click", () => {
        optionsOpen = false;
        activeOptionsCategory = "";
        setActivePage(button.dataset.homeLegacyPage || "home");
      })
    );
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
      button.addEventListener("click", (event) => {
        event.stopPropagation();
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
        activeOptionsCategory = button.dataset.optionsCategory || "";
        render(store.getState());
      })
    );
    container.querySelectorAll("[data-option-category]").forEach((button) =>
      button.addEventListener("click", () => {
        activeOptionsCategory = button.dataset.optionCategory || "";
        if (activeOptionsCategory === "notifications") {
          store.dispatch({ type: "NOTIFICATIONS_MARK_READ", internalOnly: true });
        } else {
          render(store.getState());
        }
      })
    );
    container.querySelectorAll("[data-options-back]").forEach((button) =>
      button.addEventListener("click", () => {
        activeOptionsCategory = "";
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
        activeOptionsCategory = button.dataset.optionsCategory || "";
        render(store.getState());
      })
    );
    container.querySelectorAll("[data-close-overlay]").forEach((button) => {
      button.addEventListener("click", () => {
        optionsOpen = false;
        activeOptionsCategory = "";
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
    container.querySelectorAll("[data-start-guided-tutorial]").forEach((button) =>
      button.addEventListener("click", () => {
        optionsOpen = false;
        activeOptionsCategory = "";
        closeAllTemporaryUi({ renderAfter: false });
        store.dispatch({
          type: "TUTORIAL_START",
          helperSpriteEnabled: true,
          screenReaderPrompts: Boolean(store.getState().settings?.helperSprite?.screenReaderPrompts),
        });
        setActivePage("battlefield");
        showNotice("Guided tutorial started.");
      })
    );
    container.querySelectorAll("[data-onboarding-explore]").forEach((button) =>
      button.addEventListener("click", () => {
        store.dispatch({ type: "ONBOARDING_EXPLORE" });
        showNotice("First-time guide skipped. You can restart it from Game Options.");
      })
    );
    container.querySelectorAll("[data-onboarding-watch-later]").forEach((button) =>
      button.addEventListener("click", () => {
        store.dispatch({ type: "ONBOARDING_WATCH_LATER" });
        showNotice("Tutorial saved for later.");
      })
    );
    container.querySelectorAll("[data-onboarding-profile]").forEach((button) =>
      button.addEventListener("click", () => {
        store.dispatch({ type: "ONBOARDING_EXPLORE" });
        optionsOpen = true;
        activeOptionsCategory = "profile";
        render(store.getState());
      })
    );
    container.querySelectorAll("[data-onboarding-load-save]").forEach((button) =>
      button.addEventListener("click", () => {
        store.dispatch({ type: "ONBOARDING_EXPLORE" });
        optionsOpen = true;
        activeOptionsCategory = "profile";
        render(store.getState());
      })
    );
    container.querySelectorAll("[data-onboarding-accessibility]").forEach((button) =>
      button.addEventListener("click", () => {
        optionsOpen = true;
        activeOptionsCategory = "accessibility";
        render(store.getState());
      })
    );
    container.querySelectorAll("[data-onboarding-screen-reader]").forEach((button) =>
      button.addEventListener("click", () => {
        const enabled = !Boolean(store.getState().settings?.helperSprite?.screenReaderPrompts);
        store.dispatch({ type: "ONBOARDING_SCREEN_READER", enabled });
        showNotice(enabled ? "Screen-reader tutorial prompts enabled." : "Screen-reader tutorial prompts disabled.", "info");
      })
    );
    container.querySelectorAll("[data-tutorial-advance]").forEach((button) =>
      button.addEventListener("click", () => {
        store.dispatch({ type: "TUTORIAL_ADVANCE" });
        showNotice("Tutorial step complete.", "success");
      })
    );
    container.querySelectorAll("[data-tutorial-back]").forEach((button) =>
      button.addEventListener("click", () => store.dispatch({ type: "TUTORIAL_BACK" }))
    );
    container.querySelectorAll("[data-tutorial-pause]").forEach((button) =>
      button.addEventListener("click", () => {
        store.dispatch({ type: "TUTORIAL_PAUSE" });
        showNotice("Tutorial paused and autosaved.");
      })
    );
    container.querySelectorAll("[data-tutorial-resume]").forEach((button) =>
      button.addEventListener("click", () => {
        store.dispatch({ type: "TUTORIAL_RESUME" });
        setActivePage("battlefield");
      })
    );
    container.querySelectorAll("[data-tutorial-save-exit]").forEach((button) =>
      button.addEventListener("click", () => {
        store.dispatch({ type: "TUTORIAL_SAVE_EXIT", saveName: "Guided Tutorial Autosave" });
        showNotice("Tutorial saved. Resume from Options when ready.");
      })
    );
    container.querySelectorAll("[data-tutorial-repeat]").forEach((button) =>
      button.addEventListener("click", () => {
        const message = store.getState().activeSession?.helper?.replayQueue?.[0]?.text || "Repeat the current tutorial prompt from the Helper Sprite.";
        store.dispatch({
          type: "HELPER_REMIND_ME",
          messages: [{ key: `tutorial-repeat-${Date.now()}`, text: message, source: "guided-tutorial" }],
        });
      })
    );
    container.querySelectorAll("[data-tutorial-skip]").forEach((button) =>
      button.addEventListener("click", () =>
        openConfirmation({
          id: "tutorial-skip",
          title: "Skip guided tutorial?",
          message: "This stops forced tutorial guidance. You can restart it from Game Options.",
          confirmLabel: "Skip Tutorial",
          danger: true,
        })
      )
    );
    container.querySelectorAll("[data-tutorial-restart]").forEach((button) =>
      button.addEventListener("click", () =>
        openConfirmation({
          id: "tutorial-restart",
          title: "Restart tutorial?",
          message: "This replaces the current tutorial practice board with the deterministic first-turn setup.",
          confirmLabel: "Restart Tutorial",
          danger: true,
        })
      )
    );
    container.querySelectorAll("[data-reset-onboarding]").forEach((button) =>
      button.addEventListener("click", () =>
        openConfirmation({
          id: "onboarding-reset",
          title: "Reset tutorial progress?",
          message: "The first-time onboarding window and guided tutorial progress will reset locally.",
          confirmLabel: "Reset Tutorial",
          danger: true,
        })
      )
    );
    container.querySelectorAll("[data-tutorial-free-play]").forEach((button) =>
      button.addEventListener("click", () => {
        store.dispatch({ type: "TUTORIAL_COMPLETE_FREE_PLAY" });
        showNotice("Tutorial complete. Free play is unlocked.");
      })
    );
    container.querySelectorAll("[data-tutorial-finish-sim]").forEach((button) =>
      button.addEventListener("click", () => {
        store.dispatch({ type: "TUTORIAL_FINISH_SIMULATED" });
        showNotice("Practice simulation resumed.");
      })
    );
    container.querySelectorAll("[data-tutorial-new-sim]").forEach((button) =>
      button.addEventListener("click", () => {
        simulationSetupOpen = true;
        render(store.getState());
      })
    );
    container.querySelectorAll("[data-tutorial-profile]").forEach((button) =>
      button.addEventListener("click", () => {
        optionsOpen = true;
        activeOptionsCategory = "profile";
        render(store.getState());
      })
    );
    container.querySelectorAll("[data-tutorial-save-current]").forEach((button) =>
      button.addEventListener("click", () => {
        store.dispatch({ type: "LOCAL_SAVE_CURRENT", saveName: button.dataset.saveName || "Session Checkpoint" });
        showNotice("Current session saved.");
      })
    );
    container.querySelectorAll("[data-tutorial-load-save]").forEach((button) =>
      button.addEventListener("click", () => {
        optionsOpen = true;
        activeOptionsCategory = "profile";
        render(store.getState());
      })
    );
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
    container.querySelector("[data-local-save-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = new FormData(event.currentTarget).get("saveName");
      store.dispatch({ type: "LOCAL_SAVE_CURRENT", saveName: name || "" });
      showNotice("Local game state saved.");
    });
    container.querySelectorAll("[data-local-save-load]").forEach((button) =>
      button.addEventListener("click", () =>
        openConfirmation({
          id: "local-save-load",
          title: "Load local save?",
          message: "This replaces the current active session. Save the current game first if needed.",
          confirmLabel: "Load Save",
          payload: { saveId: button.dataset.localSaveLoad },
        })
      )
    );
    container.querySelectorAll("[data-local-save-rename]").forEach((button) =>
      button.addEventListener("click", () => {
        const currentName = button.dataset.localSaveName || "BoardState Save";
        const nextName = prompt("Rename save", currentName);
        if (nextName === null) return;
        store.dispatch({ type: "LOCAL_SAVE_RENAME", saveId: button.dataset.localSaveRename, saveName: nextName });
      })
    );
    container.querySelectorAll("[data-local-save-duplicate]").forEach((button) =>
      button.addEventListener("click", () => store.dispatch({ type: "LOCAL_SAVE_DUPLICATE", saveId: button.dataset.localSaveDuplicate }))
    );
    container.querySelectorAll("[data-local-save-delete]").forEach((button) =>
      button.addEventListener("click", () =>
        openConfirmation({
          id: "local-save-delete",
          title: "Delete local save?",
          message: "This permanently removes the selected local save from this profile.",
          confirmLabel: "Delete Save",
          danger: true,
          payload: { saveId: button.dataset.localSaveDelete },
        })
      )
    );
    container.querySelectorAll("[data-local-save-export]").forEach((button) =>
      button.addEventListener("click", () => {
        const save = (store.getState().localSaves?.items || []).find((entry) => entry.saveId === button.dataset.localSaveExport);
        if (!save) {
          showNotice("Save not found.", "warning");
          return;
        }
        downloadText(`${(save.saveName || "boardstate-save").replace(/[^a-z0-9_-]+/gi, "-")}.json`, exportLocalSave(save), "application/json");
      })
    );
    container.querySelectorAll("[data-linked-session-import]").forEach((button) =>
      button.addEventListener("click", () => {
        const text = prompt("Paste canonical linked-session JSON or BoardState handoff bundle.");
        if (!text) return;
        const parsed = parseLinkedSessionSnapshot(text);
        if (!parsed.valid) {
          showNotice(parsed.errors?.[0] || "Linked session import failed.", "warning");
          return;
        }
        store.dispatch({ type: "IMPORT_LINKED_SESSION", text, sessionName: button.dataset.linkedSessionName || "" });
        showNotice("Linked session imported.");
      })
    );
    container.querySelectorAll("[data-linked-session-continue]").forEach((button) =>
      button.addEventListener("click", () => {
        openConfirmation({
          id: "linked-session-continue",
          title: "Open linked session in Advanced Mode?",
          message: "This replaces the current active session view. Save the current session first if you need a checkpoint.",
          confirmLabel: "Continue in Advanced Mode",
          payload: { sessionId: button.dataset.linkedSessionContinue || "" },
        });
      })
    );
    container.querySelectorAll("[data-linked-session-duplicate]").forEach((button) =>
      button.addEventListener("click", () => {
        openConfirmation({
          id: "linked-session-duplicate",
          title: "Duplicate linked session as Advanced game?",
          message: "This creates a new Advanced session from the linked snapshot and replaces the current active session view.",
          confirmLabel: "Duplicate as Advanced Game",
          payload: { sessionId: button.dataset.linkedSessionDuplicate || "" },
        });
      })
    );
    container.querySelectorAll("[data-linked-session-remove]").forEach((button) =>
      button.addEventListener("click", () =>
        openConfirmation({
          id: "linked-session-remove",
          title: "Remove linked session?",
          message: "This removes only the imported linked-session record. Existing saves and active games are not deleted.",
          confirmLabel: "Remove Linked Session",
          danger: true,
          payload: { sessionId: button.dataset.linkedSessionRemove },
        })
      )
    );
    container.querySelectorAll("[data-linked-session-export]").forEach((button) =>
      button.addEventListener("click", async () => {
        const state = store.getState();
        const record = getLinkedSessionRecords(state).find((entry) => entry.sessionId === button.dataset.linkedSessionExport);
        const text = record?.session
          ? JSON.stringify({ app: "BoardState", bundleType: "boardstate-shared-session-handoff", sourceApp: record.sourceApp, session: record.session }, null, 2)
          : createSharedSessionExport(state).text;
        await copyOrDownloadText(`boardstate-shared-session-${button.dataset.linkedSessionExport || "current"}.json`, text, "Shared session handoff data copied.");
      })
    );
    container.querySelectorAll("[data-export-shared-session]").forEach((button) =>
      button.addEventListener("click", async () => {
        const exported = createSharedSessionExport(store.getState());
        if (!exported.valid) {
          showNotice(exported.errors?.[0] || "Shared session export is unsafe.", "warning");
          return;
        }
        await copyOrDownloadText("boardstate-shared-session.json", exported.text, button.dataset.exportSharedSession === "download" ? "Shared session bundle prepared." : "Shared session handoff data copied.");
      })
    );
    container.querySelectorAll("[data-download-shared-session]").forEach((button) =>
      button.addEventListener("click", () => {
        const exported = createSharedSessionExport(store.getState());
        if (!exported.valid) {
          showNotice(exported.errors?.[0] || "Shared session export is unsafe.", "warning");
          return;
        }
        downloadText("boardstate-shared-session.json", exported.text, "application/json");
      })
    );
    container.querySelectorAll("[data-local-save-import]").forEach((input) =>
      input.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
          const payload = JSON.parse(await file.text());
          store.dispatch({ type: "LOCAL_SAVE_IMPORT", save: payload.save || payload });
          showNotice("Local save imported.");
        } catch {
          showNotice("Import failed: malformed save data.", "warning");
        } finally {
          event.target.value = "";
        }
      })
    );
    container.querySelectorAll("[data-setting-toggle]").forEach((input) => {
      input.addEventListener("change", () => store.dispatch({ type: "SET_SETTING", path: input.dataset.settingToggle, value: input.checked }));
    });
    container.querySelector("[data-test-notification]")?.addEventListener("click", () => {
      store.dispatch({
        type: "NOTIFICATION_ADD",
        category: "tournament",
        eventKey: "roundGenerated",
        severity: "info",
        title: "Test Tournament Alert",
        body: "This is a BoardState full-window notification test. Preferences, sound, and haptics are applied before delivery.",
        actionLabel: "Open Tournament",
        actionPage: "tournament",
        fullWindow: true,
        internalOnly: true,
      });
    });
    container.querySelector("[data-test-sound]")?.addEventListener("click", () => {
      playNotificationSound("success");
      showNotice("Sound test requested. Browser policy may require prior user interaction.", "info");
    });
    container.querySelector("[data-test-haptic]")?.addEventListener("click", () => {
      triggerNotificationHaptic("warning");
      showNotice(navigator.vibrate ? "Haptic test requested." : "Haptics are not supported on this browser.", "info");
    });
    container.querySelector("[data-reset-notification-preferences]")?.addEventListener("click", () => {
      store.dispatch({ type: "NOTIFICATIONS_RESET_PREFS", internalOnly: true });
      showNotice("Notification preferences reset.");
    });
    container.querySelector("[data-friend-display-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      store.dispatch({ type: "FRIEND_SET_DISPLAY_NAME", displayName: form.get("displayName") });
      showNotice("Friend profile name saved.");
    });
    container.querySelector("[data-add-friend-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      store.dispatch({ type: "FRIEND_ADD_BY_CODE", friendCode: form.get("friendCode"), displayName: form.get("displayName"), source: "code" });
      event.currentTarget.reset();
      showNotice("Friend code processed.");
    });
    container.querySelectorAll("[data-copy-friend-code]").forEach((button) =>
      button.addEventListener("click", async () => {
        await copyPlainText(button.dataset.copyFriendCode || "", "Friend code copied.");
      })
    );
    container.querySelectorAll("[data-share-friend-code]").forEach((button) =>
      button.addEventListener("click", async () => {
        const code = button.dataset.shareFriendCode || "";
        const text = `Add me on BoardState: ${code}`;
        if (navigator.share) {
          try {
            await navigator.share({ title: "BoardState Friend Code", text });
            showNotice("Friend code share opened.");
            return;
          } catch {
            // Fall back to clipboard when native share is cancelled or unavailable.
          }
        }
        await copyPlainText(text, "Friend code copied.");
      })
    );
    container.querySelectorAll("[data-regenerate-friend-code]").forEach((button) =>
      button.addEventListener("click", () => {
        if (!confirm("Regenerate your friend code? Existing friends stay saved locally, but new people will need the new code.")) return;
        store.dispatch({ type: "FRIEND_REGENERATE_CODE" });
      })
    );
    container.querySelectorAll("[data-refresh-nearby]").forEach((button) =>
      button.addEventListener("click", () => {
        const multiplayer = store.getState().settings?.multiplayer || {};
        store.dispatch({ type: "FRIEND_REFRESH_NEARBY", wifiAvailable: multiplayer.mode === "wifi" || multiplayer.mode === "local" });
      })
    );
    container.querySelectorAll("[data-add-nearby-friend]").forEach((button) =>
      button.addEventListener("click", () => {
        store.dispatch({
          type: "FRIEND_ADD_BY_CODE",
          friendCode: button.dataset.addNearbyFriend,
          displayName: button.dataset.nearbyName,
          source: "nearby",
        });
      })
    );
    container.querySelectorAll("[data-friend-request-accept]").forEach((button) =>
      button.addEventListener("click", () => store.dispatch({ type: "FRIEND_ACCEPT_REQUEST", requestId: button.dataset.friendRequestAccept }))
    );
    container.querySelectorAll("[data-friend-request-decline]").forEach((button) =>
      button.addEventListener("click", () => store.dispatch({ type: "FRIEND_DECLINE_REQUEST", requestId: button.dataset.friendRequestDecline }))
    );
    container.querySelectorAll("[data-hide-nearby]").forEach((button) =>
      button.addEventListener("click", () => store.dispatch({ type: "FRIEND_HIDE_NEARBY", temporaryDiscoveryId: button.dataset.hideNearby }))
    );
    container.querySelectorAll("[data-friend-favorite]").forEach((button) =>
      button.addEventListener("click", () => store.dispatch({ type: "FRIEND_TOGGLE_FAVORITE", friendId: button.dataset.friendFavorite }))
    );
    container.querySelectorAll("[data-friend-remove]").forEach((button) =>
      button.addEventListener("click", () => {
        if (!confirm("Remove this friend from your local list?")) return;
        store.dispatch({ type: "FRIEND_REMOVE", friendId: button.dataset.friendRemove });
      })
    );
    container.querySelectorAll("[data-friend-block]").forEach((button) =>
      button.addEventListener("click", () => {
        if (!confirm("Block this friend code and hide it from normal friend/nearby lists?")) return;
        store.dispatch({ type: "FRIEND_BLOCK", friendId: button.dataset.friendBlock, friendCode: button.dataset.friendCode });
      })
    );
    container.querySelectorAll("[data-friend-unblock]").forEach((button) =>
      button.addEventListener("click", () => store.dispatch({ type: "FRIEND_UNBLOCK", friendCode: button.dataset.friendUnblock }))
    );
    container.querySelectorAll("[data-friend-invite-game]").forEach((button) =>
      button.addEventListener("click", () => {
        store.dispatch({ type: "FRIEND_INVITE_GAME", friendId: button.dataset.friendInviteGame });
        showNotice("Friend game invite prepared.");
      })
    );
    container.querySelectorAll("[data-friend-invite-tournament]").forEach((button) =>
      button.addEventListener("click", () => {
        store.dispatch({ type: "FRIEND_INVITE_TOURNAMENT", friendId: button.dataset.friendInviteTournament });
        showNotice("Friend tournament invite prepared.");
      })
    );
    container.querySelectorAll("[data-friend-join-game]").forEach((button) =>
      button.addEventListener("click", () => {
        store.dispatch({ type: "FRIEND_JOIN_GAME", sessionId: button.dataset.friendJoinGame, syncMode: button.dataset.syncMode || "local" });
        showNotice("Joined friend game room.");
      })
    );
    container.querySelectorAll("[data-friend-join-tournament]").forEach((button) =>
      button.addEventListener("click", () => {
        store.dispatch({ type: "FRIEND_JOIN_TOURNAMENT", sessionId: button.dataset.friendJoinTournament, syncMode: button.dataset.syncMode || "local" });
        showNotice("Joined friend tournament.");
      })
    );
    container.querySelector("[data-tournament-create-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      store.dispatch({
        type: "TOURNAMENT_CREATE",
        name: form.get("name"),
        hostName: form.get("hostName"),
        formatPreset: form.get("formatPreset"),
        settings: {
          expectedPlayerCount: Number(form.get("expectedPlayerCount") || 10),
          allowDeckChangesBetweenRounds: form.get("allowDeckChangesBetweenRounds") === "on",
          oneVOneBeforeRepeat: form.get("oneVOneBeforeRepeat") === "on",
          suddenDeathDamageDouble: form.get("suddenDeathDamageDouble") === "on",
          oneVOneActsAsTimer: form.get("oneVOneActsAsTimer") === "on",
          topThreeAnnouncement: form.get("topThreeAnnouncement") === "on",
        },
        syncMode: form.get("syncMode"),
        wsUrl: form.get("wsUrl"),
      });
      showNotice("Tournament created.");
    });
    container.querySelector("[data-tournament-join-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      store.dispatch({ type: "TOURNAMENT_JOIN", joinCode: form.get("joinCode"), playerName: form.get("playerName"), syncMode: form.get("syncMode"), wsUrl: form.get("wsUrl") });
      showNotice("Joined tournament session.");
    });
    container.querySelector("[data-tournament-invite-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const joinCode = form.get("joinCode") || tournamentInvite?.joinCode || "";
      store.dispatch({
        type: "TOURNAMENT_JOIN",
        joinCode,
        playerName: form.get("playerName"),
        syncMode: form.get("syncMode"),
        wsUrl: form.get("wsUrl"),
      });
      tournamentInvite = null;
      setActivePage("tournament");
      showNotice("Joined tournament from invite link.");
    });
    container.querySelectorAll("[data-close-tournament-invite]").forEach((button) =>
      button.addEventListener("click", () => {
        tournamentInvite = null;
        normalizeCurrentHash();
        render(store.getState());
      })
    );
    container.querySelectorAll("[data-copy-tournament-code]").forEach((button) =>
      button.addEventListener("click", async () => {
        await copyPlainText(button.dataset.copyTournamentCode || "", "Tournament code copied.");
      })
    );
    container.querySelectorAll("[data-copy-tournament-invite]").forEach((button) =>
      button.addEventListener("click", async () => {
        await copyPlainText(button.dataset.copyTournamentInvite || buildTournamentInviteLink(button.dataset.joinCode || ""), "Tournament invite link copied.");
      })
    );
    container.querySelectorAll("[data-share-tournament-invite]").forEach((button) =>
      button.addEventListener("click", async () => {
        const inviteLink = button.dataset.shareTournamentInvite || buildTournamentInviteLink(button.dataset.joinCode || "");
        if (navigator.share) {
          try {
            await navigator.share({ title: "Join my BoardState tournament", text: "Join this BoardState tournament.", url: inviteLink });
            showNotice("Tournament invite share opened.");
            return;
          } catch (error) {
            if (error?.name === "AbortError") {
              return;
            }
          }
        }
        await copyPlainText(inviteLink, "Tournament invite link copied.");
      })
    );
    container.querySelector("[data-tournament-player-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      store.dispatch({ type: "TOURNAMENT_ADD_PLAYER", playerName: form.get("playerName"), deckNotes: form.get("deckNotes"), commander: form.get("commander") });
      showNotice("Tournament player added.");
    });
    container.querySelector("[data-tournament-sample-players]")?.addEventListener("click", () => {
      store.dispatch({ type: "TOURNAMENT_ADD_SAMPLE_PLAYERS" });
      showNotice("Filled tournament seats.");
    });
    container.querySelectorAll("[data-tournament-remove-player]").forEach((button) =>
      button.addEventListener("click", () => {
        if (!confirm("Remove this player before the tournament starts?")) return;
        store.dispatch({ type: "TOURNAMENT_REMOVE_PLAYER", playerId: button.dataset.tournamentRemovePlayer });
      })
    );
    container.querySelectorAll("[data-tournament-pin]").forEach((button) =>
      button.addEventListener("click", () => store.dispatch({ type: "TOURNAMENT_SET_PINNED", pinned: button.dataset.tournamentPin === "true" }))
    );
    container.querySelector("[data-open-tournament-page]")?.addEventListener("click", () => {
      optionsOpen = false;
      setActivePage("tournament");
    });
    container.querySelector("[data-tournament-generate-round]")?.addEventListener("click", () => {
      store.dispatch({ type: "TOURNAMENT_GENERATE_ROUND" });
      showNotice("Tournament round generated.");
    });
    container.querySelector("[data-tournament-start-round]")?.addEventListener("click", (event) => {
      store.dispatch({ type: "TOURNAMENT_START_ROUND", roundNumber: Number(event.currentTarget.dataset.roundNumber || 0) });
      showNotice("Tournament round started.");
    });
    container.querySelectorAll("[data-tournament-result-form]").forEach((formElement) => {
      formElement.addEventListener("submit", (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        store.dispatch({
          type: "TOURNAMENT_REPORT_RESULT",
          roundNumber: Number(form.get("roundNumber") || 0),
          tableId: form.get("tableId"),
          tableName: form.get("tableName"),
          winnerId: form.get("winnerId"),
          eliminationOrder: form.get("eliminationOrder"),
          eliminations: form.get("eliminations"),
          lifeTotals: form.get("lifeTotals"),
          commanderDamageTaken: form.get("commanderDamageTaken"),
          notes: form.get("notes"),
        });
        showNotice("Tournament result recorded.");
      });
    });
    container.querySelectorAll("[data-tournament-edit-table]").forEach((button) =>
      button.addEventListener("click", () => {
        const current = button.dataset.players || "";
        const answer = prompt("Enter player names or IDs for this table, comma-separated. Casual override allowed before the round starts.", current);
        if (answer === null) return;
        store.dispatch({
          type: "TOURNAMENT_EDIT_TABLE",
          roundNumber: Number(button.dataset.roundNumber || 0),
          tableId: button.dataset.tournamentEditTable,
          players: answer,
        });
      })
    );
    container.querySelectorAll("[data-tournament-sudden-death]").forEach((button) =>
      button.addEventListener("click", () => {
        store.dispatch({ type: "TOURNAMENT_START_SUDDEN_DEATH", roundNumber: Number(button.dataset.tournamentSuddenDeath || 0) });
        showNotice("Sudden Death started.");
      })
    );
    container.querySelectorAll("[data-tournament-extension]").forEach((button) =>
      button.addEventListener("click", () => {
        store.dispatch({ type: "TOURNAMENT_START_EXTENSION", roundNumber: Number(button.dataset.roundNumber || 0), tableId: button.dataset.tournamentExtension });
        showNotice("Sudden Death extension started.");
      })
    );
    container.querySelectorAll("[data-tournament-extension-turn]").forEach((button) =>
      button.addEventListener("click", () => {
        store.dispatch({ type: "TOURNAMENT_EXTENSION_TURN", roundNumber: Number(button.dataset.roundNumber || 0), tableId: button.dataset.tableId, playerId: button.dataset.tournamentExtensionTurn });
      })
    );
    container.querySelectorAll("[data-tournament-correct]").forEach((button) => {
      button.addEventListener("click", () => {
        const answer = prompt("Correct total wins for this player.", "0");
        if (answer === null) return;
        store.dispatch({ type: "TOURNAMENT_CORRECT", playerId: button.dataset.tournamentCorrect, wins: Math.max(0, Number(answer) || 0) });
        showNotice("Tournament standings corrected.");
      });
    });
    container.querySelector("[data-tournament-announce]")?.addEventListener("click", () => store.dispatch({ type: "TOURNAMENT_ANNOUNCE" }));
    container.querySelector("[data-tournament-end]")?.addEventListener("click", () => {
      const tournament = store.getState().tournament || {};
      const incomplete = (tournament.standings || []).filter((entry) => Number(entry.oneVOneGamesPlayed || 0) < 1).length;
      if (!confirm(`${incomplete ? `${incomplete} player(s) have not completed a 1v1. ` : ""}End tournament and announce Top 3?`)) return;
      store.dispatch({ type: "TOURNAMENT_END" });
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
    container.querySelectorAll("[data-loyalty-adjust]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({
        type: "ADJUST_LOYALTY",
        id: button.dataset.loyaltyAdjust,
        amount: Number(button.dataset.delta || 0),
      }));
    });
    container.querySelectorAll("[data-manual-trigger-permanent]").forEach((button) => {
      button.addEventListener("click", () => {
        const permanent = [...(store.getState().activeSession?.battlefield?.player || []), ...(store.getState().activeSession?.battlefield?.opponent || [])]
          .find((entry) => entry.id === button.dataset.manualTriggerPermanent);
        if (!permanent) return;
        const ability = permanent.triggeredAbilities?.[0]?.text || permanent.activatedAbilities?.[0]?.text || permanent.oracleText || "Manually triggered battlefield ability.";
        store.dispatch({
          type: "ADD_MANUAL_TRIGGER",
          sourceId: permanent.id,
          sourceName: permanent.name,
          summary: ability,
          triggerCount: Math.max(1, Number(permanent.quantity || 1)),
          selectedCondition: "auto",
        });
        activeUtilityPanel = "triggers";
        showNotice(`Queued ${permanent.quantity || 1} trigger(s) for ${permanent.name}.`);
      });
    });
    container.querySelector("[data-tap-cost-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      store.dispatch({
        type: "TAP_SELECTED_FOR_COST",
        mechanic: form.get("mechanic"),
        requiredValue: form.get("requiredValue"),
      });
      showNotice("Selected permanents were checked for the tap cost.");
    });
    container.querySelector("[data-manual-trigger-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      store.dispatch({
        type: "ADD_MANUAL_TRIGGER",
        sourceName: form.get("sourceName"),
        summary: form.get("summary"),
        optional: form.get("optional") === "on",
        triggerCount: form.get("triggerCount"),
        selectedCondition: form.get("selectedCondition"),
      });
      showNotice("Manual trigger added to the queue.");
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
      button.addEventListener("click", () => {
        const permanent = [...(store.getState().activeSession?.battlefield?.player || []), ...(store.getState().activeSession?.battlefield?.opponent || [])]
          .find((entry) => entry.id === button.dataset.tap);
        const manaOptions = permanent && !permanent.tapped ? getPermanentManaOptions(permanent) : [];
        let manaColor = "";
        if (manaOptions.length > 1) {
          const choice = prompt(`Choose mana for ${permanent.name}: ${manaOptions.join(", ")}`, manaOptions[0]);
          if (choice === null) {
            return;
          }
          manaColor = String(choice || "").trim().toUpperCase();
          if (!manaOptions.includes(manaColor)) {
            showNotice(`${manaColor || "That choice"} is not a supported mana option for ${permanent.name}.`, "warning");
            return;
          }
        }
        store.dispatch({ type: "TOGGLE_TAPPED", id: button.dataset.tap, manaColor });
      });
    });
    container.querySelectorAll("[data-add-land-copy]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({ type: "ADD_LAND_COPY", id: button.dataset.addLandCopy }));
    });
    container.querySelectorAll("[data-selected-menu-counter]").forEach((button) => {
      button.addEventListener("click", () => store.dispatch({
        type: "ADD_COUNTER_SELECTED",
        counterType: button.dataset.selectedMenuCounter || "Charge",
        amount: 1,
      }));
    });
    container.querySelectorAll("[data-permanent-mechanic]").forEach((button) => {
      button.addEventListener("click", () => {
        const mechanic = button.dataset.permanentMechanic;
        if (mechanic === "max-speed") {
          store.dispatch({ type: "ADVANCE_MAX_SPEED", id: button.dataset.permanentId, amount: 1 });
          return;
        }
        const answer = prompt(`Required ${formatLabel(mechanic)} contribution`, "1");
        if (answer === null) {
          return;
        }
        store.dispatch({ type: "TAP_SELECTED_FOR_COST", mechanic, requiredValue: Math.max(1, Number(answer) || 1) });
      });
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
        const attackTargets = [
          { id: "opponent", name: "Defending player" },
          ...(profile.activeSession.battlefield?.opponent || [])
            .filter((permanent) => permanent.isPlaneswalker || /\bBattle\b/i.test(permanent.typeLine || ""))
            .map((permanent) => ({ id: permanent.id, name: permanent.name })),
        ];
        let target = attackTargets[0];
        if (attackTargets.length > 1) {
          const answer = prompt(`Choose attack target:\n${attackTargets.map((entry, index) => `${index + 1}. ${entry.name}`).join("\n")}`, "1");
          if (answer === null) return;
          target = attackTargets[Math.max(0, Math.min(attackTargets.length - 1, Number(answer || 1) - 1))] || attackTargets[0];
        }
        store.dispatch({
          type: "DECLARE_ATTACKERS",
          ids: selectedIds,
          defendingPlayerId: "opponent",
          attackTargetsByAttacker: Object.fromEntries(selectedIds.map((id) => [id, target.id])),
        });
      });
    });
    container.querySelectorAll("[data-assign-blocker]").forEach((button) => {
      button.addEventListener("click", () => {
        store.dispatch({
          type: "ASSIGN_BLOCKER",
          attackerId: button.dataset.assignAttacker,
          blockerId: button.dataset.assignBlocker,
        });
      });
    });
    container.querySelectorAll("[data-no-blockers]").forEach((button) => {
      button.addEventListener("click", async () => {
        await store.dispatch({ type: "NO_BLOCKERS" });
        await store.dispatch({ type: "RESOLVE_COMBAT" });
        showNotice("No blockers declared. Combat damage resolved.");
      });
    });
    container.querySelectorAll("[data-confirm-blockers]").forEach((button) => {
      button.addEventListener("click", async () => {
        await store.dispatch({ type: "CONFIRM_BLOCKERS" });
        if (store.getState().activeSession?.combat?.step !== "damage") {
          showNotice("Blocks are not legal yet. Review the combat warning.", "warning");
          return;
        }
        await store.dispatch({ type: "RESOLVE_COMBAT" });
        showNotice("Blocks confirmed. Combat damage resolved.");
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
        const hasCombatToResolve = Boolean((session.combat?.attackerIds || []).length || session.combat?.damagePreview);
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
    container.querySelectorAll("[data-notification-ack]").forEach((button) =>
      button.addEventListener("click", () => store.dispatch({ type: "NOTIFICATION_ACK", id: button.dataset.notificationAck, internalOnly: true }))
    );
    container.querySelectorAll("[data-notification-open-page]").forEach((button) =>
      button.addEventListener("click", () => {
        const notificationId = button.dataset.notificationId;
        if (notificationId) {
          store.dispatch({ type: "NOTIFICATION_ACK", id: notificationId, internalOnly: true });
        }
        const destination = button.dataset.notificationOpenPage || "tournament";
        if (destination.startsWith("options:")) {
          optionsOpen = true;
          activeOptionsCategory = destination.replace("options:", "");
          render(store.getState());
          return;
        }
        setActivePage(destination);
      })
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

    const submitScryfallSearch = async (form) => {
      clearTimeout(searchDebounceTimer);
      const query = new FormData(form).get("query");
      searchQuery = String(query || "");
      dismissSearchInputFocus();
      await runScryfallSearch(query, store.getState(), true);
    };
    container.querySelectorAll("[data-search-form]").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        await submitScryfallSearch(event.currentTarget);
      });
    });
    const searchInputs = [...container.querySelectorAll("[data-search-query]")];
    searchInputs.forEach((input) => {
      input.addEventListener("focus", () => {
        keepSearchInputFocus = true;
      });
      input.addEventListener("blur", () => {
        keepSearchInputFocus = false;
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
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        submitScryfallSearch(event.currentTarget.form);
      });
    });
    container.querySelectorAll(".search-results").forEach((resultList) => {
      resultList.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        dismissSearchInputFocus();
      });
      resultList.addEventListener("touchstart", (event) => {
        event.stopPropagation();
        dismissSearchInputFocus();
      });
    });

    container.querySelectorAll("[data-add-result]").forEach((button) => {
      button.addEventListener("click", () => {
        dismissSearchInputFocus({ closeSearchPanel: true });
        store.dispatch({ type: "ADD_PERMANENT", card: searchResults[Number(button.dataset.addResult)] });
        showNotice("Card put onto battlefield.");
      });
    });
    container.querySelectorAll("[data-cast-result]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        dismissSearchInputFocus();
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
        dismissSearchInputFocus();
        if (!castActionPopup) {
          return;
        }
        castActionPopup = { ...castActionPopup, opponent: Boolean(input.checked) };
        render(store.getState());
      });
    });
    container.querySelectorAll("[data-cast-action-zone]").forEach((button) => {
      button.addEventListener("click", () => {
        dismissSearchInputFocus({ closeSearchPanel: true });
        const index = Number(button.dataset.castActionIndex);
        const sourceZone = button.dataset.castActionZone || "hand";
        const controller = castActionPopup?.opponent ? "opponent" : "player";
        castActionPopup = null;
        castSearchCard(index, sourceZone, controller);
      });
    });
    container.querySelectorAll("[data-cast-action-put]").forEach((button) => {
      button.addEventListener("click", () => {
        dismissSearchInputFocus({ closeSearchPanel: true });
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
        dismissSearchInputFocus({ closeSearchPanel: true });
        store.dispatch({ type: "ADD_PERMANENT", card: searchResults[Number(button.dataset.putResult)] });
        showNotice("Card put onto battlefield without being cast.");
      });
    });
    container.querySelectorAll("[data-commander-result]").forEach((button) => {
      button.addEventListener("click", () => {
        dismissSearchInputFocus();
        store.dispatch({ type: "SET_COMMANDER", card: searchResults[Number(button.dataset.commanderResult)] });
        showNotice("Commander updated.");
      });
    });
    container.querySelectorAll("[data-deck-result]").forEach((button) => {
      button.addEventListener("click", () => {
        dismissSearchInputFocus();
        store.dispatch({ type: "ADD_DECK_CARD", card: searchResults[Number(button.dataset.deckResult)] });
        showNotice("Card added to deck.");
      });
    });
    container.querySelectorAll("[data-new-deck-result]").forEach((button) => {
      button.addEventListener("click", () => {
        dismissSearchInputFocus();
        const card = searchResults[Number(button.dataset.newDeckResult)];
        if (!card) return;
        const name = prompt("Name the new deck.", canBeCommander(card) ? `${card.name} Commander Deck` : "New Deck");
        if (name === null) return;
        store.dispatch({ type: "CREATE_DECK_WITH_CARD", card, name: name.trim() || "New Deck", makeCommander: false });
        showNotice(`Created ${name.trim() || "New Deck"} and added ${card.name}.`);
      });
    });
    container.querySelectorAll("[data-inspect-result]").forEach((button) => {
      button.addEventListener("click", async () => {
        dismissSearchInputFocus();
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
    container.querySelectorAll("[data-entry-choice]").forEach((button) => {
      button.addEventListener("click", () => {
        store.dispatch({
          type: "CHOOSE_ENTRY_RESULT",
          pendingId: button.dataset.entryChoice,
          enterUntapped: button.dataset.entryUntapped === "true",
        });
        showNotice(`Entry choice recorded: ${button.dataset.entryUntapped === "true" ? "untapped" : "tapped"}.`);
      });
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
    container.querySelectorAll("[data-stack-run]").forEach((button) => {
      button.addEventListener("click", async () => {
        let safety = 0;
        while (safety < 40) {
          const current = store.getState().activeSession;
          const top = current.stack?.[0];
          if (!top) break;
          const pending = (current.pendingEffects || []).some(
            (entry) => entry.stackObjectId === top.id && !["resolved", "skipped", "ignored"].includes(entry.status)
          );
          if (pending) {
            showNotice("Manual choice required before the stack can continue.", "warning");
            break;
          }
          await store.dispatch({ type: "RESOLVE_TOP_SPELL", stackId: top.id, autoChoose: top.controller !== "player" && top.controller !== "local-player" });
          safety += 1;
        }
        showNotice("Stack processing complete or paused for a required choice.");
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
        dismissSearchInputFocus();
        castActionPopup = null;
        activeUtilityPanel = "";
        render(store.getState());
      });
    });
    container.querySelectorAll("[data-close-cast-popup]").forEach((button) => {
      button.addEventListener("click", () => {
        dismissSearchInputFocus();
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
      renderedLayer(
        !manualChoicePanelCollapsed,
        "manual-choice",
        [".manual-choice-panel:not(.manual-choice-panel--collapsed)", ".pending-strip"]
      ),
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
        dismissSearchInputFocus();
        castActionPopup = null;
        return true;
      case "utility-panel":
        dismissSearchInputFocus();
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
    dismissSearchInputFocus();
    optionsOpen = false;
    activeOptionsCategory = "";
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
    switchSearchContext(page);
    activePage = page;
    normalizeCurrentHash();
    closeAllTemporaryUi({ renderAfter: false });
    toolContextOverride = "";
    render(store.getState());
  }

  function handleHomeAction(action = "") {
    switch (action) {
      case "start-dry-run":
        closeAllTemporaryUi({ renderAfter: false });
        simulationSetupError = "";
        simulationSetupOpen = true;
        render(store.getState());
        break;
      case "continue-dry-run":
        continueMostRecentDryRun();
        break;
      case "start-advanced":
        store.dispatch({ type: "START_ADVANCED_GAMEPLAY" });
        setActivePage("battlefield");
        showNotice("Advanced gameplay started.");
        break;
      case "continue-linked":
        openLinkedGameEntry();
        break;
      case "load-state":
      case "saves":
        optionsOpen = true;
        activeOptionsCategory = "saves";
        render(store.getState());
        break;
      case "tutorial":
        startOrResumeTutorialFromHome();
        break;
      case "recent-simulations":
        optionsOpen = true;
        activeOptionsCategory = "dry-run";
        render(store.getState());
        break;
      case "rules":
        optionsOpen = true;
        activeOptionsCategory = "rules";
        render(store.getState());
        break;
      case "linked-apps":
        optionsOpen = true;
        activeOptionsCategory = "linked-apps";
        render(store.getState());
        break;
      case "accessibility":
        optionsOpen = true;
        activeOptionsCategory = "accessibility";
        render(store.getState());
        break;
      case "help":
        optionsOpen = true;
        activeOptionsCategory = "diagnostics";
        render(store.getState());
        break;
      case "legacy":
        optionsOpen = true;
        activeOptionsCategory = "legacy";
        render(store.getState());
        break;
      default:
        setActivePage("home");
        break;
    }
  }

  function continueMostRecentDryRun() {
    const state = store.getState();
    if (state.activeSession?.simulation?.enabled) {
      setActivePage("battlefield");
      return;
    }
    const save = getMostRecentDryRunSave(state);
    if (!save) {
      simulationSetupError = "";
      simulationSetupOpen = true;
      render(state);
      return;
    }
    openConfirmation({
      id: "local-save-load",
      title: "Continue Dry Run?",
      message: `Load ${save.saveName || "the latest Dry Run"} from turn ${save.metadata?.currentTurn || save.gameState?.turn || 1}?`,
      confirmLabel: "Continue Dry Run",
      payload: { saveId: save.saveId },
    });
  }

  function openLinkedGameEntry() {
    const state = store.getState();
    const linked = getLinkedSessionCandidate(state);
    if (linked?.sessionId && !linked.saveId) {
      openConfirmation({
        id: "linked-session-continue",
        title: "Open linked session in Advanced Mode?",
        message: `Open ${linked.sourceApp || "external"} session ${linked.sessionId}? Save the current session first if needed.`,
        confirmLabel: "Continue in Advanced Mode",
        payload: { sessionId: linked.sessionId },
      });
      return;
    }
    optionsOpen = true;
    activeOptionsCategory = "linked-apps";
    showNotice(linked?.saveId ? "Open the linked save from Linked Apps after import validation." : "No linked game is active. Import a canonical session or export the current session for future Lite handoff.", "info");
  }

  function startOrResumeTutorialFromHome() {
    const state = store.getState();
    if (state.activeSession?.tutorial?.active || state.activeSession?.tutorial?.paused || state.onboarding?.tutorialPaused) {
      store.dispatch({ type: "TUTORIAL_RESUME" });
    } else {
      store.dispatch({ type: "TUTORIAL_START" });
    }
    setActivePage("battlefield");
  }

  function normalizePageFromHash(hashValue = "") {
    const rawPage = String(hashValue || "")
      .replace(/^#/, "")
      .split(/[?&/]/)[0]
      .trim()
      .toLowerCase();
    return allPages.includes(rawPage) ? rawPage : "home";
  }

  function normalizeCurrentHash() {
    const canonicalHash = `#${activePage}`;
    if (location.hash !== canonicalHash) {
      history.replaceState(null, "", canonicalHash);
    }
  }

  function handleHashChange() {
    const invite = parseTournamentInviteFromLocation(location);
    if (invite?.joinCode) {
      tournamentInvite = invite;
      switchSearchContext("tournament");
      activePage = "tournament";
      closeAllTemporaryUi({ renderAfter: false });
      normalizeCurrentHash();
      render(store.getState());
      return;
    }
    const nextPage = normalizePageFromHash(location.hash);
    if (nextPage === activePage) {
      normalizeCurrentHash();
      return;
    }
    switchSearchContext(nextPage);
    activePage = nextPage;
    normalizeCurrentHash();
    closeAllTemporaryUi({ renderAfter: false });
    toolContextOverride = "";
    render(store.getState());
  }

  function switchSearchContext(nextPage) {
    dismissSearchInputFocus();
    searchContexts[activeSearchContext] = {
      results: searchResults,
      message: searchMessage,
      query: searchQuery,
    };
    activeSearchContext = nextPage === "decks" ? "decks" : "battlefield";
    const next = searchContexts[activeSearchContext];
    searchResults = next.results;
    searchMessage = next.message;
    searchQuery = next.query;
    searchLoading = false;
    castActionPopup = null;
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
    if (currentState.settings?.strictPhaseEnforcement) {
      if ((currentState.activeSession?.stack || []).length) {
        phaseControlMessage = "Resolve the stack before advancing.";
        showNotice(phaseControlMessage, "warning");
        render(store.getState());
        return;
      }
      if (["declare-blockers", "damage"].includes(currentState.activeSession?.combat?.step)) {
        phaseControlMessage = "Resolve pending combat blockers or damage before advancing.";
        showNotice(phaseControlMessage, "warning");
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
      pulsePhaseUi();
      showNotice(`Phase advanced: ${PHASES[(store.getState().activeSession?.phaseIndex ?? 0)] || "Next phase"}.`);
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

  function pulsePhaseUi() {
    document.body.classList.remove("phase-advance-celebration");
    requestAnimationFrame(() => {
      document.body.classList.add("phase-advance-celebration");
      clearTimeout(pulsePhaseUi.timer);
      pulsePhaseUi.timer = setTimeout(() => document.body.classList.remove("phase-advance-celebration"), 760);
    });
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
          if (event.target.closest("button:not([data-permanent])")) {
            return;
          }
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
        if (event.target.closest("[data-tap], [data-counter], [data-toggle-stack], .mini button, .card-action-ring button")) {
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
    const tutorialMessage = buildTutorialHelperMessage(session);

    if (tutorialMessage) {
      messages.push(tutorialMessage);
    }

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
      case "tutorial-skip":
        store.dispatch({ type: "TUTORIAL_SKIP" });
        showNotice("Guided tutorial skipped.");
        break;
      case "tutorial-restart":
        store.dispatch({ type: "TUTORIAL_RESTART" });
        setActivePage("battlefield");
        showNotice("Guided tutorial restarted.");
        break;
      case "onboarding-reset":
        store.dispatch({ type: "ONBOARDING_RESET" });
        showNotice("Tutorial progress reset.");
        break;
      case "local-save-load":
        if (payload?.saveId) {
          store.dispatch({ type: "LOCAL_SAVE_LOAD", saveId: payload.saveId });
          showNotice("Local save loaded.");
        }
        break;
      case "local-save-delete":
        if (payload?.saveId) {
          store.dispatch({ type: "LOCAL_SAVE_DELETE", saveId: payload.saveId });
          showNotice("Local save deleted.");
        }
        break;
      case "linked-session-remove":
        if (payload?.sessionId) {
          store.dispatch({ type: "REMOVE_LINKED_SESSION", sessionId: payload.sessionId });
          showNotice("Linked session removed.");
        }
        break;
      case "linked-session-continue":
        if (payload?.sessionId) {
          store.dispatch({ type: "CONTINUE_LINKED_SESSION", sessionId: payload.sessionId });
          setActivePage("battlefield");
          showNotice("Linked session opened in Advanced Mode.");
        }
        break;
      case "linked-session-duplicate":
        if (payload?.sessionId) {
          store.dispatch({ type: "DUPLICATE_LINKED_SESSION", sessionId: payload.sessionId });
          setActivePage("battlefield");
          showNotice("Linked session duplicated as a new Advanced game.");
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

  async function copyPlainText(text, successMessage = "Copied.") {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      showNotice(successMessage);
    } catch {
      showNotice("Copy unavailable in this browser. Select and copy the code manually.", "warning");
    }
  }

  function deliverNotificationFeedback(profile, notification) {
    if (!notification || notification.acknowledged || notificationFeedbackDeliveredIds.has(notification.id)) {
      return;
    }
    const preferences = getNotificationPreferences(profile);
    notificationFeedbackDeliveredIds.add(notification.id);
    if (notificationFeedbackDeliveredIds.size > 120) {
      notificationFeedbackDeliveredIds.clear();
      notificationFeedbackDeliveredIds.add(notification.id);
    }
    const friendSoundAllowed = notification.category !== "friend" || preferences.friendEvents?.friendSound !== false;
    const friendHapticsAllowed = notification.category !== "friend" || preferences.friendEvents?.friendHaptics !== false;
    if (preferences.sound && friendSoundAllowed) {
      playNotificationSound(notification.severity || notification.eventKey || "info");
    }
    if (preferences.haptics && friendHapticsAllowed) {
      triggerNotificationHaptic(notification.severity || notification.eventKey || "info");
    }
  }

  function playNotificationSound(kind = "info") {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      return false;
    }
    try {
      const context = new AudioContext();
      const gain = context.createGain();
      const oscillator = context.createOscillator();
      const now = context.currentTime;
      const success = /success|final|winner/i.test(kind);
      const warning = /warning|sudden|choice|error/i.test(kind);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(warning ? 220 : success ? 523.25 : 392, now);
      oscillator.frequency.exponentialRampToValueAtTime(warning ? 164.81 : success ? 659.25 : 493.88, now + 0.12);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.24);
      oscillator.addEventListener("ended", () => context.close().catch(() => {}));
      return true;
    } catch {
      return false;
    }
  }

  function triggerNotificationHaptic(kind = "info") {
    if (!navigator.vibrate) {
      return false;
    }
    const pattern = /final|winner|success/i.test(kind)
      ? [60, 35, 90, 35, 120]
      : /warning|sudden|choice|error/i.test(kind)
        ? [45, 35, 45]
        : [35];
    try {
      navigator.vibrate(pattern);
      return true;
    } catch {
      return false;
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
    const restore = () => {
      if (backgroundScrollLockY === null && Math.abs((window.scrollY || 0) - (snapshot.pageY || 0)) > 1) {
        window.scrollTo({ top: snapshot.pageY || 0, left: 0, behavior: "auto" });
      }
      const shell = container.querySelector?.(".app-shell");
      if (shell && Number.isFinite(snapshot.shellY) && Math.abs((shell.scrollTop || 0) - snapshot.shellY) > 1) {
        shell.scrollTop = snapshot.shellY;
      }
    };
    restore();
    requestAnimationFrame(restore);
  }

  function captureSearchFocusState() {
    const active = document.activeElement;
    if (!shouldRestoreScryfallSearchFocus(active, keepSearchInputFocus)) {
      return {
        shouldFocus: false,
        start: searchSelection.start,
        end: searchSelection.end,
        direction: searchSelection.direction,
      };
    }
    return {
      shouldFocus: true,
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
    if (!snapshot?.shouldFocus) {
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
    dismissSearchInputFocus({ closeSearchPanel: true });
    const card = searchResults[index];
    if (!card) {
      showNotice("Spell could not be found in the current search results.", "warning");
      return;
    }
    if (/\bLand\b/i.test(card.typeLine || "")) {
      store.dispatch({ type: "ADD_PERMANENT", card, controller });
      showNotice(`${card.name} played as a land.`);
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
    showNotice(`${controller === "opponent" ? "Opponent " : ""}card cast and placed on the stack from ${formatLabel(sourceZone)}.`);
  }

  function dismissSearchInputFocus({ closeSearchPanel = false } = {}) {
    keepSearchInputFocus = false;
    searchSelection = { start: null, end: null, direction: "none" };
    blurScryfallSearchInput();
    if (closeSearchPanel && activeUtilityPanel === "search") {
      activeUtilityPanel = "";
    }
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
            <small class="app-header-role">Advanced gameplay engine</small>
          </div>
          <div class="header-actions">
            <button class="pill" data-home-action="linked-apps">Advanced Mode</button>
            ${renderRulesStatusPill(profile)}
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
      ${page === "home" ? renderBoardStateHome(profile) : ""}
      ${page === "life" ? renderLifeTracker(profile, uiState.trackerModifier, uiState) : ""}
      ${page === "battlefield" ? renderBattlefield(profile, searchResults, searchMessage, uiState.searchLoading, uiState.searchQuery, uiState.combatResolving, uiState.toolContext, new Set(uiState.expandedStackIds || []), uiState.activeUtilityPanel, uiLayer.current, { opponentBoardIndex: uiState.opponentBoardIndex || 0, opponentOverlayOpen: Boolean(uiState.opponentOverlayOpen), phaseControlMessage: uiState.phaseControlMessage || "", isMobilePortrait: Boolean(uiState.isMobilePortrait), manualChoicePanelCollapsed: Boolean(uiState.manualChoicePanelCollapsed), utilityDockOpen: Boolean(uiState.utilityDockOpen), castActionPopup: uiState.castActionPopup }) : ""}
      ${page === "tournament" ? renderTournamentPage(profile) : ""}
      ${page === "profile" ? renderProfile(profile) : ""}
      ${page === "archive" ? renderArchive(profile) : ""}
      ${page === "decks" ? renderDecks(profile, searchResults, searchMessage, uiState.searchLoading, uiState.searchQuery) : ""}
      ${page === "leaderboards" ? renderLeaderboards(profile) : ""}
      ${page === "battlefield" ? renderBattlefieldToolBadge(profile, uiState.toolMenuOpen, uiState.floatingManaOpen, uiState.activeToolPanel, uiState.hudBadgePositions || HUD_BADGE_DEFAULTS, uiState.toolContext, Boolean(uiState.isMobilePortrait), Boolean(uiState.hudBadgesLocked), Boolean(uiState.simulationLogOpen)) : ""}
      ${page === "battlefield" ? renderUtilityDock(profile, uiState.utilityDockOpen, uiState.activeUtilityPanel, uiState.hudBadgePositions || HUD_BADGE_DEFAULTS, Boolean(uiState.isMobilePortrait), Boolean(uiState.hudBadgesLocked), searchResults, searchMessage, uiState.searchLoading, uiState.searchQuery, uiState.castActionPopup) : ""}
      ${uiState.quickPanelOpen ? renderQuickAdjustmentPanel(profile, uiState.quickPanelOpen) : ""}
      ${uiState.modifierPanelOpen ? renderTrackerModifierPanel(uiState.pendingTrackerModifier) : ""}
      ${uiState.optionsOpen ? renderGameOptionsCommandCenter(profile, page, uiState.activeOptionsCategory || "") : ""}
      ${uiState.statsOpen ? renderStatsOverlay(profile, uiState.statsMode) : ""}
      ${uiState.simulationSetupOpen ? renderSimulationSetupModal(uiState.simulationSelectedOpponents, uiState.simulationSelectedSpeed, uiState.simulationRevengeEnabled, uiState.simulationSetupError) : ""}
      ${uiState.simulationStatsOpen ? renderSimulationStatsOverlay(profile) : ""}
      ${uiState.syncedTurnOrderSetupOpen ? renderSyncedTurnOrderModal(uiState.syncedTurnOrderPlayers || [], uiState.syncedTurnOrderRolls || {}, uiState.syncedTurnOrderOrder || [], uiState.syncedTurnOrderSuggested || [], uiState.syncedTurnOrderTiePlayerIds || [], uiState.syncedTurnOrderError || "") : ""}
      ${page !== "tournament" ? renderPinnedTournamentPanel(profile) : ""}
      ${uiState.tournamentInvite ? renderTournamentInviteModal(profile, uiState.tournamentInvite) : ""}
      ${renderFirstLaunchOnboarding(profile)}
      ${renderGuidedTutorialPanel(profile)}
      ${renderAdhdAssistPanel(profile, page, uiLayer.current)}
      ${renderHelperSprite(profile, uiState.helperMessage, uiState.hudBadgePositions || HUD_BADGE_DEFAULTS, Boolean(uiState.isMobilePortrait), Boolean(uiState.hudBadgesLocked))}
      ${renderCardPresentation(profile.activeSession?.presentation)}
      ${renderRecoveryToasts(profile, uiState.uiNotice)}
      ${uiState.activeNotification ? renderFullWindowNotification(uiState.activeNotification) : ""}
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
  const isPortrait = window.matchMedia?.("(orientation: portrait)")?.matches ?? (window.innerHeight || 0) >= (window.innerWidth || 0);
  return isPortrait && (window.matchMedia?.(MOBILE_LAYOUT_QUERY)?.matches ?? (window.innerWidth || 0) < 1280);
}

function renderRulesStatusPill(profile = {}) {
  const rules = getRulesControlSummary(profile);
  return `<button class="pill rules-status-pill ${rules.mode === "waived" ? "is-waived" : "is-enforced"}" data-home-action="rules">${escapeHtml(rules.label)}</button>`;
}

function renderBoardStateHome(profile = {}) {
  const model = getBoardStateHomeModel(profile);
  return `
    <section class="boardstate-home-page">
      <div class="home-hero glass">
        <div>
          <p class="eyebrow">Authoritative rules control</p>
          <h2>Advanced BoardState</h2>
          <p>Focused on Dry Run simulation, full advanced gameplay, tutorial practice, canonical saves, linked-session preparation, and rules-engine authority.</p>
        </div>
        <div class="home-hero-status">
          <span class="status-chip success">${escapeHtml(model.interfaceStatus.label)}</span>
          <span class="status-chip">${escapeHtml(model.interfaceStatus.connected ? "Connected to shared session" : model.interfaceStatus.simpleModeMessage)}</span>
          <span class="status-chip ${model.rules.mode === "waived" ? "warning" : "success"}">${escapeHtml(model.rules.label)}</span>
          <span class="status-chip">${escapeHtml(model.currentSession.modeLabel)}</span>
          <span class="status-chip">Schema ${escapeHtml(model.versions.schemaVersion)}</span>
        </div>
      </div>
      <div class="home-primary-grid">
        ${renderHomeActionCard("start-dry-run", "Start Dry Run", "Test a linked or imported deck against simulated opponents.", "DRY", "primary")}
        ${renderHomeActionCard("continue-dry-run", "Continue Dry Run", model.continueDryRun ? `Resume ${model.continueDryRun.saveName} from turn ${model.continueDryRun.turn}.` : "No incomplete Dry Run save yet. Start a new simulation.", "RUN", "", !model.continueDryRun && !profile.activeSession?.simulation?.enabled)}
        ${renderHomeActionCard("start-advanced", "Start Advanced Gameplay", "Start a fully enforced Arena-style game.", "ADV", "primary")}
        ${renderHomeActionCard("continue-linked", "Continue Linked Game", model.linkedGame ? `Open ${model.linkedGame.sourceApp} session ${model.linkedGame.sessionId}.` : "No linked BoardState Lite session yet. Import shared sessions when available.", "LINK", "", !model.linkedGame)}
        ${renderHomeActionCard("load-state", "Load Game State", `${model.saveCount} saved advanced games, simulations, tutorial checkpoints, and recovery saves.`, "SAVE")}
        ${renderHomeActionCard("tutorial", "Tutorial", model.tutorial.resume ? "Resume the five-turn Helper Sprite practice game." : "Learn BoardState and play five guided turns.", "HELP")}
        ${renderHomeActionCard("recent-simulations", "Recent Simulations", `${model.recentSimulations.length} saved or completed simulation record(s).`, "SIM")}
      </div>
      <div class="home-secondary-grid">
        ${renderHomeInterfaceStatus(model.interfaceStatus)}
        ${renderHomeRulesControl(model.rules)}
        ${renderHomeLinkedStatus(model.linkedApps)}
        ${renderHomeSaveSummary(model)}
        ${renderHomeLegacySummary(model.legacy)}
      </div>
    </section>
  `;
}

function renderHomeActionCard(action, title, description, glyph, variant = "", disabled = false) {
  return `
    <button class="home-action-card ${variant} ${disabled ? "is-disabled" : ""}" data-home-action="${escapeAttribute(action)}" ${disabled && action !== "continue-linked" ? "disabled" : ""}>
      <span class="home-action-glyph">${escapeHtml(glyph)}</span>
      <strong>${escapeHtml(title)}</strong>
      <small>${escapeHtml(description)}</small>
    </button>
  `;
}

function renderHomeInterfaceStatus(status = {}) {
  return `
    <article class="home-status-card glass">
      <p class="eyebrow">Interface Mode</p>
      <h3>${escapeHtml(status.label || "Advanced Mode")}</h3>
      <p>${escapeHtml(status.connected ? "Connected to shared session where applicable." : status.simpleModeMessage || "Simple Mode is prepared for a later BoardState Lite update.")}</p>
      <small>${escapeHtml(status.returnMessage || "Export session handoff data for future Simple Mode consumers.")}</small>
      <div class="button-grid mini">
        <button data-export-shared-session="copy">Copy Session Handoff Data</button>
        <button data-download-shared-session>Export Session for Simple Mode</button>
      </div>
    </article>
  `;
}

function renderHomeRulesControl(rules = {}) {
  return `
    <article class="home-status-card glass">
      <div class="overlay-header compact">
        <div>
          <p class="eyebrow">Rules Control</p>
          <h3>${escapeHtml(rules.label)}</h3>
          <small>Engine ${escapeHtml(rules.rulesEngineVersion)}</small>
        </div>
        <span class="option-status-badge">${escapeHtml(rules.activeWaiverCount)} waiver(s)</span>
      </div>
      <div class="button-grid mini">
        <button data-rules-mode="enforced" class="${rules.mode === "enforced" ? "active" : ""}">Rules Enforced</button>
        <button data-rules-mode="waived" class="${rules.mode === "waived" ? "active" : ""}">Waive Rules</button>
        <button data-home-action="rules">Rules Settings</button>
      </div>
      <p>${escapeHtml(rules.mode === "waived" ? "Waived actions remain logged and reviewable. AI players cannot waive rules." : "Illegal actions are blocked by default during active games and Dry Run.")}</p>
    </article>
  `;
}

function renderHomeLinkedStatus(linkedApps = []) {
  return `
    <article class="home-status-card glass">
      <p class="eyebrow">Linked App Status</p>
      <h3>BoardState Ecosystem</h3>
      <div class="linked-app-mini-grid">
        ${linkedApps.map((app) => `
          <section>
            <strong>${escapeHtml(app.title)}</strong>
            <span>${escapeHtml(app.status)}</span>
            <small>${escapeHtml(app.detail)}</small>
          </section>
        `).join("")}
      </div>
      <div class="button-grid mini">
        <button data-home-action="linked-apps">Linked Apps</button>
        <button data-home-action="continue-linked">Continue Linked Game</button>
      </div>
    </article>
  `;
}

function renderHomeSaveSummary(model = {}) {
  return `
    <article class="home-status-card glass">
      <p class="eyebrow">Saves</p>
      <h3>${escapeHtml(model.saveCount)} Local Save(s)</h3>
      <p>Advanced games: ${model.saveGroups.advanced.length} - Dry Runs: ${model.saveGroups.dryRun.length} - Tutorials: ${model.saveGroups.tutorial.length}</p>
      <div class="button-grid mini">
        <button data-home-action="saves">Open Saves</button>
        <button data-home-action="load-state">Load Game State</button>
      </div>
    </article>
  `;
}

function renderHomeLegacySummary(legacy = []) {
  const total = legacy.reduce((sum, entry) => sum + Number(entry.count || 0), 0);
  return `
    <article class="home-status-card glass">
      <p class="eyebrow">Legacy / Migration</p>
      <h3>${escapeHtml(total)} Legacy Item(s)</h3>
      <p>Decks, collections, friends, tournaments, profiles, notifications, and old saves remain accessible until migration paths exist.</p>
      <div class="button-grid mini">
        <button data-home-action="legacy">Open Legacy & Migration</button>
      </div>
    </article>
  `;
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
        <article class="option-card dry-run-setup-summary">
          <h3>Dry Run Session Defaults</h3>
          <div class="setup-field-grid">
            <span><b>Player deck source</b><small>Existing BoardState deck / imported snapshot / temporary test deck</small></span>
            <span><b>Opponent count</b><small>${escapeHtml(String(selected.size || 1))} selected</small></span>
            <span><b>Opponent deck source</b><small>Alpha, Beta, and Omega saved simulation decks</small></span>
            <span><b>AI difficulty</b><small>Rules-legal commander simulation</small></span>
            <span><b>Starting player</b><small>You, then randomized NPC order</small></span>
            <span><b>Starting life</b><small>40 Commander</small></span>
            <span><b>Game format</b><small>1v1, 3-way, or 4-way Commander</small></span>
            <span><b>Rules enforcement</b><small>Rules Enforced by default; AI cannot waive rules</small></span>
            <span><b>Deterministic seed</b><small>Prepared for future shared-session replay</small></span>
            <span><b>Deck Nexus</b><small>Link Deck Nexus after app preparation</small></span>
          </div>
        </article>
        <article class="option-card">
          <h3>Choose Opponents</h3>
          <label class="toggle-row npc-identity-card npc-identity-card--alpha">
            <span><b>Alpha · ${escapeHtml(alphaDeck?.deckName || "Deck")}</b><small>Landfall / Graveyard / Jund Value</small></span>
            <input type="checkbox" data-sim-opponent="alpha" ${selected.has("alpha") ? "checked" : ""} />
          </label>
          <label class="toggle-row npc-identity-card npc-identity-card--beta">
            <span><b>Beta · ${escapeHtml(betaDeck?.deckName || "Deck")}</b><small>Spellslinger / Copy / Storm Value</small></span>
            <input type="checkbox" data-sim-opponent="beta" ${selected.has("beta") ? "checked" : ""} />
          </label>
          <label class="toggle-row npc-identity-card npc-identity-card--omega">
            <span><b>Omega · ${escapeHtml(omegaDeck?.deckName || "Deck")}</b><small>Colorless Eldrazi / Ramp / Big Threats</small></span>
            <input type="checkbox" data-sim-opponent="omega" ${selected.has("omega") ? "checked" : ""} />
          </label>
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
  const podium = [
    { id: "user", label: profile.profileName || "You", wins: Number(stats.user?.wins || 0), losses: Number(stats.user?.losses || 0) },
    { id: "alpha", label: "Alpha", wins: Number(stats.alpha?.wins || 0), losses: Number(stats.alpha?.losses || 0) },
    { id: "beta", label: "Beta", wins: Number(stats.beta?.wins || 0), losses: Number(stats.beta?.losses || 0) },
    { id: "omega", label: "Omega", wins: Number(stats.omega?.wins || 0), losses: Number(stats.omega?.losses || 0) },
  ]
    .sort((left, right) => right.wins - left.wins || left.losses - right.losses || left.label.localeCompare(right.label))
    .map((entry, index, entries) => ({
      ...entry,
      place: entries.findIndex((candidate) => candidate.wins === entry.wins) + 1,
    }))
    .slice(0, 3);
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
        <article class="simulation-podium" aria-label="Simulation win leaders">
          <div class="simulation-podium__header">
            <p class="eyebrow">Current Simulation Leaders</p>
            <strong>${latest ? `Latest winner · ${escapeHtml(latest.winnerName || latest.winnerId || "Unknown")}` : "Complete a Dry Run to record a winner"}</strong>
          </div>
          <div class="simulation-podium__grid">
            ${podium
              .map(
                (entry) => `
              <div class="simulation-podium__place simulation-podium__place--${entry.place} npc-${entry.id}">
                <span>${entry.place === 1 ? "&#9819;" : entry.place === 2 ? "&#9671;" : "&#9670;"} ${entry.place === 1 ? "1st" : entry.place === 2 ? "2nd" : "3rd"}</span>
                <strong>${escapeHtml(entry.label)}</strong>
                <small>${entry.wins}-${entry.losses} W-L</small>
              </div>
            `
              )
              .join("")}
          </div>
        </article>
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
  const visibility = profile.settings?.battlefield?.opponentVisibility || {};
  const activeOpponentIndex = hasOpponentBoards ? Math.max(0, Math.min(opponentBoards.length - 1, Number(uiState.opponentBoardIndex) || 0)) : 0;
  const activeOpponent = hasOpponentBoards ? opponentBoards[activeOpponentIndex] : null;
  const activeOpponentVisible = Boolean(activeOpponent && visibility[activeOpponent.id || "opponent"]);
  const showOpponentZone = Boolean(panels.boardOpponent && hasOpponentBoards && activeOpponentVisible);
  const showStatsOverlay = Boolean(profile.settings?.battlefield?.statsOverlay);
  return `
    <section class="battlefield-page battlefield-page--focused ui-layer-surface-${escapeAttribute(uiLayer)} ${adhdMode.enabled && adhdMode.reducedNoise ? "adhd-reduced-noise" : ""} ${isMobilePortrait && mobileFocusView ? "mobile-focus-view" : ""}">
      <div class="battlefield-state-strip">
        <div>
          <strong>Turn ${escapeHtml(session.turn)} · ${escapeHtml(PHASES[session.phaseIndex] || "Beginning")} · ${escapeHtml(resolvePhaseTrackerActorLabel(session).replace(/^Active turn:\s*/i, ""))}</strong>
          <span>${escapeHtml(resolveBattlefieldActionHint(session))}</span>
        </div>
        <div class="battlefield-top-controls">
          <button class="${showStatsOverlay ? "active" : ""}" data-setting-button="battlefield.statsOverlay" data-value="${showStatsOverlay ? "false" : "true"}" aria-pressed="${showStatsOverlay}">Stats ${showStatsOverlay ? "On" : "Off"}</button>
          <button data-setting-button="battlefield.focusMode" data-value="${profile.settings?.battlefield?.focusMode ? "false" : "true"}">Focus View</button>
        </div>
      </div>
      ${hasOpponentBoards ? renderOpponentVisibilityControls(opponentBoards, visibility) : ""}
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
            showStatsOverlay,
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
            showStatsOverlay,
            session,
            settings: profile.settings,
          })}
        </div>
      </section>
      ${renderSelectedPermanentMenu(session)}
      <aside class="search-panel glass ${isMobilePortrait ? "mobile-hud-column" : ""}">
        ${!isMobilePortrait && panels.archiveQuickAdd ? `<h2>Battlefield Quick Add</h2>` : ""}
        ${!isMobilePortrait && panels.archiveQuickAdd && activeUtilityPanel !== "search" ? renderSearch(searchResults, searchMessage, searchLoading, searchQuery, "battlefield", uiState.castActionPopup) : ""}
      </aside>
    </section>
    ${renderMobileBattlefieldDock(profile, activeUtilityPanel, uiState.utilityDockOpen, Boolean(panels.boardCombat), Boolean(combatResolving), isMobilePortrait)}
    ${panels.advancedRulesHelpers || (session.pendingEffects || []).some((entry) => !["resolved", "skipped", "ignored"].includes(entry.status)) ? renderPending(session, Boolean(uiState.manualChoicePanelCollapsed)) : ""}
    ${session.tutorial?.active ? renderTutorialSamplePanel(session) : ""}
    ${activeUtilityPanel === "history" ? renderActionTimeline(profile) : ""}
    ${activeUtilityPanel === "triggers" ? renderTriggerQueuePanel(profile) : ""}
    ${uiState.opponentOverlayOpen && activeOpponent ? renderOpponentBattlefieldOverlay(profile, activeOpponent, activeOpponentIndex, opponentBoards.length, detailMode, compressionMode, selectedIds, expandedStackIds) : ""}
    ${session.combat?.step === "declare-blockers" && !session.simulation?.enabled ? renderBlockerDeclaration(profile) : ""}
  `;
}

function renderOpponentVisibilityControls(opponentBoards = [], visibility = {}) {
  return `
    <div class="opponent-visibility-controls glass" aria-label="Opponent battlefield visibility">
      ${opponentBoards.map((opponent) => {
        const id = opponent.id || "opponent";
        const visible = Boolean(visibility[id]);
        return `<button class="${visible ? "active" : ""}" data-setting-button="battlefield.opponentVisibility.${escapeAttribute(id)}" data-value="${visible ? "false" : "true"}" aria-pressed="${visible}">${escapeHtml(opponent.name || id)} ${visible ? "Shown" : "Hidden"}</button>`;
      }).join("")}
    </div>
  `;
}

function renderCardPresentation(presentation) {
  if (!presentation || Number(presentation.expiresAt || 0) <= Date.now()) {
    return "";
  }
  const card = presentation.card || {};
  const imageUrl = getBattlefieldCardImageUrl(card);
  const label = presentation.kind === "cast"
    ? `${presentation.controller || "Player"} casts ${card.name || "a spell"}`
    : `${card.name || "Card"} enters the battlefield`;
  return `
    <aside class="card-presentation" aria-live="polite" aria-label="${escapeAttribute(label)}">
      <div class="card-presentation__energy" aria-hidden="true"></div>
      <div class="card-presentation__card ${imageUrl ? "has-card-art" : getBattlefieldCardFallbackClass(card)}" ${imageUrl ? `style="--card-image:url(&quot;${escapeAttribute(imageUrl)}&quot;)"` : ""}>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(card.name || "Card")}</strong>
        <small>${escapeHtml(card.typeLine || "")}</small>
      </div>
    </aside>
  `;
}

function renderBlockerDeclaration(profile) {
  const session = profile.activeSession;
  const combat = session.combat || {};
  const attackers = (session.battlefield.player || []).filter((entry) => (combat.attackerIds || []).includes(entry.id));
  const blockers = (session.battlefield.opponent || []).filter((entry) => entry.isCreature);
  const assignments = combat.blockersByAttacker || {};
  return `
    <section class="floating-overlay blocker-declaration glass" data-no-swipe role="dialog" aria-modal="true" aria-label="Declare blockers">
      <div class="overlay-header compact">
        <div><p class="eyebrow">Combat</p><h2>Declare Blockers</h2></div>
        <span>${escapeHtml(combat.defendingPlayerId || "Defender")}</span>
      </div>
      <div class="blocker-board-pair scroll-safe">
        <section>
          <p class="eyebrow">Attacking board</p>
          <div class="blocker-card-grid">
            ${attackers.map((attacker) => `
              <button class="blocker-card blocker-card--attacker" data-blocker-attacker="${escapeAttribute(attacker.id)}">
                <strong>${escapeHtml(attacker.name)}</strong>
                <span>${escapeHtml(`${attacker.currentPower || 0}/${attacker.currentToughness || 0}`)}</span>
                <small>Attacking ${escapeHtml(combat.attackTargetsByAttacker?.[attacker.id] || combat.defendingPlayerId || "opponent")}</small>
                <em>${(assignments[attacker.id] || []).length} blocker(s)</em>
              </button>
            `).join("") || "<p>No attackers declared.</p>"}
          </div>
        </section>
        <section>
          <p class="eyebrow">Defending board</p>
          <div class="blocker-card-grid">
            ${blockers.map((blocker) => {
              const assignedAttacker = Object.entries(assignments).find(([, ids]) => ids.includes(blocker.id))?.[0] || "";
              const legalTargets = attackers.filter((attacker) => canUiBlock(attacker, blocker));
              return `
                <article class="blocker-card ${legalTargets.length ? "" : "is-invalid"} ${assignedAttacker ? "is-assigned" : ""}">
                  <strong>${escapeHtml(blocker.name)}</strong>
                  <span>${escapeHtml(`${blocker.currentPower || 0}/${blocker.currentToughness || 0}`)}</span>
                  <small>${blocker.tapped ? "Tapped: cannot block" : assignedAttacker ? `Blocking ${attackers.find((entry) => entry.id === assignedAttacker)?.name || "attacker"}` : `${legalTargets.length} legal target(s)`}</small>
                  <div class="blocker-target-actions">
                    ${legalTargets.map((attacker) => `<button data-assign-blocker="${escapeAttribute(blocker.id)}" data-assign-attacker="${escapeAttribute(attacker.id)}">${assignedAttacker === attacker.id ? "Unassign" : `Block ${escapeHtml(attacker.name)}`}</button>`).join("")}
                  </div>
                </article>
              `;
            }).join("") || "<p>No legal blockers available.</p>"}
          </div>
        </section>
      </div>
      <div class="blocker-declaration__actions">
        <button data-no-blockers>No Blockers</button>
        <button class="resolve-button" data-confirm-blockers>Confirm Blocks</button>
      </div>
    </section>
  `;
}

function canUiBlock(attacker, blocker) {
  if (!attacker?.isCreature || !blocker?.isCreature || blocker.tapped) return false;
  const attackerText = String(attacker.oracleText || "").toLowerCase();
  const blockerText = String(blocker.oracleText || "").toLowerCase();
  const blockerKeywords = new Set((blocker.keywords || []).map((entry) => String(entry).toLowerCase()));
  const attackerKeywords = new Set((attacker.keywords || []).map((entry) => String(entry).toLowerCase()));
  if (/\bcan't be blocked\b|\bunblockable\b/.test(attackerText) || /\bcan't block\b/.test(blockerText)) return false;
  return !attackerKeywords.has("flying") || blockerKeywords.has("flying") || blockerKeywords.has("reach");
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

  const zones = BATTLEFIELD_ZONE_ORDER
    .map((zone) => ({
      ...zone,
      permanents: permanents.filter((permanent) => getBattlefieldZoneKey(permanent) === zone.key),
    }))
    .filter((zone) => zone.permanents.length);
  return `
    <div class="battlefield-groups">
      ${zones.map((zone) => renderPermanentGroup(zone.label, zone.permanents, { ...options, zoneKey: zone.key })).join("")}
    </div>
  `;
}

function renderPermanentGroup(label, permanents, options = {}) {
  if (!permanents.length) {
    return "";
  }
  const count = permanents.reduce((total, permanent) => total + (Number(permanent.quantity) || 1), 0);
  const untappedCount = permanents.filter((permanent) => !permanent.tapped).reduce((total, permanent) => total + (Number(permanent.quantity) || 1), 0);
  const tappedCount = Math.max(0, count - untappedCount);
  return `
    <section class="battlefield-group battlefield-zone-${escapeAttribute(options.zoneKey || "other")}" aria-label="${escapeAttribute(`${label}: ${count} permanents, ${untappedCount} ready, ${tappedCount} tapped`)}">
      <div class="tile-grid ${options.readonly ? "readonly" : ""} ${options.compressionMode === "compact" ? "density-high" : ""}">
        ${permanents.map((permanent) => renderPermanent(permanent, options)).join("")}
      </div>
    </section>
  `;
}

const BATTLEFIELD_ZONE_ORDER = [
  { key: "creatures", label: "Creatures" },
  { key: "lands", label: "Lands" },
  { key: "support", label: "Non-creature permanents" },
];

function getBattlefieldZoneKey(permanent = {}) {
  if (permanent.isCreature) return "creatures";
  if (permanent.isLand) return "lands";
  return "support";
}

function renderPermanent(permanent, options = {}) {
  const selected = options.selectedIds?.has(permanent.id);
  const stackExpanded = options.expandedAll || options.expandedStackIds?.has(permanent.id);
  const detailMode = options.detailMode || "standard";
  const stackMembers = permanent.stackMembers || [];
  const statusIcons = collectPermanentStatusIcons(permanent, options.session, options.settings);
  const showStatsOverlay = Boolean(options.showStatsOverlay);
  const imageUrl = getBattlefieldCardImageUrl(permanent);
  const fallbackClass = getBattlefieldCardFallbackClass(permanent);
  const damageMarked = Math.max(0, Number(permanent.damageMarked || permanent.damage || 0));
  const lethalDamage = Boolean(permanent.isCreature && damageMarked >= Math.max(0, Number(permanent.currentToughness || 0)));
  const stateClasses = [
    selected ? "selected" : "",
    permanent.targeted || permanent.isTargeted ? "targeted" : "",
    permanent.tapped ? "tapped" : "",
    permanent.attacking ? "attacking" : "",
    permanent.blocking ? "blocking" : "",
    permanent.summoningSick ? "summoning-sick" : "",
    permanent.locked || permanent.disabled ? "locked" : "",
    permanent.isCommander ? "commander-spotlight" : "",
    permanent.quantity > 1 ? "stacked-permanent" : "",
    lethalDamage ? "lethal-damage" : "",
    permanent.manualStatus === "pending" ? "pending" : "",
  ].filter(Boolean).join(" ");
  const targetAttr = options.readonly
    ? options.allowTargeting
      ? `data-opponent-permanent="${escapeAttribute(permanent.id)}"`
      : ""
    : `data-permanent="${permanent.id}"`;
  return `
    <article class="permanent detail-${detailMode} ${stateClasses}" data-permanent-card data-permanent-id="${permanent.id}" data-readonly="${options.readonly ? "true" : "false"}">
      <div class="permanent-art-layer ${fallbackClass} ${imageUrl ? "has-card-art" : "uses-fallback"}" ${imageUrl ? `style="--card-image:url(&quot;${escapeAttribute(imageUrl)}&quot;)"` : ""} data-card-image="${imageUrl ? "available" : "fallback"}" aria-hidden="true"></div>
      <div class="permanent-readability-layer" aria-hidden="true"></div>
      ${permanent.quantity > 1 ? `<i class="stack-silhouette stack-silhouette--one" aria-hidden="true"></i><i class="stack-silhouette stack-silhouette--two" aria-hidden="true"></i>` : ""}
      <div class="permanent-content">
        <button ${targetAttr}>
          <strong>${escapeHtml(permanent.name)}</strong>
          ${permanent.manaCost ? `<span class="permanent-mana-cost">${escapeHtml(permanent.manaCost)}</span>` : ""}
          ${detailMode !== "compact" ? `<span>${escapeHtml(permanent.typeLine)}</span>` : `<span>MV ${permanent.manaValue || 0}</span>`}
          ${permanent.isCreature && showStatsOverlay ? `<b>${permanent.currentPower}/${permanent.currentToughness}</b>` : ""}
          ${permanent.isPlaneswalker ? `<b>Loyalty ${permanent.counters?.Loyalty || 0}</b>` : ""}
          ${permanent.quantity > 1 ? `<i class="quantity">x${permanent.quantity}</i>` : ""}
          ${permanent.isToken ? "<em>TOKEN</em>" : ""}
          ${permanent.isCopy ? "<em>COPY</em>" : ""}
          ${permanent.isCommander ? "<em>COMMANDER</em>" : ""}
        </button>
        ${renderPermanentStateBadges(permanent, damageMarked, lethalDamage)}
        ${showStatsOverlay ? renderStatusIconRow(statusIcons) : ""}
        ${showStatsOverlay && detailMode !== "compact" ? renderPermanentDetails(permanent, detailMode) : ""}
        ${permanent.quantity > 1 ? `<button class="stack-toggle" type="button" data-toggle-stack="${permanent.id}">${stackExpanded ? "Collapse Stack" : "Expand Stack"}</button>` : ""}
        ${stackExpanded ? renderStackMemberDetails(stackMembers, detailMode, permanent) : ""}
        ${options.readonly ? "" : renderPermanentSurfaceActions(permanent)}
      </div>
    </article>
  `;
}

function renderPermanentSurfaceActions(permanent = {}) {
  if (permanent.isLand) {
    return `
      <div class="row mini permanent-surface-actions permanent-surface-actions--land">
        <button data-add-land-copy="${escapeAttribute(permanent.id)}" title="Add one matching land">+1</button>
        <button data-tap="${escapeAttribute(permanent.id)}" ${permanent.tapped ? "disabled" : ""} title="Tap for mana">Tap</button>
      </div>
    `;
  }
  if (!permanent.isCreature) {
    return "";
  }
  return `
    <div class="row mini permanent-surface-actions permanent-surface-actions--creature">
      <button data-tap="${escapeAttribute(permanent.id)}">${permanent.tapped ? "Untap" : "Tap"}</button>
      <button data-counter="${escapeAttribute(permanent.id)}">+1/+1</button>
    </div>
  `;
}

function renderSelectedPermanentMenu(session = {}) {
  const selected = [...(session.battlefield?.player || [])]
    .find((permanent) => (session.selectedIds || []).includes(permanent.id));
  if (!selected) {
    return "";
  }
  const isSimpleLand = selected.isLand && !selected.supportsStation && !selected.supportsMaxSpeed;
  return `
    <aside class="selected-permanent-menu glass scroll-safe" role="dialog" aria-label="${escapeAttribute(`${selected.name} actions`)}">
      <div class="overlay-header compact">
        <div><p class="eyebrow">Selected permanent</p><strong>${escapeHtml(selected.name)}</strong><small>${escapeHtml(selected.typeLine)}</small></div>
        <button data-selected-action="clear" aria-label="Close selected permanent actions">Close</button>
      </div>
      ${isSimpleLand ? `<p>Use +1 or Tap directly on the land tile.</p>${selected.tapped ? `<button data-tap="${escapeAttribute(selected.id)}">Untap</button>` : ""}` : `
      <div class="button-grid selected-permanent-menu__actions">
        ${selected.isLand ? "" : `<button data-selected-menu-counter="Charge">Add counter</button><button data-selected-menu-counter="+1/+1">Add +1/+1 counter</button>`}
        ${selected.isLand ? "" : `<button data-tap="${escapeAttribute(selected.id)}">${selected.tapped ? "Untap" : "Tap"}</button>`}
        ${selected.isCreature ? `<button data-declare-attackers>Attack</button>` : ""}
        ${selected.isLand ? "" : `<button data-manual-trigger-permanent="${escapeAttribute(selected.id)}">Trigger Ability</button>`}
        ${selected.isPlaneswalker ? `<button data-loyalty-adjust="${escapeAttribute(selected.id)}" data-delta="-1">Loyalty -1</button><button data-loyalty-adjust="${escapeAttribute(selected.id)}" data-delta="1">Loyalty +1</button>` : ""}
        ${selected.isLand ? "" : `<button data-selected-action="sacrifice">Sacrifice</button><button data-selected-action="exile">Exile</button><button class="danger" data-selected-action="destroy">Destroy</button>`}
        ${selected.supportsStation ? `<button data-permanent-mechanic="station" data-permanent-id="${escapeAttribute(selected.id)}">Station</button>` : ""}
        ${selected.isMount || /\bSaddle\b/i.test(selected.oracleText || "") ? `<button data-permanent-mechanic="saddle" data-permanent-id="${escapeAttribute(selected.id)}">Mount / Saddle</button>` : ""}
        ${selected.isVehicle || /\bCrew\b/i.test(selected.oracleText || "") ? `<button data-permanent-mechanic="crew" data-permanent-id="${escapeAttribute(selected.id)}">Crew</button>` : ""}
        ${selected.supportsMaxSpeed ? `<button data-permanent-mechanic="max-speed" data-permanent-id="${escapeAttribute(selected.id)}">Max Speed +1</button>` : ""}
        <button data-open-tool-panel="inspect">Details</button>
      </div>`}
    </aside>
  `;
}

function renderPermanentStateBadges(permanent = {}, damageMarked = 0, lethalDamage = false) {
  const counters = Object.entries(permanent.counters || {}).filter(([, value]) => Number(value) > 0);
  const commanderTax = Number(permanent.commanderTax || permanent.metadata?.commanderTax || 0);
  return `
    <div class="permanent-state-badges" aria-label="Permanent state">
      ${permanent.isCommander ? `<span class="state-badge state-badge--commander" title="Commander">&#9812; Commander${commanderTax ? ` · Tax ${commanderTax}` : ""}</span>` : ""}
      ${permanent.isVehicle ? `<span class="state-badge">Vehicle</span>` : ""}
      ${permanent.isMount ? `<span class="state-badge">Mount</span>` : ""}
      ${permanent.isSpacecraft ? `<span class="state-badge">Spacecraft</span>` : ""}
      ${permanent.isPlanet ? `<span class="state-badge">Planet</span>` : ""}
      ${permanent.supportsStation ? `<span class="state-badge">Station ${Number(permanent.counters?.Station || 0)}</span>` : ""}
      ${permanent.supportsMaxSpeed ? `<span class="state-badge">Speed ${Number(permanent.metadata?.maxSpeed || 0)}${permanent.metadata?.maxSpeedReached ? " · MAX" : ""}</span>` : ""}
      ${permanent.tapped ? `<span class="state-badge state-badge--tapped">&#8635; Tapped</span>` : ""}
      ${permanent.attacking ? `<span class="state-badge state-badge--attacking">&#9876; Attacking</span>` : ""}
      ${permanent.blocking ? `<span class="state-badge state-badge--blocking">&#128737; Blocking</span>` : ""}
      ${permanent.targeted || permanent.isTargeted ? `<span class="state-badge state-badge--targeted">&#8982; Targeted</span>` : ""}
      ${permanent.summoningSick ? `<span class="state-badge state-badge--sick">&#9203; Summoning sick</span>` : ""}
      ${permanent.locked || permanent.disabled ? `<span class="state-badge state-badge--locked">&#128274; Locked</span>` : ""}
      ${damageMarked ? `<span class="state-badge state-badge--damage ${lethalDamage ? "is-lethal" : ""}">&#9585; ${damageMarked} damage</span>` : ""}
      ${counters.slice(0, 3).map(([type, value]) => `<span class="state-badge state-badge--counter" title="${escapeAttribute(type)}">${escapeHtml(counterGlyph(type))} ${escapeHtml(type)} ${value}</span>`).join("")}
    </div>
  `;
}

function counterGlyph(type = "") {
  const normalized = String(type).toLowerCase();
  if (normalized.includes("+1/+1")) return "◆";
  if (normalized.includes("shield")) return "◇";
  if (normalized.includes("stun")) return "⌁";
  if (normalized.includes("charge")) return "✦";
  if (normalized.includes("loyalty")) return "♢";
  return "●";
}

function renderSelectedPermanentActions(permanent = {}) {
  return `
    <div class="card-action-ring" aria-label="Selected card actions">
      <button data-tap="${escapeAttribute(permanent.id)}" title="${permanent.tapped ? "Untap" : "Tap"}">${permanent.tapped ? "Untap" : "Tap"}</button>
      <button data-open-tool-panel="counters" title="Counters">Counters</button>
      ${permanent.isCreature ? `<button data-declare-attackers title="Declare selected creature as attacker">Attack</button>` : `<button disabled title="Only creatures can attack">Attack</button>`}
      <button data-open-tool-panel="permanents" title="Move, exile, sacrifice, or remove">Move</button>
      <button data-manual-trigger-permanent="${escapeAttribute(permanent.id)}" title="Manually trigger this card's ability">Trigger</button>
      <button class="danger" data-selected-action="destroy" title="Destroy selected permanent">Remove</button>
      <button data-open-tool-panel="inspect" title="Details">Details</button>
    </div>
  `;
}

function getBattlefieldCardImageUrl(card = {}) {
  const direct =
    card.imageSmall ||
    card.metadata?.imageSmall ||
    card.imageUrl ||
    card.metadata?.imageUrl ||
    card.imageArt ||
    card.metadata?.imageArt ||
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
  return `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=small`;
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
          <i class="stack-member-art" ${imageUrl ? `style="--card-image:url(&quot;${escapeAttribute(imageUrl)}&quot;)"` : ""} aria-hidden="true"></i>
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
      <form class="stacked-form manual-trigger-form" data-manual-trigger-form>
        <p class="eyebrow">Add Manual Trigger</p>
        <label>Source<input name="sourceName" placeholder="Selected permanent or source name" /></label>
        <label>Trigger summary<textarea name="summary" rows="2" required placeholder="Describe the trigger and choices that still need resolution."></textarea></label>
        <label>Trigger count<input name="triggerCount" type="number" min="1" value="1" /></label>
        <label>Condition
          <select name="selectedCondition">
            <option value="auto">Use battlefield state / auto</option>
            <option value="base">Base effect</option>
            <option value="condition-met">Condition met / stronger effect</option>
            <option value="manual-review">Manual review</option>
          </select>
        </label>
        <label class="toggle-row"><span>Optional trigger</span><input name="optional" type="checkbox" /></label>
        <button class="wide">Queue Manual Trigger</button>
      </form>
      <button class="wide resolve-button" data-trigger-resolve-all>Resolve All Possible</button>
    </section>
  `;
}

function renderStackPriorityPanel(profile) {
  const spells = profile.activeSession.stack || [];
  const queue = profile.activeSession.triggerQueue || [];
  const stackItems = [...spells, ...queue, ...(profile.activeSession.pendingEffects || []).filter((entry) => !entry.stackObjectId)];
  const priority = profile.activeSession.priority || {};
  const activePriorityName = ["local-player", "player"].includes(priority.activePlayerId) ? "You" : priority.activePlayerId || "No responder";
  const userCanRespond = priority.waiting && ["local-player", "player"].includes(priority.activePlayerId);
  return `
    <section class="stack-priority-panel">
      <p class="eyebrow">The Stack</p>
      <div class="timeline-list scroll-safe">
        ${stackItems
          .slice(0, 8)
          .map((entry, index) => `
            <article class="stack-priority-row ${index === 0 ? "is-next" : ""} ${entry.status === "awaiting-choice" ? "needs-choice" : ""}">
              <div class="stack-thumb">${index + 1}</div>
              <div>
                <strong>${escapeHtml(entry.name || entry.sourceName || entry.summary || "Stack item")}</strong>
                <span>${index === 0 ? "Next to resolve · " : "Waiting · "}${escapeHtml(entry.typeLine || entry.eventType || entry.status || "Pending")} ${entry.controller ? `(${escapeHtml(entry.controller)})` : ""}</span>
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
        <strong>Priority: ${escapeHtml(activePriorityName)}</strong>
        <span>${priority.waiting ? "Waiting for a response or pass." : stackItems.length ? "All applicable priority has passed; auto-run is ready." : "No priority window."}</span>
      </article>
      <div class="stack-priority-actions">
        ${userCanRespond ? `<button data-pass-priority>Pass Priority</button><button data-respond-stack>Respond...</button>` : ""}
        <button class="resolve-button" data-stack-run>Confirm / Run Stack</button>
        <button class="resolve-button" data-stack-resolve-next>Resolve Next</button>
        <button data-open-utility="triggers">Manual Review</button>
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
  const pendingCount =
    (profile.activeSession?.triggerQueue || []).filter((entry) => entry.status === "pending").length +
    (profile.activeSession?.stack || []).length +
    (profile.activeSession?.pendingEffects || []).filter((entry) => !["resolved", "skipped", "ignored"].includes(entry.status)).length;
  const hasQueuedTriggers = pendingCount > 0;
  return `
    <section class="battlefield-mobile-dock battlefield-command-console ${isMobilePortrait ? "is-mobile" : "is-desktop"} glass" data-no-swipe>
      <div class="battlefield-mobile-dock__status">
        ${hasQueuedTriggers ? `<button data-open-utility="triggers" class="pending-queue-alert ${activeUtilityPanel === "triggers" ? "active" : ""}"><span aria-hidden="true">&#9889;</span>${pendingCount} Pending</button>` : ""}
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
          <button class="battlefield-wheel-action action-resolve ${hasQueuedTriggers ? "has-pending" : ""}" data-dashboard-action="resolve" data-combat-available="${includeCombat ? "true" : "false"}" data-resolve-combat ${combatResolving ? "disabled" : ""} aria-label="Resolve stack or combat">
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
        ${renderToggle("Strict Turn Phase Enforcement", "strictPhaseEnforcement", Boolean(profile.settings?.strictPhaseEnforcement))}
        <p class="eyebrow">When off, phase tracking stays visible but manual battlefield actions are not blocked for phase timing.</p>
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
        <input type="search" name="query" data-search-query value="${escapeAttribute(query)}" placeholder="Search for a card..." inputmode="search" enterkeyhint="search" autocomplete="off" />
        <button type="submit" aria-label="Search Scryfall" ${loading ? "disabled" : ""}>${loading ? "Searching…" : "Search"}</button>
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
              <button data-deck-result="${index}">Add to selected deck</button>
              <button data-new-deck-result="${index}">Add to new deck</button>
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
      <form class="stacked-form tap-cost-card" data-tap-cost-form>
        <p class="eyebrow">Tap Cost Helper</p>
        <label>Mechanic
          <select name="mechanic">
            <option value="convoke">Convoke</option>
            <option value="improvise">Improvise</option>
            <option value="crew">Crew</option>
            <option value="saddle">Saddle</option>
            <option value="station">Station</option>
          </select>
        </label>
        <label>Required contribution<input name="requiredValue" type="number" min="0" inputmode="numeric" value="1" /></label>
        <button class="wide">Tap Selected for Cost</button>
        <small>BoardState validates selected eligible permanents, taps them, then keeps final payment/effect confirmation in Manual Choice Required.</small>
      </form>
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
          ${effect.effect?.action === "entry-choice" ? `<div class="manual-target-grid"><button data-entry-choice="${escapeAttribute(effect.id)}" data-entry-untapped="false">Enter Tapped / Decline</button><button data-entry-choice="${escapeAttribute(effect.id)}" data-entry-untapped="true">Condition Met / Pay Cost / Enter Untapped</button></div>` : ""}
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
        <button data-start-guided-tutorial>Start Guided Tutorial</button>
      </div>
      ${renderLocalSavesPanel(profile)}
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

function renderTournamentPanelLegacy(profile) {
  const tournament = profile.tournament || {};
  if (!tournament.active) {
    return `
      <article class="option-card tournament-panel">
        <h3>Local Commander Tournament</h3>
        <p>Tournament state and its session ID remain separate from regular gameplay sync.</p>
        <form class="stacked-form" data-tournament-create-form>
          <label>Tournament name<input name="name" value="Local Commander Tournament" /></label>
          <button class="wide">Create Tournament</button>
        </form>
      </article>
    `;
  }
  return `
    <article class="option-card tournament-panel">
      <div class="overlay-header compact">
        <div><h3>${escapeHtml(tournament.name)}</h3><small>${escapeHtml(tournament.id)} · ${escapeHtml(tournament.sync?.status || "local-only")}</small></div>
        <button data-tournament-end>End</button>
      </div>
      <form class="stacked-form" data-tournament-player-form>
        <label>Player name<input name="playerName" required /></label>
        <label>Commander / deck<input name="commander" /></label>
        <button>Add Player</button>
      </form>
      <div class="tournament-standings scroll-safe">
        ${(tournament.standings || []).map((standing) => `
          <article class="tournament-standing">
            <b>#${standing.rank}</b>
            <div><strong>${escapeHtml(standing.name)}</strong><small>${escapeHtml(standing.commander || "Commander not listed")} · ${escapeHtml(standing.syncStatus)}</small></div>
            <span>${standing.wins}W · ${standing.losses}L</span>
            <button data-tournament-win="${escapeAttribute(standing.playerId)}">Report Win</button>
            <button data-tournament-correct="${escapeAttribute(standing.playerId)}">Correct</button>
          </article>
        `).join("") || "<p>Add players to begin standings.</p>"}
      </div>
      <button class="wide resolve-button" data-tournament-announce>Announce Top 3</button>
      ${tournament.announcement ? `<div class="tournament-announcement"><p class="eyebrow">Top 3</p>${(tournament.announcement.winners || []).map((winner) => `<strong>#${winner.rank} ${escapeHtml(winner.name)} · ${winner.wins} wins</strong>`).join("") || "<strong>No ranked players</strong>"}</div>` : ""}
    </article>
  `;
}

function renderTournamentPanel(profile) {
  const tournament = profile.tournament || {};
  const hasTournament = tournament.status && tournament.status !== "idle";
  return `
    <article class="option-card tournament-panel">
      <h3>Tournament / Tournament Bracket</h3>
      <p>10-player casual ladder support with tournament sync kept separate from normal gameplay sync.</p>
      <div class="button-grid">
        <button data-open-tournament-page>${hasTournament ? "Open Tournament" : "Create / Join Tournament"}</button>
        ${hasTournament ? `<button data-tournament-pin="${tournament.pinned ? "false" : "true"}">${tournament.pinned ? "Unpin Panel" : "Pin Panel"}</button>` : ""}
      </div>
      ${hasTournament ? `<p>${escapeHtml(tournament.name)} - ${escapeHtml(tournament.joinCode || tournament.sync?.sessionId || "local")} - ${escapeHtml(tournament.syncStatus || tournament.sync?.status || "local-only")}</p>` : ""}
    </article>
  `;
}

function renderTournamentPage(profile) {
  const tournament = profile.tournament || {};
  const hasTournament = tournament.status && tournament.status !== "idle";
  if (!hasTournament) {
    return `
      <section class="utility-page tournament-page">
        <div class="tournament-hero glass">
          <div>
            <p class="eyebrow">Tournament Bracket</p>
            <h2>10-Player Casual MTG Tournament</h2>
            <p>Create a local-first tournament, join a hosted code, generate two 4-player pods plus one 1v1 each round, and keep tournament state separate from gameplay sync.</p>
          </div>
        </div>
        <div class="tournament-grid">
          ${renderTournamentCreateCard(profile)}
          ${renderTournamentJoinCard(profile)}
          ${renderTournamentRulesReference()}
        </div>
      </section>
    `;
  }
  const currentRound = getCurrentTournamentRound(tournament);
  const playerCount = (tournament.players || []).filter((player) => player.active !== false).length;
  const announcement = tournament.finalAnnouncement || tournament.announcement;
  return `
    <section class="utility-page tournament-page">
      <div class="tournament-hero glass">
        <div>
          <p class="eyebrow">Tournament Bracket</p>
          <h2>${escapeHtml(tournament.name)}</h2>
          <p>${escapeHtml(tournament.joinCode || tournament.sync?.sessionId || "LOCAL")} - ${escapeHtml(tournament.formatPreset || "10-player casual win ladder")}</p>
        </div>
        <div class="tournament-hero__meta">
          <span>Status: ${escapeHtml(formatLabel(tournament.status || "setup"))}</span>
          <span>Round ${Number(tournament.currentRoundNumber || 0)}</span>
          <span>${playerCount}/${Number(tournament.settings?.expectedPlayerCount || 10)} players</span>
          <span>Sync: ${escapeHtml(tournament.syncStatus || tournament.sync?.status || "local-only")}</span>
          <button data-tournament-pin="${tournament.pinned ? "false" : "true"}">${tournament.pinned ? "Unpin Tournament" : "Pin Tournament"}</button>
        </div>
      </div>
      ${tournament.lastError ? `<article class="recovery-toast warning"><strong>Tournament notice</strong><p>${escapeHtml(tournament.lastError)}</p></article>` : ""}
      <div class="tournament-grid">
        ${renderTournamentSetupControls(profile)}
        ${renderTournamentCurrentRound(tournament, currentRound)}
        ${renderTournamentStandings(tournament)}
        ${renderTournamentRecords(tournament)}
        ${renderTournamentSuddenDeath(tournament, currentRound)}
        ${announcement ? renderTournamentAnnouncement(announcement) : ""}
        ${renderTournamentRulesReference()}
        ${renderTournamentHistory(tournament)}
      </div>
    </section>
  `;
}

function renderPinnedTournamentPanel(profile) {
  const tournament = profile.tournament || {};
  if (!tournament.pinned || !tournament.status || tournament.status === "idle") {
    return "";
  }
  const standings = tournament.standings || [];
  const localName = profile.player?.name || "";
  const localStanding = standings.find((entry) => entry.displayName === localName || entry.name === localName) || standings[0] || {};
  const currentRound = getCurrentTournamentRound(tournament);
  const table = findPlayerCurrentTable(tournament, localStanding.playerId) || currentRound?.oneVOne || currentRound?.podA;
  return `
    <aside class="pinned-tournament-panel glass" data-no-swipe>
      <div>
        <p class="eyebrow">Pinned Tournament</p>
        <strong>${escapeHtml(tournament.name)}</strong>
        <span>${escapeHtml(tournament.joinCode || tournament.sync?.sessionId || "LOCAL")} - ${escapeHtml(tournament.syncStatus || "local-only")}</span>
      </div>
      <div class="pinned-tournament-panel__stats">
        <span>Round ${Number(tournament.currentRoundNumber || 0)}</span>
        <span>${escapeHtml(table?.tableName || "No table yet")}</span>
        <span>Rank #${escapeHtml(localStanding.rank || "-")} - ${escapeHtml(localStanding.totalRecord || "0-0")}</span>
      </div>
      <div class="row mini">
        <button data-open-tournament-page>Open Tournament</button>
        <button data-tournament-pin="false">Unpin</button>
      </div>
    </aside>
  `;
}

function renderTournamentCreateCard(profile) {
  return `
    <article class="option-card tournament-card">
      <h3>Create / Host Tournament</h3>
      <form class="stacked-form" data-tournament-create-form>
        <label>Tournament Name<input name="name" value="Casual Commander Ladder" required /></label>
        <label>Host Name<input name="hostName" value="${escapeAttribute(profile.player?.name || "Host")}" required /></label>
        <label>Expected Player Count<input name="expectedPlayerCount" type="number" min="2" max="32" value="10" /></label>
        <label>Format Preset
          <select name="formatPreset">
            <option value="10-player-casual-win-ladder">10-Player Casual Win Ladder</option>
          </select>
        </label>
        <label>Tournament Sync
          <select name="syncMode">
            <option value="local">Local browser tabs</option>
            <option value="wifi">WiFi relay</option>
          </select>
        </label>
        <label>WiFi Tournament Relay URL<input name="wsUrl" value="${escapeAttribute(profile.settings?.multiplayer?.wsUrl || "ws://localhost:8787")}" /></label>
        <label class="toggle-row"><span>Allow deck changes between rounds</span><input type="checkbox" name="allowDeckChangesBetweenRounds" checked /></label>
        <label class="toggle-row"><span>Require every player to complete one 1v1 before repeat</span><input type="checkbox" name="oneVOneBeforeRepeat" checked /></label>
        <label class="toggle-row"><span>Sudden Death enabled</span><input type="checkbox" name="suddenDeathDamageDouble" checked /></label>
        <label class="toggle-row"><span>1v1 acts as pod timer</span><input type="checkbox" name="oneVOneActsAsTimer" checked /></label>
        <label class="toggle-row"><span>Top 3 announcement enabled</span><input type="checkbox" name="topThreeAnnouncement" checked /></label>
        <button class="wide resolve-button">Create Tournament</button>
      </form>
    </article>
  `;
}

function renderTournamentJoinCard(profile) {
  return `
    <article class="option-card tournament-card">
      <h3>Join / Sync Tournament</h3>
      <p>Tournament sync uses its own tournament session/channel. WiFi relay mode can connect devices on the same network without joining gameplay sync.</p>
      <form class="stacked-form" data-tournament-join-form>
        <label>Tournament Code / Session ID<input name="joinCode" placeholder="MTG-ABC123" required /></label>
        <label>Player Name<input name="playerName" value="${escapeAttribute(profile.player?.name || "Player")}" required /></label>
        <label>Tournament Sync
          <select name="syncMode">
            <option value="local">Local browser tabs</option>
            <option value="wifi">WiFi relay</option>
          </select>
        </label>
        <label>WiFi Tournament Relay URL<input name="wsUrl" value="${escapeAttribute(profile.settings?.multiplayer?.wsUrl || "ws://localhost:8787")}" /></label>
        <button class="wide">Join Tournament</button>
      </form>
      <p class="eyebrow">WiFi mode requires the BoardState multiplayer relay on the host LAN, for example <code>npm run multiplayer:server</code>, and still remains separate from gameplay sync.</p>
    </article>
  `;
}

function renderTournamentSetupControls(profile) {
  const tournament = profile.tournament || {};
  const setupLocked = tournament.status !== "setup";
  return `
    <article class="option-card tournament-card">
      <h3>Host / Admin Controls</h3>
      <p>Host: ${escapeHtml(tournament.hostName || "Host")} - Code: <strong>${escapeHtml(tournament.joinCode || tournament.sync?.sessionId || "LOCAL")}</strong></p>
      <p>Sync: ${escapeHtml(tournament.sync?.mode || "local")} - ${escapeHtml(tournament.sync?.status || tournament.syncStatus || "local-only")}${tournament.sync?.mode === "wifi" ? ` - ${escapeHtml(tournament.sync?.wsUrl || "ws://localhost:8787")}` : ""}</p>
      ${renderTournamentInviteControls(tournament)}
      <div class="button-grid">
        <button data-tournament-sample-players ${setupLocked ? "disabled" : ""}>Fill to 10 Players</button>
        <button data-tournament-generate-round>Generate Next Round</button>
        <button data-tournament-start-round data-round-number="${Number(tournament.currentRoundNumber || 0)}" ${getCurrentTournamentRound(tournament)?.status !== "pending" ? "disabled" : ""}>Lock / Start Round</button>
        <button data-tournament-announce>Announce Top 3</button>
        <button class="danger-soft" data-tournament-end>End Tournament</button>
      </div>
      <form class="stacked-form" data-tournament-player-form>
        <label>Player name<input name="playerName" required ${setupLocked ? "disabled" : ""} /></label>
        <label>Commander / deck notes<input name="deckNotes" ${setupLocked ? "disabled" : ""} /></label>
        <button ${setupLocked ? "disabled" : ""}>Add Player</button>
      </form>
      <div class="tournament-player-list">
        ${(tournament.players || []).map((player) => `
          <span>${escapeHtml(player.displayName || player.name)}${player.deckNotes ? ` - ${escapeHtml(player.deckNotes)}` : ""}${setupLocked ? "" : ` <button data-tournament-remove-player="${escapeAttribute(player.playerId || player.id)}">Remove</button>`}</span>
        `).join("") || "<span>No players yet.</span>"}
      </div>
    </article>
  `;
}

function renderTournamentInviteControls(tournament = {}) {
  const code = tournament.joinCode || tournament.sync?.sessionId || "";
  if (!code) {
    return `<p class="eyebrow">Create or join a tournament to generate an invite code.</p>`;
  }
  const inviteLink = buildTournamentInviteLink(code);
  return `
    <div class="invite-link-panel">
      <p class="eyebrow">Tournament Invite</p>
      <strong>${escapeHtml(code)}</strong>
      <input readonly value="${escapeAttribute(inviteLink)}" aria-label="Tournament invite link" />
      <div class="button-grid">
        <button data-copy-tournament-code="${escapeAttribute(code)}">Copy Code</button>
        <button data-copy-tournament-invite="${escapeAttribute(inviteLink)}" data-join-code="${escapeAttribute(code)}">Copy Invite Link</button>
        <button data-share-tournament-invite="${escapeAttribute(inviteLink)}" data-join-code="${escapeAttribute(code)}">Share Invite Link</button>
      </div>
      <small>Invite links only include the tournament code/session ID. They never include passwords, local profile data, or debug state.</small>
    </div>
  `;
}

function renderTournamentCurrentRound(tournament, round) {
  if (!round) {
    return `
      <article class="option-card tournament-card tournament-current-round">
        <h3>Current Round</h3>
        <p>No round generated yet. Add 10 players, then generate Round 1.</p>
      </article>
    `;
  }
  return `
    <article class="option-card tournament-card tournament-current-round">
      <div class="overlay-header compact">
        <div><h3>Round ${round.roundNumber}</h3><small>${escapeHtml(formatLabel(round.status))}${round.suddenDeathStarted ? " - Sudden Death Active" : ""}</small></div>
        <button data-tournament-sudden-death="${round.roundNumber}">Start Sudden Death</button>
      </div>
      <div class="tournament-table-grid">
        ${[round.podA, round.podB, round.oneVOne].map((table) => renderTournamentTable(tournament, round, table)).join("")}
      </div>
    </article>
  `;
}

function renderTournamentTable(tournament, round, table) {
  if (!table) return "";
  const names = (table.players || []).map((id) => getTournamentPlayerName(tournament, id));
  const pending = table.status === "pending";
  return `
    <section class="tournament-table-card ${table.status === "complete" ? "complete" : ""}">
      <div class="overlay-header compact">
        <div>
          <p class="eyebrow">${escapeHtml(table.tableType === "oneVOne" ? "Timer Table" : "4-Player Pod")}</p>
          <h4>${escapeHtml(table.tableName)}</h4>
          <small>${escapeHtml(formatLabel(table.status))}</small>
        </div>
        ${pending ? `<button data-tournament-edit-table="${escapeAttribute(table.tableId)}" data-round-number="${round.roundNumber}" data-players="${escapeAttribute(names.join(", "))}">Edit Seating</button>` : ""}
      </div>
      <div class="deck-list">${names.map((name) => `<span>${escapeHtml(name)}</span>`).join("")}</div>
      ${table.winnerPlayerId ? `<p><strong>Winner:</strong> ${escapeHtml(getTournamentPlayerName(tournament, table.winnerPlayerId))}</p>` : ""}
      ${table.tableType === "pod" && table.eliminationOrder?.length ? `<p><strong>Elimination order:</strong> ${table.eliminationOrder.map((id) => escapeHtml(getTournamentPlayerName(tournament, id))).join(" -> ")}</p>` : ""}
      ${table.status !== "complete" ? renderTournamentResultForm(tournament, round, table) : ""}
      ${table.status !== "complete" && table.tableType === "pod" ? `
        <div class="row mini">
          <button data-tournament-extension="${escapeAttribute(table.tableId)}" data-round-number="${round.roundNumber}">Start Extension</button>
        </div>
        ${table.extensionStarted ? renderExtensionTurns(tournament, round, table) : ""}
      ` : ""}
    </section>
  `;
}

function renderTournamentResultForm(tournament, round, table) {
  return `
    <form class="stacked-form tournament-result-form" data-tournament-result-form>
      <input type="hidden" name="roundNumber" value="${round.roundNumber}" />
      <input type="hidden" name="tableId" value="${escapeAttribute(table.tableId)}" />
      <input type="hidden" name="tableName" value="${escapeAttribute(table.tableName)}" />
      <label>Winner
        <select name="winnerId" required>
          <option value="">Choose winner</option>
          ${(table.players || []).map((id) => `<option value="${escapeAttribute(id)}">${escapeHtml(getTournamentPlayerName(tournament, id))}</option>`).join("")}
        </select>
      </label>
      ${table.tableType === "pod" ? `
        <label>Elimination order, earliest first<textarea name="eliminationOrder" placeholder="${escapeAttribute((table.players || []).map((id) => getTournamentPlayerName(tournament, id)).join(", "))}"></textarea></label>
        <label>Pod eliminations, optional eliminatedBy&gt;eliminated<textarea name="eliminations" placeholder="Ari&gt;Blake, Casey&gt;Devon"></textarea></label>
        <label>Final life totals, optional name:value<textarea name="lifeTotals" placeholder="Ari:18, Casey:12"></textarea></label>
        <label>Commander damage taken, optional name:value<textarea name="commanderDamageTaken" placeholder="Ari:8, Casey:16"></textarea></label>
      ` : ""}
      <label>Notes<input name="notes" /></label>
      <button>Confirm Result</button>
    </form>
  `;
}

function renderExtensionTurns(tournament, round, table) {
  const maxTurns = Number(tournament.settings?.suddenDeathExtensionTurns || 3);
  return `
    <div class="extension-turn-grid">
      ${(table.players || []).map((id) => {
        const used = Number(table.extensionTurns?.[id] || 0);
        return `<button data-tournament-extension-turn="${escapeAttribute(id)}" data-round-number="${round.roundNumber}" data-table-id="${escapeAttribute(table.tableId)}">${escapeHtml(getTournamentPlayerName(tournament, id))}: ${used}/${maxTurns} turns</button>`;
      }).join("")}
    </div>
  `;
}

function renderTournamentStandings(tournament) {
  return `
    <article class="option-card tournament-card tournament-standings-card">
      <h3>Standings</h3>
      <div class="tournament-standings scroll-safe">
        ${(tournament.standings || []).map((standing) => `
          <article class="tournament-standing ${Number(standing.rank) <= 3 ? "top-three" : ""}">
            <b>#${standing.rank}</b>
            <div>
              <strong>${escapeHtml(standing.displayName || standing.name)}</strong>
              <small>${escapeHtml(standing.totalRecord || "0-0")} total - Pod ${escapeHtml(standing.podRecord || "0-0")} - 1v1 ${escapeHtml(standing.oneVOneRecord || "0-0")}</small>
            </div>
            <span>${standing.podEliminations || 0} elim - Avg ${Number(standing.averagePodPlacement || 0).toFixed(2)}</span>
            <small>${escapeHtml(standing.tiebreakerSummary || "")}</small>
            <button data-tournament-correct="${escapeAttribute(standing.playerId)}">Correct</button>
          </article>
        `).join("") || "<p>Add players to begin standings.</p>"}
      </div>
    </article>
  `;
}

function renderTournamentRecords(tournament) {
  return `
    <article class="option-card tournament-card">
      <h3>Player Records</h3>
      <div class="tournament-record-grid">
        ${(tournament.standings || []).map((entry) => `
          <div class="tournament-mini-record">
            <strong>${escapeHtml(entry.displayName || entry.name)}</strong>
            <span>Total ${escapeHtml(entry.totalRecord || "0-0")}</span>
            <span>Pod ${escapeHtml(entry.podRecord || "0-0")}</span>
            <span>1v1 ${escapeHtml(entry.oneVOneRecord || "0-0")}</span>
            <span>H2H ${escapeHtml(entry.headToHeadSummary || "No head-to-head yet")}</span>
            <span>${entry.currentTableId ? `Current: ${escapeHtml(entry.currentTableId)}` : "No active table"}</span>
          </div>
        `).join("") || "<p>No records yet.</p>"}
      </div>
    </article>
  `;
}

function renderTournamentSuddenDeath(tournament, round) {
  return `
    <article class="option-card tournament-card">
      <h3>Sudden Death Status</h3>
      <p>${round?.suddenDeathStarted ? "Sudden Death Active: all damage dealt to players is doubled for active pods." : "Sudden Death starts automatically when the 1v1 result is reported, or manually by host."}</p>
      <p>Life loss, poison, mill, alternate wins, and lose-the-game effects are unchanged. Commander damage during Sudden Death is doubled and tracked as doubled commander damage.</p>
      <p>Extension: each remaining pod player gets exactly ${Number(tournament.settings?.suddenDeathExtensionTurns || 3)} turns. If multiple players remain, use highest life, least commander damage taken, then most pod eliminations.</p>
    </article>
  `;
}

function renderTournamentAnnouncement(announcement = {}) {
  return `
    <article class="option-card tournament-card tournament-announcement">
      <h3>Top 3 Announcement</h3>
      ${announcement.oneVOneWarning ? `<p class="warning-text">${escapeHtml(announcement.oneVOneWarning)}</p>` : ""}
      ${(announcement.winners || []).map((winner, index) => `<strong>${index + 1}. ${escapeHtml(winner.displayName || winner.name)} - ${escapeHtml(winner.totalRecord || `${winner.wins || 0}-${winner.losses || 0}`)}</strong>`).join("") || "<p>No winners available.</p>"}
    </article>
  `;
}

function renderTournamentRulesReference() {
  const sections = [
    ["Overview", "Casual win-based ladder. All pod wins and 1v1 wins count as one tournament win."],
    ["Match Structure", "Each round has two 4-player pods and one 1v1 match. The 1v1 match acts as the timer for both pods."],
    ["Records", "Track total record, pod record, 1v1 record, pod eliminations, elimination order, average pod placement, and head-to-head where applicable."],
    ["Deck Changes", "Players may change decks between rounds, but not during an active game unless the table agrees it fixes an honest setup mistake."],
    ["1v1 Rotation", "Every player should complete one 1v1 before anyone repeats. After Round 1, first eliminated pod players are prioritized for the next 1v1."],
    ["Sudden Death", "When the 1v1 ends, unfinished pods enter Sudden Death. Damage to players is doubled; life loss, poison, mill, alternate wins, and lose effects are unchanged."],
    ["Sudden Death Extension", "Unfinished pods can enter a final extension where each remaining player gets 3 turns. Highest life, least commander damage taken, then most pod eliminations break unresolved ties."],
    ["Round Seating", "Round 1 is randomized. Later rounds use elimination order for the 1v1 first, then standings balance the pods while avoiding exact repeats where practical."],
    ["Player Conduct", "Table politics are allowed. Collusion, traded wins, sold wins, or intentionally gifted wins for standings manipulation are not allowed."],
    ["Rule Disputes", "Pause, check card text and official rules where clear, then use majority agreement if unclear so the game continues."],
    ["Rankings and Tie Breakers", "Total wins, pod wins, 1v1 wins, fewest losses, head-to-head, pod eliminations, average pod placement, then shared placement or playoff."],
    ["Tournament End Conditions", "End when the group is tired, everyone has a 1v1, 1-3 players have a clear agreed lead, or standings are accepted as final."],
    ["Winners", "Top 3 players are announced from final standings. Ties can be shared or settled by playoff."],
  ];
  return `
    <article class="option-card tournament-card tournament-rules-card">
      <h3>Rules Reference</h3>
      <div class="tournament-rules-grid">
        ${sections.map(([title, body]) => `<details open><summary>${escapeHtml(title)}</summary><p>${escapeHtml(body)}</p></details>`).join("")}
      </div>
    </article>
  `;
}

function renderTournamentHistory(tournament) {
  return `
    <article class="option-card tournament-card">
      <h3>Sync Status / History</h3>
      <p>Tournament channel: ${escapeHtml(tournament.sync?.namespace || "tournament")} - ${escapeHtml(tournament.sync?.sessionId || tournament.joinCode || "local")}</p>
      <p>Sync transport: ${escapeHtml(tournament.sync?.mode || "local")}${tournament.sync?.mode === "wifi" ? ` via ${escapeHtml(tournament.sync?.wsUrl || "ws://localhost:8787")}` : ""}</p>
      <p>Connected tournament peers: ${Array.isArray(tournament.sync?.connectedPlayers) && tournament.sync.connectedPlayers.length ? tournament.sync.connectedPlayers.map((peer) => escapeHtml(peer.name || peer.id)).join(", ") : "None detected yet"}</p>
      <p>Normal gameplay sync room remains separate: tournament actions are not sent to gameplay sync.</p>
      <div class="tournament-history-list">
        ${(tournament.historyLog || []).slice(0, 8).map((entry) => `<span>${escapeHtml(entry.type)} - ${escapeHtml(entry.summary)}</span>`).join("") || "<span>No tournament history yet.</span>"}
      </div>
    </article>
  `;
}

function getCurrentTournamentRound(tournament = {}) {
  const rounds = tournament.rounds || [];
  return rounds.find((round) => round.roundNumber === tournament.currentRoundNumber) || rounds[rounds.length - 1] || null;
}

function getTournamentPlayerName(tournament = {}, playerId = "") {
  const player = (tournament.players || []).find((entry) => entry.playerId === playerId || entry.id === playerId);
  return player?.displayName || player?.name || playerId || "Unknown player";
}

function findPlayerCurrentTable(tournament = {}, playerId = "") {
  if (!playerId) return null;
  const round = getCurrentTournamentRound(tournament);
  return [round?.podA, round?.podB, round?.oneVOne].find((table) => (table?.players || []).includes(playerId)) || null;
}

function renderFirstLaunchOnboarding(profile) {
  if (!shouldShowFirstLaunch(profile.onboarding || {})) {
    return "";
  }
  const hasSaves = Boolean((profile.localSaves?.items || []).length);
  return `
    <section class="overlay-backdrop onboarding-backdrop" data-no-swipe>
      <div class="floating-overlay glass first-launch-onboarding" role="dialog" aria-modal="true" aria-labelledby="first-launch-title">
        <div class="overlay-header">
          <div>
            <p class="eyebrow">First Launch</p>
            <h2 id="first-launch-title">Welcome to BoardState</h2>
            <p>BoardState can track your game, teach you how to use the app, and guide you through your first Magic: The Gathering turns.</p>
          </div>
        </div>
        <div class="onboarding-action-grid">
          <button class="primary-action" data-start-guided-tutorial>Start Guided Tutorial</button>
          <button data-onboarding-explore>Explore App Freely</button>
          <button data-onboarding-profile>Create Profile</button>
          <button data-onboarding-load-save ${hasSaves ? "" : "disabled"}>Load Local Save</button>
          <button data-onboarding-watch-later>Watch Tutorial Later</button>
          <button data-onboarding-explore>Do Not Show Again</button>
          <button data-onboarding-accessibility>Accessibility Options</button>
          <button data-onboarding-screen-reader>${profile.settings?.helperSprite?.screenReaderPrompts ? "Disable" : "Enable"} Screen Reader Prompts</button>
        </div>
        <p class="options-version-note">Returning users can restart this from Game Options > Accessibility / ADHD Assist or About / Help.</p>
      </div>
    </section>
  `;
}

function renderGuidedTutorialPanel(profile) {
  const tutorial = profile.activeSession?.tutorial || {};
  if (!tutorial.active && !tutorial.completionPending && tutorial.status !== "paused") {
    return "";
  }
  const progress = getTutorialProgress(tutorial);
  const step = progress.step;
  const screenReaderText = buildTutorialScreenReaderText(profile.activeSession);
  if (tutorial.completionPending || tutorial.status === "complete") {
    return renderTutorialCompletionPanel(profile, progress);
  }
  return `
    <section class="guided-tutorial-panel glass ${tutorial.paused ? "is-paused" : ""}" data-no-swipe aria-label="Guided tutorial">
      <div class="tutorial-progress-ring" style="--tutorial-progress:${progress.percent}%">
        <strong>${progress.index + 1}</strong>
        <span>${progress.total}</span>
      </div>
      <div class="guided-tutorial-copy">
        <p class="eyebrow">Turn ${escapeHtml(step.turn)} - ${escapeHtml(step.feature)}</p>
        <h3>${escapeHtml(step.title)}</h3>
        <p>${escapeHtml(step.prompt)}</p>
        ${screenReaderText && profile.settings?.helperSprite?.screenReaderPrompts ? `<p class="sr-only" aria-live="polite">${escapeHtml(screenReaderText)}</p>` : ""}
        <div class="tutorial-status-row">
          <span>${tutorial.paused ? "Paused" : "Guided"}</span>
          <span>${progress.percent}% complete</span>
          <span>Autosave ${tutorial.autoSaveId ? "ready" : "pending"}</span>
        </div>
      </div>
      <div class="guided-tutorial-actions">
        ${tutorial.paused ? `<button data-tutorial-resume>Resume Tutorial</button>` : `<button class="primary-action" data-tutorial-advance>${escapeHtml(step.actionLabel || "Next")}</button>`}
        <button data-tutorial-back ${progress.index <= 0 ? "disabled" : ""}>Back</button>
        <button data-tutorial-repeat>Repeat</button>
        <button data-helper-remind>Remind Me</button>
        <button data-tutorial-pause>${tutorial.paused ? "Paused" : "Pause"}</button>
        <button data-tutorial-save-exit>Save and Exit</button>
        <button class="danger-soft" data-tutorial-skip>Skip Tutorial</button>
      </div>
    </section>
  `;
}

function renderTutorialCompletionPanel(profile, progress) {
  return `
    <section class="overlay-backdrop" data-no-swipe>
      <div class="floating-overlay glass guided-tutorial-complete" role="dialog" aria-modal="true">
        <div class="overlay-header">
          <div>
            <p class="eyebrow">Tutorial Complete</p>
            <h2>Tutorial Complete</h2>
            <p>You’ve completed the first five guided turns. You can now continue playing freely, finish the practice game, begin a new simulation, or create your profile.</p>
          </div>
        </div>
        <div class="tutorial-completion-grid">
          <button class="primary-action" data-tutorial-free-play>Continue This Game Freely</button>
          <button data-tutorial-finish-sim>Finish Simulated Game</button>
          <button data-tutorial-new-sim>Start New Simulated Game</button>
          <button data-tutorial-profile>Create / Complete Profile</button>
          <button data-tutorial-save-current>Save Current Game</button>
          <button data-tutorial-load-save>Load Another Save</button>
          <button data-tutorial-free-play>Return to Main App</button>
        </div>
        <p class="options-version-note">Forced guidance stops after this point. Helper Sprite remains optional.</p>
      </div>
    </section>
  `;
}

function renderLocalSavesPanel(profile) {
  const collection = profile.localSaves || {};
  const saves = [...(collection.items || [])].sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0));
  return `
    <article class="option-card local-saves-panel">
      <div class="overlay-header compact">
        <div>
          <h3>Local Saves</h3>
          <p>Profile-bound local snapshots for tutorial, active games, Dry Run, and training-ground boards.</p>
        </div>
        <span class="option-status-badge">${saves.length} saves</span>
      </div>
      ${collection.lastError ? `<p class="warning-text">${escapeHtml(collection.lastError)}</p>` : ""}
      <form class="stacked-form" data-local-save-form>
        <label>Save name</label>
        <input name="saveName" placeholder="Current game checkpoint" value="${escapeAttribute(defaultLocalSaveName(profile))}" />
        <button class="wide">Save Current Game</button>
      </form>
      <div class="button-grid">
        <label class="file-pill">Import Save<input type="file" accept="application/json" data-local-save-import /></label>
        <button data-tutorial-save-current>Quick Save Tutorial/Game</button>
      </div>
      <div class="local-save-list">
        ${saves.map(renderLocalSaveCard).join("") || "<p>No local saves yet. Save the current game from here or after the tutorial.</p>"}
      </div>
    </article>
  `;
}

function renderLocalSaveCard(save = {}) {
  const updated = save.updatedAt ? new Date(save.updatedAt).toLocaleString() : "Unknown";
  const created = save.createdAt ? new Date(save.createdAt).toLocaleString() : "Unknown";
  const metadata = save.metadata || {};
  const badge = metadata.mode === "tutorial" ? "Tutorial" : save.gameMode === "dry-run" ? "Dry Run" : "Game";
  const compatibility = save.saveFormatVersion && save.saveFormatVersion !== SHARED_SAVE_FORMAT_VERSION ? "Incompatible save format" : "Compatible";
  const schema = save.schemaVersion || metadata.schemaVersion || SHARED_CONTRACT_SCHEMA_VERSION;
  const rulesVersion = save.rulesEngineVersion || metadata.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION;
  return `
    <section class="local-save-card">
      <div>
        <strong>${escapeHtml(save.saveName || "BoardState Save")}</strong>
        <small>${escapeHtml(save.profileName || "Player")} - ${escapeHtml(badge)} - Turn ${escapeHtml(metadata.currentTurn || save.gameState?.turn || 1)}</small>
        <small>Created ${escapeHtml(created)} - Updated ${escapeHtml(updated)}</small>
        <small>Rules ${escapeHtml(rulesVersion)} - Schema ${escapeHtml(schema)} - ${escapeHtml(compatibility)}</small>
        <small>Source ${escapeHtml(save.sourceApp || metadata.sourceApp || "boardstate")} - Checksum ${escapeHtml(metadata.checksum || "n/a")}</small>
        <small>Interface ${escapeHtml(metadata.localInterfaceMode || "boardstate-advanced")} - Revision ${escapeHtml(metadata.revision || 0)}</small>
      </div>
      <div class="button-grid mini">
        <button data-local-save-load="${escapeAttribute(save.saveId)}">Load</button>
        <button data-local-save-rename="${escapeAttribute(save.saveId)}" data-local-save-name="${escapeAttribute(save.saveName || "")}">Rename</button>
        <button data-local-save-duplicate="${escapeAttribute(save.saveId)}">Duplicate</button>
        <button data-local-save-export="${escapeAttribute(save.saveId)}">Export</button>
        <button class="danger-soft" data-local-save-delete="${escapeAttribute(save.saveId)}">Delete</button>
      </div>
    </section>
  `;
}

function defaultLocalSaveName(profile = {}) {
  const session = profile.activeSession || {};
  if (session.tutorial?.active || session.tutorial?.completionPending) return `Tutorial Turn ${session.tutorial?.currentTurn || session.turn || 1}`;
  if (session.simulation?.enabled) return `Dry Run Turn ${session.turn || 1}`;
  return `Game Turn ${session.turn || 1}`;
}

function renderGameOptionsCommandCenter(profile, page = "life", activeCategory = "") {
  const category = getOptionsCategories(profile, page).find((entry) => entry.id === activeCategory);
  return `
    <section class="overlay-backdrop">
      <div class="floating-overlay glass options-command-center">
        <div class="overlay-header">
          <div>
            <p class="eyebrow">${category ? "Focused Options" : "Command Center"}</p>
            <h2>${category ? escapeHtml(category.title) : "Game Options"}</h2>
            <p>${category ? escapeHtml(category.description) : "Choose a category. Detailed settings stay inside focused panels instead of one long wall."}</p>
          </div>
          <div class="overlay-actions">
            ${category ? `<button data-options-back>Back</button>` : ""}
            <button data-close-overlay>Close</button>
          </div>
        </div>
        ${category ? renderOptionsSubpage(profile, page, category.id) : renderOptionsHub(profile, page)}
      </div>
    </section>
  `;
}

function getOptionsCategories(profile, page = "life") {
  const multiplayer = getMultiplayerSettings(profile);
  const rules = getRulesControlSummary(profile);
  const saveCount = (profile.localSaves?.items || []).length;
  const linkedApps = getLinkedAppStatusCards(profile);
  const linkedCount = linkedApps.filter((entry) => entry.status !== "Not Linked").length;
  const legacyTotal = getLegacyInventory(profile).reduce((sum, entry) => sum + Number(entry.count || 0), 0);
  return [
    {
      id: "rules",
      glyph: "RULE",
      title: "Rules",
      description: "Rules Enforced / Waive Rules, active waivers, engine version, and unsupported behavior.",
      status: rules.label,
    },
    {
      id: "gameplay",
      glyph: "PLAY",
      title: "Gameplay",
      description: "Advanced gameplay defaults, stack confirmation, combat visualization, and multiplayer room basics.",
      status: multiplayer.mode === "wifi" ? "WiFi" : multiplayer.mode === "simulated" ? "Dry Run" : multiplayer.mode || "Offline",
    },
    {
      id: "dry-run",
      glyph: "DRY",
      title: "Dry Run",
      description: "Simulation setup, AI speed, difficulty defaults, deterministic mode, and recent simulations.",
      status: profile.activeSession?.simulation?.enabled ? "Active" : `${getRecentSimulationEntries(profile).length} recent`,
    },
    {
      id: "tutorial",
      glyph: "HELP",
      title: "Tutorial",
      description: "Helper Sprite, tutorial progress, restart, screen-reader prompts, and reduced motion.",
      status: profile.onboarding?.tutorialCompleted ? "Complete" : profile.onboarding?.tutorialStarted ? "In Progress" : "Ready",
    },
    {
      id: "saves",
      glyph: "SAVE",
      title: "Saves",
      description: "Profile-bound advanced game, Dry Run, tutorial, imported, legacy, and recovery saves.",
      status: `${saveCount} saves`,
    },
    {
      id: "linked-apps",
      glyph: "LINK",
      title: "Linked Apps",
      description: "BoardState Lite, Deck Nexus, future Hub, shared-session capability, and honest link status.",
      status: linkedCount ? `${linkedCount} linked` : "Not linked",
    },
    {
      id: "accessibility",
      glyph: "A11Y",
      title: "Accessibility",
      description: "ADHD assistance, screen-reader prompts, reduced motion, text, haptics, and sound.",
      status: profile.settings?.adhdMode?.enabled ? "On" : "Standard",
    },
    {
      id: "display",
      glyph: "HUD",
      title: "Display & Performance",
      description: "Portrait/widescreen layout, stats overlay, card density, animation level, and performance mode.",
      status: (profile.settings?.appearance?.compositionMode || "auto").toUpperCase(),
    },
    {
      id: "legacy",
      glyph: "MIGR",
      title: "Legacy & Migration",
      description: "Preserved decks, collection, profiles, friends, tournaments, notifications, and migration status.",
      status: `${legacyTotal} items`,
    },
    {
      id: "diagnostics",
      glyph: "LOG",
      title: "Diagnostics",
      description: "Game log, rules log, debug state, compatibility report, app/version info.",
      status: `${collectRulesConfidence(profile).length || 0} events`,
    },
  ];
}

function renderOptionsHub(profile, page = "life") {
  const simulation = profile.activeSession?.simulation || {};
  const gameTracking = profile.activeSession?.gameTracking || {};
  const showEndGame = page === "battlefield" && (Boolean(simulation.enabled) || Boolean(gameTracking.active));
  const categories = getOptionsCategories(profile, page);
  return `
    <div class="options-hub">
      ${showEndGame ? `
        <article class="options-status-strip">
          <div>
            <p class="eyebrow">Active Game</p>
            <strong>Simulation ${simulation.enabled ? "Active" : "Inactive"} - Tracking ${gameTracking.active ? "Active" : "Inactive"}</strong>
          </div>
          <button data-end-game>End Game</button>
        </article>
      ` : ""}
      <div class="options-quick-row">
        ${["rules", "dry-run", "saves"].map((id) => renderOptionCategoryCard(categories.find((entry) => entry.id === id), true)).join("")}
      </div>
      <div class="options-category-grid">
        ${categories.filter((entry) => !["rules", "dry-run", "saves"].includes(entry.id)).map((entry) => renderOptionCategoryCard(entry)).join("")}
      </div>
      <p class="options-version-note">BoardState ${escapeHtml(getAppVersion())} - focused on advanced gameplay, Dry Run, tutorials, saves, linked-session preparation, and rules authority.</p>
    </div>
  `;
}

function renderOptionCategoryCard(category, compact = false) {
  if (!category) return "";
  return `
    <button class="option-category-card ${compact ? "compact" : ""}" data-option-category="${escapeAttribute(category.id)}">
      <span class="option-category-glyph">${escapeHtml(category.glyph)}</span>
      <span>
        <strong>${escapeHtml(category.title)}</strong>
        <small>${escapeHtml(category.description)}</small>
      </span>
      <span class="option-status-badge">${escapeHtml(category.status || "")}${category.badge ? ` <i>${Number(category.badge)}</i>` : ""}</span>
      <span class="option-chevron">&gt;</span>
    </button>
  `;
}

function renderOptionsSubpage(profile, page, category) {
  switch (category) {
    case "rules":
      return renderRulesOptionsSubpage(profile);
    case "profile":
      return renderProfileOptionsSubpage(profile);
    case "gameplay":
      return renderGameplayOptionsSubpage(profile, page);
    case "dry-run":
      return renderDryRunOptionsSubpage(profile);
    case "tutorial":
      return renderTutorialOptionsSubpage(profile);
    case "saves":
      return renderSavesOptionsSubpage(profile);
    case "linked-apps":
      return renderLinkedAppsOptionsSubpage(profile);
    case "friends":
      return renderFriendsOptionsSubpage(profile);
    case "tournament":
      return renderTournamentOptionsSubpage(profile);
    case "notifications":
      return renderNotificationOptionsSubpage(profile);
    case "legacy":
      return renderLegacyMigrationSubpage(profile);
    case "display":
    case "hud":
      return renderHudOptionsSubpage(profile);
    case "accessibility":
      return renderAccessibilityOptionsSubpage(profile);
    case "diagnostics":
      return renderDiagnosticsOptionsSubpage(profile);
    case "data":
      return renderDataManagementOptionsSubpage();
    case "about":
      return renderAboutOptionsSubpage();
    default:
      return renderOptionsHub(profile, page);
  }
}

function renderRulesOptionsSubpage(profile) {
  const rules = getRulesControlSummary(profile);
  const details = buildSessionDetailsModel(profile);
  const strictPhase = Boolean(profile.settings?.strictPhaseEnforcement);
  const manualStack = Boolean(profile.settings?.manualStackConfirmation);
  const activeWaivers = profile.activeSession?.activeRuleWaivers || [];
  const waiverHistory = profile.activeSession?.waiverHistory || [];
  return `
    <div class="options-subpage">
      <article class="option-card">
        <h3>Rules</h3>
        <p>Current mode: <strong>${escapeHtml(rules.label)}</strong>. Rules engine ${escapeHtml(rules.rulesEngineVersion)}. Schema ${escapeHtml(profile.activeSession?.schemaVersion || SHARED_CONTRACT_SCHEMA_VERSION)}.</p>
        <div class="button-grid">
          <button data-rules-mode="enforced" class="${rules.mode === "enforced" ? "active" : ""}">Rules Enforced</button>
          <button data-rules-mode="waived" class="${rules.mode === "waived" ? "active" : ""}">Waive Rules</button>
          <button data-revoke-waivers ${activeWaivers.length ? "" : "disabled"}>Revoke Active Waivers</button>
        </div>
        ${renderToggle("Strict phase enforcement", "strictPhaseEnforcement", strictPhase)}
        ${renderToggle("Manual stack confirmation", "manualStackConfirmation", manualStack)}
        <div class="options-setting-group">
          <h4>Active Waivers</h4>
          ${activeWaivers.length ? activeWaivers.map((entry) => `<p>${escapeHtml(entry.ruleCode || "Rule")} - ${escapeHtml(entry.reason || "No reason")}</p>`).join("") : "<p>No active rule waivers.</p>"}
        </div>
        <div class="options-setting-group">
          <h4>Waiver History</h4>
          ${waiverHistory.slice(0, 8).map((entry) => `<p>${escapeHtml(entry.ruleCode || "Rule")} - ${escapeHtml(entry.status || entry.reason || "logged")}</p>`).join("") || "<p>No waiver history yet.</p>"}
        </div>
        <p>AI-controlled Dry Run players remain rules-enforced and cannot waive rules.</p>
      </article>
      <article class="option-card">
        <h3>Session Details</h3>
        ${renderSessionDetailsPanel(details)}
      </article>
    </div>
  `;
}

function renderDryRunOptionsSubpage(profile) {
  return `
    <div class="options-subpage">
      <article class="option-card">
        <h3>Dry Run</h3>
        <p>Dry Run uses the authoritative rules engine, mana automation, stack/priority, targeting, combat, triggers, and state-based actions where supported.</p>
        <div class="button-grid">
          <button data-open-simulation-setup>Start Dry Run</button>
          <button data-home-action="continue-dry-run">Continue Dry Run</button>
          <button data-open-simulation-stats>Simulation Stats</button>
        </div>
        ${renderToggle("Simulation revenge learning", "multiplayer.simulationRevenge", Boolean(profile.settings?.multiplayer?.simulationRevenge ?? true))}
      </article>
      ${renderRecentSimulationsPanel(profile)}
    </div>
  `;
}

function renderTutorialOptionsSubpage(profile) {
  const progress = profile.onboarding?.tutorialCompleted
    ? "Completed"
    : profile.onboarding?.tutorialStarted
      ? `Turn ${profile.onboarding?.tutorialCurrentTurn || profile.activeSession?.tutorial?.currentTurn || 1}`
      : "Not started";
  return `
    <div class="options-subpage">
      <article class="option-card">
        <h3>Tutorial</h3>
        <p>Progress: ${escapeHtml(progress)}. The Helper Sprite remains the primary guided tutorial surface.</p>
        <div class="button-grid">
          <button data-start-guided-tutorial>Start Tutorial</button>
          ${profile.activeSession?.tutorial?.active || profile.activeSession?.tutorial?.paused || profile.onboarding?.tutorialPaused ? `<button data-tutorial-resume>Resume Tutorial</button>` : ""}
          <button data-tutorial-restart>Restart Tutorial</button>
          <button data-reset-onboarding>Reset Tutorial Progress</button>
        </div>
        ${renderToggle("Helper Sprite", "helperSprite.enabled", Boolean(profile.settings?.helperSprite?.enabled))}
        ${renderToggle("Screen-reader prompts", "helperSprite.screenReaderPrompts", Boolean(profile.settings?.helperSprite?.screenReaderPrompts))}
        ${renderToggle("Reduced visual noise", "adhdMode.reducedNoise", Boolean(profile.settings?.adhdMode?.reducedNoise))}
      </article>
    </div>
  `;
}

function renderSavesOptionsSubpage(profile) {
  const groups = getSaveGroups(profile);
  return `
    <div class="options-subpage">
      ${renderLocalSavesPanel(profile)}
      ${renderSaveGroupSection("Advanced Games", groups.advanced)}
      ${renderSaveGroupSection("Dry Runs", groups.dryRun)}
      ${renderSaveGroupSection("Tutorial Saves", groups.tutorial)}
      ${renderSaveGroupSection("Imported Sessions", groups.imported)}
      ${renderSaveGroupSection("Legacy Saves", groups.legacy)}
      ${renderSaveGroupSection("Recovery Saves", groups.recovery)}
    </div>
  `;
}

function renderSaveGroupSection(title, saves = []) {
  return `
    <article class="option-card save-group-card">
      <div class="overlay-header compact">
        <div><h3>${escapeHtml(title)}</h3><small>${saves.length} item(s)</small></div>
      </div>
      <div class="local-save-list compact">
        ${saves.map(renderLocalSaveCard).join("") || `<p>No ${escapeHtml(title.toLowerCase())} available.</p>`}
      </div>
    </article>
  `;
}

function renderLinkedAppsOptionsSubpage(profile) {
  const linkedApps = getLinkedAppStatusCards(profile);
  const linked = getLinkedSessionCandidate(profile);
  const linkedRecords = getLinkedSessionRecords(profile);
  const sessionDetails = buildSessionDetailsModel(profile);
  return `
    <div class="options-subpage">
      <article class="option-card">
        <h3>Continue Linked Game</h3>
        ${linked ? `<p>${escapeHtml(linked.sourceApp || "External")} session ${escapeHtml(linked.sessionId || "local")} - Turn ${escapeHtml(linked.turn || 1)} - ${escapeHtml(linked.phase || "Beginning")} - ${escapeHtml(linked.compatibility || "valid")}</p>` : `<p>No linked game exists yet. BoardState Lite handoff will be enabled in its own update. You can import a canonical shared-session bundle now, or export the current Advanced session for future Simple Mode consumers.</p>`}
        <div class="button-grid">
          ${linked ? `<button data-linked-session-continue="${escapeAttribute(linked.sessionId)}">Continue in Advanced Mode</button>` : ""}
          <button data-tutorial-save-current>Save Current Session</button>
          <button data-linked-session-import>Import Linked Session</button>
          <button data-export-shared-session="copy">Copy Handoff JSON</button>
          <button data-download-shared-session>Export Shared Session</button>
        </div>
      </article>
      <article class="option-card">
        <h3>Session Details</h3>
        ${renderSessionDetailsPanel(sessionDetails)}
      </article>
      <article class="option-card">
        <h3>Imported Linked Sessions</h3>
        ${linkedRecords.length ? linkedRecords.map(renderLinkedSessionCard).join("") : "<p>No imported linked-session snapshots. Simple Mode live linking is not installed yet.</p>"}
      </article>
      ${linkedApps.map((app) => `
        <article class="option-card linked-app-card">
          <div class="overlay-header compact">
            <div><h3>${escapeHtml(app.title)}</h3><small>${escapeHtml(app.detail)}</small></div>
            <span class="option-status-badge">${escapeHtml(app.status)}</span>
          </div>
          <div class="button-grid">
            ${app.appId === "boardstate-lite" ? `<button data-linked-session-import>Import Linked Session</button><button data-export-shared-session="copy">Export Shared Session</button><button disabled>Return to Simple Mode Coming After Lite Update</button>` : `<button disabled>${app.status === "Not Linked" ? "Coming after app preparation" : "View Capability"}</button>`}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderSessionDetailsPanel(details = {}) {
  const capabilities = details.linkedApps?.capabilities || {};
  return `
    <div class="session-details-panel">
      <section>
        <p class="eyebrow">Session Identity</p>
        <p>Game ${escapeHtml(details.identity?.gameId || "unknown")} - Session ${escapeHtml(details.identity?.sessionId || "unknown")} - Revision ${escapeHtml(details.identity?.revision || 0)}</p>
        <p>Source ${escapeHtml(details.identity?.sourceApp || "boardstate")} - Updated ${formatTimestamp(details.identity?.updatedAt || 0)}</p>
      </section>
      <section>
        <p class="eyebrow">Players</p>
        ${(details.players || []).map((player) => `<p>${escapeHtml(player.displayName || player.playerId)} - ${escapeHtml(player.controllerType || "human")} - ${escapeHtml(player.activeInterface || "unknown")} - Life ${escapeHtml(player.life ?? "")}</p>`).join("") || "<p>Runtime player data will be inferred when the session is opened.</p>"}
      </section>
      <section>
        <p class="eyebrow">Rules</p>
        <p>Rules ${escapeHtml(details.rules?.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION)} - ${escapeHtml(details.rules?.enforcementMode || "enforced")} - Schema ${escapeHtml(details.rules?.schemaVersion || SHARED_CONTRACT_SCHEMA_VERSION)}</p>
        <p>${escapeHtml((details.rules?.activeWaivers || []).length)} active waiver(s)</p>
      </section>
      <section>
        <p class="eyebrow">Linked Apps / Capabilities</p>
        <p>BoardState Lite: ${escapeHtml(details.linkedApps?.boardStateLite || "Waiting for Lite Update")} - Deck Nexus: ${escapeHtml(details.linkedApps?.deckNexus || "Not Linked")} - Hub: ${escapeHtml(details.linkedApps?.hub || "Not Linked")}</p>
        <p>Export ${capabilities.supportsHandoffExport ? "supported" : "unavailable"} - Import ${capabilities.supportsHandoffImport ? "supported" : "unavailable"} - Mirrored Advanced ${capabilities.supportsMirroredAdvancedView ? "supported" : "not installed"}</p>
      </section>
      <section>
        <p class="eyebrow">Compatibility</p>
        <p>${escapeHtml(details.compatibility?.status || "valid")}</p>
        ${(details.compatibility?.warnings || []).map((warning) => `<p>${escapeHtml(warning)}</p>`).join("")}
      </section>
    </div>
  `;
}

function renderLinkedSessionCard(record = {}) {
  const session = record.session || {};
  const players = session.players || [];
  const activePlayer = players.find((player) => player.playerId === session.turnState?.activePlayerId);
  return `
    <section class="local-save-card linked-session-card">
      <div>
        <strong>${escapeHtml(record.sessionName || "Linked Session")}</strong>
        <small>${escapeHtml(record.sourceApp || "unknown")} - ${escapeHtml(record.gameId || "")}/${escapeHtml(record.sessionId || "")}</small>
        <small>Turn ${escapeHtml(session.turnState?.turnNumber || 1)} - ${escapeHtml(session.turnState?.currentPhase || "beginning")} - Revision ${escapeHtml(record.revision || session.revision || 0)}</small>
        <small>Active ${escapeHtml(activePlayer?.displayName || session.turnState?.activePlayerId || "unknown")} - ${escapeHtml(record.compatibility || "valid")}</small>
        ${(record.warnings || []).slice(0, 3).map((warning) => `<small>Warning: ${escapeHtml(warning)}</small>`).join("")}
      </div>
      <div class="button-grid mini">
        <button data-linked-session-continue="${escapeAttribute(record.sessionId)}">Continue in Advanced Mode</button>
        <button data-linked-session-export="${escapeAttribute(record.sessionId)}">Export Session</button>
        <button data-linked-session-duplicate="${escapeAttribute(record.sessionId)}">Duplicate as New Advanced Game</button>
        <button class="danger-soft" data-linked-session-remove="${escapeAttribute(record.sessionId)}">Remove Linked Session</button>
      </div>
    </section>
  `;
}

function formatTimestamp(value = 0) {
  return value ? new Date(value).toLocaleString() : "Unknown";
}

function renderLegacyMigrationSubpage(profile) {
  const legacy = getLegacyInventory(profile);
  return `
    <div class="options-subpage legacy-migration-page">
      <article class="option-card">
        <h3>Legacy & Migration</h3>
        <p>Legacy systems are preserved and hidden from the primary workflow until Deck Nexus, BoardState Lite, and the Hub migration paths are ready. No destructive migration runs here.</p>
        <div class="button-grid">
          <button data-export>Backup Before Migration</button>
          <button data-option-category="data">Legacy Data Tools</button>
        </div>
      </article>
      ${legacy.map((entry) => `
        <article class="option-card legacy-migration-card">
          <div>
            <p class="eyebrow">${escapeHtml(entry.destination)}</p>
            <h3>${escapeHtml(entry.label)}</h3>
            <p>${escapeHtml(entry.count)} item(s) - ${escapeHtml(entry.status)}</p>
          </div>
          <div class="button-grid mini">
            ${entry.page ? `<button data-home-legacy-page="${escapeAttribute(entry.page)}">View Legacy Data</button>` : ""}
            ${entry.optionsCategory ? `<button data-option-category="${escapeAttribute(entry.optionsCategory)}">Open Legacy Options</button>` : ""}
            <button disabled>No Delete Until Migrated</button>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderRecentSimulationsPanel(profile) {
  const entries = getRecentSimulationEntries(profile);
  return `
    <article class="option-card recent-simulations-panel">
      <div class="overlay-header compact">
        <div><h3>Recent Simulations</h3><small>${entries.length} simulation record(s)</small></div>
      </div>
      <div class="local-save-list">
        ${entries.map((entry) => `
          <section class="local-save-card">
            <div>
              <strong>${escapeHtml(entry.saveName || "Dry Run")}</strong>
              <small>Status ${escapeHtml(entry.status)} - Turn ${escapeHtml(entry.turn || 0)} - ${escapeHtml(entry.compatibility)}</small>
              <small>Rules ${escapeHtml(entry.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION)}</small>
            </div>
            <div class="button-grid mini">
              ${entry.saveId ? `<button data-home-load-save="${escapeAttribute(entry.saveId)}">Resume</button><button data-local-save-duplicate="${escapeAttribute(entry.saveId)}">Duplicate</button><button data-local-save-rename="${escapeAttribute(entry.saveId)}" data-local-save-name="${escapeAttribute(entry.saveName || "")}">Rename</button><button data-local-save-export="${escapeAttribute(entry.saveId)}">Export</button><button class="danger-soft" data-local-save-delete="${escapeAttribute(entry.saveId)}">Delete</button>` : `<button disabled>Summary Only</button>`}
            </div>
          </section>
        `).join("") || "<p>No recent simulations. Start a Dry Run to create one.</p>"}
      </div>
    </article>
  `;
}

function renderProfileOptionsSubpage(profile) {
  const localAuth = profile.localAuth || {};
  return `
    <div class="options-subpage">
      <article class="option-card">
        <h3>Profile & Saves</h3>
        <p>Status: ${localAuth.mode === "protected" ? "Password profile loaded" : "Guest / fresh mode"}${localAuth.hasPassword ? " - Password profile available" : ""}</p>
        <div class="button-grid">
          <button data-open-profile-page>Open Profile Page</button>
          <button data-guest-mode>Continue as Guest/Fresh</button>
          <button data-start-guided-tutorial>Start Guided Tutorial</button>
          ${profile.activeSession?.tutorial?.paused || profile.onboarding?.tutorialPaused ? `<button data-tutorial-resume>Resume Tutorial</button>` : ""}
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
        <div class="button-grid">
          <button data-export>Export Profile</button>
          <label class="file-pill">Import Profile<input type="file" accept="application/json" data-import /></label>
        </div>
        <p>Local device protection only. No cloud authentication, and plaintext passwords are never stored.</p>
      </article>
      ${renderLocalSavesPanel(profile)}
    </div>
  `;
}

function renderGameplayOptionsSubpage(profile, page = "life") {
  const settings = getSettings(profile);
  const multiplayer = getMultiplayerSettings(profile);
  const simulation = profile.activeSession?.simulation || {};
  const gameTracking = profile.activeSession?.gameTracking || {};
  const showEndGame = page === "battlefield" && (Boolean(simulation.enabled) || Boolean(gameTracking.active));
  return `
    <div class="options-subpage">
      ${showEndGame ? `
        <article class="option-card">
          <h3>Active Game</h3>
          <p>Simulation: ${simulation.enabled ? "Active" : "Inactive"} - Tracking: ${gameTracking.active ? "Active" : "Inactive"}</p>
          <button class="wide" data-end-game>End Game</button>
        </article>
      ` : ""}
      <article class="option-card">
        <h3>Gameplay & Multiplayer</h3>
        <div class="button-grid">
          <button data-multiplayer-mode="local">Local Multiplayer</button>
          <button data-multiplayer-mode="wifi">Connect via WiFi</button>
          <button data-multiplayer-mode="bluetooth">Bluetooth Placeholder</button>
          <button data-multiplayer-mode="simulated">Simulated Local</button>
          <button data-multiplayer-mode="offline">Disconnect</button>
          <button data-open-synced-turn-order-setup>d20 Turn Order</button>
          <button data-open-simulation-setup>Dry Run Setup</button>
          <button data-open-simulation-stats>Simulation Stats</button>
          <button data-option-category="friends">Friends / Invites</button>
        </div>
        <p>Mode: ${escapeHtml(multiplayer.mode)}</p>
        <p>Connected players: ${multiplayer.connectedPlayers.length ? multiplayer.connectedPlayers.map((player) => escapeHtml(player.name)).join(", ") : "None"}</p>
        <p>Confirmed turn order: ${multiplayer.confirmedTurnOrder?.length ? multiplayer.confirmedTurnOrder.map((id) => escapeHtml(id === "local-player" ? `${profile.player?.name || "Player"} (You)` : id)).join(" -> ") : "Not confirmed"}</p>
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
        ${renderToggle("Strict Turn Phase Enforcement", "strictPhaseEnforcement", Boolean(settings.strictPhaseEnforcement))}
        ${renderToggle("Manual Stack Confirmation", "manualStackConfirmation", Boolean(settings.manualStackConfirmation))}
      </article>
    </div>
  `;
}

function renderFriendsOptionsSubpage(profile) {
  const friendState = profile.friends || {};
  const friends = friendState.friends || [];
  const favorites = new Set(friendState.favoriteFriendIds || []);
  const nearby = friendState.nearbyPlayers || [];
  const pending = friendState.pendingFriendRequests || [];
  const blocked = friendState.blockedFriendCodes || [];
  const invites = friendState.invites || [];
  const code = friendState.myFriendCode || "";
  return `
    <div class="options-subpage friends-subpage">
      <article class="option-card friend-code-card">
        <div class="overlay-header compact">
          <div>
            <p class="eyebrow">My Friend Code</p>
            <h3 class="friend-code-display">${escapeHtml(code || "Generating")}</h3>
            <small>4-6 characters, uppercase, locally stored, and safe to copy/share.</small>
          </div>
          <span class="option-status-badge">${escapeHtml(friendState.discovery?.status || "local-only")}</span>
        </div>
        <div class="button-grid">
          <button data-copy-friend-code="${escapeAttribute(code)}">Copy Friend Code</button>
          <button data-share-friend-code="${escapeAttribute(code)}">Share Friend Code</button>
          <button data-regenerate-friend-code>Regenerate Code</button>
          <button data-refresh-nearby>Refresh Nearby</button>
        </div>
        <form class="stacked-form" data-friend-display-form>
          <label>Friend nickname / profile name<input name="displayName" value="${escapeAttribute(friendState.friendDisplayName || profile.player?.name || "Player")}" /></label>
          <button>Save Friend Profile</button>
        </form>
        ${friendState.lastError ? `<p class="recovery-toast warning">${escapeHtml(friendState.lastError)}</p>` : ""}
      </article>
      <article class="option-card">
        <h3>Add Friend by Code</h3>
        <form class="stacked-form" data-add-friend-form>
          <label>Friend Code<input name="friendCode" maxlength="6" placeholder="MAGE4" autocomplete="off" /></label>
          <label>Display name / nickname<input name="displayName" placeholder="Friend name" autocomplete="off" /></label>
          <button class="wide">Add Friend</button>
        </form>
        <p>Codes are not case-sensitive. Blocked codes cannot be added until unblocked.</p>
      </article>
      <article class="option-card">
        <h3>Nearby Players / Friends</h3>
        <p>${escapeHtml(friendState.discovery?.message || "Refresh nearby to search supported local discovery channels.")}</p>
        <div class="friend-list">
          ${nearby.length ? nearby.map((player) => renderNearbyPlayerCard(player, friends)).join("") : `<p>No nearby players found. Use friend code, invite link, room ID, or WiFi relay fallback.</p>`}
        </div>
      </article>
      <article class="option-card">
        <h3>Pending Requests</h3>
        <div class="friend-list">
          ${pending.length ? pending.map(renderFriendRequestCard).join("") : `<p>No pending friend requests.</p>`}
        </div>
      </article>
      <article class="option-card friends-list-card">
        <h3>Friends List</h3>
        <div class="friend-list">
          ${friends.length ? friends.map((friend) => renderFriendProfileCard(friend, favorites.has(friend.friendId), profile)).join("") : `<p>No friends saved yet. Add by code or discover nearby players.</p>`}
        </div>
      </article>
      <article class="option-card">
        <h3>Favorites</h3>
        <div class="friend-list compact">
          ${friends.filter((friend) => favorites.has(friend.friendId) || friend.favorite).map((friend) => `<span>${escapeHtml(friend.nickname || friend.displayName)} - ${escapeHtml(friend.friendCode)}</span>`).join("") || `<p>No favorite friends yet.</p>`}
        </div>
      </article>
      <article class="option-card">
        <h3>Blocked Users</h3>
        <div class="friend-list compact">
          ${blocked.length ? blocked.map((entry) => `<span>${escapeHtml(entry)} <button data-friend-unblock="${escapeAttribute(entry)}">Unblock</button></span>`).join("") : `<p>No blocked friend codes.</p>`}
        </div>
      </article>
      <article class="option-card">
        <h3>Friend Invites</h3>
        <p>Friend discovery/invite messages stay separate from gameplay and tournament updates. Accepting an invite can join the existing game or tournament flow.</p>
        <div class="friend-list">
          ${invites.length ? invites.map(renderFriendInviteCard).join("") : `<p>No outgoing friend invites yet.</p>`}
        </div>
      </article>
    </div>
  `;
}

function renderNearbyPlayerCard(player = {}, friends = []) {
  const isFriend = friends.some((friend) => friend.friendCode === player.friendCode);
  return `
    <section class="friend-profile-card nearby">
      <div>
        <strong>${escapeHtml(player.displayName || "Nearby Player")}</strong>
        <small>${escapeHtml(player.friendCode || "No shared code")} - ${escapeHtml(isFriend ? "Nearby Friend" : player.status || "Nearby")}</small>
      </div>
      <div class="button-grid mini">
        ${!isFriend && player.friendCode ? `<button data-add-nearby-friend="${escapeAttribute(player.friendCode)}" data-nearby-name="${escapeAttribute(player.displayName || "")}">Add Friend</button>` : ""}
        ${player.gameSessionId ? `<button data-friend-join-game="${escapeAttribute(player.gameSessionId)}">Join Game</button>` : ""}
        ${player.tournamentSessionId ? `<button data-friend-join-tournament="${escapeAttribute(player.tournamentSessionId)}">Join Tournament</button>` : ""}
        <button data-hide-nearby="${escapeAttribute(player.temporaryDiscoveryId || player.friendCode || "")}">Hide</button>
      </div>
    </section>
  `;
}

function renderFriendRequestCard(request = {}) {
  return `
    <section class="friend-profile-card">
      <div>
        <strong>${escapeHtml(request.displayName || "Friend Request")}</strong>
        <small>${escapeHtml(request.friendCode)} - ${escapeHtml(request.source || "nearby")}</small>
      </div>
      <div class="button-grid mini">
        <button data-friend-request-accept="${escapeAttribute(request.requestId)}">Accept</button>
        <button data-friend-request-decline="${escapeAttribute(request.requestId)}">Decline</button>
      </div>
    </section>
  `;
}

function renderFriendProfileCard(friend = {}, favorite = false, profile = {}) {
  const display = friend.nickname || friend.displayName || "Friend";
  return `
    <section class="friend-profile-card">
      <div>
        <strong>${escapeHtml(display)}${favorite ? " (Favorite)" : ""}</strong>
        <small>${escapeHtml(friend.friendCode)} - ${escapeHtml(friend.status || "Unknown")} - ${escapeHtml(friend.source || "code")}</small>
        ${friend.notes ? `<p>${escapeHtml(friend.notes)}</p>` : ""}
        ${friend.lastKnownGameSessionId ? `<small>Game: ${escapeHtml(friend.lastKnownGameSessionId)}</small>` : ""}
        ${friend.lastKnownTournamentSessionId ? `<small>Tournament: ${escapeHtml(friend.lastKnownTournamentSessionId)}</small>` : ""}
      </div>
      <div class="button-grid mini">
        <button data-friend-favorite="${escapeAttribute(friend.friendId)}">${favorite ? "Unfavorite" : "Favorite"}</button>
        <button data-friend-invite-game="${escapeAttribute(friend.friendId)}">Invite to Game</button>
        ${friend.lastKnownGameSessionId ? `<button data-friend-join-game="${escapeAttribute(friend.lastKnownGameSessionId)}">Join Game</button>` : ""}
        <button data-friend-invite-tournament="${escapeAttribute(friend.friendId)}" ${profile.tournament?.status && profile.tournament.status !== "idle" ? "" : "disabled"}>Invite to Tournament</button>
        ${friend.lastKnownTournamentSessionId ? `<button data-friend-join-tournament="${escapeAttribute(friend.lastKnownTournamentSessionId)}">Join Tournament</button>` : ""}
        <button data-friend-remove="${escapeAttribute(friend.friendId)}">Remove</button>
        <button data-friend-block="${escapeAttribute(friend.friendId)}" data-friend-code="${escapeAttribute(friend.friendCode)}">Block</button>
      </div>
    </section>
  `;
}

function renderFriendInviteCard(invite = {}) {
  const link = buildFriendInviteLink(invite);
  return `
    <section class="friend-profile-card invite">
      <div>
        <strong>${escapeHtml(invite.inviteType === "tournament" ? "Tournament Invite" : "Game Invite")} to ${escapeHtml(invite.friendName || invite.friendCode)}</strong>
        <small>${escapeHtml(invite.namespace || "friend")} - ${escapeHtml(invite.sessionId || "local")}</small>
        ${link ? `<input readonly value="${escapeAttribute(link)}" aria-label="Friend invite link" />` : ""}
      </div>
    </section>
  `;
}

function renderTournamentOptionsSubpage(profile) {
  const tournament = profile.tournament || {};
  const friends = profile.friends?.friends || [];
  return `
    <div class="options-subpage">
      <article class="option-card tournament-card">
        <h3>Tournament Shortcuts</h3>
        <p>Status: ${escapeHtml(getTournamentStatusLabel(tournament))} - Sync: ${escapeHtml(tournament.sync?.mode || "local")} / ${escapeHtml(tournament.sync?.status || tournament.syncStatus || "local-only")}</p>
        ${renderTournamentInviteControls(tournament)}
        <div class="button-grid">
          <button data-open-tournament-page>Open Full Tournament Bracket</button>
          <button data-option-category="friends">Invite Friends</button>
          <button data-tournament-pin="${tournament.pinned ? "false" : "true"}">${tournament.pinned ? "Unpin Tournament Panel" : "Pin Tournament Panel"}</button>
        </div>
      </article>
      ${friends.length ? `<article class="option-card"><h3>Friend Tournament Invites</h3><div class="friend-list">${friends.map((friend) => `<button data-friend-invite-tournament="${escapeAttribute(friend.friendId)}" ${tournament.status && tournament.status !== "idle" ? "" : "disabled"}>${escapeHtml(friend.nickname || friend.displayName)} - Invite</button>`).join("")}</div></article>` : ""}
      ${renderTournamentPanel(profile)}
    </div>
  `;
}

function renderNotificationOptionsSubpage(profile) {
  const preferences = getNotificationPreferences(profile);
  const unread = getUnreadNotificationCount(profile);
  return `
    <div class="options-subpage">
      <article class="option-card">
        <h3>Notification Options ${unread ? `<span class="option-status-badge">${unread} unread</span>` : ""}</h3>
        <p>Choose how BoardState alerts you. Important tournament alerts default on; browser sound may require user interaction first.</p>
        <div class="button-grid">
          <button data-test-notification>Test Notification</button>
          <button data-test-sound>Test Sound</button>
          <button data-test-haptic>Test Haptic</button>
          <button data-reset-notification-preferences>Reset Notification Preferences</button>
        </div>
        <div class="options-setting-group">
          <h4>Delivery</h4>
          ${renderToggle("Master Notifications", "notifications.master", Boolean(preferences.master))}
          ${renderToggle("Full-window Popups", "notifications.fullWindow", Boolean(preferences.fullWindow))}
          ${renderToggle("Toast Notifications", "notifications.toast", Boolean(preferences.toast))}
          ${renderToggle("Sound Notifications", "notifications.sound", Boolean(preferences.sound))}
          ${renderToggle("Haptics / Vibration", "notifications.haptics", Boolean(preferences.haptics))}
        </div>
        <div class="options-setting-group">
          <h4>Categories</h4>
          ${renderToggle("Tournament Notifications", "notifications.tournament", Boolean(preferences.tournament))}
          ${renderToggle("Gameplay Notifications", "notifications.gameplay", Boolean(preferences.gameplay))}
          ${renderToggle("Dry Run Notifications", "notifications.dryRun", Boolean(preferences.dryRun))}
          ${renderToggle("Manual Choice Required Notifications", "notifications.manualChoice", Boolean(preferences.manualChoice))}
          ${renderToggle("Sync Notifications", "notifications.sync", Boolean(preferences.sync))}
          ${renderToggle("Friend Notifications", "notifications.friends", Boolean(preferences.friends))}
          ${renderToggle("Reminder Notifications", "notifications.reminders", Boolean(preferences.reminders))}
        </div>
        <div class="options-setting-group">
          <h4>Friend Events</h4>
          ${renderFriendNotificationToggles(preferences)}
        </div>
        <div class="options-setting-group">
          <h4>Tournament Events</h4>
          ${renderTournamentNotificationToggles(preferences)}
        </div>
        <div class="options-setting-group">
          <h4>Gameplay Events</h4>
          ${renderGameplayNotificationToggles(preferences)}
        </div>
      </article>
    </div>
  `;
}

function renderTournamentNotificationToggles(preferences) {
  const labels = {
    inviteOpened: "Tournament invite opened",
    playerJoined: "Player joined",
    playerLeft: "Player left",
    tournamentStarted: "Tournament started",
    roundGenerated: "New round posted",
    roundLocked: "Round locked",
    tableAssignmentChanged: "Table/pod assignment alerts",
    oneVOneComplete: "1v1 complete / time expiration",
    suddenDeath: "Sudden Death alerts",
    suddenDeathExtension: "Sudden Death extension alerts",
    podResult: "Pod result submitted",
    standingsUpdated: "Standings updated",
    resultCorrected: "Result corrected",
    tournamentEnded: "Tournament ended",
    finalWinners: "Final winner alerts",
    syncReconnect: "Tournament sync/reconnect alerts",
  };
  return Object.entries(labels)
    .map(([key, label]) => renderToggle(label, `notifications.tournamentEvents.${key}`, preferences.tournamentEvents?.[key] !== false))
    .join("");
}

function renderGameplayNotificationToggles(preferences) {
  const labels = {
    stackPriority: "Stack priority alerts",
    manualChoice: "Manual Choice Required alerts",
    landfall: "Landfall trigger alerts",
    combatBlockers: "Combat blocker alerts",
    commanderDamage: "Commander damage alerts",
    rulesConfidence: "Rule confidence alerts",
    errorRecovery: "Error/recovery alerts",
  };
  return Object.entries(labels)
    .map(([key, label]) => renderToggle(label, `notifications.gameplayEvents.${key}`, preferences.gameplayEvents?.[key] !== false))
    .join("");
}

function renderFriendNotificationToggles(preferences) {
  const labels = {
    friendRequest: "Friend request alerts",
    friendAccepted: "Friend accepted alerts",
    nearbyFriend: "Nearby friend alerts",
    gameInvite: "Game invite alerts",
    tournamentInvite: "Tournament invite alerts",
    friendJoined: "Friend joined alerts",
    friendSound: "Friend sound alerts",
    friendHaptics: "Friend haptics alerts",
    syncUnavailable: "Friend sync unavailable alerts",
    friendBlocked: "Friend block/remove confirmations",
  };
  return Object.entries(labels)
    .map(([key, label]) => renderToggle(label, `notifications.friendEvents.${key}`, preferences.friendEvents?.[key] !== false))
    .join("");
}

function renderHudOptionsSubpage(profile) {
  const panels = getPagePanels(profile);
  const compositionMode = profile.settings?.appearance?.compositionMode || "auto";
  const resolvedCompositionMode = resolveCompositionMode(profile);
  const compositionLabel =
    compositionMode === "auto"
      ? `Auto detect (${resolvedCompositionMode === "mobile" ? "Mobile view" : "Widescreen view"})`
      : resolvedCompositionMode === "mobile"
        ? "Mobile view"
        : "Widescreen view";
  return `
    <div class="options-subpage">
      <article class="option-card">
        <h3>HUD & Layout</h3>
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
        <p>Floating mana lives in the Battlefield tools menu as a floating widget with pin/unpin support.</p>
        ${renderToggle("Opponent board panel", "pagePanels.boardOpponent", panels.boardOpponent)}
        ${renderToggle("Combat controls", "pagePanels.boardCombat", panels.boardCombat)}
        ${renderToggle("Board quick tools", "pagePanels.boardTools", panels.boardTools)}
        ${renderToggle("Advanced rules helpers", "pagePanels.advancedRulesHelpers", panels.advancedRulesHelpers)}
        ${renderToggle("Archive / quick add helpers", "pagePanels.archiveQuickAdd", panels.archiveQuickAdd)}
        ${renderToggle("Stats / timer widgets", "pagePanels.statsTimerWidgets", panels.statsTimerWidgets)}
      </article>
    </div>
  `;
}

function renderAccessibilityOptionsSubpage(profile) {
  const settings = getSettings(profile);
  return `
    <div class="options-subpage">
      <article class="option-card">
        <h3>Accessibility / ADHD Assist</h3>
        <p>ADHD Mode is a companion assistance layer for reminders and clarity, not official judging or full rules enforcement.</p>
        ${renderToggle("Helper Sprite", "helperSprite.enabled", Boolean(profile.settings?.helperSprite?.enabled))}
        ${renderToggle("Screen-reader prompts", "helperSprite.screenReaderPrompts", Boolean(profile.settings?.helperSprite?.screenReaderPrompts))}
        ${renderToggle("Tutorial narration sound", "helperSprite.tutorialNarration", Boolean(profile.settings?.helperSprite?.tutorialNarration))}
        <button class="wide" data-helper-remind>Remind me</button>
        <div class="button-grid">
          <button data-start-guided-tutorial>Start Guided Tutorial</button>
          ${profile.activeSession?.tutorial?.active || profile.activeSession?.tutorial?.paused ? `<button data-tutorial-resume>Resume Tutorial</button>` : ""}
          <button data-tutorial-restart>Restart Tutorial</button>
          <button data-reset-onboarding>Reset Tutorial Progress</button>
        </div>
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
    </div>
  `;
}

function renderDiagnosticsOptionsSubpage(profile) {
  return `
    <div class="options-subpage">
      <article class="option-card">
        <h3>Diagnostics & Support</h3>
        <p>Diagnostics should never include passwords or private tokens.</p>
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
    </div>
  `;
}

function renderDataManagementOptionsSubpage() {
  return `
    <div class="options-subpage">
      <article class="option-card">
        <h3>Data Management</h3>
        <p>Destructive actions ask before changing local data. Export first if you need a backup.</p>
        <div class="button-grid">
          <button data-export>Export Profile</button>
          <label class="file-pill">Import Profile<input type="file" accept="application/json" data-import /></label>
          <button data-tutorial-save-current>Save Current Game</button>
          <label class="file-pill">Import Save<input type="file" accept="application/json" data-local-save-import /></label>
          <button data-clear-game-history>Clear Game History</button>
          <button data-clear-simulation-learning>Clear Simulation Learning</button>
          <button data-reset-settings>Reset Settings</button>
          <button class="danger-soft" data-reset-all-local-data>Reset All Local Data</button>
        </div>
      </article>
    </div>
  `;
}

function renderAboutOptionsSubpage() {
  return `
    <div class="options-subpage">
      <article class="option-card">
        <h3>About BoardState</h3>
        <p>BoardState is a local-first MTG companion for life tracking, battlefield testing, Dry Run simulation, tournament tracking, manual-choice reminders, and debug-friendly game history.</p>
        <p>Version: ${escapeHtml(getAppVersion())}</p>
        <p>Zones are tracked invisibly where possible. Logs and bug reports are designed for troubleshooting and should not include local passwords or private tokens.</p>
        <div class="button-grid">
          <button data-start-guided-tutorial>MTG Beginner Tutorial</button>
          <button data-reset-onboarding>Restart First-Time Experience</button>
        </div>
        <p>Tutorial progress: ${profile.onboarding?.tutorialCompleted ? "completed" : profile.onboarding?.tutorialStarted ? `turn ${escapeHtml(profile.onboarding?.tutorialCurrentTurn || 1)}, step ${escapeHtml((profile.onboarding?.tutorialCurrentStep || 0) + 1)}` : "not started"}.</p>
        ${renderImportantNotes()}
      </article>
    </div>
  `;
}

function getTournamentStatusLabel(tournament = {}) {
  if (!tournament.active && !tournament.status) return "Not Joined";
  if (tournament.status === "complete") return "Complete";
  if (tournament.role === "host") return tournament.status === "active" ? "Hosting Active" : "Hosting";
  if (tournament.role === "player") return tournament.status === "active" ? "Joined Active" : "Joined";
  return tournament.status || "Local";
}

function getFriendStatusLabel(profile = {}) {
  const friends = profile.friends || {};
  const friendCount = (friends.friends || []).length;
  const nearbyCount = (friends.nearbyPlayers || []).length;
  const pendingCount = (friends.pendingFriendRequests || []).length;
  if (pendingCount) return "Invite pending";
  if (nearbyCount) return `${nearbyCount} nearby`;
  if (friendCount) return `${friendCount} friends`;
  return "No friends";
}

function getNotificationPreferences(profile = {}) {
  const defaults = {
    master: true,
    fullWindow: true,
    toast: true,
    sound: false,
    haptics: false,
    tournament: true,
    gameplay: true,
    dryRun: true,
    manualChoice: true,
    sync: true,
    friends: true,
    reminders: true,
    tournamentEvents: {},
    gameplayEvents: {},
    friendEvents: {},
  };
  const current = profile.settings?.notifications || {};
  return {
    ...defaults,
    ...current,
    tournamentEvents: { ...(defaults.tournamentEvents || {}), ...(current.tournamentEvents || {}) },
    gameplayEvents: { ...(defaults.gameplayEvents || {}), ...(current.gameplayEvents || {}) },
    friendEvents: { ...(defaults.friendEvents || {}), ...(current.friendEvents || {}) },
  };
}

function getNotificationStatus(profile = {}) {
  const preferences = getNotificationPreferences(profile);
  if (!preferences.master) return "Muted";
  if (!preferences.fullWindow && !preferences.toast) return "Sound/Haptic";
  if (!preferences.sound && !preferences.haptics) return "On";
  return "Enhanced";
}

function getUnreadNotificationCount(profile = {}) {
  const dismissed = new Set(profile.notifications?.dismissedIds || []);
  return (profile.notifications?.items || []).filter((entry) => !entry.acknowledged && !dismissed.has(entry.id)).length;
}

function getAppVersion() {
  return "1.19.0";
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
            ${renderToggle("Strict Turn Phase Enforcement", "strictPhaseEnforcement", Boolean(settings.strictPhaseEnforcement))}
            ${renderToggle("Manual Stack Confirmation", "manualStackConfirmation", Boolean(settings.manualStackConfirmation))}
          </article>
          ${renderTournamentPanel(profile)}
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

function renderTournamentInviteModal(profile, invite = {}) {
  const tournament = profile.tournament || {};
  const code = invite.joinCode || "";
  const knownTournament =
    String(tournament.joinCode || tournament.sync?.sessionId || "").toUpperCase() === String(code || "").toUpperCase()
      ? tournament
      : null;
  return `
    <section class="overlay-backdrop" data-no-swipe>
      <div class="floating-overlay glass tournament-invite-modal">
        <div class="overlay-header">
          <div>
            <p class="eyebrow">Tournament Invite</p>
            <h2>Join Tournament</h2>
            <p>${knownTournament?.name ? escapeHtml(knownTournament.name) : "Enter your player name to join this BoardState tournament."}</p>
          </div>
          <button data-close-tournament-invite>Cancel</button>
        </div>
        <form class="stacked-form" data-tournament-invite-form>
          <label>Join code
            <input name="joinCode" readonly value="${escapeAttribute(code)}" />
          </label>
          <label>Player name
            <input name="playerName" required value="${escapeAttribute(profile.player?.name || "Player")}" />
          </label>
          <label>Sync mode
            <select name="syncMode">
              <option value="local">Local join</option>
              <option value="wifi" ${profile.settings?.multiplayer?.mode === "wifi" ? "selected" : ""}>WiFi relay</option>
            </select>
          </label>
          <label>WiFi Sync URL
            <input name="wsUrl" value="${escapeAttribute(profile.settings?.multiplayer?.wsUrl || "ws://localhost:8787")}" />
          </label>
          <button class="wide">Join Tournament</button>
          <small>Tournament sync uses the tournament namespace and stays separate from normal gameplay sync. If no live relay is reachable, BoardState keeps a local joined tournament state.</small>
        </form>
      </div>
    </section>
  `;
}

function getActiveFullWindowNotification(profile = {}) {
  const preferences = getNotificationPreferences(profile);
  const dismissed = new Set(profile.notifications?.dismissedIds || []);
  if (!preferences.master && !(profile.notifications?.items || []).some((entry) => entry.critical)) {
    return null;
  }
  if (!preferences.fullWindow && !(profile.notifications?.items || []).some((entry) => entry.critical)) {
    return null;
  }
  return [...(profile.notifications?.items || [])]
    .filter((entry) => !entry.acknowledged && !dismissed.has(entry.id))
    .filter((entry) => entry.fullWindow !== false)
    .filter((entry) => preferences.fullWindow || entry.critical)
    .filter((entry) => preferences.master || entry.critical)
    .sort((left, right) => Number(left.createdAt || 0) - Number(right.createdAt || 0))[0] || null;
}

function renderFullWindowNotification(notification) {
  return `
    <section class="overlay-backdrop" data-no-swipe>
      <div class="floating-overlay glass notification-window ${escapeAttribute(notification.severity || "info")}">
        <div class="notification-window__glyph">${escapeHtml(notification.severity === "warning" ? "!" : notification.severity === "success" ? "OK" : "INFO")}</div>
        <div class="overlay-header">
          <div>
            <p class="eyebrow">${escapeHtml(notification.category || "BoardState")} Alert</p>
            <h2>${escapeHtml(notification.title || "BoardState Notification")}</h2>
          </div>
        </div>
        <p>${escapeHtml(notification.body || "A BoardState event needs attention.")}</p>
        <div class="button-grid">
          ${notification.actionPage ? `<button data-notification-open-page="${escapeAttribute(notification.actionPage)}" data-notification-id="${escapeAttribute(notification.id)}">${escapeHtml(notification.actionLabel || "Open")}</button>` : ""}
          <button data-notification-ack="${escapeAttribute(notification.id)}">Dismiss / Acknowledge</button>
        </div>
      </div>
    </section>
  `;
}

function getNotificationToastEntries(profile = {}) {
  const preferences = getNotificationPreferences(profile);
  if (!preferences.master || !preferences.toast) {
    return [];
  }
  const dismissed = new Set(profile.notifications?.dismissedIds || []);
  return (profile.notifications?.items || [])
    .filter((entry) => entry.toast !== false && !entry.acknowledged && !dismissed.has(entry.id))
    .slice(0, 2);
}

function renderRecoveryToasts(profile, notice = null) {
  const entries = (profile.activeSession?.recoveryLog || []).filter((entry) => !entry.dismissed).slice(0, 3);
  const notificationToasts = getNotificationToastEntries(profile);
  if (!entries.length && !notice && !notificationToasts.length) {
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
      ${notificationToasts.map((entry) => `
        <article class="recovery-toast ${escapeAttribute(entry.severity || "info")} notification-toast">
          <strong>${escapeHtml(entry.title || "BoardState Notification")}</strong>
          <p>${escapeHtml(entry.body || "")}</p>
          <div class="recovery-actions mini">
            ${entry.actionPage ? `<button data-notification-open-page="${escapeAttribute(entry.actionPage)}" data-notification-id="${escapeAttribute(entry.id)}">${escapeHtml(entry.actionLabel || "Open")}</button>` : ""}
            <button data-notification-ack="${escapeAttribute(entry.id)}">Dismiss</button>
          </div>
        </article>
      `).join("")}
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
        <span class="confidence-pill success" data-confidence-icon="check">Auto-resolved</span>
        <span class="confidence-pill warning" data-confidence-icon="choice">Manual choice required</span>
        <span class="confidence-pill info" data-confidence-icon="partial">Partially supported</span>
        <span class="confidence-pill review" data-confidence-icon="review">Needs review</span>
        <span class="confidence-pill error" data-confidence-icon="failed">Failed / recovery needed</span>
        <span class="confidence-pill ignored" data-confidence-icon="ignored">Ignored this game</span>
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
          (permanent) => {
            const imageUrl = getBattlefieldCardImageUrl(permanent);
            return `
        <article class="log-card permanent-inspect-card">
          <div class="permanent-inspect-hero ${imageUrl ? "has-card-art" : getBattlefieldCardFallbackClass(permanent)}" ${imageUrl ? `style="--card-image:url(&quot;${escapeAttribute(imageUrl)}&quot;)"` : ""}>
            <span class="permanent-inspect-scanline" aria-hidden="true"></span>
            <div>
              <p class="eyebrow">${permanent.isCommander ? "Commander scan" : "Battlefield scan"}</p>
              <strong>${escapeHtml(permanent.name)}</strong>
              <span>${escapeHtml(permanent.typeLine)}</span>
              ${permanent.isCreature ? `<b>${escapeHtml(`${permanent.currentPower}/${permanent.currentToughness}`)}</b>` : ""}
            </div>
          </div>
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
      `;
          }
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
    <section class="helper-sprite-widget ${helperMessage.fading ? "is-fading" : ""} glass" data-no-swipe ${inlineStyle} ${draggableAttrs} role="status" aria-live="polite">
      <button class="helper-sprite-avatar" data-helper-dismiss title="Dismiss helper sprite">*</button>
      <button class="helper-sprite-bubble" data-helper-open aria-label="Open Helper Sprite prompt">
        <strong>Helper Sprite</strong>
        <span>${escapeHtml(helperMessage.text)}</span>
      </button>
      ${helperMessage.source === "guided-tutorial" ? `<div class="helper-sprite-actions"><button data-tutorial-repeat>Repeat</button><button data-tutorial-pause>Pause</button></div>` : ""}
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

export function getBoardStateHomeModel(profile = {}) {
  const saveGroups = getSaveGroups(profile);
  const recentSimulations = getRecentSimulationEntries(profile);
  const linkedGame = getLinkedSessionCandidate(profile);
  const canonicalSession = safelyCreateCanonicalSession(profile);
  return {
    rules: getRulesControlSummary(profile),
    versions: {
      schemaVersion: canonicalSession?.schemaVersion || profile.activeSession?.schemaVersion || SHARED_CONTRACT_SCHEMA_VERSION,
      rulesEngineVersion: canonicalSession?.rulesEngineVersion || profile.activeSession?.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
      saveFormatVersion: SHARED_SAVE_FORMAT_VERSION,
      syncProtocolVersion: canonicalSession?.syncProtocolVersion || profile.activeSession?.syncProtocolVersion || SHARED_SYNC_PROTOCOL_VERSION,
    },
    currentSession: {
      gameId: profile.activeSession?.gameId || profile.activeSession?.id || "",
      sessionId: profile.activeSession?.sessionId || profile.activeSession?.id || "",
      mode: profile.activeSession?.saveMetadata?.mode || profile.activeSession?.gameTracking?.mode || (profile.activeSession?.simulation?.enabled ? "dry-run" : "training-ground"),
      modeLabel: formatSessionMode(profile.activeSession),
      turn: profile.activeSession?.turn || 1,
      phase: PHASES[profile.activeSession?.phaseIndex || 0] || "Beginning",
    },
    interfaceStatus: {
      label: "Advanced Mode",
      localInterfaceMode: profile.activeSession?.localInterfaceMode || profile.activeSession?.interfaceMode || "boardstate-advanced",
      connected: Boolean(profile.activeSession?.linkedSession?.imported || profile.activeSession?.linkedSession?.activeSync),
      simpleModeMessage: "Simple Mode available after BoardState Lite integration.",
      returnMessage: "Return to Simple Mode unavailable until Lite integration is installed. Export handoff data instead.",
    },
    continueDryRun: getMostRecentDryRunSave(profile),
    linkedGame,
    saveGroups,
    saveCount: Object.values(saveGroups).reduce((sum, saves) => sum + saves.length, 0),
    recentSimulations,
    linkedApps: getLinkedAppStatusCards(profile),
    legacy: getLegacyInventory(profile),
    tutorial: {
      resume: Boolean(profile.activeSession?.tutorial?.active || profile.activeSession?.tutorial?.paused || profile.onboarding?.tutorialPaused),
      completed: Boolean(profile.onboarding?.tutorialCompleted),
      currentTurn: profile.onboarding?.tutorialCurrentTurn || profile.activeSession?.tutorial?.currentTurn || 0,
    },
  };
}

function safelyCreateCanonicalSession(profile = {}) {
  try {
    return boardStateProfileToSharedSession(profile);
  } catch {
    return null;
  }
}

export function getRulesControlSummary(profile = {}) {
  const mode = profile.activeSession?.enforcementMode || profile.settings?.rules?.enforcementMode || "enforced";
  const normalizedMode = mode === "waived" ? "waived" : "enforced";
  return {
    mode: normalizedMode,
    label: normalizedMode === "waived" ? "Rules Waived" : "Rules Enforced",
    activeWaiverCount: (profile.activeSession?.activeRuleWaivers || []).length,
    waiverHistoryCount: (profile.activeSession?.waiverHistory || []).length,
    rulesEngineVersion: profile.activeSession?.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
  };
}

export function getSaveGroups(profile = {}) {
  const groups = {
    advanced: [],
    dryRun: [],
    tutorial: [],
    imported: [],
    legacy: [],
    recovery: [],
  };
  const saves = [...(profile.localSaves?.items || [])].sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0));
  saves.forEach((save) => {
    const mode = String(save.gameMode || save.metadata?.mode || "").toLowerCase();
    const sourceApp = String(save.sourceApp || save.metadata?.sourceApp || "boardstate").toLowerCase();
    const migrationStatus = String(save.metadata?.migrationStatus || "").toLowerCase();
    if (/tutorial/.test(mode)) groups.tutorial.push(save);
    else if (/dry|simulation/.test(mode)) groups.dryRun.push(save);
    else if (sourceApp && sourceApp !== "boardstate") groups.imported.push(save);
    else if (/legacy/.test(mode) || migrationStatus === "legacy") groups.legacy.push(save);
    else if (/recovery/.test(mode)) groups.recovery.push(save);
    else groups.advanced.push(save);
  });
  return groups;
}

function getMostRecentDryRunSave(profile = {}) {
  return getSaveGroups(profile).dryRun[0] || null;
}

function getRecentSimulationEntries(profile = {}) {
  const saves = getSaveGroups(profile).dryRun.map((save) => ({
    id: save.saveId,
    saveId: save.saveId,
    saveName: save.saveName || "Dry Run Save",
    status: "saved",
    turn: save.metadata?.currentTurn || save.gameState?.turn || 1,
    updatedAt: save.updatedAt || 0,
    rulesEngineVersion: save.rulesEngineVersion || save.metadata?.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
    compatibility: save.saveFormatVersion && save.saveFormatVersion !== SHARED_SAVE_FORMAT_VERSION ? "incompatible" : "compatible",
  }));
  const history = (profile.simulationStats?.history || []).slice(0, 8).map((entry, index) => ({
    id: entry.id || `simulation-history-${index}`,
    saveName: entry.winnerName ? `Completed - ${entry.winnerName}` : "Completed Simulation",
    status: "completed",
    turn: entry.turnCount || 0,
    updatedAt: entry.completedAt || entry.createdAt || 0,
    rulesEngineVersion: profile.activeSession?.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
    compatibility: "summary-only",
    result: entry.winnerName || entry.winnerId || "Unknown",
  }));
  return [...saves, ...history].sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0)).slice(0, 12);
}

function getLinkedSessionCandidate(profile = {}) {
  const linkedRecord = getLinkedSessionRecords(profile)[0];
  if (linkedRecord?.sessionId) {
    return {
      saveId: "",
      sessionId: linkedRecord.sessionId,
      sourceApp: linkedRecord.sourceApp,
      status: linkedRecord.status || linkedRecord.compatibility || "imported",
      turn: linkedRecord.session?.turnState?.turnNumber || 1,
      phase: linkedRecord.session?.turnState?.currentPhase || "beginning",
      revision: linkedRecord.revision || linkedRecord.session?.revision || 0,
      compatibility: linkedRecord.compatibility || "valid",
    };
  }
  const current = profile.activeSession || {};
  if (current.linkedSession?.imported || current.linkedSession?.activeSync || (current.linkedSession?.sourceApp && current.linkedSession.sourceApp !== "boardstate")) {
    return {
      saveId: "",
      sessionId: current.sessionId || current.id || "",
      sourceApp: current.linkedSession.sourceApp,
      status: current.linkedSession.status || "local",
      turn: current.turn || 1,
      phase: PHASES[current.phaseIndex || 0] || "Beginning",
    };
  }
  return (profile.localSaves?.items || [])
    .filter((save) => {
      const sourceApp = String(save.sourceApp || save.metadata?.sourceApp || "").toLowerCase();
      return sourceApp && sourceApp !== "boardstate";
    })
    .sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0))
    .map((save) => ({
      saveId: save.saveId,
      saveName: save.saveName,
      sessionId: save.sourceSession || save.gameState?.activeSession?.sessionId || save.gameState?.activeSession?.id || "",
      sourceApp: save.sourceApp || save.metadata?.sourceApp || "external",
      status: save.metadata?.migrationStatus || "imported",
      turn: save.metadata?.currentTurn || save.gameState?.turn || 1,
      phase: PHASES[save.metadata?.phaseIndex || save.gameState?.phaseIndex || 0] || "Beginning",
    }))[0] || null;
}

export function getLinkedAppStatusCards(profile = {}) {
  const appLinks = profile.settings?.linkedApps || {};
  const current = profile.activeSession?.linkedSession || {};
  const linkedRecords = getLinkedSessionRecords(profile);
  const liteImported = linkedRecords.some((entry) => entry.sourceApp === "boardstate-lite");
  const liteLinked = (current.sourceApp === "boardstate-lite" && current.imported) || appLinks.boardstateLite?.linked;
  const nexusLinked = appLinks.deckNexus?.linked;
  return [
    {
      appId: "boardstate-lite",
      title: "BoardState Lite",
      status: liteLinked ? "Linked Session Active" : liteImported ? "Linked Session Imported" : "Export Supported",
      detail: liteLinked
        ? `Last source: ${current.status || "local snapshot"}`
        : liteImported
          ? "A Lite-shaped canonical session is stored locally and can continue in Advanced Mode."
          : "Waiting for Lite update. Import/export handoff bundles are supported; live Lite linking is not installed.",
      capabilities: liteLinked || liteImported ? ["continue-linked-game", "export-shared-session", "view-session-details"] : ["import-linked-session", "export-shared-session", "waiting-for-lite-update"],
    },
    {
      appId: "deck-nexus",
      title: "Deck Nexus",
      status: nexusLinked ? "Linked" : "Not Linked",
      detail: nexusLinked ? "Deck snapshot capability detected." : "Deck Nexus linking comes after app preparation.",
      capabilities: nexusLinked ? ["deck-snapshot-import"] : ["manual-import"],
    },
    {
      appId: "boardstate-hub",
      title: "Future Hub",
      status: "Not Linked",
      detail: "Hub ownership of global profile, friends, tournaments, and backups is planned later.",
      capabilities: ["future-app-link"],
    },
  ];
}

export function getLegacyInventory(profile = {}) {
  const friendCount = (profile.friends?.friends || []).length;
  const notificationCount = (profile.notifications?.items || []).length;
  const tournamentCount = profile.tournament?.active || profile.tournament?.status !== "idle" ? 1 : 0;
  return [
    { id: "legacy-decks", label: "Legacy Decks", count: Object.keys(profile.commanders || {}).length, destination: "Deck Nexus", status: "Not Ready", page: "decks" },
    { id: "legacy-collection", label: "Legacy Collection", count: (profile.archives || []).length, destination: "Deck Nexus", status: "Not Ready", page: "archive" },
    { id: "legacy-profiles", label: "Legacy Profiles", count: 1, destination: "Future Hub", status: "Preserved", page: "profile" },
    { id: "legacy-friends", label: "Legacy Friends", count: friendCount, destination: "Future Hub", status: "Not Ready", optionsCategory: "friends" },
    { id: "legacy-tournaments", label: "Legacy Tournaments", count: tournamentCount, destination: "Future Hub", status: "Not Ready", page: "tournament" },
    { id: "legacy-notifications", label: "Legacy Notifications", count: notificationCount, destination: "Future Hub", status: "Preserved", optionsCategory: "notifications" },
    { id: "legacy-saves", label: "Legacy Saves", count: (profile.localSaves?.items || []).length, destination: "BoardState archive", status: "Preserved", optionsCategory: "saves" },
  ];
}

function formatSessionMode(session = {}) {
  if (session.simulation?.enabled) return "Dry Run";
  if (session.tutorial?.active || session.tutorial?.completionPending) return "Tutorial";
  if (session.gameTracking?.active) return session.gameTracking?.mode === "advanced-gameplay" ? "Advanced Gameplay" : "Active Game";
  return "Training Ground";
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
  const pages = ["home", "battlefield"];
  return profile.settings?.navigation?.showProfileInMainUi ? ["home", "battlefield", "profile"] : pages;
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
  if (normalized.includes("manual")) return "warning";
  if (normalized.includes("partial")) return "info";
  if (normalized.includes("ignored")) return "ignored";
  if (normalized.includes("review")) return "review";
  if (normalized.includes("failed")) return "error";
  return "info";
}

function formatManaLabel(value) {
  const labels = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green", C: "Colorless", Generic: "Generic" };
  return labels[value] || value;
}

function formatPageLabel(value) {
  if (value === "home") return "Home";
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
  return `<div class="empty-state"><span class="empty-state__sigil" aria-hidden="true">&#10022;</span><p class="empty">${escapeHtml(text)}</p></div>`;
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
