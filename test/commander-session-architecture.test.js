import test from "node:test";
import assert from "node:assert/strict";

import {
  COMMANDER_SESSION_SCHEMA_VERSION,
  ID_TYPES,
  applyParticipantDisconnect,
  applyParticipantReconnect,
  applyPlayerConcession,
  applyPlayerElimination,
  buildLocalPerspectiveProjection,
  canParticipantSubmitAction,
  createCapabilityManifest,
  createCanonicalSaveEnvelope,
  createCommanderSession,
  createDeckSnapshotReference,
  createLaunchContext,
  createReturnContext,
  createSessionReference,
  getActivePlayer,
  getCommanderDamage,
  getCommanderSources,
  getCurrentTurnEntry,
  getParticipantPermissions,
  getPlayerById,
  getPriorityHolder,
  getPublicSessionSummary,
  getSeatById,
  getSeatRelativeOpponents,
  getVisibleZonesForPerspective,
  migrateLegacySessionToCommanderSession,
  projectSessionForParticipant,
  sharedSessionToBoardStateRuntime,
  validateCapabilityManifest,
  validateCommanderSessionArchitecture,
  validateLaunchContext,
  validateSaveEnvelope,
  validateSharedGameSession,
} from "../src/shared-contracts/index.js";
import {
  createCommanderPlayers,
  createCommanderTestSession,
  createDeckNexusSnapshotFixture,
} from "./fixtures/commanderSessionFixtures.js";

test("canonical identity types include session, participant, seat, reconnect, replay, backup, and amendment IDs", () => {
  for (const idType of [
    "sessionId",
    "gameId",
    "participantId",
    "playerId",
    "seatId",
    "profileId",
    "clientId",
    "connectionId",
    "deckSnapshotId",
    "invitationId",
    "tournamentId",
    "replayId",
    "backupId",
    "ruleAmendmentId",
    "syncRevisionId",
  ]) {
    assert.equal(ID_TYPES.includes(idType), true, `${idType} must be a shared identity type`);
  }
});

test("Commander session IDs, players, seats, and participants survive serialization", () => {
  const session = createCommanderTestSession(4);
  const serialized = JSON.parse(JSON.stringify(session));
  const restored = createCommanderSession(serialized);

  assert.equal(restored.gameId, session.gameId);
  assert.equal(restored.sessionId, session.sessionId);
  assert.deepEqual(restored.players.map((player) => player.playerId), session.players.map((player) => player.playerId));
  assert.deepEqual(restored.seats.map((seat) => seat.seatId), session.seats.map((seat) => seat.seatId));
  assert.equal(validateSharedGameSession(restored).valid, true);
  assert.equal(validateCommanderSessionArchitecture(restored).valid, true);
  assert.equal(restored.players.some((player) => /^\d+$/.test(player.playerId)), false);
});

test("two-player, four-player, and ten-player Commander sessions validate with looping seat traversal", () => {
  for (const count of [2, 4, 10]) {
    const session = createCommanderTestSession(count);
    assert.equal(validateCommanderSessionArchitecture(session).valid, true);
    assert.equal(session.players.length, count);
    assert.equal(session.seats.length, count);
    assert.equal(getSeatById(session, session.seats[0].seatId).previousSeatId, session.seats[count - 1].seatId);
    assert.equal(getSeatById(session, session.seats[count - 1].seatId).nextSeatId, session.seats[0].seatId);
    session.players.forEach((player) => assert.equal(getPlayerById(session, player.playerId).playerId, player.playerId));
  }

  const invalid = createCommanderSession({ players: createCommanderPlayers(11), sessionLifecycle: "active" });
  assert.equal(validateCommanderSessionArchitecture(invalid).valid, false);
});

test("seat order remains stable when turn order diverges for extra turns and elimination", () => {
  const players = createCommanderPlayers(4);
  const session = createCommanderTestSession(4, {
    players,
    turnOrder: {
      playerIds: ["player-c", "player-a", "player-b", "player-d"],
      activePlayerId: "player-c",
      currentTurnIndex: 0,
      extraTurns: [{ playerId: "player-a", reason: "extra turn effect" }],
    },
  });

  assert.deepEqual(session.seatOrder, ["seat-a", "seat-b", "seat-c", "seat-d"]);
  assert.deepEqual(session.turnOrder.playerIds, ["player-c", "player-a", "player-b", "player-d"]);
  assert.equal(getActivePlayer(session).playerId, "player-c");
  assert.equal(getCurrentTurnEntry(session).playerId, "player-c");
  assert.deepEqual(getSeatRelativeOpponents(session, "player-a").map((player) => player.playerId), ["player-b", "player-c", "player-d"]);

  const eliminated = applyPlayerElimination(session, "player-b", "lost");
  assert.equal(getPlayerById(eliminated, "player-b").turnEligible, false);
  assert.equal(eliminated.seatOrder[1], "seat-b");
  assert.equal(eliminated.turnOrder.entries.find((entry) => entry.playerId === "player-b").status, "ineligible");

  const conceded = applyPlayerConcession(session, "player-d");
  assert.equal(getPlayerById(conceded, "player-d").conceded, true);
  assert.equal(conceded.seatOrder[3], "seat-d");
});

test("Commander sources support one commander, partners, backgrounds, per-source tax, and scalable damage", () => {
  const session = createCommanderTestSession(4, {
    players: createCommanderPlayers(4, {
      commanderSourceIds: [
        ["commander-a"],
        ["partner-b-1", "partner-b-2"],
        ["background-c-commander", "background-c"],
        ["commander-d"],
      ],
    }),
    commanderTaxByCommanderId: {
      "partner-b-1": 4,
      "partner-b-2": 2,
      "background-c": 2,
    },
    commanderDamageByRecipient: {
      "player-a": {
        "partner-b-1": 12,
        "partner-b-2": 9,
      },
      "player-d": {
        "background-c-commander": 7,
      },
    },
  });

  assert.equal(getCommanderSources(session, "player-a").length, 1);
  assert.equal(getCommanderSources(session, "player-b").length, 2);
  assert.equal(getCommanderSources(session, "player-c").length, 2);
  assert.equal(session.commanderSession.commanderTaxByCommanderId["partner-b-1"], 4);
  assert.equal(session.commanderSession.commanderTaxByCommanderId["partner-b-2"], 2);
  assert.equal(getCommanderDamage(session, "partner-b-1", "player-a"), 12);
  assert.equal(getCommanderDamage(session, "partner-b-2", "player-a"), 9);
  assert.equal(getCommanderDamage(session, "background-c-commander", "player-d"), 7);
});

test("local perspectives derive controlled player, opponents, carousel order, and hidden zone visibility", () => {
  const session = createCommanderTestSession(4, {
    activePlayerId: "player-c",
    priorityHolderId: "player-b",
    zoneState: {
      zonesByPlayer: {
        "player-a": {
          hand: { zoneName: "hand", visibility: "private", count: 2, cardInstanceIds: ["secret-a"] },
          graveyard: { zoneName: "graveyard", visibility: "public", count: 1, cardInstanceIds: ["grave-a"] },
        },
        "player-b": {
          hand: { zoneName: "hand", visibility: "private", count: 3, cardInstanceIds: ["secret-b"] },
        },
      },
    },
  });

  const playerPerspective = buildLocalPerspectiveProjection(session, { participantId: "participant-a" });
  assert.equal(playerPerspective.localPlayerId, "player-a");
  assert.equal(playerPerspective.topBattlefieldPlayerId, "player-c");
  assert.deepEqual(playerPerspective.carouselOrder, ["player-b", "player-c", "player-d"]);
  assert.equal(playerPerspective.activePlayer.playerId, "player-c");
  assert.equal(playerPerspective.priorityHolder.playerId, "player-b");
  assert.deepEqual(playerPerspective.visibleZones["player-a"].hand.cardInstanceIds, ["secret-a"]);
  assert.deepEqual(playerPerspective.visibleZones["player-b"].hand.cardInstanceIds, []);

  const spectatorSession = createCommanderTestSession(4, {
    participants: [
      ...session.participants,
      { participantId: "participant-spectator", displayName: "Watcher", role: "spectator", controlledPlayerIds: [] },
    ],
    zoneState: session.zoneState,
  });
  const spectatorPerspective = buildLocalPerspectiveProjection(spectatorSession, { participantId: "participant-spectator" });
  assert.equal(spectatorPerspective.controlledPlayers.length, 0);
  assert.equal(spectatorPerspective.visibleZones["player-a"].hand.cardInstanceIds.length, 0);
});

test("roles and permissions prevent spectator actions, host rule imposition, and AI cross-control", () => {
  const players = createCommanderPlayers(3, { controllerTypes: ["human", "ai", "human"] });
  const session = createCommanderTestSession(3, {
    players,
    participants: [
      { participantId: "participant-a", displayName: "Host", role: "host", relationship: "local", controlledPlayerIds: ["player-a"] },
      { participantId: "participant-b", displayName: "AI", role: "ai-agent", relationship: "system", controlledPlayerIds: ["player-b"] },
      { participantId: "participant-s", displayName: "Spectator", role: "spectator", relationship: "remote", controlledPlayerIds: [] },
    ],
  });

  assert.equal(canParticipantSubmitAction(session, "participant-a", { playerId: "player-a", actionType: "CAST_SPELL" }).allowed, true);
  assert.equal(canParticipantSubmitAction(session, "participant-s", { playerId: "player-c", actionType: "CAST_SPELL" }).allowed, false);
  assert.equal(canParticipantSubmitAction(session, "participant-a", { playerId: "player-a", actionType: "APPLY_RULE_AMENDMENT" }).allowed, false);
  assert.equal(canParticipantSubmitAction(session, "participant-a", { playerId: "player-a", actionType: "APPLY_RULE_AMENDMENT", unanimousApproved: true }).allowed, true);
  assert.equal(canParticipantSubmitAction(session, "participant-b", { playerId: "player-a", actionType: "CAST_SPELL" }).allowed, false);
  assert.ok(getParticipantPermissions(session, "participant-s").includes("view-public-state"));
  assert.equal(getParticipantPermissions(session, "participant-s").includes("submit-gameplay-action"), false);
});

test("disconnect and reconnect preserve participant, player, seat, decisions, and revision identity", () => {
  const session = createCommanderTestSession(4, {
    priorityHolderId: "player-b",
    revision: 10,
    participants: [
      { participantId: "participant-a", displayName: "Host", role: "host", relationship: "local", controlledPlayerIds: ["player-a"] },
      {
        participantId: "participant-b",
        displayName: "Remote",
        role: "player",
        relationship: "remote",
        controlledPlayerIds: ["player-b"],
        clientReferences: [{ clientId: "client-b-old", connectionId: "connection-b-old" }],
      },
      { participantId: "participant-c", displayName: "C", role: "player", relationship: "remote", controlledPlayerIds: ["player-c"] },
      { participantId: "participant-d", displayName: "D", role: "player", relationship: "remote", controlledPlayerIds: ["player-d"] },
    ],
  });

  const disconnected = applyParticipantDisconnect(session, "participant-b", { connectionId: "connection-b-old", disconnectedAt: 123 });
  assert.equal(disconnected.participants.find((entry) => entry.participantId === "participant-b").connectionStatus, "disconnected");
  assert.equal(disconnected.players.length, 4);
  assert.equal(disconnected.seats.length, 4);

  const reconnected = applyParticipantReconnect(disconnected, {
    participantId: "participant-b",
    clientId: "client-b-new",
    connectionId: "connection-b-new",
    connectedAt: 456,
  });
  assert.equal(reconnected.reconnected, true);
  assert.equal(reconnected.session.players.length, 4);
  assert.equal(reconnected.session.seats.find((seat) => seat.assignedPlayerId === "player-b").seatId, "seat-b");
  assert.equal(getPriorityHolder(reconnected.session).playerId, "player-b");
  assert.equal(reconnected.session.revision, disconnected.revision + 1);
});

test("ecosystem launch, return, capability, Deck Nexus, and public summary contracts stay privacy-safe and honest", () => {
  const session = createCommanderTestSession(4);
  const launchContext = createLaunchContext({
    sourceApplication: "boardstate-hub",
    requestedAction: "open-session",
    sessionReference: session,
    desiredRole: "spectator",
  });
  assert.equal(validateLaunchContext(launchContext).valid, true);
  assert.equal(validateLaunchContext({ ...launchContext, contractVersion: "future-context-9" }).valid, false);

  const returnContext = createReturnContext({
    destinationApplication: "boardstate-hub",
    completedAction: "session-opened",
    sessionReference: session,
    status: "handoff-ready",
  });
  assert.equal(returnContext.destinationApplication, "boardstate-hub");
  assert.equal(returnContext.sessionReference.privacySafeSummary.hiddenInformationExcluded, true);

  const manifest = createCapabilityManifest();
  assert.equal(validateCapabilityManifest(manifest).valid, true);
  assert.equal(manifest.supportedFeatures.liveHubConnection, false);
  assert.equal(validateCapabilityManifest({ supportedFeatures: { liveHubConnection: true } }).valid, false);

  const deck = createDeckNexusSnapshotFixture();
  const hash = deck.integrityHash;
  const changedSource = createDeckSnapshotReference({ ...deck, cards: [{ name: "Changed", quantity: 1 }] });
  assert.notEqual(changedSource.integrityHash, hash);
  assert.equal(deck.sourceApp, "deck-nexus");

  const summary = getPublicSessionSummary(session);
  const serialized = JSON.stringify(summary);
  assert.equal(serialized.includes("zoneState"), false);
  assert.equal(summary.privacySafeSummary.hubIsRulesAuthority, false);
});

test("projection and visible-zone helpers do not expose hidden opponent or host-only information", () => {
  const session = createCommanderTestSession(2, {
    zoneState: {
      zonesByPlayer: {
        "player-a": {
          library: { zoneName: "library", visibility: "private", count: 80, cardInstanceIds: ["a-top-secret"] },
        },
        "player-b": {
          hand: { zoneName: "hand", visibility: "private", count: 7, cardInstanceIds: ["b-secret"] },
        },
      },
    },
  });

  const visibleToHost = getVisibleZonesForPerspective(session, "participant-a");
  assert.deepEqual(visibleToHost["player-b"].hand.cardInstanceIds, []);
  assert.deepEqual(visibleToHost["player-a"].library.cardInstanceIds, ["a-top-secret"]);

  const projection = projectSessionForParticipant(session, "participant-b");
  assert.equal(JSON.stringify(projection).includes("a-top-secret"), false);
  assert.deepEqual(projection.visibleZones["player-b"].hand.cardInstanceIds, ["b-secret"]);
});

test("legacy session migration preserves original data, order, commander state, and canonical save compatibility", () => {
  const legacy = {
    id: "legacy-game-1",
    gameId: "legacy-game-1",
    sessionId: "legacy-session-1",
    turn: 8,
    phaseIndex: 2,
    life: 31,
    playerCounters: { poison: 1 },
    priority: { activePlayerId: "remote-two", passedPlayerIds: ["local-player"] },
    syncedMultiplayer: {
      players: [
        { id: "remote-one", name: "Remote One", status: "online" },
        { id: "remote-two", name: "Remote Two", status: "reconnecting" },
      ],
      turnOrder: ["local-player", "remote-two", "remote-one"],
      currentPlayerIndex: 1,
    },
    commander: {
      name: "Legacy Commander",
      cardId: "legacy-commander-card",
      zone: "command",
      castCount: 2,
      commanderTax: 4,
      damageByOpponent: { "remote-one": 11 },
    },
    actionHistory: [{ actionId: "legacy-action" }],
  };

  const migration = migrateLegacySessionToCommanderSession(legacy, { localPlayerName: "Local" });
  assert.equal(migration.migrated, true);
  assert.equal(migration.originalLegacySession.commander.commanderTax, 4);
  assert.equal(migration.session.gameId, "legacy-game-1");
  assert.equal(migration.session.sessionId, "legacy-session-1");
  assert.deepEqual(migration.session.turnOrder.playerIds, ["local-player", "remote-two", "remote-one"]);
  assert.equal(migration.session.turnOrder.activePlayerId, "remote-two");
  assert.equal(migration.session.commanderSession.commanderTaxByCommanderId["legacy-commander-card"], 4);
  assert.equal(getCommanderDamage(migration.session, "remote-one", "local-player"), 11);

  const envelope = createCanonicalSaveEnvelope({
    saveId: "save-migrated-legacy",
    profileId: "profile-local",
    saveName: "Migrated Legacy",
    gameState: migration.session,
    privateStateReferences: {
      originalLegacySession: migration.originalLegacySession,
    },
  });
  assert.equal(validateSaveEnvelope(envelope).valid, true);
  const runtime = sharedSessionToBoardStateRuntime(envelope.gameState, legacy);
  assert.equal(runtime.turn, 8);
  assert.equal(runtime.turnOrder.activePlayerId, "remote-two");
});
