import { createId, clone } from "../state/ids.js";
import {
  DEFAULT_RULES_ENGINE_VERSION,
  SHARED_CONTRACT_SCHEMA_VERSION,
  SHARED_SAVE_FORMAT_VERSION,
  canonicalSaveEnvelopeToLegacySave,
  legacySaveToCanonicalSaveEnvelope,
  validateSaveEnvelope,
} from "../shared-contracts/index.js";
import { ensureInterfaceModeState } from "../shared-session/handoff.js";
import { createAdvancedMultiplayerState } from "../shared-session/perspective.js";
import { createImportedDataSnapshotForSession } from "../bridge/appLinkAdapters.js";
import {
  CANONICAL_SAVE_VERSION,
  CHECKPOINT_VERSION,
  MIGRATION_VERSION,
  REPLAY_ENGINE_VERSION,
  SERIALIZATION_VERSION,
  createCanonicalSave,
  createPersistenceState,
  createPersistenceExportBundle,
  migrateCanonicalSave,
  validateCanonicalSave,
} from "../persistence/canonicalPersistence.js";

export const SAVE_STATE_VERSION = 1;

export function createLocalSaveCollection(source = {}) {
  return {
    version: SAVE_STATE_VERSION,
    activeSaveId: source.activeSaveId || "",
    lastError: source.lastError || "",
    items: Array.isArray(source.items) ? source.items.map(normalizeLocalSave).filter(Boolean) : [],
  };
}

export function saveCurrentGame(profile, options = {}) {
  const collection = createLocalSaveCollection(profile.localSaves);
  const now = Date.now();
  const requestedId = options.saveId || collection.activeSaveId || "";
  const existing = requestedId ? collection.items.find((entry) => entry.saveId === requestedId) : null;
  const save = buildLocalSave(profile, {
    saveId: existing?.saveId || options.saveId || createId("save"),
    saveName: options.saveName || existing?.saveName || defaultSaveName(profile),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });
  const items = [save, ...collection.items.filter((entry) => entry.saveId !== save.saveId)].slice(0, 60);
  return {
    ...profile,
    onboarding: {
      ...(profile.onboarding || {}),
      tutorialSaveId: profile.activeSession?.tutorial?.active || profile.activeSession?.tutorial?.completionPending
        ? save.saveId
        : profile.onboarding?.tutorialSaveId || "",
      tutorialLastUpdatedAt: now,
    },
    activeSession: {
      ...profile.activeSession,
      tutorial: {
        ...(profile.activeSession?.tutorial || {}),
        autoSaveId: profile.activeSession?.tutorial?.active || profile.activeSession?.tutorial?.completionPending
          ? save.saveId
          : profile.activeSession?.tutorial?.autoSaveId || "",
      },
    },
    localSaves: {
      ...collection,
      activeSaveId: save.saveId,
      lastError: "",
      items,
    },
  };
}

export function loadLocalSave(profile, saveId = "") {
  const collection = createLocalSaveCollection(profile.localSaves);
  const save = collection.items.find((entry) => entry.saveId === saveId);
  const validation = validateLocalSave(save);
  if (!validation.valid) {
    return withSaveError(profile, validation.reason || "Save could not be loaded.");
  }
  const gameState = clone(save.gameState || {});
  const activeSession = ensureInterfaceModeState({
    ...(gameState.activeSession || profile.activeSession || {}),
    persistence: createPersistenceState(gameState.activeSession?.persistence || save.canonicalSave?.stateSnapshot?.persistence || {}),
    advancedMultiplayer: createAdvancedMultiplayerState(
      gameState.activeSession?.advancedMultiplayer ||
        save.metadata?.advancedMultiplayer ||
        {
          viewMode: "solo-advanced",
          localPerspectivePlayerId: save.metadata?.localPerspectivePlayerId || "local-player",
          focusedOpponentId: save.metadata?.focusedOpponentId || "",
      }
    ),
  });
  const embeddedImported = save.metadata?.embeddedImportedData || gameState.importedDataSnapshot || {};
  const currentImported = profile.importedData || {};
  return {
    ...profile,
    settings: {
      ...(profile.settings || {}),
      ...(gameState.settingsSnapshot?.restoreSettings ? sanitizeSettingsSnapshot(gameState.settingsSnapshot) : {}),
    },
    activeSession,
    importedData: {
      version: currentImported.version || 1,
      lastError: currentImported.lastError || "",
      lastImportAt: currentImported.lastImportAt || 0,
      liteSessions: mergeImportedById(currentImported.liteSessions, embeddedImported.liteSessions, "sessionId"),
      deckSnapshots: mergeImportedById(currentImported.deckSnapshots, embeddedImported.deckSnapshots, "deckSnapshotId"),
      sharedSessions: Array.isArray(currentImported.sharedSessions) ? currentImported.sharedSessions : [],
      failedImports: Array.isArray(currentImported.failedImports) ? currentImported.failedImports : [],
    },
    localSaves: {
      ...collection,
      activeSaveId: save.saveId,
      lastError: "",
    },
    onboarding: {
      ...(profile.onboarding || {}),
      ...(save.tutorialState?.onboarding || {}),
      tutorialSaveId: save.saveId,
      tutorialLastUpdatedAt: Date.now(),
    },
  };
}

export function renameLocalSave(profile, saveId = "", saveName = "") {
  const collection = createLocalSaveCollection(profile.localSaves);
  const cleanedName = String(saveName || "").trim();
  if (!saveId || !cleanedName) {
    return withSaveError(profile, "Save rename needs a save and a name.");
  }
  return {
    ...profile,
    localSaves: {
      ...collection,
      lastError: "",
      items: collection.items.map((entry) =>
        entry.saveId === saveId ? { ...entry, saveName: cleanedName, updatedAt: Date.now(), metadata: { ...(entry.metadata || {}), renamedAt: Date.now() } } : entry
      ),
    },
  };
}

export function duplicateLocalSave(profile, saveId = "") {
  const collection = createLocalSaveCollection(profile.localSaves);
  const source = collection.items.find((entry) => entry.saveId === saveId);
  if (!source) {
    return withSaveError(profile, "Save could not be duplicated.");
  }
  const now = Date.now();
  const copy = {
    ...clone(source),
    saveId: createId("save"),
    saveName: `${source.saveName || "BoardState Save"} Copy`,
    createdAt: now,
    updatedAt: now,
    metadata: {
      ...(source.metadata || {}),
      duplicatedFrom: source.saveId,
    },
  };
  return {
    ...profile,
    localSaves: {
      ...collection,
      activeSaveId: copy.saveId,
      lastError: "",
      items: [copy, ...collection.items].slice(0, 60),
    },
  };
}

export function deleteLocalSave(profile, saveId = "") {
  const collection = createLocalSaveCollection(profile.localSaves);
  const items = collection.items.filter((entry) => entry.saveId !== saveId);
  return {
    ...profile,
    localSaves: {
      ...collection,
      activeSaveId: collection.activeSaveId === saveId ? "" : collection.activeSaveId,
      lastError: "",
      items,
    },
    onboarding: {
      ...(profile.onboarding || {}),
      tutorialSaveId: profile.onboarding?.tutorialSaveId === saveId ? "" : profile.onboarding?.tutorialSaveId || "",
    },
  };
}

export function importLocalSave(profile, payload = {}) {
  const source = payload.saveEnvelope || payload.canonicalEnvelope
    ? canonicalSaveEnvelopeToLegacySave(payload.saveEnvelope || payload.canonicalEnvelope)
    : payload.profile ? payload.profile : payload.save || payload;
  const normalizedSource = normalizeLocalSave(source);
  const save = normalizedSource?.canonicalSave
    ? normalizedSource
    : { ...normalizedSource, canonicalSave: migrateCanonicalSave(normalizedSource || {}).save };
  const validation = validateLocalSave(save);
  if (!validation.valid) {
    return withSaveError(profile, validation.reason || "Imported save is invalid.");
  }
  const collection = createLocalSaveCollection(profile.localSaves);
  const now = Date.now();
  const imported = {
    ...save,
    saveId: save.saveId || createId("save"),
    profileId: profile.player?.id || profile.id,
    profileName: profile.player?.name || "Player",
    updatedAt: now,
    metadata: {
      ...(save.metadata || {}),
      importedAt: now,
    },
  };
  return {
    ...profile,
    localSaves: {
      ...collection,
      activeSaveId: imported.saveId,
      lastError: "",
      items: [imported, ...collection.items.filter((entry) => entry.saveId !== imported.saveId)].slice(0, 60),
    },
  };
}

export function exportLocalSave(save = {}) {
  const normalized = normalizeLocalSave(save);
  const canonicalEnvelope = legacySaveToCanonicalSaveEnvelope(normalized);
  const canonicalSave = normalized.canonicalSave || migrateCanonicalSave(normalized).save;
  const persistenceExport = canonicalSave ? createPersistenceExportBundle(canonicalSave, { exportType: "replay" }) : null;
  return JSON.stringify(
    {
      app: "BoardState",
      exportedAt: new Date().toISOString(),
      schemaVersion: SHARED_CONTRACT_SCHEMA_VERSION,
      saveFormatVersion: SHARED_SAVE_FORMAT_VERSION,
      save: normalized,
      canonicalEnvelope,
      canonicalSave,
      persistenceExport,
    },
    null,
    2
  );
}

export function validateLocalSave(save = null) {
  if (!save || typeof save !== "object") {
    return { valid: false, reason: "Save data is missing." };
  }
  if (Number(save.saveVersion || 0) > SAVE_STATE_VERSION) {
    return { valid: false, reason: "Save was created by a newer BoardState version." };
  }
  if (save.saveFormatVersion && save.saveFormatVersion !== SHARED_SAVE_FORMAT_VERSION) {
    return { valid: false, reason: "Save uses an unsupported BoardState shared save format." };
  }
  if (!save.saveId || !save.gameState?.activeSession) {
    return { valid: false, reason: "Save is missing required game state." };
  }
  if (save.canonicalEnvelope) {
    const envelopeValidation = validateSaveEnvelope(save.canonicalEnvelope);
    if (!envelopeValidation.valid) {
      return { valid: false, reason: envelopeValidation.errors[0] || "Canonical save envelope is invalid." };
    }
  }
  if (save.canonicalSave) {
    const canonicalValidation = validateCanonicalSave(save.canonicalSave);
    if (!canonicalValidation.valid) {
      return { valid: false, reason: canonicalValidation.errors[0] || "Canonical save architecture data is invalid." };
    }
  }
  return { valid: true, reason: "" };
}

export function buildLocalSave(profile, options = {}) {
  const now = Date.now();
  const profileId = profile.player?.id || profile.id || "local-player";
  const saveId = options.saveId || createId("save");
  const createdAt = Number(options.createdAt || now);
  const updatedAt = Number(options.updatedAt || now);
  const activeSession = ensureInterfaceModeState(clone(profile.activeSession || {}));
  const advancedMultiplayer = createAdvancedMultiplayerState(activeSession.advancedMultiplayer || {});
  const importedDataSnapshot = createImportedDataSnapshotForSession(profile, activeSession);
  const sharedVersions = {
    schemaVersion: SHARED_CONTRACT_SCHEMA_VERSION,
    rulesEngineVersion: DEFAULT_RULES_ENGINE_VERSION,
    saveFormatVersion: SHARED_SAVE_FORMAT_VERSION,
  };
  const canonicalSave = createCanonicalSave(
    { ...profile, activeSession },
    {
      saveId,
      createdAt,
      updatedAt,
    }
  );
  return {
    saveId,
    saveName: String(options.saveName || defaultSaveName(profile)).trim() || defaultSaveName(profile),
    saveVersion: SAVE_STATE_VERSION,
    canonicalSaveVersion: CANONICAL_SAVE_VERSION,
    replayVersion: REPLAY_ENGINE_VERSION,
    checkpointVersion: CHECKPOINT_VERSION,
    serializationVersion: SERIALIZATION_VERSION,
    migrationVersion: MIGRATION_VERSION,
    ...sharedVersions,
    ownerApp: "boardstate",
    sourceApp: activeSession.sourceApp || "boardstate",
    originalSourceApp: activeSession.saveMetadata?.originalSourceApp || activeSession.linkedSession?.sourceApp || activeSession.sourceApp || "boardstate",
    sourceSession: activeSession.sessionId || activeSession.id || "",
    activeInterfaceByPlayer: clone(activeSession.activeInterfaceByPlayer || {}),
    localInterfaceMode: activeSession.localInterfaceMode || activeSession.interfaceMode || "boardstate-advanced",
    linkedSession: clone(activeSession.linkedSession || {}),
    importedFrom: activeSession.linkedSession?.sourceApp && activeSession.linkedSession.sourceApp !== "boardstate" ? activeSession.linkedSession.sourceApp : "",
    exportedTo: clone(activeSession.saveMetadata?.exportedTo || []),
    capabilities: clone(activeSession.sessionCapabilities || {}),
    advancedMultiplayer: clone(advancedMultiplayer),
    sessionLifecycle: activeSession.sessionLifecycle || "setup",
    hostParticipantId: activeSession.hostParticipantId || "",
    participants: clone(activeSession.participants || []),
    seats: clone(activeSession.seats || []),
    seatOrder: clone(activeSession.seatOrder || []),
    turnOrder: clone(activeSession.turnOrder || {}),
    commanderSession: clone(activeSession.commanderSession || {}),
    visibilityPolicy: clone(activeSession.visibilityPolicy || {}),
    reconnectState: clone(activeSession.reconnectState || {}),
    capabilityManifest: clone(activeSession.capabilityManifest || {}),
    stateEngine: clone(activeSession.stateEngine || {}),
    eventKnowledge: clone(activeSession.eventKnowledge || {}),
    profileId,
    profileName: profile.player?.name || "Player",
    createdAt,
    updatedAt,
    gameMode: activeSession.simulation?.enabled
      ? "dry-run"
      : activeSession.tutorial?.active || activeSession.tutorial?.completionPending
        ? "tutorial-practice"
        : activeSession.gameTracking?.active
          ? activeSession.gameTracking.mode || "active-game"
          : "training-ground",
    gameState: {
      activeSession,
      turn: activeSession.turn,
      activePlayer: activeSession.priority?.activePlayerId || activeSession.simulation?.currentPlayerId || "local-player",
      phaseIndex: activeSession.phaseIndex,
      life: activeSession.life,
      battlefield: clone(activeSession.battlefield || {}),
      zones: clone(activeSession.zones || {}),
      stack: clone(activeSession.stack || []),
      triggerQueue: clone(activeSession.triggerQueue || []),
      pendingEffects: clone(activeSession.pendingEffects || []),
      commander: clone(activeSession.commander || {}),
      simulation: clone(activeSession.simulation || {}),
      advancedMultiplayer: clone(advancedMultiplayer),
      participants: clone(activeSession.participants || []),
      seats: clone(activeSession.seats || []),
      seatOrder: clone(activeSession.seatOrder || []),
      turnOrder: clone(activeSession.turnOrder || {}),
      commanderSession: clone(activeSession.commanderSession || {}),
      visibilityPolicy: clone(activeSession.visibilityPolicy || {}),
      reconnectState: clone(activeSession.reconnectState || {}),
      capabilityManifest: clone(activeSession.capabilityManifest || {}),
      stateEngine: clone(activeSession.stateEngine || {}),
      eventKnowledge: clone(activeSession.eventKnowledge || {}),
      persistence: clone(activeSession.persistence || {}),
      remindMe: clone(activeSession.remindMe || {}),
      ruleAmendments: clone(activeSession.ruleAmendments || {}),
      importedDataSnapshot: clone(importedDataSnapshot),
      undoStack: clone(activeSession.undoStack || []),
      redoStack: clone(activeSession.redoStack || []),
      actionHistory: clone(activeSession.actionHistory || []),
      settingsSnapshot: sanitizeSettingsSnapshot(profile.settings || {}),
    },
    tutorialState: {
      sessionTutorial: clone(activeSession.tutorial || {}),
      onboarding: clone(profile.onboarding || {}),
      helper: clone(activeSession.helper || {}),
    },
    settingsSnapshot: sanitizeSettingsSnapshot(profile.settings || {}),
    metadata: {
      ...sharedVersions,
      ownerApp: "boardstate",
      sourceApp: activeSession.sourceApp || "boardstate",
      originalSourceApp: activeSession.saveMetadata?.originalSourceApp || activeSession.linkedSession?.sourceApp || activeSession.sourceApp || "boardstate",
      sourceSession: activeSession.sessionId || activeSession.id || "",
      activeInterfaceByPlayer: clone(activeSession.activeInterfaceByPlayer || {}),
      localInterfaceMode: activeSession.localInterfaceMode || activeSession.interfaceMode || "boardstate-advanced",
      linkedSession: clone(activeSession.linkedSession || {}),
      importedFrom: activeSession.linkedSession?.sourceApp && activeSession.linkedSession.sourceApp !== "boardstate" ? activeSession.linkedSession.sourceApp : "",
      exportedTo: clone(activeSession.saveMetadata?.exportedTo || []),
      capabilities: clone(activeSession.sessionCapabilities || {}),
      advancedMultiplayer: clone(advancedMultiplayer),
      sessionLifecycle: activeSession.sessionLifecycle || "setup",
      hostParticipantId: activeSession.hostParticipantId || "",
      participants: clone(activeSession.participants || []),
      seats: clone(activeSession.seats || []),
      seatOrder: clone(activeSession.seatOrder || []),
      turnOrder: clone(activeSession.turnOrder || {}),
      commanderSession: clone(activeSession.commanderSession || {}),
      visibilityPolicy: clone(activeSession.visibilityPolicy || {}),
      reconnectState: clone(activeSession.reconnectState || {}),
      capabilityManifest: clone(activeSession.capabilityManifest || {}),
      stateEngine: clone(activeSession.stateEngine || {}),
      eventKnowledge: {
        engineVersion: activeSession.eventKnowledge?.engineVersion || "",
        eventCount: Number(activeSession.eventKnowledge?.eventCount || 0),
        lastEventId: activeSession.eventKnowledge?.lastEventId || "",
        lastEventRevision: Number(activeSession.eventKnowledge?.lastEventRevision || 0),
      },
      persistence: {
        persistenceVersion: activeSession.persistence?.persistenceVersion || "",
        canonicalSaveVersion: activeSession.persistence?.canonicalSaveVersion || CANONICAL_SAVE_VERSION,
        replayVersion: activeSession.persistence?.replayVersion || REPLAY_ENGINE_VERSION,
        checkpointVersion: activeSession.persistence?.checkpointVersion || CHECKPOINT_VERSION,
        checkpointCount: (activeSession.persistence?.checkpoints || []).length,
        latestCheckpointId: activeSession.persistence?.latestCheckpointId || "",
        autoSavePolicy: activeSession.persistence?.autoSave?.policy || "every-action",
        recoveryStatus: activeSession.persistence?.recovery?.status || "clean",
      },
      remindMe: {
        version: activeSession.remindMe?.version || "",
        reminderCount: (activeSession.remindMe?.reminders || []).length,
        activeReminderCount: (activeSession.remindMe?.reminders || []).filter((entry) => entry.status === "active").length,
      },
      ruleAmendments: {
        version: activeSession.ruleAmendments?.version || "",
        approvalPolicy: activeSession.ruleAmendments?.approvalPolicy || "unanimous",
        pendingCount: (activeSession.ruleAmendments?.proposals || []).filter((entry) => entry.status === "pending-unanimous-approval").length,
        acceptedCount: (activeSession.ruleAmendments?.active || []).length,
        majorityApprovalAllowed: false,
      },
      canonicalSave: {
        saveId: canonicalSave.saveId,
        canonicalSaveVersion: canonicalSave.canonicalSaveVersion,
        replayVersion: canonicalSave.replayVersion,
        checkpointCount: canonicalSave.checkpoints.length,
        eventCount: canonicalSave.eventHistory.eventCount,
        checksum: canonicalSave.integrity.checksum,
      },
      revision: Number(activeSession.revision || 0),
      compatibilityWarnings: clone(activeSession.saveMetadata?.compatibilityWarnings || []),
      mode: activeSession.tutorial?.active || activeSession.tutorial?.completionPending ? "tutorial" : activeSession.simulation?.enabled ? "dry-run" : "normal",
      linkedAppReferences: activeSession.saveMetadata?.linkedAppReferences || [],
      importedDataReferences: {
        deckSnapshotIds: (activeSession.deckSnapshotReferences || []).map((entry) => entry.deckSnapshotId).filter(Boolean),
        liteSessionIds: importedDataSnapshot.liteSessions.map((entry) => entry.sessionId),
      },
      embeddedImportedData: clone(importedDataSnapshot),
      migrationStatus: activeSession.saveMetadata?.migrationStatus || "current",
      currentTurn: activeSession.turn || 1,
      phaseIndex: activeSession.phaseIndex || 0,
      viewMode: advancedMultiplayer.viewMode,
      localPerspectivePlayerId: advancedMultiplayer.localPerspectivePlayerId,
      focusedOpponentId: advancedMultiplayer.focusedOpponentId,
      tutorialStep: activeSession.tutorial?.currentStep ?? activeSession.tutorial?.step ?? 0,
      battlefieldCount: (activeSession.battlefield?.player || []).reduce((sum, entry) => sum + Number(entry.quantity || 1), 0),
      checksum: buildSaveChecksum(activeSession),
    },
    canonicalSave,
  };
}

function normalizeLocalSave(save = {}) {
  if (!save || typeof save !== "object") return null;
  const metadata = {
    activeInterfaceByPlayer: clone(save.metadata?.activeInterfaceByPlayer || save.activeInterfaceByPlayer || save.gameState?.activeSession?.activeInterfaceByPlayer || { "local-player": "boardstate-advanced" }),
    localInterfaceMode: save.metadata?.localInterfaceMode || save.localInterfaceMode || save.gameState?.activeSession?.localInterfaceMode || save.gameState?.activeSession?.interfaceMode || "boardstate-advanced",
    capabilities: clone(save.metadata?.capabilities || save.capabilities || save.gameState?.activeSession?.sessionCapabilities || {}),
    advancedMultiplayer: clone(save.metadata?.advancedMultiplayer || save.advancedMultiplayer || save.gameState?.advancedMultiplayer || save.gameState?.activeSession?.advancedMultiplayer || createAdvancedMultiplayerState({})),
    participants: clone(save.metadata?.participants || save.participants || save.gameState?.participants || save.gameState?.activeSession?.participants || []),
    seats: clone(save.metadata?.seats || save.seats || save.gameState?.seats || save.gameState?.activeSession?.seats || []),
    seatOrder: clone(save.metadata?.seatOrder || save.seatOrder || save.gameState?.seatOrder || save.gameState?.activeSession?.seatOrder || []),
    turnOrder: clone(save.metadata?.turnOrder || save.turnOrder || save.gameState?.turnOrder || save.gameState?.activeSession?.turnOrder || {}),
    commanderSession: clone(save.metadata?.commanderSession || save.commanderSession || save.gameState?.commanderSession || save.gameState?.activeSession?.commanderSession || {}),
    visibilityPolicy: clone(save.metadata?.visibilityPolicy || save.visibilityPolicy || save.gameState?.visibilityPolicy || save.gameState?.activeSession?.visibilityPolicy || {}),
    reconnectState: clone(save.metadata?.reconnectState || save.reconnectState || save.gameState?.reconnectState || save.gameState?.activeSession?.reconnectState || {}),
    capabilityManifest: clone(save.metadata?.capabilityManifest || save.capabilityManifest || save.gameState?.capabilityManifest || save.gameState?.activeSession?.capabilityManifest || {}),
    stateEngine: clone(save.metadata?.stateEngine || save.stateEngine || save.gameState?.stateEngine || save.gameState?.activeSession?.stateEngine || {}),
    eventKnowledge: clone(save.metadata?.eventKnowledge || save.eventKnowledge || save.gameState?.eventKnowledge || save.gameState?.activeSession?.eventKnowledge || {}),
    persistence: clone(save.metadata?.persistence || save.persistence || save.gameState?.persistence || save.gameState?.activeSession?.persistence || {}),
    linkedSession: clone(save.metadata?.linkedSession || save.linkedSession || save.gameState?.activeSession?.linkedSession || {}),
    revision: Number(save.metadata?.revision || save.revision || save.gameState?.activeSession?.revision || 0),
    compatibilityWarnings: clone(save.metadata?.compatibilityWarnings || []),
    ...(save.metadata || {}),
  };
  return {
    saveId: save.saveId || "",
    saveName: save.saveName || "BoardState Save",
    saveVersion: Number(save.saveVersion || SAVE_STATE_VERSION),
    schemaVersion: save.schemaVersion || save.metadata?.schemaVersion || SHARED_CONTRACT_SCHEMA_VERSION,
    rulesEngineVersion: save.rulesEngineVersion || save.metadata?.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
    saveFormatVersion: save.saveFormatVersion || save.metadata?.saveFormatVersion || SHARED_SAVE_FORMAT_VERSION,
    ownerApp: save.ownerApp || save.metadata?.ownerApp || "boardstate",
    sourceApp: save.sourceApp || save.metadata?.sourceApp || "boardstate",
    sourceSession: save.sourceSession || save.metadata?.sourceSession || save.gameState?.activeSession?.sessionId || save.gameState?.activeSession?.id || "",
    profileId: save.profileId || "",
    profileName: save.profileName || "Player",
    createdAt: Number(save.createdAt || Date.now()),
    updatedAt: Number(save.updatedAt || save.createdAt || Date.now()),
    gameMode: save.gameMode || save.metadata?.mode || "normal",
    gameState: clone(save.gameState || {}),
    tutorialState: clone(save.tutorialState || {}),
    settingsSnapshot: sanitizeSettingsSnapshot(save.settingsSnapshot || {}),
    metadata,
    canonicalSave: save.canonicalSave || null,
    canonicalEnvelope: save.canonicalEnvelope ? clone(save.canonicalEnvelope) : null,
  };
}

function mergeImportedById(current = [], embedded = [], idKey = "id") {
  const byId = new Map();
  (Array.isArray(embedded) ? embedded : []).forEach((entry) => {
    const id = entry?.[idKey];
    if (id) byId.set(id, clone(entry));
  });
  (Array.isArray(current) ? current : []).forEach((entry) => {
    const id = entry?.[idKey];
    if (id) byId.set(id, clone(entry));
  });
  return [...byId.values()];
}

function sanitizeSettingsSnapshot(settings = {}) {
  const snapshot = clone(settings || {});
  delete snapshot.localAuth;
  delete snapshot.password;
  delete snapshot.authToken;
  delete snapshot.token;
  return snapshot;
}

function withSaveError(profile, message = "Save action failed.") {
  return {
    ...profile,
    localSaves: {
      ...createLocalSaveCollection(profile.localSaves),
      lastError: message,
    },
  };
}

function defaultSaveName(profile = {}) {
  const session = profile.activeSession || {};
  const mode = session.tutorial?.active || session.tutorial?.completionPending ? "Tutorial" : session.simulation?.enabled ? "Dry Run" : "Game";
  return `${mode} Turn ${session.turn || 1}`;
}

function buildSaveChecksum(session = {}) {
  const seed = JSON.stringify({
    id: session.id,
    turn: session.turn,
    phaseIndex: session.phaseIndex,
    life: session.life,
    battlefieldCount: (session.battlefield?.player || []).length + (session.battlefield?.opponent || []).length,
    stackCount: (session.stack || []).length,
    triggerCount: (session.triggerQueue || []).length,
  });
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return `s${Math.abs(hash).toString(36)}`;
}
