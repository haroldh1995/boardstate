import { clone } from "../state/ids.js";
import { createContractId, normalizeContractId } from "../shared-contracts/ids.js";
import { buildStableChecksum } from "../shared-contracts/contracts.js";
import {
  DEFAULT_RULES_ENGINE_VERSION,
  SHARED_CONTRACT_SCHEMA_VERSION,
  SHARED_SAVE_FORMAT_VERSION,
  SHARED_SYNC_PROTOCOL_VERSION,
} from "../shared-contracts/version.js";
import {
  createEventKnowledgeState,
  EVENT_KNOWLEDGE_ENGINE_VERSION,
  reconstructStateAfterEvent,
} from "../authoritative-core/eventKnowledgeEngine.js";
import { createStateEngineSnapshot, STATE_ENGINE_VERSION } from "../authoritative-core/stateEngine.js";

export const CANONICAL_PERSISTENCE_VERSION = "boardstate-persistence-0.1.0";
export const CANONICAL_SAVE_VERSION = "boardstate-canonical-save-0.1.0";
export const REPLAY_ENGINE_VERSION = "boardstate-replay-0.1.0";
export const CHECKPOINT_VERSION = "boardstate-checkpoint-0.1.0";
export const SERIALIZATION_VERSION = "boardstate-serialization-0.1.0";
export const MIGRATION_VERSION = "boardstate-save-migration-0.1.0";

export const CHECKPOINT_REASONS = Object.freeze([
  "beginning-of-game",
  "beginning-of-turn",
  "beginning-of-phase",
  "before-spell-resolves",
  "after-completed-stack",
  "before-elimination",
  "before-game-ending",
  "manual",
  "recovery",
]);

export const REPLAY_MODES = Object.freeze([
  "full-replay",
  "turn-replay",
  "phase-replay",
  "combat-replay",
  "stack-replay",
  "player-replay",
  "event-replay",
]);

export const REPLAY_SPEEDS = Object.freeze(["pause", "step", "normal", "2x", "4x", "8x"]);

export const AUTO_SAVE_POLICIES = Object.freeze([
  "every-action",
  "every-priority-change",
  "every-spell",
  "every-turn",
  "every-phase",
  "manual-only",
]);

const MAX_IMPORTED_SAVE_BYTES = 6_000_000;
const MAX_CHECKPOINTS = 420;
const FORBIDDEN_EXPORT_KEYS = new Set([
  "password",
  "plaintextpassword",
  "authtoken",
  "privatetoken",
  "synccredentials",
  "credential",
  "credentials",
  "secret",
]);

export function createPersistenceState(input = {}) {
  const checkpoints = Array.isArray(input.checkpoints)
    ? input.checkpoints.map(normalizeCheckpoint).filter(Boolean)
    : [];
  return {
    persistenceVersion: input.persistenceVersion || CANONICAL_PERSISTENCE_VERSION,
    canonicalSaveVersion: input.canonicalSaveVersion || CANONICAL_SAVE_VERSION,
    replayVersion: input.replayVersion || REPLAY_ENGINE_VERSION,
    checkpointVersion: input.checkpointVersion || CHECKPOINT_VERSION,
    serializationVersion: input.serializationVersion || SERIALIZATION_VERSION,
    migrationVersion: input.migrationVersion || MIGRATION_VERSION,
    checkpoints: checkpoints.slice(0, MAX_CHECKPOINTS),
    latestCheckpointId: input.latestCheckpointId || checkpoints[0]?.checkpointId || "",
    autoSave: createAutoSaveState(input.autoSave || {}),
    recovery: createRecoveryState(input.recovery || {}),
    replay: createReplayMetadata(input.replay || {}),
    migrations: Array.isArray(input.migrations) ? input.migrations.map(normalizeMigrationRecord) : [],
    integrity: clone(input.integrity || {}),
  };
}

export function createAutoSaveState(input = {}) {
  const policy = AUTO_SAVE_POLICIES.includes(input.policy) ? input.policy : "every-action";
  return {
    policy,
    configurable: true,
    intervalMs: Math.max(0, Number(input.intervalMs || 0)),
    lightweight: input.lightweight !== false,
    lastAutoSaveAt: Number(input.lastAutoSaveAt || 0),
    lastAutoSaveActionId: String(input.lastAutoSaveActionId || ""),
    lastAutoSaveReason: String(input.lastAutoSaveReason || ""),
    pendingAutoSave: Boolean(input.pendingAutoSave),
  };
}

export function createRecoveryState(input = {}) {
  return {
    recoveryVersion: input.recoveryVersion || CANONICAL_PERSISTENCE_VERSION,
    status: String(input.status || "clean"),
    lastSavedAt: Number(input.lastSavedAt || 0),
    lastRecoveredAt: Number(input.lastRecoveredAt || 0),
    recoveryPointEventId: String(input.recoveryPointEventId || ""),
    recoveryPointCheckpointId: String(input.recoveryPointCheckpointId || ""),
    crashSafe: input.crashSafe !== false,
    warnings: normalizeStringArray(input.warnings),
    errors: normalizeStringArray(input.errors),
  };
}

export function createReplayMetadata(input = {}) {
  return {
    replayVersion: input.replayVersion || REPLAY_ENGINE_VERSION,
    modes: Array.isArray(input.modes) ? normalizeAllowed(input.modes, REPLAY_MODES) : [...REPLAY_MODES],
    speeds: Array.isArray(input.speeds) ? normalizeAllowed(input.speeds, REPLAY_SPEEDS) : [...REPLAY_SPEEDS],
    defaultSpeed: REPLAY_SPEEDS.includes(input.defaultSpeed) ? input.defaultSpeed : "normal",
    currentMode: REPLAY_MODES.includes(input.currentMode) ? input.currentMode : "full-replay",
    cursorEventId: String(input.cursorEventId || ""),
    cursorTurn: Number(input.cursorTurn || 0),
    cursorPhaseIndex: Number(input.cursorPhaseIndex || 0),
    running: Boolean(input.running),
    deterministic: input.deterministic !== false,
  };
}

export function createCheckpoint(session = {}, options = {}) {
  const reason = CHECKPOINT_REASONS.includes(options.reason) ? options.reason : "manual";
  const eventId = String(options.eventId || session.eventKnowledge?.lastEventId || "");
  const checkpointId = normalizeContractId(
    options.checkpointId || createContractId("replayId", stableHash([
      session.sessionId || session.id || "",
      eventId,
      reason,
      options.timing || "after",
      session.turn || 0,
      session.phaseIndex || 0,
    ].join("|"))),
    "replayId"
  );
  const snapshot = sanitizeCheckpointSnapshot(options.snapshot || createPersistenceStateSnapshot(session));
  return {
    checkpointId,
    checkpointVersion: CHECKPOINT_VERSION,
    reason,
    timing: String(options.timing || "after"),
    eventId,
    eventRevision: Number(options.eventRevision ?? session.eventRevision ?? 0),
    gameStateRevision: Number(options.gameStateRevision ?? session.gameStateRevision ?? 0),
    turn: Number(options.turn ?? session.turn ?? 1),
    phaseIndex: Number(options.phaseIndex ?? session.phaseIndex ?? 0),
    activePlayerId: String(options.activePlayerId || session.priority?.activePlayerId || session.turnOrder?.activePlayerId || "local-player"),
    stackDepth: Number(options.stackDepth ?? (session.stack || []).length),
    createdAt: Number(options.createdAt || Date.now()),
    checksum: buildStableChecksum(snapshot),
    snapshot,
  };
}

export function createPersistenceStateSnapshot(session = {}) {
  const snapshot = createStateEngineSnapshot(session);
  return sanitizeCheckpointSnapshot(snapshot);
}

export function recordPersistenceAfterAction(session = {}, action = {}, options = {}) {
  const previousSession = options.beforeSession || options.previousSession || null;
  const persistence = createPersistenceState(session.persistence || {});
  const checkpointRequests = getCheckpointRequests(previousSession, session, action);
  const newCheckpoints = checkpointRequests.map((request) => createCheckpoint(
    request.usePrevious && previousSession ? previousSession : session,
    {
      ...request,
      eventId: session.eventKnowledge?.lastEventId || action.knowledgeEventId || "",
      eventRevision: session.eventRevision || 0,
      snapshot: request.usePrevious && previousSession
        ? createPersistenceStateSnapshot(previousSession)
        : createPersistenceStateSnapshot(session),
    }
  ));
  const checkpoints = [...newCheckpoints, ...persistence.checkpoints]
    .filter(uniqueBy("checkpointId"))
    .slice(0, MAX_CHECKPOINTS);
  const autoSaveIntent = createAutoSaveIntent(persistence.autoSave, action, previousSession, session);
  return {
    ...session,
    persistence: {
      ...persistence,
      checkpoints,
      latestCheckpointId: checkpoints[0]?.checkpointId || persistence.latestCheckpointId,
      autoSave: autoSaveIntent.autoSave,
      recovery: {
        ...persistence.recovery,
        status: autoSaveIntent.shouldAutoSave ? "checkpointed" : persistence.recovery.status,
        lastSavedAt: autoSaveIntent.shouldAutoSave ? autoSaveIntent.at : persistence.recovery.lastSavedAt,
        recoveryPointEventId: session.eventKnowledge?.lastEventId || persistence.recovery.recoveryPointEventId,
        recoveryPointCheckpointId: checkpoints[0]?.checkpointId || persistence.recovery.recoveryPointCheckpointId,
      },
      replay: createReplayMetadata({
        ...persistence.replay,
        cursorEventId: session.eventKnowledge?.lastEventId || persistence.replay.cursorEventId,
        cursorTurn: session.turn || persistence.replay.cursorTurn,
        cursorPhaseIndex: session.phaseIndex ?? persistence.replay.cursorPhaseIndex,
      }),
    },
  };
}

export function createCanonicalSave(input = {}, options = {}) {
  const profile = input.activeSession ? input : {};
  const session = input.activeSession || input.gameState?.activeSession || input.session || input;
  const now = Number(options.updatedAt || Date.now());
  const eventKnowledge = normalizeEventHistoryForSave(session.eventKnowledge || {});
  const persistence = createPersistenceState(session.persistence || {});
  const initialCheckpoint = persistence.checkpoints.length
    ? null
    : createCheckpoint(session, { reason: "beginning-of-game", timing: "initial", eventId: eventKnowledge.lastEventId || "" });
  const checkpoints = initialCheckpoint ? [initialCheckpoint] : persistence.checkpoints;
  const saveId = normalizeContractId(options.saveId || input.saveId || createContractId("saveId"), "saveId");
  const canonical = {
    saveId,
    canonicalSaveVersion: CANONICAL_SAVE_VERSION,
    saveFormatVersion: options.saveFormatVersion || input.saveFormatVersion || SHARED_SAVE_FORMAT_VERSION,
    schemaVersion: options.schemaVersion || input.schemaVersion || SHARED_CONTRACT_SCHEMA_VERSION,
    rulesEngineVersion: session.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
    engineVersion: STATE_ENGINE_VERSION,
    eventKnowledgeEngineVersion: EVENT_KNOWLEDGE_ENGINE_VERSION,
    replayVersion: REPLAY_ENGINE_VERSION,
    serializationVersion: SERIALIZATION_VERSION,
    migrationVersion: MIGRATION_VERSION,
    sourceApp: "boardstate",
    ownerApp: "boardstate",
    createdAt: Number(options.createdAt || input.createdAt || session.createdAt || now),
    updatedAt: now,
    sessionMetadata: createSessionMetadata(session, profile),
    gameMetadata: createGameMetadata(session),
    playerMetadata: createPlayerMetadata(session),
    deckMetadata: createDeckMetadata(session),
    stateSnapshot: createPersistenceStateSnapshot(session),
    eventHistory: {
      engineVersion: eventKnowledge.engineVersion,
      eventVersion: eventKnowledge.eventVersion,
      eventCount: eventKnowledge.eventCount,
      lastEventId: eventKnowledge.lastEventId,
      lastEventRevision: eventKnowledge.lastEventRevision,
      events: clone(eventKnowledge.events || []),
      groups: clone(eventKnowledge.groups || []),
      indexes: clone(eventKnowledge.indexes || {}),
    },
    checkpoints: clone(checkpoints),
    replayMetadata: createReplayMetadata({
      ...(persistence.replay || {}),
      cursorEventId: eventKnowledge.lastEventId,
      cursorTurn: session.turn || 1,
      cursorPhaseIndex: session.phaseIndex || 0,
    }),
    confidenceMetadata: {
      rulesConfidenceLog: clone(session.rulesConfidenceLog || []),
      confidenceReport: clone(session.confidenceReport || session.proactiveAssistant?.confidenceReport || {}),
      informationConfidence: eventKnowledge.events?.[0]?.informationConfidence || "engine-verified",
      executionConfidence: eventKnowledge.events?.[0]?.executionConfidence || "engine-validated",
    },
    ruleAmendmentHistory: clone(
      session.ruleAmendments?.history ||
      session.ruleAmendmentHistory ||
      []
    ),
    ruleAmendments: clone(session.ruleAmendments || {}),
    reminders: clone(session.remindMe || {}),
    aiGameplay: clone(session.aiGameplay || {}),
    aiAnalysisMetadata: {
      version: session.aiGameplay?.version || "",
      informationMode: session.aiGameplay?.informationMode || "public-information",
      activeProfileIds: clone(session.aiGameplay?.activeProfileIds || []),
      latestDecisionId: session.aiGameplay?.latestDecision?.decisionId || "",
      threatAnalysisVersion: session.aiGameplay?.threatAnalysis?.version || "",
      boardAnalysisVersion: session.aiGameplay?.boardAnalysis?.version || "",
      replayAnalysisVersion: session.aiGameplay?.replayAnalysis?.version || "",
      mutatesGameState: false,
      externalAiServicesEnabled: false,
      generativeAiEnabled: false,
    },
    synchronizationMetadata: {
      syncProtocolVersion: session.syncProtocolVersion || SHARED_SYNC_PROTOCOL_VERSION,
      revision: Number(session.revision || 0),
      gameStateRevision: Number(session.gameStateRevision || 0),
      eventRevision: Number(session.eventRevision || 0),
      syncedMultiplayer: sanitizeSyncState(session.syncedMultiplayer || {}),
    },
    undoMetadata: {
      undoCount: (session.undoStack || []).length,
      redoCount: (session.redoStack || []).length,
      undoStack: sanitizeUndoStack(session.undoStack || []),
      redoStack: sanitizeUndoStack(session.redoStack || []),
    },
    autoSave: createAutoSaveState(persistence.autoSave || {}),
    recovery: createRecoveryState({
      ...(persistence.recovery || {}),
      recoveryPointEventId: eventKnowledge.lastEventId || persistence.recovery?.recoveryPointEventId || "",
      recoveryPointCheckpointId: checkpoints[0]?.checkpointId || persistence.recovery?.recoveryPointCheckpointId || "",
    }),
    migrations: Array.isArray(persistence.migrations) ? clone(persistence.migrations) : [],
    exportManifests: createExportManifestSet(session),
    futureExpansionFields: clone(options.futureExpansionFields || {}),
  };
  const saveWithIntegrity = {
    ...canonical,
    objectIdentity: collectObjectIdentityMap(session),
    integrity: {
      algorithm: "boardstate-stable-checksum-v1",
      checksum: "",
    },
  };
  return withSaveChecksum(saveWithIntegrity);
}

export function validateCanonicalSave(input = null) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return createValidationResult(false, "corrupted", ["canonical save must be an object"]);
  }
  const save = normalizeCanonicalSave(input);
  const errors = [];
  const warnings = [];
  [
    "saveId",
    "canonicalSaveVersion",
    "saveFormatVersion",
    "schemaVersion",
    "rulesEngineVersion",
    "engineVersion",
    "eventKnowledgeEngineVersion",
    "replayVersion",
    "serializationVersion",
    "migrationVersion",
    "sessionMetadata",
    "gameMetadata",
    "stateSnapshot",
    "eventHistory",
    "checkpoints",
    "replayMetadata",
    "synchronizationMetadata",
    "integrity",
  ].forEach((field) => {
    if (save[field] === undefined || save[field] === null || save[field] === "") errors.push(`missing ${field}`);
  });
  if (save.canonicalSaveVersion !== CANONICAL_SAVE_VERSION) errors.push("unsupported canonical save version");
  if (save.eventKnowledgeEngineVersion !== EVENT_KNOWLEDGE_ENGINE_VERSION) errors.push("unsupported Event Knowledge Engine version");
  if (save.engineVersion !== STATE_ENGINE_VERSION) errors.push("unsupported State Engine version");
  if (save.saveFormatVersion !== SHARED_SAVE_FORMAT_VERSION) errors.push("unsupported save format version");
  const eventIds = new Set();
  (save.eventHistory?.events || []).forEach((event) => {
    if (!event?.eventId) errors.push("event history contains event without ID");
    if (eventIds.has(event.eventId)) errors.push(`duplicate event ID ${event.eventId}`);
    eventIds.add(event.eventId);
  });
  (save.eventHistory?.groups || []).forEach((group) => {
    (group.eventIds || []).forEach((eventId) => {
      if (!eventIds.has(eventId)) warnings.push(`event group ${group.eventGroupId || "unknown"} references missing event ${eventId}`);
    });
  });
  (save.checkpoints || []).forEach((checkpoint) => {
    if (!checkpoint?.checkpointId) errors.push("checkpoint is missing checkpointId");
    if (!checkpoint?.snapshot) errors.push(`checkpoint ${checkpoint?.checkpointId || "unknown"} is missing snapshot`);
    if (checkpoint?.eventId && eventIds.size && !eventIds.has(checkpoint.eventId)) warnings.push(`checkpoint ${checkpoint.checkpointId} references missing event ${checkpoint.eventId}`);
    const checksum = buildStableChecksum(sanitizeCheckpointSnapshot(checkpoint.snapshot || {}));
    if (checkpoint?.checksum && checkpoint.checksum !== checksum) errors.push(`checkpoint ${checkpoint.checkpointId || "unknown"} checksum is invalid`);
  });
  if (save.integrity?.checksum) {
    const actual = buildStableChecksum({ ...save, integrity: { ...save.integrity, checksum: "" } });
    if (actual !== save.integrity.checksum) errors.push("canonical save checksum is invalid");
  }
  const unsafeKeys = findForbiddenKeys(save);
  if (unsafeKeys.length) errors.push(...unsafeKeys.map((key) => `unsafe private field ${key} is not allowed`));
  if (save.stateSnapshot?.presentation) errors.push("canonical state snapshot must not persist presentation state");
  if (save.stateSnapshot?.camera || save.stateSnapshot?.animations) errors.push("canonical state snapshot must not persist camera or animation state");
  const objectIds = new Set();
  (save.objectIdentity?.objects || []).forEach((entry) => {
    if (!entry.objectId) return;
    if (objectIds.has(entry.objectId)) errors.push(`duplicate object identity ${entry.objectId}`);
    objectIds.add(entry.objectId);
  });
  return createValidationResult(errors.length === 0, errors.length ? "invalid" : warnings.length ? "valid-with-warnings" : "valid", errors, warnings);
}

export function normalizeCanonicalSave(input = {}) {
  const source = input.canonicalSave?.stateSnapshot
    ? input.canonicalSave
    : input.metadata?.canonicalSave?.stateSnapshot
      ? input.metadata.canonicalSave
      : input;
  return clone(source || {});
}

export function migrateCanonicalSave(input = {}, options = {}) {
  const source = normalizeCanonicalSave(input);
  const original = clone(input || {});
  if (source.canonicalSaveVersion === CANONICAL_SAVE_VERSION && source.stateSnapshot && source.eventHistory) {
    return {
      migrated: false,
      status: "current",
      save: source,
      original,
      migrationVersion: MIGRATION_VERSION,
      warnings: [],
      errors: [],
    };
  }
  const session = input.gameState?.activeSession || input.activeSession || input.session || source.stateSnapshot || {};
  if (!session || typeof session !== "object" || !Object.keys(session).length) {
    return {
      migrated: false,
      status: "failed",
      save: null,
      original,
      migrationVersion: MIGRATION_VERSION,
      warnings: [],
      errors: ["legacy save does not contain a recoverable active session"],
    };
  }
  const save = createCanonicalSave(
    { activeSession: session, player: input.player || { id: input.profileId || "local-player", name: input.profileName || "Player" } },
    {
      saveId: input.saveId || options.saveId,
      saveFormatVersion: input.saveFormatVersion,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      futureExpansionFields: {
        migratedFromLegacy: true,
        legacySaveVersion: input.saveVersion || source.saveVersion || 0,
      },
    }
  );
  const migratedSave = withSaveChecksum({
    ...save,
    migrations: [
      ...save.migrations,
      normalizeMigrationRecord({
        migrationId: createContractId("saveId", stableHash(`${save.saveId}|legacy-to-canonical`)),
        fromVersion: String(input.saveVersion || source.saveVersion || "legacy"),
        toVersion: CANONICAL_SAVE_VERSION,
        migratedAt: options.migratedAt || Date.now(),
        result: "success",
        warnings: ["original legacy save was preserved beside the canonical save"],
      }),
    ],
  });
  return {
    migrated: true,
    status: "migrated",
    save: migratedSave,
    original,
    migrationVersion: MIGRATION_VERSION,
    warnings: ["original legacy save preserved"],
    errors: [],
  };
}

export function buildReplayTimeline(input = {}, options = {}) {
  const save = input.canonicalSaveVersion ? input : createCanonicalSave(input, options);
  const events = [...(save.eventHistory?.events || [])].sort((a, b) => Number(a.when?.timestamp || 0) - Number(b.when?.timestamp || 0));
  const checkpoints = [...(save.checkpoints || [])].sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
  return {
    replayVersion: REPLAY_ENGINE_VERSION,
    deterministic: true,
    modes: [...REPLAY_MODES],
    speeds: [...REPLAY_SPEEDS],
    jumps: {
      eventIds: events.map((event) => event.eventId),
      turns: [...new Set(events.map((event) => event.when?.turn).filter(Boolean))],
      phaseIndexes: [...new Set(events.map((event) => event.when?.phaseIndex).filter((entry) => entry !== undefined))],
      checkpointIds: checkpoints.map((checkpoint) => checkpoint.checkpointId),
    },
    checkpoints,
    events: events.map((event, index) => ({
      index,
      eventId: event.eventId,
      eventGroupId: event.eventGroupId,
      turn: event.when?.turn || 0,
      phaseIndex: event.when?.phaseIndex || 0,
      timestamp: event.when?.timestamp || 0,
      tags: event.tags || [],
      importance: event.importance || "normal",
      summary: event.what?.summary || event.what?.eventType || "Event",
    })),
    groups: clone(save.eventHistory?.groups || []),
  };
}

export function reconstructReplayState(input = {}, targetEventId = "") {
  const session = input.activeSession || input.session || input.stateSnapshot || input;
  const canonicalSave = input.canonicalSaveVersion ? input : createCanonicalSave(input.activeSession ? input : { activeSession: session });
  const eventId = targetEventId || canonicalSave.eventHistory?.lastEventId || canonicalSave.eventHistory?.events?.[0]?.eventId || "";
  const checkpoint = findNearestCheckpoint(canonicalSave, eventId);
  const eventReconstruction = reconstructStateAfterEvent({
    ...session,
    eventKnowledge: {
      ...(session.eventKnowledge || {}),
      events: canonicalSave.eventHistory?.events || [],
      groups: canonicalSave.eventHistory?.groups || [],
      eventCount: canonicalSave.eventHistory?.eventCount || 0,
      lastEventId: canonicalSave.eventHistory?.lastEventId || "",
      lastEventRevision: canonicalSave.eventHistory?.lastEventRevision || 0,
      stateSnapshots: session.eventKnowledge?.stateSnapshots || [],
    },
    actionHistory: session.actionHistory || canonicalSave.stateSnapshot?.actionHistory || [],
  }, eventId);
  return {
    found: Boolean(eventId) && (eventReconstruction.found || Boolean(checkpoint)),
    eventId,
    checkpointId: checkpoint?.checkpointId || "",
    source: eventReconstruction.found ? eventReconstruction.source : checkpoint ? "checkpoint" : "not-found",
    snapshot: eventReconstruction.snapshot || clone(checkpoint?.snapshot || null),
    replayPlan: {
      fromCheckpointId: checkpoint?.checkpointId || "",
      eventsAfterCheckpoint: getEventsAfterCheckpoint(canonicalSave, checkpoint, eventId),
    },
    replayVersion: REPLAY_ENGINE_VERSION,
  };
}

export function createReplayExport(input = {}, options = {}) {
  const canonicalSave = input.canonicalSaveVersion ? input : createCanonicalSave(input, options);
  return createPersistenceExportBundle(canonicalSave, {
    exportType: options.exportType || "replay",
    label: options.label || "BoardState Replay Export",
  });
}

export function createPersistenceExportBundle(canonicalSave = {}, options = {}) {
  const save = normalizeCanonicalSave(canonicalSave);
  const bundle = {
    exportId: createContractId("saveId", stableHash(`${save.saveId || "save"}|${options.exportType || "replay"}|${save.updatedAt || 0}`)),
    exportType: String(options.exportType || "replay"),
    label: String(options.label || "BoardState Persistence Export"),
    sourceApp: "boardstate",
    schemaVersion: SHARED_CONTRACT_SCHEMA_VERSION,
    canonicalSaveVersion: CANONICAL_SAVE_VERSION,
    createdAt: Number(options.createdAt || Date.now()),
    save,
    timeline: buildReplayTimeline(save),
    validation: validateCanonicalSave(save),
  };
  const bundleWithChecksum = {
    ...bundle,
    checksum: "",
  };
  return {
    ...bundleWithChecksum,
    checksum: buildStableChecksum(bundleWithChecksum),
  };
}

export function parseImportedCanonicalSave(input = {}, options = {}) {
  const raw = typeof input === "string" ? input : JSON.stringify(input || {});
  if (raw.length > Number(options.maxBytes || MAX_IMPORTED_SAVE_BYTES)) {
    return createImportResult(false, null, ["imported save is too large"]);
  }
  let parsed = input;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch {
      return createImportResult(false, null, ["imported save is malformed JSON"]);
    }
  }
  const save = parsed?.save?.canonicalSave || parsed?.canonicalSave || parsed?.save || parsed;
  const migration = migrateCanonicalSave(save);
  const candidate = migration.save || normalizeCanonicalSave(save);
  const validation = validateCanonicalSave(candidate);
  if (!validation.valid) {
    return createImportResult(false, candidate, validation.errors, validation.warnings);
  }
  return createImportResult(true, candidate, validation.errors, [...validation.warnings, ...migration.warnings]);
}

export function validatePersistenceExportBundle(input = {}) {
  if (!input || typeof input !== "object") return createValidationResult(false, "corrupted", ["export bundle must be an object"]);
  const errors = [];
  if (!input.exportId) errors.push("missing exportId");
  if (!input.exportType) errors.push("missing exportType");
  if (!input.save) errors.push("missing canonical save");
  const saveValidation = validateCanonicalSave(input.save || {});
  if (!saveValidation.valid) errors.push(...saveValidation.errors.map((error) => `save:${error}`));
  if (input.checksum) {
    const actual = buildStableChecksum({ ...input, checksum: "" });
    if (actual !== input.checksum) errors.push("export bundle checksum is invalid");
  }
  return createValidationResult(errors.length === 0, errors.length ? "invalid" : "valid", errors, saveValidation.warnings || []);
}

function createSessionMetadata(session = {}, profile = {}) {
  return {
    sessionId: session.sessionId || session.id || "",
    gameId: session.gameId || session.id || "",
    lifecycle: session.sessionLifecycle || session.status || "setup",
    sourceApp: session.sourceApp || "boardstate",
    ownerApp: "boardstate",
    profileId: profile.player?.id || profile.id || "local-player",
    createdAt: Number(session.createdAt || 0),
    updatedAt: Number(session.updatedAt || 0),
    durationMs: Math.max(0, Number(session.timer?.gameEndedAt || session.updatedAt || Date.now()) - Number(session.timer?.gameStartedAt || session.createdAt || Date.now())),
    hostParticipantId: session.hostParticipantId || "",
    participantCount: (session.participants || []).length,
    seatCount: (session.seats || []).length,
  };
}

function createGameMetadata(session = {}) {
  return {
    gameStartedAt: Number(session.timer?.gameStartedAt || session.createdAt || 0),
    gameEndedAt: Number(session.timer?.gameEndedAt || 0),
    turnCount: Number(session.turn || session.turnState?.turnNumber || 1),
    currentPhaseIndex: Number(session.phaseIndex || 0),
    currentPhase: String(session.phase || ""),
    winnerId: session.simulation?.winnerId || session.gameTracking?.winnerId || "",
    eliminationOrder: clone(session.simulation?.eliminations || session.eliminationOrder || []),
    victoryCondition: String(session.victoryCondition || ""),
    ruleSet: String(session.format || session.gameTracking?.format || "commander"),
    optionalStatistics: clone(session.simulation?.stats || session.stats || {}),
  };
}

function createPlayerMetadata(session = {}) {
  const players = Array.isArray(session.players) && session.players.length
    ? session.players
    : [{ playerId: "local-player", displayName: "Player", life: session.life, commander: session.commander }];
  return players.map((player) => ({
    playerId: player.playerId || player.id || "local-player",
    seatId: player.seatId || "",
    participantId: player.participantId || "",
    displayName: player.displayName || player.name || "",
    commander: clone(player.commander || session.commander || {}),
    partnerCommanders: clone(player.partnerCommanders || []),
    backgroundCommanders: clone(player.backgroundCommanders || []),
    lifeHistory: clone(player.lifeHistory || []),
    commanderDamageHistory: clone(player.commanderDamageHistory || session.commanderSession?.commanderDamageByRecipient?.[player.playerId] || {}),
    poisonHistory: clone(player.poisonHistory || []),
    energyHistory: clone(player.energyHistory || []),
    experienceHistory: clone(player.experienceHistory || []),
    maximumHandSizeModifications: clone(player.maximumHandSizeModifications || []),
    notes: String(player.notes || ""),
    future: clone(player.future || {}),
  }));
}

function createDeckMetadata(session = {}) {
  return {
    deckSnapshotReferences: clone(session.deckSnapshotReferences || []),
    importedDeckSnapshotIds: (session.deckSnapshotReferences || []).map((entry) => entry.deckSnapshotId).filter(Boolean),
    commanderReferences: clone(session.commanderSession?.deckSnapshotCommanderReferences || []),
  };
}

function collectObjectIdentityMap(session = {}) {
  const objects = [];
  getAllPermanents(session).forEach((permanent) => {
    objects.push({
      objectId: permanent.id || "",
      objectType: permanent.token ? "token" : permanent.copy ? "copy" : "permanent",
      name: permanent.name || permanent.card?.name || "",
      controllerId: permanent.controllerId || permanent.controller || "local-player",
      ownerId: permanent.ownerId || permanent.owner || permanent.controllerId || "local-player",
      originEventId: permanent.originEventId || permanent.createdByEventId || "",
      sourceObjectId: permanent.sourceObjectId || permanent.copySourceId || "",
      transformedFromId: permanent.transformedFromId || "",
      mergedObjectIds: clone(permanent.mergedObjectIds || []),
      zone: permanent.zone || "battlefield",
    });
  });
  (session.stack || []).forEach((entry) => {
    objects.push({
      objectId: entry.id || "",
      objectType: "stack-object",
      name: entry.name || entry.card?.name || "",
      controllerId: entry.controllerId || entry.playerId || "local-player",
      ownerId: entry.ownerId || entry.playerId || "local-player",
      originEventId: entry.originEventId || "",
      sourceObjectId: entry.sourceId || "",
      zone: "stack",
    });
  });
  return {
    objectIdentityVersion: CANONICAL_PERSISTENCE_VERSION,
    objects: objects.filter((entry) => entry.objectId),
  };
}

function createExportManifestSet(session = {}) {
  return {
    replay: { supported: true, exportType: "replay" },
    bugReport: { supported: true, exportType: "bug-report" },
    judgeReview: { supported: true, exportType: "judge-review" },
    tournamentArchive: { supported: true, exportType: "tournament-archive" },
    statistics: { supported: true, exportType: "statistics" },
    spectatorPackage: { supported: true, exportType: "spectator-package", hiddenInformationExcluded: true },
    trainingData: { supported: true, exportType: "training-data", privateInformationExcluded: true },
    sessionId: session.sessionId || session.id || "",
  };
}

function normalizeEventHistoryForSave(input = {}) {
  return {
    engineVersion: input.engineVersion || EVENT_KNOWLEDGE_ENGINE_VERSION,
    eventVersion: input.eventVersion || "event-knowledge-event-1",
    eventCount: Number(input.eventCount || (input.events || []).length || 0),
    lastEventId: input.lastEventId || input.events?.[0]?.eventId || "",
    lastEventRevision: Number(input.lastEventRevision || input.events?.[0]?.syncRevision || 0),
    events: clone(input.events || []),
    groups: clone(input.groups || []),
    indexes: clone(input.indexes || {}),
  };
}

function getCheckpointRequests(previousSession = null, session = {}, action = {}) {
  const type = String(action.actionType || action.type || "").toUpperCase();
  const requests = [];
  if (["START_ADVANCED_GAMEPLAY", "START_GAME_TRACKING", "START_SIMULATION", "TUTORIAL_START"].includes(type)) {
    requests.push({ reason: "beginning-of-game", timing: "after" });
  }
  if (type === "SIMULATION_PASS_TURN" || (previousSession && Number(previousSession.turn || 0) !== Number(session.turn || 0))) {
    requests.push({ reason: "beginning-of-turn", timing: "after" });
  }
  if (type === "ADVANCE_PHASE" || (previousSession && Number(previousSession.phaseIndex ?? -1) !== Number(session.phaseIndex ?? -1))) {
    requests.push({ reason: "beginning-of-phase", timing: "after" });
  }
  if (["RESOLVE_TOP_SPELL", "RESOLVE_TOP_OF_STACK", "RESOLVE_SPELL"].includes(type)) {
    requests.push({ reason: "before-spell-resolves", timing: "before", usePrevious: true });
  }
  if ((previousSession?.stack || []).length > 0 && (session.stack || []).length === 0) {
    requests.push({ reason: "after-completed-stack", timing: "after" });
  }
  if (type.includes("ELIMINAT") || (previousSession?.simulation?.eliminatedPlayerIds || []).length < (session.simulation?.eliminatedPlayerIds || []).length) {
    requests.push({ reason: "before-elimination", timing: "before", usePrevious: true });
  }
  if (["ARCHIVE_GAME", "STOP_GAME_TRACKING"].includes(type) || session.sessionLifecycle === "completed") {
    requests.push({ reason: "before-game-ending", timing: "before", usePrevious: true });
  }
  return requests;
}

function createAutoSaveIntent(autoSave = {}, action = {}, previousSession = null, session = {}) {
  const current = createAutoSaveState(autoSave);
  const type = String(action.actionType || action.type || "").toUpperCase();
  const phaseChanged = Number(previousSession?.phaseIndex ?? -1) !== Number(session.phaseIndex ?? -1);
  const turnChanged = Number(previousSession?.turn || 0) !== Number(session.turn || 0);
  const stackChanged = JSON.stringify((previousSession?.stack || []).map((entry) => entry.id)) !== JSON.stringify((session.stack || []).map((entry) => entry.id));
  const priorityChanged = JSON.stringify(previousSession?.priority || {}) !== JSON.stringify(session.priority || {});
  const shouldAutoSave =
    current.policy === "every-action" ||
    (current.policy === "every-priority-change" && priorityChanged) ||
    (current.policy === "every-spell" && (/SPELL|CAST|STACK/.test(type) || stackChanged)) ||
    (current.policy === "every-turn" && turnChanged) ||
    (current.policy === "every-phase" && phaseChanged);
  const at = Number(action.timestamp || Date.now());
  return {
    shouldAutoSave,
    at,
    autoSave: {
      ...current,
      pendingAutoSave: shouldAutoSave,
      lastAutoSaveAt: shouldAutoSave ? at : current.lastAutoSaveAt,
      lastAutoSaveActionId: shouldAutoSave ? action.actionId || "" : current.lastAutoSaveActionId,
      lastAutoSaveReason: shouldAutoSave ? current.policy : current.lastAutoSaveReason,
    },
  };
}

function findNearestCheckpoint(save = {}, eventId = "") {
  const checkpoints = Array.isArray(save.checkpoints) ? save.checkpoints : [];
  if (!eventId) return checkpoints[0] || null;
  const exact = checkpoints.find((checkpoint) => checkpoint.eventId === eventId);
  if (exact) return exact;
  const events = save.eventHistory?.events || [];
  const targetIndex = events.findIndex((event) => event.eventId === eventId);
  if (targetIndex < 0) return checkpoints[0] || null;
  const eventSetBeforeTarget = new Set(events.slice(targetIndex).map((event) => event.eventId));
  return checkpoints.find((checkpoint) => eventSetBeforeTarget.has(checkpoint.eventId)) || checkpoints[checkpoints.length - 1] || null;
}

function getEventsAfterCheckpoint(save = {}, checkpoint = null, eventId = "") {
  const events = [...(save.eventHistory?.events || [])].reverse();
  if (!checkpoint) return events.filter((event) => !eventId || event.eventId === eventId);
  const start = events.findIndex((event) => event.eventId === checkpoint.eventId);
  const end = eventId ? events.findIndex((event) => event.eventId === eventId) : events.length - 1;
  if (end < 0) return [];
  return events.slice(Math.max(0, start + 1), end + 1);
}

function normalizeCheckpoint(input = {}) {
  if (!input || typeof input !== "object") return null;
  return {
    checkpointId: normalizeContractId(input.checkpointId || createContractId("replayId"), "replayId"),
    checkpointVersion: input.checkpointVersion || CHECKPOINT_VERSION,
    reason: CHECKPOINT_REASONS.includes(input.reason) ? input.reason : "manual",
    timing: String(input.timing || "after"),
    eventId: String(input.eventId || ""),
    eventRevision: Number(input.eventRevision || 0),
    gameStateRevision: Number(input.gameStateRevision || 0),
    turn: Number(input.turn || 1),
    phaseIndex: Number(input.phaseIndex || 0),
    activePlayerId: String(input.activePlayerId || "local-player"),
    stackDepth: Number(input.stackDepth || 0),
    createdAt: Number(input.createdAt || Date.now()),
    checksum: String(input.checksum || ""),
    snapshot: input.snapshot ? sanitizeCheckpointSnapshot(input.snapshot) : null,
  };
}

function sanitizeCheckpointSnapshot(snapshotInput = {}) {
  const snapshot = clone(snapshotInput || {});
  delete snapshot.presentation;
  delete snapshot.camera;
  delete snapshot.animations;
  delete snapshot.visualTransitions;
  delete snapshot.selectedIds;
  delete snapshot.eventQueue;
  delete snapshot.runtime;
  delete snapshot.aiGameplay;
  if (snapshot.advancedMultiplayer) {
    snapshot.advancedMultiplayer = {
      ...snapshot.advancedMultiplayer,
      presentationEvents: [],
    };
  }
  if (snapshot.eventKnowledge) {
    snapshot.eventKnowledge = {
      engineVersion: snapshot.eventKnowledge.engineVersion || EVENT_KNOWLEDGE_ENGINE_VERSION,
      eventCount: Number(snapshot.eventKnowledge.eventCount || 0),
      lastEventId: snapshot.eventKnowledge.lastEventId || "",
      lastEventRevision: Number(snapshot.eventKnowledge.lastEventRevision || 0),
    };
  }
  if (snapshot.persistence) {
    snapshot.persistence = {
      persistenceVersion: snapshot.persistence.persistenceVersion || CANONICAL_PERSISTENCE_VERSION,
      canonicalSaveVersion: snapshot.persistence.canonicalSaveVersion || CANONICAL_SAVE_VERSION,
      checkpointCount: (snapshot.persistence.checkpoints || []).length,
      latestCheckpointId: snapshot.persistence.latestCheckpointId || "",
      autoSave: createAutoSaveState(snapshot.persistence.autoSave || {}),
      recovery: createRecoveryState(snapshot.persistence.recovery || {}),
    };
  }
  return snapshot;
}

function sanitizeUndoStack(stack = []) {
  return (Array.isArray(stack) ? stack : []).slice(0, 50).map((entry) => ({
    reason: String(entry.reason || ""),
    actionId: String(entry.actionId || entry.snapshot?.stateEngine?.lastActionId || ""),
    dependencies: clone(entry.dependencies || []),
    createdObjectIds: clone(entry.createdObjectIds || []),
    removedObjectIds: clone(entry.removedObjectIds || []),
    modifiedObjectIds: clone(entry.modifiedObjectIds || []),
    snapshot: entry.snapshot ? sanitizeCheckpointSnapshot(entry.snapshot) : null,
  }));
}

function sanitizeSyncState(sync = {}) {
  const copy = clone(sync || {});
  delete copy.password;
  delete copy.token;
  delete copy.authToken;
  delete copy.privateToken;
  delete copy.credentials;
  return copy;
}

function withSaveChecksum(save = {}) {
  const base = {
    ...save,
    integrity: {
      algorithm: save.integrity?.algorithm || "boardstate-stable-checksum-v1",
      checksum: "",
    },
  };
  return {
    ...base,
    integrity: {
      ...base.integrity,
      checksum: buildStableChecksum(base),
    },
  };
}

function normalizeMigrationRecord(input = {}) {
  return {
    migrationId: String(input.migrationId || createContractId("saveId")),
    fromVersion: String(input.fromVersion || ""),
    toVersion: String(input.toVersion || CANONICAL_SAVE_VERSION),
    migratedAt: Number(input.migratedAt || Date.now()),
    result: String(input.result || "pending"),
    warnings: normalizeStringArray(input.warnings),
    errors: normalizeStringArray(input.errors),
  };
}

function createValidationResult(valid, status = "valid", errors = [], warnings = []) {
  return {
    valid,
    status,
    errors: normalizeStringArray(errors),
    warnings: normalizeStringArray(warnings),
  };
}

function createImportResult(valid, save = null, errors = [], warnings = []) {
  return {
    valid,
    save,
    errors: normalizeStringArray(errors),
    warnings: normalizeStringArray(warnings),
  };
}

function normalizeAllowed(values = [], allowed = []) {
  const normalized = values.filter((value) => allowed.includes(value));
  return normalized.length ? [...new Set(normalized)] : [...allowed];
}

function normalizeStringArray(value = []) {
  return [...new Set((Array.isArray(value) ? value : [value]).map((entry) => String(entry || "").trim()).filter(Boolean))];
}

function uniqueBy(key) {
  const seen = new Set();
  return (entry) => {
    const value = entry?.[key];
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  };
}

function getAllPermanents(session = {}) {
  return [
    ...(session.battlefield?.player || []),
    ...(session.battlefield?.opponent || []),
    ...(session.battlefieldState?.zones?.battlefield?.objects || []),
  ].filter(Boolean);
}

function findForbiddenKeys(value = {}, path = "") {
  if (!value || typeof value !== "object") return [];
  const errors = [];
  Object.entries(value).forEach(([key, entry]) => {
    const normalized = key.toLowerCase().replace(/[^a-z]/g, "");
    const currentPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_EXPORT_KEYS.has(normalized)) {
      errors.push(currentPath);
      return;
    }
    if (entry && typeof entry === "object") errors.push(...findForbiddenKeys(entry, currentPath));
  });
  return errors;
}

function stableHash(seed = "") {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(36);
}
