import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ARCHITECTURE_CHANGE_CONTRACT,
  ARCHITECTURE_RESPONSIBILITY_MAP,
  CANONICAL_GAMEPLAY_BASELINE_ID,
  CANONICAL_GAMEPLAY_LOCKDOWN_VERSION,
  FUTURE_FEATURE_INTEGRATION_CHECKLIST,
  LOCKDOWN_CANONICAL_GAMEPLAY_LAWS,
  auditPlatformBoundary,
  createArchitectureLockdownBaseline,
  createLifecycleInterruptionRecoveryState,
  normalizeRestoredPresentationState,
  validateArchitectureLockdownBaseline,
  validateBattlefieldLockdown,
  validateCommandHandLockdown,
  validateGestureOwnershipLockdown,
  validatePresentationStateMutation,
  validateResolveEventLockdown,
  validateRestoredPresentationState,
} from "../src/gameplay/architectureLockdown.js";
import {
  createCanonicalBattlefieldGeometry,
} from "../src/gameplay/battlefieldGeometry.js";
import {
  createCardPresentationPayload,
  createGameplayLifecycleEvent,
  createPresentationLedger,
  createReplayObservation,
  createResolveInteractionPlan,
  markPresentationEventPlayed,
} from "../src/gameplay/cardLifecycle.js";
import {
  resolveCommandDeckCardProjection,
  resolveCommandDeckFocusedCard,
  resolveCommandDeckPointerOffsetPx,
  resolveCommandDeckPointerSnapSteps,
  resolveCommandDeckWheelFreeScrollOffsetPx,
  resolveCommandDeckWheelSnapSteps,
} from "../src/gameplay/commandDeckModel.js";
import {
  GESTURE_OWNERS,
  INPUT_INTENTS,
  INPUT_SURFACES,
  createInputIntentPolicy,
  createInteractionPerformanceBudget,
  createTableRadarModel,
  resolveCommandHandVisualCloneIdentity,
  resolveGestureOwnership,
  resolveOpponentFocusNavigation,
} from "../src/gameplay/inputIntent.js";
import { createCanonicalSave, validateCanonicalSave } from "../src/persistence/canonicalPersistence.js";
import { createDefaultProfile, createGameSession, createPermanent } from "../src/state/schema.js";
import { createLandscapeBattlefieldModel } from "../src/ui/landscapeBattlefield.js";

const COMMAND_IDS = Object.freeze([
  "phase",
  "commander",
  "library",
  "rules",
  "remind",
  "undo",
  "battlefield",
  "history",
  "notes",
  "calculator",
  "dice",
  "coin",
  "settings",
  "tablecraft",
]);

function readRepositoryFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function permanent(id, typeLine, extras = {}) {
  return createPermanent({
    id,
    name: extras.name || id,
    typeLine,
    owner: extras.owner || "player",
    controller: extras.controller || "player",
    ...extras,
  });
}

function commandEntriesForCenter(centerIndex, extras = {}) {
  return COMMAND_IDS.map((id, index) => {
    let slotOffset = index - centerIndex;
    if (slotOffset > COMMAND_IDS.length / 2) slotOffset -= COMMAND_IDS.length;
    if (slotOffset < -COMMAND_IDS.length / 2) slotOffset += COMMAND_IDS.length;
    const focused = id === COMMAND_IDS[centerIndex];
    const projection = resolveCommandDeckCardProjection(slotOffset, id === "phase" ? 96 : 10, focused);
    return {
      id,
      commandId: id,
      canonicalCommandId: id,
      visualId: extras.cloneEveryCard ? `${id}:visual:${centerIndex}` : id,
      isClone: Boolean(extras.cloneEveryCard && !focused),
      slotOffset,
      focused,
      highlighted: focused,
      previewOwner: focused ? id : "",
      activationOwner: focused ? id : "",
      zIndex: projection.zIndex,
      hitTestRank: projection.zIndex,
      scale: projection.scale,
      liftZ: projection.liftZ,
    };
  });
}

function makeExtremeBoard() {
  return [
    ...Array.from({ length: 30 }, (_, index) => permanent(`creature-${index}`, "Creature - Soldier", {
      currentPower: 2,
      currentToughness: 2,
      counters: index % 6 === 0 ? { "+1/+1": 1 } : {},
    })),
    ...Array.from({ length: 20 }, (_, index) => permanent(`saproling-${index}`, "Token Creature - Saproling", {
      name: "Saproling Token",
      isToken: true,
      tapped: index >= 16,
      counters: index === 19 ? { "+1/+1": 2 } : {},
    })),
    ...Array.from({ length: 36 }, (_, index) => permanent(`land-${index}`, "Basic Land - Forest", {
      name: "Forest",
      tapped: index % 3 === 0,
    })),
    ...Array.from({ length: 9 }, (_, index) => permanent(`artifact-${index}`, index === 0 ? "Artifact - Equipment" : "Artifact", {
      attachedToId: index === 0 ? "voltron-commander" : "",
    })),
    ...Array.from({ length: 8 }, (_, index) => permanent(`enchantment-${index}`, index === 0 ? "Enchantment - Aura" : "Enchantment", {
      attachedToId: index === 0 ? "voltron-commander" : "",
    })),
    ...Array.from({ length: 5 }, (_, index) => permanent(`planeswalker-${index}`, "Planeswalker - Test", {
      loyalty: 4 + index,
      counters: { Loyalty: 4 + index },
    })),
    permanent("voltron-commander", "Legendary Creature - Dragon", {
      isCommander: true,
      attachments: ["artifact-0", "enchantment-0"],
      counters: { "+1/+1": 8, Shield: 1 },
      currentPower: 13,
      currentToughness: 13,
    }),
  ];
}

function stackSession({ stackDepth = 1, pending = [], actionKind = "" } = {}) {
  return {
    ...createGameSession(),
    gameTracking: { active: true, mode: "live-tracking" },
    stack: Array.from({ length: stackDepth }, (_, index) => ({
      id: `stack-${index + 1}`,
      name: index === 0 ? "Current Spell" : `Response ${index + 1}`,
      controller: index === 0 ? "player" : "opponent",
      objectType: "spell",
      card: { name: index === 0 ? "Current Spell" : `Response ${index + 1}`, typeLine: "Instant" },
    })),
    pendingEffects: pending,
    priority: { activePlayerId: "local-player", passedPlayerIds: [], responderIds: [], waiting: false },
    actionKind,
  };
}

test("Part 6 baseline locks canonical laws, responsibility map, and future-change contract", () => {
  const baseline = createArchitectureLockdownBaseline();
  const validation = validateArchitectureLockdownBaseline(baseline);

  assert.equal(baseline.version, CANONICAL_GAMEPLAY_LOCKDOWN_VERSION);
  assert.equal(baseline.baselineId, CANONICAL_GAMEPLAY_BASELINE_ID);
  assert.equal(validation.valid, true, validation.issues.join(", "));
  assert.equal(LOCKDOWN_CANONICAL_GAMEPLAY_LAWS.length, 40);
  assert.equal(new Set(LOCKDOWN_CANONICAL_GAMEPLAY_LAWS.map((entry) => entry.id)).size, 40);
  assert.equal(ARCHITECTURE_RESPONSIBILITY_MAP.commandHandCanonicalFocus.includes("src/gameplay/commandDeckModel.js"), true);
  assert.equal(ARCHITECTURE_RESPONSIBILITY_MAP.resolution.includes("src/gameplay/cardLifecycle.js"), true);
  assert.equal(ARCHITECTURE_RESPONSIBILITY_MAP.platformAdapters.includes("src/platform/runtimeEnvironment.js"), true);
  assert.equal(ARCHITECTURE_CHANGE_CONTRACT.explicitMigrationRequired, true);
  assert.equal(FUTURE_FEATURE_INTEGRATION_CHECKLIST.includes("platform-portability-impact"), true);
});

test("Part 6 Command Hand guardrails enforce one centered frontmost focus, clone identity, snap, and contextual safety", () => {
  for (let centerIndex = 0; centerIndex < COMMAND_IDS.length; centerIndex += 1) {
    const entries = commandEntriesForCenter(centerIndex, { cloneEveryCard: true });
    const focused = resolveCommandDeckFocusedCard(entries);
    const validation = validateCommandHandLockdown(entries, {
      persistentCommandIds: COMMAND_IDS,
      finalPersistentCommandIds: COMMAND_IDS,
    });

    assert.equal(focused.id, COMMAND_IDS[centerIndex]);
    assert.equal(validation.valid, true, `${COMMAND_IDS[centerIndex]}: ${validation.issues.join(", ")}`);
    assert.equal(validation.focusedId, COMMAND_IDS[centerIndex]);
    assert.equal(validation.centeredId, COMMAND_IDS[centerIndex]);
    assert.equal(validation.topZOrderId, COMMAND_IDS[centerIndex]);
    assert.equal(validation.topHitTestId, COMMAND_IDS[centerIndex]);
  }

  const partialOffset = resolveCommandDeckPointerOffsetPx(36);
  assert.equal(partialOffset, 36);
  assert.equal(resolveCommandDeckPointerSnapSteps(partialOffset), 0);
  assert.equal(resolveCommandDeckPointerSnapSteps(resolveCommandDeckPointerOffsetPx(-160)), 2);
  assert.equal(resolveCommandDeckWheelSnapSteps(-9999), -3);
  assert.equal(resolveCommandDeckWheelFreeScrollOffsetPx(-9999), 222);

  const reversed = validateCommandHandLockdown(commandEntriesForCenter(COMMAND_IDS.length - 1), {
    persistentCommandIds: COMMAND_IDS,
    finalPersistentCommandIds: COMMAND_IDS,
  });
  assert.equal(reversed.valid, true);

  const clone = resolveCommandHandVisualCloneIdentity({ visualId: "resolve-copy-left", commandId: "resolve", isClone: true });
  assert.equal(clone.logicalCommandId, "resolve");
  assert.equal(clone.createsIndependentCommand, false);

  const contextual = validateCommandHandLockdown([
    ...commandEntriesForCenter(0),
    {
      id: "resolve",
      canonicalCommandId: "resolve",
      slotOffset: 2.5,
      focused: false,
      highlighted: false,
      previewOwner: "",
      activationOwner: "",
      zIndex: 20,
      hitTestRank: 20,
      contextual: true,
    },
  ], {
    persistentCommandIds: COMMAND_IDS,
    finalPersistentCommandIds: COMMAND_IDS,
  });
  assert.equal(contextual.valid, true, contextual.issues.join(", "));
});

test("Part 6 battlefield guardrails protect geography, density, local overflow, and authoritative identity", () => {
  const empty = createCanonicalBattlefieldGeometry([], { role: "local", viewport: "phone-landscape", playerCount: 2 });
  assert.equal(validateBattlefieldLockdown(empty).valid, true);
  assert.equal(empty.creatureZone.verticalScrollAllowed, false);
  assert.equal(empty.lowerZone.verticalScrollAllowed, false);

  const normal = createCanonicalBattlefieldGeometry([
    ...Array.from({ length: 8 }, (_, index) => permanent(`land-normal-${index}`, "Basic Land - Plains")),
    ...Array.from({ length: 6 }, (_, index) => permanent(`creature-normal-${index}`, "Creature - Knight")),
    permanent("walker-a", "Planeswalker - Elspeth", { loyalty: 5 }),
    permanent("walker-b", "Planeswalker - Teferi", { loyalty: 4 }),
    permanent("rock-a", "Artifact"),
    permanent("aura-a", "Enchantment - Aura", { attachedToId: "creature-normal-0" }),
  ], { role: "local", viewport: "desktop", playerCount: 4 });
  const normalValidation = validateBattlefieldLockdown(normal);
  assert.equal(normalValidation.valid, true, normalValidation.issues.join(", "));
  assert.deepEqual(normal.creatureZone.permanents.slice(-2).map((entry) => entry.placementRole), [
    "planeswalker-far-right",
    "planeswalker-far-right",
  ]);
  assert.deepEqual(normal.lowerZone.permanents.slice(-2).map((entry) => entry.placementRole), [
    "support-far-right",
    "support-far-right",
  ]);
  assert.equal(normal.creatureZone.horizontalScrollAllowed, false);
  assert.equal(normal.lowerZone.horizontalScrollAllowed, false);

  const extremeBoard = makeExtremeBoard();
  const extreme = createCanonicalBattlefieldGeometry(extremeBoard, { role: "local", viewport: "phone-landscape", playerCount: 4 });
  const extremeValidation = validateBattlefieldLockdown(extreme);
  assert.equal(extremeBoard.length >= 100, true);
  assert.equal(extremeValidation.valid, true, extremeValidation.issues.join(", "));
  assert.equal(extreme.creatureZone.horizontalScrollAllowed, true);
  assert.equal(extreme.lowerZone.horizontalScrollAllowed, true);
  assert.equal(extreme.creatureZone.overflowMode, "zone-local-horizontal-scroll");
  assert.equal(extreme.lowerZone.overflowMode, "zone-local-horizontal-scroll");
  assert.equal(new Set(extreme.authoritativeObjectIds).size, extremeBoard.length);
  assert.ok(extreme.creatureZone.stacking.some((group) => group.key.includes("Saproling Token")));
});

test("Part 6 multiplayer and gesture guardrails keep navigation, zone scroll, and targeting separate", () => {
  const policy = createInputIntentPolicy({ viewport: "phone-landscape", width: 844, height: 390 });
  const gestures = {
    commandHand: resolveGestureOwnership({ surface: INPUT_SURFACES.commandHand, movementX: 96, movementY: 4 }, policy),
    zoneScroll: resolveGestureOwnership({ surface: INPUT_SURFACES.overflowingZone, zoneOverflowing: true, movementX: 96, movementY: 2 }, policy),
    opponentNavigation: resolveGestureOwnership({ surface: INPUT_SURFACES.opponentBackground, opponentBackground: true, movementX: 96, movementY: 2 }, policy),
    targetingZoneScroll: resolveGestureOwnership({ targetingActive: true, surface: INPUT_SURFACES.overflowingZone, zoneOverflowing: true, movementX: 96, movementY: 2 }, policy),
    cardDrag: resolveGestureOwnership({ surface: INPUT_SURFACES.card, cardDragActive: true, zoneOverflowing: true, movementX: 28, movementY: 6 }, policy),
  };

  const validation = validateGestureOwnershipLockdown(gestures);
  assert.equal(validation.valid, true, validation.issues.join(", "));
  assert.equal(gestures.commandHand.owner, GESTURE_OWNERS.commandHand);
  assert.equal(gestures.commandHand.intent, INPUT_INTENTS.rotateCommandHand);
  assert.equal(gestures.zoneScroll.owner, GESTURE_OWNERS.zoneScroll);
  assert.equal(gestures.zoneScroll.noTransferAtBoundary, true);
  assert.equal(gestures.opponentNavigation.owner, GESTURE_OWNERS.opponentNavigation);
  assert.equal(gestures.targetingZoneScroll.owner, GESTURE_OWNERS.zoneScroll);
  assert.equal(gestures.cardDrag.owner, GESTURE_OWNERS.cardDrag);

  const opponents = [
    { id: "opponent-a", life: 40 },
    { id: "opponent-b", life: 37 },
    { id: "opponent-c", life: 21, activeTurn: true },
  ];
  const navigation = resolveOpponentFocusNavigation(opponents, "opponent-c", 1);
  assert.equal(navigation.enabled, true);
  assert.equal(navigation.arrowsVisible, true);
  assert.equal(navigation.circular, true);
  assert.equal(navigation.nextOpponentId, "opponent-a");
  assert.equal(navigation.opponentSwitchMovesLocalBattlefield, false);

  const radar = createTableRadarModel([{ id: "local-player", life: 40 }, ...opponents], {
    focusedOpponentId: "opponent-b",
    activePlayerId: "opponent-c",
  });
  assert.equal(radar.duplicatesBattlefields, false);
  assert.equal(radar.entries.find((entry) => entry.id === "opponent-b").focused, true);
  assert.equal(radar.entries.find((entry) => entry.id === "opponent-c").activeTurn, true);
});

test("Part 6 resolve, event identity, animation, replay, and notification guardrails stay idempotent", () => {
  const single = createResolveInteractionPlan(stackSession({ stackDepth: 1 }), { mode: "live-tracking" });
  assert.equal(single.requiredResolveInteractions, 1);
  assert.equal(single.deterministicCompletion, true);
  assert.equal(single.spellSubstepsAreStackObjects, false);

  const trueStack = createResolveInteractionPlan(stackSession({ stackDepth: 3 }), { mode: "live-tracking" });
  assert.equal(trueStack.requiredResolveInteractions, 1);
  assert.equal(trueStack.repeatedResolveAllowed, true);

  const land = createResolveInteractionPlan(stackSession(), { mode: "live-tracking", actionKind: "land-play" });
  assert.equal(land.requiredResolveInteractions, 0);
  assert.equal(land.reason, "direct-deterministic-action");

  const pendingDecision = { id: "target-choice", stackObjectId: "stack-1", status: "pending", effect: { manual: true } };
  const targeted = createResolveInteractionPlan(stackSession({ pending: [pendingDecision] }), { mode: "live-tracking" });
  assert.equal(targeted.requiredResolveInteractions, 0);
  assert.equal(Boolean(targeted.nextDecision), true);

  const event = createGameplayLifecycleEvent({
    eventType: "cast",
    card: { id: "spell-a", name: "Cultivate" },
    controller: "player",
    eventId: "event-cast-cultivate",
  });
  const presentation = createCardPresentationPayload({ id: "spell-a", name: "Cultivate" }, "cast", "player", {
    eventId: event.eventId,
  });
  let ledger = createPresentationLedger();
  ledger = markPresentationEventPlayed(ledger, presentation);
  const replay = createReplayObservation(event);
  const validation = validateResolveEventLockdown({
    resolvePlan: single,
    presentationLedger: ledger,
    presentationEvent: presentation,
    replayObservation: replay,
  });
  assert.equal(validation.valid, true, validation.issues.join(", "));
  assert.equal(ledger.completedEventIds.includes(event.eventId), true);
  assert.equal(presentation.shouldReplayOnRender, false);
  assert.equal(replay.mutatesAuthoritativeState, false);
  assert.equal(replay.executesRules, false);
});

test("Part 6 presentation-only actions, save/restore, and lifecycle interruption cannot mutate authoritative state", () => {
  const authoritativeBefore = {
    life: 40,
    battlefield: { player: ["forest", "sol-ring"], opponents: { "opponent-a": ["zombie"] } },
    counters: { "sol-ring": { charge: 2 } },
    stack: ["stack-1"],
    triggers: ["trigger-1"],
    turn: 4,
    priority: "local-player",
    targets: ["zombie"],
    commanderDamage: { "opponent-a": 3 },
  };
  const presentationActions = [
    "rotate-command-hand",
    "scroll-creature-zone",
    "scroll-land-support-zone",
    "switch-opponent",
    "open-inspection",
    "close-inspection",
    "expand-visual-group",
    "collapse-visual-group",
    "receive-notification",
  ];

  for (const action of presentationActions) {
    const authoritativeAfter = JSON.parse(JSON.stringify(authoritativeBefore));
    const validation = validatePresentationStateMutation(authoritativeBefore, authoritativeAfter, { action });
    assert.equal(validation.valid, true, action);
    assert.equal(validation.mutatesAuthoritativeState, false, action);
  }

  const restored = normalizeRestoredPresentationState({
    commandFocusId: "stale-visual-clone",
    opponentFocusId: "removed-opponent",
    zoneScrollPositions: { "opponent-a:creature-zone": 120, "opponent-b:land-support-zone": 48 },
    expandedGroupIds: ["saprolings", "saprolings", "treasures"],
    toastQueue: [{ id: "old-toast" }],
    activeDrag: { id: "card" },
    activeGesture: { owner: "zone-scroll" },
    midSwipe: true,
  }, {
    primaryCommandIds: COMMAND_IDS,
    opponentIds: ["opponent-a", "opponent-b"],
  });
  const restoreValidation = validateRestoredPresentationState(restored);
  assert.equal(restored.commandFocusId, "phase");
  assert.equal(restored.opponentFocusId, "opponent-a");
  assert.equal(restored.activeDrag, null);
  assert.equal(restored.activeGesture, null);
  assert.equal(restored.midSwipe, false);
  assert.equal(restored.toastQueue.length, 0);
  assert.equal(restored.replayCompletedEvents, false);
  assert.equal(restoreValidation.valid, true, restoreValidation.issues.join(", "));

  const interrupted = createLifecycleInterruptionRecoveryState(restored, {
    primaryCommandIds: COMMAND_IDS,
    opponentIds: ["opponent-a", "opponent-b"],
  });
  assert.equal(interrupted.authoritativeStatePreserved, true);
  assert.equal(interrupted.completedEventsDoNotReplay, true);
  assert.equal(interrupted.temporaryGestureStateCleared, true);
  assert.equal(interrupted.requiresRefreshRecovery, false);

  const profile = createDefaultProfile();
  profile.activeSession.presentation = { eventId: "completed-cast", state: "completed" };
  profile.activeSession.selectedIds = ["transient-selection"];
  profile.activeSession.battlefield.player = [permanent("sol-ring", "Artifact")];
  const save = createCanonicalSave(profile, { saveId: "save-part6-lock" });
  const saveValidation = validateCanonicalSave(save);
  assert.equal(saveValidation.valid, true, saveValidation.errors?.join(", "));
  assert.equal(save.stateSnapshot.presentation, undefined);
  assert.equal(save.stateSnapshot.selectedIds, undefined);
});

test("Part 6 landscape model exposes the locked baseline and preserves Part 5 responsive/performance contracts", () => {
  const profile = createDefaultProfile();
  profile.activeSession.battlefield.player = makeExtremeBoard();
  const model = createLandscapeBattlefieldModel(profile, {
    viewport: "phone-landscape",
    width: 844,
    height: 390,
    perspective: {
      localPlayerId: "local-player",
      playerCount: 4,
      opponentBoards: [
        { id: "opponent-a", permanents: [permanent("a-creature", "Creature - Zombie")] },
        { id: "opponent-b", permanents: Array.from({ length: 30 }, (_, index) => permanent(`b-creature-${index}`, "Creature - Soldier")) },
        { id: "opponent-c", permanents: Array.from({ length: 38 }, (_, index) => permanent(`c-land-${index}`, "Basic Land - Island")) },
      ],
    },
    focusedOpponentId: "opponent-b",
  });

  assert.equal(model.canonicalGameplay.architectureLock.baselineId, CANONICAL_GAMEPLAY_BASELINE_ID);
  assert.equal(model.canonicalGameplay.architectureLock.version, CANONICAL_GAMEPLAY_LOCKDOWN_VERSION);
  assert.equal(model.responsiveComposition.fixedGameplayViewport, true);
  assert.equal(model.responsiveComposition.verticalGameplayScroll, false);
  assert.equal(model.opponentCarousel.loopNavigation, true);
  assert.equal(model.opponentCarousel.gestureOwnership.localBattlefieldMoves, false);
  assert.equal(model.opponentBattlefield.tabletop.creatureZone.horizontalScrollAllowed, true);
  assert.equal(model.performance.commandHandRerendersBattlefield, false);
  assert.equal(model.performance.opponentSwitchRecomputesRules, false);

  const budget = createInteractionPerformanceBudget({ permanentCount: 180, opponentCount: 3 });
  assert.equal(budget.commandHandRerendersBattlefield, false);
  assert.equal(budget.zoneScrollRerendersOtherZones, false);
  assert.equal(budget.rulesRunOnAnimationFrame, false);
  assert.ok(budget.interactionTargets.includes("command-hand-rotation"));
});

test("Part 6 static lockdown audit covers docs, renderer markers, portability boundaries, and legacy-path activation", () => {
  const docs = readRepositoryFile("docs/ecosystem/CANONICAL_GAMEPLAY_ARCHITECTURE.md");
  const render = readRepositoryFile("src/ui/render.js");
  const styles = readRepositoryFile("src/styles.css");
  const sharedFiles = [
    "src/gameplay/canonicalGameplay.js",
    "src/gameplay/battlefieldGeometry.js",
    "src/gameplay/cardLifecycle.js",
    "src/gameplay/commandDeckModel.js",
    "src/gameplay/inputIntent.js",
    "src/gameplay/architectureLockdown.js",
  ];

  assert.match(docs, /Part 6 Architecture Lock Baseline/i);
  assert.match(docs, /boardstate-13\.2\.6-locked-baseline/);
  assert.match(docs, /Part 6 Responsibility Map/i);
  assert.match(docs, /Part 6 Future Feature Integration Contract/i);
  assert.match(docs, /Part 6 SwiftUI \/ Native Adaptation Contract/i);
  assert.match(docs, /test\/canonical-gameplay-part6\.test\.js/);

  assert.match(render, /CANONICAL_GAMEPLAY_BASELINE_ID/);
  assert.match(render, /data-canonical-gameplay-baseline-id/);
  assert.match(render, /data-canonical-gameplay-lockdown-version/);
  assert.match(render, /data-command-hand-focus-contract="exactly-one-centered-frontmost-command"/);
  assert.match(render, /data-depth-aware-hit-testing="true"/);
  assert.match(render, /data-zone-scroll-competes="false"/);
  assert.match(render, /data-global-vertical-scroll="false"/);
  assert.doesNotMatch(render, /Resolve notification/i);

  assert.match(styles, /body\[data-page="battlefield"\][\s\S]*overflow:\s*hidden/);
  assert.match(styles, /zone-local-horizontal-scroll/);
  assert.match(styles, /--protected-command-hand-clearance/);
  assert.match(styles, /touch-action:\s*none/);

  const sourceByPath = Object.fromEntries(sharedFiles.map((filePath) => [filePath, readRepositoryFile(filePath)]));
  const audit = auditPlatformBoundary(sourceByPath);
  assert.equal(audit.valid, true, audit.violations.map((entry) => `${entry.path}:${entry.kind}`).join(", "));

  for (const filePath of sharedFiles) {
    const source = sourceByPath[filePath];
    assert.equal(/document\.|window\.|localStorage|sessionStorage|HTMLElement|MouseEvent|PointerEvent|CSSStyleDeclaration/.test(source), false, filePath);
  }
});
