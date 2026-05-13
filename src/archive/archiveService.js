import { createGameSession } from "../state/schema.js";
import { buildStats, updateLeaderboards } from "../analytics/statsService.js";

export function archiveCurrentGame(profile, result = "completed") {
  const session = profile.activeSession;
  const entry = {
    id: session.id,
    commanderName: session.commander?.name || "No Commander",
    result,
    endedAt: Date.now(),
    durationMs: Date.now() - session.createdAt,
    history: session.history,
    effectLog: session.effectLog,
    boardState: session.battlefield,
    combat: session.combat,
    summary: buildStats(profile),
  };
  const withArchive = {
    ...profile,
    archives: [entry, ...(profile.archives || [])].slice(0, 100),
    activeSession: createGameSession(),
  };
  return updateLeaderboards(withArchive);
}
