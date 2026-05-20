import { createId, normalizeCount, normalizeName, normalizeSigned } from "./ids.js";
import { createFsmState } from "../game/fsm.js";

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
      },
      battlefield: {
        manaPinned: false,
        expandedAll: false,
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
      },
      gestures: {
        advanced: true,
      },
      helperSprite: {
        enabled: false,
        remindersAtUpkeep: true,
      },
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
  };
}

export function createGameSession() {
  const now = Date.now();
  return {
    id: createId("game"),
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
    combat: createCombatState(),
    pendingEffects: [],
    triggerQueue: [],
    effectLog: [],
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
    blockersByAttacker: {},
    damagePreview: null,
    resolvedDamage: 0,
    lines: [],
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
  const isCreature = source.isCreature ?? /\bCreature\b/i.test(typeLine);
  const isArtifact = source.isArtifact ?? /\bArtifact\b/i.test(typeLine);
  const isEnchantment = source.isEnchantment ?? /\bEnchantment\b/i.test(typeLine);
  const isAura = source.isAura ?? /\bAura\b/i.test(typeLine);
  const isEquipment = source.isEquipment ?? /\bEquipment\b/i.test(typeLine);
  const isPlaneswalker = source.isPlaneswalker ?? /\bPlaneswalker\b/i.test(typeLine);
  const isLand = source.isLand ?? /\bLand\b/i.test(typeLine);
  const isInstant = source.isInstant ?? /\bInstant\b/i.test(typeLine);
  const isSorcery = source.isSorcery ?? /\bSorcery\b/i.test(typeLine);
  const isToken = Boolean(source.isToken);
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
          counters: { ...(source.counters || {}) },
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
    oracleText: normalizeName(source.oracleText),
    rulesText: normalizeName(source.rulesText || source.oracleText),
    flavorText: normalizeName(source.flavorText),
    imageUrl: normalizeName(source.imageUrl),
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
    isInstant,
    isSorcery,
    isToken,
    isCopy: Boolean(source.isCopy),
    isCommander: Boolean(source.isCommander),
    basePower,
    baseToughness,
    currentPower: normalizeSigned(source.currentPower, basePower),
    currentToughness: normalizeSigned(source.currentToughness, baseToughness),
    counters: source.counters || {},
    keywords: Array.isArray(source.keywords) ? source.keywords : [],
    tapped: Boolean(source.tapped),
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
    metadata: source.metadata || {},
    relationships: source.relationships || {},
    tags: Array.isArray(source.tags) ? source.tags : [],
    layerBreakdown: Array.isArray(source.layerBreakdown) ? source.layerBreakdown : [],
    stackMembers,
    manualStatus: normalizeName(source.manualStatus),
  };
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
