import { PHASES } from "../state/schema.js";
import { buildAdvancedMultiplayerPerspective } from "../shared-session/perspective.js";
import { clonePlain } from "../shared-contracts/index.js";
import { createRulesAssistantState } from "../authoritative-core/rulesAssistant.js";

export const LANDSCAPE_BATTLEFIELD_VERSION = "boardstate-landscape-battlefield-0.5.0";
export const BATTLEFIELD_INTELLIGENCE_VERSION = "boardstate-battlefield-intelligence-0.1.0";
export const BATTLEFIELD_CAMERA_VERSION = "boardstate-camera-foundation-0.2.0";
export const GAMEPLAY_FLOW_VERSION = "boardstate-gameplay-flow-0.1.0";
export const BATTLEFIELD_MOTION_VERSION = "boardstate-battlefield-motion-0.1.0";

export const LANDSCAPE_BATTLEFIELD_REGIONS = Object.freeze([
  "global-info",
  "opponent-battlefield",
  "command-center",
  "local-battlefield",
  "context-actions",
]);

export const PERMANENT_LANE_ORDER = Object.freeze([
  "commanders",
  "creatures",
  "lands",
  "artifacts",
  "enchantments",
  "planeswalkers",
  "battles",
  "tokens",
  "other",
]);

export const PERMANENT_LANE_LABELS = Object.freeze({
  commanders: "Commanders",
  creatures: "Creatures",
  lands: "Lands",
  artifacts: "Artifacts",
  enchantments: "Enchantments",
  planeswalkers: "Planeswalkers",
  battles: "Battles",
  tokens: "Tokens",
  other: "Other Permanents",
});

export const LANDSCAPE_CONTEXT_ACTIONS = Object.freeze([
  { id: "search", label: "Search / Add", status: "available", utilityPanel: "search" },
  { id: "stack", label: "Stack", status: "available", utilityPanel: "stack" },
  { id: "triggers", label: "Trigger Queue", status: "available", utilityPanel: "triggers" },
  { id: "question", label: "Ask Why", status: "available", utilityPanel: "rules-assistant" },
  { id: "history", label: "History", status: "available", utilityPanel: "history" },
  { id: "display", label: "Display", status: "available", utilityPanel: "display" },
  { id: "settings", label: "Settings", status: "available", opensOptions: true },
]);

export const CAMERA_FOCUS_PRIORITIES = Object.freeze({
  selectedPermanent: 100,
  resolvingStackObject: 90,
  priorityDecision: 84,
  combat: 78,
  commanderChange: 70,
  majorBattlefieldChange: 62,
  activePlayer: 46,
  tableDefault: 10,
});

export const CONTEXTUAL_HUD_STATES = Object.freeze([
  "expanded",
  "compact",
  "collapsed",
  "hidden",
]);

export const MOTION_EVENT_KINDS = Object.freeze([
  "draw",
  "cast",
  "resolve",
  "counter",
  "destroy",
  "exile",
  "return",
  "bounce",
  "mill",
  "discard",
  "reveal",
  "shuffle",
  "create-token",
  "copy",
  "transform",
  "flip",
  "meld",
  "mutate",
  "equip",
  "attach-aura",
  "untap",
  "tap",
  "phasing",
  "blink",
  "commander-entering",
  "commander-returning",
  "commander-tax-change",
  "life-change",
  "commander-damage",
  "priority-change",
  "trigger-chain",
  "board-wipe",
  "player-elimination",
  "winning-moment",
  "permanent-reorder",
  "token-group",
  "token-expand",
  "stack-grow",
  "stack-resolve",
  "replacement-effect",
]);

export const MOTION_INTENSITY_LEVELS = Object.freeze(["full", "reduced", "minimal", "none"]);

const KEYWORD_STATUS_LABELS = Object.freeze([
  "Flying",
  "Reach",
  "Menace",
  "First Strike",
  "Double Strike",
  "Vigilance",
  "Lifelink",
  "Deathtouch",
  "Trample",
  "Indestructible",
  "Hexproof",
  "Ward",
  "Protection",
]);

export function createLandscapeBattlefieldModel(profileOrSession = {}, options = {}) {
  const profile = profileOrSession.activeSession ? profileOrSession : { activeSession: profileOrSession };
  const session = profile.activeSession || {};
  const viewport = resolveViewport(options.viewport);
  const perspective = options.perspective || buildAdvancedMultiplayerPerspective(profileOrSession, {
    viewport,
    localPlayerId: options.localPlayerId,
    focusedOpponentId:
      options.focusedOpponentId ||
      profile.settings?.battlefield?.focusedOpponentId ||
      session.advancedMultiplayer?.focusedOpponentId ||
      "",
  });
  const selectedIds = new Set(session.selectedIds || []);
  const opponentCarousel = createOpponentCarouselModel(session, perspective, {
    focusedOpponentId:
      options.focusedOpponentId ||
      perspective.focusedOpponentId ||
      profile.settings?.battlefield?.focusedOpponentId ||
      session.advancedMultiplayer?.focusedOpponentId ||
      "",
  });
  const localBoard = createBattlefieldRegion(
    perspective.localBoard || {
      id: perspective.localPlayerId || "local-player",
      playerId: perspective.localPlayerId || "local-player",
      name: profile.player?.name || "Player",
      permanents: session.battlefield?.player || [],
      life: session.life ?? 40,
    },
    "local",
    { selectedIds, session }
  );
  const focusedOpponent =
    (perspective.opponentBoards || []).find((board) => getBoardId(board) === opponentCarousel.focusedOpponentId) ||
    perspective.focusedOpponent ||
    perspective.primaryOpponentBoard ||
    (perspective.opponentBoards || [])[0] ||
    null;
  const opponentBoard = focusedOpponent
    ? createBattlefieldRegion(focusedOpponent, "opponent", { selectedIds, session, readonly: true })
    : createEmptyBattlefieldRegion("opponent");
  const selectedCard = createSelectedCardDetails(session, {
    selectedIds,
    localBoard,
    opponentBoard,
    stackContext: perspective.stackContext,
  });
  const rulesAssistant = createRulesAssistantState(session, {
    selectedPermanentId: selectedCard.card?.id || "",
    localBoard,
    opponentBoard,
    explanationLevel: profile.settings?.rulesAssistant?.explanationLevel || "intermediate",
  });
  const commandCenter = createCommandCenterModel(session, perspective, selectedCard);
  const density = resolveBattlefieldDensity({
    localPermanentCount: localBoard.totalPermanentCount,
    opponentPermanentCount: opponentBoard.totalPermanentCount,
    tokenCount: localBoard.tokenCount + opponentBoard.tokenCount,
    playerCount: perspective.playerCount || opponentCarousel.totalPlayerCount,
    viewport,
  });
  const intelligence = createBattlefieldIntelligenceModel({
    session,
    perspective,
    localBoard,
    opponentBoard,
    commandCenter,
    opponentCarousel,
    density,
    viewport,
  });
  const gameplayFlow = createGameplayFlowModel({
    session,
    perspective,
    localBoard,
    opponentBoard,
    commandCenter,
    selectedCard,
  });
  const camera = createBattlefieldCameraModel({
    session,
    perspective,
    selectedCard,
    commandCenter,
    opponentCarousel,
    intelligence,
  });
  const motion = createBattlefieldMotionModel({
    session,
    perspective,
    localBoard,
    opponentBoard,
    commandCenter,
    selectedCard,
    camera,
    intelligence,
    gameplayFlow,
    preferences: {
      ...(profile.settings?.battlefield || {}),
      ...(profile.settings?.accessibility || {}),
      ...(options.motionPreferences || {}),
    },
  });
  return {
    version: LANDSCAPE_BATTLEFIELD_VERSION,
    orientation: "landscape-first",
    regions: LANDSCAPE_BATTLEFIELD_REGIONS,
    viewport,
    density,
    perspective: {
      viewMode: perspective.viewMode || "solo-advanced",
      localPlayerId: perspective.localPlayerId || "local-player",
      focusedOpponentId: opponentBoard.playerId || "",
      playerCount: perspective.playerCount || 1,
      hiddenIndicators: clonePlain(perspective.hiddenIndicators || []),
    },
    opponentCarousel,
    camera,
    intelligence,
    gameplayFlow,
    motion,
    rulesAssistant,
    globalInfo: createGlobalInfoModel(session, perspective),
    opponentBattlefield: opponentBoard,
    commandCenter,
    localBattlefield: localBoard,
    contextActions: createContextActionModel(session),
    accessibility: {
      touchTargetMinimumPx: 44,
      keyboardNavigableRegions: LANDSCAPE_BATTLEFIELD_REGIONS,
      reducedMotionHonored: true,
      hiddenInformationPolicy: "public-board-projection-only",
    },
  };
}

export function createOpponentCarouselModel(session = {}, perspective = {}, options = {}) {
  const opponentBoards = clonePlain(perspective.opponentBoards || []);
  const localPlayerId = perspective.localPlayerId || "local-player";
  const activePlayerId =
    perspective.promptOwnership?.activePlayerId ||
    session.syncedMultiplayer?.currentPlayerId ||
    session.simulation?.currentPlayerId ||
    localPlayerId;
  const activeOpponent = opponentBoards.find((board) => getBoardId(board) === activePlayerId || board.playerId === activePlayerId);
  const requestedFocusId = String(options.focusedOpponentId || "");
  const focusedBoard =
    opponentBoards.find((board) => getBoardId(board) === requestedFocusId || board.playerId === requestedFocusId) ||
    activeOpponent ||
    opponentBoards[0] ||
    null;
  const focusedOpponentId = focusedBoard ? getBoardId(focusedBoard) : "";
  const focusedIndex = focusedBoard ? Math.max(0, opponentBoards.findIndex((board) => getBoardId(board) === focusedOpponentId)) : -1;
  const opponents = opponentBoards.map((board, index) =>
    createOpponentSummary(board, {
      index,
      session,
      perspective,
      focused: getBoardId(board) === focusedOpponentId,
      active: getBoardId(board) === activePlayerId || board.playerId === activePlayerId,
      localPlayerId,
    })
  );
  const previousIndex = opponents.length ? (focusedIndex - 1 + opponents.length) % opponents.length : -1;
  const nextIndex = opponents.length ? (focusedIndex + 1) % opponents.length : -1;
  const activeOpponentId = activeOpponent ? getBoardId(activeOpponent) : "";
  return {
    version: "boardstate-opponent-carousel-0.1.0",
    enabled: opponents.length > 0,
    focusedOpponentId,
    focusedIndex,
    focusedOpponent: focusedIndex >= 0 ? opponents[focusedIndex] : null,
    opponents,
    totalOpponents: opponents.length,
    totalPlayerCount: Number(perspective.playerCount || opponents.length + 1),
    renderedOpponentBattlefields: focusedIndex >= 0 ? 1 : 0,
    loopNavigation: opponents.length > 1,
    previousOpponentId: previousIndex >= 0 ? opponents[previousIndex]?.playerId || "" : "",
    nextOpponentId: nextIndex >= 0 ? opponents[nextIndex]?.playerId || "" : "",
    activeOpponentId,
    followActivePlayer: {
      enabled: Boolean(activeOpponentId && activeOpponentId === focusedOpponentId),
      available: Boolean(activeOpponentId && activeOpponentId !== focusedOpponentId),
      targetOpponentId: activeOpponentId,
      targetLabel: activeOpponent?.name || resolveParticipantName(perspective, activeOpponentId),
    },
    inputMethods: Object.freeze([
      "arrow-buttons",
      "quick-jump",
      "keyboard",
      "controller-compatible-keyboard",
      "mouse-wheel",
      "swipe",
    ]),
    seatingOrderPreserved: true,
    publicOnly: true,
    focusReason: selectedFocusReason({ activeOpponentId, focusedOpponentId, requestedFocusId, opponents }),
  };
}

export function organizePermanentsByLane(permanents = [], options = {}) {
  const selectedIds = options.selectedIds instanceof Set ? options.selectedIds : new Set(options.selectedIds || []);
  const byLane = new Map(PERMANENT_LANE_ORDER.map((lane) => [lane, []]));
  (permanents || []).forEach((permanent) => {
    const lane = getPermanentLaneKey(permanent);
    byLane.get(lane)?.push(createPermanentPresentation(permanent, { selected: selectedIds.has(permanent.id) }));
  });
  return PERMANENT_LANE_ORDER.map((lane) => {
    const lanePermanents = byLane.get(lane) || [];
    const total = lanePermanents.reduce((sum, permanent) => sum + Number(permanent.quantity || 1), 0);
    const tapped = lanePermanents
      .filter((permanent) => permanent.tapped)
      .reduce((sum, permanent) => sum + Number(permanent.quantity || 1), 0);
    return {
      key: lane,
      label: PERMANENT_LANE_LABELS[lane] || lane,
      permanents: lanePermanents,
      count: total,
      readyCount: Math.max(0, total - tapped),
      tappedCount: tapped,
      tokenStacks: lane === "tokens" ? createTokenStacks(lanePermanents) : [],
      density: getLaneDensity(total),
      layoutMode: getLaneLayoutMode(total, lane),
      canSmartCollapse: total === 0 || (lane !== "commanders" && total >= 10),
      tokenIntelligence: lane === "tokens" ? createTokenIntelligence(lanePermanents) : null,
      empty: lanePermanents.length === 0,
    };
  });
}

export function createPermanentPresentation(permanent = {}, options = {}) {
  const counters = Object.entries(permanent.counters || {})
    .filter(([, value]) => Number(value) > 0)
    .map(([counterType, value]) => ({ counterType, value: Number(value) }));
  const statusLabels = collectStatusLabels(permanent);
  return {
    ...clonePlain(permanent),
    selected: Boolean(options.selected || permanent.selected),
    laneKey: getPermanentLaneKey(permanent),
    powerToughness:
      permanent.isCreature || permanent.currentPower !== undefined || permanent.currentToughness !== undefined
        ? `${permanent.currentPower ?? permanent.power ?? "0"}/${permanent.currentToughness ?? permanent.toughness ?? "0"}`
        : "",
    countersSummary: counters,
    statusLabels,
    currentCharacteristics: {
      name: permanent.name || "Permanent",
      manaCost: permanent.manaCost || "",
      typeLine: permanent.typeLine || "Permanent",
      oracleText: permanent.oracleText || permanent.rulesText || "",
      keywords: [...new Set([...(permanent.keywords || []), ...statusLabels.filter((label) => KEYWORD_STATUS_LABELS.includes(label))])],
      power: permanent.currentPower ?? permanent.power ?? "",
      toughness: permanent.currentToughness ?? permanent.toughness ?? "",
      loyalty: permanent.counters?.Loyalty ?? permanent.loyalty ?? "",
      defense: permanent.defense ?? "",
    },
    relationshipsSummary: {
      owner: permanent.owner || permanent.ownerPlayerId || "unknown",
      controller: permanent.controller || permanent.controllerPlayerId || "unknown",
      attachedToId: permanent.attachedToId || permanent.attachedTo || "",
      attachments: clonePlain(permanent.attachments || []),
      equipment: clonePlain(permanent.equipment || permanent.equippedBy || []),
      auras: clonePlain(permanent.auras || permanent.enchantedBy || []),
    },
  };
}

export function createTokenStacks(permanents = []) {
  const stacks = new Map();
  (permanents || []).filter((permanent) => permanent.isToken || getPermanentLaneKey(permanent) === "tokens").forEach((permanent) => {
    const key = [
      permanent.name || "Token",
      permanent.typeLine || "Token",
      permanent.controller || "player",
      permanent.owner || permanent.controller || "player",
      permanent.tapped ? "tapped" : "ready",
      JSON.stringify(permanent.counters || {}),
      permanent.currentPower ?? permanent.power ?? "",
      permanent.currentToughness ?? permanent.toughness ?? "",
    ].join("|");
    const current = stacks.get(key) || {
      stackId: `token-stack:${key}`,
      name: permanent.name || "Token",
      typeLine: permanent.typeLine || "Token",
      controller: permanent.controller || "player",
      quantity: 0,
      representativeId: permanent.id || "",
      memberIds: [],
      tapped: Boolean(permanent.tapped),
      counters: clonePlain(permanent.counters || {}),
      powerToughness:
        permanent.currentPower !== undefined || permanent.currentToughness !== undefined
          ? `${permanent.currentPower ?? permanent.power ?? "0"}/${permanent.currentToughness ?? permanent.toughness ?? "0"}`
          : "",
    };
    current.quantity += Number(permanent.quantity || 1);
    current.memberIds.push(permanent.id || current.representativeId);
    stacks.set(key, current);
  });
  return [...stacks.values()];
}

function createOpponentSummary(board = {}, options = {}) {
  const permanents = clonePlain(board.permanents || []);
  const commanderHud = createCommanderHud(board, options.session, "opponent");
  const counters = board.playerCounters || {};
  const status = board.status || board.tableStatus || {};
  return {
    playerId: getBoardId(board),
    seatId: board.seatId || board.seat?.seatId || `seat-${options.index + 1}`,
    tableOrder: Number(board.tableOrder ?? board.seat?.tableOrder ?? options.index + 1),
    displayOrder: Number(board.displayOrder ?? options.index + 1),
    name: board.name || resolveParticipantName(options.perspective, getBoardId(board)) || "Opponent",
    deckName: board.deckName || "",
    focused: Boolean(options.focused),
    activeTurn: Boolean(options.active),
    life: Number(board.life ?? 40),
    poisonCounters: Number(board.poisonCounters || counters.poison || 0),
    energy: Number(board.energy ?? counters.energy ?? 0),
    experience: Number(board.experience ?? counters.experience ?? 0),
    cardsInHand: resolvePublicZoneCount(board, "hand"),
    permanentCount: permanents.reduce((sum, permanent) => sum + Number(permanent.quantity || 1), 0),
    commanderDamage: clonePlain(board.commanderDamage || {}),
    commanderHud,
    commanderSummary: commanderHud.map((commander) => ({
      commanderId: commander.commanderId,
      name: commander.name,
      zone: commander.zone,
      tax: commander.commanderTax,
      castCount: commander.castCount,
      available: commander.available,
    })),
    monarch: status.monarch || counters.monarch || "",
    initiative: status.initiative || counters.initiative || "",
    cityBlessing: Boolean(status.cityBlessing || counters.cityBlessing),
    importantPublicEffects: clonePlain(board.publicEffects || board.importantPublicEffects || []),
    publicOnly: true,
    hiddenZonesExcluded: true,
  };
}

function createTokenIntelligence(permanents = []) {
  const stacks = createTokenStacks(permanents);
  const total = stacks.reduce((sum, stack) => sum + Number(stack.quantity || 1), 0);
  return {
    stackCount: stacks.length,
    totalTokenCount: total,
    mode: total >= 10 ? "stacked-summary" : stacks.length > 1 ? "grouped" : "standard",
    canExpand: stacks.some((stack) => Number(stack.quantity || 1) > 1),
    preservesIndividualIdentity: true,
  };
}

function resolvePublicZoneCount(board = {}, zoneName = "") {
  const zoneCounts = board.publicZoneCounts || board.zoneCounts || board.hiddenZoneCounts || {};
  const value =
    zoneCounts[zoneName] ??
    board[`${zoneName}Count`] ??
    board.cardsInHand ??
    board.handSize;
  if (value === undefined || value === null || value === "") {
    return "unknown";
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : String(value);
}

function selectedFocusReason({ activeOpponentId = "", focusedOpponentId = "", requestedFocusId = "", opponents = [] } = {}) {
  if (!opponents.length) return "no-opponents";
  if (requestedFocusId && requestedFocusId === focusedOpponentId) return "manual-selection";
  if (activeOpponentId && activeOpponentId === focusedOpponentId) return "active-player";
  return "seat-order";
}

export function createBattlefieldCameraModel({
  session = {},
  perspective = {},
  selectedCard = {},
  commandCenter = {},
  opponentCarousel = {},
  intelligence = {},
} = {}) {
  const focusQueue = [];
  if (selectedCard.mode === "selected-card" && selectedCard.card?.id) {
    focusQueue.push({
      kind: "selected-permanent",
      priority: CAMERA_FOCUS_PRIORITIES.selectedPermanent,
      targetId: selectedCard.card.id,
      label: selectedCard.title || selectedCard.card.name || "Selected permanent",
    });
  }
  const stackTop = (commandCenter.stackObjects || [])[0] || (session.stack || [])[0] || null;
  if (stackTop) {
    focusQueue.push({
      kind: "stack-object",
      priority: CAMERA_FOCUS_PRIORITIES.resolvingStackObject,
      targetId: stackTop.id || stackTop.stackObjectId || "",
      label: stackTop.name || stackTop.card?.name || "Stack object",
    });
  }
  if (commandCenter.localCanAct || (commandCenter.pendingChoices || []).length) {
    focusQueue.push({
      kind: "priority-decision",
      priority: CAMERA_FOCUS_PRIORITIES.priorityDecision,
      targetId: commandCenter.priorityHolderId || "",
      label: commandCenter.priorityHolderName || "Priority decision",
    });
  }
  if (isCombatRelevant(commandCenter.combat, commandCenter.phaseLabel)) {
    focusQueue.push({
      kind: "combat",
      priority: CAMERA_FOCUS_PRIORITIES.combat,
      targetId: commandCenter.combat?.defendingPlayerId || commandCenter.activePlayerId || "",
      label: "Combat",
    });
  }
  const commanderFocus = (commandCenter.commanderTaxSummary || []).find((entry) =>
    ["command", "command-zone", "graveyard", "exile"].includes(String(entry.zone || "").toLowerCase()) ||
    Number(entry.tax || 0) > 0 ||
    Number(entry.castCount || 0) > 0
  );
  if (commanderFocus) {
    focusQueue.push({
      kind: "commander-status",
      priority: CAMERA_FOCUS_PRIORITIES.commanderChange,
      targetId: commanderFocus.commanderId || commanderFocus.name || "",
      label: commanderFocus.name || "Commander",
    });
  }
  if (intelligence?.conditions?.crowdedBoard || intelligence?.conditions?.highTokenCount) {
    focusQueue.push({
      kind: "major-battlefield-change",
      priority: CAMERA_FOCUS_PRIORITIES.majorBattlefieldChange,
      targetId: opponentCarousel.focusedOpponentId || perspective.localPlayerId || "table",
      label: intelligence.conditions.highTokenCount ? "Large token board" : "Crowded board",
    });
  }
  if (commandCenter.activePlayerId) {
    focusQueue.push({
      kind: "active-player",
      priority: CAMERA_FOCUS_PRIORITIES.activePlayer,
      targetId: commandCenter.activePlayerId,
      label: commandCenter.activePlayerName || "Active player",
    });
  }
  if (!focusQueue.length) {
    focusQueue.push({
      kind: "table",
      priority: CAMERA_FOCUS_PRIORITIES.tableDefault,
      targetId: perspective.localPlayerId || "local-player",
      label: "Battlefield",
    });
  }
  focusQueue.sort((left, right) => right.priority - left.priority);
  return {
    version: BATTLEFIELD_CAMERA_VERSION,
    mode: opponentCarousel.followActivePlayer?.enabled ? "follow-active-player" : "manual-focus",
    activeFocus: focusQueue[0],
    focusQueue,
    deterministicPriority: true,
    transitionPolicy: "intelligent-subtle-motion",
    cinematicReady: true,
    movement: {
      deterministic: true,
      maxDurationMs: 620,
      easing: "boardstate-cinematic",
      reducedMotionFallback: "instant-focus-and-highlight",
      nonEssentialMotionCanDisable: true,
    },
    preservesSynchronization: true,
    hiddenInformationPolicy: "public-projection-only",
    reducedMotionSafe: true,
  };
}

export function createBattlefieldMotionModel({
  session = {},
  perspective = {},
  localBoard = {},
  opponentBoard = {},
  commandCenter = {},
  selectedCard = {},
  camera = {},
  intelligence = {},
  gameplayFlow = {},
  preferences = {},
} = {}) {
  const motionPreferences = resolveMotionPreferences(preferences);
  const cameraPlan = createCameraTransitionPlan({
    camera,
    commandCenter,
    intelligence,
    session,
    intensity: motionPreferences.intensity,
  });
  const cardEvents = createCardMotionEvents({
    session,
    commandCenter,
    selectedCard,
    localBoard,
    opponentBoard,
  });
  const hudMotion = createHudMotionPlan({
    commandCenter,
    intelligence,
    gameplayFlow,
    cardEvents,
    intensity: motionPreferences.intensity,
  });
  return {
    version: BATTLEFIELD_MOTION_VERSION,
    policy: "animation-as-communication",
    intensity: motionPreferences.intensity,
    durationScale: motionPreferences.durationScale,
    reducedMotionHonored: true,
    essentialInformationPreservedWhenReduced: true,
    tokens: createMotionTokens(motionPreferences.durationScale),
    cameraPlan,
    cardEvents,
    hudMotion,
    visualFeedback: createVisualFeedbackPlan(commandCenter, selectedCard, gameplayFlow),
    performance: {
      transformAndOpacityOnly: true,
      avoidsLayoutThrash: true,
      avoidsPersistentParticleSystems: true,
      nonEssentialAmbientDisabled: motionPreferences.intensity !== "full",
      safeForLongCommanderGames: true,
    },
    integration: {
      consumesRulesEngineStateOnly: true,
      mutatesGameState: false,
      savePersistence: "excluded-transient-presentation",
      synchronizationAuthority: "none",
    },
  };
}

export function resolveMotionPreferences(preferences = {}) {
  const requested = String(preferences.animationLevel || preferences.motionLevel || preferences.motionIntensity || "").toLowerCase();
  const disabled =
    preferences.disableAnimations ||
    preferences.disableMotion ||
    preferences.noMotion ||
    requested === "off" ||
    requested === "none";
  const reduced =
    preferences.reducedMotion ||
    preferences.reduceMotion ||
    preferences.motionReduced ||
    preferences.performanceMode === "battery" ||
    requested === "reduced";
  const minimal =
    preferences.disableNonEssentialAnimations ||
    preferences.minimalMotion ||
    requested === "minimal";
  const intensity = disabled ? "none" : minimal ? "minimal" : reduced ? "reduced" : "full";
  const durationScale = intensity === "none" ? 0 : intensity === "minimal" ? 0.22 : intensity === "reduced" ? 0.45 : 1;
  return {
    intensity,
    durationScale,
    ambientEnabled: intensity === "full",
    nonEssentialEnabled: intensity === "full",
  };
}

function createMotionTokens(durationScale = 1) {
  const scaled = (ms) => Math.round(ms * Number(durationScale || 0));
  return {
    easing: {
      standard: "cubic-bezier(0.2, 0.78, 0.18, 1)",
      emphasis: "cubic-bezier(0.16, 1, 0.3, 1)",
      settle: "cubic-bezier(0.22, 0.72, 0.24, 1)",
    },
    durations: {
      micro: scaled(120),
      quick: scaled(180),
      standard: scaled(260),
      emphasis: scaled(420),
      cinematic: scaled(620),
    },
  };
}

export function createCameraTransitionPlan({
  camera = {},
  commandCenter = {},
  intelligence = {},
  session = {},
  intensity = "full",
} = {}) {
  const focus = camera.activeFocus || { kind: "table", priority: CAMERA_FOCUS_PRIORITIES.tableDefault, targetId: "table", label: "Battlefield" };
  const stackCount = (commandCenter.stackObjects || session.stack || []).length;
  const triggerCount = (commandCenter.triggerQueue || session.triggerQueue || []).filter((entry) => !["resolved", "skipped", "ignored"].includes(entry.status)).length;
  const noMotion = intensity === "none";
  const transitionByFocus = {
    "selected-permanent": "focus-lift",
    "stack-object": stackCount > 1 ? "stack-rise" : "stack-focus",
    "priority-decision": "priority-pulse",
    combat: "combat-focus",
    "commander-status": "commander-spotlight",
    "major-battlefield-change": intelligence?.conditions?.highTokenCount ? "token-field-settle" : "battlefield-settle",
    "active-player": "active-player-drift",
    table: "table-breathe",
  };
  return {
    focusKind: focus.kind || "table",
    targetId: focus.targetId || "table",
    label: focus.label || "Battlefield",
    reason: focus.kind || "table",
    transition: noMotion ? "instant-focus" : transitionByFocus[focus.kind] || "subtle-focus",
    durationMs: noMotion ? 0 : focus.kind === "commander-status" ? 620 : focus.kind === "selected-permanent" ? 420 : 260,
    priority: Number(focus.priority || 0),
    stackCount,
    triggerCount,
    deterministic: Boolean(camera.deterministicPriority !== false),
    neverJarring: true,
    reducedMotionFallback: "instant-focus-and-highlight",
  };
}

export function createCardMotionEvents({
  session = {},
  commandCenter = {},
  selectedCard = {},
  localBoard = {},
  opponentBoard = {},
} = {}) {
  const events = [];
  const stackObjects = commandCenter.stackObjects || session.stack || [];
  const triggers = commandCenter.triggerQueue || session.triggerQueue || [];
  const pendingChoices = commandCenter.pendingChoices || session.pendingEffects || [];
  if (selectedCard.mode === "selected-card" && selectedCard.card?.id) {
    events.push({
      kind: selectedCard.card.isCommander ? "commander-entering" : "focus",
      eventKey: `selected:${selectedCard.card.id}`,
      targetId: selectedCard.card.id,
      importance: selectedCard.card.isCommander ? "Critical" : "Normal",
      essential: true,
    });
  }
  stackObjects.slice(0, 12).forEach((entry, index) => {
    events.push({
      kind: index === 0 ? "stack-resolve" : "stack-grow",
      eventKey: `stack:${entry.id || entry.stackObjectId || index}`,
      targetId: entry.id || entry.stackObjectId || "",
      importance: index === 0 ? "Major" : "Normal",
      essential: true,
    });
  });
  const activeTriggers = triggers.filter((entry) => !["resolved", "skipped", "ignored"].includes(entry.status));
  if (activeTriggers.length) {
    events.push({
      kind: "trigger-chain",
      eventKey: `triggers:${activeTriggers.length}`,
      targetId: activeTriggers[0]?.id || "",
      count: activeTriggers.length,
      importance: activeTriggers.length >= 5 ? "Major" : "Normal",
      essential: true,
    });
  }
  if (pendingChoices.length) {
    events.push({
      kind: "priority-change",
      eventKey: `choice:${pendingChoices[0]?.id || pendingChoices.length}`,
      targetId: pendingChoices[0]?.id || "",
      count: pendingChoices.length,
      importance: "Major",
      essential: true,
    });
  }
  const boards = [localBoard, opponentBoard];
  boards.forEach((board) => {
    (board.lanes || []).forEach((lane) => {
      if (lane.key === "tokens" && lane.tokenStacks?.length) {
        events.push({
          kind: lane.tokenIntelligence?.mode === "standard" ? "token-group" : "token-expand",
          eventKey: `tokens:${board.playerId || board.role}:${lane.tokenIntelligence?.totalTokenCount || lane.count || 0}`,
          targetId: board.playerId || board.role || "",
          count: lane.tokenIntelligence?.totalTokenCount || lane.count || 0,
          importance: Number(lane.tokenIntelligence?.totalTokenCount || 0) >= 10 ? "Major" : "Normal",
          essential: false,
        });
      }
      if (Number(lane.count || 0) >= 8 && lane.key !== "tokens") {
        events.push({
          kind: "permanent-reorder",
          eventKey: `lane:${board.playerId || board.role}:${lane.key}:${lane.count}`,
          targetId: board.playerId || board.role || "",
          lane: lane.key,
          count: lane.count,
          importance: "Minor",
          essential: false,
        });
      }
    });
  });
  return events.filter((entry) => MOTION_EVENT_KINDS.includes(entry.kind) || entry.kind === "focus");
}

export function createHudMotionPlan({
  commandCenter = {},
  intelligence = {},
  gameplayFlow = {},
  cardEvents = [],
  intensity = "full",
} = {}) {
  const hud = intelligence.contextualHud || {};
  const activeSurfaces = Object.entries(hud)
    .filter(([, state]) => ["expanded", "compact"].includes(state))
    .map(([surface]) => surface);
  return {
    state: activeSurfaces.length ? "contextual-active" : "quiet",
    activeSurfaces,
    selectedCard: gameplayFlow.selected?.active ? "slide-inspect" : "idle",
    stack: hud.stack === "expanded" ? "rise-and-focus" : "collapsed",
    triggers: hud.triggers === "expanded" ? "group-and-pulse" : "collapsed",
    priority: hud.priority === "expanded" ? "decision-pulse" : hud.priority === "compact" ? "compact-glow" : "collapsed",
    notifications: (commandCenter.floatingNotifications || []).length ? "toast-slide" : "hidden",
    motionBudget: intensity === "full" ? "cinematic" : intensity === "none" ? "instant" : "restrained",
    essentialEventCount: cardEvents.filter((entry) => entry.essential).length,
  };
}

function createVisualFeedbackPlan(commandCenter = {}, selectedCard = {}, gameplayFlow = {}) {
  return {
    legalActions: "gold-blue-lift",
    illegalActions: "crimson-static-warning",
    selectedObjects: selectedCard.mode === "selected-card" ? "selected-card-lift-and-ring" : "available-on-selection",
    targets: "valid-invalid-target-rings",
    priority: commandCenter.localCanAct ? "priority-pulse" : "compact-priority-status",
    combat: isCombatRelevant(commandCenter.combat, commandCenter.phaseLabel) ? "attack-block-lane-emphasis" : "quiet",
    commander: gameplayFlow.commander ? "commander-radiance" : "standard",
    protection: "keyword-badge-and-target-warning",
    informationPreserved: true,
  };
}

export function createBattlefieldIntelligenceModel({
  session = {},
  perspective = {},
  localBoard = {},
  opponentBoard = {},
  commandCenter = {},
  opponentCarousel = {},
  density = "balanced",
  viewport = "desktop",
} = {}) {
  const stackActive = Boolean((commandCenter.stackObjects || []).length);
  const triggerActive = Boolean((commandCenter.triggerQueue || []).some((entry) => entry.status === "pending"));
  const priorityActive = Boolean(commandCenter.localCanAct || (commandCenter.pendingChoices || []).length || stackActive);
  const combatActive = isCombatRelevant(commandCenter.combat, commandCenter.phaseLabel);
  const selectionActive = commandCenter.selectedCard?.mode === "selected-card";
  const totalPermanents = Number(localBoard.totalPermanentCount || 0) + Number(opponentBoard.totalPermanentCount || 0);
  const tokenCount = Number(localBoard.tokenCount || 0) + Number(opponentBoard.tokenCount || 0);
  const highTokenCount = tokenCount >= 10;
  const crowdedBoard = totalPermanents >= 24 || density === "compressed" || density === "dense";
  return {
    version: BATTLEFIELD_INTELLIGENCE_VERSION,
    conditions: {
      stackActive,
      triggerActive,
      priorityActive,
      combatActive,
      selectionActive,
      highTokenCount,
      crowdedBoard,
      opponentCount: opponentCarousel.totalOpponents || 0,
      playerCount: perspective.playerCount || opponentCarousel.totalPlayerCount || 1,
      viewport,
    },
    contextualHud: {
      stack: stackActive || priorityActive ? "expanded" : "collapsed",
      triggers: triggerActive ? "expanded" : "collapsed",
      priority: commandCenter.localCanAct ? "expanded" : priorityActive ? "compact" : "collapsed",
      combatControls: combatActive ? "expanded" : "hidden",
      selectionTools: selectionActive ? "expanded" : "collapsed",
      notices: commandCenter.floatingNotifications?.length ? "compact" : "hidden",
    },
    layout: {
      density,
      tokenMode: highTokenCount ? "stacked-summary" : "standard",
      laneCompression: crowdedBoard ? "adaptive-compressed" : "readable",
      preserveRelativePositioning: true,
      renderedOpponentBattlefields: opponentCarousel.renderedOpponentBattlefields || 0,
    },
    focusPriorities: CAMERA_FOCUS_PRIORITIES,
    performance: {
      avoidsRenderingAllOpponents: true,
      totalOpponentBoards: opponentCarousel.totalOpponents || 0,
      renderedOpponentBoards: opponentCarousel.renderedOpponentBattlefields || 0,
      wholeStateCloneRequiredForLookup: false,
    },
  };
}

export function createGameplayFlowModel({
  session = {},
  perspective = {},
  localBoard = {},
  opponentBoard = {},
  commandCenter = {},
  selectedCard = {},
} = {}) {
  const selected = createPermanentInteractionModel(selectedCard.card, session, {
    localBoard,
    opponentBoard,
    perspective,
  });
  const triggerGroups = createTriggerWorkflowGroups(commandCenter.triggerQueue || session.triggerQueue || []);
  const priority = createPriorityFlowModel(commandCenter, perspective);
  const workflow = createActiveWorkflowModel(session, commandCenter, perspective);
  const search = createSearchWorkflowModel(session);
  return {
    version: GAMEPLAY_FLOW_VERSION,
    mode: "contextual-commander-gameplay",
    selected,
    triggerGroups,
    priority,
    workflow,
    search,
    commander: selected.commander,
    informationHierarchy: Object.freeze([
      "battlefield",
      "selected-card",
      "stack",
      "triggers",
      "priority",
      "game-information",
      "utilities",
    ]),
    interruptionPolicy: {
      confirmations: "ambiguity-or-destructive-only",
      hiddenWhenIrrelevant: true,
      battlefieldRemainsVisible: true,
    },
    accessibility: {
      touchTargetMinimumPx: 44,
      keyboardActionsExposed: true,
      screenReaderSummary: buildGameplayFlowSummary({ selected, triggerGroups, priority, workflow }),
    },
  };
}

export function createPermanentInteractionModel(permanent = null, session = {}, options = {}) {
  if (!permanent?.id) {
    return {
      active: false,
      title: "No selection",
      typeLine: "",
      zone: "",
      publicOnly: true,
      actions: [],
      primaryActions: [],
      utilityActions: [],
      dangerActions: [],
      statusChips: [],
      commander: null,
    };
  }
  const localPlayerId = options.perspective?.localPlayerId || "local-player";
  const localBoardId = options.localBoard?.playerId || localPlayerId;
  const controller = permanent.controller || permanent.controllerPlayerId || localBoardId;
  const owner = permanent.owner || permanent.ownerPlayerId || controller;
  const isLocal =
    ["player", "local-player", localPlayerId, localBoardId].includes(controller) ||
    !controller ||
    (controller === owner && owner === localBoardId);
  const lane = getPermanentLaneKey(permanent);
  const statusChips = [
    lane === "commanders" || permanent.isCommander ? "Commander" : "",
    permanent.tapped ? "Tapped" : "Ready",
    permanent.attacking ? "Attacking" : "",
    permanent.blocking ? "Blocking" : "",
    permanent.summoningSick ? "Summoning sickness" : "",
    permanent.powerToughness ? permanent.powerToughness : "",
    ...(permanent.countersSummary || []).slice(0, 3).map((entry) => `${entry.counterType} ${entry.value}`),
  ].filter(Boolean);
  const actions = [];
  actions.push({
    id: "inspect",
    label: "Inspect",
    kind: "utility",
    priority: 96,
    data: { openToolPanel: "inspect" },
  });
  if (!isLocal) {
    return finalizeInteractionModel(permanent, {
      lane,
      isLocal,
      controller,
      owner,
      publicOnly: true,
      statusChips,
      actions,
      commander: createSelectedCommanderWorkflow(permanent, session, { isLocal: false }),
    });
  }
  if (permanent.isLand || lane === "lands") {
    actions.push({
      id: permanent.tapped ? "untap" : "tap-for-mana",
      label: permanent.tapped ? "Untap" : "Tap for mana",
      kind: "primary",
      priority: 98,
      data: { tap: permanent.id },
    });
    actions.push({
      id: "add-matching-land",
      label: "+1 copy",
      kind: "utility",
      priority: 62,
      data: { addLandCopy: permanent.id },
    });
  }
  if (permanent.isCreature || lane === "creatures" || lane === "commanders") {
    const phaseLabel = String(PHASES[session.phaseIndex] || "").toLowerCase();
    const canAttackNow = phaseLabel.includes("combat") && !permanent.tapped;
    actions.push({
      id: "declare-attacker",
      label: "Attack",
      kind: "primary",
      priority: 90,
      data: { declareAttackers: true },
      disabled: !canAttackNow,
      reason: permanent.tapped ? "Tapped creatures cannot attack." : phaseLabel.includes("combat") ? "" : "Attack during combat.",
    });
    actions.push({
      id: permanent.tapped ? "untap" : "tap",
      label: permanent.tapped ? "Untap" : "Tap",
      kind: "primary",
      priority: 86,
      data: { tap: permanent.id },
    });
    actions.push({
      id: "plus-one-counter",
      label: "+1/+1",
      kind: "primary",
      priority: 76,
      data: { selectedMenuCounter: "+1/+1" },
    });
  }
  if (!(permanent.isLand || lane === "lands")) {
    actions.push({
      id: "manual-trigger",
      label: "Trigger",
      kind: "utility",
      priority: 70,
      data: { manualTriggerPermanent: permanent.id },
    });
    actions.push({
      id: "charge-counter",
      label: "Counter",
      kind: "utility",
      priority: 58,
      data: { selectedMenuCounter: "Charge" },
    });
  }
  if (permanent.isPlaneswalker || lane === "planeswalkers") {
    actions.push(
      {
        id: "loyalty-down",
        label: "Loyalty -1",
        kind: "utility",
        priority: 56,
        data: { loyaltyAdjust: permanent.id, delta: -1 },
      },
      {
        id: "loyalty-up",
        label: "Loyalty +1",
        kind: "utility",
        priority: 55,
        data: { loyaltyAdjust: permanent.id, delta: 1 },
      }
    );
  }
  if (permanent.supportsStation) {
    actions.push({
      id: "station",
      label: "Station",
      kind: "utility",
      priority: 54,
      data: { permanentMechanic: "station", permanentId: permanent.id },
    });
  }
  if (permanent.isMount || /\bSaddle\b/i.test(permanent.oracleText || "")) {
    actions.push({
      id: "saddle",
      label: "Saddle",
      kind: "utility",
      priority: 53,
      data: { permanentMechanic: "saddle", permanentId: permanent.id },
    });
  }
  if (permanent.isVehicle || /\bCrew\b/i.test(permanent.oracleText || "")) {
    actions.push({
      id: "crew",
      label: "Crew",
      kind: "utility",
      priority: 52,
      data: { permanentMechanic: "crew", permanentId: permanent.id },
    });
  }
  if (permanent.supportsMaxSpeed) {
    actions.push({
      id: "max-speed",
      label: "Max Speed +1",
      kind: "utility",
      priority: 51,
      data: { permanentMechanic: "max-speed", permanentId: permanent.id },
    });
  }
  const commander = createSelectedCommanderWorkflow(permanent, session, { isLocal });
  if (commander) {
    actions.push({
      id: "commander-tools",
      label: "Commander",
      kind: "primary",
      priority: 95,
      data: { openToolPanel: "commander" },
    });
    actions.push({
      id: "commander-damage",
      label: "Damage",
      kind: "utility",
      priority: 66,
      data: { openCommanderQuick: true },
    });
    if (commander.castAvailable) {
      actions.push({
        id: "cast-commander",
        label: "Cast",
        kind: "primary",
        priority: 92,
        data: { castCommander: true },
      });
    }
  }
  if (!(permanent.isLand || lane === "lands")) {
    actions.push(
      {
        id: "sacrifice",
        label: "Sacrifice",
        kind: "danger",
        priority: 28,
        data: { selectedAction: "sacrifice" },
      },
      {
        id: "exile",
        label: "Exile",
        kind: "danger",
        priority: 24,
        data: { selectedAction: "exile" },
      },
      {
        id: "destroy",
        label: "Destroy",
        kind: "danger",
        priority: 22,
        danger: true,
        data: { selectedAction: "destroy" },
      }
    );
  }
  actions.push({
    id: "history",
    label: "History",
    kind: "utility",
    priority: 44,
    data: { openUtility: "history" },
  });
  actions.push({
    id: "clear",
    label: "Close",
    kind: "utility",
    priority: 4,
    data: { selectedAction: "clear" },
  });
  return finalizeInteractionModel(permanent, {
    lane,
    isLocal,
    controller,
    owner,
    publicOnly: false,
    statusChips,
    actions,
    commander,
  });
}

export function createTriggerWorkflowGroups(triggerQueue = []) {
  const pending = (triggerQueue || []).filter((entry) => !["resolved", "skipped", "ignored"].includes(entry.status));
  const groups = new Map();
  pending.forEach((entry) => {
    const optional = Boolean(entry.optional || entry.may);
    const key = [
      entry.sourceName || entry.sourceId || "Unknown source",
      entry.eventType || entry.triggerType || entry.name || "trigger",
      optional ? "optional" : "required",
    ].join("|");
    const group = groups.get(key) || {
      groupId: `trigger-group:${key}`,
      sourceName: entry.sourceName || entry.sourceId || "Unknown source",
      eventType: entry.eventType || entry.triggerType || entry.name || "trigger",
      optional,
      required: !optional,
      status: entry.status || "pending",
      count: 0,
      triggerIds: [],
      summary: "",
    };
    group.count += 1;
    group.triggerIds.push(entry.id || `${key}:${group.count}`);
    groups.set(key, group);
  });
  return [...groups.values()].map((group) => ({
    ...group,
    summary: `${group.count} ${group.optional ? "optional" : "required"} ${group.eventType} trigger${group.count === 1 ? "" : "s"} from ${group.sourceName}`,
    canResolveAll: group.required || group.count > 1,
  }));
}

export function createPriorityFlowModel(commandCenter = {}, perspective = {}) {
  const stackCount = (commandCenter.stackObjects || []).length;
  const choiceCount = (commandCenter.pendingChoices || []).length;
  const localCanAct = Boolean(commandCenter.localCanAct);
  const hasMeaningfulChoice = localCanAct || stackCount > 0 || choiceCount > 0;
  return {
    state: localCanAct ? "local-action-required" : stackCount ? "stack-window" : choiceCount ? "choice-required" : "quiet",
    shouldInterrupt: localCanAct || choiceCount > 0,
    compactWhenIdle: true,
    holderId: commandCenter.priorityHolderId || perspective.promptOwnership?.priority?.ownerPlayerId || "",
    holderName: commandCenter.priorityHolderName || "",
    activePlayerId: commandCenter.activePlayerId || perspective.promptOwnership?.activePlayerId || "",
    stackCount,
    choiceCount,
    actions: hasMeaningfulChoice
      ? [
          ...(localCanAct ? [
            { id: "pass-priority", label: "Pass", kind: "primary", data: { passPriority: true } },
            { id: "respond-stack", label: "Respond", kind: "primary", data: { respondStack: true } },
          ] : []),
          ...(stackCount ? [{ id: "open-stack", label: "Stack", kind: "utility", data: { openUtility: "stack" } }] : []),
        ]
      : [],
  };
}

export function createSearchWorkflowModel(session = {}) {
  const selectedCount = (session.selectedIds || []).length;
  return {
    mode: "battlefield-overlay",
    preservesBattlefield: true,
    maintainsKeyboardFocus: true,
    selectedCount,
    scopes: Object.freeze([
      "Oracle",
      "Scryfall",
      "Deck",
      "Battlefield",
      "History",
      "Stack",
      "Graveyards",
      "Exile",
      "Libraries",
      "Players",
      "Recent",
      "Favorites",
    ]),
    primaryAction: { id: "open-search", label: "Search", data: { openUtility: "search" } },
  };
}

function finalizeInteractionModel(permanent = {}, model = {}) {
  const actions = (model.actions || [])
    .filter((action) => action?.id && action.label)
    .sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0));
  return {
    active: true,
    permanentId: permanent.id,
    title: permanent.name || "Selected permanent",
    typeLine: permanent.typeLine || "",
    lane: model.lane || getPermanentLaneKey(permanent),
    isLocal: Boolean(model.isLocal),
    publicOnly: Boolean(model.publicOnly),
    controller: model.controller || permanent.controller || "",
    owner: model.owner || permanent.owner || "",
    statusChips: model.statusChips || [],
    commander: model.commander || null,
    actions,
    primaryActions: actions.filter((action) => action.kind === "primary").slice(0, 5),
    utilityActions: actions.filter((action) => action.kind === "utility").slice(0, 6),
    dangerActions: actions.filter((action) => action.kind === "danger").slice(0, 4),
  };
}

function createSelectedCommanderWorkflow(permanent = {}, session = {}, options = {}) {
  const isCommander = Boolean(permanent.isCommander || permanent.commanderId || permanent.metadata?.commanderId || getPermanentLaneKey(permanent) === "commanders");
  if (!isCommander) {
    return null;
  }
  const runtimeCommander = session.commander || {};
  const sameRuntimeCommander =
    runtimeCommander.name &&
    (runtimeCommander.cardId === permanent.id || runtimeCommander.name === permanent.name || permanent.commanderId === runtimeCommander.cardId);
  const zone = permanent.zone || (sameRuntimeCommander ? runtimeCommander.zone : "") || "battlefield";
  const tax = Number(permanent.commanderTax ?? permanent.metadata?.commanderTax ?? (sameRuntimeCommander ? runtimeCommander.commanderTax : 0) ?? 0);
  const castCount = Number(permanent.castCount ?? permanent.metadata?.castCount ?? (sameRuntimeCommander ? runtimeCommander.castCount : 0) ?? 0);
  return {
    commanderId: permanent.commanderId || permanent.metadata?.commanderId || runtimeCommander.cardId || permanent.id,
    name: permanent.name || runtimeCommander.name || "Commander",
    zone,
    tax,
    castCount,
    castAvailable: Boolean(options.isLocal && sameRuntimeCommander && ["command", "command-zone", "none"].includes(String(zone || "").toLowerCase())),
    damageByOpponent: clonePlain(permanent.damageByOpponent || runtimeCommander.damageByOpponent || {}),
    tags: [
      permanent.isPartner || /\bpartner\b/i.test(permanent.oracleText || "") ? "Partner" : "",
      /\bchoose a background\b/i.test(permanent.oracleText || "") ? "Background" : "",
      /\bdoctor's companion\b/i.test(permanent.oracleText || "") ? "Doctor" : "",
      permanent.isCompanion || /\bcompanion\b/i.test(permanent.oracleText || "") ? "Companion" : "",
    ].filter(Boolean),
  };
}

function createActiveWorkflowModel(session = {}, commandCenter = {}, perspective = {}) {
  const activeEffects = (session.pendingEffects || commandCenter.pendingChoices || [])
    .filter((entry) => !["resolved", "skipped", "ignored"].includes(entry.status));
  if (!activeEffects.length) {
    return {
      active: false,
      stepLabel: "",
      reason: "",
      nextActionLabel: "",
      actions: [],
    };
  }
  const current = activeEffects[0] || {};
  const source = current.sourceName || current.sourceId || current.stackObjectId || "Pending effect";
  const choiceKind = current.effect?.choiceKind || current.choiceKind || current.kind || "choice";
  return {
    active: true,
    stepLabel: `Choice 1 of ${activeEffects.length}`,
    reason: current.reason || `${source} needs ${choiceKind}.`,
    source,
    choiceKind,
    ownerPlayerId: current.playerId || current.ownerPlayerId || perspective.localPlayerId || "",
    nextActionLabel: "Open choice",
    actions: [
      { id: "open-manual-choice", label: "Open choice", kind: "primary", data: { openUtility: "triggers" } },
      { id: "inspect-stack", label: "Inspect stack", kind: "utility", data: { openUtility: "stack" } },
    ],
  };
}

function buildGameplayFlowSummary({ selected, triggerGroups, priority, workflow } = {}) {
  const pieces = [];
  if (selected?.active) pieces.push(`Selected ${selected.title}`);
  if (priority?.shouldInterrupt) pieces.push(priority.state);
  if (triggerGroups?.length) pieces.push(`${triggerGroups.length} trigger group${triggerGroups.length === 1 ? "" : "s"}`);
  if (workflow?.active) pieces.push(workflow.stepLabel);
  return pieces.join(". ") || "Battlefield ready";
}

export function createSelectedCardDetails(session = {}, options = {}) {
  const selectedIds = options.selectedIds instanceof Set ? options.selectedIds : new Set(session.selectedIds || []);
  const allPermanents = [
    ...(session.battlefield?.player || []),
    ...(session.battlefield?.opponent || []),
    ...(options.localBoard?.allPermanents || []),
    ...(options.opponentBoard?.allPermanents || []),
  ];
  const selectedPermanent = allPermanents.find((permanent) => selectedIds.has(permanent.id));
  if (selectedPermanent) {
    const localIds = new Set((options.localBoard?.allPermanents || session.battlefield?.player || []).map((permanent) => permanent.id));
    const opponentIds = new Set((options.opponentBoard?.allPermanents || session.battlefield?.opponent || []).map((permanent) => permanent.id));
    const presentation = createPermanentPresentation(selectedPermanent, { selected: true });
    const publicOnly = opponentIds.has(presentation.id) || (!localIds.has(presentation.id) && presentation.controller === "opponent");
    return {
      mode: "selected-card",
      card: presentation,
      title: presentation.name || "Selected Permanent",
      oracleText: presentation.oracleText || presentation.rulesText || "No Oracle text available.",
      currentCharacteristics: presentation.currentCharacteristics,
      counters: presentation.countersSummary,
      continuousEffects: clonePlain(presentation.continuousEffects || presentation.temporaryModifiers || []),
      equipment: clonePlain(presentation.relationshipsSummary.equipment || []),
      auras: clonePlain(presentation.relationshipsSummary.auras || []),
      attachments: clonePlain(presentation.relationshipsSummary.attachments || []),
      owner: presentation.relationshipsSummary.owner,
      controller: presentation.relationshipsSummary.controller,
      powerToughness: presentation.powerToughness,
      statuses: presentation.statusLabels,
      publicOnly: Boolean(publicOnly),
    };
  }
  const stackTop = (session.stack || [])[0] || (options.stackContext?.objects || [])[0] || null;
  if (stackTop) {
    const card = stackTop.card || stackTop;
    return {
      mode: "stack-top",
      card: clonePlain(card),
      title: stackTop.name || card.name || "Top of Stack",
      oracleText: card.oracleText || card.rulesText || stackTop.summary || "Stack object is waiting for resolution.",
      currentCharacteristics: {
        name: stackTop.name || card.name || "Stack Object",
        typeLine: stackTop.typeLine || card.typeLine || stackTop.objectType || "spell or ability",
        manaCost: card.manaCost || "",
        keywords: card.keywords || [],
      },
      counters: [],
      continuousEffects: [],
      equipment: [],
      auras: [],
      attachments: [],
      owner: card.owner || stackTop.owner || "unknown",
      controller: stackTop.controller || stackTop.controllerPlayerId || "unknown",
      powerToughness: "",
      statuses: ["On Stack"],
      publicOnly: true,
    };
  }
  return {
    mode: "empty",
    card: null,
    title: "Select a card",
    oracleText: "Choose a permanent or stack object to inspect Oracle text, counters, effects, owner, controller, and current status without leaving the battlefield.",
    currentCharacteristics: {},
    counters: [],
    continuousEffects: [],
    equipment: [],
    auras: [],
    attachments: [],
    owner: "",
    controller: "",
    powerToughness: "",
    statuses: [],
    publicOnly: true,
  };
}

export function getPermanentLaneKey(permanent = {}) {
  const typeLine = String(permanent.typeLine || permanent.baseCharacteristics?.typeLine || "").toLowerCase();
  if (permanent.isCommander || permanent.commanderId || permanent.metadata?.commanderId) return "commanders";
  if (permanent.isToken || permanent.tokenStack?.token) return "tokens";
  if (permanent.isLand || /\bland\b/.test(typeLine)) return "lands";
  if (permanent.isCreature || /\bcreature\b/.test(typeLine)) return "creatures";
  if (permanent.isArtifact || /\bartifact\b/.test(typeLine)) return "artifacts";
  if (permanent.isEnchantment || /\benchantment\b/.test(typeLine)) return "enchantments";
  if (permanent.isPlaneswalker || /\bplaneswalker\b/.test(typeLine)) return "planeswalkers";
  if (/\bbattle\b/.test(typeLine)) return "battles";
  return "other";
}

function createBattlefieldRegion(board = {}, role, options = {}) {
  const allPermanents = clonePlain(board.permanents || []);
  const lanes = organizePermanentsByLane(allPermanents, { selectedIds: options.selectedIds || [] });
  const totalPermanentCount = lanes.reduce((sum, lane) => sum + lane.count, 0);
  return {
    role,
    playerId: board.playerId || board.id || role,
    displayName: board.name || (role === "local" ? "Your Battlefield" : "Opponent"),
    deckName: board.deckName || "",
    life: Number(board.life ?? (role === "local" ? options.session?.life ?? 40 : 40)),
    poisonCounters: Number(board.poisonCounters || 0),
    commanderDamage: clonePlain(board.commanderDamage || {}),
    interfaceMode: board.interfaceMode || "boardstate-advanced",
    connectionStatus: board.connectionStatus || (role === "local" ? "local" : "unknown"),
    readonly: Boolean(options.readonly),
    allPermanents,
    lanes,
    laneOrder: PERMANENT_LANE_ORDER,
    totalPermanentCount,
    creatureCount: board.creatureCount ?? lanes.find((lane) => lane.key === "creatures")?.count ?? 0,
    landCount: board.landCount ?? lanes.find((lane) => lane.key === "lands")?.count ?? 0,
    tokenCount: lanes.find((lane) => lane.key === "tokens")?.count ?? 0,
    commanderHud: createCommanderHud(board, options.session, role),
    visibility: {
      hiddenZonesExcluded: role === "opponent",
      publicOnly: Boolean(role === "opponent" || board.publicOnly),
      detailsLimited: Boolean(board.detailsLimited),
    },
  };
}

function createEmptyBattlefieldRegion(role) {
  return {
    role,
    playerId: "",
    displayName: role === "local" ? "Your Battlefield" : "Opponent Battlefield",
    deckName: "",
    life: role === "local" ? 40 : 0,
    poisonCounters: 0,
    commanderDamage: {},
    interfaceMode: "unknown",
    connectionStatus: "unknown",
    readonly: role === "opponent",
    allPermanents: [],
    lanes: organizePermanentsByLane([]),
    laneOrder: PERMANENT_LANE_ORDER,
    totalPermanentCount: 0,
    creatureCount: 0,
    landCount: 0,
    tokenCount: 0,
    commanderHud: [],
    visibility: {
      hiddenZonesExcluded: role === "opponent",
      publicOnly: role === "opponent",
      detailsLimited: true,
    },
  };
}

function createCommanderHud(board = {}, session = {}, role = "local") {
  const commanderPermanents = (board.permanents || []).filter((permanent) => permanent.isCommander || permanent.commanderId || permanent.metadata?.commanderId);
  const runtimeCommander = role === "local" && session.commander?.name
    ? [{
        commanderId: session.commander.cardId || session.commander.name,
        name: session.commander.name,
        zone: session.commander.zone || "command",
        commanderTax: Number(session.commander.commanderTax || 0),
        castCount: Number(session.commander.castCount || 0),
        damageByOpponent: clonePlain(session.commander.damageByOpponent || {}),
        available: session.commander.zone === "command" || session.commander.zone === "none",
      }]
    : [];
  return [
    ...runtimeCommander,
    ...commanderPermanents.map((permanent) => ({
      commanderId: permanent.commanderId || permanent.metadata?.commanderId || permanent.id,
      name: permanent.name || "Commander",
      zone: permanent.zone || "battlefield",
      commanderTax: Number(permanent.commanderTax || permanent.metadata?.commanderTax || 0),
      castCount: Number(permanent.castCount || permanent.metadata?.castCount || 0),
      damageByOpponent: clonePlain(permanent.damageByOpponent || {}),
      available: !permanent.tapped,
    })),
  ];
}

function createCommandCenterModel(session = {}, perspective = {}, selectedCard = {}) {
  const stackObjects = perspective.stackContext?.objects?.length
    ? clonePlain(perspective.stackContext.objects)
    : clonePlain(session.stack || []);
  const triggerQueue = clonePlain(session.triggerQueue || []);
  const pendingChoices = clonePlain(perspective.promptOwnership?.pendingChoices || []);
  const priority = perspective.promptOwnership?.priority || {};
  return {
    turn: Number(session.turn || perspective.publicInformation?.turn || 1),
    phaseIndex: Number(session.phaseIndex ?? perspective.publicInformation?.phaseIndex ?? 0),
    phaseLabel: PHASES[Number(session.phaseIndex ?? perspective.publicInformation?.phaseIndex ?? 0)] || "Beginning",
    activePlayerId: perspective.promptOwnership?.activePlayerId || session.syncedMultiplayer?.currentPlayerId || "local-player",
    activePlayerName: resolveParticipantName(perspective, perspective.promptOwnership?.activePlayerId),
    priorityHolderId: priority.ownerPlayerId || session.priority?.activePlayerId || "local-player",
    priorityHolderName: priority.ownerName || resolveParticipantName(perspective, priority.ownerPlayerId),
    localCanAct: Boolean(priority.localCanAct),
    stackObjects,
    triggerQueue,
    pendingChoices,
    selectedCard,
    combat: clonePlain(session.combat || {}),
    commanderTaxSummary: createCommanderTaxSummary(session, perspective),
    floatingNotifications: [
      ...triggerQueue.filter((entry) => entry.status === "pending").slice(0, 3).map((entry) => ({
        kind: "trigger",
        label: entry.sourceName || entry.name || "Pending trigger",
      })),
      ...pendingChoices.slice(0, 3).map((entry) => ({
        kind: "choice",
        label: entry.reason || "Manual choice required",
      })),
    ],
  };
}

function createGlobalInfoModel(session = {}, perspective = {}) {
  const participants = (perspective.participants || []).map((participant) => ({
    playerId: participant.playerId,
    displayName: participant.displayName || participant.playerId,
    life: Number(participant.life ?? (participant.playerId === perspective.localPlayerId ? session.life ?? 40 : 40)),
    poisonCounters: Number(participant.poisonCounters || 0),
    playerCounters: clonePlain(participant.playerCounters || {}),
    commanderDamage: clonePlain(participant.commanderDamage || {}),
    interfaceMode: participant.interfaceMode || "unknown",
    activeTurn: Boolean(participant.activeTurn),
    priorityStatus: participant.priorityStatus || "waiting",
    connectionStatus: participant.connectionStatus || "unknown",
  }));
  return {
    players: participants,
    turnOrder: clonePlain(session.turnOrder?.playerIds || session.syncedMultiplayer?.turnOrder || participants.map((entry) => entry.playerId)),
    activePlayerId: perspective.promptOwnership?.activePlayerId || session.syncedMultiplayer?.currentPlayerId || "local-player",
    priorityHolderId: perspective.promptOwnership?.priority?.ownerPlayerId || session.priority?.activePlayerId || "local-player",
    tableStatus: {
      monarch: session.playerCounters?.monarch || "",
      initiative: session.playerCounters?.initiative || "",
      cityBlessing: Boolean(session.playerCounters?.cityBlessing),
      playerCount: perspective.playerCount || participants.length || 1,
    },
    hiddenIndicators: clonePlain(perspective.hiddenIndicators || []),
  };
}

function createContextActionModel(session = {}) {
  return LANDSCAPE_CONTEXT_ACTIONS.map((action) => ({
    ...action,
    available: action.status === "available",
    badge:
      action.id === "stack" ? String((session.stack || []).length || "") :
      action.id === "triggers" ? String((session.triggerQueue || []).filter((entry) => entry.status === "pending").length || "") :
      action.id === "question" ? String((session.eventKnowledge?.eventCount || (session.eventKnowledge?.events || []).length || "") || "") :
      "",
  }));
}

function createCommanderTaxSummary(session = {}, perspective = {}) {
  const runtimeCommander = session.commander?.name
    ? [{
        commanderId: session.commander.cardId || session.commander.name,
        name: session.commander.name,
        tax: Number(session.commander.commanderTax || 0),
        castCount: Number(session.commander.castCount || 0),
        zone: session.commander.zone || "none",
      }]
    : [];
  const canonicalSources = Object.values(session.commanderSession?.commanderTaxByCommanderId || {}).map((tax, index) => ({
    commanderId: Object.keys(session.commanderSession?.commanderTaxByCommanderId || {})[index],
    name: Object.keys(session.commanderSession?.commanderTaxByCommanderId || {})[index],
    tax: Number(tax || 0),
    castCount: Number(session.commanderSession?.commanderCastCountByCommanderId?.[Object.keys(session.commanderSession?.commanderTaxByCommanderId || {})[index]] || 0),
    zone: session.commanderSession?.commanderZoneByCommanderId?.[Object.keys(session.commanderSession?.commanderTaxByCommanderId || {})[index]] || "unknown",
  }));
  const boardCommanders = [
    perspective.localBoard,
    perspective.focusedOpponent,
    ...(perspective.opponentBoards || []),
  ].filter(Boolean).flatMap((board) =>
    (board.permanents || []).filter((permanent) => permanent.isCommander).map((permanent) => ({
      commanderId: permanent.id,
      name: permanent.name || "Commander",
      tax: Number(permanent.commanderTax || permanent.metadata?.commanderTax || 0),
      castCount: Number(permanent.castCount || permanent.metadata?.castCount || 0),
      zone: permanent.zone || "battlefield",
    }))
  );
  const byId = new Map();
  [...runtimeCommander, ...canonicalSources, ...boardCommanders].forEach((entry) => {
    if (!entry.commanderId && !entry.name) return;
    byId.set(entry.commanderId || entry.name, entry);
  });
  return [...byId.values()];
}

function collectStatusLabels(permanent = {}) {
  const labels = [];
  if (permanent.tapped) labels.push("Tapped");
  if (permanent.summoningSick) labels.push("Summoning Sickness");
  if (permanent.attacking) labels.push("Attacking");
  if (permanent.blocking) labels.push("Blocking");
  if (permanent.destroyed) labels.push("Destroyed");
  if (permanent.zone === "exile" || permanent.exiled) labels.push("Exiled");
  if (permanent.phased || permanent.phasedOut) labels.push("Phased");
  if (permanent.isCopy) labels.push("Copied");
  if (permanent.transformed || permanent.isTransformed) labels.push("Transformed");
  if (permanent.faceDown || permanent.isFaceDown) labels.push("Face Down");
  if (permanent.mutated || permanent.isMutated) labels.push("Mutated");
  if (permanent.attachedToId || (permanent.attachments || []).length) labels.push(permanent.isEquipment ? "Equipped" : permanent.isAura ? "Enchanted" : "Attached");
  if (permanent.indestructible) labels.push("Indestructible");
  if (permanent.hexproof) labels.push("Hexproof");
  if (permanent.ward || /\bward\b/i.test(permanent.oracleText || "")) labels.push("Ward");
  if (permanent.protection || /\bprotection from\b/i.test(permanent.oracleText || "")) labels.push("Protection");
  const keywordSource = `${(permanent.keywords || []).join(" ")} ${permanent.oracleText || ""}`;
  KEYWORD_STATUS_LABELS.forEach((keyword) => {
    const escaped = keyword.replace(/\s+/g, "\\s+");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(keywordSource) && !labels.includes(keyword)) {
      labels.push(keyword);
    }
  });
  return labels;
}

function getLaneDensity(count = 0) {
  if (count >= 18) return "crowded";
  if (count >= 10) return "dense";
  if (count >= 5) return "medium";
  return "open";
}

function getLaneLayoutMode(count = 0, lane = "") {
  if (lane === "commanders") return "spotlight";
  if (lane === "tokens" && count >= 10) return "stacked-summary";
  if (count >= 18) return "compressed-flow";
  if (count >= 10) return "adaptive-flow";
  return "readable-row";
}

function resolveBattlefieldDensity({ localPermanentCount, opponentPermanentCount, tokenCount, playerCount = 1, viewport }) {
  const largestBoard = Math.max(localPermanentCount, opponentPermanentCount);
  if (viewport === "phone-landscape" || largestBoard >= 32 || tokenCount >= 18 || playerCount >= 8) return "compressed";
  if (largestBoard >= 18 || tokenCount >= 10 || playerCount >= 5) return "dense";
  if (viewport === "desktop" || viewport === "tablet-landscape") return "spacious";
  return "balanced";
}

function isCombatRelevant(combat = {}, phaseLabel = "") {
  const phase = String(phaseLabel || "").toLowerCase();
  return Boolean(
    phase.includes("combat") ||
      combat.step ||
      combat.damagePreview ||
      (combat.attackerIds || []).length ||
      Object.keys(combat.blockersByAttacker || {}).length
  );
}

function getBoardId(board = {}) {
  return board.id || board.playerId || board.participantId || "";
}

function resolveViewport(value = "") {
  const normalized = String(value || "").toLowerCase();
  if (["desktop", "tablet-landscape", "phone-landscape", "foldable-landscape", "portrait-support"].includes(normalized)) {
    return normalized;
  }
  if (normalized.includes("phone")) return "phone-landscape";
  if (normalized.includes("portrait")) return "portrait-support";
  return "desktop";
}

function resolveParticipantName(perspective = {}, playerId = "") {
  const participant = (perspective.participants || []).find((entry) => entry.playerId === playerId);
  return participant?.displayName || playerId || "Player";
}
