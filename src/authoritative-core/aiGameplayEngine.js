import { PHASES } from "../state/schema.js";
import { clonePlain } from "../shared-contracts/index.js";
import { createContractId, normalizeContractId } from "../shared-contracts/ids.js";
import { buildConfidenceReport } from "./proactiveAssistant.js";

export const AI_GAMEPLAY_ENGINE_VERSION = "boardstate-ai-gameplay-engine-0.1.0";
export const AI_DECISION_ENGINE_VERSION = "boardstate-ai-decision-engine-0.1.0";
export const AI_ANALYSIS_VERSION = "boardstate-ai-analysis-0.1.0";
export const AI_MEMORY_VERSION = "boardstate-ai-memory-0.1.0";

export const AI_INFORMATION_MODES = Object.freeze([
  "public-information",
  "hidden-information",
  "perfect-information",
  "training-mode",
]);

export const AI_SIMULATION_SPEED_MODES = Object.freeze([
  "real-time",
  "fast-forward",
  "instant-resolution",
  "step-by-step",
  "turn-by-turn",
  "event-by-event",
]);

export const AI_DIFFICULTY_TIERS = Object.freeze({
  alpha: {
    tierId: "alpha",
    label: "Alpha",
    summary: "Beginner profile with educational, visible mistakes and lower sequencing precision.",
    decisionNoise: 0.35,
    threatSensitivity: 0.55,
    resourceEfficiency: 0.45,
    explainsMistakes: true,
  },
  beta: {
    tierId: "beta",
    label: "Beta",
    summary: "Competent representative Commander profile with balanced threat assessment.",
    decisionNoise: 0.14,
    threatSensitivity: 0.76,
    resourceEfficiency: 0.72,
    explainsMistakes: true,
  },
  omega: {
    tierId: "omega",
    label: "Omega",
    summary: "Optimized profile with strong sequencing, efficient resource use, and transparent risk review.",
    decisionNoise: 0.03,
    threatSensitivity: 0.94,
    resourceEfficiency: 0.91,
    explainsMistakes: false,
  },
});

export const AI_PROFILE_CATALOG = Object.freeze([
  createProfileDefinition("aggro", "Aggro", "Prioritizes early pressure, attacks, and fast damage.", ["creature-pressure", "combat", "low-curve"]),
  createProfileDefinition("control", "Control", "Prioritizes interaction, timing, and board resets.", ["interaction", "board-wipe", "priority"]),
  createProfileDefinition("midrange", "Midrange", "Balances threats, answers, mana, and card advantage.", ["value", "removal", "resilience"]),
  createProfileDefinition("combo", "Combo", "Looks for synergistic engines and high-leverage sequences.", ["engine", "tutor", "trigger-chain"]),
  createProfileDefinition("stax", "Stax", "Emphasizes restriction effects and resource denial where legal.", ["tax", "lock", "tempo"]),
  createProfileDefinition("group-hug", "Group Hug", "Creates resources and table-wide effects without choosing outcomes.", ["resources", "politics", "table"]),
  createProfileDefinition("chaos", "Chaos", "Creates unpredictable but still rules-legal board changes.", ["variance", "randomness", "table"]),
  createProfileDefinition("politics", "Politics", "Tracks public threat posture and prior attacks without hidden collusion.", ["threat", "table", "reputation"]),
  createProfileDefinition("casual", "Casual", "Prefers clear, readable plays and fun Commander moments.", ["readability", "commander", "combat"]),
  createProfileDefinition("competitive", "Competitive", "Maximizes efficient legal actions and high-impact windows.", ["efficiency", "combo", "interaction"]),
  createProfileDefinition("experimental", "Experimental", "Explores legal alternatives for testing without scripting outcomes.", ["exploration", "analysis", "learning"]),
]);

export function createAiGameplayState(session = {}, options = {}) {
  const memory = createAiMemoryState(options.memory || session.aiGameplay?.memory || {});
  const informationMode = normalizeInformationMode(options.informationMode || session.aiGameplay?.informationMode || "public-information");
  const activeProfiles = createActiveAiProfiles(session, options);
  const latestDecision = createLatestDecisionExplanation(session, {
    informationMode,
    activeProfiles,
    memory,
  });
  const threatAnalysis = buildThreatAnalysis(session, { informationMode, memory });
  const boardAnalysis = buildBoardAnalysis(session, { informationMode, memory });
  const replayAnalysis = buildReplayAnalysis(session, { informationMode });
  const playPatterns = recognizePlayPatterns(session, { memory });
  const comparison = createDecisionComparisonFramework(session, options.decisionComparison || {});
  const confidence = buildConfidenceReport(session, options);

  return {
    version: AI_GAMEPLAY_ENGINE_VERSION,
    analysisVersion: AI_ANALYSIS_VERSION,
    available: true,
    mode: session.simulation?.enabled ? "dry-run-simulation" : "analysis-only",
    informationMode,
    localOnly: true,
    externalAiServicesEnabled: false,
    generativeAiEnabled: false,
    mutatesGameState: false,
    canWaiveRules: false,
    usesRulesEngine: true,
    usesStateEngine: true,
    usesEventKnowledgeEngine: true,
    authoritativePipeline: ["Rules Engine", "State Engine", "Event Knowledge Engine"],
    dryRun: createDryRunSummary(session),
    simulationSpeeds: AI_SIMULATION_SPEED_MODES.map((speed) => ({
      speed,
      available: true,
      architectureOnly: ["instant-resolution", "turn-by-turn", "event-by-event"].includes(speed),
    })),
    profiles: AI_PROFILE_CATALOG,
    difficultyTiers: clonePlain(AI_DIFFICULTY_TIERS),
    activeProfiles,
    latestDecision,
    threatAnalysis,
    boardAnalysis,
    replayAnalysis,
    playPatterns,
    decisionComparison: comparison,
    confidence,
    memory,
    training: {
      futureTrainingReady: true,
      userApprovedAnonymizedPatternsOnly: true,
      modifiesRules: false,
      modifiesAuthoritativeGameplay: false,
      sources: ["replay-data", "simulation-results", "player-feedback", "performance-metrics"],
    },
    boundaries: {
      neverInventsGameState: true,
      neverBypassesRulesEngine: true,
      aiActionsAreRecommendationsUntilSubmittedThroughReducer: true,
      respectsHiddenInformationMode: true,
      noStrategicCoachingUnlessRequested: true,
      noCloudAi: true,
      noExternalLlm: true,
      noDeckBuildingAi: true,
      noTournamentMatchmaking: true,
      noHubSynchronization: true,
    },
    generatedAt: Number(options.at || Date.now()),
  };
}

export function createAiMemoryState(input = {}) {
  return {
    version: input.version || AI_MEMORY_VERSION,
    enabled: input.enabled !== false,
    preferredSimulationSettings: {
      informationMode: normalizeInformationMode(input.preferredSimulationSettings?.informationMode || input.informationMode || "public-information"),
      speedMode: normalizeAllowed(input.preferredSimulationSettings?.speedMode || input.speedMode || "step-by-step", AI_SIMULATION_SPEED_MODES, "step-by-step"),
      opponentProfileIds: normalizeStringArray(input.preferredSimulationSettings?.opponentProfileIds || input.opponentProfileIds || []),
    },
    preferredExplanationLevel: normalizeAllowed(input.preferredExplanationLevel || "intermediate", ["beginner", "intermediate", "advanced"], "intermediate"),
    difficulty: normalizeAllowed(input.difficulty || "beta", Object.keys(AI_DIFFICULTY_TIERS), "beta"),
    analysisPreferences: sanitizeRecord(input.analysisPreferences || {}),
    trainingPreferences: sanitizeRecord(input.trainingPreferences || {}),
    accessibilityPreferences: sanitizeRecord(input.accessibilityPreferences || {}),
    patternWeights: sanitizeNumericRecord(input.patternWeights || {}),
    updatedAt: Number(input.updatedAt || 0),
  };
}

export function createExplainableAiDecision(session = {}, input = {}) {
  const playerId = String(input.playerId || session.simulation?.currentPlayerId || "local-player");
  const candidates = normalizeCandidateActions(input.candidateActions || []);
  const selectedAction = normalizeCandidateAction(input.selectedAction || candidates[0] || {
    actionType: "PASS_PRIORITY",
    label: "Pass priority",
  });
  const legalCandidates = candidates.filter((candidate) => candidate.legal !== false);
  const rejected = candidates
    .filter((candidate) => candidate.actionId !== selectedAction.actionId)
    .slice(0, 6)
    .map((candidate) => ({
      actionId: candidate.actionId,
      label: candidate.label,
      reason: candidate.legal === false ? "Rejected because the action was not legal." : `Lower score (${candidate.score}) than selected action (${selectedAction.score}).`,
      risk: candidate.risk || "Not selected in this simulation branch.",
    }));
  return {
    decisionId: normalizeContractId(input.decisionId || createContractId("eventId", stableHash([
      session.sessionId || session.id || "",
      playerId,
      selectedAction.actionType,
      session.turn || 1,
      session.phaseIndex || 0,
      (session.simulation?.log || [])[0]?.id || "",
    ].join("|"))), "eventId"),
    version: AI_DECISION_ENGINE_VERSION,
    playerId,
    selectedAction,
    selectedActionSubmitted: Boolean(input.selectedActionSubmitted),
    submittedThroughRulesEngine: Boolean(input.submittedThroughRulesEngine),
    mutatesGameState: false,
    legalCandidates,
    rejectedAlternatives: rejected,
    explanation: {
      why: input.why || buildDecisionWhy(session, selectedAction, playerId),
      informationUsed: buildInformationUsed(session, playerId, input.informationMode),
      alternativesConsidered: rejected.map((entry) => entry.label),
      risksConsidered: normalizeStringArray([selectedAction.risk, ...rejected.map((entry) => entry.risk)]).slice(0, 8),
      uncertainty: buildDecisionUncertainty(session, input.informationMode),
    },
    confidence: {
      information: input.informationConfidence || (input.informationMode === "perfect-information" ? "engine-verified" : "inferred"),
      execution: input.executionConfidence || (input.submittedThroughRulesEngine ? "engine-validated" : "tracking-only"),
    },
  };
}

export function buildThreatAnalysis(session = {}, options = {}) {
  const context = createAnalysisContext(session, options);
  const players = context.players
    .map((player) => {
      const permanents = getPublicPermanentsForPlayer(session, player.playerId);
      const commander = getCommanderForPlayer(session, player.playerId);
      const creaturePower = permanents
        .filter(isCreature)
        .reduce((sum, permanent) => sum + getPower(permanent), 0);
      const permanentCount = permanents.reduce((sum, permanent) => sum + Math.max(1, Number(permanent.quantity || 1)), 0);
      const manaSources = permanents.filter((permanent) => isLand(permanent) || /\bSignet\b|Sol Ring|Mana|Hedron|Archive|Dynamo|Stone/i.test(permanent.name || "")).length;
      const interactionDensity = countInteractionSignals(permanents, session, player.playerId);
      const commanderPressure = commander ? 8 + Number(commander.commanderTax || commander.tax || 0) : 0;
      const cardAdvantage = getPublicCardAdvantage(session, player.playerId, context.informationMode);
      const comboPotential = scoreComboPotential(permanents, session, player.playerId, options.memory);
      const score =
        creaturePower +
        permanentCount * 1.2 +
        manaSources * 1.8 +
        interactionDensity * 2 +
        commanderPressure +
        cardAdvantage * 1.1 +
        comboPotential;
      return {
        playerId: player.playerId,
        displayName: player.displayName,
        score: Number(score.toFixed(2)),
        categories: {
          creaturePower,
          permanentCount,
          manaSources,
          interactionDensity,
          commanderPressure,
          cardAdvantage,
          comboPotential,
        },
        reasons: buildThreatReasons({
          permanents,
          commander,
          creaturePower,
          permanentCount,
          manaSources,
          interactionDensity,
          cardAdvantage,
          comboPotential,
        }),
        confidence: {
          information: context.informationMode === "public-information" ? "inferred" : "engine-verified",
          execution: "tracking-only",
        },
      };
    })
    .sort((left, right) => right.score - left.score);
  const topPermanent = context.allPermanents
    .map((permanent) => ({
      permanentId: permanent.id || permanent.cardId || "",
      name: permanent.name || "Permanent",
      controller: permanent.controller || permanent.controllerPlayerId || "local-player",
      score: scorePermanentThreat(permanent, options.memory),
      reasons: buildPermanentThreatReasons(permanent),
    }))
    .sort((left, right) => right.score - left.score)[0] || null;
  return {
    version: AI_ANALYSIS_VERSION,
    informationMode: context.informationMode,
    rankings: players,
    mostThreateningPlayer: players[0] || null,
    mostThreateningPermanent: topPermanent,
    objectiveOnly: true,
    strategicCoaching: false,
    summary: players[0]
      ? `${players[0].displayName} currently has the highest public threat score from board, commander, mana, and interaction signals.`
      : "No public threat signals are available yet.",
  };
}

export function buildBoardAnalysis(session = {}, options = {}) {
  const context = createAnalysisContext(session, options);
  const players = context.players.map((player) => {
    const permanents = getPublicPermanentsForPlayer(session, player.playerId);
    const creatures = permanents.filter(isCreature);
    const lands = permanents.filter(isLand);
    const engines = permanents.filter((permanent) => /\bArtifact\b|\bEnchantment\b|\bPlaneswalker\b/i.test(permanent.typeLine || ""));
    const removal = countInteractionSignals(permanents, session, player.playerId);
    const life = Number(player.life ?? 40);
    const tempo = creatures.length + lands.length + engines.length * 1.4;
    const stability = life + creatures.reduce((sum, permanent) => sum + getToughness(permanent), 0) + engines.length * 2;
    return {
      playerId: player.playerId,
      displayName: player.displayName,
      life,
      boardAdvantage: Number((creatures.reduce((sum, permanent) => sum + getPower(permanent), 0) + engines.length * 2 + lands.length).toFixed(2)),
      cardAdvantage: getPublicCardAdvantage(session, player.playerId, context.informationMode),
      tempo: Number(tempo.toFixed(2)),
      manaEfficiency: lands.length ? Number((permanents.length / Math.max(1, lands.length)).toFixed(2)) : 0,
      creatureAdvantage: creatures.length,
      removalDensity: removal,
      boardStability: Number(stability.toFixed(2)),
      commanderPressure: getCommanderForPlayer(session, player.playerId) ? "present" : "not visible",
      publicResources: {
        permanents: permanents.length,
        lands: lands.length,
        creatures: creatures.length,
        engines: engines.length,
      },
      graveyardPressure: countZoneSignals(session, player.playerId, "graveyard"),
    };
  });
  return {
    version: AI_ANALYSIS_VERSION,
    informationMode: context.informationMode,
    players,
    table: {
      playerCount: players.length,
      totalPermanents: context.allPermanents.length,
      totalCreaturePower: context.allPermanents.filter(isCreature).reduce((sum, permanent) => sum + getPower(permanent), 0),
      stackCount: (session.stack || []).length,
      triggerCount: (session.triggerQueue || []).length,
      phase: PHASES[Number(session.phaseIndex || 0)] || "Beginning",
      turn: Number(session.turn || 1),
    },
    objectiveOnly: true,
    summary: players.length
      ? "Board analysis is based on public battlefield, stack, trigger, replay, and simulation evidence."
      : "Board analysis has no active players yet.",
  };
}

export function buildReplayAnalysis(session = {}, options = {}) {
  const events = [
    ...(session.eventKnowledge?.events || []),
    ...(session.actionHistory || []),
    ...(session.effectLog || []),
    ...(session.simulation?.log || []),
  ];
  const turningPoints = events
    .map((event, index) => {
      const text = `${event.summary || event.text || event.actionType || event.type || ""} ${event.detail || ""}`;
      let importance = 0;
      if (/eliminated|winner|won|lost|commander damage|game ending/i.test(text)) importance += 10;
      if (/combat|attacks|damage|board wipe|destroy|exile/i.test(text)) importance += 6;
      if (/trigger|stack|resolve|cast|counter/i.test(text)) importance += 4;
      if (event.importance === "critical") importance += 10;
      if (event.importance === "major") importance += 6;
      return {
        eventId: event.eventId || event.actionId || event.id || `event-${index}`,
        label: event.summary || event.text || event.actionType || event.type || "Game event",
        importance,
        turn: Number(event.turn || session.turn || 1),
        phase: event.phase || PHASES[Number(event.phaseIndex ?? session.phaseIndex ?? 0)] || "Beginning",
        why: importance >= 8 ? "High-impact event changed the board, life totals, commander state, or game outcome." : "Replay evidence preserved for later review.",
      };
    })
    .filter((entry) => entry.importance > 0)
    .sort((left, right) => right.importance - left.importance)
    .slice(0, 8);
  return {
    version: AI_ANALYSIS_VERSION,
    informationMode: normalizeInformationMode(options.informationMode || "public-information"),
    eventCount: events.length,
    turningPoints,
    triggerDensity: (session.triggerQueue || []).length + events.filter((event) => /trigger/i.test(`${event.summary || ""} ${event.text || ""}`)).length,
    boardComplexity: countAllPublicPermanents(session),
    commanderImpact: events.filter((event) => /commander/i.test(`${event.summary || ""} ${event.text || ""}`)).length,
    majorSwingTurns: summarizeSwingTurns(turningPoints),
    summary: turningPoints.length
      ? `${turningPoints.length} likely replay turning point(s) identified from Event Knowledge, action history, effect logs, and simulation logs.`
      : "Not enough replay evidence exists for turning-point analysis yet.",
  };
}

export function recognizePlayPatterns(session = {}, options = {}) {
  const memory = options.memory || {};
  const patterns = memory.patterns || {};
  const logs = [
    ...(session.effectLog || []),
    ...(session.simulation?.log || []),
    ...(session.eventKnowledge?.events || []),
  ].map((entry) => `${entry.summary || ""} ${entry.text || ""} ${entry.detail || ""}`);
  const detected = [
    createPattern("token-strategy", "Token pressure", Number(patterns.tokenStrategy || 0) + countMatches(logs, /token|create/i), "Token creation and token payoffs appear repeatedly."),
    createPattern("landfall-strategy", "Landfall / land recursion", Number(patterns.landfallStrategy || 0) + countMatches(logs, /landfall|land|reclamation/i), "Land entry and recursion signals appear in recent play."),
    createPattern("lifegain-strategy", "Lifegain", Number(patterns.lifegainStrategy || 0) + countMatches(logs, /gain.*life|life gained/i), "Life gain events appear often enough to remember."),
    createPattern("commander-pressure", "Commander pressure", Number(patterns.commanderDamageStrategy || 0) + countMatches(logs, /commander damage|casts commander/i), "Commander recasts or damage are shaping the game."),
    createPattern("combo-engine", "Combo engine", Number(patterns.comboEngineStrategy || 0) + countMatches(logs, /combo|copy|trigger chain|storm/i), "Engine pieces and repeated trigger chains are present."),
    createPattern("board-wipe", "Board wipe pressure", Number(patterns.boardWipeStrategy || 0) + countMatches(logs, /board wipe|destroy all|all creatures/i), "Mass removal or wipe patterns are present."),
  ].filter((entry) => entry.strength > 0)
    .sort((left, right) => right.strength - left.strength)
    .slice(0, 8);
  return {
    version: AI_ANALYSIS_VERSION,
    detected,
    remembersWithoutChangingGameplay: true,
    summary: detected.length ? `${detected.length} recurring play pattern(s) detected.` : "No recurring patterns detected yet.",
  };
}

export function createDecisionComparisonFramework(session = {}, input = {}) {
  const decisions = normalizeCandidateActions(input.decisions || input.candidateActions || []);
  return {
    version: AI_DECISION_ENGINE_VERSION,
    available: true,
    architectureOnly: decisions.length < 2,
    deterministicPredictions: false,
    mutatesAuthoritativeSession: false,
    comparisonMode: "legal-decision-branches",
    decisions: decisions.slice(0, 6).map((decision) => ({
      actionId: decision.actionId,
      label: decision.label,
      legal: decision.legal,
      score: decision.score,
      potentialOutcomes: decision.potentialOutcomes || ["Future Dry Run branch can explore this legal choice without changing the live session."],
      confidence: decision.confidence || { information: "inferred", execution: "tracking-only" },
    })),
    summary: decisions.length >= 2
      ? "Legal decisions can be compared as non-authoritative Dry Run branches."
      : "Decision comparison boundary is ready; provide two or more legal choices to compare later.",
  };
}

export function createAiAnalysisSummary(session = {}, options = {}) {
  const state = createAiGameplayState(session, options);
  return {
    version: AI_ANALYSIS_VERSION,
    mode: state.mode,
    informationMode: state.informationMode,
    topThreat: state.threatAnalysis.mostThreateningPlayer?.displayName || "",
    topPermanent: state.threatAnalysis.mostThreateningPermanent?.name || "",
    boardComplexity: state.replayAnalysis.boardComplexity,
    detectedPatterns: state.playPatterns.detected.map((entry) => entry.label),
    latestDecision: state.latestDecision?.selectedAction?.label || "",
    boundaries: state.boundaries,
  };
}

function createLatestDecisionExplanation(session = {}, options = {}) {
  const simulation = session.simulation || {};
  const latestLog = (simulation.log || [])[0];
  if (!simulation.enabled || !latestLog || latestLog.actorId === "system") {
    return null;
  }
  const playerId = latestLog.actorId || simulation.currentPlayerId || "local-player";
  return createExplainableAiDecision(session, {
    playerId,
    selectedAction: {
      actionId: latestLog.id || "",
      actionType: inferActionTypeFromText(latestLog.text || ""),
      label: latestLog.text || "AI simulation action",
      score: inferDecisionScoreFromText(latestLog.text || ""),
      risk: inferRiskFromText(latestLog.text || ""),
      legal: true,
    },
    candidateActions: inferCandidateActions(session, playerId),
    why: latestLog.detail || buildDecisionWhy(session, { label: latestLog.text || "" }, playerId),
    informationMode: options.informationMode,
    submittedThroughRulesEngine: /casts|resolves|attacks|plays|draws|passes/i.test(latestLog.text || ""),
  });
}

function createDryRunSummary(session = {}) {
  const simulation = session.simulation || {};
  return {
    active: Boolean(simulation.enabled),
    separateFromLiveGame: true,
    status: simulation.status || "idle",
    format: simulation.format || "Commander",
    currentPlayerId: simulation.currentPlayerId || "local-player",
    currentPhase: PHASES[Number(simulation.currentPhaseIndex ?? session.phaseIndex ?? 0)] || "Beginning",
    supports: {
      soloTesting: true,
      openingHands: true,
      goldfishing: true,
      comboTesting: true,
      combatTesting: true,
      stackInteraction: true,
      replacementEffects: true,
      triggerChains: true,
      multipleOpponents: true,
      futureTournamentTesting: true,
    },
    noLiveMutation: true,
    rulesEnforced: session.enforcementMode !== "waived",
    aiCannotWaiveRules: true,
    opponentCount: (simulation.selectedOpponents || []).length,
  };
}

function createActiveAiProfiles(session = {}, options = {}) {
  const simulation = session.simulation || {};
  const opponents = simulation.opponents || {};
  const profileOverrides = options.profileOverrides || {};
  return Object.values(opponents).map((npc) => {
    const difficulty = AI_DIFFICULTY_TIERS[npc.id] || AI_DIFFICULTY_TIERS.beta;
    const tags = normalizeStringArray([...(npc.strategy?.tags || []), ...(profileOverrides[npc.id]?.tags || [])]);
    const catalogProfile = pickCatalogProfile(tags);
    return {
      playerId: npc.id,
      displayName: npc.name || npc.id,
      difficulty: difficulty.tierId,
      difficultySummary: difficulty.summary,
      profileId: catalogProfile.profileId,
      profileLabel: catalogProfile.label,
      archetype: npc.strategy?.archetype || catalogProfile.summary,
      tags,
      priorities: normalizeStringArray(npc.strategy?.priorities || []).slice(0, 8),
      threatPriorityCards: normalizeStringArray(npc.strategy?.threatPriorityCards || []).slice(0, 12),
      usesRulesEngine: true,
      canWaiveRules: false,
      hiddenInformationAccess: "own-hidden-zones-only",
    };
  });
}

function pickCatalogProfile(tags = []) {
  const text = tags.join(" ").toLowerCase();
  if (/storm|combo|copy|engine/.test(text)) return AI_PROFILE_CATALOG.find((entry) => entry.profileId === "combo");
  if (/control|interaction|board-wipe|counter/.test(text)) return AI_PROFILE_CATALOG.find((entry) => entry.profileId === "control");
  if (/landfall|attrition|value|midrange/.test(text)) return AI_PROFILE_CATALOG.find((entry) => entry.profileId === "midrange");
  if (/aggro|combat|token|pressure/.test(text)) return AI_PROFILE_CATALOG.find((entry) => entry.profileId === "aggro");
  if (/politics|table/.test(text)) return AI_PROFILE_CATALOG.find((entry) => entry.profileId === "politics");
  return AI_PROFILE_CATALOG.find((entry) => entry.profileId === "casual");
}

function createAnalysisContext(session = {}, options = {}) {
  const informationMode = normalizeInformationMode(options.informationMode || "public-information");
  const simulation = session.simulation || {};
  const simulationPlayers = Object.values(simulation.players || {}).map((player) => ({
    playerId: player.id,
    displayName: player.name || player.id,
    life: player.life,
    isNpc: Boolean(player.isNpc),
  }));
  const canonicalPlayers = Array.isArray(session.players)
    ? session.players.map((player) => ({
        playerId: player.playerId || player.id,
        displayName: player.displayName || player.name || player.playerId || player.id,
        life: player.life,
        isNpc: false,
      }))
    : [];
  const local = {
    playerId: session.localPerspective?.playerId || "local-player",
    displayName: "Player",
    life: session.life ?? 40,
    isNpc: false,
  };
  const players = dedupePlayers(simulationPlayers.length ? simulationPlayers : canonicalPlayers.length ? canonicalPlayers : [local]);
  return {
    informationMode,
    players,
    allPermanents: [
      ...(session.battlefield?.player || []),
      ...(session.battlefield?.opponent || []),
    ],
  };
}

function dedupePlayers(players = []) {
  const byId = new Map();
  players.forEach((player) => {
    if (!player.playerId || byId.has(player.playerId)) return;
    byId.set(player.playerId, player);
  });
  return [...byId.values()];
}

function getPublicPermanentsForPlayer(session = {}, playerId = "") {
  if (playerId === "local-player" || playerId === session.localPerspective?.playerId) {
    return session.battlefield?.player || [];
  }
  return (session.battlefield?.opponent || []).filter((permanent) =>
    [permanent.controller, permanent.controllerPlayerId, permanent.owner, permanent.ownerPlayerId].includes(playerId)
  );
}

function getCommanderForPlayer(session = {}, playerId = "") {
  if (playerId === "local-player" || playerId === session.localPerspective?.playerId) {
    const visible = (session.battlefield?.player || []).find((permanent) => permanent.isCommander);
    return visible || session.commander || null;
  }
  const visible = (session.battlefield?.opponent || []).find((permanent) => permanent.isCommander && [permanent.controller, permanent.controllerPlayerId, permanent.owner, permanent.ownerPlayerId].includes(playerId));
  return visible || session.simulation?.opponents?.[playerId]?.commander || null;
}

function getPublicCardAdvantage(session = {}, playerId = "", informationMode = "public-information") {
  if (playerId === "local-player" || playerId === session.localPerspective?.playerId) {
    return (session.zones?.hand || []).length + Math.max(0, Number(session.zones?.unknownCounts?.hand || 0));
  }
  if (["perfect-information", "training-mode"].includes(informationMode)) {
    return session.simulation?.opponents?.[playerId]?.zones?.hand?.length || 0;
  }
  return Number(session.simulation?.opponents?.[playerId]?.publicHandCount || 0);
}

function countZoneSignals(session = {}, playerId = "", zone = "graveyard") {
  if (playerId === "local-player" || playerId === session.localPerspective?.playerId) {
    return Array.isArray(session.zones?.[zone]) ? session.zones[zone].length : 0;
  }
  return Array.isArray(session.simulation?.opponents?.[playerId]?.zones?.[zone])
    ? session.simulation.opponents[playerId].zones[zone].length
    : 0;
}

function countInteractionSignals(permanents = [], session = {}, playerId = "") {
  const permanentSignals = permanents.filter((permanent) => /destroy|exile|counter|return target|damage to any target|ward|hexproof|protection/i.test(`${permanent.oracleText || ""} ${permanent.keywords?.join(" ") || ""}`)).length;
  const stackSignals = (session.stack || []).filter((entry) => [entry.controller, entry.controllerPlayerId].includes(playerId) && /counter|destroy|exile|damage|return/i.test(`${entry.name || ""} ${entry.oracleText || ""}`)).length;
  return permanentSignals + stackSignals;
}

function scoreComboPotential(permanents = [], session = {}, playerId = "", memory = {}) {
  let score = 0;
  permanents.forEach((permanent) => {
    if (/whenever|copy|token|draw|untap|treasure|cascade|storm|landfall|sacrifice/i.test(permanent.oracleText || permanent.name || "")) score += 2;
    if (/Doubling Season|Cathars' Crusade|Scute Swarm|Storm-Kiln|Veyran|Niv-Mizzet|Zhulodok|Gitrog/i.test(permanent.name || "")) score += 5;
  });
  score += Number(memory?.patterns?.comboEngineStrategy || 0) * 0.75;
  score += (session.triggerQueue || []).filter((entry) => [entry.controller, entry.controllerPlayerId, entry.ownerPlayerId].includes(playerId)).length;
  return Number(score.toFixed(2));
}

function scorePermanentThreat(permanent = {}, memory = {}) {
  let score = 1;
  if (permanent.isCommander) score += 10;
  if (isCreature(permanent)) score += getPower(permanent) + getToughness(permanent) / 2;
  if (permanent.isToken) score += Math.min(8, Number(permanent.quantity || 1));
  if (/whenever|copy|token|draw|destroy|exile|cascade|storm|landfall/i.test(permanent.oracleText || "")) score += 4;
  score += Number(memory?.cardThreat?.[permanent.name] || 0);
  return Number(score.toFixed(2));
}

function buildThreatReasons(input = {}) {
  const reasons = [];
  if (input.commander) reasons.push("Commander is visible or castable.");
  if (input.creaturePower >= 6) reasons.push(`${input.creaturePower} public creature power.`);
  if (input.permanentCount >= 5) reasons.push(`${input.permanentCount} public permanents.`);
  if (input.manaSources >= 5) reasons.push(`${input.manaSources} visible mana sources.`);
  if (input.interactionDensity > 0) reasons.push(`${input.interactionDensity} visible interaction signal(s).`);
  if (input.comboPotential > 0) reasons.push("Engine, trigger, copy, token, or combo signals are present.");
  if (input.cardAdvantage > 0) reasons.push(`${input.cardAdvantage} known or public card-resource signal(s).`);
  return reasons.length ? reasons : ["No major public threat signal is visible."];
}

function buildPermanentThreatReasons(permanent = {}) {
  const reasons = [];
  if (permanent.isCommander) reasons.push("Commander permanent.");
  if (isCreature(permanent)) reasons.push(`${getPower(permanent)}/${getToughness(permanent)} creature body.`);
  if (permanent.isToken || Number(permanent.quantity || 1) > 1) reasons.push(`${Math.max(1, Number(permanent.quantity || 1))} stacked object(s).`);
  if (/whenever|copy|token|draw|destroy|exile|cascade|storm|landfall/i.test(permanent.oracleText || "")) reasons.push("Rules text suggests ongoing engine or interaction value.");
  return reasons.length ? reasons : ["Public permanent is visible on the battlefield."];
}

function inferCandidateActions(session = {}, playerId = "") {
  const permanents = getPublicPermanentsForPlayer(session, playerId);
  const candidates = [
    { actionType: "PASS_PRIORITY", label: "Pass priority", score: 1, legal: true },
  ];
  if (permanents.some((permanent) => isCreature(permanent) && !permanent.tapped)) {
    candidates.push({ actionType: "DECLARE_ATTACKERS", label: "Attack with available creatures", score: 5, risk: "Attacks can expose creatures to blockers.", legal: true });
  }
  if ((session.stack || []).length) {
    candidates.push({ actionType: "RESPOND_TO_STACK", label: "Respond to stack object", score: 4, risk: "Response value depends on available legal interaction.", legal: true });
  }
  if (session.simulation?.opponents?.[playerId]?.commander?.zone === "command") {
    candidates.push({ actionType: "CAST_COMMANDER", label: "Cast commander", score: 6, risk: "Commander can be removed after resolution.", legal: true });
  }
  return candidates.map(normalizeCandidateAction);
}

function normalizeCandidateActions(actions = []) {
  return (Array.isArray(actions) ? actions : []).map(normalizeCandidateAction);
}

function normalizeCandidateAction(action = {}) {
  const actionType = String(action.actionType || action.type || "ANALYZE").toUpperCase();
  const label = sanitizeText(action.label || action.summary || formatLabel(actionType));
  return {
    actionId: normalizeContractId(action.actionId || action.id || createContractId("actionId", stableHash(`${actionType}:${label}`)), "actionId"),
    actionType,
    label,
    legal: action.legal !== false,
    score: Number.isFinite(Number(action.score)) ? Number(action.score) : 1,
    risk: sanitizeText(action.risk || ""),
    potentialOutcomes: normalizeStringArray(action.potentialOutcomes || []),
    confidence: action.confidence ? clonePlain(action.confidence) : { information: "inferred", execution: "tracking-only" },
  };
}

function buildDecisionWhy(session = {}, selectedAction = {}, playerId = "") {
  const label = selectedAction.label || selectedAction.actionType || "action";
  if (/draws/i.test(label)) return "The AI advanced through its draw step using its own library information.";
  if (/plays/i.test(label)) return "The AI used its one land play for the turn when a land was available.";
  if (/casts commander/i.test(label)) return "The AI had enough visible mana to pay commander cost and tax.";
  if (/casts|resolves/i.test(label)) return "The AI selected a legal castable card according to current mana, profile priorities, and rules validation.";
  if (/attacks/i.test(label)) return "The AI selected legal untapped attackers and a public attack target from the active Commander table.";
  if (/passes|skips/i.test(label)) return "No higher-scoring legal action was available or appropriate in this simulation step.";
  return `The AI chose ${label} for ${playerId} using current public state and simulation profile priorities.`;
}

function buildInformationUsed(session = {}, playerId = "", informationMode = "public-information") {
  const used = ["public battlefield", "turn and phase", "priority state", "stack count", "trigger queue", "commander status"];
  if (playerId !== "local-player") used.push("AI player's own hand and library in Dry Run");
  if (["perfect-information", "training-mode"].includes(normalizeInformationMode(informationMode))) used.push("training-mode complete simulation state");
  if ((session.eventKnowledge?.events || []).length) used.push("Event Knowledge history");
  return used;
}

function buildDecisionUncertainty(session = {}, informationMode = "public-information") {
  const uncertainty = [];
  if (normalizeInformationMode(informationMode) === "public-information") uncertainty.push("Hidden hands and libraries are not exposed except to their owning AI during Dry Run.");
  if ((session.pendingEffects || []).length) uncertainty.push("Manual choices or unsupported interactions may require player resolution.");
  if (session.enforcementMode === "waived") uncertainty.push("Rules enforcement is waived for this session.");
  return uncertainty.length ? uncertainty : ["No major AI-decision uncertainty detected from tracked state."];
}

function inferActionTypeFromText(text = "") {
  if (/draw/i.test(text)) return "DRAW_CARD";
  if (/plays/i.test(text)) return "PLAY_LAND";
  if (/casts commander/i.test(text)) return "CAST_COMMANDER";
  if (/casts/i.test(text)) return "CAST_SPELL";
  if (/attacks/i.test(text)) return "DECLARE_ATTACKERS";
  if (/passes|skips/i.test(text)) return "PASS_PRIORITY";
  return "SIMULATION_STEP";
}

function inferDecisionScoreFromText(text = "") {
  if (/commander/i.test(text)) return 8;
  if (/attacks/i.test(text)) return 7;
  if (/casts|resolves/i.test(text)) return 6;
  if (/plays/i.test(text)) return 4;
  if (/draw/i.test(text)) return 3;
  return 1;
}

function inferRiskFromText(text = "") {
  if (/attacks/i.test(text)) return "Combat can expose attackers to blocks or crackback pressure.";
  if (/casts commander/i.test(text)) return "Commander can be removed, increasing future commander tax.";
  if (/casts|resolves/i.test(text)) return "Spell timing and targets depend on current legal choices.";
  return "Low immediate risk detected from the logged step.";
}

function summarizeSwingTurns(turningPoints = []) {
  const byTurn = {};
  turningPoints.forEach((entry) => {
    const turn = Number(entry.turn || 1);
    byTurn[turn] = Number(byTurn[turn] || 0) + Number(entry.importance || 0);
  });
  return Object.entries(byTurn)
    .map(([turn, score]) => ({ turn: Number(turn), score: Number(score) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
}

function createPattern(patternId, label, strength, explanation) {
  return {
    patternId,
    label,
    strength: Number(strength || 0),
    explanation,
    changesAuthoritativeGameplay: false,
  };
}

function countMatches(values = [], pattern) {
  return values.filter((value) => pattern.test(value)).length;
}

function countAllPublicPermanents(session = {}) {
  return (session.battlefield?.player || []).length + (session.battlefield?.opponent || []).length;
}

function isCreature(permanent = {}) {
  return Boolean(permanent.isCreature || /\bCreature\b/i.test(permanent.typeLine || ""));
}

function isLand(permanent = {}) {
  return Boolean(permanent.isLand || /\bLand\b/i.test(permanent.typeLine || ""));
}

function getPower(permanent = {}) {
  return Math.max(0, Number(permanent.currentPower ?? permanent.power ?? permanent.basePower ?? 0) || 0) * Math.max(1, Number(permanent.quantity || 1));
}

function getToughness(permanent = {}) {
  return Math.max(0, Number(permanent.currentToughness ?? permanent.toughness ?? permanent.baseToughness ?? 0) || 0) * Math.max(1, Number(permanent.quantity || 1));
}

function createProfileDefinition(profileId, label, summary, tags = []) {
  return Object.freeze({
    profileId,
    label,
    summary,
    tags: Object.freeze([...tags]),
    rulesEngineRequired: true,
    scriptsOutcomes: false,
  });
}

function normalizeInformationMode(value = "public-information") {
  return normalizeAllowed(value, AI_INFORMATION_MODES, "public-information");
}

function normalizeAllowed(value = "", allowed = [], fallback = "") {
  const normalized = String(value || "").trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeStringArray(value = []) {
  return [...new Set((Array.isArray(value) ? value : [value]).map((entry) => sanitizeText(entry)).filter(Boolean))];
}

function sanitizeText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 500);
}

function sanitizeRecord(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.fromEntries(
    Object.entries(input)
      .filter(([key]) => !/password|token|secret|credential|auth/i.test(key))
      .slice(0, 80)
      .map(([key, value]) => [sanitizeText(key).slice(0, 80), sanitizeRecordValue(value)])
  );
}

function sanitizeRecordValue(value) {
  if (Array.isArray(value)) return value.map((entry) => sanitizeRecordValue(entry)).slice(0, 40);
  if (value && typeof value === "object") return sanitizeRecord(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "boolean") return value;
  return sanitizeText(value);
}

function sanitizeNumericRecord(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.fromEntries(
    Object.entries(input)
      .filter(([key]) => !/password|token|secret|credential|auth/i.test(key))
      .slice(0, 120)
      .map(([key, value]) => [sanitizeText(key).slice(0, 80), Number.isFinite(Number(value)) ? Number(value) : 0])
  );
}

function stableHash(value = "") {
  const text = String(value || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function formatLabel(value = "") {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .trim();
}
