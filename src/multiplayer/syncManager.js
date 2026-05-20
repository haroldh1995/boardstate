const LOCAL_CHANNEL_PREFIX = "boardstate-sync";

export function createSyncManager({ onRemoteAction, onPresence } = {}) {
  let mode = "offline";
  let roomId = "boardstate-room";
  let wsUrl = "ws://localhost:8787";
  let role = "player";
  let localChannel = null;
  let socket = null;
  let reconnectTimer = null;
  const seenActionIds = new Set();
  const localPeerId = `peer-${Math.random().toString(36).slice(2, 8)}`;

  function configure(nextMode = "offline", settings = {}) {
    teardown();
    mode = nextMode;
    roomId = settings.roomId || "boardstate-room";
    wsUrl = settings.wsUrl || "ws://localhost:8787";
    role = settings.role || "player";
    if (mode === "local") {
      initBroadcastChannel();
    }
    if (mode === "wifi") {
      initWebSocket();
    }
    if (mode === "simulated") {
      const simulatedPlayers = Array.isArray(settings.simulatedPlayers) ? settings.simulatedPlayers : [];
      onPresence?.([
        { id: "local-player", name: settings.localName || "Player", role },
        ...simulatedPlayers.map((player) => ({
          id: player.id,
          name: player.name,
          role: player.role || "player",
        })),
      ]);
    }
  }

  function sendAction(action, state) {
    if (!action?.actionId || !action?.replayable || role === "spectator") {
      return;
    }
    if (seenActionIds.has(action.actionId)) {
      return;
    }
    seenActionIds.add(action.actionId);
    const payload = {
      type: "action",
      roomId,
      peerId: localPeerId,
      action: sanitizeActionForSync(action),
      publicState: createPublicSyncState(state),
    };
    if (localChannel) {
      localChannel.postMessage(payload);
    }
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }

  function teardown() {
    if (localChannel) {
      localChannel.close();
      localChannel = null;
    }
    if (socket) {
      socket.onopen = null;
      socket.onclose = null;
      socket.onmessage = null;
      socket.close();
      socket = null;
    }
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  function initBroadcastChannel() {
    localChannel = new BroadcastChannel(`${LOCAL_CHANNEL_PREFIX}:${roomId}`);
    localChannel.onmessage = ({ data }) => handleIncoming(data);
    onPresence?.([{ id: localPeerId, name: "Local Peer", role }]);
  }

  function initWebSocket() {
    try {
      socket = new WebSocket(wsUrl);
    } catch {
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: "join",
          roomId,
          peerId: localPeerId,
          role,
        })
      );
    };

    socket.onmessage = ({ data }) => {
      try {
        const message = JSON.parse(data);
        handleIncoming(message);
      } catch {
        // Ignore malformed payloads.
      }
    };

    socket.onclose = () => {
      scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      if (mode === "wifi") {
        initWebSocket();
      }
    }, 1200);
  }

  function handleIncoming(message) {
    if (!message || message.peerId === localPeerId || message.roomId !== roomId) {
      return;
    }
    if (message.type === "presence" && Array.isArray(message.peers)) {
      onPresence?.(message.peers);
      return;
    }
    if (message.type === "action" && message.action?.actionId) {
      if (seenActionIds.has(message.action.actionId)) {
        return;
      }
      seenActionIds.add(message.action.actionId);
      onRemoteAction?.(message.action, message.publicState || null);
    }
  }

  return {
    configure,
    sendAction,
    teardown,
  };
}

function sanitizeActionForSync(action) {
  return {
    ...action,
    payload: action.payload || {},
    targetIds: Array.isArray(action.targetIds) ? action.targetIds : [],
  };
}

function createPublicSyncState(state) {
  const session = state.activeSession;
  return {
    player: { name: state.player?.name || "Player" },
    life: session.life,
    turn: session.turn,
    phaseIndex: session.phaseIndex,
    battlefield: {
      player: sanitizePermanents(session.battlefield.player),
      opponent: sanitizePermanents(session.battlefield.opponent),
    },
    triggerQueueSize: (session.triggerQueue || []).filter((entry) => entry.status === "pending").length,
    updatedAt: Date.now(),
  };
}

function sanitizePermanents(permanents = []) {
  return permanents.map((permanent) => ({
    id: permanent.id,
    name: permanent.name,
    typeLine: permanent.typeLine,
    tapped: permanent.tapped,
    quantity: permanent.quantity,
    counters: permanent.counters,
    currentPower: permanent.currentPower,
    currentToughness: permanent.currentToughness,
    isToken: permanent.isToken,
    isCommander: permanent.isCommander,
  }));
}
