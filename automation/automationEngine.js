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
    const buffPower = Number(source?.staticBuffPower) || 0;
    const buffToughness = Number(source?.staticBuffToughness) || 0;
    if (buffPower === 0 && buffToughness === 0) {
      return;
    }

    if (source?.staticBuffAppliesTo !== "creatures-you-control") {
      return;
    }

    if (source?.staticBuffExcludesSelf && source.id === permanent.id) {
      return;
    }

    power += buffPower;
    toughness += buffToughness;
    modifiers.push({
      source: source.name || "Static Buff",
      power: buffPower,
      toughness: buffToughness,
    });
  });

  return { power, toughness, modifiers };
}

export function calculatePermanentPowerToughness(permanent, permanents = []) {
  const counters = Number(permanent?.plusOneCounters) || 0;
  const buffs = calculateStaticBuffs(permanent, permanents);

  return {
    power: (Number(permanent?.power) || 0) + counters + buffs.power,
    toughness: (Number(permanent?.toughness) || 0) + counters + buffs.toughness,
    modifiers: buffs.modifiers,
  };
}

export function summarizeModifierList(modifiers = [], emptyLabel = "No modifiers applied.") {
  if (!Array.isArray(modifiers) || modifiers.length === 0) {
    return emptyLabel;
  }

  return modifiers.map((modifier) => `${modifier.source}: ${modifier.summary}`).join(" • ");
}
