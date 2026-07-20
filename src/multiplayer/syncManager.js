import { ADVANCED_SYNC_EVENT_TYPES } from "../shared-session/perspective.js";

const LOCAL_CHANNEL_PREFIX = "boardstate-sync";

export function createSyncManager({ onRemoteAction, onPresence } = {}) {
  let mode = "offline";
  let roomId = "boardstate-room";
  let wsUrl = "ws://localhost:8787";
  let role = "player";
  let localName = "Player";
  let localChannel = null;
  let socket = null;
  let reconnectTimer = null;
  const seenActionIds = new Set();
  const seenEventIds = new Set();
  const localPeerId = `peer-${Math.random().toString(36).slice(2, 8)}`;

  function configure(nextMode = "offline", settings = {}) {
    teardown();
    mode = nextMode;
    roomId = settings.roomId || "boardstate-room";
    wsUrl = settings.wsUrl || "ws://localhost:8787";
    role = settings.role || "player";
    localName = settings.localName || "Player";
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
      namespace: "gameplay",
      messageType: "ACTION_SUBMITTED",
      roomId,
      peerId: localPeerId,
      action: sanitizeActionForSync(action),
      publicState: createPublicSyncState(state),
      activeInterfaceByPlayer: state.activeSession?.activeInterfaceByPlayer || {},
      sourceApp: "boardstate",
      capabilities: state.activeSession?.sessionCapabilities || {},
      sessionRevision: state.activeSession?.revision || 0,
      enforcementMode: state.activeSession?.enforcementMode || "enforced",
      rulesEngineVersion: state.activeSession?.rulesEngineVersion || "",
      schemaVersion: state.activeSession?.schemaVersion || "",
      syncProtocolVersion: state.activeSession?.syncProtocolVersion || "",
      advancedEvent: createAdvancedPresentationEvent(action, state),
      createdAt: Date.now(),
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
          name: localName,
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
    const advancedType = String(message.eventType || message.messageType || message.advancedEvent?.eventType || "").toUpperCase();
    const advancedEventId = message.eventId || message.messageId || message.advancedEvent?.eventId || message.action?.actionId || "";
    if (advancedType && ADVANCED_SYNC_EVENT_TYPES.includes(advancedType)) {
      if (message.namespace && message.namespace !== "gameplay") {
        return;
      }
      if (advancedEventId && seenEventIds.has(advancedEventId)) {
        return;
      }
      if (advancedEventId) {
        seenEventIds.add(advancedEventId);
      }
    }
    if ((message.type === "action" || advancedType === "ACTION_SUBMITTED") && message.action?.actionId) {
      if (seenActionIds.has(message.action.actionId)) {
        return;
      }
      seenActionIds.add(message.action.actionId);
      onRemoteAction?.(
        {
          ...message.action,
          remoteSyncMetadata: {
            namespace: message.namespace || "gameplay",
            messageType: message.messageType || advancedType || "ACTION_SUBMITTED",
            eventId: advancedEventId,
            sessionRevision: message.sessionRevision || message.publicState?.revision || 0,
            sourceApp: message.sourceApp || "boardstate",
            activeInterfaceByPlayer: message.activeInterfaceByPlayer || message.publicState?.activeInterfaceByPlayer || {},
          },
        },
        message.publicState || null
      );
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
    namespace: "gameplay",
    gameId: session.gameId || session.id || "",
    sessionId: session.sessionId || session.id || "",
    revision: Number(session.revision || 0),
    gameStateRevision: Number(session.gameStateRevision || session.revision || 0),
    eventRevision: Number(session.eventRevision || 0),
    eventKnowledge: {
      engineVersion: session.eventKnowledge?.engineVersion || "",
      eventCount: Number(session.eventKnowledge?.eventCount || 0),
      lastEventId: session.eventKnowledge?.lastEventId || "",
      lastEventRevision: Number(session.eventKnowledge?.lastEventRevision || 0),
    },
    sessionLifecycle: session.sessionLifecycle || "setup",
    hostParticipantId: session.hostParticipantId || "",
    participants: (session.participants || []).map((participant) => ({
      participantId: participant.participantId,
      displayName: participant.displayName,
      role: participant.role,
      connectionStatus: participant.connectionStatus,
      controlledPlayerIds: participant.controlledPlayerIds || [],
      sourceApp: participant.sourceApp || "boardstate",
    })),
    seats: (session.seats || []).map((seat) => ({
      seatId: seat.seatId,
      tableOrder: seat.tableOrder,
      displayOrder: seat.displayOrder,
      occupancyStatus: seat.occupancyStatus,
      assignedPlayerId: seat.assignedPlayerId,
      assignedParticipantId: seat.assignedParticipantId,
      previousSeatId: seat.previousSeatId,
      nextSeatId: seat.nextSeatId,
      carouselOrder: seat.carouselOrder,
    })),
    seatOrder: session.seatOrder || [],
    turnOrder: session.turnOrder || {},
    reconnectState: {
      reconnectVersion: session.reconnectState?.reconnectVersion || "",
      trustModel: session.reconnectState?.trustModel || "",
      cryptographicIdentityVerified: Boolean(session.reconnectState?.cryptographicIdentityVerified),
      lastReconnectAt: Number(session.reconnectState?.lastReconnectAt || 0),
    },
    schemaVersion: session.schemaVersion || "",
    rulesEngineVersion: session.rulesEngineVersion || "",
    syncProtocolVersion: session.syncProtocolVersion || "",
    enforcementMode: session.enforcementMode || "enforced",
    activeRuleWaivers: session.activeRuleWaivers || [],
    activeInterfaceByPlayer: session.activeInterfaceByPlayer || {},
    localInterfaceMode: session.localInterfaceMode || session.interfaceMode || "boardstate-advanced",
    capabilities: session.sessionCapabilities || {},
    capabilityManifest: session.capabilityManifest || {},
    priority: {
      activePlayerId: session.priority?.activePlayerId || "local-player",
      passedPlayerIds: session.priority?.passedPlayerIds || [],
      waiting: Boolean(session.priority?.waiting),
    },
    stack: (session.stack || []).map((object) => ({
      id: object.id,
      name: object.name || object.card?.name || "Stack Object",
      objectType: object.objectType || object.typeLine || "spell",
      controller: object.controller || "player",
      targetIds: object.targetIds || [],
      selectedModes: object.selectedModes || [],
      xValue: object.xValue,
      copied: Boolean(object.copied || object.isCopy),
      status: object.status || "pending",
    })),
    combat: {
      step: session.combat?.step || "idle",
      attackingPlayerId: session.combat?.attackingPlayerId || "local-player",
      defendingPlayerId: session.combat?.defendingPlayerId || "",
      attackerIds: session.combat?.attackerIds || [],
      attackTargetsByAttacker: session.combat?.attackTargetsByAttacker || {},
      blockersByAttacker: session.combat?.blockersByAttacker || {},
    },
    selectedTargetIds: session.selectedIds || [],
    presentation: sanitizePresentation(session.presentation),
    battlefield: {
      player: sanitizePermanents(session.battlefield.player),
      opponent: sanitizePermanents(session.battlefield.opponent),
    },
    triggerQueueSize: (session.triggerQueue || []).filter((entry) => entry.status === "pending").length,
    pendingChoices: (session.pendingEffects || [])
      .filter((entry) => !["resolved", "skipped", "ignored"].includes(entry.status))
      .map((entry) => ({
        id: entry.id,
        sourceName: entry.sourceName,
        controller: entry.controller || "",
        stackObjectId: entry.stackObjectId || "",
        choiceKind: entry.effect?.choiceKind || entry.effect?.action || "manual-choice",
        status: entry.status || "pending",
      })),
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
    controller: permanent.controller,
    owner: permanent.owner,
    attacking: permanent.attacking,
    blocking: permanent.blocking,
    markedDamage: permanent.markedDamage,
    loyalty: permanent.loyalty || permanent.counters?.Loyalty || 0,
    defense: permanent.defense || 0,
    attachments: permanent.attachments || [],
    attachedToId: permanent.attachedToId || "",
  }));
}

function sanitizePresentation(presentation = null) {
  if (!presentation || Number(presentation.expiresAt || 0) <= Date.now()) {
    return null;
  }
  return {
    id: presentation.id || "",
    kind: presentation.kind || "preview",
    controller: presentation.controller || "",
    card: {
      name: presentation.card?.name || "",
      typeLine: presentation.card?.typeLine || "",
      imageSmall: presentation.card?.imageSmall || "",
      imageUrl: presentation.card?.imageUrl || "",
    },
    expiresAt: presentation.expiresAt || 0,
    presentationOnly: true,
  };
}

function createAdvancedPresentationEvent(action = {}, state = {}) {
  const actionType = action.actionType || action.type || "";
  const session = state.activeSession || {};
  if (!["CAST_SPELL", "ADD_PERMANENT", "DECLARE_ATTACKERS", "CONFIRM_BLOCKERS", "PASS_PRIORITY", "RESOLVE_TOP_SPELL"].includes(actionType)) {
    return null;
  }
  const eventType = actionType === "CAST_SPELL"
    ? "SPELL_CAST"
    : actionType === "ADD_PERMANENT"
      ? "PERMANENT_ENTERED"
      : actionType === "DECLARE_ATTACKERS"
        ? "ATTACKERS_DECLARED"
        : actionType === "CONFIRM_BLOCKERS"
          ? "BLOCKERS_DECLARED"
          : actionType === "PASS_PRIORITY"
            ? "PLAYER_PASSED_PRIORITY"
            : "STACK_OBJECT_RESOLVED";
  return {
    eventId: action.actionId || `sync-event-${Date.now()}`,
    eventType,
    namespace: "gameplay",
    gameId: session.gameId || session.id || "",
    sessionId: session.sessionId || session.id || "",
    revision: session.revision || 0,
    playerId: action.playerId || "local-player",
    card: action.card ? {
      name: action.card.name,
      typeLine: action.card.typeLine,
      imageSmall: action.card.imageSmall,
      imageUrl: action.card.imageUrl,
    } : null,
    targetIds: action.targetIds || session.selectedIds || [],
    createdAt: Date.now(),
    presentationOnly: true,
  };
}
