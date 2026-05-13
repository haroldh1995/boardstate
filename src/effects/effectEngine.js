import { createPermanent } from "../state/schema.js";
import { createId, normalizeCount } from "../state/ids.js";
import { parseCardEffects } from "./effectParser.js";
import { getTargets } from "./targeting.js";

export function hydratePermanentEffects(permanent) {
  return createPermanent({
    ...permanent,
    parsedEffects: parseCardEffects(permanent),
  });
}

export function recalculateContinuousEffects(session) {
  const player = session.battlefield.player.map(resetComputedStats);
  const opponent = session.battlefield.opponent.map(resetComputedStats);
  const all = [...player, ...opponent];
  const staticSources = all.filter((permanent) => permanent.zone === "battlefield");

  const applyToSide = (side) =>
    side.map((permanent) => {
      let next = { ...permanent, keywords: [...new Set(permanent.keywords || [])] };
      staticSources.forEach((source) => {
        source.parsedEffects
          .filter((effect) => effect.kind === "static")
          .forEach((effect) => {
            if (!doesStaticEffectApply(session, source, effect, permanent)) {
              return;
            }
            if (effect.action === "modify-power-toughness" && permanent.isCreature) {
              next.currentPower += effect.power;
              next.currentToughness += effect.toughness;
            }
            if (effect.action === "grant-keywords") {
              next.keywords = [...new Set([...next.keywords, ...(effect.keywords || [])])];
            }
          });
      });
      return createPermanent(next);
    });

  return {
    ...session,
    battlefield: {
      ...session.battlefield,
      player: applyToSide(player),
      opponent: applyToSide(opponent),
    },
  };
}

export function processEventTriggers(session, event) {
  let nextSession = session;
  const sources = getAllPermanents(nextSession);
  sources.forEach((source) => {
    source.parsedEffects
      .filter((effect) => effect.kind === "trigger" && triggerMatches(effect, event, source))
      .forEach((effect) => {
        nextSession = resolveEffect(nextSession, effect, source, event);
      });
  });
  return recalculateContinuousEffects(nextSession);
}

export function resolveSpell(session, spell) {
  const source = hydratePermanentEffects({ ...spell, isInstant: spell.isInstant, isSorcery: spell.isSorcery });
  let nextSession = session;
  let resolved = 0;
  source.parsedEffects
    .filter((effect) => effect.kind === "spell")
    .forEach((effect) => {
      const before = JSON.stringify(nextSession);
      nextSession = resolveEffect(nextSession, effect, source, { type: "spell-cast", source });
      if (JSON.stringify(nextSession) !== before) {
        resolved += 1;
      }
    });

  return {
    ...recalculateContinuousEffects(nextSession),
    effectLog: [
      createLog(source.name, resolved > 0 ? "Spell resolved with supported automated effects." : "Spell logged for manual resolution."),
      ...nextSession.effectLog,
    ].slice(0, 60),
  };
}

export function resolveEffect(session, effect, source, event = {}) {
  if (effect.manual) {
    return {
      ...session,
      pendingEffects: [
        {
          id: createId("pending"),
          sourceId: source.id,
          sourceName: source.name,
          effect,
          status: "pending",
          createdAt: Date.now(),
        },
        ...session.pendingEffects,
      ].slice(0, 30),
    };
  }

  switch (effect.action) {
    case "create-token":
      return createTokens(session, effect, source, event);
    case "add-counters":
      return addCounters(session, effect, source, event);
    case "temporary-buff":
      return applyTemporaryBuff(session, effect, source);
    case "life":
      return {
        ...session,
        life: Math.max(0, session.life + effect.amount),
        effectLog: [createLog(source.name, `Life changed by ${effect.amount}.`), ...session.effectLog].slice(0, 60),
      };
    default:
      return session;
  }
}

function createTokens(session, effect, source, event) {
  const multiplier = getTokenMultiplier(session);
  const count = Math.max(1, normalizeCount(effect.count, 1)) * multiplier;
  const token = hydratePermanentEffects({
    name: effect.token.name,
    typeLine: effect.token.typeLine,
    basePower: effect.token.power,
    baseToughness: effect.token.toughness,
    quantity: count,
    isToken: true,
    controller: "player",
    owner: "player",
    tapped: effect.tapped || effect.attacking,
    attacking: effect.attacking,
    ownedByCommanderDeck: false,
  });

  const next = {
    ...session,
    battlefield: {
      ...session.battlefield,
      player: stackPermanent(session.battlefield.player, token),
    },
    combat: effect.attacking
      ? {
          ...session.combat,
          attackerIds: [...new Set([...(session.combat.attackerIds || []), token.id])],
        }
      : session.combat,
    effectLog: [createLog(source.name, `Created ${count} ${token.name}${effect.attacking ? " tapped and attacking" : ""}.`), ...session.effectLog].slice(0, 60),
  };

  return processEventTriggers(next, {
    type: "permanent-entered",
    permanent: token,
    instances: count,
    cause: event.type || "effect",
  });
}

function addCounters(session, effect, source, event) {
  const count = Math.max(1, normalizeCount(effect.count, 1)) * getCounterMultiplier(session);
  const repeats = Math.max(1, normalizeCount(event.instances, 1));
  const targets = getTargets(session, effect.target, source, event);
  const targetIds = new Set(targets.map((target) => target.id));

  const apply = (permanent) => {
    if (!targetIds.has(permanent.id)) {
      return permanent;
    }
    const current = normalizeCount(permanent.counters?.[effect.counterType]);
    return createPermanent({
      ...permanent,
      counters: {
        ...permanent.counters,
        [effect.counterType]: current + count * repeats,
      },
    });
  };

  return {
    ...session,
    battlefield: {
      ...session.battlefield,
      player: session.battlefield.player.map(apply),
      opponent: session.battlefield.opponent.map(apply),
    },
    effectLog: [createLog(source.name, `Added ${count * repeats} ${effect.counterType} counter(s) to ${targets.length} target(s).`), ...session.effectLog].slice(0, 60),
  };
}

function applyTemporaryBuff(session, effect, source) {
  const targets = getTargets(session, effect.target, source);
  const targetIds = new Set(targets.map((target) => target.id));
  const apply = (permanent) => {
    if (!targetIds.has(permanent.id)) {
      return permanent;
    }
    return createPermanent({
      ...permanent,
      temporaryModifiers: [
        ...(permanent.temporaryModifiers || []),
        {
          power: effect.power,
          toughness: effect.toughness,
          duration: effect.duration,
          sourceName: source.name,
        },
      ],
    });
  };

  return {
    ...session,
    battlefield: {
      ...session.battlefield,
      player: session.battlefield.player.map(apply),
      opponent: session.battlefield.opponent.map(apply),
    },
    effectLog: [createLog(source.name, `Applied ${effect.power}/${effect.toughness} temporary modifier.`), ...session.effectLog].slice(0, 60),
  };
}

function resetComputedStats(permanent) {
  const plus = normalizeCount(permanent.counters?.["+1/+1"]);
  const minus = normalizeCount(permanent.counters?.["-1/-1"]);
  const temporary = (permanent.temporaryModifiers || []).reduce(
    (sum, modifier) => {
      sum.power += Number(modifier.power) || 0;
      sum.toughness += Number(modifier.toughness) || 0;
      return sum;
    },
    { power: 0, toughness: 0 }
  );
  return createPermanent({
    ...permanent,
    currentPower: permanent.basePower + plus - minus + temporary.power,
    currentToughness: permanent.baseToughness + plus - minus + temporary.toughness,
  });
}

function doesStaticEffectApply(session, source, effect, permanent) {
  if (effect.target === "attached") {
    return source.attachedToId === permanent.id;
  }
  return getTargets(session, effect.target, source).some((target) => target.id === permanent.id);
}

function triggerMatches(effect, event, source) {
  if (effect.event === "self-entered") {
    return event.type === "permanent-entered" && event.permanent?.id === source.id;
  }
  if (effect.event === "creature-entered") {
    return event.type === "permanent-entered" && event.permanent?.isCreature;
  }
  if (effect.event === "attack") {
    return event.type === "attackers-declared";
  }
  if (effect.event === "dies") {
    return event.type === "permanent-died" && event.permanent?.isCreature;
  }
  if (effect.event?.startsWith("phase:")) {
    return event.type === "phase-changed" && effect.event === `phase:${event.phase}`;
  }
  return false;
}

function getTokenMultiplier(session) {
  return getAllPermanents(session).some((permanent) => permanent.parsedEffects?.some((effect) => effect.kind === "replacement" && effect.action === "double-tokens")) ? 2 : 1;
}

function getCounterMultiplier(session) {
  return getAllPermanents(session).some((permanent) => permanent.parsedEffects?.some((effect) => effect.kind === "replacement" && effect.action === "double-counters")) ? 2 : 1;
}

function stackPermanent(permanents, incoming) {
  const index = permanents.findIndex((permanent) => canStack(permanent, incoming));
  if (index < 0) {
    return [...permanents, incoming];
  }
  return permanents.map((permanent, permanentIndex) =>
    permanentIndex === index ? createPermanent({ ...permanent, quantity: permanent.quantity + incoming.quantity }) : permanent
  );
}

function canStack(left, right) {
  return left.isToken && right.isToken && permanentStackSignature(left) === permanentStackSignature(right);
}

function permanentStackSignature(permanent) {
  return JSON.stringify({
    name: permanent.name,
    cardId: permanent.cardId,
    typeLine: permanent.typeLine,
    oracleText: permanent.oracleText,
    controller: permanent.controller,
    owner: permanent.owner,
    basePower: permanent.basePower,
    baseToughness: permanent.baseToughness,
    counters: stableRecord(permanent.counters),
    keywords: [...(permanent.keywords || [])].sort(),
    tapped: permanent.tapped,
    summoningSick: permanent.summoningSick,
    attacking: permanent.attacking,
    blocking: permanent.blocking,
    attachedToId: permanent.attachedToId,
    temporaryModifiers: stableList(permanent.temporaryModifiers),
    isCopy: permanent.isCopy,
    isCommander: permanent.isCommander,
  });
}

function stableRecord(record = {}) {
  return Object.keys(record)
    .sort()
    .reduce((next, key) => {
      next[key] = record[key];
      return next;
    }, {});
}

function stableList(list = []) {
  return [...list].map((entry) => stableRecord(entry)).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function getAllPermanents(session) {
  return [...session.battlefield.player, ...session.battlefield.opponent];
}

function createLog(sourceName, summary) {
  return {
    id: createId("log"),
    at: Date.now(),
    sourceName,
    summary,
  };
}
