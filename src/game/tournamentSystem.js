import { createId, normalizeCount } from "../state/ids.js";
import { createTournamentState } from "../state/schema.js";

export const CASUAL_LADDER_PRESET = "10-player-casual-win-ladder";

const DEFAULT_SETTINGS = {
  expectedPlayerCount: 10,
  podSize: 4,
  oneVOneSize: 2,
  oneVOneBeforeRepeat: true,
  oneVOneActsAsTimer: true,
  suddenDeathDamageDouble: true,
  suddenDeathExtensionTurns: 3,
  allowDeckChangesBetweenRounds: true,
  topThreeAnnouncement: true,
  avoidSamePods: true,
  balanceByStandings: true,
};

export function createTournament(profile, event = {}) {
  const now = Date.now();
  const tournamentId = event.tournamentId || event.id || createId("tournament");
  const joinCode = event.joinCode || makeJoinCode(tournamentId);
  const sync = resolveTournamentSync(profile, event, joinCode);
  const host = createPlayer({
    playerId: event.hostPlayerId || profile.player?.id || "local-player",
    playerName: event.hostName || profile.player?.name || "Player",
    role: "host",
    syncStatus: sync.status,
  });
  return {
    ...profile,
    tournament: recalculateStandings(
      createTournamentState({
        active: true,
        tournamentId,
        id: tournamentId,
        joinCode,
        name: event.name || "Local Commander Tournament",
        formatPreset: event.formatPreset || CASUAL_LADDER_PRESET,
        hostPlayerId: host.playerId,
        hostName: host.displayName,
        role: "host",
        status: "setup",
        currentRoundNumber: 0,
        players: [host],
        rounds: [],
        results: [],
        settings: { ...DEFAULT_SETTINGS, ...(event.settings || {}) },
        syncStatus: sync.status,
        sync: {
          mode: sync.mode,
          sessionId: event.sessionId || joinCode,
          wsUrl: sync.wsUrl,
          lastSyncAt: now,
          status: sync.status,
          namespace: "tournament",
        },
        historyLog: [historyEntry("tournament:create", `Tournament created by ${host.displayName} with ${sync.label} sync.`)],
        createdAt: now,
        updatedAt: now,
      })
    ),
  };
}

export function joinTournament(profile, event = {}) {
  const now = Date.now();
  const joinCode = String(event.joinCode || event.sessionId || "").trim().toUpperCase();
  const tournamentId = event.tournamentId || event.id || createId("tournament");
  const existingTournament = normalizeTournament(profile.tournament);
  const existingCode = String(existingTournament.joinCode || existingTournament.sync?.sessionId || "").trim().toUpperCase();
  const reuseExisting = existingTournament.status && existingTournament.status !== "idle" && (!joinCode || existingCode === joinCode);
  const sync = resolveTournamentSync(profile, event, joinCode || event.sessionId || createId("tournament-session"));
  const explicitSyncMode = Boolean(event.syncMode || event.sync?.mode);
  const explicitWsUrl = Boolean(event.wsUrl || event.sync?.wsUrl);
  const tournament = reuseExisting
    ? normalizeTournament(profile.tournament)
    : createTournamentState({
        active: true,
        tournamentId,
        id: tournamentId,
        joinCode: joinCode || event.sessionId || createId("tournament-session"),
        name: event.name || "Joined Casual Tournament",
        role: "player",
        status: "setup",
        syncStatus: sync.status,
        sync: {
          mode: sync.mode,
          sessionId: joinCode || event.sessionId || createId("tournament-session"),
          wsUrl: sync.wsUrl,
          status: sync.status,
          namespace: "tournament",
        },
        createdAt: now,
        updatedAt: now,
      });
  const player = createPlayer({
    ...event,
    playerName: event.playerName || event.displayName || profile.player?.name || "Player",
    role: event.role || "player",
    syncStatus: sync.status,
  });
  if ((tournament.players || []).some((entry) => normalizePlayerName(entry) === normalizePlayerName(player))) {
    return { ...profile, tournament };
  }
  return {
    ...profile,
    tournament: recalculateStandings({
      ...tournament,
      active: true,
      role: tournament.role || "player",
      syncStatus: explicitSyncMode ? sync.status : tournament.syncStatus || sync.status,
      sync: {
        ...(tournament.sync || {}),
        mode: explicitSyncMode ? sync.mode : tournament.sync?.mode || sync.mode,
        wsUrl: explicitWsUrl ? sync.wsUrl : tournament.sync?.wsUrl || sync.wsUrl,
        status: explicitSyncMode ? sync.status : tournament.sync?.status || sync.status,
      },
      players: [...(tournament.players || []), player],
      historyLog: [historyEntry("tournament:join", `${player.displayName} joined ${tournament.joinCode || tournament.sync?.sessionId || "the tournament"} via ${sync.label} sync.`), ...(tournament.historyLog || [])],
      updatedAt: now,
    }),
  };
}

function resolveTournamentSync(profile = {}, event = {}, sessionId = "") {
  const requested = String(event.syncMode || event.sync?.mode || "").toLowerCase();
  const multiplayerMode = String(profile.settings?.multiplayer?.mode || "").toLowerCase();
  const mode = requested === "wifi" || (!requested && multiplayerMode === "wifi") ? "wifi" : "local";
  const wsUrl = event.wsUrl || event.sync?.wsUrl || profile.settings?.multiplayer?.wsUrl || "ws://localhost:8787";
  return {
    mode,
    wsUrl,
    sessionId,
    status: mode === "wifi" ? "wifi-ready" : "local-only",
    label: mode === "wifi" ? "WiFi relay" : "local browser",
  };
}

export function addTournamentPlayer(profile, event = {}) {
  return joinTournament(profile, { ...event, role: event.role || "player" });
}

export function addSampleTournamentPlayers(profile) {
  const names = ["Ari", "Blake", "Casey", "Devon", "Emery", "Finley", "Gray", "Harper", "Indigo", "Jules"];
  const tournament = ensureTournament(profile);
  const existingNames = new Set((tournament.players || []).map((player) => normalizePlayerName(player)));
  const players = [...(tournament.players || [])];
  names.forEach((name) => {
    if (players.length >= Number(tournament.settings?.expectedPlayerCount || 10)) return;
    if (!existingNames.has(name.toLowerCase())) {
      players.push(createPlayer({ playerName: name, deckNotes: "Deck can change between rounds" }));
      existingNames.add(name.toLowerCase());
    }
  });
  return {
    ...profile,
    tournament: recalculateStandings({
      ...tournament,
      players,
      historyLog: [historyEntry("tournament:player-list", "Filled open tournament seats with sample local players."), ...(tournament.historyLog || [])],
      updatedAt: Date.now(),
    }),
  };
}

export function removeTournamentPlayer(profile, event = {}) {
  const tournament = normalizeTournament(profile.tournament);
  if (!event.playerId || tournament.status !== "setup") return profile;
  return {
    ...profile,
    tournament: recalculateStandings({
      ...tournament,
      players: (tournament.players || []).filter((player) => player.playerId !== event.playerId && player.id !== event.playerId),
      historyLog: [historyEntry("tournament:player-list", "A player was removed before tournament start."), ...(tournament.historyLog || [])],
      updatedAt: Date.now(),
    }),
  };
}

export function setTournamentPinned(profile, event = {}) {
  const tournament = normalizeTournament(profile.tournament);
  return {
    ...profile,
    tournament: {
      ...tournament,
      pinned: Boolean(event.pinned),
      updatedAt: Date.now(),
    },
  };
}

export function generateTournamentRound(profile, event = {}) {
  const tournament = normalizeTournament(profile.tournament);
  const players = (tournament.players || []).filter((player) => player.active !== false);
  const settings = { ...DEFAULT_SETTINGS, ...(tournament.settings || {}) };
  if (players.length < settings.expectedPlayerCount) {
    return withTournamentNotice(profile, `Need ${settings.expectedPlayerCount} active players before generating the 10-player preset.`);
  }
  const roundNumber = Number(event.roundNumber || tournament.currentRoundNumber + 1 || 1);
  const previousRound = [...(tournament.rounds || [])].reverse().find((round) => round.status === "complete" || round.roundNumber < roundNumber);
  const assignments = roundNumber <= 1 || !previousRound
    ? generateFirstRound(players, settings, event)
    : generateNextRound(players, previousRound, tournament, settings);
  const round = createRound(roundNumber, assignments, event);
  const rounds = [
    ...(tournament.rounds || []).filter((entry) => entry.roundNumber !== roundNumber),
    round,
  ].sort((left, right) => left.roundNumber - right.roundNumber);
  return {
    ...profile,
    tournament: recalculateStandings({
      ...tournament,
      active: true,
      status: "active",
      currentRoundNumber: roundNumber,
      rounds,
      historyLog: [historyEntry("tournament:round-create", `Round ${roundNumber} generated with two pods and one 1v1 table.`), ...(tournament.historyLog || [])],
      updatedAt: Date.now(),
    }),
  };
}

export function startTournamentRound(profile, event = {}) {
  const tournament = normalizeTournament(profile.tournament);
  const roundNumber = Number(event.roundNumber || tournament.currentRoundNumber || 1);
  return updateRound(profile, roundNumber, (round) => ({
    ...round,
    status: "active",
    podA: { ...round.podA, status: "active" },
    podB: { ...round.podB, status: "active" },
    oneVOne: { ...round.oneVOne, status: "active" },
  }), "tournament:round-update", `Round ${roundNumber} started.`);
}

export function editTournamentTable(profile, event = {}) {
  const tournament = normalizeTournament(profile.tournament);
  const roundNumber = Number(event.roundNumber || tournament.currentRoundNumber || 1);
  const playerNamesById = Object.fromEntries((tournament.players || []).map((player) => [player.playerId, player.displayName]));
  const playerIdsByName = Object.fromEntries((tournament.players || []).map((player) => [player.displayName.toLowerCase(), player.playerId]));
  const nextPlayers = parseIdList(event.players)
    .map((entry) => playerIdsByName[String(entry).toLowerCase()] || entry)
    .filter((id) => playerNamesById[id]);
  if (!nextPlayers.length) return profile;
  return updateRound(profile, roundNumber, (round) => {
    const tableKey = getTableKey(round, event.tableId);
    if (!tableKey || round[tableKey].status !== "pending") return round;
    return {
      ...round,
      [tableKey]: {
        ...round[tableKey],
        players: [...new Set(nextPlayers)],
      },
    };
  }, "tournament:round-update", `Manual seating adjusted for ${event.tableId}.`);
}

export function reportTournamentResult(profile, event = {}) {
  const tournament = normalizeTournament(profile.tournament);
  if (!tournament.active && tournament.status === "idle") return profile;
  if (!event.tableId && event.winnerId) {
    const legacyResult = createStandaloneResult(event);
    return {
      ...profile,
      tournament: recalculateStandings({
        ...tournament,
        results: [...(tournament.results || []), legacyResult],
        finalAnnouncement: null,
        announcement: null,
        historyLog: [historyEntry("tournament:report-result", "Standalone tournament result recorded."), ...(tournament.historyLog || [])],
        updatedAt: Date.now(),
      }),
    };
  }
  const roundNumber = Number(event.roundNumber || tournament.currentRoundNumber || 1);
  const nextRounds = (tournament.rounds || []).map((round) => {
    if (round.roundNumber !== roundNumber) return round;
    const tableKey = getTableKey(round, event.tableId);
    if (!tableKey) return round;
    const table = round[tableKey];
    const updatedTable = completeTableResult(table, event, roundNumber);
    let updatedRound = {
      ...round,
      [tableKey]: updatedTable,
    };
    if (updatedTable.tableType === "oneVOne" && tournament.settings?.oneVOneActsAsTimer !== false) {
      updatedRound = startSuddenDeathOnRound(updatedRound);
    }
    if ([updatedRound.podA, updatedRound.podB, updatedRound.oneVOne].every((entry) => entry.status === "complete")) {
      updatedRound = { ...updatedRound, status: "complete", completedAt: Date.now() };
    }
    return updatedRound;
  });
  return {
    ...profile,
    tournament: recalculateStandings({
      ...tournament,
      rounds: nextRounds,
      finalAnnouncement: null,
      announcement: null,
      historyLog: [historyEntry("tournament:report-result", `Result recorded for ${event.tableName || event.tableId}.`), ...(tournament.historyLog || [])],
      updatedAt: Date.now(),
    }),
  };
}

export function startTournamentSuddenDeath(profile, event = {}) {
  const tournament = normalizeTournament(profile.tournament);
  const roundNumber = Number(event.roundNumber || tournament.currentRoundNumber || 1);
  return {
    ...profile,
    tournament: recalculateStandings({
      ...tournament,
      status: "sudden-death",
      rounds: (tournament.rounds || []).map((round) => (round.roundNumber === roundNumber ? startSuddenDeathOnRound(round) : round)),
      historyLog: [historyEntry("tournament:sudden-death-start", `Round ${roundNumber} entered Sudden Death.`), ...(tournament.historyLog || [])],
      updatedAt: Date.now(),
    }),
  };
}

export function startTournamentExtension(profile, event = {}) {
  const tournament = normalizeTournament(profile.tournament);
  const roundNumber = Number(event.roundNumber || tournament.currentRoundNumber || 1);
  return updateRound(profile, roundNumber, (round) => {
    const tableKey = getTableKey(round, event.tableId) || "podA";
    const table = round[tableKey];
    return {
      ...round,
      status: "extension",
      extensionStarted: true,
      [tableKey]: {
        ...table,
        status: table.status === "complete" ? "complete" : "extension",
        extensionStarted: true,
        extensionTurns: Object.fromEntries((table.players || []).map((playerId) => [playerId, Number(table.extensionTurns?.[playerId] || 0)])),
      },
    };
  }, "tournament:sudden-death-extension", `Final Sudden Death extension started for ${event.tableId || "pod"}.`);
}

export function recordTournamentExtensionTurn(profile, event = {}) {
  const roundNumber = Number(event.roundNumber || profile.tournament?.currentRoundNumber || 1);
  return updateRound(profile, roundNumber, (round) => {
    const tableKey = getTableKey(round, event.tableId) || "podA";
    const table = round[tableKey];
    const playerId = event.playerId || table.players?.[0] || "";
    return {
      ...round,
      [tableKey]: {
        ...table,
        extensionTurns: {
          ...(table.extensionTurns || {}),
          [playerId]: Math.min(Number(profile.tournament?.settings?.suddenDeathExtensionTurns || 3), Number(table.extensionTurns?.[playerId] || 0) + 1),
        },
      },
    };
  }, "tournament:sudden-death-extension", "Sudden Death extension turn recorded.");
}

export function correctTournamentPlayer(profile, event = {}) {
  const tournament = normalizeTournament(profile.tournament);
  if (!event.playerId) return profile;
  const players = (tournament.players || []).map((player) =>
    player.playerId === event.playerId || player.id === event.playerId
      ? {
          ...player,
          manualWins: Math.max(0, normalizeCount(event.wins)),
          manualLosses: Math.max(0, normalizeCount(event.losses)),
          manualGames: Math.max(0, normalizeCount(event.gamesPlayed)),
          updatedAt: Date.now(),
        }
      : player
  );
  return {
    ...profile,
    tournament: recalculateStandings({
      ...tournament,
      players,
      finalAnnouncement: null,
      announcement: null,
      historyLog: [historyEntry("tournament:manual-correction", "Manual standings correction applied."), ...(tournament.historyLog || [])],
      updatedAt: Date.now(),
    }),
  };
}

export function announceTournamentWinners(profile) {
  const tournament = recalculateStandings(normalizeTournament(profile.tournament));
  const winners = (tournament.standings || []).slice(0, 3);
  const oneVOneIncomplete = (tournament.standings || []).filter((entry) => Number(entry.oneVOneGamesPlayed || 0) < 1);
  const announcement = {
    id: createId("top-three"),
    winners,
    oneVOneWarning: oneVOneIncomplete.length
      ? `${oneVOneIncomplete.length} player(s) have not completed a 1v1 match.`
      : "",
    announcedAt: Date.now(),
    acknowledged: false,
  };
  return {
    ...profile,
    tournament: {
      ...tournament,
      finalAnnouncement: announcement,
      announcement,
      historyLog: [historyEntry("tournament:announce-top-three", "Top 3 announcement generated."), ...(tournament.historyLog || [])],
      updatedAt: Date.now(),
    },
  };
}

export function endTournament(profile) {
  const announcedProfile = announceTournamentWinners(profile);
  const tournament = announcedProfile.tournament;
  return {
    ...announcedProfile,
    tournament: {
      ...tournament,
      active: false,
      status: "complete",
      completedAt: Date.now(),
      historyLog: [historyEntry("tournament:end", "Tournament marked complete."), ...(tournament.historyLog || [])],
      updatedAt: Date.now(),
    },
  };
}

export function recalculateStandings(tournament) {
  const normalized = normalizeTournament(tournament);
  const records = new Map((normalized.players || []).map((player) => [player.playerId, createEmptyRecord(player)]));
  const applyWinLoss = (playerId, tableType, won) => {
    const record = records.get(playerId);
    if (!record) return;
    if (won) {
      record.totalWins += 1;
      if (tableType === "pod") record.podWins += 1;
      if (tableType === "oneVOne") record.oneVOneWins += 1;
    } else {
      record.totalLosses += 1;
      if (tableType === "pod") record.podLosses += 1;
      if (tableType === "oneVOne") record.oneVOneLosses += 1;
    }
    if (tableType === "oneVOne") record.oneVOneGamesPlayed += 1;
  };

  const completedTables = collectCompletedTables(normalized);
  completedTables.forEach(({ table, roundNumber }) => {
    const tablePlayers = table.players || [];
    tablePlayers.forEach((playerId) => applyWinLoss(playerId, table.tableType, playerId === table.winnerPlayerId));
    tablePlayers.forEach((playerId) => {
      const record = records.get(playerId);
      if (!record) return;
      record.currentTableId = "";
      record.currentTableType = "";
      record.headToHead = record.headToHead || {};
      tablePlayers.filter((otherId) => otherId !== playerId).forEach((otherId) => {
        const pair = record.headToHead[otherId] || { wins: 0, losses: 0 };
        if (playerId === table.winnerPlayerId) pair.wins += 1;
        else if (otherId === table.winnerPlayerId) pair.losses += 1;
        record.headToHead[otherId] = pair;
      });
    });
    if (table.tableType === "pod") {
      const placements = table.podPlacements || derivePlacements(table);
      Object.entries(placements).forEach(([playerId, placement]) => {
        const record = records.get(playerId);
        if (!record) return;
        const podSize = Math.max(1, tablePlayers.length);
        record.podPlacements.push(Number(placement) || podSize);
        record.averagePodPlacement = average(record.podPlacements.map((place) => podSize + 1 - place));
      });
      (table.eliminations || []).forEach((entry) => {
        const victim = records.get(entry.playerId);
        if (victim) {
          victim.eliminationHistory.push({
            ...entry,
            roundNumber,
            tableId: table.tableId,
          });
        }
        const eliminator = records.get(entry.eliminatedByPlayerId);
        if (eliminator) eliminator.podEliminations += 1;
      });
    }
  });

  (normalized.rounds || []).forEach((round) => {
    [round.podA, round.podB, round.oneVOne].filter(Boolean).forEach((table) => {
      if (table.status === "complete") return;
      (table.players || []).forEach((playerId) => {
        const record = records.get(playerId);
        if (record) {
          record.currentTableId = table.tableId;
          record.currentTableType = table.tableType;
        }
      });
    });
  });

  (normalized.results || []).forEach((result) => {
    (result.playerIds || []).forEach((playerId) => applyWinLoss(playerId, result.tableType || "oneVOne", playerId === result.winnerId));
  });

  const standings = [...records.values()].map((record) => {
    const manualWins = Math.max(0, Number(record.player.manualWins || 0));
    const manualLosses = Math.max(0, Number(record.player.manualLosses || 0));
    const totalWins = record.totalWins + manualWins;
    const totalLosses = record.totalLosses + manualLosses;
    return {
      rank: 0,
      playerId: record.player.playerId,
      id: record.player.playerId,
      displayName: record.player.displayName,
      name: record.player.displayName,
      commander: record.player.commander || "",
      deck: record.player.deck || "",
      deckNotes: record.player.deckNotes || "",
      active: record.player.active !== false,
      totalWins,
      wins: totalWins,
      totalLosses,
      losses: totalLosses,
      gamesPlayed: totalWins + totalLosses,
      totalRecord: `${totalWins}-${totalLosses}`,
      podWins: record.podWins,
      podLosses: record.podLosses,
      podRecord: `${record.podWins}-${record.podLosses}`,
      oneVOneWins: record.oneVOneWins,
      oneVOneLosses: record.oneVOneLosses,
      oneVOneRecord: `${record.oneVOneWins}-${record.oneVOneLosses}`,
      oneVOneGamesPlayed: record.oneVOneGamesPlayed,
      podEliminations: record.podEliminations,
      eliminationHistory: record.eliminationHistory,
      averagePodPlacement: Number(record.averagePodPlacement || 0),
      headToHead: record.headToHead,
      headToHeadSummary: summarizeHeadToHead(record.headToHead),
      currentTableId: record.currentTableId,
      currentTableType: record.currentTableType,
      syncStatus: record.player.syncStatus || "local",
      tiebreakerSummary: "",
    };
  });

  standings.sort((left, right) => compareStandings(left, right));
  standings.forEach((entry, index) => {
    const previous = standings[index - 1];
    entry.rank = previous && compareStandings(entry, previous, { ignoreName: true }) === 0 ? previous.rank : index + 1;
    entry.tiebreakerSummary = buildTiebreakerSummary(entry);
  });
  const players = (normalized.players || []).map((player) => {
    const standing = standings.find((entry) => entry.playerId === player.playerId);
    return {
      ...player,
      ...(standing || {}),
      id: player.playerId,
      name: player.displayName,
    };
  });
  return { ...normalized, players, standings };
}

function normalizeTournament(tournament = {}) {
  const base = createTournamentState(tournament || {});
  return {
    ...base,
    tournamentId: base.tournamentId || base.id || tournament.id || tournament.tournamentId || "",
    id: base.id || base.tournamentId || tournament.id || tournament.tournamentId || "",
    joinCode: base.joinCode || tournament.joinCode || tournament.sync?.sessionId || "",
    status: base.status || (base.active ? "setup" : "idle"),
    players: (base.players || []).map((player) => createPlayer(player)),
    rounds: Array.isArray(base.rounds) ? base.rounds.map(normalizeRound) : [],
    results: Array.isArray(base.results) ? base.results : [],
    settings: { ...DEFAULT_SETTINGS, ...(base.settings || {}) },
    historyLog: Array.isArray(base.historyLog) ? base.historyLog : [],
    pinned: Boolean(base.pinned),
    finalAnnouncement: base.finalAnnouncement || base.announcement || null,
    announcement: base.announcement || base.finalAnnouncement || null,
    sync: {
      mode: base.sync?.mode || "local",
      sessionId: base.sync?.sessionId || base.joinCode || "",
      wsUrl: base.sync?.wsUrl || "ws://localhost:8787",
      status: base.sync?.status || base.syncStatus || "local-only",
      lastSyncAt: Number(base.sync?.lastSyncAt || 0),
      namespace: base.sync?.namespace || "tournament",
      connectedPlayers: Array.isArray(base.sync?.connectedPlayers) ? base.sync.connectedPlayers : [],
    },
    syncStatus: base.syncStatus || base.sync?.status || "local-only",
  };
}

function ensureTournament(profile) {
  if (profile.tournament?.status && profile.tournament.status !== "idle") {
    return normalizeTournament(profile.tournament);
  }
  return createTournament(profile, { name: "Local Commander Tournament" }).tournament;
}

function createPlayer(source = {}) {
  const playerId = source.playerId || source.id || createId("tournament-player");
  const displayName = String(source.displayName || source.name || source.playerName || "Player").trim() || "Player";
  return {
    playerId,
    id: playerId,
    displayName,
    name: displayName,
    profileId: source.profileId || "",
    active: source.active !== false,
    role: source.role || "player",
    joinedAt: Number(source.joinedAt || Date.now()),
    deckNotes: String(source.deckNotes || source.commander || source.deck || ""),
    commander: String(source.commander || ""),
    deck: String(source.deck || ""),
    manualWins: Math.max(0, Number(source.manualWins || 0)),
    manualLosses: Math.max(0, Number(source.manualLosses || 0)),
    manualGames: Math.max(0, Number(source.manualGames || 0)),
    syncStatus: source.syncStatus || "local",
  };
}

function normalizePlayerName(player = {}) {
  return String(player.displayName || player.name || "").trim().toLowerCase();
}

function createRound(roundNumber, assignments, event = {}) {
  const now = Date.now();
  return normalizeRound({
    roundNumber,
    status: event.locked ? "active" : "pending",
    createdAt: now,
    podA: createTable(roundNumber, "A", "pod", assignments.podA),
    podB: createTable(roundNumber, "B", "pod", assignments.podB),
    oneVOne: createTable(roundNumber, "1v1", "oneVOne", assignments.oneVOne),
    suddenDeathStarted: false,
    extensionStarted: false,
    notes: "",
  });
}

function createTable(roundNumber, suffix, tableType, players) {
  const label = tableType === "oneVOne" ? "1v1 Table" : `Pod ${suffix}`;
  return {
    tableId: `round-${roundNumber}-${tableType === "oneVOne" ? "1v1" : `pod-${suffix.toLowerCase()}`}`,
    tableName: label,
    tableType,
    players: [...players],
    status: "pending",
    winnerPlayerId: "",
    losers: [],
    eliminations: [],
    eliminationOrder: [],
    podPlacements: {},
    resultConfirmed: false,
    resultReportedBy: "",
    extensionStarted: false,
    extensionTurns: {},
    lifeTotals: {},
    commanderDamageTaken: {},
    notes: "",
  };
}

function normalizeRound(round = {}) {
  return {
    roundNumber: Number(round.roundNumber || 1),
    status: round.status || "pending",
    createdAt: Number(round.createdAt || Date.now()),
    completedAt: Number(round.completedAt || 0),
    podA: normalizeTable(round.podA),
    podB: normalizeTable(round.podB),
    oneVOne: normalizeTable(round.oneVOne),
    suddenDeathStarted: Boolean(round.suddenDeathStarted),
    suddenDeathStartedAt: Number(round.suddenDeathStartedAt || 0),
    extensionStarted: Boolean(round.extensionStarted),
    notes: String(round.notes || ""),
  };
}

function normalizeTable(table = {}) {
  return {
    tableId: table.tableId || createId("table"),
    tableName: table.tableName || "Table",
    tableType: table.tableType || "pod",
    players: Array.isArray(table.players) ? table.players : [],
    status: table.status || "pending",
    winnerPlayerId: table.winnerPlayerId || "",
    losers: Array.isArray(table.losers) ? table.losers : [],
    eliminations: Array.isArray(table.eliminations) ? table.eliminations : [],
    eliminationOrder: Array.isArray(table.eliminationOrder) ? table.eliminationOrder : [],
    podPlacements: table.podPlacements || {},
    resultConfirmed: Boolean(table.resultConfirmed),
    resultReportedBy: table.resultReportedBy || "",
    extensionStarted: Boolean(table.extensionStarted),
    extensionTurns: table.extensionTurns || {},
    lifeTotals: table.lifeTotals || {},
    commanderDamageTaken: table.commanderDamageTaken || {},
    notes: String(table.notes || ""),
  };
}

function generateFirstRound(players, settings, event) {
  const ordered = event.randomize === false ? [...players] : shuffle([...players]);
  return {
    podA: ordered.slice(0, settings.podSize).map((player) => player.playerId),
    podB: ordered.slice(settings.podSize, settings.podSize * 2).map((player) => player.playerId),
    oneVOne: ordered.slice(settings.podSize * 2, settings.podSize * 2 + settings.oneVOneSize).map((player) => player.playerId),
  };
}

function generateNextRound(players, previousRound, tournament, settings) {
  const playerById = Object.fromEntries(players.map((player) => [player.playerId, player]));
  const standingsById = Object.fromEntries((tournament.standings || []).map((entry) => [entry.playerId, entry]));
  const oneVOneEligible = players.filter((player) => !settings.oneVOneBeforeRepeat || allPlayersHaveOneVOne(tournament) || Number(standingsById[player.playerId]?.oneVOneGamesPlayed || 0) < 1);
  const eliminationCandidates = getPreviousRoundEliminationOrder(previousRound).filter((id) => playerById[id]);
  const oneVOne = [];
  eliminationCandidates.forEach((playerId) => {
    if (oneVOne.length < settings.oneVOneSize && oneVOneEligible.some((player) => player.playerId === playerId) && !oneVOne.includes(playerId)) {
      oneVOne.push(playerId);
    }
  });
  players
    .filter((player) => oneVOneEligible.some((entry) => entry.playerId === player.playerId))
    .sort((left, right) => compareStandings(standingsById[left.playerId] || {}, standingsById[right.playerId] || {}))
    .forEach((player) => {
      if (oneVOne.length < settings.oneVOneSize && !oneVOne.includes(player.playerId)) {
        oneVOne.push(player.playerId);
      }
    });
  const remaining = players
    .map((player) => player.playerId)
    .filter((playerId) => !oneVOne.includes(playerId))
    .sort((leftId, rightId) => {
      const leftElim = eliminationCandidates.indexOf(leftId);
      const rightElim = eliminationCandidates.indexOf(rightId);
      const leftKnown = leftElim >= 0 ? leftElim : 999;
      const rightKnown = rightElim >= 0 ? rightElim : 999;
      if (leftKnown !== rightKnown) return leftKnown - rightKnown;
      return compareStandings(standingsById[leftId] || {}, standingsById[rightId] || {});
    });
  let podA = [];
  let podB = [];
  remaining.forEach((playerId, index) => {
    (index % 2 === 0 ? podA : podB).push(playerId);
  });
  if (podA.length > settings.podSize) {
    podB = [...podB, ...podA.splice(settings.podSize)];
  }
  if (podB.length > settings.podSize) {
    podA = [...podA, ...podB.splice(settings.podSize)];
  }
  if (settings.avoidSamePods && isSamePod(podA, previousRound.podA?.players) && podB.length) {
    [podA[0], podB[0]] = [podB[0], podA[0]];
  }
  if (settings.avoidSamePods && isSamePod(podB, previousRound.podB?.players) && podA.length > 1) {
    [podA[1], podB[0]] = [podB[0], podA[1]];
  }
  return { podA: podA.slice(0, 4), podB: podB.slice(0, 4), oneVOne: oneVOne.slice(0, 2) };
}

function completeTableResult(table, event, roundNumber) {
  const winnerPlayerId = event.winnerId || event.winnerPlayerId || "";
  const playerIds = table.players || [];
  const eliminationOrder = parseIdList(event.eliminationOrder).filter((id) => playerIds.includes(id) && id !== winnerPlayerId);
  const filledOrder = [...eliminationOrder, ...playerIds.filter((id) => id !== winnerPlayerId && !eliminationOrder.includes(id))];
  const eliminations = parseEliminations(event.eliminations, filledOrder, roundNumber, table.tableId);
  const podPlacements = table.tableType === "pod" ? derivePlacements({ ...table, winnerPlayerId, eliminationOrder: filledOrder }) : {};
  return {
    ...table,
    status: "complete",
    winnerPlayerId,
    losers: playerIds.filter((id) => id !== winnerPlayerId),
    eliminationOrder: table.tableType === "pod" ? filledOrder : [],
    eliminations,
    podPlacements,
    resultConfirmed: true,
    resultReportedBy: event.reportedBy || "host",
    lifeTotals: parseKeyValueNumbers(event.lifeTotals),
    commanderDamageTaken: parseKeyValueNumbers(event.commanderDamageTaken),
    notes: String(event.notes || ""),
  };
}

function startSuddenDeathOnRound(round) {
  const now = Date.now();
  const updatePod = (table) => table?.status === "complete" ? table : { ...table, status: "suddenDeath" };
  return {
    ...round,
    status: round.status === "complete" ? "complete" : "sudden-death",
    suddenDeathStarted: true,
    suddenDeathStartedAt: round.suddenDeathStartedAt || now,
    podA: updatePod(round.podA),
    podB: updatePod(round.podB),
  };
}

function updateRound(profile, roundNumber, updater, historyType, message) {
  const tournament = normalizeTournament(profile.tournament);
  return {
    ...profile,
    tournament: recalculateStandings({
      ...tournament,
      rounds: (tournament.rounds || []).map((round) => (round.roundNumber === roundNumber ? normalizeRound(updater(round)) : round)),
      historyLog: [historyEntry(historyType, message), ...(tournament.historyLog || [])],
      updatedAt: Date.now(),
    }),
  };
}

function createStandaloneResult(event = {}) {
  return {
    id: createId("match"),
    tableType: event.tableType || "oneVOne",
    winnerId: event.winnerId,
    playerIds: [...new Set([event.winnerId, ...(event.playerIds || [])])],
    reportedAt: Date.now(),
    note: String(event.note || ""),
  };
}

function createEmptyRecord(player) {
  return {
    player,
    totalWins: 0,
    totalLosses: 0,
    podWins: 0,
    podLosses: 0,
    oneVOneWins: 0,
    oneVOneLosses: 0,
    oneVOneGamesPlayed: 0,
    podEliminations: 0,
    eliminationHistory: [],
    podPlacements: [],
    averagePodPlacement: 0,
    headToHead: {},
    currentTableId: "",
    currentTableType: "",
  };
}

function collectCompletedTables(tournament) {
  return (tournament.rounds || []).flatMap((round) =>
    [round.podA, round.podB, round.oneVOne]
      .filter((table) => table?.status === "complete" && table.winnerPlayerId)
      .map((table) => ({ table, roundNumber: round.roundNumber }))
  );
}

function getTableKey(round, tableId) {
  return ["podA", "podB", "oneVOne"].find((key) => round?.[key]?.tableId === tableId || key === tableId);
}

function getPreviousRoundEliminationOrder(round) {
  const podOrders = [round?.podA?.eliminationOrder || [], round?.podB?.eliminationOrder || []];
  const ordered = [];
  const maxLength = Math.max(...podOrders.map((order) => order.length), 0);
  for (let index = 0; index < maxLength; index += 1) {
    podOrders.forEach((order) => {
      if (order[index] && !ordered.includes(order[index])) {
        ordered.push(order[index]);
      }
    });
  }
  return ordered;
}

function allPlayersHaveOneVOne(tournament) {
  const standingsById = Object.fromEntries((tournament.standings || []).map((entry) => [entry.playerId, entry]));
  return (tournament.players || []).every((player) => Number(standingsById[player.playerId]?.oneVOneGamesPlayed || 0) >= 1);
}

function compareStandings(left, right, options = {}) {
  const headToHeadDelta = Number(left.headToHead?.[right.playerId]?.wins || 0) - Number(right.headToHead?.[left.playerId]?.wins || 0);
  return (
    Number(right.totalWins || right.wins || 0) - Number(left.totalWins || left.wins || 0) ||
    Number(right.podWins || 0) - Number(left.podWins || 0) ||
    Number(right.oneVOneWins || 0) - Number(left.oneVOneWins || 0) ||
    Number(left.totalLosses || left.losses || 0) - Number(right.totalLosses || right.losses || 0) ||
    -headToHeadDelta ||
    Number(right.podEliminations || 0) - Number(left.podEliminations || 0) ||
    Number(right.averagePodPlacement || 0) - Number(left.averagePodPlacement || 0) ||
    (options.ignoreName ? 0 : String(left.displayName || left.name || "").localeCompare(String(right.displayName || right.name || "")))
  );
}

function buildTiebreakerSummary(entry) {
  return [
    `${entry.podWins} pod win(s)`,
    `${entry.oneVOneWins} 1v1 win(s)`,
    `${entry.totalLosses} loss(es)`,
    `${entry.podEliminations} pod elimination(s)`,
    `avg pod placement score ${Number(entry.averagePodPlacement || 0).toFixed(2)}`,
  ].join(" / ");
}

function summarizeHeadToHead(headToHead = {}) {
  const entries = Object.entries(headToHead);
  if (!entries.length) return "No head-to-head yet";
  const wins = entries.reduce((sum, [, value]) => sum + Number(value.wins || 0), 0);
  const losses = entries.reduce((sum, [, value]) => sum + Number(value.losses || 0), 0);
  return `${wins}-${losses}`;
}

function derivePlacements(table) {
  const players = table.players || [];
  const placements = {};
  if (table.winnerPlayerId) placements[table.winnerPlayerId] = 1;
  const order = table.eliminationOrder || [];
  order.forEach((playerId, index) => {
    placements[playerId] = players.length - index;
  });
  players.forEach((playerId) => {
    if (!placements[playerId]) placements[playerId] = players.length;
  });
  return placements;
}

function parseIdList(value = "") {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value || "")
    .split(/[\n,>]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseEliminations(value = "", fallbackOrder = [], roundNumber = 0, tableId = "") {
  if (Array.isArray(value)) return value;
  const explicit = String(value || "")
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const [eliminatedByPlayerId, playerId] = entry.split(/>|:/).map((part) => part.trim());
      return {
        playerId: playerId || eliminatedByPlayerId || fallbackOrder[index] || "",
        eliminatedByPlayerId: playerId ? eliminatedByPlayerId : "",
        order: index + 1,
        roundNumber,
        tableId,
        placement: fallbackOrder.length - index + 1,
      };
    });
  if (explicit.length) return explicit.filter((entry) => entry.playerId);
  return fallbackOrder.map((playerId, index) => ({
    playerId,
    eliminatedByPlayerId: "",
    order: index + 1,
    roundNumber,
    tableId,
    placement: fallbackOrder.length - index + 1,
  }));
}

function parseKeyValueNumbers(value = "") {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return Object.fromEntries(
    String(value || "")
      .split(/[\n,]+/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [key, amount] = entry.split(/[:=]/).map((part) => part.trim());
        return [key, Math.max(0, Number(amount) || 0)];
      })
  );
}

function withTournamentNotice(profile, message) {
  return {
    ...profile,
    tournament: {
      ...normalizeTournament(profile.tournament),
      lastError: message,
      updatedAt: Date.now(),
    },
  };
}

function makeJoinCode(seed = "") {
  const raw = String(seed || createId("tournament")).replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `MTG-${raw.slice(-6).padStart(6, "0")}`;
}

function historyEntry(type, summary) {
  return {
    id: createId("tournament-log"),
    type,
    summary,
    at: Date.now(),
  };
}

function average(values = []) {
  return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0;
}

function isSamePod(left = [], right = []) {
  if (!Array.isArray(right) || left.length !== right.length) return false;
  const normalizedLeft = [...left].sort().join("|");
  const normalizedRight = [...right].sort().join("|");
  return normalizedLeft === normalizedRight;
}

function shuffle(list) {
  for (let index = list.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [list[index], list[target]] = [list[target], list[index]];
  }
  return list;
}
