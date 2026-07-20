import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  AUTHORITATIVE_PIPELINE_STAGES,
  createAuthoritativePipelineReport,
  createKnowledgeEvent,
  createStateEngineSnapshot,
  createEventKnowledgeState,
  EVENT_KNOWLEDGE_ENGINE_VERSION,
  EVENT_TAGS,
  recordActionKnowledge,
  reconstructStateAfterEvent,
  validateStateEngineOwnership,
} from "../src/authoritative-core/index.js";
import { createDefaultProfile, createPermanent } from "../src/state/schema.js";
import { createAction } from "../src/state/actions.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createCanonicalEvent, validateEvent } from "../src/shared-contracts/index.js";

test("authoritative core exposes one deterministic pipeline and no UI authority", () => {
  const report = createAuthoritativePipelineReport();
  assert.deepEqual(report.stages, AUTHORITATIVE_PIPELINE_STAGES);
  assert.equal(report.rulesEngineAuthority, "rules-engine");
  assert.equal(report.stateEngineAuthority, "state-engine");
  assert.equal(report.eventKnowledgeAuthority, "event-knowledge-engine");
  assert.equal(report.uiIsAuthoritative, false);
  assert.equal(report.hubIsGameplayAuthority, false);
});

test("Event Knowledge events record who, what, when, where, why, how, changes, metadata, tags, and importance", () => {
  const event = createKnowledgeEvent({
    sessionId: "session-authority",
    gameId: "game-authority",
    eventType: "SPELL_CAST",
    causedByActionId: "action-cast",
    eventGroupId: "event-cast-group",
    playerId: "local-player",
    affectedPlayerIds: ["opponent-player"],
    sourceZone: "hand",
    destinationZone: "stack",
    syncRevision: 7,
    turn: 4,
    phase: "Main 1",
    phaseIndex: 1,
    tags: ["spell", "stack", "commander"],
    importance: "critical",
    ruleReferences: ["CR 601"],
    undoReferences: {
      actionId: "action-cast",
      createdObjectIds: ["stack-object-1"],
    },
    changes: {
      stackChanges: [{ beforeCount: 0, afterCount: 1, topObjectId: "stack-object-1" }],
    },
  });

  assert.equal(Object.isFrozen(event), true);
  assert.equal(event.sessionId, "session-authority");
  assert.equal(event.who.initiatingPlayerId, "local-player");
  assert.equal(event.who.affectedPlayerIds.includes("opponent-player"), true);
  assert.equal(event.what.eventType, "SPELL_CAST");
  assert.equal(event.when.turn, 4);
  assert.equal(event.where.sourceZone, "hand");
  assert.equal(event.where.destinationZone, "stack");
  assert.equal(event.why.originatingActionId, "action-cast");
  assert.equal(event.how.resolutionMethod, "state-engine-commit");
  assert.equal(event.changes.stackChanges[0].afterCount, 1);
  assert.equal(event.syncRevision, 7);
  assert.equal(event.eventVersion, "event-knowledge-event-1");
  assert.equal(event.informationConfidence, "engine-verified");
  assert.equal(event.executionConfidence, "engine-validated");
  assert.equal(event.importance, "critical");
  assert.equal(event.tags.includes("spell"), true);
  assert.equal(event.tags.includes("stack"), true);
  assert.equal(event.tags.includes("commander"), true);
  assert.equal(EVENT_TAGS.includes("replacement"), true);

  const duplicate = createKnowledgeEvent({
    sessionId: "session-authority",
    gameId: "game-authority",
    eventType: "SPELL_CAST",
    causedByActionId: "action-cast",
    eventGroupId: "event-cast-group",
    syncRevision: 7,
  });
  assert.equal(duplicate.eventId, event.eventId);
});

test("reducer actions commit State Engine revisions and append reconstructable Event Knowledge", () => {
  const base = createDefaultProfile();
  const action = createAction({
    type: "ADD_CUSTOM_TOKEN",
    name: "Servo",
    typeLine: "Token Artifact Creature - Servo",
    power: 1,
    toughness: 1,
    controller: "player",
  }, base);
  const next = reduceProfile(base, action);
  const session = next.activeSession;
  const eventId = session.eventKnowledge.lastEventId;

  assert.equal(validateStateEngineOwnership(session).valid, true);
  assert.equal(session.stateEngine.mutableStateOwner, "state-engine");
  assert.equal(session.gameStateRevision > base.activeSession.gameStateRevision, true);
  assert.equal(session.eventKnowledge.engineVersion, EVENT_KNOWLEDGE_ENGINE_VERSION);
  assert.equal(session.eventKnowledge.events.length >= 1, true);
  assert.equal(session.actionHistory[0].knowledgeEventId, eventId);
  assert.equal(session.eventKnowledge.events[0].tags.includes("token"), true);

  const reconstructed = reconstructStateAfterEvent(session, eventId);
  assert.equal(reconstructed.found, true);
  assert.equal(reconstructed.snapshot.battlefield.player.length, session.battlefield.player.length);
});

test("Event Knowledge groups related transaction events without editing prior events", () => {
  const session = createDefaultProfile().activeSession;
  const first = recordActionKnowledge(session, {
    actionId: "action-mana",
    actionType: "ADD_MANA",
    timestamp: 100,
    playerId: "local-player",
    payload: { color: "G", amount: 1 },
    targetIds: [],
    snapshot: createStateEngineSnapshot(session),
  });
  const eventId = first.eventKnowledge.lastEventId;
  const second = recordActionKnowledge(first, {
    actionId: "action-mana",
    actionType: "ADD_MANA",
    timestamp: 101,
    playerId: "local-player",
    payload: { color: "G", amount: 1 },
    targetIds: [],
    snapshot: createStateEngineSnapshot(first),
  });

  assert.equal(second.eventKnowledge.events.filter((event) => event.eventId === eventId).length, 1);
  assert.equal(second.eventKnowledge.groups.length >= 1, true);
  assert.equal(second.eventKnowledge.groups[0].eventIds.includes(eventId), true);
});

test("canonical events carry Event Knowledge metadata while preserving legacy validation", () => {
  const event = createCanonicalEvent({
    eventType: "COMBAT_DAMAGE_DEALT",
    gameId: "game-core",
    sessionId: "session-core",
    parentEventId: "event-parent",
    rootEventId: "event-root",
    eventGroupId: "event-combat-group",
    syncRevision: 12,
    informationConfidence: "engine-verified",
    executionConfidence: "engine-validated",
    importance: "normal",
    tags: ["combat", "damage", "life"],
    undoReferences: { modifiedObjectIds: ["creature-1"] },
    payload: { amount: 3 },
  });

  assert.equal(validateEvent(event).valid, true);
  assert.equal(event.parentEventId, "event-parent");
  assert.equal(event.rootEventId, "event-root");
  assert.equal(event.eventGroupId, "event-combat-group");
  assert.equal(event.syncRevision, 12);
  assert.equal(event.tags.includes("combat"), true);
  assert.equal(event.undoReferences.modifiedObjectIds[0], "creature-1");
});

test("authoritative core has no UI, DOM, storage, or network dependency", () => {
  const files = collectFiles("src/authoritative-core").filter((file) => file.endsWith(".js"));
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

test("State Engine snapshots avoid recursive Event Knowledge growth", () => {
  const profile = createDefaultProfile();
  profile.activeSession.battlefield.player = [
    createPermanent({ id: "creature-1", name: "Runeclaw Bear", typeLine: "Creature - Bear" }),
  ];
  const snapshot = createStateEngineSnapshot({
    ...profile.activeSession,
    eventKnowledge: createEventKnowledgeState({
      events: [createKnowledgeEvent({ eventType: "PERMANENT_ENTERED", sessionId: "session-1", gameId: "game-1" })],
    }),
  });
  assert.equal(snapshot.eventKnowledge.eventCount, 1);
  assert.equal(Array.isArray(snapshot.eventKnowledge.events), false);
  assert.equal(snapshot.battlefield.player[0].name, "Runeclaw Bear");
});

function collectFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? collectFiles(path) : [path];
  });
}
