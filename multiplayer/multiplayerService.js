import { DEFAULT_FACE_DOWN_LABEL } from "./connectionTypes.js";

export function createMultiplayerService() {
  let localSnapshot = null;

  return {
    updateLocalSnapshot(snapshot) {
      localSnapshot = snapshot;
    },
    getLocalSnapshot() {
      return localSnapshot;
    },
    connectSameWifi() {
      return {
        ok: false,
        message:
          "Same WiFi sync is coming soon. In a hosted build this will likely use WebRTC peers with a lightweight signaling step.",
      };
    },
    connectBluetooth() {
      return {
        ok: false,
        message:
          "Bluetooth sync is platform-dependent in the browser. A future pass can use Web Bluetooth where the device and browser support it.",
      };
    },
    startSimulatedLocalConnection() {
      return createSimulatedConnectedPlayers();
    },
  };
}

export function createSimulatedConnectedPlayers() {
  const now = Date.now();

  return [
    {
      id: "sim-nyra",
      displayName: "Nyra Vale",
      connectionType: "simulated",
      isConnected: true,
      lastUpdated: now,
      permissions: {
        canViewFaceDownCards: false,
      },
      publicTrackerState: {
        life: 28,
        counters: {
          poison: 1,
          energy: 3,
          experience: 2,
          tickets: 0,
        },
        commanderDamage: [
          { label: "You", value: 6 },
          { label: "Mira", value: 2 },
        ],
      },
      publicBoardState: {
        currentPhase: "Combat",
        effects: [
          createBoardPermanent({
            id: "sim-nyra-effect-1",
            name: "Parallel Lives",
            manaCost: "{3}{G}",
            typeLine: "Enchantment",
            oracleText: "If an effect would create one or more tokens under your control, it creates twice that many instead.",
            isNonCreature: true,
            doublesTokens: true,
            createsTokens: true,
          }),
        ],
        permanents: [
          createBoardPermanent({
            id: "sim-nyra-perm-1",
            name: "Birds of Paradise",
            manaCost: "{G}",
            typeLine: "Creature — Bird",
            oracleText: "Flying",
            power: 0,
            toughness: 1,
            isCreature: true,
          }),
          createBoardPermanent({
            id: "sim-nyra-perm-2",
            name: "Willbender",
            manaCost: "{1}{U}",
            typeLine: "Creature — Human Wizard",
            oracleText: "Morph {1}{U}",
            power: 2,
            toughness: 2,
            isCreature: true,
            isFaceDown: true,
            faceDownLabel: DEFAULT_FACE_DOWN_LABEL,
            revealAllowed: false,
          }),
          createBoardPermanent({
            id: "sim-nyra-perm-3",
            name: "Saproling",
            manaCost: "",
            typeLine: "Token Creature — Saproling",
            oracleText: "",
            power: 1,
            toughness: 1,
            quantity: 2,
            isCreature: true,
            isToken: true,
          }),
        ],
        totalPower: 4,
        totalToughness: 5,
      },
    },
    {
      id: "sim-garrick",
      displayName: "Garrick Flint",
      connectionType: "simulated",
      isConnected: true,
      lastUpdated: now - 15000,
      permissions: {
        canViewFaceDownCards: true,
      },
      publicTrackerState: {
        life: 34,
        counters: {
          poison: 0,
          energy: 0,
          experience: 5,
          tickets: 1,
        },
        commanderDamage: [
          { label: "You", value: 3 },
          { label: "Nyra", value: 1 },
        ],
      },
      publicBoardState: {
        currentPhase: "Main 2",
        effects: [
          createBoardPermanent({
            id: "sim-garrick-effect-1",
            name: "Anointed Procession",
            manaCost: "{3}{W}",
            typeLine: "Enchantment",
            oracleText: "If an effect would create one or more tokens under your control, it creates twice that many instead.",
            isNonCreature: true,
            doublesTokens: true,
            createsTokens: true,
          }),
        ],
        permanents: [
          createBoardPermanent({
            id: "sim-garrick-perm-1",
            name: "Bronzehide Lion",
            manaCost: "{G}{W}",
            typeLine: "Creature — Cat",
            oracleText: "",
            power: 3,
            toughness: 3,
            isCreature: true,
            isFaceDown: true,
            faceDownLabel: DEFAULT_FACE_DOWN_LABEL,
            revealAllowed: false,
          }),
          createBoardPermanent({
            id: "sim-garrick-perm-2",
            name: "Servo",
            manaCost: "",
            typeLine: "Token Artifact Creature — Servo",
            oracleText: "",
            power: 1,
            toughness: 1,
            quantity: 4,
            isCreature: true,
            isArtifact: true,
            isToken: true,
          }),
        ],
        totalPower: 7,
        totalToughness: 7,
      },
    },
  ];
}

function createBoardPermanent(source = {}) {
  return {
    id: source.id || `sim-${Math.random().toString(16).slice(2)}`,
    name: source.name || "Permanent",
    manaCost: source.manaCost || "",
    typeLine: source.typeLine || "",
    oracleText: source.oracleText || "",
    imageUrl: source.imageUrl || "",
    cardImageUrl: source.cardImageUrl || source.imageUrl || "",
    rulingsUri: source.rulingsUri || "",
    rulings: Array.isArray(source.rulings) ? source.rulings : [],
    legalities: source.legalities && typeof source.legalities === "object" ? source.legalities : {},
    power: Number.isFinite(Number(source.power)) ? Number(source.power) : 0,
    toughness: Number.isFinite(Number(source.toughness)) ? Number(source.toughness) : 0,
    quantity: Number.isFinite(Number(source.quantity)) ? Math.max(1, Number(source.quantity)) : 1,
    isToken: Boolean(source.isToken),
    isNonCreature: Boolean(source.isNonCreature),
    isLegendary: Boolean(source.isLegendary),
    isArtifact: Boolean(source.isArtifact),
    isCreature: Boolean(source.isCreature),
    plusOneCounters: Number.isFinite(Number(source.plusOneCounters)) ? Number(source.plusOneCounters) : 0,
    doublesTokens: Boolean(source.doublesTokens),
    doublesCounters: Boolean(source.doublesCounters),
    counterModifierBonus: Number.isFinite(Number(source.counterModifierBonus)) ? Number(source.counterModifierBonus) : 0,
    createsTokens: Boolean(source.createsTokens),
    addsCounters: Boolean(source.addsCounters),
    staticBuffPower: Number.isFinite(Number(source.staticBuffPower)) ? Number(source.staticBuffPower) : 0,
    staticBuffToughness: Number.isFinite(Number(source.staticBuffToughness)) ? Number(source.staticBuffToughness) : 0,
    staticBuffAppliesTo: source.staticBuffAppliesTo || "",
    staticBuffExcludesSelf: Boolean(source.staticBuffExcludesSelf),
    isExpanded: false,
    isSelected: false,
    isFaceDown: Boolean(source.isFaceDown),
    faceDownLabel: source.faceDownLabel || DEFAULT_FACE_DOWN_LABEL,
    revealAllowed: Boolean(source.revealAllowed),
    isHiddenToOpponents: Boolean(source.isHiddenToOpponents),
    automationRules: Array.isArray(source.automationRules) ? source.automationRules : [],
    autoRulesEnabled: source.autoRulesEnabled !== false,
    hasResolvedEtbTriggers: Boolean(source.hasResolvedEtbTriggers),
    notes: source.notes || "",
    attachedToId: source.attachedToId || "",
    attachmentKind: source.attachmentKind || "",
  };
}

/**
 * TODO:
 * - Replace mock players with WebRTC peers on the same local network.
 * - Add optional signaling for browser-to-browser discovery on hosted builds.
 * - Gate Bluetooth support behind feature detection and secure-context checks.
 */
