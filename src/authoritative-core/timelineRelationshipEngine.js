import { PHASES } from "../state/schema.js";

export const TIMELINE_RELATIONSHIP_VERSION = "boardstate-timeline-relationship-1.0.0";

export const TIMELINE_FILTERS = Object.freeze([
  "all",
  "combat",
  "spell",
  "zone",
  "life",
  "decision",
  "state",
]);

const RESOLVED_EFFECT_STATUSES = new Set(["resolved", "skipped", "ignored", "cancelled", "completed"]);
const PRIVATE_ZONE_NAMES = new Set(["hand", "library", "sideboard", "hidden", "face-down"]);

export function createTimelineExperience(session = {}, options = {}) {
  const filter = TIMELINE_FILTERS.includes(options.filter) ? options.filter : "all";
  const pageSize = clampInteger(options.pageSize, 20, 120, 48);
  const allEntries = collectTimelineEntries(session);
  const filteredEntries = filter === "all"
    ? allEntries
    : allEntries.filter((entry) => entry.categories.includes(filter));
  const pageCount = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const page = clampInteger(options.page, 0, pageCount - 1, 0);
  const start = page * pageSize;
  const entries = filteredEntries.slice(start, start + pageSize);
  const relationships = buildRelationshipGraph(session, {
    focusObjectId: options.focusObjectId || "",
  });

  return {
    version: TIMELINE_RELATIONSHIP_VERSION,
    presentationOnly: true,
    observationalOnly: true,
    mutatesAuthoritativeState: false,
    executesRules: false,
    liveStateReference: createLiveStateReference(session),
    filters: [...TIMELINE_FILTERS],
    filter,
    page,
    pageSize,
    pageCount,
    totalEntries: allEntries.length,
    filteredEntryCount: filteredEntries.length,
    entries,
    groups: groupTimelineEntries(entries),
    relationships,
    relationshipSummary: explainRelationships(relationships, options.focusObjectId || ""),
  };
}

export function collectTimelineEntries(session = {}) {
  const knowledgeEvents = Array.isArray(session.eventKnowledge?.events)
    ? session.eventKnowledge.events
    : [];
  const actionHistory = Array.isArray(session.actionHistory) ? session.actionHistory : [];
  const coveredActionIds = new Set();
  const entries = [];

  knowledgeEvents.forEach((event, index) => {
    const actionId = String(event.why?.originatingActionId || "");
    if (actionId) coveredActionIds.add(actionId);
    entries.push(normalizeKnowledgeTimelineEntry(event, index));
  });

  actionHistory.forEach((action, index) => {
    if (!action?.actionId || coveredActionIds.has(String(action.actionId))) return;
    entries.push(normalizeActionTimelineEntry(action, index, session));
  });

  return entries
    .filter((entry) => entry.id)
    .sort((left, right) => right.timestamp - left.timestamp || right.sequence - left.sequence);
}

export function createReplayObservation(session = {}, locator = {}) {
  const actionHistory = Array.isArray(session.actionHistory) ? session.actionHistory : [];
  const knowledgeEvents = Array.isArray(session.eventKnowledge?.events) ? session.eventKnowledge.events : [];
  const requestedActionId = String(locator.actionId || "");
  const requestedEventId = String(locator.eventId || "");
  const sourceEvent = knowledgeEvents.find((event) =>
    (requestedEventId && event.eventId === requestedEventId) ||
    (requestedActionId && event.why?.originatingActionId === requestedActionId)
  ) || null;
  const actionId = requestedActionId || String(sourceEvent?.why?.originatingActionId || "");
  const action = actionHistory.find((entry) => entry.actionId === actionId) || null;
  const snapshot = action?.snapshot ? sanitizeReplaySnapshot(action.snapshot) : null;
  const timelineEntry = sourceEvent
    ? normalizeKnowledgeTimelineEntry(sourceEvent, 0)
    : action
      ? normalizeActionTimelineEntry(action, 0, session)
      : null;

  return deepFreeze({
    version: TIMELINE_RELATIONSHIP_VERSION,
    found: Boolean(timelineEntry),
    observationalOnly: true,
    presentationOnly: true,
    mutatesAuthoritativeState: false,
    executesRules: false,
    replaysGameplayEvent: false,
    replaysAnimation: false,
    sourceEventId: String(sourceEvent?.eventId || requestedEventId),
    sourceActionId: actionId,
    liveStateReference: createLiveStateReference(session),
    entry: timelineEntry,
    snapshot,
    snapshotSummary: summarizeReplaySnapshot(snapshot),
    returnPlan: createLiveReturnPlan(session),
  });
}

export function createLiveReturnPlan(session = {}) {
  return deepFreeze({
    action: "dismiss-observation",
    authoritativeStateReference: createLiveStateReference(session),
    restoreFromAuthoritativeSession: true,
    applyReplaySnapshot: false,
    executeRules: false,
    replayAnimations: false,
  });
}

export function buildRelationshipGraph(session = {}, options = {}) {
  const permanents = collectPublicPermanents(session);
  const nodes = new Map();
  const edges = new Map();

  permanents.forEach((permanent) => {
    addNode(nodes, {
      id: permanent.id,
      kind: "permanent",
      label: permanent.name || "Permanent",
      controller: permanent.controller || "",
      zone: permanent.zone || "battlefield",
      focused: permanent.id === options.focusObjectId,
    });
    if (permanent.controller) {
      addNode(nodes, {
        id: `player:${permanent.controller}`,
        kind: "player",
        label: permanent.controller,
      });
      addEdge(edges, `player:${permanent.controller}`, permanent.id, "controls");
    }
    const attachedToId = permanent.attachedToId || permanent.relationships?.attachedToId;
    if (attachedToId) addEdge(edges, permanent.id, attachedToId, "attached-to");
    normalizeStringArray(permanent.attachments || permanent.relationships?.attachedIds)
      .forEach((attachmentId) => addEdge(edges, attachmentId, permanent.id, "attached-to"));
  });

  [...(session.stack || []), ...(session.pendingEffects || []).filter((entry) => !RESOLVED_EFFECT_STATUSES.has(entry.status))]
    .forEach((object, index) => {
      const sourceId = String(object.sourceId || object.cardId || object.id || `pending:${index}`);
      if (!sourceId) return;
      addNode(nodes, {
        id: sourceId,
        kind: object.stackObjectId || object.typeLine ? "stack-object" : "effect",
        label: object.name || object.sourceName || object.summary || "Pending effect",
      });
      normalizeStringArray(object.targetIds || object.targets)
        .forEach((targetId) => addEdge(edges, sourceId, targetId, "targets"));
      if (object.stackObjectId && object.stackObjectId !== sourceId) {
        addEdge(edges, object.stackObjectId, sourceId, "resolves-from");
      }
    });

  const attackerIds = normalizeStringArray(session.combat?.attackerIds);
  attackerIds.forEach((attackerId) => {
    addNode(nodes, { id: attackerId, kind: "permanent", label: findPermanentName(permanents, attackerId) || "Attacker" });
  });
  Object.entries(session.combat?.blockers || session.combat?.blockAssignments || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((blockerId) => addEdge(edges, blockerId, key, "blocks"));
      return;
    }
    if (value) addEdge(edges, key, String(value), "blocks");
  });

  (session.eventKnowledge?.events || []).slice(0, 80).forEach((event) => {
    if (event.parentEventId) addEdge(edges, event.parentEventId, event.eventId, "caused");
    normalizeStringArray(event.why?.causationChain)
      .forEach((causeId) => addEdge(edges, causeId, event.eventId, "caused"));
  });

  const graphNodes = [...nodes.values()];
  const knownNodeIds = new Set(graphNodes.map((node) => node.id));
  const graphEdges = [...edges.values()].filter((edge) => edge.from && edge.to);
  graphEdges.forEach((edge) => {
    if (!knownNodeIds.has(edge.from)) {
      graphNodes.push({ id: edge.from, kind: "reference", label: edge.from, controller: "", zone: "", focused: false });
      knownNodeIds.add(edge.from);
    }
    if (!knownNodeIds.has(edge.to)) {
      graphNodes.push({ id: edge.to, kind: "reference", label: edge.to, controller: "", zone: "", focused: false });
      knownNodeIds.add(edge.to);
    }
  });

  return {
    version: TIMELINE_RELATIONSHIP_VERSION,
    presentationOnly: true,
    mutatesAuthoritativeState: false,
    nodes: graphNodes,
    edges: graphEdges,
  };
}

export function explainRelationships(graph = {}, focusObjectId = "") {
  const focus = String(focusObjectId || "");
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const nodes = new Map((graph.nodes || []).map((node) => [node.id, node]));
  const relevant = focus ? edges.filter((edge) => edge.from === focus || edge.to === focus) : edges;
  return relevant.slice(0, 16).map((edge) => {
    const from = nodes.get(edge.from)?.label || edge.from;
    const to = nodes.get(edge.to)?.label || edge.to;
    return {
      fromId: edge.from,
      toId: edge.to,
      kind: edge.kind,
      summary: `${from} ${formatRelationship(edge.kind)} ${to}.`,
    };
  });
}

function normalizeKnowledgeTimelineEntry(event = {}, sequence = 0) {
  const categories = classifyTimelineCategories({
    tags: event.tags,
    actionType: event.what?.actionType,
    eventType: event.what?.eventType,
    sourceZone: event.where?.sourceZone,
    destinationZone: event.where?.destinationZone,
  });
  return {
    id: String(event.eventId || ""),
    eventId: String(event.eventId || ""),
    actionId: String(event.why?.originatingActionId || ""),
    eventGroupId: String(event.eventGroupId || ""),
    parentEventId: String(event.parentEventId || ""),
    timestamp: Number(event.when?.timestamp || 0),
    turn: Number(event.when?.turn || 0),
    phaseIndex: Number(event.when?.phaseIndex || 0),
    phase: String(event.when?.phase || PHASES[Number(event.when?.phaseIndex || 0)] || ""),
    sequence,
    importance: String(event.importance || "normal"),
    categories,
    summary: String(event.what?.summary || event.what?.eventType || "Gameplay event"),
    actorId: String(event.who?.initiatingPlayerId || event.who?.controllerPlayerId || ""),
    objectIds: normalizeStringArray(event.what?.objectIds),
    objectNames: normalizeStringArray(event.what?.objectNames),
    sourceZone: String(event.where?.sourceZone || ""),
    destinationZone: String(event.where?.destinationZone || ""),
    changeSummary: summarizeChanges(event.changes),
    confidence: {
      information: String(event.informationConfidence || "unknown"),
      execution: String(event.executionConfidence || "tracking-only"),
    },
  };
}

function normalizeActionTimelineEntry(action = {}, sequence = 0, session = {}) {
  const payload = action.payload || {};
  const categories = classifyTimelineCategories({
    actionType: action.actionType,
    sourceZone: payload.sourceZone,
    destinationZone: payload.destinationZone,
  });
  return {
    id: String(action.actionId || ""),
    eventId: String(action.knowledgeEventId || ""),
    actionId: String(action.actionId || ""),
    eventGroupId: "",
    parentEventId: "",
    timestamp: Number(action.timestamp || 0),
    turn: Number(action.snapshot?.turn || session.turn || 0),
    phaseIndex: Number(action.snapshot?.phaseIndex || session.phaseIndex || 0),
    phase: String(PHASES[Number(action.snapshot?.phaseIndex ?? session.phaseIndex ?? 0)] || ""),
    sequence,
    importance: "normal",
    categories,
    summary: formatActionSummary(action),
    actorId: String(action.playerId || ""),
    objectIds: normalizeStringArray([action.sourceId, ...(action.targetIds || [])]),
    objectNames: normalizeStringArray([payload.card?.name, payload.name, payload.sourceName]),
    sourceZone: String(payload.sourceZone || ""),
    destinationZone: String(payload.destinationZone || ""),
    changeSummary: summarizeActionPayload(payload),
    confidence: {
      information: "recorded",
      execution: "tracking-only",
    },
  };
}

function groupTimelineEntries(entries = []) {
  const groups = new Map();
  entries.forEach((entry) => {
    const key = `${entry.turn}:${entry.phaseIndex}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        turn: entry.turn,
        phaseIndex: entry.phaseIndex,
        phase: entry.phase,
        entryIds: [],
      });
    }
    groups.get(key).entryIds.push(entry.id);
  });
  return [...groups.values()];
}

function collectPublicPermanents(session = {}) {
  const sources = [
    ...(session.battlefield?.player || []),
    ...(session.battlefield?.opponent || []),
    ...Object.values(session.playerBoards || {}).flatMap((board) => board?.permanents || []),
    ...(session.players || []).flatMap((player) => player?.battlefield || player?.permanents || []),
  ];
  const byId = new Map();
  sources.forEach((permanent) => {
    if (!permanent?.id || isPrivateZone(permanent.zone)) return;
    if (!byId.has(permanent.id)) byId.set(permanent.id, permanent);
  });
  return [...byId.values()];
}

function classifyTimelineCategories(input = {}) {
  const haystack = normalizeStringArray([
    ...(input.tags || []),
    input.actionType,
    input.eventType,
    input.sourceZone,
    input.destinationZone,
  ]).join(" ").toLowerCase();
  const categories = new Set(["state"]);
  if (/combat|attack|block|damage/.test(haystack)) categories.add("combat");
  if (/spell|cast|stack|resolve|counterspell|ability|trigger/.test(haystack)) categories.add("spell");
  if (/zone|graveyard|exile|battlefield|hand|library|command|land/.test(haystack)) categories.add("zone");
  if (/life|commander.damage|poison/.test(haystack)) categories.add("life");
  if (/choice|target|mode|priority|confirm|manual|amendment/.test(haystack)) categories.add("decision");
  return [...categories];
}

function formatActionSummary(action = {}) {
  const actionType = String(action.actionType || "Action").replace(/_/g, " ").toLowerCase();
  const subject = action.payload?.card?.name || action.payload?.name || action.payload?.sourceName || "";
  return subject ? `${titleCase(actionType)}: ${subject}` : titleCase(actionType);
}

function summarizeChanges(changes = {}) {
  if (!changes || typeof changes !== "object") return "No recorded state delta.";
  const labels = Object.entries(changes)
    .filter(([, value]) => value !== undefined && value !== null && value !== false && value !== "" && (!Array.isArray(value) || value.length))
    .slice(0, 6)
    .map(([key, value]) => {
      const label = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();
      if (Array.isArray(value)) return `${value.length} ${label}`;
      if (typeof value === "object") return `${Object.keys(value).length} ${label}`;
      return `${label}: ${String(value)}`;
    });
  return labels.join("; ") || "No recorded state delta.";
}

function summarizeActionPayload(payload = {}) {
  const parts = [];
  if (payload.card?.name || payload.name) parts.push(String(payload.card?.name || payload.name));
  if (payload.amount !== undefined) parts.push(`amount ${Number(payload.amount || 0)}`);
  if (payload.counterType) parts.push(`${payload.counterType} counter`);
  if (payload.sourceZone || payload.destinationZone) {
    parts.push(`${payload.sourceZone || "unknown"} to ${payload.destinationZone || "unknown"}`);
  }
  return parts.join("; ") || "Recorded action.";
}

function sanitizeReplaySnapshot(snapshot = {}) {
  const safe = clonePlain(snapshot);
  delete safe.runtime;
  delete safe.undoStack;
  delete safe.redoStack;
  delete safe.actionHistory;
  delete safe.eventQueue;
  delete safe.history;
  if (safe.persistence) {
    safe.persistence = {
      version: safe.persistence.version || safe.persistence.persistenceVersion || "",
      lastCheckpointId: safe.persistence.lastCheckpointId || "",
    };
  }
  safe.presentation = null;
  safe.replay = undefined;
  return safe;
}

function summarizeReplaySnapshot(snapshot) {
  if (!snapshot) {
    return {
      available: false,
      turn: 0,
      phase: "",
      life: null,
      playerPermanentCount: 0,
      opponentPermanentCount: 0,
      stackCount: 0,
    };
  }
  return {
    available: true,
    turn: Number(snapshot.turn || 0),
    phase: String(PHASES[Number(snapshot.phaseIndex || 0)] || ""),
    life: snapshot.life === undefined ? null : Number(snapshot.life),
    playerPermanentCount: Number(snapshot.battlefield?.player?.length || 0),
    opponentPermanentCount: Number(snapshot.battlefield?.opponent?.length || 0),
    stackCount: Number(snapshot.stack?.length || 0),
  };
}

function createLiveStateReference(session = {}) {
  return `${session.id || session.sessionId || "session"}:${Number(session.eventRevision || session.revision || 0)}:${Number(session.updatedAt || 0)}`;
}

function addNode(nodes, node) {
  if (!node?.id || nodes.has(node.id)) return;
  nodes.set(node.id, {
    id: String(node.id),
    kind: String(node.kind || "reference"),
    label: String(node.label || node.id),
    controller: String(node.controller || ""),
    zone: String(node.zone || ""),
    focused: Boolean(node.focused),
  });
}

function addEdge(edges, from, to, kind) {
  const normalizedFrom = String(from || "");
  const normalizedTo = String(to || "");
  if (!normalizedFrom || !normalizedTo || normalizedFrom === normalizedTo) return;
  const id = `${kind}:${normalizedFrom}:${normalizedTo}`;
  if (!edges.has(id)) edges.set(id, { id, from: normalizedFrom, to: normalizedTo, kind });
}

function findPermanentName(permanents, id) {
  return permanents.find((permanent) => permanent.id === id)?.name || "";
}

function formatRelationship(kind) {
  switch (kind) {
    case "attached-to": return "is attached to";
    case "controls": return "controls";
    case "targets": return "targets";
    case "blocks": return "blocks";
    case "caused": return "caused";
    case "resolves-from": return "resolves from";
    default: return kind.replace(/-/g, " ");
  }
}

function isPrivateZone(zone = "") {
  const normalized = String(zone || "").toLowerCase();
  return [...PRIVATE_ZONE_NAMES].some((privateZone) => normalized.includes(privateZone));
}

function normalizeStringArray(value) {
  const source = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  return [...new Set(source.flat().filter(Boolean).map(String))];
}

function clampInteger(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
}

function titleCase(value) {
  return String(value || "").replace(/\b\w/g, (character) => character.toUpperCase());
}

function clonePlain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
