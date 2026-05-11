export function createActionHistoryState() {
  return { entries: [], undoStack: [], maxEntries: 150 };
}

export function createActionEntry(input) {
  return {
    id: `action_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    type: input.type || "ManualResolution",
    title: input.title || "Action",
    summary: input.summary || "",
    createdAt: Date.now(),
    playerId: input.playerId || "",
    sourceCardName: input.sourceCardName || "",
    beforeSnapshot: input.beforeSnapshot,
    afterSnapshot: input.afterSnapshot,
    lockedInMultiplayer: Boolean(input.lockedInMultiplayer),
    canUndo: input.canUndo !== false,
  };
}

export function pushActionEntry(history, entry) {
  const next = history || createActionHistoryState();
  return {
    ...next,
    entries: [entry, ...next.entries].slice(0, next.maxEntries),
    undoStack: entry.canUndo ? [entry, ...next.undoStack].slice(0, next.maxEntries) : next.undoStack,
  };
}

export function getUndoCandidate(history) {
  return history?.undoStack?.find((entry) => entry.canUndo && !entry.lockedInMultiplayer);
}
