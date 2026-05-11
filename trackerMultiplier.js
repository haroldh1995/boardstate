export const TRACKER_MIN_VALUE = -9999;
export const TRACKER_MAX_VALUE = 9999;

export function clampTrackerValue(value, min = TRACKER_MIN_VALUE, max = TRACKER_MAX_VALUE) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

export function getTrackerMultiplier(state) {
  return Math.max(1, Math.min(10, Number(state?.trackerMultiplier || 1)));
}

export function setTrackerMultiplier(state, value) {
  state.trackerMultiplier = Math.max(1, Math.min(10, Number(value) || 1));
  return state;
}

export function applyTrackerDelta(currentValue, direction, multiplier, options = {}) {
  const min = options.min ?? TRACKER_MIN_VALUE;
  const max = options.max ?? TRACKER_MAX_VALUE;
  const safeMultiplier = Math.max(1, Math.min(10, Number(multiplier) || 1));
  return clampTrackerValue(Number(currentValue || 0) + direction * safeMultiplier, min, max);
}
