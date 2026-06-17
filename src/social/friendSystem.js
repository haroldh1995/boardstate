import { createId, normalizeName } from "../state/ids.js";

const FRIEND_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const MEMORABLE_CODES = [
  "MAGE",
  "DRGN",
  "BOLT",
  "TAP4",
  "LAND",
  "STACK",
  "GOBLN",
  "ELF",
  "WIZRD",
  "SLAM",
  "FIRE",
  "HEX",
  "NERD",
  "DAMN",
  "HELL",
  "CRAP",
  "RAGE",
  "PUNT",
];
const UNSAFE_CODE_PATTERNS = [
  /SLUR/i,
  /NAZI/i,
  /KILL/i,
  /RAPE/i,
  /HATE/i,
  /TERROR/i,
  /FAG/i,
  /NIG/i,
  /CHINK/i,
  /TRANNY/i,
];

export const FRIEND_NAMESPACE = "friend";

export function createFriendState(source = {}) {
  const now = Date.now();
  const code = normalizeFriendCode(source.myFriendCode) || generateFriendCode(source.seed || "");
  return {
    myFriendCode: code,
    friendCodeCreatedAt: Number(source.friendCodeCreatedAt || now),
    friendCodeUpdatedAt: Number(source.friendCodeUpdatedAt || source.friendCodeCreatedAt || now),
    friendDisplayName: normalizeName(source.friendDisplayName, "Player"),
    friends: normalizeFriendList(source.friends),
    favoriteFriendIds: normalizeStringList(source.favoriteFriendIds),
    blockedFriendCodes: normalizeStringList(source.blockedFriendCodes).map(normalizeFriendCode).filter(Boolean),
    pendingFriendRequests: normalizePendingRequests(source.pendingFriendRequests),
    nearbyPlayers: normalizeNearbyPlayers(source.nearbyPlayers),
    invites: Array.isArray(source.invites) ? source.invites.slice(0, 40) : [],
    discovery: {
      status: normalizeName(source.discovery?.status, "local-discovery-unavailable"),
      message: normalizeName(
        source.discovery?.message,
        "Browser LAN discovery is unavailable. Use friend codes, invite links, or the WiFi relay room."
      ),
      lastRefreshAt: Number(source.discovery?.lastRefreshAt || 0),
      namespace: FRIEND_NAMESPACE,
    },
    lastError: normalizeName(source.lastError),
    historyLog: Array.isArray(source.historyLog) ? source.historyLog.slice(0, 80) : [],
  };
}

export function normalizeFriendState(source = {}) {
  return createFriendState(source || {});
}

export function normalizeFriendCode(value = "") {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

export function isValidFriendCode(value = "") {
  const code = normalizeFriendCode(value);
  return code.length >= 4 && code.length <= 6 && isSafeFriendCode(code);
}

export function isSafeFriendCode(value = "") {
  const code = normalizeFriendCode(value);
  return Boolean(code) && !UNSAFE_CODE_PATTERNS.some((pattern) => pattern.test(code));
}

export function generateFriendCode(seed = "") {
  const seeded = normalizeFriendCode(seed);
  if (seeded.length >= 4 && isSafeFriendCode(seeded)) {
    return seeded;
  }
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate =
      attempt < MEMORABLE_CODES.length
        ? MEMORABLE_CODES[Math.floor(Math.random() * MEMORABLE_CODES.length)]
        : randomAlphanumericCode(4 + Math.floor(Math.random() * 3));
    const code = normalizeFriendCode(candidate);
    if (code.length >= 4 && code.length <= 6 && isSafeFriendCode(code)) {
      return code;
    }
  }
  return randomAlphanumericCode(6);
}

export function regenerateFriendCode(profile, event = {}) {
  const friends = ensureFriendState(profile);
  const nextCode = generateFriendCode(event.seed);
  return withFriendState(profile, {
    ...friends,
    myFriendCode: nextCode,
    friendCodeUpdatedAt: Date.now(),
    historyLog: [friendHistory("friend:code-regenerated", `Friend code regenerated as ${nextCode}.`), ...friends.historyLog].slice(0, 80),
  });
}

export function setFriendDisplayName(profile, event = {}) {
  const friends = ensureFriendState(profile);
  const displayName = normalizeName(event.displayName || event.name, profile.player?.name || friends.friendDisplayName || "Player");
  return withFriendState(profile, {
    ...friends,
    friendDisplayName: displayName,
    historyLog: [friendHistory("friend:profile", `Friend display name set to ${displayName}.`), ...friends.historyLog].slice(0, 80),
  });
}

export function addFriendByCode(profile, event = {}) {
  const friends = ensureFriendState(profile);
  const code = normalizeFriendCode(event.friendCode || event.code);
  if (!isValidFriendCode(code)) {
    return withFriendNotice(profile, "Invalid code. Friend codes must be 4-6 safe letters/numbers.");
  }
  if (code === friends.myFriendCode) {
    return withFriendNotice(profile, "That is your own friend code.");
  }
  if ((friends.blockedFriendCodes || []).includes(code)) {
    return withFriendNotice(profile, "User blocked.");
  }
  if ((friends.friends || []).some((friend) => friend.friendCode === code)) {
    return withFriendNotice(profile, "Already friends.");
  }
  const friend = normalizeFriend({
    friendId: event.friendId || createId("friend"),
    friendCode: code,
    displayName: event.displayName || event.name || `Friend ${code}`,
    nickname: event.nickname || "",
    status: event.status || "Unknown",
    source: event.source || "code",
    notes: event.notes || "",
    lastKnownGameSessionId: event.gameSessionId || "",
    lastKnownTournamentSessionId: event.tournamentSessionId || "",
  });
  return withFriendState(profile, {
    ...friends,
    friends: [friend, ...(friends.friends || [])].slice(0, 120),
    historyLog: [friendHistory("friend:add", `${friend.displayName} added by friend code.`), ...friends.historyLog].slice(0, 80),
    lastError: "",
  });
}

export function acceptFriendRequest(profile, event = {}) {
  const friends = ensureFriendState(profile);
  const request = findFriendRequest(friends, event.requestId || event.friendCode || event.code);
  if (!request) {
    return withFriendNotice(profile, "Friend request not found.");
  }
  const withoutRequest = (friends.pendingFriendRequests || []).filter((entry) => entry.requestId !== request.requestId);
  const nextProfile = withFriendState(profile, { ...friends, pendingFriendRequests: withoutRequest });
  return addFriendByCode(nextProfile, {
    friendCode: request.friendCode,
    displayName: request.displayName,
    source: request.source || "request",
  });
}

export function receiveFriendRequest(profile, event = {}) {
  const friends = ensureFriendState(profile);
  const code = normalizeFriendCode(event.friendCode || event.code);
  if (!isValidFriendCode(code)) {
    return withFriendNotice(profile, "Invalid friend request code.");
  }
  if (code === friends.myFriendCode) {
    return profile;
  }
  if ((friends.blockedFriendCodes || []).includes(code)) {
    return withFriendNotice(profile, "User blocked.");
  }
  if ((friends.friends || []).some((friend) => friend.friendCode === code)) {
    return withFriendNotice(profile, "Already friends.");
  }
  const request = {
    requestId: normalizeName(event.requestId || event.id, createId("friend-request")),
    friendCode: code,
    displayName: normalizeName(event.displayName || event.name, `Friend ${code}`),
    source: normalizeName(event.source, "wifi-relay"),
    createdAt: Number(event.createdAt || Date.now()),
  };
  const existing = (friends.pendingFriendRequests || []).filter((entry) => entry.friendCode !== code);
  return withFriendState(profile, {
    ...friends,
    pendingFriendRequests: [request, ...existing].slice(0, 60),
    historyLog: [friendHistory("friend:request-received", `${request.displayName} sent a friend request.`), ...friends.historyLog].slice(0, 80),
    lastError: "",
  });
}

export function declineFriendRequest(profile, event = {}) {
  const friends = ensureFriendState(profile);
  const request = findFriendRequest(friends, event.requestId || event.friendCode || event.code);
  return withFriendState(profile, {
    ...friends,
    pendingFriendRequests: (friends.pendingFriendRequests || []).filter((entry) => entry.requestId !== request?.requestId),
    historyLog: [friendHistory("friend:request-declined", "Friend request declined."), ...friends.historyLog].slice(0, 80),
  });
}

export function removeFriend(profile, event = {}) {
  const friends = ensureFriendState(profile);
  const friendId = normalizeName(event.friendId || event.id);
  const friend = findFriend(friends, friendId);
  return withFriendState(profile, {
    ...friends,
    friends: (friends.friends || []).filter((entry) => entry.friendId !== friendId),
    favoriteFriendIds: (friends.favoriteFriendIds || []).filter((id) => id !== friendId),
    historyLog: [friendHistory("friend:remove", `${friend?.displayName || "Friend"} removed.`), ...friends.historyLog].slice(0, 80),
  });
}

export function blockFriend(profile, event = {}) {
  const friends = ensureFriendState(profile);
  const friend = findFriend(friends, event.friendId || event.friendCode || event.code);
  const code = normalizeFriendCode(event.friendCode || event.code || friend?.friendCode);
  if (!code) {
    return withFriendNotice(profile, "No friend code to block.");
  }
  return withFriendState(profile, {
    ...friends,
    friends: (friends.friends || []).filter((entry) => entry.friendCode !== code),
    favoriteFriendIds: (friends.favoriteFriendIds || []).filter((id) => id !== friend?.friendId),
    blockedFriendCodes: [...new Set([...(friends.blockedFriendCodes || []), code])],
    nearbyPlayers: (friends.nearbyPlayers || []).filter((entry) => normalizeFriendCode(entry.friendCode) !== code),
    historyLog: [friendHistory("friend:block", `${code} blocked.`), ...friends.historyLog].slice(0, 80),
  });
}

export function unblockFriend(profile, event = {}) {
  const friends = ensureFriendState(profile);
  const code = normalizeFriendCode(event.friendCode || event.code);
  return withFriendState(profile, {
    ...friends,
    blockedFriendCodes: (friends.blockedFriendCodes || []).filter((entry) => entry !== code),
    historyLog: [friendHistory("friend:unblock", `${code} unblocked.`), ...friends.historyLog].slice(0, 80),
  });
}

export function toggleFavoriteFriend(profile, event = {}) {
  const friends = ensureFriendState(profile);
  const friendId = normalizeName(event.friendId || event.id);
  const favoriteIds = new Set(friends.favoriteFriendIds || []);
  const nextFavorite = event.favorite === undefined ? !favoriteIds.has(friendId) : Boolean(event.favorite);
  if (nextFavorite) {
    favoriteIds.add(friendId);
  } else {
    favoriteIds.delete(friendId);
  }
  return withFriendState(profile, {
    ...friends,
    favoriteFriendIds: [...favoriteIds],
    friends: (friends.friends || []).map((friend) => (friend.friendId === friendId ? { ...friend, favorite: nextFavorite } : friend)),
  });
}

export function updateFriendProfile(profile, event = {}) {
  const friends = ensureFriendState(profile);
  const friendId = normalizeName(event.friendId || event.id);
  return withFriendState(profile, {
    ...friends,
    friends: (friends.friends || []).map((friend) =>
      friend.friendId === friendId
        ? normalizeFriend({
            ...friend,
            nickname: event.nickname ?? friend.nickname,
            notes: event.notes ?? friend.notes,
            displayName: event.displayName ?? friend.displayName,
          })
        : friend
    ),
  });
}

export function refreshNearbyDiscovery(profile, event = {}) {
  const friends = ensureFriendState(profile);
  const peers = Array.isArray(event.peers) ? event.peers : [];
  const nearbyPlayers = peers.length ? mergeNearbyPlayers(friends, peers) : friends.nearbyPlayers;
  const status = peers.length
    ? "found-nearby-players"
    : event.wifiAvailable
      ? "no-nearby-players"
      : "local-discovery-unavailable";
  const message =
    peers.length
      ? `Found ${peers.length} nearby BoardState player${peers.length === 1 ? "" : "s"}.`
      : event.wifiAvailable
        ? "No nearby players found in the current WiFi relay room."
        : "True browser LAN discovery is unavailable. Use the WiFi relay room, friend code, or invite link fallback.";
  return withFriendState(profile, {
    ...friends,
    nearbyPlayers,
    discovery: {
      ...friends.discovery,
      status,
      message,
      lastRefreshAt: Date.now(),
      namespace: FRIEND_NAMESPACE,
    },
  });
}

export function upsertNearbyPlayers(profile, event = {}) {
  const friends = ensureFriendState(profile);
  return withFriendState(profile, {
    ...friends,
    nearbyPlayers: mergeNearbyPlayers(friends, event.peers || event.players || []),
    discovery: {
      ...friends.discovery,
      status: "found-nearby-players",
      message: "Nearby WiFi relay presence updated.",
      lastRefreshAt: Date.now(),
      namespace: FRIEND_NAMESPACE,
    },
  });
}

export function hideNearbyPlayer(profile, event = {}) {
  const friends = ensureFriendState(profile);
  const id = normalizeName(event.temporaryDiscoveryId || event.discoveryId || event.friendCode);
  return withFriendState(profile, {
    ...friends,
    nearbyPlayers: (friends.nearbyPlayers || []).filter(
      (entry) => entry.temporaryDiscoveryId !== id && normalizeFriendCode(entry.friendCode) !== normalizeFriendCode(id)
    ),
  });
}

export function inviteFriendToGame(profile, event = {}) {
  const friends = ensureFriendState(profile);
  const friend = findFriend(friends, event.friendId || event.friendCode || event.code);
  if (!friend) {
    return withFriendNotice(profile, "Friend not found.");
  }
  const sessionId = event.sessionId || profile.settings?.multiplayer?.roomId || profile.activeSession?.id || "boardstate-room";
  const invite = createFriendInvite("game", friend, {
    sessionId,
    wsUrl: event.wsUrl || profile.settings?.multiplayer?.wsUrl || "ws://localhost:8787",
    namespace: "game",
  });
  return withFriendState(profile, {
    ...friends,
    invites: [invite, ...(friends.invites || [])].slice(0, 40),
    friends: touchFriendSession(friends.friends, friend.friendId, "lastKnownGameSessionId", sessionId),
    historyLog: [friendHistory("friend:game-invite", `Game invite prepared for ${friend.displayName}.`), ...friends.historyLog].slice(0, 80),
  });
}

export function inviteFriendToTournament(profile, event = {}) {
  const friends = ensureFriendState(profile);
  const friend = findFriend(friends, event.friendId || event.friendCode || event.code);
  if (!friend) {
    return withFriendNotice(profile, "Friend not found.");
  }
  const tournament = profile.tournament || {};
  const sessionId = event.sessionId || tournament.joinCode || tournament.sync?.sessionId || "";
  if (!sessionId) {
    return withFriendNotice(profile, "Create or join a tournament before inviting friends.");
  }
  const invite = createFriendInvite("tournament", friend, {
    sessionId,
    wsUrl: event.wsUrl || tournament.sync?.wsUrl || profile.settings?.multiplayer?.wsUrl || "ws://localhost:8787",
    namespace: "tournament",
  });
  return withFriendState(profile, {
    ...friends,
    invites: [invite, ...(friends.invites || [])].slice(0, 40),
    friends: touchFriendSession(friends.friends, friend.friendId, "lastKnownTournamentSessionId", sessionId),
    historyLog: [friendHistory("friend:tournament-invite", `Tournament invite prepared for ${friend.displayName}.`), ...friends.historyLog].slice(0, 80),
  });
}

export function sanitizeFriendDiscoveryPayload(profile = {}) {
  const friends = ensureFriendState(profile);
  return {
    namespace: FRIEND_NAMESPACE,
    friendCode: friends.myFriendCode,
    displayName: friends.friendDisplayName || profile.player?.name || "Player",
    status: profile.tournament?.active ? "In Tournament" : profile.activeSession?.syncedMultiplayer?.active ? "In Game" : "Online",
    gameSessionId: profile.settings?.multiplayer?.roomId || "",
    tournamentSessionId: profile.tournament?.joinCode || profile.tournament?.sync?.sessionId || "",
  };
}

export function buildFriendInviteLink(invite = {}, locationLike = globalThis.location) {
  const type = String(invite.inviteType || invite.type || "game").toLowerCase();
  const sessionId = normalizeName(invite.sessionId || invite.gameSessionId || invite.tournamentSessionId);
  if (!sessionId) {
    return "";
  }
  const origin = locationLike?.origin || "";
  const pathname = locationLike?.pathname || "/";
  const route = type === "tournament" ? "tournament/join" : "game/join";
  return `${origin}${pathname}#${route}/${encodeURIComponent(sessionId)}`;
}

export function ensureFriendState(profile = {}) {
  return normalizeFriendState(profile.friends || { friendDisplayName: profile.player?.name });
}

function withFriendState(profile, friends) {
  return {
    ...profile,
    friends: normalizeFriendState(friends),
  };
}

function withFriendNotice(profile, message) {
  const friends = ensureFriendState(profile);
  return withFriendState(profile, {
    ...friends,
    lastError: message,
    historyLog: [friendHistory("friend:notice", message), ...friends.historyLog].slice(0, 80),
  });
}

function normalizeFriendList(friends = []) {
  return Array.isArray(friends) ? friends.map(normalizeFriend).filter((friend) => friend.friendCode).slice(0, 120) : [];
}

function normalizeFriend(source = {}) {
  const favorite = Boolean(source.favorite);
  return {
    friendId: normalizeName(source.friendId || source.id, createId("friend")),
    friendCode: normalizeFriendCode(source.friendCode || source.code),
    displayName: normalizeName(source.displayName || source.name, "Friend"),
    nickname: normalizeName(source.nickname),
    favorite,
    blocked: Boolean(source.blocked),
    status: normalizeName(source.status, "Unknown"),
    lastSeen: Number(source.lastSeen || 0),
    addedAt: Number(source.addedAt || Date.now()),
    source: normalizeName(source.source, "code"),
    notes: normalizeName(source.notes),
    lastKnownGameSessionId: normalizeName(source.lastKnownGameSessionId),
    lastKnownTournamentSessionId: normalizeName(source.lastKnownTournamentSessionId),
  };
}

function normalizeNearbyPlayers(players = []) {
  return Array.isArray(players)
    ? players
        .map((player) => ({
          temporaryDiscoveryId: normalizeName(player.temporaryDiscoveryId || player.id || createId("nearby")),
          friendCode: normalizeFriendCode(player.friendCode || player.code),
          displayName: normalizeName(player.displayName || player.name, "Nearby Player"),
          status: normalizeName(player.status, "Nearby"),
          discoveredAt: Number(player.discoveredAt || Date.now()),
          source: normalizeName(player.source, "wifi-relay"),
          canInviteToGame: player.canInviteToGame !== false,
          canInviteToTournament: player.canInviteToTournament !== false,
          gameSessionId: normalizeName(player.gameSessionId),
          tournamentSessionId: normalizeName(player.tournamentSessionId),
        }))
        .filter((player) => player.friendCode || player.temporaryDiscoveryId)
        .slice(0, 60)
    : [];
}

function normalizePendingRequests(requests = []) {
  return Array.isArray(requests)
    ? requests
        .map((request) => ({
          requestId: normalizeName(request.requestId || request.id, createId("friend-request")),
          friendCode: normalizeFriendCode(request.friendCode || request.code),
          displayName: normalizeName(request.displayName || request.name, "Friend Request"),
          source: normalizeName(request.source, "nearby"),
          createdAt: Number(request.createdAt || Date.now()),
        }))
        .filter((request) => request.friendCode)
        .slice(0, 60)
    : [];
}

function normalizeStringList(values = []) {
  return Array.isArray(values) ? values.map((value) => String(value || "").trim()).filter(Boolean) : [];
}

function mergeNearbyPlayers(friends, peers = []) {
  const blockedCodes = new Set(friends.blockedFriendCodes || []);
  const friendByCode = new Map((friends.friends || []).map((friend) => [friend.friendCode, friend]));
  const existing = new Map((friends.nearbyPlayers || []).map((player) => [player.friendCode || player.temporaryDiscoveryId, player]));
  peers.forEach((peer) => {
    const friendCode = normalizeFriendCode(peer.friendCode || peer.code);
    if (friendCode && blockedCodes.has(friendCode)) {
      return;
    }
    const friend = friendByCode.get(friendCode);
    const next = {
      temporaryDiscoveryId: normalizeName(peer.temporaryDiscoveryId || peer.id || friendCode || createId("nearby")),
      friendCode,
      displayName: normalizeName(peer.displayName || peer.name || friend?.displayName, "Nearby Player"),
      status: friend ? "Nearby Friend" : normalizeName(peer.status, "Nearby"),
      discoveredAt: Date.now(),
      source: normalizeName(peer.source, "wifi-relay"),
      canInviteToGame: peer.canInviteToGame !== false,
      canInviteToTournament: peer.canInviteToTournament !== false,
      gameSessionId: normalizeName(peer.gameSessionId),
      tournamentSessionId: normalizeName(peer.tournamentSessionId),
    };
    existing.set(next.friendCode || next.temporaryDiscoveryId, next);
  });
  return [...existing.values()].slice(0, 60);
}

function findFriend(friends, idOrCode = "") {
  const normalized = normalizeFriendCode(idOrCode);
  const raw = normalizeName(idOrCode);
  return (friends.friends || []).find((friend) => friend.friendId === raw || friend.friendCode === normalized);
}

function findFriendRequest(friends, idOrCode = "") {
  const normalized = normalizeFriendCode(idOrCode);
  const raw = normalizeName(idOrCode);
  return (friends.pendingFriendRequests || []).find((request) => request.requestId === raw || request.friendCode === normalized);
}

function createFriendInvite(type, friend, metadata = {}) {
  return {
    inviteId: createId("friend-invite"),
    inviteType: type,
    namespace: type === "tournament" ? "tournament" : "game",
    friendId: friend.friendId,
    friendCode: friend.friendCode,
    friendName: friend.displayName,
    sessionId: metadata.sessionId || "",
    wsUrl: metadata.wsUrl || "",
    status: "pending",
    createdAt: Date.now(),
  };
}

function touchFriendSession(friends = [], friendId = "", key = "", value = "") {
  return friends.map((friend) =>
    friend.friendId === friendId
      ? {
          ...friend,
          [key]: value,
          lastSeen: Date.now(),
        }
      : friend
  );
}

function friendHistory(type, message) {
  return {
    id: createId("friend-log"),
    at: Date.now(),
    type,
    message,
  };
}

function randomAlphanumericCode(length = 6) {
  let code = "";
  for (let index = 0; index < length; index += 1) {
    code += FRIEND_CODE_ALPHABET[Math.floor(Math.random() * FRIEND_CODE_ALPHABET.length)];
  }
  return code;
}
