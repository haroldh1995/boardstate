import { PHASES } from "../state/schema.js";
import { clonePlain } from "../shared-contracts/index.js";
import { createContractId, normalizeContractId } from "../shared-contracts/ids.js";
import {
  EXECUTION_CONFIDENCE_LEVELS,
  INFORMATION_CONFIDENCE_LEVELS,
  RULE_AMENDMENT_APPROVAL_POLICY,
  isSafeRuleReferenceImportPayload,
  validateRuleAmendmentApproval,
} from "../shared-contracts/commanderModernization.js";
import { createEventKnowledgeState } from "./eventKnowledgeEngine.js";

export const REMIND_ME_ENGINE_VERSION = "boardstate-remind-me-engine-0.1.0";
export const PROACTIVE_ASSISTANT_VERSION = "boardstate-proactive-assistant-0.1.0";
export const CONFIDENCE_ENGINE_VERSION = "boardstate-confidence-engine-0.1.0";
export const RULE_AMENDMENT_SYSTEM_VERSION = "boardstate-rule-amendment-system-0.1.0";

export const REMINDER_SUBJECT_TYPES = Object.freeze([
  "card",
  "permanent",
  "commander",
  "opponent",
  "turn",
  "phase",
  "trigger",
  "life-total",
  "battlefield-state",
  "rule",
  "counter",
  "mana",
  "zone",
  "future-state",
]);

export const REMINDER_CONDITION_TYPES = Object.freeze([
  "phase",
  "turn",
  "trigger",
  "upkeep-trigger",
  "commander-can-attack",
  "priority",
  "targeted",
  "zone-change",
  "life-total",
  "counter-threshold",
  "mana-available",
  "card-enters",
  "player-attacks",
  "battlefield-state",
  "rule",
]);

export const REMINDER_STATUSES = Object.freeze([
  "active",
  "completed",
  "dismissed",
  "expired",
  "snoozed",
]);

export const SMART_NOTIFICATION_PRIORITIES = Object.freeze([
  "critical",
  "major",
  "normal",
  "minor",
  "informational",
]);

export const RULE_AMENDMENT_TYPES = Object.freeze([
  "table-amendment",
  "temporary-ruling",
  "permanent-house-rule",
  "tournament-exception",
  "judge-override",
]);

export const RULE_AMENDMENT_STATUSES = Object.freeze([
  "pending-unanimous-approval",
  "accepted",
  "rejected",
  "needs-revision",
  "withdrawn",
]);

const RESOLVED_STATUSES = new Set(["resolved", "skipped", "ignored", "cancelled", "completed"]);
const PRIVATE_ZONE_NAMES = Object.freeze(["hand", "library", "sideboard", "hidden", "face-down"]);
const PHASE_ALIASES = Object.freeze({
  upkeep: "Beginning",
  beginning: "Beginning",
  draw: "Beginning",
  main: "Main 1",
  precombat: "Main 1",
  combat: "Combat",
  attack: "Combat",
  attackers: "Combat",
  blockers: "Combat",
  postcombat: "Main 2",
  ending: "Ending",
  end: "Ending",
  cleanup: "Ending",
});

export function createRemindMeState(input = {}) {
  const reminders = Array.isArray(input.reminders)
    ? input.reminders.map((entry) => createReminder(entry)).filter(Boolean)
    : [];
  return {
    version: input.version || REMIND_ME_ENGINE_VERSION,
    enabled: input.enabled !== false,
    duplicateSuppression: input.duplicateSuppression !== false,
    reminders,
    timeline: Array.isArray(input.timeline) ? clonePlain(input.timeline).slice(0, 200) : [],
    dismissedNotificationKeys: Array.isArray(input.dismissedNotificationKeys)
      ? [...new Set(input.dismissedNotificationKeys.map(String).filter(Boolean))]
      : [],
    lastEvaluatedAt: Number(input.lastEvaluatedAt || 0),
  };
}

export function createReminder(input = {}, session = {}) {
  if (!input || typeof input !== "object") return null;
  const now = Number(input.createdAt || Date.now());
  const text = sanitizeText(input.text || input.prompt || input.description || input.label || "");
  const inferred = inferReminderIntent(text, input);
  const condition = normalizeReminderCondition(input.condition || inferred.condition);
  const subjectType = normalizeAllowed(input.subjectType || inferred.subjectType, REMINDER_SUBJECT_TYPES, "future-state");
  const seed = [
    session.sessionId || session.id || "",
    text,
    subjectType,
    condition.type,
    input.subjectId || inferred.subjectId || "",
    now,
  ].join("|");
  const reminderId = normalizeContractId(
    input.reminderId || input.id || createContractId("notificationId", stableHash(seed)),
    "notificationId"
  );
  return {
    reminderId,
    version: input.version || REMIND_ME_ENGINE_VERSION,
    text: text || "Check this Commander reminder.",
    subjectType,
    subjectId: String(input.subjectId || inferred.subjectId || ""),
    subjectName: sanitizeText(input.subjectName || inferred.subjectName || ""),
    condition,
    priority: normalizePriority(input.priority || inferred.priority || "normal"),
    status: normalizeAllowed(input.status, REMINDER_STATUSES, "active"),
    createdAt: now,
    createdByPlayerId: String(input.createdByPlayerId || input.playerId || inferLocalPlayerId(session) || "local-player"),
    createdByParticipantId: String(input.createdByParticipantId || input.participantId || ""),
    repeats: input.repeats !== undefined ? Boolean(input.repeats) : Boolean(inferred.repeats),
    expiresAt: Math.max(0, Number(input.expiresAt || 0)),
    snoozedUntil: Math.max(0, Number(input.snoozedUntil || 0)),
    lastMatchedAt: Math.max(0, Number(input.lastMatchedAt || 0)),
    completedAt: Math.max(0, Number(input.completedAt || 0)),
    dismissedAt: Math.max(0, Number(input.dismissedAt || 0)),
    source: String(input.source || "user"),
    confidence: normalizeRecommendationConfidence(input.confidence || {}),
    evidence: Array.isArray(input.evidence) ? clonePlain(input.evidence).slice(0, 12) : [],
    metadata: sanitizeMetadata(input.metadata || {}),
  };
}

export function updateReminderStatus(reminders = [], reminderId = "", status = "active", options = {}) {
  const normalizedStatus = normalizeAllowed(status, REMINDER_STATUSES, "active");
  const now = Number(options.at || Date.now());
  return (Array.isArray(reminders) ? reminders : []).map((entry) => {
    const reminder = createReminder(entry);
    if (!reminder || reminder.reminderId !== reminderId) return reminder;
    return {
      ...reminder,
      status: normalizedStatus,
      completedAt: normalizedStatus === "completed" ? now : reminder.completedAt,
      dismissedAt: normalizedStatus === "dismissed" ? now : reminder.dismissedAt,
      expiresAt: normalizedStatus === "expired" ? now : reminder.expiresAt,
      snoozedUntil: normalizedStatus === "snoozed" ? Math.max(now + Number(options.snoozeMs || 0), Number(options.snoozedUntil || 0)) : 0,
    };
  }).filter(Boolean);
}

export function evaluateReminder(session = {}, reminderInput = {}, options = {}) {
  const reminder = createReminder(reminderInput, session);
  const now = Number(options.at || Date.now());
  if (!reminder) {
    return createReminderEvaluation(null, {
      status: "invalid",
      relevant: false,
      shouldNotify: false,
      message: "Reminder data is invalid.",
      confidence: recommendationConfidence("unknown", "manual-resolution-required"),
    });
  }
  if (!["active", "snoozed"].includes(reminder.status)) {
    return createReminderEvaluation(reminder, {
      status: reminder.status,
      relevant: false,
      shouldNotify: false,
      message: "Reminder is not active.",
    });
  }
  if (reminder.expiresAt && now >= reminder.expiresAt) {
    return createReminderEvaluation(reminder, {
      status: "expired",
      relevant: false,
      shouldNotify: false,
      message: "Reminder expired.",
    });
  }
  if (reminder.snoozedUntil && now < reminder.snoozedUntil) {
    return createReminderEvaluation(reminder, {
      status: "snoozed",
      relevant: false,
      shouldNotify: false,
      message: "Reminder is snoozed.",
    });
  }

  const context = createAssistantContext(session, options);
  const match = matchReminderCondition(context, reminder);
  const shouldNotify = Boolean(match.matched && match.relevant !== false);
  return createReminderEvaluation(reminder, {
    status: shouldNotify && !reminder.repeats ? "completed" : reminder.status,
    relevant: Boolean(match.relevant),
    shouldNotify,
    headline: match.headline || reminder.text,
    message: match.message || reminder.text,
    priority: normalizePriority(match.priority || reminder.priority),
    confidence: match.confidence || reminder.confidence,
    evidence: match.evidence || [],
    matchedAt: shouldNotify ? now : 0,
  });
}

export function evaluateReminderSet(session = {}, reminderInputs = [], options = {}) {
  const reminders = Array.isArray(reminderInputs)
    ? reminderInputs.map((entry) => createReminder(entry, session)).filter(Boolean)
    : createRemindMeState(session.remindMe || {}).reminders;
  const evaluations = reminders.map((reminder) => evaluateReminder(session, reminder, options));
  const dismissedKeys = new Set(options.dismissedNotificationKeys || session.remindMe?.dismissedNotificationKeys || []);
  const dueNotifications = evaluations
    .filter((entry) => entry.shouldNotify && !dismissedKeys.has(entry.notification?.dedupeKey))
    .map((entry) => entry.notification)
    .filter(Boolean);
  return {
    version: REMIND_ME_ENGINE_VERSION,
    evaluatedAt: Number(options.at || Date.now()),
    activeCount: reminders.filter((entry) => entry.status === "active").length,
    completedCount: reminders.filter((entry) => entry.status === "completed").length,
    dismissedCount: reminders.filter((entry) => entry.status === "dismissed").length,
    evaluations,
    dueNotifications: prioritizeSmartNotifications(dueNotifications, options),
  };
}

export function createProactiveAssistantState(session = {}, options = {}) {
  const remindMe = createRemindMeState({
    ...(session.remindMe || {}),
    ...(options.remindMe || {}),
  });
  const reminderInputs = Array.isArray(options.reminders) ? options.reminders : remindMe.reminders;
  const reminderReport = evaluateReminderSet(session, reminderInputs, {
    ...options,
    dismissedNotificationKeys: remindMe.dismissedNotificationKeys,
  });
  const confidenceReport = buildConfidenceReport(session, options);
  const missedTriggerRecovery = createMissedTriggerRecoveryReport(session, options);
  const opportunities = detectGameplayOpportunities(session, options);
  const ruleAmendments = createRuleAmendmentSystemState(session.ruleAmendments || {}, session);
  const generated = createContextNotifications(session, {
    ...options,
    confidenceReport,
    missedTriggerRecovery,
    opportunities,
    ruleAmendments,
  });
  const notifications = prioritizeSmartNotifications([
    ...reminderReport.dueNotifications,
    ...generated,
  ], {
    ...options,
    dismissedNotificationKeys: remindMe.dismissedNotificationKeys,
  });

  return {
    version: PROACTIVE_ASSISTANT_VERSION,
    remindMeVersion: REMIND_ME_ENGINE_VERSION,
    confidenceEngineVersion: CONFIDENCE_ENGINE_VERSION,
    ruleAmendmentSystemVersion: RULE_AMENDMENT_SYSTEM_VERSION,
    available: true,
    mutatesGameState: false,
    strategicAdviceEnabled: false,
    voiceAssistantEnabled: false,
    derivedFromAuthoritativeData: true,
    playerAgencyPreserved: true,
    reminderReport,
    notifications,
    notificationSummary: summarizeNotifications(notifications),
    confidenceReport,
    missedTriggerRecovery,
    opportunities,
    ruleAmendments,
    playerMemory: createPlayerMemoryState(options.playerMemory || {}),
    boundaries: {
      noStrategicAdvice: true,
      noGenerativeAI: true,
      noVoiceAssistant: true,
      noHubDependency: true,
      officialRulesRemainAuthoritative: true,
      unanimousRuleAmendmentsOnly: true,
      recommendationsDoNotPlayForUser: true,
    },
  };
}

export function buildConfidenceReport(session = {}, options = {}) {
  const context = createAssistantContext(session, options);
  const eventKnowledge = context.eventKnowledge;
  const activeWaivers = Array.isArray(session.activeRuleWaivers) ? session.activeRuleWaivers : [];
  const recoveryErrors = (session.recoveryLog || []).filter((entry) => entry.severity === "error" && !entry.dismissed);
  const recoveryWarnings = (session.recoveryLog || []).filter((entry) => entry.severity !== "error" && !entry.dismissed);
  const manualChoices = context.pendingChoices.length + context.manualTriggers.length;
  const unknownZoneCount = Object.values(session.zones?.unknownCounts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const liveTracking = session.gameTracking?.active && session.gameTracking?.mode === "live-tracking";
  const disconnectedParticipants = context.participants.filter((entry) => ["disconnected", "reconnecting"].includes(String(entry.connectionStatus || "").toLowerCase()));
  const activeAmendments = createRuleAmendmentSystemState(session.ruleAmendments || {}, session).active;

  const informationLevel = !session || !Object.keys(session).length
    ? "unknown"
    : unknownZoneCount || liveTracking
      ? "inferred"
      : "engine-verified";
  const executionLevel = activeWaivers.length
    ? "enforcement-waived"
    : manualChoices
      ? "manual-resolution-required"
      : recoveryErrors.length || recoveryWarnings.length
        ? "parsed-with-warnings"
        : "engine-validated";
  const rulesLevel = activeAmendments.length ? "table-ruling" : informationLevel;
  const stateLevel = recoveryErrors.length ? "unknown" : informationLevel;
  const syncLevel = session.syncedMultiplayer?.active
    ? disconnectedParticipants.length ? "estimated" : "engine-verified"
    : "engine-verified";
  const replayLevel = eventKnowledge.eventCount || session.persistence?.checkpoints?.length
    ? "engine-verified"
    : "estimated";

  return {
    version: CONFIDENCE_ENGINE_VERSION,
    generatedAt: Number(options.at || Date.now()),
    overall: summarizeOverallConfidence({
      information: informationLevel,
      execution: executionLevel,
      rules: rulesLevel,
      state: stateLevel,
      synchronization: syncLevel,
      replay: replayLevel,
    }),
    dimensions: {
      information: confidenceDimension(informationLevel, {
        known: ["Public battlefield, stack, triggers, commander status, phase, and Event Knowledge are inspectable."],
        uncertain: [
          unknownZoneCount ? `${unknownZoneCount} hidden or unknown zone item(s) are intentionally not inferred.` : "",
          liveTracking ? "Live Tracking can omit physical hidden information." : "",
        ],
        improve: unknownZoneCount || liveTracking ? ["Reveal or enter the missing table information if the group wants BoardState to validate it."] : [],
      }),
      execution: confidenceDimension(executionLevel, {
        known: ["Rules-sensitive actions continue to use BoardState legality and state processing."],
        uncertain: [
          manualChoices ? `${manualChoices} manual choice or manual trigger item(s) need player resolution.` : "",
          activeWaivers.length ? `${activeWaivers.length} active rule waiver(s) lower execution confidence.` : "",
        ],
        improve: manualChoices ? ["Resolve pending choices through the trigger and manual-choice tools."] : [],
      }, EXECUTION_CONFIDENCE_LEVELS),
      rules: confidenceDimension(rulesLevel, {
        known: ["Official Magic rules remain the canonical authority."],
        uncertain: activeAmendments.length ? [`${activeAmendments.length} accepted table amendment(s) are active and clearly non-canonical.`] : [],
        improve: activeAmendments.length ? ["Use the rule amendment history to review which table rulings are active."] : [],
      }),
      state: confidenceDimension(stateLevel, {
        known: ["The State Engine owns current battlefield truth."],
        uncertain: recoveryErrors.length ? recoveryErrors.map((entry) => entry.message || entry.title || "Recovery issue needs review.").slice(0, 3) : [],
        improve: recoveryErrors.length ? ["Open recovery tools before continuing if the state appears inconsistent."] : [],
      }),
      synchronization: confidenceDimension(syncLevel, {
        known: [session.syncedMultiplayer?.active ? "Synchronized multiplayer metadata is present." : "Local offline play does not require network confidence."],
        uncertain: disconnectedParticipants.map((entry) => `${entry.displayName || entry.participantId || "Participant"} is ${entry.connectionStatus}.`).slice(0, 4),
        improve: disconnectedParticipants.length ? ["Wait for reconnect or use the current local session authority before accepting remote actions."] : [],
      }),
      replay: confidenceDimension(replayLevel, {
        known: eventKnowledge.eventCount ? [`${eventKnowledge.eventCount} Event Knowledge record(s) are available for replay and explanation.`] : [],
        uncertain: eventKnowledge.eventCount ? [] : ["This session has limited Event Knowledge history."],
        improve: eventKnowledge.eventCount ? [] : ["Continue through normal gameplay actions so the Event Knowledge timeline can grow."],
      }),
      futureAi: confidenceDimension("tracking-only", {
        known: ["The assistant may identify legal opportunities without recommending strategy."],
        uncertain: ["Strategic AI coaching is intentionally not active in this assistant layer."],
        improve: [],
      }, EXECUTION_CONFIDENCE_LEVELS),
    },
  };
}

export function createMissedTriggerRecoveryReport(session = {}, options = {}) {
  const context = createAssistantContext(session, options);
  const currentTurn = context.turn;
  const triggers = context.triggerQueue
    .filter((entry) => !RESOLVED_STATUSES.has(String(entry.status || "").toLowerCase()))
    .map((entry) => normalizeTriggerRecoveryItem(entry, currentTurn));
  const likelyMissed = triggers.filter((entry) => entry.recoveryStatus === "likely-missed" || entry.recoveryStatus === "delayed");
  const mandatory = triggers.filter((entry) => !entry.optional);
  const optional = triggers.filter((entry) => entry.optional);
  return {
    version: PROACTIVE_ASSISTANT_VERSION,
    generatedAt: Number(options.at || Date.now()),
    pendingCount: triggers.length,
    likelyMissedCount: likelyMissed.length,
    mandatoryCount: mandatory.length,
    optionalCount: optional.length,
    items: triggers,
    guidance: {
      officialPolicy: "Use the event timing, trigger type, and table context to decide the proper fix. BoardState presents options but does not force the table decision.",
      commanderEtiquette: "For casual Commander, clarify the missed trigger promptly and let all affected players agree on the cleanest resolution.",
      playerResponsibility: "Players remain responsible for final trigger and tournament-policy decisions.",
    },
  };
}

export function detectGameplayOpportunities(session = {}, options = {}) {
  const context = createAssistantContext(session, options);
  const opportunities = [];
  const localPlayerId = options.localPlayerId || context.localPlayerId;
  const priorityHolderId = context.priorityHolderId;
  if (priorityHolderId && priorityHolderId === localPlayerId) {
    opportunities.push(createOpportunity({
      id: "priority:local",
      priority: "major",
      title: "You have priority.",
      detail: "You may act or pass through the existing stack priority controls.",
      evidence: ["priority"],
    }));
  }
  const untappedAttackers = context.visiblePermanents.filter((permanent) =>
    isLocalPermanent(permanent, localPlayerId) &&
    isCreaturePermanent(permanent) &&
    !permanent.tapped &&
    !permanent.summoningSick &&
    !permanent.summoningSickness
  );
  if (context.phaseLabel === "Combat" && untappedAttackers.length) {
    opportunities.push(createOpportunity({
      id: "combat:available-attackers",
      priority: "normal",
      title: `${untappedAttackers.length} attacker${untappedAttackers.length === 1 ? "" : "s"} available.`,
      detail: "This identifies legal-looking untapped creatures only. It is not a strategy recommendation.",
      evidence: untappedAttackers.map((entry) => entry.id).slice(0, 8),
    }));
  }
  const manaTotal = Object.values(session.manaPool || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  if (manaTotal > 0) {
    opportunities.push(createOpportunity({
      id: "mana:floating",
      priority: "minor",
      title: `${manaTotal} mana floating.`,
      detail: "Floating mana exists in the current state and may empty as steps and phases change.",
      evidence: ["manaPool"],
    }));
  }
  const commanderRecasts = context.commanders.filter((commander) =>
    /command/i.test(commander.zone || "") &&
    !commander.disabled &&
    commander.ownerPlayerId === localPlayerId
  );
  commanderRecasts.forEach((commander) => {
    opportunities.push(createOpportunity({
      id: `commander:recast:${commander.commanderId}`,
      priority: "normal",
      title: `${commander.name || "Commander"} is in the command zone.`,
      detail: `Commander tax is ${Number(commander.commanderTax || commander.tax || 0)}. Use Commander actions when you want to cast it.`,
      evidence: [commander.commanderId],
    }));
  });
  context.triggerQueue.filter((entry) => entry.optional || entry.may).slice(0, 4).forEach((entry) => {
    opportunities.push(createOpportunity({
      id: `trigger:optional:${entry.id || entry.sourceName}`,
      priority: "minor",
      title: `${entry.sourceName || entry.name || "Optional trigger"} can be chosen.`,
      detail: "Optional triggers are surfaced so the player can decide. BoardState does not choose for the player.",
      evidence: [entry.id || entry.sourceName || "trigger"],
    }));
  });
  context.pendingChoices.filter((entry) => /replacement|instead|prevent/i.test(JSON.stringify(entry))).slice(0, 4).forEach((entry) => {
    opportunities.push(createOpportunity({
      id: `replacement:${entry.id || entry.sourceName}`,
      priority: "major",
      title: "Replacement or prevention choice is waiting.",
      detail: "Use the manual choice controls so the table can resolve the affected interaction.",
      evidence: [entry.id || entry.sourceName || "pending-choice"],
    }));
  });
  return dedupeById(opportunities).slice(0, Number(options.limit || 12));
}

export function prioritizeSmartNotifications(items = [], options = {}) {
  const dismissed = new Set(options.dismissedNotificationKeys || []);
  const byKey = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const notification = normalizeSmartNotification(item);
    if (!notification || dismissed.has(notification.dedupeKey)) return;
    const previous = byKey.get(notification.dedupeKey);
    if (!previous || priorityRank(notification.priority) < priorityRank(previous.priority)) {
      byKey.set(notification.dedupeKey, notification);
    }
  });
  return [...byKey.values()]
    .sort((left, right) => priorityRank(left.priority) - priorityRank(right.priority) || Number(right.createdAt || 0) - Number(left.createdAt || 0))
    .slice(0, Number(options.notificationLimit || 8));
}

export function createPlayerMemoryState(input = {}) {
  return {
    version: input.version || PROACTIVE_ASSISTANT_VERSION,
    enabled: input.enabled !== false,
    preferredExplanationLevel: String(input.preferredExplanationLevel || input.explanationLevel || "intermediate"),
    reminderStyle: String(input.reminderStyle || "gentle"),
    quietMode: Boolean(input.quietMode),
    frequentQuestions: sanitizeKeyValueCounts(input.frequentQuestions || input.frequentQuestionCounts || {}),
    frequentlyForgottenTriggers: sanitizeKeyValueCounts(input.frequentlyForgottenTriggers || {}),
    favoriteCards: normalizeStringArray(input.favoriteCards).slice(0, 60),
    accessibilityPreferences: sanitizeMetadata(input.accessibilityPreferences || {}),
    interactionPreferences: sanitizeMetadata(input.interactionPreferences || {}),
    gameplayPreferences: sanitizeMetadata(input.gameplayPreferences || {}),
    authoritativeGameplayUnaffected: true,
    lastUpdatedAt: Number(input.lastUpdatedAt || 0),
  };
}

export function createRuleAmendmentSystemState(input = {}, session = {}) {
  const source = Array.isArray(input) ? { history: input } : input || {};
  const proposals = Array.isArray(source.proposals)
    ? source.proposals.map((entry) => normalizeRuleAmendmentProposal(entry, session)).filter(Boolean)
    : [];
  const active = Array.isArray(source.active)
    ? source.active.map((entry) => normalizeRuleAmendmentProposal(entry, session)).filter(Boolean)
    : proposals.filter((entry) => entry.status === "accepted");
  const history = Array.isArray(source.history)
    ? source.history.map((entry) => sanitizeRuleAmendmentHistoryEntry(entry)).filter(Boolean)
    : [];
  return {
    version: source.version || RULE_AMENDMENT_SYSTEM_VERSION,
    approvalPolicy: RULE_AMENDMENT_APPROVAL_POLICY.approval,
    majorityApprovalAllowed: false,
    officialRulesRemainAuthoritative: true,
    proposals,
    active,
    history,
    pendingCount: proposals.filter((entry) => entry.status === "pending-unanimous-approval").length,
    acceptedCount: active.length,
  };
}

export function createRuleAmendmentProposal(input = {}, session = {}) {
  const proposedText = sanitizeText(input.proposedText || input.text || input.description || "");
  const sourceText = sanitizeText(input.sourceText || input.referenceText || proposedText);
  const safeSource = isSafeRuleReferenceImportPayload(sourceText);
  const safeProposal = isSafeRuleReferenceImportPayload(proposedText);
  const now = Number(input.createdAt || Date.now());
  const playerIds = resolveRuleAmendmentPlayerIds(session, input.players);
  const ruleAmendmentId = normalizeContractId(
    input.ruleAmendmentId || input.id || createContractId("ruleAmendmentId", stableHash([
      session.sessionId || session.id || "",
      proposedText,
      input.proposedByPlayerId || input.playerId || "",
      now,
    ].join("|"))),
    "ruleAmendmentId"
  );
  const validationErrors = [
    !proposedText ? "Rule amendment proposal text is required." : "",
    safeSource.valid ? "" : safeSource.reason,
    safeProposal.valid ? "" : safeProposal.reason,
  ].filter(Boolean);
  const proposal = {
    ruleAmendmentId,
    version: RULE_AMENDMENT_SYSTEM_VERSION,
    type: normalizeAllowed(input.type, RULE_AMENDMENT_TYPES, "table-amendment"),
    status: validationErrors.length ? "needs-revision" : normalizeAllowed(input.status, RULE_AMENDMENT_STATUSES, "pending-unanimous-approval"),
    proposedText,
    sourceText,
    proposedByPlayerId: String(input.proposedByPlayerId || input.playerId || inferLocalPlayerId(session) || "local-player"),
    proposedByParticipantId: String(input.proposedByParticipantId || input.participantId || ""),
    proposedAt: now,
    affectedRules: normalizeStringArray(input.affectedRules),
    affectedEventIds: normalizeStringArray(input.affectedEventIds || input.eventIds),
    affectedQuestionIds: normalizeStringArray(input.affectedQuestionIds || input.questionIds),
    votes: normalizeRuleAmendmentVotes(input.votes || input.approvals || []),
    playerIds,
    approvalPolicy: RULE_AMENDMENT_APPROVAL_POLICY.approval,
    majorityApprovalAllowed: false,
    officialRulesRemainAuthoritative: true,
    tableRuling: true,
    mutatesAuthoritativeState: false,
    applicationStatus: "not-applied",
    confidenceImpact: {
      information: "table-ruling",
      execution: "manual-resolution-required",
      reason: "Table amendments are non-canonical until every player approves and the action is resolved through existing rules/recovery controls.",
    },
    validation: {
      valid: validationErrors.length === 0,
      errors: validationErrors,
      sourceTextSafe: safeSource.valid,
      proposedTextSafe: safeProposal.valid,
    },
    history: Array.isArray(input.history) ? input.history.map(sanitizeRuleAmendmentHistoryEntry).filter(Boolean) : [],
  };
  return evaluateRuleAmendmentProposal(proposal, playerIds);
}

export function recordRuleAmendmentVote(proposalInput = {}, voteInput = {}) {
  const proposal = normalizeRuleAmendmentProposal(proposalInput);
  if (!proposal) return null;
  const vote = normalizeRuleAmendmentVote(voteInput);
  if (!vote.playerId) {
    return {
      ...proposal,
      status: "needs-revision",
      validation: {
        ...(proposal.validation || {}),
        valid: false,
        errors: [...(proposal.validation?.errors || []), "Rule amendment vote requires a player ID."],
      },
    };
  }
  const votes = [
    vote,
    ...(proposal.votes || []).filter((entry) => entry.playerId !== vote.playerId),
  ];
  return evaluateRuleAmendmentProposal({
    ...proposal,
    votes,
    history: [
      sanitizeRuleAmendmentHistoryEntry({
        type: vote.vote === "reject" ? "rejected" : "vote-recorded",
        playerId: vote.playerId,
        reason: vote.reason,
        createdAt: vote.votedAt,
      }),
      ...(proposal.history || []),
    ],
  }, proposal.playerIds);
}

export function evaluateRuleAmendmentProposal(proposalInput = {}, playersOrSession = []) {
  const proposal = normalizeRuleAmendmentProposal(proposalInput);
  if (!proposal) return null;
  const playerIds = resolveRuleAmendmentPlayerIds(playersOrSession, proposal.playerIds);
  const approvals = (proposal.votes || []).filter((entry) => entry.vote === "approve");
  const rejections = (proposal.votes || []).filter((entry) => entry.vote === "reject");
  const approvalReport = validateRuleAmendmentApproval(playerIds, approvals);
  const errors = [...(proposal.validation?.errors || []), ...(approvalReport.errors || [])].filter(Boolean);
  const status = errors.length
    ? "needs-revision"
    : rejections.length
      ? "rejected"
      : approvalReport.valid
        ? "accepted"
        : "pending-unanimous-approval";
  const missingApprovals = approvalReport.missingApprovals || [];
  return {
    ...proposal,
    playerIds,
    votes: proposal.votes || [],
    status,
    acceptedAt: status === "accepted" ? Number(proposal.acceptedAt || Date.now()) : 0,
    rejectedAt: status === "rejected" ? Number(proposal.rejectedAt || Date.now()) : 0,
    approvalPolicy: "unanimous",
    majorityApprovalAllowed: false,
    approvalReport: {
      ...approvalReport,
      rejectionCount: rejections.length,
      missingApprovals,
      unanimousRequired: true,
    },
    applicationStatus: status === "accepted" ? "accepted-not-applied-to-state" : "not-applied",
    mutatesAuthoritativeState: false,
    validation: {
      valid: errors.length === 0,
      errors,
      sourceTextSafe: proposal.validation?.sourceTextSafe !== false,
      proposedTextSafe: proposal.validation?.proposedTextSafe !== false,
    },
  };
}

function createContextNotifications(session = {}, options = {}) {
  const context = createAssistantContext(session, options);
  const notifications = [];
  if (context.pendingChoices.length) {
    notifications.push(createSmartNotification({
      id: "manual-choice",
      priority: "critical",
      title: "Manual decision needed.",
      body: `${context.pendingChoices.length} rules or choice item${context.pendingChoices.length === 1 ? "" : "s"} need player input.`,
      category: "manual-choice",
      evidence: context.pendingChoices.map((entry) => entry.id || entry.sourceName || "choice").slice(0, 6),
    }));
  }
  const mandatoryTriggers = context.triggerQueue.filter((entry) => !entry.optional && !entry.may);
  if (mandatoryTriggers.length) {
    notifications.push(createSmartNotification({
      id: "mandatory-triggers",
      priority: "major",
      title: `${mandatoryTriggers.length} mandatory trigger${mandatoryTriggers.length === 1 ? "" : "s"} waiting.`,
      body: "Review the trigger queue before advancing the game.",
      category: "trigger",
      evidence: mandatoryTriggers.map((entry) => entry.id || entry.sourceName || "trigger").slice(0, 6),
    }));
  }
  const commanderTargets = findCommanderTargets(context);
  if (commanderTargets.length) {
    notifications.push(createSmartNotification({
      id: "commander-targeted",
      priority: "critical",
      title: "Commander is being targeted.",
      body: `${commanderTargets[0].name || "A Commander"} appears in current target evidence.`,
      category: "commander",
      evidence: commanderTargets.map((entry) => entry.id || entry.commanderId).slice(0, 4),
    }));
  }
  if (options.confidenceReport?.overall?.needsAttention) {
    notifications.push(createSmartNotification({
      id: "confidence-attention",
      priority: "normal",
      title: "Confidence needs review.",
      body: options.confidenceReport.overall.summary,
      category: "confidence",
      confidence: {
        information: options.confidenceReport.dimensions.information.level,
        execution: options.confidenceReport.dimensions.execution.level,
      },
    }));
  }
  const missedCount = Number(options.missedTriggerRecovery?.likelyMissedCount || 0);
  if (missedCount) {
    notifications.push(createSmartNotification({
      id: "missed-trigger-recovery",
      priority: "major",
      title: `${missedCount} possible missed trigger${missedCount === 1 ? "" : "s"}.`,
      body: "Review recovery choices with the table before continuing.",
      category: "trigger-recovery",
    }));
  }
  (options.opportunities || []).slice(0, 3).forEach((opportunity) => {
    notifications.push(createSmartNotification({
      id: opportunity.opportunityId,
      priority: opportunity.priority,
      title: opportunity.title,
      body: opportunity.detail,
      category: "opportunity",
      evidence: opportunity.evidence,
    }));
  });
  if (options.ruleAmendments?.pendingCount) {
    notifications.push(createSmartNotification({
      id: "rule-amendment-pending",
      priority: "major",
      title: `${options.ruleAmendments.pendingCount} table ruling proposal${options.ruleAmendments.pendingCount === 1 ? "" : "s"} pending.`,
      body: "A rule amendment cannot affect the session unless every player approves.",
      category: "rule-amendment",
    }));
  }
  return notifications;
}

function matchReminderCondition(context, reminder) {
  const condition = reminder.condition || {};
  const text = `${reminder.text} ${reminder.subjectName}`.toLowerCase();
  switch (condition.type) {
    case "phase":
      return matchPhaseReminder(context, reminder);
    case "turn":
      return {
        matched: Number(condition.turn || reminder.turn || 0) === context.turn,
        relevant: true,
        message: `Turn ${context.turn} reminder.`,
        evidence: ["turn"],
      };
    case "trigger":
    case "upkeep-trigger":
      return matchTriggerReminder(context, reminder);
    case "commander-can-attack":
      return matchCommanderAttackReminder(context, reminder);
    case "priority":
      return matchPriorityReminder(context, reminder);
    case "targeted":
      return matchTargetedReminder(context, reminder);
    case "zone-change":
      return matchZoneChangeReminder(context, reminder);
    case "life-total":
      return matchLifeReminder(context, reminder);
    case "counter-threshold":
      return matchCounterReminder(context, reminder);
    case "mana-available":
      return matchManaReminder(context, reminder);
    case "card-enters":
      return matchCardEnteredReminder(context, reminder);
    case "player-attacks":
      return matchPlayerAttacksReminder(context, reminder);
    case "rule":
      return {
        matched: Boolean(context.triggerQueue.length || context.stackObjects.length || context.pendingChoices.length),
        relevant: true,
        message: "A rules reminder is relevant while stack, triggers, or manual choices are pending.",
        confidence: recommendationConfidence("inferred", "tracking-only"),
      };
    case "battlefield-state":
    default:
      return {
        matched: /counter|token|combat|state|battlefield/.test(text) && Boolean(context.visiblePermanents.length || context.triggerQueue.length),
        relevant: true,
        message: "Battlefield state reminder is being monitored.",
        confidence: recommendationConfidence("inferred", "tracking-only"),
      };
  }
}

function matchPhaseReminder(context, reminder) {
  const expected = normalizePhaseLabel(reminder.condition.phase || reminder.condition.targetPhase || reminder.phase || reminder.text);
  const matched = expected ? context.phaseLabel === expected : false;
  return {
    matched,
    relevant: true,
    headline: reminder.text,
    message: matched ? `Current phase is ${context.phaseLabel}.` : `Waiting for ${expected || "the selected phase"}.`,
    priority: /before|combat/i.test(reminder.text) ? "major" : reminder.priority,
    confidence: recommendationConfidence("engine-verified", "engine-validated"),
    evidence: ["phase"],
  };
}

function matchTriggerReminder(context, reminder) {
  const text = `${reminder.text} ${reminder.subjectName}`.toLowerCase();
  const upkeep = reminder.condition.type === "upkeep-trigger" || /upkeep/.test(text);
  const matches = context.triggerQueue.filter((entry) => {
    const haystack = `${entry.sourceName || ""} ${entry.name || ""} ${entry.eventType || ""} ${entry.text || ""}`.toLowerCase();
    return (!upkeep || /upkeep|beginning/.test(haystack) || context.phaseLabel === "Beginning") &&
      (!reminder.subjectId || entry.id === reminder.subjectId || entry.sourceId === reminder.subjectId) &&
      (!reminder.subjectName || haystack.includes(reminder.subjectName.toLowerCase()) || text.includes(entry.sourceName?.toLowerCase?.() || ""));
  });
  const matched = matches.length > 0;
  return {
    matched,
    relevant: Boolean(context.triggerQueue.length || upkeep),
    headline: matched ? `${matches.length} matching trigger${matches.length === 1 ? "" : "s"} waiting.` : reminder.text,
    message: matched ? "Review this trigger before it is missed." : "No matching trigger is pending.",
    priority: matched && matches.some((entry) => !entry.optional && !entry.may) ? "major" : "normal",
    confidence: recommendationConfidence(matched ? "engine-verified" : "inferred", matched ? "engine-validated" : "tracking-only"),
    evidence: matches.map((entry) => entry.id || entry.sourceName || "trigger").slice(0, 6),
  };
}

function matchCommanderAttackReminder(context, reminder) {
  const localPlayerId = reminder.condition.playerId || reminder.createdByPlayerId || context.localPlayerId;
  const candidates = context.visiblePermanents.filter((permanent) =>
    isLocalPermanent(permanent, localPlayerId) &&
    (permanent.isCommander || permanent.commanderId || /legendary creature/i.test(permanent.typeLine || "")) &&
    isCreaturePermanent(permanent) &&
    !permanent.tapped &&
    !permanent.summoningSick &&
    !permanent.summoningSickness
  );
  const matched = context.phaseLabel === "Combat" && candidates.length > 0;
  return {
    matched,
    relevant: candidates.length > 0 || context.phaseLabel === "Combat",
    headline: matched ? "Commander can attack." : reminder.text,
    message: matched ? `${candidates[0].name || "Your commander"} is untapped during combat.` : "Waiting for a combat step where your commander can attack.",
    priority: "normal",
    confidence: recommendationConfidence(candidates.length ? "inferred" : "unknown", "tracking-only"),
    evidence: candidates.map((entry) => entry.id).slice(0, 4),
  };
}

function matchPriorityReminder(context, reminder) {
  const text = reminder.text.toLowerCase();
  const holder = context.priorityHolderId;
  const opponentIds = new Set(context.opponents.map((entry) => entry.playerId || entry.id).filter(Boolean));
  const matched = /opponent/.test(text) ? opponentIds.has(holder) : !reminder.condition.playerId || holder === reminder.condition.playerId;
  return {
    matched,
    relevant: Boolean(holder),
    headline: matched ? "Priority reminder." : reminder.text,
    message: matched ? `${holder} has priority.` : "Priority has not reached the watched player yet.",
    priority: "normal",
    confidence: recommendationConfidence("engine-verified", "engine-validated"),
    evidence: ["priority"],
  };
}

function matchTargetedReminder(context, reminder) {
  const watchedIds = new Set([reminder.subjectId, reminder.condition.objectId, ...context.commanders.map((entry) => entry.commanderId)].filter(Boolean));
  const watchedNames = [reminder.subjectName, /commander/i.test(reminder.text) ? "commander" : ""].filter(Boolean).map((entry) => entry.toLowerCase());
  const stackMatches = context.stackObjects.filter((entry) => {
    const ids = normalizeStringArray(entry.targetIds || entry.targets || entry.targetPermanentIds);
    const names = normalizeStringArray(entry.targetNames || entry.targetLabels).map((value) => value.toLowerCase());
    return ids.some((id) => watchedIds.has(id)) ||
      names.some((name) => watchedNames.some((watched) => name.includes(watched))) ||
      (/commander/i.test(reminder.text) && ids.some((id) => context.commanders.some((commander) => commander.commanderId === id)));
  });
  return {
    matched: stackMatches.length > 0,
    relevant: Boolean(context.stackObjects.length),
    headline: stackMatches.length ? "Watched object is targeted." : reminder.text,
    message: stackMatches.length ? `${stackMatches[0].name || stackMatches[0].card?.name || "A stack object"} is targeting the watched object.` : "No matching target evidence is currently on the stack.",
    priority: stackMatches.length ? "critical" : "normal",
    confidence: recommendationConfidence(stackMatches.length ? "engine-verified" : "unknown", stackMatches.length ? "engine-validated" : "tracking-only"),
    evidence: stackMatches.map((entry) => entry.id || entry.name || "stack").slice(0, 4),
  };
}

function matchZoneChangeReminder(context, reminder) {
  const latest = context.latestEvent;
  const moved = latest && (latest.where?.sourceZone || latest.where?.destinationZone);
  const names = normalizeStringArray(latest?.what?.objectNames).join(" ").toLowerCase();
  const matched = Boolean(moved && (
    !reminder.subjectName ||
    names.includes(reminder.subjectName.toLowerCase()) ||
    latest.what?.objectIds?.includes(reminder.subjectId)
  ));
  return {
    matched,
    relevant: Boolean(moved),
    headline: matched ? "Watched object changed zones." : reminder.text,
    message: matched ? `${latest.where.sourceZone || "unknown"} to ${latest.where.destinationZone || "unknown"}.` : "No matching zone movement is recorded.",
    priority: "normal",
    confidence: recommendationConfidence(matched ? latest.informationConfidence : "unknown", matched ? latest.executionConfidence : "tracking-only"),
    evidence: matched ? [latest.eventId] : [],
  };
}

function matchLifeReminder(context, reminder) {
  const playerId = reminder.condition.playerId || reminder.createdByPlayerId || context.localPlayerId;
  const threshold = Number(reminder.condition.value ?? reminder.condition.threshold ?? extractFirstNumber(reminder.text));
  const comparator = reminder.condition.comparator || (/\bbelow|less|under|at or below\b/i.test(reminder.text) ? "<=" : ">=");
  const player = context.players.find((entry) => (entry.playerId || entry.id) === playerId) || { life: context.session.life };
  const life = Number(player.life ?? context.session.life ?? 40);
  const matched = Number.isFinite(threshold) ? compareNumber(life, comparator, threshold) : false;
  return {
    matched,
    relevant: Number.isFinite(life),
    headline: matched ? "Life total reminder." : reminder.text,
    message: matched ? `${player.displayName || playerId} is at ${life} life.` : `Current life is ${life}.`,
    priority: matched && life <= 10 ? "major" : "normal",
    confidence: recommendationConfidence("engine-verified", "engine-validated"),
    evidence: [playerId || "life"],
  };
}

function matchCounterReminder(context, reminder) {
  const counterName = reminder.condition.counter || inferCounterName(reminder.text);
  const threshold = Number(reminder.condition.value ?? reminder.condition.threshold ?? extractFirstNumber(reminder.text) ?? 1);
  const matches = context.visiblePermanents.filter((entry) => Number(entry.counters?.[counterName] || 0) >= threshold);
  return {
    matched: matches.length > 0,
    relevant: Boolean(counterName),
    headline: matches.length ? `${counterName} counter reminder.` : reminder.text,
    message: matches.length ? `${matches[0].name || "A permanent"} has ${matches[0].counters?.[counterName]} ${counterName} counter(s).` : `Watching for ${counterName} counters.`,
    priority: "normal",
    confidence: recommendationConfidence(matches.length ? "engine-verified" : "inferred", matches.length ? "engine-validated" : "tracking-only"),
    evidence: matches.map((entry) => entry.id).slice(0, 6),
  };
}

function matchManaReminder(context, reminder) {
  const threshold = Number(reminder.condition.value ?? reminder.condition.threshold ?? extractFirstNumber(reminder.text) ?? 1);
  const manaTotal = Object.values(context.session.manaPool || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  return {
    matched: manaTotal >= threshold,
    relevant: true,
    headline: manaTotal >= threshold ? "Mana reminder." : reminder.text,
    message: `${manaTotal} mana is currently floating.`,
    priority: manaTotal ? "minor" : "informational",
    confidence: recommendationConfidence("engine-verified", "engine-validated"),
    evidence: ["manaPool"],
  };
}

function matchCardEnteredReminder(context, reminder) {
  const latest = context.latestEvent;
  const entered = latest && /enter|created|token/i.test(`${latest.what?.eventType || ""} ${latest.what?.summary || ""}`);
  const names = normalizeStringArray(latest?.what?.objectNames).join(" ").toLowerCase();
  const matched = Boolean(entered && (!reminder.subjectName || names.includes(reminder.subjectName.toLowerCase())));
  return {
    matched,
    relevant: Boolean(entered),
    headline: matched ? "Watched card entered." : reminder.text,
    message: matched ? `${latest.what?.summary || "A watched object entered."}` : "No matching enter event is recorded.",
    priority: "normal",
    confidence: recommendationConfidence(matched ? latest.informationConfidence : "unknown", matched ? latest.executionConfidence : "tracking-only"),
    evidence: matched ? [latest.eventId] : [],
  };
}

function matchPlayerAttacksReminder(context, reminder) {
  const attacking = context.session.combat?.attackerIds || [];
  const matched = attacking.length > 0;
  return {
    matched,
    relevant: context.phaseLabel === "Combat" || matched,
    headline: matched ? "Attack reminder." : reminder.text,
    message: matched ? `${attacking.length} attacker${attacking.length === 1 ? "" : "s"} declared.` : "No attacks are currently declared.",
    priority: matched ? "major" : "normal",
    confidence: recommendationConfidence(matched ? "engine-verified" : "inferred", matched ? "engine-validated" : "tracking-only"),
    evidence: attacking.slice(0, 8),
  };
}

function createAssistantContext(session = {}, options = {}) {
  const eventKnowledge = createEventKnowledgeState(session.eventKnowledge || {});
  const perspective = options.perspective || {};
  const participants = Array.isArray(session.participants) ? session.participants : [];
  const players = normalizePlayers(session, perspective);
  const localPlayerId = options.localPlayerId || session.localPerspective?.playerId || session.advancedMultiplayer?.localPerspectivePlayerId || perspective.localPlayerId || "local-player";
  const triggerQueue = clonePlain(session.triggerQueue || []).filter((entry) => entry && !RESOLVED_STATUSES.has(String(entry.status || "").toLowerCase()));
  const pendingChoices = clonePlain(session.pendingEffects || []).filter((entry) => entry && !RESOLVED_STATUSES.has(String(entry.status || "").toLowerCase()));
  const stackObjects = clonePlain(session.stack || []);
  const visiblePermanents = collectVisiblePermanents(session, options);
  return {
    session,
    eventKnowledge,
    turn: Number(session.turn || session.turnState?.turnNumber || 1),
    phaseLabel: resolvePhaseLabel(session),
    step: String(session.step || session.turnState?.currentStep || ""),
    participants,
    players,
    opponents: players.filter((entry) => (entry.playerId || entry.id) !== localPlayerId),
    localPlayerId,
    priorityHolderId: session.priority?.activePlayerId || session.priorityState?.priorityHolderId || session.turnOrder?.activePlayerId || "",
    activePlayerId: session.turnOrder?.activePlayerId || session.syncedMultiplayer?.currentPlayerId || session.priority?.activePlayerId || "",
    triggerQueue,
    manualTriggers: triggerQueue.filter((entry) => String(entry.rulesConfidence || "").includes("manual") || entry.manual),
    pendingChoices,
    stackObjects,
    visiblePermanents,
    commanders: collectCommanderReferences(session, visiblePermanents),
    latestEvent: eventKnowledge.events[0] || null,
  };
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
    const id = String(permanent.id || permanent.objectId || `${permanent.name || "permanent"}:${index}`);
    if (!byId.has(id)) {
      byId.set(id, sanitizePermanent({ ...permanent, id }));
    }
  });
  return [...byId.values()];
}

function collectCommanderReferences(session = {}, visiblePermanents = []) {
  const fromSession = session.commander?.name
    ? [{
        commanderId: session.commander.cardId || session.commander.name,
        name: session.commander.name,
        ownerPlayerId: "local-player",
        controllerPlayerId: "local-player",
        zone: session.commander.zone || "none",
        commanderTax: Number(session.commander.commanderTax || 0),
        castCount: Number(session.commander.castCount || 0),
      }]
    : [];
  const commanderSources = Array.isArray(session.commanderSession?.commanderSources)
    ? session.commanderSession.commanderSources.map((entry) => ({
        commanderId: entry.commanderObjectId || entry.commanderId || entry.cardInstanceId || entry.name,
        name: entry.name || entry.commanderName || entry.commanderObjectId || "Commander",
        ownerPlayerId: entry.ownerPlayerId || entry.playerId || "",
        controllerPlayerId: entry.controllerPlayerId || entry.ownerPlayerId || entry.playerId || "",
        zone: entry.currentZone || entry.zone || session.commanderSession?.commanderZoneByCommanderId?.[entry.commanderObjectId] || "unknown",
        commanderTax: Number(entry.commanderTax ?? session.commanderSession?.commanderTaxByCommanderId?.[entry.commanderObjectId] ?? 0),
        castCount: Number(entry.castCount ?? session.commanderSession?.commanderCastCountByCommanderId?.[entry.commanderObjectId] ?? 0),
      }))
    : [];
  const fromBattlefield = visiblePermanents
    .filter((entry) => entry.isCommander || entry.commanderId)
    .map((entry) => ({
      commanderId: entry.commanderId || entry.id,
      name: entry.name || "Commander",
      ownerPlayerId: entry.ownerPlayerId || entry.owner || "",
      controllerPlayerId: entry.controllerPlayerId || entry.controller || entry.ownerPlayerId || "",
      zone: entry.zone || "battlefield",
      commanderTax: Number(entry.commanderTax || 0),
      castCount: Number(entry.castCount || 0),
      id: entry.id,
    }));
  return dedupeById([...fromSession, ...commanderSources, ...fromBattlefield], "commanderId");
}

function normalizePlayers(session = {}, perspective = {}) {
  const fromPerspective = Array.isArray(perspective.participants)
    ? perspective.participants.map((entry) => ({
        playerId: entry.playerId || entry.id,
        displayName: entry.displayName || entry.name || entry.playerId,
        life: entry.life,
        connectionStatus: entry.connectionStatus,
      }))
    : [];
  const fromSession = Array.isArray(session.players)
    ? session.players.map((entry) => ({
        playerId: entry.playerId || entry.id,
        displayName: entry.displayName || entry.name || entry.playerId || entry.id,
        life: entry.life,
        connectionStatus: entry.connectionStatus,
      }))
    : [];
  const fromParticipants = Array.isArray(session.participants)
    ? session.participants.flatMap((participant) =>
        (participant.controlledPlayerIds?.length ? participant.controlledPlayerIds : [participant.playerId]).filter(Boolean).map((playerId) => ({
          playerId,
          displayName: participant.displayName || playerId,
          connectionStatus: participant.connectionStatus,
        }))
      )
    : [];
  const fallback = [{ playerId: "local-player", displayName: "Player", life: session.life ?? 40, connectionStatus: "local" }];
  return dedupeById([...fromPerspective, ...fromSession, ...fromParticipants, ...fallback], "playerId");
}

function normalizeReminderCondition(condition = {}) {
  if (typeof condition === "string") {
    return { type: normalizeAllowed(condition, REMINDER_CONDITION_TYPES, "battlefield-state") };
  }
  const type = normalizeAllowed(condition.type || condition.kind, REMINDER_CONDITION_TYPES, "battlefield-state");
  return {
    ...sanitizeMetadata(condition),
    type,
    phase: condition.phase ? normalizePhaseLabel(condition.phase) : "",
    targetPhase: condition.targetPhase ? normalizePhaseLabel(condition.targetPhase) : "",
  };
}

function inferReminderIntent(text = "", input = {}) {
  const normalized = String(text || "").toLowerCase();
  if (/upkeep/.test(normalized) && /trigger/.test(normalized)) {
    return { condition: { type: "upkeep-trigger" }, subjectType: "trigger", priority: "major", repeats: true };
  }
  if (/commander/.test(normalized) && /(attack|summoning sickness|can attack)/.test(normalized)) {
    return { condition: { type: "commander-can-attack" }, subjectType: "commander", priority: "normal", repeats: true };
  }
  if (/target.*commander|commander.*target/.test(normalized)) {
    return { condition: { type: "targeted" }, subjectType: "commander", priority: "critical", repeats: true };
  }
  if (/priority/.test(normalized)) {
    return { condition: { type: "priority" }, subjectType: "opponent", priority: "normal", repeats: true };
  }
  if (/before.*combat|move to combat|combat/.test(normalized)) {
    return { condition: { type: "phase", phase: "Combat" }, subjectType: "phase", priority: "major", repeats: true };
  }
  if (/leave|dies|destroy|exile|bounce|return/.test(normalized)) {
    return { condition: { type: "zone-change" }, subjectType: "zone", priority: "normal", repeats: true };
  }
  if (/life/.test(normalized)) {
    return { condition: { type: "life-total", value: extractFirstNumber(normalized) || input.value || 10, comparator: normalized.includes("above") ? ">=" : "<=" }, subjectType: "life-total", priority: "normal" };
  }
  if (/counter/.test(normalized)) {
    return { condition: { type: "counter-threshold", counter: inferCounterName(normalized), value: extractFirstNumber(normalized) || 1 }, subjectType: "counter", priority: "normal", repeats: true };
  }
  if (/mana/.test(normalized)) {
    return { condition: { type: "mana-available", value: extractFirstNumber(normalized) || 1 }, subjectType: "mana", priority: "minor", repeats: true };
  }
  if (/enter|etb/.test(normalized)) {
    return { condition: { type: "card-enters" }, subjectType: "card", priority: "normal", repeats: true };
  }
  if (/attack/.test(normalized)) {
    return { condition: { type: "player-attacks" }, subjectType: "battlefield-state", priority: "major", repeats: true };
  }
  if (/trigger/.test(normalized)) {
    return { condition: { type: "trigger" }, subjectType: "trigger", priority: "normal", repeats: true };
  }
  if (/rule|ruling|judge/.test(normalized)) {
    return { condition: { type: "rule" }, subjectType: "rule", priority: "normal" };
  }
  return { condition: { type: "battlefield-state" }, subjectType: "future-state", priority: "normal" };
}

function createReminderEvaluation(reminder, patch = {}) {
  const notification = patch.shouldNotify
    ? createSmartNotification({
        id: `reminder:${reminder?.reminderId || "invalid"}`,
        priority: patch.priority || reminder?.priority || "normal",
        title: patch.headline || reminder?.text || "Reminder",
        body: patch.message || reminder?.text || "",
        category: "reminder",
        confidence: patch.confidence || reminder?.confidence,
        evidence: patch.evidence || reminder?.evidence || [],
      })
    : null;
  return {
    reminderId: reminder?.reminderId || "",
    status: patch.status || reminder?.status || "active",
    relevant: Boolean(patch.relevant),
    shouldNotify: Boolean(patch.shouldNotify),
    matchedAt: Number(patch.matchedAt || 0),
    priority: normalizePriority(patch.priority || reminder?.priority || "normal"),
    message: String(patch.message || ""),
    confidence: normalizeRecommendationConfidence(patch.confidence || reminder?.confidence || {}),
    evidence: clonePlain(patch.evidence || []),
    notification,
  };
}

function normalizeTriggerRecoveryItem(trigger = {}, currentTurn = 1) {
  const createdTurn = Number(trigger.turn || trigger.createdTurn || trigger.createdOnTurn || currentTurn);
  const status = String(trigger.status || "pending").toLowerCase();
  const optional = Boolean(trigger.optional || trigger.may);
  const delayed = status === "delayed" || trigger.delayed;
  const likelyMissed = status === "missed" || (createdTurn > 0 && createdTurn < currentTurn && status === "pending");
  return {
    triggerId: String(trigger.id || trigger.triggerId || ""),
    sourceName: String(trigger.sourceName || trigger.name || "Trigger"),
    eventType: String(trigger.eventType || trigger.triggerType || "trigger"),
    optional,
    mandatory: !optional,
    recoveryStatus: likelyMissed ? "likely-missed" : delayed ? "delayed" : "pending",
    createdTurn,
    currentTurn,
    confidence: recommendationConfidence(likelyMissed || delayed ? "inferred" : "engine-verified", "manual-resolution-required"),
    recoveryOptions: [
      optional ? "Acknowledge and decline the optional trigger if the table agrees." : "Place the mandatory trigger on the stack if policy and table context support it.",
      "Resolve manually with all affected players aware of the correction.",
      "Cancel or revise the affected action if the interaction cannot be repaired cleanly.",
    ],
  };
}

function createOpportunity(input = {}) {
  return {
    opportunityId: String(input.id || createContractId("notificationId")),
    title: sanitizeText(input.title || "Legal opportunity available."),
    detail: sanitizeText(input.detail || ""),
    priority: normalizePriority(input.priority || "informational"),
    opportunityType: "legal-opportunity",
    strategyAdvice: false,
    evidence: normalizeStringArray(input.evidence).slice(0, 8),
    confidence: normalizeRecommendationConfidence(input.confidence || recommendationConfidence("inferred", "tracking-only")),
  };
}

function createSmartNotification(input = {}) {
  return normalizeSmartNotification(input);
}

function normalizeSmartNotification(input = {}) {
  if (!input || typeof input !== "object") return null;
  const title = sanitizeText(input.title || input.headline || "");
  const body = sanitizeText(input.body || input.message || "");
  const id = String(input.notificationId || input.id || stableHash(`${title}|${body}|${input.category || ""}`));
  const priority = normalizePriority(input.priority || input.importance || "normal");
  return {
    notificationId: normalizeContractId(id.startsWith("notification") ? id : createContractId("notificationId", id), "notificationId"),
    dedupeKey: String(input.dedupeKey || `${input.category || "assistant"}:${id}`),
    version: PROACTIVE_ASSISTANT_VERSION,
    priority,
    category: String(input.category || "assistant"),
    title: title || "BoardState assistant",
    body,
    createdAt: Number(input.createdAt || Date.now()),
    intrusive: priority === "critical",
    autoDismiss: priority !== "critical",
    playerAgencyPreserved: true,
    recommendationOnly: true,
    confidence: normalizeRecommendationConfidence(input.confidence || {}),
    evidence: normalizeStringArray(input.evidence).slice(0, 10),
  };
}

function summarizeNotifications(notifications = []) {
  const counts = Object.fromEntries(SMART_NOTIFICATION_PRIORITIES.map((priority) => [priority, 0]));
  notifications.forEach((entry) => {
    counts[entry.priority] = Number(counts[entry.priority] || 0) + 1;
  });
  return {
    total: notifications.length,
    critical: counts.critical,
    major: counts.major,
    normal: counts.normal,
    minor: counts.minor,
    informational: counts.informational,
    topPriority: notifications[0]?.priority || "informational",
  };
}

function summarizeOverallConfidence(levels = {}) {
  const information = levels.information || "unknown";
  const execution = levels.execution || "tracking-only";
  const needsAttention = information === "unknown" ||
    execution === "manual-resolution-required" ||
    execution === "enforcement-waived" ||
    levels.state === "unknown" ||
    levels.synchronization === "estimated";
  return {
    information,
    execution,
    needsAttention,
    summary: needsAttention
      ? "Some assistant recommendations are limited by missing information, manual choices, waivers, or sync uncertainty."
      : "Current assistant confidence is high for the tracked public game state.",
  };
}

function confidenceDimension(level, input = {}, allowed = INFORMATION_CONFIDENCE_LEVELS) {
  const normalized = normalizeAllowed(level, allowed, allowed.includes("unknown") ? "unknown" : allowed[0]);
  return {
    level: normalized,
    known: normalizeStringArray(input.known).slice(0, 8),
    uncertain: normalizeStringArray(input.uncertain).slice(0, 8),
    improve: normalizeStringArray(input.improve).slice(0, 8),
  };
}

function recommendationConfidence(information = "inferred", execution = "tracking-only") {
  return normalizeRecommendationConfidence({ information, execution });
}

function normalizeRecommendationConfidence(value = {}) {
  return {
    information: normalizeAllowed(value.information, INFORMATION_CONFIDENCE_LEVELS, "inferred"),
    execution: normalizeAllowed(value.execution, EXECUTION_CONFIDENCE_LEVELS, "tracking-only"),
    rules: normalizeAllowed(value.rules || value.information, INFORMATION_CONFIDENCE_LEVELS, "inferred"),
    state: normalizeAllowed(value.state || value.information, INFORMATION_CONFIDENCE_LEVELS, "inferred"),
    synchronization: normalizeAllowed(value.synchronization || "engine-verified", INFORMATION_CONFIDENCE_LEVELS, "engine-verified"),
    replay: normalizeAllowed(value.replay || "estimated", INFORMATION_CONFIDENCE_LEVELS, "estimated"),
    futureAi: normalizeAllowed(value.futureAi || "tracking-only", EXECUTION_CONFIDENCE_LEVELS, "tracking-only"),
  };
}

function normalizeRuleAmendmentProposal(input = {}, session = {}) {
  if (!input || typeof input !== "object") return null;
  return {
    ruleAmendmentId: normalizeContractId(input.ruleAmendmentId || input.id || createContractId("ruleAmendmentId"), "ruleAmendmentId"),
    version: input.version || RULE_AMENDMENT_SYSTEM_VERSION,
    type: normalizeAllowed(input.type, RULE_AMENDMENT_TYPES, "table-amendment"),
    status: normalizeAllowed(input.status, RULE_AMENDMENT_STATUSES, "pending-unanimous-approval"),
    proposedText: sanitizeText(input.proposedText || input.text || ""),
    sourceText: sanitizeText(input.sourceText || input.referenceText || input.proposedText || input.text || ""),
    proposedByPlayerId: String(input.proposedByPlayerId || input.playerId || inferLocalPlayerId(session) || "local-player"),
    proposedByParticipantId: String(input.proposedByParticipantId || input.participantId || ""),
    proposedAt: Number(input.proposedAt || input.createdAt || Date.now()),
    acceptedAt: Number(input.acceptedAt || 0),
    rejectedAt: Number(input.rejectedAt || 0),
    affectedRules: normalizeStringArray(input.affectedRules),
    affectedEventIds: normalizeStringArray(input.affectedEventIds || input.eventIds),
    affectedQuestionIds: normalizeStringArray(input.affectedQuestionIds || input.questionIds),
    votes: normalizeRuleAmendmentVotes(input.votes || []),
    playerIds: resolveRuleAmendmentPlayerIds(session, input.playerIds || input.players),
    approvalPolicy: "unanimous",
    majorityApprovalAllowed: false,
    officialRulesRemainAuthoritative: true,
    tableRuling: true,
    mutatesAuthoritativeState: false,
    applicationStatus: String(input.applicationStatus || "not-applied"),
    confidenceImpact: {
      information: normalizeAllowed(input.confidenceImpact?.information, INFORMATION_CONFIDENCE_LEVELS, "table-ruling"),
      execution: normalizeAllowed(input.confidenceImpact?.execution, EXECUTION_CONFIDENCE_LEVELS, "manual-resolution-required"),
      reason: sanitizeText(input.confidenceImpact?.reason || ""),
    },
    validation: {
      valid: input.validation?.valid !== false,
      errors: normalizeStringArray(input.validation?.errors),
      sourceTextSafe: input.validation?.sourceTextSafe !== false,
      proposedTextSafe: input.validation?.proposedTextSafe !== false,
    },
    history: Array.isArray(input.history) ? input.history.map(sanitizeRuleAmendmentHistoryEntry).filter(Boolean) : [],
  };
}

function normalizeRuleAmendmentVotes(votes = []) {
  return (Array.isArray(votes) ? votes : []).map(normalizeRuleAmendmentVote).filter((entry) => entry.playerId);
}

function normalizeRuleAmendmentVote(input = {}) {
  const vote = String(input.vote || input.status || (input.approved ? "approve" : "")).toLowerCase();
  return {
    playerId: String(input.playerId || input.id || input.approvedBy || ""),
    participantId: String(input.participantId || ""),
    vote: vote === "reject" || vote === "rejected" ? "reject" : vote === "approve" || vote === "approved" ? "approve" : "pending",
    reason: sanitizeText(input.reason || ""),
    votedAt: Number(input.votedAt || input.createdAt || Date.now()),
  };
}

function sanitizeRuleAmendmentHistoryEntry(input = {}) {
  if (!input || typeof input !== "object") return null;
  return {
    historyId: String(input.historyId || createContractId("eventId", stableHash(JSON.stringify({
      type: input.type,
      playerId: input.playerId,
      at: input.createdAt || input.timestamp || Date.now(),
    })))),
    type: sanitizeText(input.type || "rule-amendment-history"),
    playerId: String(input.playerId || ""),
    participantId: String(input.participantId || ""),
    reason: sanitizeText(input.reason || ""),
    createdAt: Number(input.createdAt || input.timestamp || Date.now()),
  };
}

function resolveRuleAmendmentPlayerIds(playersOrSession = [], fallbackPlayers = []) {
  const candidates = Array.isArray(playersOrSession)
    ? playersOrSession
    : Array.isArray(playersOrSession?.players)
      ? playersOrSession.players
      : Array.isArray(playersOrSession?.participants)
        ? playersOrSession.participants.flatMap((participant) => participant.controlledPlayerIds || participant.playerId || [])
        : Array.isArray(fallbackPlayers)
          ? fallbackPlayers
          : [];
  return [...new Set((Array.isArray(candidates) ? candidates : [])
    .map((entry) => typeof entry === "string" ? entry : entry?.playerId || entry?.id)
    .filter(Boolean))];
}

function findCommanderTargets(context = {}) {
  const commanderIds = new Set(context.commanders.map((entry) => entry.commanderId || entry.id).filter(Boolean));
  const commanderNames = new Set(context.commanders.map((entry) => String(entry.name || "").toLowerCase()).filter(Boolean));
  return context.commanders.filter((commander) =>
    context.stackObjects.some((entry) => {
      const ids = normalizeStringArray(entry.targetIds || entry.targets || entry.targetPermanentIds);
      const names = normalizeStringArray(entry.targetNames || entry.targetLabels).map((value) => value.toLowerCase());
      return ids.some((id) => commanderIds.has(id) || id === commander.id) ||
        names.some((name) => commanderNames.has(name) || /commander/.test(name));
    })
  );
}

function sanitizePermanent(permanent = {}) {
  const safe = clonePlain(permanent);
  delete safe.hand;
  delete safe.library;
  delete safe.sideboard;
  delete safe.password;
  delete safe.token;
  delete safe.authToken;
  delete safe.privateToken;
  delete safe.secret;
  delete safe.privateNotes;
  return safe;
}

function sanitizeMetadata(value = {}) {
  const safe = clonePlain(value || {});
  Object.keys(safe).forEach((key) => {
    if (/password|token|secret|credential|auth/i.test(key)) {
      delete safe[key];
    }
  });
  return safe;
}

function isPrivateZone(zone = "") {
  const normalized = String(zone || "").toLowerCase();
  return PRIVATE_ZONE_NAMES.some((privateZone) => normalized.includes(privateZone));
}

function resolvePhaseLabel(session = {}) {
  return session.phase || PHASES[Number(session.phaseIndex || 0)] || session.turnState?.currentPhase || "Beginning";
}

function normalizePhaseLabel(value = "") {
  const text = String(value || "").toLowerCase();
  const direct = PHASES.find((phase) => phase.toLowerCase() === text);
  if (direct) return direct;
  const alias = Object.entries(PHASE_ALIASES).find(([key]) => text.includes(key));
  return alias?.[1] || "";
}

function inferLocalPlayerId(session = {}) {
  return session.localPerspective?.playerId ||
    session.advancedMultiplayer?.localPerspectivePlayerId ||
    session.participants?.find((entry) => entry.relationship === "local")?.controlledPlayerIds?.[0] ||
    "local-player";
}

function isLocalPermanent(permanent = {}, localPlayerId = "local-player") {
  return [permanent.controllerPlayerId, permanent.controller, permanent.ownerPlayerId, permanent.owner].filter(Boolean).includes(localPlayerId) ||
    (!permanent.controllerPlayerId && !permanent.controller && !permanent.ownerPlayerId && !permanent.owner);
}

function isCreaturePermanent(permanent = {}) {
  return Boolean(permanent.isCreature || /creature/i.test(permanent.typeLine || ""));
}

function normalizeAllowed(value = "", allowed = [], fallback = "") {
  const normalized = String(value || "").trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizePriority(value = "normal") {
  return normalizeAllowed(value, SMART_NOTIFICATION_PRIORITIES, "normal");
}

function priorityRank(value = "normal") {
  const index = SMART_NOTIFICATION_PRIORITIES.indexOf(normalizePriority(value));
  return index >= 0 ? index : 2;
}

function normalizeStringArray(value = []) {
  return [...new Set((Array.isArray(value) ? value : [value]).map((entry) => String(entry || "").trim()).filter(Boolean))];
}

function sanitizeText(value = "", max = 1400) {
  return String(value || "")
    .replace(/<\s*script\b[^>]*>.*?<\s*\/\s*script\s*>/gis, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function sanitizeKeyValueCounts(value = {}) {
  return Object.fromEntries(
    Object.entries(value || {})
      .map(([key, count]) => [sanitizeText(key, 120), Math.max(0, Math.floor(Number(count || 0)))])
      .filter(([key]) => key)
      .slice(0, 80)
  );
}

function extractFirstNumber(value = "") {
  const match = String(value || "").match(/-?\d+/);
  return match ? Number(match[0]) : NaN;
}

function inferCounterName(value = "") {
  const text = String(value || "").toLowerCase();
  if (text.includes("-1/-1")) return "-1/-1";
  if (text.includes("+1/+1")) return "+1/+1";
  if (text.includes("loyalty")) return "loyalty";
  if (text.includes("poison")) return "poison";
  if (text.includes("experience")) return "experience";
  return "+1/+1";
}

function compareNumber(left, comparator = ">=", right) {
  switch (comparator) {
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case ">":
      return left > right;
    case "=":
    case "==":
    case "===":
      return left === right;
    case ">=":
    default:
      return left >= right;
  }
}

function dedupeById(entries = [], key = "opportunityId") {
  const byId = new Map();
  entries.forEach((entry) => {
    const id = entry?.[key] || entry?.id || "";
    if (id && !byId.has(id)) byId.set(id, entry);
  });
  return [...byId.values()];
}

function stableHash(seed = "") {
  let hash = 2166136261;
  const input = String(seed || "");
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(36);
}
