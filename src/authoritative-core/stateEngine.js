import { clone } from "../state/ids.js";
import { DEFAULT_RULES_ENGINE_VERSION } from "../shared-contracts/version.js";
import { createEventKnowledgeState, EVENT_KNOWLEDGE_ENGINE_VERSION } from "./eventKnowledgeEngine.js";

export const STATE_ENGINE_VERSION = "boardstate-state-engine-0.1.0";

export const STATE_ENGINE_OWNED_FIELDS = Object.freeze([
  "battlefield",
  "stack",
  "zones",
  "life",
  "playerCounters",
  "commander",
  "manaPool",
  "continuousEffects",
  "delayedEffects",
  "triggerQueue",
  "pendingEffects",
  "priority",
  "combat",
  "turn",
  "phaseIndex",
  "fsm",
  "simulation",
  "syncedMultiplayer",
]);

export function createStateEngineMetadata(input = {}) {
  return {
    stateEngineVersion: input.stateEngineVersion || STATE_ENGINE_VERSION,
    authoritativeOwner: "boardstate-state-engine",
    mutableStateOwner: "state-engine",
    rulesAuthorityOwner: "boardstate-rules-engine",
    eventKnowledgeOwner: "boardstate-event-knowledge-engine",
    revision: Number(input.revision || 0),
    lastCommittedAt: Number(input.lastCommittedAt || 0),
    lastActionId: String(input.lastActionId || ""),
    deterministicSeed: String(input.deterministicSeed || ""),
    rulesEngineVersion: input.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
  };
}

export function normalizeStateEngineSession(session = {}) {
  return {
    ...session,
    stateEngine: createStateEngineMetadata({
      ...(session.stateEngine || {}),
      revision: Number(session.stateEngine?.revision || session.gameStateRevision || 0),
      rulesEngineVersion: session.rulesEngineVersion || session.stateEngine?.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
    }),
    eventKnowledge: createEventKnowledgeState(session.eventKnowledge || {
      engineVersion: EVENT_KNOWLEDGE_ENGINE_VERSION,
    }),
  };
}

export function commitStateTransition(previousSession = {}, nextSession = {}, context = {}) {
  const previousRevision = Number(previousSession.gameStateRevision || previousSession.stateEngine?.revision || 0);
  const explicitRevision = Number(nextSession.gameStateRevision || nextSession.stateEngine?.revision || 0);
  const shouldAdvance = context.advanceRevision !== false;
  const nextRevision = shouldAdvance ? Math.max(previousRevision + 1, explicitRevision) : Math.max(previousRevision, explicitRevision);
  const now = Number(context.committedAt || Date.now());
  const actionId = context.actionId || context.actionRecord?.actionId || context.action?.actionId || "";
  const session = normalizeStateEngineSession(nextSession);
  return {
    ...session,
    revision: Math.max(Number(session.revision || 0), nextRevision),
    gameStateRevision: nextRevision,
    updatedAt: now,
    stateEngine: createStateEngineMetadata({
      ...(session.stateEngine || {}),
      revision: nextRevision,
      lastCommittedAt: now,
      lastActionId: actionId,
      deterministicSeed: context.deterministicSeed || session.stateEngine?.deterministicSeed || "",
      rulesEngineVersion: session.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
    }),
  };
}

export function createStateEngineSnapshot(session = {}) {
  const normalized = normalizeStateEngineSession(session);
  const snapshot = clone(normalized);
  snapshot.runtime = undefined;
  snapshot.eventQueue = [];
  snapshot.undoStack = [];
  snapshot.redoStack = [];
  snapshot.eventKnowledge = {
    engineVersion: normalized.eventKnowledge?.engineVersion || EVENT_KNOWLEDGE_ENGINE_VERSION,
    eventCount: normalized.eventKnowledge?.eventCount || 0,
    lastEventId: normalized.eventKnowledge?.lastEventId || "",
    lastEventRevision: normalized.eventKnowledge?.lastEventRevision || 0,
  };
  return snapshot;
}

export function validateStateEngineOwnership(session = {}) {
  const normalized = normalizeStateEngineSession(session);
  const errors = [];
  if (normalized.stateEngine?.mutableStateOwner !== "state-engine") {
    errors.push("mutable game state must be owned by the State Engine");
  }
  if (normalized.authority?.hubIsGameplayAuthority) {
    errors.push("Hub must not be gameplay authority");
  }
  if (normalized.eventKnowledge?.engineVersion !== EVENT_KNOWLEDGE_ENGINE_VERSION) {
    errors.push("event knowledge state must use the Event Knowledge Engine version");
  }
  return {
    valid: errors.length === 0,
    errors,
    stateEngineVersion: STATE_ENGINE_VERSION,
  };
}
