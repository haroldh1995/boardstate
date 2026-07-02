import { getRulesEngineVersion, resolveAction, validateAction } from "./engine.js";
import { canonicalActionFromEngineAction, canonicalEventFromEngineEvent } from "../shared-contracts/index.js";

export function createBoardStateEngineRequest(profile = {}, action = {}, context = {}) {
  const activeSession = profile.activeSession || {};
  const rulesEngineVersion = getRulesEngineVersion();
  return {
    state: activeSession,
    action,
    context: {
      actingPlayerId: action.playerId || profile.player?.id || "local-player",
      controller: action.controller || "player",
      turn: activeSession.turn || 1,
      phaseIndex: activeSession.phaseIndex || 0,
      priorityHolder: activeSession.priority?.activePlayerId || "local-player",
      strictPhaseEnforcement: Boolean(profile.settings?.strictPhaseEnforcement),
      requireMana: context.requireMana ?? Boolean(activeSession.gameTracking?.active || activeSession.simulation?.enabled),
      rulesEngineVersion,
      canonicalAction: canonicalActionFromEngineAction(action, {
        gameId: activeSession.id || "",
        sessionId: activeSession.id || "",
        state: activeSession,
        rulesEngineVersion,
        actingPlayerId: action.playerId || profile.player?.id || "local-player",
        expectedRevision: activeSession.actionHistory?.length || 0,
      }),
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
  const result = resolveAction(request.state, request.action, request.context);
  return {
    ...result,
    canonicalEvents: (result.generatedEvents || []).map((event) => canonicalEventFromEngineEvent(event, {
      gameId: request.state.id || "",
      sessionId: request.state.id || "",
      state: request.state,
      actionId: request.context.canonicalAction?.actionId || "",
      rulesEngineVersion: request.context.rulesEngineVersion,
      revision: request.state.eventHistory?.length || 0,
    })),
  };
}

export function applyEngineResultToProfile(profile = {}, result = {}) {
  if (!result.nextState) return profile;
  return {
    ...profile,
    activeSession: result.nextState,
  };
}
