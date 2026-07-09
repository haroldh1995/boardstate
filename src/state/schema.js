import { createId, normalizeCount, normalizeName, normalizeSigned } from "./ids.js";
import { createFsmState } from "../game/fsm.js";
import { createFriendState } from "../social/friendSystem.js";
import {
  DEFAULT_RULES_ENGINE_VERSION,
  SHARED_CONTRACT_SCHEMA_VERSION,
  SHARED_SYNC_PROTOCOL_VERSION,
} from "../shared-contracts/version.js";

export const PHASES = ["Beginning", "Main 1", "Combat", "Main 2", "Ending"];
export const MANA_COLORS = ["W", "U", "B", "R", "G", "C", "Generic"];
export const CARD_ZONES = {
  BATTLEFIELD: "battlefield",
  COMMAND: "command",
  HIDDEN_PLACEHOLDER: "hidden-placeholder",
};

export function createDefaultProfile() {
  return {
    id: createId("profile"),
    version: 1,
    player: {
      id: "local-player",
      name: "Player",
      avatarAccent: "azure",
    },
    settings: {
      adhdAutomation: true,
      adhdMode: {
        enabled: false,
        triggerReminders: true,
        missedTriggerReminders: true,
        legalityHints: true,
        targetingReminders: true,
        stackExplanation: true,
        layerExplanation: true,
        triggerChainView: true,
        replayDebugInfo: true,
        stateInspector: true,
        focusedGuidance: true,
        reducedNoise: true,
        highlightLikelyActions: true,
        phaseActionReminders: true,
        unresolvedReminders: true,
        resourceReminders: true,
        stepByStepPrompts: false,
      },
      confirmAmbiguousEffects: true,
      strictPhaseEnforcement: false,
      manualStackConfirmation: false,
      rules: {
        enforcementMode: "enforced",
        explanationLevel: "standard",
        unsupportedBehavior: "manual-choice",
      },
      haptics: false,
      compactTiles: true,
      pagePanels: {
        lifeTrackerLife: true,
        lifeTrackerMana: true,
        lifeTrackerTools: true,
        boardOpponent: true,
        boardCombat: true,
        boardTools: true,
        advancedRulesHelpers: true,
        archiveQuickAdd: true,
        statsTimerWidgets: true,
      },
      multiplayer: {
        mode: "offline",
        connectedPlayers: [],
        authorityMode: "confirm",
        confirmAuthority: true,
        bluetoothReady: false,
        wifiReady: true,
        roomId: "boardstate-room",
        wsUrl: "ws://localhost:8787",
        role: "player",
        spectatorMode: false,
        selectedSimulatedOpponents: ["alpha"],
        simulatedSpeed: "normal",
        simulationRevenge: true,
        turnOrderRolls: {},
        suggestedTurnOrder: [],
        confirmedTurnOrder: [],
        needsTurnOrderConfirmation: false,
        lastTurnOrderConfirmedAt: 0,
      },
      battlefield: {
        manaPinned: false,
        expandedAll: false,
        statsOverlay: false,
        opponentVisibility: {
          opponent: false,
          alpha: false,
          beta: false,
          omega: false,
        },
        detailMode: "standard",
        compressionMode: "adaptive",
        densityScale: 1,
        focusMode: true,
      },
      appearance: {
        compositionMode: "auto",
      },
      navigation: {
        showProfileInMainUi: false,
        edgeSwipeShortcuts: true,
        compactMobileHud: true,
        mobileFocusView: true,
        hudBadgesLocked: false,
        hudBadgePositions: {
          tools: { x: 18, y: 520 },
          utility: { x: 98, y: 520 },
          helper: { x: 14, y: 420 },
          simulation: { x: 14, y: 182 },
          floatingMana: { x: 14, y: 332 },
        },
      },
      gestures: {
        advanced: true,
      },
      helperSprite: {
        enabled: false,
        remindersAtUpkeep: true,
        screenReaderPrompts: false,
        tutorialNarration: true,
      },
      notifications: {
        master: true,
        fullWindow: true,
        toast: true,
        sound: false,
        haptics: false,
        tournament: true,
        gameplay: true,
        dryRun: true,
        manualChoice: true,
        sync: true,
        friends: true,
        reminders: true,
        friendEvents: {
          friendRequest: true,
          friendAccepted: true,
          nearbyFriend: true,
          gameInvite: true,
          tournamentInvite: true,
          friendJoined: true,
          friendSound: false,
          friendHaptics: false,
          syncUnavailable: true,
          friendBlocked: true,
        },
        tournamentEvents: {
          inviteOpened: true,
          playerJoined: true,
          playerLeft: true,
          tournamentStarted: true,
          roundGenerated: true,
          roundLocked: true,
          tableAssignmentChanged: true,
          oneVOneComplete: true,
          suddenDeath: true,
          suddenDeathExtension: true,
          podResult: true,
          standingsUpdated: true,
          resultCorrected: true,
          tournamentEnded: true,
          finalWinners: true,
          syncReconnect: true,
        },
        gameplayEvents: {
          stackPriority: true,
          manualChoice: true,
          landfall: true,
          combatBlockers: true,
          commanderDamage: true,
          rulesConfidence: true,
          errorRecovery: true,
          tutorialStep: true,
          tutorialRule: true,
          tutorialSave: true,
        },
      },
    },
    onboarding: {
      firstLaunchComplete: false,
      tutorialOffered: false,
      tutorialStarted: false,
      tutorialCompleted: false,
      tutorialSkipped: false,
      tutorialVersion: "five-turn-v1",
      tutorialCurrentTurn: 0,
      tutorialCurrentStep: 0,
      tutorialPaused: false,
      tutorialSaveId: "",
      helperSpriteEnabled: true,
      screenReaderPromptsEnabled: false,
      tutorialReducedMotion: false,
      tutorialLastUpdatedAt: 0,
    },
    localAuth: {
      mode: "guest",
      locked: false,
      hasPassword: false,
    },
    activeSession: createGameSession(),
    commanders: {},
    archives: [],
    leaderboards: createEmptyLeaderboards(),
    achievements: [],
    statsSync: {
      lastSyncedAt: 0,
      publicSummary: {},
      peers: [],
    },
    notifications: {
      items: [],
      dismissedIds: [],
      lastReadAt: 0,
    },
    localSaves: {
      version: 1,
      activeSaveId: "",
      lastError: "",
      items: [],
    },
    linkedSessions: {
      version: 1,
      activeSessionId: "",
      lastError: "",
      items: [],
    },
    simulationMemory: {
      patterns: {
        tokenStrategy: 0,
        landfallStrategy: 0,
        lifegainStrategy: 0,
        commanderDamageStrategy: 0,
        graveyardRecursionStrategy: 0,
        artifactsStrategy: 0,
        enchantmentsStrategy: 0,
        comboEngineStrategy: 0,
        fastManaStrategy: 0,
        boardWipeStrategy: 0,
      },
      cardThreat: {},
      repeatedWinConditions: {},
      updatedAt: 0,
    },
    simulationStats: createEmptySimulationStats(),
    tournament: createTournamentState(),
    friends: createFriendState({ friendDisplayName: "Player" }),
  };
}

export function createGameSession() {
  const now = Date.now();
  return {
    id: createId("game"),
    gameId: createId("game"),
    sessionId: createId("session"),
    schemaVersion: SHARED_CONTRACT_SCHEMA_VERSION,
    rulesEngineVersion: DEFAULT_RULES_ENGINE_VERSION,
    syncProtocolVersion: SHARED_SYNC_PROTOCOL_VERSION,
    sourceApp: "boardstate",
    interfaceMode: "boardstate-advanced",
    activeInterfaceByPlayer: {
      "local-player": "boardstate-advanced",
    },
    interfaceModeHistory: [],
    localInterfaceMode: "boardstate-advanced",
    preferredInterfaceMode: "boardstate-advanced",
    lastInterfaceSwitchAt: 0,
    lastInterfaceSwitchBy: "",
    interfaceSwitchRevision: 0,
    linkedSimpleSessionReference: null,
    linkedAdvancedSessionReference: {
      sourceApp: "boardstate",
      gameId: "",
      sessionId: "",
      interfaceMode: "boardstate-advanced",
    },
    enforcementMode: "enforced",
    activeRuleWaivers: [],
    waiverHistory: [],
    revision: 0,
    sessionCapabilities: {
      supportsAdvancedMode: true,
      supportsSimpleMode: false,
      supportsRulesEngine: true,
      supportsEnforcedRules: true,
      supportsWaiveRules: true,
      supportsStack: true,
      supportsPriority: true,
      supportsCombat: true,
      supportsFullBattlefield: true,
      supportsLiteCompactBattlefield: false,
      supportsHiddenInformation: true,
      supportsDeckSnapshots: false,
      supportsHandoffExport: true,
      supportsHandoffImport: true,
      supportsLiveSync: false,
      supportsMirroredAdvancedView: false,
      supportsTournamentReference: true,
      supportsSaveRoundTrip: true,
    },
    saveMetadata: {
      ownerApp: "boardstate",
      sourceApp: "boardstate",
      mode: "training-ground",
      migrationStatus: "current",
    },
    linkedSession: {
      sourceApp: "boardstate",
      status: "local",
      imported: false,
      activeSync: false,
    },
    advancedMultiplayer: {
      viewMode: "solo-advanced",
      localPerspectivePlayerId: "local-player",
      focusedOpponentId: "",
      compactOpponentPanelOpen: false,
      lastPerspectiveUpdatedAt: 0,
      participantStatus: {},
      syncStatus: {},
      seenSyncEventIds: [],
      lastAppliedRevision: 0,
      lastSyncEventId: "",
      recoveryRequired: false,
      recoveryReason: "",
      presentationEvents: [],
    },
    createdAt: now,
    updatedAt: now,
    turn: 1,
    phaseIndex: 0,
    phaseStartedAt: now,
    turnStartedAt: now,
    timer: {
      gameStartedAt: now,
      phaseDurations: {},
      turnDurations: [],
      combatMs: 0,
    },
    life: 40,
    playerCounters: {},
    manaPool: createManaPool(),
    selectedIds: [],
    commander: createCommanderState(),
    battlefield: {
      player: [],
      opponent: [],
      invisiblePlaceholders: {
        hand: true,
        library: true,
        graveyard: true,
        exile: true,
      },
    },
    zones: {
      hand: [],
      library: [],
      graveyard: [],
      exile: [],
      command: [],
      unknownCounts: {
        hand: 0,
        library: 0,
        graveyard: 0,
        exile: 0,
      },
    },
    stack: [],
    priority: {
      activePlayerId: "local-player",
      passedPlayerIds: [],
      responderIds: [],
      waiting: false,
    },
    presentation: null,
    combat: createCombatState(),
    pendingEffects: [],
    triggerQueue: [],
    effectLog: [],
    recoveryLog: [],
    rulesConfidenceLog: [],
    history: [],
    undoStack: [],
    redoStack: [],
    actionHistory: [],
    eventQueue: [],
    eventHistory: [],
    fsm: createFsmState(),
    replay: {
      active: false,
      cursor: -1,
      running: false,
    },
    gameTracking: {
      active: false,
      startedAt: 0,
      mode: "training-ground",
    },
    tutorial: {
      active: false,
      loadedAt: 0,
      step: 0,
      currentTurn: 0,
      currentStep: 0,
      currentStepId: "",
      totalSteps: 0,
      status: "idle",
      paused: false,
      forcedGuidance: false,
      completionPending: false,
      autoSaveId: "",
      lessonLog: [],
      canClear: false,
    },
    helper: {
      reminderRequested: false,
      reminderRequestedTurn: 0,
      reminderQueue: [],
      replayQueue: [],
      dismissedKeys: [],
      deliveredKeys: [],
      lastKey: "",
      lastShownAt: 0,
    },
    simulation: {
      enabled: false,
      status: "idle",
      speed: "normal",
      revengeEnabled: true,
      format: "1v1 Commander",
      selectedOpponents: [],
      opponents: {},
      players: {},
      eliminatedPlayerIds: [],
      eliminations: [],
      winnerId: "",
      statsRecorded: false,
      strategyAdjustmentsApplied: 0,
      turnOrder: [],
      turnIndex: 0,
      currentPlayerId: "local-player",
      currentPhaseIndex: 0,
      round: 1,
      waitingForUser: false,
      log: [],
      createdAt: 0,
      updatedAt: 0,
    },
    syncedMultiplayer: {
      active: false,
      players: [],
      rolls: {},
      suggestedTurnOrder: [],
      tiePlayerIds: [],
      turnOrder: [],
      confirmed: false,
      pendingConfirmation: false,
      currentPlayerId: "local-player",
      currentPlayerIndex: 0,
      startedAt: 0,
      updatedAt: 0,
    },
  };
}

export function createEmptySimulationStats() {
  return {
    gamesPlayed: 0,
    averageTurnCount: 0,
    user: {
      wins: 0,
      losses: 0,
      eliminations: 0,
    },
    alpha: {
      wins: 0,
      losses: 0,
      eliminations: 0,
    },
    beta: {
      wins: 0,
      losses: 0,
      eliminations: 0,
    },
    omega: {
      wins: 0,
      losses: 0,
      eliminations: 0,
    },
    commanderDamageEliminations: 0,
    mostThreateningCards: {},
    mostTargetedCards: {},
    mostValuableCards: {},
    strategyAdjustmentsApplied: 0,
    history: [],
  };
}

export function createManaPool() {
  return MANA_COLORS.reduce((pool, color) => {
    pool[color] = 0;
    return pool;
  }, {});
}

export function createCombatState() {
  return {
    step: "idle",
    attackerIds: [],
    attackingPlayerId: "local-player",
    defendingPlayerId: "opponent",
    attackTargetsByAttacker: {},
    blockersByAttacker: {},
    damagePreview: null,
    resolvedDamage: 0,
    lines: [],
  };
}

export function createTournamentState(source = {}) {
  const tournamentId = normalizeName(source.tournamentId || source.id);
  const joinCode = normalizeName(source.joinCode || source.sync?.sessionId);
  const settings = {
    expectedPlayerCount: 10,
    podSize: 4,
    oneVOneSize: 2,
    oneVOneBeforeRepeat: true,
    oneVOneActsAsTimer: true,
    suddenDeathDamageDouble: true,
    suddenDeathExtensionTurns: 3,
    allowDeckChangesBetweenRounds: true,
    topThreeAnnouncement: true,
    avoidSamePods: true,
    balanceByStandings: true,
    ...(source.settings || {}),
  };
  return {
    active: Boolean(source.active),
    tournamentId,
    id: normalizeName(source.id || tournamentId),
    joinCode,
    name: normalizeName(source.name, "Local Commander Tournament"),
    formatPreset: normalizeName(source.formatPreset, "10-player-casual-win-ladder"),
    hostPlayerId: normalizeName(source.hostPlayerId),
    hostName: normalizeName(source.hostName, "Host"),
    role: normalizeName(source.role, "host"),
    status: normalizeName(source.status, source.active ? "setup" : "idle"),
    currentRoundNumber: normalizeCount(source.currentRoundNumber),
    players: Array.isArray(source.players) ? source.players : [],
    rounds: Array.isArray(source.rounds) ? source.rounds : [],
    results: Array.isArray(source.results) ? source.results : [],
    standings: Array.isArray(source.standings) ? source.standings : [],
    settings,
    pinned: Boolean(source.pinned),
    announcement: source.announcement || null,
    finalAnnouncement: source.finalAnnouncement || source.announcement || null,
    historyLog: Array.isArray(source.historyLog) ? source.historyLog : [],
    lastError: normalizeName(source.lastError),
    syncStatus: normalizeName(source.syncStatus || source.sync?.status, "local-only"),
    sync: {
      mode: normalizeName(source.sync?.mode, "local"),
      sessionId: normalizeName(source.sync?.sessionId || joinCode),
      wsUrl: normalizeName(source.sync?.wsUrl, "ws://localhost:8787"),
      lastSyncAt: Number(source.sync?.lastSyncAt || 0),
      status: normalizeName(source.sync?.status, "local-only"),
      namespace: normalizeName(source.sync?.namespace, "tournament"),
      connectedPlayers: Array.isArray(source.sync?.connectedPlayers) ? source.sync.connectedPlayers : [],
    },
    createdAt: Number(source.createdAt || 0),
    updatedAt: Number(source.updatedAt || 0),
    completedAt: Number(source.completedAt || 0),
  };
}

export function createCommanderState(source = {}) {
  return {
    name: normalizeName(source.name),
    cardId: normalizeName(source.cardId),
    colorIdentity: Array.isArray(source.colorIdentity) ? source.colorIdentity : [],
    zone: normalizeName(source.zone, "none"),
    castCount: normalizeCount(source.castCount),
    commanderTax: normalizeCount(source.commanderTax),
    damageByOpponent: source.damageByOpponent || {},
    deckKey: normalizeName(source.deckKey),
  };
}

export function createPermanent(source = {}) {
  const typeLine = normalizeName(source.typeLine, "Permanent");
  const oracleText = normalizeName(source.oracleText || source.rulesText);
  const isCreature = source.isCreature ?? /\bCreature\b/i.test(typeLine);
  const isArtifact = source.isArtifact ?? /\bArtifact\b/i.test(typeLine);
  const isEnchantment = source.isEnchantment ?? /\bEnchantment\b/i.test(typeLine);
  const isAura = source.isAura ?? /\bAura\b/i.test(typeLine);
  const isEquipment = source.isEquipment ?? /\bEquipment\b/i.test(typeLine);
  const isPlaneswalker = source.isPlaneswalker ?? /\bPlaneswalker\b/i.test(typeLine);
  const isPlanet = source.isPlanet ?? /\bPlanet\b/i.test(typeLine);
  const isLand = source.isLand ?? (/\bLand\b/i.test(typeLine) || isPlanet);
  const isVehicle = source.isVehicle ?? /\bVehicle\b/i.test(typeLine);
  const isMount = source.isMount ?? /\bMount\b/i.test(typeLine);
  const isSpacecraft = source.isSpacecraft ?? /\bSpacecraft\b/i.test(typeLine);
  const supportsStation = source.supportsStation ?? /\bStation\b/i.test(`${typeLine} ${oracleText}`);
  const supportsMaxSpeed = source.supportsMaxSpeed ?? /\bMax Speed\b/i.test(`${typeLine} ${oracleText}`);
  const isInstant = source.isInstant ?? /\bInstant\b/i.test(typeLine);
  const isSorcery = source.isSorcery ?? /\bSorcery\b/i.test(typeLine);
  const isToken = Boolean(source.isToken);
  const startingLoyalty = normalizeCount(source.startingLoyalty ?? source.loyalty);
  const counters = {
    ...(source.counters || {}),
    ...(isPlaneswalker && source.counters?.Loyalty === undefined && startingLoyalty > 0
      ? { Loyalty: startingLoyalty }
      : {}),
  };
  const basePower = normalizeSigned(source.basePower ?? source.power);
  const baseToughness = normalizeSigned(source.baseToughness ?? source.toughness);
  const stackMembers =
    Array.isArray(source.stackMembers) && source.stackMembers.length
      ? source.stackMembers
      : Array.from({ length: Math.max(1, normalizeCount(source.quantity, 1)) }, (_, index) => ({
          instanceId: source.instanceId || `${source.id || createId("perm")}:member:${index + 1}`,
          tapped: Boolean(source.tapped),
          attacking: Boolean(source.attacking),
          blocking: Boolean(source.blocking),
          summoningSick: source.summoningSick ?? Boolean(isCreature),
          counters: { ...counters },
          attachments: Array.isArray(source.attachments) ? [...source.attachments] : [],
          temporaryModifiers: Array.isArray(source.temporaryModifiers) ? [...source.temporaryModifiers] : [],
          metadata: {
            ...(source.memberMetadata || {}),
            enteredDuringCombat: Boolean(source.enteredDuringCombat),
            attackingPlayerId: source.attackingPlayerId || "",
            attackedObjectId: source.attackedObjectId || "",
            createdByTriggerId: source.createdByTriggerId || "",
            sourcePermanentId: source.sourcePermanentId || "",
            combatPhaseCreatedIn: source.combatPhaseCreatedIn || "",
            tokenTemplateId: source.tokenTemplateId || "",
            tokenCopyOfId: source.tokenCopyOfId || "",
          },
        }));

  return {
    id: normalizeName(source.id, createId("perm")),
    cardId: normalizeName(source.cardId || source.scryfallId),
    name: normalizeName(source.name, "Permanent"),
    manaCost: normalizeName(source.manaCost),
    manaValue: Number.isFinite(Number(source.manaValue)) ? Number(source.manaValue) : 0,
    typeLine,
    subtypes: Array.isArray(source.subtypes) ? source.subtypes : [],
    supertypes: Array.isArray(source.supertypes) ? source.supertypes : [],
    colors: Array.isArray(source.colors) ? source.colors : [],
    oracleText,
    rulesText: normalizeName(source.rulesText || oracleText),
    flavorText: normalizeName(source.flavorText),
    imageArt: normalizeName(source.imageArt),
    imageUrl: normalizeName(source.imageUrl),
    imageSmall: normalizeName(source.imageSmall),
    legalities: source.legalities || {},
    colorIdentity: Array.isArray(source.colorIdentity) ? source.colorIdentity : [],
    owner: normalizeName(source.owner, "player"),
    controller: normalizeName(source.controller, "player"),
    ownedByCommanderDeck: source.ownedByCommanderDeck !== false,
    zone: normalizeName(source.zone, CARD_ZONES.BATTLEFIELD),
    quantity: Math.max(1, normalizeCount(source.quantity, 1)),
    isCreature,
    isArtifact,
    isEnchantment,
    isAura,
    isEquipment,
    isPlaneswalker,
    isLand,
    isPlanet,
    isVehicle,
    isMount,
    isSpacecraft,
    supportsStation,
    supportsMaxSpeed,
    isInstant,
    isSorcery,
    isToken,
    isCopy: Boolean(source.isCopy),
    isCommander: Boolean(source.isCommander),
    startingLoyalty,
    basePower,
    baseToughness,
    currentPower: normalizeSigned(source.currentPower, basePower),
    currentToughness: normalizeSigned(source.currentToughness, baseToughness),
    markedDamage: Math.max(0, normalizeCount(source.markedDamage)),
    counters,
    keywords: Array.isArray(source.keywords) ? source.keywords : [],
    tapped: Boolean(source.tapped ?? shouldEnterTappedByDefault(source)),
    summoningSick: source.summoningSick ?? Boolean(isCreature),
    attacking: Boolean(source.attacking),
    blocking: Boolean(source.blocking),
    enteredDuringCombat: Boolean(source.enteredDuringCombat),
    attackingPlayerId: normalizeName(source.attackingPlayerId),
    attackedObjectId: normalizeName(source.attackedObjectId),
    createdByTriggerId: normalizeName(source.createdByTriggerId),
    sourcePermanentId: normalizeName(source.sourcePermanentId),
    combatPhaseCreatedIn: normalizeName(source.combatPhaseCreatedIn),
    tokenTemplateId: normalizeName(source.tokenTemplateId),
    tokenCopyOfId: normalizeName(source.tokenCopyOfId),
    attachedToId: normalizeName(source.attachedToId),
    attachments: Array.isArray(source.attachments) ? source.attachments : [],
    temporaryModifiers: Array.isArray(source.temporaryModifiers) ? source.temporaryModifiers : [],
    parsedEffects: Array.isArray(source.parsedEffects) ? source.parsedEffects : [],
    staticAbilities: Array.isArray(source.staticAbilities) ? source.staticAbilities : [],
    activatedAbilities: Array.isArray(source.activatedAbilities) ? source.activatedAbilities : [],
    triggeredAbilities: Array.isArray(source.triggeredAbilities) ? source.triggeredAbilities : [],
    replacementEffects: Array.isArray(source.replacementEffects) ? source.replacementEffects : [],
    continuousEffects: Array.isArray(source.continuousEffects) ? source.continuousEffects : [],
    tokenDefinitions: Array.isArray(source.tokenDefinitions) ? source.tokenDefinitions : [],
    metadata: {
      ...(source.metadata || {}),
      maxSpeed: Math.max(0, normalizeCount(source.metadata?.maxSpeed ?? source.maxSpeed)),
      maxSpeedReached: Boolean(source.metadata?.maxSpeedReached ?? source.maxSpeedReached),
    },
    relationships: source.relationships || {},
    tags: Array.isArray(source.tags) ? source.tags : [],
    layerBreakdown: Array.isArray(source.layerBreakdown) ? source.layerBreakdown : [],
    stackMembers,
    manualStatus: normalizeName(source.manualStatus),
  };
}

function shouldEnterTappedByDefault(source = {}) {
  const oracle = normalizeName(source.oracleText || source.rulesText).toLowerCase();
  if (!oracle || /\benters(?: the battlefield)? tapped unless\b/.test(oracle)) {
    return false;
  }
  return /\benters(?: the battlefield)? tapped\b/.test(oracle);
}

export function createDeckRecord(commander) {
  const key = commander.deckKey || makeCommanderDeckKey(commander.name);
  return {
    key,
    commanderName: commander.name,
    colorIdentity: commander.colorIdentity || [],
    cards: [],
    usage: {},
    games: [],
    stats: {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      commanderDamage: 0,
      averageGameMs: 0,
    },
    evolution: [],
  };
}

export function makeCommanderDeckKey(name) {
  return normalizeName(name, "commander").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function createEmptyLeaderboards() {
  return {
    highestLife: [],
    largestManaPool: [],
    biggestCombatDamage: [],
    largestTokenArmy: [],
    longestGame: [],
    mostTriggers: [],
    biggestBoardState: [],
    highestCommanderDamage: [],
  };
}
