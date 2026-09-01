import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createTimelineExperience } from "../src/authoritative-core/timelineRelationshipEngine.js";
import { createCanonicalBattlefieldGeometry } from "../src/gameplay/battlefieldGeometry.js";
import { resolveArenaHandLayout } from "../src/gameplay/dualHandModel.js";
import {
  createAccessibilitySemanticsModel,
  createInteractionPerformanceBudget,
  resolveResponsiveLandscapeComposition,
} from "../src/gameplay/inputIntent.js";
import { createAction } from "../src/state/actions.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createDefaultProfile, createPermanent } from "../src/state/schema.js";
import {
  SIMULATION_AUTOSAVE_MAX_INTERVAL_MS,
  shouldPersistSimulationTickImmediately,
} from "../src/state/store.js";
import { createLandscapeBattlefieldModel } from "../src/ui/landscapeBattlefield.js";
import { createCommanderPlayers, createCommanderTestSession } from "./fixtures/commanderSessionFixtures.js";

function largePermanent(index) {
  const typeLine = index % 11 === 0
    ? "Planeswalker - Stress"
    : index % 5 === 0
      ? "Artifact"
      : index % 3 === 0
        ? "Basic Land - Forest"
        : "Creature - Test";
  return createPermanent({
    id: `stress-${index}`,
    name: `Stress Permanent ${index}`,
    typeLine,
    controller: "player",
    owner: "player",
    tapped: index % 4 === 0,
    counters: index % 7 === 0 ? { "+1/+1": index % 5 } : {},
  });
}

test("Prompt 17 large Commander projections remain bounded and preserve one focused opponent", () => {
  const players = createCommanderPlayers(10);
  const session = createCommanderTestSession(10, { players });
  const startedAt = performance.now();
  const model = createLandscapeBattlefieldModel(session, {
    viewport: "tablet-landscape",
    width: 1366,
    height: 1024,
    localPlayerId: "player-a",
    focusedOpponentId: "player-f",
  });
  const elapsedMs = performance.now() - startedAt;

  assert.equal(model.opponentCarousel.totalPlayerCount, 10);
  assert.equal(model.opponentCarousel.totalOpponents, 9);
  assert.equal(model.opponentCarousel.renderedOpponentBattlefields, 1);
  assert.equal(model.opponentCarousel.focusedOpponentId, "player-f");
  assert.equal(model.responsiveComposition.verticalGameplayScroll, false);
  assert.ok(elapsedMs < 5_000, `ten-player projection took ${elapsedMs.toFixed(1)}ms`);
});

test("Prompt 17 extreme battlefield and ordered hand layout checks are reproducible", () => {
  const permanents = Array.from({ length: 360 }, (_, index) => largePermanent(index));
  const startedAt = performance.now();
  const geometry = createCanonicalBattlefieldGeometry(permanents, {
    role: "local",
    viewport: "desktop-ultrawide",
    playerCount: 4,
  });
  let maximumZ = 0;
  for (let cycle = 0; cycle < 500; cycle += 1) {
    const layout = resolveArenaHandLayout(
      Array.from({ length: 24 }, (_, index) => ({ id: `command-${index}` })),
      { availableWidth: 820, cardWidth: 120, activeId: `command-${cycle % 24}` },
    );
    maximumZ = Math.max(maximumZ, ...layout.entries.map((entry) => entry.zIndex));
  }
  const elapsedMs = performance.now() - startedAt;

  assert.equal(geometry.authoritativeObjectIds.length, 360);
  assert.equal(geometry.creatureZone.verticalScrollAllowed, false);
  assert.equal(geometry.lowerZone.verticalScrollAllowed, false);
  assert.equal(geometry.creatureZone.horizontalScrollAllowed || geometry.lowerZone.horizontalScrollAllowed, true);
  assert.equal(geometry.presentationOnly, true);
  assert.ok(maximumZ > 0);
  assert.ok(elapsedMs < 5_000, `extreme board and command projection took ${elapsedMs.toFixed(1)}ms`);
});

test("Prompt 17 large timeline is paged and replay knowledge does not mount an unbounded row set", () => {
  const actionHistory = Array.from({ length: 5_000 }, (_, index) => ({
    actionId: `action-${index}`,
    actionType: index % 4 === 0 ? "CAST_SPELL" : index % 4 === 1 ? "ADVANCE_PHASE" : index % 4 === 2 ? "LIFE_DELTA" : "ADD_COUNTER",
    timestamp: index + 1,
    playerId: `player-${index % 4}`,
    payload: index % 4 === 0 ? { card: { name: `Spell ${index}` } } : { amount: 1 },
    snapshot: { turn: Math.floor(index / 20) + 1, phaseIndex: index % 5 },
  }));
  const startedAt = performance.now();
  const timeline = createTimelineExperience({ id: "long-session", actionHistory }, { pageSize: 48, page: 60 });
  const elapsedMs = performance.now() - startedAt;

  assert.equal(timeline.totalEntries, 5_000);
  assert.equal(timeline.entries.length, 48);
  assert.ok(timeline.pageCount > 100);
  assert.equal(timeline.presentationOnly, true);
  assert.ok(elapsedMs < 5_000, `5,000-event timeline projection took ${elapsedMs.toFixed(1)}ms`);
});

test("Prompt 17 accessibility and device semantics remain input-complete without document layout", () => {
  const accessibility = createAccessibilitySemanticsModel({ keyboardNavigation: true });
  const performanceBudget = createInteractionPerformanceBudget({ permanentCount: 360, opponentCount: 9 });
  const phone = resolveResponsiveLandscapeComposition({
    viewport: "phone-landscape",
    width: 740,
    height: 360,
    safeArea: { left: 34, right: 12, bottom: 10 },
    permanentCounts: { local: 180, focusedOpponent: 180 },
  });

  assert.equal(accessibility.keyboardNavigation, true);
  assert.equal(accessibility.hoverOnlyRequired, false);
  assert.equal(accessibility.reducedMotionPreservesStateChanges, true);
  assert.equal(accessibility.highContrastUsesShapeAndDepth, true);
  assert.ok(accessibility.screenReaderLabels.includes("mandatory-decision"));
  assert.equal(performanceBudget.commandHandRerendersBattlefield, false);
  assert.equal(performanceBudget.opponentSwitchRecomputesRules, false);
  assert.equal(phone.verticalGameplayScroll, false);
  assert.deepEqual(phone.safeArea, { top: 0, right: 12, bottom: 10, left: 34 });

  const render = fs.readFileSync(new URL("../src/ui/render.js", import.meta.url), "utf8");
  const styles = fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(render, /aria-label="Rules reference source type"/);
  assert.match(render, /aria-label="Search imported rules references"/);
  assert.match(render, /role="status"/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /safe-area-inset-bottom/);
});

test("internal AI ticks retain semantic history without accumulating full-session snapshots", () => {
  const dispatch = (profile, input) => reduceProfile(profile, createAction(input, profile));
  let profile = dispatch(createDefaultProfile(), {
    type: "START_SIMULATION",
    selectedOpponents: ["alpha", "beta", "omega"],
    speed: "fast",
  });
  profile = dispatch(profile, { type: "SIMULATION_PASS_TURN" });
  const snapshotsBefore = profile.activeSession.eventKnowledge.stateSnapshots.length;
  const checkpointsBefore = profile.activeSession.persistence.checkpoints.length;

  for (let index = 0; index < 12; index += 1) {
    profile = dispatch(profile, { type: "SIMULATION_TICK", internalOnly: true, remote: true });
  }

  const tickActions = profile.activeSession.actionHistory.filter((entry) => entry.actionType === "SIMULATION_TICK");
  assert.ok(tickActions.length >= 8);
  assert.ok(tickActions.every((entry) => entry.snapshot === null));
  assert.equal(profile.activeSession.eventKnowledge.stateSnapshots.length, snapshotsBefore);
  assert.ok(profile.activeSession.persistence.checkpoints.length <= checkpointsBefore + 1);
  assert.ok(profile.activeSession.eventKnowledge.events.some((entry) => entry.what?.actionType === "SIMULATION_TICK"));
});

test("AI autosave policy coalesces frames but persists settled gameplay boundaries", () => {
  const previous = createDefaultProfile();
  previous.activeSession.simulation = {
    enabled: true,
    status: "running",
    currentPlayerId: "alpha",
    waitingForUser: false,
    eliminatedPlayerIds: [],
  };
  const intermediate = structuredClone(previous);
  intermediate.activeSession.simulation.currentPhaseIndex = 2;

  assert.equal(shouldPersistSimulationTickImmediately(previous, intermediate, {
    now: 1_000,
    lastPersistedAt: 500,
  }), false);
  assert.equal(shouldPersistSimulationTickImmediately(previous, intermediate, {
    now: SIMULATION_AUTOSAVE_MAX_INTERVAL_MS + 501,
    lastPersistedAt: 500,
  }), true);

  const decision = structuredClone(intermediate);
  decision.activeSession.simulation.waitingForUser = true;
  assert.equal(shouldPersistSimulationTickImmediately(previous, decision, {
    now: 1_000,
    lastPersistedAt: 500,
  }), true);

  const nextTurn = structuredClone(intermediate);
  nextTurn.activeSession.simulation.currentPlayerId = "beta";
  assert.equal(shouldPersistSimulationTickImmediately(previous, nextTurn, {
    now: 1_000,
    lastPersistedAt: 500,
  }), true);
});
