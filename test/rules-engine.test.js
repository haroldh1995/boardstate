import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  calculateCombat,
  calculateLegalTargets,
  calculateManaPayment,
  createBoardStateEngineRequest,
  getRulesEngineVersion,
  performStateBasedActions,
  resolveAction,
  serializeEngineState,
  validateAction,
} from "../src/rules-engine/index.js";
import { createDefaultProfile, createPermanent } from "../src/state/schema.js";

test("rules engine boundary has no UI, storage, DOM, or network dependencies", () => {
  const files = collectFiles("src/rules-engine").filter((file) => file.endsWith(".js"));
  const forbidden = [
    "../ui",
    "render.js",
    ".css",
    "localStorage",
    "sessionStorage",
    "indexedDB",
    "WebSocket",
    "BroadcastChannel",
    "document.",
    "window.",
    "navigator.",
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.equal(source.includes(pattern), false, `${file} must not include ${pattern}`);
    }
  }
});

test("rules engine validates and pays mana for active-game casting without changing free casting", () => {
  const profile = createDefaultProfile();
  const forest = createPermanent({
    id: "forest",
    name: "Forest",
    typeLine: "Basic Land - Forest",
    controller: "player",
  });
  const spell = {
    id: "elves",
    name: "Llanowar Elves",
    typeLine: "Creature - Elf Druid",
    manaCost: "{G}",
    power: 1,
    toughness: 1,
  };
  const activeState = {
    ...profile.activeSession,
    gameTracking: { ...profile.activeSession.gameTracking, active: true },
    battlefield: { ...profile.activeSession.battlefield, player: [forest], opponent: [] },
  };
  const validation = validateAction(activeState, { type: "CAST_SPELL", card: spell, controller: "player" });
  assert.equal(validation.legal, true);
  const result = resolveAction(activeState, { type: "CAST_SPELL", card: spell, controller: "player" });
  assert.equal(result.legal, true);
  assert.equal(result.nextState.stack[0].name, "Llanowar Elves");
  assert.equal(result.nextState.battlefield.player[0].tapped, true);

  const freeState = { ...profile.activeSession, battlefield: { ...profile.activeSession.battlefield, player: [], opponent: [] } };
  const freeValidation = validateAction(freeState, { type: "CAST_SPELL", card: spell, controller: "player" });
  assert.equal(freeValidation.legal, true);
});

test("rules engine exposes mana, targeting, combat, and state-based action services", () => {
  const attacker = createPermanent({
    id: "attacker",
    name: "Hill Giant",
    typeLine: "Creature - Giant",
    power: 3,
    toughness: 3,
    controller: "player",
  });
  const blocker = createPermanent({
    id: "blocker",
    name: "Grizzly Bears",
    typeLine: "Creature - Bear",
    power: 2,
    toughness: 2,
    controller: "opponent",
  });
  const state = {
    ...createDefaultProfile().activeSession,
    battlefield: { player: [attacker], opponent: [blocker] },
    combat: {
      step: "damage",
      attackerIds: ["attacker"],
      blockersByAttacker: { attacker: ["blocker"] },
      attackTargetsByAttacker: { attacker: "opponent" },
      lines: [],
    },
  };
  assert.equal(calculateLegalTargets(state, attacker, "all-creatures").validTargets.length, 2);
  assert.equal(calculateCombat(state).total, 0);
  assert.equal(calculateManaPayment(state, { controller: "player", manaCost: "{G}" }).verified, false);

  const sbaState = {
    ...state,
    battlefield: {
      player: [createPermanent({ ...attacker, id: "dead", markedDamage: 4 })],
      opponent: [createPermanent({ id: "walker", name: "Test Walker", typeLine: "Planeswalker", counters: { Loyalty: 0 } })],
    },
  };
  const sba = performStateBasedActions(sbaState);
  assert.equal(sba.stateBasedActions.length, 2);
  assert.equal(sba.state.battlefield.player.length, 0);
  assert.equal(sba.state.battlefield.opponent.length, 0);
});

test("BoardState adapter creates explicit engine requests and serialization is versioned", () => {
  const profile = createDefaultProfile();
  const request = createBoardStateEngineRequest(profile, { type: "PASS_PRIORITY", playerId: "local-player" });
  assert.equal(request.context.rulesEngineVersion, getRulesEngineVersion());
  const serialized = serializeEngineState(request.state);
  assert.match(serialized, /boardstate-rules-engine/);
});

test("reducer routes core rules modules through the rules-engine boundary", () => {
  const reducerSource = readFileSync("src/state/gameReducer.js", "utf8");
  const simulationSource = readFileSync("src/simulation/commanderSimulation.js", "utf8");
  assert.equal(reducerSource.includes("../effects/effectEngine.js"), false);
  assert.equal(reducerSource.includes("../game/combatSystem.js"), false);
  assert.equal(reducerSource.includes("../game/entrySystem.js"), false);
  assert.equal(reducerSource.includes("../game/manaSystem.js"), false);
  assert.equal(reducerSource.includes("../rules-engine/index.js"), true);
  assert.equal(simulationSource.includes("../effects/effectEngine.js"), false);
  assert.equal(simulationSource.includes("../rules-engine/index.js"), true);
});

function collectFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? collectFiles(path) : [path];
  });
}
