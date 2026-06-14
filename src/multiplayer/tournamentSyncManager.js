const TOURNAMENT_CHANNEL_PREFIX = "boardstate-tournament-sync";

const MESSAGE_BY_ACTION = {
  TOURNAMENT_CREATE: "tournament:create",
  TOURNAMENT_JOIN: "tournament:join",
  TOURNAMENT_ADD_PLAYER: "tournament:player-list",
  TOURNAMENT_REPORT_RESULT: "tournament:report-result",
  TOURNAMENT_CORRECT: "tournament:manual-correction",
  TOURNAMENT_ANNOUNCE: "tournament:announce-top-three",
  TOURNAMENT_END: "tournament:end",
};

export function createTournamentSyncManager({ onRemoteAction } = {}) {
  let channel = null;
  let sessionId = "";
  const peerId = `tournament-peer-${Math.random().toString(36).slice(2, 8)}`;
  const seen = new Set();

  function configure(tournament = {}) {
    teardown();
    if (!tournament.active || !tournament.sync?.sessionId || typeof BroadcastChannel === "undefined") {
      return;
    }
    sessionId = tournament.sync.sessionId;
    channel = new BroadcastChannel(`${TOURNAMENT_CHANNEL_PREFIX}:${sessionId}`);
    channel.onmessage = ({ data }) => {
      if (!data || data.namespace !== "tournament" || data.sessionId !== sessionId || data.peerId === peerId || seen.has(data.action?.actionId)) {
        return;
      }
      if (data.action?.actionId) seen.add(data.action.actionId);
      onRemoteAction?.(data.action, data.messageType);
    };
  }

  function sendAction(action, tournament = {}) {
    const messageType = MESSAGE_BY_ACTION[action?.actionType];
    if (!channel || !messageType || !action?.actionId || seen.has(action.actionId)) {
      return;
    }
    seen.add(action.actionId);
    channel.postMessage({
      namespace: "tournament",
      messageType,
      sessionId,
      peerId,
      action,
      updatedAt: tournament.updatedAt || Date.now(),
    });
  }

  function teardown() {
    channel?.close();
    channel = null;
    sessionId = "";
  }

  return { configure, sendAction, teardown };
}
