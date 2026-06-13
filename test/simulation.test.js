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
  assert.equal(profile.settings.multiplayer.role, "player");
  assert.equal(profile.settings.multiplayer.spectatorMode, false);
  assert.equal(profile.activeSession.simulation.enabled, true);
  assert.equal(profile.activeSession.simulation.status, "running");
  assert.deepEqual(profile.activeSession.simulation.selectedOpponents, ["alpha", "omega"]);
  assert.equal(profile.activeSession.simulation.currentPlayerId, "local-player");
  assert.ok(profile.settings.multiplayer.connectedPlayers.some((entry) => entry.id === "alpha"));
  assert.ok(profile.settings.multiplayer.connectedPlayers.some((entry) => entry.id === "omega"));
  assert.equal(profile.activeSession.gameTracking.active, true);
});

test("simulation turn order initializes with user first and randomized npc order after user", () => {
  let profile = createDefaultProfile();
  profile = dispatch(profile, { type: "START_SIMULATION", selectedOpponents: ["alpha", "beta", "omega"], speed: "normal" });
  const turnOrder = profile.activeSession.simulation.turnOrder || [];
  assert.equal(turnOrder[0], "local-player");
  assert.deepEqual([...turnOrder.slice(1)].sort(), ["alpha", "beta", "omega"]);
  assert.ok(
    profile.activeSession.simulation.log.some((entry) => /Turn order:/i.test(entry.text || ""))
  );
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
  const phaseBefore = profile.activeSession.phaseIndex;
  profile = dispatch(profile, { type: "ADVANCE_PHASE" });
  assert.notEqual(profile.activeSession.phaseIndex, phaseBefore);
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

test("waiting local-player simulation tick is a true no-op", () => {
  let profile = dispatch(createDefaultProfile(), { type: "START_SIMULATION", selectedOpponents: ["alpha"], speed: "normal" });
  profile = dispatch(profile, { type: "SIMULATION_TICK", internalOnly: true, remote: true });
  assert.equal(profile.activeSession.simulation.waitingForUser, true);

  const next = dispatch(profile, { type: "SIMULATION_TICK", internalOnly: true, remote: true });
  assert.equal(next, profile);
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

test("synced multiplayer roll and confirm turn order persists and phase wrap advances to next player", () => {
  let profile = createDefaultProfile();
  profile = dispatch(profile, { type: "SET_MULTIPLAYER_MODE", mode: "local" });
  profile = dispatch(profile, { type: "START_GAME_TRACKING" });
  profile = dispatch(profile, {
    type: "ROLL_MULTIPLAYER_TURN_ORDER",
    players: [
      { id: "local-player", name: "Player" },
      { id: "alpha-peer", name: "Alpha" },
      { id: "beta-peer", name: "Beta" },
    ],
    rolls: {
      "local-player": 11,
      "alpha-peer": 18,
      "beta-peer": 14,
    },
  });
  assert.equal(profile.activeSession.syncedMultiplayer.confirmed, false);
  assert.equal(profile.activeSession.syncedMultiplayer.pendingConfirmation, true);
  assert.deepEqual(profile.activeSession.syncedMultiplayer.suggestedTurnOrder, ["alpha-peer", "beta-peer", "local-player"]);

  profile = dispatch(profile, {
    type: "CONFIRM_MULTIPLAYER_TURN_ORDER",
    turnOrder: ["local-player", "beta-peer", "alpha-peer"],
  });
  assert.equal(profile.activeSession.syncedMultiplayer.confirmed, true);
  assert.equal(profile.activeSession.syncedMultiplayer.currentPlayerId, "local-player");

  const initialTurn = profile.activeSession.turn;
  let guard = 0;
  while (profile.activeSession.turn === initialTurn && guard < 20) {
    profile = dispatch(profile, { type: "ADVANCE_PHASE" });
    guard += 1;
  }
  assert.ok(profile.activeSession.turn > initialTurn);
  assert.equal(profile.activeSession.syncedMultiplayer.currentPlayerId, "beta-peer");
});

test("synced multiplayer tied highest rolls are tracked and manual confirmation resolves tie", () => {
  let profile = createDefaultProfile();
  profile = dispatch(profile, { type: "SET_MULTIPLAYER_MODE", mode: "wifi" });
  profile = dispatch(profile, { type: "START_GAME_TRACKING" });
  profile = dispatch(profile, {
    type: "ROLL_MULTIPLAYER_TURN_ORDER",
    players: [
      { id: "local-player", name: "Player" },
      { id: "alpha-peer", name: "Alpha" },
      { id: "omega-peer", name: "Omega" },
    ],
    rolls: {
      "local-player": 19,
      "alpha-peer": 19,
      "omega-peer": 7,
    },
  });
  assert.deepEqual(profile.activeSession.syncedMultiplayer.tiePlayerIds.sort(), ["alpha-peer", "local-player"]);
  assert.equal(profile.activeSession.syncedMultiplayer.pendingConfirmation, true);
  assert.equal(profile.settings.multiplayer.needsTurnOrderConfirmation, true);

  profile = dispatch(profile, {
    type: "CONFIRM_MULTIPLAYER_TURN_ORDER",
    turnOrder: ["alpha-peer", "local-player", "omega-peer"],
  });
  assert.equal(profile.activeSession.syncedMultiplayer.confirmed, true);
  assert.equal(profile.activeSession.syncedMultiplayer.pendingConfirmation, false);
  assert.equal(profile.activeSession.syncedMultiplayer.currentPlayerId, "alpha-peer");
  assert.deepEqual(profile.settings.multiplayer.confirmedTurnOrder, ["alpha-peer", "local-player", "omega-peer"]);
});
