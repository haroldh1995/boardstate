import { archiveCurrentGame } from "../archive/archiveService.js";
import { hydratePermanentEffects, processEventTriggers, recalculateContinuousEffects, resolveSpell } from "../effects/effectEngine.js";
import { addCardToCommanderDeck, assignCommander, castCommander, recordCommanderCardUsage } from "../game/commanderSystem.js";
import { assignBlocker, declareAttackers, resolveCombat } from "../game/combatSystem.js";
import { createManaPool, PHASES } from "./schema.js";
import { clone, createId, normalizeCount } from "./ids.js";
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
  const undoable = !["IMPORT_PROFILE", "SAVE_TICK"].includes(event.type);
  const baseProfile = undoable ? pushUndo(profile, event) : profile;
  let nextProfile = baseProfile;

  switch (event.type) {
    case "IMPORT_PROFILE":
      return event.profile;
    case "UNDO":
      return popUndo(profile);
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
      nextProfile = withSession(baseProfile, advancePhase(baseProfile.activeSession));
      break;
    case "ADD_PERMANENT":
      nextProfile = addPermanent(baseProfile, event.card, event.controller || "player");
      break;
    case "ADD_CUSTOM_TOKEN":
      nextProfile = addPermanent(baseProfile, createTokenCard(event), event.controller || "player");
      break;
    case "CAST_SPELL":
      nextProfile = withSession(baseProfile, resolveSpell(baseProfile.activeSession, event.card));
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
      nextProfile = withSession(baseProfile, removeSelectedPermanents(baseProfile.activeSession, event.mode || "remove"));
      break;
    case "CLEAR_SELECTION":
      nextProfile = withSession(baseProfile, { ...baseProfile.activeSession, selectedIds: [] });
      break;
    case "SELECT_PERMANENT":
      nextProfile = withSession(baseProfile, toggleSelection(baseProfile.activeSession, event.id));
      break;
    case "DECLARE_ATTACKERS":
      nextProfile = withSession(baseProfile, processEventTriggers(declareAttackers(baseProfile.activeSession, event.ids || []), { type: "attackers-declared" }));
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

  return withHistory(nextProfile, event);
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
  const withTriggers = processEventTriggers(session, {
    type: "permanent-entered",
    permanent,
    instances: permanent.quantity,
  });
  const withSessionProfile = withSession(profile, withTriggers);
  return controller === "player" ? recordCommanderCardUsage(withSessionProfile, permanent) : withSessionProfile;
}

function stackBattlefieldPermanent(permanents, incoming) {
  const index = permanents.findIndex((permanent) => permanentStackSignature(permanent) === permanentStackSignature(incoming));
  if (index < 0) {
    return [...permanents, incoming];
  }
  return permanents.map((permanent, permanentIndex) =>
    permanentIndex === index ? hydratePermanentEffects({ ...permanent, quantity: permanent.quantity + incoming.quantity }) : permanent
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
  return { ...profile, settings };
}

function setMultiplayerMode(profile, mode = "offline") {
  const simulatedOpponent = mode === "simulated" ? prepareSimulatedOpponent(profile) : null;
  const connectedPlayers =
    mode === "simulated"
      ? [
          { id: "local-player", name: profile.player?.name || "Player", authority: "host" },
          {
            id: simulatedOpponent.id,
            name: simulatedOpponent.name,
            authority: "guest",
            publicBoardSnapshot: simulatedOpponent.publicBoardSnapshot,
          },
        ]
      : [];
  return {
    ...profile,
    settings: {
      ...(profile.settings || {}),
      multiplayer: {
        ...(profile.settings?.multiplayer || {}),
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
  const nextPhaseIndex = (session.phaseIndex + 1) % PHASES.length;
  const isNewTurn = nextPhaseIndex === 0;
  const nextSession = {
    ...session,
    phaseIndex: nextPhaseIndex,
    turn: isNewTurn ? session.turn + 1 : session.turn,
    manaPool: createManaPool(),
    battlefield: {
      ...session.battlefield,
      player: session.battlefield.player.map((permanent) => ({
        ...permanent,
        tapped: isNewTurn ? false : permanent.tapped,
        summoningSick: isNewTurn ? false : permanent.summoningSick,
        attacking: false,
        blocking: false,
        temporaryModifiers: nextPhaseIndex === 0 ? [] : permanent.temporaryModifiers,
      })),
    },
  };
  return processEventTriggers(nextSession, { type: "phase-changed", phase: PHASES[nextPhaseIndex] });
}

function attachPermanent(session, sourceId, targetId) {
  const next = updatePermanent(session, sourceId, (permanent) => ({ ...permanent, attachedToId: targetId }));
  return recalculateContinuousEffects(next);
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
    if (permanent.quantity <= 1) {
      nextBattlefield[sideKey] = side.map((entry) => (entry.id === id ? hydratePermanentEffects(updater(entry)) : entry));
      changed = true;
      return;
    }

    const remaining = hydratePermanentEffects({ ...permanent, quantity: permanent.quantity - 1 });
    const updated = hydratePermanentEffects({
      ...updater({ ...permanent, id: createId("perm"), quantity: 1 }),
      quantity: 1,
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

function removeSelectedPermanents(session, mode) {
  const selected = new Set(session.selectedIds || []);
  if (!selected.size) {
    return session;
  }
  const removed = [...session.battlefield.player, ...session.battlefield.opponent].filter((permanent) => selected.has(permanent.id));
  return recalculateContinuousEffects({
    ...session,
    selectedIds: [],
    battlefield: {
      ...session.battlefield,
      player: session.battlefield.player.filter((permanent) => !selected.has(permanent.id)),
      opponent: session.battlefield.opponent.filter((permanent) => !selected.has(permanent.id)),
    },
    effectLog: [
      {
        id: createId("effect"),
        at: Date.now(),
        sourceName: "Permanent Controls",
        text: `${mode} ${removed.map((permanent) => permanent.name).join(", ")}`,
        status: "resolved",
      },
      ...(session.effectLog || []),
    ],
  });
}

function toggleSelection(session, id) {
  const exists = session.selectedIds.includes(id);
  return {
    ...session,
    selectedIds: exists ? session.selectedIds.filter((entry) => entry !== id) : [...session.selectedIds, id],
  };
}

function updatePendingEffect(session, id, status) {
  return {
    ...session,
    pendingEffects: session.pendingEffects.map((effect) => (effect.id === id ? { ...effect, status } : effect)),
  };
}

function withSession(profile, session) {
  return {
    ...profile,
    activeSession: {
      ...session,
      updatedAt: Date.now(),
    },
  };
}

function withHistory(profile, event) {
  if (event.type === "SAVE_TICK") {
    return profile;
  }
  return {
    ...profile,
    activeSession: {
      ...profile.activeSession,
      history: [
        {
          id: createId("event"),
          at: Date.now(),
          type: event.type,
          summary: event.summary || event.type,
        },
        ...profile.activeSession.history,
      ].slice(0, 250),
    },
  };
}

function pushUndo(profile, event) {
  return {
    ...profile,
    activeSession: {
      ...profile.activeSession,
      undoStack: [{ reason: event.type, snapshot: clone(profile.activeSession) }, ...profile.activeSession.undoStack].slice(0, 50),
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
    },
  };
}
