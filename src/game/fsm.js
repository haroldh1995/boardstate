const MAJOR_PHASES = ["Beginning", "Main 1", "Combat", "Main 2", "Ending"];

export const FSM_STATES = [
  "setup",
  "mulligan",
  "untap",
  "upkeep",
  "draw",
  "precombatMain",
  "combatBeginning",
  "attackers",
  "blockers",
  "damage",
  "combatEnd",
  "postcombatMain",
  "ending",
  "cleanup",
];

const NEXT_STATE = FSM_STATES.reduce((next, state, index) => {
  next[state] = FSM_STATES[(index + 1) % FSM_STATES.length];
  return next;
}, {});

const MAJOR_PHASE_BY_STATE = {
  setup: "Beginning",
  mulligan: "Beginning",
  untap: "Beginning",
  upkeep: "Beginning",
  draw: "Beginning",
  precombatMain: "Main 1",
  combatBeginning: "Combat",
  attackers: "Combat",
  blockers: "Combat",
  damage: "Combat",
  combatEnd: "Combat",
  postcombatMain: "Main 2",
  ending: "Ending",
  cleanup: "Ending",
};

export function createFsmState() {
  return {
    current: "setup",
    previous: "",
    transitions: [],
  };
}

export function canTransition(current, next) {
  return NEXT_STATE[current] === next;
}

export function transitionFsm(session, requestedNext = "") {
  const current = session.fsm?.current || "setup";
  const next = requestedNext && canTransition(current, requestedNext) ? requestedNext : NEXT_STATE[current] || "setup";
  const previous = current;
  const transitions = [
    {
      at: Date.now(),
      from: previous,
      to: next,
    },
    ...(session.fsm?.transitions || []),
  ].slice(0, 240);
  const phase = MAJOR_PHASE_BY_STATE[next] || "Beginning";
  const phaseIndex = Math.max(0, MAJOR_PHASES.indexOf(phase));
  const nextTurn = next === "untap" && previous === "cleanup" ? session.turn + 1 : session.turn;

  return {
    ...session,
    turn: nextTurn,
    phaseIndex,
    phaseStartedAt: Date.now(),
    turnStartedAt: nextTurn !== session.turn ? Date.now() : session.turnStartedAt,
    fsm: {
      current: next,
      previous,
      transitions,
    },
  };
}

export function isCombatState(state) {
  return ["combatBeginning", "attackers", "blockers", "damage", "combatEnd"].includes(state);
}
