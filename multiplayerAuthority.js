export function createPublicSyncPacket(input) {
  return {
    id: `sync_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    authority: "local-player",
    sourcePlayerId: input.sourcePlayerId || "",
    type: input.type || "PublicSync",
    summary: input.summary || "Public battlefield state updated.",
    payload: input.payload || {},
  };
}

export function validatePublicAction(intent) {
  if (!intent?.actionType) return { legal: false, reason: "Missing action type." };
  if (intent.actionType === "Attack" && (!intent.targets || intent.targets.length === 0)) {
    return { legal: false, reason: "Attack requires a target player or planeswalker." };
  }
  return { legal: true };
}
