import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  TIMELINE_RELATIONSHIP_VERSION,
  buildRelationshipGraph,
  collectTimelineEntries,
  createReplayObservation,
  createTimelineExperience,
  explainRelationships,
} from "../src/authoritative-core/timelineRelationshipEngine.js";
import { createKnowledgeEvent, createEventKnowledgeState } from "../src/authoritative-core/eventKnowledgeEngine.js";
import { createAction } from "../src/state/actions.js";
import { createDefaultProfile, createPermanent } from "../src/state/schema.js";
import { reduceProfile } from "../src/state/gameReducer.js";

function buildTimelineProfile() {
  let profile = createDefaultProfile();
  profile = reduceProfile(profile, createAction({ type: "LIFE_DELTA", amount: -3 }, profile));
  profile = reduceProfile(profile, createAction({
    type: "ADD_PERMANENT",
    card: { name: "Sol Ring", typeLine: "Artifact", oracleText: "{T}: Add {C}{C}." },
  }, profile));
  return profile;
}

test("timeline derives readable event groups without mutating authoritative state", () => {
  const profile = buildTimelineProfile();
  const before = JSON.stringify(profile.activeSession);
  const model = createTimelineExperience(profile.activeSession, { pageSize: 20 });

  assert.equal(model.version, TIMELINE_RELATIONSHIP_VERSION);
  assert.equal(model.presentationOnly, true);
  assert.equal(model.mutatesAuthoritativeState, false);
  assert.equal(model.executesRules, false);
  assert.equal(model.entries.length >= 2, true);
  assert.equal(model.entries.every((entry) => !entry.changeSummary.includes("{\"")), true);
  assert.equal(model.groups.length >= 1, true);
  assert.equal(JSON.stringify(profile.activeSession), before);
});

test("timeline filters and paginates large histories without retaining every visible row", () => {
  const profile = createDefaultProfile();
  const events = Array.from({ length: 220 }, (_, index) => createKnowledgeEvent({
    sessionId: profile.activeSession.id,
    eventId: `event-${index}`,
    eventType: index % 2 ? "DECLARE_ATTACKERS" : "CAST_SPELL",
    summary: index % 2 ? `Combat event ${index}` : `Spell event ${index}`,
    tags: index % 2 ? ["combat"] : ["spell", "stack"],
    timestamp: index + 1,
    turn: Math.floor(index / 10) + 1,
    phaseIndex: index % 2 ? 2 : 1,
  }));
  const session = {
    ...profile.activeSession,
    eventKnowledge: createEventKnowledgeState({ events }),
  };
  const firstPage = createTimelineExperience(session, { filter: "combat", page: 0, pageSize: 24 });
  const lastPage = createTimelineExperience(session, { filter: "combat", page: 99, pageSize: 24 });

  assert.equal(firstPage.entries.length, 24);
  assert.equal(firstPage.entries.every((entry) => entry.categories.includes("combat")), true);
  assert.equal(firstPage.pageCount, 5);
  assert.equal(lastPage.page, 4);
  assert.equal(lastPage.entries.length, 14);
});

test("replay observation is frozen, read-only, and leaves live life, zones, stack, and events unchanged", () => {
  const profile = buildTimelineProfile();
  const action = profile.activeSession.actionHistory.find((entry) => entry.actionType === "LIFE_DELTA");
  const before = JSON.stringify(profile.activeSession);
  const observation = createReplayObservation(profile.activeSession, { actionId: action.actionId });

  assert.equal(observation.found, true);
  assert.equal(observation.observationalOnly, true);
  assert.equal(observation.mutatesAuthoritativeState, false);
  assert.equal(observation.executesRules, false);
  assert.equal(observation.replaysGameplayEvent, false);
  assert.equal(observation.replaysAnimation, false);
  assert.equal(observation.returnPlan.applyReplaySnapshot, false);
  assert.equal(Object.isFrozen(observation), true);
  assert.equal(JSON.stringify(profile.activeSession), before);

  const ignoredLegacyCommand = reduceProfile(profile, createAction({
    type: "REPLAY_TO_ACTION",
    replayActionId: action.actionId,
  }, profile));
  assert.equal(JSON.stringify(ignoredLegacyCommand.activeSession), before);
});

test("relationship graph explains attachment, target, control, combat, and causation without private-zone cards", () => {
  const profile = createDefaultProfile();
  const host = createPermanent({ id: "host", name: "Commander", typeLine: "Legendary Creature", controller: "player" });
  const aura = createPermanent({
    id: "aura",
    name: "Shielding Aura",
    typeLine: "Enchantment - Aura",
    controller: "player",
    attachedToId: "host",
  });
  const blocker = createPermanent({ id: "blocker", name: "Guard", typeLine: "Creature", controller: "opponent" });
  const graph = buildRelationshipGraph({
    ...profile.activeSession,
    battlefield: { player: [host, aura], opponent: [blocker] },
    players: [{ battlefield: [{ id: "private-card", name: "Secret", zone: "hand" }] }],
    stack: [{ id: "stack-1", name: "Removal", sourceId: "stack-1", targetIds: ["host"] }],
    combat: { attackerIds: ["host"], blockers: { host: ["blocker"] } },
    eventKnowledge: createEventKnowledgeState({
      events: [
        createKnowledgeEvent({ eventId: "event-child", parentEventId: "event-parent", eventType: "TRIGGER_CREATED" }),
      ],
    }),
  }, { focusObjectId: "host" });
  const explanations = explainRelationships(graph, "host");

  assert.equal(graph.nodes.some((node) => node.id === "private-card"), false);
  assert.equal(graph.edges.some((edge) => edge.kind === "attached-to" && edge.from === "aura" && edge.to === "host"), true);
  assert.equal(graph.edges.some((edge) => edge.kind === "targets" && edge.to === "host"), true);
  assert.equal(graph.edges.some((edge) => edge.kind === "blocks"), true);
  assert.equal(graph.edges.some((edge) => edge.kind === "caused"), true);
  assert.equal(explanations.some((entry) => /attached to|targets|blocks/.test(entry.summary)), true);
});

test("timeline architecture remains platform-neutral", () => {
  const source = readFileSync(new URL("../src/authoritative-core/timelineRelationshipEngine.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\b(document|window|HTMLElement|localStorage|sessionStorage|history\.pushState)\b/);
  assert.doesNotMatch(source, /from\s+["'][^"']*(render|styles|serviceWorker)/);
  assert.equal(collectTimelineEntries(createDefaultProfile().activeSession).length, 0);
});
