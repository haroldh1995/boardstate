import { scoreAutomationRule } from "./rulesConfidenceScorer.js";
import { getRulesReferenceEntries } from "./rulesReferenceService.js";
import { findRelevantRuling } from "./scryfallRulingsService.js";

export function extractEffectMetadata(oracleText = "") {
  const normalized = normalizeText(oracleText).toLowerCase();
  const staticBuff = parseStaticBuff(normalized);

  return {
    doublesTokens:
      /(?:create|creates|creating).+twice that many|double the number of tokens|creates twice that many/i.test(normalized),
    doublesCounters:
      /one or more counters would be put|twice that many of those counters|double the number of each of those counters/i.test(normalized),
    counterModifierBonus: /that many plus one|plus an additional counter|additional \+1\/\+1 counter/i.test(normalized) ? 1 : 0,
    createsTokens: normalized.includes("create") && normalized.includes("token"),
    addsCounters: normalized.includes("counter"),
    staticBuffPower: staticBuff.power,
    staticBuffToughness: staticBuff.toughness,
    staticBuffAppliesTo: staticBuff.appliesTo,
    staticBuffExcludesSelf: staticBuff.excludesSelf,
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
      repeatBehavior: "per-event",
      reasonPrefix: `${permanent.name} has a dies trigger.`,
    });
  }

  if (/\bsacrific(?:e|ed|es)\b/.test(normalized) && /when|whenever/.test(normalized)) {
    appendActionSuggestions(suggestions, permanent, rulings, normalized, {
      triggerType: "OnSacrifice",
      eventType: "OnSacrifice",
      phase: "",
      repeatBehavior: "per-event",
      reasonPrefix: `${permanent.name} has a sacrifice trigger.`,
    });
  }

  if (/\bexile|exiled\b/.test(normalized) && /when|whenever/.test(normalized)) {
    appendActionSuggestions(suggestions, permanent, rulings, normalized, {
      triggerType: "OnExile",
      eventType: "OnExile",
      phase: "",
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

  if (normalizedText.includes("+1/+1 counter") || normalizedText.includes("+1/+1 counters")) {
    const targetProfile = inferCounterTargetProfile(normalizedText);
    suggestions.push(createSuggestion(permanent, {
      ...context,
      actionType: "Add +1/+1 Counters",
      targetType: targetProfile.targetType,
      value: extractCountFromText(normalizedText),
      counterType: "+1/+1",
      requiresTargetSelection: targetProfile.requiresTargetSelection,
      optionalTarget: targetProfile.optionalTarget,
      reasonSummary: `${context.reasonPrefix} It places +1/+1 counters in a supported way.`,
      evidenceSummary: "Oracle text explicitly places +1/+1 counters.",
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
    actionType: partialRule.actionType || "",
    targetType: partialRule.targetType || "All",
    value: Number.isFinite(Number(partialRule.value)) ? Number(partialRule.value) : 0,
    tokenName: partialRule.tokenName || "",
    tokenPower: Number.isFinite(Number(partialRule.tokenPower)) ? Number(partialRule.tokenPower) : 0,
    tokenToughness: Number.isFinite(Number(partialRule.tokenToughness)) ? Number(partialRule.tokenToughness) : 0,
    tokenManaCost: partialRule.tokenManaCost || "",
    counterType: partialRule.counterType || "",
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
  if (!normalizedText.includes("attack")) {
    return "";
  }

  if (normalizedText.includes("whenever one or more creatures attack")) {
    return "attack-group";
  }

  if (normalizedText.includes("whenever a creature attacks")) {
    return "attack-any";
  }

  if (normalizedText.includes("equipped creature attacks")) {
    return "attack-equipped";
  }

  if (normalizedText.includes("enchanted creature attacks")) {
    return "attack-enchanted";
  }

  if ((lowerName && normalizedText.includes(`${lowerName} attacks`)) || normalizedText.includes("this creature attacks")) {
    return "attack-self";
  }

  return "";
}

function inferCounterTargetProfile(normalizedText) {
  if (normalizedText.includes("on it") || normalizedText.includes("on itself")) {
    return { targetType: "Self", requiresTargetSelection: false, optionalTarget: false };
  }

  if (normalizedText.includes("each attacking creature") || normalizedText.includes("all attacking creatures")) {
    return { targetType: "All Attackers", requiresTargetSelection: false, optionalTarget: false };
  }

  if (normalizedText.includes("each creature you control") || normalizedText.includes("creatures you control")) {
    return { targetType: "All Creatures", requiresTargetSelection: false, optionalTarget: false };
  }

  if (normalizedText.includes("equipped creature") || normalizedText.includes("enchanted creature")) {
    return { targetType: "Attached Permanent", requiresTargetSelection: false, optionalTarget: false };
  }

  if (normalizedText.includes("another target creature")) {
    return { targetType: "Selected", requiresTargetSelection: true, optionalTarget: false };
  }

  if (normalizedText.includes("up to one target creature")) {
    return { targetType: "Selected", requiresTargetSelection: true, optionalTarget: true };
  }

  if (normalizedText.includes("target creature") || normalizedText.includes("target permanent")) {
    return { targetType: "Selected", requiresTargetSelection: true, optionalTarget: false };
  }

  return { targetType: "Board", requiresTargetSelection: false, optionalTarget: false };
}

function parseStaticBuff(normalizedText) {
  const otherMatch = normalizedText.match(/other creatures you control get \+(\d+)\/\+(\d+)/i);
  if (otherMatch) {
    return {
      power: Number(otherMatch[1]) || 0,
      toughness: Number(otherMatch[2]) || 0,
      appliesTo: "creatures-you-control",
      excludesSelf: true,
    };
  }

  const allMatch = normalizedText.match(/creatures you control get \+(\d+)\/\+(\d+)/i);
  if (allMatch) {
    return {
      power: Number(allMatch[1]) || 0,
      toughness: Number(allMatch[2]) || 0,
      appliesTo: "creatures-you-control",
      excludesSelf: false,
    };
  }

  return {
    power: 0,
    toughness: 0,
    appliesTo: "",
    excludesSelf: false,
  };
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

function dedupeSuggestions(suggestions) {
  const seen = new Set();
  return suggestions.filter((suggestion) => {
    const key = [
      suggestion.sourceCardName,
      suggestion.triggerType,
      suggestion.phase,
      suggestion.eventType,
      suggestion.actionType,
      suggestion.targetType,
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
