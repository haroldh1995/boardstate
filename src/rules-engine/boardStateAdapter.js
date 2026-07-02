import { getRulesEngineVersion, resolveAction, validateAction } from "./engine.js";

export function createBoardStateEngineRequest(profile = {}, action = {}, context = {}) {
  return {
    state: profile.activeSession || {},
    action,
    context: {
      actingPlayerId: action.playerId || profile.player?.id || "local-player",
      controller: action.controller || "player",
      turn: profile.activeSession?.turn || 1,
      phaseIndex: profile.activeSession?.phaseIndex || 0,
      priorityHolder: profile.activeSession?.priority?.activePlayerId || "local-player",
      strictPhaseEnforcement: Boolean(profile.settings?.strictPhaseEnforcement),
      requireMana: context.requireMana ?? Boolean(profile.activeSession?.gameTracking?.active || profile.activeSession?.simulation?.enabled),
      rulesEngineVersion: getRulesEngineVersion(),
      ...context,
    },
  };
}

export function validateBoardStateAction(profile = {}, action = {}, context = {}) {
  const request = createBoardStateEngineRequest(profile, action, context);
  return validateAction(request.state, request.action, request.context);
}

export function resolveBoardStateAction(profile = {}, action = {}, context = {}) {
  const request = createBoardStateEngineRequest(profile, action, context);
  return resolveAction(request.state, request.action, request.context);
}

export function applyEngineResultToProfile(profile = {}, result = {}) {
  if (!result.nextState) return profile;
  return {
    ...profile,
    activeSession: result.nextState,
  };
}
