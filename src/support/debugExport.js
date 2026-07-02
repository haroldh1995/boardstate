import { PHASES } from "../state/schema.js";

export const RULES_CONFIDENCE = {
  AUTO_RESOLVED: "auto-resolved",
  MANUAL_CHOICE: "manual-choice-required",
  PARTIAL: "partially-supported",
  IGNORED: "ignored-this-game",
  NEEDS_REVIEW: "needs-review",
  FAILED: "failed-recovery-needed",
};

export function createRecoveryEntry({
  source = "app",
  message = "Something needs attention.",
  technicalMessage = "",
  severity = "info",
  suggestedAction = "",
  action = "",
} = {}) {
  return {
    id: `recovery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source,
    message,
    technicalMessage,
    severity,
    suggestedAction,
    action,
    timestamp: Date.now(),
    dismissed: false,
  };
}

export function confidenceLabel(value = "") {
  const normalized = String(value || "").toLowerCase();
  const labels = {
    [RULES_CONFIDENCE.AUTO_RESOLVED]: "Auto-resolved",
    [RULES_CONFIDENCE.MANUAL_CHOICE]: "Manual choice required",
    [RULES_CONFIDENCE.PARTIAL]: "Partially supported",
    [RULES_CONFIDENCE.IGNORED]: "Ignored this game",
    [RULES_CONFIDENCE.NEEDS_REVIEW]: "Needs review",
    [RULES_CONFIDENCE.FAILED]: "Failed / recovery needed",
  };
  return labels[normalized] || labels[RULES_CONFIDENCE.NEEDS_REVIEW];
}

export function buildGameLog(profile = {}) {
  const session = profile.activeSession || {};
  return {
    exportedAt: new Date().toISOString(),
    gameId: session.id || "",
    turn: session.turn || 1,
    phase: PHASES[session.phaseIndex] || "Unknown",
    gameTracking: session.gameTracking || {},
    simulation: summarizeSimulation(session.simulation),
    turnsAndActions: (session.history || []).slice(0, 250),
    actionHistory: (session.actionHistory || []).slice(0, 250),
    eventHistory: (session.eventHistory || []).slice(0, 120),
    effects: (session.effectLog || []).slice(0, 120),
    pendingTriggers: summarizeTriggerQueue(session.triggerQueue),
    manualChoices: summarizeManualChoices(session.pendingEffects),
    life: session.life,
    commanderDamage: session.commander?.damageByOpponent || {},
    manaPool: session.manaPool || {},
    battlefieldSummary: summarizeBattlefield(session),
  };
}

export function buildDebugState(profile = {}, currentPage = "life") {
  const session = profile.activeSession || {};
  return {
    exportedAt: new Date().toISOString(),
    app: getAppVersion(),
    currentPage,
    player: {
      id: profile.player?.id || "local-player",
      name: profile.player?.name || "Player",
    },
    mode: {
      gameTracking: session.gameTracking || {},
      simulation: summarizeSimulation(session.simulation),
      multiplayer: profile.settings?.multiplayer || {},
    },
    turn: {
      number: session.turn || 1,
      phaseIndex: session.phaseIndex || 0,
      phase: PHASES[session.phaseIndex] || "Unknown",
      turnOrder: session.simulation?.turnOrder || session.syncedMultiplayer?.turnOrder || [],
      currentPlayerId: session.simulation?.currentPlayerId || session.syncedMultiplayer?.currentPlayerId || "local-player",
    },
    queues: {
      stack: (session.stack || []).slice(0, 40).map((entry) => ({
        id: entry.id,
        name: entry.name,
        typeLine: entry.typeLine,
        controller: entry.controller,
        sourceZone: entry.sourceZone,
        targets: entry.targetIds || [],
        modes: entry.selectedModes || [],
        xValue: entry.xValue,
        status: entry.status,
        rulesConfidence: entry.rulesConfidence,
      })),
      triggers: summarizeTriggerQueue(session.triggerQueue),
      manualChoices: summarizeManualChoices(session.pendingEffects),
      eventQueue: (session.eventQueue || []).slice(0, 40),
    },
    rulesConfidence: collectRulesConfidence(profile),
    recoveryLog: (session.recoveryLog || []).slice(0, 40),
    recentActions: (session.actionHistory || []).slice(0, 80),
    recentEffects: (session.effectLog || []).slice(0, 80),
    scryfall: {
      online: typeof navigator !== "undefined" ? navigator.onLine : true,
    },
    storage: {
      profileMode: profile.localAuth?.mode || "guest",
      hasPassword: Boolean(profile.localAuth?.hasPassword),
      localStorageAvailable: isLocalStorageAvailable(),
    },
    platform: getPlatformInfo(),
  };
}

export function buildBugReport(profile = {}, currentPage = "life") {
  return {
    reportType: "BoardState bug report",
    debugState: buildDebugState(profile, currentPage),
    gameLog: buildGameLog(profile),
    privacy: {
      excludesPlaintextPasswords: true,
      excludesSecretKeys: true,
      note: "Local profile status is included, but password text and private tokens are not exported.",
    },
  };
}

export function collectRulesConfidence(profile = {}) {
  const session = profile.activeSession || {};
  return [
    ...(session.triggerQueue || []).slice(0, 80).map((entry) => ({
      id: entry.id,
      sourceName: entry.sourceName,
      summary: `${entry.eventType || "Trigger"} trigger`,
      status: entry.status || "pending",
      rulesConfidence: entry.rulesConfidence || inferConfidenceFromStatus(entry.status, entry.effectDefinitions),
    })),
    ...(session.pendingEffects || []).slice(0, 80).map((entry) => ({
      id: entry.id,
      sourceName: entry.sourceName,
      summary: entry.summary || entry.effect?.summary || "Manual effect",
      status: entry.status || "pending",
      rulesConfidence: entry.rulesConfidence || inferConfidenceFromStatus(entry.status),
    })),
    ...(session.effectLog || []).slice(0, 80).map((entry) => ({
      id: entry.id,
      sourceName: entry.sourceName,
      summary: entry.summary,
      status: entry.status || "logged",
      rulesConfidence: entry.rulesConfidence || inferConfidenceFromStatus(entry.status),
    })),
  ].slice(0, 160);
}

export function safeJson(value) {
  return JSON.stringify(value, redactSecrets, 2);
}

function summarizeSimulation(simulation = {}) {
  return {
    enabled: Boolean(simulation.enabled),
    status: simulation.status || "idle",
    format: simulation.format || "",
    selectedOpponents: simulation.selectedOpponents || [],
    turnOrder: simulation.turnOrder || [],
    currentPlayerId: simulation.currentPlayerId || "",
    currentPhaseIndex: simulation.currentPhaseIndex || 0,
    waitingForUser: Boolean(simulation.waitingForUser),
    log: (simulation.log || []).slice(0, 80),
  };
}

function summarizeBattlefield(session = {}) {
  const summarizeSide = (side = []) =>
    side.map((permanent) => ({
      id: permanent.id,
      name: permanent.name,
      quantity: permanent.quantity || 1,
      controller: permanent.controller || "player",
      typeLine: permanent.typeLine,
      counters: permanent.counters || {},
      tapped: Boolean(permanent.tapped),
      attacking: Boolean(permanent.attacking),
      currentPower: permanent.currentPower,
      currentToughness: permanent.currentToughness,
    }));
  return {
    player: summarizeSide(session.battlefield?.player || []),
    opponent: summarizeSide(session.battlefield?.opponent || []),
  };
}

function summarizeTriggerQueue(queue = []) {
  return queue.slice(0, 80).map((entry) => ({
    id: entry.id,
    sourceName: entry.sourceName,
    eventType: entry.eventType,
    status: entry.status,
    rulesConfidence: entry.rulesConfidence || inferConfidenceFromStatus(entry.status, entry.effectDefinitions),
  }));
}

function summarizeManualChoices(pendingEffects = []) {
  return pendingEffects.slice(0, 80).map((entry) => ({
    id: entry.id,
    sourceName: entry.sourceName,
    summary: entry.summary || entry.effect?.summary || entry.effect?.reason || "",
    status: entry.status,
    rulesConfidence: entry.rulesConfidence || inferConfidenceFromStatus(entry.status),
  }));
}

function inferConfidenceFromStatus(status = "", effectDefinitions = []) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "resolved") return RULES_CONFIDENCE.AUTO_RESOLVED;
  if (normalized === "ignored") return RULES_CONFIDENCE.IGNORED;
  if (normalized === "failed") return RULES_CONFIDENCE.FAILED;
  if (effectDefinitions?.some((effect) => effect.manual || effect.optional)) return RULES_CONFIDENCE.MANUAL_CHOICE;
  if (normalized === "pending") return RULES_CONFIDENCE.MANUAL_CHOICE;
  if (normalized === "skipped" || normalized === "delayed") return RULES_CONFIDENCE.NEEDS_REVIEW;
  return RULES_CONFIDENCE.NEEDS_REVIEW;
}

function redactSecrets(key, value) {
  if (/password|token|secret|key/i.test(String(key || ""))) {
    if (key === "hasPassword") {
      return value;
    }
    return "[redacted]";
  }
  return value;
}

function getAppVersion() {
  return {
    name: "BoardState",
    version: "1.18.0",
    build: "guided-tutorial-save-release",
  };
}

function isLocalStorageAvailable() {
  try {
    const key = "__boardstate_storage_test__";
    localStorage.setItem(key, "1");
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function getPlatformInfo() {
  if (typeof navigator === "undefined") {
    return {};
  }
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    online: navigator.onLine,
  };
}
