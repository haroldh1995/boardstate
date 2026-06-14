import { createId } from "../state/ids.js";
import { createPermanent } from "../state/schema.js";

export function declareAttackers(session, attackerIds, options = {}) {
  const legalIds = new Set(
    (attackerIds || []).filter((id) => {
      const permanent = session.battlefield.player.find((entry) => entry.id === id);
      return permanent?.isCreature && !permanent.tapped;
    })
  );
  const defendingPlayerId = options.defendingPlayerId || "opponent";
  const attackTargetsByAttacker = Object.fromEntries([...legalIds].map((id) => [id, options.attackTargetsByAttacker?.[id] || defendingPlayerId]));
  return {
    ...session,
    battlefield: {
      ...session.battlefield,
      player: session.battlefield.player.map((permanent) => {
        const attacking = legalIds.has(permanent.id);
        return createPermanent({
          ...permanent,
          attacking,
          attackedObjectId: attacking ? attackTargetsByAttacker[permanent.id] : permanent.attackedObjectId,
          tapped: attacking && !hasKeyword(permanent, "vigilance") ? true : permanent.tapped,
        });
      }),
      opponent: session.battlefield.opponent.map((permanent) => createPermanent({ ...permanent, blocking: false })),
    },
    combat: {
      ...session.combat,
      step: legalIds.size ? "declare-blockers" : "idle",
      attackingPlayerId: options.attackingPlayerId || "local-player",
      defendingPlayerId,
      attackerIds: [...legalIds],
      attackTargetsByAttacker,
      blockersByAttacker: {},
      damagePreview: null,
      resolvedDamage: 0,
      lines: [...legalIds].map((id) => ({ id: createId("line"), attackerId: id, blockerIds: [] })),
    },
  };
}

export function canBlock(attacker, blocker) {
  if (!attacker?.isCreature || !blocker?.isCreature || blocker.tapped) return false;
  const attackerText = String(attacker.oracleText || "").toLowerCase();
  const blockerText = String(blocker.oracleText || "").toLowerCase();
  if (/\bcan't be blocked\b|\bunblockable\b/.test(attackerText) || /\bcan't block\b/.test(blockerText)) return false;
  if (hasKeyword(attacker, "flying") && !hasKeyword(blocker, "flying") && !hasKeyword(blocker, "reach")) return false;
  return true;
}

export function assignBlocker(session, attackerId, blockerId) {
  const attacker = session.battlefield.player.find((entry) => entry.id === attackerId);
  const blocker = session.battlefield.opponent.find((entry) => entry.id === blockerId);
  if (!canBlock(attacker, blocker)) return session;
  const nextAssignments = Object.fromEntries(
    Object.entries(session.combat.blockersByAttacker || {}).map(([id, blockers]) => [id, blockers.filter((entry) => entry !== blockerId)])
  );
  const current = nextAssignments[attackerId] || [];
  nextAssignments[attackerId] = current.includes(blockerId) ? current.filter((entry) => entry !== blockerId) : [...current, blockerId];
  const assignedIds = new Set(Object.values(nextAssignments).flat());
  return {
    ...session,
    battlefield: {
      ...session.battlefield,
      opponent: session.battlefield.opponent.map((permanent) => createPermanent({ ...permanent, blocking: assignedIds.has(permanent.id) })),
    },
    combat: {
      ...session.combat,
      step: "declare-blockers",
      blockersByAttacker: nextAssignments,
      lines: (session.combat.lines || []).map((line) => ({ ...line, blockerIds: nextAssignments[line.attackerId] || [] })),
    },
  };
}

export function declareNoBlockers(session) {
  return {
    ...session,
    battlefield: {
      ...session.battlefield,
      opponent: session.battlefield.opponent.map((permanent) => createPermanent({ ...permanent, blocking: false })),
    },
    combat: { ...session.combat, step: "damage", blockersByAttacker: {}, lines: (session.combat.lines || []).map((line) => ({ ...line, blockerIds: [] })) },
  };
}

export function confirmBlockers(session) {
  const invalidMenace = (session.battlefield.player || []).find((attacker) => {
    if (!(session.combat.attackerIds || []).includes(attacker.id) || !hasKeyword(attacker, "menace")) return false;
    const count = (session.combat.blockersByAttacker?.[attacker.id] || []).length;
    return count === 1;
  });
  if (invalidMenace) {
    return {
      ...session,
      recoveryLog: [
        {
          id: createId("combat-warning"),
          source: "Combat",
          message: `${invalidMenace.name} has menace and must be blocked by two or more creatures.`,
          severity: "warning",
          timestamp: Date.now(),
          dismissed: false,
        },
        ...(session.recoveryLog || []),
      ].slice(0, 80),
    };
  }
  return { ...session, combat: { ...session.combat, step: "damage" } };
}

export function autoAssignBlockers(session) {
  let next = session;
  const available = (session.battlefield.opponent || [])
    .filter((blocker) => blocker.isCreature && !blocker.tapped)
    .sort((left, right) => getToughness(right) - getToughness(left));
  const used = new Set();
  const attackers = (session.battlefield.player || [])
    .filter((attacker) => (session.combat.attackerIds || []).includes(attacker.id))
    .sort((left, right) => getPower(right) - getPower(left));
  attackers.forEach((attacker) => {
    const required = hasKeyword(attacker, "menace") ? 2 : 1;
    available
      .filter((candidate) => !used.has(candidate.id) && canBlock(attacker, candidate))
      .slice(0, required)
      .forEach((blocker) => {
        used.add(blocker.id);
        next = assignBlocker(next, attacker.id, blocker.id);
      });
  });
  return { ...next, combat: { ...next.combat, step: "damage" } };
}

export function calculateCombatDamage(session) {
  const attackers = session.battlefield.player.filter((permanent) => session.combat.attackerIds.includes(permanent.id));
  const blockers = session.battlefield.opponent;
  let total = 0;
  const details = [];
  attackers.forEach((attacker) => {
    const assigned = blockers.filter((blocker) => (session.combat.blockersByAttacker[attacker.id] || []).includes(blocker.id));
    const blockerToughness = assigned.reduce((sum, blocker) => sum + getToughness(blocker), 0);
    const power = getPower(attacker);
    const damage = assigned.length === 0 ? power : hasKeyword(attacker, "trample") ? Math.max(0, power - blockerToughness) : 0;
    total += damage;
    details.push({
      attackerId: attacker.id,
      attackerName: attacker.name,
      targetId: session.combat.attackTargetsByAttacker?.[attacker.id] || session.combat.defendingPlayerId || "opponent",
      damage,
      blockedBy: assigned.map((blocker) => blocker.name),
      blockerIds: assigned.map((blocker) => blocker.id),
    });
  });
  return { total, details };
}

export function resolveCombat(session) {
  const preview = calculateCombatDamage(session);
  const damageToAttacker = new Map();
  const damageToBlocker = new Map();
  preview.details.forEach((detail) => {
    const attacker = session.battlefield.player.find((entry) => entry.id === detail.attackerId);
    const assigned = session.battlefield.opponent.filter((entry) => detail.blockerIds.includes(entry.id));
    damageToAttacker.set(detail.attackerId, assigned.reduce((sum, blocker) => sum + getPower(blocker), 0));
    let remaining = getPower(attacker);
    assigned.forEach((blocker) => {
      const assignedDamage = Math.max(0, Math.min(remaining, getToughness(blocker)));
      damageToBlocker.set(blocker.id, assignedDamage);
      remaining -= assignedDamage;
    });
  });
  const markAndKeepAlive = (permanent, damage) => {
    const markedDamage = Math.max(0, Number(permanent.markedDamage || 0) + damage);
    const lethal = permanent.isCreature && markedDamage >= getToughness(permanent);
    if (lethal || (damage > 0 && hasKeywordSource(damageToAttacker, damageToBlocker, permanent, session, "deathtouch"))) return null;
    return createPermanent({ ...permanent, markedDamage, attacking: false, blocking: false });
  };
  const nextPlayer = session.battlefield.player.map((permanent) => markAndKeepAlive(permanent, damageToAttacker.get(permanent.id) || 0)).filter(Boolean);
  const survivingPlayerIds = new Set(nextPlayer.map((permanent) => permanent.id));
  const playerCasualties = session.battlefield.player.filter((permanent) => !survivingPlayerIds.has(permanent.id));
  const targets = preview.details.reduce((record, detail) => {
    record[detail.targetId] = (record[detail.targetId] || 0) + detail.damage;
    return record;
  }, {});
  const nextOpponent = session.battlefield.opponent
    .map((permanent) => markAndKeepAlive(permanent, damageToBlocker.get(permanent.id) || 0))
    .filter(Boolean)
    .map((permanent) => {
      const combatDamage = Math.max(0, Number(targets[permanent.id] || 0));
      if (!combatDamage) return permanent;
      if (permanent.isPlaneswalker) {
        return createPermanent({
          ...permanent,
          counters: { ...(permanent.counters || {}), Loyalty: Math.max(0, Number(permanent.counters?.Loyalty || 0) - combatDamage) },
        });
      }
      if (/\bBattle\b/i.test(permanent.typeLine || "")) {
        return createPermanent({
          ...permanent,
          counters: { ...(permanent.counters || {}), Defense: Math.max(0, Number(permanent.counters?.Defense || 0) - combatDamage) },
        });
      }
      return permanent;
    })
    .filter((permanent) => !permanent.isPlaneswalker || Number(permanent.counters?.Loyalty || 0) > 0)
    .filter((permanent) => !/\bBattle\b/i.test(permanent.typeLine || "") || Number(permanent.counters?.Defense || 0) > 0);
  let nextLife = session.life;
  if (targets["local-player"]) nextLife = Math.max(0, nextLife - targets["local-player"]);
  return {
    ...session,
    life: nextLife,
    battlefield: { ...session.battlefield, player: nextPlayer, opponent: nextOpponent },
    zones: {
      ...session.zones,
      graveyard: [
        ...(session.zones?.graveyard || []),
        ...playerCasualties.map((permanent) => ({ ...permanent, zone: "graveyard", attacking: false, blocking: false })),
      ],
    },
    combat: { ...session.combat, step: "resolved", damagePreview: preview, resolvedDamage: preview.total },
    effectLog: [
      { id: createId("combat"), at: Date.now(), sourceName: "Combat", summary: `Resolved ${preview.total} unblocked or trample combat damage.` },
      ...session.effectLog,
    ].slice(0, 120),
  };
}

function hasKeywordSource(attackerDamage, blockerDamage, permanent, session, keyword) {
  if (attackerDamage.has(permanent.id)) {
    return (session.battlefield.opponent || []).some((blocker) =>
      (session.combat.blockersByAttacker?.[permanent.id] || []).includes(blocker.id) && hasKeyword(blocker, keyword)
    );
  }
  if (blockerDamage.has(permanent.id)) {
    return (session.battlefield.player || []).some((attacker) =>
      (session.combat.blockersByAttacker?.[attacker.id] || []).includes(permanent.id) && hasKeyword(attacker, keyword)
    );
  }
  return false;
}

function getPower(permanent = {}) {
  return Math.max(0, Number(permanent.currentPower ?? permanent.basePower ?? 0));
}

function getToughness(permanent = {}) {
  return Math.max(0, Number(permanent.currentToughness ?? permanent.baseToughness ?? 0));
}

function hasKeyword(permanent, keyword) {
  return (permanent?.keywords || []).map((entry) => String(entry).toLowerCase()).includes(keyword);
}
