import { createId } from "./ids.js";

const NON_REPLAYABLE = new Set(["SAVE_TICK", "IMPORT_PROFILE"]);
const NON_UNDOABLE = new Set(["SAVE_TICK", "IMPORT_PROFILE", "UNDO"]);

export function createAction(input, state) {
  if (!input || typeof input !== "object") {
    return toActionEnvelope({ type: "UNKNOWN" }, state);
  }
  if (input.actionId && input.actionType) {
    return input;
  }
  return toActionEnvelope(input, state);
}

export function finalizeAction(action, nextState) {
  return {
    ...action,
    resultingStateReference: `${nextState.activeSession?.id || "session"}:${nextState.activeSession?.updatedAt || Date.now()}`,
  };
}

function toActionEnvelope(event, state) {
  const actionType = event.type || event.actionType || "UNKNOWN";
  const payload = sanitizePayload({ ...event, type: undefined, actionType: undefined });
  const targetIds = normalizeTargets(event);
  return {
    ...event,
    type: actionType,
    actionType,
    payload,
    actionId: createId("action"),
    timestamp: Date.now(),
    playerId: state.player?.id || "local-player",
    sourceId: event.sourceId || event.id || "",
    targetIds,
    resultingStateReference: "",
    replayable: !NON_REPLAYABLE.has(actionType),
    undoable: !NON_UNDOABLE.has(actionType),
  };
}

function normalizeTargets(event) {
  if (Array.isArray(event.targetIds)) {
    return [...event.targetIds];
  }
  if (event.targetId) {
    return [event.targetId];
  }
  if (event.id) {
    return [event.id];
  }
  return [];
}

function sanitizePayload(payload) {
  const next = { ...payload };
  delete next.actionId;
  delete next.timestamp;
  delete next.playerId;
  delete next.sourceId;
  delete next.targetIds;
  delete next.resultingStateReference;
  delete next.replayable;
  delete next.undoable;
  return next;
}
