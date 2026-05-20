import { archiveCurrentGame } from "../archive/archiveService.js";
import { hydratePermanentEffects, processEventTriggers, recalculateContinuousEffects, resolveQueuedTrigger, resolveSpell } from "../effects/effectEngine.js";
import { addCardToCommanderDeck, assignCommander, castCommander, recordCommanderCardUsage } from "../game/commanderSystem.js";
import { assignBlocker, declareAttackers, resolveCombat } from "../game/combatSystem.js";
import { createManaPool, PHASES } from "./schema.js";
import { clone, createId, normalizeCount } from "./ids.js";
import { drainGameEvents, mapActionTypeToGameEvent, queueGameEvent, runGameEventObservers } from "../game/eventBus.js";
import { transitionFsm } from "../game/fsm.js";
import { finalizeAction } from "./actions.js";
import {
  createWorldShaperOpponent,
  prepareSimulatedCastPermanent,
  prepareSimulatedCombat,
  prepareSimulatedDrawStep,
  prepareSimulatedLandPlay,
  prepareSimulatedLegalActionCheck,
  prepareSimulatedPriority,
} from "../simulation/simulatedOpponent.js";

export function reduceProfile(profile, event) {
  const actionType = event.actionType || event.type;
  const undoable = !["IMPORT_PROFILE", "SAVE_TICK"].includes(actionType);
  const baseProfile = undoable ? pushUndo(profile, event) : profile;
  let nextProfile = baseProfile;

  switch (actionType) {
    case "IMPORT_PROFILE":
      return event.profile;
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
    case "SET_LIFE":
      nextProfile = withSession(baseProfile, { ...baseProfile.activeSession, life: normalizeCount(event.life, 40) });
      break;
    case "ADD_COUNTER":
      nextProfile = withSession(baseProfile, applyCounterToSession(baseProfile.activeSession, event));
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
      nextProfile = withSession(baseProfile, advancePhase(withRuntimeSettings(baseProfile.activeSession, baseProfile.settings)));
      break;
    case "ADD_PERMANENT":
      nextProfile = addPermanent(baseProfile, event.card, event.controller || "player");
      break;
    case "ADD_CUSTOM_TOKEN":
      nextProfile = addPermanent(baseProfile, createTokenCard(event), event.controller || "player");
      break;
    case "CAST_SPELL":
      nextProfile = withSession(baseProfile, resolveSpell(withRuntimeSettings(baseProfile.activeSession, baseProfile.settings), event.card));
      nextProfile = recordCommanderCardUsage(nextProfile, { ...event.card, owner: "player", controller: "player" });
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
  return withHistory(nextProfile, finalizeAction(event, nextProfile));
}

function addPermanent(profile, card, controller) {
  const permanent = hydratePermanentEffects({
    ...card,
    controller,
    owner: card.owner || controller,
  });
  const side = controller === "opponent" ? "opponent" : "player";
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
  const simulatedOpponent = mode === "simulated" ? prepareSimulatedOpponent(profile) : null;
  const existingSettings = profile.settings?.multiplayer || {};
  const connectedPlayers = [
    { id: "local-player", name: profile.player?.name || "Player", authority: "host", role: existingSettings.role || "player" },
    ...(mode === "simulated" && simulatedOpponent
      ? [
          {
            id: simulatedOpponent.id,
            name: simulatedOpponent.name,
            authority: "guest",
            role: "player",
            publicBoardSnapshot: simulatedOpponent.publicBoardSnapshot,
          },
        ]
      : []),
  ];
  return {
    ...profile,
    settings: {
      ...(profile.settings || {}),
      multiplayer: {
        ...existingSettings,
        mode,
        connectedPlayers,
        simulatedOpponent,
        selectedSimulatedOpponentId: simulatedOpponent?.id || "",
      },
    },
  };
}

function prepareSimulatedOpponent(profile) {
  const opponent = createWorldShaperOpponent("World Shaper Sim");
  return [
    prepareSimulatedDrawStep,
    prepareSimulatedLandPlay,
    prepareSimulatedCastPermanent,
    prepareSimulatedCombat,
    prepareSimulatedPriority,
    prepareSimulatedLegalActionCheck,
  ].reduce((nextOpponent, prepare) => prepare(nextOpponent), opponent);
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

function advancePhase(session) {
  const transitioned = transitionFsm(session);
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
  return processEventTriggers(withReactivated, {
    type: "phase-changed",
    phase: PHASES[withReactivated.phaseIndex],
    eventType: "PHASE_CHANGED",
    payload: { phase: PHASES[withReactivated.phaseIndex] },
  });
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

  return recalculateContinuousEffects({
    ...nextSession,
    selectedIds: remainingSelected,
    battlefield: {
      ...nextSession.battlefield,
      player: nextSession.battlefield.player.map(scrubAttachments),
      opponent: nextSession.battlefield.opponent.map(scrubAttachments),
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
    pendingEffects: session.pendingEffects.map((effect) => (effect.id === id ? { ...effect, status: normalizedStatus, updatedAt: Date.now() } : effect)),
    effectLog: entry
      ? [
          {
            id: createId("effect"),
            at: Date.now(),
            sourceName: entry.sourceName || "Manual Effect",
            summary: `Manual effect ${summaryLabel}: ${entry.summary || entry.effect?.summary || entry.effect?.action || "effect"}`,
            status: normalizedStatus,
          },
          ...(session.effectLog || []),
        ].slice(0, 80)
      : session.effectLog,
  };
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
    },
  };
}

function withHistory(profile, event) {
  if (event.actionType === "SAVE_TICK" || event.type === "SAVE_TICK") {
    return profile;
  }
  const actionType = event.actionType || event.type || "UNKNOWN";
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
