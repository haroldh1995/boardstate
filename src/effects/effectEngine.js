import { createPermanent } from "../state/schema.js";
import { createId, normalizeCount } from "../state/ids.js";
import { parseCardEffects } from "./effectParser.js";
import { getTargets } from "./targeting.js";
import { applyLayerSystem } from "./layerSystem.js";
import { createCardDefinition } from "./cardDefinition.js";
import { RULES_CONFIDENCE } from "../support/debugExport.js";
import { preparePermanentEntry } from "../game/entrySystem.js";

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
    metadata: { ...(permanent.metadata || {}), ...(definition.metadata || {}) },
    relationships: { ...(permanent.relationships || {}), ...(definition.relationships || {}) },
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

export function castSpellToStack(session, spell, options = {}) {
  const source = hydratePermanentEffects({
    ...spell,
    owner: options.owner || spell.owner || options.controller || spell.controller || "player",
    controller: options.controller || spell.controller || "player",
    zone: options.sourceZone || spell.zone || "hand",
  });
  if (source.isLand) {
    return queueSpellRecovery(session, source, "Lands are played, not cast. Use Put onto Battlefield or a land-play action.");
  }
  const isPermanentSpell = !source.isInstant && !source.isSorcery;

  const stackObject = {
    id: createId("spell"),
    objectType: options.isCopy ? (isPermanentSpell ? "copy-of-permanent-spell" : "copy-of-spell") : isPermanentSpell ? "permanent-spell" : "spell",
    card: source,
    name: source.name,
    typeLine: source.typeLine,
    oracleText: source.oracleText,
    controller: source.controller,
    owner: source.owner,
    sourceZone: options.sourceZone || source.zone || "hand",
    targetIds: Array.isArray(options.targetIds) ? [...options.targetIds] : [...(session.selectedIds || [])],
    targetStackId: options.targetStackId || "",
    selectedModes: Array.isArray(options.selectedModes) ? [...options.selectedModes] : [],
    xValue: Number.isFinite(Number(options.xValue)) ? Math.max(0, Number(options.xValue)) : null,
    additionalCosts: options.additionalCosts || {},
    castPermission: options.castPermission || "",
    isCopy: Boolean(options.isCopy),
    copiedFromStackId: options.copiedFromStackId || "",
    isPermanentSpell,
    status: "pending",
    rulesConfidence: RULES_CONFIDENCE.AUTO_RESOLVED,
    createdAt: Date.now(),
    effectsApplied: false,
  };
  const missingChoices = collectSpellCastingChoices(stackObject, session);
  const pendingEntries = missingChoices.map((choice) => createSpellChoiceEntry(stackObject, choice));
  const nextStackObject = missingChoices.length
    ? { ...stackObject, status: "awaiting-choice", rulesConfidence: RULES_CONFIDENCE.MANUAL_CHOICE }
    : stackObject;
  const responderIds = getPriorityResponderIds(session, source.controller);
  const nextSession = {
    ...removeKnownZoneCard(session, source.controller, stackObject.sourceZone, source),
    stack: [nextStackObject, ...(session.stack || [])],
    presentation: createCardPresentation(source, "cast", source.controller),
    priority: {
      activePlayerId: responderIds[0] || source.controller,
      passedPlayerIds: [],
      responderIds,
      waiting: Boolean(responderIds.length),
    },
    pendingEffects: [...pendingEntries, ...(session.pendingEffects || [])].slice(0, 120),
    rulesConfidenceLog: [
      createRulesConfidenceEntry(source.name, missingChoices.length ? "Spell cast with choices pending." : "Spell placed on the stack.", nextStackObject.rulesConfidence),
      ...(session.rulesConfidenceLog || []),
    ].slice(0, 160),
    effectLog: [
      createLog(
        source.name,
        missingChoices.length ? `Spell placed on stack; ${missingChoices.length} choice(s) required.` : "Spell placed on the stack.",
        nextStackObject.rulesConfidence,
        nextStackObject.status
      ),
      ...(session.effectLog || []),
    ].slice(0, 120),
  };
  return processEventTriggers(nextSession, {
    type: "spell-cast",
    eventType: "SPELL_CAST",
    source,
    payload: { spell: nextStackObject, controller: source.controller },
  });
}

export function resolveTopOfStack(session, options = {}) {
  const stack = [...(session.stack || [])];
  const spell = options.stackId ? stack.find((entry) => entry.id === options.stackId) : stack[0];
  if (!spell) {
    return queueSpellRecovery(session, { name: "Stack" }, "There is no spell on the stack to resolve.", "info");
  }
  const unresolvedChoices = (session.pendingEffects || []).filter(
    (entry) => entry.stackObjectId === spell.id && !["resolved", "skipped", "ignored"].includes(entry.status)
  );
  if (unresolvedChoices.length) {
    return queueSpellRecovery(
      {
        ...session,
        stack: stack.map((entry) => entry.id === spell.id ? { ...entry, status: "awaiting-choice", rulesConfidence: RULES_CONFIDENCE.MANUAL_CHOICE } : entry),
      },
      spell,
      `${spell.name} cannot resolve until ${unresolvedChoices.length} pending choice(s) are handled.`
    );
  }

  let nextSession = session;
  if (spell.isPermanentSpell) {
    return finalizePermanentSpellResolution(nextSession, spell);
  }
  if (!spell.effectsApplied) {
    nextSession = resolveSpell(nextSession, spell.card, {
      stackObjectId: spell.id,
      targetIds: spell.targetIds,
      targetStackId: spell.targetStackId,
      selectedModes: spell.selectedModes,
      xValue: spell.xValue,
      controller: spell.controller,
      autoChoose: Boolean(options.autoChoose),
      deferDestination: true,
    });
  }
  const generatedChoices = (nextSession.pendingEffects || []).filter(
    (entry) => entry.stackObjectId === spell.id && !["resolved", "skipped", "ignored"].includes(entry.status)
  );
  if (generatedChoices.length) {
    return {
      ...nextSession,
      stack: (nextSession.stack || stack).map((entry) =>
        entry.id === spell.id
          ? { ...entry, status: "awaiting-choice", effectsApplied: true, rulesConfidence: RULES_CONFIDENCE.MANUAL_CHOICE }
          : entry
      ),
    };
  }
  return finalizeSpellResolution(nextSession, { ...spell, effectsApplied: true });
}

export function passStackPriority(session, playerId = "local-player") {
  const passed = new Set(session.priority?.passedPlayerIds || []);
  passed.add(playerId);
  const responderIds = session.priority?.responderIds || [];
  const next = {
    ...session,
    priority: {
      ...(session.priority || {}),
      activePlayerId: responderIds.find((id) => !passed.has(id)) || playerId,
      passedPlayerIds: [...passed],
      waiting: responderIds.some((id) => !passed.has(id)),
    },
    effectLog: [createLog("Priority", `${playerId} passed priority.`, RULES_CONFIDENCE.AUTO_RESOLVED), ...(session.effectLog || [])].slice(0, 120),
  };
  return responderIds.length && responderIds.every((id) => passed.has(id))
    ? resolveTopOfStack(next, { autoChoose: playerId !== "local-player" })
    : next;
}

export function counterStackObject(session, stackId = "", sourceName = "Counterspell") {
  const stack = [...(session.stack || [])];
  const target = stack.find((entry) => entry.id === stackId) || stack[0];
  if (!target) {
    return queueSpellRecovery(session, { name: sourceName }, "Counterspell needs a valid spell or ability on the stack.");
  }
  const withoutTarget = stack.filter((entry) => entry.id !== target.id);
  const moved = target.isCopy ? session : moveSpellCardToDestination(session, target, "graveyard");
  return {
    ...moved,
    stack: withoutTarget,
    priority: { activePlayerId: target.controller || "local-player", passedPlayerIds: [], waiting: Boolean(withoutTarget.length) },
    effectLog: [
      createLog(sourceName, `${target.name} was countered${target.isCopy ? " and ceased to exist" : " and moved to graveyard"}.`),
      ...(moved.effectLog || []),
    ].slice(0, 120),
  };
}

export function resolveSpell(session, spell, options = {}) {
  const source = hydratePermanentEffects({
    ...spell,
    controller: options.controller || spell.controller || "player",
    owner: spell.owner || options.controller || spell.controller || "player",
    isInstant: spell.isInstant,
    isSorcery: spell.isSorcery,
  });
  let nextSession = session;
  let resolved = 0;
  const spellEffects = source.parsedEffects.filter((effect) => effect.kind === "spell");
  if (!spellEffects.length) {
    nextSession = queueUnsupportedEffect(
      nextSession,
      {
        action: "unparsed-spell",
        manual: true,
        summary: source.oracleText
          ? `No safe automatic resolution was found for: ${source.oracleText}`
          : "Card rules text is unavailable; resolve this spell manually.",
      },
      source,
      {
        type: "spell-resolution",
        stackObjectId: options.stackObjectId || "",
      }
    );
  }
  spellEffects.forEach((effect) => {
      const before = JSON.stringify(nextSession);
      nextSession = resolveEffect(nextSession, effect, source, {
        type: "spell-resolution",
        source,
        stackObjectId: options.stackObjectId || "",
        targetIds: options.targetIds || [],
        targetStackId: options.targetStackId || "",
        selectedModes: options.selectedModes || [],
        xValue: options.xValue,
        autoChoose: Boolean(options.autoChoose),
      });
      if (JSON.stringify(nextSession) !== before) {
        resolved += 1;
      }
    });

  const resolvedSession = {
    ...recalculateContinuousEffects(nextSession),
    effectLog: [
      createLog(
        source.name,
        resolved > 0 ? "Spell processed supported effects; review any pending choices." : "Spell logged for manual resolution.",
        (nextSession.pendingEffects || []).some((entry) => entry.stackObjectId === options.stackObjectId && entry.status === "pending")
          ? RULES_CONFIDENCE.PARTIAL
          : RULES_CONFIDENCE.AUTO_RESOLVED
      ),
      ...nextSession.effectLog,
    ].slice(0, 60),
  };
  if (options.deferDestination) {
    return resolvedSession;
  }
  return moveSpellCardToDestination(resolvedSession, {
    card: source,
    name: source.name,
    controller: source.controller,
    owner: source.owner,
    sourceZone: options.sourceZone || source.zone || "hand",
    isCopy: Boolean(options.isCopy),
  }, determineSpellDestination(source, options));
}

export function resolveEffect(session, effect, source, event = {}) {
  const effectiveEffect = effect.manual && canResolveManualEffect(session, effect, event)
    ? { ...effect, manual: false }
    : effect;
  if (effectiveEffect.manual) {
    const pendingEntry = {
      id: createId("pending"),
      sourceId: source.id,
      sourceName: source.name,
      effect: effectiveEffect,
      summary: effectiveEffect.summary || effectiveEffect.reason || "Manual choice required",
      status: "pending",
      rulesConfidence: RULES_CONFIDENCE.MANUAL_CHOICE,
      createdAt: Date.now(),
      triggerId: event.payload?.triggerId || event.triggerId || "",
      eventType: event.eventType || event.type || "",
      stackObjectId: event.stackObjectId || "",
      oracleText: source.oracleText || "",
      controller: source.controller || "player",
    };
    return {
      ...session,
      pendingEffects: [pendingEntry, ...session.pendingEffects].slice(0, 60),
      effectLog: [
        createLog(source.name, `Manual choice required: ${effectiveEffect.summary || effectiveEffect.reason || effectiveEffect.action || "effect"}.`, RULES_CONFIDENCE.MANUAL_CHOICE),
        ...session.effectLog,
      ].slice(0, 80),
    };
  }

  switch (effectiveEffect.action) {
    case "create-token":
      return createTokens(session, effectiveEffect, source, event);
    case "add-counters":
      return addCounters(session, effectiveEffect, source, event);
    case "double-counters":
      return doubleCounters(session, effectiveEffect, source, event);
    case "temporary-buff":
      return applyTemporaryBuff(session, effectiveEffect, source);
    case "life":
      return applyLifeEffect(session, effectiveEffect, source, event);
    case "life-loss":
      return applyLifeLossEffect(session, effectiveEffect, source, event);
    case "damage":
      return applyDamageEffect(session, effectiveEffect, source, event);
    case "draw":
    case "discard":
    case "discard-hand":
    case "mill":
      return applyHiddenZoneEffect(session, effectiveEffect, source, event);
    case "remove-permanent":
      return applyRemovalEffect(session, effectiveEffect, source, event);
    case "search-land":
    case "search-library":
      return applySearchEffect(session, effectiveEffect, source, event);
    case "return-from-graveyard":
    case "return-all-lands-from-graveyard":
      return applyGraveyardEffect(session, effectiveEffect, source, event);
    case "counter-stack-object":
      return counterStackObject(session, event.targetStackId || session.stack?.[1]?.id || session.stack?.[0]?.id, source.name);
    case "copy-stack-object":
      return copyStackObject(session, event.targetStackId || session.stack?.[1]?.id || session.stack?.[0]?.id, source, effectiveEffect, event);
    default:
      return queueUnsupportedEffect(session, effectiveEffect, source, event);
  }
}

function collectSpellCastingChoices(spell, session = {}) {
  const text = String(spell.oracleText || "").toLowerCase();
  const choices = [];
  if ((/\{x\}/i.test(spell.card?.manaCost || "") || /\bx\b/.test(text)) && spell.xValue === null) {
    choices.push({ kind: "x-value", summary: "Choose and record X before resolving this spell." });
  }
  if (/\bchoose (?:one|two|one or both|one or more|up to one|up to two)\b/.test(text) && !spell.selectedModes.length) {
    choices.push({ kind: "modes", summary: "Choose the spell mode(s)." });
  }
  if (/\bAura\b/i.test(spell.typeLine || "") && !spell.targetIds.length) {
    choices.push({ kind: "targets", summary: "Choose what this Aura will enchant." });
  }
  const requiresStackTarget = (spell.card?.parsedEffects || []).some((effect) => effect.target === "target-stack-object");
  const requiresVisibleTarget = (spell.card?.parsedEffects || []).some(
    (effect) =>
      effect.target !== "target-stack-object" &&
      effect.manual &&
      (/^(selected|target)/i.test(String(effect.target || "")) ||
        /\btarget\b/i.test(`${effect.reason || ""} ${effect.summary || ""} ${text}`))
  );
  if (requiresStackTarget && !spell.targetStackId) {
    choices.push({ kind: "stack-target", summary: "Choose a spell or ability on the stack." });
  } else if (requiresVisibleTarget && !spell.targetIds.length) {
    choices.push({ kind: "targets", summary: "Choose target(s) manually." });
  }
  if (/\bas an additional cost\b|\bbuyback\b|\bkicker\b|\bmultikicker\b|\bentwine\b|\bescalate\b|\boverload\b|\breplicate\b/.test(text)) {
    choices.push({ kind: "additional-cost", summary: "Confirm optional or additional costs paid." });
  }
  const sourceZone = String(spell.sourceZone || "hand").toLowerCase();
  const graveyardPermission = /\bflashback\b|\bjump-start\b|\bretrace\b|\bescape\b|\baftermath\b/.test(text);
  const exilePermission = /\badventure\b|\bforetell\b|\bsuspend\b|\brebound\b|cast .* from exile/.test(text);
  if (
    !spell.castPermission &&
    ((sourceZone === "graveyard" && !graveyardPermission) ||
      (sourceZone === "exile" && !exilePermission) ||
      sourceZone === "command")
  ) {
    choices.push({ kind: "zone-permission", summary: `Confirm permission to cast this spell from ${sourceZone}.` });
  }
  const isActiveGame = Boolean(session.gameTracking?.active || session.simulation?.enabled);
  const legalSorceryPhase = [1, 3].includes(Number(session.phaseIndex));
  if (session.runtime?.strictPhaseEnforcement && spell.card?.isSorcery && isActiveGame && (!legalSorceryPhase || (session.stack || []).length > 0)) {
    choices.push({ kind: "timing-override", summary: "Sorcery timing is not currently legal. Confirm a permission or manual override." });
  }
  if (isActiveGame && (spell.controller === "player" || spell.controller === "local-player")) {
    const availableMana = Object.values(session.manaPool || {}).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
    const requiredMana = Math.max(0, Number(spell.card?.manaValue || 0) - (/\{x\}/i.test(spell.card?.manaCost || "") ? 1 : 0)) + Math.max(0, Number(spell.xValue) || 0);
    if (requiredMana > availableMana) {
      choices.push({ kind: "mana-payment", summary: `Insufficient tracked mana (${availableMana}/${requiredMana}). Confirm payment or manual override.` });
    }
  }
  return dedupeChoices(choices);
}

function dedupeChoices(choices) {
  const seen = new Set();
  return choices.filter((choice) => {
    const key = `${choice.kind}:${choice.summary}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function createSpellChoiceEntry(spell, choice) {
  return {
    id: createId("pending"),
    sourceId: spell.card?.id || spell.id,
    sourceName: spell.name,
    effect: {
      action: "spell-casting-choice",
      manual: true,
      choiceKind: choice.kind,
      summary: choice.summary,
    },
    summary: choice.summary,
    status: "pending",
    rulesConfidence: RULES_CONFIDENCE.MANUAL_CHOICE,
    createdAt: Date.now(),
    eventType: "SPELL_CAST",
    stackObjectId: spell.id,
    oracleText: spell.oracleText,
    controller: spell.controller,
  };
}

function canResolveManualEffect(session, effect, event = {}) {
  if (effect.unlessPay) {
    return typeof event.paymentDecision === "boolean";
  }
  if (event.autoChoose) {
    return true;
  }
  if (effect.target === "target-stack-object") {
    return Boolean(event.targetStackId);
  }
  if (/selected|target/.test(String(effect.target || ""))) {
    return Boolean((event.targetIds || []).length || (session.selectedIds || []).length);
  }
  return false;
}

function finalizeSpellResolution(session, spell) {
  const destination = determineSpellDestination(spell.card || {}, spell);
  const moved = spell.isCopy ? session : moveSpellCardToDestination(session, spell, destination);
  const remainingStack = (moved.stack || []).filter((entry) => entry.id !== spell.id);
  return {
    ...moved,
    stack: remainingStack,
    priority: {
      activePlayerId: spell.controller || "local-player",
      passedPlayerIds: [],
      waiting: Boolean(remainingStack.length),
    },
    rulesConfidenceLog: [
      createRulesConfidenceEntry(
        spell.name,
        spell.isCopy ? "Spell copy resolved and ceased to exist." : `Spell resolved to ${destination}.`,
        RULES_CONFIDENCE.AUTO_RESOLVED
      ),
      ...(moved.rulesConfidenceLog || []),
    ].slice(0, 160),
    effectLog: [
      createLog(
        spell.name,
        spell.isCopy ? "Spell copy resolved and ceased to exist." : `Spell resolved and moved to ${destination}.`,
        RULES_CONFIDENCE.AUTO_RESOLVED
      ),
      ...(moved.effectLog || []),
    ].slice(0, 120),
  };
}

function finalizePermanentSpellResolution(session, spell) {
  const controller = spell.controller || "player";
  const side = controller === "player" || controller === "local-player" ? "player" : "opponent";
  const entry = preparePermanentEntry({
    ...(spell.card || {}),
    id: createId("perm"),
    owner: spell.owner || controller,
    zone: "battlefield",
    isCopy: Boolean(spell.isCopy),
    isToken: Boolean(spell.isCopy),
    attachedToId: /\bAura\b/i.test(spell.typeLine || "") ? spell.targetIds?.[0] || "" : spell.card?.attachedToId || "",
  }, controller);
  const permanent = hydratePermanentEffects(entry.permanent);
  const entered = emitPermanentEntryEvents({
    ...session,
    presentation: createCardPresentation(permanent, "resolved-permanent", controller),
    pendingEffects: entry.choice ? [entry.choice, ...(session.pendingEffects || [])].slice(0, 120) : session.pendingEffects,
    battlefield: {
      ...session.battlefield,
      [side]: stackPermanent(session.battlefield?.[side] || [], permanent),
    },
  }, permanent, {
    instances: permanent.quantity || 1,
    cause: spell.isCopy ? "permanent-spell-copy-resolved" : "permanent-spell-resolved",
  });
  const remainingStack = (entered.stack || []).filter((entry) => entry.id !== spell.id);
  return recalculateContinuousEffects({
    ...entered,
    stack: remainingStack,
    priority: {
      activePlayerId: controller,
      passedPlayerIds: [],
      waiting: Boolean(remainingStack.length),
    },
    rulesConfidenceLog: [
      createRulesConfidenceEntry(
        spell.name,
        spell.isCopy ? "Permanent spell copy resolved as a token permanent." : "Permanent spell resolved onto the battlefield.",
        RULES_CONFIDENCE.AUTO_RESOLVED
      ),
      ...(entered.rulesConfidenceLog || []),
    ].slice(0, 160),
    effectLog: [
      createLog(
        spell.name,
        spell.isCopy ? "Permanent spell copy resolved as a token permanent." : "Permanent spell resolved onto the battlefield.",
        RULES_CONFIDENCE.AUTO_RESOLVED
      ),
      ...(entered.effectLog || []),
    ].slice(0, 120),
  });
}

function getPriorityResponderIds(session, controller) {
  if (session.simulation?.enabled) {
    return (session.simulation.turnOrder || Object.keys(session.simulation.opponents || {}))
      .filter((id) => id !== controller && id !== "player" && !(session.simulation.eliminatedPlayerIds || []).includes(id));
  }
  if (session.syncedMultiplayer?.confirmed) {
    return (session.syncedMultiplayer.turnOrder || []).filter(
      (id) => id !== controller && !(controller === "player" && id === "local-player")
    );
  }
  return [];
}

function createCardPresentation(card, kind, controller = "player") {
  const now = Date.now();
  return {
    id: createId("presentation"),
    card: {
      cardId: card.cardId || "",
      name: card.name || "Card",
      typeLine: card.typeLine || "",
      imageUrl: card.imageUrl || "",
      imageSmall: card.imageSmall || "",
      imageArt: card.imageArt || "",
    },
    kind,
    controller,
    createdAt: now,
    expiresAt: now + 1550,
  };
}

function determineSpellDestination(card = {}, options = {}) {
  if (options.isCopy) return "cease";
  const text = String(card.oracleText || "").toLowerCase();
  const sourceZone = String(options.sourceZone || card.zone || "").toLowerCase();
  if (options.buybackPaid) return "hand";
  if ((/\bflashback\b|\bjump-start\b/.test(text) && sourceZone === "graveyard") || /\bexile (?:this spell|it) instead\b/.test(text)) return "exile";
  if (/\brebound\b/.test(text) && sourceZone === "hand") return "exile";
  if (/\badventure\b/.test(String(card.typeLine || "").toLowerCase())) return "exile";
  return "graveyard";
}

function removeKnownZoneCard(session, controller, zoneName, card) {
  if (!zoneName || zoneName === "stack") return session;
  return updateControllerZones(session, controller, (zones) => {
    const zone = [...(zones[zoneName] || [])];
    const index = zone.findIndex((entry) => entry.cardId === card.cardId || entry.name === card.name);
    if (index >= 0) zone.splice(index, 1);
    return { ...zones, [zoneName]: zone };
  });
}

function moveSpellCardToDestination(session, spell, destination) {
  if (destination === "cease") return session;
  const card = {
    ...(spell.card || {}),
    id: spell.card?.id || spell.card?.cardId || createId("zone-card"),
    zone: destination,
    controller: spell.owner || spell.controller,
  };
  return updateControllerZones(session, spell.owner || spell.controller || "player", (zones) => ({
    ...zones,
    [destination]: [...(zones[destination] || []), card],
  }));
}

function updateControllerZones(session, controller, updater) {
  if (controller && controller !== "player" && controller !== "local-player" && session.simulation?.opponents?.[controller]) {
    const npc = session.simulation.opponents[controller];
    const zones = updater({
      library: [...(npc.zones?.library || [])],
      hand: [...(npc.zones?.hand || [])],
      graveyard: [...(npc.zones?.graveyard || [])],
      exile: [...(npc.zones?.exile || [])],
      command: [...(npc.zones?.command || [])],
      battlefield: [...(npc.zones?.battlefield || [])],
    });
    return {
      ...session,
      simulation: {
        ...session.simulation,
        opponents: {
          ...session.simulation.opponents,
          [controller]: { ...npc, zones, updatedAt: Date.now() },
        },
        updatedAt: Date.now(),
      },
    };
  }
  return {
    ...session,
    zones: updater({
      hand: [...(session.zones?.hand || [])],
      library: [...(session.zones?.library || [])],
      graveyard: [...(session.zones?.graveyard || [])],
      exile: [...(session.zones?.exile || [])],
      command: [...(session.zones?.command || [])],
      unknownCounts: { ...(session.zones?.unknownCounts || {}) },
    }),
  };
}

function applyHiddenZoneEffect(session, effect, source, event) {
  const controllers = resolvePlayerTargets(session, source.controller, effect.target);
  const count = Math.max(0, resolveVariableNumber(effect.count, effect.countFrom, event));
  let next = session;
  controllers.forEach((controller) => {
    next = updateControllerZones(next, controller, (zones) => {
      if (effect.action === "draw") return drawCardsFromZones(zones, count);
      if (effect.action === "mill") return millCardsFromZones(zones, count);
      return discardCardsFromZones(zones, effect.action === "discard-hand" ? Infinity : count);
    });
  });
  return appendEffectResult(next, source.name, `${effect.action} processed for ${controllers.length} player(s).`);
}

function drawCardsFromZones(zones, count) {
  const library = [...(zones.library || [])];
  const hand = [...(zones.hand || [])];
  const drawn = library.splice(0, count);
  hand.push(...drawn);
  const unknownCounts = { ...(zones.unknownCounts || {}) };
  const remaining = Math.max(0, count - drawn.length);
  if (remaining) {
    unknownCounts.library = Math.max(0, Number(unknownCounts.library || 0) - remaining);
    unknownCounts.hand = Number(unknownCounts.hand || 0) + remaining;
  }
  return { ...zones, library, hand, unknownCounts };
}

function discardCardsFromZones(zones, requestedCount) {
  const hand = [...(zones.hand || [])];
  const graveyard = [...(zones.graveyard || [])];
  const unknownCounts = { ...(zones.unknownCounts || {}) };
  const count = requestedCount === Infinity ? hand.length + Number(unknownCounts.hand || 0) : requestedCount;
  const discardedKnown = hand.splice(Math.max(0, hand.length - count), count);
  graveyard.push(...discardedKnown);
  const remaining = Math.max(0, count - discardedKnown.length);
  const unknownDiscard = Math.min(Number(unknownCounts.hand || 0), remaining);
  unknownCounts.hand = Math.max(0, Number(unknownCounts.hand || 0) - unknownDiscard);
  unknownCounts.graveyard = Number(unknownCounts.graveyard || 0) + unknownDiscard;
  return { ...zones, hand, graveyard, unknownCounts };
}

function millCardsFromZones(zones, count) {
  const library = [...(zones.library || [])];
  const graveyard = [...(zones.graveyard || [])];
  const milled = library.splice(0, count);
  graveyard.push(...milled);
  const unknownCounts = { ...(zones.unknownCounts || {}) };
  const remaining = Math.max(0, count - milled.length);
  if (remaining) {
    unknownCounts.library = Math.max(0, Number(unknownCounts.library || 0) - remaining);
    unknownCounts.graveyard = Number(unknownCounts.graveyard || 0) + remaining;
  }
  return { ...zones, library, graveyard, unknownCounts };
}

function applySearchEffect(session, effect, source, event) {
  const controller = source.controller || "player";
  if (!event.autoChoose && (controller === "player" || controller === "local-player")) {
    return queueUnsupportedEffect(session, { ...effect, summary: "Choose a card from your library and confirm its destination." }, source, event);
  }
  let foundNames = [];
  const battlefieldCards = [];
  let next = updateControllerZones(session, controller, (zones) => {
    const library = [...(zones.library || [])];
    const destination = [...(zones[effect.destination] || [])];
    const secondaryDestination = effect.secondaryDestination ? [...(zones[effect.secondaryDestination] || [])] : null;
    const count = Math.max(1, Number(effect.count || 1));
    for (let index = 0; index < count; index += 1) {
      const foundIndex = library.findIndex((card) => cardMatchesQuery(card, effect.query));
      if (foundIndex < 0) break;
      const [card] = library.splice(foundIndex, 1);
      foundNames.push(card.name);
      const useSecondary = secondaryDestination && index >= Number(effect.primaryCount || 1);
      const targetDestination = useSecondary ? effect.secondaryDestination : effect.destination;
      (useSecondary ? secondaryDestination : destination).push({
        ...card,
        tapped: useSecondary ? false : Boolean(effect.tapped),
        zone: targetDestination,
      });
      if (targetDestination === "battlefield") {
        battlefieldCards.push({ ...card, tapped: Boolean(effect.tapped), zone: "battlefield" });
      }
    }
    return {
      ...zones,
      library,
      [effect.destination]: destination,
      ...(secondaryDestination ? { [effect.secondaryDestination]: secondaryDestination } : {}),
    };
  });
  battlefieldCards.forEach((card) => {
    const permanent = hydratePermanentEffects({ ...card, controller, owner: controller });
    const side = controller === "player" || controller === "local-player" ? "player" : "opponent";
    next = emitPermanentEntryEvents({
      ...next,
      battlefield: { ...next.battlefield, [side]: stackPermanent(next.battlefield[side] || [], permanent) },
    }, permanent, { cause: "library-search" });
  });
  return appendEffectResult(next, source.name, foundNames.length ? `Searched for ${foundNames.join(", ")}.` : "Library search found no matching known card.", foundNames.length ? RULES_CONFIDENCE.AUTO_RESOLVED : RULES_CONFIDENCE.PARTIAL);
}

function applyGraveyardEffect(session, effect, source, event) {
  const controller = source.controller || "player";
  if (!event.autoChoose && effect.action === "return-from-graveyard") {
    return queueUnsupportedEffect(session, { ...effect, summary: "Choose a card from the graveyard." }, source, event);
  }
  let moved = [];
  let next = updateControllerZones(session, controller, (zones) => {
    const graveyard = [...(zones.graveyard || [])];
    const destination = [...(zones[effect.destination || "hand"] || [])];
    if (effect.action === "return-all-lands-from-graveyard") {
      moved = graveyard.filter((card) => /\bLand\b/i.test(card.typeLine || ""));
    } else {
      const index = graveyard.findIndex((card) => cardMatchesQuery(card, effect.query));
      moved = index >= 0 ? graveyard.splice(index, 1) : [];
    }
    const remaining = effect.action === "return-all-lands-from-graveyard"
      ? graveyard.filter((card) => !moved.includes(card))
      : graveyard;
    destination.push(...moved.map((card) => ({ ...card, zone: effect.destination || "hand" })));
    return { ...zones, graveyard: remaining, [effect.destination || "hand"]: destination };
  });
  if ((effect.destination || "") === "battlefield") {
    moved.forEach((card) => {
      const permanent = hydratePermanentEffects({ ...card, controller, owner: controller, zone: "battlefield" });
      const side = controller === "player" || controller === "local-player" ? "player" : "opponent";
      next = emitPermanentEntryEvents({
        ...next,
        battlefield: { ...next.battlefield, [side]: stackPermanent(next.battlefield[side], permanent) },
      }, permanent, { cause: "graveyard-return" });
    });
  }
  return appendEffectResult(next, source.name, `Returned ${moved.length} card(s) from graveyard.`, moved.length ? RULES_CONFIDENCE.AUTO_RESOLVED : RULES_CONFIDENCE.PARTIAL);
}

function applyRemovalEffect(session, effect, source, event) {
  if (effect.mode === "exile-graveyards") {
    let next = session;
    resolvePlayerTargets(session, source.controller, "each-player").forEach((controller) => {
      next = updateControllerZones(next, controller, (zones) => ({
        ...zones,
        exile: [...(zones.exile || []), ...(zones.graveyard || [])],
        graveyard: [],
        unknownCounts: {
          ...(zones.unknownCounts || {}),
          exile: Number(zones.unknownCounts?.exile || 0) + Number(zones.unknownCounts?.graveyard || 0),
          graveyard: 0,
        },
      }));
    });
    return appendEffectResult(next, source.name, "Exiled all tracked graveyards.");
  }
  const targetIds = new Set((event.targetIds || []).length ? event.targetIds : getTargets(session, effect.target, source, event).map((target) => target.id));
  const removed = [];
  const mapSide = (side) => side.filter((permanent) => {
    if (!targetIds.has(permanent.id)) return true;
    if (effect.mode === "destroy" && (permanent.keywords || []).includes("indestructible")) return true;
    removed.push(permanent);
    return false;
  });
  let next = {
    ...session,
    battlefield: {
      ...session.battlefield,
      player: mapSide(session.battlefield.player || []),
      opponent: mapSide(session.battlefield.opponent || []),
    },
    selectedIds: (session.selectedIds || []).filter((id) => !targetIds.has(id)),
  };
  removed.forEach((permanent) => {
    const destination = effect.mode === "exile" ? "exile" : effect.mode === "bounce" ? "hand" : "graveyard";
    next = updateControllerZones(next, permanent.owner || permanent.controller || "player", (zones) => ({
      ...zones,
      [destination]: [...(zones[destination] || []), { ...permanent, zone: destination }],
    }));
    next = processEventTriggers(next, {
      type: effect.mode === "destroy" || effect.mode === "sacrifice" ? "permanent-died" : "permanent-left",
      eventType: effect.mode === "exile" ? "EXILE" : effect.mode === "sacrifice" ? "SACRIFICE" : effect.mode === "destroy" ? "DESTROY" : "LEAVE_BATTLEFIELD",
      permanent,
      payload: { permanent, cause: effect.mode, controller: permanent.controller },
    });
  });
  return appendEffectResult(next, source.name, `${effect.mode} affected ${removed.length} permanent(s).`, removed.length ? RULES_CONFIDENCE.AUTO_RESOLVED : RULES_CONFIDENCE.PARTIAL);
}

function copyStackObject(session, targetStackId, source, effect, event) {
  const target = (session.stack || []).find((entry) => entry.id === targetStackId);
  if (!target) return queueSpellRecovery(session, source, "Copy effect needs a valid spell on the stack.");
  const copy = {
    ...target,
    id: createId("spell-copy"),
    objectType: "copy-of-spell",
    isCopy: true,
    copiedFromStackId: target.id,
    controller: source.controller || target.controller,
    owner: source.controller || target.owner,
    sourceZone: "stack",
    targetIds: effect.allowNewTargets && (event.targetIds || []).length ? [...event.targetIds] : [...(target.targetIds || [])],
    status: "pending",
    rulesConfidence: RULES_CONFIDENCE.AUTO_RESOLVED,
    createdAt: Date.now(),
    effectsApplied: false,
  };
  return appendEffectResult({ ...session, stack: [copy, ...(session.stack || [])] }, source.name, `Copied ${target.name}; the copy is on the stack.`);
}

function resolvePlayerTargets(session, controller = "player", target = "you") {
  const simulationIds = Object.keys(session.simulation?.players || {});
  const allIds = simulationIds.length ? simulationIds : ["local-player", "opponent"];
  const normalizedController = controller === "player" ? "local-player" : controller;
  if (target === "each-player") return allIds;
  if (target === "each-opponent") return allIds.filter((id) => id !== normalizedController);
  if (target === "target-player" || target === "target-opponent") return [normalizedController === "local-player" ? "opponent" : "local-player"];
  return [normalizedController];
}

function resolveVariableNumber(value, countFrom, event = {}) {
  if (countFrom === "x") return Math.max(0, Number(event.xValue) || 0);
  return Math.max(0, Number(value) || 0);
}

function cardMatchesQuery(card = {}, query = "card") {
  const typeLine = String(card.typeLine || "");
  if (query === "card") return true;
  if (query === "basic-land") return (/\bBasic\b/i.test(typeLine) && /\bLand\b/i.test(typeLine)) || /^(Plains|Island|Swamp|Mountain|Forest|Wastes)$/i.test(card.name || "");
  if (query === "land") return /\bLand\b/i.test(typeLine);
  if (query === "creature") return /\bCreature\b/i.test(typeLine);
  if (query === "instant-sorcery") return /\bInstant\b|\bSorcery\b/i.test(typeLine);
  if (query === "artifact-enchantment") return /\bArtifact\b|\bEnchantment\b/i.test(typeLine);
  return new RegExp(`\\b${query}\\b`, "i").test(typeLine);
}

function appendEffectResult(session, sourceName, summary, rulesConfidence = RULES_CONFIDENCE.AUTO_RESOLVED) {
  return {
    ...session,
    effectLog: [createLog(sourceName, summary, rulesConfidence), ...(session.effectLog || [])].slice(0, 120),
    rulesConfidenceLog: [createRulesConfidenceEntry(sourceName, summary, rulesConfidence), ...(session.rulesConfidenceLog || [])].slice(0, 160),
  };
}

function queueSpellRecovery(session, source = {}, message = "Spell resolution needs attention.", severity = "warning") {
  return {
    ...session,
    recoveryLog: [
      {
        id: createId("recovery"),
        source: source.name || "Spell Stack",
        message,
        technicalMessage: message,
        severity,
        timestamp: Date.now(),
        suggestedAction: "Open Stack/Priority or Manual Choice Required.",
        action: "open-manual-choice",
        dismissed: false,
      },
      ...(session.recoveryLog || []),
    ].slice(0, 80),
  };
}

function createRulesConfidenceEntry(sourceName, summary, rulesConfidence) {
  return {
    id: createId("confidence"),
    at: Date.now(),
    sourceName,
    summary,
    status: rulesConfidence === RULES_CONFIDENCE.AUTO_RESOLVED ? "resolved" : "pending",
    rulesConfidence,
  };
}

function createTokens(session, effect, source, event) {
  const targetController =
    effect.controller === "target-controller"
      ? getAllPermanents(session).find((permanent) => (event.targetIds || session.selectedIds || []).includes(permanent.id))?.controller
      : "";
  const controller = targetController || effect.controller || source.controller || "player";
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
    stackObjectId: event.stackObjectId || "",
    oracleText: source.oracleText || "",
    controller: source.controller || "player",
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
  const amount = resolveVariableNumber(effect.amount, effect.amountFrom, event);
  const total = amount * repeats;
  const controller = source.controller || "player";
  let next = session;
  if (controller === "player" || controller === "local-player") {
    next = { ...next, life: Math.max(0, next.life + total) };
  } else if (next.simulation?.players?.[controller]) {
    next = updateSimulationPlayerLife(next, controller, total);
  }
  next = { ...next, effectLog: [createLog(source.name, `Life changed by ${total}.`), ...(next.effectLog || [])].slice(0, 60) };
  return appendDebugTrace(next, "life-applied", { source: source.name, amount: total, repeats });
}

function applyLifeLossEffect(session, effect, source, event = {}) {
  const amount = resolveVariableNumber(effect.amount, effect.amountFrom, event);
  let next = session;
  const targets = resolvePlayerTargets(session, source.controller, effect.target);
  targets.forEach((playerId) => {
    if (playerId === "local-player" || playerId === "player") {
      next = { ...next, life: Math.max(0, Number(next.life || 0) - amount) };
    } else if (next.simulation?.players?.[playerId]) {
      next = updateSimulationPlayerLife(next, playerId, -amount);
    }
  });
  return appendEffectResult(next, source.name, `${targets.length} player(s) lost ${amount} life.`);
}

function applyDamageEffect(session, effect, source, event = {}) {
  const repeats = Math.max(1, normalizeCount(event.payload?.instances ?? event.instances, 1));
  const amount = resolveVariableNumber(effect.amount, effect.amountFrom, event);
  const total = amount * repeats;
  let next = session;
  const selectedPlayerIds =
    effect.target === "selected"
      ? (event.targetIds || []).filter(
          (id) => id === "local-player" || id === "player" || id === "opponent" || Boolean(session.simulation?.players?.[id])
        )
      : [];
  if (selectedPlayerIds.length) {
    selectedPlayerIds.forEach((playerId) => {
      if (playerId === "local-player" || playerId === "player") {
        next = { ...next, life: Math.max(0, Number(next.life || 0) - total) };
      } else if (next.simulation?.players?.[playerId]) {
        next = updateSimulationPlayerLife(next, playerId, -total);
      } else {
        const current = normalizeCount(next.commander?.damageByOpponent?.opponent, 0);
        next = {
          ...next,
          commander: {
            ...next.commander,
            damageByOpponent: { ...(next.commander?.damageByOpponent || {}), opponent: current + total },
          },
        };
      }
    });
    next = appendEffectResult(next, source.name, `Dealt ${total} damage to ${selectedPlayerIds.length} player(s).`);
  }
  const selectedPermanentIds = (event.targetIds || []).filter((id) => !selectedPlayerIds.includes(id));
  if (
    String(effect.target || "").includes("creature") ||
    (effect.target === "selected" && selectedPermanentIds.length) ||
    effect.target === "all-creatures"
  ) {
    const targets = getTargets(
      next,
      effect.target === "selected-creature" ? "selected-creature" : effect.target,
      source,
      effect.target === "selected" ? { ...event, targetIds: selectedPermanentIds } : event
    );
    const ids = new Set(targets.map((target) => target.id));
    const lethalIds = [];
    const mark = (permanent) => {
      if (!ids.has(permanent.id)) return permanent;
      const markedDamage = Number(permanent.markedDamage || 0) + total;
      if (permanent.isCreature && markedDamage >= Number(permanent.currentToughness || permanent.baseToughness || 0)) {
        lethalIds.push(permanent.id);
      }
      return createPermanent({ ...permanent, markedDamage });
    };
    next = {
      ...next,
      battlefield: {
        ...next.battlefield,
        player: (next.battlefield.player || []).map(mark),
        opponent: (next.battlefield.opponent || []).map(mark),
      },
    };
    if (lethalIds.length) {
      next = applyRemovalEffect(next, { action: "remove-permanent", mode: "destroy", target: "selected", manual: false }, source, { ...event, targetIds: lethalIds });
    }
    next = appendEffectResult(next, source.name, `Dealt ${total} damage to ${targets.length} creature(s).`);
  } else if (!selectedPlayerIds.length) {
    const playerTargets = resolvePlayerTargets(next, source.controller, effect.target === "opponent" ? "target-opponent" : effect.target);
    playerTargets.forEach((playerId) => {
      if (playerId === "local-player" || playerId === "player") {
        next = { ...next, life: Math.max(0, Number(next.life || 0) - total) };
      } else if (next.simulation?.players?.[playerId]) {
        next = updateSimulationPlayerLife(next, playerId, -total);
      } else {
        const current = normalizeCount(next.commander?.damageByOpponent?.opponent, 0);
        next = {
          ...next,
          commander: {
            ...next.commander,
            damageByOpponent: { ...(next.commander?.damageByOpponent || {}), opponent: current + total },
          },
        };
      }
    });
    next = appendEffectResult(next, source.name, `Dealt ${total} damage to ${playerTargets.length} player target(s).`);
  }
  return appendDebugTrace(next, "damage-applied", { source: source.name, amount: total, target: effect.target, repeats });
}

function updateSimulationPlayerLife(session, playerId, delta) {
  const player = session.simulation?.players?.[playerId];
  if (!player) return session;
  const life = Math.max(0, Number(player.life || 0) + Number(delta || 0));
  const players = {
    ...session.simulation.players,
    [playerId]: { ...player, life, eliminated: life <= 0 || Boolean(player.eliminated) },
  };
  const opponents = { ...(session.simulation.opponents || {}) };
  if (opponents[playerId]) opponents[playerId] = { ...opponents[playerId], life, updatedAt: Date.now() };
  return {
    ...session,
    life: playerId === "local-player" ? life : session.life,
    simulation: { ...session.simulation, players, opponents, updatedAt: Date.now() },
  };
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

  const modified = {
    ...session,
    battlefield: {
      ...session.battlefield,
      player: session.battlefield.player.map(apply),
      opponent: session.battlefield.opponent.map(apply),
    },
    effectLog: [createLog(source.name, `Applied ${effect.power}/${effect.toughness} temporary modifier.`), ...session.effectLog].slice(0, 60),
  };
  const recalculated = recalculateContinuousEffects(modified);
  const zeroToughnessIds = getAllPermanents(recalculated)
    .filter((permanent) => permanent.isCreature && Number(permanent.currentToughness || 0) <= 0)
    .map((permanent) => permanent.id);
  return zeroToughnessIds.length
    ? applyRemovalEffect(recalculated, { action: "remove-permanent", mode: "state-based", target: "selected", manual: false }, source, { targetIds: zeroToughnessIds })
    : recalculated;
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
