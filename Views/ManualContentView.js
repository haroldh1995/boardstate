export const MANUAL_SECTIONS = Object.freeze([
  {
    id: "core-flow",
    title: "Core Flow",
    points: [
      "Set life and commander values on the Tracker page.",
      "Import permanents from Scryfall search on Board State.",
      "Use Next Phase to progress turn structure and refresh reminders.",
    ],
  },
  {
    id: "gestures",
    title: "Gestures",
    points: [
      "Tap a permanent tile to select or clear selection.",
      "Long press or Details button to inspect full card data.",
      "Use contextual menu actions for tap/untap and removal.",
    ],
  },
  {
    id: "combat",
    title: "Combat",
    points: [
      "Select attackers then run Confirm Combat.",
      "Use Combat Simulation as a fast-assisted calculator.",
      "The app assists with deterministic triggers and logs each action.",
    ],
  },
  {
    id: "adhd-mode",
    title: "ADHD Mode",
    points: [
      "Auto-applies deterministic effects only.",
      "Never auto-resolves choice-based or target-based actions.",
      "Every automatic action is written to history and automation logs.",
    ],
  },
]);
