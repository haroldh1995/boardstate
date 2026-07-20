import { clone } from "../state/ids.js";
import { createContractId, normalizeContractId } from "../shared-contracts/ids.js";
import {
  EXECUTION_CONFIDENCE_LEVELS,
  INFORMATION_CONFIDENCE_LEVELS,
} from "../shared-contracts/commanderModernization.js";
import { DEFAULT_RULES_ENGINE_VERSION } from "../shared-contracts/version.js";

export const EVENT_KNOWLEDGE_ENGINE_VERSION = "boardstate-event-knowledge-engine-0.1.0";

export const EVENT_IMPORTANCE_LEVELS = Object.freeze(["critical", "major", "normal", "minor"]);

export const EVENT_TAGS = Object.freeze([
  "combat",
  "spell",
  "land",
  "mana",
  "token",
  "commander",
  "graveyard",
  "draw",
  "discard",
  "counter",
  "copy",
  "replacement",
  "trigger",
  "legendary",
  "planeswalker",
  "artifact",
  "creature",
  "enchantment",
  "instant",
  "sorcery",
  "battle",
  "damage",
  "life",
  "priority",
  "stack",
  "state",
  "zone",
  "sync",
  "tutorial",
  "simulation",
]);

export function createEventKnowledgeState(input = {}) {
  const events = Array.isArray(input.events) ? input.events.map(normalizeKnowledgeEvent) : [];
  const stateSnapshots = Array.isArray(input.stateSnapshots)
    ? input.stateSnapshots.map(normalizeStateSnapshot).filter(Boolean)
    : [];
  const groups = Array.isArray(input.groups)
    ? input.groups.map(normalizeEventGroup).filter(Boolean)
    : deriveGroupsFromEvents(events);
  return {
    engineVersion: input.engineVersion || EVENT_KNOWLEDGE_ENGINE_VERSION,
    eventVersion: input.eventVersion || "event-knowledge-event-1",
    immutable: true,
    events,
    groups,
    stateSnapshots,
    eventCount: Number(input.eventCount || events.length),
    lastEventId: input.lastEventId || events[0]?.eventId || "",
    lastEventRevision: Number(input.lastEventRevision || events[0]?.syncRevision || events.length || 0),
    indexes: {
      byActionId: clone(input.indexes?.byActionId || {}),
      byTag: clone(input.indexes?.byTag || {}),
      byPlayerId: clone(input.indexes?.byPlayerId || {}),
      byGroupId: clone(input.indexes?.byGroupId || {}),
    },
  };
}

export function createEventGroup(input = {}) {
  const eventGroupId = normalizeContractId(
    input.eventGroupId || createDeterministicKnowledgeId("eventId", [
      input.sessionId,
      input.rootEventId,
      input.actionId,
      input.groupType || input.eventType || "group",
    ]),
    "eventId"
  );
  return {
    eventGroupId,
    rootEventId: String(input.rootEventId || ""),
    parentEventId: String(input.parentEventId || ""),
    sessionId: String(input.sessionId || ""),
    gameId: String(input.gameId || ""),
    groupType: String(input.groupType || input.eventType || "transaction"),
    label: String(input.label || input.groupType || input.eventType || "Event Group"),
    eventIds: Array.isArray(input.eventIds) ? [...new Set(input.eventIds.filter(Boolean))] : [],
    createdAt: Number(input.createdAt || Date.now()),
    collapsedByDefault: Boolean(input.collapsedByDefault),
    replayExpandable: input.replayExpandable !== false,
  };
}

export function createKnowledgeEvent(input = {}) {
  const sessionId = String(input.sessionId || input.session?.sessionId || input.session?.id || "");
  const gameId = String(input.gameId || input.session?.gameId || input.session?.id || "");
  const eventType = normalizeEventType(input.eventType || input.type || input.actionType || "STATE_CHANGED");
  const eventGroupId = String(input.eventGroupId || input.groupId || "");
  const parentEventId = String(input.parentEventId || "");
  const rootEventId = String(input.rootEventId || parentEventId || "");
  const causedByActionId = String(input.causedByActionId || input.actionId || input.action?.actionId || "");
  const syncRevision = Math.max(0, Number(input.syncRevision || input.revision || input.session?.eventRevision || 0));
  const sequence = Number(input.sequence || 0);
  const eventId = normalizeContractId(
    input.eventId || input.id || createDeterministicKnowledgeId("eventId", [
      sessionId,
      eventGroupId,
      parentEventId,
      rootEventId,
      causedByActionId,
      eventType,
      sequence,
    ]),
    "eventId"
  );

  const normalizedRootId = rootEventId || eventId;
  const normalizedGroupId = eventGroupId || createDeterministicKnowledgeId("eventId", [sessionId, normalizedRootId, causedByActionId, "group"]);
  const createdAt = Number(input.createdAt || input.timestamp || Date.now());
  const turn = Number(input.turn ?? input.session?.turn ?? 0);
  const phaseIndex = Number(input.phaseIndex ?? input.session?.phaseIndex ?? 0);
  const phase = String(input.phase || input.session?.phase || "");
  const step = String(input.step || input.session?.step || "");
  const tags = normalizeTags(input.tags || deriveTags(input));
  const importance = normalizeImportance(input.importance || deriveImportance(eventType, tags, input));
  const actionType = normalizeEventType(input.actionType || input.action?.actionType || eventType);

  return deepFreeze({
    eventId,
    parentEventId: String(input.parentEventId || ""),
    rootEventId: normalizedRootId,
    eventGroupId: normalizedGroupId,
    sessionId,
    gameId,
    syncRevision,
    eventVersion: String(input.eventVersion || "event-knowledge-event-1"),
    engineVersion: EVENT_KNOWLEDGE_ENGINE_VERSION,
    rulesEngineVersion: input.rulesEngineVersion || input.session?.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
    informationConfidence: normalizeConfidence(input.informationConfidence, INFORMATION_CONFIDENCE_LEVELS, "engine-verified"),
    executionConfidence: normalizeConfidence(input.executionConfidence, EXECUTION_CONFIDENCE_LEVELS, "engine-validated"),
    importance,
    tags,
    ruleReferences: normalizeStringArray(input.ruleReferences),
    ruleAmendmentReferences: normalizeStringArray(input.ruleAmendmentReferences || input.ruleAmendmentIds),
    undoReferences: normalizeUndoReferences(input.undoReferences),
    who: {
      initiatingPlayerId: String(input.who?.initiatingPlayerId || input.initiatingPlayerId || input.playerId || input.action?.playerId || ""),
      affectedPlayerIds: normalizeStringArray(input.who?.affectedPlayerIds || input.affectedPlayerIds || input.targetPlayerIds),
      controllerPlayerId: String(input.who?.controllerPlayerId || input.controllerPlayerId || input.playerId || input.action?.playerId || ""),
      ownerPlayerIds: normalizeStringArray(input.who?.ownerPlayerIds || input.ownerPlayerIds),
    },
    what: {
      eventType,
      actionType,
      objectIds: normalizeStringArray(input.what?.objectIds || input.objectIds),
      objectNames: normalizeStringArray(input.what?.objectNames || input.objectNames),
      summary: String(input.what?.summary || input.summary || eventType),
    },
    when: {
      timestamp: createdAt,
      turn,
      phase,
      phaseIndex,
      step,
    },
    where: {
      sourceZone: String(input.where?.sourceZone || input.sourceZone || input.action?.sourceZone || ""),
      destinationZone: String(input.where?.destinationZone || input.destinationZone || ""),
      zoneChanges: clone(input.where?.zoneChanges || input.zoneChanges || []),
    },
    why: {
      originatingActionId: causedByActionId,
      originatingRule: String(input.why?.originatingRule || input.originatingRule || ""),
      originatingTriggerId: String(input.why?.originatingTriggerId || input.originatingTriggerId || ""),
      originatingReplacementEffectId: String(input.why?.originatingReplacementEffectId || input.originatingReplacementEffectId || ""),
      causationChain: normalizeStringArray(input.why?.causationChain || input.causationChain),
    },
    how: {
      resolutionMethod: String(input.how?.resolutionMethod || input.resolutionMethod || "state-engine-commit"),
      replacementInteractions: clone(input.how?.replacementInteractions || input.replacementInteractions || []),
      preventionInteractions: clone(input.how?.preventionInteractions || input.preventionInteractions || []),
      stateBasedActions: clone(input.how?.stateBasedActions || input.stateBasedActions || []),
    },
    changes: normalizeChanges(input.changes || {}),
    replayMetadata: clone(input.replayMetadata || {}),
    synchronizationMetadata: clone(input.synchronizationMetadata || {}),
    aiMetadata: clone(input.aiMetadata || {}),
    questionMetadata: clone(input.questionMetadata || {}),
    debuggingMetadata: clone(input.debuggingMetadata || {}),
    analyticsMetadata: clone(input.analyticsMetadata || {}),
    payload: clone(input.payload || {}),
  });
}

export function recordGameEventKnowledge(session = {}, gameEvent = {}, options = {}) {
  const knowledgeEvent = createKnowledgeEvent({
    session,
    eventId: gameEvent.knowledgeEventId || gameEvent.id,
    eventType: gameEvent.eventType,
    createdAt: gameEvent.timestamp,
    playerId: gameEvent.playerId,
    sourceZone: gameEvent.payload?.sourceZone || "",
    destinationZone: gameEvent.payload?.destinationZone || "",
    sourceId: gameEvent.sourceId,
    syncRevision: options.syncRevision || session.eventRevision || session.revision || 0,
    eventGroupId: options.eventGroupId || gameEvent.eventGroupId,
    parentEventId: options.parentEventId || gameEvent.parentEventId,
    rootEventId: options.rootEventId || gameEvent.rootEventId,
    causedByActionId: options.causedByActionId || gameEvent.causedByActionId || gameEvent.payload?.actionId || "",
    tags: deriveTags({ eventType: gameEvent.eventType, payload: gameEvent.payload }),
    importance: deriveImportance(gameEvent.eventType, [], gameEvent),
    payload: gameEvent.payload || {},
    changes: inferChangesFromEvent(session, gameEvent),
    replayMetadata: {
      collapseIntoParent: Boolean(options.collapseIntoParent),
      source: "game-event-bus",
    },
  });
  return appendKnowledgeEvent(session, knowledgeEvent, {
    snapshot: options.snapshot !== false ? createKnowledgeStateSnapshot(session, knowledgeEvent.eventId) : null,
  });
}

export function recordActionKnowledge(session = {}, actionRecord = {}, options = {}) {
  const beforeSession = options.beforeSession || options.previousSession || null;
  const event = createKnowledgeEvent({
    session,
    eventType: `${normalizeEventType(actionRecord.actionType || "ACTION")}_RESOLVED`,
    actionType: actionRecord.actionType || "UNKNOWN",
    causedByActionId: actionRecord.actionId,
    eventGroupId: actionRecord.eventGroupId || createDeterministicKnowledgeId("eventId", [session.sessionId || session.id, actionRecord.actionId, "group"]),
    rootEventId: actionRecord.rootEventId || "",
    playerId: actionRecord.playerId,
    sourceZone: actionRecord.payload?.sourceZone || actionRecord.sourceZone || "",
    destinationZone: inferDestinationZone(actionRecord),
    syncRevision: Number(options.syncRevision || session.eventRevision || session.revision || 0) + 1,
    createdAt: actionRecord.timestamp || Date.now(),
    turn: session.turn,
    phaseIndex: session.phaseIndex,
    phase: options.phase || "",
    step: options.step || "",
    tags: deriveTags({ actionType: actionRecord.actionType, payload: actionRecord.payload, action: actionRecord }),
    importance: deriveImportance(actionRecord.actionType, [], actionRecord),
    undoReferences: {
      actionId: actionRecord.actionId,
      dependencies: normalizeStringArray(options.dependencies),
      createdObjectIds: normalizeStringArray(options.createdObjectIds),
      removedObjectIds: normalizeStringArray(options.removedObjectIds),
      modifiedObjectIds: normalizeStringArray(options.modifiedObjectIds || actionRecord.targetIds),
      cascadingEffectIds: normalizeStringArray(options.cascadingEffectIds),
      replacementEffectIds: normalizeStringArray(options.replacementEffectIds),
      triggerIds: normalizeStringArray(options.triggerIds || (session.triggerQueue || []).map((entry) => entry.id)),
    },
    changes: summarizeStateChanges(beforeSession, session, actionRecord),
    replayMetadata: {
      replayable: actionRecord.replayable !== false,
      stateReference: actionRecord.resultingStateReference || `${session.sessionId || session.id}:${actionRecord.actionId}`,
    },
    synchronizationMetadata: {
      revision: Number(session.revision || 0),
      gameStateRevision: Number(session.gameStateRevision || 0),
      eventRevision: Number(session.eventRevision || 0) + 1,
    },
    payload: actionRecord.payload || {},
  });
  return appendKnowledgeEvent(session, event, {
    snapshot: actionRecord.snapshot || createKnowledgeStateSnapshot(session, event.eventId),
  });
}

export function appendKnowledgeEvent(session = {}, eventInput = {}, options = {}) {
  const state = createEventKnowledgeState(session.eventKnowledge || {});
  const event = normalizeKnowledgeEvent(eventInput);
  if (state.events.some((entry) => entry.eventId === event.eventId)) {
    return {
      ...session,
      eventKnowledge: state,
    };
  }
  const events = [event, ...state.events].slice(0, 10000);
  const groups = upsertGroupEvent(state.groups, event);
  const stateSnapshots = options.snapshot
    ? [normalizeStateSnapshot({ eventId: event.eventId, snapshot: options.snapshot, createdAt: event.when.timestamp }), ...state.stateSnapshots.filter((entry) => entry.eventId !== event.eventId)].slice(0, 1200)
    : state.stateSnapshots;
  const indexes = buildEventIndexes(events);
  return {
    ...session,
    eventRevision: Math.max(Number(session.eventRevision || 0), Number(event.syncRevision || 0), state.eventCount + 1),
    eventKnowledge: {
      ...state,
      events,
      groups,
      stateSnapshots,
      eventCount: events.length,
      lastEventId: event.eventId,
      lastEventRevision: Math.max(Number(state.lastEventRevision || 0), Number(event.syncRevision || 0)),
      indexes,
    },
  };
}

export function reconstructStateAfterEvent(session = {}, eventId = "") {
  const state = createEventKnowledgeState(session.eventKnowledge || {});
  const snapshot = state.stateSnapshots.find((entry) => entry.eventId === eventId);
  if (snapshot?.snapshot) {
    return {
      found: true,
      eventId,
      snapshot: clone(snapshot.snapshot),
      source: "event-knowledge-snapshot",
      engineVersion: state.engineVersion,
    };
  }
  const actionEntry = (session.actionHistory || []).find((entry) => entry.actionId === eventId || entry.knowledgeEventId === eventId || entry.eventId === eventId);
  if (actionEntry?.snapshot) {
    return {
      found: true,
      eventId,
      snapshot: clone(actionEntry.snapshot),
      source: "action-history-snapshot",
      engineVersion: state.engineVersion,
    };
  }
  return {
    found: false,
    eventId,
    snapshot: null,
    source: "not-found",
    engineVersion: state.engineVersion,
  };
}

export function createKnowledgeStateSnapshot(session = {}, eventId = "") {
  const snapshot = clone(session || {});
  snapshot.eventQueue = [];
  snapshot.eventKnowledge = {
    engineVersion: session.eventKnowledge?.engineVersion || EVENT_KNOWLEDGE_ENGINE_VERSION,
    eventCount: session.eventKnowledge?.eventCount || 0,
    lastEventId: eventId || session.eventKnowledge?.lastEventId || "",
    lastEventRevision: session.eventKnowledge?.lastEventRevision || session.eventRevision || 0,
  };
  snapshot.undoStack = [];
  snapshot.redoStack = [];
  snapshot.runtime = undefined;
  return snapshot;
}

export function createDeterministicKnowledgeId(type = "eventId", parts = []) {
  const seed = parts.map((part) => String(part ?? "")).join("|");
  return createContractId(type, stableHash(seed || type));
}

export function summarizeStateChanges(beforeSession = null, afterSession = {}, action = {}) {
  const changes = {
    objectsCreated: [],
    objectsDestroyed: [],
    objectsModified: [],
    countersChanged: [],
    zonesChanged: [],
    lifeChanges: [],
    commanderDamage: [],
    priorityChanges: [],
    manaChanges: [],
    stackChanges: [],
  };
  if (!beforeSession) {
    return normalizeChanges({
      ...changes,
      objectsModified: normalizeStringArray(action.targetIds),
      stackChanges: summarizeStackChange(null, afterSession),
    });
  }
  changes.lifeChanges = Number(beforeSession.life) !== Number(afterSession.life)
    ? [{ playerId: "local-player", before: Number(beforeSession.life || 0), after: Number(afterSession.life || 0) }]
    : [];
  changes.priorityChanges = JSON.stringify(beforeSession.priority || {}) === JSON.stringify(afterSession.priority || {})
    ? []
    : [{ before: clone(beforeSession.priority || {}), after: clone(afterSession.priority || {}) }];
  changes.manaChanges = JSON.stringify(beforeSession.manaPool || {}) === JSON.stringify(afterSession.manaPool || {})
    ? []
    : [{ before: clone(beforeSession.manaPool || {}), after: clone(afterSession.manaPool || {}) }];
  changes.stackChanges = summarizeStackChange(beforeSession, afterSession);
  changes.zonesChanged = summarizeZoneChanges(beforeSession, afterSession);
  changes.countersChanged = summarizeCounterChanges(beforeSession, afterSession);
  const objectDiff = summarizeObjectDiff(beforeSession, afterSession);
  changes.objectsCreated = objectDiff.created;
  changes.objectsDestroyed = objectDiff.destroyed;
  changes.objectsModified = [...new Set([...objectDiff.modified, ...normalizeStringArray(action.targetIds)])];
  return normalizeChanges(changes);
}

function normalizeKnowledgeEvent(event = {}) {
  if (event.who && event.what && event.when && event.where && event.why && event.how && event.changes) {
    return event;
  }
  return createKnowledgeEvent(event);
}

function normalizeEventGroup(group = {}) {
  if (!group || typeof group !== "object") return null;
  return createEventGroup(group);
}

function normalizeStateSnapshot(entry = {}) {
  if (!entry?.eventId || !entry.snapshot) return null;
  return {
    eventId: String(entry.eventId),
    createdAt: Number(entry.createdAt || Date.now()),
    snapshot: clone(entry.snapshot),
  };
}

function deriveGroupsFromEvents(events = []) {
  const groups = new Map();
  events.forEach((event) => {
    const groupId = event.eventGroupId || createDeterministicKnowledgeId("eventId", [event.sessionId, event.rootEventId, "group"]);
    const previous = groups.get(groupId) || createEventGroup({
      eventGroupId: groupId,
      rootEventId: event.rootEventId,
      sessionId: event.sessionId,
      gameId: event.gameId,
      groupType: event.what?.actionType || event.what?.eventType || "transaction",
      createdAt: event.when?.timestamp,
    });
    groups.set(groupId, {
      ...previous,
      eventIds: [...new Set([event.eventId, ...(previous.eventIds || [])])],
    });
  });
  return [...groups.values()];
}

function upsertGroupEvent(groups = [], event = {}) {
  const eventGroupId = event.eventGroupId || createDeterministicKnowledgeId("eventId", [event.sessionId, event.rootEventId, "group"]);
  let found = false;
  const nextGroups = groups.map((group) => {
    if (group.eventGroupId !== eventGroupId) return group;
    found = true;
    return {
      ...group,
      eventIds: [...new Set([event.eventId, ...(group.eventIds || [])])],
    };
  });
  if (!found) {
    nextGroups.unshift(createEventGroup({
      eventGroupId,
      rootEventId: event.rootEventId,
      sessionId: event.sessionId,
      gameId: event.gameId,
      groupType: event.what?.actionType || event.what?.eventType || "transaction",
      label: event.what?.summary || event.what?.actionType || event.what?.eventType || "Event Group",
      eventIds: [event.eventId],
      createdAt: event.when?.timestamp,
      replayExpandable: true,
    }));
  }
  return nextGroups.slice(0, 2000);
}

function buildEventIndexes(events = []) {
  const indexes = {
    byActionId: {},
    byTag: {},
    byPlayerId: {},
    byGroupId: {},
  };
  events.forEach((event) => {
    const actionId = event.why?.originatingActionId;
    if (actionId) indexes.byActionId[actionId] = event.eventId;
    (event.tags || []).forEach((tag) => {
      indexes.byTag[tag] = [...new Set([...(indexes.byTag[tag] || []), event.eventId])].slice(0, 500);
    });
    const playerIds = [event.who?.initiatingPlayerId, ...(event.who?.affectedPlayerIds || [])].filter(Boolean);
    playerIds.forEach((playerId) => {
      indexes.byPlayerId[playerId] = [...new Set([...(indexes.byPlayerId[playerId] || []), event.eventId])].slice(0, 500);
    });
    if (event.eventGroupId) {
      indexes.byGroupId[event.eventGroupId] = [...new Set([...(indexes.byGroupId[event.eventGroupId] || []), event.eventId])].slice(0, 500);
    }
  });
  return indexes;
}

function normalizeEventType(value = "") {
  return String(value || "UNKNOWN").trim().replace(/[^a-zA-Z0-9_-]/g, "_").toUpperCase();
}

function normalizeTags(tags = []) {
  return [...new Set((Array.isArray(tags) ? tags : [tags])
    .map((tag) => String(tag || "").trim().toLowerCase())
    .filter((tag) => EVENT_TAGS.includes(tag)))];
}

function normalizeImportance(value = "normal") {
  const normalized = String(value || "normal").toLowerCase();
  return EVENT_IMPORTANCE_LEVELS.includes(normalized) ? normalized : "normal";
}

function normalizeConfidence(value = "", allowed = [], fallback = "") {
  const normalized = String(value || fallback).trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeStringArray(value = []) {
  return [...new Set((Array.isArray(value) ? value : [value]).map((entry) => String(entry || "").trim()).filter(Boolean))];
}

function normalizeUndoReferences(value = {}) {
  return {
    actionId: String(value.actionId || ""),
    dependencies: normalizeStringArray(value.dependencies),
    createdObjectIds: normalizeStringArray(value.createdObjectIds),
    removedObjectIds: normalizeStringArray(value.removedObjectIds),
    modifiedObjectIds: normalizeStringArray(value.modifiedObjectIds),
    cascadingEffectIds: normalizeStringArray(value.cascadingEffectIds),
    replacementEffectIds: normalizeStringArray(value.replacementEffectIds),
    triggerIds: normalizeStringArray(value.triggerIds),
  };
}

function normalizeChanges(value = {}) {
  return {
    objectsCreated: clone(value.objectsCreated || []),
    objectsDestroyed: clone(value.objectsDestroyed || []),
    objectsModified: clone(value.objectsModified || []),
    countersChanged: clone(value.countersChanged || []),
    zonesChanged: clone(value.zonesChanged || []),
    lifeChanges: clone(value.lifeChanges || []),
    commanderDamage: clone(value.commanderDamage || []),
    priorityChanges: clone(value.priorityChanges || []),
    manaChanges: clone(value.manaChanges || []),
    stackChanges: clone(value.stackChanges || []),
  };
}

function deriveTags(input = {}) {
  const haystack = JSON.stringify({
    eventType: input.eventType,
    actionType: input.actionType,
    payload: input.payload,
    action: input.action,
  }).toLowerCase();
  const tags = [];
  EVENT_TAGS.forEach((tag) => {
    if (haystack.includes(tag)) tags.push(tag);
  });
  if (/cast|spell|instant|sorcery/.test(haystack)) tags.push("spell", "stack");
  if (/attack|block|combat/.test(haystack)) tags.push("combat");
  if (/life|damage/.test(haystack)) tags.push("life");
  if (/token/.test(haystack)) tags.push("token");
  if (/commander/.test(haystack)) tags.push("commander");
  if (/priority|pass_priority/.test(haystack)) tags.push("priority");
  if (/mana|tap/.test(haystack)) tags.push("mana");
  return normalizeTags(tags);
}

function deriveImportance(eventType = "", tags = [], input = {}) {
  const text = `${eventType} ${JSON.stringify(input)}`.toLowerCase();
  if (/game_won|game_lost|player_eliminated|commander_cast/.test(text)) return "critical";
  if (/board wipe|extra turn|commander death|infinite|eliminated/.test(text)) return "major";
  if ((tags || []).includes("priority") || /marker|informational/.test(text)) return "minor";
  return "normal";
}

function inferDestinationZone(actionRecord = {}) {
  const type = String(actionRecord.actionType || "").toUpperCase();
  if (type === "CAST_SPELL") return "stack";
  if (type === "ADD_PERMANENT" || type === "ADD_CUSTOM_TOKEN" || type === "ADD_LAND_COPY") return "battlefield";
  if (type === "REMOVE_SELECTED") return actionRecord.payload?.mode === "exile" ? "exile" : "graveyard";
  return "";
}

function inferChangesFromEvent(session = {}, gameEvent = {}) {
  const eventType = String(gameEvent.eventType || "").toUpperCase();
  const payload = gameEvent.payload || {};
  return normalizeChanges({
    objectsCreated: eventType.includes("TOKEN") || eventType.includes("ENTER") ? [payload.permanent?.id || payload.id || gameEvent.sourceId].filter(Boolean) : [],
    objectsDestroyed: eventType.includes("DESTROY") || eventType.includes("LEAVE") ? [payload.permanent?.id || payload.id || gameEvent.sourceId].filter(Boolean) : [],
    countersChanged: eventType.includes("COUNTER") ? [{ targetId: payload.permanent?.id || payload.id || gameEvent.sourceId, amount: payload.amount }] : [],
    lifeChanges: eventType.includes("LIFE") ? [{ playerId: gameEvent.playerId || "local-player", amount: payload.amount }] : [],
    commanderDamage: eventType.includes("COMMANDER_DAMAGE") ? [{ playerId: gameEvent.playerId || "local-player", amount: payload.amount }] : [],
    priorityChanges: eventType.includes("PRIORITY") ? [clone(session.priority || {})] : [],
    stackChanges: eventType.includes("SPELL") || eventType.includes("STACK") ? summarizeStackChange(null, session) : [],
  });
}

function summarizeStackChange(beforeSession = null, afterSession = {}) {
  const beforeStack = beforeSession?.stack || [];
  const afterStack = afterSession?.stack || [];
  if (beforeSession && JSON.stringify(beforeStack.map(stackSummary)) === JSON.stringify(afterStack.map(stackSummary))) return [];
  return [{
    beforeCount: beforeStack.length,
    afterCount: afterStack.length,
    topObjectId: afterStack[0]?.id || "",
    topObjectName: afterStack[0]?.name || afterStack[0]?.card?.name || "",
  }];
}

function stackSummary(entry = {}) {
  return {
    id: entry.id,
    name: entry.name || entry.card?.name || "",
    status: entry.status || "",
  };
}

function summarizeZoneChanges(beforeSession = {}, afterSession = {}) {
  const zones = ["hand", "library", "graveyard", "exile", "command"];
  return zones
    .map((zone) => ({
      zone,
      beforeCount: (beforeSession.zones?.[zone] || []).length,
      afterCount: (afterSession.zones?.[zone] || []).length,
    }))
    .filter((entry) => entry.beforeCount !== entry.afterCount);
}

function summarizeCounterChanges(beforeSession = {}, afterSession = {}) {
  const before = mapPermanentsById(beforeSession);
  return getAllPermanents(afterSession)
    .map((permanent) => {
      const previous = before.get(permanent.id);
      if (!previous || JSON.stringify(previous.counters || {}) === JSON.stringify(permanent.counters || {})) return null;
      return {
        objectId: permanent.id,
        objectName: permanent.name,
        before: clone(previous.counters || {}),
        after: clone(permanent.counters || {}),
      };
    })
    .filter(Boolean);
}

function summarizeObjectDiff(beforeSession = {}, afterSession = {}) {
  const before = mapPermanentsById(beforeSession);
  const after = mapPermanentsById(afterSession);
  const created = [];
  const destroyed = [];
  const modified = [];
  after.forEach((permanent, id) => {
    if (!before.has(id)) {
      created.push(id);
    } else if (JSON.stringify(publicPermanentFingerprint(before.get(id))) !== JSON.stringify(publicPermanentFingerprint(permanent))) {
      modified.push(id);
    }
  });
  before.forEach((permanent, id) => {
    if (!after.has(id)) destroyed.push(id);
  });
  return { created, destroyed, modified };
}

function mapPermanentsById(session = {}) {
  return new Map(getAllPermanents(session).map((permanent) => [permanent.id, permanent]));
}

function getAllPermanents(session = {}) {
  return [...(session.battlefield?.player || []), ...(session.battlefield?.opponent || [])].filter(Boolean);
}

function publicPermanentFingerprint(permanent = {}) {
  return {
    name: permanent.name,
    tapped: Boolean(permanent.tapped),
    quantity: Number(permanent.quantity || 1),
    counters: permanent.counters || {},
    markedDamage: permanent.markedDamage || 0,
    attacking: Boolean(permanent.attacking),
    blocking: Boolean(permanent.blocking),
    zone: permanent.zone || "battlefield",
  };
}

function stableHash(seed = "") {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(36);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);
  Object.values(value).forEach((entry) => {
    if (entry && typeof entry === "object" && !Object.isFrozen(entry)) deepFreeze(entry);
  });
  return value;
}
