import { PHASES } from "../state/schema.js";
import { buildAdvancedMultiplayerPerspective } from "../shared-session/perspective.js";
import { clonePlain } from "../shared-contracts/index.js";

export const LANDSCAPE_BATTLEFIELD_VERSION = "boardstate-landscape-battlefield-0.1.0";

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
  { id: "history", label: "History", status: "available", utilityPanel: "history" },
  { id: "display", label: "Display", status: "available", utilityPanel: "display" },
  { id: "settings", label: "Settings", status: "available", opensOptions: true },
  { id: "question", label: "Question", status: "future", reason: "Question System arrives in a later prompt." },
  { id: "remind-me", label: "Remind Me", status: "future", reason: "Remind Me timeline arrives in a later prompt." },
  { id: "replay-ui", label: "Replay UI", status: "future", reason: "Replay data exists; visual replay UI arrives later." },
  { id: "ai-panel", label: "AI Panel", status: "future", reason: "AI battlefield interface arrives in a later prompt." },
]);

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
  const commandCenter = createCommandCenterModel(session, perspective, selectedCard);
  return {
    version: LANDSCAPE_BATTLEFIELD_VERSION,
    orientation: "landscape-first",
    regions: LANDSCAPE_BATTLEFIELD_REGIONS,
    viewport,
    density: resolveBattlefieldDensity({
      localPermanentCount: localBoard.totalPermanentCount,
      opponentPermanentCount: opponentBoard.totalPermanentCount,
      tokenCount: localBoard.tokenCount + opponentBoard.tokenCount,
      viewport,
    }),
    perspective: {
      viewMode: perspective.viewMode || "solo-advanced",
      localPlayerId: perspective.localPlayerId || "local-player",
      focusedOpponentId: opponentBoard.playerId || "",
      playerCount: perspective.playerCount || 1,
      hiddenIndicators: clonePlain(perspective.hiddenIndicators || []),
    },
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

export function createSelectedCardDetails(session = {}, options = {}) {
  const selectedIds = options.selectedIds instanceof Set ? options.selectedIds : new Set(session.selectedIds || []);
  const allPermanents = [
    ...(options.localBoard?.allPermanents || []),
    ...(options.opponentBoard?.allPermanents || []),
    ...(session.battlefield?.player || []),
    ...(session.battlefield?.opponent || []),
  ];
  const selectedPermanent = allPermanents.find((permanent) => selectedIds.has(permanent.id));
  if (selectedPermanent) {
    const presentation = createPermanentPresentation(selectedPermanent, { selected: true });
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
      publicOnly: Boolean(presentation.publicOnly || presentation.controller === "opponent"),
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

function resolveBattlefieldDensity({ localPermanentCount, opponentPermanentCount, tokenCount, viewport }) {
  const largestBoard = Math.max(localPermanentCount, opponentPermanentCount);
  if (viewport === "phone-landscape" || largestBoard >= 32 || tokenCount >= 18) return "compressed";
  if (largestBoard >= 18 || tokenCount >= 10) return "dense";
  if (viewport === "desktop" || viewport === "tablet-landscape") return "spacious";
  return "balanced";
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
