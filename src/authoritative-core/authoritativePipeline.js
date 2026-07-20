import { resolveAction, validateAction } from "../rules-engine/engine.js";
import { commitStateTransition } from "./stateEngine.js";
import { recordActionKnowledge } from "./eventKnowledgeEngine.js";

export const AUTHORITATIVE_PIPELINE_VERSION = "boardstate-authoritative-pipeline-0.1.0";

export const AUTHORITATIVE_PIPELINE_STAGES = Object.freeze([
  "player-intent",
  "input-validation",
  "rules-engine",
  "state-engine",
  "event-knowledge-engine",
  "ui-rendering",
  "replay",
  "ai",
  "synchronization",
  "question-system",
  "remind-me",
  "analytics",
  "spectator-mode",
]);

export function createAuthoritativePipelineReport(input = {}) {
  return {
    pipelineVersion: AUTHORITATIVE_PIPELINE_VERSION,
    stages: [...AUTHORITATIVE_PIPELINE_STAGES],
    rulesEngineAuthority: "rules-engine",
    stateEngineAuthority: "state-engine",
    eventKnowledgeAuthority: "event-knowledge-engine",
    uiIsAuthoritative: false,
    hubIsGameplayAuthority: false,
    deterministic: true,
    notes: Array.isArray(input.notes) ? [...input.notes] : [],
  };
}

export function validateAuthoritativePipelineAction(state = {}, action = {}, context = {}) {
  const validation = validateAction(state, action, context);
  return {
    pipelineVersion: AUTHORITATIVE_PIPELINE_VERSION,
    stage: "input-validation",
    validation,
  };
}

export function resolveAuthoritativePipelineAction(state = {}, action = {}, context = {}) {
  const validation = validateAction(state, action, context);
  if (!validation.legal && !context.allowIllegal) {
    return {
      pipelineVersion: AUTHORITATIVE_PIPELINE_VERSION,
      legal: false,
      validation,
      state,
      eventKnowledgeRecorded: false,
      blockedAt: "rules-engine",
    };
  }
  const rulesResult = resolveAction(state, action, context);
  const committedState = commitStateTransition(state, rulesResult.nextState || state, {
    action,
    actionId: action.actionId || "",
    deterministicSeed: context.deterministicSeed || "",
  });
  const knowledgeState = recordActionKnowledge(committedState, {
    actionId: action.actionId || "",
    actionType: action.actionType || action.type || "UNKNOWN",
    timestamp: action.timestamp || Date.now(),
    playerId: action.playerId || context.actingPlayerId || "local-player",
    sourceId: action.sourceId || action.id || "",
    targetIds: action.targetIds || [],
    payload: action.payload || action,
    replayable: action.replayable !== false,
    undoable: action.undoable !== false,
    resultingStateReference: `${committedState.sessionId || committedState.id}:${committedState.updatedAt}`,
  }, {
    beforeSession: state,
  });
  return {
    pipelineVersion: AUTHORITATIVE_PIPELINE_VERSION,
    legal: rulesResult.legal,
    validation,
    rulesResult,
    state: knowledgeState,
    eventKnowledgeRecorded: true,
    completedStages: [...AUTHORITATIVE_PIPELINE_STAGES],
  };
}
