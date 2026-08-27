export const CANONICAL_GAMEPLAY_ARCHITECTURE_VERSION = "boardstate-canonical-gameplay-13.2.6-part1";

export const CANONICAL_GAMEPLAY_LAWS = Object.freeze([
  "gameplay-is-landscape",
  "loading-and-authentication-may-remain-portrait",
  "no-global-battlefield-scrolling",
  "battlefield-remains-true-tabletop",
  "cards-always-resemble-cards",
  "battlefield-is-spatial-not-document-based",
  "player-battlefield-remains-anchored",
  "opponent-battlefield-remains-anchored",
  "only-overflowing-zones-scroll-horizontally",
  "opponent-switching-and-zone-scrolling-are-separate",
  "notifications-never-cover-gameplay",
  "animations-always-have-priority",
  "protected-gameplay-space-cannot-be-obstructed",
  "tactical-command-hand-remains-permanently-docked",
  "live-tracking-assumes-tabletop-progression-unless-decision-required",
]);

export const CANONICAL_BATTLEFIELD_GEOGRAPHY = Object.freeze({
  reference: "two-player-beginner-playmat-spatial-organization",
  artworkPolicy: "do-not-copy-artwork-branding-or-decorative-elements",
  tableOrientation: "mirrored-player-territories",
  playerTerritory: "bottom-anchored",
  opponentTerritory: "top-anchored",
  sharedCorridor: "center-protected-gameplay-corridor",
  lanes: Object.freeze({
    creatures: "combat-facing-creature-lane",
    lands: "resource-lane-nearest-player-edge",
    artifacts: "support-permanent-lane",
    enchantments: "support-permanent-lane",
    planeswalkers: "support-permanent-lane",
    battles: "support-permanent-lane",
    commanders: "prominent-commander-identity-zone",
    library: "side-zone",
    graveyard: "side-zone",
    exile: "side-zone",
  }),
});

export const PROTECTED_GAMEPLAY_CORRIDOR = Object.freeze({
  id: "protected-gameplay-corridor",
  policy: "must-remain-clear",
  purpose: Object.freeze([
    "casting",
    "resolving",
    "targeting",
    "combat",
    "trigger-visualization",
    "stack-visualization",
    "priority-communication",
  ]),
  prohibitedPermanentObstructions: Object.freeze([
    "notifications",
    "undo-messages",
    "friend-activity",
    "helper-sprite",
    "contextual-guidance",
    "assistant-messages",
    "achievement-notifications",
    "status-toasts",
    "low-priority-reminders",
  ]),
});

export const LIVE_TRACKING_ASSUMPTIONS = Object.freeze({
  engine: "live-tracking-assumption-engine",
  interruptPolicy: "only-when-meaningful-player-decision-exists",
  automaticProgression: Object.freeze([
    "played-lands-enter-immediately",
    "creatures-enter-immediately-after-resolve",
    "artifacts-enter-immediately",
    "enchantments-enter-immediately",
    "battles-enter-immediately",
    "planeswalkers-enter-immediately",
    "equipment-enters-immediately",
    "counters-apply-immediately",
    "commander-tax-recalculates-automatically",
    "static-abilities-recalculate-automatically",
    "power-and-toughness-update-automatically",
    "continuous-effects-refresh-automatically",
  ]),
});

export const SINGLE_RESOLVE_LAW = Object.freeze({
  actionMeaning: "player-is-finished-resolving-this-spell",
  oneResolveCompletesUncontestedAction: true,
  permittedRepeatReason: "actual-stack-interaction-or-required-player-choice",
  automaticSteps: Object.freeze([
    "play-cast-animation",
    "move-spell-to-stack",
    "resolve-spell",
    "move-permanent-onto-battlefield-when-applicable",
    "generate-etb-triggers-when-applicable",
    "refresh-board-state",
    "update-continuous-effects",
    "update-available-actions",
    "end-resolution",
  ]),
});

const RESOLVED_CHOICE_STATUSES = new Set(["resolved", "skipped", "ignored", "cancelled", "completed"]);
const LOCAL_PLAYER_IDS = new Set(["player", "local-player"]);

export function createCanonicalGameplayRuntimeContract(page = "battlefield") {
  const gameplay = page === "battlefield";
  return {
    version: CANONICAL_GAMEPLAY_ARCHITECTURE_VERSION,
    page,
    viewport: gameplay ? "fixed" : "fixed",
    orientation: gameplay ? "landscape" : "orientation-neutral-startup-allowed",
    globalBattlefieldScroll: false,
    battlefieldModel: "spatial-tabletop",
    cardPresentation: "cards-always-resemble-cards",
    playerBattlefieldAnchor: "bottom",
    opponentBattlefieldAnchor: "top",
    overflowingZoneScroll: "horizontal-only",
    protectedGameplayCorridor: PROTECTED_GAMEPLAY_CORRIDOR.id,
    tacticalCommandHand: "permanently-docked",
    notificationsCoverGameplay: false,
    liveTrackingAssumptionEngine: LIVE_TRACKING_ASSUMPTIONS.engine,
  };
}

export function getPendingPlayerDecisions(session = {}, stackObject = null) {
  const stackObjectId = stackObject?.id || "";
  return (session.pendingEffects || []).filter((entry) => {
    if (RESOLVED_CHOICE_STATUSES.has(String(entry.status || "").toLowerCase())) {
      return false;
    }
    return !stackObjectId || !entry.stackObjectId || entry.stackObjectId === stackObjectId;
  });
}

export function getPendingTargetDecision(session = {}) {
  return (session.pendingEffects || []).find((entry) =>
    String(entry.status || "").toLowerCase() === "pending" &&
    entry.effect?.choiceKind === "targets"
  ) || null;
}

export function hasMeaningfulGameplayDecision(session = {}, stackObject = null) {
  if (getPendingPlayerDecisions(session, stackObject).length) {
    return true;
  }
  const priority = session.priority || {};
  const activePlayerId = priority.activePlayerId || "";
  if (priority.waiting && LOCAL_PLAYER_IDS.has(activePlayerId) && stackObject && !LOCAL_PLAYER_IDS.has(stackObject.controller || "")) {
    return true;
  }
  return false;
}

export function createSingleResolvePlan(session = {}, options = {}) {
  const stack = session.stack || [];
  const stackObject = options.stackId
    ? stack.find((entry) => entry.id === options.stackId)
    : stack[0];
  if (!stackObject) {
    return {
      version: CANONICAL_GAMEPLAY_ARCHITECTURE_VERSION,
      canResolve: false,
      reason: "empty-stack",
      requiresPlayerDecision: false,
      mode: "nothing-to-resolve",
    };
  }
  const decisions = getPendingPlayerDecisions(session, stackObject);
  const requiresPlayerDecision = hasMeaningfulGameplayDecision(session, stackObject);
  return {
    version: CANONICAL_GAMEPLAY_ARCHITECTURE_VERSION,
    canResolve: !decisions.length,
    reason: decisions.length ? "pending-player-decision" : "single-uncontested-resolve",
    requiresPlayerDecision,
    pendingDecisionCount: decisions.length,
    stackObjectId: stackObject.id || "",
    stackObjectName: stackObject.name || stackObject.card?.name || "Stack Object",
    stackDepth: stack.length,
    mode: decisions.length ? "interrupt-for-decision" : "single-resolve",
    oneResolveCompletesUncontestedAction: !decisions.length,
    automaticProgression: LIVE_TRACKING_ASSUMPTIONS.automaticProgression,
    resolveSteps: SINGLE_RESOLVE_LAW.automaticSteps,
  };
}

export function shouldAutoProgressLiveTrackingStack(session = {}, settings = {}) {
  if (settings.manualStackConfirmation) {
    return {
      allowed: false,
      reason: "manual-stack-confirmation-enabled",
      plan: createSingleResolvePlan(session),
    };
  }
  const plan = createSingleResolvePlan(session);
  if (!plan.canResolve) {
    return { allowed: false, reason: plan.reason, plan };
  }
  if (plan.requiresPlayerDecision) {
    return { allowed: false, reason: "priority-decision-required", plan };
  }
  return { allowed: true, reason: "live-tracking-assumes-uncontested-resolution", plan };
}

export function createProtectedGameplayCorridorState({ notificationCount = 0, helperVisible = false, overlayActive = false } = {}) {
  return {
    version: CANONICAL_GAMEPLAY_ARCHITECTURE_VERSION,
    corridorId: PROTECTED_GAMEPLAY_CORRIDOR.id,
    clearForGameplay: !notificationCount && !helperVisible && !overlayActive,
    notificationCount: Number(notificationCount || 0),
    helperVisible: Boolean(helperVisible),
    overlayActive: Boolean(overlayActive),
    permanentObstructionsAllowed: false,
  };
}
