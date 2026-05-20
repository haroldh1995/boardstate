import { createPermanent } from "../state/schema.js";
import { normalizeCount } from "../state/ids.js";
import { getTargets } from "./targeting.js";

export const EFFECT_LAYERS = [
  { index: 1, name: "copy" },
  { index: 2, name: "control" },
  { index: 3, name: "text" },
  { index: 4, name: "type" },
  { index: 5, name: "color" },
  { index: 6, name: "ability" },
  { index: 7, name: "powerToughnessBase" },
  { index: 8, name: "powerToughnessModifiers" },
  { index: 9, name: "counters" },
  { index: 10, name: "finalDisplay" },
];

export function createModifier(input = {}) {
  return {
    modifierId: input.modifierId || `${input.sourceId || "source"}:${input.layer || 8}:${input.timestamp || Date.now()}`,
    sourceId: input.sourceId || "",
    targetSelector: input.targetSelector || "self",
    timestamp: Number(input.timestamp) || Date.now(),
    duration: input.duration || "battlefield",
    layer: Number(input.layer) || 8,
    dependencies: Array.isArray(input.dependencies) ? input.dependencies : [],
    operation: input.operation || "none",
    amount: input.amount || 0,
    power: Number(input.power) || 0,
    toughness: Number(input.toughness) || 0,
    keywords: Array.isArray(input.keywords) ? input.keywords : [],
    color: input.color || "",
    setType: input.setType || "",
    setPower: Number.isFinite(Number(input.setPower)) ? Number(input.setPower) : null,
    setToughness: Number.isFinite(Number(input.setToughness)) ? Number(input.setToughness) : null,
    expiresOn: input.expiresOn || "",
    sourceName: input.sourceName || "",
  };
}

export function collectLayerModifiers(session) {
  const modifiers = [];
  const permanents = [...session.battlefield.player, ...session.battlefield.opponent];

  permanents.forEach((permanent) => {
    (permanent.temporaryModifiers || []).forEach((temporary, index) => {
      modifiers.push(
        createModifier({
          modifierId: `${permanent.id}:temp:${index}`,
          sourceId: permanent.id,
          sourceName: permanent.name,
          targetSelector: "self",
          layer: 8,
          operation: "add-pt",
          power: Number(temporary.power) || 0,
          toughness: Number(temporary.toughness) || 0,
          duration: temporary.duration || "turn",
        })
      );
    });

    Object.entries(permanent.counters || {}).forEach(([counterType, value]) => {
      if (!Number(value)) {
        return;
      }
      if (counterType === "+1/+1" || counterType === "-1/-1") {
        const sign = counterType === "+1/+1" ? 1 : -1;
        modifiers.push(
          createModifier({
            modifierId: `${permanent.id}:counter:${counterType}`,
            sourceId: permanent.id,
            sourceName: permanent.name,
            targetSelector: "self",
            layer: 9,
            operation: "add-pt",
            power: sign * normalizeCount(value),
            toughness: sign * normalizeCount(value),
            duration: "battlefield",
          })
        );
      }
    });

    (permanent.parsedEffects || []).forEach((effect, index) => {
      if (effect.kind !== "static") {
        return;
      }
      if (effect.action === "modify-power-toughness") {
        modifiers.push(
          createModifier({
            modifierId: `${permanent.id}:static:${index}`,
            sourceId: permanent.id,
            sourceName: permanent.name,
            targetSelector: effect.target || "all-creatures",
            layer: 8,
            operation: "add-pt",
            power: Number(effect.power) || 0,
            toughness: Number(effect.toughness) || 0,
            duration: "battlefield",
          })
        );
      }
      if (effect.action === "grant-keywords") {
        modifiers.push(
          createModifier({
            modifierId: `${permanent.id}:keywords:${index}`,
            sourceId: permanent.id,
            sourceName: permanent.name,
            targetSelector: effect.target || "self",
            layer: 6,
            operation: "add-keywords",
            keywords: effect.keywords || [],
            duration: "battlefield",
          })
        );
      }
    });

    (permanent.continuousEffects || []).forEach((effect, index) => {
      const layer = Number(effect.layer) || 8;
      modifiers.push(
        createModifier({
          modifierId: `${permanent.id}:continuous:${index}`,
          sourceId: permanent.id,
          sourceName: permanent.name,
          targetSelector: effect.targetSelector || "self",
          layer,
          operation: effect.operation || "none",
          dependencies: effect.dependencies || [],
          duration: effect.duration || "battlefield",
          power: effect.power,
          toughness: effect.toughness,
          keywords: effect.keywords,
          setType: effect.setType,
          setPower: effect.setPower,
          setToughness: effect.setToughness,
          color: effect.color,
        })
      );
    });
  });

  return modifiers.sort((left, right) => left.layer - right.layer || left.timestamp - right.timestamp);
}

export function applyLayerSystem(session) {
  const modifiers = collectLayerModifiers(session);
  const applyToSide = (side) => side.map((permanent) => applyModifiersToPermanent(session, permanent, modifiers));
  return {
    ...session,
    layerContext: {
      modifiers,
      updatedAt: Date.now(),
    },
    battlefield: {
      ...session.battlefield,
      player: applyToSide(session.battlefield.player),
      opponent: applyToSide(session.battlefield.opponent),
    },
  };
}

function applyModifiersToPermanent(session, permanent, modifiers) {
  let next = createPermanent({
    ...permanent,
    currentPower: permanent.basePower,
    currentToughness: permanent.baseToughness,
    keywords: [...new Set(permanent.keywords || [])],
  });
  const layerBreakdown = [];

  modifiers.forEach((modifier) => {
    if (!modifierTargetsPermanent(session, modifier, permanent)) {
      return;
    }
    const beforePower = next.currentPower;
    const beforeToughness = next.currentToughness;
    const beforeKeywords = new Set(next.keywords || []);

    if (modifier.layer === 4 && modifier.operation === "set-type" && modifier.setType) {
      next.typeLine = modifier.setType;
    }
    if (modifier.layer === 5 && modifier.operation === "set-color" && modifier.color) {
      next.colors = [modifier.color];
    }
    if (modifier.layer === 6 && modifier.operation === "add-keywords" && modifier.keywords?.length) {
      next.keywords = [...new Set([...(next.keywords || []), ...modifier.keywords])];
    }
    if (modifier.layer === 7 && modifier.operation === "set-base-pt") {
      if (Number.isFinite(modifier.setPower)) {
        next.currentPower = modifier.setPower;
      }
      if (Number.isFinite(modifier.setToughness)) {
        next.currentToughness = modifier.setToughness;
      }
    }
    if ((modifier.layer === 8 || modifier.layer === 9) && modifier.operation === "add-pt") {
      next.currentPower += Number(modifier.power) || 0;
      next.currentToughness += Number(modifier.toughness) || 0;
    }

    const keywordDelta = [...(next.keywords || [])].filter((keyword) => !beforeKeywords.has(keyword));
    if (
      beforePower !== next.currentPower ||
      beforeToughness !== next.currentToughness ||
      keywordDelta.length ||
      modifier.layer <= 6
    ) {
      layerBreakdown.push({
        layer: modifier.layer,
        modifierId: modifier.modifierId,
        sourceId: modifier.sourceId,
        sourceName: modifier.sourceName,
        operation: modifier.operation,
        powerDelta: next.currentPower - beforePower,
        toughnessDelta: next.currentToughness - beforeToughness,
        keywordDelta,
      });
    }
  });

  return createPermanent({
    ...next,
    layerBreakdown,
    currentPower: Number.isFinite(next.currentPower) ? next.currentPower : permanent.basePower,
    currentToughness: Number.isFinite(next.currentToughness) ? next.currentToughness : permanent.baseToughness,
  });
}

function modifierTargetsPermanent(session, modifier, permanent) {
  if (modifier.targetSelector === "self") {
    return modifier.sourceId === permanent.id;
  }
  const source = getPermanentById(session, modifier.sourceId);
  if (!source) {
    return false;
  }
  return getTargets(session, modifier.targetSelector, source).some((target) => target.id === permanent.id);
}

function getPermanentById(session, id) {
  return [...session.battlefield.player, ...session.battlefield.opponent].find((permanent) => permanent.id === id) || null;
}
