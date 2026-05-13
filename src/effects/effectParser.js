import { inferTargetFromText, normalizeText } from "./targeting.js";

const NUMBER_WORDS = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

export function parseCardEffects(card) {
  const text = normalizeText(card.oracleText);
  if (!text) {
    return [];
  }

  return [
    ...parseStaticEffects(text, card),
    ...parseTriggeredEffects(text, card),
    ...parseSpellEffects(text, card),
  ];
}

export function parseStaticEffects(text, card = {}) {
  const effects = [];
  const pushBuff = (match, target) => {
    effects.push({
      id: `${card.id || card.cardId || card.name}-static-${effects.length}`,
      kind: "static",
      action: "modify-power-toughness",
      target,
      power: Number(match[1]) || 0,
      toughness: Number(match[2]) || 0,
      sourceName: card.name,
    });
  };

  for (const match of text.matchAll(/creatures you control get ([+\-]\d+)\/([+\-]\d+)/g)) {
    pushBuff(match, "all-creatures");
  }
  for (const match of text.matchAll(/all creatures get ([+\-]\d+)\/([+\-]\d+)/g)) {
    pushBuff(match, "all-creatures");
  }
  for (const match of text.matchAll(/creature tokens you control get ([+\-]\d+)\/([+\-]\d+)/g)) {
    pushBuff(match, "all-creature-tokens");
  }
  for (const match of text.matchAll(/artifact creatures you control get ([+\-]\d+)\/([+\-]\d+)/g)) {
    pushBuff(match, "all-artifacts");
  }
  for (const match of text.matchAll(/equipped creature gets ([+\-]\d+)\/([+\-]\d+)/g)) {
    pushBuff(match, "attached");
  }
  for (const match of text.matchAll(/enchanted creature gets ([+\-]\d+)\/([+\-]\d+)/g)) {
    pushBuff(match, "attached");
  }

  const keywordMatch = text.match(/(?:creatures you control|equipped creature|enchanted creature) (?:have|has|gain|gains) ([a-z, ]+)/);
  if (keywordMatch) {
    effects.push({
      id: `${card.id || card.cardId || card.name}-keywords`,
      kind: "static",
      action: "grant-keywords",
      target: text.includes("equipped creature") || text.includes("enchanted creature") ? "attached" : "all-creatures",
      keywords: extractKeywords(keywordMatch[1]),
      sourceName: card.name,
    });
  }

  const attachmentKeywordMatch = text.match(/(?:equipped creature|enchanted creature).*(?:has|gains?) ([a-z, ]+)/);
  if (attachmentKeywordMatch) {
    effects.push({
      id: `${card.id || card.cardId || card.name}-attachment-keywords`,
      kind: "static",
      action: "grant-keywords",
      target: "attached",
      keywords: extractKeywords(attachmentKeywordMatch[1]),
      sourceName: card.name,
    });
  }

  if (/one or more counters would be (?:put|placed)/.test(text) && /twice that many/.test(text)) {
    effects.push({ kind: "replacement", action: "double-counters", target: "all-permanents", sourceName: card.name });
  }
  if (/create.+twice that many|twice that many.+tokens|double the number of tokens/.test(text)) {
    effects.push({ kind: "replacement", action: "double-tokens", target: "all-tokens", sourceName: card.name });
  }

  return effects;
}

export function parseTriggeredEffects(text, card = {}) {
  const effects = [];
  const sourceName = card.name || "Card";
  const pushActions = (event, sentence) => {
    parseActions(sentence, sourceName).forEach((action) => {
      effects.push({
        ...action,
        kind: "trigger",
        event,
        sourceName,
        sourceId: card.id,
      });
    });
  };

  for (const sentence of splitSentences(text)) {
    if (/whenever .+ creature.+ enters|whenever a creature enters|whenever another creature enters/.test(sentence)) {
      pushActions("creature-entered", sentence);
    } else if (/when .+ enters|when this enters/.test(sentence)) {
      pushActions("self-entered", sentence);
    } else if (/at the beginning of your upkeep/.test(sentence)) {
      pushActions("phase:Beginning", sentence);
    } else if (/at the beginning of combat/.test(sentence)) {
      pushActions("phase:Combat", sentence);
    } else if (/at the beginning of your end step|at the beginning of each end step/.test(sentence)) {
      pushActions("phase:Ending", sentence);
    } else if (/whenever .+ attacks|whenever one or more creatures attack/.test(sentence)) {
      pushActions("attack", sentence);
    } else if (/whenever .+ dies|whenever a creature dies/.test(sentence)) {
      pushActions("dies", sentence);
    }
  }

  return effects;
}

export function parseSpellEffects(text, card = {}) {
  if (!card.isInstant && !card.isSorcery) {
    return [];
  }
  return parseActions(text, card.name).map((action) => ({
    ...action,
    kind: "spell",
    sourceName: card.name,
    sourceId: card.id,
  }));
}

export function parseActions(text, sourceName = "") {
  const actions = [];

  if (text.includes("create") && text.includes("token")) {
    actions.push({
      action: "create-token",
      count: parseCount(text),
      token: parseToken(text),
      tapped: text.includes("tapped"),
      attacking: text.includes("attacking"),
      manual: false,
    });
  }

  if (text.includes("counter") && /\bput\b|\bputs\b|\badd\b|\badds\b/.test(text)) {
    const target = inferTargetFromText(text, sourceName);
    actions.push({
      action: "add-counters",
      count: parseCounterCount(text),
      counterType: parseCounterType(text),
      target: target.target,
      entity: target.entity,
      manual: target.manual,
    });
  }

  const buff = text.match(/get(?:s)? ([+\-]\d+)\/([+\-]\d+) until end of (turn|combat)/);
  if (buff) {
    const target = inferTargetFromText(text, sourceName);
    actions.push({
      action: "temporary-buff",
      power: Number(buff[1]) || 0,
      toughness: Number(buff[2]) || 0,
      duration: buff[3] === "combat" ? "combat" : "turn",
      target: target.target,
      entity: target.entity,
      manual: target.manual,
    });
  }

  const gain = text.match(/you gain (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) life/);
  if (gain) {
    actions.push({ action: "life", amount: parseCountToken(gain[1]), manual: false });
  }

  return actions;
}

function parseToken(text) {
  const pt = text.match(/(\d+)\/(\d+)/);
  const type = text.match(/(?:white|blue|black|red|green|colorless|artifact|enchantment|\s)*([a-z]+) creature token/);
  return {
    name: type ? `${capitalize(type[1])} Token` : "Token",
    typeLine: "Token Creature",
    power: pt ? Number(pt[1]) || 1 : 1,
    toughness: pt ? Number(pt[2]) || 1 : 1,
  };
}

function parseCounterType(text) {
  if (text.includes("+1/+1 counter")) {
    return "+1/+1";
  }
  if (text.includes("-1/-1 counter")) {
    return "-1/-1";
  }
  const match = text.match(/([a-z]+(?: [a-z]+){0,2}) counters?/);
  return match ? capitalizeWords(match[1].replace(/^(?:a|an|one|two|\d+) /, "")) : "Generic";
}

function parseCounterCount(text) {
  const match = text.match(/(?:put|puts|add|adds) (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)/);
  return match ? parseCountToken(match[1]) : 1;
}

function parseCount(text) {
  const match = text.match(/(?:create|creates|created|draw|gain) (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)/);
  return match ? parseCountToken(match[1]) : 1;
}

function parseCountToken(token) {
  const normalized = String(token || "").toLowerCase();
  return NUMBER_WORDS[normalized] || Number(normalized) || 1;
}

function splitSentences(text) {
  return text.split(/\.\s*/).map((part) => part.trim()).filter(Boolean);
}

function extractKeywords(text) {
  const known = ["flying", "first strike", "double strike", "deathtouch", "haste", "hexproof", "indestructible", "lifelink", "menace", "reach", "trample", "vigilance", "ward"];
  return known.filter((keyword) => text.includes(keyword));
}

function capitalize(value) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function capitalizeWords(value) {
  return String(value || "").split(/\s+/).filter(Boolean).map(capitalize).join(" ");
}
