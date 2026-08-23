import { PHASES } from "../state/schema.js";

export const LAND_PLAY_SYSTEM_VERSION = "boardstate-land-play-system-13.3.0";

export function createLandPlayState(input = {}) {
  return {
    version: LAND_PLAY_SYSTEM_VERSION,
    turn: Math.max(1, Number(input.turn) || 1),
    playsByController: normalizeCountRecord(input.playsByController),
    allowanceOverrides: normalizeCountRecord(input.allowanceOverrides),
    lastPlayEventId: String(input.lastPlayEventId || ""),
    lastPlayedCardId: String(input.lastPlayedCardId || ""),
  };
}

export function resolveLandPlayPolicy(session = {}, settings = {}) {
  const mode = String(session.gameTracking?.mode || "training-ground").toLowerCase();
  const fullControl = Boolean(
    session.simulation?.enabled ||
    ["simulation-game", "dry-run", "full-control", "digital-game"].includes(mode)
  );
  const strict = Boolean(settings.strictPhaseEnforcement || session.runtime?.strictPhaseEnforcement || fullControl);
  return {
    version: LAND_PLAY_SYSTEM_VERSION,
    mode: fullControl ? "full-control" : "live-tracking",
    fullControl,
    strict,
    physicalTableAuthoritative: !fullControl,
  };
}

export function getLandPlayAllowance(session = {}, controller = "player") {
  const state = createLandPlayState(session.landPlayState || { turn: session.turn });
  const explicit = Number(state.allowanceOverrides[controller]);
  if (Number.isFinite(explicit) && explicit >= 0) {
    return explicit;
  }
  return 1 + countAdditionalLandPermissions(session, controller);
}

export function evaluateLandPlay(session = {}, card = {}, options = {}) {
  const controller = String(options.controller || "player");
  const policy = resolveLandPlayPolicy(session, options.settings || {});
  const isLand = /\bLand\b/i.test(card.typeLine || "") || Boolean(card.isLand);
  const phase = PHASES[Number(session.phaseIndex) || 0] || PHASES[0];
  const legalPhase = /^Main [12]$/.test(phase);
  const stackClear = !(session.stack || []).length;
  const state = createLandPlayState(session.landPlayState || { turn: session.turn });
  const plays = state.turn === Number(session.turn || 1) ? Number(state.playsByController[controller] || 0) : 0;
  const allowance = getLandPlayAllowance(session, controller);
  const withinAllowance = plays < allowance;
  const strictLegal = isLand && legalPhase && stackClear && withinAllowance;
  const allowed = policy.strict ? strictLegal : isLand;
  const reasons = [];
  if (!isLand) reasons.push("selected object is not a land");
  if (!legalPhase) reasons.push(`land plays normally occur during a main phase, not ${phase}`);
  if (!stackClear) reasons.push("the stack must be empty for a normal land play");
  if (!withinAllowance) reasons.push(`land-play allowance ${allowance} is already used`);
  return {
    version: LAND_PLAY_SYSTEM_VERSION,
    allowed,
    strictLegal,
    trackingOnly: !policy.strict,
    policy,
    phase,
    stackClear,
    plays,
    allowance,
    remainingBeforePlay: Math.max(0, allowance - plays),
    reasons,
  };
}

export function recordLandPlay(session = {}, card = {}, options = {}) {
  const controller = String(options.controller || "player");
  const turn = Math.max(1, Number(session.turn) || 1);
  const current = createLandPlayState(session.landPlayState || { turn });
  const state = current.turn === turn
    ? current
    : createLandPlayState({ turn, allowanceOverrides: current.allowanceOverrides });
  return {
    ...session,
    landPlayState: {
      ...state,
      playsByController: {
        ...state.playsByController,
        [controller]: Number(state.playsByController[controller] || 0) + 1,
      },
      lastPlayEventId: String(options.eventId || ""),
      lastPlayedCardId: String(card.cardId || card.id || card.name || ""),
    },
  };
}

export function resetLandPlayStateForTurn(session = {}, turn = session.turn) {
  const current = createLandPlayState(session.landPlayState || {});
  return {
    ...session,
    landPlayState: createLandPlayState({
      turn,
      allowanceOverrides: current.allowanceOverrides,
    }),
  };
}

export function countAdditionalLandPermissions(session = {}, controller = "player") {
  return (session.battlefield?.[controller === "player" ? "player" : "opponent"] || []).reduce((total, permanent) => {
    if (permanent.controller && permanent.controller !== controller) return total;
    const text = String(permanent.oracleText || permanent.rulesText || "");
    const match = text.match(/you may play (?:up to )?(one|two|three|four|five|an?) additional lands?/i);
    if (!match) return total;
    const amount = parseNumberWord(match[1]);
    return total + Math.max(1, amount) * Math.max(1, Number(permanent.quantity) || 1);
  }, 0);
}

function parseNumberWord(value = "") {
  const normalized = String(value || "").toLowerCase();
  return ({ one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5 })[normalized] || Number(normalized) || 1;
}

function normalizeCountRecord(record = {}) {
  return Object.fromEntries(
    Object.entries(record || {}).map(([key, value]) => [String(key), Math.max(0, Number(value) || 0)])
  );
}
