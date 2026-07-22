import test from "node:test";
import assert from "node:assert/strict";

import {
  QUESTION_SYSTEM_VERSION,
  RULES_ASSISTANT_VERSION,
  askRulesQuestion,
  createRulesAssistantState,
  createWhatIfFoundation,
  explainLayerBreakdown,
  explainPermanent,
  explainStackObject,
  explainTrigger,
  searchRulesAssistant,
} from "../src/authoritative-core/rulesAssistant.js";
import {
  createEventKnowledgeState,
  createKnowledgeEvent,
} from "../src/authoritative-core/eventKnowledgeEngine.js";
import { createDefaultProfile, createPermanent } from "../src/state/schema.js";

function createAssistantSession() {
  const profile = createDefaultProfile();
  const countersMatter = createPermanent({
    id: "permanent-ajani",
    name: "Ajani's Pridemate",
    typeLine: "Creature - Cat Soldier",
    oracleText: "Whenever you gain life, put a +1/+1 counter on Ajani's Pridemate.",
    owner: "local-player",
    controller: "local-player",
    basePower: 2,
    baseToughness: 2,
    currentPower: 7,
    currentToughness: 7,
    counters: { "+1/+1": 5 },
    layerBreakdown: [
      {
        layer: 9,
        modifierId: "counter-five",
        sourceId: "permanent-ajani",
        sourceName: "Five +1/+1 counters",
        operation: "add-pt",
        powerDelta: 5,
        toughnessDelta: 5,
      },
    ],
    keywords: ["Vigilance"],
  });
  const tokenEvent = createKnowledgeEvent({
    sessionId: "session-rules-assistant",
    gameId: "game-rules-assistant",
    eventId: "event-token-created",
    eventType: "TOKEN_CREATED",
    summary: "Anim Pakal created a Gnome token",
    tags: ["token", "trigger"],
    turn: 5,
    phase: "Combat",
    playerId: "local-player",
    objectNames: ["Gnome token"],
    ruleReferences: ["CR 111 - Tokens"],
  });
  const triggerEvent = createKnowledgeEvent({
    sessionId: "session-rules-assistant",
    gameId: "game-rules-assistant",
    eventId: "event-life-trigger",
    parentEventId: "event-token-created",
    rootEventId: "event-token-created",
    eventGroupId: tokenEvent.eventGroupId,
    eventType: "TRIGGER_CREATED",
    summary: "Soul Warden triggered from the token entering",
    tags: ["trigger", "life"],
    turn: 5,
    phase: "Combat",
    playerId: "local-player",
    objectNames: ["Soul Warden"],
    ruleReferences: ["CR 603 - Handling Triggered Abilities"],
  });
  return {
    ...profile.activeSession,
    sessionId: "session-rules-assistant",
    gameId: "game-rules-assistant",
    turn: 5,
    phaseIndex: 2,
    selectedIds: ["permanent-ajani"],
    battlefield: {
      ...profile.activeSession.battlefield,
      player: [
        countersMatter,
        createPermanent({
          id: "hidden-card",
          name: "Secret Hand Card",
          typeLine: "Instant",
          oracleText: "Private hidden text.",
          zone: "hand",
        }),
      ],
      opponent: [
        createPermanent({
          id: "opponent-dragon",
          name: "Dragon Whelp",
          typeLine: "Creature - Dragon",
          oracleText: "Flying",
          owner: "opponent-player",
          controller: "opponent-player",
          currentPower: 2,
          currentToughness: 3,
        }),
      ],
    },
    stack: [
      {
        id: "stack-bolt",
        name: "Lightning Bolt",
        controller: "opponent-player",
        card: {
          name: "Lightning Bolt",
          typeLine: "Instant",
          oracleText: "Lightning Bolt deals 3 damage to any target.",
        },
        targetIds: ["permanent-ajani"],
      },
    ],
    triggerQueue: [
      {
        id: "trigger-pridemate",
        sourceName: "Ajani's Pridemate",
        eventType: "life-gain",
        status: "pending",
        optional: false,
      },
    ],
    eventKnowledge: createEventKnowledgeState({
      events: [triggerEvent, tokenEvent],
    }),
  };
}

test("rules assistant exposes an authoritative, non-generative Question System state", () => {
  const session = createAssistantSession();
  const model = createRulesAssistantState(session);
  assert.equal(model.version, RULES_ASSISTANT_VERSION);
  assert.equal(model.questionSystemVersion, QUESTION_SYSTEM_VERSION);
  assert.equal(model.generativeAiEnabled, false);
  assert.equal(model.externalSearchEnabled, false);
  assert.equal(model.mutatesGameState, false);
  assert.equal(model.supportedQuestionTypes.includes("why"), true);
  assert.equal(model.context.selectedPermanentName, "Ajani's Pridemate");
});

test("rules assistant answers stack questions from current stack state", () => {
  const answer = askRulesQuestion(createAssistantSession(), "What is on the stack?");
  assert.equal(answer.questionType, "what");
  assert.match(answer.answer.shortAnswer, /Lightning Bolt/);
  assert.equal(answer.confidence.information, "engine-verified");
  assert.equal(answer.evidence[0].kind, "stack-object");
  assert.equal(answer.boundaries.noGenerativeAI, true);
});

test("rules assistant explains ownership and control for selected permanents", () => {
  const answer = askRulesQuestion(createAssistantSession(), "Who controls this?");
  assert.match(answer.answer.headline, /local-player/);
  assert.match(answer.answer.shortAnswer, /Owner: local-player/);
  assert.equal(answer.ruleReferences.includes("CR 109 - Objects"), true);
});

test("rules assistant explains layer and counter-derived power/toughness", () => {
  const session = createAssistantSession();
  const answer = askRulesQuestion(session, "Why is this creature a 7/7?", { explanationLevel: "advanced" });
  assert.match(answer.answer.shortAnswer, /Final displayed power\/toughness is 7\/7/);
  assert.equal(answer.ruleReferences.includes("CR 613 - Interaction of Continuous Effects"), true);
  assert.ok(answer.answer.advanced.some((entry) => /Layer 9/.test(entry)));

  const breakdown = explainLayerBreakdown(session.battlefield.player[0], session);
  assert.equal(breakdown.current, "7/7");
  assert.equal(breakdown.layers[0].layer, 9);
});

test("rules assistant explains pending triggers and event provenance chains", () => {
  const session = createAssistantSession();
  const triggerAnswer = explainTrigger(session, "trigger-pridemate");
  assert.match(triggerAnswer.answer.shortAnswer, /mandatory/);
  assert.equal(triggerAnswer.ruleReferences.includes("CR 603 - Handling Triggered Abilities"), true);

  const eventAnswer = askRulesQuestion(session, "Why did this trigger?");
  assert.equal(eventAnswer.eventChain.length >= 1, true);
  assert.ok(eventAnswer.evidence.some((entry) => entry.kind === "trigger"));
});

test("rules assistant supports card, stack, event search without exposing hidden zones", () => {
  const session = createAssistantSession();
  const visibleResults = searchRulesAssistant(session, "Ajani");
  assert.ok(visibleResults.results.some((entry) => entry.kind === "permanent"));

  const hiddenResults = searchRulesAssistant(session, "Secret Hand Card");
  assert.equal(hiddenResults.results.length, 0);

  const stackAnswer = explainStackObject(session, "stack-bolt");
  assert.match(stackAnswer.answer.shortAnswer, /Lightning Bolt/);
});

test("rules assistant prepares What If analysis as a non-mutating Dry Run fork boundary", () => {
  const session = createAssistantSession();
  const before = JSON.stringify(session);
  const answer = askRulesQuestion(session, "What if I countered this?");
  assert.equal(answer.whatIf.status, "prepared-for-dry-run");
  assert.equal(answer.whatIf.mutatesAuthoritativeSession, false);
  assert.equal(JSON.stringify(session), before);

  const foundation = createWhatIfFoundation(session, "What if I attacked differently?");
  assert.equal(foundation.safety.liveSessionPreserved, true);
});

test("rules assistant refuses to invent answers when authoritative evidence is missing", () => {
  const session = createDefaultProfile().activeSession;
  const answer = askRulesQuestion(session, "Why did my commander die?");
  assert.match(answer.answer.shortAnswer, /will not invent game state/i);
  assert.equal(answer.confidence.information, "unknown");
  assert.equal(answer.confidence.execution, "manual-resolution-required");

  const permanentAnswer = explainPermanent(session, "missing");
  assert.equal(permanentAnswer.confidence.information, "unknown");
});
