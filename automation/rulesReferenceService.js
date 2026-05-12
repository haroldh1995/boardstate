import {
  COMPACT_RULES_INDEX,
  COMPREHENSIVE_RULES_ASSET_URL,
  COMPREHENSIVE_RULES_SOURCE,
  loadComprehensiveRulesText,
  searchComprehensiveRulesText,
} from "./comprehensiveRulesIndex.js";

export const WIZARDS_RULES_URL = "https://magic.wizards.com/rules";
export const COMMANDER_RULES_URL = "https://mtgcommander.net/index.php/rules/";
export { COMPACT_RULES_INDEX, COMPREHENSIVE_RULES_SOURCE, loadComprehensiveRulesText, searchComprehensiveRulesText };

export const AUTOMATION_RULES_NOTE =
  "Automation uses Scryfall card data/rulings and selected official rules references where available. Ambiguous effects require confirmation.";

export const RULES_SOURCE_PRIORITY = [
  {
    key: "oracle",
    label: "Scryfall Card Data",
    summary: "Primary source for oracle text, type line, legalities, faces, and related official links.",
    url: "https://api.scryfall.com/cards/search?q=",
  },
  {
    key: "rulings",
    label: "Scryfall Rulings",
    summary: "Card-specific rulings fetched from the card's official rulings endpoint when available.",
    url: "https://api.scryfall.com/cards/search?q=",
  },
  {
    key: "comp-rules",
    label: "Wizards Comprehensive Rules",
    summary: "Bundled full Comprehensive Rules text plus a compact index for fast commander, planeswalker, combat, and layer lookups.",
    url: COMPREHENSIVE_RULES_ASSET_URL,
  },
  {
    key: "commander",
    label: "Commander Rules",
    summary: "Commander-specific format assumptions and restrictions for local single-player and multiplayer reference.",
    url: COMMANDER_RULES_URL,
  },
];

export const RULES_REFERENCE_CATEGORIES = {
  triggers: {
    key: "triggers",
    label: "Triggered Abilities",
    url: WIZARDS_RULES_URL,
    summary: "Use for event-based abilities such as enters, dies, attacks, and beginning-of-phase triggers.",
  },
  replacement: {
    key: "replacement",
    label: "Replacement Effects",
    url: WIZARDS_RULES_URL,
    summary: "Use for token and counter modification effects that change an event before it happens.",
  },
  tokens: {
    key: "tokens",
    label: "Tokens",
    url: WIZARDS_RULES_URL,
    summary: "Use for token creation, token identity, and stacking token output modifiers.",
  },
  counters: {
    key: "counters",
    label: "Counters",
    url: WIZARDS_RULES_URL,
    summary: "Use for +1/+1 counters and supported counter-placement modifiers.",
  },
  combat: {
    key: "combat",
    label: "Combat Phase",
    url: WIZARDS_RULES_URL,
    summary: "Use for attack timing, combat-phase automation, and selected-attacker calculations.",
  },
  attack: {
    key: "attack",
    label: "Attack Triggers",
    url: WIZARDS_RULES_URL,
    summary: "Use for 'whenever this attacks' and other supported attack-trigger patterns.",
  },
  etb: {
    key: "etb",
    label: "Enter the Battlefield",
    url: WIZARDS_RULES_URL,
    summary: "Use for one-time enters-the-battlefield token and counter effects.",
  },
  dies: {
    key: "dies",
    label: "Dies and Removal",
    url: WIZARDS_RULES_URL,
    summary: "Use for supported death, sacrifice, and exile trigger timing.",
  },
  phases: {
    key: "phases",
    label: "Turn and Phase Structure",
    url: WIZARDS_RULES_URL,
    summary: "Use for upkeep, combat, end step, and conservative phase mapping.",
  },
  commander: {
    key: "commander",
    label: "Commander Format",
    url: COMMANDER_RULES_URL,
    summary: `${COMPACT_RULES_INDEX.commander.map((entry) => entry.rule).join(", ")}: Use for commander designation, color identity, casting tax, and commander damage.`,
  },
  planeswalkers: {
    key: "planeswalkers",
    label: "Planeswalkers and Loyalty",
    url: COMPREHENSIVE_RULES_ASSET_URL,
    summary: `${COMPACT_RULES_INDEX.planeswalkers.map((entry) => entry.rule).join(", ")}: Use for loyalty counters, activation limits, damage, and zero-loyalty state actions.`,
  },
  layers: {
    key: "layers",
    label: "Layered Continuous Effects",
    url: COMPREHENSIVE_RULES_ASSET_URL,
    summary: `${COMPACT_RULES_INDEX.layers.map((entry) => entry.rule).join(", ")}: Use for modular power/toughness and static effect ordering.`,
  },
  stateBasedActions: {
    key: "stateBasedActions",
    label: "State-Based Actions",
    url: COMPREHENSIVE_RULES_ASSET_URL,
    summary: `${COMPACT_RULES_INDEX.stateBasedActions.map((entry) => entry.rule).join(", ")}: Use for automatic cleanup such as zero-toughness creatures and zero-loyalty planeswalkers.`,
  },
};

export function getRulesReferenceEntries(ruleLike = {}) {
  const keys = new Set();

  if (ruleLike.phase || ruleLike.eventType === "Phase") {
    keys.add("phases");
  }

  if (ruleLike.eventType === "ETB") {
    keys.add("etb");
    keys.add("triggers");
  }

  if (ruleLike.eventType === "OnDeath" || ruleLike.eventType === "OnSacrifice" || ruleLike.eventType === "OnExile") {
    keys.add("dies");
    keys.add("triggers");
  }

  if (ruleLike.eventType === "Attack") {
    keys.add("combat");
    keys.add("attack");
    keys.add("triggers");
  }

  if (ruleLike.isPlaneswalker || ruleLike.counterType === "Loyalty" || ruleLike.actionType === "Loyalty") {
    keys.add("planeswalkers");
    keys.add("stateBasedActions");
  }

  if (ruleLike.triggerType === "Static") {
    keys.add("replacement");
  }

  if (ruleLike.actionType === "Create Tokens" || ruleLike.actionType === "Modify Token Amount") {
    keys.add("tokens");
  }

  if (ruleLike.actionType === "Add +1/+1 Counters" || ruleLike.actionType === "Add Counters" || ruleLike.actionType === "Modify Counter Amount") {
    keys.add("counters");
  }

  keys.add("commander");
  keys.add("layers");

  return Array.from(keys)
    .map((key) => RULES_REFERENCE_CATEGORIES[key])
    .filter(Boolean);
}

export function summarizeRulesSources(entries = []) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return "";
  }

  return entries.map((entry) => entry.label).join(" • ");
}
