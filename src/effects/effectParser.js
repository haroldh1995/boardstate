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

  if (
    (/one or more counters would be (?:put|placed)/.test(text) || /would put one or more counters/.test(text)) &&
    /twice that many/.test(text)
  ) {
    effects.push({ kind: "replacement", action: "double-counters", target: "all-permanents", sourceName: card.name });
  }
  if (/create.+twice that many|twice that many.+tokens|double the number of tokens/.test(text)) {
    effects.push({ kind: "replacement", action: "double-tokens", target: "all-tokens", sourceName: card.name });
  }
  if (/landfall ability of a permanent you control triggers an additional time|landfall abilities trigger an additional time/.test(text)) {
    effects.push({ kind: "replacement", action: "double-landfall-triggers", target: "all-landfall-triggers", sourceName: card.name });
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
    } else if (/whenever a land you control enters|whenever a land enters the battlefield under your control|landfall/.test(sentence)) {
      pushActions("land-entered", sentence);
    } else if (/this creature enters with|enters with (?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) [+\-]?\d*\/?[+\-]?\d* counters? on it/.test(sentence)) {
      pushActions("self-entered", sentence);
    } else if (/when .+ enters|when this enters/.test(sentence)) {
      pushActions("self-entered", sentence);
    } else if (/at the beginning of your upkeep/.test(sentence)) {
      pushActions("phase:Beginning", sentence);
    } else if (/at the beginning of combat/.test(sentence)) {
      pushActions("phase:Combat", sentence);
    } else if (/at the beginning of your end step|at the beginning of each end step/.test(sentence)) {
      pushActions("phase:Ending", sentence);
    } else if (/whenever .+ attacks|whenever .+ attack|whenever one or more creatures attack/.test(sentence)) {
      pushActions("attack", sentence);
    } else if (/whenever .+ dies|whenever a creature dies/.test(sentence)) {
      pushActions("dies", sentence);
    }
  }

  return effects;
}

export function parseSpellEffects(text, card = {}) {
  const typeLine = String(card.typeLine || "").toLowerCase();
  if (!card.isInstant && !card.isSorcery && !typeLine.includes("instant") && !typeLine.includes("sorcery")) {
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
  const normalizedText = normalizeText(text);
  const target = inferTargetFromText(normalizedText, sourceName);

  if (normalizedText.includes("create") && normalizedText.includes("token")) {
    const copyThreshold = parseLandCopyThreshold(normalizedText);
    actions.push({
      action: "create-token",
      count: parseCount(normalizedText),
      token: parseToken(normalizedText),
      tapped: normalizedText.includes("tapped"),
      attacking: normalizedText.includes("attacking"),
      controller: /that creatures controller creates|its controller creates/.test(normalizedText) ? "target-controller" : "",
      countFrom: parseCountFrom(normalizedText),
      copySelfAtLandCount: copyThreshold,
      copySelf: normalizedText.includes("copy of this creature"),
      manual: false,
    });
  }

  if (normalizedText.includes("counter") && /\bput\b|\bputs\b|\badd\b|\badds\b/.test(normalizedText)) {
    actions.push({
      action: "add-counters",
      count: parseCounterCount(normalizedText),
      counterType: parseCounterType(normalizedText),
      target: target.target,
      entity: target.entity,
      manual: target.manual,
    });
  }

  const etbCounters = normalizedText.match(/enters with (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) ((?:\+1\/\+1|-1\/-1|[a-z ]+)) counters? on (?:it|this creature)/);
  if (etbCounters) {
    actions.push({
      action: "add-counters",
      count: parseCountToken(etbCounters[1]),
      counterType: normalizeCounterType(etbCounters[2]),
      target: "self",
      entity: "permanent",
      manual: false,
    });
  }

  const counterDoubling = normalizedText.match(
    /double the number of ((?:\+1\/\+1|-1\/-1|[a-z ]+)) counters on (it|this creature|target creature|target permanent|[a-z0-9 ',\-]+)/
  );
  if (counterDoubling) {
    const onSource = normalizeText(counterDoubling[2]).includes(normalizeText(sourceName));
    actions.push({
      action: "double-counters",
      counterType: normalizeCounterType(counterDoubling[1]),
      target: counterDoubling[2].includes("target") ? "selected" : onSource ? "self" : "all-creatures",
      entity: counterDoubling[2].includes("creature") || onSource ? "creature" : "permanent",
      manual: counterDoubling[2].includes("target"),
    });
  }

  const buff = normalizedText.match(/get(?:s)? ([+\-]\d+)\/([+\-]\d+) until end of (turn|combat)/);
  if (buff) {
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

  const gain = normalizedText.match(/you gain (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) life/);
  if (gain) {
    actions.push({ action: "life", amount: parseCountToken(gain[1]), manual: false });
  }

  const lifeLoss = normalizedText.match(/(each opponent|target opponent|target player|each player) loses (x|a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) life/);
  if (lifeLoss) {
    actions.push({
      action: "life-loss",
      amount: lifeLoss[2] === "x" ? 0 : parseCountToken(lifeLoss[2]),
      amountFrom: lifeLoss[2] === "x" ? "x" : "",
      target: normalizePlayerTarget(lifeLoss[1]),
      manual: /target/.test(lifeLoss[1]),
    });
  }
  const selfLifeLoss = normalizedText.match(/(?:you |and )lose (x|a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) life/);
  if (selfLifeLoss) {
    actions.push({
      action: "life-loss",
      amount: selfLifeLoss[1] === "x" ? 0 : parseCountToken(selfLifeLoss[1]),
      amountFrom: selfLifeLoss[1] === "x" ? "x" : "",
      target: "you",
      manual: false,
    });
  }

  const damage = normalizedText.match(/(?:deals?|deal) (x|a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) damage to (each creature|each opponent|target opponent|opponent|any target|target creature|target player|each player)/);
  if (damage) {
    actions.push({
      action: "damage",
      amount: damage[1] === "x" ? 0 : parseCountToken(damage[1]),
      amountFrom: damage[1] === "x" ? "x" : "",
      target: inferDamageTarget(damage[2]),
      manual: /target/.test(damage[2]),
    });
  }

  const draw = normalizedText.match(/(?:(target player|each player|you) )?draws? (x|a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) cards?/);
  if (draw) {
    actions.push({
      action: "draw",
      count: draw[2] === "x" ? 0 : parseCountToken(draw[2]),
      countFrom: draw[2] === "x" ? "x" : "",
      target: normalizePlayerTarget(draw[1] || "you"),
      manual: /target/.test(draw[1] || ""),
    });
  }

  const discard = normalizedText.match(/(?:(target player|each opponent|each player|you) )?discards? (?:their hand|x|a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)(?: cards?)?/);
  if (discard) {
    const discardToken = normalizedText.match(/discards? (their hand|x|a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)/)?.[1] || "one";
    actions.push({
      action: discardToken === "their hand" ? "discard-hand" : "discard",
      count: discardToken === "x" ? 0 : discardToken === "their hand" ? 0 : parseCountToken(discardToken),
      countFrom: discardToken === "x" ? "x" : "",
      target: normalizePlayerTarget(discard[1] || "you"),
      random: normalizedText.includes("at random"),
      manual: /target/.test(discard[1] || "") || (!normalizedText.includes("at random") && discardToken !== "their hand"),
    });
  }

  const mill = normalizedText.match(/(?:(target player|each opponent|each player|you) )?mills? (x|a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) cards?/);
  if (mill) {
    actions.push({
      action: "mill",
      count: mill[2] === "x" ? 0 : parseCountToken(mill[2]),
      countFrom: mill[2] === "x" ? "x" : "",
      target: normalizePlayerTarget(mill[1] || "you"),
      manual: /target/.test(mill[1] || ""),
    });
  }

  const removalAction = inferRemovalAction(normalizedText);
  if (removalAction) {
    actions.push(removalAction);
  }

  if (/counter target (?:spell|instant or sorcery spell|noncreature spell|activated or triggered ability)/.test(normalizedText)) {
    actions.push({
      action: "counter-stack-object",
      target: "target-stack-object",
      unlessPay: parseUnlessPay(normalizedText),
      manual: true,
    });
  }

  if (/copy target (?:instant or sorcery spell|spell)/.test(normalizedText)) {
    actions.push({
      action: "copy-stack-object",
      target: "target-stack-object",
      allowNewTargets: /choose new targets/.test(normalizedText),
      manual: true,
    });
  }

  if (/search your library for/.test(normalizedText)) {
    const isLandSearch = /(?:basic )?land card|forest card|island card|swamp card|mountain card|plains card/.test(normalizedText);
    actions.push({
      action: isLandSearch ? "search-land" : "search-library",
      count: parseSearchCount(normalizedText),
      destination: inferSearchDestination(normalizedText),
      secondaryDestination: /put one onto the battlefield tapped and the other into your hand/.test(normalizedText) ? "hand" : "",
      primaryCount: /put one onto the battlefield tapped and the other into your hand/.test(normalizedText) ? 1 : 0,
      tapped: /onto the battlefield tapped/.test(normalizedText),
      query: inferSearchQuery(normalizedText),
      manual: true,
    });
  }

  if (/return target .+ card from (?:your |a )?graveyard to (?:your )?hand/.test(normalizedText)) {
    actions.push({
      action: "return-from-graveyard",
      destination: "hand",
      query: inferGraveyardQuery(normalizedText),
      manual: true,
    });
  } else if (/return target creature card from (?:your |a )?graveyard to the battlefield/.test(normalizedText)) {
    actions.push({
      action: "return-from-graveyard",
      destination: "battlefield",
      query: "creature",
      manual: true,
    });
  }

  if (/return all land cards from your graveyard to the battlefield/.test(normalizedText)) {
    actions.push({
      action: "return-all-lands-from-graveyard",
      destination: "battlefield",
      manual: false,
    });
  }

  if (/take an extra turn|additional turn/.test(normalizedText)) {
    actions.push({ action: "extra-turn", manual: true, reason: "Extra-turn scheduling requires confirmation" });
  }
  if (/additional combat phase|extra combat phase/.test(normalizedText)) {
    actions.push({ action: "extra-combat", manual: true, reason: "Extra-combat scheduling requires confirmation" });
  }
  if (/as an additional cost to cast this spell/.test(normalizedText)) {
    actions.push({ action: "additional-cost", manual: true, reason: "Additional casting cost must be confirmed" });
  }

  if (requiresRulesReview(normalizedText) && !actions.some((entry) => entry.action === "manual-choice")) {
    actions.push({
      action: "manual-choice",
      manual: true,
      reason: "Partially supported spell text needs review",
      summary: `Partially supported: ${normalizedText.slice(0, 180)}`,
    });
  }

  if (requiresManualChoice(normalizedText) && !actions.some((entry) => entry.manual)) {
    actions.push({
      action: "manual-choice",
      manual: true,
      reason: inferManualChoiceReason(normalizedText),
      summary: buildManualChoiceSummary(normalizedText),
    });
  }

  if (!actions.length && normalizedText) {
    actions.push({
      action: "manual-choice",
      manual: true,
      reason: "Unsupported effect requires manual resolution",
      summary: buildManualChoiceSummary(normalizedText),
    });
  }

  return actions;
}

function normalizePlayerTarget(raw = "you") {
  const value = String(raw || "you").toLowerCase();
  if (value.includes("each opponent")) return "each-opponent";
  if (value.includes("each player")) return "each-player";
  if (value.includes("target opponent")) return "target-opponent";
  if (value.includes("target player")) return "target-player";
  return "you";
}

function inferRemovalAction(text) {
  const patterns = [
    { regex: /destroy all nonland permanents/, mode: "destroy", target: "all-nonland-permanents", manual: false },
    { regex: /destroy all creatures/, mode: "destroy", target: "all-creatures", manual: false },
    { regex: /destroy all artifacts and enchantments/, mode: "destroy", target: "all-artifacts-enchantments", manual: false },
    { regex: /exile all creatures/, mode: "exile", target: "all-creatures", manual: false },
    { regex: /exile all graveyards/, mode: "exile-graveyards", target: "each-player", manual: false },
    { regex: /return all creatures to their owners hands/, mode: "bounce", target: "all-creatures", manual: false },
    { regex: /destroy target artifact or enchantment/, mode: "destroy", target: "selected-artifact-enchantment", manual: true },
    { regex: /destroy target artifact or creature/, mode: "destroy", target: "selected-artifact-creature", manual: true },
    { regex: /destroy each nonland permanent with mana value x or less/, mode: "destroy", target: "all-nonland-mana-value-x", manual: false },
    { regex: /destroy target artifact/, mode: "destroy", target: "selected-artifact", manual: true },
    { regex: /destroy target enchantment/, mode: "destroy", target: "selected-enchantment", manual: true },
    { regex: /destroy target creature/, mode: "destroy", target: "selected-creature", manual: true },
    { regex: /destroy target permanent/, mode: "destroy", target: "selected", manual: true },
    { regex: /exile target card from (?:a|target players|your) graveyard/, mode: "exile-graveyard-card", target: "graveyard-card", manual: true },
    { regex: /exile target creature/, mode: "exile", target: "selected-creature", manual: true },
    { regex: /exile target (?:nonland )?permanent/, mode: "exile", target: "selected", manual: true },
    { regex: /return target creature to its owners hand/, mode: "bounce", target: "selected-creature", manual: true },
    { regex: /return target (?:nonland )?permanent to its owners hand/, mode: "bounce", target: "selected", manual: true },
    { regex: /target (?:player|opponent) sacrifices a creature/, mode: "sacrifice", target: "target-player-creature", manual: true },
    { regex: /each opponent sacrifices a creature/, mode: "sacrifice", target: "each-opponent-creature", manual: true },
  ];
  const match = patterns.find((entry) => entry.regex.test(text));
  return match ? { action: "remove-permanent", mode: match.mode, target: match.target, manual: match.manual } : null;
}

function parseUnlessPay(text) {
  const match = text.match(/unless its controller pays (x|one|two|three|four|five|six|seven|eight|nine|ten|\d+)/);
  if (!match) return 0;
  return match[1] === "x" ? "x" : parseCountToken(match[1]);
}

function parseSearchCount(text) {
  if (/for up to (two|three|four|\d+)/.test(text)) {
    return parseCountToken(text.match(/for up to (two|three|four|\d+)/)[1]);
  }
  if (/for (two|three|four|\d+) .+ cards?/.test(text)) {
    return parseCountToken(text.match(/for (two|three|four|\d+) .+ cards?/)[1]);
  }
  return 1;
}

function inferSearchDestination(text) {
  if (/onto the battlefield/.test(text)) return "battlefield";
  if (/into your graveyard/.test(text)) return "graveyard";
  if (/on top of your library/.test(text)) return "library-top";
  return "hand";
}

function inferSearchQuery(text) {
  if (/basic land/.test(text)) return "basic-land";
  if (/land card/.test(text)) return "land";
  if (/creature card/.test(text)) return "creature";
  if (/instant or sorcery/.test(text)) return "instant-sorcery";
  if (/artifact or enchantment/.test(text)) return "artifact-enchantment";
  if (/artifact/.test(text)) return "artifact";
  if (/enchantment/.test(text)) return "enchantment";
  return "card";
}

function inferGraveyardQuery(text) {
  if (/creature card/.test(text)) return "creature";
  if (/instant or sorcery/.test(text)) return "instant-sorcery";
  if (/land card/.test(text)) return "land";
  return "card";
}

function parseToken(text) {
  const pt = text.match(/(\d+)\/(\d+)/);
  const nonCreatureType = text.match(/\b(treasure|food|clue|blood|map|powerstone) tokens?\b/);
  if (nonCreatureType) {
    const tokenName = capitalize(nonCreatureType[1]);
    return {
      name: `${tokenName} Token`,
      typeLine: `Token Artifact - ${tokenName}`,
      power: 0,
      toughness: 0,
    };
  }
  const type = text.match(/(?:white|blue|black|red|green|colorless|artifact|enchantment|\s)*([a-z]+) creature token/);
  return {
    name: type ? `${capitalize(type[1])} Token` : "Token",
    typeLine: "Token Creature",
    power: pt ? Number(pt[1]) || 1 : 1,
    toughness: pt ? Number(pt[2]) || 1 : 1,
  };
}

function parseCountFrom(text) {
  if (/for each attacking creature|equal to the number of attacking creatures/.test(text)) {
    return "attacking-creatures";
  }
  if (/equal to the number of \+1\/\+1 counters on|that many \+1\/\+1 counters on/.test(text)) {
    return "source-plus1-counters";
  }
  if (/where x is .* power|equal to .* power/.test(text)) {
    return "source-power";
  }
  if (/equal to the number of counters on/.test(text)) {
    return "source-all-counters";
  }
  if (/for each land/.test(text)) {
    return "lands";
  }
  return "";
}

function parseLandCopyThreshold(text) {
  const match = text.match(/if you control (six|seven|eight|nine|ten|\d+) or more lands/);
  if (!match) {
    return 0;
  }
  return parseCountToken(match[1]);
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

function normalizeCounterType(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "+1/+1" || value === "-1/-1") {
    return value;
  }
  return capitalizeWords(value.replace(/ counters?$/, ""));
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

function inferDamageTarget(raw) {
  const value = String(raw || "").toLowerCase();
  if (value.includes("each creature")) {
    return "all-creatures";
  }
  if (value.includes("each opponent")) {
    return "each-opponent";
  }
  if (value.includes("each player")) {
    return "each-player";
  }
  if (value.includes("opponent")) {
    return "opponent";
  }
  if (value.includes("target creature")) {
    return "selected-creature";
  }
  if (value.includes("target player")) {
    return "selected-player";
  }
  return "selected";
}

function capitalize(value) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function capitalizeWords(value) {
  return String(value || "").split(/\s+/).filter(Boolean).map(capitalize).join(" ");
}

function requiresManualChoice(text) {
  if (!text) {
    return false;
  }
  return [
    /\bmay\b/,
    /\bchoose\b/,
    /\btarget\b/,
    /\bone or more\b/,
    /\bup to\b/,
    /\bany number\b/,
    /\bpay\b/,
    /\beither\b/,
    /\battach\b/,
    /\bequip\b/,
    /\bdistribute\b/,
    /\border\b/,
    /\bunless\b/,
  ].some((pattern) => pattern.test(text));
}

function requiresRulesReview(text) {
  return [
    /\bscry\b/,
    /\bsurveil\b/,
    /\blook at the top\b/,
    /\breveal the top\b/,
    /\bdelve\b/,
    /\bcascade\b/,
    /\bstorm\b/,
    /\breplicate\b/,
    /\bsuspend\b/,
    /\bforetell\b/,
    /\badventure\b/,
    /\bflashback\b/,
    /\bjump-start\b/,
    /\bretrace\b/,
    /\bescape\b/,
    /\brebound\b/,
    /\bbuyback\b/,
    /\bkicker\b/,
    /\boverload\b/,
    /\bat the beginning of the next\b/,
    /\bdraws? cards equal to\b/,
    /\bsacrifices all colored permanents\b/,
    /\bshuffle it into their library\b/,
    /\bdivided as you choose\b/,
    /\bprevent all\b/,
    /\bprotection from\b/,
  ].some((pattern) => pattern.test(text));
}

function inferManualChoiceReason(text) {
  if (/\btarget\b/.test(text)) return "Target selection required";
  if (/\bmay\b/.test(text)) return "Optional effect decision required";
  if (/\bchoose\b|\beither\b|\bup to\b|\bany number\b/.test(text)) return "Mode/choice selection required";
  if (/\battach\b|\bequip\b/.test(text)) return "Attachment target choice required";
  if (/\bpay\b|\bunless\b/.test(text)) return "Cost/payment decision required";
  if (/\border\b|\bdistribute\b/.test(text)) return "Ordering/distribution decision required";
  return "Manual choice required";
}

function buildManualChoiceSummary(text) {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  if (!compact) {
    return "Manual choice required.";
  }
  return `Manual choice required: ${compact.slice(0, 180)}`;
}
