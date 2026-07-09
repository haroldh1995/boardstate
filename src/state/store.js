import { createDefaultProfile } from "./schema.js";
import { reduceProfile } from "./gameReducer.js";
import { createPasswordProfile, loadGuestProfile, loadProfile, loginWithPassword, lockProtectedProfile, saveProfile } from "../storage/localDatabase.js";
import { createAction } from "./actions.js";
import { createSyncManager } from "../multiplayer/syncManager.js";
import { createTournamentSyncManager } from "../multiplayer/tournamentSyncManager.js";
import { createFriendSyncManager } from "../multiplayer/friendSyncManager.js";
import { getSimulationSpeedInterval } from "../simulation/commanderSimulation.js";

export function createStore() {
  let state = createDefaultProfile();
  const listeners = new Set();
  let simulationTimer = null;
  let simulationTickInFlight = false;
  const syncManager = createSyncManager({
    onRemoteAction: async (remoteAction, publicState) => {
      const merged = {
        ...remoteAction,
        sourceId: remoteAction.sourceId || remoteAction.playerId || "remote",
        summary: remoteAction.summary || `Remote ${remoteAction.actionType || remoteAction.type}`,
      };
      state = reduceProfile(state, createAction(merged, state));
      if (publicState) {
        state = withRemotePeerState(state, publicState);
      }
      emit();
      await saveProfile(state);
    },
    onPresence: (peers) => {
      state = {
        ...state,
        settings: {
          ...(state.settings || {}),
          multiplayer: {
            ...(state.settings?.multiplayer || {}),
            connectedPlayers: peers,
          },
        },
      };
      emit();
    },
  });
  const tournamentSyncManager = createTournamentSyncManager({
    onRemoteAction: async (remoteAction) => {
      state = reduceProfile(state, createAction({ ...remoteAction, remote: true }, state));
      configureTournamentSync();
      emit(remoteAction);
      await saveProfile(state);
    },
    onPresence: async (peers) => {
      const tournament = state.tournament || {};
      if (!tournament.active) {
        return;
      }
      state = {
        ...state,
        tournament: {
          ...tournament,
          syncStatus: "wifi-connected",
          sync: {
            ...(tournament.sync || {}),
            status: "wifi-connected",
            connectedPlayers: peers,
            lastSyncAt: Date.now(),
          },
        },
      };
      emit();
      await saveProfile(state);
    },
    onStatus: async (statusEvent) => {
      const tournament = state.tournament || {};
      if (!tournament.active) {
        return;
      }
      state = {
        ...state,
        tournament: {
          ...tournament,
          syncStatus: statusEvent.status || tournament.syncStatus,
          sync: {
            ...(tournament.sync || {}),
            status: statusEvent.status || tournament.sync?.status,
            lastSyncAt: Date.now(),
          },
        },
      };
      state = reduceProfile(state, {
        type: "NOTIFICATION_ADD",
        category: "tournament",
        eventKey: statusEvent.eventKey || "syncReconnect",
        severity: statusEvent.severity || "warning",
        title: statusEvent.title || "Tournament Sync Status",
        body: statusEvent.body || "Tournament sync status changed.",
        actionLabel: "Open Tournament",
        actionPage: "tournament",
        internalOnly: true,
      });
      emit();
      await saveProfile(state);
    },
  });
  const friendSyncManager = createFriendSyncManager({
    onRemoteAction: async (remoteAction, messageType, publicProfile) => {
      if (publicProfile) {
        state = reduceProfile(state, createAction({ type: "FRIEND_UPSERT_NEARBY", peers: [publicProfile], internalOnly: true }, state));
      }
      if (messageType === "friend:request" && publicProfile?.friendCode) {
        state = reduceProfile(
          state,
          createAction(
            {
              type: "FRIEND_RECEIVE_REQUEST",
              friendCode: publicProfile.friendCode,
              displayName: publicProfile.displayName,
              source: "wifi-relay",
              internalOnly: true,
            },
            state
          )
        );
      }
      state = reduceProfile(state, {
        type: "NOTIFICATION_ADD",
        category: "friend",
        eventKey: messageType === "friend:tournament-invite" ? "tournamentInvite" : messageType === "friend:game-invite" ? "gameInvite" : "friendRequest",
        severity: "info",
        title: messageType === "friend:tournament-invite" ? "Friend Tournament Invite" : messageType === "friend:game-invite" ? "Friend Game Invite" : "Friend Message",
        body: `${publicProfile?.displayName || "A BoardState player"} sent ${messageType || "a friend message"}. Confirm locally before joining anything.`,
        actionLabel: "Open Friends",
        actionPage: "options:friends",
        internalOnly: true,
      });
      emit(remoteAction);
      await saveProfile(state);
    },
    onNearbyPlayers: async (peers) => {
      state = reduceProfile(state, createAction({ type: "FRIEND_UPSERT_NEARBY", peers, internalOnly: true }, state));
      emit();
      await saveProfile(state);
    },
    onStatus: async (statusEvent) => {
      state = reduceProfile(state, {
        type: "NOTIFICATION_ADD",
        category: "friend",
        eventKey: statusEvent.eventKey || "syncUnavailable",
        severity: statusEvent.severity || "warning",
        title: statusEvent.title || "Friend Discovery",
        body: statusEvent.body || "Friend discovery status changed.",
        actionLabel: "Open Friends",
        actionPage: "options:friends",
        fullWindow: false,
        toast: true,
        internalOnly: true,
      });
      emit();
      await saveProfile(state);
    },
  });

  function emit(action = null) {
    listeners.forEach((listener) => listener(state, action));
  }

  function refreshSimulationLoop() {
    clearTimeout(simulationTimer);
    simulationTimer = null;
    const simulation = state.activeSession?.simulation;
    const mode = state.settings?.multiplayer?.mode;
    if (mode !== "simulated" || !simulation?.enabled || simulation.status !== "running") {
      return;
    }
    const waitMs = getSimulationSpeedInterval(simulation.speed || "normal");
    simulationTimer = setTimeout(async () => {
      if (simulationTickInFlight) {
        return;
      }
      simulationTickInFlight = true;
      const speedSnapshot = state.activeSession?.simulation?.speed || "normal";
      try {
        await storeApi.dispatch({
          type: "SIMULATION_TICK",
          sourceId: "simulation-engine",
          playerId: state.activeSession?.simulation?.currentPlayerId || "npc",
          internalOnly: true,
          remote: true,
        });
        if (speedSnapshot === "step") {
          await storeApi.dispatch({
            type: "SIMULATION_PAUSE",
            sourceId: "simulation-engine",
            internalOnly: true,
            remote: true,
          });
        }
      } finally {
        simulationTickInFlight = false;
      }
    }, waitMs);
  }

  function configureSync() {
    const multiplayer = state.settings?.multiplayer || {};
    const mode = multiplayer.mode === "wifi" ? "wifi" : multiplayer.mode === "local" ? "local" : multiplayer.mode === "simulated" ? "simulated" : "offline";
    syncManager.configure(mode, {
      roomId: multiplayer.roomId || "boardstate-room",
      wsUrl: multiplayer.wsUrl || "ws://localhost:8787",
      role: multiplayer.role || "player",
      localName: state.player?.name || "Player",
      simulatedPlayers: Object.values(state.activeSession?.simulation?.opponents || {}).map((opponent) => ({
        id: opponent.id,
        name: opponent.name,
        role: "player",
      })),
    });
  }

  function configureTournamentSync() {
    tournamentSyncManager.configure(state.tournament || {}, state.settings?.multiplayer || {});
  }

  function configureFriendSync() {
    friendSyncManager.configure(state, state.settings?.multiplayer || {});
  }

  const storeApi = {
    async init() {
      state = await loadProfile();
      configureSync();
      configureTournamentSync();
      configureFriendSync();
      emit();
      refreshSimulationLoop();
    },
    getState() {
      return state;
    },
    async dispatch(event) {
      const action = createAction(event, state);
      if (isSpectatorBlocked(state, action)) {
        return;
      }
      const previousState = state;
      state = reduceProfile(state, action);
      if (state === previousState) {
        refreshSimulationLoop();
        return;
      }
      emit(action);
      await saveProfile(state);
      const isTournamentAction = String(action.actionType || "").startsWith("TOURNAMENT_");
      const isFriendAction = String(action.actionType || "").startsWith("FRIEND_");
      if (!event?.remote && !event?.internalOnly && !isTournamentAction && !isFriendAction) {
        syncManager.sendAction(action, state);
      }
      if (!event?.remote && !event?.internalOnly && isTournamentAction) {
        configureTournamentSync();
        tournamentSyncManager.sendAction(action, state.tournament);
      }
      if (!event?.remote && !event?.internalOnly && isFriendAction) {
        configureFriendSync();
        friendSyncManager.sendAction(action, state);
      }
      if (event?.type === "SET_MULTIPLAYER_MODE" || event?.actionType === "SET_MULTIPLAYER_MODE" || event?.type === "SET_SETTING") {
        configureSync();
        configureFriendSync();
      }
      refreshSimulationLoop();
    },
    async createPassword(password) {
      state = await createPasswordProfile(password, state);
      configureSync();
      configureTournamentSync();
      configureFriendSync();
      emit();
      await saveProfile(state);
      refreshSimulationLoop();
    },
    async login(password) {
      state = await loginWithPassword(password);
      configureSync();
      configureTournamentSync();
      configureFriendSync();
      emit();
      refreshSimulationLoop();
    },
    async continueGuest() {
      state = await loadGuestProfile();
      configureSync();
      configureTournamentSync();
      configureFriendSync();
      emit();
      refreshSimulationLoop();
    },
    async lockProfile() {
      state = await lockProtectedProfile();
      configureSync();
      configureTournamentSync();
      configureFriendSync();
      emit();
      refreshSimulationLoop();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return storeApi;
}

function withRemotePeerState(profile, publicState) {
  const existing = profile.settings?.multiplayer?.connectedPlayers || [];
  const remotePeer = {
    id: publicState.player?.name || "remote-peer",
    name: publicState.player?.name || "Remote Player",
    authority: "peer",
    publicBoardSnapshot: publicState.battlefield?.player || [],
    life: publicState.life,
    turn: publicState.turn,
    phaseIndex: publicState.phaseIndex,
    activeInterface: publicState.localInterfaceMode || publicState.activeInterfaceByPlayer?.[publicState.player?.id] || "unknown",
    connectionStatus: "online",
    priority: publicState.priority || {},
    stackSummary: publicState.stack || [],
    combatSummary: publicState.combat || {},
    rulesEngineVersion: publicState.rulesEngineVersion || "",
    schemaVersion: publicState.schemaVersion || "",
    sessionRevision: publicState.revision || 0,
    sourceApp: "boardstate",
    spectator: profile.settings?.multiplayer?.spectatorMode || false,
  };
  const connectedPlayers = [...existing.filter((entry) => entry.id !== remotePeer.id), remotePeer];
  return {
    ...profile,
    settings: {
      ...(profile.settings || {}),
      multiplayer: {
        ...(profile.settings?.multiplayer || {}),
        connectedPlayers,
      },
    },
  };
}

function isSpectatorBlocked(state, action) {
  const multiplayer = state.settings?.multiplayer || {};
  if (!multiplayer.spectatorMode && multiplayer.role !== "spectator") {
    return false;
  }
  if (String(action.actionType || "").startsWith("FRIEND_")) {
    return false;
  }
  const allowed = new Set([
    "SET_MULTIPLAYER_MODE",
    "SET_SETTING",
    "START_SIMULATION",
    "SIMULATION_PAUSE",
    "SIMULATION_RESUME",
    "SIMULATION_STOP",
    "SIMULATION_PASS_TURN",
    "SIMULATION_SET_SPEED",
    "UNDO",
    "REDO",
    "TRIGGER_QUEUE_RESOLVE",
    "TRIGGER_QUEUE_SKIP",
    "TRIGGER_QUEUE_DELAY",
  ]);
  return !allowed.has(action.actionType);
}
