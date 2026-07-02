export const SHARED_CONTRACT_SCHEMA_VERSION = "boardstate-shared-contracts-0.1.0";
export const SHARED_SAVE_FORMAT_VERSION = "boardstate-save-envelope-0.1.0";
export const SHARED_SYNC_PROTOCOL_VERSION = "boardstate-sync-protocol-0.1.0";
export const DEFAULT_RULES_ENGINE_VERSION = "boardstate-rules-engine-0.1.0";

export const SHARED_VERSION_CHANGELOG = [
  {
    schemaVersion: SHARED_CONTRACT_SCHEMA_VERSION,
    saveFormatVersion: SHARED_SAVE_FORMAT_VERSION,
    syncProtocolVersion: SHARED_SYNC_PROTOCOL_VERSION,
    note: "Initial canonical ecosystem contracts for BoardState shared sessions, actions, events, saves, and sync envelopes.",
  },
];

export function getSharedVersionInfo(overrides = {}) {
  return {
    schemaVersion: overrides.schemaVersion || SHARED_CONTRACT_SCHEMA_VERSION,
    rulesEngineVersion: overrides.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
    saveFormatVersion: overrides.saveFormatVersion || SHARED_SAVE_FORMAT_VERSION,
    syncProtocolVersion: overrides.syncProtocolVersion || SHARED_SYNC_PROTOCOL_VERSION,
  };
}

export function compareContractVersions(left = "", right = "") {
  if (left === right) return 0;
  const leftParts = parseVersionTail(left);
  const rightParts = parseVersionTail(right);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const delta = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (delta !== 0) return delta > 0 ? 1 : -1;
  }
  return String(left).localeCompare(String(right));
}

export function isSupportedSchemaVersion(version = SHARED_CONTRACT_SCHEMA_VERSION) {
  return version === SHARED_CONTRACT_SCHEMA_VERSION;
}

export function isSupportedSaveFormatVersion(version = SHARED_SAVE_FORMAT_VERSION) {
  return version === SHARED_SAVE_FORMAT_VERSION;
}

export function isSupportedSyncProtocolVersion(version = SHARED_SYNC_PROTOCOL_VERSION) {
  return version === SHARED_SYNC_PROTOCOL_VERSION;
}

function parseVersionTail(version = "") {
  const match = String(version || "").match(/(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map((part) => Number(part) || 0) : [0, 0, 0];
}
