import { createId } from "../state/ids.js";

export function declareAttackers(session, attackerIds) {
  const legalIds = new Set(attackerIds);
  return {
    ...session,
    battlefield: {
      ...session.battlefield,
      player: session.battlefield.player.map((permanent) => {
        const attacking = legalIds.has(permanent.id) && permanent.isCreature;
        return {
          ...permanent,
          attacking,
          tapped: attacking && !hasKeyword(permanent, "vigilance") ? true : permanent.tapped,
        };
      }),
    },
    combat: {
      ...session.combat,
      step: "attackers",
      attackerIds: [...legalIds],
      lines: [...legalIds].map((id) => ({ id: createId("line"), attackerId: id, blockerIds: [] })),
    },
  };
}

export function assignBlocker(session, attackerId, blockerId) {
  const current = session.combat.blockersByAttacker[attackerId] || [];
  return {
    ...session,
    combat: {
      ...session.combat,
      step: "blockers",
      blockersByAttacker: {
        ...session.combat.blockersByAttacker,
        [attackerId]: [...new Set([...current, blockerId])],
      },
      lines: session.combat.lines.map((line) =>
        line.attackerId === attackerId ? { ...line, blockerIds: [...new Set([...line.blockerIds, blockerId])] } : line
      ),
    },
  };
}

export function calculateCombatDamage(session) {
  const attackers = session.battlefield.player.filter((permanent) => session.combat.attackerIds.includes(permanent.id));
  const opponentBlockers = session.battlefield.opponent;
  let total = 0;
  const details = [];

  attackers.forEach((attacker) => {
    const blockerIds = session.combat.blockersByAttacker[attacker.id] || [];
    const blockers = opponentBlockers.filter((blocker) => blockerIds.includes(blocker.id));
    const blockedToughness = blockers.reduce((sum, blocker) => sum + (blocker.currentToughness || blocker.baseToughness || 0), 0);
    const power = attacker.currentPower || attacker.basePower || 0;
    const damage = blockers.length === 0 ? power : hasKeyword(attacker, "trample") ? Math.max(0, power - blockedToughness) : 0;
    total += damage;
    details.push({ attackerId: attacker.id, attackerName: attacker.name, damage, blockedBy: blockers.map((blocker) => blocker.name) });
  });

  return {
    total,
    details,
  };
}

export function resolveCombat(session) {
  const preview = calculateCombatDamage(session);
  return {
    ...session,
    combat: {
      ...session.combat,
      step: "resolved",
      damagePreview: preview,
      resolvedDamage: preview.total,
    },
    effectLog: [
      {
        id: createId("combat"),
        at: Date.now(),
        sourceName: "Combat",
        summary: `Resolved ${preview.total} estimated combat damage.`,
      },
      ...session.effectLog,
    ],
  };
}

function hasKeyword(permanent, keyword) {
  return (permanent.keywords || []).map((entry) => entry.toLowerCase()).includes(keyword);
}
