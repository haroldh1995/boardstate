export const SETTINGS_TOGGLE_FIELDS = Object.freeze([
  {
    id: "adhdMode",
    label: "ADHD Mode",
    description: "Auto-resolve deterministic counters/tokens/life effects and keep logs for each action.",
  },
  {
    id: "autoResolveDeterministic",
    label: "Deterministic Auto-Resolve",
    description: "Automatically resolve non-choice rules that are safe and deterministic.",
  },
  {
    id: "triggerRemindersEnabled",
    label: "Trigger Reminders",
    description: "Queue phase/combat trigger reminders during turn progression.",
  },
  {
    id: "manaAutoClearEnabled",
    label: "Auto-Clear Floating Mana",
    description: "Clear floating mana when moving into non-combat utility phases.",
  },
]);
