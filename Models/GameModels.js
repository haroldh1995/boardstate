export const PHASE_ALIAS_MAP = Object.freeze({
  Upkeep: "Beginning",
  Main: "Main1",
  Combat: "Combat",
  "Main 2": "Main2",
  End: "Ending",
});

export const DEFAULT_COUNTER_TYPES = Object.freeze([
  "+1/+1",
  "-1/-1",
  "Loyalty",
  "Charge",
  "Poison",
  "Energy",
  "Shield",
  "Stun",
  "Lore",
  "Quest",
  "Time",
  "Experience",
  "Treasure",
  "Food",
  "Clue",
]);

export const MANA_COLORS = Object.freeze(["W", "U", "B", "R", "G", "C"]);

export const DEFAULT_COMPANION_SETTINGS = Object.freeze({
  adhdMode: false,
  autoResolveDeterministic: true,
  triggerRemindersEnabled: true,
  manaAutoClearEnabled: true,
});

export const MAX_HISTORY_ENTRIES = 300;
export const MAX_UNDO_ENTRIES = 80;
export const LIFE_ROLLBACK_WINDOW_MS = 3000;
