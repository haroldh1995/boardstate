import {
  DEFAULT_RULES_ENGINE_VERSION,
  SHARED_CONTRACT_SCHEMA_VERSION,
  SHARED_SAVE_FORMAT_VERSION,
  SHARED_SYNC_PROTOCOL_VERSION,
} from "./version.js";
import {
  createCanonicalAction,
  createCanonicalEvent,
  createCanonicalPlayer,
  createCanonicalSaveEnvelope,
  createCanonicalSyncMessage,
  createCardDefinitionReference,
  createCardInstance,
  createChoiceRequest,
  createCombatState,
  createDeckSnapshot,
  createManaState,
  createPermanentState,
  createSessionCapabilities,
  createSharedGameSession,
  createStackObject,
  createTournamentReference,
  createTrigger,
  clonePlain,
} from "./contracts.js";
import { createContractId, normalizeContractId } from "./ids.js";

const PHASE_ID_BY_LABEL = {
  Beginning: "beginning",
  "Main 1": "main-1",
  Combat: "combat",
  "Main 2": "main-2",
  Ending: "ending",
};

export function boardStateProfileToSharedSession(profile = {}, options = {}) {
  const session = profile.activeSession || {};
  const localPlayerId = profile.player?.id || "local-player";
  const players = buildPlayers(profile, options);
  const battlefield = buildBattlefieldState(session);
  return createSharedGameSession({
    gameId: session.id || options.gameId || createContractId("gameId"),
    sessionId: options.sessionId || session.id || createContractId("sessionId"),
    schemaVersion: SHARED_CONTRACT_SCHEMA_VERSION,
    rulesEngineVersion: options.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
    syncProtocolVersion: SHARED_SYNC_PROTOCOL_VERSION,
    format: session.simulation?.format || session.gameTracking?.format || "commander",
    status: session.gameTracking?.active || session.simulation?.enabled ? "active" : "setup",
    createdAt: session.createdAt || Date.now(),
    updatedAt: session.updatedAt || Date.now(),
    revision: Number(session.actionHistory?.length || session.eventHistory?.length || 0),
    hostPlayerId: localPlayerId,
    activeInterfaceByPlayer: session.activeInterfaceByPlayer || Object.fromEntries(players.map((player) => [player.playerId, player.activeInterface])),
    interfaceModeHistory: session.interfaceModeHistory || [],
    localInterfaceMode: session.localInterfaceMode || session.interfaceMode || "boardstate-advanced",
    preferredInterfaceMode: session.preferredInterfaceMode || "boardstate-advanced",
    lastInterfaceSwitchAt: session.lastInterfaceSwitchAt || 0,
    lastInterfaceSwitchBy: session.lastInterfaceSwitchBy || "",
    interfaceSwitchRevision: session.interfaceSwitchRevision || 0,
    linkedSimpleSessionReference: session.linkedSimpleSessionReference || null,
    linkedAdvancedSessionReference: session.linkedAdvancedSessionReference || null,
    enforcementMode: options.enforcementMode || session.enforcementMode || "enforced",
    activeRuleWaivers: session.activeRuleWaivers || [],
    players,
    turnState: {
      turnNumber: session.turn || 1,
      activePlayerId: session.simulation?.currentPlayerId || session.priority?.activePlayerId || localPlayerId,
      startingPlayerId: localPlayerId,
      currentPhase: PHASE_ID_BY_LABEL[options.phaseLabel] || PHASE_ID_BY_LABEL[options.phases?.[session.phaseIndex]] || "beginning",
      currentStep: session.fsm?.current || "setup",
      turnStartedAt: session.turnStartedAt || 0,
      landPlaysAllowed: 1,
      landPlaysUsed: Number(session.landPlaysUsed || 0),
      attackersDeclared: Boolean(session.combat?.attackerIds?.length),
      blockersDeclared: Boolean(Object.keys(session.combat?.blockersByAttacker || {}).length),
    },
    priorityState: {
      priorityHolderId: session.priority?.activePlayerId || localPlayerId,
      passedPlayerIds: session.priority?.passedPlayerIds || [],
      allPlayersPassed: Boolean(session.priority?.waiting === false && (session.priority?.passedPlayerIds || []).length),
      stackCanResolve: Boolean((session.stack || []).length),
    },
    battlefieldState: battlefield,
    zoneState: buildZoneState(session, players),
    stackState: {
      objects: (session.stack || []).map((object) => createStackObject({
        ...object,
        stackObjectId: object.id,
        controllerPlayerId: controllerToPlayerId(object.controller || object.owner, localPlayerId),
        targets: object.targetIds || [],
      })),
      topObjectId: session.stack?.[0]?.id || "",
      order: (session.stack || []).map((object) => object.id),
    },
    triggerState: {
      triggers: [...(session.triggerQueue || []), ...(session.pendingEffects || [])].map((trigger) => createTrigger({
        ...trigger,
        triggerId: trigger.id,
        sourcePermanentId: trigger.sourceId || trigger.source?.id || "",
      })),
      order: [...(session.triggerQueue || []), ...(session.pendingEffects || [])].map((trigger) => trigger.id).filter(Boolean),
    },
    combatState: createCombatState(session.combat || {}),
    manaState: createManaState({
      poolsByPlayer: { [localPlayerId]: clonePlain(session.manaPool || {}) },
    }),
    continuousEffectState: { effects: [], revision: Number(session.derivedStateRevision || 0) },
    delayedEffectState: { effects: clonePlain(session.delayedEffects || []), revision: 0 },
    publicInformation: {
      life: session.life,
      turn: session.turn,
      phaseIndex: session.phaseIndex,
      battlefieldOrderByPlayer: battlefield.battlefieldOrderByPlayer,
    },
    privateInformationReferences: buildPrivateInformationReferences(session, localPlayerId),
    tournamentReference: profile.tournament?.active || profile.tournament?.joinCode
      ? createTournamentReference({
          tournamentId: profile.tournament.tournamentId || profile.tournament.id || profile.tournament.joinCode,
          participantId: localPlayerId,
          currentRoundNumber: profile.tournament.currentRoundNumber || 0,
          status: profile.tournament.status || "local",
          hostProfileId: profile.tournament.hostPlayerId || profile.tournament.hostName || "",
          syncSessionId: profile.tournament.sync?.sessionId || profile.tournament.joinCode || "",
          externalOwnerApp: "boardstate",
        })
      : null,
    deckSnapshotReferences: Object.entries(profile.commanders || {}).map(([deckKey, deck]) => createDeckSnapshot({
      deckSnapshotId: deck.deckSnapshotId || deckKey,
      sourceDeckId: deckKey,
      ownerProfileId: profile.id || localPlayerId,
      name: deck.name || deck.commanderName || deckKey,
      cards: deck.cards || [],
      commanderIds: deck.commanderName ? [deck.commanderName] : [],
    })),
    saveMetadata: {
      ...(session.saveMetadata || {}),
      sourceApp: "boardstate",
      profileId: profile.id || localPlayerId,
      activeInterfaceByPlayer: session.activeInterfaceByPlayer || Object.fromEntries(players.map((player) => [player.playerId, player.activeInterface])),
      localInterfaceMode: session.localInterfaceMode || session.interfaceMode || "boardstate-advanced",
    },
    sessionCapabilities: createSessionCapabilities(session.sessionCapabilities || {
      supportsAdvancedMode: true,
      supportsRulesEngine: true,
      supportsEnforcedRules: true,
      supportsWaiveRules: true,
      supportsStack: true,
      supportsPriority: true,
      supportsCombat: true,
      supportsFullBattlefield: true,
      supportsHandoffExport: true,
      supportsHandoffImport: true,
      supportsTournamentReference: true,
      supportsSaveRoundTrip: true,
    }),
    historyMetadata: {
      actionCount: (session.actionHistory || []).length,
      eventCount: (session.eventHistory || []).length,
    },
  });
}

export function sharedSessionToBoardStateRuntime(sharedSession = {}, fallbackRuntime = {}) {
  const session = createSharedGameSession(sharedSession);
  const localPlayer = session.players.find((player) => player.playerId === "local-player") || session.players[0] || {};
  return {
    ...clonePlain(fallbackRuntime || {}),
    id: session.gameId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    turn: session.turnState.turnNumber,
    phaseIndex: phaseIndexFromCanonical(session.turnState.currentPhase),
    life: Number(localPlayer.life ?? fallbackRuntime.life ?? 40),
    playerCounters: clonePlain(localPlayer.playerCounters || fallbackRuntime.playerCounters || {}),
    battlefield: canonicalBattlefieldToRuntime(session.battlefieldState, fallbackRuntime.battlefield || {}),
    zones: clonePlain(fallbackRuntime.zones || {}),
    stack: (session.stackState.objects || []).map((object) => ({
      id: object.stackObjectId,
      name: object.cardDefinitionReference?.name || "Stack Object",
      typeLine: object.cardDefinitionReference?.typeLine || "",
      controller: playerIdToController(object.controllerPlayerId),
      targetIds: (object.targets || []).map((target) => target.id || target),
      xValue: object.xValue || 0,
      copied: object.copied,
    })),
    priority: {
      activePlayerId: session.priorityState.priorityHolderId || "local-player",
      passedPlayerIds: session.priorityState.passedPlayerIds || [],
      responderIds: session.priorityState.passOrder || [],
      waiting: !session.priorityState.allPlayersPassed,
    },
    combat: {
      ...(fallbackRuntime.combat || {}),
      attackerIds: Array.isArray(session.combatState.attackers) ? session.combatState.attackers : [],
      blockersByAttacker: clonePlain(session.combatState.blockerAssignments || {}),
      attackTargetsByAttacker: clonePlain(session.combatState.attackTargets || {}),
    },
    manaPool: clonePlain(session.manaState.poolsByPlayer?.["local-player"] || fallbackRuntime.manaPool || {}),
    sourceApp: session.sourceApp || fallbackRuntime.sourceApp || "boardstate",
    schemaVersion: session.schemaVersion,
    rulesEngineVersion: session.rulesEngineVersion,
    syncProtocolVersion: session.syncProtocolVersion,
    enforcementMode: session.enforcementMode,
    activeRuleWaivers: clonePlain(session.activeRuleWaivers || []),
    activeInterfaceByPlayer: clonePlain(session.activeInterfaceByPlayer || {}),
    interfaceModeHistory: clonePlain(session.interfaceModeHistory || []),
    localInterfaceMode: session.localInterfaceMode || "boardstate-advanced",
    preferredInterfaceMode: session.preferredInterfaceMode || "boardstate-advanced",
    lastInterfaceSwitchAt: session.lastInterfaceSwitchAt || 0,
    lastInterfaceSwitchBy: session.lastInterfaceSwitchBy || "",
    interfaceSwitchRevision: session.interfaceSwitchRevision || 0,
    linkedSimpleSessionReference: clonePlain(session.linkedSimpleSessionReference || null),
    linkedAdvancedSessionReference: clonePlain(session.linkedAdvancedSessionReference || null),
    sessionCapabilities: clonePlain(session.sessionCapabilities || {}),
  };
}

export function legacySaveToCanonicalSaveEnvelope(save = {}, options = {}) {
  const activeSession = save.gameState?.activeSession || save.activeSession || {};
  const profile = {
    id: save.profileId || options.profileId || "local-player",
    player: { id: save.profileId || "local-player", name: save.profileName || "Player" },
    activeSession,
    settings: save.gameState?.settingsSnapshot || save.settingsSnapshot || {},
    onboarding: save.tutorialState?.onboarding || {},
    commanders: {},
    tournament: {},
  };
  return createCanonicalSaveEnvelope({
    saveId: save.saveId || options.saveId,
    saveName: save.saveName || "BoardState Save",
    profileId: profile.id,
    createdAt: save.createdAt,
    updatedAt: save.updatedAt,
    gameState: boardStateProfileToSharedSession(profile, options),
    privateStateReferences: {
      boardstateRuntimeState: clonePlain(activeSession),
      legacySaveVersion: save.saveVersion || 1,
    },
    tutorialState: clonePlain(save.tutorialState || {}),
    appPresentationState: clonePlain(save.settingsSnapshot || {}),
    metadata: {
      ...(save.metadata || {}),
      legacySaveId: save.saveId || "",
      sourceGameMode: save.gameMode || "",
    },
  });
}

export function canonicalSaveEnvelopeToLegacySave(envelope = {}, options = {}) {
  const canonical = createCanonicalSaveEnvelope(envelope);
  const runtimeState = canonical.privateStateReferences?.boardstateRuntimeState ||
    sharedSessionToBoardStateRuntime(canonical.gameState, options.fallbackRuntime || {});
  return {
    saveId: canonical.saveId,
    saveName: canonical.saveName,
    saveVersion: Number(options.saveVersion || 1),
    schemaVersion: canonical.schemaVersion,
    rulesEngineVersion: canonical.rulesEngineVersion,
    saveFormatVersion: canonical.saveFormatVersion,
    profileId: canonical.profileId,
    profileName: options.profileName || "Player",
    createdAt: canonical.createdAt,
    updatedAt: canonical.updatedAt,
    gameMode: canonical.metadata?.sourceGameMode || "normal",
    gameState: {
      activeSession: clonePlain(runtimeState),
      turn: runtimeState.turn,
      activePlayer: runtimeState.priority?.activePlayerId || "local-player",
      phaseIndex: runtimeState.phaseIndex,
      life: runtimeState.life,
      battlefield: clonePlain(runtimeState.battlefield || {}),
      zones: clonePlain(runtimeState.zones || {}),
      stack: clonePlain(runtimeState.stack || []),
      triggerQueue: clonePlain(runtimeState.triggerQueue || []),
      pendingEffects: clonePlain(runtimeState.pendingEffects || []),
      commander: clonePlain(runtimeState.commander || {}),
      simulation: clonePlain(runtimeState.simulation || {}),
      settingsSnapshot: clonePlain(canonical.appPresentationState || {}),
    },
    tutorialState: clonePlain(canonical.tutorialState || {}),
    settingsSnapshot: clonePlain(canonical.appPresentationState || {}),
    metadata: {
      ...(canonical.metadata || {}),
      checksum: canonical.checksum,
    },
  };
}

export function legacySyncMessageToCanonicalSyncMessage(message = {}, options = {}) {
  const namespace = message.namespace ||
    (message.type === "tournament-action" ? "tournament" : message.type === "friend-message" || message.type === "friend-presence" ? "friend" : "gameplay");
  return createCanonicalSyncMessage({
    namespace,
    messageType: message.messageType || message.type || "message",
    sessionId: message.sessionId || message.roomId || options.sessionId || "",
    gameId: message.gameId || options.gameId || "",
    senderPlayerId: message.senderPlayerId || message.peerId || "",
    senderAppInstanceId: message.senderAppInstanceId || message.peerId || "",
    expectedRevision: message.expectedRevision || 0,
    payload: {
      action: clonePlain(message.action || null),
      publicState: clonePlain(message.publicState || null),
      publicProfile: clonePlain(message.publicProfile || null),
      activeInterfaceByPlayer: clonePlain(message.activeInterfaceByPlayer || message.payload?.activeInterfaceByPlayer || {}),
      interfaceModeChanged: clonePlain(message.interfaceModeChanged || message.payload?.interfaceModeChanged || null),
      sourceApp: message.sourceApp || message.payload?.sourceApp || "",
      capabilities: clonePlain(message.capabilities || message.sessionCapabilities || message.payload?.capabilities || {}),
      sessionRevision: message.sessionRevision || message.revision || message.payload?.sessionRevision || 0,
      enforcementMode: message.enforcementMode || message.payload?.enforcementMode || "",
      rulesEngineVersion: message.rulesEngineVersion || message.payload?.rulesEngineVersion || "",
      schemaVersion: message.schemaVersion || message.payload?.schemaVersion || "",
      rawPayload: clonePlain(message.payload || null),
    },
    createdAt: message.createdAt || message.updatedAt || Date.now(),
  });
}

export function canonicalSyncMessageToLegacyPayload(message = {}, options = {}) {
  const canonical = createCanonicalSyncMessage(message);
  return {
    type: options.type || legacyTypeForNamespace(canonical.namespace),
    namespace: canonical.namespace,
    messageType: canonical.messageType,
    roomId: options.roomId || canonical.sessionId,
    sessionId: canonical.sessionId,
    peerId: canonical.senderAppInstanceId,
    action: clonePlain(canonical.payload?.action || null),
    publicState: clonePlain(canonical.payload?.publicState || null),
    publicProfile: clonePlain(canonical.payload?.publicProfile || null),
    activeInterfaceByPlayer: clonePlain(canonical.payload?.activeInterfaceByPlayer || {}),
    interfaceModeChanged: clonePlain(canonical.payload?.interfaceModeChanged || null),
    sourceApp: canonical.payload?.sourceApp || "",
    capabilities: clonePlain(canonical.payload?.capabilities || {}),
    sessionRevision: canonical.payload?.sessionRevision || canonical.expectedRevision || 0,
    enforcementMode: canonical.payload?.enforcementMode || "",
    rulesEngineVersion: canonical.payload?.rulesEngineVersion || "",
    schemaVersion: canonical.payload?.schemaVersion || "",
    updatedAt: canonical.createdAt,
  };
}

export function canonicalActionFromEngineAction(action = {}, context = {}) {
  return createCanonicalAction({
    actionId: action.actionId || action.id,
    actionType: action.actionType || action.type,
    gameId: context.gameId || context.state?.id || "",
    sessionId: context.sessionId || context.state?.id || "",
    playerId: action.playerId || context.actingPlayerId || "local-player",
    expectedRevision: context.expectedRevision || 0,
    payload: clonePlain(action.payload || action),
    clientMetadata: {
      sourceApp: "boardstate",
      rulesEngineVersion: context.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
    },
  });
}

export function canonicalEventFromEngineEvent(event = {}, context = {}) {
  return createCanonicalEvent({
    eventId: event.eventId || event.id,
    eventType: event.eventType || event.type,
    gameId: context.gameId || context.state?.id || "",
    sessionId: context.sessionId || context.state?.id || "",
    revision: context.revision || 0,
    causedByActionId: event.causedByActionId || context.actionId || "",
    controllerPlayerId: event.controllerPlayerId || event.playerId || "local-player",
    payload: clonePlain(event.payload || event),
    visibility: event.visibility || "public",
    rulesEngineVersion: context.rulesEngineVersion || DEFAULT_RULES_ENGINE_VERSION,
  });
}

function buildPlayers(profile = {}, options = {}) {
  const session = profile.activeSession || {};
  const localPlayerId = profile.player?.id || "local-player";
  const connectedPlayers = profile.settings?.multiplayer?.connectedPlayers || session.syncedMultiplayer?.players || [];
  const players = [
    createCanonicalPlayer({
      playerId: localPlayerId,
      profileId: profile.id || localPlayerId,
      displayName: profile.player?.name || "Player",
      seatIndex: 0,
      controllerType: "human",
      connectionStatus: "local",
      activeInterface: "boardstate-advanced",
      life: session.life || 40,
      startingLife: options.startingLife || 40,
      commanderDamage: session.commander?.damageByOpponent || {},
      poisonCounters: Number(session.playerCounters?.poison || session.playerCounters?.POISON || 0),
      playerCounters: session.playerCounters || {},
      commanderCardInstanceIds: session.commander?.name ? [session.commander.name] : [],
      publicMetadata: { role: "local" },
    }),
  ];
  connectedPlayers.forEach((player, index) => {
    if (player.id === localPlayerId) return;
    players.push(createCanonicalPlayer({
      playerId: player.id || createContractId("playerId", player.name),
      displayName: player.name || `Player ${index + 2}`,
      seatIndex: index + 1,
      controllerType: player.role === "ai" ? "ai" : "remote",
      connectionStatus: "online",
      activeInterface: "unknown",
      startingLife: options.startingLife || 40,
      life: player.life || options.startingLife || 40,
      publicMetadata: { role: player.role || "player" },
    }));
  });
  Object.values(session.simulation?.opponents || {}).forEach((opponent, index) => {
    players.push(createCanonicalPlayer({
      playerId: opponent.id || opponent.name || `ai-${index + 1}`,
      displayName: opponent.name || `AI ${index + 1}`,
      seatIndex: players.length,
      controllerType: "ai",
      connectionStatus: "local",
      activeInterface: "boardstate-advanced",
      life: opponent.life || 40,
      startingLife: 40,
    }));
  });
  return players;
}

function buildBattlefieldState(session = {}) {
  const permanentsById = {};
  const battlefieldOrderByPlayer = {};
  const creaturePermanentIds = [];
  const landPermanentIds = [];
  const nonCreaturePermanentIds = [];
  const attackingPermanentIds = [];
  Object.entries(session.battlefield || {}).forEach(([side, permanents]) => {
    if (!Array.isArray(permanents)) return;
    const playerId = side === "player" ? "local-player" : side;
    battlefieldOrderByPlayer[playerId] = [];
    permanents.forEach((permanent) => {
      const canonical = createPermanentState({
        ...permanent,
        permanentId: permanent.id,
        cardInstanceId: permanent.cardInstanceId || permanent.id,
        controllerPlayerId: controllerToPlayerId(permanent.controller || side, "local-player"),
        ownerPlayerId: controllerToPlayerId(permanent.owner || permanent.controller || side, "local-player"),
      });
      permanentsById[canonical.permanentId] = canonical;
      battlefieldOrderByPlayer[playerId].push(canonical.permanentId);
      if (permanent.isCreature) creaturePermanentIds.push(canonical.permanentId);
      else if (permanent.isLand) landPermanentIds.push(canonical.permanentId);
      else nonCreaturePermanentIds.push(canonical.permanentId);
      if (permanent.attacking) attackingPermanentIds.push(canonical.permanentId);
    });
  });
  return {
    permanentsById,
    battlefieldOrderByPlayer,
    creaturePermanentIds,
    landPermanentIds,
    nonCreaturePermanentIds,
    attackingPermanentIds,
    blockingAssignments: clonePlain(session.combat?.blockersByAttacker || {}),
    selectedTargets: session.selectedIds || [],
    derivedStateRevision: Number(session.derivedStateRevision || 0),
    continuousEffectRevision: Number(session.continuousEffectRevision || 0),
  };
}

function buildZoneState(session = {}, players = []) {
  const zonesByPlayer = {};
  const localPlayerId = players[0]?.playerId || "local-player";
  const zones = session.zones || {};
  zonesByPlayer[localPlayerId] = {
    library: privateZone("library", zones.library),
    hand: privateZone("hand", zones.hand),
    graveyard: publicZone("graveyard", zones.graveyard),
    exile: publicZone("exile", zones.exile),
    command: publicZone("command", zones.command),
  };
  return {
    zonesByPlayer,
    sharedZones: {
      stack: publicZone("stack", session.stack),
      battlefield: publicZone("battlefield", []),
    },
    visibility: {
      hand: "private",
      library: "private",
      battlefield: "public",
      graveyard: "public",
      exile: "public",
      command: "public",
    },
  };
}

function buildPrivateInformationReferences(session = {}, localPlayerId = "local-player") {
  return {
    [localPlayerId]: {
      handCount: (session.zones?.hand || []).length,
      libraryCount: (session.zones?.library || []).length,
      handReference: `${session.id || "game"}:${localPlayerId}:hand`,
      libraryReference: `${session.id || "game"}:${localPlayerId}:library`,
    },
  };
}

function canonicalBattlefieldToRuntime(battlefieldState = {}, fallbackBattlefield = {}) {
  const byId = battlefieldState.permanentsById || {};
  const sides = {};
  Object.entries(battlefieldState.battlefieldOrderByPlayer || {}).forEach(([playerId, ids]) => {
    const side = playerId === "local-player" ? "player" : playerId;
    sides[side] = (ids || []).map((id) => permanentToRuntime(byId[id])).filter(Boolean);
  });
  return {
    ...clonePlain(fallbackBattlefield),
    ...sides,
  };
}

function permanentToRuntime(permanent = null) {
  if (!permanent) return null;
  const card = permanent.baseCharacteristics || {};
  return {
    id: permanent.permanentId,
    cardInstanceId: permanent.cardInstanceId,
    name: card.name || "Permanent",
    typeLine: permanent.derivedCharacteristics?.typeLine || card.typeLine || "",
    oracleText: card.oracleText || "",
    manaCost: card.manaCost || "",
    controller: playerIdToController(permanent.controllerPlayerId),
    owner: playerIdToController(permanent.ownerPlayerId),
    tapped: permanent.tapped,
    attacking: permanent.attacking,
    blocking: permanent.blocking,
    summoningSick: permanent.summoningSick,
    counters: clonePlain(permanent.counters || {}),
    markedDamage: permanent.damageMarked,
    currentPower: permanent.derivedCharacteristics?.power,
    currentToughness: permanent.derivedCharacteristics?.toughness,
    quantity: permanent.tokenStack?.quantity || 1,
    isToken: Boolean(permanent.tokenStack?.token),
  };
}

function privateZone(zoneName, contents = []) {
  return {
    zoneName,
    visibility: "private",
    count: Array.isArray(contents) ? contents.length : Number(contents || 0),
    cardInstanceIds: [],
    privateInformationReference: zoneName,
  };
}

function publicZone(zoneName, contents = []) {
  return {
    zoneName,
    visibility: "public",
    count: Array.isArray(contents) ? contents.length : Number(contents || 0),
    cardInstanceIds: Array.isArray(contents) ? contents.map((card) => card.id || card.cardInstanceId || String(card)).filter(Boolean) : [],
  };
}

function controllerToPlayerId(controller = "", localPlayerId = "local-player") {
  if (!controller || controller === "player") return localPlayerId;
  if (controller === "opponent") return "opponent";
  return normalizeContractId(controller, "playerId");
}

function playerIdToController(playerId = "") {
  return playerId === "local-player" ? "player" : playerId || "opponent";
}

function phaseIndexFromCanonical(phase = "") {
  return { beginning: 0, "main-1": 1, combat: 2, "main-2": 3, ending: 4 }[phase] ?? 0;
}

function legacyTypeForNamespace(namespace = "") {
  if (namespace === "tournament") return "tournament-action";
  if (namespace === "friend" || namespace === "discovery") return "friend-message";
  return "action";
}
