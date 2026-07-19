import {
  APP_IDS,
  CONNECTION_STATUSES,
  CONTROLLER_TYPES,
  INTERFACE_MODES,
  VISIBILITY_LEVELS,
  buildStableChecksum,
  clonePlain,
  createDeckSnapshot,
  createSessionCapabilities,
  createSharedGameSession,
} from "./contracts.js";
import {
  DEFAULT_RULES_ENGINE_VERSION,
  SHARED_CONTRACT_SCHEMA_VERSION,
  SHARED_SAVE_FORMAT_VERSION,
  SHARED_SYNC_PROTOCOL_VERSION,
} from "./version.js";
import { createContractId, normalizeContractId } from "./ids.js";
import {
  COMMANDER_MODERNIZATION_INPUT_MODES,
  MODERNIZATION_FOUNDATION_VERSION,
  SUPPORTED_COMMANDER_PLAYER_RANGE,
  createModernizationCapabilityReport,
  normalizeCommanderFormat,
  validateCommanderPlayerCount,
} from "./commanderModernization.js";

export const COMMANDER_SESSION_SCHEMA_VERSION =
  "boardstate-commander-session-0.1.0";

export const SESSION_LIFECYCLE_STATES = Object.freeze([
  "setup",
  "lobby",
  "ready-check",
  "initializing",
  "active",
  "paused",
  "reconnecting",
  "suspended",
  "completed",
  "abandoned",
  "archived",
  "corrupted",
  "incompatible",
  "replay-only",
  "recovery-required",
]);

export const PARTICIPANT_ROLES = Object.freeze([
  "host",
  "player",
  "spectator",
  "ai-agent",
  "tutorial-agent",
  "local-guest",
]);

export const PARTICIPANT_RELATIONSHIPS = Object.freeze([
  "local",
  "remote",
  "same-device",
  "external-app",
  "system",
]);

export const SESSION_PERMISSION_KEYS = Object.freeze([
  "submit-gameplay-action",
  "submit-decision",
  "view-public-state",
  "view-owner-hidden",
  "view-controlled-hidden",
  "view-replay",
  "manage-session-settings",
  "invite-participant",
  "remove-participant",
  "propose-rule-amendment",
  "vote-rule-amendment",
  "reconnect",
  "export-public-summary",
  "export-private-backup",
]);

export const DEFAULT_PERMISSIONS_BY_ROLE = Object.freeze({
  host: [
    "submit-gameplay-action",
    "submit-decision",
    "view-public-state",
    "view-owner-hidden",
    "view-controlled-hidden",
    "view-replay",
    "manage-session-settings",
    "invite-participant",
    "remove-participant",
    "propose-rule-amendment",
    "vote-rule-amendment",
    "reconnect",
    "export-public-summary",
    "export-private-backup",
  ],
  player: [
    "submit-gameplay-action",
    "submit-decision",
    "view-public-state",
    "view-owner-hidden",
    "view-controlled-hidden",
    "view-replay",
    "propose-rule-amendment",
    "vote-rule-amendment",
    "reconnect",
    "export-public-summary",
  ],
  spectator: ["view-public-state", "view-replay", "export-public-summary"],
  "ai-agent": ["submit-gameplay-action", "submit-decision", "view-public-state"],
  "tutorial-agent": ["submit-gameplay-action", "submit-decision", "view-public-state"],
  "local-guest": [
    "submit-gameplay-action",
    "submit-decision",
    "view-public-state",
    "view-owner-hidden",
    "view-controlled-hidden",
    "vote-rule-amendment",
  ],
});

export const VISIBILITY_POLICY_LEVELS = Object.freeze([
  "public",
  "owner-visible",
  "controller-visible",
  "explicitly-revealed",
  "participant-specific",
  "host-administrative",
  "rules-authoritative-client-hidden",
  "spectator-visible",
  "replay-visible",
  "post-game-visible",
  "unknown",
]);

export function createParticipantReference(input = {}, index = 0) {
  const role = normalizeRole(input.role || (input.spectator ? "spectator" : "player"));
  const displayName = String(input.displayName || input.name || `Participant ${index + 1}`).trim() || `Participant ${index + 1}`;
  const participantId = normalizeStableId(
    input.participantId || input.id || input.profileId || input.playerId,
    "participantId",
    displayName
  );
  const controlledPlayerIds = normalizeIdList(input.controlledPlayerIds || input.players || input.playerIds, "playerId");
  return {
    participantId,
    profileReference: createProfileReference(input.profileReference || input),
    displayName,
    role,
    permissions: normalizePermissions(input.permissions || DEFAULT_PERMISSIONS_BY_ROLE[role]),
    connectionStatus: normalizeConnectionStatus(input.connectionStatus || input.status || (role === "ai-agent" || role === "tutorial-agent" ? "local" : "unknown")),
    clientReferences: normalizeClientReferences(input.clientReferences || input.clients || []),
    relationship: PARTICIPANT_RELATIONSHIPS.includes(input.relationship) ? input.relationship : "remote",
    supportedCapabilities: normalizeCapabilitySummary(input.supportedCapabilities || input.capabilities || {}),
    visibilityGrants: normalizeVisibilityGrants(input.visibilityGrants || []),
    controlledPlayerIds,
    spectatorMetadata: clonePlain(input.spectatorMetadata || {}),
    sourceApp: normalizeAppId(input.sourceApp || "boardstate"),
    lastSeenAt: Number(input.lastSeenAt || input.updatedAt || 0),
    reconnectReference: input.reconnectReference ? String(input.reconnectReference) : "",
  };
}

export function createSeatReference(input = {}, index = 0) {
  const tableOrder = Number.isFinite(Number(input.tableOrder ?? input.seatIndex ?? index))
    ? Number(input.tableOrder ?? input.seatIndex ?? index)
    : index;
  const seatId = normalizeStableId(input.seatId || input.id, "seatId", `seat-${tableOrder + 1}`);
  const assignedPlayerId = input.assignedPlayerId || input.playerId
    ? normalizeStableId(input.assignedPlayerId || input.playerId, "playerId", `player-${tableOrder + 1}`)
    : "";
  const assignedParticipantId = input.assignedParticipantId || input.participantId
    ? normalizeStableId(input.assignedParticipantId || input.participantId, "participantId", `participant-${tableOrder + 1}`)
    : "";
  return {
    seatId,
    tableOrder,
    displayOrder: Number.isFinite(Number(input.displayOrder)) ? Number(input.displayOrder) : tableOrder,
    occupancyStatus: input.occupancyStatus || (input.occupied === false ? "vacant" : assignedPlayerId ? "occupied" : "vacant"),
    assignedPlayerId,
    assignedParticipantId,
    previousSeatId: String(input.previousSeatId || ""),
    nextSeatId: String(input.nextSeatId || ""),
    carouselOrder: Number.isFinite(Number(input.carouselOrder)) ? Number(input.carouselOrder) : tableOrder,
    metadata: clonePlain(input.metadata || {}),
  };
}

export function createCommanderSourceReference(input = {}, index = 0) {
  const seed = input.name || input.cardName || input.commanderId || `commander-${index + 1}`;
  const commanderObjectId = normalizeStableId(
    input.commanderObjectId || input.commanderId || input.cardInstanceId || input.id,
    "cardInstanceId",
    seed
  );
  return {
    commanderObjectId,
    cardInstanceId: commanderObjectId,
    ownerPlayerId: normalizeStableId(input.ownerPlayerId || input.owner || "local-player", "playerId", "local-player"),
    controllerPlayerId: normalizeStableId(input.controllerPlayerId || input.controller || input.ownerPlayerId || input.owner || "local-player", "playerId", "local-player"),
    sourceDeckSnapshotId: input.sourceDeckSnapshotId || input.deckSnapshotId
      ? normalizeStableId(input.sourceDeckSnapshotId || input.deckSnapshotId, "deckSnapshotId", seed)
      : "",
    designation: String(input.designation || input.commanderType || "commander"),
    name: String(input.name || input.cardName || seed),
    partnerGroupId: String(input.partnerGroupId || ""),
    backgroundLinkedToCommanderId: String(input.backgroundLinkedToCommanderId || ""),
    zone: String(input.zone || "command"),
    castCount: Math.max(0, Number(input.castCount || input.commanderCastCount || 0)),
    commanderTax: Math.max(0, Number(input.commanderTax || 0)),
    taxHistory: Array.isArray(input.taxHistory) ? clonePlain(input.taxHistory) : [],
    zoneHistory: Array.isArray(input.zoneHistory) ? clonePlain(input.zoneHistory) : [],
    publicMetadata: clonePlain(input.publicMetadata || {}),
  };
}

export function createVisibilityPolicy(input = {}) {
  return {
    policyVersion: String(input.policyVersion || COMMANDER_SESSION_SCHEMA_VERSION),
    defaultZoneVisibility: {
      battlefield: "public",
      stack: "public",
      graveyard: "public",
      exile: "public",
      command: "public",
      hand: "owner-visible",
      library: "owner-visible",
      sideboard: "owner-visible",
      ...(input.defaultZoneVisibility || {}),
    },
    hostSeesHiddenByDefault: Boolean(input.hostSeesHiddenByDefault),
    spectatorSeesHiddenByDefault: Boolean(input.spectatorSeesHiddenByDefault),
    hubReceivesHiddenGameplayData: Boolean(input.hubReceivesHiddenGameplayData),
    explicitReveals: Array.isArray(input.explicitReveals) ? clonePlain(input.explicitReveals) : [],
    participantVisibilityOverrides: clonePlain(input.participantVisibilityOverrides || {}),
    liveTrackingUnknownPolicy: String(input.liveTrackingUnknownPolicy || "preserve-unknown"),
    replayVisibilityPolicy: String(input.replayVisibilityPolicy || "public-until-authorized"),
  };
}

export function createCapabilityManifest(input = {}) {
  const base = createModernizationCapabilityReport();
  return {
    manifestVersion: String(input.manifestVersion || COMMANDER_SESSION_SCHEMA_VERSION),
    appId: normalizeAppId(input.appId || "boardstate"),
    appVersion: String(input.appVersion || ""),
    contractVersions: {
      commanderSession: COMMANDER_SESSION_SCHEMA_VERSION,
      commanderModernization: MODERNIZATION_FOUNDATION_VERSION,
      sharedContracts: SHARED_CONTRACT_SCHEMA_VERSION,
      saveSchema: SHARED_SAVE_FORMAT_VERSION,
      syncProtocol: SHARED_SYNC_PROTOCOL_VERSION,
      rulesEngine: input.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
      ...(input.contractVersions || {}),
    },
    supportedFeatures: {
      canonicalSessions: true,
      liveTrackingInput: true,
      fullControlInput: true,
      spectatorRole: true,
      replayReferences: true,
      hiddenInformationFiltering: true,
      commanderPartners: true,
      tenPlayerCommander: true,
      ruleAmendmentVoting: true,
      deckNexusSnapshots: true,
      boardStateLiteInteroperability: true,
      offlineLocalPlay: true,
      reducedMotionPreference: true,
      hubCoordination: false,
      liveHubConnection: false,
      liveDeckNexusLink: false,
      liveBoardStateLiteHandoff: false,
      ...(input.supportedFeatures || {}),
    },
    unsupportedFeatures: Array.isArray(input.unsupportedFeatures)
      ? [...input.unsupportedFeatures]
      : ["live-hub-connection", "live-deck-nexus-link", "live-boardstate-lite-handoff"],
    offlineCapabilities: clonePlain(input.offlineCapabilities || {
      createLocalSession: true,
      saveAndRestore: true,
      dryRun: true,
      tutorial: true,
    }),
    optionalRoutes: clonePlain(input.optionalRoutes || {}),
    foundationCapabilities: base,
    limitations: Array.isArray(input.limitations)
      ? [...input.limitations]
      : ["Hub, BoardState Lite, and Deck Nexus live counterparts are not connected yet."],
  };
}

export function createCommanderSession(input = {}) {
  const now = Date.now();
  const players = normalizePlayers(input.players || [], input);
  const participants = normalizeParticipants(input.participants || [], players, input);
  const seats = linkSeatTraversal(normalizeSeats(input.seats || [], players, participants));
  const turnOrder = createTurnOrderState(input.turnOrder || input.turnState || {}, players, seats);
  const commanderSession = createCommanderSessionState(input.commanderSession || input.commanderState || {}, players, input.deckSnapshotReferences || []);
  const hostParticipantId = resolveHostParticipantId(input, participants);
  const hostPlayerId = input.hostPlayerId || participants.find((entry) => entry.participantId === hostParticipantId)?.controlledPlayerIds?.[0] || players[0]?.playerId || "local-player";
  const lifecycle = normalizeLifecycle(input.sessionLifecycle || input.lifecycle || input.status || "setup");
  const shared = createSharedGameSession({
    ...input,
    format: normalizeCommanderFormat(input.format),
    status: lifecycle === "completed" ? "completed" : lifecycle,
    sessionLifecycle: lifecycle,
    updatedAt: input.updatedAt || now,
    hostParticipantId,
    hostPlayerId,
    participants,
    seats,
    seatOrder: seats.map((seat) => seat.seatId),
    turnOrder,
    players,
    commanderSession,
    authority: createAuthorityState(input.authority || {}, hostParticipantId),
    localPerspective: clonePlain(input.localPerspective || {}),
    visibilityPolicy: createVisibilityPolicy(input.visibilityPolicy || {}),
    rolePermissions: clonePlain(input.rolePermissions || DEFAULT_PERMISSIONS_BY_ROLE),
    reconnectState: createReconnectState(input.reconnectState || {}),
    capabilityManifest: createCapabilityManifest(input.capabilityManifest || {}),
    identityAliases: clonePlain(input.identityAliases || {}),
  });
  return {
    ...shared,
    commanderSessionSchemaVersion: COMMANDER_SESSION_SCHEMA_VERSION,
    participantCount: participants.length,
    activePlayerCount: players.filter((player) => !player.eliminated && !player.conceded).length,
  };
}

export function createTurnOrderState(input = {}, players = [], seats = []) {
  const orderedPlayers = normalizeIdList(input.playerIds || input.order || input.turnOrder, "playerId");
  const seatDerivedPlayerIds = seats
    .filter((seat) => seat.assignedPlayerId)
    .sort((a, b) => a.tableOrder - b.tableOrder)
    .map((seat) => seat.assignedPlayerId);
  const playerIds = orderedPlayers.length ? orderedPlayers : seatDerivedPlayerIds.length ? seatDerivedPlayerIds : players.map((player) => player.playerId);
  const entries = playerIds.map((playerId, index) => ({
    turnEntryId: normalizeStableId(input.entries?.[index]?.turnEntryId, "syncRevisionId", `turn-${index + 1}-${playerId}`),
    playerId,
    seatId: seats.find((seat) => seat.assignedPlayerId === playerId)?.seatId || "",
    turnOrderIndex: index,
    status: input.entries?.[index]?.status || "eligible",
    reason: input.entries?.[index]?.reason || "",
  }));
  const activePlayerId = input.activePlayerId || input.currentPlayerId || entries[Number(input.currentTurnIndex || 0)]?.playerId || entries[0]?.playerId || "local-player";
  return {
    turnOrderId: normalizeStableId(input.turnOrderId || input.id, "syncRevisionId", "commander-turn-order"),
    revision: Math.max(0, Number(input.revision || input.turnOrderRevision || 0)),
    playerIds,
    entries,
    currentTurnIndex: Math.max(0, Number(input.currentTurnIndex || Math.max(0, playerIds.indexOf(activePlayerId)) || 0)),
    activePlayerId,
    extraTurns: Array.isArray(input.extraTurns) ? clonePlain(input.extraTurns) : [],
    skippedTurns: Array.isArray(input.skippedTurns) ? clonePlain(input.skippedTurns) : [],
    controlledTurns: Array.isArray(input.controlledTurns) ? clonePlain(input.controlledTurns) : [],
    modifiedTurnOrderHistory: Array.isArray(input.modifiedTurnOrderHistory) ? clonePlain(input.modifiedTurnOrderHistory) : [],
    seatOrderIndependent: true,
  };
}

export function buildLocalPerspectiveProjection(sessionInput = {}, options = {}) {
  const session = createCommanderSession(sessionInput);
  const localParticipantId = options.participantId || session.localPerspective?.participantId || session.hostParticipantId || session.participants[0]?.participantId || "";
  const participant = getParticipantById(session, localParticipantId);
  const controlledPlayers = getControlledPlayers(session, localParticipantId);
  const localPlayer = options.localPlayerId
    ? getPlayerById(session, options.localPlayerId)
    : controlledPlayers[0] || null;
  const localSeat = localPlayer ? getSeatById(session, localPlayer.seatId || "") || session.seats.find((seat) => seat.assignedPlayerId === localPlayer.playerId) || null : null;
  const opponents = localPlayer ? getSeatRelativeOpponents(session, localPlayer.playerId) : getOpponents(session, "");
  const activePlayer = getActivePlayer(session);
  const priorityHolder = getPriorityHolder(session);
  const visibleZones = getVisibleZonesForPerspective(session, localParticipantId);
  return {
    sessionId: session.sessionId,
    gameId: session.gameId,
    participant,
    participantId: localParticipantId,
    role: participant?.role || "spectator",
    controlledPlayers,
    localPlayer,
    localPlayerId: localPlayer?.playerId || "",
    localSeat,
    localSeatId: localSeat?.seatId || "",
    opponents,
    carouselOrder: opponents.map((player) => player.playerId),
    bottomBattlefieldPlayerId: localPlayer?.playerId || "",
    topBattlefieldPlayerId: resolveTopBattlefieldPlayerId(session, localPlayer?.playerId || "", options.focusedOpponentId),
    activePlayer,
    priorityHolder,
    visibleZones,
    permissions: getParticipantPermissions(session, localParticipantId),
    canSubmitGameplayAction: canParticipantSubmitAction(session, localParticipantId, { playerId: localPlayer?.playerId || "" }).allowed,
    reconnect: getReconnectState(session, localParticipantId),
  };
}

export function getParticipantById(sessionInput = {}, participantId = "") {
  const id = String(participantId || "");
  return (sessionInput.participants || []).find((participant) => participant.participantId === id) || null;
}

export function getPlayerById(sessionInput = {}, playerId = "") {
  const id = String(playerId || "");
  return (sessionInput.players || []).find((player) => player.playerId === id) || null;
}

export function getSeatById(sessionInput = {}, seatId = "") {
  const id = String(seatId || "");
  return (sessionInput.seats || []).find((seat) => seat.seatId === id) || null;
}

export function getLocalParticipant(sessionInput = {}) {
  return getParticipantById(sessionInput, sessionInput.localPerspective?.participantId || sessionInput.hostParticipantId || "") ||
    (sessionInput.participants || []).find((participant) => participant.relationship === "local") ||
    (sessionInput.participants || [])[0] ||
    null;
}

export function getControlledPlayers(sessionInput = {}, participantId = "") {
  const participant = getParticipantById(sessionInput, participantId) || {};
  const controlled = new Set(participant.controlledPlayerIds || []);
  return (sessionInput.players || []).filter((player) =>
    controlled.has(player.playerId) || player.participantId === participant.participantId
  );
}

export function getOpponents(sessionInput = {}, playerId = "") {
  return (sessionInput.players || []).filter((player) =>
    player.playerId !== playerId && !player.eliminated && !player.conceded
  );
}

export function getSeatRelativeOpponents(sessionInput = {}, playerId = "") {
  const localSeat = (sessionInput.seats || []).find((seat) => seat.assignedPlayerId === playerId);
  const orderedSeats = [...(sessionInput.seats || [])].sort((a, b) => a.tableOrder - b.tableOrder);
  if (!localSeat) return getOpponents(sessionInput, playerId);
  const start = orderedSeats.findIndex((seat) => seat.seatId === localSeat.seatId);
  const seatCycle = [...orderedSeats.slice(start + 1), ...orderedSeats.slice(0, start)];
  return seatCycle
    .map((seat) => getPlayerById(sessionInput, seat.assignedPlayerId))
    .filter((player) => player && player.playerId !== playerId && !player.eliminated && !player.conceded);
}

export function getActivePlayer(sessionInput = {}) {
  const activePlayerId = sessionInput.turnOrder?.activePlayerId || sessionInput.turnState?.activePlayerId || "local-player";
  return getPlayerById(sessionInput, activePlayerId);
}

export function getPriorityHolder(sessionInput = {}) {
  const priorityHolderId = sessionInput.priorityState?.priorityHolderId || sessionInput.priority?.activePlayerId || "local-player";
  return getPlayerById(sessionInput, priorityHolderId);
}

export function getCurrentTurnEntry(sessionInput = {}) {
  const order = sessionInput.turnOrder || {};
  return (order.entries || []).find((entry) => entry.playerId === order.activePlayerId) ||
    (order.entries || [])[Number(order.currentTurnIndex || 0)] ||
    null;
}

export function getCommanderSources(sessionInput = {}, playerId = "") {
  const sources = sessionInput.commanderSession?.commanderSources || [];
  return playerId ? sources.filter((source) => source.ownerPlayerId === playerId) : sources;
}

export function getCommanderDamage(sessionInput = {}, sourceCommanderId = "", recipientPlayerId = "") {
  const ledger = sessionInput.commanderSession?.commanderDamageByRecipient || {};
  if (recipientPlayerId && sourceCommanderId) return Number(ledger[recipientPlayerId]?.[sourceCommanderId] || 0);
  if (recipientPlayerId) return clonePlain(ledger[recipientPlayerId] || {});
  return clonePlain(ledger);
}

export function getVisibleZonesForPerspective(sessionInput = {}, participantId = "") {
  const participant = getParticipantById(sessionInput, participantId) || {};
  const controlledPlayers = new Set(getControlledPlayers(sessionInput, participantId).map((player) => player.playerId));
  const policy = createVisibilityPolicy(sessionInput.visibilityPolicy || {});
  const zonesByPlayer = sessionInput.zoneState?.zonesByPlayer || {};
  return Object.fromEntries(Object.entries(zonesByPlayer).map(([playerId, zones]) => [
    playerId,
    Object.fromEntries(Object.entries(zones || {}).map(([zoneName, zone]) => {
      const level = policy.defaultZoneVisibility[zoneName] || zone.visibility || "unknown";
      const visible = isZoneVisibleToParticipant({ zone, zoneName, level, playerId, participant, controlledPlayers, policy });
      return [zoneName, visible ? clonePlain(zone) : redactZone(zone, zoneName)];
    })),
  ]));
}

export function getParticipantPermissions(sessionInput = {}, participantId = "") {
  const participant = getParticipantById(sessionInput, participantId);
  return normalizePermissions(participant?.permissions || DEFAULT_PERMISSIONS_BY_ROLE[participant?.role] || []);
}

export function getSessionCapabilities(sessionInput = {}) {
  return createSessionCapabilities(sessionInput.sessionCapabilities || {});
}

export function getReconnectState(sessionInput = {}, participantId = "") {
  const state = createReconnectState(sessionInput.reconnectState || {});
  if (!participantId) return state;
  return {
    ...state,
    participant: state.participantsById[participantId] || null,
  };
}

export function getPublicSessionSummary(sessionInput = {}) {
  return createSessionReference(sessionInput);
}

export function canParticipantSubmitAction(sessionInput = {}, participantId = "", action = {}) {
  const participant = getParticipantById(sessionInput, participantId);
  if (!participant) return { allowed: false, reason: "participant not found" };
  const permissions = getParticipantPermissions(sessionInput, participantId);
  if (participant.role === "spectator") return { allowed: false, reason: "spectators cannot submit gameplay actions" };
  if (action.actionType === "APPLY_RULE_AMENDMENT" && !action.unanimousApproved) {
    return { allowed: false, reason: "rule amendments require unanimous player approval" };
  }
  if (action.actionType === "VOTE_RULE_AMENDMENT") {
    return { allowed: permissions.includes("vote-rule-amendment"), reason: permissions.includes("vote-rule-amendment") ? "" : "participant cannot vote on amendments" };
  }
  const playerId = action.playerId || action.payload?.playerId || "";
  if (playerId && !participant.controlledPlayerIds.includes(playerId) && participant.role !== "tutorial-agent") {
    return { allowed: false, reason: "participant does not control that player" };
  }
  if (!permissions.includes("submit-gameplay-action")) return { allowed: false, reason: "participant lacks gameplay permission" };
  return { allowed: true, reason: "" };
}

export function applyParticipantDisconnect(sessionInput = {}, participantId = "", options = {}) {
  const session = createCommanderSession(sessionInput);
  const participants = session.participants.map((participant) =>
    participant.participantId === participantId
      ? {
          ...participant,
          connectionStatus: "disconnected",
          lastSeenAt: Number(options.disconnectedAt || Date.now()),
        }
      : participant
  );
  return {
    ...session,
    participants,
    reconnectState: createReconnectState({
      ...(session.reconnectState || {}),
      participantsById: {
        ...(session.reconnectState?.participantsById || {}),
        [participantId]: {
          participantId,
          status: "disconnected",
          lastConnectionId: options.connectionId || "",
          updatedAt: Number(options.disconnectedAt || Date.now()),
        },
      },
    }),
    revision: Number(session.revision || 0) + 1,
  };
}

export function applyParticipantReconnect(sessionInput = {}, payload = {}) {
  const session = createCommanderSession(sessionInput);
  const participantId = String(payload.participantId || "");
  const existing = getParticipantById(session, participantId) ||
    findParticipantByClientReference(session, payload.clientId || payload.connectionId || "");
  if (!existing) {
    return { session, reconnected: false, status: "rejected", reason: "participant identity not recognized" };
  }
  const nextClientReferences = normalizeClientReferences([
    ...(existing.clientReferences || []),
    {
      clientId: payload.clientId || "",
      connectionId: payload.connectionId || "",
      connectedAt: payload.connectedAt || Date.now(),
      transient: true,
    },
  ]);
  const participants = session.participants.map((participant) =>
    participant.participantId === existing.participantId
      ? {
          ...participant,
          connectionStatus: payload.connectionStatus || "online",
          clientReferences: nextClientReferences,
          lastSeenAt: Number(payload.connectedAt || Date.now()),
        }
      : participant
  );
  return {
    session: {
      ...session,
      participants,
      reconnectState: createReconnectState({
        ...(session.reconnectState || {}),
        participantsById: {
          ...(session.reconnectState?.participantsById || {}),
          [existing.participantId]: {
            participantId: existing.participantId,
            status: "reconnected",
            lastConnectionId: payload.connectionId || "",
            updatedAt: Number(payload.connectedAt || Date.now()),
          },
        },
      }),
      revision: Number(session.revision || 0) + 1,
    },
    reconnected: true,
    status: "reconnected",
    participantId: existing.participantId,
    playerIds: existing.controlledPlayerIds || [],
  };
}

export function applyPlayerElimination(sessionInput = {}, playerId = "", reason = "eliminated") {
  const session = createCommanderSession(sessionInput);
  return {
    ...session,
    players: session.players.map((player) =>
      player.playerId === playerId
        ? { ...player, eliminated: true, eliminationReason: reason, priorityEligible: false, turnEligible: false }
        : player
    ),
    turnOrder: markTurnOrderPlayerStatus(session.turnOrder, playerId, "ineligible", reason),
    revision: Number(session.revision || 0) + 1,
  };
}

export function applyPlayerConcession(sessionInput = {}, playerId = "") {
  const session = createCommanderSession(sessionInput);
  return {
    ...applyPlayerElimination(session, playerId, "conceded"),
    players: session.players.map((player) =>
      player.playerId === playerId ? { ...player, conceded: true, eliminated: true, eliminationReason: "conceded" } : player
    ),
  };
}

export function migrateLegacySessionToCommanderSession(legacySession = {}, options = {}) {
  const originalLegacySession = clonePlain(legacySession || {});
  const localPlayerId = normalizeStableId(options.localPlayerId || "local-player", "playerId", "local-player");
  const connectedPlayers = Array.isArray(options.connectedPlayers)
    ? options.connectedPlayers
    : Array.isArray(legacySession.syncedMultiplayer?.players)
      ? legacySession.syncedMultiplayer.players
      : [];
  const remotePlayers = connectedPlayers.filter((entry) => (entry.id || entry.playerId) !== localPlayerId);
  const players = [
    {
      playerId: localPlayerId,
      participantId: "participant-local-player",
      seatId: "seat-local-player",
      displayName: options.localPlayerName || "Player",
      controllerType: "human",
      connectionStatus: "local",
      activeInterface: "boardstate-advanced",
      life: legacySession.life || 40,
      commanderDamage: legacySession.commander?.damageByOpponent || {},
      playerCounters: legacySession.playerCounters || {},
      commanderCardInstanceIds: legacySession.commander?.name ? [legacySession.commander.name] : [],
    },
    ...remotePlayers.map((entry, index) => ({
      playerId: normalizeStableId(entry.playerId || entry.id, "playerId", entry.name || `remote-${index + 1}`),
      participantId: normalizeStableId(entry.participantId || entry.id, "participantId", entry.name || `remote-${index + 1}`),
      seatId: normalizeStableId(entry.seatId, "seatId", `seat-${index + 2}`),
      displayName: entry.displayName || entry.name || `Player ${index + 2}`,
      controllerType: entry.role === "ai" ? "ai" : "remote",
      connectionStatus: entry.connectionStatus || entry.status || "unknown",
      activeInterface: entry.activeInterface || entry.interfaceMode || "unknown",
      life: entry.life || 40,
    })),
  ];
  const session = createCommanderSession({
    gameId: legacySession.gameId || legacySession.id || options.gameId,
    sessionId: legacySession.sessionId || legacySession.id || options.sessionId,
    sourceApp: legacySession.sourceApp || "boardstate",
    format: legacySession.simulation?.format || legacySession.gameTracking?.format || "commander",
    sessionLifecycle: legacySession.gameTracking?.active || legacySession.simulation?.enabled ? "active" : "setup",
    createdAt: legacySession.createdAt,
    updatedAt: legacySession.updatedAt,
    revision: legacySession.revision || legacySession.actionHistory?.length || 0,
    players,
    turnOrder: {
      playerIds: legacySession.syncedMultiplayer?.turnOrder || legacySession.simulation?.turnOrder || players.map((player) => player.playerId),
      activePlayerId: legacySession.priority?.activePlayerId || legacySession.simulation?.currentPlayerId || localPlayerId,
    },
    turnState: {
      turnNumber: legacySession.turn || 1,
      activePlayerId: legacySession.priority?.activePlayerId || legacySession.simulation?.currentPlayerId || localPlayerId,
      currentTurnIndex: legacySession.syncedMultiplayer?.currentPlayerIndex || legacySession.simulation?.turnIndex || 0,
    },
    priorityState: {
      priorityHolderId: legacySession.priority?.activePlayerId || localPlayerId,
      passedPlayerIds: legacySession.priority?.passedPlayerIds || [],
    },
    commanderSession: {
      commanderSources: legacySession.commander?.name
        ? [createCommanderSourceReference({
            commanderObjectId: legacySession.commander.cardId || legacySession.commander.name,
            name: legacySession.commander.name,
            ownerPlayerId: localPlayerId,
            controllerPlayerId: localPlayerId,
            zone: legacySession.commander.zone || "command",
            castCount: legacySession.commander.castCount || 0,
            commanderTax: legacySession.commander.commanderTax || 0,
          })]
        : [],
      commanderDamageByRecipient: { [localPlayerId]: legacySession.commander?.damageByOpponent || {} },
    },
    localPerspective: { participantId: "participant-local-player", playerId: localPlayerId },
  });
  return {
    session,
    originalLegacySession,
    migrated: true,
    warnings: ["Legacy runtime session was preserved separately; canonical Commander identity metadata was added non-destructively."],
  };
}

export function createSessionReference(sessionInput = {}) {
  const session = createCommanderSession(sessionInput);
  return {
    appIdentity: "boardstate",
    sessionId: session.sessionId,
    gameId: session.gameId,
    contractVersion: COMMANDER_SESSION_SCHEMA_VERSION,
    sessionMode: session.saveMetadata?.mode || session.gameTracking?.mode || "commander",
    lifecycle: session.sessionLifecycle || session.status,
    participantCount: session.participants.length,
    supportedCapabilities: clonePlain(session.capabilityManifest?.supportedFeatures || {}),
    rulesEngineVersion: session.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
    cardDataVersion: session.cardDataVersion || session.saveMetadata?.cardDataVersion || "",
    launchSource: session.launchContext?.sourceApplication || session.sourceApp || "boardstate",
    returnTarget: session.returnContext?.destinationApplication || "",
    privacySafeSummary: {
      playerCount: session.players.length,
      seatCount: session.seats.length,
      activePlayerId: session.turnOrder?.activePlayerId || session.turnState?.activePlayerId || "",
      priorityHolderId: session.priorityState?.priorityHolderId || "",
      hiddenInformationExcluded: true,
      hubIsRulesAuthority: false,
    },
    checksum: buildStableChecksum({
      gameId: session.gameId,
      sessionId: session.sessionId,
      revision: session.revision,
      players: session.players.map((player) => player.playerId),
    }),
  };
}

export function createDeckSnapshotReference(input = {}) {
  const deck = createDeckSnapshot(input);
  const hashSource = {
    cards: deck.cards,
    commanderIds: deck.commanderIds,
    deckSnapshotId: deck.deckSnapshotId,
    sourceDeckVersion: deck.sourceDeckVersion,
    cardDataVersion: input.cardDataVersion || "",
  };
  const integrityHash = Array.isArray(input.cards) || Array.isArray(input.commanderIds)
    ? buildStableChecksum(hashSource)
    : input.integrityHash || buildStableChecksum(hashSource);
  return {
    deckSnapshotId: deck.deckSnapshotId,
    sourceApp: deck.sourceApp,
    sourceDeckId: deck.sourceDeckId,
    sourceDeckVersion: deck.sourceDeckVersion,
    format: normalizeCommanderFormat(deck.format),
    commanderReferences: Array.isArray(deck.commanderIds) ? [...deck.commanderIds] : [],
    cardDataVersion: String(input.cardDataVersion || ""),
    integrityHash: String(integrityHash),
    importedAt: Number(deck.importedAt || Date.now()),
    ownershipMetadata: input.ownerProfileId ? { ownerProfileId: deck.ownerProfileId } : {},
    immutableSnapshotVersion: deck.immutableSnapshotVersion,
    legalityResult: clonePlain(input.legalityResult || {}),
    validationWarnings: Array.isArray(input.validationWarnings) ? [...input.validationWarnings] : [],
    importProvenance: clonePlain(input.importProvenance || {}),
  };
}

export function createLaunchContext(input = {}) {
  return {
    launchContextId: normalizeStableId(input.launchContextId || input.id, "invitationId", "launch-context"),
    contractVersion: String(input.contractVersion || COMMANDER_SESSION_SCHEMA_VERSION),
    sourceApplication: normalizeAppId(input.sourceApplication || input.sourceApp || "boardstate"),
    requestedAction: String(input.requestedAction || "open-session"),
    sessionReference: input.sessionReference ? createSessionReference(input.sessionReference) : null,
    inviteReference: clonePlain(input.inviteReference || null),
    tournamentReference: clonePlain(input.tournamentReference || null),
    participantReference: input.participantReference ? createParticipantReference(input.participantReference) : null,
    desiredRole: normalizeRole(input.desiredRole || "player"),
    returnContext: input.returnContext ? createReturnContext(input.returnContext) : null,
    createdAt: Number(input.createdAt || Date.now()),
  };
}

export function createReturnContext(input = {}) {
  return {
    returnContextId: normalizeStableId(input.returnContextId || input.id, "invitationId", "return-context"),
    contractVersion: String(input.contractVersion || COMMANDER_SESSION_SCHEMA_VERSION),
    destinationApplication: normalizeAppId(input.destinationApplication || input.destinationApp || "boardstate"),
    completedAction: String(input.completedAction || ""),
    sessionReference: input.sessionReference ? createSessionReference(input.sessionReference) : null,
    status: String(input.status || "pending"),
    safeSummary: clonePlain(input.safeSummary || {}),
    replayReference: input.replayReference ? normalizeStableId(input.replayReference, "replayId", "replay") : "",
    resultReference: String(input.resultReference || ""),
    errorStatus: String(input.errorStatus || ""),
    createdAt: Number(input.createdAt || Date.now()),
  };
}

export function validateLaunchContext(input = {}) {
  const context = createLaunchContext(input);
  const errors = [];
  if (context.contractVersion !== COMMANDER_SESSION_SCHEMA_VERSION) errors.push(`unsupported launch context version ${context.contractVersion}`);
  if (!context.sourceApplication) errors.push("missing source application");
  if (!context.requestedAction) errors.push("missing requested action");
  return { valid: errors.length === 0, status: errors.length ? "invalid" : "valid", errors, warnings: [] };
}

export function validateCapabilityManifest(input = {}) {
  const manifest = createCapabilityManifest(input);
  const errors = [];
  if (manifest.contractVersions.commanderSession !== COMMANDER_SESSION_SCHEMA_VERSION) errors.push("unsupported commander session contract");
  if (manifest.supportedFeatures.liveHubConnection) errors.push("Hub live connection cannot be reported by BoardState in this preparation phase");
  if (manifest.supportedFeatures.liveDeckNexusLink) errors.push("Deck Nexus live link cannot be reported by BoardState in this preparation phase");
  if (manifest.supportedFeatures.liveBoardStateLiteHandoff) errors.push("BoardState Lite live handoff cannot be reported by BoardState in this preparation phase");
  return { valid: errors.length === 0, status: errors.length ? "invalid" : "valid", errors, warnings: manifest.limitations || [] };
}

export function validateCommanderSessionArchitecture(sessionInput = {}) {
  const session = createCommanderSession(sessionInput);
  const errors = [];
  const warnings = [];
  collectDuplicateIds(session.players, "playerId").forEach((id) => errors.push(`duplicate player ID ${id}`));
  collectDuplicateIds(session.participants, "participantId").forEach((id) => errors.push(`duplicate participant ID ${id}`));
  collectDuplicateIds(session.seats, "seatId").forEach((id) => errors.push(`duplicate seat ID ${id}`));
  const playerCount = validateCommanderPlayerCount(session.players.filter((player) => !player.eliminated && !player.conceded).length, {
    allowSinglePlayerTraining: session.saveMetadata?.mode === "training-ground" || session.simulation?.enabled,
  });
  if (!playerCount.valid) errors.push(...playerCount.errors);
  if (playerCount.warnings.length) warnings.push(...playerCount.warnings);
  const playerIds = new Set(session.players.map((player) => player.playerId));
  const participantIds = new Set(session.participants.map((participant) => participant.participantId));
  session.seats.forEach((seat) => {
    if (seat.assignedPlayerId && !playerIds.has(seat.assignedPlayerId)) errors.push(`seat ${seat.seatId} references missing player ${seat.assignedPlayerId}`);
    if (seat.assignedParticipantId && !participantIds.has(seat.assignedParticipantId)) errors.push(`seat ${seat.seatId} references missing participant ${seat.assignedParticipantId}`);
  });
  session.participants.forEach((participant) => {
    if (participant.role === "spectator" && participant.controlledPlayerIds.length) errors.push(`spectator ${participant.participantId} cannot control players`);
    participant.controlledPlayerIds.forEach((playerId) => {
      if (!playerIds.has(playerId)) errors.push(`participant ${participant.participantId} controls missing player ${playerId}`);
    });
  });
  session.players.forEach((player) => {
    if (looksLikeArrayIndex(player.playerId)) errors.push(`player ID ${player.playerId} looks like an array index`);
    if (player.displayName && player.playerId === player.displayName) warnings.push(`player ${player.playerId} uses display name as identity`);
  });
  return {
    valid: errors.length === 0,
    status: errors.length ? "invalid" : warnings.length ? "valid-with-warnings" : "valid",
    errors,
    warnings,
  };
}

export function projectSessionForParticipant(sessionInput = {}, participantId = "") {
  const session = createCommanderSession(sessionInput);
  return {
    summary: createSessionReference(session),
    perspective: buildLocalPerspectiveProjection(session, { participantId }),
    participants: session.participants.map((participant) => ({
      participantId: participant.participantId,
      displayName: participant.displayName,
      role: participant.role,
      connectionStatus: participant.connectionStatus,
      controlledPlayerIds: participant.controlledPlayerIds,
    })),
    players: session.players.map((player) => ({
      playerId: player.playerId,
      seatId: player.seatId,
      displayName: player.displayName,
      life: player.life,
      poisonCounters: player.poisonCounters,
      playerCounters: clonePlain(player.playerCounters || {}),
      eliminated: player.eliminated,
      conceded: player.conceded,
      commanderSourceIds: player.commanderSourceIds || player.commanderCardInstanceIds || [],
    })),
    visibleZones: getVisibleZonesForPerspective(session, participantId),
  };
}

function normalizePlayers(playersInput = [], input = {}) {
  const sourcePlayers = Array.isArray(playersInput) && playersInput.length ? playersInput : [
    {
      playerId: input.localPlayerId || "local-player",
      displayName: input.localPlayerName || "Player",
      controllerType: "human",
      connectionStatus: "local",
      activeInterface: "boardstate-advanced",
      life: input.startingLife || 40,
    },
  ];
  return sourcePlayers.map((player, index) => {
    const playerId = normalizeStableId(player.playerId || player.id, "playerId", player.displayName || player.name || `player-${index + 1}`);
    const seatId = normalizeStableId(player.seatId, "seatId", `seat-${index + 1}`);
    const participantId = normalizeStableId(player.participantId || player.profileId || player.controllerParticipantId, "participantId", player.displayName || player.name || `participant-${index + 1}`);
    return {
      ...clonePlain(player),
      playerId,
      seatId,
      participantId,
      displayName: String(player.displayName || player.name || `Player ${index + 1}`).trim() || `Player ${index + 1}`,
      seatIndex: Number(player.seatIndex ?? index),
      controllerType: CONTROLLER_TYPES.includes(player.controllerType) ? player.controllerType : "human",
      connectionStatus: normalizeConnectionStatus(player.connectionStatus || player.status || "unknown"),
      activeInterface: INTERFACE_MODES.includes(player.activeInterface) ? player.activeInterface : "unknown",
      life: Number(player.life ?? player.startingLife ?? 40),
      startingLife: Number(player.startingLife || 40),
      commanderDamage: clonePlain(player.commanderDamage || {}),
      commanderSourceIds: normalizeIdList(player.commanderSourceIds || player.commanderCardInstanceIds, "cardInstanceId"),
      commanderCardInstanceIds: normalizeIdList(player.commanderCardInstanceIds || player.commanderSourceIds, "cardInstanceId"),
      priorityEligible: player.priorityEligible !== false && !player.eliminated && !player.conceded,
      turnEligible: player.turnEligible !== false && !player.eliminated && !player.conceded,
    };
  });
}

function normalizeParticipants(participantsInput = [], players = [], input = {}) {
  const explicit = Array.isArray(participantsInput) ? participantsInput : [];
  const participants = explicit.length
    ? explicit.map(createParticipantReference)
    : players.map((player, index) => createParticipantReference({
        participantId: player.participantId,
        profileId: player.profileId,
        displayName: player.displayName,
        role: player.controllerType === "ai" ? "ai-agent" : player.controllerType === "tutorial" ? "tutorial-agent" : index === 0 ? "host" : "player",
        relationship: index === 0 ? "local" : player.controllerType === "ai" || player.controllerType === "tutorial" ? "system" : "remote",
        connectionStatus: player.connectionStatus || (index === 0 ? "local" : "unknown"),
        controlledPlayerIds: [player.playerId],
        sourceApp: input.sourceApp || "boardstate",
      }, index));
  return participants.map((participant) => ({
    ...participant,
    controlledPlayerIds: participant.role === "spectator" ? [] : normalizeIdList(participant.controlledPlayerIds, "playerId"),
  }));
}

function normalizeSeats(seatsInput = [], players = [], participants = []) {
  if (Array.isArray(seatsInput) && seatsInput.length) {
    return seatsInput.map(createSeatReference);
  }
  return players
    .map((player, index) => {
      const participant = participants.find((entry) => entry.controlledPlayerIds.includes(player.playerId));
      return createSeatReference({
        seatId: player.seatId,
        tableOrder: Number(player.seatIndex ?? index),
        displayOrder: Number(player.seatIndex ?? index),
        assignedPlayerId: player.playerId,
        assignedParticipantId: participant?.participantId || player.participantId || "",
        occupancyStatus: "occupied",
      }, index);
    })
    .sort((a, b) => a.tableOrder - b.tableOrder);
}

function linkSeatTraversal(seats = []) {
  const ordered = [...seats].sort((a, b) => a.tableOrder - b.tableOrder);
  return ordered.map((seat, index) => ({
    ...seat,
    previousSeatId: ordered[(index - 1 + ordered.length) % ordered.length]?.seatId || "",
    nextSeatId: ordered[(index + 1) % ordered.length]?.seatId || "",
    carouselOrder: index,
  }));
}

function createCommanderSessionState(input = {}, players = [], deckSnapshotReferences = []) {
  const explicitSources = Array.isArray(input.commanderSources) ? input.commanderSources : [];
  const derivedSources = explicitSources.length
    ? explicitSources
    : players.flatMap((player) =>
        normalizeIdList(player.commanderSourceIds || player.commanderCardInstanceIds, "cardInstanceId").map((commanderId, index) =>
          createCommanderSourceReference({
            commanderObjectId: commanderId,
            name: commanderId,
            ownerPlayerId: player.playerId,
            controllerPlayerId: player.playerId,
            designation: index === 0 ? "commander" : "partner",
            commanderTax: player.commanderTaxByCommanderId?.[commanderId] || 0,
            castCount: player.commanderCastCountByCommanderId?.[commanderId] || 0,
            zone: player.commanderZoneByCommanderId?.[commanderId] || "command",
          }, index)
        )
      );
  const commanderSources = derivedSources.map(createCommanderSourceReference);
  const ledger = clonePlain(input.commanderDamageByRecipient || {});
  players.forEach((recipient) => {
    ledger[recipient.playerId] = {
      ...(ledger[recipient.playerId] || {}),
      ...(recipient.commanderDamage || {}),
    };
  });
  return {
    commanderSessionVersion: COMMANDER_SESSION_SCHEMA_VERSION,
    commanderSources,
    commanderSourcesByPlayer: groupBy(commanderSources, "ownerPlayerId"),
    commanderDamageByRecipient: ledger,
    commanderTaxByCommanderId: Object.fromEntries(commanderSources.map((source) => [source.commanderObjectId, Number(source.commanderTax || 0)])),
    commanderCastCountByCommanderId: Object.fromEntries(commanderSources.map((source) => [source.commanderObjectId, Number(source.castCount || 0)])),
    commanderZoneByCommanderId: Object.fromEntries(commanderSources.map((source) => [source.commanderObjectId, source.zone || "command"])),
    deckSnapshotCommanderReferences: clonePlain(deckSnapshotReferences || []),
    multipleCommanderObjectsSupported: true,
  };
}

function createAuthorityState(input = {}, hostParticipantId = "") {
  return {
    rulesAuthorityOwner: "boardstate",
    sessionAuthority: String(input.sessionAuthority || "local"),
    hostParticipantId: input.hostParticipantId || hostParticipantId,
    hostCanImposeRuleAmendments: false,
    hubIsGameplayAuthority: false,
    lastAuthorityRevision: Math.max(0, Number(input.lastAuthorityRevision || 0)),
  };
}

function createReconnectState(input = {}) {
  return {
    reconnectVersion: String(input.reconnectVersion || COMMANDER_SESSION_SCHEMA_VERSION),
    participantsById: clonePlain(input.participantsById || {}),
    clientsById: clonePlain(input.clientsById || {}),
    trustModel: String(input.trustModel || "local-session-reference"),
    cryptographicIdentityVerified: Boolean(input.cryptographicIdentityVerified),
    lastReconnectAt: Number(input.lastReconnectAt || 0),
  };
}

function normalizeClientReferences(references = []) {
  return (Array.isArray(references) ? references : []).map((reference, index) => ({
    clientId: normalizeStableId(reference.clientId || reference.id, "clientId", `client-${index + 1}`),
    connectionId: reference.connectionId
      ? normalizeStableId(reference.connectionId, "connectionId", `connection-${index + 1}`)
      : "",
    appInstanceId: reference.appInstanceId ? normalizeStableId(reference.appInstanceId, "appInstanceId", `app-${index + 1}`) : "",
    status: normalizeConnectionStatus(reference.status || "unknown"),
    connectedAt: Number(reference.connectedAt || 0),
    transient: reference.transient !== false,
  }));
}

function normalizeCapabilitySummary(input = {}) {
  return {
    canonicalSessionVersion: String(input.canonicalSessionVersion || COMMANDER_SESSION_SCHEMA_VERSION),
    rulesEngineVersion: String(input.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION),
    cardDataVersion: String(input.cardDataVersion || ""),
    saveSchemaVersion: String(input.saveSchemaVersion || SHARED_SAVE_FORMAT_VERSION),
    eventContractVersion: String(input.eventContractVersion || SHARED_CONTRACT_SCHEMA_VERSION),
    inputModes: Array.isArray(input.inputModes) ? [...input.inputModes] : [...COMMANDER_MODERNIZATION_INPUT_MODES],
    spectatorSupport: input.spectatorSupport !== false,
    hiddenInformationFiltering: input.hiddenInformationFiltering !== false,
    tenPlayerSupport: input.tenPlayerSupport !== false,
    offlineSupport: input.offlineSupport !== false,
    reducedMotionPreference: Boolean(input.reducedMotionPreference),
  };
}

function normalizeVisibilityGrants(grants = []) {
  return (Array.isArray(grants) ? grants : []).map((grant) => ({
    grantId: normalizeStableId(grant.grantId || grant.id, "eventId", "visibility-grant"),
    scope: VISIBILITY_POLICY_LEVELS.includes(grant.scope) ? grant.scope : "participant-specific",
    playerId: grant.playerId ? normalizeStableId(grant.playerId, "playerId", "player") : "",
    zoneName: String(grant.zoneName || ""),
    expiresAtRevision: Number(grant.expiresAtRevision || 0),
  }));
}

function createProfileReference(input = {}) {
  const profileId = input.profileId || input.id || "";
  return profileId
    ? {
        profileId: normalizeStableId(profileId, "profileId", input.displayName || input.name || "profile"),
        displayName: String(input.displayName || input.name || ""),
      }
    : null;
}

function normalizeRole(role = "player") {
  return PARTICIPANT_ROLES.includes(role) ? role : "player";
}

function normalizeConnectionStatus(status = "unknown") {
  return CONNECTION_STATUSES.includes(status) ? status : "unknown";
}

function normalizeAppId(appId = "boardstate") {
  return APP_IDS.includes(appId) ? appId : "boardstate";
}

function normalizePermissions(permissions = []) {
  return [...new Set((Array.isArray(permissions) ? permissions : []).filter((permission) => SESSION_PERMISSION_KEYS.includes(permission)))];
}

function normalizeIdList(values = [], type = "playerId") {
  return [...new Set((Array.isArray(values) ? values : []).map((value, index) => normalizeStableId(value, type, `${type}-${index + 1}`)).filter(Boolean))];
}

function normalizeStableId(value = "", type = "id", fallbackSeed = "") {
  const raw = String(value || "").trim();
  if (!raw || looksLikeArrayIndex(raw)) return createContractId(type, fallbackSeed || type);
  return normalizeContractId(raw, type);
}

function normalizeLifecycle(value = "setup") {
  const normalized = String(value || "setup");
  if (normalized === "complete") return "completed";
  return SESSION_LIFECYCLE_STATES.includes(normalized) ? normalized : "setup";
}

function resolveHostParticipantId(input = {}, participants = []) {
  if (input.hostParticipantId) return normalizeStableId(input.hostParticipantId, "participantId", "host");
  return participants.find((participant) => participant.role === "host")?.participantId || participants[0]?.participantId || "";
}

function resolveTopBattlefieldPlayerId(session = {}, localPlayerId = "", focusedOpponentId = "") {
  if (focusedOpponentId && getPlayerById(session, focusedOpponentId)) return focusedOpponentId;
  const activePlayerId = session.turnOrder?.activePlayerId || session.turnState?.activePlayerId || "";
  if (activePlayerId && activePlayerId !== localPlayerId && getPlayerById(session, activePlayerId)) return activePlayerId;
  return getSeatRelativeOpponents(session, localPlayerId)[0]?.playerId || "";
}

function isZoneVisibleToParticipant({ zone, zoneName, level, playerId, participant, controlledPlayers, policy }) {
  if (zone?.visibility === "public" || level === "public" || level === "spectator-visible") return true;
  if (level === "unknown" || zone?.visibility === "unknown") return true;
  if (controlledPlayers.has(playerId) && (level === "owner-visible" || level === "controller-visible" || zone?.visibility === "private" || zone?.visibility === "owner-only")) return true;
  const overrides = policy.participantVisibilityOverrides?.[participant.participantId] || {};
  const explicitZones = overrides[playerId] || [];
  return Array.isArray(explicitZones) && explicitZones.includes(zoneName);
}

function redactZone(zone = {}, zoneName = "") {
  return {
    zoneName: zone.zoneName || zoneName,
    visibility: "hidden",
    count: Number(zone.count || zone.cardInstanceIds?.length || 0),
    cardInstanceIds: [],
    privateInformationReference: zone.privateInformationReference || "",
    redacted: true,
  };
}

function findParticipantByClientReference(session = {}, clientOrConnectionId = "") {
  const id = String(clientOrConnectionId || "");
  if (!id) return null;
  return (session.participants || []).find((participant) =>
    (participant.clientReferences || []).some((reference) => reference.clientId === id || reference.connectionId === id)
  ) || null;
}

function markTurnOrderPlayerStatus(turnOrder = {}, playerId = "", status = "ineligible", reason = "") {
  return {
    ...turnOrder,
    entries: (turnOrder.entries || []).map((entry) =>
      entry.playerId === playerId ? { ...entry, status, reason } : entry
    ),
    revision: Number(turnOrder.revision || 0) + 1,
  };
}

function collectDuplicateIds(entries = [], key = "id") {
  const seen = new Set();
  const duplicates = new Set();
  entries.forEach((entry) => {
    const id = entry?.[key];
    if (!id) return;
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  });
  return [...duplicates];
}

function looksLikeArrayIndex(value = "") {
  return /^\d+$/.test(String(value || "").trim());
}

function groupBy(entries = [], key = "") {
  return entries.reduce((groups, entry) => {
    const groupKey = entry[key] || "";
    if (!groupKey) return groups;
    groups[groupKey] = [...(groups[groupKey] || []), entry.commanderObjectId];
    return groups;
  }, {});
}
