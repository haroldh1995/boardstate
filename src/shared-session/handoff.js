import {
  DEFAULT_RULES_ENGINE_VERSION,
  SHARED_CONTRACT_SCHEMA_VERSION,
  SHARED_SAVE_FORMAT_VERSION,
  SHARED_SYNC_PROTOCOL_VERSION,
  INTERFACE_MODES,
  createCanonicalEvent,
  createSessionCapabilities,
  createSharedGameSession,
  boardStateProfileToSharedSession,
  sharedSessionToBoardStateRuntime,
  validateNoPrivateExportTokens,
  validateSharedGameSession,
  clonePlain,
} from "../shared-contracts/index.js";
import { createContractId } from "../shared-contracts/ids.js";

export const LOCAL_INTERFACE_MODE = "boardstate-advanced";
export const UNKNOWN_INTERFACE_MODE = "unknown";
export const INTERFACE_MODE_CHANGED_EVENT = "INTERFACE_MODE_CHANGED";
export const HANDOFF_BUNDLE_TYPE = "boardstate-shared-session-handoff";

export function normalizeInterfaceMode(mode = UNKNOWN_INTERFACE_MODE) {
  return INTERFACE_MODES.includes(mode) ? mode : UNKNOWN_INTERFACE_MODE;
}

export function getBoardStateSessionCapabilities(overrides = {}) {
  return createSessionCapabilities({
    supportsAdvancedMode: true,
    supportsSimpleMode: false,
    supportsRulesEngine: true,
    supportsEnforcedRules: true,
    supportsWaiveRules: true,
    supportsStack: true,
    supportsPriority: true,
    supportsCombat: true,
    supportsFullBattlefield: true,
    supportsLiteCompactBattlefield: false,
    supportsHiddenInformation: true,
    supportsDeckSnapshots: Boolean(overrides.supportsDeckSnapshots),
    supportsHandoffExport: true,
    supportsHandoffImport: true,
    supportsLiveSync: Boolean(overrides.supportsLiveSync),
    supportsMirroredAdvancedView: false,
    supportsTournamentReference: true,
    supportsSaveRoundTrip: true,
    ...overrides,
  });
}

export function ensureInterfaceModeState(session = {}, options = {}) {
  const localPlayerId = options.localPlayerId || session.hostPlayerId || session.priority?.activePlayerId || "local-player";
  const currentMode = normalizeInterfaceMode(session.localInterfaceMode || session.interfaceMode || LOCAL_INTERFACE_MODE);
  const players = Array.isArray(session.players) ? session.players : [];
  const activeInterfaceByPlayer = clonePlain(session.activeInterfaceByPlayer || {});
  players.forEach((player) => {
    if (!player?.playerId) return;
    activeInterfaceByPlayer[player.playerId] = normalizeInterfaceMode(activeInterfaceByPlayer[player.playerId] || player.activeInterface || UNKNOWN_INTERFACE_MODE);
  });
  if (!activeInterfaceByPlayer[localPlayerId]) {
    activeInterfaceByPlayer[localPlayerId] = currentMode === UNKNOWN_INTERFACE_MODE ? LOCAL_INTERFACE_MODE : currentMode;
  }
  const sourceApp = options.sourceApp || session.sourceApp || session.linkedSession?.sourceApp || "boardstate";
  const linkedSimpleSessionReference =
    session.linkedSimpleSessionReference ||
    (sourceApp === "boardstate-lite"
      ? {
          sourceApp,
          gameId: session.gameId || session.id || "",
          sessionId: session.sessionId || session.id || "",
          importedAt: session.linkedSession?.importedAt || session.updatedAt || Date.now(),
        }
      : null);
  const linkedAdvancedSessionReference =
    session.linkedAdvancedSessionReference ||
    {
      sourceApp: "boardstate",
      gameId: session.gameId || session.id || "",
      sessionId: session.sessionId || session.id || "",
      interfaceMode: LOCAL_INTERFACE_MODE,
    };
  const capabilities = getBoardStateSessionCapabilities(session.sessionCapabilities || session.capabilities || {});
  return {
    ...clonePlain(session),
    sourceApp,
    interfaceMode: currentMode === UNKNOWN_INTERFACE_MODE ? LOCAL_INTERFACE_MODE : currentMode,
    activeInterfaceByPlayer,
    interfaceModeHistory: Array.isArray(session.interfaceModeHistory) ? clonePlain(session.interfaceModeHistory) : [],
    localInterfaceMode: currentMode === UNKNOWN_INTERFACE_MODE ? LOCAL_INTERFACE_MODE : currentMode,
    preferredInterfaceMode: normalizeInterfaceMode(session.preferredInterfaceMode || LOCAL_INTERFACE_MODE),
    lastInterfaceSwitchAt: Number(session.lastInterfaceSwitchAt || 0),
    lastInterfaceSwitchBy: String(session.lastInterfaceSwitchBy || ""),
    interfaceSwitchRevision: Math.max(0, Number(session.interfaceSwitchRevision || 0)),
    linkedSimpleSessionReference,
    linkedAdvancedSessionReference,
    sessionCapabilities: capabilities,
    saveMetadata: {
      ...(session.saveMetadata || {}),
      sourceApp,
      activeInterfaceByPlayer,
      localInterfaceMode: currentMode === UNKNOWN_INTERFACE_MODE ? LOCAL_INTERFACE_MODE : currentMode,
      capabilities,
      schemaVersion: session.schemaVersion || SHARED_CONTRACT_SCHEMA_VERSION,
      rulesEngineVersion: session.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
      revision: Number(session.revision || 0),
    },
  };
}

export function recordInterfaceModeChange(session = {}, options = {}) {
  const playerId = options.playerId || session.hostPlayerId || "local-player";
  const nextInterface = normalizeInterfaceMode(options.nextInterface || LOCAL_INTERFACE_MODE);
  const prepared = ensureInterfaceModeState(session, { localPlayerId: playerId, sourceApp: options.sourceApp || session.sourceApp });
  const previousInterface = normalizeInterfaceMode(prepared.activeInterfaceByPlayer?.[playerId] || UNKNOWN_INTERFACE_MODE);
  const revision = Math.max(Number(prepared.revision || 0) + 1, Number(prepared.interfaceSwitchRevision || 0) + 1);
  const timestamp = Number(options.timestamp || Date.now());
  const entry = {
    playerId,
    previousInterface,
    nextInterface,
    gameId: prepared.gameId || prepared.id || "",
    sessionId: prepared.sessionId || prepared.id || "",
    revision,
    timestamp,
    sourceApp: options.sourceApp || "boardstate",
    reason: String(options.reason || ""),
  };
  const event = createCanonicalEvent({
    eventType: INTERFACE_MODE_CHANGED_EVENT,
    gameId: entry.gameId,
    sessionId: entry.sessionId,
    revision,
    controllerPlayerId: playerId,
    createdAt: timestamp,
    payload: entry,
    rulesEngineVersion: prepared.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
  });
  return {
    ...prepared,
    revision,
    updatedAt: timestamp,
    interfaceMode: playerId === "local-player" ? nextInterface : prepared.interfaceMode,
    localInterfaceMode: playerId === "local-player" ? nextInterface : prepared.localInterfaceMode,
    activeInterfaceByPlayer: {
      ...(prepared.activeInterfaceByPlayer || {}),
      [playerId]: nextInterface,
    },
    lastInterfaceSwitchAt: timestamp,
    lastInterfaceSwitchBy: playerId,
    interfaceSwitchRevision: revision,
    interfaceModeHistory: [...(prepared.interfaceModeHistory || []), entry],
    historyMetadata: {
      ...(prepared.historyMetadata || {}),
      lastInterfaceEventId: event.eventId,
    },
  };
}

export function createSharedSessionExport(profile = {}, options = {}) {
  const session = boardStateProfileToSharedSession(profile, {
    enforcementMode: profile.activeSession?.enforcementMode || profile.settings?.rules?.enforcementMode || "enforced",
    rulesEngineVersion: profile.activeSession?.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
    ...options,
  });
  const prepared = ensureInterfaceModeState({
    ...session,
    sourceApp: "boardstate",
    localInterfaceMode: LOCAL_INTERFACE_MODE,
    activeRuleWaivers: clonePlain(profile.activeSession?.activeRuleWaivers || session.activeRuleWaivers || []),
    historyMetadata: {
      ...(session.historyMetadata || {}),
      waiverHistoryCount: (profile.activeSession?.waiverHistory || []).length,
    },
  });
  const bundle = {
    app: "BoardState",
    bundleType: HANDOFF_BUNDLE_TYPE,
    exportedAt: new Date(options.exportedAt || Date.now()).toISOString(),
    schemaVersion: SHARED_CONTRACT_SCHEMA_VERSION,
    saveFormatVersion: SHARED_SAVE_FORMAT_VERSION,
    syncProtocolVersion: SHARED_SYNC_PROTOCOL_VERSION,
    rulesEngineVersion: prepared.rulesEngineVersion,
    sourceApp: "boardstate",
    currentInterfaceMode: LOCAL_INTERFACE_MODE,
    session: prepared,
  };
  const tokenValidation = validateNoPrivateExportTokens(bundle);
  if (!tokenValidation.valid) {
    return {
      valid: false,
      errors: tokenValidation.errors,
      bundle: null,
      text: "",
    };
  }
  return {
    valid: true,
    errors: [],
    bundle,
    text: JSON.stringify(bundle, null, 2),
  };
}

export function parseLinkedSessionSnapshot(input = {}) {
  try {
    const parsed = typeof input === "string" ? JSON.parse(input) : clonePlain(input || {});
    const rawSession = parsed.session || parsed.sharedSession || parsed.gameState || parsed.canonicalSession || parsed;
    const rawErrors = [];
    if (!rawSession || typeof rawSession !== "object") rawErrors.push("linked session payload must contain a session object");
    if (!rawSession.gameId) rawErrors.push("linked session is missing gameId");
    if (!rawSession.sessionId) rawErrors.push("linked session is missing sessionId");
    if (!Array.isArray(rawSession.players) || rawSession.players.length === 0) rawErrors.push("linked session must include at least one player");
    if (rawErrors.length) {
      return { valid: false, status: "invalid", errors: rawErrors, warnings: [], session: null, sourceApp: parsed.sourceApp || rawSession?.sourceApp || "unknown" };
    }
    const session = ensureInterfaceModeState(createSharedGameSession({
      ...rawSession,
      sourceApp: parsed.sourceApp || rawSession.sourceApp || "unknown",
      sessionCapabilities: getBoardStateSessionCapabilities(rawSession.sessionCapabilities || {}),
    }), {
      sourceApp: parsed.sourceApp || rawSession.sourceApp || "unknown",
    });
    const validation = validateSharedGameSession(session);
    const warnings = getLinkedSessionWarnings(session);
    return {
      valid: validation.valid,
      status: validation.status,
      errors: validation.errors || [],
      warnings: [...(validation.warnings || []), ...warnings],
      session,
      sourceApp: parsed.sourceApp || rawSession.sourceApp || "unknown",
    };
  } catch {
    return {
      valid: false,
      status: "corrupted",
      errors: ["linked session import is malformed JSON"],
      warnings: [],
      session: null,
      sourceApp: "unknown",
    };
  }
}

export function importLinkedSessionSnapshot(profile = {}, input = {}, options = {}) {
  const parsed = parseLinkedSessionSnapshot(input);
  if (!parsed.valid || !parsed.session) {
    return {
      profile: {
        ...profile,
        linkedSessions: {
          ...(profile.linkedSessions || {}),
          lastError: parsed.errors[0] || "Linked session import failed.",
        },
      },
      validation: parsed,
    };
  }
  const now = Date.now();
  const collection = createLinkedSessionCollection(profile.linkedSessions);
  const imported = {
    linkedSessionId: parsed.session.sessionId,
    gameId: parsed.session.gameId,
    sessionId: parsed.session.sessionId,
    sessionName: options.sessionName || parsed.session.saveMetadata?.saveName || `${formatSourceApp(parsed.sourceApp)} Session`,
    sourceApp: parsed.sourceApp || parsed.session.sourceApp || "unknown",
    importedAt: now,
    updatedAt: parsed.session.updatedAt || now,
    revision: parsed.session.revision || 0,
    compatibility: parsed.status === "valid" ? "valid" : parsed.status,
    warnings: parsed.warnings || [],
    session: parsed.session,
  };
  return {
    profile: {
      ...profile,
      linkedSessions: {
        ...collection,
        lastError: "",
        activeSessionId: options.activate ? imported.sessionId : collection.activeSessionId || imported.sessionId,
        items: [imported, ...collection.items.filter((entry) => entry.sessionId !== imported.sessionId)].slice(0, 24),
      },
    },
    validation: parsed,
    imported,
  };
}

export function restoreLinkedSessionAsAdvanced(profile = {}, sessionId = "") {
  const collection = createLinkedSessionCollection(profile.linkedSessions);
  const record = collection.items.find((entry) => entry.sessionId === sessionId || entry.linkedSessionId === sessionId);
  if (!record?.session) {
    return {
      profile: {
        ...profile,
        linkedSessions: { ...collection, lastError: "Linked session could not be found." },
      },
      restored: false,
    };
  }
  const parsed = parseLinkedSessionSnapshot({ session: record.session, sourceApp: record.sourceApp });
  if (!parsed.valid || !parsed.session) {
    return {
      profile: {
        ...profile,
        linkedSessions: { ...collection, lastError: parsed.errors[0] || "Linked session is incompatible." },
      },
      restored: false,
      validation: parsed,
    };
  }
  const runtime = ensureInterfaceModeState(sharedSessionToBoardStateRuntime(parsed.session, profile.activeSession || {}), {
    sourceApp: parsed.session.sourceApp || record.sourceApp || "unknown",
  });
  const activeSession = recordInterfaceModeChange({
    ...runtime,
    gameId: parsed.session.gameId,
    sessionId: parsed.session.sessionId,
    schemaVersion: parsed.session.schemaVersion,
    rulesEngineVersion: parsed.session.rulesEngineVersion,
    syncProtocolVersion: parsed.session.syncProtocolVersion,
    enforcementMode: parsed.session.enforcementMode,
    activeRuleWaivers: parsed.session.activeRuleWaivers || [],
    activeInterfaceByPlayer: parsed.session.activeInterfaceByPlayer,
    interfaceModeHistory: parsed.session.interfaceModeHistory || [],
    linkedSession: {
      sourceApp: record.sourceApp || parsed.session.sourceApp || "unknown",
      status: "linked-session-active",
      imported: true,
      importedAt: record.importedAt,
      activeSync: false,
      compatibility: parsed.status,
      warnings: parsed.warnings,
    },
    sessionCapabilities: parsed.session.sessionCapabilities,
    saveMetadata: {
      ...(runtime.saveMetadata || {}),
      sourceApp: "boardstate",
      originalSourceApp: record.sourceApp || parsed.session.sourceApp || "unknown",
      sourceSession: parsed.session.sessionId,
      mode: "linked-advanced-continuation",
      migrationStatus: parsed.status,
      compatibilityWarnings: parsed.warnings,
    },
  }, {
    playerId: "local-player",
    nextInterface: LOCAL_INTERFACE_MODE,
    reason: "Continue linked session in original BoardState Advanced Mode.",
    sourceApp: "boardstate",
  });
  return {
    profile: {
      ...profile,
      activeSession,
      linkedSessions: {
        ...collection,
        activeSessionId: record.sessionId,
        lastError: "",
        items: collection.items.map((entry) => entry.sessionId === record.sessionId ? { ...entry, status: "active", lastOpenedAt: Date.now() } : entry),
      },
    },
    restored: true,
    validation: parsed,
  };
}

export function duplicateLinkedSessionAsAdvanced(profile = {}, sessionId = "") {
  const restored = restoreLinkedSessionAsAdvanced(profile, sessionId);
  if (!restored.restored) return restored;
  const gameId = createContractId("gameId");
  const newSessionId = createContractId("sessionId");
  return {
    ...restored,
    profile: {
      ...restored.profile,
      activeSession: ensureInterfaceModeState({
        ...restored.profile.activeSession,
        id: gameId,
        gameId,
        sessionId: newSessionId,
        sourceApp: "boardstate",
        linkedSession: {
          sourceApp: "boardstate",
          status: "duplicated-linked-session",
          imported: false,
          activeSync: false,
        },
        saveMetadata: {
          ...(restored.profile.activeSession.saveMetadata || {}),
          sourceApp: "boardstate",
          sourceSession: newSessionId,
          mode: "advanced-gameplay",
          duplicatedFromLinkedSession: sessionId,
        },
      }),
    },
  };
}

export function removeLinkedSession(profile = {}, sessionId = "") {
  const collection = createLinkedSessionCollection(profile.linkedSessions);
  return {
    ...profile,
    linkedSessions: {
      ...collection,
      activeSessionId: collection.activeSessionId === sessionId ? "" : collection.activeSessionId,
      lastError: "",
      items: collection.items.filter((entry) => entry.sessionId !== sessionId && entry.linkedSessionId !== sessionId),
    },
  };
}

export function createLinkedSessionCollection(source = {}) {
  return {
    version: 1,
    activeSessionId: source.activeSessionId || "",
    lastError: source.lastError || "",
    items: Array.isArray(source.items) ? source.items.filter(Boolean).map(normalizeLinkedSessionRecord) : [],
  };
}

export function normalizeLinkedSessionRecord(record = {}) {
  const session = record.session ? ensureInterfaceModeState(createSharedGameSession(record.session), { sourceApp: record.sourceApp || record.session.sourceApp || "unknown" }) : null;
  return {
    linkedSessionId: record.linkedSessionId || record.sessionId || session?.sessionId || "",
    gameId: record.gameId || session?.gameId || "",
    sessionId: record.sessionId || session?.sessionId || "",
    sessionName: record.sessionName || record.saveName || "Linked Session",
    sourceApp: record.sourceApp || session?.sourceApp || "unknown",
    importedAt: Number(record.importedAt || Date.now()),
    updatedAt: Number(record.updatedAt || session?.updatedAt || Date.now()),
    revision: Number(record.revision || session?.revision || 0),
    compatibility: record.compatibility || "valid",
    warnings: Array.isArray(record.warnings) ? [...record.warnings] : [],
    status: record.status || "imported",
    lastOpenedAt: Number(record.lastOpenedAt || 0),
    session,
  };
}

export function getLinkedSessionRecords(profile = {}) {
  const linked = createLinkedSessionCollection(profile.linkedSessions).items;
  const current = profile.activeSession || {};
  if (current.linkedSession?.imported || current.linkedSession?.sourceApp === "boardstate-lite") {
    linked.unshift(normalizeLinkedSessionRecord({
      linkedSessionId: current.sessionId || current.id || "",
      gameId: current.gameId || current.id || "",
      sessionId: current.sessionId || current.id || "",
      sessionName: "Current Linked Session",
      sourceApp: current.linkedSession.sourceApp || current.sourceApp || "unknown",
      updatedAt: current.updatedAt || Date.now(),
      revision: current.revision || 0,
      status: "active",
      session: createSharedGameSession({
        ...current,
        players: current.players || [{
          playerId: "local-player",
          displayName: "Player",
          activeInterface: LOCAL_INTERFACE_MODE,
        }],
      }),
    }));
  }
  return linked;
}

export function buildSessionDetailsModel(profile = {}) {
  const exportResult = createSharedSessionExport(profile);
  const session = exportResult.bundle?.session || ensureInterfaceModeState(profile.activeSession || {});
  return {
    identity: {
      gameId: session.gameId || session.id || "",
      sessionId: session.sessionId || session.id || "",
      revision: session.revision || 0,
      sourceApp: session.sourceApp || "boardstate",
      createdAt: session.createdAt || 0,
      updatedAt: session.updatedAt || 0,
    },
    players: session.players || [],
    rules: {
      rulesEngineVersion: session.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
      enforcementMode: session.enforcementMode || "enforced",
      activeWaivers: session.activeRuleWaivers || [],
      schemaVersion: session.schemaVersion || SHARED_CONTRACT_SCHEMA_VERSION,
    },
    linkedApps: {
      boardStateLite: "Waiting for Lite Update",
      deckNexus: profile.settings?.linkedApps?.deckNexus?.linked ? "Linked" : "Not Linked",
      hub: "Not Linked",
      capabilities: session.sessionCapabilities || getBoardStateSessionCapabilities(),
    },
    compatibility: {
      status: exportResult.valid ? "valid" : "recovery required",
      warnings: exportResult.errors || [],
    },
  };
}

function getLinkedSessionWarnings(session = {}) {
  const warnings = [];
  if (!session.deckSnapshotReferences?.length) warnings.push("missing deck snapshot reference");
  if (!Object.keys(session.privateInformationReferences || {}).length) warnings.push("private hand/library information unavailable");
  if (!session.zoneState?.zonesByPlayer || !Object.keys(session.zoneState.zonesByPlayer).length) warnings.push("limited zone information");
  if (!session.battlefieldState?.permanentsById || !Object.keys(session.battlefieldState.permanentsById).length) warnings.push("battlefield may be empty or compact-only");
  if (!session.stackState?.objects?.length) warnings.push("stack object detail unavailable unless present in source snapshot");
  return warnings;
}

function formatSourceApp(sourceApp = "unknown") {
  const normalized = String(sourceApp || "unknown");
  if (normalized === "boardstate-lite") return "BoardState Lite";
  if (normalized === "boardstate") return "BoardState";
  if (normalized === "hub") return "Hub";
  return "External";
}
