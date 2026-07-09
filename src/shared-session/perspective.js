import {
  boardStateProfileToSharedSession,
  createSharedGameSession,
  clonePlain,
  validateSharedGameSession,
} from "../shared-contracts/index.js";

export const ADVANCED_MULTIPLAYER_VIEW_MODES = Object.freeze([
  "solo-advanced",
  "two-player-mirrored",
  "commander-pod-advanced",
  "mixed-interface-session",
  "imported-session-view",
  "recovery-view",
]);

export const ADVANCED_SYNC_EVENT_TYPES = Object.freeze([
  "INTERFACE_MODE_CHANGED",
  "GAME_STATE_UPDATED",
  "ACTION_SUBMITTED",
  "ACTION_ACCEPTED",
  "ACTION_REJECTED",
  "PRIORITY_CHANGED",
  "PLAYER_PASSED_PRIORITY",
  "STACK_OBJECT_ADDED",
  "STACK_OBJECT_RESOLVED",
  "SPELL_CAST",
  "PERMANENT_ENTERED",
  "TARGETS_SELECTED",
  "ATTACKERS_DECLARED",
  "BLOCKERS_DECLARED",
  "COMBAT_DAMAGE_DEALT",
  "RULE_VIOLATION",
  "RULE_WARNING",
  "RULE_WAIVED",
  "MANUAL_CHOICE_REQUIRED",
  "SESSION_RECOVERY_REQUIRED",
]);

export function createAdvancedMultiplayerState(input = {}) {
  return {
    viewMode: ADVANCED_MULTIPLAYER_VIEW_MODES.includes(input.viewMode) ? input.viewMode : "solo-advanced",
    localPerspectivePlayerId: normalizePlayerId(input.localPerspectivePlayerId || "local-player"),
    focusedOpponentId: normalizePlayerId(input.focusedOpponentId || ""),
    compactOpponentPanelOpen: Boolean(input.compactOpponentPanelOpen),
    lastPerspectiveUpdatedAt: Number(input.lastPerspectiveUpdatedAt || 0),
    participantStatus: clonePlain(input.participantStatus || {}),
    syncStatus: clonePlain(input.syncStatus || {}),
    seenSyncEventIds: Array.isArray(input.seenSyncEventIds) ? [...new Set(input.seenSyncEventIds)].slice(-250) : [],
    lastAppliedRevision: Math.max(0, Number(input.lastAppliedRevision || 0)),
    lastSyncEventId: String(input.lastSyncEventId || ""),
    recoveryRequired: Boolean(input.recoveryRequired),
    recoveryReason: String(input.recoveryReason || ""),
    presentationEvents: Array.isArray(input.presentationEvents) ? clonePlain(input.presentationEvents).slice(-40) : [],
  };
}

export function buildAdvancedMultiplayerPerspective(profileOrSession = {}, options = {}) {
  const profile = profileOrSession.activeSession ? profileOrSession : null;
  const runtimeSession = profile?.activeSession || profileOrSession || {};
  const canonicalSession = options.canonicalSession || safeCanonicalSession(profileOrSession);
  const validation = validateSharedGameSession(canonicalSession);
  const advancedState = createAdvancedMultiplayerState(runtimeSession.advancedMultiplayer || {});
  const localPlayerId = normalizePlayerId(
    options.localPlayerId ||
      advancedState.localPerspectivePlayerId ||
      profile?.player?.id ||
      canonicalSession.hostPlayerId ||
      "local-player"
  );
  const participants = buildParticipantStatus(profile, runtimeSession, canonicalSession, localPlayerId);
  const participantIds = participants.map((participant) => participant.playerId);
  const activeInterfaceByPlayer = {
    ...(canonicalSession.activeInterfaceByPlayer || {}),
    ...(runtimeSession.activeInterfaceByPlayer || {}),
  };
  participants.forEach((participant) => {
    activeInterfaceByPlayer[participant.playerId] = normalizeInterface(
      activeInterfaceByPlayer[participant.playerId] || participant.interfaceMode || participant.activeInterface
    );
  });
  const playerCount = Math.max(participants.length, participantIds.length);
  const liveAdvancedCount = participants.filter((participant) => participant.interfaceMode === "boardstate-advanced").length;
  const imported = Boolean(
    runtimeSession.linkedSession?.imported ||
      (runtimeSession.sourceApp && runtimeSession.sourceApp !== "boardstate") ||
      (canonicalSession.sourceApp && canonicalSession.sourceApp !== "boardstate")
  );
  const mixed = participants.some((participant) => participant.interfaceMode !== "boardstate-advanced");
  const viewMode = determineAdvancedViewMode({
    playerCount,
    liveAdvancedCount,
    mixed,
    imported,
    validation,
    runtimeSession,
    canonicalSession,
  });
  const boardByPlayer = buildPublicBoardsByPlayer(profile, runtimeSession, canonicalSession, participants, localPlayerId);
  const localBoard = boardByPlayer.get(localPlayerId) || createPublicBoard(localPlayerId, "Player", [], {});
  const opponentBoards = participants
    .filter((participant) => participant.playerId !== localPlayerId)
    .map((participant) => boardByPlayer.get(participant.playerId) || createPublicBoard(participant.playerId, participant.displayName, [], participant))
    .map((board) => ({
      ...board,
      compact: viewMode === "commander-pod-advanced" || viewMode === "mixed-interface-session",
      detailsLimited: isDetailsLimited(board, canonicalSession),
    }));
  const focusedOpponentId = resolveFocusedOpponentId({
    requested: options.focusedOpponentId || advancedState.focusedOpponentId,
    opponentBoards,
    runtimeSession,
    canonicalSession,
    localPlayerId,
  });
  const focusedOpponent = opponentBoards.find((board) => board.id === focusedOpponentId) || opponentBoards[0] || null;
  const promptOwnership = buildPromptOwnership(runtimeSession, canonicalSession, participants, localPlayerId);
  const stackContext = buildStackContext(runtimeSession, canonicalSession, participants, promptOwnership);
  const combatContext = buildCombatContext(runtimeSession, canonicalSession, localPlayerId, focusedOpponentId);
  const participantStatus = participants.map((participant) => ({
    ...participant,
    priorityStatus: promptOwnership.priority.ownerPlayerId === participant.playerId ? "has-priority" : promptOwnership.priority.passedPlayerIds.includes(participant.playerId) ? "passed" : "waiting",
    activeTurn: participant.playerId === promptOwnership.activePlayerId,
    waitingForChoice: promptOwnership.pendingChoices.some((choice) => choice.ownerPlayerId === participant.playerId && choice.status === "pending"),
  }));
  return {
    viewMode,
    validationStatus: validation.status,
    localPlayerId,
    localPlayer: participantStatus.find((participant) => participant.playerId === localPlayerId) || participantStatus[0] || null,
    playerCount,
    liveAdvancedCount,
    activeInterfaceByPlayer,
    boardOrder: [localPlayerId, ...opponentBoards.map((board) => board.id)],
    localBoard,
    opponentBoards,
    secondaryOpponents: opponentBoards,
    primaryOpponentBoard: focusedOpponent,
    focusedOpponent,
    focusedOpponentId: focusedOpponent?.id || "",
    fullOpponentBoard: viewMode === "two-player-mirrored" || Boolean(focusedOpponent),
    compactOpponentLanes: viewMode === "commander-pod-advanced" || viewMode === "mixed-interface-session",
    participants: participantStatus,
    promptOwnership,
    priority: promptOwnership.priority,
    stackContext,
    combatContext,
    selectedTargetIds: [...new Set([...(runtimeSession.selectedIds || []), ...(canonicalSession.battlefieldState?.selectedTargets || [])])],
    hiddenIndicators: buildHiddenIndicators(canonicalSession, opponentBoards),
    publicInformation: buildPublicInformation(canonicalSession, runtimeSession),
    availableLocalActions: buildAvailableLocalActions(promptOwnership, viewMode),
    presentation: buildSharedCardPreviewModel(runtimeSession),
    recovery: {
      required: viewMode === "recovery-view" || advancedState.recoveryRequired,
      reason: advancedState.recoveryReason || validation.errors?.[0] || "",
    },
  };
}

export function buildAdvancedTargetingVisualModel(profileOrSession = {}, perspective = null, options = {}) {
  const profile = profileOrSession.activeSession ? profileOrSession : null;
  const session = profile?.activeSession || profileOrSession || {};
  const view = perspective || buildAdvancedMultiplayerPerspective(profileOrSession, options);
  const validIds = new Set((options.legalTargets?.validTargets || options.validTargets || []).map((target) => target.id || target.permanentId || target));
  const invalidById = new Map((options.legalTargets?.invalidTargets || []).map((target) => [target.id || target.permanentId || "", target.reason || "invalid target"]));
  const selectedIds = new Set(session.selectedIds || []);
  const sourceIds = new Set([options.sourcePermanentId || options.sourceId || session.stack?.[0]?.sourcePermanentId || ""].filter(Boolean));
  const candidates = [view.localBoard, ...(view.opponentBoards || [])].flatMap((board) =>
    (board?.permanents || []).map((permanent) => {
      const targetable = validIds.size ? validIds.has(permanent.id) : !invalidById.has(permanent.id);
      return {
        id: permanent.id,
        playerId: board.playerId || board.id,
        boardRole: (board.playerId || board.id) === view.localPlayerId ? "local" : "opponent",
        name: permanent.name,
        valid: targetable,
        selected: selectedIds.has(permanent.id),
        source: sourceIds.has(permanent.id),
        reason: targetable ? "" : invalidById.get(permanent.id) || "not a legal target",
      };
    })
  );
  const byPermanentId = Object.fromEntries(candidates.map((candidate) => [candidate.id, candidate]));
  const focusedOpponentId = candidates.find((candidate) => candidate.valid && candidate.boardRole === "opponent")?.playerId || view.focusedOpponentId;
  return {
    sourceIds: [...sourceIds],
    candidates,
    byPermanentId,
    validTargetIds: candidates.filter((candidate) => candidate.valid).map((candidate) => candidate.id),
    invalidTargetIds: candidates.filter((candidate) => !candidate.valid).map((candidate) => candidate.id),
    selectedTargetIds: [...selectedIds],
    focusedOpponentId,
    usesEngineLegalTargets: Boolean(options.legalTargets),
  };
}

export function applyAdvancedSyncEvent(session = {}, event = {}) {
  const type = String(event.eventType || event.messageType || event.type || event.payload?.eventType || "").toUpperCase();
  const namespace = event.namespace || event.payload?.namespace || "gameplay";
  const state = createAdvancedMultiplayerState(session.advancedMultiplayer || {});
  const eventId = String(event.eventId || event.actionId || event.messageId || event.payload?.eventId || `${type}:${event.revision || event.sessionRevision || Date.now()}`);
  const revision = Math.max(0, Number(event.revision || event.sessionRevision || event.payload?.revision || event.payload?.sessionRevision || 0));
  if (namespace !== "gameplay") {
    return { session, applied: false, status: "rejected", reason: "advanced gameplay sync only accepts gameplay namespace events" };
  }
  if (!ADVANCED_SYNC_EVENT_TYPES.includes(type)) {
    return { session, applied: false, status: "ignored", reason: "unsupported advanced sync event" };
  }
  if (state.seenSyncEventIds.includes(eventId)) {
    return { session, applied: false, status: "duplicate", reason: "duplicate sync event ignored" };
  }
  if (revision && state.lastAppliedRevision && revision < state.lastAppliedRevision) {
    return {
      session: {
        ...session,
        advancedMultiplayer: {
          ...state,
          recoveryRequired: true,
          recoveryReason: "stale sync event revision",
        },
      },
      applied: false,
      status: "stale",
      reason: "stale sync event revision",
    };
  }
  const payload = event.payload || event;
  let nextSession = clonePlain(session);
  if (type === "INTERFACE_MODE_CHANGED" && payload.playerId) {
    nextSession.activeInterfaceByPlayer = {
      ...(nextSession.activeInterfaceByPlayer || {}),
      [payload.playerId]: normalizeInterface(payload.nextInterface || payload.interfaceMode),
    };
    nextSession.interfaceModeHistory = [...(nextSession.interfaceModeHistory || []), clonePlain(payload)].slice(-80);
  }
  if (type === "PRIORITY_CHANGED" && payload.priorityHolderId) {
    nextSession.priority = {
      ...(nextSession.priority || {}),
      activePlayerId: payload.priorityHolderId,
      passedPlayerIds: payload.passedPlayerIds || nextSession.priority?.passedPlayerIds || [],
      waiting: payload.waiting !== false,
    };
  }
  if (type === "TARGETS_SELECTED" && Array.isArray(payload.targetIds)) {
    nextSession.selectedIds = [...payload.targetIds];
  }
  if ((type === "SPELL_CAST" || type === "STACK_OBJECT_ADDED") && payload.card) {
    nextSession.presentation = {
      id: payload.eventId || eventId,
      kind: "cast",
      controller: payload.controllerPlayerId || payload.playerId || "",
      card: clonePlain(payload.card),
      createdAt: Date.now(),
      expiresAt: Date.now() + 2200,
      presentationOnly: true,
      synced: true,
    };
  }
  const nextState = {
    ...state,
    seenSyncEventIds: [...state.seenSyncEventIds, eventId].slice(-250),
    lastSyncEventId: eventId,
    lastAppliedRevision: Math.max(state.lastAppliedRevision, revision || state.lastAppliedRevision),
    recoveryRequired: type === "SESSION_RECOVERY_REQUIRED" ? true : state.recoveryRequired,
    recoveryReason: type === "SESSION_RECOVERY_REQUIRED" ? payload.reason || "session recovery required" : state.recoveryReason,
    presentationEvents: (type === "SPELL_CAST" || type === "STACK_OBJECT_ADDED")
      ? [
          ...state.presentationEvents,
          {
            eventId,
            eventType: type,
            cardName: payload.card?.name || payload.name || "",
            controllerPlayerId: payload.controllerPlayerId || payload.playerId || "",
            revision,
            presentationOnly: true,
          },
        ].slice(-40)
      : state.presentationEvents,
  };
  return {
    session: {
      ...nextSession,
      revision: Math.max(Number(nextSession.revision || 0), revision),
      advancedMultiplayer: nextState,
    },
    applied: true,
    status: "applied",
    reason: "",
  };
}

export function buildSharedCardPreviewModel(session = {}) {
  const presentation = session.presentation || null;
  if (!presentation) {
    return null;
  }
  return {
    id: presentation.id || "",
    kind: presentation.kind || "state-preview",
    sourcePlayerId: controllerToPlayerId(presentation.controller || presentation.controllerPlayerId || "local-player"),
    controllerLabel: presentation.controller || presentation.controllerPlayerId || "Player",
    card: clonePlain(presentation.card || {}),
    expiresAt: Number(presentation.expiresAt || 0),
    presentationOnly: true,
    synced: Boolean(presentation.synced || session.syncedMultiplayer?.active),
  };
}

function safeCanonicalSession(profileOrSession = {}) {
  try {
    if (profileOrSession.activeSession) {
      return boardStateProfileToSharedSession(profileOrSession);
    }
    return createSharedGameSession(profileOrSession);
  } catch {
    return createSharedGameSession({ status: "recovery-required" });
  }
}

function determineAdvancedViewMode({ playerCount, liveAdvancedCount, mixed, imported, validation, runtimeSession, canonicalSession }) {
  if (!validation.valid || runtimeSession.advancedMultiplayer?.recoveryRequired || canonicalSession.status === "recovery-required") {
    return "recovery-view";
  }
  if (imported && !runtimeSession.syncedMultiplayer?.active) {
    return "imported-session-view";
  }
  if (playerCount >= 3) {
    return mixed ? "mixed-interface-session" : "commander-pod-advanced";
  }
  if (playerCount === 2 && liveAdvancedCount === 2) {
    return "two-player-mirrored";
  }
  if (playerCount >= 2 && mixed) {
    return "mixed-interface-session";
  }
  return "solo-advanced";
}

function buildParticipantStatus(profile, runtimeSession, canonicalSession, localPlayerId) {
  const byId = new Map();
  const addParticipant = (entry = {}) => {
    const playerId = normalizePlayerId(entry.playerId || entry.id || entry.profileId || "");
    if (!playerId) return;
    const interfaceMode = normalizeInterface(
      canonicalSession.activeInterfaceByPlayer?.[playerId] ||
        runtimeSession.activeInterfaceByPlayer?.[playerId] ||
        entry.activeInterface ||
        entry.interfaceMode ||
        (playerId === localPlayerId ? "boardstate-advanced" : "unknown")
    );
    byId.set(playerId, {
      playerId,
      displayName: entry.displayName || entry.name || (playerId === localPlayerId ? profile?.player?.name || "Player" : playerId),
      controllerType: entry.controllerType || (entry.role === "ai" ? "ai" : "human"),
      connectionStatus: entry.connectionStatus || (playerId === localPlayerId ? "local" : entry.status || "unknown"),
      interfaceMode,
      life: Number(entry.life ?? 40),
      commanderDamage: clonePlain(entry.commanderDamage || entry.commanderDamageFrom || {}),
      poisonCounters: Number(entry.poisonCounters || entry.playerCounters?.poison || 0),
      playerCounters: clonePlain(entry.playerCounters || {}),
      passedPriority: false,
      publicMetadata: clonePlain(entry.publicMetadata || {}),
    });
  };
  (canonicalSession.players || []).forEach(addParticipant);
  (profile?.settings?.multiplayer?.connectedPlayers || []).forEach((player) =>
    addParticipant({
      ...player,
      playerId: player.id,
      activeInterface: player.activeInterface || runtimeSession.activeInterfaceByPlayer?.[player.id] || "unknown",
      connectionStatus: player.connectionStatus || "online",
    })
  );
  Object.values(runtimeSession.simulation?.opponents || {}).forEach((npc) =>
    addParticipant({
      ...npc,
      playerId: npc.id,
      controllerType: "ai",
      activeInterface: runtimeSession.activeInterfaceByPlayer?.[npc.id] || "boardstate-advanced",
      connectionStatus: "local",
    })
  );
  addParticipant({
    playerId: localPlayerId,
    displayName: profile?.player?.name || "Player",
    controllerType: "human",
    activeInterface: "boardstate-advanced",
    connectionStatus: "local",
    life: runtimeSession.life ?? 40,
    playerCounters: runtimeSession.playerCounters || {},
  });
  const passed = new Set(runtimeSession.priority?.passedPlayerIds || canonicalSession.priorityState?.passedPlayerIds || []);
  return [...byId.values()].map((participant, index) => ({
    ...participant,
    seatIndex: Number(participant.seatIndex ?? index),
    passedPriority: passed.has(participant.playerId),
  })).sort((left, right) => Number(left.seatIndex || 0) - Number(right.seatIndex || 0));
}

function buildPublicBoardsByPlayer(profile, runtimeSession, canonicalSession, participants, localPlayerId) {
  const boards = new Map();
  participants.forEach((participant) => boards.set(participant.playerId, createPublicBoard(participant.playerId, participant.displayName, [], participant)));
  if (runtimeSession.battlefield?.player) {
    boards.set(localPlayerId, createPublicBoard(localPlayerId, profile?.player?.name || "Player", runtimeSession.battlefield.player, boards.get(localPlayerId)));
  }
  (runtimeSession.battlefield?.opponent || []).forEach((permanent) => {
    const ownerId = controllerToPlayerId(permanent.controller || "opponent");
    const board = boards.get(ownerId) || createPublicBoard(ownerId, ownerId, [], {});
    board.permanents.push(sanitizePublicPermanent(permanent));
    boards.set(ownerId, updateBoardCounts(board));
  });
  Object.entries(canonicalSession.battlefieldState?.battlefieldOrderByPlayer || {}).forEach(([playerId, ids]) => {
    const existing = boards.get(playerId) || createPublicBoard(playerId, playerId, [], {});
    if (existing.permanents.length) return;
    const permanents = (ids || [])
      .map((id) => canonicalSession.battlefieldState?.permanentsById?.[id])
      .filter(Boolean)
      .map(canonicalPermanentToPublicPermanent);
    boards.set(playerId, createPublicBoard(playerId, existing.name || playerId, permanents, existing));
  });
  (profile?.settings?.multiplayer?.connectedPlayers || []).forEach((peer) => {
    if (!peer.id || peer.id === localPlayerId) return;
    const board = boards.get(peer.id) || createPublicBoard(peer.id, peer.name || peer.id, [], peer);
    const snapshot = normalizePeerSnapshotEntries(peer.publicBoardSnapshot);
    if (!board.permanents.length && snapshot.length) {
      board.permanents = snapshot.map(sanitizePublicPermanent);
    }
    board.life = Number(peer.life ?? board.life ?? 40);
    board.interfaceMode = normalizeInterface(peer.activeInterface || runtimeSession.activeInterfaceByPlayer?.[peer.id] || board.interfaceMode);
    boards.set(peer.id, updateBoardCounts(board));
  });
  return boards;
}

function createPublicBoard(id, name, permanents = [], metadata = {}) {
  const playerId = normalizePlayerId(id);
  return updateBoardCounts({
    id: playerId,
    playerId,
    name: name || id || "Player",
    deckName: metadata.deckName || metadata.publicMetadata?.deckName || "",
    interfaceMode: normalizeInterface(metadata.interfaceMode || metadata.activeInterface || "unknown"),
    controllerType: metadata.controllerType || "human",
    connectionStatus: metadata.connectionStatus || "unknown",
    life: Number(metadata.life ?? 40),
    commanderDamage: clonePlain(metadata.commanderDamage || {}),
    poisonCounters: Number(metadata.poisonCounters || 0),
    alerts: [],
    permanents: (permanents || []).map(sanitizePublicPermanent),
  });
}

function updateBoardCounts(board) {
  const permanents = board.permanents || [];
  return {
    ...board,
    creatureCount: permanents.filter((permanent) => permanent.isCreature).reduce((sum, permanent) => sum + Number(permanent.quantity || 1), 0),
    landCount: permanents.filter((permanent) => permanent.isLand).reduce((sum, permanent) => sum + Number(permanent.quantity || 1), 0),
    nonCreaturePermanentCount: permanents.filter((permanent) => !permanent.isLand && !permanent.isCreature).reduce((sum, permanent) => sum + Number(permanent.quantity || 1), 0),
  };
}

function sanitizePublicPermanent(permanent = {}) {
  return {
    id: String(permanent.id || permanent.permanentId || ""),
    name: String(permanent.name || permanent.baseCharacteristics?.name || "Permanent"),
    typeLine: String(permanent.typeLine || permanent.baseCharacteristics?.typeLine || ""),
    manaCost: String(permanent.manaCost || permanent.baseCharacteristics?.manaCost || ""),
    oracleText: String(permanent.oracleText || permanent.rulesText || permanent.baseCharacteristics?.oracleText || ""),
    tapped: Boolean(permanent.tapped),
    attacking: Boolean(permanent.attacking),
    blocking: Boolean(permanent.blocking),
    quantity: Math.max(1, Number(permanent.quantity || permanent.tokenStack?.quantity || 1)),
    counters: clonePlain(permanent.counters || {}),
    currentPower: permanent.currentPower ?? permanent.derivedCharacteristics?.power ?? permanent.power ?? "",
    currentToughness: permanent.currentToughness ?? permanent.derivedCharacteristics?.toughness ?? permanent.toughness ?? "",
    damageMarked: Number(permanent.damageMarked || permanent.markedDamage || 0),
    loyalty: Number(permanent.loyalty || permanent.counters?.Loyalty || 0),
    defense: Number(permanent.defense || 0),
    attachments: clonePlain(permanent.attachments || []),
    attachedToId: String(permanent.attachedToId || permanent.attachedTo || ""),
    controller: playerIdToController(permanent.controllerPlayerId || permanent.controller || ""),
    owner: playerIdToController(permanent.ownerPlayerId || permanent.owner || permanent.controller || ""),
    isCreature: Boolean(permanent.isCreature ?? /\bCreature\b/i.test(permanent.typeLine || permanent.baseCharacteristics?.typeLine || "")),
    isLand: Boolean(permanent.isLand ?? /\bLand\b/i.test(permanent.typeLine || permanent.baseCharacteristics?.typeLine || "")),
    isPlaneswalker: Boolean(permanent.isPlaneswalker ?? /\bPlaneswalker\b/i.test(permanent.typeLine || permanent.baseCharacteristics?.typeLine || "")),
    isVehicle: Boolean(permanent.isVehicle ?? /\bVehicle\b/i.test(permanent.typeLine || permanent.baseCharacteristics?.typeLine || "")),
    isMount: Boolean(permanent.isMount ?? /\bMount\b/i.test(permanent.typeLine || permanent.baseCharacteristics?.typeLine || "")),
    isSpacecraft: Boolean(permanent.isSpacecraft ?? /\bSpacecraft\b/i.test(permanent.typeLine || permanent.baseCharacteristics?.typeLine || "")),
    isPlanet: Boolean(permanent.isPlanet ?? /\bPlanet\b/i.test(permanent.typeLine || permanent.baseCharacteristics?.typeLine || "")),
    isToken: Boolean(permanent.isToken || permanent.tokenStack?.token),
    isCopy: Boolean(permanent.isCopy || permanent.tokenStack?.exactCopy),
    keywords: Array.isArray(permanent.keywords) ? [...permanent.keywords] : [],
    layerBreakdown: Array.isArray(permanent.layerBreakdown) ? clonePlain(permanent.layerBreakdown) : [],
    publicOnly: true,
  };
}

function canonicalPermanentToPublicPermanent(permanent = {}) {
  return sanitizePublicPermanent({
    ...permanent,
    id: permanent.permanentId,
    name: permanent.baseCharacteristics?.name,
    typeLine: permanent.derivedCharacteristics?.typeLine || permanent.baseCharacteristics?.typeLine,
    oracleText: permanent.baseCharacteristics?.oracleText,
    manaCost: permanent.baseCharacteristics?.manaCost,
    currentPower: permanent.derivedCharacteristics?.power,
    currentToughness: permanent.derivedCharacteristics?.toughness,
    controller: permanent.controllerPlayerId,
    owner: permanent.ownerPlayerId,
  });
}

function resolveFocusedOpponentId({ requested, opponentBoards, runtimeSession, canonicalSession, localPlayerId }) {
  const opponentIds = new Set(opponentBoards.map((board) => board.id));
  const candidates = [
    requested,
    runtimeSession.combat?.defendingPlayerId,
    runtimeSession.combat?.attackTargetsByAttacker ? Object.values(runtimeSession.combat.attackTargetsByAttacker)[0] : "",
    runtimeSession.priority?.activePlayerId,
    canonicalSession.priorityState?.priorityHolderId,
    canonicalSession.turnState?.activePlayerId,
  ].map(normalizePlayerId);
  return candidates.find((id) => id && id !== localPlayerId && opponentIds.has(id)) || opponentBoards[0]?.id || "";
}

function buildPromptOwnership(runtimeSession, canonicalSession, participants, localPlayerId) {
  const priorityOwner = normalizePlayerId(runtimeSession.priority?.activePlayerId || canonicalSession.priorityState?.priorityHolderId || "local-player");
  const passedPlayerIds = runtimeSession.priority?.passedPlayerIds || canonicalSession.priorityState?.passedPlayerIds || [];
  const activePlayerId = normalizePlayerId(runtimeSession.simulation?.currentPlayerId || runtimeSession.syncedMultiplayer?.currentPlayerId || canonicalSession.turnState?.activePlayerId || "local-player");
  const participantById = new Map(participants.map((participant) => [participant.playerId, participant]));
  const pendingChoices = (runtimeSession.pendingEffects || [])
    .filter((effect) => !["resolved", "skipped", "ignored"].includes(effect.status))
    .map((effect) => {
      const ownerPlayerId = resolveChoiceOwner(effect, runtimeSession, canonicalSession);
      const owner = participantById.get(ownerPlayerId) || {};
      const aiOwned = owner.controllerType === "ai";
      return {
        choiceId: effect.id || effect.choiceRequestId || "",
        choiceType: effect.effect?.choiceKind || effect.effect?.action || "manual-choice",
        ownerPlayerId,
        ownerName: owner.displayName || ownerPlayerId,
        localCanResolve: ownerPlayerId === localPlayerId && !aiOwned,
        localCanAct: ownerPlayerId === localPlayerId && !aiOwned,
        aiOwned,
        status: effect.status || "pending",
        reason: effect.summary || effect.effect?.summary || "Manual choice required.",
        sourceName: effect.sourceName || "",
        stackObjectId: effect.stackObjectId || "",
        waitingMessage: ownerPlayerId === localPlayerId ? "Your decision" : `Waiting for ${owner.displayName || ownerPlayerId}`,
      };
    });
  return {
    activePlayerId,
    priority: {
      ownerPlayerId: priorityOwner,
      ownerName: participantById.get(priorityOwner)?.displayName || priorityOwner,
      localCanAct: Boolean(runtimeSession.priority?.waiting && priorityOwner === localPlayerId && participantById.get(priorityOwner)?.controllerType !== "ai"),
      localIsWaiting: Boolean(runtimeSession.priority?.waiting && priorityOwner !== localPlayerId),
      passedPlayerIds: [...passedPlayerIds],
      statusText: priorityOwner === localPlayerId ? "Your priority" : `Waiting for ${participantById.get(priorityOwner)?.displayName || priorityOwner}`,
    },
    pendingChoices,
  };
}

function resolveChoiceOwner(effect = {}, runtimeSession = {}, canonicalSession = {}) {
  const direct = effect.requestingPlayerId || effect.playerId || effect.controllerPlayerId || effect.ownerPlayerId;
  if (direct) return normalizePlayerId(direct);
  if (effect.controller) return controllerToPlayerId(effect.controller);
  if (effect.effect?.choiceKind === "blockers" || effect.effect?.action === "declare-blockers") {
    return normalizePlayerId(runtimeSession.combat?.defendingPlayerId || "opponent");
  }
  if (effect.stackObjectId) {
    const stackObject = (runtimeSession.stack || []).find((entry) => entry.id === effect.stackObjectId) ||
      (canonicalSession.stackState?.objects || []).find((entry) => entry.stackObjectId === effect.stackObjectId);
    if (stackObject) return controllerToPlayerId(stackObject.controller || stackObject.controllerPlayerId || "local-player");
  }
  return "local-player";
}

function buildStackContext(runtimeSession, canonicalSession, participants, promptOwnership) {
  const participantById = new Map(participants.map((participant) => [participant.playerId, participant]));
  const stackObjects = (runtimeSession.stack || []).map((object, index) => {
    const controllerPlayerId = controllerToPlayerId(object.controller || object.controllerPlayerId || "local-player");
    return {
      stackObjectId: object.id || object.stackObjectId || `stack-${index}`,
      name: object.name || object.card?.name || "Stack Object",
      objectType: object.objectType || object.typeLine || "spell",
      controllerPlayerId,
      controllerName: participantById.get(controllerPlayerId)?.displayName || controllerPlayerId,
      sourcePlayerId: controllerPlayerId,
      targetSummary: (object.targetIds || object.targets || []).map((target) => target.id || target).join(", "),
      selectedModes: object.selectedModes || [],
      xValue: object.xValue ?? "",
      copied: Boolean(object.copied || object.isCopy),
      status: object.status || "pending",
      requiredChoices: promptOwnership.pendingChoices.filter((choice) => choice.stackObjectId === (object.id || object.stackObjectId)),
      orderIndex: index,
    };
  });
  if (!stackObjects.length && canonicalSession.stackState?.objects?.length) {
    return {
      objects: canonicalSession.stackState.objects.map((object, index) => ({
        stackObjectId: object.stackObjectId,
        name: object.cardDefinitionReference?.name || "Stack Object",
        objectType: object.objectType,
        controllerPlayerId: object.controllerPlayerId,
        controllerName: participantById.get(object.controllerPlayerId)?.displayName || object.controllerPlayerId,
        sourcePlayerId: object.controllerPlayerId,
        targetSummary: (object.targets || []).map((target) => target.id || target).join(", "),
        selectedModes: object.selectedModes || [],
        xValue: object.xValue ?? "",
        copied: Boolean(object.copied),
        status: object.status || "pending",
        requiredChoices: promptOwnership.pendingChoices.filter((choice) => choice.stackObjectId === object.stackObjectId),
        orderIndex: index,
      })),
      priorityHolderId: promptOwnership.priority.ownerPlayerId,
      sameOrderForAllClients: true,
    };
  }
  return {
    objects: stackObjects,
    priorityHolderId: promptOwnership.priority.ownerPlayerId,
    sameOrderForAllClients: true,
  };
}

function buildCombatContext(runtimeSession, canonicalSession, localPlayerId, focusedOpponentId) {
  const combat = runtimeSession.combat || {};
  return {
    step: combat.step || canonicalSession.combatState?.status || "idle",
    attackingPlayerId: normalizePlayerId(combat.attackingPlayerId || canonicalSession.combatState?.attackingPlayerId || localPlayerId),
    defendingPlayerId: normalizePlayerId(combat.defendingPlayerId || focusedOpponentId || canonicalSession.combatState?.defendingPlayerIds?.[0] || ""),
    attackerIds: combat.attackerIds || canonicalSession.combatState?.attackers || [],
    attackTargetsByAttacker: clonePlain(combat.attackTargetsByAttacker || canonicalSession.combatState?.attackTargets || {}),
    blockersByAttacker: clonePlain(combat.blockersByAttacker || canonicalSession.combatState?.blockerAssignments || {}),
    focusPlayerId: focusedOpponentId,
    localIsAttacker: normalizePlayerId(combat.attackingPlayerId || localPlayerId) === localPlayerId,
    localIsDefender: normalizePlayerId(combat.defendingPlayerId || "") === localPlayerId,
  };
}

function buildHiddenIndicators(canonicalSession, opponentBoards) {
  const hidden = [];
  opponentBoards.forEach((board) => {
    const privateRef = canonicalSession.privateInformationReferences?.[board.id];
    if (!privateRef) hidden.push({ playerId: board.id, kind: "private-zones", label: "hand/library hidden or unavailable" });
    if (board.detailsLimited) hidden.push({ playerId: board.id, kind: "limited-public-board", label: "details limited" });
  });
  return hidden;
}

function buildPublicInformation(canonicalSession, runtimeSession) {
  return {
    turn: runtimeSession.turn || canonicalSession.turnState?.turnNumber || 1,
    phaseIndex: runtimeSession.phaseIndex ?? 0,
    activePlayerId: canonicalSession.turnState?.activePlayerId || runtimeSession.priority?.activePlayerId || "local-player",
    stackSize: (runtimeSession.stack || canonicalSession.stackState?.objects || []).length,
    triggerQueueSize: (runtimeSession.triggerQueue || canonicalSession.triggerState?.triggers || []).length,
  };
}

function buildAvailableLocalActions(promptOwnership, viewMode) {
  return {
    canPassPriority: promptOwnership.priority.localCanAct,
    canRespondToStack: promptOwnership.priority.localCanAct,
    canResolveLocalChoices: promptOwnership.pendingChoices.some((choice) => choice.localCanResolve),
    canInspectPublicBoards: true,
    canExportHandoff: true,
    canReturnToSimpleMode: false,
    viewMode,
  };
}

function isDetailsLimited(board, canonicalSession) {
  if (board.interfaceMode === "boardstate-lite" || board.interfaceMode === "unknown") {
    const hasBoard = board.permanents?.length > 0;
    const hasZones = Boolean(canonicalSession.zoneState?.zonesByPlayer?.[board.id]);
    return !hasBoard || !hasZones;
  }
  return false;
}

function normalizePeerSnapshotEntries(snapshot) {
  if (Array.isArray(snapshot)) return snapshot;
  if (Array.isArray(snapshot?.battlefield)) return snapshot.battlefield;
  if (Array.isArray(snapshot?.publicBoardSnapshot)) return snapshot.publicBoardSnapshot;
  return [];
}

function normalizePlayerId(value = "") {
  const raw = String(value || "").trim();
  if (!raw || raw === "player") return raw === "" ? "" : "local-player";
  if (raw === "opponent") return "opponent";
  return raw;
}

function controllerToPlayerId(controller = "") {
  const value = normalizePlayerId(controller);
  if (!value) return "local-player";
  return value;
}

function playerIdToController(playerId = "") {
  if (playerId === "local-player") return "player";
  return playerId || "opponent";
}

function normalizeInterface(value = "") {
  return ["boardstate-advanced", "boardstate-lite", "unknown"].includes(value) ? value : "unknown";
}
