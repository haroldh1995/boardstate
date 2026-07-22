import test from "node:test";
import assert from "node:assert/strict";

import {
  AI_GAMEPLAY_ENGINE_VERSION,
  createAiGameplayState,
  createExplainableAiDecision,
} from "../src/authoritative-core/aiGameplayEngine.js";
import { createAction } from "../src/state/actions.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createDefaultProfile, createPermanent } from "../src/state/schema.js";
import { saveCurrentGame } from "../src/storage/saveState.js";

function dispatch(profile, input) {
  return reduceProfile(profile, createAction(input, profile));
}

function createAnalysisProfile() {
  const profile = createDefaultProfile();
  profile.activeSession = {
    ...profile.activeSession,
    turn: 5,
    phaseIndex: 2,
    battlefield: {
      ...profile.activeSession.battlefield,
      player: [
        createPermanent({
          id: "local-commander",
          name: "Astra, Dawn Marshal",
          typeLine: "Legendary Creature - Human Soldier",
          oracleText: "Whenever you attack, create a 1/1 Soldier creature token.",
          isCommander: true,
          currentPower: 5,
          currentToughness: 5,
        }),
      ],
      opponent: [
        createPermanent({
          id: "alpha-commander",
          name: "Hearthhull, the Worldseed",
          typeLine: "Legendary Creature - Dinosaur",
          oracleText: "Trample. Whenever a land enters, create a token.",
          isCommander: true,
          currentPower: 6,
          currentToughness: 6,
          controller: "alpha",
          owner: "alpha",
        }),
        createPermanent({
          id: "alpha-tokens",
          name: "Elemental",
          typeLine: "Token Creature - Elemental",
          oracleText: "",
          isToken: true,
          quantity: 8,
          currentPower: 3,
          currentToughness: 3,
          controller: "alpha",
          owner: "alpha",
        }),
      ],
    },
    simulation: {
      ...profile.activeSession.simulation,
      enabled: true,
      status: "running",
      currentPlayerId: "alpha",
      selectedOpponents: ["alpha"],
      players: {
        "local-player": { id: "local-player", name: "Player", life: 32 },
        alpha: { id: "alpha", name: "Alpha", life: 40, isNpc: true },
      },
      opponents: {
        alpha: {
          id: "alpha",
          name: "Alpha",
          commander: { name: "Hearthhull, the Worldseed", zone: "battlefield", commanderTax: 2 },
          strategy: {
            archetype: "Landfall Token Aggro",
            tags: ["aggro", "token", "landfall"],
            priorities: ["commander", "combat"],
          },
          zones: {
            hand: [{ name: "Cultivate" }],
            library: [{ name: "Forest" }],
            graveyard: [{ name: "Rampant Growth" }],
          },
        },
      },
      log: [
        {
          id: "sim-log-1",
          actorId: "alpha",
          text: "Alpha attacks Player with Elemental tokens.",
          detail: "Alpha used legal attackers from its public battlefield.",
        },
      ],
    },
    eventKnowledge: {
      ...profile.activeSession.eventKnowledge,
      events: [
        { eventId: "event-1", summary: "Commander damage changed", importance: "major", turn: 5, phase: "Combat" },
      ],
      eventCount: 1,
      lastEventId: "event-1",
    },
  };
  return profile;
}

test("AI gameplay state is explainable, local-only, and non-authoritative", () => {
  const profile = createAnalysisProfile();
  const ai = createAiGameplayState(profile.activeSession, { informationMode: "public-information" });
  assert.equal(ai.version, AI_GAMEPLAY_ENGINE_VERSION);
  assert.equal(ai.available, true);
  assert.equal(ai.externalAiServicesEnabled, false);
  assert.equal(ai.generativeAiEnabled, false);
  assert.equal(ai.mutatesGameState, false);
  assert.equal(ai.canWaiveRules, false);
  assert.equal(ai.boundaries.neverBypassesRulesEngine, true);
  assert.equal(ai.dryRun.separateFromLiveGame, true);
  assert.equal(ai.activeProfiles[0].playerId, "alpha");
  assert.equal(ai.activeProfiles[0].usesRulesEngine, true);
});

test("AI analysis uses public battlefield evidence without exposing hidden opponent cards", () => {
  const ai = createAiGameplayState(createAnalysisProfile().activeSession, { informationMode: "public-information" });
  assert.equal(ai.threatAnalysis.mostThreateningPlayer.playerId, "alpha");
  assert.ok(ai.threatAnalysis.mostThreateningPlayer.reasons.some((reason) => /Commander|token|power|permanent/i.test(reason)));
  assert.equal(ai.boardAnalysis.players.find((entry) => entry.playerId === "alpha").publicResources.creatures >= 1, true);
  assert.equal(ai.boardAnalysis.players.find((entry) => entry.playerId === "alpha").cardAdvantage, 0);
  assert.equal(JSON.stringify(ai.threatAnalysis).includes("Cultivate"), false);
});

test("AI decisions record alternatives, risks, and rules-engine submission status", () => {
  const decision = createExplainableAiDecision(createAnalysisProfile().activeSession, {
    playerId: "alpha",
    selectedAction: { actionType: "DECLARE_ATTACKERS", label: "Attack with tokens", score: 8, legal: true },
    candidateActions: [
      { actionType: "DECLARE_ATTACKERS", label: "Attack with tokens", score: 8, legal: true, risk: "Blockers may trade." },
      { actionType: "PASS_PRIORITY", label: "Pass priority", score: 1, legal: true },
      { actionType: "CAST_SPELL", label: "Cast illegal spell", score: 9, legal: false },
    ],
    submittedThroughRulesEngine: true,
  });
  assert.equal(decision.mutatesGameState, false);
  assert.equal(decision.submittedThroughRulesEngine, true);
  assert.equal(decision.legalCandidates.length, 2);
  assert.ok(decision.rejectedAlternatives.some((entry) => /not legal/i.test(entry.reason)));
  assert.ok(decision.explanation.informationUsed.includes("public battlefield"));
});

test("reducer refreshes AI analysis after Dry Run simulation actions", () => {
  let profile = createDefaultProfile();
  profile = dispatch(profile, { type: "START_SIMULATION", selectedOpponents: ["alpha", "beta"], speed: "normal" });
  assert.equal(profile.activeSession.aiGameplay.available, true);
  assert.deepEqual(profile.activeSession.aiGameplay.activeProfileIds.sort(), ["alpha", "beta"]);
  assert.equal(profile.activeSession.aiGameplay.boundaries.noExternalLlm, true);

  profile = dispatch(profile, { type: "SIMULATION_PASS_TURN" });
  profile = dispatch(profile, { type: "SIMULATION_TICK", internalOnly: true, remote: true });
  assert.ok(profile.activeSession.aiGameplay.analysisLog.length >= 1);
  assert.ok(profile.activeSession.aiGameplay.latestDecision);
  assert.equal(profile.activeSession.aiGameplay.latestDecision.mutatesGameState, false);
});

test("AI gameplay metadata is preserved in local and canonical saves", () => {
  let profile = createAnalysisProfile();
  profile = dispatch(profile, { type: "AI_GAMEPLAY_REFRESH_ANALYSIS" });
  const saved = saveCurrentGame(profile, { saveName: "AI analysis save" });
  const save = saved.localSaves.items[0];
  assert.equal(save.metadata.aiGameplay.externalAiServicesEnabled, false);
  assert.equal(save.metadata.aiGameplay.generativeAiEnabled, false);
  assert.equal(save.gameState.activeSession.aiGameplay.version, AI_GAMEPLAY_ENGINE_VERSION);
  assert.equal(save.canonicalSave.aiAnalysisMetadata.externalAiServicesEnabled, false);
  assert.equal(save.canonicalSave.aiGameplay.version, AI_GAMEPLAY_ENGINE_VERSION);
  assert.equal(save.canonicalSave.stateSnapshot.aiGameplay, undefined);
});
