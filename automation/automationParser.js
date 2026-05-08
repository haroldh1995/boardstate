import { scoreAutomationRule } from "./rulesConfidenceScorer.js";
import { getRulesReferenceEntries } from "./rulesReferenceService.js";
import { findRelevantRuling } from "./scryfallRulingsService.js";

export function extractEffectMetadata(oracleText = "") {
  const normalized = normalizeText(oracleText).toLowerCase();
  const staticBuffRules = parseStaticBuffRules(normalized);
  const primaryStaticBuff = staticBuffRules[0] || {
    power: 0,
    toughness: 0,
    appliesTo: "",
    excludesSelf: false,
  };

  return {
    doublesTokens:
      /(?:create|creates|creating).+twice that many|double the number of tokens|creates twice that many/i.test(normalized),
    doublesCounters:
      /one or more counters would be put|twice that many of those counters|double the number of each of those counters/i.test(normalized),
    counterModifierBonus: /that many plus one|plus an additional counter|additional \+1\/\+1 counter/i.test(normalized) ? 1 : 0,
    createsTokens: normalized.includes("create") && normalized.includes("token"),
    addsCounters: normalized.includes("counter"),
    staticBuffRules,
    staticBuffPower: primaryStaticBuff.power,
    staticBuffToughness: primaryStaticBuff.toughness,
    staticBuffAppliesTo: primaryStaticBuff.appliesTo,
    staticBuffExcludesSelf: primaryStaticBuff.excludesSelf,
  };
}

export function buildAutomationSuggestions(permanent = {}) {
  const oracleText = normalizeText(permanent.oracleText);
  const normalized = oracleText.toLowerCase();
  const rulings = Array.isArray(permanent.rulings) ? permanent.rulings : [];
  const suggestions = [];
  const effectMetadata = extractEffectMetadata(oracleText);

  if (!normalized) {
    return suggestions;
  }

  if (effectMetadata.doublesTokens) {
    suggestions.push(createSuggestion(permanent, {
      triggerType: "Static",
      eventType: "Static",
      actionType: "Modify Token Amount",
      targetType: "Tokens Only",
      value: 2,
      repeatBehavior: "static",
      reasonSummary: `${permanent.name} modifies token creation while it stays on the battlefield.`,
      evidenceSummary: "Oracle text indicates token creation happens twice instead.",
      isStaticModifier: true,
      rulingKeywords: ["token", "twice"],
    }));
  }

  if (effectMetadata.doublesCounters || effectMetadata.counterModifierBonus > 0) {
    suggestions.push(createSuggestion(permanent, {
      triggerType: "Static",
      eventType: "Static",
      actionType: "Modify Counter Amount",
      targetType: "All Creatures",
      value: effectMetadata.doublesCounters ? 2 : effectMetadata.counterModifierBonus,
      repeatBehavior: "static",
      reasonSummary: `${permanent.name} modifies supported counter placement while it stays on the battlefield.`,
      evidenceSummary: effectMetadata.doublesCounters
        ? "Oracle text indicates counter placement is doubled."
        : `Oracle text indicates ${effectMetadata.counterModifierBonus} extra counter${effectMetadata.counterModifierBonus === 1 ? "" : "s"} should be added.`,
      isStaticModifier: true,
      rulingKeywords: ["counter"],
    }));
  }

  if (effectMetadata.staticBuffPower !== 0 || effectMetadata.staticBuffToughness !== 0) {
    suggestions.push(createSuggestion(permanent, {
      triggerType: "Static",
      eventType: "Static",
      actionType: "Board Buff",
      targetType: "All Creatures",
      value: effectMetadata.staticBuffPower,
      repeatBehavior: "static",
      reasonSummary: `${permanent.name} applies a board-wide power/toughness buff while it remains on the battlefield.`,
      evidenceSummary: `Oracle text grants creatures you control +${effectMetadata.staticBuffPower}/+${effectMetadata.staticBuffToughness}.`,
      isStaticModifier: true,
      rulingKeywords: ["creatures", "control"],
    }));
  }

  const etbEvent = detectEntersTheBattlefieldEvent(normalized, permanent.name);
  if (etbEvent) {
    appendActionSuggestions(suggestions, permanent, rulings, normalized, {
      triggerType: "ETB",
      eventType: "ETB",
      phase: "",
      eventSourceScope: inferEventSourceScope(normalized, "ETB", permanent.name),
      repeatBehavior: "once",
      reasonPrefix: `${permanent.name} has an enters-the-battlefield trigger.`,
    });
  }

  const phaseTrigger = detectPhaseTrigger(normalized);
  if (phaseTrigger) {
    appendActionSuggestions(suggestions, permanent, rulings, normalized, {
      triggerType: "Phase",
      eventType: "Phase",
      phase: phaseTrigger.phase,
      repeatBehavior: "per-event",
      reasonPrefix: `${permanent.name} has a beginning/end phase trigger.`,
      mappedPhaseConservatively: phaseTrigger.mappedPhaseConservatively,
    });
  }

  if (/\bdies\b/.test(normalized)) {
    appendActionSuggestions(suggestions, permanent, rulings, normalized, {
      triggerType: "OnDeath",
      eventType: "OnDeath",
      phase: "",
      eventSourceScope: inferEventSourceScope(normalized, "OnDeath", permanent.name),
      repeatBehavior: "per-event",
      reasonPrefix: `${permanent.name} has a dies trigger.`,
    });
  }

  if (/\bsacrific(?:e|ed|es)\b/.test(normalized) && /when|whenever/.test(normalized)) {
    appendActionSuggestions(suggestions, permanent, rulings, normalized, {
      triggerType: "OnSacrifice",
      eventType: "OnSacrifice",
      phase: "",
      eventSourceScope: inferEventSourceScope(normalized, "OnSacrifice", permanent.name),
      repeatBehavior: "per-event",
      reasonPrefix: `${permanent.name} has a sacrifice trigger.`,
    });
  }

  if (/\bexile|exiled\b/.test(normalized) && /when|whenever/.test(normalized)) {
    appendActionSuggestions(suggestions, permanent, rulings, normalized, {
      triggerType: "OnExile",
      eventType: "OnExile",
      phase: "",
      eventSourceScope: inferEventSourceScope(normalized, "OnExile", permanent.name),
      repeatBehavior: "per-event",
      reasonPrefix: `${permanent.name} has an exile trigger.`,
    });
  }

  const attackTrigger = detectAttackTrigger(normalized, permanent.name);
  if (attackTrigger) {
    appendActionSuggestions(suggestions, permanent, rulings, normalized, {
      triggerType: attackTrigger,
      eventType: "Attack",
      phase: "Combat",
      eventSourceScope: attackTrigger === "attack-self" ? "self" : "any-creature",
      repeatBehavior: "per-event",
      reasonPrefix: `${permanent.name} has an attack trigger.`,
    });
  }

  return dedupeSuggestions(suggestions);
}

function appendActionSuggestions(suggestions, permanent, rulings, normalizedText, context) {
  if (normalizedText.includes("create") && normalizedText.includes("token")) {
    const tokenSpec = extractTokenSpec(normalizedText);
    suggestions.push(createSuggestion(permanent, {
      ...context,
      actionType: "Create Tokens",
      targetType: "Board",
      value: extractCountFromText(normalizedText),
      tokenName: tokenSpec.name,
      tokenPower: tokenSpec.power,
      tokenToughness: tokenSpec.toughness,
      tokenManaCost: "",
      reasonSummary: `${context.reasonPrefix} It creates tokens that can be automated on the battlefield.`,
      evidenceSummary: "Oracle text explicitly creates creature tokens.",
      rulingKeywords: ["token", "create"],
    }, rulings));
  }

  if (hasCounterPlacementLanguage(normalizedText)) {
    const targetProfile = inferCounterTargetProfile(normalizedText, permanent.name);
    const counterType = extractCounterTypeFromText(normalizedText);
    const actionType = counterType === "+1/+1" ? "Add +1/+1 Counters" : "Add Counters";
    suggestions.push(createSuggestion(permanent, {
      ...context,
      actionType,
      targetType: targetProfile.targetType,
      counterTargetEntity: targetProfile.counterTargetEntity,
      value: extractCounterCountFromText(normalizedText),
      counterType,
      requiresTargetSelection: targetProfile.requiresTargetSelection,
      optionalTarget: targetProfile.optionalTarget,
      reasonSummary: `${context.reasonPrefix} It places ${counterType} counters in a supported way.`,
      evidenceSummary: `Oracle text explicitly places ${counterType} counters.`,
      rulingKeywords: ["counter"],
    }, rulings));
  }

  if (/\bdouble|twice\b/.test(normalizedText) && normalizedText.includes("token")) {
    suggestions.push(createSuggestion(permanent, {
      ...context,
      actionType: "Multiply Tokens",
      targetType: context.eventType === "Attack" ? "Selected Attackers" : "Tokens Only",
      value: 2,
      reasonSummary: `${context.reasonPrefix} It doubles token output in a supported battlefield context.`,
      evidenceSummary: "Oracle text doubles token creation or token amount.",
      rulingKeywords: ["token", "twice"],
    }, rulings));
  }

  const temporaryBuff = extractTemporaryBuff(normalizedText);
  if (temporaryBuff) {
    const targetProfile = inferTemporaryBuffTargetProfile(normalizedText, permanent.name);
    suggestions.push(createSuggestion(permanent, {
      ...context,
      actionType: "Apply Temporary Buff",
      targetType: targetProfile.targetType,
      counterTargetEntity: targetProfile.counterTargetEntity,
      requiresTargetSelection: targetProfile.requiresTargetSelection,
      optionalTarget: targetProfile.optionalTarget,
      buffPower: temporaryBuff.power,
      buffToughness: temporaryBuff.toughness,
      buffDuration: temporaryBuff.duration,
      value: 0,
      reasonSummary: `${context.reasonPrefix} It applies a temporary power/toughness effect on a supported timing window.`,
      evidenceSummary: `Oracle text grants ${temporaryBuff.power >= 0 ? "+" : ""}${temporaryBuff.power}/${temporaryBuff.toughness >= 0 ? "+" : ""}${temporaryBuff.toughness} ${temporaryBuff.duration === "until-end-of-combat" ? "until end of combat" : "until end of turn"}.`,
      rulingKeywords: ["combat", "until end of turn"],
    }, rulings));
  }
}

function createSuggestion(permanent, partialRule, rulings = permanent.rulings || []) {
  const ruleReferences = getRulesReferenceEntries(partialRule);
  const rulingMatch = findRelevantRuling(
    Array.isArray(rulings) ? rulings : [],
    Array.isArray(partialRule.rulingKeywords) ? partialRule.rulingKeywords : []
  );
  const confidenceMeta = scoreAutomationRule({
    hasDirectOraclePattern: true,
    usesRulingSupport: Boolean(rulingMatch),
    usesRulesReference: ruleReferences.length > 0,
    requiresTargetSelection: Boolean(partialRule.requiresTargetSelection),
    isAmbiguous: Boolean(partialRule.optionalTarget),
    mappedPhaseConservatively: Boolean(partialRule.mappedPhaseConservatively),
    isStaticModifier: Boolean(partialRule.isStaticModifier),
  });

  return {
    sourceCardName: permanent.name,
    triggerType: partialRule.triggerType,
    phase: partialRule.phase || "",
    eventType: partialRule.eventType || "",
    eventSourceScope: partialRule.eventSourceScope || "self",
    actionType: partialRule.actionType || "",
    targetType: partialRule.targetType || "All",
    value: Number.isFinite(Number(partialRule.value)) ? Number(partialRule.value) : 0,
    tokenName: partialRule.tokenName || "",
    tokenPower: Number.isFinite(Number(partialRule.tokenPower)) ? Number(partialRule.tokenPower) : 0,
    tokenToughness: Number.isFinite(Number(partialRule.tokenToughness)) ? Number(partialRule.tokenToughness) : 0,
    tokenManaCost: partialRule.tokenManaCost || "",
    counterType: partialRule.counterType || "",
    counterTargetEntity: partialRule.counterTargetEntity === "permanent" ? "permanent" : partialRule.counterTargetEntity === "creature" ? "creature" : "",
    buffPower: Number.isFinite(Number(partialRule.buffPower)) ? Number(partialRule.buffPower) : 0,
    buffToughness: Number.isFinite(Number(partialRule.buffToughness)) ? Number(partialRule.buffToughness) : 0,
    buffDuration: partialRule.buffDuration || "until-end-of-turn",
    requiresTargetSelection: Boolean(partialRule.requiresTargetSelection),
    optionalTarget: Boolean(partialRule.optionalTarget),
    repeatBehavior: partialRule.repeatBehavior || "per-event",
    enabled: confidenceMeta.defaultEnabled,
    askBeforeRun: confidenceMeta.requiresConfirmation,
    confidence: confidenceMeta.confidence,
    sourceEvidence: buildSourceEvidence(partialRule.evidenceSummary, rulingMatch, ruleReferences),
    reasonSummary: partialRule.reasonSummary || "",
  };
}

function buildSourceEvidence(oracleSummary, rulingMatch, ruleReferences) {
  const evidence = [];

  if (oracleSummary) {
    evidence.push({
      source: "Oracle Text",
      summary: oracleSummary,
      url: "https://api.scryfall.com/cards/search?q=",
    });
  }

  if (rulingMatch?.comment) {
    evidence.push({
      source: "Scryfall Ruling",
      summary: rulingMatch.comment,
      url: "https://api.scryfall.com/cards/search?q=",
    });
  }

  ruleReferences.forEach((reference) => {
    evidence.push({
      source: "Rules Reference",
      summary: reference.label,
      url: reference.url,
    });
  });

  return evidence;
}

function detectEntersTheBattlefieldEvent(normalizedText, cardName) {
  const lowerName = normalizeText(cardName).toLowerCase();
  return (
    /(?:when|whenever)\s+.+enters the battlefield/.test(normalizedText) ||
    /(?:when|whenever)\s+this creature enters\b/.test(normalizedText) ||
    /(?:when|whenever)\s+this enters\b/.test(normalizedText) ||
    /(?:when|whenever)\s+(?!another\b)(?!a creature\b)(?!one or more creatures\b).+ enters\b/.test(normalizedText) ||
    (lowerName && normalizedText.includes(`${lowerName} enters`)) ||
    /when this enters/.test(normalizedText)
  );
}

function detectPhaseTrigger(normalizedText) {
  if (normalizedText.includes("at the beginning of your upkeep")) {
    return { phase: "Upkeep", mappedPhaseConservatively: false };
  }

  if (normalizedText.includes("at the beginning of combat")) {
    return { phase: "Combat", mappedPhaseConservatively: false };
  }

  if (normalizedText.includes("at the beginning of your end step") || normalizedText.includes("at the beginning of each end step")) {
    return { phase: "End", mappedPhaseConservatively: false };
  }

  if (normalizedText.includes("at the beginning of your main phase")) {
    return { phase: "Main", mappedPhaseConservatively: true };
  }

  return null;
}

function detectAttackTrigger(normalizedText, cardName) {
  const lowerName = normalizeText(cardName).toLowerCase();
  if (!/\battack(?:s|ing)?\b/.test(normalizedText)) {
    return "";
  }

  if (/whenever one or more [a-z0-9,\- ]*creatures?[a-z0-9,\- ]* attack/.test(normalizedText)) {
    return "attack-group";
  }

  if (/whenever (?:a|another) [a-z0-9,\- ]*creatures?[a-z0-9,\- ]* attacks/.test(normalizedText)) {
    return "attack-any";
  }

  if (normalizedText.includes("equipped creature attacks")) {
    return "attack-equipped";
  }

  if (normalizedText.includes("enchanted creature attacks")) {
    return "attack-enchanted";
  }

  if (
    (lowerName && normalizedText.includes(`${lowerName} attacks`)) ||
    normalizedText.includes("this creature attacks") ||
    normalizedText.includes("whenever this attacks")
  ) {
    return "attack-self";
  }

  return "";
}

function inferEventSourceScope(normalizedText, eventType, cardName = "") {
  const normalizedName = normalizeMatcherText(cardName);
  const text = normalizeMatcherText(normalizedText);

  if (eventType === "ETB") {
    if (
      text.includes("whenever another creature enters") ||
      text.includes("whenever a creature enters") ||
      text.includes("whenever one or more creatures enter")
    ) {
      return text.includes("another creature enters") ? "another-creature" : "any-creature";
    }

    if (text.includes("whenever another permanent enters") || text.includes("whenever a permanent enters")) {
      return text.includes("another permanent enters") ? "another-permanent" : "any-permanent";
    }
  }

  if (eventType === "OnDeath") {
    if (
      text.includes("whenever another creature dies") ||
      text.includes("whenever a creature dies") ||
      text.includes("whenever one or more creatures die")
    ) {
      return text.includes("another creature dies") ? "another-creature" : "any-creature";
    }
  }

  if (eventType === "OnSacrifice") {
    if (text.includes("whenever another creature is sacrificed") || text.includes("whenever another creature sacrifices")) {
      return "another-creature";
    }
    if (text.includes("whenever a creature is sacrificed") || text.includes("whenever you sacrifice a creature")) {
      return "any-creature";
    }
    if (text.includes("whenever a permanent is sacrificed") || text.includes("whenever you sacrifice a permanent")) {
      return "any-permanent";
    }
  }

  if (eventType === "OnExile") {
    if (text.includes("whenever another creature is exiled") || text.includes("whenever another creature leaves")) {
      return "another-creature";
    }
    if (text.includes("whenever a creature is exiled") || text.includes("whenever a creature leaves")) {
      return "any-creature";
    }
    if (text.includes("whenever a permanent is exiled") || text.includes("whenever a permanent leaves")) {
      return "any-permanent";
    }
  }

  if (
    normalizedName &&
    (text.includes(`${normalizedName} enters`) ||
      text.includes(`${normalizedName} dies`) ||
      text.includes(`${normalizedName} is exiled`) ||
      text.includes(`${normalizedName} is sacrificed`))
  ) {
    return "self";
  }

  if (text.includes("when this enters") || text.includes("when this dies") || text.includes("when this is exiled")) {
    return "self";
  }

  return "self";
}

function inferCounterTargetProfile(normalizedText, cardName = "") {
  if (hasSelfCounterTargetReference(normalizedText, cardName)) {
    return { targetType: "Self", counterTargetEntity: "permanent", requiresTargetSelection: false, optionalTarget: false };
  }

  if (
    normalizedText.includes("each permanent you control") ||
    normalizedText.includes("permanents you control") ||
    normalizedText.includes("each permanent")
  ) {
    return { targetType: "All", counterTargetEntity: "permanent", requiresTargetSelection: false, optionalTarget: false };
  }

  if (
    normalizedText.includes("each attacking creature") ||
    normalizedText.includes("all attacking creatures") ||
    normalizedText.includes("attacking creatures you control")
  ) {
    return { targetType: "All Attackers", counterTargetEntity: "creature", requiresTargetSelection: false, optionalTarget: false };
  }

  if (normalizedText.includes("each creature you control") || normalizedText.includes("creatures you control")) {
    return { targetType: "All Creatures", counterTargetEntity: "creature", requiresTargetSelection: false, optionalTarget: false };
  }

  if (normalizedText.includes("equipped creature") || normalizedText.includes("enchanted creature")) {
    return { targetType: "Attached Permanent", counterTargetEntity: "creature", requiresTargetSelection: false, optionalTarget: false };
  }

  if (normalizedText.includes("another target attacking creature")) {
    return { targetType: "Selected", counterTargetEntity: "creature", requiresTargetSelection: true, optionalTarget: false };
  }

  if (normalizedText.includes("another target attacking permanent")) {
    return { targetType: "Selected", counterTargetEntity: "permanent", requiresTargetSelection: true, optionalTarget: false };
  }

  if (normalizedText.includes("up to one target attacking creature")) {
    return { targetType: "Selected", counterTargetEntity: "creature", requiresTargetSelection: true, optionalTarget: true };
  }

  if (normalizedText.includes("up to one target attacking permanent")) {
    return { targetType: "Selected", counterTargetEntity: "permanent", requiresTargetSelection: true, optionalTarget: true };
  }

  if (normalizedText.includes("target attacking creature")) {
    return { targetType: "Selected", counterTargetEntity: "creature", requiresTargetSelection: true, optionalTarget: false };
  }

  if (normalizedText.includes("target attacking permanent")) {
    return { targetType: "Selected", counterTargetEntity: "permanent", requiresTargetSelection: true, optionalTarget: false };
  }

  if (normalizedText.includes("another target creature")) {
    return { targetType: "Selected", counterTargetEntity: "creature", requiresTargetSelection: true, optionalTarget: false };
  }

  if (normalizedText.includes("another target permanent")) {
    return { targetType: "Selected", counterTargetEntity: "permanent", requiresTargetSelection: true, optionalTarget: false };
  }

  if (normalizedText.includes("up to one target creature")) {
    return { targetType: "Selected", counterTargetEntity: "creature", requiresTargetSelection: true, optionalTarget: true };
  }

  if (normalizedText.includes("up to one target permanent")) {
    return { targetType: "Selected", counterTargetEntity: "permanent", requiresTargetSelection: true, optionalTarget: true };
  }

  if (normalizedText.includes("target creature")) {
    return { targetType: "Selected", counterTargetEntity: "creature", requiresTargetSelection: true, optionalTarget: false };
  }

  if (normalizedText.includes("target permanent")) {
    return { targetType: "Selected", counterTargetEntity: "permanent", requiresTargetSelection: true, optionalTarget: false };
  }

  return { targetType: "Board", counterTargetEntity: "creature", requiresTargetSelection: false, optionalTarget: false };
}

function inferTemporaryBuffTargetProfile(normalizedText, cardName = "") {
  if (hasSelfCounterTargetReference(normalizedText, cardName)) {
    return { targetType: "Self", counterTargetEntity: "creature", requiresTargetSelection: false, optionalTarget: false };
  }

  if (
    normalizedText.includes("each attacking creature") ||
    normalizedText.includes("all attacking creatures") ||
    normalizedText.includes("attacking creatures you control")
  ) {
    return { targetType: "All Attackers", counterTargetEntity: "creature", requiresTargetSelection: false, optionalTarget: false };
  }

  if (normalizedText.includes("equipped creature") || normalizedText.includes("enchanted creature")) {
    return { targetType: "Attached Permanent", counterTargetEntity: "creature", requiresTargetSelection: false, optionalTarget: false };
  }

  if (normalizedText.includes("creatures you control") || normalizedText.includes("each creature you control")) {
    return { targetType: "All Creatures", counterTargetEntity: "creature", requiresTargetSelection: false, optionalTarget: false };
  }

  if (normalizedText.includes("up to one target creature")) {
    return { targetType: "Selected", counterTargetEntity: "creature", requiresTargetSelection: true, optionalTarget: true };
  }

  if (normalizedText.includes("target creature")) {
    return { targetType: "Selected", counterTargetEntity: "creature", requiresTargetSelection: true, optionalTarget: false };
  }

  return { targetType: "Board", counterTargetEntity: "creature", requiresTargetSelection: false, optionalTarget: false };
}

function extractTemporaryBuff(normalizedText) {
  if (!normalizedText.includes("until end of turn") && !normalizedText.includes("until end of combat")) {
    return null;
  }

  const match = normalizedText.match(/get(?:s)?\s+([+\-]\d+)\/([+\-]\d+)(?:[^.]*?)until end of (turn|combat)/i);
  if (!match) {
    return null;
  }

  return {
    power: Number(match[1]) || 0,
    toughness: Number(match[2]) || 0,
    duration: match[3] === "combat" ? "until-end-of-combat" : "until-end-of-turn",
  };
}

function hasCounterPlacementLanguage(normalizedText) {
  if (!normalizedText.includes("counter")) {
    return false;
  }

  return (
    /\bput\b|\bputs\b|\badd\b|\badds\b|\bdistribute\b|\bdistributes\b|\bmove\b|\bmoves\b/.test(normalizedText) ||
    /\benters\b.+\bwith\b.+\bcounters?\b/.test(normalizedText) ||
    /\bwith\b.+\bcounters?\b.+\bon\b/.test(normalizedText)
  );
}

function extractCounterTypeFromText(normalizedText) {
  if (normalizedText.includes("+1/+1 counter")) {
    return "+1/+1";
  }

  if (normalizedText.includes("-1/-1 counter")) {
    return "-1/-1";
  }

  const match = normalizedText.match(/([+\-]\d+\/[+\-]\d+|[a-z][a-z0-9+\/-]*(?:\s+[a-z][a-z0-9+\/-]*){0,2})\s+counters?\b/);
  if (!match) {
    return "Generic";
  }

  let candidate = match[1].trim();
  candidate = candidate
    .replace(/^(?:that\s+many|an?\s+additional|additional)\s+/i, "")
    .replace(/^(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+/i, "")
    .trim();

  if (!candidate) {
    return "Generic";
  }

  if (candidate === "+1/+1" || candidate === "-1/-1") {
    return candidate;
  }

  return candidate
    .split(/\s+/)
    .map((part) => `${part[0]?.toUpperCase() || ""}${part.slice(1)}`)
    .join(" ");
}

function hasSelfCounterTargetReference(text, cardName = "") {
  const normalizedText = normalizeMatcherText(text);
  if (!normalizedText) {
    return false;
  }

  if (normalizedText.includes("on it") || normalizedText.includes("on itself")) {
    return true;
  }

  const normalizedName = normalizeMatcherText(cardName);
  if (!normalizedName) {
    return false;
  }

  return normalizedText.includes(`on ${normalizedName}`) || normalizedText.includes(`onto ${normalizedName}`);
}

function normalizeMatcherText(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseStaticBuffRules(normalizedText) {
  const rules = [];
  const isTemporaryClause = (match) =>
    typeof match?.index === "number" &&
    normalizedText.slice(match.index, match.index + String(match[0] || "").length + 48).includes("until end of");

  const pushRule = (power, toughness, appliesTo, options = {}) => {
    rules.push({
      power: Number(power) || 0,
      toughness: Number(toughness) || 0,
      appliesTo,
      excludesSelf: Boolean(options.excludesSelf),
      creatureType: options.creatureType || "",
    });
  };

  const tribalPattern = /other ([a-z]+) creatures you control get ([+\-]\d+)\/([+\-]\d+)/gi;
  for (const match of normalizedText.matchAll(tribalPattern)) {
    if (isTemporaryClause(match)) {
      continue;
    }
    pushRule(match[2], match[3], "tribal-you-control", {
      excludesSelf: true,
      creatureType: capitalize(match[1]),
    });
  }

  const selfTribalPattern = /([a-z]+) creatures you control get ([+\-]\d+)\/([+\-]\d+)/gi;
  for (const match of normalizedText.matchAll(selfTribalPattern)) {
    const creatureTypeToken = String(match[1] || "").toLowerCase();
    if (
      creatureTypeToken === "other" ||
      creatureTypeToken === "all" ||
      creatureTypeToken === "attacking" ||
      creatureTypeToken === "blocking" ||
      creatureTypeToken === "artifact" ||
      creatureTypeToken === "token" ||
      creatureTypeToken === "creature"
    ) {
      continue;
    }
    const prefix = typeof match.index === "number" ? normalizedText.slice(0, match.index) : "";
    const precedingWord = (prefix.match(/([a-z]+)\s*$/i)?.[1] || "").toLowerCase();
    if (precedingWord === "other") {
      continue;
    }
    if (/other [a-z]+ creatures you control/.test(match[0])) {
      continue;
    }
    if (isTemporaryClause(match)) {
      continue;
    }
    pushRule(match[2], match[3], "tribal-you-control", {
      excludesSelf: false,
      creatureType: capitalize(match[1]),
    });
  }

  const ownPattern = /(?:other )?creatures you control get ([+\-]\d+)\/([+\-]\d+)/gi;
  for (const match of normalizedText.matchAll(ownPattern)) {
    if (isTemporaryClause(match)) {
      continue;
    }
    const prefix = typeof match.index === "number" ? normalizedText.slice(0, match.index) : "";
    const precedingWord = (prefix.match(/([a-z]+)\s*$/i)?.[1] || "").toLowerCase();
    if (precedingWord && precedingWord !== "other") {
      continue;
    }
    pushRule(match[1], match[2], "creatures-you-control", {
      excludesSelf: match[0].startsWith("other"),
    });
  }

  const allPattern = /all creatures get ([+\-]\d+)\/([+\-]\d+)/gi;
  for (const match of normalizedText.matchAll(allPattern)) {
    if (isTemporaryClause(match)) {
      continue;
    }
    pushRule(match[1], match[2], "all-creatures");
  }

  const opponentPattern = /creatures (?:your opponents|opponents) control get ([+\-]\d+)\/([+\-]\d+)/gi;
  for (const match of normalizedText.matchAll(opponentPattern)) {
    if (isTemporaryClause(match)) {
      continue;
    }
    pushRule(match[1], match[2], "opponent-creatures");
  }

  const tokenOwnPattern = /(?:other )?(?:creature )?tokens you control get ([+\-]\d+)\/([+\-]\d+)/gi;
  for (const match of normalizedText.matchAll(tokenOwnPattern)) {
    if (isTemporaryClause(match)) {
      continue;
    }
    pushRule(match[1], match[2], "token-creatures-you-control", {
      excludesSelf: match[0].startsWith("other"),
    });
  }

  const artifactCreatureOwnPattern = /(?:other )?artifact creatures you control get ([+\-]\d+)\/([+\-]\d+)/gi;
  for (const match of normalizedText.matchAll(artifactCreatureOwnPattern)) {
    if (isTemporaryClause(match)) {
      continue;
    }
    pushRule(match[1], match[2], "artifact-creatures-you-control", {
      excludesSelf: match[0].startsWith("other"),
    });
  }

  const attackingOwnPattern = /attacking creatures you control get ([+\-]\d+)\/([+\-]\d+)/gi;
  for (const match of normalizedText.matchAll(attackingOwnPattern)) {
    if (isTemporaryClause(match)) {
      continue;
    }
    pushRule(match[1], match[2], "attacking-creatures-you-control");
  }

  const attackingPattern = /attacking creatures get ([+\-]\d+)\/([+\-]\d+)/gi;
  for (const match of normalizedText.matchAll(attackingPattern)) {
    if (isTemporaryClause(match)) {
      continue;
    }
    pushRule(match[1], match[2], "attacking-creatures");
  }

  const blockingOwnPattern = /blocking creatures you control get ([+\-]\d+)\/([+\-]\d+)/gi;
  for (const match of normalizedText.matchAll(blockingOwnPattern)) {
    if (isTemporaryClause(match)) {
      continue;
    }
    pushRule(match[1], match[2], "blocking-creatures-you-control");
  }

  const blockingPattern = /blocking creatures get ([+\-]\d+)\/([+\-]\d+)/gi;
  for (const match of normalizedText.matchAll(blockingPattern)) {
    if (isTemporaryClause(match)) {
      continue;
    }
    pushRule(match[1], match[2], "blocking-creatures");
  }

  const equippedPattern = /equipped creature gets ([+\-]\d+)\/([+\-]\d+)/gi;
  for (const match of normalizedText.matchAll(equippedPattern)) {
    if (isTemporaryClause(match)) {
      continue;
    }
    pushRule(match[1], match[2], "equipped-creature");
  }

  const enchantedPattern = /enchanted creature gets ([+\-]\d+)\/([+\-]\d+)/gi;
  for (const match of normalizedText.matchAll(enchantedPattern)) {
    if (isTemporaryClause(match)) {
      continue;
    }
    pushRule(match[1], match[2], "enchanted-creature");
  }

  return rules;
}

function extractTokenSpec(normalizedText) {
  const ptMatch = normalizedText.match(/(\d+)\/(\d+)/);
  const typeMatch = normalizedText.match(
    /(?:create|creates?)\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:[a-z]+\s+){0,3}?([a-z]+)\s+creature token/i
  );

  return {
    power: ptMatch ? Number(ptMatch[1]) || 1 : 1,
    toughness: ptMatch ? Number(ptMatch[2]) || 1 : 1,
    name: typeMatch ? `${capitalize(typeMatch[1])} Token` : "Token",
  };
}

function extractCountFromText(normalizedText) {
  const digitMatch = normalizedText.match(/\b(\d+)\b/);
  if (digitMatch) {
    return Number(digitMatch[1]) || 1;
  }

  const wordCounts = {
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

  return Object.entries(wordCounts).find(([word]) => new RegExp(`\\b${word}\\b`).test(normalizedText))?.[1] || 1;
}

function extractCounterCountFromText(normalizedText) {
  const countTokenPattern =
    "(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\\d+)";
  const leadPattern = new RegExp(
    `(?:put|puts|add|adds|move|moves|distribute|distributes|with)\\s+${countTokenPattern}\\s+(?:[a-z0-9+\\/-]+\\s+){0,4}counters?\\b`,
    "i"
  );
  const leadMatch = normalizedText.match(leadPattern);
  if (leadMatch?.[1]) {
    return parseCountToken(leadMatch[1]);
  }

  return extractCountFromText(normalizedText);
}

function parseCountToken(token) {
  const normalizedToken = normalizeText(token).toLowerCase();
  if (!normalizedToken) {
    return 1;
  }

  if (/^\d+$/.test(normalizedToken)) {
    return Number(normalizedToken) || 1;
  }

  const wordCounts = {
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

  return wordCounts[normalizedToken] || 1;
}

function dedupeSuggestions(suggestions) {
  const seen = new Set();
  return suggestions.filter((suggestion) => {
    const key = [
      suggestion.sourceCardName,
      suggestion.triggerType,
      suggestion.phase,
      suggestion.eventType,
      suggestion.eventSourceScope,
      suggestion.actionType,
      suggestion.targetType,
      suggestion.counterType,
      suggestion.counterTargetEntity,
      suggestion.buffPower,
      suggestion.buffToughness,
      suggestion.buffDuration,
      suggestion.value,
      suggestion.tokenName,
      suggestion.tokenPower,
      suggestion.tokenToughness,
    ].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function capitalize(value) {
  const normalized = normalizeText(value);
  return normalized ? `${normalized[0].toUpperCase()}${normalized.slice(1)}` : "";
}
