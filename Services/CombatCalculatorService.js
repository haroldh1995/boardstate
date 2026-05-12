export function calculateCombatPreview({ attackers = [], blockers = [] }) {
  const attackerTotal = attackers.reduce(
    (accumulator, attacker) => {
      accumulator.power += normalizeNumber(attacker?.currentPower ?? attacker?.power);
      accumulator.toughness += normalizeNumber(attacker?.currentToughness ?? attacker?.toughness);
      return accumulator;
    },
    { power: 0, toughness: 0 }
  );

  const blockerTotal = blockers.reduce(
    (accumulator, blocker) => {
      accumulator.power += normalizeNumber(blocker?.currentPower ?? blocker?.power);
      accumulator.toughness += normalizeNumber(blocker?.currentToughness ?? blocker?.toughness);
      return accumulator;
    },
    { power: 0, toughness: 0 }
  );

  const trampleDamage = estimateTrampleOverflow(attackers, blockers);
  return {
    attackerTotal,
    blockerTotal,
    trampleDamage,
    netPressure: attackerTotal.power - blockerTotal.toughness,
  };
}

export function estimateTrampleOverflow(attackers = [], blockers = []) {
  const blockerToughness = blockers.reduce((sum, blocker) => sum + normalizeNumber(blocker?.currentToughness ?? blocker?.toughness), 0);
  const tramplePower = attackers
    .filter((attacker) => hasKeyword(attacker, "trample"))
    .reduce((sum, attacker) => sum + normalizeNumber(attacker?.currentPower ?? attacker?.power), 0);
  return Math.max(0, tramplePower - blockerToughness);
}

function hasKeyword(permanent, keyword) {
  const oracleText = String(permanent?.oracleText || "").toLowerCase();
  const keywords = Array.isArray(permanent?.keywords) ? permanent.keywords.map((entry) => String(entry).toLowerCase()) : [];
  return oracleText.includes(keyword) || keywords.includes(keyword);
}

function normalizeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}
