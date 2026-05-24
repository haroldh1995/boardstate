import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultProfile } from "../src/state/schema.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createAction } from "../src/state/actions.js";
import { getDeckMainboardCount, getSimulationDeckById } from "../src/simulation/decks/index.js";

function dispatch(profile, input) {
  return reduceProfile(profile, createAction(input, profile));
}

test("static npc deck assignments include commanders and non-empty mainboards", () => {
  const alpha = getSimulationDeckById("alpha");
  const beta = getSimulationDeckById("beta");
  const omega = getSimulationDeckById("omega");
  assert.equal(alpha.commander.name, "Hearthhull, the Worldseed");
  assert.equal(beta.commander.name, "Stella Lee, Wild Card");
  assert.equal(omega.commander.name, "Zhulodok, Void Gorger");
  assert.ok(getDeckMainboardCount(alpha) > 0);
  assert.ok(getDeckMainboardCount(beta) > 0);
  assert.ok(getDeckMainboardCount(omega) > 0);
});

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
  assert.equal(profile.activeSession.gameTracking.active, true);
});

test("simulation format labeling supports 1v1, 3-way, and 4-way commander setups", () => {
  let profile = createDefaultProfile();
  profile = dispatch(profile, { type: "START_SIMULATION", selectedOpponents: ["alpha"], speed: "normal" });
  assert.equal(profile.activeSession.simulation.format, "1v1 Commander");

  profile = dispatch(profile, { type: "START_SIMULATION", selectedOpponents: ["alpha", "beta"], speed: "normal" });
  assert.equal(profile.activeSession.simulation.format, "3-way Commander");

  profile = dispatch(profile, { type: "START_SIMULATION", selectedOpponents: ["alpha", "beta", "omega"], speed: "normal" });
  assert.equal(profile.activeSession.simulation.format, "4-way Commander");
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
  assert.ok(profile.activeSession.simulation.opponents.alpha.zones.library.length >= 0);
  assert.ok(Array.isArray(profile.activeSession.simulation.opponents.alpha.zones.hand));
});

test("simulation pause and stop update runtime status safely", () => {
  let profile = createDefaultProfile();
  profile = dispatch(profile, { type: "START_SIMULATION", selectedOpponents: ["beta"], speed: "step" });
  profile = dispatch(profile, { type: "SIMULATION_PAUSE" });
  assert.equal(profile.activeSession.simulation.status, "paused");
  profile = dispatch(profile, { type: "SIMULATION_STOP" });
  assert.equal(profile.activeSession.simulation.enabled, false);
  assert.equal(profile.settings.multiplayer.mode, "offline");
  assert.equal(profile.activeSession.gameTracking.active, false);
});

test("full triple-opponent simulation tick produces alpha beta omega turn progression", () => {
  let profile = createDefaultProfile();
  profile = dispatch(profile, { type: "START_SIMULATION", selectedOpponents: ["alpha", "beta", "omega"], speed: "normal" });
  profile = dispatch(profile, { type: "SIMULATION_PASS_TURN" });
  for (let index = 0; index < 20; index += 1) {
    profile = dispatch(profile, { type: "SIMULATION_TICK", internalOnly: true, remote: true });
  }
  const logText = profile.activeSession.simulation.log.map((entry) => `${entry.actorId}:${entry.text}`).join("\n");
  assert.match(logText, /alpha/i);
  assert.match(logText, /beta/i);
  assert.match(logText, /omega/i);
});

test("training ground activate board queues manual choices and keeps phase-independent evaluation", () => {
  let profile = createDefaultProfile();
  profile = dispatch(profile, {
    type: "ADD_PERMANENT",
    card: {
      name: "Training Ground Aura",
      typeLine: "Enchantment",
      oracleText: "Whenever a creature enters the battlefield under your control, you may choose target creature.",
      parsedEffects: [
        {
          kind: "trigger",
          action: "add-counters",
          manual: true,
          summary: "choose target creature",
          target: "selected",
        },
      ],
      triggeredAbilities: [{ eventType: "ENTER_BATTLEFIELD", condition: "creature-entered-under-your-control" }],
    },
  });
  assert.equal(profile.activeSession.gameTracking.active, false);
  profile = dispatch(profile, { type: "ACTIVATE_BOARD" });
  assert.ok((profile.activeSession.pendingEffects || []).length >= 1);
  assert.match(profile.activeSession.effectLog[0]?.summary || "", /Activate Board evaluated/i);
});

test("simulation completion records separate simulation stats with revenge disabled and no strategy updates", () => {
  let profile = createDefaultProfile();
  profile = dispatch(profile, {
    type: "START_SIMULATION",
    selectedOpponents: ["alpha", "beta"],
    speed: "normal",
    revengeEnabled: false,
  });
  profile = {
    ...profile,
    activeSession: {
      ...profile.activeSession,
      turn: 7,
      simulation: {
        ...profile.activeSession.simulation,
        enabled: true,
        status: "completed",
        winnerId: "local-player",
        selectedOpponents: ["alpha", "beta"],
        eliminations: [],
        statsRecorded: false,
        revengeEnabled: false,
      },
    },
  };
  profile = dispatch(profile, { type: "SET_PLAYER_NAME", name: "Player" });
  assert.equal(profile.simulationStats.gamesPlayed, 1);
  assert.equal(profile.simulationStats.user.wins, 1);
  assert.equal(profile.simulationStats.alpha.losses, 1);
  assert.equal(profile.simulationStats.beta.losses, 1);
  assert.equal(profile.activeSession.simulation.statsRecorded, true);
  assert.equal(profile.simulationStats.history[0]?.revengeEnabled, false);
  assert.equal(profile.simulationMemory?.npcLearning?.alpha, undefined);
  assert.equal(profile.simulationMemory?.npcLearning?.beta, undefined);
});

test("simulation completion with revenge enabled updates learning state for npc opponents", () => {
  let profile = createDefaultProfile();
  profile = dispatch(profile, {
    type: "START_SIMULATION",
    selectedOpponents: ["alpha", "omega"],
    speed: "normal",
    revengeEnabled: true,
  });
  profile = {
    ...profile,
    activeSession: {
      ...profile.activeSession,
      turn: 9,
      simulation: {
        ...profile.activeSession.simulation,
        enabled: true,
        status: "completed",
        winnerId: "alpha",
        selectedOpponents: ["alpha", "omega"],
        eliminations: [
          { byPlayerId: "alpha", targetPlayerId: "local-player", reason: "combat-damage" },
          { byPlayerId: "alpha", targetPlayerId: "omega", reason: "commander-damage" },
        ],
        statsRecorded: false,
        revengeEnabled: true,
      },
    },
  };
  profile = dispatch(profile, { type: "SET_PLAYER_NAME", name: "Player" });
  assert.equal(profile.simulationStats.gamesPlayed, 1);
  assert.equal(profile.simulationStats.alpha.wins, 1);
  assert.equal(profile.simulationStats.user.losses, 1);
  assert.equal(profile.simulationStats.omega.losses, 1);
  assert.ok((profile.simulationMemory?.npcLearning?.omega?.targetPriority?.alpha || 0) >= 2);
  assert.ok((profile.simulationMemory?.npcLearning?.alpha?.aggression || 0) >= 1);
  assert.equal(profile.simulationStats.history[0]?.revengeEnabled, true);
});
