export const DEFAULT_COMBAT_RECOMMENDATION_SETTINGS = {
  enabled: false,
  showProjectedLethal: true,
  showBadBlocks: true,
  showCommanderLethal: true,
  showEngineLossWarnings: true,
  showInfiniteLoopWarnings: true,
};

export function createDefaultRulesRegistry() {
  return [
    { id: "combat", enabled: true },
    { id: "tokens", enabled: true },
    { id: "replacement-effects", enabled: true },
    { id: "counters", enabled: true },
    { id: "commander", enabled: true },
    { id: "multiplayer", enabled: true },
    { id: "priority", enabled: true },
    { id: "state-based-actions", enabled: true },
  ];
}
