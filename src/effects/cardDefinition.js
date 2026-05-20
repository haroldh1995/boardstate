import { normalizeName, normalizeSigned } from "../state/ids.js";
import { parseCardEffects } from "./effectParser.js";
import { applyCardBehaviorOverrides } from "./cardBehaviorOverrides.js";

const COLOR_SYMBOLS = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
  C: "Colorless",
};

export function createCardDefinition(card = {}) {
  const parsedTypeLine = parseTypeLine(card.typeLine || "Permanent");
  const manaCost = normalizeName(card.manaCost);
  const parsedEffects = applyCardBehaviorOverrides(card, parseCardEffects(card));
  const keywords = Array.from(
    new Set([
      ...(card.keywords || []),
      ...parsedEffects.filter((effect) => effect.action === "grant-keywords").flatMap((effect) => effect.keywords || []),
    ])
  );
  const staticAbilities = parsedEffects.filter((effect) => effect.kind === "static");
  const activatedAbilities = Array.isArray(card.activatedAbilities) ? card.activatedAbilities : [];
  const triggeredAbilities = normalizeTriggerDefinitions(parsedEffects.filter((effect) => effect.kind === "trigger"), card.id || card.cardId || "");
  const replacementEffects = parsedEffects.filter((effect) => effect.kind === "replacement");
  const continuousEffects = normalizeContinuousEffects(card.continuousEffects || [], card.id || card.cardId || "");
  const tokenDefinitions = buildTokenDefinitions(parsedEffects, card.tokenDefinitions || []);

  return {
    id: normalizeName(card.id || card.cardId),
    name: normalizeName(card.name, "Card"),
    manaCost,
    manaValue: parseManaValue(manaCost),
    typeLine: normalizeName(card.typeLine, "Permanent"),
    subtypes: parsedTypeLine.subtypes,
    colors: normalizeColors(card.colors, manaCost),
    supertypes: parsedTypeLine.supertypes,
    power: normalizeSigned(card.power ?? card.basePower),
    toughness: normalizeSigned(card.toughness ?? card.baseToughness),
    loyalty: Number.isFinite(Number(card.loyalty)) ? Number(card.loyalty) : 0,
    keywords,
    staticAbilities,
    activatedAbilities,
    triggeredAbilities,
    replacementEffects,
    continuousEffects,
    tokenDefinitions,
    parsedEffects,
    metadata: {
      source: card.metadata?.source || "runtime",
      setCode: card.metadata?.setCode || card.setCode || "",
      rarity: card.metadata?.rarity || card.rarity || "",
      imageUrl: card.imageUrl || card.metadata?.imageUrl || "",
    },
    rulesText: normalizeName(card.rulesText || card.oracleText),
    flavorText: normalizeName(card.flavorText),
    relationships: normalizeRelationships(card.relationships),
    tags: normalizeTags(card.tags, parsedTypeLine, card),
  };
}

function normalizeTriggerDefinitions(triggers, sourceId) {
  const deriveCondition = (trigger = {}) => {
    const event = String(trigger.event || "");
    if (event.startsWith("phase:")) {
      return trigger.condition || event.split(":")[1] || "";
    }
    if (event === "self-entered" || event === "creature-entered" || event === "land-entered" || event === "attack" || event === "dies") {
      return trigger.condition || event;
    }
    return trigger.condition || "";
  };
  return triggers.map((trigger, index) => ({
    id: trigger.id || `${sourceId || "source"}:trigger:${index}`,
    sourceId,
    eventType: mapTriggerEventType(trigger.event),
    timing: trigger.event?.startsWith("phase:") ? "phase" : "event",
    condition: deriveCondition(trigger),
    targetSelector: trigger.target || "all-creatures",
    optional: Boolean(trigger.optional),
    oncePerTurn: Boolean(trigger.oncePerTurn),
    effectDefinitions: trigger.effectDefinitions || [trigger],
    priority: Number.isFinite(Number(trigger.priority)) ? Number(trigger.priority) : 0,
    stackBehavior: trigger.stackBehavior || "stack",
  }));
}

function normalizeContinuousEffects(effects, sourceId) {
  return effects
    .filter(Boolean)
    .map((effect, index) => ({
      modifierId: effect.modifierId || `${sourceId || "source"}:continuous:${index}`,
      sourceId,
      targetSelector: effect.targetSelector || effect.target || "self",
      timestamp: Date.now() + index,
      duration: effect.duration || "battlefield",
      layer: Number(effect.layer) || inferLayer(effect),
      dependencies: effect.dependencies || [],
      operation: effect.operation || inferOperation(effect),
      power: effect.power,
      toughness: effect.toughness,
      keywords: effect.keywords || [],
      color: effect.color || "",
      setType: effect.setType || "",
      setPower: effect.setPower,
      setToughness: effect.setToughness,
      expirationRules: effect.expirationRules || "",
    }));
}

function buildTokenDefinitions(parsedEffects, explicitDefinitions) {
  const parsed = parsedEffects
    .filter((effect) => effect.action === "create-token")
    .map((effect, index) => ({
      id: `token:${index}`,
      name: effect.token?.name || "Token",
      typeLine: effect.token?.typeLine || "Token Creature",
      power: Number(effect.token?.power) || 0,
      toughness: Number(effect.token?.toughness) || 0,
      tapped: Boolean(effect.tapped),
      attacking: Boolean(effect.attacking),
    }));
  return [...explicitDefinitions, ...parsed];
}

function normalizeColors(inputColors, manaCost) {
  if (Array.isArray(inputColors) && inputColors.length) {
    return [...new Set(inputColors)];
  }
  const symbols = [...String(manaCost || "").matchAll(/\{([WUBRGC])\}/g)].map((match) => COLOR_SYMBOLS[match[1]]).filter(Boolean);
  return [...new Set(symbols)];
}

function parseManaValue(manaCost) {
  let value = 0;
  for (const match of String(manaCost || "").matchAll(/\{([^}]+)\}/g)) {
    const symbol = match[1];
    if (/^\d+$/.test(symbol)) {
      value += Number(symbol);
      continue;
    }
    if (/^[WUBRGCXYZ]$/.test(symbol)) {
      value += 1;
    }
  }
  return value;
}

function parseTypeLine(typeLine) {
  const [left = "", right = ""] = String(typeLine || "Permanent").split("—").map((entry) => entry.trim());
  const allLeft = left.split(/\s+/).filter(Boolean);
  const supertypes = allLeft.filter((token) => ["Legendary", "Basic", "Snow", "World", "Ongoing"].includes(token));
  const coreTypes = allLeft.filter((token) => !supertypes.includes(token));
  const subtypes = right ? right.split(/\s+/).filter(Boolean) : [];
  return { supertypes, coreTypes, subtypes };
}

function normalizeRelationships(relationships = {}) {
  return {
    attachedToId: relationships.attachedToId || "",
    attachedIds: Array.isArray(relationships.attachedIds) ? relationships.attachedIds : [],
    copiedFromId: relationships.copiedFromId || "",
    linkedCommanderKey: relationships.linkedCommanderKey || "",
  };
}

function normalizeTags(tags = [], parsedTypeLine = {}, card = {}) {
  const nextTags = new Set(Array.isArray(tags) ? tags : []);
  parsedTypeLine.supertypes.forEach((entry) => nextTags.add(entry.toLowerCase()));
  parsedTypeLine.subtypes.forEach((entry) => nextTags.add(entry.toLowerCase()));
  if (card.isToken) {
    nextTags.add("token");
  }
  if (card.isCommander) {
    nextTags.add("commander");
  }
  return [...nextTags];
}

function mapTriggerEventType(event) {
  if (!event) {
    return "UNKNOWN";
  }
  if (event === "creature-entered" || event === "self-entered") {
    return "ENTER_BATTLEFIELD";
  }
  if (event === "attack") {
    return "ATTACK_TRIGGER_CHECK";
  }
  if (event === "land-entered") {
    return "LANDFALL_CHECK";
  }
  if (event === "dies") {
    return "LEAVE_BATTLEFIELD";
  }
  if (String(event).startsWith("phase:")) {
    return "PHASE_CHANGED";
  }
  return String(event).toUpperCase();
}

function inferLayer(effect) {
  if (effect.action === "grant-keywords") {
    return 6;
  }
  if (effect.action === "modify-power-toughness") {
    return 8;
  }
  return 8;
}

function inferOperation(effect) {
  if (effect.action === "grant-keywords") {
    return "add-keywords";
  }
  if (effect.action === "modify-power-toughness") {
    return "add-pt";
  }
  return "none";
}
