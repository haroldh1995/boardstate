const STATS_KEY = "boardstate_stats_v1";
export const DEFAULT_TURN_LIMIT_MS = 5 * 60 * 1000;

export function createDefaultStatsProfile(playerName = "Player") {
  return {
    playerId: `player_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    playerName,
    games: [],
    commanderMatchups: [],
  };
}

export function loadStatsProfile(playerName = "Player") {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? { ...createDefaultStatsProfile(playerName), ...JSON.parse(raw) } : createDefaultStatsProfile(playerName);
  } catch {
    return createDefaultStatsProfile(playerName);
  }
}

export function saveStatsProfile(profile) {
  localStorage.setItem(STATS_KEY, JSON.stringify(profile));
}

export function createTurnTimerState() {
  return { isGameStarted: false, isTurnActive: false, turnLimitMs: DEFAULT_TURN_LIMIT_MS, elapsedMs: 0 };
}
