import {
  DEFAULT_COMPANION_SETTINGS,
  LIFE_ROLLBACK_WINDOW_MS,
  MANA_COLORS,
  MAX_HISTORY_ENTRIES,
  MAX_UNDO_ENTRIES,
} from "../Models/GameModels.js";

export function createDefaultCompanionState() {
  return {
    settings: { ...DEFAULT_COMPANION_SETTINGS },
    history: [],
    undoStack: [],
    lifeRollback: null,
    recentCounterSearches: [],
    triggerQueue: [],
    floatingMana: createEmptyFloatingMana(),
  };
}

export function normalizeCompanionState(source = {}) {
  const fallback = createDefaultCompanionState();
  return {
    settings: {
      adhdMode: Boolean(source?.settings?.adhdMode),
      autoResolveDeterministic:
        source?.settings?.autoResolveDeterministic === undefined
          ? fallback.settings.autoResolveDeterministic
          : Boolean(source.settings.autoResolveDeterministic),
      triggerRemindersEnabled:
        source?.settings?.triggerRemindersEnabled === undefined
          ? fallback.settings.triggerRemindersEnabled
          : Boolean(source.settings.triggerRemindersEnabled),
      manaAutoClearEnabled:
        source?.settings?.manaAutoClearEnabled === undefined
          ? fallback.settings.manaAutoClearEnabled
          : Boolean(source.settings.manaAutoClearEnabled),
    },
    history: Array.isArray(source?.history)
      ? source.history
          .map((entry) => ({
            id: normalizeText(entry?.id),
            type: normalizeText(entry?.type, "event"),
            summary: normalizeText(entry?.summary, "Action resolved"),
            timestamp: normalizeTimestamp(entry?.timestamp),
            payload: isRecord(entry?.payload) ? entry.payload : {},
          }))
          .filter((entry) => entry.id)
          .slice(-MAX_HISTORY_ENTRIES)
      : [],
    undoStack: Array.isArray(source?.undoStack)
      ? source.undoStack
          .map((entry) => ({
            id: normalizeText(entry?.id),
            timestamp: normalizeTimestamp(entry?.timestamp),
            reason: normalizeText(entry?.reason, "Undo snapshot"),
            snapshot: isRecord(entry?.snapshot) ? entry.snapshot : null,
          }))
          .filter((entry) => entry.id && entry.snapshot)
          .slice(-MAX_UNDO_ENTRIES)
      : [],
    lifeRollback: normalizeLifeRollback(source?.lifeRollback),
    recentCounterSearches: Array.isArray(source?.recentCounterSearches)
      ? source.recentCounterSearches
          .map((value) => normalizeText(value))
          .filter(Boolean)
          .slice(0, 5)
      : [],
    triggerQueue: Array.isArray(source?.triggerQueue)
      ? source.triggerQueue
          .map((entry) => ({
            id: normalizeText(entry?.id),
            summary: normalizeText(entry?.summary, "Trigger reminder"),
            source: normalizeText(entry?.source, "Board"),
            deterministic: Boolean(entry?.deterministic),
            timestamp: normalizeTimestamp(entry?.timestamp),
          }))
          .filter((entry) => entry.id)
      : [],
    floatingMana: normalizeFloatingMana(source?.floatingMana),
  };
}

export function createHistoryEntry({ type, summary, payload = {}, timestamp = Date.now() }) {
  return {
    id: createLocalId(),
    type: normalizeText(type, "event"),
    summary: normalizeText(summary, "Action resolved"),
    timestamp: normalizeTimestamp(timestamp),
    payload: isRecord(payload) ? payload : {},
  };
}

export function recordHistoryAction(companionState, historyEntry) {
  return {
    ...companionState,
    history: [...(companionState?.history || []), historyEntry].slice(-MAX_HISTORY_ENTRIES),
  };
}

export function pushUndoSnapshot(companionState, { reason, snapshot, timestamp = Date.now() }) {
  if (!snapshot) {
    return companionState;
  }

  const undoEntry = {
    id: createLocalId(),
    reason: normalizeText(reason, "Undo snapshot"),
    timestamp: normalizeTimestamp(timestamp),
    snapshot,
  };
  return {
    ...companionState,
    undoStack: [...(companionState?.undoStack || []), undoEntry].slice(-MAX_UNDO_ENTRIES),
  };
}

export function popUndoSnapshot(companionState) {
  const undoStack = Array.isArray(companionState?.undoStack) ? companionState.undoStack : [];
  if (undoStack.length === 0) {
    return { companionState, undoEntry: null };
  }

  const undoEntry = undoStack[undoStack.length - 1];
  return {
    companionState: {
      ...companionState,
      undoStack: undoStack.slice(0, -1),
    },
    undoEntry,
  };
}

export function createLifeRollbackBuffer({ previousLife, nextLife, timestamp = Date.now() }) {
  return {
    previousLife: Number.isFinite(previousLife) ? Math.max(0, Math.round(previousLife)) : 0,
    nextLife: Number.isFinite(nextLife) ? Math.max(0, Math.round(nextLife)) : 0,
    expiresAt: normalizeTimestamp(timestamp) + LIFE_ROLLBACK_WINDOW_MS,
  };
}

export function hasActiveLifeRollback(lifeRollback, now = Date.now()) {
  return Boolean(lifeRollback?.expiresAt) && normalizeTimestamp(now) <= lifeRollback.expiresAt;
}

export function normalizePhaseKey(phaseLabel) {
  return normalizeText(phaseLabel).toLowerCase().replace(/\s+/g, "");
}

export function createEmptyFloatingMana() {
  return MANA_COLORS.reduce((accumulator, color) => {
    accumulator[color] = 0;
    return accumulator;
  }, {});
}

export function normalizeFloatingMana(source = {}) {
  return MANA_COLORS.reduce((accumulator, color) => {
    const value = Number(source?.[color]);
    accumulator[color] = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
    return accumulator;
  }, {});
}

function normalizeLifeRollback(source = null) {
  if (!source || typeof source !== "object") {
    return null;
  }

  const expiresAt = normalizeTimestamp(source.expiresAt);
  if (!expiresAt) {
    return null;
  }

  return {
    previousLife: Number.isFinite(source.previousLife) ? Math.max(0, Math.round(source.previousLife)) : 0,
    nextLife: Number.isFinite(source.nextLife) ? Math.max(0, Math.round(source.nextLife)) : 0,
    expiresAt,
  };
}

function createLocalId() {
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeText(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }
  const next = value.trim();
  return next || fallback;
}

function normalizeTimestamp(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : Date.now();
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
