const MANA_COLORS = ["W", "U", "B", "R", "G", "C"];
const BASIC_LAND_MANA = {
  plains: "W",
  island: "U",
  swamp: "B",
  mountain: "R",
  forest: "G",
  wastes: "C",
};

export function getPermanentManaOptions(permanent = {}) {
  const name = String(permanent.name || "").trim().toLowerCase();
  if (BASIC_LAND_MANA[name]) {
    return [BASIC_LAND_MANA[name]];
  }

  const text = String(permanent.oracleText || permanent.rulesText || "");
  const lower = text.toLowerCase();
  const hasTapAbility = /\{t\}|\btap\b/.test(lower);
  const addsMana = /\badd\b/.test(lower) && (/\{[wubrgc]\}/i.test(text) || /\bmana\b/.test(lower));
  if (hasTapAbility && !addsMana) {
    return [];
  }
  if (/add one mana of any color|add one mana of any type|add a mana of any color/i.test(text)) {
    return ["W", "U", "B", "R", "G"];
  }

  const symbols = [...text.matchAll(/\{([WUBRGC])\}/gi)].map((match) => match[1].toUpperCase());
  if (addsMana && symbols.length) {
    return [...new Set(symbols)];
  }

  const identity = Array.isArray(permanent.colorIdentity)
    ? permanent.colorIdentity.filter((color) => MANA_COLORS.includes(color))
    : [];
  if (permanent.isLand && identity.length) {
    return [...new Set(identity)];
  }
  return permanent.isLand ? ["C"] : [];
}

export function parseManaRequirements(manaCost = "", xValue = 0) {
  const requirements = { generic: 0, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, ambiguous: false };
  for (const match of String(manaCost || "").matchAll(/\{([^}]+)\}/g)) {
    const symbol = match[1].toUpperCase();
    if (/^\d+$/.test(symbol)) {
      requirements.generic += Number(symbol);
    } else if (MANA_COLORS.includes(symbol)) {
      requirements[symbol] += 1;
    } else if (symbol === "X") {
      requirements.generic += Math.max(0, Number(xValue) || 0);
    } else {
      requirements.ambiguous = true;
    }
  }
  return requirements;
}

export function planManaPayment(session = {}, controller = "player", manaCost = "", xValue = 0) {
  const requirements = parseManaRequirements(manaCost, xValue);
  const side = controller === "player" || controller === "local-player" ? "player" : "opponent";
  if (requirements.ambiguous) {
    return { verified: false, sourceIds: [], poolAfter: { ...(session.manaPool || {}) }, reason: "ambiguous-cost" };
  }

  const poolAfter = side === "player" ? { ...(session.manaPool || {}) } : {};
  const sourceIds = [];
  const sources = (session.battlefield?.[side] || [])
    .filter((permanent) => permanent.controller === controller || side === "player")
    .filter((permanent) => !permanent.tapped)
    .flatMap((permanent) => {
      const options = getPermanentManaOptions(permanent);
      return Array.from({ length: Math.max(1, Number(permanent.quantity) || 1) }, () => ({
        id: permanent.id,
        options,
        basic: Boolean(BASIC_LAND_MANA[String(permanent.name || "").trim().toLowerCase()]),
      }));
    })
    .filter((source) => source.options.length);

  for (const color of MANA_COLORS) {
    let needed = requirements[color];
    const fromPool = Math.min(needed, Math.max(0, Number(poolAfter[color]) || 0));
    poolAfter[color] = Math.max(0, (Number(poolAfter[color]) || 0) - fromPool);
    needed -= fromPool;
    while (needed > 0) {
      const index = chooseSourceIndex(sources, color);
      if (index < 0) {
        return { verified: false, sourceIds: [], poolAfter: { ...(session.manaPool || {}) }, reason: `missing-${color}` };
      }
      sourceIds.push(sources[index].id);
      sources.splice(index, 1);
      needed -= 1;
    }
  }

  let generic = requirements.generic;
  for (const color of [...MANA_COLORS, "Generic"]) {
    const available = Math.max(0, Number(poolAfter[color]) || 0);
    const used = Math.min(generic, available);
    poolAfter[color] = available - used;
    generic -= used;
  }
  while (generic > 0) {
    const index = chooseSourceIndex(sources);
    if (index < 0) {
      return { verified: false, sourceIds: [], poolAfter: { ...(session.manaPool || {}) }, reason: "insufficient-mana" };
    }
    sourceIds.push(sources[index].id);
    sources.splice(index, 1);
    generic -= 1;
  }

  return { verified: true, sourceIds, poolAfter, reason: "" };
}

function chooseSourceIndex(sources, color = "") {
  const candidates = sources
    .map((source, index) => ({ source, index }))
    .filter(({ source }) => !color || source.options.includes(color))
    .sort((left, right) => {
      if (left.source.options.length !== right.source.options.length) {
        return left.source.options.length - right.source.options.length;
      }
      if (left.source.basic !== right.source.basic) {
        return left.source.basic ? -1 : 1;
      }
      return left.index - right.index;
    });
  return candidates[0]?.index ?? -1;
}
