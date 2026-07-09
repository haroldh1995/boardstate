import {
  ACTION_TYPES,
  EVENT_TYPES,
  SYNC_NAMESPACES,
  createCanonicalAction,
  createCanonicalEvent,
  createCanonicalPlayer,
  createCanonicalSaveEnvelope,
  createCanonicalSyncMessage,
  createCardInstance,
  createDeckSnapshot,
  createEcosystemBundle,
  createRuleViolation,
  createRuleWaiver,
  createSharedGameSession,
  createTournamentReference,
} from "./contracts.js";
import {
  SHARED_CONTRACT_SCHEMA_VERSION,
  SHARED_SAVE_FORMAT_VERSION,
  SHARED_SYNC_PROTOCOL_VERSION,
  isSupportedSaveFormatVersion,
  isSupportedSchemaVersion,
  isSupportedSyncProtocolVersion,
} from "./version.js";
import { ID_TYPES, assertNoPrivateToken } from "./ids.js";

export const VALIDATION_STATUSES = Object.freeze([
  "valid",
  "invalid",
  "unsupported-version",
  "migration-required",
  "partially-recoverable",
  "corrupted",
]);

export function createValidationResult(status = "valid", errors = [], warnings = []) {
  return {
    valid: status === "valid" || status === "partially-recoverable",
    status,
    invalid: status === "invalid" || status === "corrupted",
    unsupportedVersion: status === "unsupported-version",
    migrationRequired: status === "migration-required",
    partiallyRecoverable: status === "partially-recoverable",
    corrupted: status === "corrupted",
    errors,
    warnings,
  };
}

export function validateVersionSet(value = {}) {
  const errors = [];
  if (value.schemaVersion && !isSupportedSchemaVersion(value.schemaVersion)) errors.push(`unsupported schema version ${value.schemaVersion}`);
  if (value.saveFormatVersion && !isSupportedSaveFormatVersion(value.saveFormatVersion)) errors.push(`unsupported save format version ${value.saveFormatVersion}`);
  if (value.syncProtocolVersion && !isSupportedSyncProtocolVersion(value.syncProtocolVersion)) errors.push(`unsupported sync protocol version ${value.syncProtocolVersion}`);
  if (!errors.length) return createValidationResult("valid");
  return createValidationResult("unsupported-version", errors);
}

export function validateSharedGameSession(input = null) {
  if (!isObject(input)) return createValidationResult("corrupted", ["shared game session must be an object"]);
  const session = createSharedGameSession(input);
  const errors = required(session, ["gameId", "sessionId", "schemaVersion", "rulesEngineVersion", "syncProtocolVersion", "players", "turnState", "priorityState", "battlefieldState", "zoneState"]);
  const version = validateVersionSet(session);
  if (!version.valid) return version;
  if (!Array.isArray(session.players)) errors.push("players must be an array");
  if (!isObject(session.activeInterfaceByPlayer)) errors.push("activeInterfaceByPlayer must be an object");
  if (!isObject(session.sessionCapabilities)) errors.push("sessionCapabilities must be an object");
  return errors.length ? createValidationResult("invalid", errors) : createValidationResult("valid");
}

export function validatePlayer(input = null) {
  if (!isObject(input)) return createValidationResult("corrupted", ["player must be an object"]);
  const player = createCanonicalPlayer(input);
  const errors = required(player, ["playerId", "displayName", "controllerType", "activeInterface"]);
  if (!isObject(player.commanderDamage)) errors.push("commanderDamage must identify commander sources");
  return errors.length ? createValidationResult("invalid", errors) : createValidationResult("valid");
}

export function validateCardInstance(input = null) {
  if (!isObject(input)) return createValidationResult("corrupted", ["card instance must be an object"]);
  const card = createCardInstance(input);
  const errors = required(card, ["cardInstanceId", "ownerPlayerId", "controllerPlayerId", "oracleId", "printingId", "currentZone", "visibility"]);
  return errors.length ? createValidationResult("invalid", errors) : createValidationResult("valid");
}

export function validateDeckSnapshot(input = null) {
  if (!isObject(input)) return createValidationResult("corrupted", ["deck snapshot must be an object"]);
  const deck = createDeckSnapshot(input);
  const errors = required(deck, ["deckSnapshotId", "sourceApp", "sourceDeckId", "name", "format", "cards", "immutableSnapshotVersion"]);
  if (!Array.isArray(deck.cards)) errors.push("deck cards must be an array");
  return errors.length ? createValidationResult("invalid", errors) : createValidationResult("valid");
}

export function validateAction(input = null) {
  if (!isObject(input)) return createValidationResult("corrupted", ["action must be an object"]);
  const action = createCanonicalAction(input);
  const errors = required(action, ["actionId", "actionType", "schemaVersion", "gameId", "sessionId", "playerId", "createdAt", "payload"]);
  if (!ACTION_TYPES.includes(action.actionType)) errors.push(`unsupported action type ${action.actionType}`);
  const version = validateVersionSet(action);
  if (!version.valid) return version;
  return errors.length ? createValidationResult("invalid", errors) : createValidationResult("valid");
}

export function validateEvent(input = null) {
  if (!isObject(input)) return createValidationResult("corrupted", ["event must be an object"]);
  const event = createCanonicalEvent(input);
  const errors = required(event, ["eventId", "eventType", "schemaVersion", "gameId", "sessionId", "revision", "createdAt", "payload", "visibility", "rulesEngineVersion"]);
  if (!EVENT_TYPES.includes(event.eventType)) errors.push(`unsupported event type ${event.eventType}`);
  const version = validateVersionSet(event);
  if (!version.valid) return version;
  return errors.length ? createValidationResult("invalid", errors) : createValidationResult("valid");
}

export function validateSyncMessage(input = null) {
  if (!isObject(input)) return createValidationResult("corrupted", ["sync message must be an object"]);
  const message = createCanonicalSyncMessage(input);
  const errors = required(message, ["namespace", "messageType", "syncProtocolVersion", "messageId", "sessionId", "senderAppInstanceId", "payload", "createdAt"]);
  if (input.namespace && !SYNC_NAMESPACES.includes(input.namespace)) errors.push(`invalid sync namespace ${input.namespace}`);
  if (!SYNC_NAMESPACES.includes(message.namespace)) errors.push(`invalid sync namespace ${message.namespace}`);
  if (message.namespace === "tournament" && /^gameplay:/i.test(message.messageType)) errors.push("tournament namespace cannot carry gameplay messages");
  if ((message.namespace === "friend" || message.namespace === "discovery") && /^gameplay:|^tournament:/i.test(message.messageType)) {
    errors.push("friend/discovery namespace cannot carry gameplay or tournament state messages");
  }
  const version = validateVersionSet(message);
  if (!version.valid) return version;
  return errors.length ? createValidationResult("invalid", errors) : createValidationResult("valid");
}

export function validateSaveEnvelope(input = null) {
  if (!isObject(input)) return createValidationResult("corrupted", ["save envelope must be an object"]);
  const envelope = createCanonicalSaveEnvelope(input);
  const errors = required(envelope, ["saveId", "saveFormatVersion", "schemaVersion", "rulesEngineVersion", "profileId", "gameId", "sessionId", "saveName", "gameState", "checksum"]);
  const version = validateVersionSet(envelope);
  if (!version.valid) return version;
  const gameValidation = validateSharedGameSession(envelope.gameState);
  if (!gameValidation.valid) errors.push(...gameValidation.errors.map((error) => `gameState:${error}`));
  return errors.length ? createValidationResult("invalid", errors) : createValidationResult("valid");
}

export function validateEcosystemBundle(input = null) {
  if (!isObject(input)) return createValidationResult("corrupted", ["ecosystem bundle must be an object"]);
  const bundle = createEcosystemBundle(input);
  const errors = required(bundle, ["bundleId", "schemaVersion", "sections", "metadata"]);
  if (!isObject(bundle.sections)) errors.push("bundle sections must be an object");
  const version = validateVersionSet(bundle);
  if (!version.valid) return version;
  return errors.length ? createValidationResult("invalid", errors) : createValidationResult("valid");
}

export function validateTournamentReference(input = null) {
  if (!isObject(input)) return createValidationResult("corrupted", ["tournament reference must be an object"]);
  const ref = createTournamentReference(input);
  const errors = required(ref, ["tournamentId", "participantId", "status", "externalOwnerApp"]);
  return errors.length ? createValidationResult("partially-recoverable", errors, ["missing tournament fields can be inferred later"]) : createValidationResult("valid");
}

export function validateRuleViolation(input = null) {
  if (!isObject(input)) return createValidationResult("corrupted", ["rule violation must be an object"]);
  const violation = createRuleViolation(input);
  const errors = required(violation, ["ruleViolationId", "code", "severity", "messageKey", "blocking", "waivable"]);
  return errors.length ? createValidationResult("invalid", errors) : createValidationResult("valid");
}

export function validateRuleWaiver(input = null) {
  if (!isObject(input)) return createValidationResult("corrupted", ["rule waiver must be an object"]);
  const waiver = createRuleWaiver(input);
  const errors = required(waiver, ["waiverId", "ruleCode", "scope", "approvedByPlayerId", "createdAt", "relatedActionId"]);
  return errors.length ? createValidationResult("partially-recoverable", errors, ["waiver contract exists but UI behavior is implemented in a later prompt"]) : createValidationResult("valid");
}

export function validateNoPrivateExportTokens(input = {}) {
  const serialized = JSON.stringify(input || {});
  const errors = [];
  ["password", "authToken", "privateToken", "secret"].forEach((key) => {
    if (serialized.includes(`"${key}"`)) errors.push(`private export key ${key} is not allowed`);
  });
  if (!assertNoPrivateToken(serialized.replace(/"token"/gi, ""))) errors.push("private token-like value detected");
  return errors.length ? createValidationResult("invalid", errors) : createValidationResult("valid");
}

export function getContractSchemaInventory() {
  return {
    schemaVersion: SHARED_CONTRACT_SCHEMA_VERSION,
    saveFormatVersion: SHARED_SAVE_FORMAT_VERSION,
    syncProtocolVersion: SHARED_SYNC_PROTOCOL_VERSION,
    idTypes: [...ID_TYPES],
    actionTypes: [...ACTION_TYPES],
    eventTypes: [...EVENT_TYPES],
    syncNamespaces: [...SYNC_NAMESPACES],
  };
}

function required(value = {}, fields = []) {
  return fields.filter((field) => value[field] === undefined || value[field] === null || value[field] === "").map((field) => `missing ${field}`);
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
