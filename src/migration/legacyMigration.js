import {
  DEFAULT_RULES_ENGINE_VERSION,
  SHARED_CONTRACT_SCHEMA_VERSION,
  SHARED_SAVE_FORMAT_VERSION,
  SHARED_SYNC_PROTOCOL_VERSION,
  buildStableChecksum,
  clonePlain,
} from "../shared-contracts/index.js";
import { createContractId } from "../shared-contracts/ids.js";
import {
  createImportedDataState,
  validateBoardStateLiteSnapshot,
  validateDeckNexusSnapshotPayload,
} from "../bridge/appLinkAdapters.js";
import { validateLocalSave } from "../storage/saveState.js";

export const LEGACY_MIGRATION_VERSION = "boardstate-legacy-migration-0.1.0";
export const LEGACY_BACKUP_BUNDLE_TYPE = "boardstate-legacy-full-backup";
export const LEGACY_EXPORT_BUNDLE_TYPE = "boardstate-legacy-destination-export";

export const FUTURE_OWNER_APPS = Object.freeze({
  BOARDSTATE: "boardstate",
  BOARDSTATE_LITE: "boardstate-lite",
  DECK_NEXUS: "deck-nexus",
  HUB: "boardstate-hub",
  UNKNOWN: "unknown",
});

export const MIGRATION_READINESS = Object.freeze({
  READY: "Ready to Export",
  READY_WITH_WARNINGS: "Export Available With Warnings",
  NEEDS_DESTINATION: "Needs Destination App Update",
  NEEDS_REVIEW: "Needs Manual Review",
  UNSUPPORTED: "Unsupported Legacy Format",
  PROTECTED: "Protected Data",
  BOARDSTATE_OWNED: "Already BoardState-Owned",
  UNKNOWN: "Unknown Data",
  ERROR: "Error Reading Data",
});

export const MIGRATION_STATUS = Object.freeze({
  NOT_STARTED: "Not Started",
  EXPORT_PREPARED: "Export Prepared",
  WAITING_DESTINATION: "Waiting for Destination App",
  READY_MANUAL_IMPORT: "Ready for Manual Import",
  MIGRATED: "Migrated",
  PARTIAL: "Partial",
  FAILED: "Failed",
  ARCHIVED: "Archived",
  CLEANUP_ELIGIBLE: "Cleanup Eligible",
});

const STORAGE_PROFILE = "profile-storage";
const STORAGE_SAVE = "profile-local-saves";
const STORAGE_SETTINGS = "profile-settings";
const STORAGE_IMPORTED = "profile-imported-data";
const STORAGE_RUNTIME = "active-session-runtime";
const STORAGE_UNKNOWN = "unknown-profile-section";

const UNSAFE_PRIVATE_KEYS = new Set([
  "password",
  "passwordHash",
  "passwordSalt",
  "hash",
  "salt",
  "authToken",
  "accessToken",
  "refreshToken",
  "privateToken",
  "sessionToken",
  "secret",
  "privateKey",
  "syncCredential",
  "syncCredentials",
  "bearer",
]);

const CATEGORY_DEFINITIONS = [
  {
    categoryId: "legacy-profiles",
    displayName: "Legacy Profiles",
    futureOwnerApp: FUTURE_OWNER_APPS.HUB,
    storageLocation: STORAGE_PROFILE,
    access: { page: "profile" },
    bundleTargets: ["hub", "backup"],
  },
  {
    categoryId: "legacy-local-protected-profiles",
    displayName: "Legacy Local Protected Profiles",
    futureOwnerApp: FUTURE_OWNER_APPS.HUB,
    storageLocation: STORAGE_PROFILE,
    access: { page: "profile" },
    bundleTargets: ["backup"],
  },
  {
    categoryId: "legacy-decks",
    displayName: "Legacy Decks",
    futureOwnerApp: FUTURE_OWNER_APPS.DECK_NEXUS,
    storageLocation: STORAGE_PROFILE,
    access: { page: "decks" },
    bundleTargets: ["deck-nexus"],
  },
  {
    categoryId: "legacy-collection-records",
    displayName: "Legacy Collection Records",
    futureOwnerApp: FUTURE_OWNER_APPS.DECK_NEXUS,
    storageLocation: STORAGE_PROFILE,
    access: { page: "archive" },
    bundleTargets: ["deck-nexus"],
  },
  {
    categoryId: "legacy-card-tags-favorites",
    displayName: "Legacy Card Tags / Favorites",
    futureOwnerApp: FUTURE_OWNER_APPS.DECK_NEXUS,
    storageLocation: STORAGE_PROFILE,
    access: { page: "archive" },
    bundleTargets: ["deck-nexus"],
  },
  {
    categoryId: "legacy-scanner-card-import-data",
    displayName: "Legacy Scanner / Card Import Data",
    futureOwnerApp: FUTURE_OWNER_APPS.DECK_NEXUS,
    storageLocation: STORAGE_PROFILE,
    access: { page: "archive" },
    bundleTargets: ["deck-nexus"],
  },
  {
    categoryId: "legacy-physical-game-records",
    displayName: "Legacy Physical Game Records",
    futureOwnerApp: FUTURE_OWNER_APPS.BOARDSTATE_LITE,
    storageLocation: STORAGE_RUNTIME,
    access: { page: "battlefield" },
    bundleTargets: ["boardstate-lite"],
  },
  {
    categoryId: "legacy-life-tracker-records",
    displayName: "Legacy Life-Tracker Records",
    futureOwnerApp: FUTURE_OWNER_APPS.BOARDSTATE_LITE,
    storageLocation: STORAGE_RUNTIME,
    access: { page: "battlefield" },
    bundleTargets: ["boardstate-lite"],
  },
  {
    categoryId: "legacy-commander-damage-records",
    displayName: "Legacy Commander Damage Records",
    futureOwnerApp: FUTURE_OWNER_APPS.BOARDSTATE_LITE,
    storageLocation: STORAGE_RUNTIME,
    access: { page: "battlefield" },
    bundleTargets: ["boardstate-lite"],
  },
  {
    categoryId: "legacy-player-counter-records",
    displayName: "Legacy Player Counter Records",
    futureOwnerApp: FUTURE_OWNER_APPS.BOARDSTATE_LITE,
    storageLocation: STORAGE_RUNTIME,
    access: { page: "battlefield" },
    bundleTargets: ["boardstate-lite"],
  },
  {
    categoryId: "legacy-compact-battlefield-records",
    displayName: "Legacy Compact Battlefield Records",
    futureOwnerApp: FUTURE_OWNER_APPS.BOARDSTATE_LITE,
    storageLocation: STORAGE_RUNTIME,
    access: { page: "battlefield" },
    bundleTargets: ["boardstate-lite"],
  },
  {
    categoryId: "legacy-dry-run-saves",
    displayName: "Legacy Dry Run Saves",
    futureOwnerApp: FUTURE_OWNER_APPS.BOARDSTATE,
    storageLocation: STORAGE_SAVE,
    access: { optionsCategory: "saves" },
    bundleTargets: ["boardstate"],
  },
  {
    categoryId: "legacy-advanced-game-saves",
    displayName: "Legacy Advanced Game Saves",
    futureOwnerApp: FUTURE_OWNER_APPS.BOARDSTATE,
    storageLocation: STORAGE_SAVE,
    access: { optionsCategory: "saves" },
    bundleTargets: ["boardstate"],
  },
  {
    categoryId: "legacy-tutorial-saves",
    displayName: "Legacy Tutorial Saves",
    futureOwnerApp: FUTURE_OWNER_APPS.BOARDSTATE,
    storageLocation: STORAGE_SAVE,
    access: { optionsCategory: "saves" },
    bundleTargets: ["boardstate"],
  },
  {
    categoryId: "legacy-recovery-saves",
    displayName: "Legacy Recovery Saves",
    futureOwnerApp: FUTURE_OWNER_APPS.BOARDSTATE,
    storageLocation: STORAGE_SAVE,
    access: { optionsCategory: "saves" },
    bundleTargets: ["boardstate"],
  },
  {
    categoryId: "legacy-tournaments",
    displayName: "Legacy Tournaments",
    futureOwnerApp: FUTURE_OWNER_APPS.HUB,
    storageLocation: STORAGE_PROFILE,
    access: { page: "tournament" },
    bundleTargets: ["hub"],
  },
  {
    categoryId: "legacy-tournament-participants",
    displayName: "Legacy Tournament Participants",
    futureOwnerApp: FUTURE_OWNER_APPS.HUB,
    storageLocation: STORAGE_PROFILE,
    access: { page: "tournament" },
    bundleTargets: ["hub"],
  },
  {
    categoryId: "legacy-friends",
    displayName: "Legacy Friends",
    futureOwnerApp: FUTURE_OWNER_APPS.HUB,
    storageLocation: STORAGE_PROFILE,
    access: { optionsCategory: "friends" },
    bundleTargets: ["hub"],
  },
  {
    categoryId: "legacy-friend-codes",
    displayName: "Legacy Friend Codes",
    futureOwnerApp: FUTURE_OWNER_APPS.HUB,
    storageLocation: STORAGE_PROFILE,
    access: { optionsCategory: "friends" },
    bundleTargets: ["hub"],
  },
  {
    categoryId: "legacy-notification-preferences",
    displayName: "Legacy Notification Preferences",
    futureOwnerApp: FUTURE_OWNER_APPS.HUB,
    storageLocation: STORAGE_SETTINGS,
    access: { optionsCategory: "notifications" },
    bundleTargets: ["hub"],
  },
  {
    categoryId: "legacy-sync-rooms",
    displayName: "Legacy Sync Rooms",
    futureOwnerApp: FUTURE_OWNER_APPS.HUB,
    storageLocation: STORAGE_SETTINGS,
    access: { optionsCategory: "gameplay" },
    bundleTargets: ["hub"],
  },
  {
    categoryId: "legacy-multiplayer-sessions",
    displayName: "Legacy Multiplayer Sessions",
    futureOwnerApp: FUTURE_OWNER_APPS.BOARDSTATE_LITE,
    storageLocation: STORAGE_RUNTIME,
    access: { optionsCategory: "gameplay" },
    bundleTargets: ["boardstate-lite", "hub"],
  },
  {
    categoryId: "legacy-app-settings",
    displayName: "Legacy App Settings",
    futureOwnerApp: FUTURE_OWNER_APPS.HUB,
    storageLocation: STORAGE_SETTINGS,
    access: { optionsCategory: "display" },
    bundleTargets: ["hub", "boardstate"],
  },
  {
    categoryId: "legacy-accessibility-settings",
    displayName: "Legacy Accessibility Settings",
    futureOwnerApp: FUTURE_OWNER_APPS.HUB,
    storageLocation: STORAGE_SETTINGS,
    access: { optionsCategory: "accessibility" },
    bundleTargets: ["hub", "boardstate"],
  },
  {
    categoryId: "legacy-diagnostics-logs",
    displayName: "Legacy Diagnostics / Logs",
    futureOwnerApp: FUTURE_OWNER_APPS.BOARDSTATE,
    storageLocation: STORAGE_RUNTIME,
    access: { optionsCategory: "diagnostics" },
    bundleTargets: ["boardstate"],
  },
  {
    categoryId: "unknown-legacy-keys-data-blocks",
    displayName: "Unknown Legacy Keys / Data Blocks",
    futureOwnerApp: FUTURE_OWNER_APPS.UNKNOWN,
    storageLocation: STORAGE_UNKNOWN,
    access: { optionsCategory: "legacy" },
    bundleTargets: ["backup"],
  },
];

const KNOWN_PROFILE_KEYS = new Set([
  "id",
  "version",
  "player",
  "settings",
  "onboarding",
  "localAuth",
  "activeSession",
  "commanders",
  "archives",
  "leaderboards",
  "achievements",
  "statsSync",
  "notifications",
  "localSaves",
  "linkedSessions",
  "importedData",
  "legacyMigration",
  "simulationMemory",
  "simulationStats",
  "tournament",
  "friends",
]);

export function createLegacyMigrationState(source = {}) {
  return {
    version: LEGACY_MIGRATION_VERSION,
    lastInventoryAt: Number(source.lastInventoryAt || 0),
    lastBackupAt: Number(source.lastBackupAt || 0),
    lastExportAt: Number(source.lastExportAt || 0),
    lastRecoveryAt: Number(source.lastRecoveryAt || 0),
    archiveRecords: Array.isArray(source.archiveRecords) ? source.archiveRecords.map(normalizeArchiveRecord).filter(Boolean).slice(0, 120) : [],
    backups: Array.isArray(source.backups) ? source.backups.map(normalizeBackupRecord).filter(Boolean).slice(0, 40) : [],
    exports: Array.isArray(source.exports) ? source.exports.map(normalizeExportRecord).filter(Boolean).slice(0, 80) : [],
    history: Array.isArray(source.history) ? source.history.map(normalizeMigrationHistoryEntry).filter(Boolean).slice(0, 120) : [],
    recoveryReports: Array.isArray(source.recoveryReports) ? source.recoveryReports.map(normalizeRecoveryRecord).filter(Boolean).slice(0, 30) : [],
    lastError: String(source.lastError || ""),
  };
}

export function buildLegacyDataInventory(profile = {}, options = {}) {
  const now = Number(options.scannedAt || Date.now());
  const safeProfile = profile && typeof profile === "object" ? profile : {};
  const saveGroups = groupLocalSaves(safeProfile.localSaves?.items || []);
  const categoryCounts = buildCategoryCounts(safeProfile, saveGroups);
  const categories = CATEGORY_DEFINITIONS.map((definition) => buildInventoryCategory(safeProfile, definition, categoryCounts[definition.categoryId] || {}, now));
  const archiveRecords = createLegacyArchiveRecords(categories, safeProfile.legacyMigration?.archiveRecords || [], now);
  const overview = buildMigrationOverview(categories, safeProfile.legacyMigration || {}, now);
  return {
    version: LEGACY_MIGRATION_VERSION,
    scannedAt: now,
    categories,
    overview,
    archiveRecords,
    saveValidation: validateLegacySaves(safeProfile),
  };
}

export function buildMigrationOverview(categories = [], migrationState = {}, scannedAt = Date.now()) {
  const detectedCategories = categories.filter((category) => category.detected);
  const readyForExport = detectedCategories.filter((category) => category.migrationReadiness === MIGRATION_READINESS.READY || category.migrationReadiness === MIGRATION_READINESS.READY_WITH_WARNINGS);
  const waitingForDestination = detectedCategories.filter((category) => category.migrationReadiness === MIGRATION_READINESS.NEEDS_DESTINATION);
  const boardStateOwned = detectedCategories.filter((category) => category.migrationReadiness === MIGRATION_READINESS.BOARDSTATE_OWNED);
  const protectedOrUnknown = detectedCategories.filter((category) => category.migrationReadiness === MIGRATION_READINESS.PROTECTED || category.migrationReadiness === MIGRATION_READINESS.UNKNOWN || category.migrationReadiness === MIGRATION_READINESS.NEEDS_REVIEW);
  return {
    totalCategoriesDetected: detectedCategories.length,
    totalItems: categories.reduce((sum, category) => sum + Number(category.itemCount || 0), 0),
    readyForExportCount: readyForExport.length,
    waitingForDestinationCount: waitingForDestination.length,
    boardStateOwnedCount: boardStateOwned.length,
    protectedOrUnknownCount: protectedOrUnknown.length,
    lastInventoryScan: Number(migrationState.lastInventoryAt || scannedAt || 0),
    latestBackupAt: Number(migrationState.lastBackupAt || 0),
    latestExportAt: Number(migrationState.lastExportAt || 0),
  };
}

export function createFullLegacyBackupBundle(profile = {}, options = {}) {
  const now = Number(options.createdAt || Date.now());
  const inventory = buildLegacyDataInventory(profile, { scannedAt: now });
  const sanitizedProfile = sanitizeForMigrationExport(profile);
  const bundle = {
    app: "BoardState",
    bundleType: LEGACY_BACKUP_BUNDLE_TYPE,
    backupId: createContractId("saveId", `legacy-backup-${now}`),
    migrationVersion: LEGACY_MIGRATION_VERSION,
    schemaVersion: SHARED_CONTRACT_SCHEMA_VERSION,
    saveFormatVersion: SHARED_SAVE_FORMAT_VERSION,
    syncProtocolVersion: SHARED_SYNC_PROTOCOL_VERSION,
    rulesEngineVersion: profile.activeSession?.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
    sourceApp: "boardstate",
    createdAt: new Date(now).toISOString(),
    profileId: profile.player?.id || profile.id || "local-player",
    profileName: profile.player?.name || "Player",
    data: {
      profile: sanitizedProfile,
      boardStateOwned: buildBoardStateOwnedPayload(profile),
      legacyDataBlocks: buildLegacyPayloadBlocks(profile),
      importedSnapshots: sanitizeForMigrationExport(profile.importedData || {}),
      settings: sanitizeForMigrationExport(profile.settings || {}),
      migrationMetadata: sanitizeForMigrationExport(profile.legacyMigration || {}),
      inventory,
    },
    warnings: [
      "This backup is non-destructive and does not mark data as migrated.",
      "Restoring from backup must be confirmed and validated before replacing current data.",
      ...collectBackupWarnings(profile, inventory.categories),
    ],
    privacyExclusions: collectPrivacyExclusions(profile),
    validationHash: "",
  };
  bundle.validationHash = buildStableChecksum(bundle);
  const validation = validateLegacyBackupBundle(bundle);
  return { valid: validation.valid, bundle, text: JSON.stringify(bundle, null, 2), validation };
}

export function validateLegacyBackupBundle(bundle = {}) {
  const errors = [];
  const warnings = [];
  if (!bundle || typeof bundle !== "object") errors.push("backup bundle must be an object");
  if (bundle.bundleType !== LEGACY_BACKUP_BUNDLE_TYPE) errors.push("backup bundle type is invalid");
  if (!bundle.schemaVersion) errors.push("schema version missing");
  if (!bundle.saveFormatVersion) errors.push("save format version missing");
  if (!bundle.sourceApp) errors.push("source app missing");
  if (!bundle.createdAt) errors.push("createdAt missing");
  if (!bundle.data?.profile) errors.push("profile snapshot missing");
  const privacy = validateNoUnsafeMigrationData(bundle);
  errors.push(...privacy.errors);
  if (!bundle.validationHash) warnings.push("validation hash missing");
  if (!Array.isArray(bundle.privacyExclusions)) warnings.push("privacy exclusion list missing");
  return createMigrationValidationResult(errors.length ? "invalid" : "valid", errors, warnings);
}

export function createDestinationExportBundle(profile = {}, destination = "boardstate", options = {}) {
  const normalized = normalizeDestination(destination);
  const now = Number(options.createdAt || Date.now());
  const inventory = buildLegacyDataInventory(profile, { scannedAt: now });
  const destinationPayloads = {
    "deck-nexus": buildDeckNexusExportPayload(profile, inventory),
    "boardstate-lite": buildBoardStateLiteExportPayload(profile, inventory),
    boardstate: buildBoardStateArchivePayload(profile, inventory),
    hub: buildHubReadyExportPayload(profile, inventory),
  };
  const payload = destinationPayloads[normalized] || buildBoardStateArchivePayload(profile, inventory);
  const bundle = {
    app: "BoardState",
    bundleType: LEGACY_EXPORT_BUNDLE_TYPE,
    exportId: createContractId("saveId", `legacy-export-${normalized}-${now}`),
    exportLabel: payload.exportLabel,
    migrationVersion: LEGACY_MIGRATION_VERSION,
    schemaVersion: SHARED_CONTRACT_SCHEMA_VERSION,
    saveFormatVersion: SHARED_SAVE_FORMAT_VERSION,
    syncProtocolVersion: SHARED_SYNC_PROTOCOL_VERSION,
    rulesEngineVersion: profile.activeSession?.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
    sourceApp: "boardstate",
    targetApp: payload.targetApp,
    destination,
    destinationStatus: payload.destinationStatus,
    createdAt: new Date(now).toISOString(),
    itemCounts: payload.itemCounts,
    payload: payload.data,
    warnings: payload.warnings,
    privacyExclusions: collectPrivacyExclusions(profile),
    compatibility: payload.compatibility,
    validationHash: "",
  };
  bundle.validationHash = buildStableChecksum(bundle);
  const validation = validateMigrationExportBundle(bundle);
  return { valid: validation.valid, bundle, text: JSON.stringify(bundle, null, 2), validation };
}

export function validateMigrationExportBundle(bundle = {}) {
  const errors = [];
  const warnings = [];
  if (!bundle || typeof bundle !== "object") errors.push("export bundle must be an object");
  if (bundle.bundleType !== LEGACY_EXPORT_BUNDLE_TYPE) errors.push("export bundle type is invalid");
  if (!bundle.schemaVersion) errors.push("schema version missing");
  if (!bundle.sourceApp) errors.push("source app missing");
  if (!bundle.targetApp) errors.push("destination app target missing");
  if (!bundle.saveFormatVersion) errors.push("format version missing");
  if (!bundle.itemCounts || typeof bundle.itemCounts !== "object") errors.push("item counts missing");
  if (!bundle.compatibility || typeof bundle.compatibility !== "object") errors.push("destination compatibility metadata missing");
  if (!Array.isArray(bundle.warnings)) warnings.push("warnings list missing");
  if (!bundle.validationHash) warnings.push("validation hash missing");
  const privacy = validateNoUnsafeMigrationData(bundle);
  errors.push(...privacy.errors);
  const declaredTotal = Object.values(bundle.itemCounts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  if (!Number.isFinite(declaredTotal)) errors.push("item counts are malformed");
  if (bundle.targetApp === FUTURE_OWNER_APPS.HUB && /migrated|synced|linked/i.test(`${bundle.destinationStatus || ""}`)) {
    errors.push("hub export must not claim migration, sync, or live linking");
  }
  return createMigrationValidationResult(errors.length ? "invalid" : "valid", errors, warnings);
}

export function buildLegacyDataBrowserModel(profile = {}) {
  const inventory = buildLegacyDataInventory(profile);
  return {
    generatedAt: Date.now(),
    filters: [
      "All",
      "Deck Nexus",
      "BoardState Lite",
      "BoardState-Owned",
      "Future Hub",
      "Protected",
      "Needs Review",
      "Unknown",
    ],
    categories: inventory.categories.map((category) => ({
      categoryId: category.categoryId,
      displayName: category.displayName,
      sourceSystem: "Original BoardState",
      futureDestination: formatOwnerApp(category.futureOwnerApp),
      exportStatus: category.exportAvailable ? "Export prepared on demand" : "Backup only",
      itemCount: category.itemCount,
      lastUpdated: category.lastUpdated,
      searchText: `${category.displayName} ${formatOwnerApp(category.futureOwnerApp)} ${category.migrationReadiness}`.toLowerCase(),
      protected: category.migrationReadiness === MIGRATION_READINESS.PROTECTED,
      safeMetadataOnly: category.privacyWarnings.length > 0,
      openPage: category.page || "",
      optionsCategory: category.optionsCategory || "",
      warnings: [...category.compatibilityWarnings, ...category.privacyWarnings],
      sampleItems: buildSafeCategorySamples(profile, category).slice(0, 5),
    })),
  };
}

export function buildRecoveryReport(profile = {}, options = {}) {
  const now = Number(options.createdAt || Date.now());
  const inventory = buildLegacyDataInventory(profile, { scannedAt: now });
  const saveValidation = validateLegacySaves(profile);
  const importedValidation = validateImportedData(profile);
  const archiveValidation = validateLegacyArchives(profile);
  const sharedSessionValidation = validateSharedSessionReferences(profile);
  const errors = [
    ...saveValidation.invalidSaves.map((entry) => `save:${entry.saveId}:${entry.reason}`),
    ...importedValidation.invalidImports.map((entry) => `import:${entry.id}:${entry.reason}`),
    ...archiveValidation.errors,
    ...sharedSessionValidation.errors,
  ];
  const report = {
    reportId: createContractId("eventId", `legacy-recovery-${now}`),
    reportType: "BoardState Legacy Recovery Report",
    migrationVersion: LEGACY_MIGRATION_VERSION,
    appVersion: options.appVersion || "",
    schemaVersion: SHARED_CONTRACT_SCHEMA_VERSION,
    saveFormatVersion: SHARED_SAVE_FORMAT_VERSION,
    syncProtocolVersion: SHARED_SYNC_PROTOCOL_VERSION,
    rulesEngineVersion: profile.activeSession?.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
    createdAt: new Date(now).toISOString(),
    storageCategories: inventory.categories.map((category) => ({
      categoryId: category.categoryId,
      detected: category.detected,
      itemCount: category.itemCount,
      readiness: category.migrationReadiness,
    })),
    errorSummaries: errors,
    missingReferences: [
      ...importedValidation.missingReferences,
      ...sharedSessionValidation.missingReferences,
    ],
    invalidSavesCount: saveValidation.invalidSaves.length,
    invalidImportsCount: importedValidation.invalidImports.length,
    migrationStatus: summarizeMigrationStatus(profile.legacyMigration || {}, inventory.categories),
    recoveryActions: [
      "Create Emergency Backup before repair.",
      "Repair operations should create duplicate saves and keep originals.",
      "Quarantine candidates require user confirmation and are not deleted.",
    ],
    privacy: {
      excludesPlaintextPasswords: true,
      excludesPrivateTokens: true,
      excludesUnsafeSyncCredentials: true,
    },
    quarantineCandidates: [
      ...saveValidation.invalidSaves.map((entry) => ({ type: "save", id: entry.saveId, status: "quarantine candidate" })),
      ...importedValidation.invalidImports.map((entry) => ({ type: "import", id: entry.id, status: "quarantine candidate" })),
    ],
  };
  const validation = validateNoUnsafeMigrationData(report);
  return { valid: validation.valid, report, text: JSON.stringify(report, null, 2), validation };
}

export function extractProfileFromLegacyBackup(input = {}) {
  let parsed = input;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch {
      return { valid: false, errors: ["backup JSON is malformed"], profile: null };
    }
  }
  const validation = validateLegacyBackupBundle(parsed);
  if (!validation.valid) return { valid: false, errors: validation.errors, profile: null };
  if (!parsed.data?.profile) return { valid: false, errors: ["backup does not contain a restorable profile snapshot"], profile: null };
  return {
    valid: true,
    errors: [],
    warnings: [
      "Restore requires confirmation and does not restore excluded passwords or unsafe credentials.",
      ...(parsed.warnings || []),
    ],
    profile: parsed.data.profile,
  };
}

export function rebuildMigrationIndex(profile = {}) {
  const now = Date.now();
  const inventory = buildLegacyDataInventory(profile, { scannedAt: now });
  const previous = createLegacyMigrationState(profile.legacyMigration || {});
  const entry = createMigrationHistoryEntry({
    eventType: "inventory scan",
    timestamp: now,
    result: "success",
    warnings: inventory.categories.flatMap((category) => category.compatibilityWarnings || []).slice(0, 20),
  });
  return {
    ...profile,
    legacyMigration: {
      ...previous,
      lastInventoryAt: now,
      archiveRecords: inventory.archiveRecords,
      history: [entry, ...previous.history].slice(0, 120),
      lastError: "",
    },
  };
}

export function recordMigrationBackupCreated(profile = {}, backupResult = {}) {
  const now = Date.now();
  const previous = createLegacyMigrationState(profile.legacyMigration || {});
  const bundle = backupResult.bundle || {};
  const validation = backupResult.validation || validateLegacyBackupBundle(bundle);
  const record = normalizeBackupRecord({
    backupId: bundle.backupId || createContractId("saveId", `legacy-backup-${now}`),
    createdAt: now,
    bundleType: bundle.bundleType || LEGACY_BACKUP_BUNDLE_TYPE,
    itemCount: bundle.data?.inventory?.overview?.totalItems || 0,
    validationStatus: validation.status || "valid",
    warnings: [...(bundle.warnings || []), ...(validation.warnings || [])],
    validationHash: bundle.validationHash || "",
  });
  const entry = createMigrationHistoryEntry({
    eventType: validation.valid ? "full backup created" : "export validation failed",
    timestamp: now,
    result: validation.valid ? "success" : "failed",
    warnings: record.warnings,
    relatedBackupId: record.backupId,
    errorSummary: validation.errors?.[0] || "",
  });
  return {
    ...profile,
    legacyMigration: {
      ...previous,
      lastBackupAt: validation.valid ? now : previous.lastBackupAt,
      backups: [record, ...previous.backups.filter((entryRecord) => entryRecord.backupId !== record.backupId)].slice(0, 40),
      history: [entry, ...previous.history].slice(0, 120),
      lastError: validation.valid ? "" : validation.errors?.[0] || "Backup validation failed.",
    },
  };
}

export function recordMigrationExportCreated(profile = {}, exportResult = {}) {
  const now = Date.now();
  const previous = createLegacyMigrationState(profile.legacyMigration || {});
  const bundle = exportResult.bundle || {};
  const validation = exportResult.validation || validateMigrationExportBundle(bundle);
  const record = normalizeExportRecord({
    exportId: bundle.exportId || createContractId("saveId", `legacy-export-${now}`),
    destinationApp: bundle.targetApp || FUTURE_OWNER_APPS.UNKNOWN,
    exportLabel: bundle.exportLabel || "",
    createdAt: now,
    bundleType: bundle.bundleType || LEGACY_EXPORT_BUNDLE_TYPE,
    itemCounts: bundle.itemCounts || {},
    validationStatus: validation.status || "valid",
    warnings: [...(bundle.warnings || []), ...(validation.warnings || [])],
    validationHash: bundle.validationHash || "",
    migrationStatus: validation.valid ? MIGRATION_STATUS.EXPORT_PREPARED : MIGRATION_STATUS.FAILED,
  });
  const entry = createMigrationHistoryEntry({
    eventType: validation.valid ? "export bundle created" : "export validation failed",
    timestamp: now,
    result: validation.valid ? "success" : "failed",
    warnings: record.warnings,
    relatedExportId: record.exportId,
    errorSummary: validation.errors?.[0] || "",
  });
  const nextArchives = updateArchiveRecordsWithExport(previous.archiveRecords, bundle.targetApp, record.exportId);
  return {
    ...profile,
    legacyMigration: {
      ...previous,
      lastExportAt: validation.valid ? now : previous.lastExportAt,
      archiveRecords: nextArchives,
      exports: [record, ...previous.exports.filter((entryRecord) => entryRecord.exportId !== record.exportId)].slice(0, 80),
      history: [entry, ...previous.history].slice(0, 120),
      lastError: validation.valid ? "" : validation.errors?.[0] || "Export validation failed.",
    },
  };
}

export function recordMigrationRecoveryReport(profile = {}, recoveryResult = {}) {
  const now = Date.now();
  const previous = createLegacyMigrationState(profile.legacyMigration || {});
  const report = recoveryResult.report || {};
  const record = normalizeRecoveryRecord({
    reportId: report.reportId || createContractId("eventId", `legacy-recovery-${now}`),
    createdAt: now,
    invalidSavesCount: report.invalidSavesCount || 0,
    invalidImportsCount: report.invalidImportsCount || 0,
    errorCount: (report.errorSummaries || []).length,
    validationStatus: recoveryResult.valid === false ? "invalid" : "valid",
  });
  const entry = createMigrationHistoryEntry({
    eventType: "recovery report exported",
    timestamp: now,
    result: recoveryResult.valid === false ? "failed" : "success",
    warnings: report.errorSummaries || [],
    errorSummary: recoveryResult.validation?.errors?.[0] || "",
  });
  return {
    ...profile,
    legacyMigration: {
      ...previous,
      lastRecoveryAt: now,
      recoveryReports: [record, ...previous.recoveryReports.filter((entryRecord) => entryRecord.reportId !== record.reportId)].slice(0, 30),
      history: [entry, ...previous.history].slice(0, 120),
      lastError: recoveryResult.valid === false ? recoveryResult.validation?.errors?.[0] || "Recovery validation failed." : "",
    },
  };
}

function buildCategoryCounts(profile = {}, saveGroups = {}) {
  const session = profile.activeSession || {};
  const tournament = profile.tournament || {};
  const friends = profile.friends || {};
  const settings = profile.settings || {};
  const commanderDecks = profile.commanders || {};
  const archives = profile.archives || [];
  const importedData = createImportedDataState(profile.importedData || {});
  const unknownKeys = Object.keys(profile || {}).filter((key) => !KNOWN_PROFILE_KEYS.has(key));
  const playerCounters = session.playerCounters || {};
  const commanderDamage = session.commander?.damageByOpponent || {};
  const physicalSessionDetected = Boolean(session.gameTracking?.active || session.life || session.turn || session.battlefield);
  const countObjectEntries = (value) => value && typeof value === "object" ? Object.keys(value).length : 0;
  return {
    "legacy-profiles": {
      itemCount: profile.player || profile.id ? 1 : 0,
      lastUpdated: profile.updatedAt || profile.activeSession?.updatedAt || 0,
      estimatedSize: estimateSize({ player: profile.player, localAuth: profile.localAuth }),
    },
    "legacy-local-protected-profiles": {
      itemCount: profile.localAuth?.hasPassword || profile.localAuth?.mode === "protected" ? 1 : 0,
      lastUpdated: profile.localAuth?.updatedAt || 0,
      estimatedSize: estimateSize({ localAuth: profile.localAuth }),
      privacyWarnings: profile.localAuth?.hasPassword ? ["Protected data present. Password text and credential material are excluded from exports."] : [],
    },
    "legacy-decks": {
      itemCount: Object.keys(commanderDecks).length,
      lastUpdated: maxUpdated(commanderDecks),
      estimatedSize: estimateSize(commanderDecks),
    },
    "legacy-collection-records": {
      itemCount: Array.isArray(archives) ? archives.length : 0,
      lastUpdated: maxUpdated(archives),
      estimatedSize: estimateSize(archives),
    },
    "legacy-card-tags-favorites": {
      itemCount: countCardTags(profile),
      lastUpdated: maxUpdated([profile.cardTags, profile.favorites, settings.cardTags, settings.favorites]),
      estimatedSize: estimateSize({ cardTags: profile.cardTags, favorites: profile.favorites, settingsCardTags: settings.cardTags, settingsFavorites: settings.favorites }),
    },
    "legacy-scanner-card-import-data": {
      itemCount: countObjectEntries(profile.scannerData || profile.cardImports || settings.scanner || settings.cardImports),
      lastUpdated: maxUpdated([profile.scannerData, profile.cardImports, settings.scanner, settings.cardImports]),
      estimatedSize: estimateSize({ scannerData: profile.scannerData, cardImports: profile.cardImports, scanner: settings.scanner }),
    },
    "legacy-physical-game-records": {
      itemCount: physicalSessionDetected ? 1 : 0,
      lastUpdated: session.updatedAt || 0,
      estimatedSize: estimateSize({ life: session.life, turn: session.turn, phaseIndex: session.phaseIndex, gameTracking: session.gameTracking }),
    },
    "legacy-life-tracker-records": {
      itemCount: session.life !== undefined ? 1 : 0,
      lastUpdated: session.updatedAt || 0,
      estimatedSize: estimateSize({ life: session.life, history: session.history }),
    },
    "legacy-commander-damage-records": {
      itemCount: countObjectEntries(commanderDamage),
      lastUpdated: session.updatedAt || 0,
      estimatedSize: estimateSize(commanderDamage),
    },
    "legacy-player-counter-records": {
      itemCount: countObjectEntries(playerCounters),
      lastUpdated: session.updatedAt || 0,
      estimatedSize: estimateSize(playerCounters),
    },
    "legacy-compact-battlefield-records": {
      itemCount: countBattlefieldPermanents(session),
      lastUpdated: session.updatedAt || 0,
      estimatedSize: estimateSize(session.battlefield || {}),
    },
    "legacy-dry-run-saves": saveGroupCount(saveGroups.dryRun),
    "legacy-advanced-game-saves": saveGroupCount(saveGroups.advanced),
    "legacy-tutorial-saves": saveGroupCount(saveGroups.tutorial),
    "legacy-recovery-saves": saveGroupCount(saveGroups.recovery),
    "legacy-tournaments": {
      itemCount: tournament.active || tournament.status !== "idle" || (tournament.rounds || []).length ? 1 : 0,
      lastUpdated: tournament.updatedAt || maxUpdated(tournament.historyLog || []),
      estimatedSize: estimateSize(tournament),
    },
    "legacy-tournament-participants": {
      itemCount: (tournament.players || []).length,
      lastUpdated: tournament.updatedAt || maxUpdated(tournament.players || []),
      estimatedSize: estimateSize(tournament.players || []),
    },
    "legacy-friends": {
      itemCount: (friends.friends || []).length,
      lastUpdated: maxUpdated(friends.friends || []),
      estimatedSize: estimateSize(friends.friends || []),
    },
    "legacy-friend-codes": {
      itemCount: friends.myFriendCode || friends.friendCode ? 1 : 0,
      lastUpdated: friends.updatedAt || 0,
      estimatedSize: estimateSize({ myFriendCode: friends.myFriendCode, friendCode: friends.friendCode }),
      privacyWarnings: friends.myFriendCode || friends.friendCode ? ["Friend code is exported as user-visible identity metadata only."] : [],
    },
    "legacy-notification-preferences": {
      itemCount: settings.notifications ? 1 : 0,
      lastUpdated: settings.notifications?.updatedAt || 0,
      estimatedSize: estimateSize(settings.notifications || {}),
    },
    "legacy-sync-rooms": {
      itemCount: settings.multiplayer?.roomId || settings.multiplayer?.mode !== "offline" ? 1 : 0,
      lastUpdated: settings.multiplayer?.updatedAt || 0,
      estimatedSize: estimateSize(settings.multiplayer || {}),
      privacyWarnings: settings.multiplayer?.wsUrl ? ["Sync server URL is retained as metadata; credentials are excluded if present."] : [],
    },
    "legacy-multiplayer-sessions": {
      itemCount: session.syncedMultiplayer?.connectedPlayers?.length || settings.multiplayer?.connectedPlayers?.length || 0,
      lastUpdated: session.updatedAt || 0,
      estimatedSize: estimateSize({ syncedMultiplayer: session.syncedMultiplayer, connectedPlayers: settings.multiplayer?.connectedPlayers }),
    },
    "legacy-app-settings": {
      itemCount: Object.keys(settings || {}).length ? 1 : 0,
      lastUpdated: settings.updatedAt || 0,
      estimatedSize: estimateSize(settings),
    },
    "legacy-accessibility-settings": {
      itemCount: settings.adhdMode || settings.helperSprite || settings.haptics !== undefined ? 1 : 0,
      lastUpdated: maxUpdated([settings.adhdMode, settings.helperSprite]),
      estimatedSize: estimateSize({ adhdMode: settings.adhdMode, helperSprite: settings.helperSprite, haptics: settings.haptics, sound: settings.notifications?.sound }),
    },
    "legacy-diagnostics-logs": {
      itemCount: (session.recoveryLog || []).length + (session.rulesConfidenceLog || []).length + (session.effectLog || []).length + (session.eventHistory || []).length,
      lastUpdated: maxUpdated([...(session.recoveryLog || []), ...(session.effectLog || []), ...(session.eventHistory || [])]),
      estimatedSize: estimateSize({ recoveryLog: session.recoveryLog, rulesConfidenceLog: session.rulesConfidenceLog, effectLog: session.effectLog, eventHistory: session.eventHistory }),
    },
    "unknown-legacy-keys-data-blocks": {
      itemCount: unknownKeys.length,
      lastUpdated: 0,
      estimatedSize: estimateSize(Object.fromEntries(unknownKeys.map((key) => [key, profile[key]]))),
      compatibilityWarnings: unknownKeys.length ? [`Unknown profile sections detected: ${unknownKeys.join(", ")}`] : [],
      sampleItems: unknownKeys,
    },
    "imported-snapshots": {
      itemCount: importedData.deckSnapshots.length + importedData.liteSessions.length + importedData.sharedSessions.length,
      lastUpdated: importedData.lastImportAt || maxUpdated([...importedData.deckSnapshots, ...importedData.liteSessions]),
      estimatedSize: estimateSize(importedData),
    },
  };
}

function buildInventoryCategory(profile = {}, definition = {}, counts = {}, now = Date.now()) {
  const itemCount = Math.max(0, Number(counts.itemCount || 0));
  const detected = itemCount > 0;
  const readiness = classifyMigrationReadiness(definition, itemCount, counts, profile);
  const warnings = [
    ...(counts.compatibilityWarnings || []),
    ...defaultCompatibilityWarnings(definition, itemCount),
  ];
  const privacyWarnings = [
    ...(counts.privacyWarnings || []),
    ...defaultPrivacyWarnings(definition, itemCount),
  ];
  return {
    categoryId: definition.categoryId,
    id: definition.categoryId,
    displayName: definition.displayName,
    label: definition.displayName,
    detected,
    itemCount,
    count: itemCount,
    estimatedSize: Number(counts.estimatedSize || 0),
    lastUpdated: Number(counts.lastUpdated || 0),
    storageLocation: definition.storageLocation,
    futureOwnerApp: definition.futureOwnerApp,
    destination: formatOwnerApp(definition.futureOwnerApp),
    migrationReadiness: readiness,
    status: readiness,
    exportAvailable: detected && isExportAvailable(definition, readiness),
    backupAvailable: true,
    destructiveActionsAllowed: false,
    compatibilityWarnings: warnings,
    privacyWarnings,
    page: definition.access?.page || "",
    optionsCategory: definition.access?.optionsCategory || "",
    preservedLegacyAccessPath: buildLegacyAccessPath(definition.access),
    intendedAction: getIntendedAction(definition, readiness),
    bundleTargets: [...(definition.bundleTargets || [])],
    scannedAt: now,
  };
}

function classifyMigrationReadiness(definition = {}, itemCount = 0, counts = {}) {
  if (!itemCount) {
    return definition.futureOwnerApp === FUTURE_OWNER_APPS.BOARDSTATE ? MIGRATION_READINESS.BOARDSTATE_OWNED : MIGRATION_READINESS.NEEDS_DESTINATION;
  }
  if (definition.categoryId === "legacy-local-protected-profiles") return MIGRATION_READINESS.PROTECTED;
  if (definition.categoryId === "unknown-legacy-keys-data-blocks") return MIGRATION_READINESS.UNKNOWN;
  if (counts.error) return MIGRATION_READINESS.ERROR;
  if (definition.futureOwnerApp === FUTURE_OWNER_APPS.BOARDSTATE) return MIGRATION_READINESS.BOARDSTATE_OWNED;
  if (definition.futureOwnerApp === FUTURE_OWNER_APPS.HUB) return MIGRATION_READINESS.NEEDS_DESTINATION;
  if (definition.futureOwnerApp === FUTURE_OWNER_APPS.BOARDSTATE_LITE) {
    return definition.categoryId === "legacy-multiplayer-sessions" ? MIGRATION_READINESS.READY_WITH_WARNINGS : MIGRATION_READINESS.READY;
  }
  if (definition.futureOwnerApp === FUTURE_OWNER_APPS.DECK_NEXUS) return MIGRATION_READINESS.READY;
  return MIGRATION_READINESS.NEEDS_REVIEW;
}

function createLegacyArchiveRecords(categories = [], previousRecords = [], now = Date.now()) {
  const previousByCategory = new Map((previousRecords || []).map((record) => [record.categoryId, normalizeArchiveRecord(record)]));
  return categories.map((category) => {
    const previous = previousByCategory.get(category.categoryId) || {};
    return normalizeArchiveRecord({
      archiveId: previous.archiveId || createContractId("saveId", `archive-${category.categoryId}`),
      categoryId: category.categoryId,
      futureOwnerApp: category.futureOwnerApp,
      detectedAt: previous.detectedAt || (category.detected ? now : 0),
      lastSeenAt: category.detected ? now : previous.lastSeenAt || 0,
      itemCount: category.itemCount,
      estimatedSize: category.estimatedSize,
      readinessStatus: category.migrationReadiness,
      exportIds: previous.exportIds || [],
      backupIds: previous.backupIds || [],
      userNotes: previous.userNotes || "",
      warnings: [...category.compatibilityWarnings, ...category.privacyWarnings],
      migrationStatus: deriveArchiveMigrationStatus(category, previous),
      migratedAt: previous.migrationStatus === MIGRATION_STATUS.MIGRATED ? previous.migratedAt || 0 : 0,
      preservedLegacyAccessPath: category.preservedLegacyAccessPath,
      destructiveCleanupEligible: false,
    });
  });
}

function buildDeckNexusExportPayload(profile = {}, inventory = {}) {
  const legacyDecks = Object.entries(profile.commanders || {}).map(([deckId, deck]) => ({
    deckId,
    commander: sanitizeForMigrationExport(deck.commander || deck.commanderCard || null),
    cards: sanitizeForMigrationExport(deck.cards || deck.deck || []),
    cardCategories: sanitizeForMigrationExport(deck.categories || deck.cardCategories || {}),
    notes: String(deck.notes || ""),
    goals: sanitizeForMigrationExport(deck.goals || []),
    versions: sanitizeForMigrationExport(deck.versions || []),
    sourceMetadata: { sourceApp: "boardstate", sourceCategory: "legacy-decks" },
  }));
  const data = {
    legacyDecks,
    commanderData: sanitizeForMigrationExport(profile.commanders || {}),
    collectionRecords: sanitizeForMigrationExport(profile.archives || []),
    ownedCardRecords: sanitizeForMigrationExport(profile.ownedCards || profile.collection || []),
    scannerCardImportRecords: sanitizeForMigrationExport(profile.scannerData || profile.cardImports || profile.settings?.scanner || {}),
    tagsFavorites: sanitizeForMigrationExport({
      cardTags: profile.cardTags || profile.settings?.cardTags || {},
      favorites: profile.favorites || profile.settings?.favorites || {},
    }),
    sourceMetadata: buildSourceMetadata(profile, inventory, "deck-nexus"),
  };
  return {
    targetApp: FUTURE_OWNER_APPS.DECK_NEXUS,
    exportLabel: "Prepared for Deck Nexus",
    destinationStatus: "Ready for Manual Import",
    itemCounts: {
      legacyDecks: legacyDecks.length,
      collectionRecords: Array.isArray(profile.archives) ? profile.archives.length : 0,
      scannerRecords: countObjectEntries(profile.scannerData || profile.cardImports || profile.settings?.scanner || {}),
    },
    data,
    warnings: [
      "Deck Nexus repository is not modified by this export.",
      "This bundle is prepared for future Deck Nexus import; it does not prove external import success.",
    ],
    compatibility: {
      status: "Ready for Future Migration",
      destinationAvailable: false,
      requiresDestinationAppUpdate: true,
    },
  };
}

function buildBoardStateLiteExportPayload(profile = {}, inventory = {}) {
  const session = profile.activeSession || {};
  const data = {
    physicalTableRecords: sanitizeForMigrationExport({
      life: session.life,
      turn: session.turn,
      phaseIndex: session.phaseIndex,
      players: session.players || [],
      gameTracking: session.gameTracking || {},
    }),
    lifeTrackerRecords: sanitizeForMigrationExport({ life: session.life, history: session.history || [] }),
    commanderDamageLogs: sanitizeForMigrationExport(session.commander?.damageByOpponent || {}),
    poisonPlayerCounters: sanitizeForMigrationExport(session.playerCounters || {}),
    compactBattlefieldHelperData: sanitizeForMigrationExport({
      battlefield: summarizeCompactBattlefield(session),
      tapped: summarizeTappedState(session),
      counters: summarizePermanentCounters(session),
    }),
    simpleMultiplayerTableData: sanitizeForMigrationExport({
      syncedMultiplayer: session.syncedMultiplayer || {},
      multiplayerSettings: profile.settings?.multiplayer || {},
    }),
    tablePlayerPreferences: sanitizeForMigrationExport({
      startingLife: profile.settings?.startingLife || 40,
      playerName: profile.player?.name || "Player",
      accessibility: {
        adhdMode: profile.settings?.adhdMode || {},
        helperSprite: profile.settings?.helperSprite || {},
      },
    }),
    sourceMetadata: buildSourceMetadata(profile, inventory, "boardstate-lite"),
  };
  return {
    targetApp: FUTURE_OWNER_APPS.BOARDSTATE_LITE,
    exportLabel: "Prepared for BoardState Lite",
    destinationStatus: "Ready for Manual Import",
    itemCounts: {
      tableRecords: data.physicalTableRecords.life !== undefined ? 1 : 0,
      commanderDamageEntries: Object.keys(data.commanderDamageLogs || {}).length,
      battlefieldPermanents: (data.compactBattlefieldHelperData.battlefield || []).length,
    },
    data,
    warnings: [
      "BoardState Lite repository is not modified by this export.",
      "This bundle contains compact public table state and does not include full Advanced private rules state.",
    ],
    compatibility: {
      status: "Ready for Future Migration",
      destinationAvailable: false,
      requiresDestinationAppUpdate: true,
    },
  };
}

function buildBoardStateArchivePayload(profile = {}, inventory = {}) {
  const saveGroups = groupLocalSaves(profile.localSaves?.items || []);
  const data = {
    dryRunSaves: sanitizeForMigrationExport(saveGroups.dryRun),
    advancedGameplaySaves: sanitizeForMigrationExport(saveGroups.advanced),
    tutorialSaves: sanitizeForMigrationExport(saveGroups.tutorial),
    recoverySaves: sanitizeForMigrationExport(saveGroups.recovery),
    rulesSettings: sanitizeForMigrationExport(profile.settings?.rules || {}),
    waiverHistory: sanitizeForMigrationExport(profile.activeSession?.waiverHistory || []),
    importedDeckSnapshots: sanitizeForMigrationExport(createImportedDataState(profile.importedData || {}).deckSnapshots),
    importedSessions: sanitizeForMigrationExport([
      ...createImportedDataState(profile.importedData || {}).liteSessions,
      ...(profile.linkedSessions?.items || []),
    ]),
    advancedSimulationLogs: sanitizeForMigrationExport({
      simulationStats: profile.simulationStats || {},
      simulationMemory: profile.simulationMemory || {},
      activeSimulationLog: profile.activeSession?.simulation?.log || [],
    }),
    sourceMetadata: buildSourceMetadata(profile, inventory, "boardstate"),
  };
  return {
    targetApp: FUTURE_OWNER_APPS.BOARDSTATE,
    exportLabel: "Kept in BoardState",
    destinationStatus: "Already BoardState-Owned",
    itemCounts: {
      dryRunSaves: data.dryRunSaves.length,
      advancedGameplaySaves: data.advancedGameplaySaves.length,
      tutorialSaves: data.tutorialSaves.length,
      recoverySaves: data.recoverySaves.length,
      importedSnapshots: data.importedDeckSnapshots.length,
      importedSessions: data.importedSessions.length,
    },
    data,
    warnings: ["BoardState-owned data remains local and accessible. No migration or cleanup is performed."],
    compatibility: {
      status: "Already BoardState-Owned",
      destinationAvailable: true,
      requiresDestinationAppUpdate: false,
    },
  };
}

function buildHubReadyExportPayload(profile = {}, inventory = {}) {
  const data = {
    sharedProfileReferences: sanitizeForMigrationExport({
      profileId: profile.player?.id || profile.id || "local-player",
      displayName: profile.player?.name || "Player",
      localAuth: {
        mode: profile.localAuth?.mode || "guest",
        hasPassword: Boolean(profile.localAuth?.hasPassword),
        protectedDataPresent: Boolean(profile.localAuth?.hasPassword),
      },
    }),
    appLinkMetadata: sanitizeForMigrationExport(profile.settings?.linkedApps || {}),
    friends: sanitizeForMigrationExport(profile.friends || {}),
    tournaments: sanitizeForMigrationExport(profile.tournament || {}),
    notificationPreferences: sanitizeForMigrationExport(profile.settings?.notifications || {}),
    ecosystemSettings: sanitizeForMigrationExport({
      appearance: profile.settings?.appearance || {},
      accessibility: {
        adhdMode: profile.settings?.adhdMode || {},
        helperSprite: profile.settings?.helperSprite || {},
      },
      multiplayer: profile.settings?.multiplayer || {},
    }),
    backupMetadata: sanitizeForMigrationExport(profile.legacyMigration?.backups || []),
    activeSessionReferences: sanitizeForMigrationExport({
      gameId: profile.activeSession?.gameId || profile.activeSession?.id || "",
      sessionId: profile.activeSession?.sessionId || "",
      sourceApp: profile.activeSession?.sourceApp || "boardstate",
      revision: profile.activeSession?.revision || 0,
    }),
    linkedAppReferences: sanitizeForMigrationExport(profile.activeSession?.saveMetadata?.linkedAppReferences || []),
    migrationHistory: sanitizeForMigrationExport(profile.legacyMigration?.history || []),
    sourceMetadata: buildSourceMetadata(profile, inventory, "hub"),
  };
  return {
    targetApp: FUTURE_OWNER_APPS.HUB,
    exportLabel: "Prepared for future Hub migration",
    destinationStatus: "Waiting for Hub App",
    itemCounts: {
      profileReferences: 1,
      friends: (profile.friends?.friends || []).length,
      tournaments: profile.tournament?.active || profile.tournament?.status !== "idle" ? 1 : 0,
      notifications: Object.keys(profile.settings?.notifications || {}).length ? 1 : 0,
      migrationHistory: (profile.legacyMigration?.history || []).length,
    },
    data,
    warnings: [
      "Hub is not built yet. This is a Hub-ready export bundle only.",
      "No Hub import, sync, or migration completion is claimed.",
    ],
    compatibility: {
      status: "Waiting for Hub App",
      destinationAvailable: false,
      requiresDestinationAppUpdate: true,
    },
  };
}

function buildBoardStateOwnedPayload(profile = {}) {
  const saveGroups = groupLocalSaves(profile.localSaves?.items || []);
  return {
    dryRunSaves: sanitizeForMigrationExport(saveGroups.dryRun),
    advancedSaves: sanitizeForMigrationExport(saveGroups.advanced),
    tutorialSaves: sanitizeForMigrationExport(saveGroups.tutorial),
    recoverySaves: sanitizeForMigrationExport(saveGroups.recovery),
    rulesSettings: sanitizeForMigrationExport(profile.settings?.rules || {}),
    waiverHistory: sanitizeForMigrationExport(profile.activeSession?.waiverHistory || []),
    importedData: sanitizeForMigrationExport(profile.importedData || {}),
    simulationLogs: sanitizeForMigrationExport({
      stats: profile.simulationStats || {},
      memory: profile.simulationMemory || {},
      activeLog: profile.activeSession?.simulation?.log || [],
    }),
  };
}

function buildLegacyPayloadBlocks(profile = {}) {
  return {
    deckNexusCandidates: buildDeckNexusExportPayload(profile, {}).data,
    boardStateLiteCandidates: buildBoardStateLiteExportPayload(profile, {}).data,
    hubCandidates: buildHubReadyExportPayload(profile, {}).data,
  };
}

function buildSourceMetadata(profile = {}, inventory = {}, destination = "") {
  return {
    sourceApp: "boardstate",
    sourceProfileId: profile.player?.id || profile.id || "local-player",
    sourceProfileName: profile.player?.name || "Player",
    destination,
    generatedAt: new Date().toISOString(),
    inventoryVersion: inventory.version || LEGACY_MIGRATION_VERSION,
    categories: (inventory.categories || []).filter((category) => category.detected).map((category) => ({
      categoryId: category.categoryId,
      itemCount: category.itemCount,
      readiness: category.migrationReadiness,
    })),
  };
}

function validateLegacySaves(profile = {}) {
  const saves = Array.isArray(profile.localSaves?.items) ? profile.localSaves.items : [];
  const validSaves = [];
  const invalidSaves = [];
  const migratableSaves = [];
  saves.forEach((save) => {
    const validation = validateLocalSave(save);
    const record = {
      saveId: save?.saveId || "",
      saveName: save?.saveName || "BoardState Save",
      mode: save?.gameMode || save?.metadata?.mode || "normal",
      reason: validation.reason || "",
      compatibility: validation.valid ? "valid" : "corrupted",
    };
    if (validation.valid) {
      validSaves.push(record);
      if (!save.schemaVersion || !save.saveFormatVersion) migratableSaves.push({ ...record, compatibility: "migration-required" });
    } else {
      invalidSaves.push(record);
    }
  });
  return {
    total: saves.length,
    validSaves,
    invalidSaves,
    migratableSaves,
    corruptedSaves: invalidSaves.filter((entry) => /missing|required|malformed/i.test(entry.reason)),
  };
}

function validateImportedData(profile = {}) {
  const imported = createImportedDataState(profile.importedData || {});
  const invalidImports = [];
  const missingReferences = [];
  imported.deckSnapshots.forEach((snapshot) => {
    const validation = validateDeckNexusSnapshotPayload({ bundleType: "deck-nexus-deck-snapshot", sourceApp: "deck-nexus", deckSnapshot: snapshot });
    if (!validation.valid) invalidImports.push({ id: snapshot.deckSnapshotId, type: "deck-nexus", reason: validation.errors?.[0] || validation.status });
  });
  imported.liteSessions.forEach((record) => {
    const validation = validateBoardStateLiteSnapshot({ bundleType: "boardstate-lite-session-handoff", sourceApp: "boardstate-lite", session: record.canonicalSession || record.session });
    if (!validation.valid) invalidImports.push({ id: record.sessionId, type: "boardstate-lite", reason: validation.errors?.[0] || validation.status });
  });
  (profile.activeSession?.deckSnapshotReferences || []).forEach((reference) => {
    if (reference.deckSnapshotId && !imported.deckSnapshots.some((snapshot) => snapshot.deckSnapshotId === reference.deckSnapshotId)) {
      missingReferences.push(`deck snapshot ${reference.deckSnapshotId}`);
    }
  });
  return { invalidImports, missingReferences };
}

function validateLegacyArchives(profile = {}) {
  const state = createLegacyMigrationState(profile.legacyMigration || {});
  const errors = [];
  state.archiveRecords.forEach((record) => {
    if (!record.archiveId || !record.categoryId) errors.push(`archive record missing identity for ${record.categoryId || "unknown"}`);
    if (record.destructiveCleanupEligible) errors.push(`archive ${record.categoryId} unexpectedly marked cleanup eligible`);
  });
  return { valid: !errors.length, errors };
}

function validateSharedSessionReferences(profile = {}) {
  const errors = [];
  const missingReferences = [];
  const session = profile.activeSession || {};
  if (!session.gameId && !session.id) errors.push("active session missing game id");
  if (!session.sessionId) missingReferences.push("active session sessionId missing");
  if (!session.schemaVersion) missingReferences.push("active session schemaVersion missing");
  if (!session.rulesEngineVersion) missingReferences.push("active session rulesEngineVersion missing");
  return { valid: !errors.length, errors, missingReferences };
}

function groupLocalSaves(saves = []) {
  const groups = { advanced: [], dryRun: [], tutorial: [], imported: [], legacy: [], recovery: [] };
  (Array.isArray(saves) ? saves : []).forEach((save) => {
    const mode = String(save?.gameMode || save?.metadata?.mode || "").toLowerCase();
    const sourceApp = String(save?.sourceApp || save?.metadata?.sourceApp || "boardstate").toLowerCase();
    const migrationStatus = String(save?.metadata?.migrationStatus || "").toLowerCase();
    if (/tutorial/.test(mode)) groups.tutorial.push(save);
    else if (/dry|simulation/.test(mode)) groups.dryRun.push(save);
    else if (/recovery/.test(mode)) groups.recovery.push(save);
    else if (sourceApp && sourceApp !== "boardstate") groups.imported.push(save);
    else if (/legacy/.test(mode) || migrationStatus === "legacy") groups.legacy.push(save);
    else groups.advanced.push(save);
  });
  return groups;
}

function saveGroupCount(saves = []) {
  return {
    itemCount: saves.length,
    lastUpdated: maxUpdated(saves),
    estimatedSize: estimateSize(saves),
  };
}

function sanitizeForMigrationExport(value) {
  return sanitizeValue(clonePlain(value || null));
}

function sanitizeValue(value, key = "") {
  if (UNSAFE_PRIVATE_KEYS.has(String(key))) {
    return "[excluded-private-field]";
  }
  if (Array.isArray(value)) return value.map((entry) => sanitizeValue(entry, key));
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && /bearer\s+[a-z0-9._-]{8,}/i.test(value)) return "[excluded-private-field]";
    if (typeof value === "string" && /<script|javascript:/i.test(value)) return value.replace(/<script/gi, "&lt;script").replace(/javascript:/gi, "blocked-script:");
    return value;
  }
  const next = {};
  Object.entries(value).forEach(([childKey, childValue]) => {
    if (UNSAFE_PRIVATE_KEYS.has(childKey)) {
      next[childKey] = "[excluded-private-field]";
    } else {
      next[childKey] = sanitizeValue(childValue, childKey);
    }
  });
  return next;
}

function validateNoUnsafeMigrationData(input = {}) {
  const errors = [];
  const stack = [input];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    Object.entries(current).forEach(([key, value]) => {
      if (UNSAFE_PRIVATE_KEYS.has(key) && value !== "[excluded-private-field]") {
        errors.push(`unsafe private field ${key} is not excluded`);
      }
      if (typeof value === "string" && /bearer\s+[a-z0-9._-]{8,}/i.test(value)) {
        errors.push("bearer credential text is not allowed");
      }
      if (value && typeof value === "object") stack.push(value);
    });
  }
  return { valid: errors.length === 0, errors };
}

function collectPrivacyExclusions(profile = {}) {
  const exclusions = [
    "plaintext passwords",
    "private tokens",
    "unsafe sync credentials",
    "raw private browser secrets",
    "executable script content",
  ];
  if (profile.localAuth?.hasPassword) exclusions.push("protected profile credential material");
  return [...new Set(exclusions)];
}

function collectBackupWarnings(profile = {}, categories = []) {
  const warnings = [];
  if (profile.localAuth?.hasPassword) warnings.push("Protected profile metadata is included; credential material is excluded.");
  if (categories.some((category) => category.futureOwnerApp === FUTURE_OWNER_APPS.HUB && category.detected)) warnings.push("Hub-ready data is backed up locally, but Hub migration is not available yet.");
  if (categories.some((category) => category.categoryId === "unknown-legacy-keys-data-blocks" && category.detected)) warnings.push("Unknown legacy data blocks require review before migration.");
  return warnings;
}

function buildSafeCategorySamples(profile = {}, category = {}) {
  switch (category.categoryId) {
    case "legacy-profiles":
      return [{ name: profile.player?.name || "Player", id: profile.player?.id || profile.id || "local-player" }];
    case "legacy-local-protected-profiles":
      return profile.localAuth?.hasPassword ? [{ name: "Protected data present", id: "protected-profile", protected: true }] : [];
    case "legacy-decks":
      return Object.entries(profile.commanders || {}).map(([id, deck]) => ({ name: deck.name || deck.commander?.name || id, id }));
    case "legacy-collection-records":
      return (profile.archives || []).map((entry, index) => ({ name: entry.name || entry.cardName || `Archive ${index + 1}`, id: entry.id || `archive-${index}` }));
    case "legacy-friends":
      return (profile.friends?.friends || []).map((entry) => ({ name: entry.displayName || entry.friendCode || "Friend", id: entry.friendId || entry.friendCode || "" }));
    case "legacy-tournaments":
      return profile.tournament?.active || profile.tournament?.status !== "idle" ? [{ name: profile.tournament?.name || "Local Tournament", id: profile.tournament?.id || profile.tournament?.tournamentId || "" }] : [];
    case "legacy-dry-run-saves":
    case "legacy-advanced-game-saves":
    case "legacy-tutorial-saves":
    case "legacy-recovery-saves":
      return groupSavesForCategory(profile.localSaves?.items || [], category.categoryId).map((save) => ({ name: save.saveName || "BoardState Save", id: save.saveId || "" }));
    case "unknown-legacy-keys-data-blocks":
      return Object.keys(profile || {}).filter((key) => !KNOWN_PROFILE_KEYS.has(key)).map((key) => ({ name: key, id: key }));
    default:
      return [];
  }
}

function groupSavesForCategory(saves = [], categoryId = "") {
  const groups = groupLocalSaves(saves);
  if (categoryId === "legacy-dry-run-saves") return groups.dryRun;
  if (categoryId === "legacy-tutorial-saves") return groups.tutorial;
  if (categoryId === "legacy-recovery-saves") return groups.recovery;
  if (categoryId === "legacy-advanced-game-saves") return groups.advanced;
  return [];
}

function updateArchiveRecordsWithExport(records = [], targetApp = "", exportId = "") {
  return (records || []).map((record) => {
    if (!exportId || !isCategoryForTarget(record.futureOwnerApp, targetApp)) return record;
    return normalizeArchiveRecord({
      ...record,
      exportIds: [exportId, ...(record.exportIds || []).filter((id) => id !== exportId)].slice(0, 12),
      migrationStatus: record.futureOwnerApp === FUTURE_OWNER_APPS.BOARDSTATE
        ? MIGRATION_STATUS.ARCHIVED
        : targetApp === FUTURE_OWNER_APPS.HUB
          ? MIGRATION_STATUS.WAITING_DESTINATION
          : MIGRATION_STATUS.EXPORT_PREPARED,
      destructiveCleanupEligible: false,
    });
  });
}

function isCategoryForTarget(futureOwnerApp = "", targetApp = "") {
  if (targetApp === FUTURE_OWNER_APPS.HUB) return futureOwnerApp === FUTURE_OWNER_APPS.HUB;
  return futureOwnerApp === targetApp;
}

function normalizeArchiveRecord(record = {}) {
  if (!record || typeof record !== "object") return null;
  return {
    archiveId: String(record.archiveId || createContractId("saveId", `archive-${record.categoryId || "legacy"}`)),
    categoryId: String(record.categoryId || ""),
    futureOwnerApp: record.futureOwnerApp || FUTURE_OWNER_APPS.UNKNOWN,
    detectedAt: Number(record.detectedAt || 0),
    lastSeenAt: Number(record.lastSeenAt || 0),
    itemCount: Math.max(0, Number(record.itemCount || 0)),
    estimatedSize: Math.max(0, Number(record.estimatedSize || 0)),
    readinessStatus: String(record.readinessStatus || MIGRATION_READINESS.NEEDS_REVIEW),
    exportIds: Array.isArray(record.exportIds) ? record.exportIds.map(String).slice(0, 12) : [],
    backupIds: Array.isArray(record.backupIds) ? record.backupIds.map(String).slice(0, 12) : [],
    userNotes: String(record.userNotes || ""),
    warnings: Array.isArray(record.warnings) ? record.warnings.map(String).slice(0, 12) : [],
    migrationStatus: normalizeMigrationStatus(record.migrationStatus || MIGRATION_STATUS.NOT_STARTED),
    migratedAt: Number(record.migratedAt || 0),
    preservedLegacyAccessPath: String(record.preservedLegacyAccessPath || ""),
    destructiveCleanupEligible: false,
  };
}

function normalizeBackupRecord(record = {}) {
  if (!record || typeof record !== "object") return null;
  return {
    backupId: String(record.backupId || createContractId("saveId", "legacy-backup")),
    createdAt: Number(record.createdAt || Date.now()),
    bundleType: String(record.bundleType || LEGACY_BACKUP_BUNDLE_TYPE),
    itemCount: Number(record.itemCount || 0),
    validationStatus: String(record.validationStatus || "valid"),
    warnings: Array.isArray(record.warnings) ? record.warnings.map(String).slice(0, 12) : [],
    validationHash: String(record.validationHash || ""),
  };
}

function normalizeExportRecord(record = {}) {
  if (!record || typeof record !== "object") return null;
  return {
    exportId: String(record.exportId || createContractId("saveId", "legacy-export")),
    destinationApp: String(record.destinationApp || FUTURE_OWNER_APPS.UNKNOWN),
    exportLabel: String(record.exportLabel || ""),
    createdAt: Number(record.createdAt || Date.now()),
    bundleType: String(record.bundleType || LEGACY_EXPORT_BUNDLE_TYPE),
    itemCounts: clonePlain(record.itemCounts || {}),
    validationStatus: String(record.validationStatus || "valid"),
    warnings: Array.isArray(record.warnings) ? record.warnings.map(String).slice(0, 12) : [],
    validationHash: String(record.validationHash || ""),
    migrationStatus: normalizeMigrationStatus(record.migrationStatus || MIGRATION_STATUS.EXPORT_PREPARED),
  };
}

function normalizeRecoveryRecord(record = {}) {
  if (!record || typeof record !== "object") return null;
  return {
    reportId: String(record.reportId || createContractId("eventId", "legacy-recovery")),
    createdAt: Number(record.createdAt || Date.now()),
    invalidSavesCount: Number(record.invalidSavesCount || 0),
    invalidImportsCount: Number(record.invalidImportsCount || 0),
    errorCount: Number(record.errorCount || 0),
    validationStatus: String(record.validationStatus || "valid"),
  };
}

function createMigrationHistoryEntry(input = {}) {
  return normalizeMigrationHistoryEntry({
    logId: input.logId || createContractId("eventId", `migration-${input.eventType || "event"}-${input.timestamp || Date.now()}`),
    eventType: input.eventType || "migration event",
    categoryId: input.categoryId || "",
    timestamp: Number(input.timestamp || Date.now()),
    result: input.result || "success",
    warnings: input.warnings || [],
    relatedExportId: input.relatedExportId || "",
    relatedBackupId: input.relatedBackupId || "",
    errorSummary: input.errorSummary || "",
  });
}

function normalizeMigrationHistoryEntry(entry = {}) {
  if (!entry || typeof entry !== "object") return null;
  return {
    logId: String(entry.logId || createContractId("eventId", "migration-log")),
    eventType: String(entry.eventType || "migration event"),
    categoryId: String(entry.categoryId || ""),
    timestamp: Number(entry.timestamp || Date.now()),
    result: String(entry.result || "success"),
    warnings: Array.isArray(entry.warnings) ? entry.warnings.map(String).slice(0, 12) : [],
    relatedExportId: String(entry.relatedExportId || ""),
    relatedBackupId: String(entry.relatedBackupId || ""),
    errorSummary: String(entry.errorSummary || ""),
  };
}

function createMigrationValidationResult(status = "valid", errors = [], warnings = []) {
  return {
    valid: status === "valid",
    status,
    invalid: status !== "valid",
    errors,
    warnings,
  };
}

function deriveArchiveMigrationStatus(category = {}, previous = {}) {
  if (previous.migrationStatus === MIGRATION_STATUS.MIGRATED) return MIGRATION_STATUS.MIGRATED;
  if (!category.detected) return MIGRATION_STATUS.NOT_STARTED;
  if (category.futureOwnerApp === FUTURE_OWNER_APPS.BOARDSTATE) return MIGRATION_STATUS.ARCHIVED;
  if (category.futureOwnerApp === FUTURE_OWNER_APPS.HUB) return MIGRATION_STATUS.WAITING_DESTINATION;
  if (category.exportAvailable) return previous.exportIds?.length ? MIGRATION_STATUS.EXPORT_PREPARED : MIGRATION_STATUS.NOT_STARTED;
  return MIGRATION_STATUS.NOT_STARTED;
}

function normalizeMigrationStatus(status = MIGRATION_STATUS.NOT_STARTED) {
  return Object.values(MIGRATION_STATUS).includes(status) ? status : MIGRATION_STATUS.NOT_STARTED;
}

function defaultCompatibilityWarnings(definition = {}, itemCount = 0) {
  if (!itemCount) return [];
  if (definition.futureOwnerApp === FUTURE_OWNER_APPS.HUB) return ["Destination app update required. Prepared exports do not mean Hub migration is complete."];
  if (definition.futureOwnerApp === FUTURE_OWNER_APPS.BOARDSTATE_LITE) return ["BoardState Lite repository is not updated by this prompt."];
  if (definition.futureOwnerApp === FUTURE_OWNER_APPS.DECK_NEXUS) return ["Deck Nexus repository is not updated by this prompt."];
  return [];
}

function defaultPrivacyWarnings(definition = {}, itemCount = 0) {
  if (!itemCount) return [];
  if (definition.categoryId === "legacy-profiles") return ["Profile identity metadata is shown; passwords and credential material are excluded."];
  return [];
}

function isExportAvailable(definition = {}, readiness = "") {
  if (readiness === MIGRATION_READINESS.PROTECTED || readiness === MIGRATION_READINESS.UNKNOWN || readiness === MIGRATION_READINESS.ERROR) return false;
  if (definition.bundleTargets?.includes("backup")) return false;
  return true;
}

function getIntendedAction(definition = {}, readiness = "") {
  if (readiness === MIGRATION_READINESS.BOARDSTATE_OWNED) return "Keep in BoardState";
  if (definition.futureOwnerApp === FUTURE_OWNER_APPS.DECK_NEXUS) return "Export Deck Nexus Bundle";
  if (definition.futureOwnerApp === FUTURE_OWNER_APPS.BOARDSTATE_LITE) return "Export Lite Table Bundle";
  if (definition.futureOwnerApp === FUTURE_OWNER_APPS.HUB) return "Prepare Hub-ready export bundle";
  return "Create full backup and review";
}

function buildLegacyAccessPath(access = {}) {
  if (access.page) return `page:${access.page}`;
  if (access.optionsCategory) return `options:${access.optionsCategory}`;
  return "options:legacy";
}

function formatOwnerApp(appId = "") {
  const labels = {
    [FUTURE_OWNER_APPS.BOARDSTATE]: "BoardState archive",
    [FUTURE_OWNER_APPS.BOARDSTATE_LITE]: "BoardState Lite",
    [FUTURE_OWNER_APPS.DECK_NEXUS]: "Deck Nexus",
    [FUTURE_OWNER_APPS.HUB]: "Future Hub",
    [FUTURE_OWNER_APPS.UNKNOWN]: "Needs Review",
  };
  return labels[appId] || labels[FUTURE_OWNER_APPS.UNKNOWN];
}

function normalizeDestination(destination = "") {
  const normalized = String(destination || "").toLowerCase();
  if (normalized === "deck-nexus") return "deck-nexus";
  if (normalized === "boardstate-lite") return "boardstate-lite";
  if (normalized === "hub" || normalized === "boardstate-hub") return "hub";
  return "boardstate";
}

function summarizeMigrationStatus(migrationState = {}, categories = []) {
  const state = createLegacyMigrationState(migrationState);
  return {
    lastInventoryAt: state.lastInventoryAt || 0,
    lastBackupAt: state.lastBackupAt || 0,
    lastExportAt: state.lastExportAt || 0,
    archiveRecords: state.archiveRecords.length,
    detectedCategories: categories.filter((category) => category.detected).length,
    cleanupEligibleCount: state.archiveRecords.filter((record) => record.destructiveCleanupEligible).length,
  };
}

function summarizeCompactBattlefield(session = {}) {
  return [...(session.battlefield?.player || []), ...(session.battlefield?.opponent || [])].map((permanent) => ({
    id: permanent.id,
    name: permanent.name,
    controller: permanent.controller || "player",
    typeLine: permanent.typeLine || "",
    quantity: Number(permanent.quantity || 1),
    tapped: Boolean(permanent.tapped),
    counters: clonePlain(permanent.counters || {}),
    token: Boolean(permanent.isToken || permanent.token),
  }));
}

function summarizeTappedState(session = {}) {
  return summarizeCompactBattlefield(session).filter((entry) => entry.tapped).map((entry) => entry.id);
}

function summarizePermanentCounters(session = {}) {
  return Object.fromEntries(summarizeCompactBattlefield(session).filter((entry) => Object.keys(entry.counters || {}).length).map((entry) => [entry.id, entry.counters]));
}

function countBattlefieldPermanents(session = {}) {
  return [...(session.battlefield?.player || []), ...(session.battlefield?.opponent || [])].reduce((sum, permanent) => sum + Math.max(1, Number(permanent.quantity || 1)), 0);
}

function countCardTags(profile = {}) {
  return countObjectEntries(profile.cardTags || {}) + countObjectEntries(profile.favorites || {}) + countObjectEntries(profile.settings?.cardTags || {}) + countObjectEntries(profile.settings?.favorites || {});
}

function countObjectEntries(value = {}) {
  if (!value || typeof value !== "object") return 0;
  if (Array.isArray(value)) return value.length;
  return Object.keys(value).length;
}

function maxUpdated(value = []) {
  const list = Array.isArray(value) ? value : Object.values(value || {});
  return list.reduce((max, entry) => {
    if (!entry || typeof entry !== "object") return max;
    const candidate = Number(entry.updatedAt || entry.createdAt || entry.timestamp || entry.completedAt || entry.importedAt || 0);
    return Math.max(max, Number.isFinite(candidate) ? candidate : 0);
  }, 0);
}

function estimateSize(value = {}) {
  try {
    return JSON.stringify(sanitizeForMigrationExport(value)).length;
  } catch {
    return 0;
  }
}
