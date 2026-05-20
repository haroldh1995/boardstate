import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultProfile } from "../src/state/schema.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createAction } from "../src/state/actions.js";

function dispatch(profile, input) {
  return reduceProfile(profile, createAction(input, profile));
}

test("simulation setup starts local turn with selected NPC opponents", () => {
  let profile = createDefaultProfile();
  profile = dispatch(profile, { type: "START_SIMULATION", selectedOpponents: ["alpha", "omega"], speed: "normal" });
  assert.equal(profile.settings.multiplayer.mode, "simulated");
  assert.equal(profile.activeSession.simulation.enabled, true);
  assert.equal(profile.activeSession.simulation.status, "running");
  assert.deepEqual(profile.activeSession.simulation.selectedOpponents, ["alpha", "omega"]);
  assert.equal(profile.activeSession.simulation.currentPlayerId, "local-player");
  assert.ok(profile.settings.multiplayer.connectedPlayers.some((entry) => entry.id === "alpha"));
  assert.ok(profile.settings.multiplayer.connectedPlayers.some((entry) => entry.id === "omega"));
});

test("simulation pass turn hands control to npc and tick generates npc action log", () => {
  let profile = createDefaultProfile();
  profile = dispatch(profile, { type: "START_SIMULATION", selectedOpponents: ["alpha"], speed: "normal" });
  profile = dispatch(profile, { type: "SIMULATION_PASS_TURN" });
  assert.equal(profile.activeSession.simulation.currentPlayerId, "alpha");
  const beforeLogs = profile.activeSession.simulation.log.length;
  profile = dispatch(profile, { type: "SIMULATION_TICK", internalOnly: true, remote: true });
  assert.ok(profile.activeSession.simulation.log.length > beforeLogs);
  assert.ok(
    profile.activeSession.simulation.log.some(
      (entry) => entry.actorId === "alpha" && /draws|passes/i.test(entry.text || "")
    )
  );
});

test("simulation pause and stop update runtime status safely", () => {
  let profile = createDefaultProfile();
  profile = dispatch(profile, { type: "START_SIMULATION", selectedOpponents: ["beta"], speed: "step" });
  profile = dispatch(profile, { type: "SIMULATION_PAUSE" });
  assert.equal(profile.activeSession.simulation.status, "paused");
  profile = dispatch(profile, { type: "SIMULATION_STOP" });
  assert.equal(profile.activeSession.simulation.enabled, false);
  assert.equal(profile.settings.multiplayer.mode, "offline");
});

