import { MANA_COLORS } from "../Models/GameModels.js";
import { createEmptyFloatingMana, normalizeFloatingMana, normalizePhaseKey } from "../Core/GameStateEngine.js";

export function applyFloatingManaDelta(floatingMana, color, delta) {
  const normalized = normalizeFloatingMana(floatingMana);
  if (!MANA_COLORS.includes(color)) {
    return normalized;
  }

  const next = { ...normalized };
  next[color] = Math.max(0, next[color] + Math.round(Number(delta) || 0));
  return next;
}

export function clearFloatingManaForPhase(floatingMana, phaseLabel, options = {}) {
  const normalized = normalizeFloatingMana(floatingMana);
  if (options.manaAutoClearEnabled === false) {
    return normalized;
  }

  if (options.persistThroughPhaseChange) {
    return normalized;
  }

  const previousPhase = normalizePhaseKey(options.previousPhaseLabel || "");
  const normalizedPhase = normalizePhaseKey(phaseLabel);
  if (!normalizedPhase || previousPhase === normalizedPhase) {
    return normalized;
  }

  return createEmptyFloatingMana();
}

export function getFloatingManaTotal(floatingMana) {
  const normalized = normalizeFloatingMana(floatingMana);
  return MANA_COLORS.reduce((sum, color) => sum + normalized[color], 0);
}

export function isFloatingManaEmpty(floatingMana) {
  return getFloatingManaTotal(floatingMana) === 0;
}
