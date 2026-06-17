const TOURNAMENT_CHANNEL_PREFIX = "boardstate-tournament-sync";

const MESSAGE_BY_ACTION = {
  TOURNAMENT_CREATE: "tournament:create",
  TOURNAMENT_JOIN: "tournament:join",
  TOURNAMENT_SET_PINNED: "tournament:local-pin",
  TOURNAMENT_ADD_PLAYER: "tournament:player-list",
  TOURNAMENT_ADD_SAMPLE_PLAYERS: "tournament:player-list",
  TOURNAMENT_REMOVE_PLAYER: "tournament:player-list",
  TOURNAMENT_GENERATE_ROUND: "tournament:round-create",
  TOURNAMENT_START_ROUND: "tournament:round-update",
  TOURNAMENT_EDIT_TABLE: "tournament:round-update",
  TOURNAMENT_REPORT_RESULT: "tournament:report-result",
  TOURNAMENT_START_SUDDEN_DEATH: "tournament:sudden-death-start",
  TOURNAMENT_START_EXTENSION: "tournament:sudden-death-extension",
  TOURNAMENT_EXTENSION_TURN: "tournament:sudden-death-extension",
  TOURNAMENT_CORRECT: "tournament:manual-correction",
  TOURNAMENT_ANNOUNCE: "tournament:announce-top-three",
  TOURNAMENT_END: "tournament:end",
};

export function createTournamentSyncManager({ onRemoteAction, onPresence, onStatus } = {}) {
  let channel = null;
  let sessionId = "";
  let mode = "local";
  let roomId = "";
  let wsUrl = "ws://localhost:8787";
  let socket = null;
  let roomJoined = false;
  let reconnectTimer = null;
  let lastStatus = "";
  const pendingPayloads = [];
  const peerId = `tournament-peer-${Math.random().toString(36).slice(2, 8)}`;
  const seen = new Set();

  function configure(tournament = {}, multiplayerSettings = {}) {
    if (!tournament.active || !tournament.sync?.sessionId) {
      teardown();
      return;
    }
    const nextSessionId = tournament.sync.sessionId;
    const tournamentMode = String(tournament.sync?.mode || "").toLowerCase();
    const settingsMode = String(multiplayerSettings.mode || "").toLowerCase();
    const nextMode = tournamentMode ? (tournamentMode === "wifi" ? "wifi" : "local") : settingsMode === "wifi" ? "wifi" : "local";
    const nextWsUrl = tournament.sync?.wsUrl || multiplayerSettings.wsUrl || "ws://localhost:8787";
    const nextRoomId = getTournamentRoomId(nextSessionId);
    if ((channel || socket) && sessionId === nextSessionId && mode === nextMode && wsUrl === nextWsUrl && roomId === nextRoomId) {
      return;
    }
    teardown({ keepPending: true });
    sessionId = nextSessionId;
    mode = nextMode;
    wsUrl = nextWsUrl;
    roomId = nextRoomId;
    if (mode === "wifi") {
      initWebSocket(tournament);
      return;
    }
    initBroadcastChannel();
  }

  function initBroadcastChannel() {
    if (typeof BroadcastChannel === "undefined") {
      return;
    }
    channel = new BroadcastChannel(`${TOURNAMENT_CHANNEL_PREFIX}:${sessionId}`);
    channel.onmessage = ({ data }) => {
      handleIncoming(data);
    };
  }

  function initWebSocket(tournament = {}) {
    if (typeof WebSocket === "undefined") {
      return;
    }
    try {
      socket = new WebSocket(wsUrl);
    } catch {
      scheduleReconnect(tournament);
      return;
    }
    socket.onopen = () => {
      socket.send(JSON.stringify({
        type: "join",
        namespace: "tournament",
        roomId,
        sessionId,
        peerId,
        name: tournament.hostName || tournament.localPlayerName || "Tournament player",
        role: tournament.role || "player",
      }));
      roomJoined = true;
      notifyStatus("wifi-connected", "Tournament Sync Reconnected", "Tournament WiFi relay is connected.");
      flushPending();
    };
    socket.onmessage = ({ data }) => {
      try {
        handleIncoming(JSON.parse(data));
      } catch {
        // Ignore malformed tournament sync payloads.
      }
    };
    socket.onclose = () => scheduleReconnect(tournament);
  }

  function sendAction(action, tournament = {}) {
    const messageType = MESSAGE_BY_ACTION[action?.actionType];
    if (!messageType || !action?.actionId || seen.has(action.actionId)) {
      return;
    }
    seen.add(action.actionId);
    const payload = {
      type: "tournament-action",
      namespace: "tournament",
      messageType,
      roomId,
      sessionId,
      peerId,
      action,
      updatedAt: tournament.updatedAt || Date.now(),
    };
    if (channel) {
      channel.postMessage(payload);
      return;
    }
    if (mode === "wifi" && roomJoined && typeof WebSocket !== "undefined" && socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
      return;
    }
    if (mode === "wifi") {
      pendingPayloads.push(payload);
    }
  }

  function handleIncoming(data) {
    if (!data || data.peerId === peerId) {
      return;
    }
    const dataSessionId = data.sessionId || String(data.roomId || "").replace(/^tournament:/, "");
    if (data.namespace !== "tournament" || dataSessionId !== sessionId) {
      return;
    }
    if (data.type === "presence" && Array.isArray(data.peers)) {
      onPresence?.(data.peers);
      return;
    }
    if (data.action?.actionId) {
      if (seen.has(data.action.actionId)) {
        return;
      }
      seen.add(data.action.actionId);
      onRemoteAction?.(data.action, data.messageType);
    }
  }

  function flushPending() {
    if (typeof WebSocket === "undefined" || socket?.readyState !== WebSocket.OPEN) {
      return;
    }
    while (pendingPayloads.length) {
      socket.send(JSON.stringify(pendingPayloads.shift()));
    }
  }

  function scheduleReconnect(tournament = {}) {
    clearTimeout(reconnectTimer);
    notifyStatus("wifi-reconnecting", "Tournament Sync Reconnecting", "Tournament WiFi relay disconnected. BoardState will keep trying to reconnect.");
    reconnectTimer = setTimeout(() => {
      if (mode === "wifi") {
        initWebSocket(tournament);
      }
    }, 1200);
  }

  function notifyStatus(status, title, body) {
    if (lastStatus === status) {
      return;
    }
    lastStatus = status;
    onStatus?.({
      status,
      title,
      body,
      eventKey: "syncReconnect",
      severity: status === "wifi-connected" ? "success" : "warning",
    });
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
    roomJoined = false;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    if (!options.keepPending) {
      pendingPayloads.length = 0;
    }
    sessionId = "";
    mode = "local";
    roomId = "";
    lastStatus = "";
  }

  return { configure, sendAction, teardown };
}

function getTournamentRoomId(id = "") {
  return `tournament:${id || "local"}`;
}
