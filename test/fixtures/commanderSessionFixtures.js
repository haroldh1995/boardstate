import {
  createCommanderSession,
  createCommanderSourceReference,
  createDeckSnapshotReference,
} from "../../src/shared-contracts/index.js";

const NAMES = [
  "Arden",
  "Bex",
  "Cato",
  "Dina",
  "Elio",
  "Faye",
  "Galen",
  "Hana",
  "Ivar",
  "Jora",
];

export function createCommanderPlayers(count = 4, options = {}) {
  return Array.from({ length: count }, (_, index) => {
    const letter = String.fromCharCode(97 + index);
    const playerId = `player-${letter}`;
    return {
      playerId,
      participantId: `participant-${letter}`,
      seatId: `seat-${letter}`,
      displayName: options.names?.[index] || NAMES[index] || `Player ${index + 1}`,
      seatIndex: index,
      controllerType: options.controllerTypes?.[index] || "human",
      connectionStatus: index === 0 ? "local" : options.connectionStatuses?.[index] || "online",
      activeInterface: options.interfaces?.[index] || "boardstate-advanced",
      life: options.life?.[index] ?? 40,
      startingLife: 40,
      commanderSourceIds: options.commanderSourceIds?.[index] || [`commander-${letter}`],
      commanderCardInstanceIds: options.commanderSourceIds?.[index] || [`commander-${letter}`],
    };
  });
}

export function createParticipantsForPlayers(players = [], options = {}) {
  return players.map((player, index) => ({
    participantId: player.participantId,
    displayName: player.displayName,
    role: options.roles?.[index] || (index === 0 ? "host" : "player"),
    relationship: index === 0 ? "local" : "remote",
    connectionStatus: player.connectionStatus,
    controlledPlayerIds: options.roles?.[index] === "spectator" ? [] : [player.playerId],
    sourceApp: options.sourceApps?.[index] || "boardstate",
    clientReferences: options.clientReferences?.[index] || [],
  }));
}

export function createCommanderTestSession(count = 4, options = {}) {
  const players = options.players || createCommanderPlayers(count, options);
  const participants = options.participants || createParticipantsForPlayers(players, options);
  const commanderSources = options.commanderSources || players.flatMap((player) =>
    (player.commanderSourceIds || []).map((commanderId, index) =>
      createCommanderSourceReference({
        commanderObjectId: commanderId,
        name: `${player.displayName} Commander ${index + 1}`,
        ownerPlayerId: player.playerId,
        controllerPlayerId: player.playerId,
        designation: index === 0 ? "commander" : "partner",
        commanderTax: options.commanderTaxByCommanderId?.[commanderId] || 0,
        castCount: options.commanderCastCountByCommanderId?.[commanderId] || 0,
      })
    )
  );
  return createCommanderSession({
    gameId: options.gameId || "game-commander-test",
    sessionId: options.sessionId || "session-commander-test",
    format: options.format || "commander",
    sessionLifecycle: options.sessionLifecycle || "active",
    revision: options.revision || 3,
    players,
    participants,
    turnOrder: options.turnOrder || {
      playerIds: players.map((player) => player.playerId),
      activePlayerId: options.activePlayerId || players[0]?.playerId,
      currentTurnIndex: Math.max(0, players.findIndex((player) => player.playerId === (options.activePlayerId || players[0]?.playerId))),
      extraTurns: options.extraTurns || [],
      skippedTurns: options.skippedTurns || [],
      controlledTurns: options.controlledTurns || [],
    },
    turnState: {
      turnNumber: options.turnNumber || 4,
      activePlayerId: options.activePlayerId || players[0]?.playerId,
      currentPhase: "main-1",
      currentStep: "precombatMain",
    },
    priorityState: {
      priorityHolderId: options.priorityHolderId || options.activePlayerId || players[0]?.playerId,
      passedPlayerIds: options.passedPlayerIds || [],
    },
    commanderSession: {
      commanderSources,
      commanderDamageByRecipient: options.commanderDamageByRecipient || {},
    },
    zoneState: options.zoneState || {},
    deckSnapshotReferences: options.deckSnapshotReferences || [],
    localPerspective: {
      participantId: participants[0]?.participantId,
      playerId: players[0]?.playerId,
      seatId: players[0]?.seatId,
    },
    saveMetadata: {
      mode: "commander",
    },
  });
}

export function createDeckNexusSnapshotFixture() {
  return createDeckSnapshotReference({
    deckSnapshotId: "deck-snapshot-nexus-1",
    sourceApp: "deck-nexus",
    sourceDeckId: "deck-nexus-master-1",
    sourceDeckVersion: "7",
    format: "commander",
    commanderIds: ["commander-a", "commander-b"],
    cardDataVersion: "oracle-2026-07-19",
    cards: [
      { name: "Command Tower", quantity: 1, oracleId: "oracle-command-tower" },
      { name: "Forest", quantity: 20, oracleId: "oracle-forest" },
    ],
    importedAt: 1784437200000,
  });
}
