const BASE_URL = typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : "/";

export const COMPREHENSIVE_RULES_ASSET_URL = `${BASE_URL}rules/MagicCompRules-20210712.txt`;

export const COMPREHENSIVE_RULES_SOURCE = {
  title: "Magic: The Gathering Comprehensive Rules",
  effectiveDate: "2021-07-12",
  assetUrl: COMPREHENSIVE_RULES_ASSET_URL,
  note: "Bundled static reference; lazy-loaded only when full text search is needed.",
};

export const COMPACT_RULES_INDEX = {
  commander: [
    {
      rule: "903.3",
      label: "Commander designation",
      summary: "Each deck has a designated commander, normally a legendary creature, with specific allowances for cards that say they can be commanders.",
    },
    {
      rule: "903.4",
      label: "Color identity",
      summary: "Commander deck cards must fit within the commander's color identity.",
    },
    {
      rule: "903.8",
      label: "Commander casting",
      summary: "A commander may be cast from the command zone with an additional two generic mana for each previous cast from that zone.",
    },
    {
      rule: "903.10",
      label: "Commander damage",
      summary: "A player dealt 21 or more combat damage by the same commander over the game loses in Commander rules.",
    },
  ],
  planeswalkers: [
    {
      rule: "306.5b",
      label: "Loyalty entry",
      summary: "A planeswalker enters the battlefield with loyalty counters equal to its printed loyalty number.",
    },
    {
      rule: "306.5d",
      label: "Loyalty activation timing",
      summary: "A player may activate a loyalty ability of a permanent they control only once each turn during a main phase when the stack is empty.",
    },
    {
      rule: "306.8",
      label: "Planeswalker damage",
      summary: "Damage dealt to a planeswalker removes that many loyalty counters from it.",
    },
    {
      rule: "306.9",
      label: "Zero loyalty state action",
      summary: "A planeswalker with loyalty 0 is put into its owner's graveyard as a state-based action.",
    },
  ],
  layers: [
    {
      rule: "613",
      label: "Continuous effect layers",
      summary: "Continuous effects are applied in layer order, with power/toughness changes handled in layer 7.",
    },
  ],
  stateBasedActions: [
    {
      rule: "704",
      label: "State-based actions",
      summary: "The game checks state-based actions automatically whenever a player would receive priority.",
    },
  ],
  combat: [
    {
      rule: "508.1a",
      label: "Attacker legality",
      summary: "A creature generally must be untapped and controlled continuously since the turn began, or have haste, to be declared as an attacker.",
    },
    {
      rule: "508.1f",
      label: "Attack tapping",
      summary: "Chosen attackers become tapped unless an effect says they do not tap to attack.",
    },
  ],
};

let cachedRulesText = "";
let cachedRulesPromise = null;

export async function loadComprehensiveRulesText() {
  if (cachedRulesText) {
    return cachedRulesText;
  }

  if (!cachedRulesPromise) {
    cachedRulesPromise = fetch(COMPREHENSIVE_RULES_ASSET_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unable to load bundled Comprehensive Rules reference.");
        }
        return response.text();
      })
      .then((text) => {
        cachedRulesText = text;
        return cachedRulesText;
      });
  }

  return cachedRulesPromise;
}

export async function searchComprehensiveRulesText(query, limit = 8) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const rulesText = await loadComprehensiveRulesText();
  const lines = rulesText.split(/\r?\n/);
  const results = [];

  for (let index = 0; index < lines.length && results.length < limit; index += 1) {
    const line = lines[index];
    if (line.toLowerCase().includes(normalizedQuery)) {
      results.push({
        lineNumber: index + 1,
        text: line.trim(),
      });
    }
  }

  return results;
}
