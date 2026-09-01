import { createId } from "../state/ids.js";

export const DUAL_HAND_MODEL_VERSION = "boardstate-dual-hand-dock-1.0.0";

export const HAND_DOCK_SURFACES = Object.freeze({
  commands: "commands",
  playerHand: "player-hand",
});

export const HAND_GESTURE_INTENTS = Object.freeze({
  select: "SELECT_HAND_CARD",
  inspect: "INSPECT_HAND_CARD",
  reorder: "REORDER_HAND_CARD",
  castOrPlay: "CAST_OR_PLAY_HAND_CARD",
  scroll: "SCROLL_HAND_LOCAL",
  toggleSurface: "TOGGLE_HAND_DOCK_SURFACE",
});

export const DEFAULT_PERSISTENT_COMMAND_ORDER = Object.freeze([
  "phase",
  "commander",
  "library",
  "rules",
  "remind",
  "undo",
  "battlefield",
  "history",
  "notes",
  "calculator",
  "dice",
  "coin",
  "settings",
  "tablecraft",
]);

export const HAND_INTERACTION_THRESHOLDS = Object.freeze({
  tapMaxMovementPx: 10,
  holdMs: 420,
  reorderStartPx: 16,
  castDragPx: 46,
  axisDominanceRatio: 1.18,
});

export const HAND_LAYOUT_POLICY = Object.freeze({
  cardAspectRatio: 0.714,
  relaxedExposureRatio: 0.72,
  minimumExposurePx: 28,
  maximumTiltDegrees: 7,
  maximumEdgeDropPx: 12,
  overflowPaddingPx: 18,
});

export function normalizePersistentCommandOrder(
  availableCommandIds = [],
  storedOrder = [],
  legacyFavoriteIds = [],
) {
  const available = uniqueIds(availableCommandIds);
  const availableSet = new Set(available);
  const stored = uniqueIds(storedOrder).filter((id) => availableSet.has(id));
  const ordered = [...stored, ...available.filter((id) => !stored.includes(id))];

  if (stored.length || !legacyFavoriteIds?.length) {
    return ordered;
  }

  // Old pinned cards represented priority. Preserve that useful signal by
  // placing them at the new hand's right/front edge, then discard wheel state.
  const favorites = uniqueIds(legacyFavoriteIds).filter((id) => availableSet.has(id));
  return [...ordered.filter((id) => !favorites.includes(id)), ...favorites];
}

export function orderCommandCards(cards = [], storedOrder = [], legacyFavoriteIds = []) {
  const byId = new Map((cards || []).filter((card) => card?.id).map((card) => [String(card.id), card]));
  const persistent = (cards || []).filter((card) => card?.id && !card.contextual);
  const contextual = (cards || [])
    .filter((card) => card?.id && card.contextual)
    .sort((left, right) => Number(left.priority || 0) - Number(right.priority || 0));
  const persistentOrder = normalizePersistentCommandOrder(
    persistent.map((card) => card.id),
    storedOrder,
    legacyFavoriteIds,
  );
  return {
    persistentOrder,
    cards: [
      ...persistentOrder.map((id) => byId.get(id)).filter(Boolean),
      ...contextual,
    ],
  };
}

export function reorderOrderedIds(ids = [], movedId = "", targetIndex = 0) {
  const order = uniqueIds(ids);
  const id = String(movedId || "");
  if (!id || !order.includes(id)) return order;
  const without = order.filter((entry) => entry !== id);
  const index = clamp(Math.trunc(Number(targetIndex || 0)), 0, without.length);
  without.splice(index, 0, id);
  return without;
}

export function moveOrderedId(ids = [], movedId = "", movement = "right") {
  const order = uniqueIds(ids);
  const current = order.indexOf(String(movedId || ""));
  if (current < 0) return order;
  const target = movement === "left"
    ? current - 1
    : movement === "beginning"
      ? 0
      : movement === "front" || movement === "end"
        ? order.length - 1
        : current + 1;
  return reorderOrderedIds(order, movedId, clamp(target, 0, order.length - 1));
}

export function resolveArenaHandLayout(items = [], options = {}) {
  const cards = (items || []).filter((item) => item?.id);
  const count = cards.length;
  const availableWidth = Math.max(0, Number(options.availableWidth || 0));
  const cardWidth = Math.max(64, Number(options.cardWidth || 116));
  const minimumExposure = Math.max(20, Number(options.minimumExposurePx || HAND_LAYOUT_POLICY.minimumExposurePx));
  const relaxedExposure = cardWidth * HAND_LAYOUT_POLICY.relaxedExposureRatio;
  const fitExposure = count > 1 ? (availableWidth - cardWidth) / (count - 1) : 0;
  const exposure = count <= 1
    ? 0
    : clamp(fitExposure, minimumExposure, relaxedExposure);
  const contentWidth = count ? cardWidth + exposure * (count - 1) : 0;
  const overflow = contentWidth > availableWidth + 0.5;
  const startX = overflow ? HAND_LAYOUT_POLICY.overflowPaddingPx : Math.max(0, (availableWidth - contentWidth) / 2);
  const midpoint = (count - 1) / 2;
  const divisor = Math.max(1, midpoint);
  const activeId = String(options.activeId || "");
  const draggingId = String(options.draggingId || "");

  const entries = cards.map((card, index) => {
    const normalized = (index - midpoint) / divisor;
    const active = card.id === activeId;
    const dragging = card.id === draggingId;
    const temporaryLift = active || dragging;
    return {
      id: String(card.id),
      index,
      xPx: startX + exposure * index,
      exposurePx: exposure,
      angleDegrees: normalized * HAND_LAYOUT_POLICY.maximumTiltDegrees,
      dropPx: Math.abs(normalized) * HAND_LAYOUT_POLICY.maximumEdgeDropPx,
      zIndex: temporaryLift ? 2000 + index : 100 + index,
      scale: temporaryLift ? 1.12 : 1,
      liftPx: dragging ? 40 : active ? 34 : 0,
      active,
      dragging,
      frontmostAtRest: !temporaryLift && index === count - 1,
    };
  });

  return {
    version: DUAL_HAND_MODEL_VERSION,
    mode: "ordered-overlapping-tcg-hand",
    circular: false,
    clones: false,
    count,
    cardWidth,
    exposurePx: exposure,
    contentWidth,
    availableWidth,
    overflow,
    overflowMode: overflow ? "hand-local-horizontal" : "none",
    rightmostFrontmost: true,
    entries,
  };
}

export function validateArenaHandContinuity(layout = {}) {
  const entries = layout.entries || [];
  const issues = [];
  const ids = entries.map((entry) => entry.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) issues.push("duplicate-hand-identity");
  if (layout.circular) issues.push("retired-circular-hand-forbidden");
  if (layout.clones) issues.push("retired-hand-clones-forbidden");
  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1];
    const current = entries[index];
    const gap = Number(current.xPx || 0) - Number(previous.xPx || 0);
    if (!(gap > 0)) issues.push(`non-monotonic-hand-position:${current.id}`);
    if (gap > Math.max(Number(layout.cardWidth || 0), Number(layout.exposurePx || 0) * 1.4)) {
      issues.push(`disconnected-hand-cluster:${current.id}`);
    }
    if (!previous.active && !previous.dragging && !current.active && !current.dragging && current.zIndex <= previous.zIndex) {
      issues.push(`rightward-depth-regression:${current.id}`);
    }
  }
  const resting = entries.filter((entry) => !entry.active && !entry.dragging);
  if (resting.length && resting.at(-1)?.zIndex !== Math.max(...resting.map((entry) => entry.zIndex))) {
    issues.push("rightmost-resting-card-must-be-frontmost");
  }
  return {
    version: DUAL_HAND_MODEL_VERSION,
    valid: issues.length === 0,
    continuous: !issues.some((issue) => issue.startsWith("disconnected-hand-cluster")),
    issues,
  };
}

export function resolveHandGestureIntent(input = {}) {
  const thresholds = { ...HAND_INTERACTION_THRESHOLDS, ...(input.thresholds || {}) };
  const dx = Number(input.dx ?? input.movementX ?? 0);
  const dy = Number(input.dy ?? input.movementY ?? 0);
  const distance = Math.hypot(dx, dy);
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const durationMs = Math.max(0, Number(input.durationMs || 0));
  const playerCard = input.surface === HAND_DOCK_SURFACES.playerHand || input.playerHandCard;

  if (input.toggle) return intent(HAND_GESTURE_INTENTS.toggleSurface, "hand-dock-toggle");
  if (input.scrollWheel || input.handLocalPan) return intent(HAND_GESTURE_INTENTS.scroll, input.owner || "hand-local-scroll");
  if (
    playerCard &&
    dy <= -thresholds.castDragPx &&
    absY >= absX * thresholds.axisDominanceRatio
  ) {
    return intent(HAND_GESTURE_INTENTS.castOrPlay, "player-hand");
  }
  if (absX >= thresholds.reorderStartPx && absX >= absY * thresholds.axisDominanceRatio) {
    return intent(HAND_GESTURE_INTENTS.reorder, playerCard ? "player-hand" : "command-hand");
  }
  if (durationMs >= thresholds.holdMs && distance <= thresholds.tapMaxMovementPx) {
    return intent(HAND_GESTURE_INTENTS.inspect, playerCard ? "player-hand" : "command-hand");
  }
  return intent(HAND_GESTURE_INTENTS.select, playerCard ? "player-hand" : "command-hand");
}

export function createTrackedHandCard(card = {}, options = {}) {
  const id = String(options.id || card.cardInstanceId || card.instanceId || createId("hand-card"));
  const owner = String(options.owner || card.owner || "player");
  return {
    ...card,
    id,
    cardInstanceId: id,
    cardId: String(card.cardId || card.scryfallId || card.printingId || card.name || ""),
    owner,
    controller: String(options.controller || card.controller || owner),
    zone: "hand",
    quantity: 1,
    isToken: false,
    visibility: "owner-only",
    trackedAt: Number(options.trackedAt || Date.now()),
  };
}

export function createPlayerHandPrivacyProjection(session = {}, options = {}) {
  const cards = Array.isArray(session.zones?.hand) ? session.zones.hand : [];
  const authorized = Boolean(options.authorizedOwner || options.localOwner);
  return {
    version: DUAL_HAND_MODEL_VERSION,
    visibility: "private-owner-only",
    count: cards.length,
    cards: authorized ? cards.map((card) => ({ ...card })) : [],
    cardInstanceIds: authorized ? cards.map((card) => card.cardInstanceId || card.id).filter(Boolean) : [],
    identitiesRedacted: !authorized,
    shareable: authorized ? "local-only" : "count-only",
  };
}

export function resolvePlayerHandActions(card = {}, context = {}) {
  if (!card?.id) return [];
  const isLand = Boolean(card.isLand || /\bLand\b/i.test(card.typeLine || ""));
  const actions = ["inspect"];
  if (isLand) {
    if (context.landPlayAllowed !== false) actions.unshift("play-land");
  } else {
    actions.unshift("cast");
  }
  actions.push("discard", "exile", "move-to-library");
  if (context.revealSupported) actions.push("reveal");
  return actions;
}

function intent(value, owner) {
  return {
    version: DUAL_HAND_MODEL_VERSION,
    intent: value,
    owner,
    singleOwner: true,
    transferDuringActiveGesture: false,
    platformNeutral: true,
  };
}

function uniqueIds(values = []) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum));
}
