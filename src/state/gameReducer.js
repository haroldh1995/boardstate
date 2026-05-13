import { archiveCurrentGame } from "../archive/archiveService.js";
import { hydratePermanentEffects, processEventTriggers, recalculateContinuousEffects, resolveSpell } from "../effects/effectEngine.js";
import { addCardToCommanderDeck, assignCommander, castCommander, recordCommanderCardUsage } from "../game/commanderSystem.js";
import { assignBlocker, declareAttackers, resolveCombat } from "../game/combatSystem.js";
import { createManaPool, PHASES } from "./schema.js";
import { clone, createId, normalizeCount } from "./ids.js";

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
    case "LIFE_DELTA":
      nextProfile = withSession(baseProfile, {
        ...baseProfile.activeSession,
        life: Math.max(0, baseProfile.activeSession.life + Number(event.amount || 0)),
      });
      break;
    case "SET_LIFE":
      nextProfile = withSession(baseProfile, { ...baseProfile.activeSession, life: normalizeCount(event.life, 40) });
      break;
    case "ADD_COUNTER":
      nextProfile = withSession(baseProfile, applyCounterToSession(baseProfile.activeSession, event));
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
      [side]: [...profile.activeSession.battlefield[side], permanent],
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
  const safeColor = ["W", "U", "B", "R", "G", "C"].includes(color) ? color : "C";
  return {
    ...session,
    manaPool: {
      ...session.manaPool,
      [safeColor]: normalizeCount(session.manaPool[safeColor]) + normalizeCount(amount, 1),
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
