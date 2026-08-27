import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  BATTLEFIELD_OVERFLOW_ORDER,
  CANONICAL_BATTLEFIELD_GEOMETRY_VERSION,
  createCanonicalBattlefieldGeometry,
  resolveBattlefieldDensityState,
} from "../src/gameplay/battlefieldGeometry.js";
import {
  COMMAND_DECK_MAX_FREE_SCROLL_STEPS,
  COMMAND_DECK_SCROLL_PX_PER_CARD,
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
  createAccessibilitySemanticsModel,
  createInputIntentPolicy,
  createInteractionPerformanceBudget,
  createTableRadarModel,
  resolveCommandHandVisualCloneIdentity,
  resolveGestureOwnership,
  resolveResponsiveLandscapeComposition,
  validateCommandHandFocusState,
} from "../src/gameplay/inputIntent.js";
import {
  CARD_PRESENTATION_ROLES,
  GAMEPLAY_EVENT_TYPES,
  GAMEPLAY_MODES,
  NOTIFICATION_PRIORITY_LEVELS,
  classifyNotificationPriority,
  createGameplayLifecycleEvent,
  createModeInteractionPolicy,
  createPresentationLedger,
  createPreviewState,
  createReplayObservation,
  createResolveInteractionPlan,
  dismissPreviewState,
  markPresentationEventPlayed,
  shouldDeferNotification,
  shouldPlayPresentationEvent,
} from "../src/gameplay/cardLifecycle.js";
import { castSpellToStack, resolveTopOfStack } from "../src/effects/effectEngine.js";
import { createDefaultProfile, createGameSession, createPermanent } from "../src/state/schema.js";
import { createAction } from "../src/state/actions.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createRuntimeEnvironment } from "../src/platform/runtimeEnvironment.js";
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

function makeOpponent(id, permanents = [], extras = {}) {
  return {
    id,
    playerId: id,
    name: extras.name || id,
    life: extras.life ?? 40,
    permanents,
    ...extras,
  };
}

function makeExtremeBoard() {
  return [
    ...Array.from({ length: 28 }, (_, index) =>
      permanent(`creature-${index}`, "Creature - Soldier", {
        currentPower: 2,
        currentToughness: 2,
        counters: index % 7 === 0 ? { "+1/+1": 1 } : {},
      })
    ),
    ...Array.from({ length: 18 }, (_, index) =>
      permanent(`goblin-token-${index}`, "Token Creature - Goblin", {
        name: "Goblin Token",
        isToken: true,
        currentPower: 1,
        currentToughness: 1,
        tapped: index >= 14,
        counters: index === 17 ? { "+1/+1": 2 } : {},
      })
    ),
    ...Array.from({ length: 36 }, (_, index) =>
      permanent(`land-${index}`, "Basic Land - Forest", {
        name: "Forest",
        tapped: index % 3 === 0,
      })
    ),
    ...Array.from({ length: 10 }, (_, index) =>
      permanent(`artifact-${index}`, "Artifact", {
        name: index < 4 ? "Treasure Token" : `Artifact ${index}`,
        isToken: index < 4,
      })
    ),
    ...Array.from({ length: 8 }, (_, index) => permanent(`enchantment-${index}`, "Enchantment")),
    ...Array.from({ length: 5 }, (_, index) =>
      permanent(`planeswalker-${index}`, "Planeswalker - Test", {
        loyalty: 4 + index,
        counters: { Loyalty: 4 + index },
      })
    ),
    permanent("voltron-commander", "Legendary Creature - Dragon", {
      isCommander: true,
      attachments: ["sword-a", "aura-a", "boots-a"],
      counters: { "+1/+1": 8, Shield: 1 },
      currentPower: 13,
      currentToughness: 13,
    }),
  ];
}

function commandEntriesForCenter(centerIndex) {
  return COMMAND_IDS.map((id, index) => {
    let slotOffset = index - centerIndex;
    if (slotOffset > COMMAND_IDS.length / 2) slotOffset -= COMMAND_IDS.length;
    if (slotOffset < -COMMAND_IDS.length / 2) slotOffset += COMMAND_IDS.length;
    const focused = id === COMMAND_IDS[centerIndex];
    const projection = resolveCommandDeckCardProjection(slotOffset, id === "phase" ? 96 : 10, focused);
    return {
      id,
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

function stackSession({ stackDepth = 1, pending = [], stackObject = {} } = {}) {
  const stack = Array.from({ length: stackDepth }, (_, index) => ({
    id: index === 0 ? stackObject.id || "stack-1" : `stack-${index + 1}`,
    name: index === 0 ? stackObject.name || "Current Spell" : `Response ${index + 1}`,
    controller: index === 0 ? stackObject.controller || "player" : "opponent",
    objectType: stackObject.objectType || "spell",
    card: stackObject.card || { name: stackObject.name || "Current Spell", typeLine: "Instant" },
    ...stackObject,
  }));
  return {
    ...createGameSession(),
    gameTracking: { active: true, mode: GAMEPLAY_MODES.liveTracking },
    stack,
    pendingEffects: pending,
    priority: { activePlayerId: "local-player", passedPlayerIds: [], responderIds: [], waiting: false },
  };
}

test("Part 5 master battlefield matrix preserves tabletop geography, density escalation, and object identity", () => {
  const empty = createCanonicalBattlefieldGeometry([], { role: "local", viewport: "phone-landscape", playerCount: 2 });
  assert.equal(empty.version, CANONICAL_BATTLEFIELD_GEOMETRY_VERSION);
  assert.equal(empty.densityState, "empty");
  assert.equal(empty.creatureZone.verticalScrollAllowed, false);
  assert.equal(empty.lowerZone.verticalScrollAllowed, false);
  assert.equal(empty.creatureZone.horizontalScrollAllowed, false);
  assert.equal(empty.lowerZone.horizontalScrollAllowed, false);

  const early = createCanonicalBattlefieldGeometry([
    permanent("forest-a", "Basic Land - Forest"),
    permanent("island-a", "Basic Land - Island"),
    permanent("elf", "Creature - Elf", { currentPower: 1, currentToughness: 1 }),
  ], { role: "local", viewport: "desktop", playerCount: 2 });
  assert.equal(early.densityState, "sparse");
  assert.equal(early.creatureZone.horizontalScrollAllowed, false);
  assert.equal(early.lowerZone.horizontalScrollAllowed, false);
  assert.equal(early.creatureZone.permanents[0].placementRole, "creature");
  assert.equal(early.lowerZone.permanents[0].placementRole, "land");

  const normal = createCanonicalBattlefieldGeometry([
    ...Array.from({ length: 8 }, (_, index) => permanent(`normal-land-${index}`, "Basic Land - Plains")),
    ...Array.from({ length: 6 }, (_, index) => permanent(`normal-creature-${index}`, "Creature - Knight")),
    permanent("normal-walker", "Planeswalker - Elspeth", { loyalty: 5 }),
    permanent("normal-artifact", "Artifact"),
    permanent("normal-enchantment", "Enchantment"),
  ], { role: "local", viewport: "desktop", playerCount: 4 });
  assert.equal(normal.densityState, "normal");
  assert.equal(normal.creatureZone.permanents.at(-1).placementRole, "planeswalker-far-right");
  assert.equal(normal.lowerZone.permanents.at(8).placementRole, "support-far-right");
  assert.equal(normal.creatureZone.layoutMode, "adaptive-spacing");

  const busy = createCanonicalBattlefieldGeometry([
    ...Array.from({ length: 15 }, (_, index) => permanent(`busy-land-${index}`, "Basic Land - Mountain")),
    ...Array.from({ length: 10 }, (_, index) => permanent(`busy-creature-${index}`, "Creature - Goblin")),
    ...Array.from({ length: 4 }, (_, index) => permanent(`busy-artifact-${index}`, "Artifact")),
    ...Array.from({ length: 3 }, (_, index) => permanent(`busy-enchantment-${index}`, "Enchantment")),
    ...Array.from({ length: 3 }, (_, index) => permanent(`busy-walker-${index}`, "Planeswalker - Chandra")),
  ], { role: "local", viewport: "desktop", playerCount: 4 });
  assert.equal(busy.densityState, "busy");
  assert.equal(busy.overflowOrder, BATTLEFIELD_OVERFLOW_ORDER);
  assert.notEqual(busy.creatureZone.layoutMode, "zone-local-horizontal-scroll");
  assert.notEqual(busy.lowerZone.layoutMode, "zone-local-horizontal-scroll");

  const extremeBoard = makeExtremeBoard();
  const extreme = createCanonicalBattlefieldGeometry(extremeBoard, { role: "local", viewport: "phone-landscape", playerCount: 4 });
  assert.equal(resolveBattlefieldDensityState({ permanentCount: extremeBoard.length, tokenCount: 18, viewport: "phone-landscape", playerCount: 4 }), "extreme");
  assert.equal(extreme.densityState, "extreme");
  assert.equal(extreme.creatureZone.horizontalScrollAllowed, true);
  assert.equal(extreme.lowerZone.horizontalScrollAllowed, true);
  assert.equal(extreme.creatureZone.verticalScrollAllowed, false);
  assert.equal(extreme.lowerZone.verticalScrollAllowed, false);
  assert.equal(extreme.authoritativeObjectIds.length, extremeBoard.length);
  assert.equal(new Set(extreme.authoritativeObjectIds).size, extremeBoard.length);
  assert.ok(extreme.creatureZone.stacking.some((group) => group.key.includes("Goblin Token") && group.quantity >= 14));
  assert.ok(extreme.creatureZone.stacking.every((group) => group.ids.every((id) => extreme.authoritativeObjectIds.includes(id))));
});

test("Part 5 specialty board states keep planeswalkers, support permanents, tokens, and attachments readable", () => {
  const superfriends = createCanonicalBattlefieldGeometry([
    permanent("creature-a", "Creature - Angel"),
    permanent("pw-1", "Planeswalker - Ajani", { loyalty: 4 }),
    permanent("pw-2", "Planeswalker - Tamiyo", { loyalty: 6 }),
    permanent("pw-3", "Planeswalker - Teferi", { loyalty: 5 }),
  ], { role: "local", viewport: "desktop", playerCount: 4 });
  assert.deepEqual(superfriends.planeswalkerPlacement.renderOrder, ["pw-3", "pw-2", "pw-1"]);
  assert.deepEqual(superfriends.creatureZone.permanents.slice(-3).map((entry) => entry.placementRole), [
    "planeswalker-far-right",
    "planeswalker-far-right",
    "planeswalker-far-right",
  ]);

  const supportBoard = createCanonicalBattlefieldGeometry([
    permanent("land-a", "Basic Land - Swamp"),
    permanent("rock-a", "Artifact"),
    permanent("equipment-a", "Artifact - Equipment", { attachedToId: "voltron" }),
    permanent("enchantment-a", "Enchantment"),
    permanent("aura-a", "Enchantment - Aura", { attachedToId: "voltron" }),
  ], { role: "local", viewport: "desktop", playerCount: 4 });
  assert.equal(supportBoard.supportPlacement.landCount, 1);
  assert.equal(supportBoard.supportPlacement.supportCount, 4);
  assert.deepEqual(supportBoard.lowerZone.permanents.slice(1).map((entry) => entry.placementRole), [
    "support-far-right",
    "support-far-right",
    "support-far-right",
    "support-far-right",
  ]);
  assert.equal(supportBoard.lowerZone.permanents.find((entry) => entry.id === "equipment-a").attachedToId, "voltron");
  assert.equal(supportBoard.lowerZone.permanents.find((entry) => entry.id === "aura-a").attachedToId, "voltron");

  const tokenSwarm = createCanonicalBattlefieldGeometry([
    ...Array.from({ length: 12 }, (_, index) => permanent(`token-ready-${index}`, "Token Creature - Saproling", { name: "Saproling Token", isToken: true })),
    permanent("token-tapped", "Token Creature - Saproling", { name: "Saproling Token", isToken: true, tapped: true }),
    permanent("token-countered", "Token Creature - Saproling", { name: "Saproling Token", isToken: true, counters: { "+1/+1": 1 } }),
  ], { role: "local", viewport: "desktop", playerCount: 4 });
  const groupedReady = tokenSwarm.creatureZone.stacking.find((group) => group.key.includes("Saproling Token") && group.quantity === 12);
  assert.ok(groupedReady);
  assert.equal(tokenSwarm.creatureZone.authoritativeObjectIds.includes("token-tapped"), true);
  assert.equal(tokenSwarm.creatureZone.authoritativeObjectIds.includes("token-countered"), true);
});

test("Part 5 multiplayer navigation keeps local state anchored and separates opponent switching from zone scroll", () => {
  const profile = createDefaultProfile();
  profile.activeSession.battlefield.player = [
    permanent("local-land", "Basic Land - Forest"),
    permanent("local-creature", "Creature - Elf"),
  ];
  const opponents = [
    makeOpponent("opponent-a", [permanent("a-creature", "Creature - Zombie")]),
    makeOpponent("opponent-b", Array.from({ length: 30 }, (_, index) => permanent(`b-creature-${index}`, "Creature - Soldier"))),
    makeOpponent("opponent-c", Array.from({ length: 38 }, (_, index) => permanent(`c-land-${index}`, "Basic Land - Island"))),
  ];
  const perspective = {
    localPlayerId: "local-player",
    playerCount: 4,
    opponentBoards: opponents,
    focusedOpponentId: "opponent-a",
    promptOwnership: { activePlayerId: "opponent-c" },
  };
  const modelA = createLandscapeBattlefieldModel(profile, {
    viewport: "phone-landscape",
    width: 844,
    height: 390,
    focusedOpponentId: "opponent-a",
    perspective,
  });
  const modelB = createLandscapeBattlefieldModel(profile, {
    viewport: "phone-landscape",
    width: 844,
    height: 390,
    focusedOpponentId: "opponent-b",
    perspective,
  });
  const modelC = createLandscapeBattlefieldModel(profile, {
    viewport: "phone-landscape",
    width: 844,
    height: 390,
    focusedOpponentId: "opponent-c",
    perspective,
  });

  assert.equal(modelA.opponentCarousel.enabled, true);
  assert.equal(modelA.opponentCarousel.arrowsVisible, true);
  assert.equal(modelA.opponentCarousel.loopNavigation, true);
  assert.equal(modelA.opponentCarousel.gestureOwnership.localBattlefieldMoves, false);
  assert.deepEqual(modelA.localBattlefield.presentationState.zoneScrollMemory, modelB.localBattlefield.presentationState.zoneScrollMemory);
  assert.equal(modelB.opponentBattlefield.tabletop.creatureZone.horizontalScrollAllowed, true);
  assert.equal(modelB.opponentBattlefield.tabletop.lowerZone.horizontalScrollAllowed, false);
  assert.equal(modelC.opponentBattlefield.tabletop.lowerZone.horizontalScrollAllowed, true);
  assert.equal(modelC.opponentBattlefield.tabletop.creatureZone.horizontalScrollAllowed, false);
  assert.equal(modelA.gameplayFlow.inputIntent.gestureOwnership.opponentNavigation.intent, INPUT_INTENTS.switchOpponent);
  assert.equal(modelB.gameplayFlow.inputIntent.gestureOwnership.overflowingZone.intent, INPUT_INTENTS.scrollZone);
  assert.equal(modelB.gameplayFlow.inputIntent.gestureOwnership.overflowingZone.noTransferAtBoundary, true);

  const radar = createTableRadarModel(
    [{ id: "local-player", life: 40 }, ...opponents],
    { focusedOpponentId: "opponent-b", activePlayerId: "opponent-c" }
  );
  assert.equal(radar.duplicatesBattlefields, false);
  assert.equal(radar.entries.find((entry) => entry.id === "opponent-b").focused, true);
  assert.equal(radar.entries.find((entry) => entry.id === "opponent-c").activeTurn, true);

  const twoPlayer = createLandscapeBattlefieldModel(profile, {
    viewport: "desktop",
    perspective: { localPlayerId: "local-player", playerCount: 2, opponentBoards: [opponents[0]] },
  });
  assert.equal(twoPlayer.opponentCarousel.enabled, false);
  assert.equal(twoPlayer.opponentCarousel.arrowsVisible, false);
});

test("Part 5 input contamination matrix has one owner for command hand, zones, opponents, targeting, and drag", () => {
  const policy = createInputIntentPolicy({ viewport: "phone-landscape", width: 844, height: 390 });
  const matrix = [
    [
      "command-hand swipe",
      { surface: INPUT_SURFACES.commandHand, movementX: 96, movementY: 4 },
      GESTURE_OWNERS.commandHand,
      INPUT_INTENTS.rotateCommandHand,
    ],
    [
      "zone overflow swipe",
      { surface: INPUT_SURFACES.overflowingZone, zoneOverflowing: true, movementX: 96, movementY: 3 },
      GESTURE_OWNERS.zoneScroll,
      INPUT_INTENTS.scrollZone,
    ],
    [
      "opponent background swipe",
      { surface: INPUT_SURFACES.opponentBackground, opponentBackground: true, movementX: 96, movementY: 3 },
      GESTURE_OWNERS.opponentNavigation,
      INPUT_INTENTS.switchOpponent,
    ],
    [
      "active targeting in zone",
      { targetingActive: true, surface: INPUT_SURFACES.overflowingZone, zoneOverflowing: true, movementX: 96, movementY: 3 },
      GESTURE_OWNERS.zoneScroll,
      INPUT_INTENTS.scrollZone,
    ],
    [
      "explicit card drag",
      { surface: INPUT_SURFACES.card, cardDragActive: true, zoneOverflowing: true, movementX: 24, movementY: 12 },
      GESTURE_OWNERS.cardDrag,
      INPUT_INTENTS.dragCard,
    ],
  ];

  for (const [name, input, owner, intent] of matrix) {
    const result = resolveGestureOwnership(input, policy);
    assert.equal(result.singleOwner, true, name);
    assert.equal(result.owner, owner, name);
    assert.equal(result.intent, intent, name);
    assert.equal(result.transferDuringActiveGesture, false, name);
  }
  const zoneEdge = resolveGestureOwnership({ surface: INPUT_SURFACES.overflowingZone, zoneOverflowing: true, movementX: 130, movementY: 0 }, policy);
  assert.equal(zoneEdge.noTransferAtBoundary, true);
});

test("Part 5 Command Hand matrix proves center, z-order, preview, activation, snap, wrap, and clone identity", () => {
  for (let centerIndex = 0; centerIndex < COMMAND_IDS.length; centerIndex += 1) {
    const entries = commandEntriesForCenter(centerIndex);
    const focused = resolveCommandDeckFocusedCard(entries);
    const validation = validateCommandHandFocusState(entries);
    assert.equal(focused.id, COMMAND_IDS[centerIndex]);
    assert.equal(validation.valid, true, `${COMMAND_IDS[centerIndex]}: ${validation.issues.join(", ")}`);
    assert.equal(validation.focusedId, COMMAND_IDS[centerIndex]);
    assert.equal(validation.centeredId, COMMAND_IDS[centerIndex]);
    assert.equal(validation.topZOrderId, COMMAND_IDS[centerIndex]);
    assert.equal(validation.topHitTestId, COMMAND_IDS[centerIndex]);
    assert.ok(entries.find((entry) => entry.id === focused.id).scale > entries.find((entry) => Math.abs(entry.slotOffset) === 1).scale);
  }

  for (let centerIndex = COMMAND_IDS.length - 1; centerIndex >= 0; centerIndex -= 1) {
    assert.equal(validateCommandHandFocusState(commandEntriesForCenter(centerIndex)).valid, true);
  }

  const partialOffset = resolveCommandDeckPointerOffsetPx(37);
  assert.equal(partialOffset, 37);
  assert.equal(resolveCommandDeckPointerSnapSteps(partialOffset), 0);
  assert.equal(resolveCommandDeckPointerSnapSteps(resolveCommandDeckPointerOffsetPx(140)), -2);
  assert.equal(resolveCommandDeckWheelSnapSteps(9999), COMMAND_DECK_MAX_FREE_SCROLL_STEPS);
  assert.equal(resolveCommandDeckWheelFreeScrollOffsetPx(9999), -COMMAND_DECK_MAX_FREE_SCROLL_STEPS * COMMAND_DECK_SCROLL_PX_PER_CARD);

  const seamLeft = commandEntriesForCenter(0);
  const seamRight = commandEntriesForCenter(COMMAND_IDS.length - 1);
  assert.equal(validateCommandHandFocusState(seamLeft).valid, true);
  assert.equal(validateCommandHandFocusState(seamRight).valid, true);
  assert.equal(resolveCommandHandVisualCloneIdentity({ visualId: "phase-left-clone", commandId: "phase", isClone: true }).createsIndependentCommand, false);
  assert.equal(resolveCommandHandVisualCloneIdentity({ visualId: "phase-left-clone", commandId: "phase", isClone: true }).logicalCommandId, "phase");
});

test("Part 5 Live Tracking resolution, event identity, replay, and preview separation remain stable", () => {
  let solRingSession = castSpellToStack(createGameSession(), {
    name: "Sol Ring",
    typeLine: "Artifact",
    oracleText: "{T}: Add {C}{C}.",
  });
  const castPresentation = solRingSession.presentation;
  let ledger = createPresentationLedger();
  assert.equal(shouldPlayPresentationEvent(ledger, castPresentation), true);
  ledger = markPresentationEventPlayed(ledger, castPresentation);
  assert.equal(shouldPlayPresentationEvent(ledger, { ...castPresentation, unrelatedUpdate: "command-hand-rotation" }), false);

  solRingSession = resolveTopOfStack(solRingSession, { stackId: solRingSession.stack[0].id });
  assert.equal(solRingSession.stack.length, 0);
  assert.equal(solRingSession.battlefield.player.some((entry) => entry.name === "Sol Ring"), true);
  assert.equal(solRingSession.presentation.presentationRole, CARD_PRESENTATION_ROLES.battlefieldPermanent);
  assert.equal(createResolveInteractionPlan(solRingSession).requiredResolveInteractions, 0);

  let profile = createDefaultProfile();
  profile = reduceProfile(profile, createAction({ type: "ADD_PERMANENT", card: { name: "Forest", typeLine: "Basic Land - Forest" } }, profile));
  assert.equal(profile.activeSession.stack.length, 0);
  profile = reduceProfile(profile, createAction({ type: "LIFE_DELTA", amount: -5 }, profile));
  assert.equal(profile.activeSession.life, 35);
  const forest = profile.activeSession.battlefield.player.find((entry) => entry.name === "Forest");
  profile = reduceProfile(profile, createAction({ type: "ADD_COUNTER", id: forest.id, counterType: "Charge", amount: 2 }, profile));
  assert.equal(profile.activeSession.battlefield.player.find((entry) => entry.id === forest.id).counters.Charge, 2);

  const trueStack = createResolveInteractionPlan(stackSession({ stackDepth: 3 }), { mode: GAMEPLAY_MODES.liveTracking });
  assert.equal(trueStack.requiredResolveInteractions, 1);
  assert.equal(trueStack.repeatedResolveAllowed, true);
  assert.equal(trueStack.spellSubstepsAreStackObjects, false);

  const pendingDecision = { id: "choice-1", stackObjectId: "stack-1", status: "pending", effect: { action: "targets", manual: true } };
  const targetedEtb = createResolveInteractionPlan(stackSession({ pending: [pendingDecision] }), { mode: GAMEPLAY_MODES.liveTracking });
  assert.equal(targetedEtb.requiredResolveInteractions, 0);
  assert.equal(Boolean(targetedEtb.nextDecision), true);

  const preview = createPreviewState(CARD_PRESENTATION_ROLES.inspectionPreview, { id: "creature", name: "Creature" }, {
    focusedOpponentId: "opponent-a",
    commandHandFocusedId: "rules",
    zoneScrollPositions: { "local:creature-zone": 80 },
  });
  const dismissed = dismissPreviewState(preview);
  assert.equal(preview.mutatesAuthoritativeState, false);
  assert.equal(dismissed.restoredContext.commandHandFocusedId, "rules");

  const replayEvent = createGameplayLifecycleEvent({
    eventType: GAMEPLAY_EVENT_TYPES.resolve,
    card: { id: "spell", name: "Wrath of God" },
    fromZone: "stack",
    toZone: "graveyard",
  });
  const replay = createReplayObservation(replayEvent);
  assert.equal(replay.observationalOnly, true);
  assert.equal(replay.mutatesAuthoritativeState, false);
  assert.equal(replay.executesRules, false);
});

test("Part 5 notifications, helpers, accessibility, and performance respect protected gameplay priority", () => {
  const castingSession = castSpellToStack(createGameSession(), { name: "Cultivate", typeLine: "Sorcery" });
  const social = { category: "friend", severity: "info", title: "Friend joined" };
  const helper = { category: "tutorial", severity: "info", title: "Tip" };
  const gameplay = { category: "gameplay", severity: "warning", title: "Manual choice" };
  const critical = { category: "system", severity: "error", title: "Storage failed" };

  assert.equal(shouldDeferNotification(social, { session: castingSession, commandHandActive: true }).defer, true);
  assert.equal(shouldDeferNotification(helper, { session: castingSession, commandHandActive: true }).defer, true);
  assert.equal(shouldDeferNotification(gameplay, { session: castingSession }).defer, false);
  assert.equal(shouldDeferNotification(critical, { session: castingSession }).defer, false);
  assert.equal(classifyNotificationPriority(critical), NOTIFICATION_PRIORITY_LEVELS.critical);

  const accessibility = createAccessibilitySemanticsModel({ keyboardNavigation: true });
  assert.equal(accessibility.hoverOnlyRequired, false);
  assert.equal(accessibility.reducedMotionPreservesStateChanges, true);
  assert.equal(accessibility.highContrastUsesShapeAndDepth, true);
  assert.ok(accessibility.screenReaderLabels.includes("focused-command"));
  assert.ok(accessibility.screenReaderLabels.includes("mandatory-decision"));

  const performance = createInteractionPerformanceBudget({ permanentCount: 160, opponentCount: 3 });
  assert.equal(performance.commandHandRerendersBattlefield, false);
  assert.equal(performance.zoneScrollRerendersOtherZones, false);
  assert.equal(performance.opponentSwitchRecomputesRules, false);
  assert.equal(performance.rulesRunOnAnimationFrame, false);
  assert.equal(performance.animationDefinesRulesState, false);
  assert.ok(performance.largeBoardStressTargetObjects >= 160);
});

test("Part 5 responsive device matrix keeps gameplay landscape, fixed, safe-area-aware, and non-dashboard", () => {
  const cases = [
    ["small phone", { viewport: "phone-landscape", width: 740, height: 360, safeArea: { left: 34, right: 12, bottom: 10 } }, "phone-landscape"],
    ["large phone", { viewport: "phone-landscape", width: 932, height: 430, safeArea: { left: 44, right: 44, bottom: 12 } }, "phone-landscape"],
    ["tablet", { viewport: "tablet-landscape", width: 1366, height: 1024 }, "tablet-landscape"],
    ["desktop", { viewport: "desktop", width: 1440, height: 900 }, "desktop-landscape"],
    ["ultrawide", { viewport: "desktop-ultrawide", width: 2560, height: 1080 }, "desktop-ultrawide"],
  ];

  for (const [name, options, expectedClass] of cases) {
    const composition = resolveResponsiveLandscapeComposition({
      ...options,
      permanentCounts: { local: 56, focusedOpponent: 44 },
    });
    assert.equal(composition.deviceClass, expectedClass, name);
    assert.equal(composition.orientation, "landscape", name);
    assert.equal(composition.fixedGameplayViewport, true, name);
    assert.equal(composition.verticalGameplayScroll, false, name);
    assert.equal(composition.portraitGameplayFallback, false, name);
    assert.equal(composition.densityPolicy.zoneLocalOverflowOnly, true, name);
    assert.equal(composition.densityPolicy.cardProportionsPreserved, true, name);
    assert.ok(composition.semanticRegions.commandHand.height >= 92, name);
    if (expectedClass === "desktop-ultrawide") {
      assert.equal(composition.ultrawide.active, true);
      assert.equal(composition.ultrawide.avoidDashboardExpansion, true);
    }
  }

  const reducedMotionProfile = createDefaultProfile();
  reducedMotionProfile.settings.accessibility = {
    ...(reducedMotionProfile.settings.accessibility || {}),
  };
  reducedMotionProfile.settings.accessibility.reducedMotion = true;
  reducedMotionProfile.settings.accessibility.textScale = 1.35;
  const model = createLandscapeBattlefieldModel(reducedMotionProfile, {
    viewport: "tablet-landscape",
    width: 1180,
    height: 820,
  });
  assert.equal(model.responsiveComposition.verticalGameplayScroll, false);
  assert.equal(model.accessibility.reducedMotionHonored, true);
  assert.equal(model.canonicalGameplay.inputIntent.policy.accessibility.largeTextScale, 1.35);
  assert.equal(model.motion.intensity === "reduced" || model.motion.reducedMotion, true);
});

test("Part 5 mode, rules-assistant, replay, and hidden-information policies remain non-mutating and portable", () => {
  const live = createModeInteractionPolicy(GAMEPLAY_MODES.liveTracking);
  const full = createModeInteractionPolicy({ simulation: { enabled: true } });
  assert.equal(live.rulesEngineShared, true);
  assert.equal(full.rulesEngineShared, true);
  assert.equal(live.authoritativeRulesDivergeByMode, false);
  assert.equal(full.authoritativeRulesDivergeByMode, false);
  assert.equal(live.neverFabricateHiddenInformation, true);
  assert.equal(full.neverFabricateHiddenInformation, true);

  const model = createLandscapeBattlefieldModel(createDefaultProfile(), { viewport: "desktop" });
  assert.equal(model.rulesAssistant.mutatesGameState, false);
  assert.equal(model.rulesAssistant.privacy.hiddenZonesExcluded, true);
  assert.equal(model.proactiveAssistant.mutatesGameState, false);
  assert.equal(model.accessibility.hiddenInformationPolicy, "public-board-projection-only");
});

test("Part 5 static release-baseline audit guards renderer, CSS, docs, and shared-gameplay portability", () => {
  const render = readRepositoryFile("src/ui/render.js");
  const styles = readRepositoryFile("src/styles.css");
  const docs = readRepositoryFile("docs/ecosystem/CANONICAL_GAMEPLAY_ARCHITECTURE.md");
  const sharedFiles = [
    "src/gameplay/canonicalGameplay.js",
    "src/gameplay/battlefieldGeometry.js",
    "src/gameplay/cardLifecycle.js",
    "src/gameplay/commandDeckModel.js",
    "src/gameplay/inputIntent.js",
  ];

  assert.match(render, /data-fixed-gameplay-viewport="true"/);
  assert.match(render, /data-global-vertical-scroll="false"/);
  assert.match(render, /data-command-hand-focus-contract="exactly-one-centered-frontmost-command"/);
  assert.match(render, /data-depth-aware-hit-testing="true"/);
  assert.match(render, /data-opponent-navigation-circular/);
  assert.match(render, /data-zone-scroll-competes="false"/);
  assert.match(render, /shouldDeferNotification/);
  assert.doesNotMatch(render, /Resolve notification/i);

  assert.match(styles, /body\[data-page="battlefield"\][\s\S]*overflow:\s*hidden/);
  assert.match(styles, /tabletop-zone-layout/);
  assert.match(styles, /zone-local-horizontal-scroll/);
  assert.match(styles, /commander-action-hand/);
  assert.match(styles, /--protected-command-hand-clearance/);
  assert.match(styles, /grid-template-rows:\s*minmax\(5\.8rem,\s*1fr\)\s*minmax\(1\.55rem,\s*auto\)\s*minmax\(5\.8rem,\s*1fr\)/);
  assert.match(styles, /--tabletop-card-width:\s*clamp\(4\.2rem,\s*17\.5svh,\s*5\.6rem\)/);
  assert.match(styles, /touch-action:\s*none/);
  assert.match(styles, /recovery-toast-stack/);

  assert.match(docs, /Canonical Gameplay Laws/i);
  assert.match(docs, /Part 5 Release Baseline/i);
  assert.match(docs, /Regression Blacklist/i);
  assert.match(docs, /Platform-portability law/i);

  for (const filePath of sharedFiles) {
    const contents = readRepositoryFile(filePath);
    assert.equal(/document\.|window\.|localStorage|sessionStorage|navigator\.|HTMLElement|MouseEvent|PointerEvent|CSSStyleDeclaration/.test(contents), false, filePath);
  }
});

test("Part 5 runtime adapters keep browser lifecycle APIs behind bound platform boundaries", () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  try {
    let setTimeoutBound = false;
    let clearTimeoutBound = false;
    globalThis.setTimeout = function setTimeoutProbe(callback) {
      setTimeoutBound = this === globalThis;
      if (typeof callback === "function") callback();
      return 13;
    };
    globalThis.clearTimeout = function clearTimeoutProbe() {
      clearTimeoutBound = this === globalThis;
    };
    const runtime = createRuntimeEnvironment();
    const timeoutId = runtime.setTimeout(() => {}, 1);
    runtime.clearTimeout(timeoutId);
    assert.equal(setTimeoutBound, true);
    assert.equal(clearTimeoutBound, true);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});
