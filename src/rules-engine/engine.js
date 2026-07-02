import {
  castSpellToStack as legacyCastSpellToStack,
  hydratePermanentEffects,
  passStackPriority as legacyPassStackPriority,
  processEventTriggers as legacyProcessEventTriggers,
  recalculateContinuousEffects as legacyRecalculateContinuousEffects,
  resolveQueuedTrigger as legacyResolveQueuedTrigger,
  resolveSpell as legacyResolveSpell,
  resolveTopOfStack as legacyResolveTopOfStack,
} from "../effects/effectEngine.js";
import { getTargets, suggestLegalAttachments, suggestLikelyTargets } from "../effects/targeting.js";
import {
  assignBlocker as legacyAssignBlocker,
  autoAssignBlockers as legacyAutoAssignBlockers,
  calculateCombatDamage as legacyCalculateCombatDamage,
  canBlock,
  confirmBlockers as legacyConfirmBlockers,
  declareAttackers as legacyDeclareAttackers,
  declareNoBlockers as legacyDeclareNoBlockers,
  resolveCombat as legacyResolveCombat,
} from "../game/combatSystem.js";
import { chooseEntryResult, preparePermanentEntry } from "../game/entrySystem.js";
import { getPermanentManaOptions, parseManaRequirements, planManaPayment } from "../game/manaSystem.js";
import { transitionFsm } from "../game/fsm.js";
import { createId } from "../state/ids.js";
import { createManaPool, createPermanent } from "../state/schema.js";
import { RULES_CONFIDENCE } from "../support/debugExport.js";

export const RULES_ENGINE_VERSION = "boardstate-rules-engine-0.1.0";

export function getRulesEngineVersion() {
  return RULES_ENGINE_VERSION;
}

export function validateAction(state = {}, action = {}, context = {}) {
  const actionType = normalizeActionType(action);
  const violations = [];
  const warnings = [];
  const requiredChoices = [];

  if (!state || typeof state !== "object") {
    return buildValidationResult(false, ["missing-state"], warnings, requiredChoices, actionType);
  }

  if (actionType === "CAST_SPELL") {
    const card = action.card || action.sourceCard;
    if (!card) violations.push("missing-card");
    if (card?.isLand || /\bLand\b/i.test(card?.typeLine || "")) violations.push("lands-are-not-cast");
    const shouldRequireMana = context.requireMana ?? Boolean(state.gameTracking?.active || state.simulation?.enabled);
    const controller = action.controller || "player";
    if (shouldRequireMana && isLocalController(controller)) {
      const payment = calculateManaPayment(state, {
        controller,
        manaCost: card?.manaCost || "",
        xValue: action.xValue,
      });
      if (!payment.verified) violations.push(payment.reason || "mana-payment-failed");
    }
  }

  if (actionType === "PLAY_LAND" || actionType === "PUT_ONTO_BATTLEFIELD" || actionType === "ADD_PERMANENT") {
    if (!action.card && !action.permanent) violations.push("missing-card");
  }

  if (actionType === "TAP_PERMANENT") {
    const permanent = getPermanentById(state, action.id || action.permanentId);
    if (!permanent) violations.push("missing-permanent");
    if (permanent?.tapped) violations.push("already-tapped");
  }

  if (actionType === "DECLARE_ATTACKERS") {
    const attackerIds = action.ids || action.attackerIds || [];
    const attackers = attackerIds.map((id) => getPermanentById(state, id)).filter(Boolean);
    if (!attackers.length) warnings.push("no-legal-attackers-selected");
    attackers.forEach((attacker) => {
      if (!attacker.isCreature) violations.push(`${attacker.name}:not-a-creature`);
      if (attacker.tapped) violations.push(`${attacker.name}:tapped`);
      if (attacker.summoningSick && !hasKeyword(attacker, "haste")) warnings.push(`${attacker.name}:summoning-sick`);
    });
  }

  if (actionType === "ASSIGN_BLOCKER") {
    const attacker = getPermanentById(state, action.attackerId);
    const blocker = getPermanentById(state, action.blockerId);
    if (!attacker || !blocker) violations.push("missing-combatant");
    if (attacker && blocker && !canBlock(attacker, blocker)) violations.push("illegal-block");
  }

  if (actionType === "RESOLVE_STACK_OBJECT" || actionType === "RESOLVE_TOP_SPELL") {
    if (!(state.stack || []).length) warnings.push("empty-stack");
  }

  return buildValidationResult(!violations.length, violations, warnings, requiredChoices, actionType);
}

export function resolveAction(state = {}, action = {}, context = {}) {
  const validation = validateAction(state, action, context);
  if (!validation.legal && !context.allowIllegal) {
    return buildEngineResult(state, validation, [], []);
  }

  const actionType = normalizeActionType(action);
  let nextState = state;
  let generatedEvents = [];

  switch (actionType) {
    case "CAST_SPELL": {
      const paid = context.skipManaPayment
        ? { state, verified: false, sourceIds: [] }
        : payManaForAction(state, action, context);
      nextState = legacyCastSpellToStack(paid.state, action.card, {
        controller: action.controller || "player",
        owner: action.owner || action.controller || "player",
        sourceZone: action.sourceZone || "hand",
        targetIds: action.targetIds || state.selectedIds || [],
        targetStackId: action.targetStackId || "",
        selectedModes: action.selectedModes || [],
        xValue: action.xValue,
        additionalCosts: action.additionalCosts || {},
        castPermission: action.castPermission || "",
        manaPaymentVerified: paid.verified,
        manaPaymentSources: paid.sourceIds,
      });
      generatedEvents = [{ eventType: "SPELL_CAST", sourceId: nextState.stack?.[0]?.id || "", actionType }];
      break;
    }
    case "PASS_PRIORITY":
      nextState = legacyPassStackPriority(state, action.playerId || "local-player");
      generatedEvents = [{ eventType: "PRIORITY_CHANGED", actionType }];
      break;
    case "RESOLVE_STACK_OBJECT":
    case "RESOLVE_TOP_SPELL":
      nextState = legacyResolveTopOfStack(state, {
        stackId: action.stackId || "",
        autoChoose: Boolean(action.autoChoose),
      });
      generatedEvents = [{ eventType: "STACK_OBJECT_RESOLVED", actionType }];
      break;
    case "DECLARE_ATTACKERS":
      nextState = legacyDeclareAttackers(state, action.ids || action.attackerIds || [], {
        defendingPlayerId: action.defendingPlayerId || "opponent",
        attackingPlayerId: action.attackingPlayerId || "local-player",
        attackTargetsByAttacker: action.attackTargetsByAttacker || {},
      });
      generatedEvents = [{ eventType: "ATTACKERS_DECLARED", actionType }];
      break;
    case "ASSIGN_BLOCKER":
      nextState = legacyAssignBlocker(state, action.attackerId, action.blockerId);
      generatedEvents = [{ eventType: "BLOCKERS_DECLARED", actionType }];
      break;
    case "NO_BLOCKERS":
      nextState = legacyDeclareNoBlockers(state);
      generatedEvents = [{ eventType: "BLOCKERS_DECLARED", actionType }];
      break;
    case "CONFIRM_BLOCKERS":
      nextState = legacyConfirmBlockers(state);
      generatedEvents = [{ eventType: "BLOCKERS_DECLARED", actionType }];
      break;
    case "RESOLVE_COMBAT":
      nextState = legacyResolveCombat(state);
      generatedEvents = [{ eventType: "COMBAT_DAMAGE_DEALT", actionType }];
      break;
    case "ADVANCE_PHASE":
      nextState = advanceRulesPhase(state);
      generatedEvents = [{ eventType: "PHASE_CHANGED", actionType }];
      break;
    case "ADD_PERMANENT":
    case "PUT_ONTO_BATTLEFIELD":
    case "PLAY_LAND":
      nextState = putPermanentOntoBattlefield(state, action.card || action.permanent, action.controller || "player");
      generatedEvents = [{ eventType: "PERMANENT_ENTERED", actionType }];
      break;
    default:
      return buildEngineResult(state, {
        ...validation,
        unsupported: true,
        manualReview: true,
        explanation: `Action ${actionType || "UNKNOWN"} is not resolved by the extracted engine yet.`,
      }, [], []);
  }

  return buildEngineResult(nextState, validation, generatedEvents, [], performStateBasedActions(nextState).stateBasedActions);
}

export function applyEvent(state = {}, event = {}) {
  const nextState = legacyProcessEventTriggers(state, event);
  return buildEngineResult(nextState, buildValidationResult(true, [], [], [], "APPLY_EVENT"), [event], nextState.triggerQueue || []);
}

export function collectTriggers(state = {}, event = {}) {
  const beforeIds = new Set((state.triggerQueue || []).map((entry) => entry.id));
  const nextState = legacyProcessEventTriggers(state, event);
  const generatedTriggers = (nextState.triggerQueue || []).filter((entry) => !beforeIds.has(entry.id));
  return { state: nextState, triggers: generatedTriggers, rulesEngineVersion: RULES_ENGINE_VERSION };
}

export function performStateBasedActions(state = {}) {
  const stateBasedActions = [];
  const mapSide = (side = []) =>
    side
      .filter((permanent) => {
        if (permanent.isToken && permanent.zone && permanent.zone !== "battlefield") {
          stateBasedActions.push(createStateBasedAction("token-ceased", permanent));
          return false;
        }
        if (permanent.isPlaneswalker && Number(permanent.counters?.Loyalty || 0) <= 0) {
          stateBasedActions.push(createStateBasedAction("planeswalker-zero-loyalty", permanent));
          return false;
        }
        const toughness = Number(permanent.currentToughness ?? permanent.baseToughness ?? permanent.toughness ?? 0);
        if (permanent.isCreature && toughness <= 0) {
          stateBasedActions.push(createStateBasedAction("zero-toughness", permanent));
          return false;
        }
        if (permanent.isCreature && Number(permanent.markedDamage || 0) >= toughness && toughness > 0) {
          stateBasedActions.push(createStateBasedAction("lethal-damage", permanent));
          return false;
        }
        return true;
      })
      .map((permanent) => createPermanent(permanent));

  const nextState = {
    ...state,
    battlefield: {
      ...(state.battlefield || {}),
      player: mapSide(state.battlefield?.player || []),
      opponent: mapSide(state.battlefield?.opponent || []),
    },
  };
  return { state: nextState, stateBasedActions, stable: stateBasedActions.length === 0, rulesEngineVersion: RULES_ENGINE_VERSION };
}

export function recalculateContinuousEffects(state = {}) {
  return legacyRecalculateContinuousEffects(state);
}

export function calculateLegalTargets(state = {}, source = null, targetSelector = "all-creatures", context = {}) {
  const validTargets = getTargets(state, targetSelector, source, context);
  const validIds = new Set(validTargets.map((target) => target.id));
  const invalidTargets = getAllPermanents(state)
    .filter((permanent) => !validIds.has(permanent.id))
    .map((permanent) => ({ id: permanent.id, name: permanent.name, reason: "does-not-match-target-selector" }));
  return {
    validTargets,
    invalidTargets,
    minTargets: validTargets.length ? 1 : 0,
    maxTargets: validTargets.length ? 1 : 0,
    targetSelector,
    rulesEngineVersion: RULES_ENGINE_VERSION,
  };
}

export function calculateCombat(state = {}) {
  return {
    ...legacyCalculateCombatDamage(state),
    rulesEngineVersion: RULES_ENGINE_VERSION,
  };
}

export function calculateManaPayment(state = {}, request = {}) {
  return {
    ...planManaPayment(state, request.controller || "player", request.manaCost || "", request.xValue || 0),
    rulesEngineVersion: RULES_ENGINE_VERSION,
  };
}

export function payManaForAction(state = {}, action = {}, context = {}) {
  const controller = action.controller || context.controller || "player";
  const requireMana = context.requireMana ?? Boolean(state.gameTracking?.active || state.simulation?.enabled);
  if (!requireMana || !isLocalController(controller)) {
    return { state, verified: false, sourceIds: [], payment: null };
  }
  const payment = calculateManaPayment(state, {
    controller,
    manaCost: action.card?.manaCost || action.manaCost || "",
    xValue: action.xValue || 0,
  });
  if (!payment.verified) {
    return { state, verified: false, sourceIds: [], payment };
  }
  return {
    state: applyManaPaymentToState({ ...state, manaPool: payment.poolAfter }, payment.sourceIds),
    verified: true,
    sourceIds: payment.sourceIds,
    payment,
  };
}

export function applyManaPaymentToState(state = {}, sourceIds = []) {
  return sourceIds.reduce((currentState, sourceId) => updateOnePermanent(currentState, sourceId, (permanent) => ({
    ...permanent,
    tapped: true,
    attacking: false,
    blocking: false,
  })), state);
}

export function serializeEngineState(state = {}) {
  return JSON.stringify({
    rulesEngineVersion: RULES_ENGINE_VERSION,
    state,
  });
}

export function deserializeEngineState(payload = "") {
  if (!payload) return { rulesEngineVersion: RULES_ENGINE_VERSION, state: {} };
  const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
  return {
    rulesEngineVersion: parsed.rulesEngineVersion || RULES_ENGINE_VERSION,
    state: parsed.state || parsed,
  };
}

export function explainRuleResult(result = {}) {
  if (result.explanation) return result.explanation;
  if (result.validation?.violations?.length) {
    return `Illegal action: ${result.validation.violations.join(", ")}.`;
  }
  if (result.validation?.warnings?.length) {
    return `Legal with warning: ${result.validation.warnings.join(", ")}.`;
  }
  if (result.validation?.requiredChoices?.length) {
    return `Legal action requires choices: ${result.validation.requiredChoices.join(", ")}.`;
  }
  return "Action accepted by the BoardState rules engine.";
}

export {
  chooseEntryResult,
  getPermanentManaOptions,
  hydratePermanentEffects,
  legacyAssignBlocker as assignBlocker,
  legacyAutoAssignBlockers as autoAssignBlockers,
  legacyCalculateCombatDamage as calculateCombatDamage,
  legacyCastSpellToStack as castSpellToStack,
  legacyConfirmBlockers as confirmBlockers,
  legacyDeclareAttackers as declareAttackers,
  legacyDeclareNoBlockers as declareNoBlockers,
  legacyPassStackPriority as passStackPriority,
  legacyProcessEventTriggers as processEventTriggers,
  legacyRecalculateContinuousEffects as legacyContinuousEffects,
  legacyResolveCombat as resolveCombat,
  legacyResolveQueuedTrigger as resolveQueuedTrigger,
  legacyResolveSpell as resolveSpell,
  legacyResolveTopOfStack as resolveTopOfStack,
  parseManaRequirements,
  planManaPayment,
  preparePermanentEntry,
  suggestLegalAttachments,
  suggestLikelyTargets,
};

function buildValidationResult(legal, violations = [], warnings = [], requiredChoices = [], actionType = "") {
  return {
    actionType,
    legal,
    status: !legal ? "illegal" : requiredChoices.length ? "needs-choices" : warnings.length ? "legal-warning" : "legal",
    violations,
    warnings,
    requiredChoices,
    manualReview: false,
    unsupported: false,
    rulesEngineVersion: RULES_ENGINE_VERSION,
  };
}

function buildEngineResult(nextState, validation, generatedEvents = [], generatedTriggers = [], stateBasedActions = []) {
  return {
    legal: validation.legal,
    nextState,
    validation,
    violations: validation.violations || [],
    warnings: validation.warnings || [],
    requiredChoices: validation.requiredChoices || [],
    generatedEvents,
    generatedTriggers,
    stateBasedActions,
    stackChanges: summarizeStack(nextState),
    priorityChanges: nextState?.priority || null,
    rulesExplanation: explainRuleResult({ validation }),
    unsupported: Boolean(validation.unsupported),
    manualReview: Boolean(validation.manualReview),
    revisionMetadata: {
      rulesEngineVersion: RULES_ENGINE_VERSION,
      resolvedAt: Date.now(),
    },
  };
}

function normalizeActionType(action = {}) {
  const type = action.actionType || action.type || "";
  if (type === "ADD_PERMANENT" && (action.card?.isLand || /\bLand\b/i.test(action.card?.typeLine || ""))) return "PLAY_LAND";
  return String(type || "").trim().toUpperCase();
}

function putPermanentOntoBattlefield(state = {}, card = {}, controller = "player") {
  const entry = preparePermanentEntry(card, controller);
  const permanent = hydratePermanentEffects(entry.permanent);
  const side = isLocalController(controller) ? "player" : "opponent";
  const battlefield = state.battlefield || { player: [], opponent: [] };
  const nextState = {
    ...state,
    pendingEffects: entry.choice ? [entry.choice, ...(state.pendingEffects || [])].slice(0, 120) : state.pendingEffects || [],
    battlefield: {
      ...battlefield,
      [side]: stackPermanent(battlefield[side] || [], permanent),
    },
  };
  const eventType = permanent.isLand ? "LAND_ENTERED_BATTLEFIELD" : "ENTER_BATTLEFIELD";
  return legacyProcessEventTriggers(nextState, {
    type: permanent.isLand ? "land-entered-battlefield" : "enter-battlefield",
    eventType,
    source: permanent,
    payload: { permanent, controller, instances: permanent.quantity || 1 },
  });
}

function advanceRulesPhase(state = {}) {
  const transitioned = transitionFsm(state);
  return {
    ...transitioned,
    manaPool: createManaPool(),
  };
}

function updateOnePermanent(state = {}, id = "", updater = (permanent) => permanent) {
  const mapSide = (side = []) => side.map((permanent) => permanent.id === id ? hydratePermanentEffects(updater(permanent)) : permanent);
  return legacyRecalculateContinuousEffects({
    ...state,
    battlefield: {
      ...(state.battlefield || {}),
      player: mapSide(state.battlefield?.player || []),
      opponent: mapSide(state.battlefield?.opponent || []),
    },
  });
}

function stackPermanent(permanents = [], incoming = {}) {
  const matchIndex = permanents.findIndex((permanent) =>
    permanent.name === incoming.name &&
    permanent.typeLine === incoming.typeLine &&
    permanent.controller === incoming.controller &&
    !permanent.tapped &&
    !incoming.tapped &&
    !permanent.isToken &&
    !incoming.isToken
  );
  if (matchIndex < 0) return [...permanents, incoming];
  return permanents.map((permanent, index) => index === matchIndex
    ? createPermanent({
        ...permanent,
        quantity: Math.max(1, Number(permanent.quantity || 1)) + Math.max(1, Number(incoming.quantity || 1)),
      })
    : permanent);
}

function summarizeStack(state = {}) {
  const stack = state.stack || [];
  return {
    count: stack.length,
    topObjectId: stack[0]?.id || "",
    topObjectName: stack[0]?.name || "",
  };
}

function getPermanentById(state = {}, id = "") {
  return getAllPermanents(state).find((permanent) => permanent.id === id) || null;
}

function getAllPermanents(state = {}) {
  return [...(state.battlefield?.player || []), ...(state.battlefield?.opponent || [])];
}

function createStateBasedAction(action, permanent) {
  return {
    id: createId("sba"),
    action,
    objectId: permanent.id,
    objectName: permanent.name,
    rulesConfidence: RULES_CONFIDENCE.AUTO_RESOLVED,
  };
}

function isLocalController(controller = "") {
  return controller === "player" || controller === "local-player";
}

function hasKeyword(permanent = {}, keyword = "") {
  const needle = String(keyword || "").toLowerCase();
  return (permanent.keywords || []).some((entry) => String(entry || "").toLowerCase() === needle) ||
    String(permanent.oracleText || "").toLowerCase().includes(needle);
}
