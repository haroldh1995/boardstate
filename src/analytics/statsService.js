export function buildStats(profile) {
  const archives = profile.archives || [];
  const session = profile.activeSession;
  const permanents = [...session.battlefield.player, ...session.battlefield.opponent];
  const tokens = permanents.filter((permanent) => permanent.isToken);
  const counters = permanents.flatMap((permanent) => Object.entries(permanent.counters || {}));
  const manaTotal = Object.values(session.manaPool || {}).reduce((sum, value) => sum + value, 0);

  return {
    gamesPlayed: archives.length,
    actionsThisGame: session.history.length,
    currentBoardSize: permanents.length,
    highestLife: Math.max(session.life, ...archives.map((game) => game.summary?.highestLife || 0)),
    largestTokenArmy: Math.max(tokens.reduce((sum, token) => sum + token.quantity, 0), ...archives.map((game) => game.summary?.largestTokenArmy || 0)),
    counterTypes: summarizeEntries(counters),
    manaFloating: manaTotal,
    triggersResolved: session.effectLog.length,
    commanderCount: Object.keys(profile.commanders || {}).length,
  };
}

export function updateLeaderboards(profile) {
  const stats = buildStats(profile);
  return {
    ...profile,
    leaderboards: {
      ...profile.leaderboards,
      highestLife: pushRecord(profile.leaderboards.highestLife, "Highest Life", stats.highestLife),
      largestTokenArmy: pushRecord(profile.leaderboards.largestTokenArmy, "Largest Token Army", stats.largestTokenArmy),
      largestManaPool: pushRecord(profile.leaderboards.largestManaPool, "Largest Mana Pool", stats.manaFloating),
      biggestBoardState: pushRecord(profile.leaderboards.biggestBoardState, "Biggest Board", stats.currentBoardSize),
      mostTriggers: pushRecord(profile.leaderboards.mostTriggers, "Most Triggers", stats.triggersResolved),
    },
  };
}

function pushRecord(list = [], label, value) {
  return [...list, { label, value, at: Date.now() }]
    .sort((left, right) => right.value - left.value)
    .slice(0, 10);
}

function summarizeEntries(entries) {
  return entries.reduce((summary, [name, count]) => {
    summary[name] = (summary[name] || 0) + count;
    return summary;
  }, {});
}
