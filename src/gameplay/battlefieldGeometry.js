export const CANONICAL_BATTLEFIELD_GEOMETRY_VERSION = "boardstate-canonical-battlefield-geometry-0.1.0";

export const BATTLEFIELD_DENSITY_STATES = Object.freeze(["empty", "sparse", "normal", "busy", "extreme"]);

export const BATTLEFIELD_OVERFLOW_ORDER = Object.freeze([
  "normal-placement",
  "adaptive-spacing",
  "controlled-overlap",
  "duplicate-stacking",
  "equivalent-object-grouping",
  "nonland-permanent-stacking",
  "adaptive-scaling",
  "expandable-grouped-presentation",
  "zone-local-horizontal-scrolling",
]);

export const BATTLEFIELD_GESTURE_OWNERS = Object.freeze({
  commandHand: "command-hand",
  overflowingZone: "overflowing-zone",
  opponentNavigation: "opponent-navigation",
  cardDrag: "card-drag",
  cardInspection: "card-inspection",
  none: "none",
});

export const CANONICAL_TABLETOP_ZONES = Object.freeze({
  creature: "creature-zone",
  lower: "land-support-zone",
  side: "side-zones",
});

export function getPermanentLaneKey(permanent = {}) {
  const typeLine = getTypeLine(permanent);
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

export function getCanonicalTabletopZoneKey(permanent = {}) {
  const typeLine = getTypeLine(permanent);
  if (permanent.isPlaneswalker || /\bplaneswalker\b/.test(typeLine)) return "planeswalker";
  if (permanent.isLand || /\bland\b/.test(typeLine)) return "land";
  if (permanent.isCreature || /\bcreature\b/.test(typeLine)) return "creature";
  return "support";
}

export function resolveBattlefieldDensityState({ permanentCount = 0, tokenCount = 0, viewport = "desktop", playerCount = 1 } = {}) {
  const count = Math.max(0, Number(permanentCount || 0));
  const tokens = Math.max(0, Number(tokenCount || 0));
  const players = Math.max(1, Number(playerCount || 1));
  const compactViewport = String(viewport || "").includes("phone");
  if (count === 0) return "empty";
  if (count <= 4 && tokens <= 3 && !compactViewport) return "sparse";
  if (count <= 18 && tokens <= 12 && players <= 4) return "normal";
  if (count <= 54 && tokens <= 38 && players <= 7) return "busy";
  return "extreme";
}

export function createCanonicalBattlefieldGeometry(permanents = [], options = {}) {
  const role = options.role || "local";
  const prepared = (permanents || []).map((permanent, index) => ({
    ...clonePlain(permanent),
    semanticLaneKey: getPermanentLaneKey(permanent),
    canonicalZoneKey: getCanonicalTabletopZoneKey(permanent),
    originalIndex: index,
  }));
  const tokenCount = prepared
    .filter((permanent) => permanent.isToken || /\btoken\b/i.test(permanent.typeLine || ""))
    .reduce((sum, permanent) => sum + Number(permanent.quantity || 1), 0);
  const densityState = resolveBattlefieldDensityState({
    permanentCount: prepared.reduce((sum, permanent) => sum + Number(permanent.quantity || 1), 0),
    tokenCount,
    viewport: options.viewport,
    playerCount: options.playerCount,
  });
  const creatures = [];
  const planeswalkers = [];
  const lands = [];
  const support = [];
  for (const permanent of prepared) {
    const zone = permanent.canonicalZoneKey;
    if (zone === "planeswalker") {
      planeswalkers.push({ ...permanent, placementRole: "planeswalker-far-right" });
    } else if (zone === "creature") {
      creatures.push({ ...permanent, placementRole: permanent.isCommander ? "creature-commander" : "creature" });
    } else if (zone === "land") {
      lands.push({ ...permanent, placementRole: "land" });
    } else {
      support.push({ ...permanent, placementRole: "support-far-right" });
    }
  }
  const orderedPlaneswalkers = planeswalkers.slice().reverse();
  const creatureZonePermanents = [...creatures, ...orderedPlaneswalkers].map((permanent, index) =>
    withTabletopOrder(permanent, CANONICAL_TABLETOP_ZONES.creature, index)
  );
  const lowerZonePermanents = [...lands, ...support].map((permanent, index) =>
    withTabletopOrder(permanent, CANONICAL_TABLETOP_ZONES.lower, index)
  );
  const creatureZone = createZoneModel({
    key: CANONICAL_TABLETOP_ZONES.creature,
    label: "Creatures",
    permanents: creatureZonePermanents,
    densityState,
    role,
    supportBoundaryIndex: creatures.length,
    overflowThreshold: getZoneOverflowThreshold(densityState, "creature"),
  });
  const lowerZone = createZoneModel({
    key: CANONICAL_TABLETOP_ZONES.lower,
    label: "Lands / Support",
    permanents: lowerZonePermanents,
    densityState,
    role,
    supportBoundaryIndex: lands.length,
    overflowThreshold: getZoneOverflowThreshold(densityState, "lower"),
  });
  return {
    version: CANONICAL_BATTLEFIELD_GEOMETRY_VERSION,
    role,
    densityState,
    zones: [creatureZone, lowerZone],
    creatureZone,
    lowerZone,
    sideZones: {
      key: CANONICAL_TABLETOP_ZONES.side,
      library: { location: role === "opponent" ? "upper-edge" : "lower-edge" },
      graveyard: { location: role === "opponent" ? "upper-edge" : "lower-edge" },
      exile: { location: role === "opponent" ? "upper-edge" : "lower-edge" },
    },
    planeswalkerPlacement: {
      enabled: true,
      rule: "far-right-creature-zone-inward",
      idsRightToLeft: planeswalkers.map((permanent) => permanent.id || permanent.name || ""),
      renderOrder: orderedPlaneswalkers.map((permanent) => permanent.id || permanent.name || ""),
    },
    supportPlacement: {
      enabled: true,
      rule: "far-right-lower-zone-after-lands",
      landCount: lands.length,
      supportCount: support.length,
    },
    gestureOwnership: createGestureOwnershipContract(),
    overflowOrder: BATTLEFIELD_OVERFLOW_ORDER,
    presentationOnly: true,
    authoritativeObjectIds: prepared.map((permanent) => permanent.id).filter(Boolean),
  };
}

export function resolveBattlefieldGestureOwner({
  origin = "",
  zoneOverflowing = false,
  cardDragActive = false,
  inspectionActive = false,
  opponentBackground = false,
} = {}) {
  if (origin === "command-hand") return BATTLEFIELD_GESTURE_OWNERS.commandHand;
  if (cardDragActive) return BATTLEFIELD_GESTURE_OWNERS.cardDrag;
  if (inspectionActive) return BATTLEFIELD_GESTURE_OWNERS.cardInspection;
  if (zoneOverflowing) return BATTLEFIELD_GESTURE_OWNERS.overflowingZone;
  if (opponentBackground) return BATTLEFIELD_GESTURE_OWNERS.opponentNavigation;
  return BATTLEFIELD_GESTURE_OWNERS.none;
}

function createZoneModel({ key, label, permanents, densityState, role, supportBoundaryIndex = 0, overflowThreshold }) {
  const count = permanents.reduce((sum, permanent) => sum + Number(permanent.quantity || 1), 0);
  const overflow = count > overflowThreshold;
  return {
    key,
    label,
    role,
    permanents,
    count,
    densityState,
    layoutMode: getZoneLayoutMode(count, densityState, overflow),
    overflowMode: overflow ? "zone-local-horizontal-scroll" : "none",
    horizontalScrollAllowed: overflow,
    verticalScrollAllowed: false,
    overflowThreshold,
    supportBoundaryIndex,
    overflowCues: overflow ? ["edge-card-peek", "edge-fade", "compact-direction-affordance"] : [],
    scrollMemoryKey: `${role}:${key}`,
    authoritativeObjectIds: permanents.map((permanent) => permanent.id).filter(Boolean),
    stacking: createPresentationStackSummary(permanents, densityState),
  };
}

function createPresentationStackSummary(permanents = [], densityState = "normal") {
  const groupable = new Map();
  for (const permanent of permanents) {
    const key = createEquivalentStackKey(permanent);
    const group = groupable.get(key) || {
      key,
      representativeId: permanent.id || "",
      ids: [],
      quantity: 0,
      shouldStack: false,
      reason: "",
    };
    group.ids.push(permanent.id || "");
    group.quantity += Number(permanent.quantity || 1);
    groupable.set(key, group);
  }
  return [...groupable.values()]
    .map((group) => ({
      ...group,
      shouldStack:
        group.quantity > 1 &&
        (["busy", "extreme"].includes(densityState) || group.ids.length > 1 || group.quantity >= 4),
      reason: group.quantity > 1 ? "equivalent-authoritative-objects" : "single-object",
    }))
    .filter((group) => group.shouldStack);
}

function createEquivalentStackKey(permanent = {}) {
  return [
    permanent.name || "Permanent",
    permanent.typeLine || "Permanent",
    permanent.controller || permanent.controllerPlayerId || "controller",
    permanent.owner || permanent.ownerPlayerId || "owner",
    permanent.tapped ? "tapped" : "untapped",
    permanent.attacking ? "attacking" : "",
    permanent.blocking ? "blocking" : "",
    permanent.summoningSick ? "summoning" : "",
    JSON.stringify(permanent.counters || {}),
    JSON.stringify(permanent.attachments || []),
    JSON.stringify(permanent.equipment || permanent.equippedBy || []),
    permanent.currentPower ?? permanent.power ?? "",
    permanent.currentToughness ?? permanent.toughness ?? "",
  ].join("|");
}

function getZoneOverflowThreshold(densityState = "normal", zoneKind = "creature") {
  const thresholds = {
    empty: 99,
    sparse: 99,
    normal: zoneKind === "creature" ? 12 : 16,
    busy: zoneKind === "creature" ? 18 : 24,
    extreme: zoneKind === "creature" ? 24 : 32,
  };
  return thresholds[densityState] || thresholds.normal;
}

function getZoneLayoutMode(count = 0, densityState = "normal", overflow = false) {
  if (!count) return "empty";
  if (overflow) return "zone-local-horizontal-scroll";
  if (densityState === "extreme") return "grouped-compact";
  if (densityState === "busy") return "controlled-overlap";
  if (densityState === "normal") return "adaptive-spacing";
  return "normal-placement";
}

function createGestureOwnershipContract() {
  return {
    commandHand: "gestures-starting-inside-dual-hand-dock-belong-to-that-hand-only",
    overflowingZone: "gestures-starting-inside-overflowing-zone-scroll-that-zone-only",
    opponentNavigation: "gestures-starting-on-opponent-background-switch-focused-opponent",
    noGestureTransferAtZoneEdge: true,
    cardDragPriority: "tap-inspect-scroll-drag-thresholds",
  };
}

function withTabletopOrder(permanent = {}, zoneKey = "", index = 0) {
  return {
    ...permanent,
    tabletopZoneKey: zoneKey,
    tabletopOrder: index,
    presentationOnly: true,
  };
}

function getTypeLine(permanent = {}) {
  return String(permanent.typeLine || permanent.baseCharacteristics?.typeLine || "").toLowerCase();
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}
