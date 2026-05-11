import { MANA_COLORS, PHASE_ALIAS_MAP } from "../Models/GameModels.js";
import { getFloatingManaTotal, isFloatingManaEmpty } from "../Services/FloatingManaService.js";

export function buildCompanionViewModel(appState) {
  const companion = appState?.companion || {};
  const floatingMana = companion.floatingMana || {};
  const manaTotal = getFloatingManaTotal(floatingMana);
  const phaseLabel = PHASE_ALIAS_MAP[appState?.boardStatePhase || appState?.boardPhase] || appState?.boardStatePhase || appState?.boardPhase || "";

  return {
    phaseLabel,
    manaTotal,
    floatingMana: MANA_COLORS.reduce((accumulator, color) => {
      accumulator[color] = Number(floatingMana[color]) || 0;
      return accumulator;
    }, {}),
    floatingManaCollapsed: isFloatingManaEmpty(floatingMana),
    adhdModeEnabled: Boolean(companion?.settings?.adhdMode),
    triggerRemindersEnabled: Boolean(companion?.settings?.triggerRemindersEnabled),
    autoResolveDeterministic: Boolean(companion?.settings?.autoResolveDeterministic),
    historyCount: Array.isArray(companion?.history) ? companion.history.length : 0,
    undoCount: Array.isArray(companion?.undoStack) ? companion.undoStack.length : 0,
  };
}
