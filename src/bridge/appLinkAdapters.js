import {
  DEFAULT_RULES_ENGINE_VERSION,
  SHARED_CONTRACT_SCHEMA_VERSION,
  SHARED_SAVE_FORMAT_VERSION,
  SHARED_SYNC_PROTOCOL_VERSION,
  clonePlain,
  createDeckSnapshot,
  createSharedGameSession,
  validateDeckSnapshot,
} from "../shared-contracts/index.js";
import { createContractId } from "../shared-contracts/ids.js";
import {
  createSharedSessionExport,
  importLinkedSessionSnapshot,
  parseLinkedSessionSnapshot,
} from "../shared-session/handoff.js";
import {
  ECOSYSTEM_INTEGRATION_VERSION,
  createHubLaunchContext,
  createHubReturnContext,
  createPrivacySafeEcosystemBundle,
  validateEcosystemSyncEnvelope,
} from "../ecosystem/ecosystemIntegration.js";

export const APP_LINK_ADAPTER_VERSION = "boardstate-bridge-adapters-0.1.0";
export const LITE_HANDOFF_BUNDLE_TYPE = "boardstate-lite-session-handoff";
export const DECK_NEXUS_SNAPSHOT_BUNDLE_TYPE = "deck-nexus-deck-snapshot";
export const BRIDGE_PAYLOAD_LIMIT = 512_000;

const IMPORTED_DATA_VERSION = 1;
const SAFE_APP_IDS = new Set(["boardstate", "boardstate-lite", "deck-nexus", "boardstate-hub", "unknown"]);
const PRIVATE_EXPORT_KEYS = ["password", "authToken", "privateToken", "secret", "syncCredential", "syncCredentials"];

export function createImportedDataState(source = {}) {
  return {
    version: IMPORTED_DATA_VERSION,
    lastError: String(source.lastError || ""),
    lastImportAt: Number(source.lastImportAt || 0),
    liteSessions: Array.isArray(source.liteSessions) ? source.liteSessions.map(normalizeImportedLiteSession).filter(Boolean) : [],
    deckSnapshots: Array.isArray(source.deckSnapshots) ? source.deckSnapshots.map(normalizeImportedDeckSnapshot).filter(Boolean) : [],
    sharedSessions: Array.isArray(source.sharedSessions) ? source.sharedSessions.map(normalizeImportedLiteSession).filter(Boolean) : [],
    failedImports: Array.isArray(source.failedImports) ? clonePlain(source.failedImports).slice(0, 40) : [],
  };
}

export function getAppLinkAdapters(profile = {}) {
  return {
    "boardstate-lite": createBoardStateLiteBridgeAdapter(profile),
    "deck-nexus": createDeckNexusBridgeAdapter(profile),
    "boardstate-hub": createHubBridgeAdapter(profile),
  };
}

export function getAppLinkAdapter(appId = "", profile = {}) {
  return getAppLinkAdapters(profile)[appId] || null;
}

export function createCapabilityHandshake(appId = "unknown", profile = {}, overrides = {}) {
  const now = Number(overrides.lastCheckedAt || Date.now());
  const importedData = createImportedDataState(profile.importedData || {});
  const appNameById = {
    "boardstate-lite": "BoardState Lite",
    "deck-nexus": "Deck Nexus",
    "boardstate-hub": "BoardState Hub",
    boardstate: "BoardState",
    unknown: "Unknown App",
  };
  const base = {
    appId: SAFE_APP_IDS.has(appId) ? appId : "unknown",
    appName: appNameById[appId] || "Unknown App",
    appVersion: "",
    adapterVersion: APP_LINK_ADAPTER_VERSION,
    schemaVersion: SHARED_CONTRACT_SCHEMA_VERSION,
    supportedPayloadTypes: [],
    supportedImportTypes: [],
    supportedExportTypes: [],
    supportsDeepLink: false,
    supportsFileImport: true,
    supportsClipboardImport: true,
    supportsLocalStorageLink: false,
    supportsBroadcastChannel: false,
    supportsLiveSync: false,
    supportsDeckSnapshots: false,
    supportsSharedSessions: false,
    supportsRulesEngine: true,
    supportsAdvancedMode: true,
    supportsSimpleMode: false,
    supportsHubCoordination: false,
    lastCheckedAt: now,
    status: "Not Linked",
    limitations: [],
  };
  if (appId === "boardstate-lite") {
    return {
      ...base,
      appId,
      supportedPayloadTypes: [LITE_HANDOFF_BUNDLE_TYPE, "canonical-shared-session"],
      supportedImportTypes: ["boardstate-lite-session-snapshot", "canonical-shared-session"],
      supportedExportTypes: [LITE_HANDOFF_BUNDLE_TYPE, "canonical-shared-session"],
      supportsDeepLink: true,
      supportsSharedSessions: true,
      status: importedData.liteSessions.length ? "Imported Lite Session Available" : "Handoff Import/Export Supported",
      limitations: [
        "BoardState Lite repository is not updated yet.",
        "Live Lite switching is not installed.",
        "Missing simple-session private zones are preserved as unknown.",
      ],
      ...overrides,
    };
  }
  if (appId === "deck-nexus") {
    return {
      ...base,
      appId,
      supportedPayloadTypes: [DECK_NEXUS_SNAPSHOT_BUNDLE_TYPE, "deck-snapshot"],
      supportedImportTypes: ["deck-nexus-deck-snapshot"],
      supportedExportTypes: ["boardstate-imported-deck-snapshot-reference"],
      supportsDeepLink: true,
      supportsDeckSnapshots: true,
      status: importedData.deckSnapshots.length ? "Imported Snapshots Available" : "Snapshot Import Supported",
      limitations: [
        "Deck Nexus live linking is not installed.",
        "Imported deck snapshots are immutable local copies.",
        "BoardState does not mutate Deck Nexus master deck data.",
      ],
      ...overrides,
    };
  }
  if (appId === "boardstate-hub") {
    return {
      ...base,
      appId,
      appName: "BoardState Hub",
      appVersion: ECOSYSTEM_INTEGRATION_VERSION,
      supportedPayloadTypes: ["hub-launch-context", "hub-return-context", "ecosystem-capability-manifest", "privacy-safe-ecosystem-bundle"],
      supportedImportTypes: ["hub-launch-context"],
      supportedExportTypes: ["hub-return-context", "privacy-safe-ecosystem-bundle", "public-session-summary"],
      status: "Hub Not Connected",
      supportsDeepLink: true,
      supportsHubCoordination: true,
      supportsRulesEngine: false,
      supportsSharedSessions: true,
      limitations: [
        "No live Hub endpoint is configured.",
        "Hub coordinates profiles, friends, notifications, discovery, and cloud sync.",
        "Hub is never gameplay authority.",
      ],
      ...overrides,
    };
  }
  return { ...base, ...overrides };
}

export function createBoardStateLiteBridgeAdapter(profile = {}) {
  return {
    getAppId: () => "boardstate-lite",
    getDisplayName: () => "BoardState Lite",
    getCapabilities: () => createCapabilityHandshake("boardstate-lite", profile),
    getConnectionStatus: () => getBoardStateLiteStatus(profile),
    validateIncomingPayload: (payload) => validateBoardStateLiteSnapshot(payload),
    importPayload: (targetProfile, payload, options = {}) => importBoardStateLiteSnapshot(targetProfile, payload, options),
    exportPayload: (targetProfile, options = {}) => createBoardStateLiteHandoffBundle(targetProfile, options),
    createHandoffBundle: (targetProfile, options = {}) => createBoardStateLiteHandoffBundle(targetProfile, options),
    parseHandoffBundle: (payload) => validateBoardStateLiteSnapshot(payload),
    getCompatibilityReport: (payload) => buildLiteCompatibilityReport(payload),
    disconnect: (targetProfile) => disconnectImportedApp(targetProfile, "boardstate-lite"),
    clearImportedData: (targetProfile) => clearImportedLiteSessions(targetProfile),
  };
}

export function createDeckNexusBridgeAdapter(profile = {}) {
  return {
    getAppId: () => "deck-nexus",
    getDisplayName: () => "Deck Nexus",
    getCapabilities: () => createCapabilityHandshake("deck-nexus", profile),
    getConnectionStatus: () => getDeckNexusStatus(profile),
    validateIncomingPayload: (payload) => validateDeckNexusSnapshotPayload(payload),
    importPayload: (targetProfile, payload, options = {}) => importDeckNexusSnapshot(targetProfile, payload, options),
    exportPayload: (targetProfile, options = {}) => createDeckSnapshotReferenceBundle(targetProfile, options),
    createHandoffBundle: (targetProfile, options = {}) => createDeckSnapshotReferenceBundle(targetProfile, options),
    parseHandoffBundle: (payload) => validateDeckNexusSnapshotPayload(payload),
    getCompatibilityReport: (payload) => buildDeckNexusCompatibilityReport(payload),
    disconnect: (targetProfile) => disconnectImportedApp(targetProfile, "deck-nexus"),
    clearImportedData: (targetProfile) => clearImportedDeckSnapshots(targetProfile),
  };
}

function createHubBridgeAdapter(profile = {}) {
  return {
    getAppId: () => "boardstate-hub",
    getDisplayName: () => "BoardState Hub",
    getCapabilities: () => createCapabilityHandshake("boardstate-hub", profile),
    getConnectionStatus: () => ({
      status: "Hub Not Connected",
      linked: false,
      detail: "Hub coordination contracts are ready; no live Hub endpoint is configured.",
    }),
    validateIncomingPayload: (payload) => validateHubPayload(payload),
    importPayload: (targetProfile, payload) => ({
      ...targetProfile,
      ecosystemIntegration: targetProfile.ecosystemIntegration || profile.ecosystemIntegration || {},
      importedData: {
        ...(targetProfile.importedData || {}),
        lastError: validateHubPayload(payload).valid ? "" : validateHubPayload(payload).errors[0] || "Hub payload rejected.",
      },
    }),
    exportPayload: (targetProfile, options = {}) => createPrivacySafeEcosystemBundle(targetProfile, options),
    createHandoffBundle: (targetProfile, options = {}) => createPrivacySafeEcosystemBundle(targetProfile, options),
    parseHandoffBundle: (payload) => validateHubPayload(payload),
    getCompatibilityReport: (payload = {}) => validateHubPayload(payload),
    createLaunchContext: (targetProfile = profile, options = {}) => createHubLaunchContext(targetProfile, options),
    createReturnContext: (targetProfile = profile, options = {}) => createHubReturnContext(targetProfile, options),
    disconnect: (targetProfile) => disconnectImportedApp(targetProfile, "boardstate-hub"),
    clearImportedData: (targetProfile) => targetProfile,
  };
}

function validateHubPayload(payload = {}) {
  try {
    const parsed = typeof payload === "string" ? JSON.parse(payload) : clonePlain(payload || {});
    const bundleType = parsed.bundleType || parsed.payloadType || parsed.type || "";
    if (/sync/i.test(bundleType) || parsed.envelopeId || parsed.canonicalMessage) {
      const validation = validateEcosystemSyncEnvelope(parsed);
      return createBridgeCompatibilityReport({
        status: validation.valid ? "valid" : "invalid",
        sourceApp: "boardstate-hub",
        payloadType: bundleType || "ecosystem-sync-envelope",
        errors: validation.errors,
        warnings: ["Validated as a Hub coordination envelope. Hub still cannot mutate gameplay."],
        privateInformationExcluded: true,
        recommendedAction: validation.valid ? "Queue for Hub when a live endpoint is configured." : "Reject Hub payload.",
      });
    }
    if (!["hub-launch-context", "hub-return-context", "ecosystem-capability-manifest", "privacy-safe-ecosystem-bundle", ""].includes(bundleType)) {
      return createBridgeCompatibilityReport({
        status: "unsupported-version",
        sourceApp: "boardstate-hub",
        payloadType: bundleType,
        errors: [`unsupported Hub payload type ${bundleType}`],
      });
    }
    const privacyValidation = validateNoUnsafeBridgeData(parsed);
    return createBridgeCompatibilityReport({
      status: privacyValidation.valid ? "valid" : "unsafe-private-data",
      sourceApp: "boardstate-hub",
      payloadType: bundleType || "hub-launch-context",
      errors: privacyValidation.errors,
      warnings: ["Hub live connection is not installed; payload is validation-only."],
      privateInformationExcluded: true,
      recommendedAction: privacyValidation.valid ? "Review launch or return context locally." : "Reject unsafe Hub payload.",
    });
  } catch {
    return createBridgeCompatibilityReport({
      status: "corrupted",
      sourceApp: "boardstate-hub",
      errors: ["Hub payload is malformed JSON."],
    });
  }
}

export function validateBoardStateLiteSnapshot(input = {}) {
  const safe = parseBridgePayload(input, { expectedSourceApp: "boardstate-lite", allowedBundleTypes: [LITE_HANDOFF_BUNDLE_TYPE, "boardstate-shared-session-handoff"] });
  if (!safe.valid) {
    return createBridgeCompatibilityReport({
      status: safe.status,
      sourceApp: safe.sourceApp || "boardstate-lite",
      errors: safe.errors,
      warnings: safe.warnings,
      payloadType: LITE_HANDOFF_BUNDLE_TYPE,
    });
  }
  const parsed = parseLinkedSessionSnapshot({
    ...safe.payload,
    sourceApp: safe.payload.sourceApp || "boardstate-lite",
    session: safe.payload.session || safe.payload.sharedSession || safe.payload.gameState || safe.payload,
  });
  const errors = [...(parsed.errors || [])];
  const warnings = [...safe.warnings, ...(parsed.warnings || [])];
  if (parsed.sourceApp && parsed.sourceApp !== "boardstate-lite") {
    warnings.push(`source app ${parsed.sourceApp} is compatible but not a live BoardState Lite link`);
  }
  if (parsed.session) {
    const unknowns = collectLiteUnknownMarkers(parsed.session);
    warnings.push(...unknowns);
  }
  return createBridgeCompatibilityReport({
    status: parsed.valid ? (warnings.length ? "compatible-with-warnings" : "valid") : parsed.status || "invalid",
    sourceApp: parsed.sourceApp || safe.payload.sourceApp || "boardstate-lite",
    sourceVersion: safe.payload.sourceVersion || safe.payload.appVersion || "",
    schemaVersion: parsed.session?.schemaVersion || safe.payload.schemaVersion || SHARED_CONTRACT_SCHEMA_VERSION,
    rulesEngineVersion: parsed.session?.rulesEngineVersion || safe.payload.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
    errors,
    warnings,
    missingFields: collectLiteMissingFields(parsed.session || {}),
    inferredFields: collectLiteInferredFields(parsed.session || {}),
    privateInformationExcluded: true,
    recommendedAction: parsed.valid ? "Import snapshot, then continue in Advanced Mode when ready." : "Reject import and request a valid canonical shared-session snapshot.",
    payloadType: LITE_HANDOFF_BUNDLE_TYPE,
    session: parsed.session || null,
  });
}

export function importBoardStateLiteSnapshot(profile = {}, input = {}, options = {}) {
  const report = validateBoardStateLiteSnapshot(input);
  if (!report.valid || !report.session) {
    return {
      profile: recordFailedImport(profile, {
        sourceApp: "boardstate-lite",
        payloadType: LITE_HANDOFF_BUNDLE_TYPE,
        compatibilityReport: report,
      }),
      compatibilityReport: report,
      imported: null,
    };
  }
  const importedResult = importLinkedSessionSnapshot(profile, {
    sourceApp: "boardstate-lite",
    session: report.session,
  }, {
    sessionName: options.sessionName || "BoardState Lite Imported Session",
    activate: Boolean(options.activate),
  });
  const importedData = createImportedDataState(importedResult.profile.importedData || profile.importedData || {});
  const liteRecord = normalizeImportedLiteSession({
    importedSessionId: report.session.sessionId,
    originalSessionId: report.session.sessionId,
    gameId: report.session.gameId,
    sessionId: report.session.sessionId,
    name: options.sessionName || "BoardState Lite Imported Session",
    sourceApp: "boardstate-lite",
    sourceVersion: report.sourceVersion || "",
    importedAt: Date.now(),
    schemaVersion: report.schemaVersion,
    rulesEngineVersion: report.rulesEngineVersion,
    revision: report.session.revision || 0,
    compatibilityReport: report,
    canonicalSession: report.session,
    unknownDataMarkers: report.missingFields || [],
  });
  return {
    profile: {
      ...importedResult.profile,
      importedData: {
        ...importedData,
        lastError: "",
        lastImportAt: Date.now(),
        liteSessions: [liteRecord, ...importedData.liteSessions.filter((entry) => entry.sessionId !== liteRecord.sessionId)].slice(0, 24),
      },
      settings: withLinkedAppStatus(importedResult.profile.settings, "boardstateLite", {
        linked: false,
        status: "Imported Lite Session Available",
        lastSyncAt: Date.now(),
        availableCapabilities: ["handoff-import", "handoff-export", "continue-in-advanced"],
      }),
    },
    compatibilityReport: report,
    imported: liteRecord,
  };
}

export function createBoardStateLiteHandoffBundle(profile = {}, options = {}) {
  const exported = createSharedSessionExport(profile, options);
  if (!exported.valid || !exported.bundle?.session) {
    return { valid: false, errors: exported.errors || ["shared session export failed"], bundle: null, text: "" };
  }
  const session = exported.bundle.session;
  const bundle = {
    app: "BoardState",
    bundleType: LITE_HANDOFF_BUNDLE_TYPE,
    sourceApp: "boardstate",
    targetApp: "boardstate-lite",
    exportedAt: new Date(options.exportedAt || Date.now()).toISOString(),
    schemaVersion: SHARED_CONTRACT_SCHEMA_VERSION,
    saveFormatVersion: SHARED_SAVE_FORMAT_VERSION,
    syncProtocolVersion: SHARED_SYNC_PROTOCOL_VERSION,
    rulesEngineVersion: session.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
    sessionRevision: session.revision || 0,
    enforcementMode: session.enforcementMode || "enforced",
    activeWaivers: clonePlain(session.activeRuleWaivers || []),
    compatibilityNotes: [
      "Prepared for future BoardState Lite handoff.",
      "BoardState Lite live import is not installed yet.",
    ],
    omittedDataNotices: [
      "Private hand/library data is not exported for public Lite handoff.",
      "Unsafe sync credentials and local passwords are excluded.",
    ],
    privateDataWarning: "This bundle contains public shared-session state only.",
    playerSummary: (session.players || []).map((player) => ({
      playerId: player.playerId,
      displayName: player.displayName,
      life: player.life,
      commanderDamage: clonePlain(player.commanderDamage || {}),
      poisonCounters: player.poisonCounters || 0,
      playerCounters: clonePlain(player.playerCounters || {}),
      interfaceMode: session.activeInterfaceByPlayer?.[player.playerId] || player.activeInterface || "unknown",
    })),
    battlefieldSummary: summarizeBattlefieldForLite(session),
    session,
  };
  const privacyValidation = validateNoUnsafeBridgeData(bundle);
  if (!privacyValidation.valid) {
    return { valid: false, errors: privacyValidation.errors, bundle: null, text: "" };
  }
  return { valid: true, errors: [], bundle, text: JSON.stringify(bundle, null, 2) };
}

export function validateDeckNexusSnapshotPayload(input = {}) {
  const safe = parseBridgePayload(input, { expectedSourceApp: "deck-nexus", allowedBundleTypes: [DECK_NEXUS_SNAPSHOT_BUNDLE_TYPE, "deck-snapshot"] });
  if (!safe.valid) {
    return createBridgeCompatibilityReport({
      status: safe.status,
      sourceApp: "deck-nexus",
      errors: safe.errors,
      warnings: safe.warnings,
      payloadType: DECK_NEXUS_SNAPSHOT_BUNDLE_TYPE,
    });
  }
  const normalized = normalizeDeckNexusSnapshot(safe.payload);
  const validation = validateDeckSnapshot(normalized);
  const errors = [...(validation.errors || [])];
  const warnings = [...safe.warnings, ...buildDeckSnapshotWarnings(normalized, safe.payload)];
  if (normalized.sourceApp !== "deck-nexus") warnings.push("source app was normalized to Deck Nexus-compatible snapshot import");
  return createBridgeCompatibilityReport({
    status: errors.length ? validation.status || "invalid" : warnings.length ? "compatible-with-warnings" : "valid",
    sourceApp: "deck-nexus",
    sourceVersion: normalized.sourceDeckVersion,
    schemaVersion: SHARED_CONTRACT_SCHEMA_VERSION,
    errors,
    warnings,
    missingFields: getDeckMissingFields(normalized),
    unsupportedFields: [],
    inferredFields: getDeckInferredFields(normalized),
    recommendedAction: errors.length ? "Reject import and request a valid deck snapshot." : "Import immutable deck snapshot for Dry Run or Advanced Gameplay.",
    payloadType: DECK_NEXUS_SNAPSHOT_BUNDLE_TYPE,
    deckSnapshot: normalized,
  });
}

export function normalizeDeckNexusSnapshot(input = {}) {
  const raw = input.deckSnapshot || input.snapshot || input.deck || input.payload || input;
  const cards = normalizeDeckCards(raw.cards || raw.mainboard || raw.cardEntries || []);
  const sideboard = normalizeDeckCards(raw.sideboard || []);
  const commanderIds = Array.isArray(raw.commanderIds)
    ? raw.commanderIds.map(String).filter(Boolean)
    : cards.filter((card) => card.commander || card.role === "commander").map((card) => card.oracleId || card.name);
  const sourceDeckVersion = String(raw.sourceDeckVersion || raw.sourceVersion || raw.version || raw.deckVersion || "snapshot-v1");
  const sourceDeckId = String(raw.sourceDeckId || raw.deckId || raw.id || raw.name || raw.deckName || createContractId("deckId"));
  return createDeckSnapshot({
    deckSnapshotId: raw.deckSnapshotId || raw.snapshotId || `${sourceDeckId}-${sourceDeckVersion}`,
    sourceApp: "deck-nexus",
    sourceDeckId,
    sourceDeckVersion,
    ownerProfileId: raw.ownerProfileId || raw.profileId || "",
    name: raw.deckName || raw.name || "Deck Nexus Snapshot",
    format: raw.format || "commander",
    commanderIds,
    partnerBackgroundReferences: raw.partnerBackgroundReferences || {
      partner: raw.partnerReferences || raw.partnerIds || [],
      background: raw.backgroundReferences || raw.backgroundIds || [],
      companion: raw.companionIds || [],
    },
    cards,
    sideboard,
    strategyTags: Array.isArray(raw.strategyTags) ? raw.strategyTags : [],
    bracketPowerMetadata: raw.bracketPowerMetadata || raw.powerMetadata || raw.bracket || {},
    importedAt: Number(raw.importedAt || raw.exportedAt || Date.now()),
    immutableSnapshotVersion: raw.immutableSnapshotVersion || raw.snapshotVersion || SHARED_CONTRACT_SCHEMA_VERSION,
  });
}

export function importDeckNexusSnapshot(profile = {}, input = {}, options = {}) {
  const report = validateDeckNexusSnapshotPayload(input);
  if (!report.valid || !report.deckSnapshot) {
    return {
      profile: recordFailedImport(profile, {
        sourceApp: "deck-nexus",
        payloadType: DECK_NEXUS_SNAPSHOT_BUNDLE_TYPE,
        compatibilityReport: report,
      }),
      compatibilityReport: report,
      imported: null,
    };
  }
  const importedData = createImportedDataState(profile.importedData || {});
  const existing = importedData.deckSnapshots.find((entry) => entry.deckSnapshotId === report.deckSnapshot.deckSnapshotId);
  if (existing && !options.overwrite) {
    const blocked = createBridgeCompatibilityReport({
      status: "compatible-with-warnings",
      sourceApp: "deck-nexus",
      warnings: ["deck snapshot already imported; confirm overwrite to replace this exact immutable snapshot"],
      recommendedAction: "Keep existing snapshot or reimport with overwrite confirmation.",
      deckSnapshot: report.deckSnapshot,
    });
    return {
      profile: {
        ...profile,
        importedData: {
          ...importedData,
          lastError: "Deck snapshot already imported; overwrite requires confirmation.",
        },
      },
      compatibilityReport: blocked,
      imported: existing,
    };
  }
  const now = Date.now();
  const previousVersions = importedData.deckSnapshots.filter((entry) => entry.sourceDeckId === report.deckSnapshot.sourceDeckId);
  const snapshotRecord = normalizeImportedDeckSnapshot({
    ...report.deckSnapshot,
    importedAt: now,
    status: report.status,
    compatibilityReport: report,
    newerSnapshotAvailable: false,
    previousSnapshotIds: previousVersions.map((entry) => entry.deckSnapshotId).filter((id) => id !== report.deckSnapshot.deckSnapshotId),
  });
  const deckSnapshots = [
    snapshotRecord,
    ...importedData.deckSnapshots
      .filter((entry) => options.overwrite ? entry.deckSnapshotId !== snapshotRecord.deckSnapshotId : entry.deckSnapshotId !== snapshotRecord.deckSnapshotId)
      .map((entry) => entry.sourceDeckId === snapshotRecord.sourceDeckId ? { ...entry, newerSnapshotAvailable: true, newerSnapshotId: snapshotRecord.deckSnapshotId } : entry),
  ].slice(0, 80);
  return {
    profile: {
      ...profile,
      importedData: {
        ...importedData,
        lastError: "",
        lastImportAt: now,
        deckSnapshots,
      },
      settings: withLinkedAppStatus(profile.settings, "deckNexus", {
        linked: false,
        status: "Imported Snapshots Available",
        lastSyncAt: now,
        availableCapabilities: ["snapshot-import", "dry-run-source", "advanced-gameplay-source"],
      }),
    },
    compatibilityReport: report,
    imported: snapshotRecord,
  };
}

export function getImportedDeckSnapshots(profile = {}) {
  return createImportedDataState(profile.importedData || {}).deckSnapshots;
}

export function getImportedLiteSessions(profile = {}) {
  return createImportedDataState(profile.importedData || {}).liteSessions;
}

export function getDeckSnapshotById(profile = {}, deckSnapshotId = "") {
  return getImportedDeckSnapshots(profile).find((entry) => entry.deckSnapshotId === deckSnapshotId) || null;
}

export function buildDeckSourceOptions(profile = {}) {
  const imported = getImportedDeckSnapshots(profile).map((snapshot) => ({
    type: "imported-deck-snapshot",
    label: snapshot.name,
    deckSnapshotId: snapshot.deckSnapshotId,
    sourceApp: snapshot.sourceApp,
    sourceDeckId: snapshot.sourceDeckId,
    sourceDeckVersion: snapshot.sourceDeckVersion,
    importedAt: snapshot.importedAt,
    format: snapshot.format,
    commander: snapshot.commanderIds?.[0] || "",
    cardCount: countDeckCards(snapshot),
    compatibilityStatus: snapshot.compatibilityReport?.status || snapshot.status || "valid",
    newerSnapshotAvailable: Boolean(snapshot.newerSnapshotAvailable),
    newerSnapshotId: snapshot.newerSnapshotId || "",
  }));
  const legacy = Object.entries(profile.commanders || {}).map(([deckKey, deck]) => ({
    type: "legacy-boardstate-deck",
    label: deck.name || deck.commanderName || deckKey,
    deckKey,
    sourceApp: "boardstate",
    cardCount: (deck.cards || []).reduce((sum, card) => sum + Number(card.quantity || 1), 0),
    compatibilityStatus: "legacy",
  }));
  return [
    ...legacy,
    ...imported,
    { type: "boardstate-practice-deck", label: "BoardState Practice Deck", sourceApp: "boardstate", compatibilityStatus: "available" },
  ];
}

export function attachDeckSnapshotToSession(session = {}, snapshot = {}, options = {}) {
  if (!snapshot?.deckSnapshotId) return session;
  const reference = {
    deckSnapshotId: snapshot.deckSnapshotId,
    sourceDeckId: snapshot.sourceDeckId,
    sourceDeckVersion: snapshot.sourceDeckVersion,
    sourceApp: snapshot.sourceApp || "deck-nexus",
    importedAt: snapshot.importedAt || Date.now(),
    cardDataVersion: snapshot.cardDataVersion || snapshot.immutableSnapshotVersion || "",
    playerId: options.playerId || "local-player",
    usage: options.usage || "player-deck",
    embeddedSnapshot: clonePlain(snapshot),
  };
  return {
    ...session,
    deckSnapshotReferences: [
      reference,
      ...(session.deckSnapshotReferences || []).filter((entry) => entry.deckSnapshotId !== snapshot.deckSnapshotId),
    ],
    saveMetadata: {
      ...(session.saveMetadata || {}),
      deckSnapshotId: snapshot.deckSnapshotId,
      sourceDeckId: snapshot.sourceDeckId,
      sourceDeckVersion: snapshot.sourceDeckVersion,
      sourceApp: session.saveMetadata?.sourceApp || session.sourceApp || "boardstate",
      importedAt: snapshot.importedAt,
      cardDataVersion: reference.cardDataVersion,
      linkedAppReferences: [
        ...new Set([...(session.saveMetadata?.linkedAppReferences || []), "deck-nexus"]),
      ],
    },
  };
}

export function removeImportedDeckSnapshot(profile = {}, deckSnapshotId = "", options = {}) {
  const importedData = createImportedDataState(profile.importedData || {});
  const usedByActive = (profile.activeSession?.deckSnapshotReferences || []).some((entry) => entry.deckSnapshotId === deckSnapshotId);
  if (usedByActive && !options.confirm) {
    return {
      ...profile,
      importedData: {
        ...importedData,
        lastError: "Snapshot is referenced by the active session; confirm removal or save an embedded copy first.",
      },
    };
  }
  return {
    ...profile,
    importedData: {
      ...importedData,
      lastError: "",
      deckSnapshots: importedData.deckSnapshots.filter((entry) => entry.deckSnapshotId !== deckSnapshotId),
    },
  };
}

export function clearImportedDeckSnapshots(profile = {}) {
  const importedData = createImportedDataState(profile.importedData || {});
  return {
    ...profile,
    importedData: {
      ...importedData,
      deckSnapshots: [],
      lastError: "",
    },
  };
}

export function clearImportedLiteSessions(profile = {}) {
  const importedData = createImportedDataState(profile.importedData || {});
  return {
    ...profile,
    importedData: {
      ...importedData,
      liteSessions: [],
      lastError: "",
    },
  };
}

export function disconnectImportedApp(profile = {}, appId = "") {
  const key = appId === "deck-nexus" ? "deckNexus" : appId === "boardstate-lite" ? "boardstateLite" : "boardstateHub";
  const status =
    appId === "deck-nexus"
      ? "Snapshot Import Supported"
      : appId === "boardstate-lite"
        ? "Handoff Import/Export Supported"
        : "Hub Not Connected";
  return {
    ...profile,
    settings: withLinkedAppStatus(profile.settings, key, {
      linked: false,
      status,
      lastSyncAt: 0,
      availableCapabilities: [],
    }),
  };
}

export function createDeckSnapshotReferenceBundle(profile = {}, options = {}) {
  const snapshots = getImportedDeckSnapshots(profile);
  const selected = options.deckSnapshotId ? snapshots.filter((snapshot) => snapshot.deckSnapshotId === options.deckSnapshotId) : snapshots;
  const bundle = {
    app: "BoardState",
    bundleType: "boardstate-imported-deck-snapshot-reference",
    sourceApp: "boardstate",
    targetApp: "deck-nexus",
    exportedAt: new Date(options.exportedAt || Date.now()).toISOString(),
    schemaVersion: SHARED_CONTRACT_SCHEMA_VERSION,
    snapshots: selected.map((snapshot) => ({
      deckSnapshotId: snapshot.deckSnapshotId,
      sourceDeckId: snapshot.sourceDeckId,
      sourceDeckVersion: snapshot.sourceDeckVersion,
      sourceApp: snapshot.sourceApp,
      name: snapshot.name,
      importedAt: snapshot.importedAt,
      immutableSnapshotVersion: snapshot.immutableSnapshotVersion,
      compatibilityStatus: snapshot.compatibilityReport?.status || snapshot.status || "valid",
    })),
    limitations: ["This is a local imported snapshot reference, not a live Deck Nexus link."],
  };
  const privacyValidation = validateNoUnsafeBridgeData(bundle);
  if (!privacyValidation.valid) return { valid: false, errors: privacyValidation.errors, bundle: null, text: "" };
  return { valid: true, errors: [], bundle, text: JSON.stringify(bundle, null, 2) };
}

export function createImportedDataSnapshotForSession(profile = {}, session = {}) {
  const references = session.deckSnapshotReferences || [];
  const deckSnapshotIds = new Set(references.map((entry) => entry.deckSnapshotId).filter(Boolean));
  const importedData = createImportedDataState(profile.importedData || {});
  return {
    deckSnapshots: importedData.deckSnapshots.filter((snapshot) => deckSnapshotIds.has(snapshot.deckSnapshotId)),
    liteSessions: importedData.liteSessions.filter((record) => record.sessionId === session.sessionId || record.originalSessionId === session.sessionId),
    compatibilityReports: references.map((reference) => reference.compatibilityReport).filter(Boolean),
  };
}

export function getImportedDataManagementModel(profile = {}) {
  const importedData = createImportedDataState(profile.importedData || {});
  const activeRefs = new Set((profile.activeSession?.deckSnapshotReferences || []).map((entry) => entry.deckSnapshotId));
  return {
    liteSessions: importedData.liteSessions.map((record) => ({
      ...record,
      compatibilityStatus: record.compatibilityReport?.status || "valid",
      usedByActiveSession: record.sessionId === profile.activeSession?.sessionId,
    })),
    deckSnapshots: importedData.deckSnapshots.map((snapshot) => ({
      ...snapshot,
      compatibilityStatus: snapshot.compatibilityReport?.status || snapshot.status || "valid",
      cardCount: countDeckCards(snapshot),
      commander: snapshot.commanderIds?.[0] || "",
      usedByActiveSession: activeRefs.has(snapshot.deckSnapshotId),
    })),
    sharedSessions: importedData.sharedSessions,
    failedImports: importedData.failedImports,
  };
}

export function parseAppLinkHandoffFromLocation(locationLike = globalThis.location) {
  const hash = String(locationLike?.hash || "");
  const search = String(locationLike?.search || "");
  const hashRoute = hash.match(/^#\/?(?:import|handoff)\/(session|deck)\/([^?&#]+)/i);
  const hashQueryIndex = hash.indexOf("?");
  const hashParams = hashQueryIndex >= 0 ? new URLSearchParams(hash.slice(hashQueryIndex + 1).replace(/^#/, "")) : new URLSearchParams();
  const searchParams = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const sessionRef = hashRoute?.[1] === "session" ? hashRoute[2] : searchParams.get("boardstateSession") || searchParams.get("importSession") || hashParams.get("boardstateSession") || hashParams.get("importSession") || "";
  const deckRef = hashRoute?.[1] === "deck" ? hashRoute[2] : searchParams.get("deckSnapshot") || hashParams.get("deckSnapshot") || "";
  const rawRef = sessionRef || deckRef || "";
  if (!rawRef) return null;
  if (rawRef.length > 8192) {
    return { valid: false, status: "unsafe", errors: ["handoff link payload is too large"], type: sessionRef ? "session" : "deck", requiresConfirmation: true };
  }
  let payloadReference = "";
  try {
    payloadReference = decodeURIComponent(rawRef);
  } catch {
    return { valid: false, status: "corrupted", errors: ["handoff link payload is malformed"], type: sessionRef ? "session" : "deck", requiresConfirmation: true };
  }
  return {
    valid: true,
    status: "pending-confirmation",
    type: sessionRef ? "session" : "deck",
    payloadReference,
    requiresConfirmation: true,
    source: "deep-link",
  };
}

export function buildLiteCompatibilityReport(payload = {}) {
  return validateBoardStateLiteSnapshot(payload);
}

export function buildDeckNexusCompatibilityReport(payload = {}) {
  return validateDeckNexusSnapshotPayload(payload);
}

export function getBoardStateLiteStatus(profile = {}) {
  const imported = getImportedLiteSessions(profile);
  const current = profile.activeSession?.linkedSession || {};
  if (current.sourceApp === "boardstate-lite" && current.imported) {
    return { status: "Imported Lite Session Active", linked: false, detail: "Current Advanced session came from a Lite snapshot." };
  }
  if (imported.length) {
    return { status: "Imported Lite Session Available", linked: false, detail: `${imported.length} Lite snapshot(s) stored locally.` };
  }
  return { status: "Handoff Import/Export Supported", linked: false, detail: "Waiting for Lite update; Live Link Not Installed." };
}

export function getDeckNexusStatus(profile = {}) {
  const snapshots = getImportedDeckSnapshots(profile);
  if (snapshots.length) {
    return { status: "Imported Snapshots Available", linked: false, detail: `${snapshots.length} immutable deck snapshot(s) stored locally.` };
  }
  return { status: "Snapshot Import Supported", linked: false, detail: "Waiting for Nexus update; Live Link Not Installed." };
}

function parseBridgePayload(input = {}, options = {}) {
  try {
    const raw = typeof input === "string" ? input : JSON.stringify(input || {});
    if (raw.length > BRIDGE_PAYLOAD_LIMIT) {
      return { valid: false, status: "unsafe-private-data", errors: ["bridge payload is too large"], warnings: [], payload: null };
    }
    const parsed = typeof input === "string" ? JSON.parse(input) : clonePlain(input || {});
    const privacyValidation = validateNoUnsafeBridgeData(parsed);
    if (!privacyValidation.valid) {
      return { valid: false, status: "unsafe-private-data", errors: privacyValidation.errors, warnings: [], payload: null, sourceApp: parsed.sourceApp || "unknown" };
    }
    const unsafeKey = findUnsafePrivateKey(parsed);
    if (unsafeKey) {
      return { valid: false, status: "unsafe-private-data", errors: [`private import key ${unsafeKey} is not allowed`], warnings: [], payload: null, sourceApp: parsed.sourceApp || "unknown" };
    }
    const scriptWarning = JSON.stringify(parsed).match(/<script|javascript:/i) ? ["script-like content sanitized/rejected from bridge import review"] : [];
    const payload = parsed.deckSnapshot || parsed.session || parsed.sharedSession || parsed.payload || parsed;
    const bundleType = parsed.bundleType || payload.bundleType || "";
    const sourceApp = parsed.sourceApp || payload.sourceApp || parsed.appId || "unknown";
    const warnings = [...scriptWarning];
    if (options.expectedSourceApp && sourceApp !== options.expectedSourceApp) {
      warnings.push(`expected ${options.expectedSourceApp}; received ${sourceApp}`);
    }
    if (options.allowedBundleTypes?.length && bundleType && !options.allowedBundleTypes.includes(bundleType)) {
      warnings.push(`bundle type ${bundleType} is treated as compatible external payload`);
    }
    return { valid: true, status: "valid", errors: [], warnings, payload: parsed, sourceApp, bundleType };
  } catch {
    return { valid: false, status: "corrupted", errors: ["bridge payload is malformed JSON"], warnings: [], payload: null, sourceApp: "unknown" };
  }
}

function createBridgeCompatibilityReport(input = {}) {
  const status = normalizeCompatibilityStatus(input.status || (input.errors?.length ? "invalid" : "valid"));
  return {
    valid: status === "valid" || status === "compatible-with-warnings",
    status,
    sourceApp: input.sourceApp || "unknown",
    sourceVersion: input.sourceVersion || "",
    schemaVersion: input.schemaVersion || SHARED_CONTRACT_SCHEMA_VERSION,
    rulesEngineVersion: input.rulesEngineVersion || "",
    payloadType: input.payloadType || "",
    errors: Array.isArray(input.errors) ? input.errors : [],
    warnings: Array.isArray(input.warnings) ? input.warnings : [],
    missingFields: Array.isArray(input.missingFields) ? input.missingFields : [],
    unsupportedFields: Array.isArray(input.unsupportedFields) ? input.unsupportedFields : [],
    inferredFields: Array.isArray(input.inferredFields) ? input.inferredFields : [],
    unknownPublicInformation: Array.isArray(input.unknownPublicInformation) ? input.unknownPublicInformation : [],
    privateInformationExcluded: Boolean(input.privateInformationExcluded),
    recommendedAction: input.recommendedAction || "",
    session: input.session || null,
    deckSnapshot: input.deckSnapshot || null,
    checkedAt: Number(input.checkedAt || Date.now()),
  };
}

function normalizeCompatibilityStatus(status = "valid") {
  return [
    "valid",
    "compatible-with-warnings",
    "migration-required",
    "unsupported-version",
    "missing-required-data",
    "corrupted",
    "unsafe-private-data",
    "invalid",
  ].includes(status) ? status : "invalid";
}

function normalizeImportedLiteSession(record = {}) {
  const session = record.canonicalSession || record.session || null;
  const sessionId = record.sessionId || record.importedSessionId || session?.sessionId || "";
  if (!sessionId) return null;
  return {
    importedSessionId: record.importedSessionId || sessionId,
    originalSessionId: record.originalSessionId || sessionId,
    gameId: record.gameId || session?.gameId || "",
    sessionId,
    name: record.name || record.sessionName || "Imported Lite Session",
    sourceApp: record.sourceApp || "boardstate-lite",
    sourceVersion: record.sourceVersion || "",
    importedAt: Number(record.importedAt || Date.now()),
    schemaVersion: record.schemaVersion || session?.schemaVersion || SHARED_CONTRACT_SCHEMA_VERSION,
    rulesEngineVersion: record.rulesEngineVersion || session?.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
    revision: Number(record.revision || session?.revision || 0),
    compatibilityReport: record.compatibilityReport || createBridgeCompatibilityReport({ sourceApp: "boardstate-lite" }),
    canonicalSession: session ? createSharedGameSession(session) : null,
    unknownDataMarkers: Array.isArray(record.unknownDataMarkers) ? [...record.unknownDataMarkers] : [],
    status: record.status || "imported",
  };
}

function normalizeImportedDeckSnapshot(record = {}) {
  const snapshot = createDeckSnapshot(record.snapshot || record.deckSnapshot || record);
  return {
    ...snapshot,
    sourceApp: "deck-nexus",
    cardDataVersion: record.cardDataVersion || record.sourceDataVersion || snapshot.immutableSnapshotVersion,
    status: record.status || record.compatibilityReport?.status || "valid",
    compatibilityReport: record.compatibilityReport || createBridgeCompatibilityReport({ sourceApp: "deck-nexus", deckSnapshot: snapshot }),
    newerSnapshotAvailable: Boolean(record.newerSnapshotAvailable),
    newerSnapshotId: record.newerSnapshotId || "",
    previousSnapshotIds: Array.isArray(record.previousSnapshotIds) ? [...record.previousSnapshotIds] : [],
  };
}

function normalizeDeckCards(cards = []) {
  if (Array.isArray(cards)) {
    return cards.map(normalizeDeckCard).filter((card) => card.quantity > 0 && card.name);
  }
  if (cards && typeof cards === "object") {
    return Object.entries(cards).map(([name, quantity]) => normalizeDeckCard({ name, quantity })).filter((card) => card.quantity > 0 && card.name);
  }
  return [];
}

function normalizeDeckCard(card = {}, index = 0) {
  const name = String(card.name || card.cardName || card.title || "").trim();
  const oracleId = String(card.oracleId || card.oracle_id || card.cardOracleId || name || createContractId("cardOracleId"));
  return {
    oracleId,
    printingId: String(card.printingId || card.printing_id || card.scryfallId || card.id || oracleId),
    name,
    quantity: Math.max(0, Number(card.quantity || card.count || 1)),
    role: String(card.role || card.category || (card.commander ? "commander" : "mainboard")),
    zone: String(card.zone || card.board || (card.sideboard ? "sideboard" : "mainboard")),
    commander: Boolean(card.commander || card.isCommander),
    imageReference: card.imageReference || card.imageUrl || card.image_uris?.normal || "",
    typeLine: String(card.typeLine || card.type_line || ""),
    oracleText: String(card.oracleText || card.oracle_text || ""),
    manaCost: String(card.manaCost || card.mana_cost || ""),
    colorIdentity: Array.isArray(card.colorIdentity) ? [...card.colorIdentity] : [],
    fallbackLookup: {
      name,
      rowIndex: index,
      source: "deck-nexus-snapshot",
    },
  };
}

function buildDeckSnapshotWarnings(snapshot = {}, raw = {}) {
  const warnings = [];
  if (!snapshot.commanderIds?.length && /commander/i.test(snapshot.format)) warnings.push("commander format snapshot has no commander reference");
  if (!snapshot.cards.length) warnings.push("deck snapshot has no cards");
  if (snapshot.cards.some((card) => !card.oracleText)) warnings.push("one or more cards are missing oracle text; gameplay may require Manual Choice Required");
  if (snapshot.cards.some((card) => !card.imageReference && !card.imageUris)) warnings.push("one or more cards are missing image references");
  const total = countDeckCards(snapshot);
  if (/commander/i.test(snapshot.format) && total && total !== 100) warnings.push(`commander deck card count is ${total}; legality warning only, import remains allowed`);
  if (!raw.cardDataVersion && !raw.sourceDataVersion) warnings.push("card data version missing; imported snapshot remains immutable but may need lookup");
  return [...new Set(warnings)];
}

function getDeckMissingFields(snapshot = {}) {
  const missing = [];
  if (!snapshot.name) missing.push("deck name");
  if (!snapshot.cards?.length) missing.push("cards");
  if (!snapshot.commanderIds?.length && /commander/i.test(snapshot.format || "")) missing.push("commander reference");
  if (snapshot.cards?.some((card) => !card.oracleId)) missing.push("oracle IDs");
  if (snapshot.cards?.some((card) => !card.oracleText)) missing.push("oracle text");
  return [...new Set(missing)];
}

function getDeckInferredFields(snapshot = {}) {
  const inferred = [];
  if (snapshot.deckSnapshotId && snapshot.deckSnapshotId.includes(snapshot.sourceDeckVersion || "")) inferred.push("deckSnapshotId");
  if (!snapshot.ownerProfileId) inferred.push("ownerProfileId omitted");
  return inferred;
}

function collectLiteMissingFields(session = {}) {
  const missing = [];
  if (!session.privateInformationReferences || !Object.keys(session.privateInformationReferences).length) missing.push("private hand/library references");
  if (!session.deckSnapshotReferences?.length) missing.push("deck snapshot reference");
  if (!session.zoneState?.zonesByPlayer || !Object.keys(session.zoneState.zonesByPlayer).length) missing.push("graveyard/exile/hand/library zones");
  if (!session.stackState?.objects?.length) missing.push("detailed stack objects");
  return missing;
}

function collectLiteInferredFields(session = {}) {
  const inferred = [];
  if (!session.localInterfaceMode || session.localInterfaceMode === "unknown") inferred.push("localInterfaceMode");
  if (!session.activeInterfaceByPlayer || !Object.keys(session.activeInterfaceByPlayer).length) inferred.push("activeInterfaceByPlayer");
  if (!session.rulesEngineVersion) inferred.push("rulesEngineVersion");
  return inferred;
}

function collectLiteUnknownMarkers(session = {}) {
  return collectLiteMissingFields(session).map((field) => `${field} unavailable; preserved as unknown until needed`);
}

function summarizeBattlefieldForLite(session = {}) {
  const permanents = Object.values(session.battlefieldState?.permanentsById || {});
  return {
    permanentCount: permanents.length,
    byController: permanents.reduce((acc, permanent) => {
      const playerId = permanent.controllerPlayerId || "unknown";
      acc[playerId] = acc[playerId] || { creatures: 0, lands: 0, nonCreaturePermanents: 0, tapped: 0, tokens: 0 };
      const typeLine = `${permanent.baseCharacteristics?.typeLine || ""} ${permanent.derivedCharacteristics?.typeLine || ""}`;
      if (/\bCreature\b/i.test(typeLine)) acc[playerId].creatures += 1;
      else if (/\bLand\b/i.test(typeLine)) acc[playerId].lands += 1;
      else acc[playerId].nonCreaturePermanents += 1;
      if (permanent.tapped) acc[playerId].tapped += 1;
      if (permanent.token) acc[playerId].tokens += 1;
      return acc;
    }, {}),
    compactPermanents: permanents.map((permanent) => ({
      permanentId: permanent.permanentId,
      cardInstanceId: permanent.cardInstanceId,
      controllerPlayerId: permanent.controllerPlayerId,
      name: permanent.baseCharacteristics?.name || "Permanent",
      typeLine: permanent.derivedCharacteristics?.typeLine || permanent.baseCharacteristics?.typeLine || "",
      tapped: Boolean(permanent.tapped),
      counters: clonePlain(permanent.counters || {}),
      token: Boolean(permanent.token),
    })),
  };
}

function countDeckCards(snapshot = {}) {
  return [...(snapshot.cards || []), ...(snapshot.sideboard || [])].reduce((sum, card) => sum + Number(card.quantity || 0), 0);
}

function recordFailedImport(profile = {}, entry = {}) {
  const importedData = createImportedDataState(profile.importedData || {});
  const failed = {
    importId: createContractId("eventId"),
    sourceApp: entry.sourceApp || "unknown",
    payloadType: entry.payloadType || "",
    failedAt: Date.now(),
    compatibilityReport: entry.compatibilityReport || createBridgeCompatibilityReport({ status: "invalid", sourceApp: entry.sourceApp || "unknown" }),
  };
  return {
    ...profile,
    importedData: {
      ...importedData,
      lastError: failed.compatibilityReport.errors?.[0] || failed.compatibilityReport.status || "Import failed.",
      failedImports: [failed, ...importedData.failedImports].slice(0, 40),
    },
  };
}

function withLinkedAppStatus(settings = {}, key = "", patch = {}) {
  return {
    ...(settings || {}),
    linkedApps: {
      ...(settings?.linkedApps || {}),
      [key]: {
        ...(settings?.linkedApps?.[key] || {}),
        ...patch,
      },
    },
  };
}

function validateNoUnsafeBridgeData(input = {}) {
  const unsafeKey = findUnsafePrivateKey(input);
  const errors = [];
  if (unsafeKey) {
    errors.push(`private import key ${unsafeKey} is not allowed`);
  }
  const serialized = JSON.stringify(input || {});
  if (/bearer\s+[a-z0-9._-]{8,}/i.test(serialized)) {
    errors.push("bearer credential text is not allowed in bridge payloads");
  }
  if (/"(?:password|authToken|privateToken|secret|syncCredential|syncCredentials)"\s*:/i.test(serialized)) {
    errors.push("private bridge field is not allowed");
  }
  return errors.length ? { valid: false, errors } : { valid: true, errors: [] };
}

function findUnsafePrivateKey(value = {}) {
  if (!value || typeof value !== "object") return "";
  const stack = [value];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    for (const [key, child] of Object.entries(current)) {
      if (PRIVATE_EXPORT_KEYS.includes(key)) return key;
      if (child && typeof child === "object") stack.push(child);
    }
  }
  return "";
}
