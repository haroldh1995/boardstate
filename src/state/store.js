import { createDefaultProfile } from "./schema.js";
import { reduceProfile } from "./gameReducer.js";
import { createPasswordProfile, loadGuestProfile, loadProfile, loginWithPassword, lockProtectedProfile, saveProfile } from "../storage/localDatabase.js";
import { createAction } from "./actions.js";
import { createSyncManager } from "../multiplayer/syncManager.js";
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

  function emit() {
    listeners.forEach((listener) => listener(state));
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

  const storeApi = {
    async init() {
      state = await loadProfile();
      configureSync();
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
      state = reduceProfile(state, action);
      emit();
      await saveProfile(state);
      if (!event?.remote && !event?.internalOnly) {
        syncManager.sendAction(action, state);
      }
      if (event?.type === "SET_MULTIPLAYER_MODE" || event?.actionType === "SET_MULTIPLAYER_MODE" || event?.type === "SET_SETTING") {
        configureSync();
      }
      refreshSimulationLoop();
    },
    async createPassword(password) {
      state = await createPasswordProfile(password, state);
      configureSync();
      emit();
      await saveProfile(state);
      refreshSimulationLoop();
    },
    async login(password) {
      state = await loginWithPassword(password);
      configureSync();
      emit();
      refreshSimulationLoop();
    },
    async continueGuest() {
      state = await loadGuestProfile();
      configureSync();
      emit();
      refreshSimulationLoop();
    },
    async lockProfile() {
      state = await lockProtectedProfile();
      configureSync();
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
