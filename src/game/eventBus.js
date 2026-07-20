import { createId } from "../state/ids.js";
import { recordGameEventKnowledge } from "../authoritative-core/eventKnowledgeEngine.js";

export const GAME_EVENT_TYPES = {
  ENTER_BATTLEFIELD: "ENTER_BATTLEFIELD",
  LAND_ENTERED_BATTLEFIELD: "LAND_ENTERED_BATTLEFIELD",
  LANDFALL_CHECK: "LANDFALL_CHECK",
  LEAVE_BATTLEFIELD: "LEAVE_BATTLEFIELD",
  DESTROY: "DESTROY",
  EXILE: "EXILE",
  SACRIFICE: "SACRIFICE",
  COUNTER_ADDED: "COUNTER_ADDED",
  COUNTER_REMOVED: "COUNTER_REMOVED",
  TOKEN_CREATED: "TOKEN_CREATED",
  PHASE_CHANGED: "PHASE_CHANGED",
  TURN_CHANGED: "TURN_CHANGED",
  LIFE_CHANGED: "LIFE_CHANGED",
  COMMANDER_DAMAGE_CHANGED: "COMMANDER_DAMAGE_CHANGED",
  SPELL_CAST: "SPELL_CAST",
  ABILITY_ACTIVATED: "ABILITY_ACTIVATED",
  ATTACK_DECLARED: "ATTACK_DECLARED",
  ATTACK_TRIGGER_CHECK: "ATTACK_TRIGGER_CHECK",
  BLOCK_DECLARED: "BLOCK_DECLARED",
};

const observers = new Set();

export function createGameEvent(eventType, payload = {}, meta = {}) {
  return {
    id: createId("evt"),
    eventType,
    timestamp: Date.now(),
    payload,
    sourceId: meta.sourceId || "",
    playerId: meta.playerId || "",
    parentEventId: meta.parentEventId || "",
    rootEventId: meta.rootEventId || "",
    eventGroupId: meta.eventGroupId || "",
    causedByActionId: meta.causedByActionId || payload.actionId || "",
  };
}

export function queueGameEvent(session, eventType, payload = {}, meta = {}) {
  const gameEvent = createGameEvent(eventType, payload, meta);
  const queued = {
    ...session,
    eventQueue: [...(session.eventQueue || []), gameEvent],
    eventHistory: [gameEvent, ...(session.eventHistory || [])].slice(0, 300),
  };
  return recordGameEventKnowledge(queued, gameEvent, {
    eventGroupId: meta.eventGroupId || "",
    parentEventId: meta.parentEventId || "",
    rootEventId: meta.rootEventId || "",
    causedByActionId: meta.causedByActionId || "",
  });
}

export function drainGameEvents(session, handler) {
  let nextSession = { ...session, eventQueue: [] };
  for (const event of session.eventQueue || []) {
    nextSession = handler(nextSession, event) || nextSession;
  }
  return nextSession;
}

export function registerGameEventObserver(observer) {
  observers.add(observer);
  return () => observers.delete(observer);
}

export function runGameEventObservers(session, gameEvent) {
  let next = session;
  observers.forEach((observer) => {
    const updated = observer(next, gameEvent);
    if (updated) {
      next = updated;
    }
  });
  return next;
}

export function mapActionTypeToGameEvent(actionType) {
  const mapping = {
    ADD_PERMANENT: GAME_EVENT_TYPES.ENTER_BATTLEFIELD,
    ADD_CUSTOM_TOKEN: GAME_EVENT_TYPES.TOKEN_CREATED,
    TOGGLE_TAPPED: GAME_EVENT_TYPES.ABILITY_ACTIVATED,
    ADD_COUNTER: GAME_EVENT_TYPES.COUNTER_ADDED,
    ADD_COUNTER_SELECTED: GAME_EVENT_TYPES.COUNTER_ADDED,
    APPLY_COUNTER_SCOPE: GAME_EVENT_TYPES.COUNTER_ADDED,
    ADVANCE_PHASE: GAME_EVENT_TYPES.PHASE_CHANGED,
    LIFE_DELTA: GAME_EVENT_TYPES.LIFE_CHANGED,
    SET_LIFE: GAME_EVENT_TYPES.LIFE_CHANGED,
    COMMANDER_DAMAGE_DELTA: GAME_EVENT_TYPES.COMMANDER_DAMAGE_CHANGED,
    SET_COMMANDER_DAMAGE: GAME_EVENT_TYPES.COMMANDER_DAMAGE_CHANGED,
    CAST_SPELL: GAME_EVENT_TYPES.SPELL_CAST,
    DECLARE_ATTACKERS: GAME_EVENT_TYPES.ATTACK_DECLARED,
    ASSIGN_BLOCKER: GAME_EVENT_TYPES.BLOCK_DECLARED,
    REMOVE_SELECTED: GAME_EVENT_TYPES.LEAVE_BATTLEFIELD,
  };
  return mapping[actionType] || "";
}
