import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CANONICAL_INPUT_INTENT_VERSION,
  GESTURE_OWNERS,
  INPUT_INTENTS,
  INPUT_SURFACES,
  createAccessibilitySemanticsModel,
  createCommandHandAccessibilityModel,
  createInputIntentPolicy,
  createInteractionPerformanceBudget,
  createTableRadarModel,
  resolveCommandHandVisualCloneIdentity,
  resolveGestureOwnership,
  resolveOpponentFocusNavigation,
  resolveResponsiveLandscapeComposition,
  validateCommandHandFocusState,
} from "../src/gameplay/inputIntent.js";
import {
  resolveCommandDeckCardProjection,
  resolveCommandDeckCardPress,
  resolveCommandDeckFocusedCard,
} from "../src/gameplay/commandDeckModel.js";
import { createDefaultProfile } from "../src/state/schema.js";
import {
  createLandscapeBattlefieldModel,
  createOpponentCarouselModel,
} from "../src/ui/landscapeBattlefield.js";

function readRepositoryFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function makeOpponent(id, extras = {}) {
  return {
    id,
    playerId: id,
    name: extras.name || id,
    life: extras.life ?? 40,
    permanents: extras.permanents || [],
    ...extras,
  };
}

test("Part 4 input intent resolves exactly one owner by semantic priority", () => {
  const policy = createInputIntentPolicy({ viewport: "phone-landscape" });
  assert.equal(policy.version, CANONICAL_INPUT_INTENT_VERSION);
  assert.equal(policy.platformBoundary.swiftUiPortable, true);
  assert.equal(policy.accessibility.hoverRequired, false);

  assert.equal(resolveGestureOwnership({ activeMandatoryDecision: true, surface: INPUT_SURFACES.card }, policy).owner, GESTURE_OWNERS.mandatoryGameplay);
  assert.equal(resolveGestureOwnership({ surface: INPUT_SURFACES.card, cardDragActive: true, zoneOverflowing: true }, policy).owner, GESTURE_OWNERS.cardDrag);
  assert.equal(resolveGestureOwnership({ targetingActive: true, surface: INPUT_SURFACES.overflowingZone, zoneOverflowing: true, movementX: 72, movementY: 2 }, policy).owner, GESTURE_OWNERS.zoneScroll);
  assert.equal(resolveGestureOwnership({ surface: INPUT_SURFACES.commandHand, movementX: 72, movementY: 2 }, policy).intent, INPUT_INTENTS.rotateCommandHand);
  assert.equal(resolveGestureOwnership({ surface: INPUT_SURFACES.overflowingZone, zoneOverflowing: true, movementX: 72, movementY: 2 }, policy).owner, GESTURE_OWNERS.zoneScroll);
  assert.equal(resolveGestureOwnership({ surface: INPUT_SURFACES.opponentBackground, opponentBackground: true, movementX: 72, movementY: 2 }, policy).intent, INPUT_INTENTS.switchOpponent);

  const tinyMovement = resolveGestureOwnership({ surface: INPUT_SURFACES.card, movementX: 3, movementY: 2, durationMs: 80 }, policy);
  assert.equal(tinyMovement.intent, INPUT_INTENTS.tapSelect);
  assert.equal(tinyMovement.singleOwner, true);

  const longPress = resolveGestureOwnership({ surface: INPUT_SURFACES.card, movementX: 1, movementY: 1, durationMs: 500 }, policy);
  assert.equal(longPress.intent, INPUT_INTENTS.inspect);

  const zoneEdge = resolveGestureOwnership({ surface: INPUT_SURFACES.overflowingZone, zoneOverflowing: true, movementX: 90, movementY: 0 }, policy);
  assert.equal(zoneEdge.noTransferAtBoundary, true);
  assert.equal(zoneEdge.transferDuringActiveGesture, false);
});

test("Part 4 Command Hand focus, highlight, preview, activation, and hit testing stay unified", () => {
  const commandIds = [
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
  ];
  for (let centerIndex = 0; centerIndex < commandIds.length; centerIndex += 1) {
    const candidates = commandIds.map((id, index) => {
      let slotOffset = index - centerIndex;
      if (slotOffset > commandIds.length / 2) slotOffset -= commandIds.length;
      if (slotOffset < -commandIds.length / 2) slotOffset += commandIds.length;
      return { id, slotOffset, priority: id === "phase" ? 96 : 10 };
    });
    const focused = resolveCommandDeckFocusedCard(candidates);
    assert.equal(focused.id, commandIds[centerIndex]);

    const entries = candidates.map((candidate) => {
      const projection = resolveCommandDeckCardProjection(
        candidate.slotOffset,
        candidate.priority,
        candidate.id === focused.id
      );
      return {
        id: candidate.id,
        slotOffset: candidate.slotOffset,
        focused: candidate.id === focused.id,
        highlighted: candidate.id === focused.id,
        previewOwner: candidate.id === focused.id ? candidate.id : "",
        activationOwner: candidate.id === focused.id ? candidate.id : "",
        zIndex: projection.zIndex,
        hitTestRank: projection.zIndex,
      };
    });
    const validation = validateCommandHandFocusState(entries);
    assert.equal(validation.valid, true, validation.issues.join(", "));
    assert.equal(validation.focusedId, commandIds[centerIndex]);
    assert.equal(validation.topZOrderId, commandIds[centerIndex]);
    assert.equal(validation.topHitTestId, commandIds[centerIndex]);
  }
});

test("Part 4 Command Hand rear cards focus before activation", () => {
  assert.deepEqual(resolveCommandDeckCardPress(0, true), { intent: "activate", rotationSteps: 0 });
  assert.deepEqual(resolveCommandDeckCardPress(2, false), { intent: "focus", rotationSteps: 2 });
  assert.deepEqual(resolveCommandDeckCardPress(-3, false), { intent: "focus", rotationSteps: -3 });
});

test("Part 4 visual command clones map to one canonical command identity", () => {
  const clone = resolveCommandHandVisualCloneIdentity({
    visualId: "phase-copy-left",
    commandId: "phase",
    isClone: true,
  });
  assert.equal(clone.canonicalCommandId, "phase");
  assert.equal(clone.logicalCommandId, "phase");
  assert.equal(clone.createsIndependentCommand, false);

  const accessibility = createCommandHandAccessibilityModel(
    [
      { id: "phase", label: "Next Phase", intent: "Advance turn" },
      { id: "library", label: "Search", intent: "Find a card" },
    ],
    "library"
  );
  assert.equal(accessibility.hoverRequired, false);
  assert.deepEqual(accessibility.commands.map((command) => command.focused), [false, true]);
});

test("Part 4 opponent navigation is circular, stable, and suppressed for two-player games", () => {
  const opponents = [makeOpponent("opponent-a"), makeOpponent("opponent-b"), makeOpponent("opponent-c")];
  const navigation = resolveOpponentFocusNavigation(opponents, "opponent-b", 1);
  assert.equal(navigation.enabled, true);
  assert.equal(navigation.arrowsVisible, true);
  assert.equal(navigation.previousOpponentId, "opponent-a");
  assert.equal(navigation.nextOpponentId, "opponent-c");
  assert.deepEqual(navigation.stableOrder, ["opponent-a", "opponent-b", "opponent-c"]);
  assert.equal(resolveOpponentFocusNavigation(opponents, "opponent-c", 1).nextOpponentId, "opponent-a");
  assert.equal(resolveOpponentFocusNavigation(opponents, "opponent-a", -1).nextFocusedOpponentId, "opponent-c");

  const twoPlayer = createOpponentCarouselModel(
    { syncedMultiplayer: { currentPlayerId: "local-player" } },
    {
      localPlayerId: "local-player",
      playerCount: 2,
      opponentBoards: [makeOpponent("opponent-a")],
    }
  );
  assert.equal(twoPlayer.enabled, false);
  assert.equal(twoPlayer.arrowsVisible, false);
  assert.equal(twoPlayer.renderedOpponentBattlefields, 1);
});

test("Part 4 table radar communicates table awareness without mini battlefield duplication", () => {
  const radar = createTableRadarModel(
    [
      { id: "local", name: "You", life: 40 },
      { id: "opponent-a", name: "A", life: 34 },
      { id: "opponent-b", name: "B", life: 12, eliminated: true },
    ],
    { focusedOpponentId: "opponent-a", activePlayerId: "opponent-b" }
  );
  assert.equal(radar.role, "compact-table-awareness");
  assert.equal(radar.duplicatesBattlefields, false);
  assert.equal(radar.entries.find((entry) => entry.id === "opponent-a").focused, true);
  assert.equal(radar.entries.find((entry) => entry.id === "opponent-b").activeTurn, true);
  assert.equal(radar.entries.find((entry) => entry.id === "opponent-b").selectable, false);
});

test("Part 4 responsive landscape composition never converts gameplay into vertical document flow", () => {
  const phone = resolveResponsiveLandscapeComposition({
    width: 844,
    height: 390,
    safeArea: { left: 24, right: 24, bottom: 10, top: 0 },
    permanentCounts: { local: 18, opponent: 18 },
  });
  assert.equal(phone.deviceClass, "phone-landscape");
  assert.equal(phone.fixedGameplayViewport, true);
  assert.equal(phone.verticalGameplayScroll, false);
  assert.equal(phone.portraitGameplayFallback, false);
  assert.equal(phone.densityPolicy.zoneLocalOverflowOnly, true);
  assert.ok(phone.semanticRegions.commandHand.height >= 92);

  const tablet = resolveResponsiveLandscapeComposition({ width: 1366, height: 1024, viewport: "ipad-landscape" });
  assert.equal(tablet.deviceClass, "tablet-landscape");
  assert.equal(tablet.verticalGameplayScroll, false);
  assert.ok(tablet.semanticRegions.localTerritory.height > phone.semanticRegions.localTerritory.height);

  const ultrawide = resolveResponsiveLandscapeComposition({ width: 2560, height: 1080 });
  assert.equal(ultrawide.deviceClass, "desktop-ultrawide");
  assert.equal(ultrawide.ultrawide.active, true);
  assert.equal(ultrawide.ultrawide.avoidDashboardExpansion, true);
});

test("Part 4 landscape model exposes input, accessibility, and performance architecture", () => {
  const profile = createDefaultProfile();
  const opponents = [makeOpponent("opponent-a"), makeOpponent("opponent-b")];
  const model = createLandscapeBattlefieldModel(profile, {
    viewport: "phone-landscape",
    width: 844,
    height: 390,
    perspective: {
      localPlayerId: "local-player",
      playerCount: 3,
      opponentBoards: opponents,
      promptOwnership: { activePlayerId: "opponent-b" },
    },
    focusedOpponentId: "opponent-a",
  });
  assert.equal(model.canonicalGameplay.inputIntent.version, CANONICAL_INPUT_INTENT_VERSION);
  assert.equal(model.gameplayFlow.inputIntent.gestureOwnership.commandHand.owner, GESTURE_OWNERS.commandHand);
  assert.equal(model.gameplayFlow.inputIntent.gestureOwnership.overflowingZone.owner, GESTURE_OWNERS.zoneScroll);
  assert.equal(model.gameplayFlow.inputIntent.gestureOwnership.opponentNavigation.owner, GESTURE_OWNERS.opponentNavigation);
  assert.equal(model.responsiveComposition.verticalGameplayScroll, false);
  assert.equal(model.performance.commandHandRerendersBattlefield, false);
  assert.equal(model.accessibility.hoverOnlyRequired, false);
  assert.ok(model.accessibility.screenReaderLabels.includes("focused-command"));
});

test("Part 4 accessibility and performance budgets remain platform-neutral", () => {
  const accessibility = createAccessibilitySemanticsModel();
  const performance = createInteractionPerformanceBudget({ permanentCount: 140, opponentCount: 3 });
  assert.equal(accessibility.reducedMotionPreservesStateChanges, true);
  assert.equal(accessibility.highContrastUsesShapeAndDepth, true);
  assert.equal(performance.rulesRunOnAnimationFrame, false);
  assert.equal(performance.commandHandRerendersBattlefield, false);
  assert.equal(performance.largeBoardStressTargetObjects, 140);
});

test("Part 4 renderer and CSS expose platform-portable contracts without new global gameplay scroll", () => {
  const render = readRepositoryFile("src/ui/render.js");
  const styles = readRepositoryFile("src/styles.css");
  const docs = readRepositoryFile("docs/ecosystem/CANONICAL_GAMEPLAY_ARCHITECTURE.md");
  const inputIntent = readRepositoryFile("src/gameplay/inputIntent.js");

  assert.match(render, /CANONICAL_INPUT_INTENT_VERSION/);
  assert.match(render, /data-input-intent-version/);
  assert.match(render, /data-depth-aware-hit-testing="true"/);
  assert.match(render, /compareCommandDeckDepth/);
  assert.match(render, /data-opponent-navigation-circular/);
  assert.match(render, /data-zone-scroll-competes="false"/);
  assert.match(render, /data-gesture-transfer="false"/);
  assert.match(render, /data-global-vertical-scroll="false"/);
  assert.match(styles, /touch-action:\s*none/);
  assert.match(styles, /contain:\s*layout paint style/);
  assert.match(docs, /Part 4 Input Intent Architecture/i);
  assert.equal(inputIntent.includes("document."), false);
  assert.equal(inputIntent.includes("window."), false);
  assert.equal(inputIntent.includes("localStorage"), false);
  assert.equal(inputIntent.includes("navigator."), false);
});
