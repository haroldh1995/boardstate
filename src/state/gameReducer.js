import { archiveCurrentGame } from "../archive/archiveService.js";
import {
  castSpellToStack,
  hydratePermanentEffects,
  passStackPriority,
  processEventTriggers,
  recalculateContinuousEffects,
  resolveQueuedTrigger,
  resolveSpell,
  resolveTopOfStack,
} from "../effects/effectEngine.js";
import { addCardToCommanderDeck, assignCommander, castCommander, recordCommanderCardUsage } from "../game/commanderSystem.js";
import { assignBlocker, declareAttackers, resolveCombat } from "../game/combatSystem.js";
import { createDefaultProfile, createEmptySimulationStats, createGameSession, createManaPool, createPermanent, PHASES } from "./schema.js";
import { clone, createId, normalizeCount } from "./ids.js";
import { drainGameEvents, mapActionTypeToGameEvent, queueGameEvent, runGameEventObservers } from "../game/eventBus.js";
import { transitionFsm } from "../game/fsm.js";
import { finalizeAction } from "./actions.js";
import {
  createNpcPublicSnapshot,
  createSimLog,
  createSimulationSession,
  toOpponentPermanent,
} from "../simulation/commanderSimulation.js";
import { RULES_CONFIDENCE, createRecoveryEntry } from "../support/debugExport.js";

export function reduceProfile(profile, event) {
  const actionType = event.actionType || event.type;
  const undoable =
    !event?.internalOnly &&
    !["IMPORT_PROFILE", "SAVE_TICK", "SIMULATION_TICK"].includes(actionType);
  const baseProfile = undoable ? pushUndo(profile, event) : profile;
  let nextProfile = baseProfile;

  switch (actionType) {
    case "IMPORT_PROFILE":
      return event.profile;
    case "ADD_RECOVERY_ENTRY":
      nextProfile = withSession(baseProfile, addRecoveryEntry(baseProfile.activeSession, event.entry || event));
      break;
    case "DISMISS_RECOVERY_ENTRY":
      nextProfile = withSession(baseProfile, dismissRecoveryEntry(baseProfile.activeSession, event.id));
      break;
    case "CLEAR_RECOVERY_ENTRIES":
      nextProfile = withSession(baseProfile, { ...baseProfile.activeSession, recoveryLog: [] });
      break;
    case "UNDO":
      return popUndo(profile);
    case "REDO":
      return popRedo(profile);
    case "REPLAY_TO_ACTION":
      nextProfile = replayToAction(baseProfile, event.replayActionId || event.payload?.replayActionId || "");
      break;
    case "SET_PLAYER_NAME":
      nextProfile = { ...baseProfile, player: { ...baseProfile.player, name: event.name || "Player" } };
      break;
    case "SET_SETTING":
      nextProfile = updateSetting(baseProfile, event.path, event.value);
      break;
    case "SET_MULTIPLAYER_MODE":
      nextProfile = setMultiplayerMode(baseProfile, event.mode);
      break;
    case "ROLL_MULTIPLAYER_TURN_ORDER":
      nextProfile = rollMultiplayerTurnOrder(baseProfile, event);
      break;
    case "CONFIRM_MULTIPLAYER_TURN_ORDER":
      nextProfile = confirmMultiplayerTurnOrder(baseProfile, event);
      break;
    case "CLEAR_MULTIPLAYER_TURN_ORDER":
      nextProfile = clearMultiplayerTurnOrder(baseProfile);
      break;
    case "START_GAME_TRACKING":
      nextProfile = withSession(baseProfile, startGameTracking(baseProfile.activeSession, baseProfile.settings || {}));
      break;
    case "STOP_GAME_TRACKING":
      nextProfile = withSession(baseProfile, stopGameTracking(baseProfile.activeSession));
      break;
    case "ACTIVATE_BOARD":
      nextProfile = withSession(baseProfile, activateBoardState(withRuntimeSettings(baseProfile.activeSession, baseProfile.settings)));
      break;
    case "START_SIMULATION":
      nextProfile = startSimulation(baseProfile, event);
      break;
    case "SIMULATION_PAUSE":
      nextProfile = updateSimulationStatus(baseProfile, "paused");
      break;
    case "SIMULATION_RESUME":
      nextProfile = updateSimulationStatus(baseProfile, "running");
      break;
    case "SIMULATION_STOP":
      nextProfile = stopSimulation(baseProfile);
      break;
    case "SIMULATION_SET_SPEED":
      nextProfile = updateSimulationSpeed(baseProfile, event.speed);
      break;
    case "SIMULATION_PASS_TURN":
      nextProfile = withSession(baseProfile, advanceSimulationTurn(baseProfile.activeSession, "manual-pass"));
      break;
    case "SIMULATION_TICK":
      {
        const tickSession = runSimulationTick(baseProfile.activeSession, baseProfile.simulationMemory || {});
        if (tickSession === baseProfile.activeSession) {
          return baseProfile;
        }
        nextProfile = withSession(baseProfile, tickSession);
      }
      break;
    case "LIFE_DELTA":
      nextProfile = withSession(baseProfile, {
        ...baseProfile.activeSession,
        life: Math.max(0, baseProfile.activeSession.life + Number(event.amount || 0)),
      });
      break;
    case "PLAYER_COUNTER_DELTA":
      nextProfile = withSession(baseProfile, updatePlayerCounter(baseProfile.activeSession, event.counter, event.amount));
      break;
    case "COMMANDER_DAMAGE_DELTA":
      nextProfile = withSession(baseProfile, updateCommanderDamage(baseProfile.activeSession, event.opponentId || "opponent", event.amount));
      break;
    case "SET_COMMANDER_DAMAGE":
      nextProfile = withSession(baseProfile, setCommanderDamage(baseProfile.activeSession, event.opponentId || "opponent", event.value));
      break;
    case "RESET_PLAYER_TRACKERS":
      nextProfile = withSession(baseProfile, resetPlayerTrackers(baseProfile.activeSession));
      break;
    case "CLEAR_GAME_HISTORY":
      nextProfile = withSession(baseProfile, clearGameHistory(baseProfile.activeSession));
      break;
    case "CLEAR_SIMULATION_LEARNING":
      nextProfile = clearSimulationLearning(baseProfile);
      break;
    case "RESET_ALL_LOCAL_DATA":
      nextProfile = resetAllLocalData(baseProfile);
      break;
    case "RESET_SETTINGS":
      nextProfile = resetProfileSettings(baseProfile);
      break;
    case "LOAD_TUTORIAL_SAMPLE_BOARD":
      nextProfile = withSession(baseProfile, loadTutorialSampleBoard(baseProfile.activeSession));
      break;
    case "CLEAR_TUTORIAL":
      nextProfile = withSession(baseProfile, {
        ...baseProfile.activeSession,
        tutorial: {
          ...(baseProfile.activeSession.tutorial || {}),
          active: false,
          canClear: false,
        },
      });
      break;
    case "SET_LIFE":
      nextProfile = withSession(baseProfile, { ...baseProfile.activeSession, life: normalizeCount(event.life, 40) });
      break;
    case "ADD_COUNTER":
      nextProfile = withSession(baseProfile, applyCounterToSession(baseProfile.activeSession, event));
      break;
    case "ADJUST_LOYALTY":
      nextProfile = withSession(baseProfile, adjustPlaneswalkerLoyalty(baseProfile.activeSession, event.id, event.amount));
      break;
    case "ADD_COUNTER_SELECTED":
      nextProfile = withSession(baseProfile, applyCounterToSelected(baseProfile.activeSession, event));
      break;
    case "APPLY_COUNTER_SCOPE":
      nextProfile = applyCounterScopeProfile(baseProfile, event);
      break;
    case "ADD_MANA":
      nextProfile = withSession(baseProfile, addMana(baseProfile.activeSession, event.color, event.amount));
      break;
    case "CLEAR_MANA":
      nextProfile = withSession(baseProfile, { ...baseProfile.activeSession, manaPool: createManaPool() });
      break;
    case "ADVANCE_PHASE":
      nextProfile = withSession(baseProfile, advancePhase(withRuntimeSettings(baseProfile.activeSession, baseProfile.settings), baseProfile.settings?.multiplayer || {}));
      break;
    case "ADD_PERMANENT":
      nextProfile = addPermanent(baseProfile, event.card, event.controller || "player");
      break;
    case "ADD_CUSTOM_TOKEN":
      nextProfile = addPermanent(baseProfile, createTokenCard(event), event.controller || "player");
      break;
    case "CAST_SPELL":
      nextProfile = withSession(
        baseProfile,
        castSpellToStack(withRuntimeSettings(baseProfile.activeSession, baseProfile.settings), event.card, {
          controller: event.controller || "player",
          owner: event.owner || event.controller || "player",
          sourceZone: event.sourceZone || "hand",
          targetIds: event.targetIds || baseProfile.activeSession.selectedIds || [],
          targetStackId: event.targetStackId || "",
          selectedModes: event.selectedModes || [],
          xValue: event.xValue,
          additionalCosts: event.additionalCosts || {},
          castPermission: event.castPermission || "",
        })
      );
      nextProfile = recordCommanderCardUsage(nextProfile, { ...event.card, owner: "player", controller: "player" });
      break;
    case "RESOLVE_TOP_SPELL":
      nextProfile = withSession(baseProfile, resolveTopOfStack(withRuntimeSettings(baseProfile.activeSession, baseProfile.settings), {
        stackId: event.stackId || "",
        autoChoose: Boolean(event.autoChoose),
      }));
      break;
    case "PASS_PRIORITY":
      nextProfile = withSession(baseProfile, passStackPriority(baseProfile.activeSession, event.playerId || "local-player"));
      break;
    case "ATTACH_PERMANENT":
      nextProfile = withSession(baseProfile, attachPermanent(baseProfile.activeSession, event.sourceId, event.targetId));
      break;
    case "TOGGLE_TAPPED":
      nextProfile = withSession(baseProfile, togglePermanentTapped(baseProfile.activeSession, event.id));
      break;
    case "SET_SELECTED_TAPPED":
      nextProfile = withSession(baseProfile, setSelectedTapped(baseProfile.activeSession, Boolean(event.tapped)));
      break;
    case "TAP_SELECTED_FOR_COST":
      nextProfile = withSession(baseProfile, tapSelectedForCost(baseProfile.activeSession, event));
      break;
    case "REMOVE_SELECTED":
      nextProfile = withSession(baseProfile, removeSelectedPermanents(baseProfile.activeSession, event));
      break;
    case "CLEAR_SELECTION":
      nextProfile = withSession(baseProfile, { ...baseProfile.activeSession, selectedIds: [] });
      break;
    case "SELECT_PERMANENT":
      nextProfile = withSession(baseProfile, toggleSelection(baseProfile.activeSession, event.id));
      break;
    case "REORDER_PERMANENT":
      nextProfile = withSession(baseProfile, reorderPermanent(baseProfile.activeSession, event.id, event.direction));
      break;
    case "DECLARE_ATTACKERS":
      nextProfile = withSession(
        baseProfile,
        emitAttackTriggerEvents(withRuntimeSettings(declareAttackers(baseProfile.activeSession, event.ids || []), baseProfile.settings), event.ids || [])
      );
      break;
    case "ASSIGN_BLOCKER":
      nextProfile = withSession(baseProfile, assignBlocker(baseProfile.activeSession, event.attackerId, event.blockerId));
      break;
    case "RESOLVE_COMBAT":
      nextProfile = withSession(baseProfile, resolveCombat(baseProfile.activeSession));
      break;
    case "SET_COMMANDER":
      nextProfile = assignCommander(baseProfile, event.card);
      break;
    case "CAST_COMMANDER":
      nextProfile = castCommander(baseProfile);
      break;
    case "ADD_DECK_CARD":
      nextProfile = addCardToCommanderDeck(baseProfile, event.card, event.source || "manual");
      break;
    case "MARK_PENDING_EFFECT":
      nextProfile = withSession(baseProfile, updatePendingEffect(baseProfile.activeSession, event.id, event.status));
      break;
    case "SET_SPELL_TARGET":
      nextProfile = withSession(baseProfile, setSpellTargetChoice(baseProfile.activeSession, event.pendingId, event.targetId));
      break;
    case "HELPER_REMIND_ME":
      nextProfile = withSession(baseProfile, requestHelperReminder(baseProfile.activeSession, event.messages || []));
      break;
    case "HELPER_DISMISS_MESSAGE":
      nextProfile = withSession(baseProfile, dismissHelperMessage(baseProfile.activeSession, event.messageKey || ""));
      break;
    case "HELPER_MARK_SHOWN":
      nextProfile = withSession(baseProfile, markHelperMessageShown(baseProfile.activeSession, event.messageKey || ""));
      break;
    case "TRIGGER_QUEUE_RESOLVE":
      nextProfile = withSession(baseProfile, resolveQueuedTrigger(baseProfile.activeSession, { triggerId: event.id, command: "resolve", requestedBy: event.playerId || "player" }));
      break;
    case "TRIGGER_QUEUE_SKIP":
      nextProfile = withSession(baseProfile, resolveQueuedTrigger(baseProfile.activeSession, { triggerId: event.id, command: "skip", requestedBy: event.playerId || "player" }));
      break;
    case "TRIGGER_QUEUE_DELAY":
      nextProfile = withSession(baseProfile, resolveQueuedTrigger(baseProfile.activeSession, { triggerId: event.id, command: "delay", requestedBy: event.playerId || "player" }));
      break;
    case "TRIGGER_QUEUE_REACTIVATE_DELAYED":
      nextProfile = withSession(baseProfile, reactivateDelayedTriggers(baseProfile.activeSession));
      break;
    case "ADD_MANUAL_TRIGGER":
      nextProfile = withSession(baseProfile, addManualTrigger(baseProfile.activeSession, event));
      break;
    case "ARCHIVE_GAME":
      nextProfile = archiveCurrentGame(baseProfile, event.result || "completed");
      break;
    case "SYNC_PUBLIC_STATS":
      nextProfile = syncPublicStats(baseProfile);
      break;
    default:
      nextProfile = baseProfile;
      break;
  }

  nextProfile = withSession(
    nextProfile,
    emitAndProcessSessionEvent(withRuntimeSettings(nextProfile.activeSession, nextProfile.settings), event, actionType)
  );
  nextProfile = reconcileSimulationCompletion(nextProfile, baseProfile, actionType, event);
  nextProfile = updateSimulationMemory(nextProfile, event, actionType);
  nextProfile = maybeAdvanceLocalSimulationTurn(nextProfile, baseProfile.activeSession, actionType);
  nextProfile = syncSimulationPresence(nextProfile);
  return withHistory(nextProfile, finalizeAction(event, nextProfile));
}

function addPermanent(profile, card, controller) {
  const permanent = hydratePermanentEffects({
    ...card,
    controller,
    owner: card.owner || controller,
  });
  const side = controller === "player" ? "player" : "opponent";
  const session = {
    ...profile.activeSession,
    battlefield: {
      ...profile.activeSession.battlefield,
      [side]: stackBattlefieldPermanent(profile.activeSession.battlefield[side], permanent),
    },
  };
  const withTriggers = emitPermanentEntryTriggerEvents(withRuntimeSettings(session, profile.settings), permanent, {
    instances: permanent.quantity,
    cause: "add-permanent",
  });
  const withSessionProfile = withSession(profile, withTriggers);
  return controller === "player" ? recordCommanderCardUsage(withSessionProfile, permanent) : withSessionProfile;
}

function emitPermanentEntryTriggerEvents(session, permanent, { instances = 1, cause = "effect", chainId = createId("chain") } = {}) {
  const payload = {
    permanent,
    instances,
    cause,
    controller: permanent.controller,
  };
  let nextSession = processEventTriggers(session, {
    type: "permanent-entered",
    eventType: "ENTER_BATTLEFIELD",
    permanent,
    payload,
    instances,
    cause,
    chainId,
  });
  if (permanent.isLand) {
    nextSession = processEventTriggers(nextSession, {
      type: "land-entered-battlefield",
      eventType: "LAND_ENTERED_BATTLEFIELD",
      permanent,
      payload,
      instances,
      cause,
      chainId,
    });
    nextSession = processEventTriggers(nextSession, {
      type: "landfall-check",
      eventType: "LANDFALL_CHECK",
      permanent,
      payload,
      instances,
      cause,
      chainId,
    });
  }
  return nextSession;
}

function emitAttackTriggerEvents(session, attackerIds = []) {
  const payload = {
    attackerIds: [...attackerIds],
    phase: PHASES[session.phaseIndex],
    attackingPlayerId: "opponent",
    attackedObjectId: "opponent",
  };
  const chainId = createId("chain");
  const withDeclared = processEventTriggers(session, {
    type: "attackers-declared",
    eventType: "ATTACK_DECLARED",
    payload,
    ids: [...attackerIds],
    chainId,
  });
  return processEventTriggers(withDeclared, {
    type: "attack-trigger-check",
    eventType: "ATTACK_TRIGGER_CHECK",
    payload,
    ids: [...attackerIds],
    chainId,
  });
}

function stackBattlefieldPermanent(permanents, incoming) {
  const index = permanents.findIndex((permanent) => permanentStackSignature(permanent) === permanentStackSignature(incoming));
  if (index < 0) {
    return [...permanents, normalizeStackMembers(incoming)];
  }
  return permanents.map((permanent, permanentIndex) =>
    permanentIndex === index
      ? hydratePermanentEffects({
          ...permanent,
          quantity: (permanent.quantity || 1) + (incoming.quantity || 1),
          stackMembers: [...(permanent.stackMembers || []), ...(normalizeStackMembers(incoming).stackMembers || [])],
        })
      : permanent
  );
}

function permanentStackSignature(permanent) {
  return JSON.stringify({
    name: permanent.name,
    cardId: permanent.cardId,
    typeLine: permanent.typeLine,
    oracleText: permanent.oracleText,
    controller: permanent.controller,
    owner: permanent.owner,
    basePower: permanent.basePower,
    baseToughness: permanent.baseToughness,
    counters: stableRecord(permanent.counters),
    keywords: [...(permanent.keywords || [])].sort(),
    tapped: permanent.tapped,
    summoningSick: permanent.summoningSick,
    attacking: permanent.attacking,
    blocking: permanent.blocking,
    enteredDuringCombat: permanent.enteredDuringCombat,
    attackingPlayerId: permanent.attackingPlayerId,
    attackedObjectId: permanent.attackedObjectId,
    createdByTriggerId: permanent.createdByTriggerId,
    sourcePermanentId: permanent.sourcePermanentId,
    combatPhaseCreatedIn: permanent.combatPhaseCreatedIn,
    tokenTemplateId: permanent.tokenTemplateId,
    tokenCopyOfId: permanent.tokenCopyOfId,
    attachedToId: permanent.attachedToId,
    attachments: [...(permanent.attachments || [])].sort(),
    temporaryModifiers: permanent.temporaryModifiers || [],
    manualStatus: permanent.manualStatus,
    isToken: permanent.isToken,
    isCopy: permanent.isCopy,
  });
}

function stableRecord(record = {}) {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}

function createTokenCard(event) {
  const type = event.tokenType || "Creature";
  const typeLine = /\bToken\b/i.test(type) ? type : `Token ${type}`;
  return {
    name: event.name || "Custom Token",
    typeLine,
    basePower: event.power,
    baseToughness: event.toughness,
    quantity: normalizeCount(event.quantity, 1) || 1,
    tapped: Boolean(event.tapped),
    isToken: true,
    ownedByCommanderDeck: false,
  };
}

function updateSetting(profile, path, value) {
  const keys = String(path || "").split(".").filter(Boolean);
  if (!keys.length) {
    return profile;
  }
  const settings = { ...(profile.settings || {}) };
  let cursor = settings;
  keys.slice(0, -1).forEach((key) => {
    cursor[key] = { ...(cursor[key] || {}) };
    cursor = cursor[key];
  });
  cursor[keys[keys.length - 1]] = value;
  if (path === "adhdMode.enabled") {
    settings.adhdAutomation = Boolean(value);
  }
  if (path === "adhdAutomation") {
    settings.adhdMode = {
      ...(settings.adhdMode || {}),
      enabled: Boolean(value),
    };
  }
  return { ...profile, settings };
}

function setMultiplayerMode(profile, mode = "offline") {
  const existingSettings = profile.settings?.multiplayer || {};
  const currentSimulation = profile.activeSession?.simulation || {};
  const connectedPlayers =
    mode === "simulated"
      ? buildSimulationConnectedPlayers(profile, currentSimulation.opponents || {})
      : [{ id: "local-player", name: profile.player?.name || "Player", authority: "host", role: existingSettings.role || "player" }];
  return {
    ...profile,
    activeSession: {
      ...profile.activeSession,
      simulation:
        mode === "simulated"
          ? currentSimulation
          : {
              ...currentSimulation,
              enabled: false,
              status: "stopped",
              waitingForUser: false,
            },
      syncedMultiplayer:
        mode === "local" || mode === "wifi"
          ? {
              ...(profile.activeSession?.syncedMultiplayer || {}),
              active: true,
              updatedAt: Date.now(),
            }
          : {
              ...(profile.activeSession?.syncedMultiplayer || {}),
              active: false,
              pendingConfirmation: false,
              confirmed: false,
              updatedAt: Date.now(),
            },
    },
    settings: {
      ...(profile.settings || {}),
      multiplayer: {
        ...existingSettings,
        mode,
        connectedPlayers,
      },
    },
  };
}

function rollMultiplayerTurnOrder(profile, event = {}) {
  const players = normalizeSyncedTurnPlayers(event.players || profile.settings?.multiplayer?.connectedPlayers || [], profile.player?.name || "Player");
  if (players.length <= 1) {
    return profile;
  }
  const rolls = Object.fromEntries(players.map((player) => [player.id, Math.max(1, Math.min(20, normalizeCount(event.rolls?.[player.id], Math.floor(Math.random() * 20) + 1)))]));
  const suggestedTurnOrder = [...players]
    .sort((left, right) => {
      const rightRoll = rolls[right.id] || 0;
      const leftRoll = rolls[left.id] || 0;
      if (rightRoll !== leftRoll) {
        return rightRoll - leftRoll;
      }
      return left.name.localeCompare(right.name);
    })
    .map((player) => player.id);
  const highestRoll = Math.max(...Object.values(rolls));
  const tiePlayerIds = players.filter((player) => rolls[player.id] === highestRoll).map((player) => player.id);
  const awaitingManualTieBreak = tiePlayerIds.length > 1;
  const syncedState = {
    ...(profile.activeSession?.syncedMultiplayer || {}),
    active: true,
    players,
    rolls,
    suggestedTurnOrder,
    tiePlayerIds,
    turnOrder: suggestedTurnOrder,
    confirmed: false,
    pendingConfirmation: true,
    currentPlayerId: suggestedTurnOrder[0] || "local-player",
    currentPlayerIndex: 0,
    updatedAt: Date.now(),
  };
  const withSessionUpdate = withSession(profile, {
    ...profile.activeSession,
    syncedMultiplayer: syncedState,
    effectLog: [
      {
        id: createId("turn-order-roll"),
        at: Date.now(),
        sourceName: "Multiplayer",
        summary: awaitingManualTieBreak
          ? "Turn order rolled: tie for highest d20, reroll tied players or confirm manual ordering."
          : `Turn order rolled: ${formatTurnOrderNames(players, suggestedTurnOrder)}.`,
      },
      ...(profile.activeSession?.effectLog || []),
    ].slice(0, 180),
  });
  return {
    ...withSessionUpdate,
    settings: {
      ...(withSessionUpdate.settings || {}),
      multiplayer: {
        ...(withSessionUpdate.settings?.multiplayer || {}),
        turnOrderRolls: rolls,
        suggestedTurnOrder,
        confirmedTurnOrder: [],
        needsTurnOrderConfirmation: true,
      },
    },
  };
}

function confirmMultiplayerTurnOrder(profile, event = {}) {
  const currentState = profile.activeSession?.syncedMultiplayer || {};
  const players = normalizeSyncedTurnPlayers(currentState.players || event.players || profile.settings?.multiplayer?.connectedPlayers || [], profile.player?.name || "Player");
  const playerIds = new Set(players.map((player) => player.id));
  const eventOrder = Array.isArray(event.turnOrder) ? event.turnOrder : [];
  const normalizedEventOrder = eventOrder.filter((id) => playerIds.has(id));
  const remaining = players.map((player) => player.id).filter((id) => !normalizedEventOrder.includes(id));
  const turnOrder = [...normalizedEventOrder, ...remaining];
  if (!turnOrder.length) {
    return profile;
  }
  const rolls = {
    ...(currentState.rolls || {}),
    ...(event.rolls || {}),
  };
  const suggestedTurnOrder = (event.suggestedTurnOrder || currentState.suggestedTurnOrder || turnOrder).filter((id) => playerIds.has(id));
  const tiePlayerIds = (event.tiePlayerIds || currentState.tiePlayerIds || []).filter((id) => playerIds.has(id));
  const syncedState = {
    ...currentState,
    active: true,
    players,
    rolls,
    suggestedTurnOrder,
    tiePlayerIds,
    turnOrder,
    confirmed: true,
    pendingConfirmation: false,
    currentPlayerId: turnOrder[0] || "local-player",
    currentPlayerIndex: 0,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };
  const withSessionUpdate = withSession(profile, {
    ...profile.activeSession,
    syncedMultiplayer: syncedState,
    effectLog: [
      {
        id: createId("turn-order-confirm"),
        at: Date.now(),
        sourceName: "Multiplayer",
        summary: `Turn order confirmed: ${formatTurnOrderNames(players, turnOrder)}.`,
      },
      ...(profile.activeSession?.effectLog || []),
    ].slice(0, 180),
  });
  return {
    ...withSessionUpdate,
    settings: {
      ...(withSessionUpdate.settings || {}),
      multiplayer: {
        ...(withSessionUpdate.settings?.multiplayer || {}),
        confirmedTurnOrder: turnOrder,
        needsTurnOrderConfirmation: false,
        lastTurnOrderConfirmedAt: Date.now(),
      },
    },
  };
}

function clearMultiplayerTurnOrder(profile) {
  const clearedState = {
    ...(profile.activeSession?.syncedMultiplayer || {}),
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
    updatedAt: Date.now(),
  };
  const withSessionUpdate = withSession(profile, {
    ...profile.activeSession,
    syncedMultiplayer: clearedState,
  });
  return {
    ...withSessionUpdate,
    settings: {
      ...(withSessionUpdate.settings || {}),
      multiplayer: {
        ...(withSessionUpdate.settings?.multiplayer || {}),
        turnOrderRolls: {},
        suggestedTurnOrder: [],
        confirmedTurnOrder: [],
        needsTurnOrderConfirmation: false,
      },
    },
  };
}

function normalizeSyncedTurnPlayers(entries = [], localPlayerName = "Player") {
  const byId = new Map();
  byId.set("local-player", { id: "local-player", name: localPlayerName || "Player" });
  entries.forEach((entry) => {
    if (!entry?.id || entry.id === "local-player") {
      return;
    }
    if (entry.id.startsWith("peer-") && (entry.name || "").trim() === localPlayerName.trim()) {
      return;
    }
    byId.set(entry.id, {
      id: entry.id,
      name: entry.name || entry.id,
    });
  });
  return [...byId.values()];
}

function formatTurnOrderNames(players = [], turnOrder = []) {
  const byId = Object.fromEntries(players.map((player) => [player.id, player.name]));
  return turnOrder.map((id) => (id === "local-player" ? `${byId[id] || "Player"} (You)` : byId[id] || id)).join(" -> ");
}

function startSimulation(profile, event = {}) {
  const revengeEnabled = event.revengeEnabled !== false;
  const setup = createSimulationSession(profile, {
    selectedOpponents: event.selectedOpponents || profile.settings?.multiplayer?.selectedSimulatedOpponents || [],
    speed: event.speed || profile.settings?.multiplayer?.simulatedSpeed || "normal",
    revengeEnabled,
  });
  const connectedPlayers = setup.connectedPlayers || buildSimulationConnectedPlayers(profile, setup.session.simulation.opponents || {});
  return {
    ...profile,
    activeSession: setup.session,
    settings: {
      ...(profile.settings || {}),
      multiplayer: {
        ...(profile.settings?.multiplayer || {}),
        mode: "simulated",
        role: "player",
        spectatorMode: false,
        connectedPlayers,
        selectedSimulatedOpponents: [...(setup.session.simulation.selectedOpponents || [])],
        simulatedSpeed: setup.session.simulation.speed || "normal",
        simulationRevenge: revengeEnabled,
      },
    },
  };
}

function updateSimulationStatus(profile, status = "paused") {
  const simulation = profile.activeSession?.simulation;
  if (!simulation?.enabled) {
    return profile;
  }
  return withSession(profile, {
    ...profile.activeSession,
    simulation: appendSimulationLog(
      {
        ...simulation,
        status,
        updatedAt: Date.now(),
      },
      createSimLog("system", status === "running" ? "Simulation resumed." : "Simulation paused.")
    ),
  });
}

function updateSimulationSpeed(profile, speed = "normal") {
  const simulation = profile.activeSession?.simulation;
  if (!simulation?.enabled) {
    return profile;
  }
  return {
    ...withSession(profile, {
      ...profile.activeSession,
      simulation: {
        ...simulation,
        speed,
        updatedAt: Date.now(),
      },
    }),
    settings: {
      ...(profile.settings || {}),
      multiplayer: {
        ...(profile.settings?.multiplayer || {}),
        simulatedSpeed: speed,
      },
    },
  };
}

function stopSimulation(profile) {
  const simulation = profile.activeSession?.simulation;
  if (!simulation?.enabled) {
    return profile;
  }
  const nextSimulation = appendSimulationLog(
    {
      ...simulation,
      enabled: false,
      status: "stopped",
      waitingForUser: false,
      updatedAt: Date.now(),
    },
    createSimLog("system", "Simulation stopped.")
  );
  return {
    ...withSession(profile, {
      ...profile.activeSession,
      simulation: nextSimulation,
      gameTracking: {
        active: false,
        startedAt: profile.activeSession?.gameTracking?.startedAt || 0,
        mode: "training-ground",
      },
    }),
    settings: {
      ...(profile.settings || {}),
      multiplayer: {
        ...(profile.settings?.multiplayer || {}),
        mode: "offline",
        connectedPlayers: [{ id: "local-player", name: profile.player?.name || "Player", authority: "host", role: "player" }],
      },
    },
  };
}

function runSimulationTick(session, simulationMemory = {}) {
  const preparedSession = ensureSimulationPlayerState(session);
  const simulation = preparedSession.simulation || {};
  if (!simulation.enabled || simulation.status !== "running") {
    return preparedSession;
  }
  if (simulation.winnerId) {
    return concludeSimulationSession(preparedSession, simulation.winnerId, "winner-detected");
  }
  const currentPlayerId = simulation.currentPlayerId || simulation.turnOrder?.[simulation.turnIndex] || "local-player";
  if (simulation.eliminatedPlayerIds?.includes(currentPlayerId)) {
    return advanceSimulationTurn(preparedSession, "skip-eliminated-player");
  }
  if (currentPlayerId === "local-player") {
    if (simulation.waitingForUser) {
      return preparedSession;
    }
    return {
      ...preparedSession,
      simulation: appendSimulationLog(
        {
          ...simulation,
          waitingForUser: true,
          updatedAt: Date.now(),
        },
        createSimLog("system", "Your turn: play normally, then pass turn from simulation controls.")
      ),
    };
  }

  const npc = simulation.opponents?.[currentPlayerId];
  if (!npc) {
    return {
      ...preparedSession,
      simulation: appendSimulationLog(
        {
          ...simulation,
          status: "paused",
          waitingForUser: true,
          updatedAt: Date.now(),
        },
        createSimLog("system", `Simulation paused: missing NPC state for ${currentPlayerId}.`)
      ),
    };
  }

  const phase = Number.isFinite(Number(simulation.currentPhaseIndex)) ? Number(simulation.currentPhaseIndex) : 0;
  if (phase === 0) {
    return applyNpcDrawStep(preparedSession, npc, simulation);
  }
  if (phase === 1) {
    return applyNpcMainStep(preparedSession, npc, simulation, simulationMemory);
  }
  if (phase === 2) {
    return applyNpcCombatStep(preparedSession, npc, simulation, simulationMemory);
  }
  if (phase === 3) {
    return applyNpcSecondMainStep(preparedSession, npc, simulation, simulationMemory);
  }
  return advanceSimulationTurn(preparedSession, "npc-end-step");
}

function applyNpcDrawStep(session, npc, simulation) {
  const [drawn, ...library] = npc.zones.library || [];
  const updatedNpc = {
    ...npc,
    zones: {
      ...npc.zones,
      library,
      hand: drawn ? [...(npc.zones.hand || []), drawn] : [...(npc.zones.hand || [])],
    },
    currentPhaseIndex: 1,
    landPlaysThisTurn: 0,
    updatedAt: Date.now(),
  };
  return {
    ...session,
    phaseIndex: 0,
    simulation: appendSimulationLog(
      withNpcUpdated(simulation, updatedNpc, {
        currentPhaseIndex: 1,
        updatedAt: Date.now(),
      }),
      createSimLog(npc.id, drawn ? `${npc.name} draws ${drawn.name}.` : `${npc.name} tries to draw but has no cards.`)
    ),
  };
}

function applyNpcMainStep(session, npc, simulation, simulationMemory = {}) {
  let nextSession = session;
  let updatedNpc = { ...npc };
  let actionText = `${npc.name} passes Main 1.`;

  const landIndex = (updatedNpc.zones.hand || []).findIndex((card) => isType(card, "Land"));
  if (landIndex >= 0 && (updatedNpc.landPlaysThisTurn || 0) < 1) {
    const landCard = updatedNpc.zones.hand[landIndex];
    updatedNpc.zones.hand = updatedNpc.zones.hand.filter((_, index) => index !== landIndex);
    nextSession = addOpponentCardToBattlefield(nextSession, landCard, npc.id);
    updatedNpc.zones.battlefield = [...(updatedNpc.zones.battlefield || []), landCard];
    updatedNpc.landPlaysThisTurn = 1;
    actionText = `${npc.name} plays ${landCard.name}.`;
  } else {
    const commanderCast = maybeCastNpcCommander(nextSession, updatedNpc);
    if (commanderCast) {
      nextSession = commanderCast.session;
      updatedNpc = commanderCast.npc;
      actionText = `${npc.name} casts commander ${updatedNpc.commander.card.name}${updatedNpc.commander.tax > 0 ? ` (tax ${updatedNpc.commander.tax})` : ""}.`;
    } else {
    const castIndex = chooseNpcCastIndex(updatedNpc, nextSession, simulationMemory, { secondary: false });
    if (castIndex >= 0) {
      const castCard = updatedNpc.zones.hand[castIndex];
      updatedNpc.zones.hand = updatedNpc.zones.hand.filter((_, index) => index !== castIndex);
      const castResult = resolveNpcCast(nextSession, updatedNpc, castCard, simulationMemory);
      nextSession = castResult.session;
      updatedNpc = castResult.npc;
      actionText = `${npc.name} casts ${castCard.name}.`;
    }
    }
  }

  updatedNpc.currentPhaseIndex = 2;
  updatedNpc.updatedAt = Date.now();
  return {
    ...nextSession,
    phaseIndex: 1,
    simulation: appendSimulationLog(
      withNpcUpdated(simulation, updatedNpc, {
        currentPhaseIndex: 2,
        updatedAt: Date.now(),
      }),
      createSimLog(npc.id, actionText)
    ),
  };
}

function applyNpcCombatStep(session, npc, simulation, simulationMemory = {}) {
  const opponentCreatures = (session.battlefield.opponent || []).filter(
    (permanent) => permanent.controller === npc.id && permanent.isCreature && !permanent.tapped && !permanent.summoningSick
  );
  const strategyAggression = (npc.strategy?.tags || []).some((tag) => ["spellslinger", "landfall", "colorless-ramp"].includes(tag)) ? 1 : 0;
  const maxAttackers = Math.max(1, Math.min(opponentCreatures.length, 3 + strategyAggression));
  const attackers = opponentCreatures
    .slice()
    .sort((left, right) => (right.currentPower || right.basePower || 0) - (left.currentPower || left.basePower || 0))
    .slice(0, maxAttackers);

  let nextSession = session;
  let damage = 0;
  const attackTargetId = chooseNpcAttackTargetId(nextSession, simulation, npc, simulationMemory);
  const attackTargetName = getSimulationPlayerName(simulation, attackTargetId);
  if (attackers.length) {
    const attackerIds = new Set(attackers.map((attacker) => attacker.id));
    nextSession = {
      ...nextSession,
      battlefield: {
        ...nextSession.battlefield,
        opponent: nextSession.battlefield.opponent.map((permanent) =>
          attackerIds.has(permanent.id)
            ? createPermanent({
                ...permanent,
                tapped: true,
                attacking: true,
                attackedObjectId: attackTargetId,
                attackingPlayerId: attackTargetId,
                enteredDuringCombat: true,
              })
            : permanent
        ),
      },
      combat: {
        ...(nextSession.combat || {}),
        step: "attackers",
        attackerIds: [...new Set([...(nextSession.combat?.attackerIds || []), ...attackers.map((attacker) => attacker.id)])],
      },
    };
    damage = attackers.reduce((total, attacker) => total + Number(attacker.currentPower || attacker.basePower || 0), 0);
    nextSession = applyCombatDamageToSimulationTarget(nextSession, simulation, npc, attackTargetId, attackers);
    const targetAfterDamage = nextSession.simulation?.players?.[attackTargetId];
    const targetLife = Number(targetAfterDamage?.life ?? 0);
    damage = Math.max(0, damage);
    if (targetAfterDamage?.eliminated) {
      nextSession = appendSimulationEffectLog(nextSession, `${attackTargetName} is eliminated by combat damage.`);
    } else {
      nextSession = appendSimulationEffectLog(nextSession, `${npc.name} damages ${attackTargetName} (${targetLife} life remaining).`);
    }
  }

  const updatedNpc = {
    ...npc,
    lastAttackTargetId: attackers.length ? attackTargetId : npc.lastAttackTargetId || "",
    currentPhaseIndex: 3,
    updatedAt: Date.now(),
  };
  return {
    ...nextSession,
    phaseIndex: 2,
    simulation: appendSimulationLog(
      withNpcUpdated(simulation, updatedNpc, {
        currentPhaseIndex: 3,
        updatedAt: Date.now(),
      }),
      createSimLog(
        npc.id,
        attackers.length ? `${npc.name} attacks ${attackTargetName} for ${damage}.` : `${npc.name} skips combat.`
      )
    ),
  };
}

function applyNpcSecondMainStep(session, npc, simulation, simulationMemory = {}) {
  let nextSession = session;
  let updatedNpc = { ...npc };
  let actionText = `${npc.name} passes Main 2.`;
  const commanderCast = maybeCastNpcCommander(nextSession, updatedNpc, { conservative: true });
  if (commanderCast) {
    nextSession = commanderCast.session;
    updatedNpc = commanderCast.npc;
    actionText = `${npc.name} casts commander ${updatedNpc.commander.card.name} in Main 2.`;
  } else {
  const castIndex = chooseNpcCastIndex(updatedNpc, nextSession, simulationMemory, { secondary: true });
  if (castIndex >= 0) {
    const castCard = updatedNpc.zones.hand[castIndex];
    updatedNpc.zones.hand = updatedNpc.zones.hand.filter((_, index) => index !== castIndex);
    const castResult = resolveNpcCast(nextSession, updatedNpc, castCard, simulationMemory);
    nextSession = castResult.session;
    updatedNpc = castResult.npc;
    actionText = `${npc.name} casts ${castCard.name} in Main 2.`;
  }
  }

  updatedNpc.currentPhaseIndex = 4;
  updatedNpc.updatedAt = Date.now();
  return {
    ...nextSession,
    phaseIndex: 3,
    simulation: appendSimulationLog(
      withNpcUpdated(simulation, updatedNpc, {
        currentPhaseIndex: 4,
        updatedAt: Date.now(),
      }),
      createSimLog(npc.id, actionText)
    ),
  };
}

function advanceSimulationTurn(session, reason = "end-step") {
  const preparedSession = ensureSimulationPlayerState(session);
  const simulation = preparedSession.simulation || {};
  if (!simulation.enabled) {
    return preparedSession;
  }
  if (simulation.winnerId) {
    return concludeSimulationSession(preparedSession, simulation.winnerId, reason);
  }
  const activeTurnOrder = getActiveSimulationTurnOrder(simulation);
  if (activeTurnOrder.length <= 1) {
    const winnerId = activeTurnOrder[0] || "local-player";
    return concludeSimulationSession(preparedSession, winnerId, "last-player-standing");
  }
  const currentPlayerId = simulation.currentPlayerId || activeTurnOrder[0];
  const currentOrderIndex = Math.max(0, activeTurnOrder.indexOf(currentPlayerId));
  const nextOrderIndex = (currentOrderIndex + 1) % activeTurnOrder.length;
  const nextPlayerId = activeTurnOrder[nextOrderIndex] || "local-player";
  const turnOrder = simulation.turnOrder || activeTurnOrder;
  const nextTurnIndex = Math.max(0, turnOrder.indexOf(nextPlayerId));
  const baseRound = Math.max(simulation.round || 1, session.turn || 1);
  const nextRound = nextOrderIndex === 0 ? baseRound + 1 : baseRound;
  const nextOpponents = Object.fromEntries(
    Object.entries(simulation.opponents || {}).map(([id, npc]) => [
      id,
      {
        ...npc,
        landPlaysThisTurn: 0,
        currentPhaseIndex: id === nextPlayerId ? 0 : npc.currentPhaseIndex || 0,
        updatedAt: Date.now(),
      },
    ])
  );
  const statusText = nextPlayerId === "local-player" ? "Your turn started." : `${nextOpponents[nextPlayerId]?.name || nextPlayerId} turn started.`;
  const nextSimulation = appendSimulationLog(
    {
      ...simulation,
      turnOrder,
      opponents: nextOpponents,
      turnIndex: nextTurnIndex,
      currentPlayerId: nextPlayerId,
      currentPhaseIndex: 0,
      waitingForUser: nextPlayerId === "local-player",
      round: nextRound,
      updatedAt: Date.now(),
    },
    createSimLog(nextPlayerId === "local-player" ? "system" : nextPlayerId, statusText, reason)
  );
  return {
    ...preparedSession,
    turn: nextRound,
    phaseIndex: 4,
    combat: {
      ...(preparedSession.combat || {}),
      attackerIds: [],
      blockersByAttacker: {},
      lines: [],
    },
    battlefield: {
      ...preparedSession.battlefield,
      opponent: (preparedSession.battlefield.opponent || []).map((permanent) =>
        createPermanent({
          ...permanent,
          attacking: false,
          blocking: false,
          summoningSick: false,
        })
      ),
    },
    simulation: nextSimulation,
  };
}

function resolveNpcCast(session, npc, card, simulationMemory = {}) {
  if (isType(card, "Instant") || isType(card, "Sorcery")) {
    const targetId = chooseThreatTargetId(session, simulationMemory, npc.id);
    const preparedSession = {
      ...session,
      selectedIds: targetId ? [targetId] : [],
      simulation: {
        ...session.simulation,
        opponents: {
          ...(session.simulation?.opponents || {}),
          [npc.id]: npc,
        },
      },
    };
    const resolved = resolveSpell(preparedSession, { ...card, controller: npc.id, owner: npc.id, zone: "hand" }, {
      controller: npc.id,
      sourceZone: "hand",
      targetIds: targetId ? [targetId] : [],
      autoChoose: true,
      xValue: chooseNpcXValue(session, npc, card),
    });
    const resolvedNpc = resolved.simulation?.opponents?.[npc.id] || npc;
    return {
      session: appendSimulationEffectLog(
        {
          ...resolved,
          selectedIds: [],
        },
        `${npc.name} resolves ${card.name}${targetId ? " against a high-threat target" : ""}.`
      ),
      npc: {
        ...resolvedNpc,
        zones: {
          ...resolvedNpc.zones,
          hand: (resolvedNpc.zones?.hand || []).filter((entry) => entry.cardId !== card.cardId),
        },
      },
    };
  }
  return {
    session: addOpponentCardToBattlefield(session, card, npc.id),
    npc: {
      ...npc,
      zones: {
        ...npc.zones,
        battlefield: [...(npc.zones?.battlefield || []), card],
      },
    },
  };
}

function chooseNpcXValue(session, npc, card) {
  if (!/\{x\}|\bx\b/i.test(`${card.manaCost || ""} ${card.oracleText || ""}`)) {
    return undefined;
  }
  const available = getNpcAvailableMana(session, npc.id);
  const fixedCost = Math.max(0, Number(card.manaValue || 0) - 1);
  return Math.max(0, available - fixedCost);
}

function chooseNpcCastIndex(npc, session, simulationMemory = {}, options = {}) {
  const hand = npc.zones.hand || [];
  if (!hand.length) {
    return -1;
  }
  const availableMana = getNpcAvailableMana(session, npc.id);
  const castable = hand
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => !isType(card, "Land") && Number(card.manaValue || 0) <= availableMana);
  if (!castable.length) {
    return -1;
  }
  const scored = castable
    .map((entry) => ({
      ...entry,
      score: getNpcCardPriority(entry.card, simulationMemory, { ...options, npc, session }),
    }))
    .sort((left, right) => right.score - left.score);
  return scored[0]?.index ?? -1;
}

function maybeCastNpcCommander(session, npc, options = {}) {
  if (npc.commander?.zone !== "command" || !npc.commander?.card) {
    return null;
  }
  const availableMana = getNpcAvailableMana(session, npc.id);
  const commanderValue = Number(npc.commander.card.manaValue || 0);
  const tax = Number(npc.commander.tax || 0);
  const totalCost = commanderValue + tax;
  if (!Number.isFinite(totalCost) || totalCost <= 0 || totalCost > availableMana) {
    return null;
  }
  if (options.conservative && availableMana <= totalCost + 1) {
    return null;
  }
  const castCard = {
    ...npc.commander.card,
    unresolvedDefinition: false,
    isCommander: true,
  };
  const nextSession = addOpponentCardToBattlefield(session, castCard, npc.id);
  return {
    session: nextSession,
    npc: {
      ...npc,
      commander: {
        ...npc.commander,
        zone: "battlefield",
        castCount: Number(npc.commander.castCount || 0) + 1,
      },
      zones: {
        ...npc.zones,
        command: [],
        battlefield: [...(npc.zones?.battlefield || []), castCard],
      },
    },
  };
}

function npcStrategyTags(npc) {
  return new Set((npc?.strategy?.tags || []).map((tag) => String(tag || "").toLowerCase()));
}

function getNpcCardPriority(card, simulationMemory = {}, options = {}) {
  let score = 1;
  const strategyTags = npcStrategyTags(options.npc);
  const priorityCards = new Set((options.npc?.strategy?.threatPriorityCards || []).map((name) => String(name || "").toLowerCase()));
  const npcLearning = simulationMemory?.npcLearning?.[options.npc?.id || ""] || {};
  const learnedCardPriority = npcLearning.cardPriority || {};
  const learnedCardScore = Number(learnedCardPriority[card.name] || learnedCardPriority[String(card.name || "").toLowerCase()] || 0);
  if (isType(card, "Creature")) {
    score += 4;
  }
  if (isType(card, "Instant") || isType(card, "Sorcery")) {
    score += 3;
  }
  if (isType(card, "Artifact") || isType(card, "Enchantment")) {
    score += 2;
  }
  if (priorityCards.has(String(card.name || "").toLowerCase())) {
    score += 6;
  }
  if (strategyTags.has("landfall") && /land|reclamation|tracker|baloths|gitrog/i.test(card.name || "")) {
    score += 4;
  }
  if (strategyTags.has("spellslinger") && (isType(card, "Instant") || isType(card, "Sorcery"))) {
    score += 3;
  }
  const oracle = String(card.oracleText || "").toLowerCase();
  const ownBoardCount = (options.session?.battlefield?.opponent || []).filter((permanent) => permanent.controller === options.npc?.id).length;
  const opposingBoardCount =
    (options.session?.battlefield?.player || []).length +
    (options.session?.battlefield?.opponent || []).filter((permanent) => permanent.controller !== options.npc?.id).length;
  if (/search your library for .*(?:land|forest|island|swamp|mountain|plains)/.test(oracle) && getNpcAvailableMana(options.session || {}, options.npc?.id) <= 5) {
    score += 6;
  }
  if (/\bdraw\b/.test(oracle) && (options.npc?.zones?.hand || []).length <= 4) {
    score += 5;
  }
  if (/destroy target|exile target|return target/.test(oracle) && opposingBoardCount > 0) {
    score += 5;
  }
  if (/all creatures|all nonland permanents|all colored permanents/.test(oracle) && opposingBoardCount >= ownBoardCount + 2) {
    score += 8;
  }
  if (/copy target|copy that spell/.test(oracle) && (options.session?.stack || []).length) {
    score += 7;
  }
  if (strategyTags.has("colorless-ramp") && (isType(card, "Artifact") || /eldrazi|kozilek|ugin/i.test(card.name || ""))) {
    score += 4;
  }
  if ((simulationMemory.patterns?.tokenStrategy || 0) >= 2 && /destroy|exile/i.test(card.oracleText || "")) {
    score += 4;
  }
  score += learnedCardScore;
  score += Math.max(0, Number(npcLearning.aggression || 0)) * 0.15;
  if (options.secondary) {
    score -= 1;
  }
  return score;
}

function getNpcAvailableMana(session, npcId) {
  return (session.battlefield.opponent || []).reduce((sum, permanent) => {
    if (permanent.controller !== npcId) {
      return sum;
    }
    if (permanent.isLand) {
      return sum + (permanent.quantity || 1);
    }
    if (permanent.isArtifact && /mana|ramp|relic/i.test(`${permanent.name} ${permanent.oracleText}`)) {
      return sum + 1;
    }
    return sum;
  }, 0);
}

function addOpponentCardToBattlefield(session, card, controllerId) {
  const permanent = toOpponentPermanent(card, controllerId);
  const withEntry = emitPermanentEntryTriggerEvents(
    {
      ...session,
      battlefield: {
        ...session.battlefield,
        opponent: stackBattlefieldPermanent(session.battlefield.opponent || [], permanent),
      },
    },
    permanent,
    {
      instances: permanent.quantity || 1,
      cause: "simulation-cast",
    }
  );
  if (!card.unresolvedDefinition) {
    return withEntry;
  }
  return {
    ...withEntry,
    effectLog: [
      {
        id: createId("sim-unresolved"),
        at: Date.now(),
        sourceName: "Simulation Parser",
        summary: `Unresolved card definition retained for ${card.name}.`,
        status: "manual-choice-required",
      },
      ...(withEntry.effectLog || []),
    ].slice(0, 160),
  };
}

function chooseThreatTargetId(session, simulationMemory = {}, actingNpcId = "") {
  const threats = [
    ...(session.battlefield.player || []),
    ...(session.battlefield.opponent || []).filter((permanent) => permanent.controller !== actingNpcId),
  ];
  if (!threats.length) {
    return "";
  }
  const memory = simulationMemory.cardThreat || {};
  const winMemory = simulationMemory.repeatedWinConditions || {};
  const npcLearning = simulationMemory?.npcLearning?.[actingNpcId] || {};
  const targetPriority = npcLearning.targetPriority || {};
  const ranked = threats
    .map((permanent) => {
      let score = Number(memory[permanent.name] || 0);
      score += Number(winMemory[permanent.name] || 0);
      score += Number(targetPriority[permanent.controller === "player" ? "local-player" : permanent.controller] || 0);
      if (permanent.isCommander) {
        score += 5;
      }
      if (permanent.isToken) {
        score += 2;
      }
      if ((permanent.currentPower || permanent.basePower || 0) >= 5) {
        score += 3;
      }
      if (/doubling season|cathars' crusade|scute swarm/i.test(permanent.name || "")) {
        score += 6;
      }
      return { id: permanent.id, score };
    })
    .sort((left, right) => right.score - left.score);
  return ranked[0]?.id || "";
}

function buildSimulationConnectedPlayers(profile, opponents = {}) {
  return [
    { id: "local-player", name: profile.player?.name || "Player", authority: "host", role: "player" },
    ...Object.values(opponents).map((npc) => ({
      id: npc.id,
      name: npc.name,
      authority: "guest",
      role: "player",
      publicBoardSnapshot: createNpcPublicSnapshot(npc),
    })),
  ];
}

function ensureSimulationPlayerState(session) {
  const simulation = session.simulation || {};
  if (!simulation.enabled) {
    return session;
  }
  const turnOrder = (simulation.turnOrder || []).length
    ? [...simulation.turnOrder]
    : ["local-player", ...Object.keys(simulation.opponents || {})];
  const existingPlayers = simulation.players || {};
  const nextPlayers = {};
  const nextOpponents = { ...(simulation.opponents || {}) };
  let changed = !sameOrderedValues(turnOrder, simulation.turnOrder || []);

  turnOrder.forEach((playerId) => {
    const previous = existingPlayers[playerId] || {};
    const isLocal = playerId === "local-player";
    const npc = isLocal ? null : nextOpponents[playerId];
    const baseLife = isLocal ? Number(session.life || previous.life || 40) : Number(npc?.life ?? previous.life ?? 40);
    const commanderDamageFrom = { ...(previous.commanderDamageFrom || (isLocal ? {} : npc?.commanderDamageFrom || {})) };
    const commanderDamageBy = { ...(previous.commanderDamageBy || {}) };
    const eliminatedByCommander = Object.values(commanderDamageFrom).some((value) => Number(value || 0) >= 21);
    const eliminated = Boolean(previous.eliminated || baseLife <= 0 || eliminatedByCommander);
    const normalizedPlayer = {
      id: playerId,
      name: isLocal ? previous.name || "Player" : previous.name || npc?.name || playerId,
      life: Number.isFinite(baseLife) ? baseLife : 40,
      eliminated,
      isNpc: !isLocal,
      commanderDamageFrom,
      commanderDamageBy,
    };
    nextPlayers[playerId] = sameSimulationPlayer(previous, normalizedPlayer) ? previous : normalizedPlayer;
    changed ||= nextPlayers[playerId] !== previous;
    if (!isLocal && npc) {
      const npcNeedsUpdate =
        Number(npc.life ?? 40) !== nextPlayers[playerId].life ||
        !sameNumericRecord(npc.commanderDamageFrom || {}, commanderDamageFrom);
      if (npcNeedsUpdate) {
        nextOpponents[playerId] = {
          ...npc,
          life: nextPlayers[playerId].life,
          commanderDamageFrom,
        };
        changed = true;
      }
    }
  });

  const eliminatedPlayerIds = Object.values(nextPlayers)
    .filter((player) => player.eliminated)
    .map((player) => player.id);
  const nextLife = Math.max(0, Number(nextPlayers["local-player"]?.life ?? session.life ?? 40));
  changed ||= nextLife !== session.life;
  changed ||= !sameOrderedValues(eliminatedPlayerIds, simulation.eliminatedPlayerIds || []);
  changed ||= Object.keys(existingPlayers).length !== Object.keys(nextPlayers).length;

  if (!changed) {
    return session;
  }

  return {
    ...session,
    life: nextLife,
    simulation: {
      ...simulation,
      turnOrder,
      players: nextPlayers,
      opponents: nextOpponents,
      eliminatedPlayerIds,
    },
  };
}

function sameSimulationPlayer(left = {}, right = {}) {
  return (
    left.id === right.id &&
    left.name === right.name &&
    Number(left.life) === Number(right.life) &&
    Boolean(left.eliminated) === Boolean(right.eliminated) &&
    Boolean(left.isNpc) === Boolean(right.isNpc) &&
    sameNumericRecord(left.commanderDamageFrom || {}, right.commanderDamageFrom || {}) &&
    sameNumericRecord(left.commanderDamageBy || {}, right.commanderDamageBy || {})
  );
}

function sameNumericRecord(left = {}, right = {}) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => Number(left[key] || 0) === Number(right[key] || 0));
}

function sameOrderedValues(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function getActiveSimulationTurnOrder(simulation = {}) {
  const players = simulation.players || {};
  return (simulation.turnOrder || [])
    .filter((id) => Boolean(players[id]))
    .filter((id) => !players[id].eliminated);
}

function getSimulationPlayerName(simulation = {}, playerId = "") {
  if (!playerId) {
    return "Unknown";
  }
  if (playerId === "local-player") {
    return simulation.players?.["local-player"]?.name || "Player";
  }
  return simulation.players?.[playerId]?.name || simulation.opponents?.[playerId]?.name || playerId;
}

function getControllerBattlefieldThreat(session, controllerId) {
  const permanents =
    controllerId === "local-player"
      ? session.battlefield.player || []
      : (session.battlefield.opponent || []).filter((permanent) => permanent.controller === controllerId);
  return permanents.reduce((score, permanent) => {
    let nextScore = score + 1;
    if (permanent.isCommander) {
      nextScore += 6;
    }
    if (permanent.isToken) {
      nextScore += 2;
    }
    if (permanent.isCreature) {
      nextScore += Math.max(1, Number(permanent.currentPower || permanent.basePower || 0));
    }
    if (/doubling season|cathars' crusade|scute swarm|zhulodok|stella lee|hearthhull|szarel|kozilek/i.test(permanent.name || "")) {
      nextScore += 7;
    }
    return nextScore;
  }, 0);
}

function chooseNpcAttackTargetId(session, simulation, npc, simulationMemory = {}) {
  const activeTargets = getActiveSimulationTurnOrder(simulation).filter((playerId) => playerId !== npc.id);
  if (!activeTargets.length) {
    return "local-player";
  }
  const npcLearning = simulationMemory?.npcLearning?.[npc.id] || {};
  const targetPriority = npcLearning.targetPriority || {};
  const learnedAggression = Math.max(0, Number(npcLearning.aggression || 0));
  const ranked = activeTargets
    .map((playerId) => {
      const player = simulation.players?.[playerId];
      const boardThreat = getControllerBattlefieldThreat(session, playerId);
      const lifePressure = Math.max(0, 40 - Number(player?.life || 40));
      const eliminationPressure = Number(player?.life || 40) <= 8 ? 8 : 0;
      const revengePressure =
        playerId === "local-player"
          ? (Number(simulationMemory.patterns?.comboEngineStrategy || 0) +
              Number(simulationMemory.patterns?.tokenStrategy || 0) +
              Number(simulationMemory.patterns?.commanderDamageStrategy || 0)) * 0.35
          : 0;
      const learnedPriority = Number(targetPriority[playerId] || 0);
      const spreadPenalty =
        activeTargets.length > 2 && npc.lastAttackTargetId && npc.lastAttackTargetId === playerId
          ? -2
          : 0;
      const localNeutralPenalty =
        playerId === "local-player" &&
        boardThreat <= 1 &&
        learnedPriority <= 0 &&
        revengePressure <= 1
          ? -1.4
          : 0;
      const tieBreaker = deterministicTargetBias(`${npc.id}:${playerId}:${simulation.round || 1}`);
      const score =
        boardThreat +
        lifePressure +
        eliminationPressure +
        revengePressure +
        learnedPriority +
        learnedAggression * 0.2 +
        spreadPenalty +
        localNeutralPenalty +
        tieBreaker;
      return { playerId, score };
    })
    .sort((left, right) => right.score - left.score);
  return ranked[0]?.playerId || activeTargets[0];
}

function deterministicTargetBias(seed = "") {
  const value = String(seed || "");
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 9973;
  }
  return (hash % 19) / 100;
}

function appendSimulationEffectLog(session, summary = "") {
  if (!summary) {
    return session;
  }
  return {
    ...session,
    effectLog: [
      {
        id: createId("sim-effect"),
        at: Date.now(),
        sourceName: "Simulation",
        summary,
      },
      ...(session.effectLog || []),
    ].slice(0, 180),
  };
}

function applyCombatDamageToSimulationTarget(session, simulation, npc, targetId, attackers = []) {
  if (!targetId) {
    return session;
  }
  const nextSession = ensureSimulationPlayerState(session);
  const nextSimulation = nextSession.simulation || {};
  const players = { ...(nextSimulation.players || {}) };
  if (!players[targetId]) {
    return nextSession;
  }
  const totalDamage = attackers.reduce((sum, attacker) => sum + Math.max(0, Number(attacker.currentPower || attacker.basePower || 0)), 0);
  const target = {
    ...(players[targetId] || {}),
    commanderDamageFrom: { ...(players[targetId]?.commanderDamageFrom || {}) },
  };
  const wasEliminated = Boolean(target.eliminated);
  const source = {
    ...(players[npc.id] || {}),
    commanderDamageBy: { ...(players[npc.id]?.commanderDamageBy || {}) },
  };
  target.life = Math.max(0, Number(target.life || 0) - totalDamage);
  attackers.forEach((attacker) => {
    const isCommanderAttack = Boolean(attacker.isCommander || attacker.name === npc.commander?.card?.name);
    if (!isCommanderAttack) {
      return;
    }
    const commanderKey = npc.commander?.card?.name || npc.id;
    const attackerDamage = Math.max(0, Number(attacker.currentPower || attacker.basePower || 0));
    target.commanderDamageFrom[commanderKey] = Number(target.commanderDamageFrom[commanderKey] || 0) + attackerDamage;
    source.commanderDamageBy[commanderKey] = Number(source.commanderDamageBy[commanderKey] || 0) + attackerDamage;
  });
  const commanderDamageLoss = Object.entries(target.commanderDamageFrom || {}).find(([, value]) => Number(value || 0) >= 21);
  target.eliminated = target.life <= 0 || Boolean(commanderDamageLoss);
  players[targetId] = target;
  players[npc.id] = source;
  const opponents = { ...(nextSimulation.opponents || {}) };
  if (targetId !== "local-player" && opponents[targetId]) {
    opponents[targetId] = {
      ...opponents[targetId],
      life: target.life,
      commanderDamageFrom: { ...(target.commanderDamageFrom || {}) },
      updatedAt: Date.now(),
    };
  }
  if (opponents[npc.id]) {
    opponents[npc.id] = {
      ...opponents[npc.id],
      updatedAt: Date.now(),
    };
  }
  const eliminatedPlayerIds = Object.values(players)
    .filter((player) => player?.eliminated)
    .map((player) => player.id);
  const eliminationReason = commanderDamageLoss ? "commander-damage" : "combat-damage";
  const eliminationEntry =
    !wasEliminated && target.eliminated
      ? {
          id: createId("sim-elim"),
          at: Date.now(),
          byPlayerId: npc.id,
          targetPlayerId: targetId,
          reason: eliminationReason,
          commanderSource: commanderDamageLoss?.[0] || "",
        }
      : null;
  return {
    ...nextSession,
    life: targetId === "local-player" ? target.life : nextSession.life,
    simulation: {
      ...nextSimulation,
      players,
      opponents,
      eliminatedPlayerIds,
      eliminations: eliminationEntry
        ? [eliminationEntry, ...(nextSimulation.eliminations || [])].slice(0, 80)
        : nextSimulation.eliminations || [],
      updatedAt: Date.now(),
    },
  };
}

function concludeSimulationSession(session, winnerId, reason = "completed") {
  const preparedSession = ensureSimulationPlayerState(session);
  const simulation = preparedSession.simulation || {};
  if (!simulation.enabled) {
    return preparedSession;
  }
  const winnerName = getSimulationPlayerName(simulation, winnerId);
  return {
    ...preparedSession,
    simulation: appendSimulationLog(
      {
        ...simulation,
        status: "completed",
        waitingForUser: true,
        winnerId,
        updatedAt: Date.now(),
      },
      createSimLog("system", `Simulation complete. Winner: ${winnerName}.`, reason)
    ),
    gameTracking: {
      ...(preparedSession.gameTracking || {}),
      active: false,
      mode: "training-ground",
    },
  };
}

function appendSimulationLog(simulation, entry) {
  return {
    ...simulation,
    log: [entry, ...(simulation.log || [])].slice(0, 120),
    updatedAt: Date.now(),
  };
}

function withNpcUpdated(simulation, npc, overrides = {}) {
  return {
    ...simulation,
    opponents: {
      ...(simulation.opponents || {}),
      [npc.id]: npc,
    },
    ...overrides,
  };
}

function isType(card, typeName) {
  return String(card?.typeLine || "").toLowerCase().includes(String(typeName || "").toLowerCase());
}

function updatePlayerCounter(session, counter = "custom", amount = 1) {
  const current = normalizeCount(session.playerCounters?.[counter]);
  return {
    ...session,
    playerCounters: {
      ...(session.playerCounters || {}),
      [counter]: Math.max(0, current + Number(amount || 0)),
    },
  };
}

function updateCommanderDamage(session, opponentId, amount = 1) {
  const current = normalizeCount(session.commander.damageByOpponent?.[opponentId]);
  return {
    ...session,
    commander: {
      ...session.commander,
      damageByOpponent: {
        ...(session.commander.damageByOpponent || {}),
        [opponentId]: Math.max(0, current + Number(amount || 0)),
      },
    },
  };
}

function setCommanderDamage(session, opponentId, value = 0) {
  return {
    ...session,
    commander: {
      ...session.commander,
      damageByOpponent: {
        ...(session.commander.damageByOpponent || {}),
        [opponentId]: normalizeCount(value),
      },
    },
  };
}

function resetPlayerTrackers(session) {
  return {
    ...session,
    life: 40,
    playerCounters: {},
    manaPool: createManaPool(),
    commander: {
      ...session.commander,
      damageByOpponent: {},
    },
  };
}

function applyCounterToSelected(session, event) {
  return (session.selectedIds || []).reduce(
    (nextSession, id) => applyCounterToSession(nextSession, { ...event, id }),
    session
  );
}

function applyCounterScopeProfile(profile, event) {
  const counterType = String(event.counterType || "+1/+1").trim() || "+1/+1";
  const amount = Math.max(1, normalizeCount(event.amount, 1));
  const scope = event.scope || "selected";
  const session = applyCounterScope(profile.activeSession, { scope, counterType, amount });
  const recent = [counterType, ...(profile.settings?.recentCounterTypes || []).filter((entry) => entry !== counterType)].slice(0, 5);
  return {
    ...withSession(profile, session),
    settings: {
      ...(profile.settings || {}),
      recentCounterTypes: recent,
    },
  };
}

function applyCounterScope(session, event) {
  const selected = new Set(session.selectedIds || []);
  const matchesScope = (permanent) => {
    if (event.scope === "all-creatures") {
      return permanent.isCreature;
    }
    if (event.scope === "all-permanents") {
      return true;
    }
    if (event.scope === "all-tokens") {
      return permanent.isToken;
    }
    return selected.has(permanent.id);
  };
  const mapSide = (side) =>
    side.map((permanent) =>
      matchesScope(permanent)
        ? hydratePermanentEffects({
            ...permanent,
            counters: {
              ...permanent.counters,
              [event.counterType]: normalizeCount(permanent.counters?.[event.counterType]) + event.amount,
            },
          })
        : permanent
    );
  return recalculateContinuousEffects({
    ...session,
    battlefield: {
      ...session.battlefield,
      player: mapSide(session.battlefield.player),
      opponent: mapSide(session.battlefield.opponent),
    },
  });
}

function syncPublicStats(profile) {
  const session = profile.activeSession;
  const publicSummary = {
    playerName: profile.player?.name || "Player",
    life: session.life,
    turn: session.turn,
    boardSize: session.battlefield.player.reduce((sum, permanent) => sum + permanent.quantity, 0),
    actionsThisGame: session.history.length,
    triggersResolved: session.effectLog.length,
    syncedAt: Date.now(),
  };
  const connectedPlayers = profile.settings?.multiplayer?.connectedPlayers || [];
  return {
    ...profile,
    statsSync: {
      lastSyncedAt: Date.now(),
      publicSummary,
      peers: connectedPlayers
        .filter((player) => player.id !== "local-player")
        .map((player) => ({
          id: player.id,
          name: player.name,
          boardSize: publicSummary.boardSize,
          comparedAt: Date.now(),
        })),
    },
  };
}

function startGameTracking(session, settings = {}) {
  if (session.gameTracking?.active) {
    return session;
  }
  const now = Date.now();
  const multiplayerMode = settings?.multiplayer?.mode || "offline";
  const isSyncedMultiplayer = multiplayerMode === "local" || multiplayerMode === "wifi";
  const synced = session.syncedMultiplayer || {};
  const hasConfirmedTurnOrder = Boolean(synced.confirmed && Array.isArray(synced.turnOrder) && synced.turnOrder.length > 0);
  const syncedMultiplayer = isSyncedMultiplayer
    ? {
        ...synced,
        active: true,
        pendingConfirmation: !hasConfirmedTurnOrder,
        confirmed: hasConfirmedTurnOrder,
        currentPlayerId: hasConfirmedTurnOrder ? synced.turnOrder[0] : synced.currentPlayerId || "local-player",
        currentPlayerIndex: hasConfirmedTurnOrder ? 0 : Number(synced.currentPlayerIndex || 0),
        startedAt: now,
        updatedAt: now,
      }
    : synced;
  return {
    ...session,
    gameTracking: {
      active: true,
      startedAt: now,
      mode: "active-game",
    },
    syncedMultiplayer,
    effectLog: [
      {
        id: createId("game-start"),
        at: now,
        sourceName: "Game Tracking",
        summary:
          isSyncedMultiplayer && !hasConfirmedTurnOrder
            ? "Game tracking started. Confirm multiplayer turn order before advancing phases."
            : "Game tracking started.",
      },
      ...(session.effectLog || []),
    ].slice(0, 120),
  };
}

function stopGameTracking(session) {
  if (!session.gameTracking?.active) {
    return session;
  }
  const now = Date.now();
  return {
    ...session,
    gameTracking: {
      active: false,
      startedAt: session.gameTracking?.startedAt || 0,
      mode: "training-ground",
    },
    syncedMultiplayer: {
      ...(session.syncedMultiplayer || {}),
      active: false,
      updatedAt: now,
    },
    effectLog: [
      {
        id: createId("game-stop"),
        at: now,
        sourceName: "Game Tracking",
        summary: "Game tracking stopped. Training ground remains active.",
      },
      ...(session.effectLog || []),
    ].slice(0, 120),
  };
}

function activateBoardState(session) {
  const recalculated = recalculateContinuousEffects(session);
  const pending = collectManualChoiceEffects(recalculated);
  const nextPending = [...pending, ...(recalculated.pendingEffects || [])].slice(0, 120);
  return {
    ...recalculated,
    pendingEffects: nextPending,
    effectLog: [
      {
        id: createId("board-activate"),
        at: Date.now(),
        sourceName: "Training Ground",
        summary: `Activate Board evaluated ${getAllPermanents(recalculated).length} permanents and queued ${pending.length} manual choice item(s).`,
      },
      ...(recalculated.effectLog || []),
    ].slice(0, 160),
  };
}

function collectManualChoiceEffects(session) {
  const existing = new Set((session.pendingEffects || []).map((entry) => `${entry.sourceId}:${entry.effect?.action || entry.summary}`));
  const results = [];
  getAllPermanents(session).forEach((permanent) => {
    (permanent.parsedEffects || []).forEach((effect) => {
      if (!effect.manual) {
        return;
      }
      const key = `${permanent.id}:${effect.action || effect.reason || "manual"}`;
      if (existing.has(key)) {
        return;
      }
      existing.add(key);
      results.push({
        id: createId("pending"),
        sourceId: permanent.id,
        sourceName: permanent.name,
        effect,
        summary: `manual choice required: ${effect.reason || effect.summary || effect.action || "effect"}`,
        status: "pending",
        createdAt: Date.now(),
        eventType: "BOARD_ACTIVATE",
        triggerId: "",
      });
    });
  });
  return results;
}

function reconcileSimulationCompletion(profile, previousProfile, actionType, event) {
  const simulation = profile.activeSession?.simulation || {};
  if (!simulation.enabled) {
    return profile;
  }
  let nextProfile = profile;
  let session = ensureSimulationPlayerState(nextProfile.activeSession);
  if (session !== nextProfile.activeSession) {
    nextProfile = withSession(nextProfile, session);
  }
  const normalizedSimulation = nextProfile.activeSession.simulation || {};
  if (normalizedSimulation.status === "running") {
    const activePlayers = getActiveSimulationTurnOrder(normalizedSimulation);
    if (activePlayers.length <= 1) {
      const winnerId = activePlayers[0] || normalizedSimulation.winnerId || "local-player";
      nextProfile = withSession(nextProfile, concludeSimulationSession(nextProfile.activeSession, winnerId, "state-check"));
    }
  }
  const completedSimulation = nextProfile.activeSession?.simulation || {};
  if (completedSimulation.status !== "completed" || completedSimulation.statsRecorded) {
    return nextProfile;
  }
  return applySimulationStatsResult(nextProfile, previousProfile, actionType, event);
}

function applySimulationStatsResult(profile, previousProfile, actionType, event) {
  const simulation = profile.activeSession?.simulation || {};
  if (!simulation.winnerId) {
    return profile;
  }
  const previousStats = profile.simulationStats || createEmptySimulationStats();
  const stats = {
    ...previousStats,
    user: { ...(previousStats.user || {}) },
    alpha: { ...(previousStats.alpha || {}) },
    beta: { ...(previousStats.beta || {}) },
    omega: { ...(previousStats.omega || {}) },
    mostThreateningCards: { ...(previousStats.mostThreateningCards || {}) },
    mostTargetedCards: { ...(previousStats.mostTargetedCards || {}) },
    mostValuableCards: { ...(previousStats.mostValuableCards || {}) },
    history: [...(previousStats.history || [])],
  };

  const participants = ["local-player", ...(simulation.selectedOpponents || [])].filter((id, index, array) => id && array.indexOf(id) === index);
  const winnerId = simulation.winnerId;
  const turnCount = Math.max(1, Number(profile.activeSession?.turn || simulation.round || 1));
  const gamesPlayed = Number(stats.gamesPlayed || 0) + 1;
  const revengeEnabled = simulation.revengeEnabled !== false;
  const adjustmentsApplied = revengeEnabled ? Math.max(1, Number(simulation.strategyAdjustmentsApplied || 0) + 1) : 0;

  participants.forEach((playerId) => {
    const statsKey = mapSimulationPlayerToStatsKey(playerId);
    if (!stats[statsKey]) {
      return;
    }
    if (playerId === winnerId) {
      stats[statsKey].wins = Number(stats[statsKey].wins || 0) + 1;
    } else {
      stats[statsKey].losses = Number(stats[statsKey].losses || 0) + 1;
    }
  });

  (simulation.eliminations || []).forEach((elimination) => {
    const byKey = mapSimulationPlayerToStatsKey(elimination.byPlayerId);
    if (!stats[byKey]) {
      return;
    }
    stats[byKey].eliminations = Number(stats[byKey].eliminations || 0) + 1;
    if (elimination.reason === "commander-damage") {
      stats.commanderDamageEliminations = Number(stats.commanderDamageEliminations || 0) + 1;
    }
  });

  if (revengeEnabled) {
    const opponentIds = (simulation.selectedOpponents || []).filter(Boolean);
    opponentIds.forEach((npcId) => {
      const npcState = simulation.opponents?.[npcId];
      if (!npcState) {
        return;
      }
      const emphasisCards = npcState.strategy?.threatPriorityCards || [];
      emphasisCards.slice(0, 6).forEach((cardName) => {
        stats.mostThreateningCards[cardName] = Number(stats.mostThreateningCards[cardName] || 0) + 1;
      });
      if (winnerId !== npcId) {
        stats.mostTargetedCards[npcState.commander?.card?.name || npcState.commanderProfile?.primary || npcState.name] =
          Number(stats.mostTargetedCards[npcState.commander?.card?.name || npcState.commanderProfile?.primary || npcState.name] || 0) + 1;
      }
    });
  }

  (profile.activeSession?.effectLog || [])
    .slice(0, 16)
    .forEach((entry) => {
      const source = String(entry.sourceName || "").trim();
      if (!source || source === "Simulation") {
        return;
      }
      stats.mostValuableCards[source] = Number(stats.mostValuableCards[source] || 0) + 1;
    });

  stats.gamesPlayed = gamesPlayed;
  stats.averageTurnCount = Number(((Number(stats.averageTurnCount || 0) * (gamesPlayed - 1) + turnCount) / gamesPlayed).toFixed(2));
  stats.strategyAdjustmentsApplied = Number(stats.strategyAdjustmentsApplied || 0) + adjustmentsApplied;
  stats.history = [
    {
      id: createId("simstat"),
      at: Date.now(),
      format: simulation.format || inferSimulationFormat((simulation.selectedOpponents || []).length),
      winnerId,
      winnerName: getSimulationPlayerName(simulation, winnerId),
      turnCount,
      opponentsUsed: [...(simulation.selectedOpponents || [])],
      revengeEnabled,
      strategyAdjustmentsApplied: adjustmentsApplied,
      eliminations: [...(simulation.eliminations || [])],
      actionType,
      sourceAction: event?.type || event?.actionType || actionType,
    },
    ...stats.history,
  ].slice(0, 120);

  const nextProfile = {
    ...profile,
    simulationMemory: applyRevengeLearningFromSimulation(profile.simulationMemory || {}, simulation),
    simulationStats: stats,
    activeSession: {
      ...profile.activeSession,
      simulation: {
        ...simulation,
        statsRecorded: true,
        strategyAdjustmentsApplied: Number(simulation.strategyAdjustmentsApplied || 0) + adjustmentsApplied,
      },
    },
  };
  return nextProfile;
}

function mapSimulationPlayerToStatsKey(playerId = "") {
  if (playerId === "local-player") {
    return "user";
  }
  if (playerId === "alpha" || playerId === "beta" || playerId === "omega") {
    return playerId;
  }
  return "user";
}

function inferSimulationFormat(opponentCount = 1) {
  if (opponentCount <= 1) {
    return "1v1 Commander";
  }
  if (opponentCount === 2) {
    return "3-way Commander";
  }
  return "4-way Commander";
}

function applyRevengeLearningFromSimulation(memory = {}, simulation = {}) {
  if (simulation.revengeEnabled === false) {
    return memory;
  }

  const nextMemory = {
    ...memory,
    patterns: {
      ...(memory.patterns || {}),
    },
    cardThreat: {
      ...(memory.cardThreat || {}),
    },
    repeatedWinConditions: {
      ...(memory.repeatedWinConditions || {}),
    },
    npcLearning: {
      ...(memory.npcLearning || {}),
    },
    updatedAt: Date.now(),
  };

  const participants = ["local-player", ...(simulation.selectedOpponents || [])]
    .filter(Boolean)
    .filter((id, index, array) => array.indexOf(id) === index);
  const winnerId = simulation.winnerId || "local-player";
  const eliminations = simulation.eliminations || [];

  participants
    .filter((id) => id !== "local-player")
    .forEach((npcId) => {
      const previousLearning = nextMemory.npcLearning[npcId] || {};
      const targetPriority = { ...(previousLearning.targetPriority || {}) };
      const cardPriority = { ...(previousLearning.cardPriority || {}) };
      const knownThreats = { ...(previousLearning.knownThreats || {}) };
      let aggression = Number(previousLearning.aggression || 0);
      let defense = Number(previousLearning.defense || 0);
      let matchCount = Number(previousLearning.matchCount || 0) + 1;

      participants.forEach((targetId) => {
        if (targetId === npcId) {
          return;
        }
        targetPriority[targetId] = Number(targetPriority[targetId] || 0);
      });

      if (winnerId !== npcId) {
        targetPriority[winnerId] = Number(targetPriority[winnerId] || 0) + 2;
        defense += 1;
      } else {
        aggression += 1;
      }

      eliminations.forEach((entry) => {
        if (!entry) {
          return;
        }
        if (entry.byPlayerId === npcId) {
          targetPriority[entry.targetPlayerId] = Number(targetPriority[entry.targetPlayerId] || 0) + 1;
          aggression += entry.reason === "commander-damage" ? 2 : 1;
        }
        if (entry.targetPlayerId === npcId) {
          targetPriority[entry.byPlayerId] = Number(targetPriority[entry.byPlayerId] || 0) + 2;
          defense += 2;
        }
      });

      (simulation.opponents?.[winnerId]?.strategy?.threatPriorityCards || [])
        .slice(0, 6)
        .forEach((cardName) => {
          cardPriority[cardName] = Number(cardPriority[cardName] || 0) + 2;
          knownThreats[cardName] = Number(knownThreats[cardName] || 0) + 1;
        });

      (simulation.opponents?.[npcId]?.strategy?.revengeLearningFocus || [])
        .forEach((focus) => {
          const key = `${focus}`;
          knownThreats[key] = Number(knownThreats[key] || 0) + 1;
        });

      nextMemory.npcLearning[npcId] = {
        aggression,
        defense,
        matchCount,
        targetPriority,
        cardPriority,
        knownThreats,
        lastWinner: winnerId,
        lastUpdated: Date.now(),
      };
    });

  return nextMemory;
}

function updateSimulationMemory(profile, event, actionType) {
  if (event?.internalOnly || !profile?.activeSession?.simulation?.enabled) {
    return profile;
  }
  if (profile.activeSession.simulation.revengeEnabled === false) {
    return profile;
  }
  const memory = {
    ...(profile.simulationMemory || {}),
    patterns: {
      ...(profile.simulationMemory?.patterns || {}),
    },
    cardThreat: {
      ...(profile.simulationMemory?.cardThreat || {}),
    },
    repeatedWinConditions: {
      ...(profile.simulationMemory?.repeatedWinConditions || {}),
    },
    updatedAt: Date.now(),
  };

  const incrementPattern = (key, amount = 1) => {
    memory.patterns[key] = normalizeCount(memory.patterns[key], 0) + amount;
  };
  const bumpThreat = (name, amount = 1) => {
    if (!name) {
      return;
    }
    memory.cardThreat[name] = normalizeCount(memory.cardThreat[name], 0) + amount;
  };
  const bumpWinCondition = (name, amount = 1) => {
    if (!name) {
      return;
    }
    memory.repeatedWinConditions[name] = normalizeCount(memory.repeatedWinConditions[name], 0) + amount;
  };

  if (actionType === "ADD_CUSTOM_TOKEN") {
    incrementPattern("tokenStrategy", normalizeCount(event.quantity, 1));
  }
  if (actionType === "ADD_PERMANENT") {
    const typeLine = String(event.card?.typeLine || "").toLowerCase();
    if (typeLine.includes("land")) {
      incrementPattern("landfallStrategy");
    }
    if (typeLine.includes("artifact")) {
      incrementPattern("artifactsStrategy");
    }
    if (typeLine.includes("enchantment")) {
      incrementPattern("enchantmentsStrategy");
    }
    if (typeLine.includes("creature")) {
      bumpThreat(event.card?.name, 1);
    }
    if (/doubling season|cathars' crusade|scute swarm/i.test(event.card?.name || "")) {
      incrementPattern("comboEngineStrategy", 2);
      bumpThreat(event.card?.name, 3);
      bumpWinCondition(event.card?.name, 1);
    }
    if (/omnath, locus of rage|rampaging baloths|the gitrog monster|stella lee, wild card|zhulodok, void gorger/i.test(event.card?.name || "")) {
      bumpWinCondition(event.card?.name, 2);
    }
  }
  if (actionType === "LIFE_DELTA" && Number(event.amount || 0) > 0) {
    incrementPattern("lifegainStrategy");
  }
  if (actionType === "ADD_MANA" && Number(event.amount || 0) >= 2) {
    incrementPattern("fastManaStrategy");
  }
  if (actionType === "COMMANDER_DAMAGE_DELTA" && Number(event.amount || 0) > 0) {
    incrementPattern("commanderDamageStrategy");
  }
  if (actionType === "REMOVE_SELECTED" && String(event.mode || "").toLowerCase() === "destroy") {
    incrementPattern("boardWipeStrategy");
  }
  return {
    ...profile,
    simulationMemory: memory,
  };
}

function maybeAdvanceLocalSimulationTurn(profile, previousSession, actionType) {
  const simulation = profile.activeSession?.simulation;
  if (!simulation?.enabled || simulation.status !== "running") {
    return profile;
  }
  if (simulation.currentPlayerId !== "local-player") {
    return profile;
  }
  if (!["ADVANCE_PHASE", "SIMULATION_PASS_TURN"].includes(actionType)) {
    return profile;
  }
  if (actionType === "SIMULATION_PASS_TURN") {
    return profile;
  }
  const previousTurn = previousSession?.turn || 0;
  if (profile.activeSession.turn <= previousTurn || profile.activeSession.phaseIndex !== 0) {
    return profile;
  }
  const alignedSession = {
    ...profile.activeSession,
    simulation: {
      ...simulation,
      round: Math.max(simulation.round || 1, profile.activeSession.turn || 1),
      waitingForUser: false,
    },
  };
  return withSession(profile, advanceSimulationTurn(alignedSession, "local-turn-complete"));
}

function syncSimulationPresence(profile) {
  const simulation = profile.activeSession?.simulation;
  if (!simulation?.enabled) {
    return profile;
  }
  return {
    ...profile,
    settings: {
      ...(profile.settings || {}),
      multiplayer: {
        ...(profile.settings?.multiplayer || {}),
        mode: "simulated",
        connectedPlayers: buildSimulationConnectedPlayers(profile, simulation.opponents || {}),
      },
    },
  };
}

function advancePhase(session, multiplayerSettings = {}) {
  let transitioned = transitionFsm(session);
  const traversedStates = [transitioned];
  let guard = 0;
  while (
    guard < 24 &&
    transitioned.turn === session.turn &&
    transitioned.phaseIndex === session.phaseIndex
  ) {
    transitioned = transitionFsm(transitioned);
    traversedStates.push(transitioned);
    guard += 1;
  }
  const traversedPhases = traversedStates
    .map((state) => PHASES[state.phaseIndex] || "Beginning")
    .filter((phase, index, phases) => index === 0 || phase !== phases[index - 1]);
  const isNewTurn = transitioned.turn !== session.turn;
  const helperState = session.helper || {};
  const shouldReplayHelperReminder =
    isNewTurn &&
    transitioned.phaseIndex === 0 &&
    Boolean(helperState.reminderRequested) &&
    Array.isArray(helperState.reminderQueue) &&
    helperState.reminderQueue.length > 0;
  const nextSession = {
    ...transitioned,
    manaPool: createManaPool(),
    battlefield: {
      ...transitioned.battlefield,
      player: transitioned.battlefield.player.map((permanent) => ({
        ...permanent,
        tapped: isNewTurn ? false : permanent.tapped,
        summoningSick: isNewTurn ? false : permanent.summoningSick,
        attacking: false,
        blocking: false,
        markedDamage: isNewTurn ? 0 : permanent.markedDamage,
        temporaryModifiers: transitioned.phaseIndex === 0 ? [] : permanent.temporaryModifiers,
      })),
      opponent: transitioned.battlefield.opponent.map((permanent) => ({
        ...permanent,
        tapped: isNewTurn ? false : permanent.tapped,
        summoningSick: isNewTurn ? false : permanent.summoningSick,
        attacking: false,
        blocking: false,
        markedDamage: isNewTurn ? 0 : permanent.markedDamage,
        temporaryModifiers: transitioned.phaseIndex === 0 ? [] : permanent.temporaryModifiers,
      })),
    },
    helper: shouldReplayHelperReminder
      ? {
          ...helperState,
          reminderRequested: false,
          replayQueue: helperState.reminderQueue,
          reminderQueue: [],
        }
      : helperState,
  };
  const withTurnEvent = isNewTurn ? queueGameEvent(nextSession, "TURN_CHANGED", { turn: nextSession.turn }) : nextSession;
  const withReactivated = reactivateDelayedTriggers(withTurnEvent);
  const withPhaseTriggers = traversedPhases.reduce((currentSession, phase, index) =>
    processEventTriggers(currentSession, {
      type: "phase-changed",
      phase,
      eventType: "PHASE_CHANGED",
      payload: { phase },
      sequenceIndex: index,
    }), withReactivated);
  return applySyncedMultiplayerTurnProgression(withPhaseTriggers, session, isNewTurn, multiplayerSettings);
}

function applySyncedMultiplayerTurnProgression(session, previousSession, isNewTurn, multiplayerSettings = {}) {
  if (!isNewTurn) {
    return session;
  }
  if (session.simulation?.enabled) {
    return session;
  }
  if (!session.gameTracking?.active) {
    return session;
  }
  const mode = multiplayerSettings?.mode || previousSession?.runtime?.multiplayerMode || "offline";
  if (!["local", "wifi"].includes(mode)) {
    return session;
  }
  const synced = session.syncedMultiplayer || previousSession?.syncedMultiplayer || {};
  const turnOrder = Array.isArray(synced.turnOrder) ? [...synced.turnOrder].filter(Boolean) : [];
  if (!synced.confirmed || !turnOrder.length) {
    return {
      ...session,
      syncedMultiplayer: {
        ...synced,
        active: true,
        pendingConfirmation: true,
        confirmed: false,
        updatedAt: Date.now(),
      },
    };
  }
  const currentPlayerId = turnOrder.includes(synced.currentPlayerId) ? synced.currentPlayerId : turnOrder[0];
  const currentIndex = Math.max(0, turnOrder.indexOf(currentPlayerId));
  const nextIndex = (currentIndex + 1) % turnOrder.length;
  const nextPlayerId = turnOrder[nextIndex] || turnOrder[0];
  return {
    ...session,
    syncedMultiplayer: {
      ...synced,
      active: true,
      pendingConfirmation: false,
      confirmed: true,
      currentPlayerId: nextPlayerId,
      currentPlayerIndex: nextIndex,
      updatedAt: Date.now(),
    },
  };
}

function attachPermanent(session, sourceId, targetId) {
  const withSource = updatePermanent(session, sourceId, (permanent) => ({
    ...permanent,
    attachedToId: targetId,
    relationships: {
      ...(permanent.relationships || {}),
      attachedToId: targetId,
    },
  }));
  const withTarget = updatePermanent(withSource, targetId, (permanent) => ({
    ...permanent,
    attachments: [...new Set([...(permanent.attachments || []), sourceId])],
    relationships: {
      ...(permanent.relationships || {}),
      attachedIds: [...new Set([...(permanent.relationships?.attachedIds || []), sourceId])],
    },
  }));
  return recalculateContinuousEffects(withTarget);
}

function applyCounterToSession(session, event) {
  return updateOnePermanentInstance(session, event.id, (permanent) => ({
    ...permanent,
    counters: {
      ...permanent.counters,
      [event.counterType || "+1/+1"]: normalizeCount(permanent.counters?.[event.counterType || "+1/+1"]) + normalizeCount(event.amount, 1),
    },
  }));
}

function adjustPlaneswalkerLoyalty(session, id, amount = 0) {
  const walker = [...(session.battlefield?.player || []), ...(session.battlefield?.opponent || [])]
    .find((permanent) => permanent.id === id);
  if (!walker?.isPlaneswalker) {
    return addRecoveryEntry(session, {
      source: "Planeswalker Controls",
      message: "Select a planeswalker before adjusting loyalty.",
      severity: "warning",
    });
  }
  const nextLoyalty = Math.max(0, Number(walker.counters?.Loyalty || 0) + Number(amount || 0));
  const adjusted = updateOnePermanentInstance(session, id, (permanent) => ({
    ...permanent,
    counters: {
      ...(permanent.counters || {}),
      Loyalty: nextLoyalty,
    },
  }));
  if (nextLoyalty > 0) {
    return adjusted;
  }
  const removed = [...(adjusted.battlefield?.player || []), ...(adjusted.battlefield?.opponent || [])]
    .find((permanent) => permanent.id === id) || walker;
  const controllerSide = (adjusted.battlefield?.player || []).some((permanent) => permanent.id === id) ? "player" : "opponent";
  return {
    ...adjusted,
    selectedIds: (adjusted.selectedIds || []).filter((entry) => entry !== id),
    battlefield: {
      ...adjusted.battlefield,
      [controllerSide]: (adjusted.battlefield?.[controllerSide] || []).filter((permanent) => permanent.id !== id),
    },
    zones: controllerSide === "player"
      ? {
          ...(adjusted.zones || {}),
          graveyard: [...(adjusted.zones?.graveyard || []), { ...removed, zone: "graveyard" }],
        }
      : adjusted.zones,
    effectLog: [
      {
        id: createId("effect"),
        at: Date.now(),
        sourceName: removed.name,
        summary: "Planeswalker reached zero loyalty and was moved to its owner's graveyard.",
        status: "resolved",
        rulesConfidence: RULES_CONFIDENCE.AUTO_RESOLVED,
      },
      ...(adjusted.effectLog || []),
    ].slice(0, 120),
  };
}

function tapSelectedForCost(session, event = {}) {
  const mechanic = String(event.mechanic || "tap-cost").toLowerCase();
  const requiredValue = Math.max(0, Number(event.requiredValue || 0));
  const selected = [...(session.battlefield?.player || [])].filter((permanent) => (session.selectedIds || []).includes(permanent.id));
  const eligible = selected.filter((permanent) => {
    if (permanent.tapped) return false;
    if (mechanic === "improvise") return permanent.isArtifact;
    if (["convoke", "crew", "saddle", "station"].includes(mechanic)) return permanent.isCreature;
    return true;
  });
  const contributed = eligible.reduce((sum, permanent) => {
    if (["crew", "saddle", "station"].includes(mechanic)) {
      return sum + Math.max(0, Number(permanent.currentPower ?? permanent.basePower ?? 0));
    }
    return sum + Math.max(1, Number(permanent.quantity || 1));
  }, 0);
  if (!eligible.length || contributed < requiredValue) {
    return addRecoveryEntry(session, {
      source: `${formatMechanicLabel(mechanic)} Cost`,
      message: `Selected eligible permanents provide ${contributed}; ${requiredValue || 1} is required. Nothing was tapped.`,
      severity: "warning",
      suggestedAction: "Select additional eligible untapped permanents and try again.",
    });
  }
  const eligibleIds = new Set(eligible.map((permanent) => permanent.id));
  const mapSide = (side) => side.map((permanent) =>
    eligibleIds.has(permanent.id)
      ? hydratePermanentEffects({ ...permanent, tapped: true, attacking: false, blocking: false })
      : permanent
  );
  return {
    ...recalculateContinuousEffects({
      ...session,
      battlefield: {
        ...session.battlefield,
        player: mapSide(session.battlefield.player || []),
        opponent: mapSide(session.battlefield.opponent || []),
      },
    }),
    pendingEffects: [
      {
        id: createId("pending"),
        sourceId: eligible[0]?.id || "",
        sourceName: `${formatMechanicLabel(mechanic)} payment`,
        summary: `Confirm ${formatMechanicLabel(mechanic)} payment (${contributed} contributed by ${eligible.length} selected permanent(s)).`,
        effect: {
          action: "tap-cost-payment",
          manual: true,
          choiceKind: mechanic,
          contributed,
          requiredValue,
        },
        status: "pending",
        rulesConfidence: RULES_CONFIDENCE.MANUAL_CHOICE,
        createdAt: Date.now(),
        eventType: "ABILITY_ACTIVATED",
        controller: "player",
      },
      ...(session.pendingEffects || []),
    ].slice(0, 120),
  };
}

function formatMechanicLabel(mechanic = "") {
  return String(mechanic || "tap cost").replace(/(^|-)([a-z])/g, (_, separator, letter) => `${separator ? " " : ""}${letter.toUpperCase()}`);
}

function addManualTrigger(session, event = {}) {
  const selectedSource = [...(session.battlefield?.player || []), ...(session.battlefield?.opponent || [])]
    .find((permanent) => permanent.id === event.sourceId || (session.selectedIds || []).includes(permanent.id));
  const sourceName = String(event.sourceName || selectedSource?.name || "Manual Trigger").trim();
  const summary = String(event.summary || "Resolve this manually entered trigger.").trim();
  const trigger = {
    id: createId("trigger"),
    chainId: createId("chain"),
    sourceId: selectedSource?.id || event.sourceId || "",
    sourceName,
    eventType: String(event.eventType || "MANUAL_TRIGGER"),
    targetSelector: "manual",
    optional: Boolean(event.optional),
    oncePerTurn: false,
    triggerCondition: "manual-entry",
    effectDefinitions: [{
      action: "manual-choice",
      manual: true,
      summary,
      reason: "User-entered trigger requires manual resolution.",
    }],
    status: "pending",
    rulesConfidence: RULES_CONFIDENCE.MANUAL_CHOICE,
    createdAt: Date.now(),
  };
  return {
    ...session,
    triggerQueue: [trigger, ...(session.triggerQueue || [])].slice(0, 120),
    rulesConfidenceLog: [
      {
        id: createId("confidence"),
        at: Date.now(),
        sourceName,
        summary,
        status: "pending",
        rulesConfidence: RULES_CONFIDENCE.MANUAL_CHOICE,
      },
      ...(session.rulesConfidenceLog || []),
    ].slice(0, 160),
  };
}

function addMana(session, color, amount = 1) {
  const safeColor = ["W", "U", "B", "R", "G", "C", "Generic"].includes(color) ? color : "C";
  const delta = Number.isFinite(Number(amount)) ? Math.trunc(Number(amount)) : 1;
  const current = normalizeCount(session.manaPool?.[safeColor]);
  return {
    ...session,
    manaPool: {
      ...session.manaPool,
      [safeColor]: Math.max(0, current + delta),
    },
  };
}

function updatePermanent(session, id, updater) {
  const mapSide = (side) => side.map((permanent) => (permanent.id === id ? hydratePermanentEffects(updater(permanent)) : permanent));
  return recalculateContinuousEffects({
    ...session,
    battlefield: {
      ...session.battlefield,
      player: mapSide(session.battlefield.player),
      opponent: mapSide(session.battlefield.opponent),
    },
  });
}

function updateOnePermanentInstance(session, id, updater) {
  let changed = false;
  const nextBattlefield = { ...session.battlefield };

  ["player", "opponent"].forEach((sideKey) => {
    if (changed) {
      return;
    }

    const side = session.battlefield[sideKey];
    const index = side.findIndex((permanent) => permanent.id === id);
    if (index < 0) {
      return;
    }

    const permanent = side[index];
    const members = [...(permanent.stackMembers || [])];
    if ((permanent.quantity || members.length) <= 1 || members.length <= 1) {
      nextBattlefield[sideKey] = side.map((entry) => (entry.id === id ? hydratePermanentEffects(updater(entry)) : entry));
      changed = true;
      return;
    }

    const [memberToUpdate, ...remainingMembers] = members;
    const remaining = hydratePermanentEffects({
      ...permanent,
      quantity: Math.max(1, (permanent.quantity || members.length) - 1),
      stackMembers: remainingMembers.length ? remainingMembers : members.slice(1),
    });
    const updated = hydratePermanentEffects({
      ...updater({
        ...permanent,
        id: createId("perm"),
        quantity: 1,
        tapped: memberToUpdate?.tapped ?? permanent.tapped,
        counters: memberToUpdate?.counters || permanent.counters,
        attachments: memberToUpdate?.attachments || permanent.attachments,
        temporaryModifiers: memberToUpdate?.temporaryModifiers || permanent.temporaryModifiers,
      }),
      quantity: 1,
      stackMembers: [
        {
          instanceId: memberToUpdate?.instanceId || createId("member"),
          tapped: memberToUpdate?.tapped ?? permanent.tapped,
          counters: memberToUpdate?.counters || permanent.counters,
          attachments: memberToUpdate?.attachments || permanent.attachments,
          temporaryModifiers: memberToUpdate?.temporaryModifiers || permanent.temporaryModifiers,
          metadata: memberToUpdate?.metadata || {},
        },
      ],
    });

    nextBattlefield[sideKey] = [...side.slice(0, index), remaining, updated, ...side.slice(index + 1)];
    changed = true;
  });

  if (!changed) {
    return session;
  }

  return recalculateContinuousEffects({
    ...session,
    battlefield: nextBattlefield,
  });
}

function normalizeStackMembers(permanent) {
  const quantity = Math.max(1, Number(permanent.quantity) || 1);
  const existing = Array.isArray(permanent.stackMembers) && permanent.stackMembers.length ? permanent.stackMembers : [];
  const stackMembers =
    existing.length >= quantity
      ? existing.slice(0, quantity)
      : [
          ...existing,
          ...Array.from({ length: quantity - existing.length }, (_, index) => ({
            instanceId: createId("member"),
            tapped: Boolean(permanent.tapped),
            attacking: Boolean(permanent.attacking),
            blocking: Boolean(permanent.blocking),
            summoningSick: Boolean(permanent.summoningSick),
            counters: { ...(permanent.counters || {}) },
            attachments: Array.isArray(permanent.attachments) ? [...permanent.attachments] : [],
            temporaryModifiers: Array.isArray(permanent.temporaryModifiers) ? [...permanent.temporaryModifiers] : [],
            metadata: {
              generatedIndex: index + 1,
              enteredDuringCombat: Boolean(permanent.enteredDuringCombat),
              attackingPlayerId: permanent.attackingPlayerId || "",
              attackedObjectId: permanent.attackedObjectId || "",
              createdByTriggerId: permanent.createdByTriggerId || "",
              sourcePermanentId: permanent.sourcePermanentId || "",
              combatPhaseCreatedIn: permanent.combatPhaseCreatedIn || "",
              tokenTemplateId: permanent.tokenTemplateId || "",
              tokenCopyOfId: permanent.tokenCopyOfId || "",
            },
          })),
        ];
  return {
    ...permanent,
    quantity,
    stackMembers,
  };
}

function togglePermanentTapped(session, id) {
  return updateOnePermanentInstance(session, id, (permanent) => ({
    ...permanent,
    tapped: !permanent.tapped,
    attacking: false,
    blocking: false,
  }));
}

function setSelectedTapped(session, tapped) {
  const selected = new Set(session.selectedIds || []);
  const mapSide = (side) =>
    side.map((permanent) =>
      selected.has(permanent.id)
        ? hydratePermanentEffects({
            ...permanent,
            tapped,
            attacking: tapped ? permanent.attacking : false,
            blocking: tapped ? permanent.blocking : false,
          })
        : permanent
    );
  return recalculateContinuousEffects({
    ...session,
    battlefield: {
      ...session.battlefield,
      player: mapSide(session.battlefield.player),
      opponent: mapSide(session.battlefield.opponent),
    },
  });
}

function removeSelectedPermanents(session, options = {}) {
  const mode = String(options.mode || "remove");
  const countMode = String(options.countMode || "all");
  const requestedCount = Math.max(1, normalizeCount(options.count, 1));
  const countById = options.countById && typeof options.countById === "object" ? options.countById : {};
  const selected = new Set(session.selectedIds || []);
  if (!selected.size) {
    return session;
  }
  const removed = [];
  const removedIds = new Set();
  const remainingSelected = [];

  const eventType = mapRemovalModeToEventType(mode);
  const eventLegacyType = mapRemovalModeToLegacyType(mode);
  const chainId = createId("chain");

  let nextSession = {
    ...session,
    battlefield: {
      ...session.battlefield,
      player: [...session.battlefield.player],
      opponent: [...session.battlefield.opponent],
    },
  };

  ["player", "opponent"].forEach((sideKey) => {
    const nextSide = [];
    (nextSession.battlefield[sideKey] || []).forEach((permanent) => {
      if (!selected.has(permanent.id)) {
        nextSide.push(permanent);
        return;
      }
      const totalQty = Math.max(1, Number(permanent.quantity) || 1);
      const perPermanentRequested = Math.max(1, normalizeCount(countById[permanent.id], requestedCount));
      const removeCountRaw =
        countMode === "all"
          ? totalQty
          : countMode === "single"
            ? 1
            : perPermanentRequested;
      const removeCount = Math.max(1, Math.min(totalQty, removeCountRaw));
      const remaining = totalQty - removeCount;

      removed.push({
        id: permanent.id,
        name: permanent.name,
        mode,
        count: removeCount,
        totalBefore: totalQty,
        side: sideKey,
        controller: permanent.controller,
        permanent,
      });

      const removedPermanent = hydratePermanentEffects({
        ...permanent,
        id: createId("removed"),
        quantity: removeCount,
        stackMembers: (permanent.stackMembers || []).slice(0, removeCount),
      });

      nextSession = processEventTriggers(nextSession, {
        type: eventLegacyType,
        eventType,
        payload: {
          permanent: removedPermanent,
          instances: removeCount,
          cause: mode,
          controller: removedPermanent.controller,
        },
        permanent: removedPermanent,
        instances: removeCount,
        cause: mode,
        chainId,
      });

      if (remaining <= 0) {
        removedIds.add(permanent.id);
        return;
      }
      const remainingPermanent = hydratePermanentEffects({
        ...permanent,
        quantity: remaining,
        stackMembers: (permanent.stackMembers || []).slice(removeCount),
      });
      nextSide.push(remainingPermanent);
      remainingSelected.push(remainingPermanent.id);
    });
    nextSession.battlefield[sideKey] = nextSide;
  });

  if (!removed.length) {
    return session;
  }

  const scrubAttachments = (permanent) =>
    hydratePermanentEffects({
      ...permanent,
      attachments: (permanent.attachments || []).filter((entry) => !removedIds.has(entry)),
      relationships: {
        ...(permanent.relationships || {}),
        attachedIds: (permanent.relationships?.attachedIds || []).filter((entry) => !removedIds.has(entry)),
        attachedToId: removedIds.has(permanent.relationships?.attachedToId) ? "" : permanent.relationships?.attachedToId,
      },
      attachedToId: removedIds.has(permanent.attachedToId) ? "" : permanent.attachedToId,
    });

  const zonedSession = applySimulationZoneUpdatesForRemoval(nextSession, removed, mode);
  return recalculateContinuousEffects({
    ...zonedSession,
    selectedIds: remainingSelected,
    battlefield: {
      ...zonedSession.battlefield,
      player: zonedSession.battlefield.player.map(scrubAttachments),
      opponent: zonedSession.battlefield.opponent.map(scrubAttachments),
    },
    effectLog: [
      {
        id: createId("effect"),
        at: Date.now(),
        sourceName: "Permanent Controls",
        text: `${mode} ${removed.map((entry) => `${entry.name} x${entry.count}`).join(", ")}`,
        summary: `${mode} ${removed.reduce((sum, entry) => sum + entry.count, 0)} permanent instance(s)`,
        payload: {
          mode,
          countMode,
          count: requestedCount,
          removed,
        },
        status: "resolved",
      },
      ...(session.effectLog || []),
    ],
  });
}

function applySimulationZoneUpdatesForRemoval(session, removed = [], mode = "remove") {
  if (!session.simulation?.enabled || !removed.length) {
    return session;
  }
  const opponents = { ...(session.simulation.opponents || {}) };
  let changed = false;
  removed.forEach((entry) => {
    if (entry.side !== "opponent" || !entry.controller || !opponents[entry.controller]) {
      return;
    }
    const npc = opponents[entry.controller];
    const movedCard = {
      name: entry.permanent?.name || entry.name,
      typeLine: entry.permanent?.typeLine || "Permanent",
      manaValue: entry.permanent?.manaValue || 0,
      cardId: entry.permanent?.cardId || "",
      role: entry.permanent?.role || "",
    };
    const zones = {
      ...(npc.zones || {}),
      graveyard: [...(npc.zones?.graveyard || [])],
      exile: [...(npc.zones?.exile || [])],
      command: [...(npc.zones?.command || [])],
      battlefield: [...(npc.zones?.battlefield || [])],
    };
    if (entry.permanent?.isCommander || npc.commander?.card?.name === movedCard.name) {
      zones.command = [npc.commander.card];
      opponents[entry.controller] = {
        ...npc,
        zones,
        commander: {
          ...npc.commander,
          zone: "command",
          tax: Number(npc.commander?.tax || 0) + 2,
        },
        updatedAt: Date.now(),
      };
      changed = true;
      return;
    }
    if (String(mode || "").toLowerCase() === "exile") {
      zones.exile.push(movedCard);
    } else {
      zones.graveyard.push(movedCard);
    }
    opponents[entry.controller] = {
      ...npc,
      zones,
      updatedAt: Date.now(),
    };
    changed = true;
  });
  if (!changed) {
    return session;
  }
  return {
    ...session,
    simulation: {
      ...session.simulation,
      opponents,
      updatedAt: Date.now(),
    },
  };
}

function mapRemovalModeToEventType(mode = "remove") {
  const normalized = String(mode || "remove").toLowerCase();
  if (normalized === "destroy") {
    return "DESTROY";
  }
  if (normalized === "exile") {
    return "EXILE";
  }
  if (normalized === "sacrifice") {
    return "SACRIFICE";
  }
  if (normalized === "bounce" || normalized === "return") {
    return "LEAVE_BATTLEFIELD";
  }
  return "LEAVE_BATTLEFIELD";
}

function mapRemovalModeToLegacyType(mode = "remove") {
  const normalized = String(mode || "remove").toLowerCase();
  if (normalized === "destroy" || normalized === "sacrifice") {
    return "permanent-died";
  }
  return "permanent-left";
}

function toggleSelection(session, id) {
  const exists = session.selectedIds.includes(id);
  return {
    ...session,
    selectedIds: exists ? session.selectedIds.filter((entry) => entry !== id) : [...session.selectedIds, id],
  };
}

function reorderPermanent(session, id, direction = 1) {
  const sideKey = "player";
  const side = [...session.battlefield[sideKey]];
  const index = side.findIndex((permanent) => permanent.id === id);
  if (index < 0) {
    return session;
  }
  const nextIndex = Math.max(0, Math.min(side.length - 1, index + (Number(direction) >= 0 ? 1 : -1)));
  if (nextIndex === index) {
    return session;
  }
  const [entry] = side.splice(index, 1);
  side.splice(nextIndex, 0, entry);
  return {
    ...session,
    battlefield: {
      ...session.battlefield,
      [sideKey]: side,
    },
  };
}

function updatePendingEffect(session, id, status) {
  const entry = (session.pendingEffects || []).find((effect) => effect.id === id);
  const normalizedStatus = String(status || "pending").toLowerCase();
  const rulesConfidence =
    normalizedStatus === "resolved"
      ? RULES_CONFIDENCE.AUTO_RESOLVED
      : normalizedStatus === "ignored"
        ? RULES_CONFIDENCE.IGNORED
        : normalizedStatus === "skipped"
          ? RULES_CONFIDENCE.NEEDS_REVIEW
          : RULES_CONFIDENCE.MANUAL_CHOICE;
  const summaryLabel =
    normalizedStatus === "resolved"
      ? "resolved"
      : normalizedStatus === "skipped"
        ? "skipped"
        : normalizedStatus === "ignored"
          ? "ignored"
          : normalizedStatus;
  return {
    ...session,
    pendingEffects: session.pendingEffects.map((effect) =>
      effect.id === id ? { ...effect, status: normalizedStatus, rulesConfidence, updatedAt: Date.now() } : effect
    ),
    rulesConfidenceLog: [
      {
        id: createId("confidence"),
        at: Date.now(),
        sourceName: entry?.sourceName || "Manual Effect",
        summary: entry?.summary || entry?.effect?.summary || "Manual effect status changed",
        status: normalizedStatus,
        rulesConfidence,
      },
      ...(session.rulesConfidenceLog || []),
    ].slice(0, 120),
    effectLog: entry
      ? [
          {
            id: createId("effect"),
            at: Date.now(),
            sourceName: entry.sourceName || "Manual Effect",
            summary: `Manual effect ${summaryLabel}: ${entry.summary || entry.effect?.summary || entry.effect?.action || "effect"}`,
            status: normalizedStatus,
            rulesConfidence,
          },
          ...(session.effectLog || []),
        ].slice(0, 80)
      : session.effectLog,
  };
}

function setSpellTargetChoice(session, pendingId, targetId) {
  const pending = (session.pendingEffects || []).find((entry) => entry.id === pendingId);
  if (!pending?.stackObjectId || !targetId) {
    return session;
  }
  const updated = updatePendingEffect(session, pendingId, "resolved");
  const battlefieldIds = new Set([
    ...(session.battlefield?.player || []).map((entry) => entry.id),
    ...(session.battlefield?.opponent || []).map((entry) => entry.id),
  ]);
  return {
    ...updated,
    selectedIds: battlefieldIds.has(targetId) ? [targetId] : [],
    stack: (updated.stack || []).map((entry) =>
      entry.id === pending.stackObjectId
        ? {
            ...entry,
            targetIds: [targetId],
            status: "pending",
            rulesConfidence: RULES_CONFIDENCE.AUTO_RESOLVED,
          }
        : entry
    ),
  };
}

function addRecoveryEntry(session, entry = {}) {
  const recoveryEntry = {
    ...createRecoveryEntry(entry),
    ...entry,
    id: entry.id || createRecoveryEntry(entry).id,
    timestamp: entry.timestamp || Date.now(),
    dismissed: false,
  };
  return {
    ...session,
    recoveryLog: [recoveryEntry, ...(session.recoveryLog || [])].slice(0, 80),
    effectLog: [
      {
        id: createId("effect"),
        at: recoveryEntry.timestamp,
        sourceName: recoveryEntry.source || "Recovery",
        summary: recoveryEntry.message || "Recovery notice created.",
        status: recoveryEntry.severity || "info",
        rulesConfidence: recoveryEntry.severity === "error" ? RULES_CONFIDENCE.FAILED : RULES_CONFIDENCE.NEEDS_REVIEW,
      },
      ...(session.effectLog || []),
    ].slice(0, 80),
  };
}

function dismissRecoveryEntry(session, id = "") {
  return {
    ...session,
    recoveryLog: (session.recoveryLog || []).map((entry) =>
      entry.id === id ? { ...entry, dismissed: true, dismissedAt: Date.now() } : entry
    ),
  };
}

function clearGameHistory(session) {
  return {
    ...session,
    history: [],
    actionHistory: [],
    eventHistory: [],
    effectLog: [
      {
        id: createId("effect"),
        at: Date.now(),
        sourceName: "Data Management",
        summary: "Game history cleared.",
        status: "resolved",
        rulesConfidence: RULES_CONFIDENCE.AUTO_RESOLVED,
      },
    ],
    recoveryLog: [],
    rulesConfidenceLog: [],
  };
}

function clearSimulationLearning(profile) {
  const defaults = createDefaultProfile();
  return {
    ...profile,
    simulationMemory: defaults.simulationMemory,
    activeSession: addRecoveryEntry(profile.activeSession, {
      source: "Data Management",
      message: "Simulation learning cleared. Normal game history was preserved.",
      severity: "success",
      suggestedAction: "Start a new Dry Run when you are ready.",
    }),
  };
}

function resetAllLocalData(profile) {
  const fresh = createDefaultProfile();
  return {
    ...fresh,
    localAuth: {
      ...fresh.localAuth,
      hasPassword: Boolean(profile.localAuth?.hasPassword),
    },
    activeSession: addRecoveryEntry(fresh.activeSession, {
      source: "Data Management",
      message: "Local data reset complete.",
      severity: "success",
      suggestedAction: "Start fresh or import a saved profile.",
    }),
  };
}

function resetProfileSettings(profile) {
  const defaults = createDefaultProfile();
  return {
    ...profile,
    settings: defaults.settings,
    activeSession: addRecoveryEntry(profile.activeSession, {
      source: "Settings",
      message: "Settings reset to BoardState defaults.",
      severity: "success",
    }),
  };
}

function loadTutorialSampleBoard(session) {
  const now = Date.now();
  const tutorialCreature = hydratePermanentEffects(
    createPermanent({
      id: createId("tutorial"),
      name: "Tutorial Vanguard",
      typeLine: "Creature - Soldier",
      oracleText: "When this creature enters, you gain 1 life.",
      basePower: 2,
      baseToughness: 2,
      controller: "player",
      owner: "player",
      counters: { "+1/+1": 1 },
    })
  );
  const tutorialToken = hydratePermanentEffects(
    createPermanent({
      id: createId("tutorial"),
      name: "Practice Gnome",
      typeLine: "Token Artifact Creature - Gnome",
      oracleText: "A sample token for stack and token controls.",
      basePower: 1,
      baseToughness: 1,
      controller: "player",
      owner: "player",
      quantity: 2,
      isToken: true,
    })
  );
  const tutorialEngine = hydratePermanentEffects(
    createPermanent({
      id: createId("tutorial"),
      name: "Choice Beacon",
      typeLine: "Enchantment",
      oracleText: "When a creature enters, choose a target creature. Manual choice required.",
      controller: "player",
      owner: "player",
    })
  );
  const manualEntry = {
    id: createId("pending"),
    sourceId: tutorialEngine.id,
    sourceName: tutorialEngine.name,
    summary: "Tutorial: choose a target creature, then mark this resolved/skipped/ignored.",
    effect: {
      action: "choose-target",
      summary: "Choose a target creature for the tutorial manual-choice example.",
      manual: true,
    },
    status: "pending",
    rulesConfidence: RULES_CONFIDENCE.MANUAL_CHOICE,
    createdAt: now,
    eventType: "TUTORIAL",
  };
  return recalculateContinuousEffects({
    ...session,
    selectedIds: [tutorialCreature.id],
    battlefield: {
      ...session.battlefield,
      player: [tutorialCreature, tutorialToken, tutorialEngine],
    },
    pendingEffects: [manualEntry, ...(session.pendingEffects || [])].slice(0, 60),
    triggerQueue: [
      {
        id: createId("trigger"),
        chainId: createId("chain"),
        sourceId: tutorialCreature.id,
        sourceName: tutorialCreature.name,
        eventType: "ENTER_BATTLEFIELD",
        targetSelector: "you",
        optional: false,
        oncePerTurn: false,
        triggerCondition: "tutorial",
        effectDefinitions: [{ action: "life", amount: 1, target: "you", summary: "Tutorial auto-resolved life gain." }],
        status: "resolved",
        rulesConfidence: RULES_CONFIDENCE.AUTO_RESOLVED,
        createdAt: now,
        resolvedAt: now,
      },
      ...(session.triggerQueue || []),
    ].slice(0, 120),
    effectLog: [
      {
        id: createId("effect"),
        at: now,
        sourceName: "Tutorial Sample Board",
        summary: "Loaded a safe sample board with a creature, token stack, automatic trigger, and manual-choice example.",
        status: "resolved",
        rulesConfidence: RULES_CONFIDENCE.AUTO_RESOLVED,
      },
      ...(session.effectLog || []),
    ].slice(0, 80),
    tutorial: {
      active: true,
      loadedAt: now,
      step: 1,
      canClear: true,
    },
    gameTracking: {
      ...(session.gameTracking || {}),
      active: false,
      mode: "training-ground",
    },
    helper: {
      ...(session.helper || {}),
      reminderQueue: [
        {
          key: `tutorial:${now}`,
          text: "Tutorial board loaded: inspect the token stack, open Pending Effects, then try Activate Board.",
          source: "tutorial",
        },
        ...(session.helper?.reminderQueue || []),
      ].slice(0, 8),
    },
  });
}

function requestHelperReminder(session, messages = []) {
  const cleaned = Array.isArray(messages)
    ? messages
        .map((entry) => ({
          key: String(entry.key || ""),
          text: String(entry.text || "").trim(),
          source: String(entry.source || "helper"),
        }))
        .filter((entry) => entry.key && entry.text)
        .slice(0, 8)
    : [];
  return {
    ...session,
    helper: {
      ...(session.helper || {}),
      reminderRequested: true,
      reminderRequestedTurn: session.turn,
      reminderQueue: cleaned,
    },
    effectLog: [
      {
        id: createId("effect"),
        at: Date.now(),
        sourceName: "Helper Sprite",
        summary: `Remind me armed for next upkeep${cleaned.length ? ` (${cleaned.length} message${cleaned.length === 1 ? "" : "s"})` : ""}.`,
        status: "queued",
      },
      ...(session.effectLog || []),
    ].slice(0, 80),
  };
}

function dismissHelperMessage(session, messageKey = "") {
  if (!messageKey) {
    return session;
  }
  const helper = session.helper || {};
  const replayQueue = (helper.replayQueue || []).filter((entry) => entry.key !== messageKey);
  const dismissedKeys = [...new Set([...(helper.dismissedKeys || []), messageKey])].slice(-80);
  return {
    ...session,
    helper: {
      ...helper,
      replayQueue,
      dismissedKeys,
    },
  };
}

function markHelperMessageShown(session, messageKey = "") {
  if (!messageKey) {
    return session;
  }
  const helper = session.helper || {};
  const deliveredKeys = [...new Set([...(helper.deliveredKeys || []), messageKey])].slice(-120);
  return {
    ...session,
    helper: {
      ...helper,
      deliveredKeys,
      lastKey: messageKey,
      lastShownAt: Date.now(),
    },
  };
}

function reactivateDelayedTriggers(session) {
  const queue = (session.triggerQueue || []).map((entry) => {
    if (
      entry.status === "delayed" &&
      Number(entry.delayedUntilTurn) <= session.turn &&
      Number(entry.delayedUntilPhase) <= session.phaseIndex
    ) {
      return {
        ...entry,
        status: "pending",
        delayedUntilTurn: null,
        delayedUntilPhase: null,
      };
    }
    return entry;
  });
  return {
    ...session,
    triggerQueue: queue,
  };
}

function emitAndProcessSessionEvent(session, action, actionType) {
  const mappedEventType = mapActionToGameEvent(action, actionType);
  if (!mappedEventType) {
    return session;
  }
  const queued = queueGameEvent(
    session,
    mappedEventType,
    {
      actionType,
      phase: PHASES[session.phaseIndex],
      turn: session.turn,
      permanent: action.card || action.permanent || null,
      targetIds: action.targetIds || [],
      amount: action.amount,
    },
    {
      sourceId: action.sourceId || action.id || "",
      playerId: action.playerId || "local-player",
    }
  );
  const actionsWithInlineTriggerResolution = new Set(["ADD_PERMANENT", "ADD_CUSTOM_TOKEN", "CAST_SPELL", "ADVANCE_PHASE", "DECLARE_ATTACKERS"]);
  if (actionsWithInlineTriggerResolution.has(actionType)) {
    return { ...queued, eventQueue: [] };
  }
  return drainGameEvents(queued, (nextSession, gameEvent) =>
    processEventTriggers(
      runGameEventObservers(nextSession, gameEvent),
      {
        type: eventTypeToLegacy(gameEvent.eventType),
        eventType: gameEvent.eventType,
        phase: gameEvent.payload?.phase,
        payload: gameEvent.payload || {},
        permanent: gameEvent.payload?.permanent || null,
      }
    )
  );
}

function mapActionToGameEvent(action, actionType) {
  if (actionType === "REMOVE_SELECTED") {
    return "";
  }
  return mapActionTypeToGameEvent(actionType);
}

function eventTypeToLegacy(eventType) {
  const map = {
    ENTER_BATTLEFIELD: "permanent-entered",
    LAND_ENTERED_BATTLEFIELD: "land-entered-battlefield",
    LANDFALL_CHECK: "landfall-check",
    LEAVE_BATTLEFIELD: "permanent-left",
    DESTROY: "permanent-died",
    EXILE: "permanent-left",
    SACRIFICE: "permanent-died",
    COUNTER_ADDED: "counter-added",
    TOKEN_CREATED: "permanent-entered",
    PHASE_CHANGED: "phase-changed",
    TURN_CHANGED: "turn-changed",
    LIFE_CHANGED: "life-changed",
    COMMANDER_DAMAGE_CHANGED: "commander-damage-changed",
    SPELL_CAST: "spell-cast",
    ABILITY_ACTIVATED: "ability-activated",
    ATTACK_DECLARED: "attackers-declared",
    ATTACK_TRIGGER_CHECK: "attack-trigger-check",
    BLOCK_DECLARED: "blockers-declared",
  };
  return map[eventType] || "state-changed";
}

function withSession(profile, session) {
  const { runtime, ...cleanSession } = session || {};
  return {
    ...profile,
    activeSession: {
      ...cleanSession,
      updatedAt: Date.now(),
    },
  };
}

function withRuntimeSettings(session, settings = {}) {
  return {
    ...session,
    runtime: {
      adhdAutomation: Boolean(settings.adhdAutomation ?? settings.adhdMode?.enabled ?? true),
      confirmAmbiguousEffects: Boolean(settings.confirmAmbiguousEffects ?? true),
      adhdModeEnabled: Boolean(settings.adhdMode?.enabled),
      debugRules: Boolean(settings.developer?.rulesDebug),
      multiplayerMode: settings.multiplayer?.mode || "offline",
    },
  };
}

function withHistory(profile, event) {
  if (event.actionType === "SAVE_TICK" || event.type === "SAVE_TICK") {
    return profile;
  }
  const actionType = event.actionType || event.type || "UNKNOWN";
  if (actionType === "CLEAR_GAME_HISTORY") {
    return profile;
  }
  const actionRecord = {
    actionId: event.actionId || createId("action"),
    timestamp: event.timestamp || Date.now(),
    playerId: event.playerId || "local-player",
    sourceId: event.sourceId || event.id || "",
    targetIds: Array.isArray(event.targetIds) ? event.targetIds : [],
    actionType,
    payload: event.payload || {},
    resultingStateReference: event.resultingStateReference || `${profile.activeSession.id}:${profile.activeSession.updatedAt}`,
    replayable: event.replayable !== false,
    undoable: event.undoable !== false,
    snapshot: createReplaySnapshot(profile.activeSession),
  };
  return {
    ...profile,
    activeSession: {
      ...profile.activeSession,
      history: [
        {
          id: actionRecord.actionId,
          at: actionRecord.timestamp,
          type: actionType,
          summary: event.summary || actionType,
        },
        ...profile.activeSession.history,
      ].slice(0, 250),
      actionHistory: [actionRecord, ...(profile.activeSession.actionHistory || [])].slice(0, 600),
    },
  };
}

function pushUndo(profile, event) {
  const reason = event.actionType || event.type || "UNKNOWN";
  return {
    ...profile,
    activeSession: {
      ...profile.activeSession,
      undoStack: [{ reason, snapshot: createUndoSnapshot(profile.activeSession) }, ...profile.activeSession.undoStack].slice(0, 50),
      redoStack: [],
    },
  };
}

function popUndo(profile) {
  const [entry, ...rest] = profile.activeSession.undoStack;
  if (!entry) {
    return profile;
  }
  return {
    ...profile,
    activeSession: {
      ...entry.snapshot,
      undoStack: rest,
      redoStack: [{ reason: "UNDO", snapshot: createUndoSnapshot(profile.activeSession) }, ...(profile.activeSession.redoStack || [])].slice(0, 50),
    },
  };
}

function popRedo(profile) {
  const [entry, ...rest] = profile.activeSession.redoStack || [];
  if (!entry) {
    return profile;
  }
  return {
    ...profile,
    activeSession: {
      ...entry.snapshot,
      redoStack: rest,
      undoStack: [{ reason: "REDO", snapshot: createUndoSnapshot(profile.activeSession) }, ...(profile.activeSession.undoStack || [])].slice(0, 50),
    },
  };
}

function replayToAction(profile, actionId) {
  const history = profile.activeSession.actionHistory || [];
  const entry = history.find((item) => item.actionId === actionId);
  if (!entry?.snapshot) {
    return profile;
  }
  return {
    ...profile,
    activeSession: {
      ...createReplaySnapshot(entry.snapshot),
      replay: {
        ...(entry.snapshot.replay || {}),
        active: true,
        cursor: history.findIndex((item) => item.actionId === actionId),
        running: false,
      },
    },
  };
}

function getAllPermanents(session) {
  return [...(session.battlefield?.player || []), ...(session.battlefield?.opponent || [])];
}

function createUndoSnapshot(session) {
  const snapshot = clone(session);
  snapshot.undoStack = [];
  snapshot.redoStack = [];
  snapshot.actionHistory = [];
  snapshot.history = [];
  snapshot.eventQueue = [];
  snapshot.eventHistory = [];
  snapshot.runtime = undefined;
  return snapshot;
}

function createReplaySnapshot(session) {
  const snapshot = createUndoSnapshot(session);
  snapshot.effectLog = (snapshot.effectLog || []).slice(0, 120);
  snapshot.pendingEffects = (snapshot.pendingEffects || []).slice(0, 60);
  snapshot.triggerQueue = (snapshot.triggerQueue || []).slice(0, 180);
  snapshot.recoveryLog = (snapshot.recoveryLog || []).slice(0, 80);
  snapshot.rulesConfidenceLog = (snapshot.rulesConfidenceLog || []).slice(0, 120);
  if (snapshot.helper) {
    snapshot.helper = {
      ...snapshot.helper,
      reminderQueue: (snapshot.helper.reminderQueue || []).slice(0, 12),
      replayQueue: (snapshot.helper.replayQueue || []).slice(0, 12),
      dismissedKeys: (snapshot.helper.dismissedKeys || []).slice(-120),
      deliveredKeys: (snapshot.helper.deliveredKeys || []).slice(-180),
    };
  }
  snapshot.replay = {
    ...(snapshot.replay || {}),
    active: false,
    cursor: -1,
    running: false,
  };
  return snapshot;
}
