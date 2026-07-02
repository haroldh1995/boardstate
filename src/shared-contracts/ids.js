export const ID_TYPES = Object.freeze([
  "profileId",
  "playerId",
  "friendId",
  "friendCode",
  "appInstanceId",
  "deviceId",
  "gameId",
  "sessionId",
  "roomId",
  "tournamentId",
  "participantId",
  "roundId",
  "tableId",
  "deckId",
  "deckSnapshotId",
  "cardOracleId",
  "cardPrintingId",
  "cardInstanceId",
  "permanentId",
  "stackObjectId",
  "triggerId",
  "choiceRequestId",
  "actionId",
  "eventId",
  "saveId",
  "notificationId",
]);

export const ID_PREFIX_BY_TYPE = Object.freeze({
  profileId: "profile",
  playerId: "player",
  friendId: "friend",
  friendCode: "friend-code",
  appInstanceId: "app",
  deviceId: "device",
  gameId: "game",
  sessionId: "session",
  roomId: "room",
  tournamentId: "tournament",
  participantId: "participant",
  roundId: "round",
  tableId: "table",
  deckId: "deck",
  deckSnapshotId: "deck-snapshot",
  cardOracleId: "oracle",
  cardPrintingId: "printing",
  cardInstanceId: "card",
  permanentId: "permanent",
  stackObjectId: "stack",
  triggerId: "trigger",
  choiceRequestId: "choice",
  actionId: "action",
  eventId: "event",
  saveId: "save",
  notificationId: "notification",
});

const PRIVATE_TOKEN_PATTERNS = [/password/i, /token/i, /secret/i, /bearer/i, /auth/i];

export function createContractId(type = "id", seed = "") {
  const prefix = ID_PREFIX_BY_TYPE[type] || normalizeIdSegment(type) || "id";
  const safeSeed = normalizeIdSegment(seed);
  if (safeSeed) return `${prefix}_${safeSeed}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeContractId(value = "", type = "id") {
  const raw = String(value || "").trim();
  if (!raw || containsPrivateTokenHint(raw)) return createContractId(type);
  return raw.replace(/[^\w:.-]/g, "_").slice(0, 160);
}

export function normalizeFriendCode(value = "") {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function assertNoPrivateToken(value = "") {
  return !containsPrivateTokenHint(String(value || ""));
}

function normalizeIdSegment(value = "") {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
}

function containsPrivateTokenHint(value = "") {
  return PRIVATE_TOKEN_PATTERNS.some((pattern) => pattern.test(value));
}
