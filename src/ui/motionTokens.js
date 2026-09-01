export const BOARDSTATE_MOTION_LANGUAGE_VERSION = "boardstate-motion-language-0.1.0";

export const MOTION_INTENT = Object.freeze({
  communication: "motion-explains-state",
  responsiveness: "input-acknowledged-immediately",
  physicality: "premium-collectible-weight",
  accessibility: "reduced-motion-preserves-information",
});

export const MOTION_OWNERS = Object.freeze({
  battlefield: "battlefield",
  dualHandDock: "dual-hand-dock",
  cardInspector: "card-inspection",
  notificationSystem: "notification-system",
  modalSystem: "modal-system",
  opponentCarousel: "opponent-carousel",
});

export const MOTION_STATE_CATALOG = Object.freeze({
  card: Object.freeze(["idle", "hovered", "selected", "dragging", "resolving", "disabled", "hidden", "destroyed"]),
  panel: Object.freeze(["closed", "opening", "active", "inactive", "closing"]),
  commandCard: Object.freeze([
    "idle",
    "reordering",
    "inspecting",
    "highlighted",
    "contextual-entry",
    "contextual-exit",
    "selected",
    "waiting",
    "disabled",
    "resolving",
  ]),
});

export const MOTION_DEBUG_FIELDS = Object.freeze([
  "owner",
  "state",
  "token",
  "duration",
  "queue",
  "interrupt",
  "transition",
  "frame",
]);

const BASE_MOTION_TOKENS = Object.freeze({
  durationMs: Object.freeze({
    instant: 0,
    acknowledgement: 70,
    micro: 100,
    quick: 160,
    standard: 220,
    emphasis: 340,
    cinematic: 500,
    resolvingLoop: 900,
    ambient: 7500,
  }),
  delayMs: Object.freeze({
    none: 0,
    commandCardStagger: 24,
    groupedEventStagger: 36,
    secondaryEventDelay: 90,
  }),
  easing: Object.freeze({
    standard: "cubic-bezier(0.2, 0.78, 0.18, 1)",
    emphasis: "cubic-bezier(0.16, 1, 0.3, 1)",
    settle: "cubic-bezier(0.22, 0.72, 0.24, 1)",
    inertia: "cubic-bezier(0.18, 0.84, 0.22, 1)",
    linear: "linear",
  }),
  physics: Object.freeze({
    cardMass: 0.78,
    commandCardMass: 0.68,
    panelMass: 1,
    cameraMass: 1.24,
    friction: 0.82,
    releaseDamping: 0.74,
    maxRotationDegrees: 18,
    hoverLiftPx: 22,
    selectedLiftPx: 18,
    neighborDisplacementRem: 0.75,
  }),
  transform: Object.freeze({
    cardHoverScale: 1.075,
    cardActiveScale: 1.01,
    cardCompactHoverScale: 1.035,
    permanentHoverScale: 1.012,
    disabledScale: 1,
  }),
  opacity: Object.freeze({
    quiet: 0.58,
    supporting: 0.7,
    idle: 0.92,
    active: 1,
    disabled: 0.5,
  }),
});

export function createMotionTokenSet(durationScale = 1) {
  const scale = Number.isFinite(Number(durationScale)) ? Math.max(0, Number(durationScale)) : 1;
  const scaleMs = (ms) => Math.round(Number(ms || 0) * scale);
  return {
    version: BOARDSTATE_MOTION_LANGUAGE_VERSION,
    intent: MOTION_INTENT,
    durations: {
      instant: 0,
      acknowledgement: scaleMs(BASE_MOTION_TOKENS.durationMs.acknowledgement),
      micro: scaleMs(BASE_MOTION_TOKENS.durationMs.micro),
      quick: scaleMs(BASE_MOTION_TOKENS.durationMs.quick),
      standard: scaleMs(BASE_MOTION_TOKENS.durationMs.standard),
      emphasis: scaleMs(BASE_MOTION_TOKENS.durationMs.emphasis),
      cinematic: scaleMs(BASE_MOTION_TOKENS.durationMs.cinematic),
      resolvingLoop: scaleMs(BASE_MOTION_TOKENS.durationMs.resolvingLoop),
      ambient: scale ? BASE_MOTION_TOKENS.durationMs.ambient : 0,
    },
    delays: {
      none: 0,
      commandCardStagger: scaleMs(BASE_MOTION_TOKENS.delayMs.commandCardStagger),
      groupedEventStagger: scaleMs(BASE_MOTION_TOKENS.delayMs.groupedEventStagger),
      secondaryEventDelay: scaleMs(BASE_MOTION_TOKENS.delayMs.secondaryEventDelay),
    },
    easing: BASE_MOTION_TOKENS.easing,
    physics: BASE_MOTION_TOKENS.physics,
    transform: BASE_MOTION_TOKENS.transform,
    opacity: BASE_MOTION_TOKENS.opacity,
  };
}

export function createMotionCssVariables(durationScale = 1) {
  const tokens = createMotionTokenSet(durationScale);
  return {
    "--motion-duration-acknowledgement": `${tokens.durations.acknowledgement}ms`,
    "--motion-duration-micro": `${tokens.durations.micro}ms`,
    "--motion-duration-quick": `${tokens.durations.quick}ms`,
    "--motion-duration-standard": `${tokens.durations.standard}ms`,
    "--motion-duration-emphasis": `${tokens.durations.emphasis}ms`,
    "--motion-duration-cinematic": `${tokens.durations.cinematic}ms`,
    "--motion-duration-resolving-loop": `${tokens.durations.resolvingLoop}ms`,
    "--motion-duration-ambient": `${tokens.durations.ambient}ms`,
    "--motion-delay-command-card-stagger": `${tokens.delays.commandCardStagger}ms`,
    "--motion-ease-standard": tokens.easing.standard,
    "--motion-ease-emphasis": tokens.easing.emphasis,
    "--motion-ease-settle": tokens.easing.settle,
    "--motion-ease-inertia": tokens.easing.inertia,
  };
}

export function createMotionDebugSnapshot({
  owner = MOTION_OWNERS.battlefield,
  state = "idle",
  token = "standard",
  duration = 0,
  queue = "empty",
  interrupt = "none",
  transition = "stable",
  frame = "unmeasured",
} = {}) {
  return {
    version: BOARDSTATE_MOTION_LANGUAGE_VERSION,
    owner,
    state,
    token,
    duration,
    queue,
    interrupt,
    transition,
    frame,
    fields: MOTION_DEBUG_FIELDS,
    productionVisible: false,
  };
}
