import { FRIEND_NAMESPACE, sanitizeFriendDiscoveryPayload } from "../social/friendSystem.js";

const FRIEND_CHANNEL_PREFIX = "boardstate-friend-sync";

const MESSAGE_BY_ACTION = {
  FRIEND_ADD_BY_CODE: "friend:request",
  FRIEND_ACCEPT_REQUEST: "friend:accepted",
  FRIEND_DECLINE_REQUEST: "friend:declined",
  FRIEND_REMOVE: "friend:removed",
  FRIEND_BLOCK: "friend:blocked",
  FRIEND_INVITE_GAME: "friend:game-invite",
  FRIEND_INVITE_TOURNAMENT: "friend:tournament-invite",
  FRIEND_JOIN_GAME: "friend:game-join",
  FRIEND_JOIN_TOURNAMENT: "friend:tournament-join",
  FRIEND_REFRESH_NEARBY: "friend:nearby-refresh",
};

export function createFriendSyncManager({ onRemoteAction, onNearbyPlayers, onStatus } = {}) {
  let channel = null;
  let socket = null;
  let mode = "offline";
  let roomId = "friend:local";
  let wsUrl = "ws://localhost:8787";
  let localPayload = null;
  let reconnectTimer = null;
  let joined = false;
  let lastStatus = "";
  const peerId = `friend-peer-${Math.random().toString(36).slice(2, 8)}`;
  const seen = new Set();
  const pendingPayloads = [];

  function configure(profile = {}, multiplayerSettings = {}) {
    teardown({ keepPending: true });
    localPayload = sanitizeFriendDiscoveryPayload(profile);
    const requestedMode = String(profile.friends?.discovery?.mode || multiplayerSettings.mode || "").toLowerCase();
    mode = requestedMode === "wifi" ? "wifi" : requestedMode === "local" ? "local" : "local";
    const baseRoom = multiplayerSettings.roomId || "boardstate-room";
    roomId = `friend:${baseRoom}`;
    wsUrl = multiplayerSettings.wsUrl || "ws://localhost:8787";
    if (mode === "wifi") {
      initWebSocket();
      return;
    }
    initBroadcastChannel();
  }

  function refresh(profile = {}) {
    localPayload = sanitizeFriendDiscoveryPayload(profile);
    sendPresence();
  }

  function sendAction(action, profile = {}) {
    const messageType = MESSAGE_BY_ACTION[action?.actionType || action?.type];
    if (!messageType || !action?.actionId || seen.has(action.actionId)) {
      return;
    }
    seen.add(action.actionId);
    const payload = {
      type: "friend-message",
      namespace: FRIEND_NAMESPACE,
      messageType,
      roomId,
      peerId,
      action: sanitizeFriendAction(action),
      publicProfile: sanitizeFriendDiscoveryPayload(profile),
      updatedAt: Date.now(),
    };
    post(payload);
  }

  function teardown(options = {}) {
    channel?.close();
    channel = null;
    if (socket) {
      socket.onopen = null;
      socket.onclose = null;
      socket.onmessage = null;
      socket.close();
      socket = null;
    }
    joined = false;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    if (!options.keepPending) {
      pendingPayloads.length = 0;
    }
    lastStatus = "";
  }

  function initBroadcastChannel() {
    if (typeof BroadcastChannel === "undefined") {
      notifyStatus("local-discovery-unavailable", "Friend Discovery Fallback", "This browser cannot open local discovery channels. Use friend codes or invite links.");
      return;
    }
    channel = new BroadcastChannel(`${FRIEND_CHANNEL_PREFIX}:${roomId}`);
    channel.onmessage = ({ data }) => handleIncoming(data);
    sendPresence();
    notifyStatus("local-discovery-ready", "Friend Discovery Ready", "Friend discovery is watching this browser room.");
  }

  function initWebSocket() {
    if (typeof WebSocket === "undefined") {
      notifyStatus("wifi-unavailable", "Friend WiFi Relay Missing", "This browser does not support WebSocket relay discovery.");
      return;
    }
    try {
      socket = new WebSocket(wsUrl);
    } catch {
      scheduleReconnect();
      return;
    }
    socket.onopen = () => {
      joined = true;
      socket.send(JSON.stringify({
        type: "join",
        namespace: FRIEND_NAMESPACE,
        roomId,
        peerId,
        name: localPayload?.displayName || "Player",
        role: "friend",
        friendCode: localPayload?.friendCode || "",
        publicProfile: localPayload,
      }));
      notifyStatus("wifi-connected", "Friend WiFi Connected", "Friend discovery relay is connected.");
      flushPending();
      sendPresence();
    };
    socket.onmessage = ({ data }) => {
      try {
        handleIncoming(JSON.parse(data));
      } catch {
        // Ignore malformed friend discovery messages.
      }
    };
    socket.onclose = scheduleReconnect;
  }

  function sendPresence() {
    const payload = {
      type: "friend-presence",
      namespace: FRIEND_NAMESPACE,
      roomId,
      peerId,
      publicProfile: localPayload,
      updatedAt: Date.now(),
    };
    post(payload);
  }

  function post(payload) {
    if (channel) {
      channel.postMessage(payload);
      return;
    }
    if (mode === "wifi" && joined && socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
      return;
    }
    if (mode === "wifi") {
      pendingPayloads.push(payload);
    }
  }

  function handleIncoming(message) {
    if (!message || message.peerId === peerId || message.roomId !== roomId || message.namespace !== FRIEND_NAMESPACE) {
      return;
    }
    if (message.type === "presence" && Array.isArray(message.peers)) {
      onNearbyPlayers?.(message.peers.map(mapRelayPeer));
      return;
    }
    if (message.type === "friend-presence" && message.publicProfile) {
      onNearbyPlayers?.([mapPublicProfile(message.publicProfile, message.peerId)]);
      return;
    }
    if (message.type === "friend-message" && message.action?.actionId) {
      if (seen.has(message.action.actionId)) {
        return;
      }
      seen.add(message.action.actionId);
      onRemoteAction?.(message.action, message.messageType, message.publicProfile || null);
    }
  }

  function flushPending() {
    if (socket?.readyState !== WebSocket.OPEN) {
      return;
    }
    while (pendingPayloads.length) {
      socket.send(JSON.stringify(pendingPayloads.shift()));
    }
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    notifyStatus("wifi-reconnecting", "Friend WiFi Reconnecting", "Friend discovery relay disconnected. BoardState will keep trying.");
    reconnectTimer = setTimeout(() => {
      if (mode === "wifi") {
        initWebSocket();
      }
    }, 1200);
  }

  function notifyStatus(status, title, body) {
    if (status === lastStatus) {
      return;
    }
    lastStatus = status;
    onStatus?.({
      status,
      title,
      body,
      eventKey: "nearbyFriend",
      severity: status.includes("connected") || status.includes("ready") ? "success" : "warning",
    });
  }

  return {
    configure,
    refresh,
    sendAction,
    teardown,
  };
}

function sanitizeFriendAction(action = {}) {
  return {
    actionId: action.actionId,
    actionType: action.actionType || action.type,
    friendId: action.friendId || "",
    friendCode: action.friendCode || action.code || "",
    sessionId: action.sessionId || "",
    tournamentSessionId: action.tournamentSessionId || "",
    gameSessionId: action.gameSessionId || "",
    createdAt: action.timestamp || Date.now(),
  };
}

function mapRelayPeer(peer = {}) {
  return {
    temporaryDiscoveryId: peer.id || "",
    friendCode: peer.friendCode || peer.publicProfile?.friendCode || "",
    displayName: peer.name || peer.publicProfile?.displayName || "Nearby Player",
    status: peer.namespace === FRIEND_NAMESPACE ? "Nearby" : "Nearby relay peer",
    source: "wifi-relay",
    gameSessionId: peer.publicProfile?.gameSessionId || "",
    tournamentSessionId: peer.publicProfile?.tournamentSessionId || "",
    canInviteToGame: true,
    canInviteToTournament: true,
  };
}

function mapPublicProfile(publicProfile = {}, peerId = "") {
  return {
    temporaryDiscoveryId: peerId || publicProfile.friendCode || "",
    friendCode: publicProfile.friendCode || "",
    displayName: publicProfile.displayName || "Nearby Player",
    status: publicProfile.status || "Nearby",
    source: "friend-presence",
    gameSessionId: publicProfile.gameSessionId || "",
    tournamentSessionId: publicProfile.tournamentSessionId || "",
    canInviteToGame: true,
    canInviteToTournament: true,
  };
}
