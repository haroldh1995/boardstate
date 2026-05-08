export function applyTokenModifiersDetailed(baseQuantity, permanents = []) {
  let value = Math.max(0, Number(baseQuantity) || 0);
  const modifiers = [];

  permanents.forEach((permanent) => {
    if (!permanent?.doublesTokens) {
      return;
    }

    value *= 2;
    modifiers.push({
      source: permanent.name || "Token Doubler",
      summary: "doubled token creation",
    });
  });

  return {
    base: Math.max(0, Number(baseQuantity) || 0),
    value,
    modifiers,
  };
}

export function applyCounterModifiersDetailed(baseValue, permanents = []) {
  let value = Math.max(0, Number(baseValue) || 0);
  const modifiers = [];

  permanents.forEach((permanent) => {
    if (permanent?.doublesCounters) {
      value *= 2;
      modifiers.push({
        source: permanent.name || "Counter Doubler",
        summary: "doubled counter placement",
      });
    }

    const bonus = Number(permanent?.counterModifierBonus) || 0;
    if (bonus > 0) {
      value += bonus;
      modifiers.push({
        source: permanent.name || "Counter Modifier",
        summary: `added ${bonus} extra counter${bonus === 1 ? "" : "s"}`,
      });
    }
  });

  return {
    base: Math.max(0, Number(baseValue) || 0),
    value,
    modifiers,
  };
}

export function calculateStaticBuffs(permanent, permanents = []) {
  if (!permanent?.isCreature) {
    return { power: 0, toughness: 0, modifiers: [] };
  }

  let power = 0;
  let toughness = 0;
  const modifiers = [];

  permanents.forEach((source) => {
    const rules = getSourceStaticBuffRules(source);
    if (rules.length === 0) {
      return;
    }

    rules.forEach((rule) => {
      if (!doesStaticBuffRuleApplyToPermanent(rule, source, permanent)) {
        return;
      }

      power += rule.power;
      toughness += rule.toughness;
      modifiers.push({
        source: source.name || "Static Buff",
        power: rule.power,
        toughness: rule.toughness,
      });
    });
  });

  return { power, toughness, modifiers };
}

export function calculatePermanentPowerToughness(permanent, permanents = []) {
  const plusCounters = Number(permanent?.plusOneCounters) || 0;
  const minusCounters = Number(permanent?.minusOneCounters) || 0;
  const counters = plusCounters - minusCounters;
  const temporaryPower =
    (Number(permanent?.temporaryPowerUntilTurnEnd) || 0) +
    (Number(permanent?.temporaryPowerUntilCombatEnd) || 0);
  const temporaryToughness =
    (Number(permanent?.temporaryToughnessUntilTurnEnd) || 0) +
    (Number(permanent?.temporaryToughnessUntilCombatEnd) || 0);
  const buffs = calculateStaticBuffs(permanent, permanents);

  return {
    power: (Number(permanent?.power) || 0) + counters + buffs.power + temporaryPower,
    toughness: (Number(permanent?.toughness) || 0) + counters + buffs.toughness + temporaryToughness,
    modifiers: buffs.modifiers,
  };
}

function getSourceStaticBuffRules(source) {
  if (Array.isArray(source?.staticBuffRules) && source.staticBuffRules.length > 0) {
    return source.staticBuffRules
      .map((rule) => ({
        power: Number(rule?.power) || 0,
        toughness: Number(rule?.toughness) || 0,
        appliesTo: typeof rule?.appliesTo === "string" ? rule.appliesTo : "",
        excludesSelf: Boolean(rule?.excludesSelf),
        creatureType: typeof rule?.creatureType === "string" ? rule.creatureType.trim() : "",
      }))
      .filter((rule) => (rule.power !== 0 || rule.toughness !== 0) && rule.appliesTo);
  }

  const legacyPower = Number(source?.staticBuffPower) || 0;
  const legacyToughness = Number(source?.staticBuffToughness) || 0;
  const legacyAppliesTo = typeof source?.staticBuffAppliesTo === "string" ? source.staticBuffAppliesTo : "";
  if ((legacyPower !== 0 || legacyToughness !== 0) && legacyAppliesTo) {
    return [
      {
        power: legacyPower,
        toughness: legacyToughness,
        appliesTo: legacyAppliesTo,
        excludesSelf: Boolean(source?.staticBuffExcludesSelf),
        creatureType: "",
      },
    ];
  }

  return [];
}

function doesStaticBuffRuleApplyToPermanent(rule, source, permanent) {
  if (!permanent?.isCreature) {
    return false;
  }

  if (rule.excludesSelf && source?.id === permanent.id) {
    return false;
  }

  switch (rule.appliesTo) {
    case "creatures-you-control":
      return true;
    case "all-creatures":
      return true;
    case "opponent-creatures":
      return false;
    case "attacking-creatures":
    case "attacking-creatures-you-control":
      return Boolean(permanent?.isAttacking);
    case "blocking-creatures":
    case "blocking-creatures-you-control":
      return Boolean(permanent?.isBlocking);
    case "token-creatures-you-control":
      return Boolean(permanent?.isToken);
    case "artifact-creatures-you-control":
      return Boolean(permanent?.isArtifact);
    case "equipped-creature":
    case "enchanted-creature":
      return Boolean(source?.attachedToId) && source.attachedToId === permanent.id;
    case "tribal-you-control":
      return hasCreatureType(permanent, rule.creatureType);
    default:
      return false;
  }
}

function hasCreatureType(permanent, creatureType) {
  if (!creatureType) {
    return false;
  }

  const typeLine = String(permanent?.typeLine || "").toLowerCase();
  return new RegExp(`\\b${escapeRegExp(String(creatureType).toLowerCase())}\\b`, "i").test(typeLine);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function summarizeModifierList(modifiers = [], emptyLabel = "No modifiers applied.") {
  if (!Array.isArray(modifiers) || modifiers.length === 0) {
    return emptyLabel;
  }

  return modifiers.map((modifier) => `${modifier.source}: ${modifier.summary}`).join(" • ");
}
