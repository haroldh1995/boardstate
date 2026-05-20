import { normalizeText } from "./targeting.js";

const overrides = {
  "anim pakal thousandth moon": {
    parsedEffects: [
      {
        kind: "trigger",
        event: "attack",
        condition: "attack-non-gnome-you-control",
        action: "add-counters",
        count: 1,
        counterType: "+1/+1",
        target: "self",
        entity: "creature",
        manual: false,
      },
      {
        kind: "trigger",
        event: "attack",
        condition: "attack-non-gnome-you-control",
        action: "create-token",
        count: 1,
        countFrom: "source-power",
        token: {
          name: "Gnome Token",
          typeLine: "Token Artifact Creature - Gnome",
          power: 1,
          toughness: 1,
        },
        tapped: true,
        attacking: true,
        manual: false,
      },
    ],
  },
  "cathars crusade": {
    parsedEffects: [
      {
        kind: "trigger",
        event: "creature-entered",
        condition: "creature-entered-controlled",
        action: "add-counters",
        count: 1,
        counterType: "+1/+1",
        target: "your-creatures",
        entity: "creature",
        manual: false,
      },
    ],
  },
  "mossborn hydra": {
    parsedEffects: [
      {
        kind: "trigger",
        event: "self-entered",
        condition: "self-entered",
        action: "add-counters",
        count: 1,
        counterType: "+1/+1",
        target: "self",
        entity: "creature",
        manual: false,
      },
      {
        kind: "trigger",
        event: "land-entered",
        condition: "land-entered-controlled",
        action: "double-counters",
        counterType: "+1/+1",
        target: "self",
        entity: "creature",
        manual: false,
      },
    ],
  },
  "soul warden": {
    parsedEffects: [
      {
        kind: "trigger",
        event: "creature-entered",
        condition: "creature-entered-other",
        action: "life",
        amount: 1,
        manual: false,
      },
    ],
  },
  "warleader s call": {
    parsedEffects: [
      {
        id: "warleaders-call-static",
        kind: "static",
        action: "modify-power-toughness",
        target: "your-creatures",
        power: 1,
        toughness: 1,
        sourceName: "Warleader's Call",
      },
      {
        kind: "trigger",
        event: "creature-entered",
        condition: "creature-entered-controlled",
        action: "damage",
        amount: 1,
        target: "each-opponent",
        manual: false,
      },
    ],
  },
  "doubling season": {
    parsedEffects: [
      {
        kind: "replacement",
        action: "double-tokens",
        target: "all-tokens",
        sourceName: "Doubling Season",
      },
      {
        kind: "replacement",
        action: "double-counters",
        target: "all-permanents",
        sourceName: "Doubling Season",
      },
    ],
  },
  "scute swarm": {
    parsedEffects: [
      {
        kind: "trigger",
        event: "land-entered",
        condition: "land-entered-controlled",
        action: "create-token",
        count: 1,
        token: {
          name: "Insect Token",
          typeLine: "Token Creature - Insect",
          power: 1,
          toughness: 1,
        },
        copySelfAtLandCount: 6,
        copySelf: true,
        manual: false,
      },
    ],
  },
  "traveling chocobo": {
    parsedEffects: [
      {
        kind: "replacement",
        action: "double-landfall-triggers",
        target: "all-landfall-triggers",
        sourceName: "Traveling Chocobo",
      },
    ],
  },
};

export function applyCardBehaviorOverrides(card = {}, parsedEffects = []) {
  const key = normalizeCardKey(card.name);
  const override = overrides[key];
  if (!override) {
    return parsedEffects;
  }
  return (override.parsedEffects || []).map((effect) => ({
    sourceName: card.name || effect.sourceName || "Card",
    ...effect,
  }));
}

function normalizeCardKey(name = "") {
  return normalizeText(name).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}
