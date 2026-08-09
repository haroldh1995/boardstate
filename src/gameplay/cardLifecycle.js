import {
  CANONICAL_GAMEPLAY_ARCHITECTURE_VERSION,
  createSingleResolvePlan,
  getPendingPlayerDecisions,
} from "./canonicalGameplay.js";

export const CANONICAL_CARD_LIFECYCLE_VERSION = "boardstate-card-lifecycle-13.2.6-part3";

export const GAMEPLAY_MODES = Object.freeze({
  liveTracking: "live-tracking",
  fullControl: "full-control",
});

export const CARD_LIFECYCLE_STATES = Object.freeze([
  "in-hand",
  "being-selected",
  "being-cast",
  "on-stack",
  "resolving",
  "entering-battlefield",
  "battlefield",
  "moving-to-graveyard",
  "exiled",
  "returning-to-command-zone",
  "returning-to-hand",
  "moving-to-library",
  "revealed",
  "copied",
  "token-created",
  "ceased-to-exist",
]);

export const CARD_PRESENTATION_ROLES = Object.freeze({
  battlefieldPermanent: "battlefield-permanent",
  castingPreview: "casting-preview",
  inspectionPreview: "inspection-preview",
  stackObject: "stack-object",
  commandHand: "command-hand",
  replayObservation: "replay-observation",
});

export const GAMEPLAY_EVENT_TYPES = Object.freeze({
  cast: "cast",
  resolve: "resolve",
  zoneChange: "zone-change",
  trigger: "trigger",
  tokenCreation: "token-creation",
  counterChange: "counter-change",
  lifeChange: "life-change",
  combat: "combat",
  landPlay: "land-play",
  replacementEffect: "replacement-effect",
  inspection: "inspection",
  undo: "undo",
  replay: "replay",
});

export const DIRECT_LIVE_TRACKING_ACTIONS = Object.freeze([
  "land-play",
  "life-change",
  "counter-change",
  "token-creation",
  "static-effect-update",
  "continuous-effect-update",
  "state-based-action",
  "commander-tax-update",
  "commander-damage-update",
]);

export const NOTIFICATION_PRIORITY_LEVELS = Object.freeze({
  critical: 1,
  importantGameplay: 2,
  informational: 3,
  social: 4,
  educational: 5,
});

export const GAMEPLAY_COMMUNICATION_PRIORITY = Object.freeze([
  "mandatory-current-player-decision",
  "critical-rules-state",
  "active-casting-resolution",
  "active-combat",
  "active-stack-priority",
  "selected-or-inspected-card",
  "relevant-contextual-command",
  "important-gameplay-notification",
  "reminder",
  "helper-educational-guidance",
  "social-notification",
  "decorative-information",
]);

const RESOLVED_STATUSES = new Set(["resolved", "skipped", "ignored", "cancelled", "completed"]);
const PRESENTATION_ROLE_BY_KIND = Object.freeze({
  cast: CARD_PRESENTATION_ROLES.castingPreview,
  "spell-cast": CARD_PRESENTATION_ROLES.castingPreview,
  "land-played": CARD_PRESENTATION_ROLES.battlefieldPermanent,
  "entered-battlefield": CARD_PRESENTATION_ROLES.battlefieldPermanent,
  "resolved-permanent": CARD_PRESENTATION_ROLES.battlefieldPermanent,
  inspect: CARD_PRESENTATION_ROLES.inspectionPreview,
  inspection: CARD_PRESENTATION_ROLES.inspectionPreview,
  stack: CARD_PRESENTATION_ROLES.stackObject,
});

export function resolveGameplayMode(session = {}, explicitMode = "") {
  const requested = normalizeGameplayMode(explicitMode || session.mode || session.gameplayMode || session.gameTracking?.mode || session.saveMetadata?.mode || "");
  if (requested) {
    return requested;
  }
  return session.simulation?.enabled ? GAMEPLAY_MODES.fullControl : GAMEPLAY_MODES.liveTracking;
}

export function createModeInteractionPolicy(modeOrSession = GAMEPLAY_MODES.liveTracking, options = {}) {
  const mode = typeof modeOrSession === "string"
    ? resolveGameplayMode({}, modeOrSession)
    : resolveGameplayMode(modeOrSession, options.mode);
  const liveTracking = mode !== GAMEPLAY_MODES.fullControl;
  return {
    version: CANONICAL_CARD_LIFECYCLE_VERSION,
    canonicalGameplayVersion: CANONICAL_GAMEPLAY_ARCHITECTURE_VERSION,
    mode,
    rulesEngineShared: true,
    authoritativeRulesDivergeByMode: false,
    inferDeterministicConsequences: liveTracking,
    requestDigitalPriorityPasses: !liveTracking,
    oneResolvePerStackObjectDefault: true,
    landPlayRequiresResolve: false,
    directLifeCounterTokenChangesRequireResolve: false,
    collectCastingChoicesWhenNeeded: true,
    askSmallestSafeQuestionWhenInferenceIsUnsafe: true,
    neverFabricateHiddenInformation: true,
    presentationStateIsNotRulesState: true,
  };
}

export function createCardLifecycleSnapshot(card = {}, lifecycleState = "battlefield", options = {}) {
  const state = CARD_LIFECYCLE_STATES.includes(lifecycleState) ? lifecycleState : "battlefield";
  return {
    version: CANONICAL_CARD_LIFECYCLE_VERSION,
    objectId: options.objectId || card.id || card.cardId || "",
    cardId: card.cardId || card.id || "",
    name: card.name || "Card",
    controller: options.controller || card.controller || "player",
    owner: options.owner || card.owner || options.controller || card.controller || "player",
    lifecycleState: state,
    zone: options.zone || card.zone || inferZoneFromLifecycleState(state),
    authoritative: true,
    animationStateSeparate: true,
    presentationRole: options.presentationRole || resolvePresentationRoleForLifecycleState(state),
    eventId: options.eventId || "",
    previousZone: options.previousZone || "",
    nextZone: options.nextZone || "",
    rulesConfidence: options.rulesConfidence || card.rulesConfidence || "auto-resolved",
  };
}

export function createGameplayEventIdentity(eventType = "", payload = {}, options = {}) {
  const explicit = options.eventId || payload.eventId || payload.id;
  if (explicit) {
    return String(explicit);
  }
  const type = normalizeIdentitySegment(eventType || payload.eventType || payload.type || "gameplay-event");
  const objectId =
    payload.stackObjectId ||
    payload.stackId ||
    payload.objectId ||
    payload.permanentId ||
    payload.sourceId ||
    payload.triggerId ||
    payload.card?.id ||
    payload.card?.cardId ||
    payload.permanent?.id ||
    payload.source?.id ||
    payload.name ||
    payload.card?.name ||
    "";
  const controller = payload.controller || payload.playerId || payload.card?.controller || payload.permanent?.controller || "";
  const sequence = payload.sequence || payload.revision || payload.eventRevision || options.sequence || "";
  return ["event", type, objectId, controller, sequence]
    .map(normalizeIdentitySegment)
    .filter(Boolean)
    .join(":");
}

export function createGameplayLifecycleEvent({
  eventType = GAMEPLAY_EVENT_TYPES.zoneChange,
  card = {},
  source = {},
  fromZone = "",
  toZone = "",
  lifecycleState = "",
  controller = "",
  stackObjectId = "",
  triggerId = "",
  requiresDecision = false,
  deterministic = true,
  hiddenInformationRequired = false,
  eventId = "",
  timestamp = 0,
} = {}) {
  const payload = {
    stackObjectId,
    triggerId,
    card,
    source,
    controller: controller || card.controller || source.controller || "player",
    eventId,
  };
  return {
    version: CANONICAL_CARD_LIFECYCLE_VERSION,
    eventId: createGameplayEventIdentity(eventType, payload),
    eventType,
    objectId: card.id || card.cardId || source.id || stackObjectId || triggerId || "",
    cardName: card.name || source.name || "Card",
    controller: payload.controller,
    fromZone,
    toZone,
    lifecycleState: lifecycleState || inferLifecycleStateFromEvent(eventType, toZone),
    requiresDecision: Boolean(requiresDecision),
    deterministic: Boolean(deterministic),
    hiddenInformationRequired: Boolean(hiddenInformationRequired),
    rulesEvent: true,
    presentationOnly: false,
    timestamp: Number(timestamp || 0),
  };
}

export function createCardPresentationPayload(card = {}, kind = "entered-battlefield", controller = "player", options = {}) {
  const role = options.presentationRole || PRESENTATION_ROLE_BY_KIND[kind] || CARD_PRESENTATION_ROLES.battlefieldPermanent;
  const eventType = options.eventType || mapPresentationKindToEventType(kind);
  const eventId = createGameplayEventIdentity(eventType, {
    eventId: options.eventId,
    stackObjectId: options.stackObjectId,
    objectId: options.objectId || card.id || card.cardId || card.name,
    card,
    controller,
    sequence: options.sequence,
  });
  const createdAt = Number(options.createdAt || 0);
  const durationMs = Math.max(0, Number(options.durationMs ?? 1550));
  return {
    id: options.presentationId || `presentation:${eventId}`,
    eventId,
    animationId: `animation:${eventId}`,
    card: {
      cardId: card.cardId || "",
      id: card.id || card.cardId || "",
      name: card.name || "Card",
      typeLine: card.typeLine || "",
      imageUrl: card.imageUrl || "",
      imageSmall: card.imageSmall || "",
      imageArt: card.imageArt || "",
    },
    kind,
    presentationRole: role,
    controller,
    sourcePlayerId: options.sourcePlayerId || controller,
    stackObjectId: options.stackObjectId || "",
    presentationOnly: true,
    mutatesAuthoritativeState: false,
    shouldReplayOnRender: false,
    state: options.state || "appearing",
    owner: options.owner || resolvePresentationOwner(role),
    createdAt,
    expiresAt: Number(options.expiresAt || (createdAt ? createdAt + durationMs : 0)),
  };
}

export function createPresentationLedger(existing = {}) {
  return {
    version: CANONICAL_CARD_LIFECYCLE_VERSION,
    completedEventIds: uniqueStrings(existing.completedEventIds || existing.playedEventIds || []),
    activeEventIds: uniqueStrings(existing.activeEventIds || []),
    queue: Array.isArray(existing.queue) ? existing.queue.map((entry) => ({ ...entry })) : [],
  };
}

export function shouldPlayPresentationEvent(ledger = {}, presentationEvent = {}) {
  const state = createPresentationLedger(ledger);
  const eventId = presentationEvent.eventId || presentationEvent.authoritativeEventId || "";
  return Boolean(eventId && !state.completedEventIds.includes(eventId));
}

export function markPresentationEventPlayed(ledger = {}, presentationEvent = {}) {
  const state = createPresentationLedger(ledger);
  const eventId = presentationEvent.eventId || presentationEvent.authoritativeEventId || "";
  return {
    ...state,
    activeEventIds: state.activeEventIds.filter((id) => id !== eventId),
    completedEventIds: uniqueStrings([eventId, ...state.completedEventIds]).slice(0, 240),
    lastCompletedEventId: eventId,
  };
}

export function createResolveInteractionPlan(session = {}, options = {}) {
  const actionKind = normalizeIdentitySegment(options.actionKind || "");
  const mode = resolveGameplayMode(session, options.mode);
  const policy = createModeInteractionPolicy(mode);
  if (DIRECT_LIVE_TRACKING_ACTIONS.includes(actionKind)) {
    return {
      version: CANONICAL_CARD_LIFECYCLE_VERSION,
      mode,
      policy,
      actionKind,
      canResolve: false,
      reason: "direct-deterministic-action",
      requiredResolveInteractions: 0,
      deterministicCompletion: true,
      spellSubstepsAreStackObjects: false,
      nextDecision: null,
    };
  }
  const stack = session.stack || [];
  const stackObject = options.stackId ? stack.find((entry) => entry.id === options.stackId) : stack[0];
  if (!stackObject) {
    return {
      version: CANONICAL_CARD_LIFECYCLE_VERSION,
      mode,
      policy,
      canResolve: false,
      reason: "empty-stack",
      requiredResolveInteractions: 0,
      deterministicCompletion: true,
      spellSubstepsAreStackObjects: false,
      nextDecision: null,
    };
  }
  const singleResolvePlan = createSingleResolvePlan(session, { stackId: stackObject.id });
  const decisions = getPendingPlayerDecisions(session, stackObject);
  const stackDepth = stack.length;
  const genuineStackObjects = stackDepth;
  const requiresDecision = Boolean(decisions.length || singleResolvePlan.requiresPlayerDecision);
  return {
    version: CANONICAL_CARD_LIFECYCLE_VERSION,
    mode,
    policy,
    stackObjectId: stackObject.id || "",
    stackObjectName: stackObject.name || stackObject.card?.name || "Stack Object",
    stackDepth,
    genuineStackObjects,
    canResolve: singleResolvePlan.canResolve,
    reason: requiresDecision ? "decision-required-before-resolution" : "one-resolve-current-stack-object",
    requiredResolveInteractions: requiresDecision ? 0 : 1,
    repeatedResolveAllowed: stackDepth > 1,
    repeatedResolveReason: stackDepth > 1 ? "independent-stack-objects-remain" : "",
    deterministicCompletion: !requiresDecision,
    spellSubstepsAreStackObjects: false,
    nextDecision: decisions[0] || null,
    singleResolvePlan,
  };
}

export function createPostResolveDecisionPipeline(session = {}, options = {}) {
  const pendingDecisions = getPendingPlayerDecisions(session, options.stackObject || null);
  return {
    version: CANONICAL_CARD_LIFECYCLE_VERSION,
    steps: [
      "finish-current-object",
      "apply-deterministic-state-changes",
      "process-replacement-effects",
      "generate-triggers",
      "identify-mandatory-choices",
      pendingDecisions.length ? "present-next-decision" : "continue-automatically",
    ],
    pendingDecisionCount: pendingDecisions.length,
    nextDecision: pendingDecisions[0] || null,
    replayOriginalAnimation: false,
    askResolveAgainForSameObject: false,
  };
}

export function classifyTriggerForPresentation(trigger = {}) {
  const effects = Array.isArray(trigger.effectDefinitions) ? trigger.effectDefinitions : [];
  const requiresManualEffect = effects.some((effect) => effect.manual || effect.optional || effect.choiceKind);
  const optional = Boolean(trigger.optional || effects.some((effect) => effect.optional));
  const requiresOrdering = Boolean(trigger.requiresOrdering || trigger.orderingRequired || trigger.apnapOrderRequired);
  const requiresDecision = optional || requiresManualEffect || requiresOrdering || trigger.rulesConfidence === "manual-choice-required";
  return {
    version: CANONICAL_CARD_LIFECYCLE_VERSION,
    triggerId: trigger.id || "",
    sourceId: trigger.sourceId || "",
    sourceName: trigger.sourceName || "Trigger",
    eventType: trigger.eventType || "TRIGGER",
    kind: requiresOrdering ? "ordering-required" : optional ? "optional-trigger" : requiresDecision ? "decision-required-trigger" : "automatic-trigger",
    automatic: !requiresDecision,
    requiresDecision,
    optional,
    requiresOrdering,
    stackObject: false,
    replacementEffect: false,
    presentationOnlyUntilResolved: true,
  };
}

export function createTriggerPresentationPlan(triggers = [], options = {}) {
  const classified = triggers.map(classifyTriggerForPresentation);
  const automatic = classified.filter((entry) => entry.automatic);
  const decisions = classified.filter((entry) => entry.requiresDecision);
  return {
    version: CANONICAL_CARD_LIFECYCLE_VERSION,
    mode: resolveGameplayMode(options.session || {}, options.mode),
    total: classified.length,
    automatic,
    decisions,
    autoProcessWithoutPrompt: automatic.length,
    promptCount: decisions.length,
    batchAutomaticPresentation: automatic.length > 4,
    preventNotificationFlood: true,
  };
}

export function isReplacementEffectStackObject(effect = {}) {
  return Boolean(effect.isStackObject || effect.stackBehavior === "stack" || effect.usesStack === true);
}

export function createPreviewState(role = CARD_PRESENTATION_ROLES.inspectionPreview, card = {}, context = {}) {
  const normalizedRole = Object.values(CARD_PRESENTATION_ROLES).includes(role) ? role : CARD_PRESENTATION_ROLES.inspectionPreview;
  return {
    version: CANONICAL_CARD_LIFECYCLE_VERSION,
    active: true,
    role: normalizedRole,
    cardId: card.cardId || card.id || "",
    objectId: card.id || card.cardId || "",
    cardName: card.name || "Card",
    deliberate: normalizedRole === CARD_PRESENTATION_ROLES.inspectionPreview,
    presentationOnly: true,
    mutatesAuthoritativeState: false,
    previousContext: {
      focusedOpponentId: context.focusedOpponentId || "",
      commandHandFocusedId: context.commandHandFocusedId || "",
      selectedIds: uniqueStrings(context.selectedIds || []),
      zoneScrollPositions: cloneRecord(context.zoneScrollPositions || {}),
      expandedStackIds: uniqueStrings(context.expandedStackIds || []),
    },
  };
}

export function dismissPreviewState(preview = {}) {
  return {
    version: CANONICAL_CARD_LIFECYCLE_VERSION,
    active: false,
    dismissedRole: preview.role || "",
    presentationOnly: true,
    mutatesAuthoritativeState: false,
    restoredContext: cloneRecord(preview.previousContext || {}),
  };
}

export function resolveGameplayAttentionOwner(context = {}) {
  const session = context.session || {};
  const hasMandatoryDecision = Boolean(context.mandatoryDecision || getPendingPlayerDecisions(session).length);
  const stackActive = Boolean(context.stackActive || (session.stack || []).length);
  const presentation = context.presentation || session.presentation || null;
  const presentationKind = String(presentation?.kind || "");
  const castOrResolvePresentation = Boolean(
    context.castingOrResolving ||
    ["cast", "spell-cast", "resolved-permanent", "entered-battlefield", "land-played"].includes(presentationKind)
  );
  const combatActive = Boolean(context.combatActive || session.combat?.step && session.combat.step !== "idle");
  const inspectionActive = Boolean(context.inspectionActive || context.previewRole === CARD_PRESENTATION_ROLES.inspectionPreview);
  const contextualCommand = Boolean(context.commandHandActive || context.focusedCommandId);
  const ordered = [
    [hasMandatoryDecision, "mandatory-current-player-decision"],
    [Boolean(context.criticalRulesState), "critical-rules-state"],
    [castOrResolvePresentation, "active-casting-resolution"],
    [combatActive, "active-combat"],
    [stackActive, "active-stack-priority"],
    [inspectionActive, "selected-or-inspected-card"],
    [contextualCommand, "relevant-contextual-command"],
    [Boolean(context.importantGameplayNotification), "important-gameplay-notification"],
    [Boolean(context.reminder), "reminder"],
    [Boolean(context.helper), "helper-educational-guidance"],
    [Boolean(context.socialNotification), "social-notification"],
  ];
  const match = ordered.find(([active]) => active);
  const owner = match ? match[1] : "decorative-information";
  return {
    version: CANONICAL_CARD_LIFECYCLE_VERSION,
    owner,
    priority: GAMEPLAY_COMMUNICATION_PRIORITY.indexOf(owner) + 1,
    protectedCorridorOwner: ["mandatory-current-player-decision", "critical-rules-state", "active-casting-resolution", "active-combat", "active-stack-priority"].includes(owner),
    lowerPriorityMustYield: owner !== "decorative-information",
  };
}

export function classifyNotificationPriority(notification = {}) {
  const category = String(notification.category || notification.eventKey || "").toLowerCase();
  const severity = String(notification.severity || "").toLowerCase();
  if (notification.critical || severity === "critical" || severity === "error") {
    return NOTIFICATION_PRIORITY_LEVELS.critical;
  }
  if (/gameplay|manual|rules|stack|combat|trigger|commander|recovery/.test(category) || severity === "warning") {
    return NOTIFICATION_PRIORITY_LEVELS.importantGameplay;
  }
  if (/friend|social|nearby|invite/.test(category)) {
    return NOTIFICATION_PRIORITY_LEVELS.social;
  }
  if (/tutorial|helper|learning|education|onboarding|assistance/.test(category)) {
    return NOTIFICATION_PRIORITY_LEVELS.educational;
  }
  return NOTIFICATION_PRIORITY_LEVELS.informational;
}

export function shouldDeferNotification(notification = {}, context = {}) {
  const priority = classifyNotificationPriority(notification);
  const attention = resolveGameplayAttentionOwner(context);
  if (priority === NOTIFICATION_PRIORITY_LEVELS.critical) {
    return {
      defer: false,
      reason: "critical-notification",
      priority,
      attention,
    };
  }
  if (attention.protectedCorridorOwner && priority >= NOTIFICATION_PRIORITY_LEVELS.informational) {
    return {
      defer: true,
      reason: "protected-gameplay-corridor-owned",
      priority,
      attention,
    };
  }
  if (attention.owner === "relevant-contextual-command" && priority >= NOTIFICATION_PRIORITY_LEVELS.social) {
    return {
      defer: true,
      reason: "focused-command-hand-owned",
      priority,
      attention,
    };
  }
  return {
    defer: false,
    reason: "allowed",
    priority,
    attention,
  };
}

export function createReplayObservation(event = {}) {
  return {
    version: CANONICAL_CARD_LIFECYCLE_VERSION,
    eventId: event.eventId || event.id || "",
    eventType: event.eventType || event.type || "replay",
    presentationRole: CARD_PRESENTATION_ROLES.replayObservation,
    observationalOnly: true,
    mutatesAuthoritativeState: false,
    executesRules: false,
    sourceEvent: { ...event },
  };
}

export function assertModeParityOutcome(liveResult = {}, fullControlResult = {}) {
  return {
    version: CANONICAL_CARD_LIFECYCLE_VERSION,
    authoritativeRulesMatch:
      stableStateSignature(liveResult.authoritativeState || liveResult) ===
      stableStateSignature(fullControlResult.authoritativeState || fullControlResult),
    interactionDepthMayDiffer: true,
  };
}

function normalizeGameplayMode(mode = "") {
  const normalized = String(mode || "").trim().toLowerCase();
  if (!normalized) return "";
  if (["full-control", "dry-run", "simulation", "simulated", "digital", "digital-game"].includes(normalized)) {
    return GAMEPLAY_MODES.fullControl;
  }
  if (["live-tracking", "active-game", "training-ground", "normal", "commander", "tabletop"].includes(normalized)) {
    return GAMEPLAY_MODES.liveTracking;
  }
  return "";
}

function normalizeIdentitySegment(value = "") {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferZoneFromLifecycleState(state = "") {
  if (state.includes("graveyard")) return "graveyard";
  if (state.includes("exil")) return "exile";
  if (state.includes("command")) return "command";
  if (state.includes("hand")) return "hand";
  if (state.includes("library")) return "library";
  if (state.includes("stack") || state === "resolving") return "stack";
  if (state.includes("battlefield") || state.includes("token-created")) return "battlefield";
  return "";
}

function inferLifecycleStateFromEvent(eventType = "", toZone = "") {
  const type = String(eventType || "").toLowerCase();
  if (type.includes("cast")) return "being-cast";
  if (type.includes("resolve")) return "resolving";
  if (type.includes("token")) return "token-created";
  if (type.includes("land")) return "entering-battlefield";
  if (toZone === "battlefield") return "entering-battlefield";
  if (toZone === "graveyard") return "moving-to-graveyard";
  if (toZone === "exile") return "exiled";
  if (toZone === "command") return "returning-to-command-zone";
  return "battlefield";
}

function resolvePresentationRoleForLifecycleState(state = "") {
  if (state === "being-cast") return CARD_PRESENTATION_ROLES.castingPreview;
  if (state === "on-stack" || state === "resolving") return CARD_PRESENTATION_ROLES.stackObject;
  return CARD_PRESENTATION_ROLES.battlefieldPermanent;
}

function mapPresentationKindToEventType(kind = "") {
  if (kind === "cast" || kind === "spell-cast") return GAMEPLAY_EVENT_TYPES.cast;
  if (kind === "land-played") return GAMEPLAY_EVENT_TYPES.landPlay;
  if (kind === "resolved-permanent" || kind === "entered-battlefield") return GAMEPLAY_EVENT_TYPES.resolve;
  if (kind === "inspect" || kind === "inspection") return GAMEPLAY_EVENT_TYPES.inspection;
  return GAMEPLAY_EVENT_TYPES.zoneChange;
}

function resolvePresentationOwner(role = "") {
  if (role === CARD_PRESENTATION_ROLES.castingPreview || role === CARD_PRESENTATION_ROLES.stackObject) {
    return "protected-gameplay-corridor";
  }
  if (role === CARD_PRESENTATION_ROLES.inspectionPreview) {
    return "card-inspection";
  }
  return "battlefield";
}

function uniqueStrings(values = []) {
  return [...new Set((values || []).map((value) => String(value || "")).filter(Boolean))];
}

function cloneRecord(record = {}) {
  return JSON.parse(JSON.stringify(record || {}));
}

function stableStateSignature(value = {}) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStateSignature).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${key}:${stableStateSignature(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
