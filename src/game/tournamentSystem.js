import { createId, normalizeCount } from "../state/ids.js";
import { createTournamentState } from "../state/schema.js";

export function createTournament(profile, event = {}) {
  const now = Date.now();
  const host = createPlayer(event.hostName || profile.player?.name || "Player", "host");
  return {
    ...profile,
    tournament: recalculateStandings(
      createTournamentState({
        active: true,
        id: event.id || createId("tournament"),
        name: event.name || "Local Commander Tournament",
        role: "host",
        players: [host],
        sync: {
          mode: "local",
          sessionId: event.sessionId || createId("tournament-session"),
          lastSyncAt: now,
          status: "local-only",
        },
        createdAt: now,
        updatedAt: now,
      })
    ),
  };
}

export function joinTournament(profile, event = {}) {
  const tournament = profile.tournament?.active ? profile.tournament : createTournamentState({
    active: true,
    id: event.id || createId("tournament"),
    name: event.name || "Local Commander Tournament",
    role: "player",
    sync: { mode: "local", sessionId: event.sessionId || createId("tournament-session"), status: "local-only" },
    createdAt: Date.now(),
  });
  const player = createPlayer(event.playerName || profile.player?.name || "Player", "player", event);
  if ((tournament.players || []).some((entry) => entry.name.toLowerCase() === player.name.toLowerCase())) {
    return profile;
  }
  return {
    ...profile,
    tournament: recalculateStandings({ ...tournament, players: [...tournament.players, player], updatedAt: Date.now() }),
  };
}

export function addTournamentPlayer(profile, event = {}) {
  return joinTournament(profile, event);
}

export function reportTournamentResult(profile, event = {}) {
  const tournament = profile.tournament;
  if (!tournament?.active || !event.winnerId) return profile;
  const result = {
    id: createId("match"),
    winnerId: event.winnerId,
    playerIds: [...new Set([event.winnerId, ...(event.playerIds || [])])],
    reportedAt: Date.now(),
    note: String(event.note || ""),
  };
  return {
    ...profile,
    tournament: recalculateStandings({ ...tournament, results: [...(tournament.results || []), result], announcement: null, updatedAt: Date.now() }),
  };
}

export function correctTournamentPlayer(profile, event = {}) {
  const tournament = profile.tournament;
  if (!tournament?.active || !event.playerId) return profile;
  const players = tournament.players.map((player) =>
    player.id === event.playerId
      ? { ...player, manualWins: Math.max(0, normalizeCount(event.wins)), manualGames: Math.max(0, normalizeCount(event.gamesPlayed)), updatedAt: Date.now() }
      : player
  );
  return { ...profile, tournament: recalculateStandings({ ...tournament, players, announcement: null, updatedAt: Date.now() }) };
}

export function announceTournamentWinners(profile) {
  const tournament = recalculateStandings(profile.tournament || createTournamentState());
  return {
    ...profile,
    tournament: {
      ...tournament,
      announcement: {
        id: createId("top-three"),
        winners: tournament.standings.slice(0, 3),
        announcedAt: Date.now(),
        acknowledged: false,
      },
      updatedAt: Date.now(),
    },
  };
}

export function endTournament(profile) {
  if (!profile.tournament?.active) return profile;
  return { ...profile, tournament: { ...profile.tournament, active: false, updatedAt: Date.now() } };
}

export function recalculateStandings(tournament) {
  const results = tournament.results || [];
  const standings = (tournament.players || []).map((player) => {
    const relevant = results.filter((result) => result.playerIds.includes(player.id));
    const wins = relevant.filter((result) => result.winnerId === player.id).length + Math.max(0, Number(player.manualWins || 0));
    const gamesPlayed = relevant.length + Math.max(0, Number(player.manualGames || 0));
    return {
      rank: 0,
      playerId: player.id,
      name: player.name,
      wins,
      gamesPlayed,
      losses: Math.max(0, gamesPlayed - wins),
      commander: player.commander || "",
      deck: player.deck || "",
      syncStatus: player.syncStatus || "local",
    };
  });
  standings.sort((left, right) => right.wins - left.wins || right.gamesPlayed - left.gamesPlayed || left.name.localeCompare(right.name));
  standings.forEach((entry, index) => {
    entry.rank = index + 1;
  });
  return { ...tournament, standings };
}

function createPlayer(name, role = "player", source = {}) {
  return {
    id: source.playerId || createId("tournament-player"),
    name: String(name || "Player").trim() || "Player",
    role,
    commander: String(source.commander || ""),
    deck: String(source.deck || ""),
    syncStatus: "local",
    joinedAt: Date.now(),
  };
}
