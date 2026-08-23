import test from "node:test";
import assert from "node:assert/strict";

import {
  LAND_PLAY_SYSTEM_VERSION,
  evaluateLandPlay,
  getLandPlayAllowance,
  recordLandPlay,
  resetLandPlayStateForTurn,
} from "../src/game/landPlaySystem.js";
import { createAction } from "../src/state/actions.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createDefaultProfile, createPermanent } from "../src/state/schema.js";

function dispatch(profile, input) {
  return reduceProfile(profile, createAction(input, profile));
}

const forest = {
  cardId: "forest",
  name: "Forest",
  typeLine: "Basic Land - Forest",
  oracleText: "{T}: Add {G}.",
};

test("Live Tracking records land plays immediately without manufacturing Resolve steps", () => {
  let profile = createDefaultProfile();
  profile.activeSession.gameTracking = { active: true, mode: "active-game" };
  profile.activeSession.phaseIndex = 0;
  profile = dispatch(profile, { type: "PLAY_LAND", card: forest, controller: "player" });
  assert.equal(profile.activeSession.battlefield.player.some((permanent) => permanent.name === "Forest"), true);
  assert.equal(profile.activeSession.landPlayState.version, LAND_PLAY_SYSTEM_VERSION);
  assert.equal(profile.activeSession.landPlayState.playsByController.player, 1);
  assert.equal(profile.activeSession.stack.length, 0);
  assert.equal(profile.activeSession.presentation.kind, "land-played");
});

test("strict Full Control enforces main phase, empty stack, and land allowance", () => {
  let profile = createDefaultProfile();
  profile.settings.strictPhaseEnforcement = true;
  profile.activeSession.gameTracking = { active: true, mode: "full-control" };
  profile.activeSession.phaseIndex = 1;
  profile = dispatch(profile, { type: "PLAY_LAND", card: forest, controller: "player" });
  assert.equal(profile.activeSession.landPlayState.playsByController.player, 1);

  profile = dispatch(profile, { type: "PLAY_LAND", card: { ...forest, cardId: "forest-2" }, controller: "player" });
  assert.equal(profile.activeSession.battlefield.player.reduce((sum, permanent) => sum + permanent.quantity, 0), 1);
  assert.match(profile.activeSession.recoveryLog[0].message, /allowance/i);
});

test("additional-land permissions increase allowance and reset safely on the next turn", () => {
  let profile = createDefaultProfile();
  profile.activeSession.battlefield.player = [
    createPermanent({
      id: "oracle",
      name: "Oracle of Mul Daya",
      typeLine: "Creature - Elf Shaman",
      oracleText: "You may play an additional land on each of your turns.",
    }),
  ];
  assert.equal(getLandPlayAllowance(profile.activeSession, "player"), 2);
  const evaluation = evaluateLandPlay(profile.activeSession, forest, {
    controller: "player",
    settings: { strictPhaseEnforcement: true },
  });
  assert.equal(evaluation.allowance, 2);

  let session = recordLandPlay(profile.activeSession, forest, { controller: "player", eventId: "land-1" });
  session = recordLandPlay(session, { ...forest, cardId: "forest-2" }, { controller: "player", eventId: "land-2" });
  assert.equal(session.landPlayState.playsByController.player, 2);
  session = resetLandPlayStateForTurn({ ...session, turn: 2 }, 2);
  assert.deepEqual(session.landPlayState.playsByController, {});
  assert.equal(session.landPlayState.turn, 2);
});
