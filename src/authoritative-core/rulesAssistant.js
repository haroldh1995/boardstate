import { PHASES } from "../state/schema.js";
import {
  EXECUTION_CONFIDENCE_LEVELS,
  INFORMATION_CONFIDENCE_LEVELS,
  QUESTION_SYSTEM_TYPES,
} from "../shared-contracts/commanderModernization.js";
import { clonePlain } from "../shared-contracts/index.js";
import { EFFECT_LAYERS } from "../effects/layerSystem.js";
import {
  createDeterministicKnowledgeId,
  createEventKnowledgeState,
  reconstructStateAfterEvent,
} from "./eventKnowledgeEngine.js";

export const RULES_ASSISTANT_VERSION = "boardstate-rules-assistant-0.1.0";
export const QUESTION_SYSTEM_VERSION = "boardstate-question-system-0.1.0";

export const EXPLANATION_LEVELS = Object.freeze(["beginner", "intermediate", "advanced"]);

const COMMON_QUESTION_PROMPTS = Object.freeze([
  "What happened?",
  "What is on the stack?",
  "Who controls this?",
  "Why is this power and toughness?",
  "Why did this trigger?",
  "What changed?",
  "What if I took a different action?",
]);

const PRIVATE_ZONE_NAMES = Object.freeze(["hand", "library", "sideboard", "hidden", "face-down"]);

export function createRulesAssistantState(session = {}, options = {}) {
  const questionContext = createQuestionContext(session, options);
  const selected = questionContext.selectedPermanent;
  const hasStack = questionContext.stackObjects.length > 0;
  const hasTriggers = questionContext.triggerQueue.length > 0;
  const latestEvent = questionContext.latestEvent;
  const commonQuestions = [
    selected ? "Who controls this?" : "",
    selected ? "Why is this power and toughness?" : "",
    selected ? "What abilities does this currently have?" : "",
    hasStack ? "What is on the stack?" : "",
    hasTriggers ? "Why did this trigger?" : "",
    latestEvent ? "What happened?" : "What is true right now?",
    "What if I took a different action?",
  ].filter(Boolean);

  return {
    version: RULES_ASSISTANT_VERSION,
    questionSystemVersion: QUESTION_SYSTEM_VERSION,
    mode: "authoritative-explainable-gameplay",
    available: true,
    derivedFromAuthoritativeData: true,
    generativeAiEnabled: false,
    externalSearchEnabled: false,
    mutatesGameState: false,
    explanationLevel: normalizeExplanationLevel(options.explanationLevel || "intermediate"),
    supportedQuestionTypes: [...QUESTION_SYSTEM_TYPES],
    commonQuestions: commonQuestions.length ? commonQuestions : [...COMMON_QUESTION_PROMPTS],
    context: {
      selectedPermanentId: selected?.id || "",
      selectedPermanentName: selected?.name || "",
      stackCount: questionContext.stackObjects.length,
      triggerCount: questionContext.triggerQueue.length,
      eventCount: questionContext.eventKnowledge.events.length,
      turn: Number(session.turn || 1),
      phase: resolvePhaseLabel(session),
    },
    searchScopes: [
      "Rules",
      "Oracle",
      "Cards",
      "Battlefield",
      "Stack",
      "Triggers",
      "History",
      "Commander",
    ],
    privacy: {
      hiddenZonesExcluded: true,
      rawPayloadsExcluded: true,
      opponentPrivateInformationExcluded: true,
    },
  };
}

export function createQuestionContext(session = {}, options = {}) {
  const eventKnowledge = createEventKnowledgeState(session.eventKnowledge || {});
  const allPermanents = collectVisiblePermanents(session, options);
  const selectedPermanentId =
    options.selectedPermanentId ||
    firstString(session.selectedIds) ||
    firstString(options.selectedIds) ||
    "";
  const selectedPermanent =
    allPermanents.find((permanent) => permanent.id === selectedPermanentId) ||
    (options.permanentId ? allPermanents.find((permanent) => permanent.id === options.permanentId) : null) ||
    null;

  return {
    session,
    sessionId: session.sessionId || session.id || "",
    gameId: session.gameId || session.id || "",
    turn: Number(session.turn || 1),
    phase: resolvePhaseLabel(session),
    step: session.step || "",
    eventKnowledge,
    allPermanents,
    selectedPermanent,
    stackObjects: clonePlain(session.stack || []),
    triggerQueue: clonePlain(session.triggerQueue || []).filter((entry) => entry && !isResolvedStatus(entry.status)),
    latestEvent: eventKnowledge.events[0] || null,
  };
}

export function normalizeExplanationLevel(level = "intermediate") {
  const normalized = String(level || "").trim().toLowerCase();
  return EXPLANATION_LEVELS.includes(normalized) ? normalized : "intermediate";
}

export function askRulesQuestion(session = {}, question = "", options = {}) {
  const context = createQuestionContext(session, options);
  const originalQuestion = String(question || "").trim();
  const questionType = classifyQuestion(originalQuestion);
  const explanationLevel = normalizeExplanationLevel(options.explanationLevel || "intermediate");
  const base = createAnswerShell({
    session,
    context,
    questionType,
    originalQuestion,
    explanationLevel,
  });

  if (!originalQuestion) {
    return withAnswer(base, {
      headline: "Ask about the current game.",
      shortAnswer: "Choose a common question or ask about a selected card, stack object, trigger, event, or Commander status.",
      detail: "The assistant only uses BoardState rules, state, and event history. It will say when there is not enough authoritative evidence.",
      confidence: confidence("engine-verified", "tracking-only"),
      followUps: COMMON_QUESTION_PROMPTS,
    });
  }

  const normalized = originalQuestion.toLowerCase();
  if (questionType === "what-if" || /\bwhat if\b/.test(normalized)) {
    return answerWhatIfFoundation(base, context, originalQuestion);
  }
  if (/\bstack\b/.test(normalized)) {
    return answerStackQuestion(base, context);
  }
  if (/\btrigger(ed|s| queue)?\b/.test(normalized)) {
    return answerTriggerQuestion(base, context, options);
  }
  if (/\bwhat happened\b|\bwhat just resolved\b|\bwhat changed\b|\bhistory\b|\bevent\b/.test(normalized)) {
    return answerEventQuestion(base, context, options);
  }
  if (/\bcast\b/.test(normalized) && /\b(can't|cannot|cant|illegal|why)\b/.test(normalized)) {
    return answerCastingLegalityQuestion(base, context);
  }
  if (/\bpower\b|\btoughness\b|\b[0-9]+\/[0-9]+\b|\blayer\b|\b7\/7\b/.test(normalized)) {
    return answerPermanentLayerQuestion(base, context);
  }
  if (/\bwho\b|\bcontrol(s|ler)?\b|\bown(s|er)?\b/.test(normalized)) {
    return answerPermanentRelationshipQuestion(base, context);
  }
  if (/\bwhy\b/.test(normalized)) {
    return answerWhyQuestion(base, context);
  }
  if (/\bwhat\b/.test(normalized)) {
    return answerWhatQuestion(base, context);
  }
  if (/\bwhere\b/.test(normalized)) {
    return answerWhereQuestion(base, context);
  }
  if (/\bwhen\b/.test(normalized)) {
    return answerWhenQuestion(base, context);
  }
  if (/\bhow\b/.test(normalized)) {
    return answerHowQuestion(base, context);
  }
  return answerUnknownQuestion(base, context);
}

export function explainPermanent(session = {}, permanentId = "", options = {}) {
  const context = createQuestionContext(session, { ...options, permanentId, selectedPermanentId: permanentId });
  const base = createAnswerShell({
    session,
    context,
    questionType: "what",
    originalQuestion: `Explain ${context.selectedPermanent?.name || permanentId || "this permanent"}`,
    explanationLevel: options.explanationLevel,
  });
  return answerWhatQuestion(base, context);
}

export function explainStackObject(session = {}, stackObjectId = "", options = {}) {
  const context = createQuestionContext(session, options);
  const stackObject = context.stackObjects.find((entry) => (entry.id || entry.stackObjectId) === stackObjectId) || context.stackObjects[0] || null;
  const base = createAnswerShell({
    session,
    context,
    questionType: "what",
    originalQuestion: `Explain ${stackObject?.name || stackObjectId || "the stack"}`,
    explanationLevel: options.explanationLevel,
  });
  return answerStackQuestion(base, { ...context, stackObjects: stackObject ? [stackObject] : [] });
}

export function explainTrigger(session = {}, triggerId = "", options = {}) {
  const context = createQuestionContext(session, options);
  const trigger = context.triggerQueue.find((entry) => entry.id === triggerId) || context.triggerQueue[0] || null;
  const base = createAnswerShell({
    session,
    context,
    questionType: "why",
    originalQuestion: `Explain ${trigger?.sourceName || triggerId || "this trigger"}`,
    explanationLevel: options.explanationLevel,
  });
  return answerTriggerQuestion(base, { ...context, triggerQueue: trigger ? [trigger] : [] });
}

export function explainEvent(session = {}, eventId = "", options = {}) {
  const context = createQuestionContext(session, options);
  const event = context.eventKnowledge.events.find((entry) => entry.eventId === eventId) || context.latestEvent || null;
  const base = createAnswerShell({
    session,
    context,
    questionType: "what",
    originalQuestion: `Explain ${event?.what?.summary || eventId || "the latest event"}`,
    explanationLevel: options.explanationLevel,
  });
  return answerEventQuestion(base, context, { ...options, eventId: event?.eventId || eventId });
}

export function explainLayerBreakdown(permanent = {}, session = {}, options = {}) {
  const level = normalizeExplanationLevel(options.explanationLevel);
  const breakdown = normalizeLayerBreakdown(permanent);
  const counters = summarizeCounters(permanent);
  const basePower = firstNumber(permanent.basePower, permanent.printedPower, permanent.power, permanent.currentPower);
  const baseToughness = firstNumber(permanent.baseToughness, permanent.printedToughness, permanent.toughness, permanent.currentToughness);
  const currentPower = firstNumber(permanent.currentPower, permanent.power, basePower);
  const currentToughness = firstNumber(permanent.currentToughness, permanent.toughness, baseToughness);
  const summaries = [
    Number.isFinite(basePower) && Number.isFinite(baseToughness)
      ? `Base power/toughness starts at ${basePower}/${baseToughness}.`
      : "",
    ...breakdown.map((entry) => summarizeLayerEntry(entry)),
    counters.length && !breakdown.some((entry) => Number(entry.layer) === 9)
      ? `Counters currently present: ${counters.map((entry) => `${entry.counterType} ${entry.value}`).join(", ")}.`
      : "",
    Number.isFinite(currentPower) && Number.isFinite(currentToughness)
      ? `Final displayed power/toughness is ${currentPower}/${currentToughness}.`
      : "",
  ].filter(Boolean);

  return {
    subjectId: permanent.id || "",
    subjectName: permanent.name || "Permanent",
    base: Number.isFinite(basePower) && Number.isFinite(baseToughness) ? `${basePower}/${baseToughness}` : "",
    current: Number.isFinite(currentPower) && Number.isFinite(currentToughness) ? `${currentPower}/${currentToughness}` : permanent.powerToughness || "",
    layers: breakdown,
    counters,
    summary: summaries.join(" "),
    explanationLevel: level,
    ruleReferences: [
      "CR 613 - Interaction of Continuous Effects",
      counters.length ? "CR 122 - Counters" : "",
    ].filter(Boolean),
  };
}

export function searchRulesAssistant(session = {}, query = "", options = {}) {
  const context = createQuestionContext(session, options);
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) {
    return {
      query: "",
      results: [],
      scopes: createRulesAssistantState(session, options).searchScopes,
    };
  }
  const results = [];
  const addResult = (result) => {
    if (!result?.id || results.some((entry) => entry.id === result.id)) return;
    results.push(result);
  };

  COMMON_QUESTION_PROMPTS.forEach((prompt, index) => {
    if (prompt.toLowerCase().includes(needle)) {
      addResult({ id: `common:${index}`, kind: "common-question", title: prompt, summary: "Ask this contextual question." });
    }
  });
  context.allPermanents.forEach((permanent) => {
    const haystack = [permanent.name, permanent.typeLine, permanent.oracleText, permanent.rulesText, permanent.controller, permanent.owner].join(" ").toLowerCase();
    if (haystack.includes(needle)) {
      addResult({
        id: `permanent:${permanent.id}`,
        kind: "permanent",
        title: permanent.name || permanent.id,
        summary: summarizePermanent(permanent),
      });
    }
  });
  context.stackObjects.forEach((entry, index) => {
    const card = entry.card || entry;
    const haystack = [entry.name, card.name, card.oracleText, entry.summary].join(" ").toLowerCase();
    if (haystack.includes(needle)) {
      addResult({
        id: `stack:${entry.id || index}`,
        kind: "stack-object",
        title: entry.name || card.name || "Stack object",
        summary: "Object currently on the stack.",
      });
    }
  });
  context.triggerQueue.forEach((entry, index) => {
    const haystack = [entry.sourceName, entry.name, entry.eventType, entry.reason, entry.text].join(" ").toLowerCase();
    if (haystack.includes(needle)) {
      addResult({
        id: `trigger:${entry.id || index}`,
        kind: "trigger",
        title: entry.sourceName || entry.name || "Trigger",
        summary: entry.optional || entry.may ? "Optional pending trigger." : "Required pending trigger.",
      });
    }
  });
  context.eventKnowledge.events.slice(0, 100).forEach((event) => {
    const haystack = [
      event.eventId,
      event.what?.eventType,
      event.what?.summary,
      ...(event.what?.objectNames || []),
      ...(event.tags || []),
      ...(event.ruleReferences || []),
    ].join(" ").toLowerCase();
    if (haystack.includes(needle)) {
      addResult({
        id: `event:${event.eventId}`,
        kind: "event",
        title: event.what?.summary || event.what?.eventType || event.eventId,
        summary: summarizeKnowledgeEvent(event),
      });
    }
  });

  return {
    query: needle,
    resultCount: results.length,
    results: results.slice(0, Number(options.limit || 12)),
    scopes: createRulesAssistantState(session, options).searchScopes,
  };
}

export function createWhatIfFoundation(session = {}, prompt = "", options = {}) {
  const eventId = options.eventId || session.eventKnowledge?.lastEventId || "";
  const reconstruction = eventId ? reconstructStateAfterEvent(session, eventId) : { found: false };
  return {
    status: "prepared-for-dry-run",
    available: true,
    mutatesAuthoritativeSession: false,
    sourceEventId: eventId,
    reconstructionAvailable: Boolean(reconstruction.found || session),
    dryRunForkRequired: true,
    prompt: String(prompt || ""),
    safety: {
      liveSessionPreserved: true,
      eventHistoryPreserved: true,
      syncStateNotChanged: true,
    },
  };
}

function createAnswerShell({ session = {}, context = {}, questionType = "what", originalQuestion = "", explanationLevel = "intermediate" } = {}) {
  const normalizedType = QUESTION_SYSTEM_TYPES.includes(questionType) ? questionType : "what";
  return {
    questionId: createDeterministicKnowledgeId("eventId", [
      session.sessionId || session.id || "local-session",
      String(originalQuestion || "").toLowerCase(),
      normalizedType,
      context.eventKnowledge?.lastEventId || "",
    ]),
    version: RULES_ASSISTANT_VERSION,
    questionSystemVersion: QUESTION_SYSTEM_VERSION,
    questionType: normalizedType,
    originalQuestion: String(originalQuestion || ""),
    explanationLevel: normalizeExplanationLevel(explanationLevel),
    answer: {
      headline: "",
      shortAnswer: "",
      detail: "",
      advanced: [],
      nextSteps: [],
    },
    confidence: confidence("unknown", "tracking-only"),
    evidence: [],
    ruleReferences: [],
    oracleReferences: [],
    eventChain: [],
    followUps: [],
    relatedActions: [],
    boundaries: {
      derivedFromAuthoritativeData: true,
      noGenerativeAI: true,
      noInternetSearch: true,
      mutatesGameState: false,
      hiddenInformationExcluded: true,
      rawPayloadsExcluded: true,
    },
  };
}

function withAnswer(base, patch = {}) {
  return {
    ...base,
    answer: {
      ...base.answer,
      ...(patch.answer || {}),
      headline: patch.headline ?? patch.answer?.headline ?? base.answer.headline,
      shortAnswer: patch.shortAnswer ?? patch.answer?.shortAnswer ?? base.answer.shortAnswer,
      detail: detailForLevel(base.explanationLevel, patch.detail || patch.shortAnswer || ""),
      advanced: base.explanationLevel === "advanced" ? clonePlain(patch.advanced || []) : [],
      nextSteps: clonePlain(patch.nextSteps || []),
    },
    confidence: patch.confidence || base.confidence,
    evidence: clonePlain(patch.evidence || base.evidence),
    ruleReferences: clonePlain(patch.ruleReferences || base.ruleReferences),
    oracleReferences: clonePlain(patch.oracleReferences || base.oracleReferences),
    eventChain: clonePlain(patch.eventChain || base.eventChain),
    followUps: clonePlain(patch.followUps || base.followUps),
    relatedActions: clonePlain(patch.relatedActions || base.relatedActions),
    whatIf: patch.whatIf ? clonePlain(patch.whatIf) : base.whatIf,
  };
}

function answerStackQuestion(base, context) {
  const stack = context.stackObjects || [];
  if (!stack.length) {
    return withAnswer(base, {
      headline: "The stack is empty.",
      shortAnswer: "No spell or ability is currently waiting to resolve.",
      detail: "Priority can still move around the table, but BoardState does not have any stack objects to explain right now.",
      confidence: confidence("engine-verified", "engine-validated"),
      ruleReferences: ["CR 117 - Timing and Priority", "CR 405 - Stack"],
      followUps: ["Who has priority?", "What happened?"],
    });
  }
  const stackSummaries = stack.map((entry, index) => {
    const card = entry.card || entry;
    const controller = entry.controllerName || entry.controller || entry.controllerPlayerId || "unknown controller";
    const targetText = normalizeStringArray(entry.targetNames || entry.targetIds).length
      ? ` targeting ${normalizeStringArray(entry.targetNames || entry.targetIds).join(", ")}`
      : "";
    return `${index + 1}. ${entry.name || card.name || "Stack object"} controlled by ${controller}${targetText}`;
  });
  return withAnswer(base, {
    headline: `${stack.length} object${stack.length === 1 ? "" : "s"} on the stack.`,
    shortAnswer: stackSummaries.join(" "),
    detail: "Objects resolve last-in, first-out after all players pass priority in sequence.",
    confidence: confidence("engine-verified", "engine-validated"),
    evidence: stack.map((entry, index) => createEvidence("stack-object", entry.id || `stack-${index}`, entry.name || entry.card?.name || "Stack object", "Current stack state")),
    ruleReferences: ["CR 117 - Timing and Priority", "CR 405 - Stack", "CR 608 - Resolving Spells and Abilities"],
    followUps: ["Who controls this stack object?", "What happens when it resolves?", "Can I respond?"],
  });
}

function answerTriggerQuestion(base, context) {
  const triggers = context.triggerQueue || [];
  const latestTriggerEvent = findLatestEventByTag(context.eventKnowledge.events, "trigger");
  if (!triggers.length && !latestTriggerEvent) {
    return withAnswer(base, {
      headline: "No pending trigger evidence is available.",
      shortAnswer: "BoardState does not currently have a pending trigger or recorded trigger event that proves the trigger happened.",
      detail: "This may mean nothing triggered, the trigger already resolved, or the current game history does not include enough structured detail.",
      confidence: confidence("unknown", "manual-resolution-required"),
      ruleReferences: ["CR 603 - Handling Triggered Abilities"],
      followUps: ["What happened?", "Show me history."],
    });
  }
  const rows = triggers.length
    ? triggers.map((entry) => `${entry.sourceName || entry.name || "Trigger"} is ${entry.optional || entry.may ? "optional" : "mandatory"} and currently ${entry.status || "pending"}.`)
    : [summarizeKnowledgeEvent(latestTriggerEvent)];
  return withAnswer(base, {
    headline: triggers.length ? `${triggers.length} trigger${triggers.length === 1 ? "" : "s"} pending.` : "A trigger event is recorded.",
    shortAnswer: rows.join(" "),
    detail: "Triggered abilities are created by a triggering event, then they are put on the stack at the appropriate time before players receive priority.",
    confidence: confidence(triggers.length ? "engine-verified" : latestTriggerEvent.informationConfidence, triggers.length ? "engine-validated" : latestTriggerEvent.executionConfidence),
    evidence: [
      ...triggers.map((entry, index) => createEvidence("trigger", entry.id || `trigger-${index}`, entry.sourceName || entry.name || "Trigger", entry.reason || entry.eventType || "Pending trigger queue")),
      latestTriggerEvent ? createEventEvidence(latestTriggerEvent) : null,
    ].filter(Boolean),
    ruleReferences: ["CR 603 - Handling Triggered Abilities", "CR 117 - Timing and Priority"],
    eventChain: latestTriggerEvent ? buildEventChain(context.eventKnowledge.events, latestTriggerEvent) : [],
    followUps: ["Why did this trigger?", "Can it be responded to?", "What caused that?"],
  });
}

function answerEventQuestion(base, context, options = {}) {
  const event =
    context.eventKnowledge.events.find((entry) => entry.eventId === options.eventId) ||
    context.latestEvent ||
    null;
  if (!event) {
    return withAnswer(base, {
      headline: "No structured event has been recorded yet.",
      shortAnswer: "BoardState will not invent game state. The current session does not have Event Knowledge history to explain.",
      detail: "The rules assistant can still explain the current visible battlefield, stack, and triggers.",
      confidence: confidence("unknown", "manual-resolution-required"),
      followUps: ["What is true right now?", "What is on the stack?"],
    });
  }
  const reconstruction = reconstructStateAfterEvent(context.eventKnowledge ? { eventKnowledge: context.eventKnowledge } : {}, event.eventId);
  return withAnswer(base, {
    headline: event.what?.summary || event.what?.eventType || "Event recorded.",
    shortAnswer: summarizeKnowledgeEvent(event),
    detail: "This explanation is derived from the immutable Event Knowledge record. Corrections must be represented by later events rather than editing this event.",
    confidence: confidence(event.informationConfidence, event.executionConfidence),
    evidence: [createEventEvidence(event)],
    ruleReferences: clonePlain(event.ruleReferences || []),
    eventChain: buildEventChain(context.eventKnowledge.events, event),
    advanced: [
      `Event ID: ${event.eventId}`,
      `Group ID: ${event.eventGroupId || "none"}`,
      `Reconstruction available: ${reconstruction.found ? "yes" : "not from this isolated context"}`,
    ],
    followUps: ["Why did this happen?", "What changed?", "Show me the rule."],
  });
}

function answerCastingLegalityQuestion(base, context) {
  const priorityHolder = context.session?.priority?.activePlayerId || context.session?.priorityHolderId || "";
  const selected = context.selectedPermanent;
  const stackBusy = context.stackObjects.length > 0;
  const phase = context.phase;
  const reasons = [
    priorityHolder ? `Priority is currently assigned to ${priorityHolder}.` : "The current priority holder is not explicit in this session snapshot.",
    phase ? `The current phase is ${phase}.` : "",
    stackBusy ? "There is already an object on the stack, so timing depends on priority and the type of action." : "",
    selected ? `${selected.name || "The selected object"} is currently represented as ${selected.typeLine || selected.zone || "a visible game object"}.` : "No candidate spell or card is selected.",
  ].filter(Boolean);
  return withAnswer(base, {
    headline: "Casting legality depends on priority, timing, source zone, costs, and targets.",
    shortAnswer: reasons.join(" "),
    detail: "BoardState can block illegal casts only when it has enough authoritative information about the card, source zone, timing window, costs, priority holder, and targets.",
    confidence: confidence(selected ? "inferred" : "unknown", "manual-resolution-required"),
    evidence: [
      selected ? createPermanentEvidence(selected) : null,
      ...context.stackObjects.slice(0, 1).map((entry, index) => createEvidence("stack-object", entry.id || `stack-${index}`, entry.name || entry.card?.name || "Stack object", "Existing stack object")),
    ].filter(Boolean),
    ruleReferences: ["CR 117 - Timing and Priority", "CR 601 - Casting Spells", "CR 602 - Activating Activated Abilities"],
    followUps: ["What is on the stack?", "Who has priority?", "Show me the selected card."],
  });
}

function answerPermanentLayerQuestion(base, context) {
  const permanent = context.selectedPermanent;
  if (!permanent) {
    return withAnswer(base, {
      headline: "Select a permanent to explain power and toughness.",
      shortAnswer: "BoardState needs a visible permanent before it can explain counters, continuous effects, and layer changes.",
      confidence: confidence("unknown", "tracking-only"),
      ruleReferences: ["CR 613 - Interaction of Continuous Effects"],
      followUps: ["What is true right now?", "What changed?"],
    });
  }
  const layerExplanation = explainLayerBreakdown(permanent, {}, { explanationLevel: base.explanationLevel });
  return withAnswer(base, {
    headline: `${permanent.name || "Selected permanent"} is ${layerExplanation.current || "using its current characteristics"}.`,
    shortAnswer: layerExplanation.summary || summarizePermanent(permanent),
    detail: "Power, toughness, abilities, and other characteristics are explained from the selected permanent's current characteristics, counters, and recorded layer breakdown.",
    confidence: confidence(layerExplanation.layers.length || layerExplanation.counters.length ? "engine-verified" : "inferred", "engine-validated"),
    evidence: [createPermanentEvidence(permanent)],
    ruleReferences: layerExplanation.ruleReferences,
    advanced: layerExplanation.layers.map((entry) => `${entry.label}: ${entry.summary}`),
    followUps: ["Show me the rule.", "What counters are on it?", "What caused that?"],
  });
}

function answerPermanentRelationshipQuestion(base, context) {
  const permanent = context.selectedPermanent;
  if (!permanent) {
    return withAnswer(base, {
      headline: "Select a permanent to explain ownership and control.",
      shortAnswer: "No visible permanent is currently selected.",
      confidence: confidence("unknown", "tracking-only"),
      ruleReferences: ["CR 108 - Cards", "CR 109 - Objects"],
      followUps: ["What is on the stack?", "What happened?"],
    });
  }
  const owner = permanent.owner || permanent.ownerPlayerId || "unknown owner";
  const controller = permanent.controller || permanent.controllerPlayerId || owner || "unknown controller";
  return withAnswer(base, {
    headline: `${permanent.name || "This object"} is controlled by ${controller}.`,
    shortAnswer: `Owner: ${owner}. Controller: ${controller}. ${owner !== controller ? "Ownership and control are currently different." : "Ownership and control currently match."}`,
    detail: "Owner describes whose card it is. Controller describes who currently makes game decisions for it.",
    confidence: confidence(owner === "unknown owner" || controller === "unknown controller" ? "unknown" : "engine-verified", "engine-validated"),
    evidence: [createPermanentEvidence(permanent)],
    ruleReferences: ["CR 108 - Cards", "CR 109 - Objects"],
    followUps: ["Why did control change?", "What effects apply?", "Where did it come from?"],
  });
}

function answerWhyQuestion(base, context) {
  if (context.selectedPermanent) {
    const permanent = context.selectedPermanent;
    const reasons = [
      permanent.tapped ? `${permanent.name} is tapped because its current state has tapped=true.` : "",
      permanent.attacking ? `${permanent.name} is marked as attacking.` : "",
      permanent.blocking ? `${permanent.name} is marked as blocking.` : "",
      permanent.zone ? `${permanent.name} is currently in ${permanent.zone}.` : "",
      permanent.layerBreakdown?.length ? "Layer breakdown records continuous-effect changes." : "",
      summarizeCounters(permanent).length ? "Counters are present and may change its characteristics." : "",
    ].filter(Boolean);
    return withAnswer(base, {
      headline: reasons.length ? `BoardState has ${reasons.length} visible reason${reasons.length === 1 ? "" : "s"}.` : "No specific cause is recorded on the selected permanent.",
      shortAnswer: reasons.join(" ") || "The visible state is known, but the current snapshot does not include a complete cause chain for this object.",
      detail: "For a full why-chain, BoardState uses Event Knowledge provenance. If older events were not captured, the assistant reports the current state without inventing missing causes.",
      confidence: confidence(reasons.length ? "inferred" : "unknown", "tracking-only"),
      evidence: [createPermanentEvidence(permanent)],
      ruleReferences: permanent.layerBreakdown?.length ? ["CR 613 - Interaction of Continuous Effects"] : [],
      eventChain: context.latestEvent ? buildEventChain(context.eventKnowledge.events, context.latestEvent) : [],
      followUps: ["What changed?", "Show me history.", "Explain power and toughness."],
    });
  }
  return answerEventQuestion(base, context);
}

function answerWhatQuestion(base, context) {
  const permanent = context.selectedPermanent;
  if (permanent) {
    const keywords = normalizeStringArray(permanent.keywords || permanent.keywordAbilities);
    const detail = [
      summarizePermanent(permanent),
      permanent.oracleText || permanent.rulesText ? `Oracle text: ${permanent.oracleText || permanent.rulesText}` : "",
      keywords.length ? `Current keyword abilities: ${keywords.join(", ")}.` : "",
      permanent.isCommander || permanent.commanderId ? "This object is marked as a Commander object." : "",
    ].filter(Boolean).join(" ");
    return withAnswer(base, {
      headline: permanent.name || "Selected permanent",
      shortAnswer: detail,
      detail: "This card explanation is derived from the visible permanent record, current characteristics, counters, attachments, Commander metadata, and public Oracle text stored in BoardState.",
      confidence: confidence("engine-verified", "engine-validated"),
      evidence: [createPermanentEvidence(permanent)],
      oracleReferences: permanent.oracleText || permanent.rulesText ? [{ objectId: permanent.id || "", text: permanent.oracleText || permanent.rulesText }] : [],
      ruleReferences: permanent.isCommander || permanent.commanderId ? ["CR 903 - Commander"] : [],
      followUps: ["Who controls this?", "Why is this power and toughness?", "What effects apply?"],
    });
  }
  if (context.stackObjects.length) {
    return answerStackQuestion(base, context);
  }
  return answerEventQuestion(base, context);
}

function answerWhereQuestion(base, context) {
  const permanent = context.selectedPermanent;
  if (permanent) {
    return withAnswer(base, {
      headline: `${permanent.name || "This object"} is in ${permanent.zone || "the visible battlefield projection"}.`,
      shortAnswer: `Zone: ${permanent.zone || "battlefield"}. Controller: ${permanent.controller || permanent.controllerPlayerId || "unknown"}.`,
      confidence: confidence("engine-verified", "engine-validated"),
      evidence: [createPermanentEvidence(permanent)],
      ruleReferences: ["CR 400 - Zones"],
      followUps: ["Where did it come from?", "Who controls this?", "What changed?"],
    });
  }
  const event = context.latestEvent;
  if (event?.where?.sourceZone || event?.where?.destinationZone) {
    return withAnswer(base, {
      headline: "The latest event recorded a zone movement.",
      shortAnswer: `${event.where.sourceZone || "unknown"} to ${event.where.destinationZone || "unknown"}.`,
      confidence: confidence(event.informationConfidence, event.executionConfidence),
      evidence: [createEventEvidence(event)],
      ruleReferences: ["CR 400 - Zones"],
      eventChain: buildEventChain(context.eventKnowledge.events, event),
    });
  }
  return answerUnknownQuestion(base, context);
}

function answerWhenQuestion(base, context) {
  const event = context.latestEvent;
  if (!event) {
    return answerUnknownQuestion(base, context);
  }
  return withAnswer(base, {
    headline: `Turn ${event.when?.turn || context.turn}, ${event.when?.phase || context.phase || "unknown phase"}.`,
    shortAnswer: `${event.what?.summary || event.what?.eventType || "Event"} was recorded at ${new Date(Number(event.when?.timestamp || 0)).toISOString()}.`,
    confidence: confidence(event.informationConfidence, event.executionConfidence),
    evidence: [createEventEvidence(event)],
    eventChain: buildEventChain(context.eventKnowledge.events, event),
    followUps: ["What happened?", "Why did this happen?", "Jump to event."],
  });
}

function answerHowQuestion(base, context) {
  const event = context.latestEvent;
  if (!event) {
    return answerUnknownQuestion(base, context);
  }
  const how = [
    event.how?.resolutionMethod ? `Resolution: ${event.how.resolutionMethod}.` : "",
    event.how?.replacementInteractions?.length ? `${event.how.replacementInteractions.length} replacement interaction(s).` : "",
    event.how?.preventionInteractions?.length ? `${event.how.preventionInteractions.length} prevention interaction(s).` : "",
    event.how?.stateBasedActions?.length ? `${event.how.stateBasedActions.length} state-based action(s).` : "",
  ].filter(Boolean);
  return withAnswer(base, {
    headline: "Event Knowledge recorded the resolution path.",
    shortAnswer: how.join(" ") || "This event resolved through the State Engine commit path.",
    confidence: confidence(event.informationConfidence, event.executionConfidence),
    evidence: [createEventEvidence(event)],
    ruleReferences: clonePlain(event.ruleReferences || []),
    eventChain: buildEventChain(context.eventKnowledge.events, event),
    followUps: ["Why did this happen?", "What changed?", "Show me the rule."],
  });
}

function answerWhatIfFoundation(base, context, prompt) {
  return withAnswer(base, {
    headline: "What If is prepared as a safe Dry Run fork.",
    shortAnswer: "BoardState can prepare a hypothetical branch without mutating the authoritative live session.",
    detail: "The assistant records the fork boundary and source event. A later Dry Run UI can use this to evaluate alternate choices safely.",
    confidence: confidence("engine-verified", "tracking-only"),
    evidence: context.latestEvent ? [createEventEvidence(context.latestEvent)] : [],
    ruleReferences: ["BoardState Dry Run uses the authoritative rules engine and a forked session."],
    followUps: ["What happened?", "Why did this happen?"],
    whatIf: createWhatIfFoundation({ eventKnowledge: context.eventKnowledge }, prompt),
  });
}

function answerUnknownQuestion(base, context) {
  return withAnswer(base, {
    headline: "BoardState does not have enough authoritative evidence yet.",
    shortAnswer: "The assistant will not invent game state or rulings. Select a card, stack object, trigger, or event for a grounded explanation.",
    detail: "Current visible sources include the public battlefield, stack, pending triggers, and Event Knowledge history.",
    confidence: confidence("unknown", "manual-resolution-required"),
    evidence: [
      createEvidence("battlefield", "visible-battlefield", "Visible battlefield", `${context.allPermanents.length} visible permanent(s)`),
      context.latestEvent ? createEventEvidence(context.latestEvent) : null,
    ].filter(Boolean),
    followUps: ["What is on the stack?", "What happened?", "What is true right now?"],
  });
}

function classifyQuestion(question = "") {
  const normalized = String(question || "").trim().toLowerCase();
  if (/\bwhat if\b/.test(normalized)) return "what-if";
  if (/\bwhy\b/.test(normalized)) return "why";
  if (/\bhow\b/.test(normalized)) return "how";
  if (/\bwho\b/.test(normalized)) return "who";
  if (/\bwhen\b/.test(normalized)) return "when";
  if (/\bwhere\b/.test(normalized)) return "where";
  if (/\bwhat\b/.test(normalized)) return "what";
  return "what";
}

function collectVisiblePermanents(session = {}, options = {}) {
  const sources = [
    ...(session.battlefield?.player || []),
    ...(session.battlefield?.opponent || []),
    ...(options.localBoard?.allPermanents || []),
    ...(options.opponentBoard?.allPermanents || []),
    ...Object.values(session.playerBoards || {}).flatMap((board) => board?.permanents || []),
    ...(session.players || []).flatMap((player) => player?.battlefield || player?.permanents || []),
  ];
  const byId = new Map();
  sources.forEach((permanent, index) => {
    if (!permanent || isPrivateZone(permanent.zone)) return;
    const id = permanent.id || permanent.objectId || `${permanent.name || "permanent"}:${index}`;
    if (!byId.has(id)) {
      byId.set(id, sanitizePermanent({ ...permanent, id }));
    }
  });
  return [...byId.values()];
}

function sanitizePermanent(permanent = {}) {
  const safe = clonePlain(permanent);
  delete safe.privateNotes;
  delete safe.secret;
  delete safe.password;
  delete safe.token;
  delete safe.authToken;
  delete safe.hand;
  delete safe.library;
  return safe;
}

function isPrivateZone(zone = "") {
  const normalized = String(zone || "").toLowerCase();
  return PRIVATE_ZONE_NAMES.some((privateZone) => normalized.includes(privateZone));
}

function isResolvedStatus(status = "") {
  return ["resolved", "skipped", "ignored", "cancelled"].includes(String(status || "").toLowerCase());
}

function resolvePhaseLabel(session = {}) {
  return session.phase || PHASES[Number(session.phaseIndex || 0)] || "Beginning";
}

function firstString(value) {
  if (Array.isArray(value)) {
    return String(value.find(Boolean) || "");
  }
  return String(value || "");
}

function firstNumber(...values) {
  const value = values.find((entry) => entry !== undefined && entry !== null && entry !== "");
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return value ? [String(value)] : [];
  }
  return [...new Set(value.filter(Boolean).map(String))];
}

function normalizeLayerBreakdown(permanent = {}) {
  const direct = Array.isArray(permanent.layerBreakdown) ? permanent.layerBreakdown : [];
  const fromCounters = summarizeCounters(permanent).map((entry) => ({
    layer: 9,
    modifierId: `${permanent.id || permanent.name}:counter:${entry.counterType}`,
    sourceId: permanent.id || "",
    sourceName: permanent.name || "Counter",
    operation: "counter",
    powerDelta: entry.counterType === "+1/+1" ? Number(entry.value || 0) : entry.counterType === "-1/-1" ? -Number(entry.value || 0) : 0,
    toughnessDelta: entry.counterType === "+1/+1" ? Number(entry.value || 0) : entry.counterType === "-1/-1" ? -Number(entry.value || 0) : 0,
    keywordDelta: [],
  }));
  const combined = direct.length ? direct : fromCounters;
  return combined.map((entry) => {
    const layer = Number(entry.layer || 0);
    const layerMeta = EFFECT_LAYERS.find((meta) => Number(meta.index) === layer);
    const summary = summarizeLayerEntry(entry);
    return {
      layer,
      layerName: layerMeta?.name || "unknown",
      label: layerMeta ? `Layer ${layer}: ${layerMeta.name}` : `Layer ${layer || "unknown"}`,
      modifierId: String(entry.modifierId || ""),
      sourceId: String(entry.sourceId || ""),
      sourceName: String(entry.sourceName || ""),
      operation: String(entry.operation || ""),
      powerDelta: Number(entry.powerDelta || 0),
      toughnessDelta: Number(entry.toughnessDelta || 0),
      keywordDelta: normalizeStringArray(entry.keywordDelta),
      summary,
    };
  });
}

function summarizeLayerEntry(entry = {}) {
  const parts = [];
  if (entry.sourceName) parts.push(`${entry.sourceName}`);
  if (entry.operation) parts.push(`${entry.operation}`);
  const powerDelta = Number(entry.powerDelta || 0);
  const toughnessDelta = Number(entry.toughnessDelta || 0);
  if (powerDelta || toughnessDelta) {
    parts.push(`${powerDelta >= 0 ? "+" : ""}${powerDelta}/${toughnessDelta >= 0 ? "+" : ""}${toughnessDelta}`);
  }
  const keywords = normalizeStringArray(entry.keywordDelta);
  if (keywords.length) {
    parts.push(`adds ${keywords.join(", ")}`);
  }
  return parts.join(" ") || "No visible characteristic delta.";
}

function summarizeCounters(permanent = {}) {
  return Object.entries(permanent.counters || {})
    .filter(([, value]) => Number(value || 0) !== 0)
    .map(([counterType, value]) => ({ counterType, value: Number(value || 0) }));
}

function summarizePermanent(permanent = {}) {
  const pt = Number.isFinite(Number(permanent.currentPower)) && Number.isFinite(Number(permanent.currentToughness))
    ? `${permanent.currentPower}/${permanent.currentToughness}`
    : permanent.powerToughness || "";
  const details = [
    permanent.typeLine || "",
    pt ? `Power/toughness ${pt}.` : "",
    permanent.tapped ? "Tapped." : "",
    permanent.zone ? `Zone ${permanent.zone}.` : "",
    permanent.isCommander || permanent.commanderId ? "Commander." : "",
  ].filter(Boolean);
  return details.join(" ") || "Visible permanent.";
}

function summarizeKnowledgeEvent(event = {}) {
  const subject = event.what?.objectNames?.length ? ` involving ${event.what.objectNames.join(", ")}` : "";
  const where = event.where?.sourceZone || event.where?.destinationZone
    ? ` (${event.where.sourceZone || "unknown"} to ${event.where.destinationZone || "unknown"})`
    : "";
  return `${event.what?.summary || event.what?.eventType || "Event"}${subject}${where}. Turn ${event.when?.turn || 0}.`;
}

function createPermanentEvidence(permanent = {}) {
  return createEvidence("permanent", permanent.id || "", permanent.name || "Permanent", summarizePermanent(permanent), {
    publicOnly: Boolean(permanent.publicOnly || permanent.controller === "opponent"),
  });
}

function createEventEvidence(event = {}) {
  return createEvidence("event", event.eventId || "", event.what?.summary || event.what?.eventType || "Event", summarizeKnowledgeEvent(event), {
    tags: normalizeStringArray(event.tags),
    informationConfidence: event.informationConfidence || "unknown",
    executionConfidence: event.executionConfidence || "tracking-only",
  });
}

function createEvidence(kind, id, label, summary, extra = {}) {
  return {
    kind,
    id: String(id || ""),
    label: String(label || kind),
    summary: String(summary || ""),
    source: "boardstate-authoritative-data",
    ...extra,
  };
}

function findLatestEventByTag(events = [], tag = "") {
  return events.find((event) => (event.tags || []).includes(tag)) || null;
}

function buildEventChain(events = [], event = {}) {
  if (!event?.eventId) return [];
  const byId = new Map(events.map((entry) => [entry.eventId, entry]));
  const chain = [];
  const visited = new Set();
  const pushEvent = (entry, depth = 0) => {
    if (!entry?.eventId || visited.has(entry.eventId) || chain.length >= 12) return;
    visited.add(entry.eventId);
    chain.push({
      eventId: entry.eventId,
      parentEventId: entry.parentEventId || "",
      rootEventId: entry.rootEventId || "",
      eventGroupId: entry.eventGroupId || "",
      depth,
      label: entry.what?.summary || entry.what?.eventType || "Event",
      summary: summarizeKnowledgeEvent(entry),
      ruleReferences: clonePlain(entry.ruleReferences || []),
    });
  };
  pushEvent(event, 0);
  let current = event;
  let depth = 1;
  while (current.parentEventId && byId.has(current.parentEventId) && depth < 8) {
    current = byId.get(current.parentEventId);
    pushEvent(current, depth);
    depth += 1;
  }
  (event.why?.causationChain || []).forEach((eventId) => pushEvent(byId.get(eventId), depth));
  events
    .filter((entry) => entry.eventGroupId && entry.eventGroupId === event.eventGroupId)
    .slice(0, 8)
    .forEach((entry) => pushEvent(entry, depth));
  return chain;
}

function detailForLevel(level = "intermediate", detail = "") {
  const normalized = normalizeExplanationLevel(level);
  if (normalized === "beginner") {
    return String(detail || "").split(". ").slice(0, 2).join(". ");
  }
  return String(detail || "");
}

function confidence(information = "unknown", execution = "tracking-only") {
  return {
    information: INFORMATION_CONFIDENCE_LEVELS.includes(information) ? information : "unknown",
    execution: EXECUTION_CONFIDENCE_LEVELS.includes(execution) ? execution : "tracking-only",
  };
}
