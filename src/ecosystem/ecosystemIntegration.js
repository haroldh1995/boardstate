import {
  SHARED_CONTRACT_SCHEMA_VERSION,
  SHARED_SAVE_FORMAT_VERSION,
  SHARED_SYNC_PROTOCOL_VERSION,
  DEFAULT_RULES_ENGINE_VERSION,
} from "../shared-contracts/version.js";
import {
  APP_IDS,
  SYNC_NAMESPACES,
  buildStableChecksum,
  clonePlain,
  createCanonicalSyncMessage,
  createEcosystemBundle,
  createNotificationReference,
} from "../shared-contracts/contracts.js";
import { createContractId, normalizeContractId } from "../shared-contracts/ids.js";
import {
  COMMANDER_SESSION_SCHEMA_VERSION,
  createCapabilityManifest,
  createLaunchContext,
  createReturnContext,
  createSessionReference,
  validateCapabilityManifest,
  validateLaunchContext,
} from "../shared-contracts/commanderSession.js";

export const ECOSYSTEM_INTEGRATION_VERSION = "boardstate-ecosystem-integration-0.1.0";

export const ECOSYSTEM_SYNC_DOMAINS = Object.freeze([
  "profile",
  "preferences",
  "notifications",
  "presence",
  "session-discovery",
  "cloud-save",
  "deck-snapshot",
  "lite-session",
  "hub-launch",
  "hub-return",
  "gameplay-summary",
]);

export const ECOSYSTEM_PRESENCE_STATUSES = Object.freeze([
  "offline",
  "online",
  "in-game",
  "in-dry-run",
  "editing-deck",
  "using-lite",
  "using-boardstate",
  "idle",
  "unknown",
]);

const MAX_OUTBOX = 100;
const MAX_DISCOVERY_ENTRIES = 40;
const MAX_NOTIFICATION_REFERENCES = 60;
const MAX_PAYLOAD_BYTES = 512_000;
const BOARDSTATE_APP_ID = "boardstate";
const HUB_APP_ID = "boardstate-hub";
const LITE_APP_ID = "boardstate-lite";
const DECK_NEXUS_APP_ID = "deck-nexus";
const PRIVATE_KEYS = new Set([
  "password",
  "plaintextpassword",
  "hash",
  "salt",
  "authtoken",
  "authmeta",
  "authorization",
  "bearer",
  "token",
  "privatetoken",
  "refreshtoken",
  "idtoken",
  "apikey",
  "credential",
  "credentials",
  "secret",
  "synccredential",
  "synccredentials",
  "localauth",
  "protectedprofile",
]);

export function createEcosystemIntegrationState(profile = {}, input = {}) {
  const previous = input.version ? input : profile.ecosystemIntegration || {};
  const now = Number(input.updatedAt || Date.now());
  const sharedProfile = createSharedProfileProjection(profile, input.sharedProfile || previous.sharedProfile || {});
  const sharedPreferences = createSharedPreferenceSnapshot(profile, input.sharedPreferences || previous.sharedPreferences || {});
  const sharedNotifications = createSharedNotificationSnapshot(profile, input.sharedNotifications || previous.sharedNotifications || {});
  const presence = createPresenceState(profile, input.presence || previous.presence || {});
  const sessionDiscovery = createSessionDiscoveryIndex(profile, input.sessionDiscovery || previous.sessionDiscovery || {});
  const appStatuses = createEcosystemAppStatuses(profile, input.appStatuses || previous.appStatuses || {});
  const cloudSync = createCloudSyncState(profile, input.cloudSync || previous.cloudSync || {});
  const capabilityManifest = createEcosystemCapabilityManifest(profile, input.capabilityManifest || previous.capabilityManifest || {});
  const crossAppNavigation = createCrossAppNavigationModel(profile, input.crossAppNavigation || previous.crossAppNavigation || {});
  const syncBoundaries = createSyncBoundaryReport(profile, input.syncBoundaries || previous.syncBoundaries || {});
  const importExportManifests = createImportExportManifestSet(profile);
  return {
    version: ECOSYSTEM_INTEGRATION_VERSION,
    schemaVersion: SHARED_CONTRACT_SCHEMA_VERSION,
    status: resolveEcosystemStatus(appStatuses, cloudSync),
    appStatuses,
    sharedProfile,
    sharedPreferences,
    sharedNotifications,
    presence,
    sessionDiscovery,
    cloudSync,
    capabilityManifest,
    crossAppNavigation,
    syncBoundaries,
    importExportManifests,
    security: {
      hubIsGameplayAuthority: false,
      boardStateRemainsGameplayAuthority: true,
      hiddenGameplayDataSharedWithHub: false,
      privateCredentialsExported: false,
      liveHubEndpointConfigured: false,
      externalAppsMayMutateAuthoritativeState: false,
    },
    updatedAt: now,
  };
}

export function createEcosystemCapabilityManifest(profile = {}, input = {}) {
  const activeSession = profile.activeSession || {};
  const importedData = profile.importedData || {};
  const manifest = createCapabilityManifest({
    appId: BOARDSTATE_APP_ID,
    appVersion: input.appVersion || "",
    rulesEngineVersion: activeSession.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
    supportedFeatures: {
      canonicalSessions: true,
      liveTrackingInput: true,
      fullControlInput: true,
      spectatorRole: true,
      replayReferences: true,
      hiddenInformationFiltering: true,
      commanderPartners: true,
      tenPlayerCommander: true,
      ruleAmendmentVoting: true,
      deckNexusSnapshots: true,
      boardStateLiteInteroperability: true,
      hubCoordination: true,
      sharedProfileProjection: true,
      sharedPreferencesProjection: true,
      sharedNotificationsProjection: true,
      sessionDiscoveryProjection: true,
      cloudSyncQueue: true,
      friendPresenceProjection: true,
      offlineLocalPlay: true,
      reducedMotionPreference: true,
      liveHubConnection: false,
      liveDeckNexusLink: false,
      liveBoardStateLiteHandoff: false,
      ...(input.supportedFeatures || {}),
    },
    unsupportedFeatures: [
      "live-hub-connection",
      "live-deck-nexus-link",
      "live-boardstate-lite-handoff",
      "cloud-authentication",
      "cloud-save-upload",
      "marketplace",
      "chat-system",
      ...(input.unsupportedFeatures || []),
    ],
    offlineCapabilities: {
      createLocalSession: true,
      saveAndRestore: true,
      dryRun: true,
      tutorial: true,
      queueEcosystemSync: true,
      exportPrivacySafeBundle: true,
      ...(input.offlineCapabilities || {}),
    },
    optionalRoutes: {
      appLinkImport: "#/import/session/:id",
      deckSnapshotImport: "#/import/deck/:id",
      gameJoin: "#game/join/:sessionId",
      tournamentJoin: "#tournament/join/:sessionId",
      ...(input.optionalRoutes || {}),
    },
    limitations: [
      "Hub coordination contracts are ready, but no live Hub endpoint is configured.",
      "BoardState Lite and Deck Nexus live links require counterpart app updates.",
      "BoardState remains the only gameplay authority.",
      ...(input.limitations || []),
    ],
  });
  const validation = validateCapabilityManifest(manifest);
  return {
    ...manifest,
    ecosystemIntegrationVersion: ECOSYSTEM_INTEGRATION_VERSION,
    importedLiteSessionCount: (importedData.liteSessions || []).length,
    importedDeckSnapshotCount: (importedData.deckSnapshots || []).length,
    validation,
  };
}

export function createSharedProfileProjection(profile = {}, input = {}) {
  const player = profile.player || {};
  const friends = profile.friends || {};
  const commanders = Object.values(profile.commanders || {});
  const now = Number(input.updatedAt || Date.now());
  return {
    projectionVersion: ECOSYSTEM_INTEGRATION_VERSION,
    profileId: normalizeContractId(input.profileId || player.id || profile.id || "local-player", "profileId"),
    displayName: sanitizeText(input.displayName || player.name || friends.friendDisplayName || "Player"),
    avatarAccent: sanitizeText(input.avatarAccent || player.avatarAccent || ""),
    friendCode: sanitizeText(input.friendCode || friends.myFriendCode || ""),
    favoriteCommanders: commanders
      .map((commander) => sanitizeText(commander.name || commander.commanderName || ""))
      .filter(Boolean)
      .slice(0, 24),
    statisticsReference: {
      gamesPlayed: Number(profile.simulationStats?.gamesPlayed || 0),
      achievementsCount: (profile.achievements || []).length,
      localSaveCount: (profile.localSaves?.items || []).length,
    },
    preferenceReferences: {
      accessibility: "settings:accessibility",
      notifications: "settings:notifications",
      reminders: "settings:remindMe",
      questions: "settings:rulesAssistant",
      ai: "settings:aiGameplay",
      theme: "settings:appearance",
    },
    sourceApp: BOARDSTATE_APP_ID,
    hubProfileReference: input.hubProfileReference || "",
    syncStatus: input.syncStatus || "local-only",
    privacy: {
      consentRequiredBeforeCloudSync: true,
      sharesHiddenGameplayData: false,
      sharesLocalAuthData: false,
      sharesPrivateDeckOwnership: false,
    },
    updatedAt: now,
    checksum: buildStableChecksum({
      id: player.id || profile.id || "",
      name: player.name || "",
      avatarAccent: player.avatarAccent || "",
      friendCode: friends.myFriendCode || "",
    }),
  };
}

export function createSharedPreferenceSnapshot(profile = {}, input = {}) {
  const settings = profile.settings || {};
  const snapshot = {
    projectionVersion: ECOSYSTEM_INTEGRATION_VERSION,
    profileId: normalizeContractId(profile.player?.id || profile.id || "local-player", "profileId"),
    accessibility: {
      screenReaderPrompts: Boolean(settings.helperSprite?.screenReaderPrompts),
      helperSpriteEnabled: Boolean(settings.helperSprite?.enabled),
      largeText: Boolean(settings.accessibility?.largeText),
      highContrast: Boolean(settings.accessibility?.highContrast),
      reducedNoise: Boolean(settings.adhdMode?.reducedNoise),
    },
    interaction: {
      compactTiles: Boolean(settings.compactTiles),
      confirmAmbiguousEffects: settings.confirmAmbiguousEffects !== false,
      manualStackConfirmation: Boolean(settings.manualStackConfirmation),
      strictPhaseEnforcement: Boolean(settings.strictPhaseEnforcement),
      edgeSwipeShortcuts: settings.navigation?.edgeSwipeShortcuts !== false,
    },
    animation: {
      compositionMode: settings.appearance?.compositionMode || "auto",
      reducedMotionPreference: Boolean(settings.appearance?.reducedMotion || settings.motion?.reducedMotion),
      cameraPreference: settings.battlefield?.focusMode === false ? "manual" : "follow-active-player",
    },
    reminders: cloneSafe(settings.remindMe || {}),
    questions: cloneSafe(settings.rulesAssistant || {}),
    ai: cloneSafe(settings.aiGameplay || {}),
    notifications: createNotificationPreferenceSummary(settings.notifications || {}),
    synchronizedThroughHub: false,
    hubSyncStatus: input.hubSyncStatus || "queued-local-only",
    updatedAt: Number(input.updatedAt || Date.now()),
  };
  return {
    ...snapshot,
    checksum: buildStableChecksum(snapshot),
  };
}

export function createSharedNotificationSnapshot(profile = {}, input = {}) {
  const items = Array.isArray(profile.notifications?.items) ? profile.notifications.items : [];
  const references = items
    .slice(0, MAX_NOTIFICATION_REFERENCES)
    .map((notification) => createNotificationReference({
      notificationId: notification.id || notification.notificationId,
      category: notification.category || "system",
      severity: notification.severity || notification.priority || "info",
      title: sanitizeText(notification.title || notification.titleKey || ""),
      body: sanitizeText(notification.body || notification.bodyKey || ""),
      relatedGameId: profile.activeSession?.gameId || profile.activeSession?.id || "",
      relatedTournamentId: profile.tournament?.tournamentId || "",
      relatedActionId: notification.actionId || "",
      relatedEventId: notification.eventId || "",
      createdAt: notification.createdAt || notification.at || Date.now(),
      acknowledged: Boolean(notification.acknowledged || notification.read || (profile.notifications?.dismissedIds || []).includes(notification.id)),
      deliveryHints: {
        fullWindow: Boolean(notification.fullWindow),
        toast: notification.toast !== false,
        sourceApp: BOARDSTATE_APP_ID,
      },
    }));
  return {
    projectionVersion: ECOSYSTEM_INTEGRATION_VERSION,
    deliveryAuthority: "hub-coordinates-boardstate-originated-notifications",
    liveHubDelivery: false,
    notificationCount: references.length,
    references,
    preferencesChecksum: buildStableChecksum(profile.settings?.notifications || {}),
    lastReadAt: Number(profile.notifications?.lastReadAt || 0),
    updatedAt: Number(input.updatedAt || Date.now()),
  };
}

export function createPresenceState(profile = {}, input = {}) {
  const now = Number(input.updatedAt || Date.now());
  const status = normalizePresenceStatus(input.status || inferPresenceStatus(profile));
  return {
    projectionVersion: ECOSYSTEM_INTEGRATION_VERSION,
    status,
    publicLabel: presenceLabel(status),
    sourceApp: BOARDSTATE_APP_ID,
    activeSessionId: canExposePresenceSession(profile, input)
      ? profile.activeSession?.sessionId || profile.activeSession?.id || ""
      : "",
    activeGameId: canExposePresenceSession(profile, input)
      ? profile.activeSession?.gameId || profile.activeSession?.id || ""
      : "",
    deviceClass: sanitizeText(input.deviceClass || "unknown"),
    privacy: {
      sharePresence: input.sharePresence !== false,
      shareSessionReference: Boolean(input.shareSessionReference),
      shareDryRunStatus: input.shareDryRunStatus !== false,
      shareHiddenGameplayInfo: false,
    },
    friendsNamespace: "friend",
    updatedAt: now,
  };
}

export function createSessionDiscoveryIndex(profile = {}, input = {}) {
  const activeSession = profile.activeSession || {};
  const active = createDiscoveryEntryFromActiveSession(profile, activeSession);
  const saves = (profile.localSaves?.items || [])
    .slice(0, MAX_DISCOVERY_ENTRIES)
    .map(createDiscoveryEntryFromSave)
    .filter(Boolean);
  const linked = (profile.linkedSessions?.items || [])
    .slice(0, MAX_DISCOVERY_ENTRIES)
    .map(createDiscoveryEntryFromLinkedSession)
    .filter(Boolean);
  const invitations = (profile.friends?.invites || [])
    .slice(0, MAX_DISCOVERY_ENTRIES)
    .map(createDiscoveryEntryFromInvite)
    .filter(Boolean);
  return {
    projectionVersion: ECOSYSTEM_INTEGRATION_VERSION,
    sourceApp: BOARDSTATE_APP_ID,
    privacySafe: true,
    liveHubDiscovery: false,
    activeSession: active,
    recentSessions: uniqueById([active, ...saves, ...linked].filter(Boolean)).slice(0, MAX_DISCOVERY_ENTRIES),
    invitations,
    resumeCandidates: uniqueById([...saves, ...linked].filter(Boolean)).slice(0, MAX_DISCOVERY_ENTRIES),
    warnings: ["Discovery is local and privacy-safe until Hub is configured."],
    updatedAt: Number(input.updatedAt || Date.now()),
  };
}

export function createEcosystemAppStatuses(profile = {}, input = {}) {
  const importedData = profile.importedData || {};
  const hubStatus = normalizeAppStatus(input[HUB_APP_ID] || input.boardstateHub || {});
  const liteStatus = normalizeAppStatus(input[LITE_APP_ID] || input.boardstateLite || {});
  const nexusStatus = normalizeAppStatus(input[DECK_NEXUS_APP_ID] || input.deckNexus || {});
  const importedLiteCount = (importedData.liteSessions || []).length;
  const importedDeckCount = (importedData.deckSnapshots || []).length;
  return {
    [BOARDSTATE_APP_ID]: {
      appId: BOARDSTATE_APP_ID,
      appName: "BoardState",
      role: "authoritative-gameplay-engine",
      status: "Connected Locally",
      connected: true,
      liveConnection: true,
      gameplayAuthority: true,
      rulesAuthority: true,
      detail: "This app owns rules, state, replay truth, simulations, tutorials, and gameplay history.",
      capabilities: ["rules-engine", "state-engine", "event-knowledge", "replay", "ai-analysis", "dry-run", "offline-play"],
      lastCheckedAt: Date.now(),
    },
    [HUB_APP_ID]: {
      appId: HUB_APP_ID,
      appName: "BoardState Hub",
      role: "ecosystem-coordinator",
      status: hubStatus.status || "Hub Not Connected",
      connected: false,
      liveConnection: false,
      gameplayAuthority: false,
      coordinationReady: true,
      cloudSyncReady: true,
      detail: hubStatus.detail || "Profiles, friends, notifications, session discovery, and cloud sync are prepared, but no Hub endpoint is configured.",
      capabilities: ["profile-projection", "preference-projection", "notification-projection", "session-discovery-projection", "offline-sync-queue"],
      limitations: ["No live Hub endpoint is configured.", "Hub cannot mutate BoardState gameplay authority."],
      lastCheckedAt: Date.now(),
    },
    [LITE_APP_ID]: {
      appId: LITE_APP_ID,
      appName: "BoardState Lite",
      role: "personal-battlefield-companion",
      status: importedLiteCount ? "Imported Lite Session Available" : liteStatus.status || "Waiting for Lite Update",
      connected: false,
      liveConnection: false,
      gameplayAuthority: false,
      sessionContinuityReady: true,
      detail: importedLiteCount
        ? `${importedLiteCount} Lite session snapshot(s) stored locally.`
        : "Lite can attach through canonical session contracts after its counterpart update.",
      capabilities: ["canonical-session-reference", "lite-snapshot-import", "advanced-handoff-export", "privacy-safe-player-summary"],
      limitations: ["Live Lite transition is not installed.", "BoardState remains rules authority."],
      lastCheckedAt: Date.now(),
    },
    [DECK_NEXUS_APP_ID]: {
      appId: DECK_NEXUS_APP_ID,
      appName: "Deck Nexus",
      role: "deck-and-collection-authority",
      status: importedDeckCount ? "Imported Snapshots Available" : nexusStatus.status || "Waiting for Deck Nexus Update",
      connected: false,
      liveConnection: false,
      gameplayAuthority: false,
      immutableSnapshotReady: true,
      detail: importedDeckCount
        ? `${importedDeckCount} immutable Deck Nexus snapshot(s) stored locally.`
        : "BoardState can validate and store immutable deck snapshots without mutating source decks.",
      capabilities: ["immutable-deck-snapshot", "commander-validation-boundary", "deck-statistics-return-context"],
      limitations: ["Live Deck Nexus link is not installed.", "BoardState does not own collection data."],
      lastCheckedAt: Date.now(),
    },
  };
}

export function createCloudSyncState(profile = {}, input = {}) {
  const outbox = Array.isArray(input.outbox) ? input.outbox.map(normalizeQueuedEnvelope).filter(Boolean).slice(0, MAX_OUTBOX) : [];
  return {
    syncVersion: ECOSYSTEM_INTEGRATION_VERSION,
    status: input.status || "not-configured",
    liveHubConnection: false,
    endpointConfigured: false,
    offlineCapable: true,
    automaticSyncWhenOnline: Boolean(input.automaticSyncWhenOnline),
    conflictPolicy: "boardstate-authoritative-gameplay-wins",
    queuedCount: outbox.length,
    outbox,
    lastAttemptAt: Number(input.lastAttemptAt || 0),
    lastSuccessAt: Number(input.lastSuccessAt || 0),
    lastError: sanitizeText(input.lastError || ""),
    pendingDomains: [...new Set(outbox.map((entry) => entry.domain))],
    protectedDomains: ["gameplay", "hidden-zones", "rule-amendments", "replay-truth"],
    currentSessionRevision: Number(profile.activeSession?.revision || 0),
  };
}

export function createCrossAppNavigationModel(profile = {}, input = {}) {
  const session = profile.activeSession || {};
  const sessionReference = safeCreateSessionReference(session);
  return {
    projectionVersion: ECOSYSTEM_INTEGRATION_VERSION,
    sourceApp: BOARDSTATE_APP_ID,
    actions: [
      createCrossAppAction({
        actionId: "open-current-game-in-hub",
        targetApp: HUB_APP_ID,
        label: "Open Current Game In Hub",
        status: "hub-not-connected",
        enabled: false,
        reason: "Hub launch routing is prepared but no live Hub endpoint is configured.",
        sessionReference,
      }),
      createCrossAppAction({
        actionId: "return-to-lite",
        targetApp: LITE_APP_ID,
        label: "Return To Lite",
        status: "waiting-for-lite-update",
        enabled: false,
        reason: "BoardState can export a Lite handoff bundle, but live Lite return is not installed.",
        sessionReference,
      }),
      createCrossAppAction({
        actionId: "open-deck-in-nexus",
        targetApp: DECK_NEXUS_APP_ID,
        label: "Open Deck In Deck Nexus",
        status: "waiting-for-deck-nexus-update",
        enabled: false,
        reason: "Imported snapshots are immutable local copies; live Deck Nexus deck opening is not installed.",
        deckSnapshotIds: (session.deckSnapshotReferences || []).map((entry) => entry.deckSnapshotId).filter(Boolean),
      }),
      createCrossAppAction({
        actionId: "copy-privacy-safe-handoff",
        targetApp: "external",
        label: "Copy Privacy-Safe Handoff",
        status: "available",
        enabled: true,
        reason: "Exports privacy-safe canonical session data without hidden zones or credentials.",
        sessionReference,
      }),
    ],
    launchContext: createLaunchContext({
      sourceApplication: BOARDSTATE_APP_ID,
      requestedAction: "open-current-session",
      sessionReference,
      desiredRole: "player",
      contractVersion: COMMANDER_SESSION_SCHEMA_VERSION,
    }),
    returnContext: createReturnContext({
      destinationApplication: BOARDSTATE_APP_ID,
      completedAction: "return-to-authoritative-gameplay",
      sessionReference,
      status: "prepared",
      safeSummary: {
        hubConnected: false,
        liveExternalAppTransition: false,
      },
    }),
    ...(input || {}),
  };
}

export function createEcosystemSyncEnvelope(profile = {}, options = {}) {
  const domain = normalizeDomain(options.domain || options.syncDomain || "profile");
  const payloadResult = sanitizeEcosystemPayload(options.payload || payloadForDomain(profile, domain));
  if (!payloadResult.valid) {
    return {
      valid: false,
      status: "rejected",
      errors: payloadResult.errors,
      envelope: null,
    };
  }
  const session = profile.activeSession || {};
  const namespace = namespaceForDomain(domain);
  const canonicalMessage = createCanonicalSyncMessage({
    namespace,
    messageType: `ecosystem:${domain}`,
    sessionId: session.sessionId || session.id || "",
    gameId: session.gameId || session.id || "",
    senderPlayerId: profile.player?.id || "local-player",
    senderAppInstanceId: options.senderAppInstanceId || createContractId("appInstanceId", BOARDSTATE_APP_ID),
    expectedRevision: Number(options.expectedRevision ?? session.revision ?? 0),
    payload: payloadResult.payload,
    createdAt: options.createdAt || Date.now(),
  });
  const envelope = {
    envelopeId: normalizeContractId(options.envelopeId || createContractId("syncRevisionId"), "syncRevisionId"),
    ecosystemIntegrationVersion: ECOSYSTEM_INTEGRATION_VERSION,
    domain,
    namespace,
    sourceApp: BOARDSTATE_APP_ID,
    targetApp: options.targetApp || HUB_APP_ID,
    status: options.status || "queued-offline",
    liveSubmitted: false,
    requiresHubConnection: true,
    canonicalMessage,
    checksum: buildStableChecksum(canonicalMessage),
    privacy: {
      hiddenGameplayDataIncluded: false,
      credentialsIncluded: false,
      hubMayMutateGameplay: false,
    },
    createdAt: Number(options.createdAt || Date.now()),
  };
  return {
    valid: true,
    status: "queued",
    errors: [],
    envelope,
  };
}

export function queueEcosystemSync(profile = {}, options = {}) {
  const current = createEcosystemIntegrationState(profile);
  const created = createEcosystemSyncEnvelope(profile, options);
  if (!created.valid) {
    return {
      ...profile,
      ecosystemIntegration: {
        ...current,
        cloudSync: {
          ...current.cloudSync,
          lastError: created.errors[0] || "Ecosystem sync payload rejected.",
        },
      },
    };
  }
  const outbox = [created.envelope, ...(current.cloudSync.outbox || []).filter((entry) => entry.envelopeId !== created.envelope.envelopeId)].slice(0, MAX_OUTBOX);
  return {
    ...profile,
    ecosystemIntegration: createEcosystemIntegrationState(profile, {
      ...current,
      cloudSync: {
        ...current.cloudSync,
        status: "queued-offline",
        outbox,
        lastError: "",
      },
    }),
  };
}

export function acknowledgeEcosystemSync(profile = {}, options = {}) {
  const current = createEcosystemIntegrationState(profile);
  const ackId = String(options.envelopeId || options.id || "");
  return {
    ...profile,
    ecosystemIntegration: createEcosystemIntegrationState(profile, {
      ...current,
      cloudSync: {
        ...current.cloudSync,
        status: (current.cloudSync.outbox || []).length > 1 ? "queued-offline" : "not-configured",
        outbox: (current.cloudSync.outbox || []).filter((entry) => entry.envelopeId !== ackId),
        lastSuccessAt: Number(options.acknowledgedAt || Date.now()),
      },
    }),
  };
}

export function updateEcosystemPresence(profile = {}, options = {}) {
  const current = createEcosystemIntegrationState(profile);
  return {
    ...profile,
    ecosystemIntegration: createEcosystemIntegrationState(profile, {
      ...current,
      presence: createPresenceState(profile, {
        ...(current.presence || {}),
        ...options,
        updatedAt: Date.now(),
      }),
    }),
  };
}

export function applySharedPreferencePatch(profile = {}, patch = {}) {
  const safePatch = normalizeSharedPreferencePatch(patch);
  const settings = profile.settings || {};
  const nextProfile = {
    ...profile,
    settings: {
      ...settings,
      helperSprite: {
        ...(settings.helperSprite || {}),
        screenReaderPrompts: safePatch.accessibility.screenReaderPrompts ?? settings.helperSprite?.screenReaderPrompts,
        enabled: safePatch.accessibility.helperSpriteEnabled ?? settings.helperSprite?.enabled,
      },
      adhdMode: {
        ...(settings.adhdMode || {}),
        reducedNoise: safePatch.accessibility.reducedNoise ?? settings.adhdMode?.reducedNoise,
      },
      navigation: {
        ...(settings.navigation || {}),
        edgeSwipeShortcuts: safePatch.interaction.edgeSwipeShortcuts ?? settings.navigation?.edgeSwipeShortcuts,
      },
      appearance: {
        ...(settings.appearance || {}),
        compositionMode: safePatch.animation.compositionMode || settings.appearance?.compositionMode || "auto",
        reducedMotion: safePatch.animation.reducedMotionPreference ?? settings.appearance?.reducedMotion,
      },
      remindMe: {
        ...(settings.remindMe || {}),
        ...(safePatch.reminders || {}),
      },
      rulesAssistant: {
        ...(settings.rulesAssistant || {}),
        ...(safePatch.questions || {}),
      },
      aiGameplay: {
        ...(settings.aiGameplay || {}),
        ...(safePatch.ai || {}),
      },
      notifications: {
        ...(settings.notifications || {}),
        ...(safePatch.notifications || {}),
      },
    },
  };
  return {
    ...nextProfile,
    ecosystemIntegration: createEcosystemIntegrationState(nextProfile, {
      ...(nextProfile.ecosystemIntegration || {}),
      sharedPreferences: createSharedPreferenceSnapshot(nextProfile, { hubSyncStatus: "applied-local-patch" }),
    }),
  };
}

export function createHubLaunchContext(profile = {}, options = {}) {
  const sessionReference = safeCreateSessionReference(profile.activeSession || {});
  const context = createLaunchContext({
    sourceApplication: options.sourceApplication || HUB_APP_ID,
    requestedAction: options.requestedAction || "open-boardstate-session",
    sessionReference,
    participantReference: options.participantReference || {
      participantId: profile.activeSession?.hostParticipantId || "participant-local-player",
      displayName: profile.player?.name || "Player",
      role: "player",
    },
    desiredRole: options.desiredRole || "player",
    returnContext: options.returnContext || {
      destinationApplication: HUB_APP_ID,
      requestedReturnAction: "session-summary",
    },
    contractVersion: options.contractVersion || COMMANDER_SESSION_SCHEMA_VERSION,
  });
  const validation = validateLaunchContext(context);
  return { context, validation };
}

export function createHubReturnContext(profile = {}, options = {}) {
  const session = profile.activeSession || {};
  return createReturnContext({
    destinationApplication: options.destinationApplication || HUB_APP_ID,
    completedAction: options.completedAction || "boardstate-session-summary",
    sessionReference: safeCreateSessionReference(session),
    status: options.status || "prepared",
    safeSummary: {
      winner: session.winnerId || "",
      turn: session.turn || 1,
      phaseIndex: session.phaseIndex || 0,
      sessionLifecycle: session.sessionLifecycle || "setup",
      eventRevision: session.eventRevision || 0,
      hiddenGameplayDataIncluded: false,
      ...(options.safeSummary || {}),
    },
    replayReference: options.replayReference || session.persistence?.replay?.cursorEventId || "",
    resultReference: options.resultReference || "",
    errorStatus: options.errorStatus || "",
  });
}

export function createPrivacySafeEcosystemBundle(profile = {}, options = {}) {
  const state = createEcosystemIntegrationState(profile);
  const bundle = createEcosystemBundle({
    sections: {
      profile: state.sharedProfile,
      boardstate: {
        appStatus: state.appStatuses[BOARDSTATE_APP_ID],
        capabilityManifest: state.capabilityManifest,
        activeSession: state.sessionDiscovery.activeSession,
      },
      boardstateLite: state.appStatuses[LITE_APP_ID],
      deckNexus: {
        appStatus: state.appStatuses[DECK_NEXUS_APP_ID],
        importedSnapshots: (profile.importedData?.deckSnapshots || []).map((snapshot) => ({
          deckSnapshotId: snapshot.deckSnapshotId,
          sourceDeckId: snapshot.sourceDeckId,
          sourceDeckVersion: snapshot.sourceDeckVersion,
          name: snapshot.name,
          format: snapshot.format,
          immutableSnapshotVersion: snapshot.immutableSnapshotVersion,
          cardCount: (snapshot.cards || []).reduce((sum, card) => sum + Number(card.quantity || 0), 0),
        })),
      },
      hub: {
        appStatus: state.appStatuses[HUB_APP_ID],
        cloudSync: {
          status: state.cloudSync.status,
          queuedCount: state.cloudSync.queuedCount,
          pendingDomains: state.cloudSync.pendingDomains,
        },
      },
      friends: {
        friendCode: state.sharedProfile.friendCode,
        friendCount: (profile.friends?.friends || []).length,
        pendingRequestCount: (profile.friends?.pendingFriendRequests || []).length,
      },
      notifications: state.sharedNotifications,
      appLinks: state.crossAppNavigation,
      metadata: {
        ecosystemIntegrationVersion: ECOSYSTEM_INTEGRATION_VERSION,
        exportedAt: new Date(options.exportedAt || Date.now()).toISOString(),
        hiddenGameplayDataIncluded: false,
        credentialsIncluded: false,
      },
    },
    metadata: {
      sourceApp: BOARDSTATE_APP_ID,
      targetApp: HUB_APP_ID,
      liveHubConnection: false,
    },
  });
  const validation = validateNoEcosystemSecrets(bundle);
  return {
    valid: validation.valid,
    errors: validation.errors,
    bundle: validation.valid ? bundle : null,
    text: validation.valid ? JSON.stringify(bundle, null, 2) : "",
  };
}

export function validateNoEcosystemSecrets(input = {}) {
  const errors = [];
  const stack = [input];
  while (stack.length) {
    const value = stack.pop();
    if (!value || typeof value !== "object") continue;
    for (const [key, child] of Object.entries(value)) {
      const normalizedKey = String(key || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
      if (PRIVATE_KEYS.has(normalizedKey)) {
        errors.push(`private ecosystem field ${key} is not allowed`);
      }
      if (child && typeof child === "object") stack.push(child);
      if (typeof child === "string" && /bearer\s+[a-z0-9._-]{8,}|<script|javascript:/i.test(child)) {
        errors.push(`unsafe ecosystem value at ${key}`);
      }
    }
  }
  const serialized = JSON.stringify(input || {});
  if (serialized.length > MAX_PAYLOAD_BYTES * 2) {
    errors.push("ecosystem payload is too large");
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function validateEcosystemSyncEnvelope(input = {}) {
  const envelope = input.envelope || input;
  const errors = [];
  if (!ECOSYSTEM_SYNC_DOMAINS.includes(envelope.domain)) errors.push(`invalid ecosystem sync domain ${envelope.domain}`);
  if (!SYNC_NAMESPACES.includes(envelope.namespace)) errors.push(`invalid sync namespace ${envelope.namespace}`);
  if (envelope.targetApp === HUB_APP_ID && envelope.canonicalMessage?.namespace === "gameplay" && envelope.domain !== "gameplay-summary") {
    errors.push("Hub sync may receive gameplay summaries only, not authoritative gameplay actions");
  }
  if (envelope.privacy?.hubMayMutateGameplay) errors.push("Hub cannot mutate BoardState gameplay");
  const secretValidation = validateNoEcosystemSecrets(envelope);
  errors.push(...secretValidation.errors);
  return {
    valid: errors.length === 0,
    status: errors.length ? "invalid" : "valid",
    errors: [...new Set(errors)],
  };
}

function createSyncBoundaryReport(profile = {}, input = {}) {
  return {
    version: ECOSYSTEM_INTEGRATION_VERSION,
    namespaces: {
      gameplay: "BoardState authoritative gameplay sync only",
      profile: "Hub-coordinated shared profile projection",
      friend: "Friend presence and invitations only",
      notification: "Ecosystem notification references only",
      deck: "Deck snapshot references only",
      "app-link": "Launch and return contexts only",
      tournament: "Tournament coordination only",
    },
    gameplayAuthorityOwner: BOARDSTATE_APP_ID,
    hubReceivesHiddenGameplayData: false,
    friendNamespaceCarriesGameplay: false,
    tournamentNamespaceCarriesGameplay: false,
    deckNamespaceMutatesActiveGame: false,
    latestSessionRevision: Number(profile.activeSession?.revision || 0),
    warnings: input.warnings || [],
  };
}

function createImportExportManifestSet(profile = {}) {
  return {
    version: ECOSYSTEM_INTEGRATION_VERSION,
    boardStateLite: {
      importSupported: true,
      exportSupported: true,
      liveLinkInstalled: false,
      importedSessionCount: (profile.importedData?.liteSessions || []).length,
    },
    deckNexus: {
      immutableSnapshotImportSupported: true,
      liveLinkInstalled: false,
      importedSnapshotCount: (profile.importedData?.deckSnapshots || []).length,
    },
    hub: {
      privacySafeBundleSupported: true,
      liveConnectionInstalled: false,
      queuedSyncCount: (profile.ecosystemIntegration?.cloudSync?.outbox || []).length,
    },
  };
}

function payloadForDomain(profile = {}, domain = "profile") {
  if (domain === "preferences") return createSharedPreferenceSnapshot(profile);
  if (domain === "notifications") return createSharedNotificationSnapshot(profile);
  if (domain === "presence") return createPresenceState(profile);
  if (domain === "session-discovery") return createSessionDiscoveryIndex(profile);
  if (domain === "deck-snapshot") return createImportExportManifestSet(profile).deckNexus;
  if (domain === "lite-session") return createImportExportManifestSet(profile).boardStateLite;
  if (domain === "hub-launch") return createHubLaunchContext(profile).context;
  if (domain === "hub-return") return createHubReturnContext(profile);
  if (domain === "gameplay-summary") return createDiscoveryEntryFromActiveSession(profile, profile.activeSession || {});
  return createSharedProfileProjection(profile);
}

function sanitizeEcosystemPayload(payload = {}) {
  const cloned = cloneSafe(payload);
  const errors = [];
  const scrubbed = scrubPrivateFields(cloned, errors);
  const serialized = JSON.stringify(scrubbed || {});
  if (serialized.length > MAX_PAYLOAD_BYTES) errors.push("ecosystem sync payload is too large");
  if (/<script|javascript:|bearer\s+[a-z0-9._-]{8,}/i.test(serialized)) errors.push("ecosystem sync payload contains unsafe script or credential-like text");
  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    payload: scrubbed,
  };
}

function scrubPrivateFields(value, errors = []) {
  if (Array.isArray(value)) return value.map((entry) => scrubPrivateFields(entry, errors));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).flatMap(([key, child]) => {
    const normalizedKey = String(key || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (PRIVATE_KEYS.has(normalizedKey)) {
      errors.push(`private ecosystem field ${key} was rejected`);
      return [];
    }
    if (normalizedKey === "hand" || normalizedKey === "library" || normalizedKey === "sideboard") {
      return [[key, redactHiddenZone(child)]];
    }
    return [[key, scrubPrivateFields(child, errors)]];
  }));
}

function redactHiddenZone(value = {}) {
  if (Array.isArray(value)) {
    return { visibility: "hidden", count: value.length, redacted: true };
  }
  return {
    visibility: value.visibility || "hidden",
    count: Number(value.count || value.cardInstanceIds?.length || value.cards?.length || 0),
    redacted: true,
  };
}

function createNotificationPreferenceSummary(preferences = {}) {
  return {
    master: preferences.master !== false,
    fullWindow: preferences.fullWindow !== false,
    toast: preferences.toast !== false,
    sound: Boolean(preferences.sound),
    haptics: Boolean(preferences.haptics),
    tournament: preferences.tournament !== false,
    gameplay: preferences.gameplay !== false,
    dryRun: preferences.dryRun !== false,
    manualChoice: preferences.manualChoice !== false,
    sync: preferences.sync !== false,
    friends: preferences.friends !== false,
    reminders: preferences.reminders !== false,
  };
}

function normalizeSharedPreferencePatch(patch = {}) {
  return {
    accessibility: cloneSafe(patch.accessibility || {}),
    interaction: cloneSafe(patch.interaction || {}),
    animation: cloneSafe(patch.animation || {}),
    reminders: cloneSafe(patch.reminders || {}),
    questions: cloneSafe(patch.questions || {}),
    ai: cloneSafe(patch.ai || {}),
    notifications: cloneSafe(patch.notifications || {}),
  };
}

function createDiscoveryEntryFromActiveSession(profile = {}, session = {}) {
  if (!session) return null;
  const sessionId = session.sessionId || session.id || "";
  if (!sessionId) return null;
  return {
    discoveryId: normalizeContractId(`active-${sessionId}`, "sessionId"),
    source: "active-session",
    sourceApp: BOARDSTATE_APP_ID,
    sessionReference: safeCreateSessionReference(session),
    sessionId,
    gameId: session.gameId || session.id || "",
    title: "Current BoardState Session",
    mode: session.simulation?.enabled ? "Dry Run" : session.gameTracking?.active ? "Advanced Gameplay" : "Training Ground",
    lifecycle: session.sessionLifecycle || "setup",
    turn: Number(session.turn || 1),
    phaseIndex: Number(session.phaseIndex || 0),
    playerCount: Math.max(1, (session.players || []).length || (session.participants || []).length || 1),
    privacy: {
      hiddenGameplayDataIncluded: false,
      publicSummaryOnly: true,
    },
    updatedAt: Number(session.updatedAt || Date.now()),
  };
}

function createDiscoveryEntryFromSave(save = {}) {
  const session = save.gameState?.activeSession || {};
  const sessionId = save.sourceSession || session.sessionId || session.id || save.saveId || "";
  if (!sessionId) return null;
  return {
    discoveryId: normalizeContractId(`save-${save.saveId || sessionId}`, "sessionId"),
    source: "local-save",
    sourceApp: save.sourceApp || save.metadata?.sourceApp || BOARDSTATE_APP_ID,
    sessionId,
    gameId: session.gameId || save.gameId || "",
    title: sanitizeText(save.saveName || "Local Save"),
    mode: sanitizeText(save.gameMode || save.metadata?.mode || "saved-game"),
    lifecycle: session.sessionLifecycle || save.metadata?.sessionLifecycle || "archived",
    turn: Number(save.metadata?.currentTurn || session.turn || 1),
    phaseIndex: Number(save.metadata?.phaseIndex || session.phaseIndex || 0),
    updatedAt: Number(save.updatedAt || save.createdAt || 0),
    privacy: {
      hiddenGameplayDataIncluded: false,
      publicSummaryOnly: true,
    },
  };
}

function createDiscoveryEntryFromLinkedSession(record = {}) {
  const sessionId = record.sessionId || record.linkedSessionId || "";
  if (!sessionId) return null;
  return {
    discoveryId: normalizeContractId(`linked-${sessionId}`, "sessionId"),
    source: "linked-session",
    sourceApp: record.sourceApp || "external",
    sessionId,
    gameId: record.gameId || "",
    title: sanitizeText(record.sessionName || "Linked Session"),
    mode: "linked-session",
    lifecycle: record.status || "imported",
    revision: Number(record.revision || 0),
    updatedAt: Number(record.updatedAt || record.importedAt || 0),
    privacy: {
      hiddenGameplayDataIncluded: false,
      publicSummaryOnly: true,
    },
  };
}

function createDiscoveryEntryFromInvite(invite = {}) {
  const sessionId = invite.sessionId || invite.gameSessionId || invite.tournamentSessionId || "";
  if (!sessionId) return null;
  return {
    discoveryId: normalizeContractId(invite.inviteId || `invite-${sessionId}`, "invitationId"),
    source: "friend-invite",
    sourceApp: BOARDSTATE_APP_ID,
    sessionId,
    title: sanitizeText(`${invite.friendName || "Friend"} ${invite.inviteType || "game"} invite`),
    mode: invite.inviteType || "game",
    lifecycle: invite.status || "pending",
    updatedAt: Number(invite.createdAt || 0),
    privacy: {
      hiddenGameplayDataIncluded: false,
      publicSummaryOnly: true,
    },
  };
}

function safeCreateSessionReference(session = {}) {
  try {
    return createSessionReference({
      ...session,
      players: Array.isArray(session.players) && session.players.length
        ? session.players
        : [{ playerId: "local-player", displayName: "Player", life: session.life || 40 }],
    });
  } catch {
    return {
      appId: BOARDSTATE_APP_ID,
      sessionId: session.sessionId || session.id || "",
      gameId: session.gameId || session.id || "",
      contractVersion: COMMANDER_SESSION_SCHEMA_VERSION,
      privacySafeSummary: true,
    };
  }
}

function normalizeQueuedEnvelope(envelope = {}) {
  if (!envelope?.envelopeId) return null;
  return {
    ...cloneSafe(envelope),
    status: envelope.status || "queued-offline",
    liveSubmitted: false,
  };
}

function normalizeDomain(domain = "profile") {
  const normalized = String(domain || "profile").trim().toLowerCase();
  return ECOSYSTEM_SYNC_DOMAINS.includes(normalized) ? normalized : "profile";
}

function namespaceForDomain(domain = "profile") {
  if (domain === "notifications") return "notification";
  if (domain === "presence") return "friend";
  if (domain === "session-discovery") return "discovery";
  if (domain === "deck-snapshot") return "deck";
  if (domain === "lite-session" || domain === "hub-launch" || domain === "hub-return") return "app-link";
  if (domain === "gameplay-summary") return "discovery";
  return "profile";
}

function createCrossAppAction(input = {}) {
  return {
    actionId: input.actionId || createContractId("actionId"),
    targetApp: APP_IDS.includes(input.targetApp) ? input.targetApp : String(input.targetApp || "external"),
    label: sanitizeText(input.label || "Cross-App Action"),
    status: sanitizeText(input.status || "available"),
    enabled: Boolean(input.enabled),
    reason: sanitizeText(input.reason || ""),
    sessionReference: input.sessionReference || null,
    deckSnapshotIds: Array.isArray(input.deckSnapshotIds) ? input.deckSnapshotIds.map(String).filter(Boolean) : [],
  };
}

function inferPresenceStatus(profile = {}) {
  const session = profile.activeSession || {};
  if (session.simulation?.enabled) return "in-dry-run";
  if (session.gameTracking?.active || session.sessionLifecycle === "active") return "in-game";
  return "using-boardstate";
}

function normalizePresenceStatus(status = "unknown") {
  const normalized = String(status || "unknown").trim().toLowerCase();
  return ECOSYSTEM_PRESENCE_STATUSES.includes(normalized) ? normalized : "unknown";
}

function presenceLabel(status = "unknown") {
  const labels = {
    offline: "Offline",
    online: "Online",
    "in-game": "In Game",
    "in-dry-run": "In Dry Run",
    "editing-deck": "Editing Deck",
    "using-lite": "Using Lite",
    "using-boardstate": "Using BoardState",
    idle: "Idle",
    unknown: "Unknown",
  };
  return labels[status] || "Unknown";
}

function canExposePresenceSession(profile = {}, input = {}) {
  if (input.shareSessionReference !== undefined) return Boolean(input.shareSessionReference);
  return Boolean(profile.settings?.ecosystem?.shareSessionPresence);
}

function normalizeAppStatus(input = {}) {
  return input && typeof input === "object" ? input : {};
}

function resolveEcosystemStatus(appStatuses = {}, cloudSync = {}) {
  if (appStatuses[HUB_APP_ID]?.liveConnection) return "hub-connected";
  if ((cloudSync.outbox || []).length) return "offline-sync-queued";
  return "integration-ready";
}

function uniqueById(entries = []) {
  const seen = new Set();
  return entries.filter((entry) => {
    const id = entry.discoveryId || entry.sessionId || entry.saveId || "";
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function sanitizeText(value = "") {
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, 500);
}

function cloneSafe(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return {};
  }
}
