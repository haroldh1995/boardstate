export const COMMAND_DECK_MODEL_VERSION = "boardstate-command-deck-model-0.1.0";

export const COMMAND_DECK_VISIBLE_RADIUS = 3;
export const COMMAND_DECK_SCROLL_PX_PER_CARD = 74;
export const COMMAND_DECK_SLOT_SPACING_PX = 58;
export const COMMAND_DECK_WHEEL_DELTA_PER_CARD = 220;
export const COMMAND_DECK_MAX_FREE_SCROLL_STEPS = 3;
export const COMMAND_DECK_RENDER_RADIUS = COMMAND_DECK_VISIBLE_RADIUS + COMMAND_DECK_MAX_FREE_SCROLL_STEPS;
export const COMMAND_DECK_WHEEL_IDLE_SNAP_MS = 150;

export function clampCommandDeckFreeScrollSteps(steps = 0, maxSteps = COMMAND_DECK_MAX_FREE_SCROLL_STEPS) {
  const value = Number(steps || 0);
  const limit = Math.max(0, Number(maxSteps || COMMAND_DECK_MAX_FREE_SCROLL_STEPS));
  return Math.max(-limit, Math.min(limit, Number.isFinite(value) ? value : 0));
}

export function resolveCommandDeckScrollStepsFromOffsetPx(offsetPx = 0) {
  return clampCommandDeckFreeScrollSteps(Number(offsetPx || 0) / COMMAND_DECK_SCROLL_PX_PER_CARD);
}

export function resolveCommandDeckWheelFreeScrollOffsetPx(delta = 0) {
  const freeScrollSteps = clampCommandDeckFreeScrollSteps(Number(delta || 0) / COMMAND_DECK_WHEEL_DELTA_PER_CARD);
  return -freeScrollSteps * COMMAND_DECK_SCROLL_PX_PER_CARD;
}

export function resolveCommandDeckWheelSnapSteps(delta = 0) {
  return clampCommandDeckFreeScrollSteps(Math.round(Number(delta || 0) / COMMAND_DECK_WHEEL_DELTA_PER_CARD));
}

export function resolveCommandDeckPointerOffsetPx(deltaX = 0) {
  return Math.max(
    -COMMAND_DECK_SCROLL_PX_PER_CARD * COMMAND_DECK_MAX_FREE_SCROLL_STEPS,
    Math.min(COMMAND_DECK_SCROLL_PX_PER_CARD * COMMAND_DECK_MAX_FREE_SCROLL_STEPS, Number(deltaX || 0))
  );
}

export function resolveCommandDeckPointerSnapSteps(offsetPx = 0) {
  return clampCommandDeckFreeScrollSteps(Math.round(-Number(offsetPx || 0) / COMMAND_DECK_SCROLL_PX_PER_CARD));
}

export function resolveCommandDeckCardProjection(slotOffset = 0, priority = 0, isCommittedCenter = false) {
  const offset = Number(slotOffset || 0);
  const distance = Math.abs(offset);
  const priorityProminence = Math.max(0, Math.min(1, Number(priority || 0) / 128));
  const centerProminence = Math.max(0, Math.min(1, 1 - distance / (COMMAND_DECK_VISIBLE_RADIUS + 0.24)));
  const prominence = Math.max(centerProminence, priorityProminence * 0.42, isCommittedCenter && distance < 0.45 ? 1 : 0);
  const fadeStart = COMMAND_DECK_VISIBLE_RADIUS - 0.16;
  const fadeEnd = COMMAND_DECK_VISIBLE_RADIUS + 0.86;
  const visibility = distance <= fadeStart ? 1 : Math.max(0, Math.min(1, 1 - (distance - fadeStart) / (fadeEnd - fadeStart)));
  const scale = 0.9 + prominence * 0.15 + (distance < 0.44 ? 0.025 : 0);
  const rise = Math.max(0, 18 - distance * 4.2) + Math.max(0, Number(priority || 0) - 90) * 0.12 + (distance < 0.44 ? 4 : 0);
  const zIndex = Math.round(1800 - distance * 180 + priorityProminence * 24 + (distance < 0.44 ? 180 : 0));
  return {
    offset,
    xPx: offset * COMMAND_DECK_SLOT_SPACING_PX,
    angle: offset * 5.2,
    rise,
    scale,
    prominence,
    visibility,
    zIndex: Math.max(1, zIndex),
    liftZ: distance < 0.44 ? 36 : Math.round(prominence * 12),
    interactive: visibility > 0.18,
  };
}
