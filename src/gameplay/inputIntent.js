export const CANONICAL_INPUT_INTENT_VERSION = "boardstate-input-intent-13.2.6-part4";

export const INPUT_INTENTS = Object.freeze({
  tapSelect: "TAP_SELECT",
  inspect: "INSPECT",
  dragCard: "DRAG_CARD",
  scrollZone: "SCROLL_ZONE",
  rotateCommandHand: "ROTATE_COMMAND_HAND",
  switchOpponent: "SWITCH_OPPONENT",
  target: "TARGET",
  confirm: "CONFIRM",
  cancel: "CANCEL",
  openContextAction: "OPEN_CONTEXT_ACTION",
  panWithinAllowedView: "PAN_WITHIN_ALLOWED_VIEW",
  accessibilityActivate: "ACCESSIBILITY_ACTIVATE",
});

export const INPUT_SURFACES = Object.freeze({
  commandHand: "command-hand",
  overflowingZone: "overflowing-zone",
  opponentBackground: "opponent-background",
  card: "card",
  modal: "modal",
  stack: "stack",
  battlefieldBackground: "battlefield-background",
  tableRadar: "table-radar",
});

export const GESTURE_OWNERS = Object.freeze({
  mandatoryGameplay: "mandatory-gameplay",
  cardDrag: "card-drag",
  targeting: "targeting",
  commandHand: "command-hand",
  zoneScroll: "zone-scroll",
  opponentNavigation: "opponent-navigation",
  cardInspection: "card-inspection",
  background: "background",
});

export const TOUCH_INTENT_THRESHOLDS = Object.freeze({
  accidentalMovementPx: 5,
  tapMaxMovementPx: 10,
  tapMaxDurationMs: 240,
  longPressMs: 420,
  dragStartPx: 14,
  horizontalSwipePx: 42,
  verticalToleranceRatio: 1.2,
  wheelStepPx: 96,
});

export const COMMAND_HAND_FOCUS_CONTRACT = Object.freeze({
  exactFocusCount: 1,
  centerAnchor: "mathematical-command-hand-center",
  focusSource: "nearest-card-center",
  zOrderSource: "canonical-focus-depth-order",
  previewSource: "canonical-focused-command-id",
  activationSource: "canonical-focused-command-id",
  hitTestSource: "visible-depth-order",
});

export function createInputIntentPolicy(options = {}) {
  const deviceClass = resolveDeviceClass(options);
  const touchMultiplier = deviceClass === "phone-landscape" ? 1.08 : deviceClass === "tablet-landscape" ? 1.04 : 1;
  const reducedMotion = Boolean(options.reducedMotion);
  const largeTextScale = Math.max(1, Number(options.textScale || options.largeTextScale || 1));
  return {
    version: CANONICAL_INPUT_INTENT_VERSION,
    deviceClass,
    orientation: "landscape-gameplay",
    ownerPriority: [
      GESTURE_OWNERS.mandatoryGameplay,
      GESTURE_OWNERS.cardDrag,
      GESTURE_OWNERS.targeting,
      GESTURE_OWNERS.commandHand,
      GESTURE_OWNERS.zoneScroll,
      GESTURE_OWNERS.opponentNavigation,
      GESTURE_OWNERS.cardInspection,
      GESTURE_OWNERS.background,
    ],
    thresholds: {
      ...TOUCH_INTENT_THRESHOLDS,
      dragStartPx: Math.round(TOUCH_INTENT_THRESHOLDS.dragStartPx * touchMultiplier),
      horizontalSwipePx: Math.round(TOUCH_INTENT_THRESHOLDS.horizontalSwipePx * touchMultiplier),
      longPressMs: reducedMotion ? 380 : TOUCH_INTENT_THRESHOLDS.longPressMs,
    },
    inputMethods: ["touch", "pointer", "mouse", "trackpad", "keyboard", "screen-reader", "controller-compatible-focus"],
    accessibility: {
      touchTargetMinimumPx: 44,
      largeTextScale,
      reducedMotion,
      hoverRequired: false,
      semanticLabelsRequired: true,
    },
    platformBoundary: {
      semanticIntentsOnly: true,
      dependsOnBrowserGlobals: false,
      cssIsAuthoritativeGameplay: false,
      swiftUiPortable: true,
    },
  };
}

export function resolveInputIntent(input = {}, policy = createInputIntentPolicy()) {
  const thresholds = policy.thresholds || TOUCH_INTENT_THRESHOLDS;
  const surface = input.surface || input.origin || "";
  const movementX = Number(input.movementX ?? input.dx ?? 0);
  const movementY = Number(input.movementY ?? input.dy ?? 0);
  const durationMs = Number(input.durationMs ?? 0);
  const absX = Math.abs(movementX);
  const absY = Math.abs(movementY);
  const horizontalSwipe = absX >= thresholds.horizontalSwipePx && absX >= absY * thresholds.verticalToleranceRatio;
  const dragMovement = Math.hypot(movementX, movementY) >= thresholds.dragStartPx;
  const tapMovement = Math.hypot(movementX, movementY) <= thresholds.tapMaxMovementPx;
  const keyboardKey = String(input.keyboardKey || input.key || "");

  if (input.accessibility || keyboardKey === "Enter" || keyboardKey === " ") {
    return createIntentResult(INPUT_INTENTS.accessibilityActivate, GESTURE_OWNERS.mandatoryGameplay, input);
  }
  if (keyboardKey === "Escape") {
    return createIntentResult(INPUT_INTENTS.cancel, GESTURE_OWNERS.mandatoryGameplay, input);
  }
  if (input.activeMandatoryDecision || surface === INPUT_SURFACES.modal || surface === INPUT_SURFACES.stack) {
    const intent = keyboardKey ? INPUT_INTENTS.confirm : INPUT_INTENTS.openContextAction;
    return createIntentResult(intent, GESTURE_OWNERS.mandatoryGameplay, input);
  }
  if (input.cardDragActive || (surface === INPUT_SURFACES.card && dragMovement && !input.zoneOverflowing)) {
    return createIntentResult(INPUT_INTENTS.dragCard, GESTURE_OWNERS.cardDrag, input);
  }
  if (input.targetingActive) {
    if (input.zoneOverflowing && horizontalSwipe) {
      return createIntentResult(INPUT_INTENTS.scrollZone, GESTURE_OWNERS.zoneScroll, input);
    }
    return createIntentResult(INPUT_INTENTS.target, GESTURE_OWNERS.targeting, input);
  }
  if (surface === INPUT_SURFACES.commandHand || input.commandHandOrigin) {
    const intent = horizontalSwipe || input.wheel ? INPUT_INTENTS.rotateCommandHand : INPUT_INTENTS.tapSelect;
    return createIntentResult(intent, GESTURE_OWNERS.commandHand, input);
  }
  if ((surface === INPUT_SURFACES.overflowingZone || input.zoneOverflowing) && horizontalSwipe) {
    return createIntentResult(INPUT_INTENTS.scrollZone, GESTURE_OWNERS.zoneScroll, {
      ...input,
      noTransferAtBoundary: true,
    });
  }
  if ((surface === INPUT_SURFACES.opponentBackground || input.opponentBackground) && horizontalSwipe) {
    return createIntentResult(INPUT_INTENTS.switchOpponent, GESTURE_OWNERS.opponentNavigation, input);
  }
  if (surface === INPUT_SURFACES.card && durationMs >= thresholds.longPressMs && tapMovement) {
    return createIntentResult(INPUT_INTENTS.inspect, GESTURE_OWNERS.cardInspection, input);
  }
  if (surface === INPUT_SURFACES.card && tapMovement) {
    return createIntentResult(INPUT_INTENTS.tapSelect, GESTURE_OWNERS.cardInspection, input);
  }
  if (absX > thresholds.accidentalMovementPx || absY > thresholds.accidentalMovementPx) {
    return createIntentResult(INPUT_INTENTS.panWithinAllowedView, GESTURE_OWNERS.background, input);
  }
  return createIntentResult(INPUT_INTENTS.tapSelect, GESTURE_OWNERS.background, input);
}

export function resolveGestureOwnership(input = {}, policy) {
  return resolveInputIntent(input, policy);
}

export function resolveOpponentFocusNavigation(opponents = [], focusedOpponentId = "", direction = 1) {
  const ordered = (opponents || []).map((opponent, index) => ({
    id: getOpponentId(opponent),
    playerId: opponent.playerId || opponent.id || getOpponentId(opponent),
    name: opponent.name || opponent.displayName || `Opponent ${index + 1}`,
    life: Number(opponent.life ?? 40),
    activeTurn: Boolean(opponent.activeTurn || opponent.active),
    eliminated: Boolean(opponent.eliminated || opponent.status === "eliminated"),
    index,
  })).filter((opponent) => opponent.id);
  const focusedIndex = Math.max(0, ordered.findIndex((opponent) => opponent.id === focusedOpponentId));
  const activeIndex = ordered.length ? (focusedIndex >= 0 ? focusedIndex : 0) : -1;
  const step = Number(direction || 1) < 0 ? -1 : 1;
  const nextIndex = ordered.length ? (activeIndex + step + ordered.length) % ordered.length : -1;
  const previousIndex = ordered.length ? (activeIndex - 1 + ordered.length) % ordered.length : -1;
  return {
    version: CANONICAL_INPUT_INTENT_VERSION,
    enabled: ordered.length > 1,
    arrowsVisible: ordered.length > 1,
    circular: ordered.length > 1,
    stableOrder: ordered.map((opponent) => opponent.id),
    focusedOpponentId: activeIndex >= 0 ? ordered[activeIndex]?.id || "" : "",
    nextOpponentId: nextIndex >= 0 ? ordered[nextIndex]?.id || "" : "",
    previousOpponentId: previousIndex >= 0 ? ordered[previousIndex]?.id || "" : "",
    nextFocusedOpponentId: nextIndex >= 0 ? ordered[nextIndex]?.id || "" : "",
    gestureSurface: "eligible-opponent-background-only",
    opponentSwitchMovesLocalBattlefield: false,
  };
}

export function createTableRadarModel(players = [], options = {}) {
  const focusedOpponentId = String(options.focusedOpponentId || "");
  const activePlayerId = String(options.activePlayerId || "");
  return {
    version: CANONICAL_INPUT_INTENT_VERSION,
    role: "compact-table-awareness",
    duplicatesBattlefields: false,
    entries: (players || []).map((player, index) => {
      const id = getOpponentId(player) || `player-${index + 1}`;
      return {
        id,
        playerId: player.playerId || id,
        name: player.name || player.displayName || `Player ${index + 1}`,
        life: Number(player.life ?? 40),
        focused: id === focusedOpponentId || player.playerId === focusedOpponentId,
        activeTurn: id === activePlayerId || player.playerId === activePlayerId,
        commanderMarker: player.commander?.name || player.commanderName || "",
        eliminated: Boolean(player.eliminated || player.status === "eliminated"),
        selectable: !player.eliminated,
      };
    }),
  };
}

export function resolveCommandHandVisualCloneIdentity(visualInstance = {}) {
  const canonicalCommandId = String(
    visualInstance.canonicalCommandId ||
      visualInstance.commandId ||
      visualInstance.actionCardId ||
      visualInstance.id ||
      ""
  );
  const visualId = String(visualInstance.visualId || visualInstance.cloneId || canonicalCommandId);
  return {
    visualId,
    canonicalCommandId,
    isClone: Boolean(visualInstance.isClone || (visualId && canonicalCommandId && visualId !== canonicalCommandId)),
    logicalCommandId: canonicalCommandId,
    mayOwnFocus: Boolean(canonicalCommandId),
    createsIndependentCommand: false,
  };
}

export function validateCommandHandFocusState(entries = []) {
  const normalized = (entries || []).map((entry, index) => ({
    ...entry,
    index,
    id: String(entry.id || entry.commandId || entry.canonicalCommandId || ""),
    slotOffset: Number(entry.slotOffset ?? entry.liveSlot ?? 0),
    zIndex: Number(entry.zIndex ?? 0),
    focused: Boolean(entry.focused || entry.isFocused || entry.center || entry.isCenter),
    highlighted: entry.highlighted === undefined ? Boolean(entry.focused || entry.isFocused || entry.center || entry.isCenter) : Boolean(entry.highlighted),
    previewOwner: String(entry.previewOwner || entry.previewCommandId || ""),
    activationOwner: String(entry.activationOwner || entry.activationCommandId || ""),
    hitTestRank: Number(entry.hitTestRank ?? entry.zIndex ?? 0),
  }));
  const centered = normalized.filter((entry) => Math.abs(entry.slotOffset) < 0.001);
  const focused = normalized.filter((entry) => entry.focused);
  const topByZ = normalized.reduce((best, entry) => (entry.zIndex > (best?.zIndex ?? Number.NEGATIVE_INFINITY) ? entry : best), null);
  const topByHit = normalized.reduce((best, entry) => (entry.hitTestRank > (best?.hitTestRank ?? Number.NEGATIVE_INFINITY) ? entry : best), null);
  const focusedEntry = focused[0] || centered[0] || null;
  const issues = [];
  if (focused.length !== 1) issues.push("exactly-one-focused-command-required");
  if (centered.length !== 1) issues.push("exactly-one-centered-command-required");
  if (focusedEntry && centered[0] && focusedEntry.id !== centered[0].id) issues.push("focus-must-match-center");
  if (focusedEntry && topByZ && focusedEntry.id !== topByZ.id) issues.push("focused-command-must-have-highest-z-order");
  if (focusedEntry && topByHit && focusedEntry.id !== topByHit.id) issues.push("focused-command-must-win-hit-testing");
  if (focusedEntry && normalized.some((entry) => entry.highlighted && entry.id !== focusedEntry.id)) issues.push("highlight-must-match-focus");
  if (focusedEntry && normalized.some((entry) => entry.previewOwner && entry.previewOwner !== focusedEntry.id)) issues.push("preview-must-match-focus");
  if (focusedEntry && normalized.some((entry) => entry.activationOwner && entry.activationOwner !== focusedEntry.id)) issues.push("activation-must-match-focus");
  return {
    version: CANONICAL_INPUT_INTENT_VERSION,
    valid: issues.length === 0,
    focusedId: focusedEntry?.id || "",
    centeredId: centered[0]?.id || "",
    topZOrderId: topByZ?.id || "",
    topHitTestId: topByHit?.id || "",
    issues,
    contract: COMMAND_HAND_FOCUS_CONTRACT,
  };
}

export function createCommandHandAccessibilityModel(commands = [], focusedCommandId = "") {
  return {
    version: CANONICAL_INPUT_INTENT_VERSION,
    role: "accessible-command-hand",
    focusTraversal: "logical-circular-command-order",
    hoverRequired: false,
    commands: (commands || []).map((command) => ({
      id: command.id,
      label: command.label || command.name || "Command",
      purpose: command.intent || command.detail || command.purpose || "Available command",
      focused: command.id === focusedCommandId,
      disabled: Boolean(command.disabled),
      shortcut: command.shortcut || "",
      activationIntent: INPUT_INTENTS.confirm,
    })),
  };
}

export function resolveResponsiveLandscapeComposition(options = {}) {
  const width = Math.max(0, Number(options.width || 0));
  const height = Math.max(0, Number(options.height || 0));
  const safeArea = normalizeSafeArea(options.safeArea);
  const availableWidth = Math.max(0, width - safeArea.left - safeArea.right);
  const availableHeight = Math.max(0, height - safeArea.top - safeArea.bottom);
  const deviceClass = resolveDeviceClass({ ...options, width, height });
  const permanentCounts = options.permanentCounts || {};
  const totalPermanentCount = Object.values(permanentCounts).reduce((sum, count) => sum + Number(count || 0), 0);
  const commandHandHeightRatio = deviceClass === "phone-landscape" ? 0.31 : deviceClass === "tablet-landscape" ? 0.25 : 0.21;
  const commandHandHeight = Math.round(Math.max(92, Math.min(178, availableHeight * commandHandHeightRatio)));
  const protectedCorridorHeight = Math.round(Math.max(80, Math.min(availableHeight * 0.24, 156)));
  const opponentHeight = Math.round(Math.max(82, (availableHeight - commandHandHeight - protectedCorridorHeight) * 0.48));
  const localHeight = Math.max(90, availableHeight - commandHandHeight - protectedCorridorHeight - opponentHeight);
  return {
    version: CANONICAL_INPUT_INTENT_VERSION,
    deviceClass,
    orientation: "landscape",
    fixedGameplayViewport: true,
    verticalGameplayScroll: false,
    portraitGameplayFallback: false,
    safeArea,
    availableWidth,
    availableHeight,
    semanticRegions: {
      opponentTerritory: { x: safeArea.left, y: safeArea.top, width: availableWidth, height: opponentHeight },
      protectedGameplayCorridor: { x: safeArea.left, y: safeArea.top + opponentHeight, width: availableWidth, height: protectedCorridorHeight },
      localTerritory: { x: safeArea.left, y: safeArea.top + opponentHeight + protectedCorridorHeight, width: availableWidth, height: localHeight },
      commandHand: { x: safeArea.left, y: height - safeArea.bottom - commandHandHeight, width: availableWidth, height: commandHandHeight },
    },
    densityPolicy: {
      totalPermanentCount,
      zoneLocalOverflowOnly: true,
      overflowBeforeVerticalExpansion: false,
      cardProportionsPreserved: true,
    },
    ultrawide: {
      active: availableWidth >= 1800,
      maxIntentionalTableWidth: availableWidth >= 1800 ? 1640 : availableWidth,
      avoidDashboardExpansion: true,
    },
  };
}

export function createAccessibilitySemanticsModel(options = {}) {
  return {
    version: CANONICAL_INPUT_INTENT_VERSION,
    screenReaderLabels: [
      "player",
      "opponent",
      "life",
      "card",
      "zone",
      "tap-state",
      "counters",
      "commander",
      "focused-command",
      "stack-object",
      "turn-phase",
      "mandatory-decision",
    ],
    touchTargetMinimumPx: 44,
    reducedMotionPreservesStateChanges: true,
    highContrastUsesShapeAndDepth: true,
    hoverOnlyRequired: false,
    keyboardNavigation: Boolean(options.keyboardNavigation ?? true),
  };
}

export function createInteractionPerformanceBudget(options = {}) {
  const permanentCount = Math.max(0, Number(options.permanentCount || 0));
  const opponentCount = Math.max(0, Number(options.opponentCount || 0));
  return {
    version: CANONICAL_INPUT_INTENT_VERSION,
    commandHandRerendersBattlefield: false,
    zoneScrollRerendersOtherZones: false,
    opponentSwitchRecomputesRules: false,
    rulesRunOnAnimationFrame: false,
    animationDefinesRulesState: false,
    largeBoardStressTargetObjects: Math.max(100, permanentCount),
    multiplayerStressTargetOpponents: Math.max(3, opponentCount),
    interactionTargets: ["command-hand-rotation", "zone-scroll", "card-inspection", "opponent-switch", "targeting", "stack-interaction"],
  };
}

function createIntentResult(intent, owner, input = {}) {
  return {
    version: CANONICAL_INPUT_INTENT_VERSION,
    intent,
    owner,
    singleOwner: true,
    transferDuringActiveGesture: false,
    noTransferAtBoundary: Boolean(input.noTransferAtBoundary || owner === GESTURE_OWNERS.zoneScroll),
    sourceSurface: input.surface || input.origin || "",
    platformNeutral: true,
  };
}

function resolveDeviceClass(options = {}) {
  const explicit = String(options.deviceClass || options.viewport || "");
  if (explicit) {
    if (explicit.includes("phone")) return "phone-landscape";
    if (explicit.includes("tablet") || explicit.includes("ipad")) return "tablet-landscape";
    if (explicit.includes("ultrawide")) return "desktop-ultrawide";
    if (explicit.includes("desktop")) return "desktop-landscape";
  }
  const width = Number(options.width || 0);
  const height = Number(options.height || 0);
  if (width >= 1800) return "desktop-ultrawide";
  if (width >= 1024 && height >= 650) return "tablet-landscape";
  if (width >= 900) return "desktop-landscape";
  return "phone-landscape";
}

function normalizeSafeArea(safeArea = {}) {
  return {
    top: Math.max(0, Number(safeArea.top || 0)),
    right: Math.max(0, Number(safeArea.right || 0)),
    bottom: Math.max(0, Number(safeArea.bottom || 0)),
    left: Math.max(0, Number(safeArea.left || 0)),
  };
}

function getOpponentId(opponent = {}) {
  return String(opponent.id || opponent.playerId || opponent.seatId || "");
}
