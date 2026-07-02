import {
  DEFAULT_RULES_ENGINE_VERSION,
  SHARED_CONTRACT_SCHEMA_VERSION,
  SHARED_SAVE_FORMAT_VERSION,
  SHARED_SYNC_PROTOCOL_VERSION,
  getSharedVersionInfo,
} from "./version.js";
import { createContractId, normalizeContractId, normalizeFriendCode } from "./ids.js";

export const APP_IDS = Object.freeze(["boardstate", "boardstate-lite", "deck-nexus", "boardstate-hub"]);
export const INTERFACE_MODES = Object.freeze(["boardstate-lite", "boardstate-advanced", "unknown"]);
export const CONTROLLER_TYPES = Object.freeze(["human", "ai", "remote", "tutorial"]);
export const CONNECTION_STATUSES = Object.freeze(["local", "online", "offline", "nearby", "disconnected", "unknown"]);
export const GAME_STATUSES = Object.freeze(["setup", "active", "paused", "complete", "abandoned", "recovery-required"]);
export const ENFORCEMENT_MODES = Object.freeze(["enforced", "waived"]);
export const ZONE_NAMES = Object.freeze(["library", "hand", "battlefield", "graveyard", "exile", "command", "stack", "companion", "sideboard", "ante", "unknown"]);
export const VISIBILITY_LEVELS = Object.freeze(["public", "private", "known", "hidden", "owner-only"]);
export const STACK_OBJECT_TYPES = Object.freeze(["spell", "activated-ability", "triggered-ability", "copy", "special-action"]);
export const CHOICE_TYPES = Object.freeze(["target", "mode", "x-value", "color", "payment-source", "discard", "sacrifice", "replacement-effect", "trigger-order", "legend-rule", "commander-replacement", "combat-damage"]);
export const SYNC_NAMESPACES = Object.freeze(["ecosystem", "profile", "friend", "discovery", "gameplay", "tournament", "notification", "deck", "app-link"]);
export const ACTION_TYPES = Object.freeze([
  "CREATE_GAME",
  "START_GAME",
  "END_GAME",
  "ADD_PLAYER",
  "REMOVE_PLAYER",
  "CHANGE_LIFE",
  "SET_LIFE",
  "CHANGE_COMMANDER_DAMAGE",
  "CHANGE_POISON",
  "ADVANCE_PHASE",
  "SET_PHASE",
  "PASS_PRIORITY",
  "CAST_SPELL",
  "PLAY_LAND",
  "PUT_ONTO_BATTLEFIELD",
  "ACTIVATE_ABILITY",
  "TRIGGER_ABILITY",
  "SELECT_TARGETS",
  "SELECT_MODE",
  "PAY_COST",
  "TAP_PERMANENT",
  "UNTAP_PERMANENT",
  "ADD_COUNTER",
  "REMOVE_COUNTER",
  "CREATE_TOKEN",
  "DECLARE_ATTACKERS",
  "DECLARE_BLOCKERS",
  "ASSIGN_COMBAT_DAMAGE",
  "RESOLVE_STACK_OBJECT",
  "COUNTER_STACK_OBJECT",
  "DESTROY_PERMANENT",
  "SACRIFICE_PERMANENT",
  "EXILE_OBJECT",
  "RETURN_TO_HAND",
  "RETURN_TO_LIBRARY",
  "MOVE_ZONE",
  "ACTIVATE_LOYALTY_ABILITY",
  "CREW_VEHICLE",
  "SADDLE_MOUNT",
  "STATION_PERMANENT",
  "UPDATE_MAX_SPEED",
  "SUBMIT_CHOICE",
  "APPLY_RULE_WAIVER",
  "REVOKE_RULE_WAIVER",
  "SWITCH_INTERFACE_MODE",
  "SAVE_GAME",
  "LOAD_GAME",
]);
export const EVENT_TYPES = Object.freeze([
  "GAME_CREATED",
  "GAME_STARTED",
  "GAME_ENDED",
  "PLAYER_ADDED",
  "PLAYER_REMOVED",
  "LIFE_CHANGED",
  "COMMANDER_DAMAGE_CHANGED",
  "POISON_CHANGED",
  "PHASE_CHANGED",
  "PRIORITY_CHANGED",
  "SPELL_CAST",
  "SPELL_RESOLVED",
  "SPELL_COUNTERED",
  "LAND_PLAYED",
  "PERMANENT_ENTERED",
  "PERMANENT_LEFT_BATTLEFIELD",
  "CARD_MOVED_ZONE",
  "ABILITY_ACTIVATED",
  "ABILITY_TRIGGERED",
  "STACK_OBJECT_ADDED",
  "STACK_OBJECT_RESOLVED",
  "TARGETS_SELECTED",
  "MANA_ADDED",
  "MANA_SPENT",
  "PERMANENT_TAPPED",
  "PERMANENT_UNTAPPED",
  "COUNTER_ADDED",
  "COUNTER_REMOVED",
  "TOKEN_CREATED",
  "ATTACKERS_DECLARED",
  "BLOCKERS_DECLARED",
  "COMBAT_DAMAGE_ASSIGNED",
  "COMBAT_DAMAGE_DEALT",
  "PLAYER_DAMAGED",
  "STATE_BASED_ACTION_PERFORMED",
  "MANUAL_CHOICE_REQUIRED",
  "CHOICE_SUBMITTED",
  "RULE_VIOLATION",
  "RULE_WARNING",
  "RULE_WAIVED",
  "INTERFACE_MODE_CHANGED",
  "SAVE_CREATED",
  "SAVE_LOADED",
]);

export function createSharedProfileReference(input = {}) {
  const now = Date.now();
  return {
    profileId: normalizeContractId(input.profileId || input.id || "local-player", "profileId"),
    displayName: String(input.displayName || input.name || "Player").trim() || "Player",
    friendCode: normalizeFriendCode(input.friendCode || ""),
    preferredStartingLife: Number(input.preferredStartingLife || 40),
    accessibilityPreferencesReference: input.accessibilityPreferencesReference || "profile:accessibility",
    notificationPreferencesReference: input.notificationPreferencesReference || "profile:notifications",
    linkedApps: Array.isArray(input.linkedApps) ? input.linkedApps.map(createLinkedAppState) : [],
    createdAt: Number(input.createdAt || now),
    updatedAt: Number(input.updatedAt || input.createdAt || now),
  };
}

export function createLinkedAppState(input = {}) {
  return {
    appId: APP_IDS.includes(input.appId) ? input.appId : "boardstate",
    appName: String(input.appName || input.appId || "BoardState"),
    appVersion: String(input.appVersion || ""),
    appInstanceId: normalizeContractId(input.appInstanceId || createContractId("appInstanceId"), "appInstanceId"),
    linked: input.linked !== false,
    lastLinkedAt: Number(input.lastLinkedAt || 0),
    lastSyncAt: Number(input.lastSyncAt || 0),
    status: String(input.status || "unknown"),
    availableCapabilities: Array.isArray(input.availableCapabilities) ? [...input.availableCapabilities] : [],
    dataVersion: String(input.dataVersion || SHARED_CONTRACT_SCHEMA_VERSION),
  };
}

export function createCanonicalPlayer(input = {}) {
  return {
    playerId: normalizeContractId(input.playerId || input.id || "local-player", "playerId"),
    profileId: input.profileId ? normalizeContractId(input.profileId, "profileId") : "",
    displayName: String(input.displayName || input.name || "Player").trim() || "Player",
    seatIndex: Number(input.seatIndex || 0),
    controllerType: CONTROLLER_TYPES.includes(input.controllerType) ? input.controllerType : "human",
    connectionStatus: CONNECTION_STATUSES.includes(input.connectionStatus) ? input.connectionStatus : "unknown",
    activeInterface: INTERFACE_MODES.includes(input.activeInterface) ? input.activeInterface : "unknown",
    life: Number(input.life ?? input.startingLife ?? 40),
    startingLife: Number(input.startingLife || 40),
    commanderDamage: normalizeCommanderDamage(input.commanderDamage),
    poisonCounters: Math.max(0, Number(input.poisonCounters || 0)),
    playerCounters: clonePlain(input.playerCounters || {}),
    eliminated: Boolean(input.eliminated),
    eliminationReason: String(input.eliminationReason || ""),
    conceded: Boolean(input.conceded),
    teamId: String(input.teamId || ""),
    deckSnapshotId: input.deckSnapshotId ? normalizeContractId(input.deckSnapshotId, "deckSnapshotId") : "",
    commanderCardInstanceIds: Array.isArray(input.commanderCardInstanceIds) ? input.commanderCardInstanceIds.map((id) => normalizeContractId(id, "cardInstanceId")) : [],
    publicMetadata: clonePlain(input.publicMetadata || {}),
    privateMetadataReference: String(input.privateMetadataReference || ""),
  };
}

export function createCardDefinitionReference(card = {}) {
  return {
    oracleId: normalizeContractId(card.oracleId || card.oracle_id || card.cardId || card.id || card.name || createContractId("cardOracleId"), "cardOracleId"),
    printingId: normalizeContractId(card.printingId || card.scryfallId || card.id || card.cardId || card.name || createContractId("cardPrintingId"), "cardPrintingId"),
    name: String(card.name || "Unknown Card"),
    faceName: String(card.faceName || ""),
    layout: String(card.layout || ""),
    typeLine: String(card.typeLine || card.type_line || ""),
    oracleText: String(card.oracleText || card.oracle_text || ""),
    manaCost: String(card.manaCost || card.mana_cost || ""),
    colorIdentity: Array.isArray(card.colorIdentity) ? [...card.colorIdentity] : [],
    colors: Array.isArray(card.colors) ? [...card.colors] : [],
    power: card.power ?? "",
    toughness: card.toughness ?? "",
    loyalty: card.loyalty ?? "",
    defense: card.defense ?? "",
    imageUris: clonePlain(card.imageUris || card.image_uris || {}),
    cardFaces: Array.isArray(card.cardFaces || card.card_faces) ? clonePlain(card.cardFaces || card.card_faces) : [],
    keywords: Array.isArray(card.keywords) ? [...card.keywords] : [],
    legalitiesReference: card.legalitiesReference || (card.legalities ? "embedded-legalities" : ""),
    sourceDataVersion: String(card.sourceDataVersion || card.updatedAt || ""),
  };
}

export function createCardInstance(input = {}) {
  return {
    cardInstanceId: normalizeContractId(input.cardInstanceId || input.id || createContractId("cardInstanceId"), "cardInstanceId"),
    ownerPlayerId: normalizeContractId(input.ownerPlayerId || input.owner || input.controller || "local-player", "playerId"),
    controllerPlayerId: normalizeContractId(input.controllerPlayerId || input.controller || input.owner || "local-player", "playerId"),
    oracleId: normalizeContractId(input.oracleId || input.cardId || input.name || createContractId("cardOracleId"), "cardOracleId"),
    printingId: normalizeContractId(input.printingId || input.scryfallId || input.cardId || input.name || createContractId("cardPrintingId"), "cardPrintingId"),
    faceIndex: Number(input.faceIndex || 0),
    currentZone: ZONE_NAMES.includes(input.currentZone) ? input.currentZone : "unknown",
    visibility: VISIBILITY_LEVELS.includes(input.visibility) ? input.visibility : "public",
    knownToPlayerIds: Array.isArray(input.knownToPlayerIds) ? input.knownToPlayerIds.map((id) => normalizeContractId(id, "playerId")) : [],
    tapped: Boolean(input.tapped),
    transformed: Boolean(input.transformed),
    faceDown: Boolean(input.faceDown),
    counters: clonePlain(input.counters || {}),
    damageMarked: Number(input.damageMarked || input.markedDamage || 0),
    attachments: Array.isArray(input.attachments) ? input.attachments.map((id) => normalizeContractId(id, "permanentId")) : [],
    attachedTo: input.attachedTo ? normalizeContractId(input.attachedTo, "permanentId") : "",
    temporaryEffects: Array.isArray(input.temporaryEffects) ? clonePlain(input.temporaryEffects) : [],
    createdBy: String(input.createdBy || ""),
    copiedFrom: String(input.copiedFrom || ""),
    token: Boolean(input.token || input.isToken),
    conjured: Boolean(input.conjured),
    metadata: clonePlain(input.metadata || {}),
  };
}

export function createDeckSnapshot(input = {}) {
  return {
    deckSnapshotId: normalizeContractId(input.deckSnapshotId || input.id || createContractId("deckSnapshotId"), "deckSnapshotId"),
    sourceApp: APP_IDS.includes(input.sourceApp) ? input.sourceApp : "boardstate",
    sourceDeckId: normalizeContractId(input.sourceDeckId || input.deckId || input.deckKey || createContractId("deckId"), "deckId"),
    sourceDeckVersion: String(input.sourceDeckVersion || input.version || "legacy"),
    ownerProfileId: input.ownerProfileId ? normalizeContractId(input.ownerProfileId, "profileId") : "",
    name: String(input.name || input.commanderName || "BoardState Deck"),
    format: String(input.format || "commander"),
    commanderIds: Array.isArray(input.commanderIds) ? [...input.commanderIds] : [],
    partnerBackgroundReferences: clonePlain(input.partnerBackgroundReferences || {}),
    cards: Array.isArray(input.cards) ? clonePlain(input.cards) : [],
    sideboard: Array.isArray(input.sideboard) ? clonePlain(input.sideboard) : [],
    strategyTags: Array.isArray(input.strategyTags) ? [...input.strategyTags] : [],
    bracketPowerMetadata: clonePlain(input.bracketPowerMetadata || {}),
    importedAt: Number(input.importedAt || Date.now()),
    immutableSnapshotVersion: String(input.immutableSnapshotVersion || SHARED_CONTRACT_SCHEMA_VERSION),
  };
}

export function createSharedGameSession(input = {}) {
  const versionInfo = getSharedVersionInfo(input);
  const now = Date.now();
  return {
    gameId: normalizeContractId(input.gameId || input.id || createContractId("gameId"), "gameId"),
    sessionId: normalizeContractId(input.sessionId || input.gameId || input.id || createContractId("sessionId"), "sessionId"),
    schemaVersion: versionInfo.schemaVersion,
    rulesEngineVersion: versionInfo.rulesEngineVersion,
    syncProtocolVersion: versionInfo.syncProtocolVersion,
    format: String(input.format || "commander"),
    status: GAME_STATUSES.includes(input.status) ? input.status : "setup",
    createdAt: Number(input.createdAt || now),
    updatedAt: Number(input.updatedAt || now),
    revision: Math.max(0, Number(input.revision || 0)),
    hostPlayerId: input.hostPlayerId ? normalizeContractId(input.hostPlayerId, "playerId") : "local-player",
    activeInterfaceByPlayer: clonePlain(input.activeInterfaceByPlayer || {}),
    enforcementMode: ENFORCEMENT_MODES.includes(input.enforcementMode) ? input.enforcementMode : "enforced",
    activeRuleWaivers: Array.isArray(input.activeRuleWaivers) ? input.activeRuleWaivers.map(createRuleWaiver) : [],
    players: Array.isArray(input.players) ? input.players.map(createCanonicalPlayer) : [],
    turnState: createTurnState(input.turnState || {}),
    priorityState: createPriorityState(input.priorityState || {}),
    battlefieldState: createBattlefieldState(input.battlefieldState || {}),
    zoneState: createZoneState(input.zoneState || {}),
    stackState: createStackState(input.stackState || {}),
    triggerState: createTriggerState(input.triggerState || {}),
    combatState: createCombatState(input.combatState || {}),
    manaState: createManaState(input.manaState || {}),
    continuousEffectState: clonePlain(input.continuousEffectState || { effects: [], revision: 0 }),
    delayedEffectState: clonePlain(input.delayedEffectState || { effects: [], revision: 0 }),
    publicInformation: clonePlain(input.publicInformation || {}),
    privateInformationReferences: clonePlain(input.privateInformationReferences || {}),
    tournamentReference: input.tournamentReference ? createTournamentReference(input.tournamentReference) : null,
    deckSnapshotReferences: Array.isArray(input.deckSnapshotReferences) ? clonePlain(input.deckSnapshotReferences) : [],
    saveMetadata: clonePlain(input.saveMetadata || {}),
    sessionCapabilities: clonePlain(input.sessionCapabilities || {}),
    historyMetadata: clonePlain(input.historyMetadata || {}),
  };
}

export function createTurnState(input = {}) {
  return {
    turnNumber: Math.max(1, Number(input.turnNumber || 1)),
    activePlayerId: input.activePlayerId || "local-player",
    startingPlayerId: input.startingPlayerId || input.activePlayerId || "local-player",
    currentPhase: String(input.currentPhase || "beginning"),
    currentStep: String(input.currentStep || "setup"),
    extraTurns: Array.isArray(input.extraTurns) ? clonePlain(input.extraTurns) : [],
    skippedTurns: Array.isArray(input.skippedTurns) ? clonePlain(input.skippedTurns) : [],
    phaseSequence: Array.isArray(input.phaseSequence) ? [...input.phaseSequence] : ["beginning", "main-1", "combat", "main-2", "ending"],
    stepSequence: Array.isArray(input.stepSequence) ? [...input.stepSequence] : [],
    turnStartedAt: Number(input.turnStartedAt || 0),
    landPlaysAllowed: Number(input.landPlaysAllowed || 1),
    landPlaysUsed: Number(input.landPlaysUsed || 0),
    spellsCastThisTurn: clonePlain(input.spellsCastThisTurn || {}),
    abilitiesActivatedThisTurn: clonePlain(input.abilitiesActivatedThisTurn || {}),
    attackersDeclared: Boolean(input.attackersDeclared),
    blockersDeclared: Boolean(input.blockersDeclared),
  };
}

export function createPriorityState(input = {}) {
  const passed = Array.isArray(input.passedPlayerIds) ? input.passedPlayerIds : [];
  return {
    priorityHolderId: input.priorityHolderId || input.activePlayerId || "local-player",
    passOrder: Array.isArray(input.passOrder) ? [...input.passOrder] : [],
    passedPlayerIds: [...passed],
    allPlayersPassed: Boolean(input.allPlayersPassed),
    priorityRound: Math.max(0, Number(input.priorityRound || 0)),
    pendingChoiceRequestIds: Array.isArray(input.pendingChoiceRequestIds) ? [...input.pendingChoiceRequestIds] : [],
    stackCanResolve: Boolean(input.stackCanResolve),
    lastActionId: String(input.lastActionId || ""),
    lastEventId: String(input.lastEventId || ""),
  };
}

export function createBattlefieldState(input = {}) {
  return {
    permanentsById: clonePlain(input.permanentsById || {}),
    battlefieldOrderByPlayer: clonePlain(input.battlefieldOrderByPlayer || {}),
    creaturePermanentIds: Array.isArray(input.creaturePermanentIds) ? [...input.creaturePermanentIds] : [],
    landPermanentIds: Array.isArray(input.landPermanentIds) ? [...input.landPermanentIds] : [],
    nonCreaturePermanentIds: Array.isArray(input.nonCreaturePermanentIds) ? [...input.nonCreaturePermanentIds] : [],
    attackingPermanentIds: Array.isArray(input.attackingPermanentIds) ? [...input.attackingPermanentIds] : [],
    blockingAssignments: clonePlain(input.blockingAssignments || {}),
    selectedTargets: Array.isArray(input.selectedTargets) ? [...input.selectedTargets] : [],
    derivedStateRevision: Number(input.derivedStateRevision || 0),
    continuousEffectRevision: Number(input.continuousEffectRevision || 0),
  };
}

export function createPermanentState(input = {}) {
  const cardReference = createCardDefinitionReference(input.baseCharacteristics || input.cardDefinitionReference || input);
  return {
    permanentId: normalizeContractId(input.permanentId || input.id || createContractId("permanentId"), "permanentId"),
    cardInstanceId: normalizeContractId(input.cardInstanceId || input.id || createContractId("cardInstanceId"), "cardInstanceId"),
    ownerPlayerId: normalizeContractId(input.ownerPlayerId || input.owner || input.controller || "local-player", "playerId"),
    controllerPlayerId: normalizeContractId(input.controllerPlayerId || input.controller || input.owner || "local-player", "playerId"),
    baseCharacteristics: cardReference,
    derivedCharacteristics: clonePlain(input.derivedCharacteristics || {
      typeLine: input.typeLine || "",
      power: input.currentPower ?? input.power ?? "",
      toughness: input.currentToughness ?? input.toughness ?? "",
      loyalty: input.counters?.Loyalty ?? input.loyalty ?? "",
      abilities: input.keywords || [],
    }),
    tapped: Boolean(input.tapped),
    attacking: Boolean(input.attacking),
    blocking: Boolean(input.blocking),
    phasedOut: Boolean(input.phasedOut),
    transformed: Boolean(input.transformed),
    faceDown: Boolean(input.faceDown),
    summoningSick: input.summoningSick !== false,
    counters: clonePlain(input.counters || {}),
    damageMarked: Number(input.damageMarked || input.markedDamage || 0),
    loyalty: Number(input.loyalty ?? input.counters?.Loyalty ?? 0),
    defense: Number(input.defense || 0),
    attachments: Array.isArray(input.attachments) ? [...input.attachments] : [],
    attachedTo: String(input.attachedTo || ""),
    tokenStack: {
      token: Boolean(input.isToken || input.token),
      quantity: Math.max(1, Number(input.quantity || 1)),
      exactCopy: Boolean(input.exactCopy || input.isExactCopy),
    },
    crewed: Boolean(input.crewed),
    saddled: Boolean(input.saddled),
    mounted: Boolean(input.mounted),
    stationed: Boolean(input.stationed),
    stationProgress: Number(input.stationProgress || 0),
    maxSpeedState: clonePlain(input.maxSpeedState || {}),
    temporaryEffects: Array.isArray(input.temporaryEffects) ? clonePlain(input.temporaryEffects) : [],
    enteredBattlefieldTurn: Number(input.enteredBattlefieldTurn || 0),
    enteredBattlefieldEventId: String(input.enteredBattlefieldEventId || ""),
    metadata: clonePlain(input.metadata || {}),
  };
}

export function createZoneState(input = {}) {
  return {
    zonesByPlayer: clonePlain(input.zonesByPlayer || {}),
    sharedZones: clonePlain(input.sharedZones || {}),
    visibility: clonePlain(input.visibility || {}),
  };
}

export function createStackState(input = {}) {
  return {
    objects: Array.isArray(input.objects) ? input.objects.map(createStackObject) : [],
    topObjectId: String(input.topObjectId || ""),
    order: Array.isArray(input.order) ? [...input.order] : [],
  };
}

export function createStackObject(input = {}) {
  return {
    stackObjectId: normalizeContractId(input.stackObjectId || input.id || createContractId("stackObjectId"), "stackObjectId"),
    objectType: STACK_OBJECT_TYPES.includes(input.objectType) ? input.objectType : "spell",
    controllerPlayerId: input.controllerPlayerId || input.controller || "local-player",
    sourceCardInstanceId: String(input.sourceCardInstanceId || input.cardInstanceId || ""),
    sourcePermanentId: String(input.sourcePermanentId || ""),
    cardDefinitionReference: createCardDefinitionReference(input.cardDefinitionReference || input.card || input),
    selectedModes: Array.isArray(input.selectedModes) ? clonePlain(input.selectedModes) : [],
    targets: Array.isArray(input.targets) ? clonePlain(input.targets) : [],
    xValue: Number(input.xValue || 0),
    costsPaid: clonePlain(input.costsPaid || {}),
    copied: Boolean(input.copied || input.isCopy),
    createdAtRevision: Number(input.createdAtRevision || 0),
    status: String(input.status || "pending"),
    requiredChoiceRequestIds: Array.isArray(input.requiredChoiceRequestIds) ? [...input.requiredChoiceRequestIds] : [],
    rulesMetadata: clonePlain(input.rulesMetadata || {}),
  };
}

export function createTriggerState(input = {}) {
  return {
    triggers: Array.isArray(input.triggers) ? input.triggers.map(createTrigger) : [],
    order: Array.isArray(input.order) ? [...input.order] : [],
  };
}

export function createTrigger(input = {}) {
  return {
    triggerId: normalizeContractId(input.triggerId || input.id || createContractId("triggerId"), "triggerId"),
    sourcePermanentId: String(input.sourcePermanentId || input.sourceId || ""),
    controllerPlayerId: String(input.controllerPlayerId || input.controller || "local-player"),
    eventId: String(input.eventId || ""),
    triggerCondition: String(input.triggerCondition || input.condition || input.summary || ""),
    multiplicity: Math.max(1, Number(input.multiplicity || input.count || 1)),
    copiedCount: Math.max(0, Number(input.copiedCount || 0)),
    optional: Boolean(input.optional),
    status: String(input.status || "pending"),
    stackObjectId: String(input.stackObjectId || ""),
  };
}

export function createChoiceRequest(input = {}) {
  return {
    choiceRequestId: normalizeContractId(input.choiceRequestId || input.id || createContractId("choiceRequestId"), "choiceRequestId"),
    requestingPlayerId: String(input.requestingPlayerId || input.playerId || "local-player"),
    choiceType: CHOICE_TYPES.includes(input.choiceType) ? input.choiceType : "target",
    promptKey: String(input.promptKey || input.prompt || "manual-choice-required"),
    sourceObjectId: String(input.sourceObjectId || input.sourceId || ""),
    legalOptions: Array.isArray(input.legalOptions) ? clonePlain(input.legalOptions) : [],
    minimumSelections: Number(input.minimumSelections || 0),
    maximumSelections: Number(input.maximumSelections || 1),
    defaultOption: clonePlain(input.defaultOption || null),
    deadline: Number(input.deadline || 0),
    visibility: VISIBILITY_LEVELS.includes(input.visibility) ? input.visibility : "private",
    status: String(input.status || "pending"),
    resolution: clonePlain(input.resolution || null),
  };
}

export function createCombatState(input = {}) {
  return {
    combatId: normalizeContractId(input.combatId || input.id || createContractId("eventId"), "eventId"),
    attackingPlayerId: String(input.attackingPlayerId || "local-player"),
    defendingPlayerIds: Array.isArray(input.defendingPlayerIds) ? [...input.defendingPlayerIds] : [],
    attackers: clonePlain(input.attackers || input.attackerIds || []),
    attackTargets: clonePlain(input.attackTargets || input.attackTargetsByAttacker || {}),
    blockerAssignments: clonePlain(input.blockerAssignments || input.blockersByAttacker || {}),
    damageAssignments: clonePlain(input.damageAssignments || {}),
    firstStrikeDamageComplete: Boolean(input.firstStrikeDamageComplete),
    normalDamageComplete: Boolean(input.normalDamageComplete),
    combatComplete: Boolean(input.combatComplete),
    restrictions: clonePlain(input.restrictions || {}),
    requirements: clonePlain(input.requirements || {}),
  };
}

export function createManaState(input = {}) {
  return {
    poolsByPlayer: clonePlain(input.poolsByPlayer || {}),
    availableSources: Array.isArray(input.availableSources) ? input.availableSources.map(createManaSourceReference) : [],
    paymentHistory: Array.isArray(input.paymentHistory) ? input.paymentHistory.map(createPaymentRecord) : [],
    supportedMana: ["white", "blue", "black", "red", "green", "colorless", "generic", "snow", "restricted", "temporary", "persistent"],
  };
}

export function createManaSourceReference(input = {}) {
  return {
    permanentId: String(input.permanentId || input.id || ""),
    abilityReference: String(input.abilityReference || input.abilityId || ""),
    producibleMana: clonePlain(input.producibleMana || {}),
    restrictions: clonePlain(input.restrictions || {}),
    additionalCost: clonePlain(input.additionalCost || {}),
    selectedOutput: clonePlain(input.selectedOutput || {}),
  };
}

export function createPaymentRecord(input = {}) {
  return {
    paymentId: normalizeContractId(input.paymentId || createContractId("eventId"), "eventId"),
    playerId: String(input.playerId || "local-player"),
    sourceObjectId: String(input.sourceObjectId || ""),
    manaSpent: clonePlain(input.manaSpent || {}),
    permanentsTapped: Array.isArray(input.permanentsTapped) ? [...input.permanentsTapped] : [],
    permanentsSacrificed: Array.isArray(input.permanentsSacrificed) ? [...input.permanentsSacrificed] : [],
    cardsDiscarded: Array.isArray(input.cardsDiscarded) ? [...input.cardsDiscarded] : [],
    lifePaid: Number(input.lifePaid || 0),
    countersRemoved: clonePlain(input.countersRemoved || {}),
    loyaltyPaid: Number(input.loyaltyPaid || 0),
    convokeSources: Array.isArray(input.convokeSources) ? [...input.convokeSources] : [],
    improviseSources: Array.isArray(input.improviseSources) ? [...input.improviseSources] : [],
    otherCosts: clonePlain(input.otherCosts || {}),
    unresolvedChoices: Array.isArray(input.unresolvedChoices) ? clonePlain(input.unresolvedChoices) : [],
  };
}

export function createRuleViolation(input = {}) {
  return {
    ruleViolationId: normalizeContractId(input.ruleViolationId || input.id || createContractId("eventId"), "eventId"),
    code: String(input.code || "unknown-rule-violation"),
    severity: String(input.severity || "error"),
    messageKey: String(input.messageKey || input.code || "rule.violation"),
    explanation: String(input.explanation || ""),
    relatedObjectIds: Array.isArray(input.relatedObjectIds) ? [...input.relatedObjectIds] : [],
    blocking: input.blocking !== false,
    waivable: input.waivable !== false,
    suggestedCorrections: Array.isArray(input.suggestedCorrections) ? clonePlain(input.suggestedCorrections) : [],
  };
}

export function createRuleWarning(input = {}) {
  return {
    ruleWarningId: normalizeContractId(input.ruleWarningId || input.id || createContractId("eventId"), "eventId"),
    code: String(input.code || "rule-warning"),
    explanation: String(input.explanation || ""),
    relatedObjectIds: Array.isArray(input.relatedObjectIds) ? [...input.relatedObjectIds] : [],
    requiresConfirmation: Boolean(input.requiresConfirmation),
  };
}

export function createRuleWaiver(input = {}) {
  return {
    waiverId: normalizeContractId(input.waiverId || input.id || createContractId("eventId"), "eventId"),
    ruleCode: String(input.ruleCode || input.code || ""),
    scope: ["action", "turn", "game"].includes(input.scope) ? input.scope : "action",
    approvedByPlayerId: String(input.approvedByPlayerId || input.playerId || ""),
    createdAt: Number(input.createdAt || Date.now()),
    expiresAtRevision: Number(input.expiresAtRevision || 0),
    reason: String(input.reason || ""),
    relatedActionId: String(input.relatedActionId || ""),
  };
}

export function createCanonicalAction(input = {}) {
  return {
    actionId: normalizeContractId(input.actionId || input.id || createContractId("actionId"), "actionId"),
    actionType: normalizeActionType(input.actionType || input.type),
    schemaVersion: input.schemaVersion || SHARED_CONTRACT_SCHEMA_VERSION,
    gameId: normalizeContractId(input.gameId || "", "gameId"),
    sessionId: normalizeContractId(input.sessionId || input.gameId || "", "sessionId"),
    playerId: normalizeContractId(input.playerId || "local-player", "playerId"),
    createdAt: Number(input.createdAt || input.timestamp || Date.now()),
    expectedRevision: Number(input.expectedRevision || 0),
    payload: clonePlain(input.payload || {}),
    clientMetadata: sanitizeClientMetadata(input.clientMetadata || {}),
  };
}

export function createCanonicalEvent(input = {}) {
  return {
    eventId: normalizeContractId(input.eventId || input.id || createContractId("eventId"), "eventId"),
    eventType: normalizeEventType(input.eventType || input.type),
    schemaVersion: input.schemaVersion || SHARED_CONTRACT_SCHEMA_VERSION,
    gameId: normalizeContractId(input.gameId || "", "gameId"),
    sessionId: normalizeContractId(input.sessionId || input.gameId || "", "sessionId"),
    revision: Number(input.revision || 0),
    causedByActionId: String(input.causedByActionId || input.actionId || ""),
    createdAt: Number(input.createdAt || input.timestamp || Date.now()),
    controllerPlayerId: String(input.controllerPlayerId || input.playerId || ""),
    payload: clonePlain(input.payload || {}),
    visibility: VISIBILITY_LEVELS.includes(input.visibility) ? input.visibility : "public",
    rulesEngineVersion: input.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
  };
}

export function createCanonicalSyncMessage(input = {}) {
  return {
    namespace: SYNC_NAMESPACES.includes(input.namespace) ? input.namespace : "ecosystem",
    messageType: String(input.messageType || input.type || "message"),
    syncProtocolVersion: input.syncProtocolVersion || SHARED_SYNC_PROTOCOL_VERSION,
    messageId: normalizeContractId(input.messageId || input.id || createContractId("eventId"), "eventId"),
    sessionId: normalizeContractId(input.sessionId || input.roomId || "", "sessionId"),
    gameId: normalizeContractId(input.gameId || "", "gameId"),
    senderPlayerId: normalizeContractId(input.senderPlayerId || input.peerId || input.playerId || "", "playerId"),
    senderAppInstanceId: normalizeContractId(input.senderAppInstanceId || input.peerId || "", "appInstanceId"),
    expectedRevision: Number(input.expectedRevision || 0),
    payload: clonePlain(input.payload || {}),
    createdAt: Number(input.createdAt || input.updatedAt || Date.now()),
  };
}

export function createTournamentReference(input = {}) {
  return {
    tournamentId: normalizeContractId(input.tournamentId || input.id || "", "tournamentId"),
    participantId: normalizeContractId(input.participantId || input.playerId || "", "participantId"),
    roundId: normalizeContractId(input.roundId || input.roundNumber || "", "roundId"),
    tableId: normalizeContractId(input.tableId || "", "tableId"),
    tableType: String(input.tableType || ""),
    currentRoundNumber: Number(input.currentRoundNumber || input.roundNumber || 0),
    status: String(input.status || "local"),
    hostProfileId: String(input.hostProfileId || ""),
    syncSessionId: String(input.syncSessionId || input.sessionId || ""),
    externalOwnerApp: ["hub", "boardstate", "legacy"].includes(input.externalOwnerApp) ? input.externalOwnerApp : "boardstate",
  };
}

export function createNotificationReference(input = {}) {
  return {
    notificationId: normalizeContractId(input.notificationId || input.id || createContractId("notificationId"), "notificationId"),
    category: String(input.category || "gameplay"),
    severity: String(input.severity || "info"),
    titleKey: String(input.titleKey || input.title || ""),
    bodyKey: String(input.bodyKey || input.body || ""),
    relatedGameId: String(input.relatedGameId || ""),
    relatedTournamentId: String(input.relatedTournamentId || ""),
    relatedActionId: String(input.relatedActionId || ""),
    relatedEventId: String(input.relatedEventId || ""),
    createdAt: Number(input.createdAt || Date.now()),
    acknowledged: Boolean(input.acknowledged),
    deliveryHints: clonePlain(input.deliveryHints || {}),
  };
}

export function createCanonicalSaveEnvelope(input = {}) {
  const now = Date.now();
  const gameState = input.gameState ? createSharedGameSession(input.gameState) : createSharedGameSession({});
  const envelope = {
    saveId: normalizeContractId(input.saveId || createContractId("saveId"), "saveId"),
    saveFormatVersion: input.saveFormatVersion || SHARED_SAVE_FORMAT_VERSION,
    schemaVersion: input.schemaVersion || SHARED_CONTRACT_SCHEMA_VERSION,
    rulesEngineVersion: input.rulesEngineVersion || gameState.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
    profileId: normalizeContractId(input.profileId || "", "profileId"),
    gameId: gameState.gameId,
    sessionId: gameState.sessionId,
    saveName: String(input.saveName || "BoardState Save"),
    createdAt: Number(input.createdAt || now),
    updatedAt: Number(input.updatedAt || input.createdAt || now),
    sourceApp: input.sourceApp || "boardstate",
    gameState,
    privateStateReferences: clonePlain(input.privateStateReferences || {}),
    tutorialState: clonePlain(input.tutorialState || {}),
    appPresentationState: clonePlain(input.appPresentationState || {}),
    metadata: clonePlain(input.metadata || {}),
    checksum: String(input.checksum || ""),
  };
  return {
    ...envelope,
    checksum: envelope.checksum || buildStableChecksum(envelope),
  };
}

export function createEcosystemBundle(input = {}) {
  return {
    bundleId: normalizeContractId(input.bundleId || createContractId("saveId"), "saveId"),
    schemaVersion: input.schemaVersion || SHARED_CONTRACT_SCHEMA_VERSION,
    createdAt: Number(input.createdAt || Date.now()),
    updatedAt: Number(input.updatedAt || input.createdAt || Date.now()),
    sections: {
      profile: versionedSection(input.sections?.profile),
      boardstate: versionedSection(input.sections?.boardstate),
      boardstateLite: versionedSection(input.sections?.boardstateLite),
      deckNexus: versionedSection(input.sections?.deckNexus),
      hub: versionedSection(input.sections?.hub),
      decks: versionedSection(input.sections?.decks),
      gameSaves: versionedSection(input.sections?.gameSaves),
      friends: versionedSection(input.sections?.friends),
      tournaments: versionedSection(input.sections?.tournaments),
      notifications: versionedSection(input.sections?.notifications),
      appLinks: versionedSection(input.sections?.appLinks),
      metadata: versionedSection(input.sections?.metadata),
      ...(input.sections?.unknown || {}),
    },
    metadata: clonePlain(input.metadata || {}),
  };
}

export function clonePlain(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return JSON.parse(JSON.stringify(value));
}

export function normalizeActionType(value = "") {
  const normalized = String(value || "").trim().toUpperCase();
  return ACTION_TYPES.includes(normalized) ? normalized : normalized || "UNKNOWN_ACTION";
}

export function normalizeEventType(value = "") {
  const normalized = String(value || "").trim().toUpperCase();
  return EVENT_TYPES.includes(normalized) ? normalized : normalized || "UNKNOWN_EVENT";
}

export function buildStableChecksum(value = {}) {
  const seed = JSON.stringify(value, (key, entry) => key === "checksum" ? undefined : entry);
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return `c${Math.abs(hash).toString(36)}`;
}

function normalizeCommanderDamage(value = {}) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).map(([sourceCommanderId, amount]) => [
    normalizeContractId(sourceCommanderId, "cardInstanceId"),
    Number(amount || 0),
  ]));
}

function sanitizeClientMetadata(metadata = {}) {
  const clone = clonePlain(metadata || {});
  delete clone.password;
  delete clone.authToken;
  delete clone.token;
  delete clone.privateToken;
  return clone;
}

function versionedSection(section = null) {
  if (section && typeof section === "object" && section.schemaVersion) return clonePlain(section);
  return {
    schemaVersion: SHARED_CONTRACT_SCHEMA_VERSION,
    data: clonePlain(section || null),
  };
}
