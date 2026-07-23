import { MANA_COLORS, createDefaultProfile } from "../state/schema.js";
import { normalizeFriendState } from "../social/friendSystem.js";
import { createOnboardingState } from "../onboarding/tutorialSystem.js";
import { createLocalSaveCollection } from "./saveState.js";
import { createEcosystemIntegrationState } from "../ecosystem/ecosystemIntegration.js";

const DB_NAME = "boardstate";
const STORE_NAME = "profiles";
const ACTIVE_KEY = "active-profile";
const PROTECTED_KEY = "protected-profile";
const AUTH_META_KEY = "auth-meta";
const FALLBACK_KEY = "boardstate-profile";
const PROTECTED_FALLBACK_KEY = "boardstate-protected-profile";
const AUTH_FALLBACK_KEY = "boardstate-auth-meta";
const GUEST_SESSION_KEY = "boardstate-guest-session";
const LEGACY_FALLBACK_KEYS = ["boardstate-hybrid-profile"];
const DATABASE_TIMEOUT_MS = 1800;

function openDatabase() {
  if (!("indexedDB" in globalThis)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let settled = false;
    let request = null;
    const timeout = globalThis.setTimeout(() => settle(null), DATABASE_TIMEOUT_MS);

    function settle(value) {
      if (settled) {
        return;
      }
      settled = true;
      globalThis.clearTimeout(timeout);
      resolve(value);
    }

    try {
      request = indexedDB.open(DB_NAME, 1);
    } catch {
      settle(null);
      return;
    }

    request.onblocked = () => settle(null);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settle(request.result);
    };
    request.onerror = () => settle(null);
  });
}

export async function loadProfile() {
  return normalizeProfile(createGuestProfile(await hasPasswordProfile()));
}

export async function getAuthStatus() {
  return { hasPassword: await hasPasswordProfile() };
}

export async function createPasswordProfile(password, profile = createDefaultProfile()) {
  const meta = await createPasswordMeta(password);
  const protectedProfile = normalizeProfile({
    ...profile,
    localAuth: { mode: "protected", locked: false, hasPassword: true },
  });
  await writeRecord(PROTECTED_KEY, protectedProfile);
  await writeRecord(AUTH_META_KEY, meta);
  saveProtectedFallback(protectedProfile);
  saveAuthFallback(meta);
  return protectedProfile;
}

export async function loginWithPassword(password) {
  const meta = await readAuthMeta();
  if (!meta || !(await verifyPassword(password, meta))) {
    throw new Error("Invalid password");
  }
  const profile = (await readRecord(PROTECTED_KEY)) || loadProtectedFallback() || loadLegacyFallbackProfile();
  return normalizeProfile({
    ...(profile || createDefaultProfile()),
    localAuth: { mode: "protected", locked: false, hasPassword: true },
  });
}

export async function loadGuestProfile() {
  try {
    sessionStorage.removeItem(GUEST_SESSION_KEY);
  } catch {
    // Guest/fresh mode should never depend on previous saved history.
  }
  return normalizeProfile(createGuestProfile(await hasPasswordProfile(), { freshSession: true }));
}

export async function lockProtectedProfile() {
  return normalizeProfile(createGuestProfile(await hasPasswordProfile()));
}

export async function saveProfile(profile) {
  const normalized = normalizeProfile(profile);
  if (normalized.localAuth?.mode === "protected" && !normalized.localAuth?.locked) {
    await writeRecord(PROTECTED_KEY, normalized);
    saveProtectedFallback(normalized);
    return normalized;
  }
  try {
    sessionStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(sanitizeGuestProfile(normalized)));
  } catch {
    // Guest mode is intentionally non-authoritative; gameplay continues in memory.
  }
  saveFallbackProfile(sanitizeGuestProfile(normalized));
  return normalized;
}

export async function loadLegacyProfile() {
  const database = await openDatabase();
  if (!database) {
    return loadFallbackProfile();
  }

  const profile = await new Promise((resolve) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(ACTIVE_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
  database.close();
  return normalizeProfile(profile || loadFallbackProfile());
}

export async function saveLegacyProfile(profile) {
  const database = await openDatabase();
  if (!database) {
    saveFallbackProfile(profile);
    return profile;
  }

  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(profile, ACTIVE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
  saveFallbackProfile(profile);
  return profile;
}

async function hasPasswordProfile() {
  return Boolean(await readAuthMeta());
}

async function readAuthMeta() {
  return (await readRecord(AUTH_META_KEY)) || loadAuthFallback();
}

async function readRecord(key) {
  const database = await openDatabase();
  if (!database) {
    return null;
  }
  const value = await new Promise((resolve) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
  database.close();
  return value;
}

async function writeRecord(key, value) {
  const database = await openDatabase();
  if (!database) {
    return false;
  }
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
  return true;
}

async function createPasswordMeta(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPassword(password, salt);
  const normalized = {
    version: 1,
    algorithm: "SHA-256",
    salt: toBase64(salt),
    hash,
    createdAt: Date.now(),
  };
}

async function verifyPassword(password, meta) {
  const salt = fromBase64(meta.salt || "");
  return (await hashPassword(password, salt)) === meta.hash;
}

async function hashPassword(password, salt) {
  // Local device protection only: this is not cloud authentication and never stores plaintext passwords.
  const encoded = new TextEncoder().encode(`${toBase64(salt)}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return toBase64(new Uint8Array(digest));
}

function toBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value) {
  try {
    return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  } catch {
    return new Uint8Array();
  }
}

export function exportProfile(profile) {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: "BoardState",
      profile,
    },
    null,
    2
  );
}

export function parseImportedProfile(text) {
  const payload = JSON.parse(text);
  return normalizeProfile(payload.profile || payload);
}

function loadFallbackProfile() {
  try {
    const raw = localStorage.getItem(FALLBACK_KEY) || LEGACY_FALLBACK_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    return normalizeProfile(raw ? JSON.parse(raw) : createDefaultProfile());
  } catch {
    return createDefaultProfile();
  }
}

function loadLegacyFallbackProfile() {
  try {
    const raw = localStorage.getItem(FALLBACK_KEY) || LEGACY_FALLBACK_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    return raw ? normalizeProfile(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function loadProtectedFallback() {
  try {
    const raw = localStorage.getItem(PROTECTED_FALLBACK_KEY);
    return raw ? normalizeProfile(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function loadAuthFallback() {
  try {
    const raw = localStorage.getItem(AUTH_FALLBACK_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function normalizeProfile(profile) {
  const defaults = createDefaultProfile();
  const hasExplicitOnboarding = Boolean(profile && Object.prototype.hasOwnProperty.call(profile, "onboarding"));
  const onboarding = hasExplicitOnboarding
    ? createOnboardingState({ ...defaults.onboarding, ...(profile.onboarding || {}) })
    : createOnboardingState({
        ...defaults.onboarding,
        firstLaunchComplete: true,
        tutorialOffered: true,
        tutorialSkipped: true,
      });
  const manaPool = {
    ...defaults.activeSession.manaPool,
    ...(profile.activeSession?.manaPool || {}),
  };
  MANA_COLORS.forEach((color) => {
    manaPool[color] = Number.isFinite(Number(manaPool[color])) ? Math.max(0, Math.floor(Number(manaPool[color]))) : 0;
  });
  return {
    ...defaults,
    ...profile,
    player: { ...defaults.player, ...(profile.player || {}) },
    onboarding,
    settings: {
      ...defaults.settings,
      ...(profile.settings || {}),
      pagePanels: { ...defaults.settings.pagePanels, ...(profile.settings?.pagePanels || {}) },
      multiplayer: { ...defaults.settings.multiplayer, ...(profile.settings?.multiplayer || {}) },
      battlefield: { ...defaults.settings.battlefield, ...(profile.settings?.battlefield || {}) },
      appearance: { ...defaults.settings.appearance, ...(profile.settings?.appearance || {}) },
      navigation: { ...defaults.settings.navigation, ...(profile.settings?.navigation || {}) },
      gestures: { ...defaults.settings.gestures, ...(profile.settings?.gestures || {}) },
      adhdMode: { ...defaults.settings.adhdMode, ...(profile.settings?.adhdMode || {}) },
      helperSprite: { ...defaults.settings.helperSprite, ...(profile.settings?.helperSprite || {}) },
      rulesAssistant: { ...defaults.settings.rulesAssistant, ...(profile.settings?.rulesAssistant || {}) },
      remindMe: { ...defaults.settings.remindMe, ...(profile.settings?.remindMe || {}) },
      aiGameplay: { ...defaults.settings.aiGameplay, ...(profile.settings?.aiGameplay || {}) },
      ecosystem: { ...defaults.settings.ecosystem, ...(profile.settings?.ecosystem || {}) },
      playerMemory: {
        ...defaults.settings.playerMemory,
        ...(profile.settings?.playerMemory || {}),
        frequentQuestions: {
          ...defaults.settings.playerMemory.frequentQuestions,
          ...(profile.settings?.playerMemory?.frequentQuestions || {}),
        },
        frequentlyForgottenTriggers: {
          ...defaults.settings.playerMemory.frequentlyForgottenTriggers,
          ...(profile.settings?.playerMemory?.frequentlyForgottenTriggers || {}),
        },
        accessibilityPreferences: {
          ...defaults.settings.playerMemory.accessibilityPreferences,
          ...(profile.settings?.playerMemory?.accessibilityPreferences || {}),
        },
        interactionPreferences: {
          ...defaults.settings.playerMemory.interactionPreferences,
          ...(profile.settings?.playerMemory?.interactionPreferences || {}),
        },
        gameplayPreferences: {
          ...defaults.settings.playerMemory.gameplayPreferences,
          ...(profile.settings?.playerMemory?.gameplayPreferences || {}),
        },
      },
      notifications: {
        ...defaults.settings.notifications,
        ...(profile.settings?.notifications || {}),
        tournamentEvents: {
          ...defaults.settings.notifications.tournamentEvents,
          ...(profile.settings?.notifications?.tournamentEvents || {}),
        },
        gameplayEvents: {
          ...defaults.settings.notifications.gameplayEvents,
          ...(profile.settings?.notifications?.gameplayEvents || {}),
        },
        friendEvents: {
          ...defaults.settings.notifications.friendEvents,
          ...(profile.settings?.notifications?.friendEvents || {}),
        },
      },
      recentCounterTypes: profile.settings?.recentCounterTypes || defaults.settings.recentCounterTypes || [],
    },
    localAuth: { ...defaults.localAuth, ...(profile.localAuth || {}) },
    activeSession: {
      ...defaults.activeSession,
      ...(profile.activeSession || {}),
      manaPool,
      battlefield: {
        ...defaults.activeSession.battlefield,
        ...(profile.activeSession?.battlefield || {}),
      },
      zones: {
        ...defaults.activeSession.zones,
        ...(profile.activeSession?.zones || {}),
        unknownCounts: {
          ...defaults.activeSession.zones.unknownCounts,
          ...(profile.activeSession?.zones?.unknownCounts || {}),
        },
      },
      stack: profile.activeSession?.stack || defaults.activeSession.stack,
      priority: {
        ...defaults.activeSession.priority,
        ...(profile.activeSession?.priority || {}),
      },
      presentation: profile.activeSession?.presentation || defaults.activeSession.presentation,
      fsm: {
        ...defaults.activeSession.fsm,
        ...(profile.activeSession?.fsm || {}),
      },
      helper: {
        ...defaults.activeSession.helper,
        ...(profile.activeSession?.helper || {}),
      },
      remindMe: {
        ...defaults.activeSession.remindMe,
        ...(profile.activeSession?.remindMe || {}),
        reminders: Array.isArray(profile.activeSession?.remindMe?.reminders)
          ? profile.activeSession.remindMe.reminders
          : defaults.activeSession.remindMe.reminders,
        timeline: Array.isArray(profile.activeSession?.remindMe?.timeline)
          ? profile.activeSession.remindMe.timeline
          : defaults.activeSession.remindMe.timeline,
        dismissedNotificationKeys: Array.isArray(profile.activeSession?.remindMe?.dismissedNotificationKeys)
          ? profile.activeSession.remindMe.dismissedNotificationKeys
          : defaults.activeSession.remindMe.dismissedNotificationKeys,
      },
      ruleAmendments: {
        ...defaults.activeSession.ruleAmendments,
        ...(profile.activeSession?.ruleAmendments || {}),
        proposals: Array.isArray(profile.activeSession?.ruleAmendments?.proposals)
          ? profile.activeSession.ruleAmendments.proposals
          : defaults.activeSession.ruleAmendments.proposals,
        active: Array.isArray(profile.activeSession?.ruleAmendments?.active)
          ? profile.activeSession.ruleAmendments.active
          : defaults.activeSession.ruleAmendments.active,
        history: Array.isArray(profile.activeSession?.ruleAmendments?.history)
          ? profile.activeSession.ruleAmendments.history
          : defaults.activeSession.ruleAmendments.history,
      },
      aiGameplay: {
        ...defaults.activeSession.aiGameplay,
        ...(profile.activeSession?.aiGameplay || {}),
        activeProfileIds: Array.isArray(profile.activeSession?.aiGameplay?.activeProfileIds)
          ? profile.activeSession.aiGameplay.activeProfileIds
          : defaults.activeSession.aiGameplay.activeProfileIds,
        analysisLog: Array.isArray(profile.activeSession?.aiGameplay?.analysisLog)
          ? profile.activeSession.aiGameplay.analysisLog
          : defaults.activeSession.aiGameplay.analysisLog,
        memory: {
          ...defaults.activeSession.aiGameplay.memory,
          ...(profile.activeSession?.aiGameplay?.memory || {}),
          preferredSimulationSettings: {
            ...defaults.activeSession.aiGameplay.memory.preferredSimulationSettings,
            ...(profile.activeSession?.aiGameplay?.memory?.preferredSimulationSettings || {}),
          },
          analysisPreferences: {
            ...defaults.activeSession.aiGameplay.memory.analysisPreferences,
            ...(profile.activeSession?.aiGameplay?.memory?.analysisPreferences || {}),
          },
          trainingPreferences: {
            ...defaults.activeSession.aiGameplay.memory.trainingPreferences,
            ...(profile.activeSession?.aiGameplay?.memory?.trainingPreferences || {}),
          },
          accessibilityPreferences: {
            ...defaults.activeSession.aiGameplay.memory.accessibilityPreferences,
            ...(profile.activeSession?.aiGameplay?.memory?.accessibilityPreferences || {}),
          },
          patternWeights: {
            ...defaults.activeSession.aiGameplay.memory.patternWeights,
            ...(profile.activeSession?.aiGameplay?.memory?.patternWeights || {}),
          },
        },
      },
      simulation: {
        ...defaults.activeSession.simulation,
        ...(profile.activeSession?.simulation || {}),
      },
      tutorial: {
        ...defaults.activeSession.tutorial,
        ...(profile.activeSession?.tutorial || {}),
      },
      syncedMultiplayer: {
        ...defaults.activeSession.syncedMultiplayer,
        ...(profile.activeSession?.syncedMultiplayer || {}),
      },
      gameTracking: {
        ...defaults.activeSession.gameTracking,
        ...(profile.activeSession?.gameTracking || {}),
      },
      history: profile.activeSession?.history || defaults.activeSession.history,
      actionHistory: profile.activeSession?.actionHistory || defaults.activeSession.actionHistory,
      eventHistory: profile.activeSession?.eventHistory || defaults.activeSession.eventHistory,
      eventQueue: profile.activeSession?.eventQueue || defaults.activeSession.eventQueue,
      recoveryLog: profile.activeSession?.recoveryLog || defaults.activeSession.recoveryLog,
      rulesConfidenceLog: profile.activeSession?.rulesConfidenceLog || defaults.activeSession.rulesConfidenceLog,
      pendingEffects: profile.activeSession?.pendingEffects || defaults.activeSession.pendingEffects,
      triggerQueue: profile.activeSession?.triggerQueue || defaults.activeSession.triggerQueue,
      effectLog: profile.activeSession?.effectLog || defaults.activeSession.effectLog,
      undoStack: profile.activeSession?.undoStack || defaults.activeSession.undoStack,
      redoStack: profile.activeSession?.redoStack || defaults.activeSession.redoStack,
    },
    statsSync: { ...defaults.statsSync, ...(profile.statsSync || {}) },
    notifications: {
      ...defaults.notifications,
      ...(profile.notifications || {}),
      items: Array.isArray(profile.notifications?.items) ? profile.notifications.items : defaults.notifications.items,
      dismissedIds: Array.isArray(profile.notifications?.dismissedIds) ? profile.notifications.dismissedIds : defaults.notifications.dismissedIds,
    },
    localSaves: createLocalSaveCollection({
      ...defaults.localSaves,
      ...(profile.localSaves || {}),
    }),
    simulationMemory: { ...defaults.simulationMemory, ...(profile.simulationMemory || {}) },
    simulationStats: {
      ...defaults.simulationStats,
      ...(profile.simulationStats || {}),
      user: { ...defaults.simulationStats.user, ...(profile.simulationStats?.user || {}) },
      alpha: { ...defaults.simulationStats.alpha, ...(profile.simulationStats?.alpha || {}) },
      beta: { ...defaults.simulationStats.beta, ...(profile.simulationStats?.beta || {}) },
      omega: { ...defaults.simulationStats.omega, ...(profile.simulationStats?.omega || {}) },
      mostThreateningCards: {
        ...defaults.simulationStats.mostThreateningCards,
        ...(profile.simulationStats?.mostThreateningCards || {}),
      },
      mostTargetedCards: {
        ...defaults.simulationStats.mostTargetedCards,
        ...(profile.simulationStats?.mostTargetedCards || {}),
      },
      mostValuableCards: {
        ...defaults.simulationStats.mostValuableCards,
        ...(profile.simulationStats?.mostValuableCards || {}),
      },
      history: profile.simulationStats?.history || defaults.simulationStats.history,
    },
    tournament: {
      ...defaults.tournament,
      ...(profile.tournament || {}),
      sync: { ...defaults.tournament.sync, ...(profile.tournament?.sync || {}) },
      players: profile.tournament?.players || defaults.tournament.players,
      rounds: profile.tournament?.rounds || defaults.tournament.rounds,
      results: profile.tournament?.results || defaults.tournament.results,
      standings: profile.tournament?.standings || defaults.tournament.standings,
      settings: { ...defaults.tournament.settings, ...(profile.tournament?.settings || {}) },
      historyLog: profile.tournament?.historyLog || defaults.tournament.historyLog,
      finalAnnouncement: profile.tournament?.finalAnnouncement || profile.tournament?.announcement || defaults.tournament.finalAnnouncement,
      announcement: profile.tournament?.announcement || profile.tournament?.finalAnnouncement || defaults.tournament.announcement,
    },
    friends: normalizeFriendState({
      ...defaults.friends,
      ...(profile.friends || {}),
      friendDisplayName: profile.friends?.friendDisplayName || profile.player?.name || defaults.friends.friendDisplayName,
    }),
  };
  return {
    ...normalized,
    ecosystemIntegration: createEcosystemIntegrationState(normalized, profile.ecosystemIntegration || {}),
  };
}

function createGuestProfile(hasPassword, options = {}) {
  let sessionProfile = null;
  try {
    sessionProfile = JSON.parse(sessionStorage.getItem(GUEST_SESSION_KEY) || "null");
  } catch {
    sessionProfile = null;
  }
  const fallbackProfile = loadLegacyFallbackProfile();
  const baseProfile = options.freshSession ? createDefaultProfile() : sessionProfile || fallbackProfile || createDefaultProfile();
  return {
    ...baseProfile,
    archives: [],
    commanders: {},
    leaderboards: createDefaultProfile().leaderboards,
    localSaves: baseProfile.localSaves || fallbackProfile?.localSaves || createDefaultProfile().localSaves,
    onboarding: baseProfile.onboarding || fallbackProfile?.onboarding || createDefaultProfile().onboarding,
    activeSession: options.freshSession ? createDefaultProfile().activeSession : baseProfile.activeSession || createDefaultProfile().activeSession,
    localAuth: { mode: "guest", locked: false, hasPassword },
  };
}

function sanitizeGuestProfile(profile) {
  return {
    ...profile,
    archives: [],
    commanders: {},
    localAuth: {
      mode: "guest",
      locked: false,
      hasPassword: Boolean(profile.localAuth?.hasPassword),
    },
  };
}

function saveProtectedFallback(profile) {
  try {
    localStorage.setItem(PROTECTED_FALLBACK_KEY, JSON.stringify(profile));
  } catch {
    // IndexedDB remains the primary local-first storage layer.
  }
}

function saveAuthFallback(meta) {
  try {
    localStorage.setItem(AUTH_FALLBACK_KEY, JSON.stringify(meta));
  } catch {
    // A missing fallback only affects older browsers that cannot open IndexedDB.
  }
}

function saveFallbackProfile(profile) {
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(profile));
  } catch {
    // Local gameplay still continues in memory if persistent storage is unavailable.
  }
}
