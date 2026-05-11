const ACTIVE_GAME_STORAGE_KEY = "boardstate_active_game_v1";

export function saveActiveGame(gameState, options = {}) {
  localStorage.setItem(ACTIVE_GAME_STORAGE_KEY, JSON.stringify({
    schemaVersion: 1,
    savedAt: Date.now(),
    gameState,
    activeCommanderDeckId: options.activeCommanderDeckId || "",
    currentGameStatId: options.currentGameStatId || "",
  }));
}

export function loadActiveGame() {
  try {
    const raw = localStorage.getItem(ACTIVE_GAME_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearActiveGame() {
  localStorage.removeItem(ACTIVE_GAME_STORAGE_KEY);
}
