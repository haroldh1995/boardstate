export const BOARDSTATE_SENSORY_LANGUAGE_VERSION = "boardstate-sensory-language-0.1.0";

export const AUDIO_TOKEN_IDS = Object.freeze({
  interactionConfirm: "interaction-confirm",
  selection: "selection",
  deselection: "deselection",
  cardPickup: "card-pickup",
  cardPlacement: "card-placement",
  cardDraw: "card-draw",
  cardResolve: "card-resolve",
  error: "error",
  warning: "warning",
  success: "success",
  notification: "notification",
  commanderEvent: "commander-event",
  combat: "combat",
  search: "search",
  modalOpen: "modal-open",
  modalClose: "modal-close",
  handReorder: "hand-reorder",
  ambient: "ambient",
});

export const HAPTIC_TOKEN_IDS = Object.freeze({
  lightConfirmation: "light-confirmation",
  mediumConfirmation: "medium-confirmation",
  heavyConfirmation: "heavy-confirmation",
  selection: "selection",
  error: "error",
  success: "success",
  warning: "warning",
  longPress: "long-press",
  cardPlacement: "card-placement",
  commanderEvent: "commander-event",
  handReorder: "hand-reorder",
});

export const SENSORY_CHANNELS = Object.freeze({
  ui: "ui",
  gameplay: "gameplay",
  ambient: "ambient",
  music: "music",
  haptics: "haptics",
});

export const SENSORY_PRIORITY = Object.freeze({
  criticalGameplay: "critical-gameplay",
  commanderEvent: "commander-event",
  cardInteraction: "card-interaction",
  contextualAction: "contextual-action",
  notification: "notification",
  backgroundFeedback: "background-feedback",
  decorative: "decorative",
});

export const SENSORY_DEBUG_FIELDS = Object.freeze([
  "audioToken",
  "hapticToken",
  "priority",
  "suppressed",
  "channels",
  "volumeCategory",
]);

const AUDIO_TOKENS = Object.freeze({
  [AUDIO_TOKEN_IDS.interactionConfirm]: createAudioToken({
    channel: SENSORY_CHANNELS.ui,
    priority: SENSORY_PRIORITY.contextualAction,
    frequencies: [392, 440],
    durationMs: 88,
    gain: 0.038,
  }),
  [AUDIO_TOKEN_IDS.selection]: createAudioToken({
    channel: SENSORY_CHANNELS.ui,
    priority: SENSORY_PRIORITY.contextualAction,
    frequencies: [466.16, 523.25],
    durationMs: 78,
    gain: 0.034,
  }),
  [AUDIO_TOKEN_IDS.deselection]: createAudioToken({
    channel: SENSORY_CHANNELS.ui,
    priority: SENSORY_PRIORITY.backgroundFeedback,
    frequencies: [392, 349.23],
    durationMs: 68,
    gain: 0.028,
  }),
  [AUDIO_TOKEN_IDS.cardPickup]: createAudioToken({
    channel: SENSORY_CHANNELS.gameplay,
    priority: SENSORY_PRIORITY.cardInteraction,
    frequencies: [293.66, 392],
    durationMs: 104,
    gain: 0.044,
    waveform: "triangle",
  }),
  [AUDIO_TOKEN_IDS.cardPlacement]: createAudioToken({
    channel: SENSORY_CHANNELS.gameplay,
    priority: SENSORY_PRIORITY.cardInteraction,
    frequencies: [220, 261.63],
    durationMs: 118,
    gain: 0.048,
    waveform: "triangle",
  }),
  [AUDIO_TOKEN_IDS.cardDraw]: createAudioToken({
    channel: SENSORY_CHANNELS.gameplay,
    priority: SENSORY_PRIORITY.cardInteraction,
    frequencies: [329.63, 493.88],
    durationMs: 132,
    gain: 0.042,
  }),
  [AUDIO_TOKEN_IDS.cardResolve]: createAudioToken({
    channel: SENSORY_CHANNELS.gameplay,
    priority: SENSORY_PRIORITY.criticalGameplay,
    frequencies: [261.63, 392, 523.25],
    durationMs: 180,
    gain: 0.054,
  }),
  [AUDIO_TOKEN_IDS.error]: createAudioToken({
    channel: SENSORY_CHANNELS.ui,
    priority: SENSORY_PRIORITY.criticalGameplay,
    frequencies: [220, 164.81],
    durationMs: 160,
    gain: 0.048,
    waveform: "triangle",
  }),
  [AUDIO_TOKEN_IDS.warning]: createAudioToken({
    channel: SENSORY_CHANNELS.ui,
    priority: SENSORY_PRIORITY.contextualAction,
    frequencies: [246.94, 220],
    durationMs: 138,
    gain: 0.044,
  }),
  [AUDIO_TOKEN_IDS.success]: createAudioToken({
    channel: SENSORY_CHANNELS.ui,
    priority: SENSORY_PRIORITY.notification,
    frequencies: [523.25, 659.25],
    durationMs: 142,
    gain: 0.046,
  }),
  [AUDIO_TOKEN_IDS.notification]: createAudioToken({
    channel: SENSORY_CHANNELS.ui,
    priority: SENSORY_PRIORITY.notification,
    frequencies: [392, 493.88],
    durationMs: 124,
    gain: 0.04,
  }),
  [AUDIO_TOKEN_IDS.commanderEvent]: createAudioToken({
    channel: SENSORY_CHANNELS.gameplay,
    priority: SENSORY_PRIORITY.commanderEvent,
    frequencies: [196, 293.66, 392],
    durationMs: 210,
    gain: 0.056,
    waveform: "triangle",
  }),
  [AUDIO_TOKEN_IDS.combat]: createAudioToken({
    channel: SENSORY_CHANNELS.gameplay,
    priority: SENSORY_PRIORITY.criticalGameplay,
    frequencies: [174.61, 233.08],
    durationMs: 152,
    gain: 0.05,
    waveform: "triangle",
  }),
  [AUDIO_TOKEN_IDS.search]: createAudioToken({
    channel: SENSORY_CHANNELS.ui,
    priority: SENSORY_PRIORITY.contextualAction,
    frequencies: [349.23, 466.16],
    durationMs: 96,
    gain: 0.032,
  }),
  [AUDIO_TOKEN_IDS.modalOpen]: createAudioToken({
    channel: SENSORY_CHANNELS.ui,
    priority: SENSORY_PRIORITY.contextualAction,
    frequencies: [329.63, 392],
    durationMs: 98,
    gain: 0.03,
  }),
  [AUDIO_TOKEN_IDS.modalClose]: createAudioToken({
    channel: SENSORY_CHANNELS.ui,
    priority: SENSORY_PRIORITY.backgroundFeedback,
    frequencies: [392, 329.63],
    durationMs: 86,
    gain: 0.026,
  }),
  [AUDIO_TOKEN_IDS.handReorder]: createAudioToken({
    channel: SENSORY_CHANNELS.ui,
    priority: SENSORY_PRIORITY.backgroundFeedback,
    frequencies: [277.18, 311.13],
    durationMs: 52,
    gain: 0.018,
  }),
  [AUDIO_TOKEN_IDS.ambient]: createAudioToken({
    channel: SENSORY_CHANNELS.ambient,
    priority: SENSORY_PRIORITY.decorative,
    frequencies: [146.83],
    durationMs: 1200,
    gain: 0,
  }),
});

const HAPTIC_TOKENS = Object.freeze({
  [HAPTIC_TOKEN_IDS.lightConfirmation]: createHapticToken([8], SENSORY_PRIORITY.backgroundFeedback),
  [HAPTIC_TOKEN_IDS.mediumConfirmation]: createHapticToken([18], SENSORY_PRIORITY.contextualAction),
  [HAPTIC_TOKEN_IDS.heavyConfirmation]: createHapticToken([42], SENSORY_PRIORITY.criticalGameplay),
  [HAPTIC_TOKEN_IDS.selection]: createHapticToken([10], SENSORY_PRIORITY.contextualAction),
  [HAPTIC_TOKEN_IDS.error]: createHapticToken([28, 30, 28], SENSORY_PRIORITY.criticalGameplay),
  [HAPTIC_TOKEN_IDS.success]: createHapticToken([22, 26, 36], SENSORY_PRIORITY.notification),
  [HAPTIC_TOKEN_IDS.warning]: createHapticToken([20, 26, 20], SENSORY_PRIORITY.contextualAction),
  [HAPTIC_TOKEN_IDS.longPress]: createHapticToken([18, 28, 18], SENSORY_PRIORITY.contextualAction),
  [HAPTIC_TOKEN_IDS.cardPlacement]: createHapticToken([16], SENSORY_PRIORITY.cardInteraction),
  [HAPTIC_TOKEN_IDS.commanderEvent]: createHapticToken([36, 28, 52], SENSORY_PRIORITY.commanderEvent),
  [HAPTIC_TOKEN_IDS.handReorder]: createHapticToken([8], SENSORY_PRIORITY.backgroundFeedback),
});

export function createAudioTokenSet() {
  return {
    version: BOARDSTATE_SENSORY_LANGUAGE_VERSION,
    ids: AUDIO_TOKEN_IDS,
    channels: SENSORY_CHANNELS,
    priority: SENSORY_PRIORITY,
    tokens: AUDIO_TOKENS,
    assetPolicy: "generated-web-audio-only",
  };
}

export function createHapticTokenSet() {
  return {
    version: BOARDSTATE_SENSORY_LANGUAGE_VERSION,
    ids: HAPTIC_TOKEN_IDS,
    channels: SENSORY_CHANNELS,
    priority: SENSORY_PRIORITY,
    tokens: HAPTIC_TOKENS,
  };
}

export function createSensoryPreferenceDefaults() {
  return {
    masterVolume: 0.45,
    uiVolume: 0.48,
    gameplayVolume: 0.54,
    ambientVolume: 0,
    musicVolume: 0,
    reducedHaptics: false,
    audioDebug: false,
  };
}

export function createSensoryDebugSnapshot({
  audioToken = AUDIO_TOKEN_IDS.interactionConfirm,
  hapticToken = HAPTIC_TOKEN_IDS.lightConfirmation,
  priority = SENSORY_PRIORITY.contextualAction,
  suppressed = "none",
  channels = [SENSORY_CHANNELS.ui, SENSORY_CHANNELS.haptics],
  volumeCategory = "uiVolume",
} = {}) {
  return {
    version: BOARDSTATE_SENSORY_LANGUAGE_VERSION,
    audioToken,
    hapticToken,
    priority,
    suppressed,
    channels,
    volumeCategory,
    fields: SENSORY_DEBUG_FIELDS,
    productionVisible: false,
  };
}

export function resolveSensoryPreferences(profileOrSettings = {}) {
  const settings = profileOrSettings.settings || profileOrSettings || {};
  const sensory = settings.sensory || {};
  const notifications = settings.notifications || {};
  const defaults = createSensoryPreferenceDefaults();
  return {
    version: BOARDSTATE_SENSORY_LANGUAGE_VERSION,
    audioEnabled: Boolean(notifications.sound),
    hapticsEnabled: Boolean(settings.haptics || notifications.haptics),
    masterVolume: clampVolume(sensory.masterVolume ?? defaults.masterVolume),
    uiVolume: clampVolume(sensory.uiVolume ?? defaults.uiVolume),
    gameplayVolume: clampVolume(sensory.gameplayVolume ?? defaults.gameplayVolume),
    ambientVolume: clampVolume(sensory.ambientVolume ?? defaults.ambientVolume),
    musicVolume: clampVolume(sensory.musicVolume ?? defaults.musicVolume),
    reducedHaptics: Boolean(sensory.reducedHaptics),
    audioDebug: Boolean(sensory.audioDebug),
  };
}

export function resolveAudioTokenForNotification(kind = "info") {
  if (/final|winner|success/i.test(kind)) {
    return AUDIO_TOKEN_IDS.success;
  }
  if (/warning|sudden|choice|error|failed/i.test(kind)) {
    return /error|failed/i.test(kind) ? AUDIO_TOKEN_IDS.error : AUDIO_TOKEN_IDS.warning;
  }
  return AUDIO_TOKEN_IDS.notification;
}

export function resolveHapticTokenForNotification(kind = "info") {
  if (/final|winner|success/i.test(kind)) {
    return HAPTIC_TOKEN_IDS.success;
  }
  if (/warning|sudden|choice|error|failed/i.test(kind)) {
    return /error|failed/i.test(kind) ? HAPTIC_TOKEN_IDS.error : HAPTIC_TOKEN_IDS.warning;
  }
  return HAPTIC_TOKEN_IDS.mediumConfirmation;
}

export function resolveSensoryTokenForAction(action = {}) {
  const id = String(action.id || action.actionId || "").toLowerCase();
  const family = String(action.family || "").toLowerCase();
  const state = String(action.state || "").toLowerCase();
  if (id === "commander" || family === "commander") {
    return {
      audioTokenId: AUDIO_TOKEN_IDS.commanderEvent,
      hapticTokenId: HAPTIC_TOKEN_IDS.commanderEvent,
      priority: SENSORY_PRIORITY.commanderEvent,
      volumeCategory: "gameplayVolume",
    };
  }
  if (id === "combat" || family === "combat") {
    return {
      audioTokenId: AUDIO_TOKEN_IDS.combat,
      hapticTokenId: HAPTIC_TOKEN_IDS.heavyConfirmation,
      priority: SENSORY_PRIORITY.criticalGameplay,
      volumeCategory: "gameplayVolume",
    };
  }
  if (id === "resolve" || family === "stack" || state === "resolving") {
    return {
      audioTokenId: AUDIO_TOKEN_IDS.cardResolve,
      hapticTokenId: HAPTIC_TOKEN_IDS.cardPlacement,
      priority: SENSORY_PRIORITY.criticalGameplay,
      volumeCategory: "gameplayVolume",
    };
  }
  if (id === "library" || family === "knowledge") {
    return {
      audioTokenId: AUDIO_TOKEN_IDS.search,
      hapticTokenId: HAPTIC_TOKEN_IDS.selection,
      priority: SENSORY_PRIORITY.contextualAction,
      volumeCategory: "uiVolume",
    };
  }
  if (state === "disabled" || state === "demoted") {
    return {
      audioTokenId: AUDIO_TOKEN_IDS.deselection,
      hapticTokenId: HAPTIC_TOKEN_IDS.lightConfirmation,
      priority: SENSORY_PRIORITY.backgroundFeedback,
      volumeCategory: "uiVolume",
    };
  }
  return {
    audioTokenId: AUDIO_TOKEN_IDS.interactionConfirm,
    hapticTokenId: HAPTIC_TOKEN_IDS.selection,
    priority: SENSORY_PRIORITY.contextualAction,
    volumeCategory: "uiVolume",
  };
}

export function getAudioToken(tokenId = AUDIO_TOKEN_IDS.notification) {
  return AUDIO_TOKENS[tokenId] || AUDIO_TOKENS[AUDIO_TOKEN_IDS.notification];
}

export function getHapticToken(tokenId = HAPTIC_TOKEN_IDS.lightConfirmation) {
  return HAPTIC_TOKENS[tokenId] || HAPTIC_TOKENS[HAPTIC_TOKEN_IDS.lightConfirmation];
}

function createAudioToken({
  channel = SENSORY_CHANNELS.ui,
  priority = SENSORY_PRIORITY.contextualAction,
  frequencies = [392],
  durationMs = 100,
  gain = 0.04,
  waveform = "sine",
  attackMs = 10,
  releaseMs = 80,
} = {}) {
  return Object.freeze({
    channel,
    priority,
    frequencies: Object.freeze(frequencies.map((frequency) => Number(frequency)).filter((frequency) => Number.isFinite(frequency) && frequency > 0)),
    durationMs: Math.max(0, Math.round(Number(durationMs || 0))),
    gain: clampVolume(gain),
    waveform,
    attackMs: Math.max(0, Math.round(Number(attackMs || 0))),
    releaseMs: Math.max(0, Math.round(Number(releaseMs || 0))),
    generated: true,
  });
}

function createHapticToken(pattern = [8], priority = SENSORY_PRIORITY.contextualAction) {
  return Object.freeze({
    priority,
    pattern: Object.freeze(pattern.map((entry) => Math.max(0, Math.round(Number(entry || 0))))),
  });
}

function clampVolume(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(1, numeric));
}
