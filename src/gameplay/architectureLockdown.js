import { CANONICAL_BATTLEFIELD_GEOMETRY_VERSION } from "./battlefieldGeometry.js";
import { CANONICAL_CARD_LIFECYCLE_VERSION } from "./cardLifecycle.js";
import { CANONICAL_GAMEPLAY_ARCHITECTURE_VERSION } from "./canonicalGameplay.js";
import {
  CANONICAL_INPUT_INTENT_VERSION,
  resolveCommandHandVisualCloneIdentity,
  validateCommandHandFocusState,
} from "./inputIntent.js";

export const CANONICAL_GAMEPLAY_BASELINE_ID = "boardstate-13.2.6-locked-baseline";
export const CANONICAL_GAMEPLAY_LOCKDOWN_VERSION = "boardstate-gameplay-architecture-lock-13.2.6-part6";

export const LOCKDOWN_CANONICAL_GAMEPLAY_LAWS = Object.freeze([
  law(1, "BoardState gameplay is spatial"),
  law(2, "Landscape gameplay is authoritative"),
  law(3, "No global vertical gameplay scroll"),
  law(4, "Local player territory is anchored"),
  law(5, "Tabletop geography is stable"),
  law(6, "Battlefield cards look like TCG cards"),
  law(7, "Previews are temporary"),
  law(8, "Creature region"),
  law(9, "Planeswalker placement"),
  law(10, "Land / support region"),
  law(11, "Organize before scrolling"),
  law(12, "Overflow is zone-local"),
  law(13, "Opponent navigation is separate from zone scrolling"),
  law(14, "Opponent arrows are reliable"),
  law(15, "Opponent order is stable"),
  law(16, "Command Hand is a TCG hand"),
  law(17, "Exactly one command is focused"),
  law(18, "Center means front"),
  law(19, "Command focus has one source of truth"),
  law(20, "Command Hand movement is free during input"),
  law(21, "Command Hand snaps after motion"),
  law(22, "Command Hand is circular"),
  law(23, "Visual clones are not gameplay objects"),
  law(24, "Contextual commands are temporary"),
  law(25, "Live Tracking prioritizes speed"),
  law(26, "One Resolve by default"),
  law(27, "Deterministic consequences are automatic"),
  law(28, "Genuine decisions remain explicit"),
  law(29, "Real stack objects remain real"),
  law(30, "Hidden information is never invented"),
  law(31, "Gameplay events have semantic identity"),
  law(32, "Animation does not create gameplay"),
  law(33, "Animation is idempotent per event"),
  law(34, "Critical gameplay owns visual priority"),
  law(35, "Protected gameplay corridor"),
  law(36, "One gesture - one owner"),
  law(37, "Gesture ownership does not change mid-gesture"),
  law(38, "Presentation state is not authoritative state"),
  law(39, "Live Tracking and Full Control share authoritative rules"),
  law(40, "BoardState remains platform-portable"),
]);

export const ARCHITECTURE_RESPONSIBILITY_MAP = Object.freeze({
  canonicalDocumentation: ["docs/ecosystem/CANONICAL_GAMEPLAY_ARCHITECTURE.md"],
  battlefieldComposition: ["src/ui/landscapeBattlefield.js", "src/gameplay/battlefieldGeometry.js"],
  battlefieldCardRendering: ["src/ui/render.js", "src/styles.css"],
  cardZoneAssignment: ["src/gameplay/battlefieldGeometry.js"],
  planeswalkerPlacement: ["src/gameplay/battlefieldGeometry.js"],
  supportPermanentPlacement: ["src/gameplay/battlefieldGeometry.js"],
  densityManagement: ["src/gameplay/battlefieldGeometry.js", "src/ui/landscapeBattlefield.js"],
  stackingGrouping: ["src/gameplay/battlefieldGeometry.js"],
  zoneOverflow: ["src/gameplay/battlefieldGeometry.js", "src/ui/landscapeBattlefield.js", "src/styles.css"],
  opponentFocus: ["src/gameplay/inputIntent.js", "src/ui/landscapeBattlefield.js", "src/state/gameReducer.js"],
  opponentNavigation: ["src/gameplay/inputIntent.js", "src/ui/landscapeBattlefield.js", "src/ui/render.js"],
  gestureIntent: ["src/gameplay/inputIntent.js"],
  gestureOwnership: ["src/gameplay/inputIntent.js", "src/gameplay/battlefieldGeometry.js", "src/ui/render.js"],
  commandHandCanonicalFocus: ["src/gameplay/commandDeckModel.js", "src/gameplay/inputIntent.js", "src/ui/render.js"],
  commandHandGeometry: ["src/gameplay/commandDeckModel.js", "src/styles.css"],
  commandHandZOrder: ["src/gameplay/commandDeckModel.js", "src/gameplay/inputIntent.js", "src/ui/render.js"],
  commandHandInfiniteRotation: ["src/gameplay/commandDeckModel.js", "src/ui/render.js"],
  commandHandContextualCommands: ["src/ui/render.js", "src/gameplay/cardLifecycle.js"],
  cardLifecycle: ["src/gameplay/cardLifecycle.js", "src/effects/effectEngine.js", "src/state/gameReducer.js"],
  stack: ["src/gameplay/cardLifecycle.js", "src/effects/effectEngine.js", "src/state/schema.js"],
  resolution: ["src/gameplay/canonicalGameplay.js", "src/gameplay/cardLifecycle.js", "src/effects/effectEngine.js"],
  triggerPipeline: ["src/gameplay/cardLifecycle.js", "src/effects/effectEngine.js", "src/state/gameReducer.js"],
  gameplayEventIdentity: ["src/gameplay/cardLifecycle.js", "src/authoritative-core/eventKnowledgeEngine.js"],
  animationEventPresentation: ["src/gameplay/cardLifecycle.js", "src/ui/landscapeBattlefield.js", "src/ui/render.js"],
  notificationPriority: ["src/gameplay/cardLifecycle.js", "src/ui/render.js"],
  protectedGameplayCorridor: ["src/gameplay/canonicalGameplay.js", "src/gameplay/cardLifecycle.js", "src/ui/render.js"],
  orientationLayoutPolicy: ["src/gameplay/inputIntent.js", "src/ui/landscapeBattlefield.js", "src/ui/render.js", "src/styles.css"],
  persistence: ["src/persistence/canonicalPersistence.js", "src/storage/saveState.js", "src/state/gameReducer.js"],
  platformAdapters: ["src/platform/runtimeEnvironment.js", "src/storage/localDatabase.js", "src/services/scryfallService.js"],
  regressionTests: [
    "test/canonical-gameplay-architecture.test.js",
    "test/canonical-gameplay-part2.test.js",
    "test/canonical-gameplay-part3.test.js",
    "test/canonical-gameplay-part4.test.js",
    "test/canonical-gameplay-part5.test.js",
    "test/canonical-gameplay-part6.test.js",
  ],
});

export const ARCHITECTURE_CHANGE_CONTRACT = Object.freeze({
  explicitMigrationRequired: true,
  requiredSteps: Object.freeze([
    "identify-canonical-law",
    "define-replacement-behavior",
    "justify-boardstate-improvement",
    "update-canonical-documentation",
    "update-regression-tests",
    "revalidate-adjacent-systems",
    "revalidate-live-tracking",
    "revalidate-full-control-compatibility",
    "revalidate-multiplayer",
    "revalidate-platform-portability",
  ]),
});

export const FUTURE_FEATURE_INTEGRATION_CHECKLIST = Object.freeze([
  "authoritative-state-impact",
  "presentation-state-impact",
  "interaction-intent-impact",
  "canonical-law-impact",
  "live-tracking-impact",
  "full-control-impact",
  "command-hand-impact",
  "battlefield-geography-impact",
  "multiplayer-navigation-impact",
  "gesture-ownership-impact",
  "mobile-landscape-impact",
  "accessibility-impact",
  "performance-impact",
  "platform-portability-impact",
]);

export const LOCKDOWN_REGRESSION_CATEGORIES = Object.freeze([
  "battlefield",
  "cards",
  "command-hand",
  "multiplayer",
  "gestures",
  "resolution",
  "stack",
  "events",
  "animation",
  "notifications",
  "persistence",
  "responsive-device-behavior",
  "portability",
  "performance",
]);

export const PLATFORM_PORTABILITY_CONTRACT = Object.freeze({
  sharedGameplayUsesSemanticStateAndIntent: true,
  presentationAdaptersOwnPlatformBehavior: true,
  swiftUiAdaptationViable: true,
  browserClientIsNotTheArchitecture: true,
  prohibitedSharedConcerns: Object.freeze([
    "dom-only-authority",
    "css-as-rules-truth",
    "hover-only-required-actions",
    "browser-lifecycle-as-gameplay-lifecycle",
    "platform-events-as-semantic-gameplay-events",
    "platform-storage-as-only-persistence",
    "platform-animation-as-rules-execution",
  ]),
});

export function createArchitectureLockdownBaseline(overrides = {}) {
  return {
    version: CANONICAL_GAMEPLAY_LOCKDOWN_VERSION,
    baselineId: CANONICAL_GAMEPLAY_BASELINE_ID,
    locked: true,
    canonicalVersions: {
      gameplay: CANONICAL_GAMEPLAY_ARCHITECTURE_VERSION,
      battlefieldGeometry: CANONICAL_BATTLEFIELD_GEOMETRY_VERSION,
      cardLifecycle: CANONICAL_CARD_LIFECYCLE_VERSION,
      inputIntent: CANONICAL_INPUT_INTENT_VERSION,
    },
    laws: LOCKDOWN_CANONICAL_GAMEPLAY_LAWS,
    documentation: {
      sourceOfTruth: "docs/ecosystem/CANONICAL_GAMEPLAY_ARCHITECTURE.md",
      duplicateFinalArchitectureDocumentsAllowed: false,
    },
    responsibilityMap: ARCHITECTURE_RESPONSIBILITY_MAP,
    regressionCategories: LOCKDOWN_REGRESSION_CATEGORIES,
    architectureChangeContract: ARCHITECTURE_CHANGE_CONTRACT,
    futureFeatureIntegrationChecklist: FUTURE_FEATURE_INTEGRATION_CHECKLIST,
    platformPortability: PLATFORM_PORTABILITY_CONTRACT,
    liveTrackingFullControlContract: {
      sharedAuthoritativeRules: true,
      liveTrackingOneResolveDefault: true,
      fullControlMayRequestMoreInput: true,
      hiddenInformationFabricated: false,
    },
    releaseSynchronization: {
      localRemoteDeploymentMustMatch: true,
      productionBuildRequired: true,
      deploymentVerificationRequiredWhenSupported: true,
    },
    ...overrides,
  };
}

export function validateArchitectureLockdownBaseline(baseline = createArchitectureLockdownBaseline()) {
  const issues = [];
  if (baseline.baselineId !== CANONICAL_GAMEPLAY_BASELINE_ID) issues.push("invalid-baseline-id");
  if (baseline.version !== CANONICAL_GAMEPLAY_LOCKDOWN_VERSION) issues.push("invalid-lockdown-version");
  if ((baseline.laws || []).length !== 40) issues.push("forty-canonical-laws-required");
  if (baseline.documentation?.sourceOfTruth !== "docs/ecosystem/CANONICAL_GAMEPLAY_ARCHITECTURE.md") issues.push("canonical-doc-source-required");
  if (baseline.documentation?.duplicateFinalArchitectureDocumentsAllowed !== false) issues.push("duplicate-final-docs-not-allowed");
  for (const key of Object.keys(ARCHITECTURE_RESPONSIBILITY_MAP)) {
    if (!Array.isArray(baseline.responsibilityMap?.[key]) || !baseline.responsibilityMap[key].length) {
      issues.push(`missing-responsibility:${key}`);
    }
  }
  if (!baseline.platformPortability?.swiftUiAdaptationViable) issues.push("swiftui-portability-contract-required");
  return createValidationResult(issues);
}

export function validateCommandHandLockdown(entries = [], options = {}) {
  const focusValidation = validateCommandHandFocusState(entries);
  const issues = [...focusValidation.issues];
  const stableRest = options.stableRest !== false;
  if (stableRest && !focusValidation.valid) issues.push("command-hand-stable-rest-invalid");
  if (stableRest && focusValidation.focusedId !== focusValidation.centeredId) issues.push("focused-command-must-equal-center");
  if (stableRest && focusValidation.focusedId !== focusValidation.topZOrderId) issues.push("focused-command-must-own-top-depth");
  if (stableRest && focusValidation.focusedId !== focusValidation.topHitTestId) issues.push("focused-command-must-own-hit-testing");

  const clones = (entries || []).filter((entry) => entry?.visualId || entry?.cloneId || entry?.isClone);
  for (const clone of clones) {
    const identity = resolveCommandHandVisualCloneIdentity(clone);
    if (!identity.canonicalCommandId || identity.createsIndependentCommand) {
      issues.push(`invalid-visual-clone:${identity.visualId || "unknown"}`);
    }
  }

  const persistentOrder = normalizeStringArray(options.persistentCommandIds);
  const finalPersistentOrder = normalizeStringArray(options.finalPersistentCommandIds || options.persistentCommandIds);
  if (persistentOrder.length && stableSignature(persistentOrder) !== stableSignature(finalPersistentOrder)) {
    issues.push("contextual-command-corrupted-persistent-order");
  }

  return {
    version: CANONICAL_GAMEPLAY_LOCKDOWN_VERSION,
    baselineId: CANONICAL_GAMEPLAY_BASELINE_ID,
    valid: issues.length === 0,
    focusedId: focusValidation.focusedId,
    centeredId: focusValidation.centeredId,
    topZOrderId: focusValidation.topZOrderId,
    topHitTestId: focusValidation.topHitTestId,
    issues: uniqueStrings(issues),
  };
}

export function validateBattlefieldLockdown(geometry = {}) {
  const issues = [];
  const creatureZone = geometry.creatureZone || {};
  const lowerZone = geometry.lowerZone || {};
  if (geometry.version && geometry.version !== CANONICAL_BATTLEFIELD_GEOMETRY_VERSION) issues.push("invalid-battlefield-geometry-version");
  if (creatureZone.verticalScrollAllowed !== false) issues.push("creature-zone-vertical-scroll-forbidden");
  if (lowerZone.verticalScrollAllowed !== false) issues.push("land-support-zone-vertical-scroll-forbidden");
  if (creatureZone.horizontalScrollAllowed && creatureZone.overflowMode !== "zone-local-horizontal-scroll") issues.push("creature-overflow-not-zone-local");
  if (lowerZone.horizontalScrollAllowed && lowerZone.overflowMode !== "zone-local-horizontal-scroll") issues.push("lower-overflow-not-zone-local");
  if (!planeswalkersAreFarRight(creatureZone.permanents || [])) issues.push("planeswalkers-must-be-far-right-creature-region");
  if (!supportIsFarRight(lowerZone.permanents || [])) issues.push("support-permanents-must-be-far-right-lower-region");
  if (!authoritativeIdsAreUnique(geometry.authoritativeObjectIds || [])) issues.push("authoritative-object-identity-duplicated");
  for (const zone of geometry.zones || []) {
    if (zone.verticalScrollAllowed) issues.push(`zone-vertical-scroll-forbidden:${zone.key || "unknown"}`);
    if (zone.horizontalScrollAllowed && zone.overflowMode !== "zone-local-horizontal-scroll") {
      issues.push(`zone-overflow-not-local:${zone.key || "unknown"}`);
    }
  }
  return {
    version: CANONICAL_GAMEPLAY_LOCKDOWN_VERSION,
    baselineId: CANONICAL_GAMEPLAY_BASELINE_ID,
    valid: issues.length === 0,
    densityState: geometry.densityState || "",
    issues: uniqueStrings(issues),
  };
}

export function validateGestureOwnershipLockdown(results = []) {
  const normalized = Array.isArray(results) ? results : Object.values(results || {});
  const issues = [];
  for (const result of normalized) {
    if (!result?.owner) issues.push("gesture-owner-required");
    if (result?.singleOwner !== true) issues.push(`gesture-must-have-one-owner:${result?.owner || "unknown"}`);
    if (result?.transferDuringActiveGesture !== false) issues.push(`gesture-transfer-forbidden:${result?.owner || "unknown"}`);
    if (result?.owner === "zone-scroll" && result?.noTransferAtBoundary !== true) issues.push("zone-scroll-must-not-transfer-at-boundary");
  }
  return {
    version: CANONICAL_GAMEPLAY_LOCKDOWN_VERSION,
    baselineId: CANONICAL_GAMEPLAY_BASELINE_ID,
    valid: issues.length === 0,
    issues: uniqueStrings(issues),
  };
}

export function validateResolveEventLockdown({
  resolvePlan = {},
  presentationLedger = {},
  presentationEvent = {},
  replayObservation = {},
} = {}) {
  const issues = [];
  if (resolvePlan.policy?.mode === "live-tracking" && resolvePlan.stackDepth === 1 && resolvePlan.requiredResolveInteractions > 1) {
    issues.push("live-tracking-uncontested-object-must-not-repeat-resolve");
  }
  if (resolvePlan.deterministicCompletion && resolvePlan.requiredResolveInteractions > 1) {
    issues.push("deterministic-completion-must-not-repeat-resolve");
  }
  if (resolvePlan.spellSubstepsAreStackObjects) issues.push("spell-substeps-must-not-be-stack-objects");
  if (presentationLedger.completedEventIds?.includes(presentationEvent.eventId) && presentationEvent.shouldReplayOnRender !== false) {
    issues.push("completed-presentation-event-must-not-replay");
  }
  if (replayObservation.mutatesAuthoritativeState || replayObservation.executesRules) {
    issues.push("replay-must-be-observational");
  }
  return {
    version: CANONICAL_GAMEPLAY_LOCKDOWN_VERSION,
    baselineId: CANONICAL_GAMEPLAY_BASELINE_ID,
    valid: issues.length === 0,
    issues: uniqueStrings(issues),
  };
}

export function validatePresentationStateMutation(beforeAuthoritative = {}, afterAuthoritative = {}) {
  const before = stableSignature(beforeAuthoritative);
  const after = stableSignature(afterAuthoritative);
  const valid = before === after;
  return {
    version: CANONICAL_GAMEPLAY_LOCKDOWN_VERSION,
    baselineId: CANONICAL_GAMEPLAY_BASELINE_ID,
    valid,
    mutatesAuthoritativeState: !valid,
    issues: valid ? [] : ["presentation-action-mutated-authoritative-state"],
  };
}

export function normalizeRestoredPresentationState(input = {}, context = {}) {
  const primaryCommandIds = normalizeStringArray(context.primaryCommandIds || input.primaryCommandIds || []);
  const contextualCommandIds = normalizeStringArray(context.contextualCommandIds || input.contextualCommandIds || []);
  const validCommandIds = [...primaryCommandIds, ...contextualCommandIds];
  const requestedFocus = String(input.commandFocusId || input.focusedCommandId || "");
  const commandFocusId = validCommandIds.includes(requestedFocus)
    ? requestedFocus
    : primaryCommandIds[0] || contextualCommandIds[0] || "";
  const opponents = normalizeStringArray(context.opponentIds || input.opponentIds || []);
  const requestedOpponent = String(input.opponentFocusId || input.focusedOpponentId || "");
  const opponentFocusId = opponents.includes(requestedOpponent) ? requestedOpponent : opponents[0] || "";
  const authoritativeRequiresDecision = Boolean(context.authoritativeState?.mandatoryDecision || context.mandatoryDecision);
  return {
    version: CANONICAL_GAMEPLAY_LOCKDOWN_VERSION,
    baselineId: CANONICAL_GAMEPLAY_BASELINE_ID,
    presentationOnly: true,
    mutatesAuthoritativeState: false,
    commandFocusId,
    commandFocusValid: Boolean(commandFocusId),
    opponentFocusId,
    opponentFocusValid: !opponents.length || opponents.includes(opponentFocusId),
    zoneScrollPositions: normalizeNumberRecord(input.zoneScrollPositions || {}),
    expandedGroupIds: uniqueStrings(input.expandedGroupIds || []),
    mandatoryDecision: authoritativeRequiresDecision ? clonePlain(input.mandatoryDecision || context.authoritativeState?.mandatoryDecision || {}) : null,
    toastQueue: [],
    helperMessage: null,
    hoverId: "",
    activeDrag: null,
    activeGesture: null,
    midSwipe: false,
    expiredContextualCommandIds: normalizeStringArray(input.expiredContextualCommandIds || []),
    completedPresentationEventIds: [],
    replayCompletedEvents: false,
    requiresRefreshRecovery: false,
  };
}

export function validateRestoredPresentationState(restored = {}) {
  const issues = [];
  if (!restored.commandFocusValid || !restored.commandFocusId) issues.push("restore-requires-valid-command-focus");
  if (restored.opponentFocusValid === false) issues.push("restore-requires-valid-opponent-focus");
  if (restored.activeDrag) issues.push("restore-must-clear-active-drag");
  if (restored.activeGesture) issues.push("restore-must-clear-active-gesture");
  if (restored.midSwipe) issues.push("restore-must-not-resume-mid-swipe");
  if ((restored.toastQueue || []).length) issues.push("restore-must-not-resume-completed-toasts");
  if (restored.replayCompletedEvents) issues.push("restore-must-not-replay-completed-events");
  if (restored.mutatesAuthoritativeState) issues.push("restore-must-not-mutate-authoritative-state");
  return {
    version: CANONICAL_GAMEPLAY_LOCKDOWN_VERSION,
    baselineId: CANONICAL_GAMEPLAY_BASELINE_ID,
    valid: issues.length === 0,
    issues: uniqueStrings(issues),
  };
}

export function createLifecycleInterruptionRecoveryState(input = {}, context = {}) {
  const restored = normalizeRestoredPresentationState(input, context);
  return {
    ...restored,
    interruptionSafe: true,
    authoritativeStatePreserved: true,
    completedEventsDoNotReplay: true,
    temporaryGestureStateCleared: true,
    requiresRefreshRecovery: false,
  };
}

export function auditPlatformBoundary(sourceByPath = {}) {
  const webStoragePattern = new RegExp(`\\b${["local", "Storage"].join("")}\\b|\\b${["session", "Storage"].join("")}\\b`);
  const presentationElementPattern = new RegExp(`\\b${["HTML", "Element"].join("")}\\b|\\b${["CSS", "Style", "Declaration"].join("")}\\b`);
  const platformEventPattern = new RegExp(`\\b${["Mouse", "Event"].join("")}\\b|\\b${["Pointer", "Event"].join("")}\\b|\\b${["Keyboard", "Event"].join("")}\\b`);
  const prohibitedPatterns = [
    ["dom-global", /\bdocument\s*\./],
    ["platform-global", /\bwindow\s*\./],
    ["web-storage", webStoragePattern],
    ["browser-navigation", /\bhistory\s*\./],
    ["presentation-element", presentationElementPattern],
    ["platform-event-as-intent", platformEventPattern],
  ];
  const violations = [];
  for (const [path, source] of Object.entries(sourceByPath || {})) {
    for (const [kind, pattern] of prohibitedPatterns) {
      if (pattern.test(String(source || ""))) {
        violations.push({ path, kind });
      }
    }
  }
  return {
    version: CANONICAL_GAMEPLAY_LOCKDOWN_VERSION,
    baselineId: CANONICAL_GAMEPLAY_BASELINE_ID,
    valid: violations.length === 0,
    violations,
  };
}

function law(number, title) {
  return Object.freeze({
    id: `law-${String(number).padStart(2, "0")}`,
    title,
    lockedBy: CANONICAL_GAMEPLAY_BASELINE_ID,
  });
}

function planeswalkersAreFarRight(permanents = []) {
  const firstPlaneswalker = permanents.findIndex((entry) => entry.placementRole === "planeswalker-far-right");
  if (firstPlaneswalker < 0) return true;
  return permanents.slice(firstPlaneswalker).every((entry) => entry.placementRole === "planeswalker-far-right");
}

function supportIsFarRight(permanents = []) {
  const firstSupport = permanents.findIndex((entry) => entry.placementRole === "support-far-right");
  if (firstSupport < 0) return true;
  return permanents.slice(firstSupport).every((entry) => entry.placementRole === "support-far-right");
}

function authoritativeIdsAreUnique(ids = []) {
  return new Set(ids.filter(Boolean)).size === ids.filter(Boolean).length;
}

function createValidationResult(issues = []) {
  return {
    version: CANONICAL_GAMEPLAY_LOCKDOWN_VERSION,
    baselineId: CANONICAL_GAMEPLAY_BASELINE_ID,
    valid: issues.length === 0,
    issues: uniqueStrings(issues),
  };
}

function normalizeStringArray(values = []) {
  return [...new Set((values || []).map((value) => String(value || "")).filter(Boolean))];
}

function uniqueStrings(values = []) {
  return [...new Set((values || []).map((value) => String(value || "")).filter(Boolean))];
}

function normalizeNumberRecord(record = {}) {
  return Object.fromEntries(
    Object.entries(record || {}).map(([key, value]) => [String(key), Number.isFinite(Number(value)) ? Number(value) : 0])
  );
}

function stableSignature(value = {}) {
  if (Array.isArray(value)) {
    return `[${value.map(stableSignature).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${key}:${stableSignature(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}
