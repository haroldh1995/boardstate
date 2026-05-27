import { createPermanent } from "../state/schema.js";
import { createId, normalizeCount } from "../state/ids.js";
import { parseCardEffects } from "./effectParser.js";
import { getTargets } from "./targeting.js";
import { applyLayerSystem } from "./layerSystem.js";
import { createCardDefinition } from "./cardDefinition.js";
import { RULES_CONFIDENCE } from "../support/debugExport.js";

export function hydratePermanentEffects(permanent) {
  const definition = createCardDefinition(permanent);
  return createPermanent({
    ...permanent,
    ...definition,
    manaValue: definition.manaValue,
    rulesText: definition.rulesText,
    flavorText: definition.flavorText,
    staticAbilities: definition.staticAbilities,
    activatedAbilities: definition.activatedAbilities,
    triggeredAbilities: definition.triggeredAbilities,
    replacementEffects: definition.replacementEffects,
    continuousEffects: definition.continuousEffects,
    tokenDefinitions: definition.tokenDefinitions,
    metadata: definition.metadata,
    relationships: definition.relationships,
    tags: definition.tags,
    parsedEffects: definition.parsedEffects || parseCardEffects(permanent),
  });
}

export function recalculateContinuousEffects(session) {
  const resetSession = {
    ...session,
    battlefield: {
      ...session.battlefield,
      player: session.battlefield.player.map(resetComputedStats),
      opponent: session.battlefield.opponent.map(resetComputedStats),
    },
  };
  return applyLayerSystem(resetSession);
}

export function processEventTriggers(session, event) {
  let nextSession = session;
  const normalizedEvent = normalizeTriggerEvent(event);
  const chainId = normalizedEvent.chainId || createId("chain");
  nextSession = appendDebugTrace(nextSession, "event-emitted", {
    eventType: normalizedEvent.eventType || "",
    chainId,
    sourceId: normalizedEvent.payload?.permanent?.id || "",
    instances: normalizedEvent.payload?.instances || normalizedEvent.instances || 1,
  });
  const sources = getAllPermanents(nextSession);
  let triggerTouched = false;
  sources.forEach((source) => {
    const structuredTriggers = source.triggeredAbilities || [];
    structuredTriggers
      .filter((trigger) => triggerMatchesStructured(trigger, normalizedEvent, source, nextSession))
      .forEach((trigger) => {
        nextSession = appendDebugTrace(nextSession, "trigger-detected", {
          source: source.name,
          sourceId: source.id,
          eventType: normalizedEvent.eventType || "",
          condition: trigger.condition || "",
        });
        const normalizedEffects = (trigger.effectDefinitions || []).map((effectDefinition) => ({
          ...effectDefinition,
          manual: Boolean(effectDefinition.manual || trigger.optional),
          sourceId: source.id,
          sourceName: source.name,
        }));
        const repeatCount = getTriggerRepeatCount(nextSession, trigger, normalizedEvent, source);
        for (let repeatIndex = 0; repeatIndex < repeatCount; repeatIndex += 1) {
          nextSession = enqueueTrigger(nextSession, {
            source,
            event: normalizedEvent,
            chainId,
            optional: Boolean(trigger.optional),
            oncePerTurn: Boolean(trigger.oncePerTurn),
            targetSelector: trigger.targetSelector || "all-creatures",
            effectDefinitions: normalizedEffects,
            triggerCondition: trigger.condition || "",
          });
          triggerTouched = true;
          nextSession = appendDebugTrace(nextSession, "trigger-queued", {
            source: source.name,
            triggerId: nextSession.triggerQueue[0]?.id || "",
            eventType: normalizedEvent.eventType || "",
            repeat: repeatIndex + 1,
            repeats: repeatCount,
          });
          if (normalizedEffects.every((effectDefinition) => shouldAutoResolveTrigger(effectDefinition, nextSession))) {
            nextSession = resolveQueuedTrigger(nextSession, {
              triggerId: nextSession.triggerQueue[0]?.id,
              command: "resolve",
              requestedBy: "auto",
            });
            triggerTouched = true;
          }
        }
      });
  });
  if (triggerTouched || eventAffectsBattlefield(event)) {
    return recalculateContinuousEffects(nextSession);
  }
  return nextSession;
}

export function resolveQueuedTrigger(session, { triggerId, command = "resolve", requestedBy = "player" } = {}) {
  const queue = [...(session.triggerQueue || [])];
  const index = queue.findIndex((entry) => entry.id === triggerId);
  if (index < 0) {
    return session;
  }
  const entry = queue[index];
  if (command === "skip") {
    queue[index] = {
      ...entry,
      status: "skipped",
      rulesConfidence: RULES_CONFIDENCE.NEEDS_REVIEW,
      resolvedAt: Date.now(),
      resolution: { command, requestedBy },
    };
    return { ...session, triggerQueue: queue };
  }
  if (command === "delay") {
    queue[index] = {
      ...entry,
      status: "delayed",
      rulesConfidence: RULES_CONFIDENCE.NEEDS_REVIEW,
      delayedUntilTurn: session.turn + 1,
      delayedUntilPhase: (session.phaseIndex + 1) % 5,
      resolution: { command, requestedBy },
    };
    return { ...session, triggerQueue: queue };
  }

  const source = getAllPermanents(session).find((permanent) => permanent.id === entry.sourceId) || createPermanent({ id: entry.sourceId, name: entry.sourceName });
  let resolvedSession = { ...session, triggerQueue: queue };
  (entry.effectDefinitions || []).forEach((effectDefinition) => {
    const currentSource = getAllPermanents(resolvedSession).find((permanent) => permanent.id === entry.sourceId) || source;
    resolvedSession = resolveEffect(resolvedSession, effectDefinition, currentSource, {
      type: entry.eventType?.toLowerCase() || "trigger",
      eventType: entry.eventType,
      payload: {
        ...(entry.eventPayload || {}),
        triggerId: entry.id,
      },
      triggerId: entry.id,
      chainId: entry.chainId,
    });
  });

  const generatedModifiers = collectModifierPreview(resolvedSession, source.id);
  const nextQueue = [...(resolvedSession.triggerQueue || [])];
  const nextIndex = nextQueue.findIndex((queueEntry) => queueEntry.id === entry.id);
  if (nextIndex >= 0) {
    nextQueue[nextIndex] = {
      ...nextQueue[nextIndex],
      status: "resolved",
      rulesConfidence: RULES_CONFIDENCE.AUTO_RESOLVED,
      resolvedAt: Date.now(),
      generatedModifiers,
      resolution: { command, requestedBy },
    };
  }

  const finalized = recalculateContinuousEffects({
    ...resolvedSession,
    triggerQueue: nextQueue,
  });
  const battlefieldCount =
    finalized.battlefield.player.reduce((sum, permanent) => sum + (permanent.quantity || 1), 0) +
    finalized.battlefield.opponent.reduce((sum, permanent) => sum + (permanent.quantity || 1), 0);
  return appendDebugTrace(finalized, "trigger-resolved", {
    triggerId: entry.id,
    source: source.name,
    queueStatus: "resolved",
    battlefieldCount,
    life: finalized.life,
    opponentDamage: finalized.commander?.damageByOpponent?.opponent || 0,
  });
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
    const pendingEntry = {
      id: createId("pending"),
      sourceId: source.id,
      sourceName: source.name,
      effect,
      summary: effect.summary || effect.reason || "Manual choice required",
      status: "pending",
      rulesConfidence: RULES_CONFIDENCE.MANUAL_CHOICE,
      createdAt: Date.now(),
      triggerId: event.payload?.triggerId || event.triggerId || "",
      eventType: event.eventType || event.type || "",
    };
    return {
      ...session,
      pendingEffects: [pendingEntry, ...session.pendingEffects].slice(0, 60),
      effectLog: [
        createLog(source.name, `Manual choice required: ${effect.summary || effect.reason || effect.action || "effect"}.`, RULES_CONFIDENCE.MANUAL_CHOICE),
        ...session.effectLog,
      ].slice(0, 80),
    };
  }

  switch (effect.action) {
    case "create-token":
      return createTokens(session, effect, source, event);
    case "add-counters":
      return addCounters(session, effect, source, event);
    case "double-counters":
      return doubleCounters(session, effect, source, event);
    case "temporary-buff":
      return applyTemporaryBuff(session, effect, source);
    case "life":
      return applyLifeEffect(session, effect, source, event);
    case "damage":
      return applyDamageEffect(session, effect, source, event);
    default:
      return queueUnsupportedEffect(session, effect, source, event);
  }
}

function createTokens(session, effect, source, event) {
  const controller = effect.controller || source.controller || "player";
  const repeats = Math.max(1, normalizeCount(event.payload?.instances ?? event.instances, 1));
  const replacementCount = getReplacementEffects(session, controller, "double-tokens").length;
  const multiplier = getTokenMultiplierForController(session, controller);
  const baseCount = normalizeCount(resolveTokenCount(session, effect, source), 0);
  const count = Math.max(0, baseCount * multiplier * repeats);
  if (count <= 0) {
    return appendDebugTrace(session, "tokens-created", {
      source: source.name,
      token: effect.token?.name || "Token",
      count: 0,
      controller,
      multiplier,
      replacementCount,
      repeats,
      skipped: "zero-count",
    });
  }
  const shouldCopySelf =
    Boolean(effect.copySelf) &&
    (!effect.copySelfAtLandCount || countLands(session, controller) >= Number(effect.copySelfAtLandCount || 0));
  const tokenBase = shouldCopySelf
    ? createCopyTokenFromSource(source, controller, effect)
    : {
        name: effect.token?.name || "Token",
        typeLine: effect.token?.typeLine || "Token Creature",
        basePower: effect.token?.power,
        baseToughness: effect.token?.toughness,
        oracleText: effect.token?.oracleText || "",
      };
  const token = hydratePermanentEffects({
    ...tokenBase,
    quantity: count,
    isToken: true,
    isCopy: shouldCopySelf,
    controller,
    owner: controller,
    tapped: effect.tapped || effect.attacking,
    attacking: effect.attacking,
    blocking: Boolean(effect.blocking),
    summoningSick: Boolean(effect.summoningSick ?? !effect.attacking),
    enteredDuringCombat: Boolean(effect.attacking || source.attacking || String(event.payload?.phase || "").toLowerCase().includes("combat")),
    attackingPlayerId: effect.attackingPlayerId || event.payload?.attackingPlayerId || "opponent",
    attackedObjectId: effect.attackedObjectId || event.payload?.attackedObjectId || "opponent",
    createdByTriggerId: event.payload?.triggerId || event.triggerId || "",
    sourcePermanentId: source.id,
    combatPhaseCreatedIn: effect.combatPhaseCreatedIn || event.payload?.phase || "",
    tokenTemplateId: effect.tokenTemplateId || effect.token?.id || effect.token?.name || "",
    tokenCopyOfId: shouldCopySelf ? source.id : "",
    ownedByCommanderDeck: false,
  });
  const battlefieldSide = controller === "player" ? "player" : "opponent";

  const next = {
    ...session,
    battlefield: {
      ...session.battlefield,
      [battlefieldSide]: stackPermanent(
        session.battlefield[battlefieldSide],
        token
      ),
    },
    combat: effect.attacking
      ? {
          ...session.combat,
          attackerIds: [...new Set([...(session.combat.attackerIds || []), token.id])],
        }
      : session.combat,
    effectLog: [createLog(source.name, `Created ${count} ${token.name}${effect.attacking ? " tapped and attacking" : ""}.`), ...session.effectLog].slice(0, 60),
  };
  const withDebug = appendDebugTrace(next, "tokens-created", {
    source: source.name,
    token: token.name,
    count,
    controller,
    multiplier,
    replacementCount,
    repeats,
    copy: shouldCopySelf,
    tapped: Boolean(token.tapped),
    attacking: Boolean(token.attacking),
    enteredDuringCombat: Boolean(token.enteredDuringCombat),
  });
  return emitPermanentEntryEvents(withDebug, token, {
    instances: count,
    cause: event.type || event.eventType || "effect",
    chainId: event.chainId,
  });
}

function queueUnsupportedEffect(session, effect = {}, source = {}, event = {}) {
  const summary = effect.summary || effect.reason || effect.action || "Unrecognized card effect";
  const pendingEntry = {
    id: createId("pending"),
    sourceId: source.id,
    sourceName: source.name || "Unknown source",
    effect,
    summary: `Needs review: ${summary}`,
    status: "pending",
    rulesConfidence: RULES_CONFIDENCE.NEEDS_REVIEW,
    createdAt: Date.now(),
    triggerId: event.payload?.triggerId || event.triggerId || "",
    eventType: event.eventType || event.type || "",
  };
  return {
    ...session,
    pendingEffects: [pendingEntry, ...(session.pendingEffects || [])].slice(0, 60),
    recoveryLog: [
      {
        id: createId("recovery"),
        source: source.name || "Rules Engine",
        message: "This effect needs manual review instead of being ignored.",
        technicalMessage: `Unsupported effect action: ${effect.action || "unknown"}`,
        severity: "warning",
        timestamp: Date.now(),
        suggestedAction: "Open Manual Choice Required and resolve, skip, or ignore this game.",
        action: "open-manual-choice",
        dismissed: false,
      },
      ...(session.recoveryLog || []),
    ].slice(0, 80),
    effectLog: [
      createLog(source.name || "Rules Engine", `Needs review: ${summary}.`, RULES_CONFIDENCE.NEEDS_REVIEW, "needs-review"),
      ...(session.effectLog || []),
    ].slice(0, 80),
  };
}

function addCounters(session, effect, source, event) {
  const baseCount = Math.max(1, normalizeCount(effect.count, 1));
  const repeats = Math.max(1, normalizeCount(event.payload?.instances ?? event.instances, 1));
  const targets = getTargets(session, effect.target, source, event);
  const targetIds = new Set(targets.map((target) => target.id));

  const apply = (permanent) => {
    if (!targetIds.has(permanent.id)) {
      return permanent;
    }
    const controller = permanent.controller || source.controller;
    const multiplier = getCounterMultiplierForController(session, controller);
    const current = normalizeCount(permanent.counters?.[effect.counterType]);
    return createPermanent({
      ...permanent,
      counters: {
        ...permanent.counters,
        [effect.counterType]: current + baseCount * repeats * multiplier,
      },
    });
  };

  const next = {
    ...session,
    battlefield: {
      ...session.battlefield,
      player: session.battlefield.player.map(apply),
      opponent: session.battlefield.opponent.map(apply),
    },
    effectLog: [createLog(source.name, `Added counters to ${targets.length} target(s).`), ...session.effectLog].slice(0, 60),
  };
  return appendDebugTrace(next, "counters-added", {
    source: source.name,
    counterType: effect.counterType,
    baseCount,
    repeats,
    targets: targets.length,
    replacementCount: getReplacementEffects(session, source.controller || "player", "double-counters").length,
  });
}

function doubleCounters(session, effect, source, event = {}) {
  const targets = getTargets(session, effect.target || "self", source, event);
  const targetIds = new Set(targets.map((target) => target.id));
  const counterType = effect.counterType || "+1/+1";
  const repeats = Math.max(1, normalizeCount(event.payload?.instances ?? event.instances, 1));
  const mapPermanent = (permanent) => {
    if (!targetIds.has(permanent.id)) {
      return permanent;
    }
    const current = normalizeCount(permanent.counters?.[counterType], 0);
    if (!current) {
      return permanent;
    }
    const multiplier = getCounterMultiplierForController(session, permanent.controller || source.controller);
    const additional = current * repeats * multiplier;
    return createPermanent({
      ...permanent,
      counters: {
        ...(permanent.counters || {}),
        [counterType]: current + additional,
      },
    });
  };
  const next = {
    ...session,
    battlefield: {
      ...session.battlefield,
      player: session.battlefield.player.map(mapPermanent),
      opponent: session.battlefield.opponent.map(mapPermanent),
    },
    effectLog: [createLog(source.name, `Doubled ${counterType} counters on ${targets.length} permanent(s).`), ...session.effectLog].slice(0, 60),
  };
  return appendDebugTrace(next, "counters-doubled", {
    source: source.name,
    counterType,
    targets: targets.length,
    repeats,
  });
}

function applyLifeEffect(session, effect, source, event = {}) {
  const repeats = Math.max(1, normalizeCount(event.payload?.instances ?? event.instances, 1));
  const amount = Number(effect.amount) || 0;
  const total = amount * repeats;
  const next = {
    ...session,
    life: Math.max(0, session.life + total),
    effectLog: [createLog(source.name, `Life changed by ${total}.`), ...session.effectLog].slice(0, 60),
  };
  return appendDebugTrace(next, "life-applied", { source: source.name, amount: total, repeats });
}

function applyDamageEffect(session, effect, source, event = {}) {
  const repeats = Math.max(1, normalizeCount(event.payload?.instances ?? event.instances, 1));
  const amount = Math.max(0, Number(effect.amount) || 0);
  const total = amount * repeats;
  const current = normalizeCount(session.commander?.damageByOpponent?.opponent, 0);
  const next = {
    ...session,
    commander: {
      ...session.commander,
      damageByOpponent: {
        ...(session.commander?.damageByOpponent || {}),
        opponent: current + total,
      },
    },
    effectLog: [createLog(source.name, `Dealt ${total} damage to opponent.`), ...session.effectLog].slice(0, 60),
  };
  return appendDebugTrace(next, "damage-applied", { source: source.name, amount: total, target: effect.target, repeats });
}

function resolveTokenCount(session, effect, source) {
  const countFrom = String(effect.countFrom || "").toLowerCase();
  if (countFrom === "attacking-creatures") {
    return getAllPermanents(session).filter(
      (permanent) => permanent.controller === source.controller && permanent.isCreature && (session.combat?.attackerIds || []).includes(permanent.id)
    ).length;
  }
  if (countFrom === "source-power") {
    const currentSource = getAllPermanents(session).find((permanent) => permanent.id === source.id) || source;
    const power = Number(currentSource.currentPower ?? currentSource.basePower ?? 0);
    return Number.isFinite(power) ? Math.max(0, Math.trunc(power)) : 0;
  }
  if (countFrom === "source-plus1-counters") {
    const currentSource = getAllPermanents(session).find((permanent) => permanent.id === source.id) || source;
    return normalizeCount(currentSource.counters?.["+1/+1"], 0);
  }
  if (countFrom === "source-all-counters") {
    const currentSource = getAllPermanents(session).find((permanent) => permanent.id === source.id) || source;
    return Object.values(currentSource.counters || {}).reduce((sum, value) => sum + normalizeCount(value, 0), 0);
  }
  if (countFrom === "lands") {
    return countLands(session, source.controller);
  }
  return normalizeCount(effect.count, 0);
}

function countLands(session, controller = "player") {
  return getAllPermanents(session)
    .filter((permanent) => permanent.controller === controller && permanent.isLand)
    .reduce((sum, permanent) => sum + (permanent.quantity || 1), 0);
}

function createCopyTokenFromSource(source, controller, effect) {
  return {
    cardId: source.cardId,
    name: source.name,
    manaCost: source.manaCost,
    typeLine: source.typeLine,
    oracleText: source.oracleText,
    rulesText: source.rulesText,
    basePower: source.basePower,
    baseToughness: source.baseToughness,
    colors: source.colors,
    colorIdentity: source.colorIdentity,
    legalities: source.legalities,
    subtypes: source.subtypes,
    supertypes: source.supertypes,
    keywords: source.keywords,
    metadata: {
      ...(source.metadata || {}),
      copiedFromId: source.id,
      copiedVia: effect.sourceName || source.name,
    },
    controller,
    owner: controller,
  };
}

function emitPermanentEntryEvents(session, permanent, { instances = 1, cause = "effect", chainId = "" } = {}) {
  const payload = { permanent, instances, cause, controller: permanent.controller };
  let next = processEventTriggers(session, {
    type: "permanent-entered",
    eventType: "ENTER_BATTLEFIELD",
    permanent,
    payload,
    instances,
    cause,
    chainId,
  });
  if (permanent.isLand) {
    next = processEventTriggers(next, {
      type: "land-entered-battlefield",
      eventType: "LAND_ENTERED_BATTLEFIELD",
      permanent,
      payload,
      instances,
      cause,
      chainId,
    });
    next = processEventTriggers(next, {
      type: "landfall-check",
      eventType: "LANDFALL_CHECK",
      permanent,
      payload,
      instances,
      cause,
      chainId,
    });
  }
  return next;
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
  return createPermanent({
    ...permanent,
    keywords: [...new Set(permanent.keywords || [])],
    currentPower: permanent.basePower,
    currentToughness: permanent.baseToughness,
  });
}

function triggerMatchesStructured(trigger, event, source, session) {
  const eventType = String(trigger.eventType || "").toUpperCase();
  if (!eventType) {
    return false;
  }
  const normalizedEventType = String(event.eventType || "").toUpperCase();
  const comparableEventType = ["DESTROY", "EXILE", "SACRIFICE"].includes(normalizedEventType)
    ? "LEAVE_BATTLEFIELD"
    : normalizedEventType;
  if (!comparableEventType || comparableEventType !== eventType) {
    return false;
  }

  if (eventType === "ENTER_BATTLEFIELD") {
    return evaluateEnterBattlefieldCondition(trigger.condition, event, source);
  }
  if (eventType === "LAND_ENTERED_BATTLEFIELD" || eventType === "LANDFALL_CHECK") {
    return evaluateLandfallCondition(trigger.condition, event, source);
  }
  if (eventType === "ATTACK_DECLARED" || eventType === "ATTACK_TRIGGER_CHECK") {
    return evaluateAttackCondition(trigger.condition, event, source, session);
  }
  if (["LEAVE_BATTLEFIELD", "DESTROY", "EXILE", "SACRIFICE"].includes(eventType)) {
    return evaluateLeaveBattlefieldCondition(trigger.condition, event);
  }
  if (eventType === "PHASE_CHANGED" && trigger.timing === "phase") {
    return !trigger.condition || trigger.condition === event.payload?.phase || trigger.condition === event.phase;
  }
  return true;
}

function enqueueTrigger(session, { source, event, chainId, optional, oncePerTurn, targetSelector, effectDefinitions, triggerCondition = "" }) {
  const queueEntry = {
    id: createId("trigger"),
    chainId,
    sourceId: source.id,
    sourceName: source.name,
    eventType: event.eventType || String(event.type || "").toUpperCase() || "TRIGGER",
    eventPayload: event.payload || {},
    targetSelector: targetSelector || "all-creatures",
    optional: Boolean(optional),
    oncePerTurn: Boolean(oncePerTurn),
    triggerCondition,
    effectDefinitions: effectDefinitions || [],
    status: "pending",
    rulesConfidence: (effectDefinitions || []).some((effect) => effect.manual || effect.optional)
      ? RULES_CONFIDENCE.MANUAL_CHOICE
      : RULES_CONFIDENCE.AUTO_RESOLVED,
    createdAt: Date.now(),
    generatedModifiers: [],
  };
  return {
    ...session,
    triggerQueue: [queueEntry, ...(session.triggerQueue || [])].slice(0, 120),
  };
}

function shouldAutoResolveTrigger(effect, session) {
  const runtime = session.runtime || {};
  const alwaysAutoActions = new Set(["create-token", "add-counters", "double-counters", "life", "damage"]);
  const adhdAutoEnabled = runtime.adhdAutomation !== false || alwaysAutoActions.has(effect.action);
  const confirmAmbiguous = runtime.confirmAmbiguousEffects !== false;
  if (!adhdAutoEnabled) {
    return false;
  }
  if (effect.manual || effect.optional) {
    return false;
  }
  if (confirmAmbiguous && effect.target === "selected") {
    return false;
  }
  return true;
}

function collectModifierPreview(session, sourceId) {
  const modifiers = session.layerContext?.modifiers || [];
  return modifiers
    .filter((modifier) => modifier.sourceId === sourceId)
    .slice(0, 8)
    .map((modifier) => ({
      modifierId: modifier.modifierId,
      layer: modifier.layer,
      operation: modifier.operation,
      targetSelector: modifier.targetSelector,
    }));
}

function getTokenMultiplierForController(session, controller = "player") {
  const replacements = getReplacementEffects(session, controller, "double-tokens");
  return replacements.length ? Math.pow(2, replacements.length) : 1;
}

function getCounterMultiplierForController(session, controller = "player") {
  const replacements = getReplacementEffects(session, controller, "double-counters");
  return replacements.length ? Math.pow(2, replacements.length) : 1;
}

function getTriggerRepeatCount(session, trigger, event, source) {
  const eventType = String(event.eventType || "").toUpperCase();
  if (!["LAND_ENTERED_BATTLEFIELD", "LANDFALL_CHECK"].includes(eventType)) {
    return 1;
  }
  if (!String(trigger.condition || "").includes("land-entered")) {
    return 1;
  }
  const extra = getReplacementEffects(session, source.controller || "player", "double-landfall-triggers").length;
  return 1 + extra;
}

function getReplacementEffects(session, controller, actionName) {
  return getAllPermanents(session)
    .filter((permanent) => permanent.controller === controller)
    .flatMap((permanent) =>
      (permanent.replacementEffects || []).length
        ? permanent.replacementEffects || []
        : (permanent.parsedEffects || []).filter((effect) => effect.kind === "replacement")
    )
    .filter((effect) => effect.action === actionName);
}

function stackPermanent(permanents, incoming) {
  const index = permanents.findIndex((permanent) => canStack(permanent, incoming));
  if (index < 0) {
    return [...permanents, normalizeStackMembers(incoming)];
  }
  return permanents.map((permanent, permanentIndex) =>
    permanentIndex === index
      ? createPermanent({
          ...permanent,
          quantity: (permanent.quantity || 1) + (incoming.quantity || 1),
          stackMembers: [...(permanent.stackMembers || []), ...(normalizeStackMembers(incoming).stackMembers || [])],
        })
      : permanent
  );
}

function canStack(left, right) {
  const stackEligible = (left.isToken && right.isToken) || (left.isCopy && right.isCopy);
  return stackEligible && permanentStackSignature(left) === permanentStackSignature(right);
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
    enteredDuringCombat: permanent.enteredDuringCombat,
    attackingPlayerId: permanent.attackingPlayerId,
    attackedObjectId: permanent.attackedObjectId,
    createdByTriggerId: permanent.createdByTriggerId,
    sourcePermanentId: permanent.sourcePermanentId,
    combatPhaseCreatedIn: permanent.combatPhaseCreatedIn,
    tokenTemplateId: permanent.tokenTemplateId,
    tokenCopyOfId: permanent.tokenCopyOfId,
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

function normalizeStackMembers(permanent) {
  const quantity = Math.max(1, Number(permanent.quantity) || 1);
  const existing = Array.isArray(permanent.stackMembers) && permanent.stackMembers.length ? permanent.stackMembers : [];
  const stackMembers =
    existing.length >= quantity
      ? existing.slice(0, quantity)
      : [
          ...existing,
          ...Array.from({ length: quantity - existing.length }, () => ({
            instanceId: createId("member"),
            tapped: Boolean(permanent.tapped),
            attacking: Boolean(permanent.attacking),
            blocking: Boolean(permanent.blocking),
            summoningSick: Boolean(permanent.summoningSick),
            counters: { ...(permanent.counters || {}) },
            attachments: Array.isArray(permanent.attachments) ? [...permanent.attachments] : [],
            temporaryModifiers: Array.isArray(permanent.temporaryModifiers) ? [...permanent.temporaryModifiers] : [],
            metadata: {
              enteredDuringCombat: Boolean(permanent.enteredDuringCombat),
              attackingPlayerId: permanent.attackingPlayerId || "",
              attackedObjectId: permanent.attackedObjectId || "",
              createdByTriggerId: permanent.createdByTriggerId || "",
              sourcePermanentId: permanent.sourcePermanentId || "",
              combatPhaseCreatedIn: permanent.combatPhaseCreatedIn || "",
              tokenTemplateId: permanent.tokenTemplateId || "",
              tokenCopyOfId: permanent.tokenCopyOfId || "",
            },
          })),
        ];
  return {
    ...permanent,
    quantity,
    stackMembers,
  };
}

function createLog(sourceName, summary, rulesConfidence = RULES_CONFIDENCE.AUTO_RESOLVED, status = "resolved") {
  return {
    id: createId("log"),
    at: Date.now(),
    sourceName,
    summary,
    status,
    rulesConfidence,
  };
}

function normalizeTriggerEvent(event = {}) {
  const explicit = String(event.eventType || "").toUpperCase();
  if (explicit) {
    return event;
  }
  const fallbackMap = {
    "permanent-entered": "ENTER_BATTLEFIELD",
    "land-entered-battlefield": "LAND_ENTERED_BATTLEFIELD",
    "landfall-check": "LANDFALL_CHECK",
    "attackers-declared": "ATTACK_TRIGGER_CHECK",
    "attack-trigger-check": "ATTACK_TRIGGER_CHECK",
    "permanent-died": "LEAVE_BATTLEFIELD",
    "phase-changed": "PHASE_CHANGED",
  };
  const mapped = fallbackMap[String(event.type || "").toLowerCase()] || "";
  return {
    ...event,
    eventType: mapped || event.eventType || "",
    payload: event.payload || {},
  };
}

function evaluateEnterBattlefieldCondition(condition, event, source) {
  const permanent = event.payload?.permanent || event.permanent;
  if (!permanent) {
    return false;
  }
  const normalized = String(condition || "").toLowerCase();
  if (!normalized) {
    return true;
  }
  if (normalized === "self-entered") {
    return permanent.id === source.id;
  }
  if (normalized === "creature-entered") {
    return Boolean(permanent.isCreature);
  }
  if (normalized === "creature-entered-other") {
    return Boolean(permanent.isCreature) && permanent.id !== source.id;
  }
  if (normalized === "creature-entered-controlled") {
    return Boolean(permanent.isCreature) && permanent.controller === source.controller;
  }
  return true;
}

function evaluateLandfallCondition(condition, event, source) {
  const permanent = event.payload?.permanent || event.permanent;
  if (!permanent || !permanent.isLand) {
    return false;
  }
  const normalized = String(condition || "").toLowerCase();
  if (!normalized || normalized === "land-entered") {
    return true;
  }
  if (normalized === "land-entered-controlled") {
    return permanent.controller === source.controller;
  }
  return true;
}

function evaluateAttackCondition(condition, event, source, session) {
  const attackerIds = event.payload?.attackerIds || event.ids || [];
  const attackers = getAllPermanents(session).filter((permanent) => attackerIds.includes(permanent.id));
  const normalized = String(condition || "").toLowerCase();
  if (!normalized || normalized === "attack") {
    return attackers.length > 0;
  }
  if (normalized === "attack-non-gnome-you-control") {
    return attackers.some(
      (permanent) => permanent.controller === source.controller && permanent.isCreature && !/\bGnome\b/i.test(permanent.typeLine || "")
    );
  }
  return attackers.length > 0;
}

function evaluateLeaveBattlefieldCondition(condition, event) {
  const permanent = event.payload?.permanent || event.permanent;
  if (!permanent) {
    return false;
  }
  const cause = String(event.payload?.cause || event.cause || "").toLowerCase();
  if (condition === "dies") {
    if (["exile", "bounce", "return", "remove"].includes(cause)) {
      return false;
    }
    return Boolean(permanent.isCreature);
  }
  return true;
}

function eventAffectsBattlefield(event = {}) {
  const key = String(event.eventType || event.type || "").toLowerCase();
  return [
    "enter_battlefield",
    "leave_battlefield",
    "destroy",
    "exile",
    "sacrifice",
    "counter_added",
    "counter_removed",
    "token_created",
    "phase_changed",
    "turn_changed",
    "land_entered_battlefield",
    "landfall_check",
    "attack_trigger_check",
    "permanent-entered",
    "permanent-left",
    "permanent-died",
    "attackers-declared",
    "blockers-declared",
    "phase-changed",
    "turn-changed",
    "spell-cast",
  ].includes(key);
}

function appendDebugTrace(session, kind, payload = {}) {
  if (!session.runtime?.debugRules) {
    return session;
  }
  const entry = {
    id: createId("debug"),
    at: Date.now(),
    kind,
    payload,
  };
  if (typeof console !== "undefined" && typeof console.debug === "function") {
    console.debug("[RulesDebug]", kind, payload);
  }
  return {
    ...session,
    debugTrace: [entry, ...(session.debugTrace || [])].slice(0, 400),
  };
}
