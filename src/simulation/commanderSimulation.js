import { createId } from "../state/ids.js";
import { createGameSession, createPermanent, PHASES } from "../state/schema.js";
import { hydratePermanentEffects } from "../effects/effectEngine.js";
import { getDeckMainboardCount, getSimulationDeckById, SIM_OPPONENT_IDS, summarizeDeckIntegrity } from "./decks/index.js";

export const SIMULATION_SPEEDS = {
  step: { label: "Step", intervalMs: 250 },
  normal: { label: "Normal", intervalMs: 1100 },
  fast: { label: "Fast", intervalMs: 350 },
};

export function getSimulationSpeedInterval(speed = "normal") {
  return SIMULATION_SPEEDS[speed]?.intervalMs || SIMULATION_SPEEDS.normal.intervalMs;
}

export function createSimulationSession(profile, options = {}) {
  const session = createGameSession();
  const selectedOpponents = (Array.isArray(options.selectedOpponents) ? options.selectedOpponents : [])
    .filter((id) => SIM_OPPONENT_IDS.includes(id));
  const safeOpponents = selectedOpponents.length ? selectedOpponents : ["alpha"];
  const revengeEnabled = options.revengeEnabled !== false;
  const format = inferSimulationFormat(safeOpponents.length);
  const speed = String(options.speed || "normal").toLowerCase();
  const opponents = Object.fromEntries(safeOpponents.map((id) => [id, createNpcStateFromDeck(id)]));
  const players = createSimulationPlayers(profile, opponents);
  const integrityNotes = safeOpponents.map((id) => {
    const deck = getSimulationDeckById(id);
    const integrity = summarizeDeckIntegrity(deck);
    return `${deck?.name || id}: ${integrity.mainboardCount} cards${integrity.unresolved.length ? ` (${integrity.unresolved.length} unresolved)` : ""}`;
  });
  const connectedPlayers = [
    { id: "local-player", name: profile.player?.name || "Player", authority: "host", role: "player" },
    ...safeOpponents.map((id) => ({
      id,
      name: opponents[id].name,
      authority: "guest",
      role: "player",
      publicBoardSnapshot: createNpcPublicSnapshot(opponents[id]),
    })),
  ];
  session.simulation = {
    enabled: true,
    status: "running",
    speed: SIMULATION_SPEEDS[speed] ? speed : "normal",
    revengeEnabled,
    format,
    selectedOpponents: safeOpponents,
    opponents,
    players,
    eliminatedPlayerIds: [],
    eliminations: [],
    winnerId: "",
    statsRecorded: false,
    strategyAdjustmentsApplied: 0,
    turnOrder: ["local-player", ...safeOpponents],
    turnIndex: 0,
    currentPlayerId: "local-player",
    currentPhaseIndex: 0,
    round: 1,
    waitingForUser: true,
    log: [
      createSimLog("system", "Simulation started. Your turn is active."),
      createSimLog("system", `Format: ${format}. Revenge ${revengeEnabled ? "ON" : "OFF"}.`),
      createSimLog("system", `Deck integrity: ${integrityNotes.join(" | ")}`),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  session.gameTracking = {
    active: true,
    startedAt: Date.now(),
    mode: "simulation-game",
  };
  session.phaseIndex = 0;
  session.turn = 1;
  return {
    session,
    connectedPlayers,
  };
}

function inferSimulationFormat(opponentCount = 1) {
  if (opponentCount <= 1) {
    return "1v1 Commander";
  }
  if (opponentCount === 2) {
    return "3-way Commander";
  }
  return "4-way Commander";
}

function createSimulationPlayers(profile, opponents = {}) {
  const localPlayerName = profile.player?.name || "Player";
  const players = {
    "local-player": {
      id: "local-player",
      name: localPlayerName,
      life: 40,
      eliminated: false,
      isNpc: false,
      commanderDamageFrom: {},
      commanderDamageBy: {},
    },
  };
  Object.values(opponents || {}).forEach((npc) => {
    players[npc.id] = {
      id: npc.id,
      name: npc.name,
      life: 40,
      eliminated: false,
      isNpc: true,
      commanderDamageFrom: {},
      commanderDamageBy: {},
    };
  });
  return players;
}

export function createNpcPublicSnapshot(npc) {
  return {
    id: npc.id,
    name: npc.name,
    life: npc.life,
    deckName: npc.deckName,
    currentPhase: PHASES[npc.currentPhaseIndex || 0] || PHASES[0],
    battlefieldCount: (npc.zones?.battlefield || []).length,
    updatedAt: Date.now(),
  };
}

export function createSimLog(actorId, text, detail = "") {
  return {
    id: createId("simlog"),
    actorId,
    text,
    detail,
    at: Date.now(),
  };
}

function createNpcStateFromDeck(id) {
  const deck = getSimulationDeckById(id) || {
    id,
    name: id,
    deckName: `${id} Deck Placeholder`,
    status: "placeholder",
    isPlaceholder: true,
    commander: {
      name: `${id} Commander Placeholder`,
      typeLine: "Legendary Creature",
      manaCost: "{3}",
      manaValue: 3,
      power: 3,
      toughness: 3,
      role: "commander",
      quantity: 1,
    },
    cards: [],
    strategy: {
      archetype: "Unknown",
      tags: [],
      priorities: [],
      threatPriorityCards: [],
      revengeLearningFocus: [],
    },
  };
  const commanderCard = toDeckCard(deck.commander, deck.id);
  const library = expandDeckCards(deck.cards || [], deck.id);
  const openingHand = library.splice(0, 7);
  const integrity = summarizeDeckIntegrity(deck);
  return {
    id: deck.id,
    name: deck.name,
    deckName: deck.deckName,
    deckStatus: deck.status || "placeholder",
    isPlaceholder: Boolean(deck.isPlaceholder),
    strategy: deck.strategy || {},
    commanderProfile: {
      primary: deck.commander?.name || "",
      backup: deck.backupCommander?.name || "",
    },
    unresolvedCards: integrity.unresolved,
    deckMainboardCount: integrity.mainboardCount,
    life: 40,
    commander: {
      card: commanderCard,
      zone: "command",
      castCount: 0,
      tax: 0,
    },
    commanderDamageFrom: {},
    zones: {
      library,
      hand: openingHand,
      battlefield: [],
      graveyard: [],
      exile: [],
      command: [commanderCard],
    },
    landPlaysThisTurn: 0,
    currentPhaseIndex: 0,
    memory: {
      knownThreats: {},
      lossesToCommander: {},
    },
    updatedAt: Date.now(),
  };
}

export function toDeckCard(card, ownerId = "npc") {
  const inferredTypeLine = card.typeLine || inferTypeLineFromName(card.name || "");
  const inferredRole = card.role || inferRoleFromType(inferredTypeLine);
  const inferredManaValue = Number.isFinite(Number(card.manaValue))
    ? Number(card.manaValue)
    : inferManaValueFromCard(card, inferredTypeLine);
  const unresolvedDefinition = Boolean(card.unresolvedDefinition || !card.typeLine);
  return {
    cardId: card.cardId || createId("simcard"),
    name: card.name || "Simulation Card Placeholder",
    manaCost: card.manaCost || "",
    manaValue: inferredManaValue,
    typeLine: inferredTypeLine || "Permanent",
    power: Number.isFinite(Number(card.power)) ? Number(card.power) : 0,
    toughness: Number.isFinite(Number(card.toughness)) ? Number(card.toughness) : 0,
    oracleText: card.oracleText || "",
    keywords: Array.isArray(card.keywords) ? card.keywords : [],
    role: inferredRole,
    quantity: 1,
    owner: ownerId,
    controller: ownerId,
    unresolvedDefinition,
  };
}

function expandDeckCards(cards, ownerId) {
  return cards.flatMap((entry) =>
    Array.from({ length: Math.max(1, Number(entry.quantity) || 1) }, (_, index) =>
      toDeckCard(
        {
          ...entry,
          cardId: entry.cardId || `${ownerId}:${normalizeNameForId(entry.name || "card")}:${index + 1}`,
          quantity: 1,
        },
        ownerId
      )
    )
  );
}

function inferManaValue(manaCost = "") {
  const values = String(manaCost || "").match(/\d+|[WUBRGCX]/gi) || [];
  return values.reduce((sum, value) => {
    if (/^\d+$/.test(value)) {
      return sum + Number(value);
    }
    return sum + 1;
  }, 0);
}

function inferManaValueFromCard(card = {}, typeLine = "") {
  if (Number.isFinite(Number(card.manaValue))) {
    return Number(card.manaValue);
  }
  const direct = inferManaValue(card.manaCost || "");
  if (direct > 0) {
    return direct;
  }
  if (/\bLand\b/i.test(typeLine)) {
    return 0;
  }
  if (/\bInstant\b|\bSorcery\b/i.test(typeLine)) {
    return 2;
  }
  if (/\bArtifact\b/i.test(typeLine)) {
    return 3;
  }
  if (/\bCreature\b/i.test(typeLine)) {
    return 4;
  }
  if (/\bEnchantment\b/i.test(typeLine)) {
    return 4;
  }
  return 3;
}

function inferRoleFromType(typeLine = "") {
  if (/\bLand\b/i.test(typeLine)) {
    return "land";
  }
  if (/\bInstant\b|\bSorcery\b/i.test(typeLine)) {
    return "interaction";
  }
  if (/\bCreature\b/i.test(typeLine)) {
    return "creature";
  }
  if (/\bArtifact\b/i.test(typeLine)) {
    return "artifact";
  }
  if (/\bEnchantment\b/i.test(typeLine)) {
    return "engine";
  }
  return "permanent";
}

function inferTypeLineFromName(name = "") {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) {
    return "Permanent";
  }
  if (isKnownLandName(normalized)) {
    return "Land";
  }
  if (KNOWN_INSTANTS.has(normalized)) {
    return "Instant";
  }
  if (KNOWN_SORCERIES.has(normalized)) {
    return "Sorcery";
  }
  if (KNOWN_ENCHANTMENTS.has(normalized)) {
    return "Enchantment";
  }
  if (KNOWN_ARTIFACTS.has(normalized)) {
    return "Artifact";
  }
  if (KNOWN_PLANESWALKERS.has(normalized)) {
    return "Planeswalker";
  }
  if (KNOWN_CREATURES.has(normalized)) {
    return "Creature";
  }
  return "Permanent";
}

function isKnownLandName(name) {
  if (/\bforest\b|\bisland\b|\bmountain\b|\bswamp\b|\bplains\b|\bwastes\b/.test(name)) {
    return true;
  }
  return KNOWN_LANDS.has(name);
}

const KNOWN_LANDS = new Set([
  "bojuka bog",
  "cabaretti courtyard",
  "canyon slough",
  "cinder glade",
  "command tower",
  "dakmor salvage",
  "escape tunnel",
  "evolving wilds",
  "fabled passage",
  "festering thicket",
  "karplusan forest",
  "llanowar wastes",
  "maestros theater",
  "mountain valley",
  "myriad landscape",
  "riveteers overlook",
  "rocky tar pit",
  "sheltered thicket",
  "smoldering marsh",
  "sulfurous springs",
  "terramorphic expanse",
  "twilight mire",
  "vernal fen",
  "viridescent bog",
  "cascade bluffs",
  "exotic orchard",
  "ferrous lake",
  "frostboil snarl",
  "izzet boilerworks",
  "reliquary tower",
  "shivan reef",
  "sulfur falls",
  "temple of epiphany",
  "temple of the false god",
  "arcane lighthouse",
  "arch of orazca",
  "blast zone",
  "bonders' enclave",
  "eldrazi temple",
  "forge of heroes",
  "geier reach sanitarium",
  "guildless commons",
  "mage-ring network",
  "mirrorpool",
  "rogue's passage",
  "ruins of oran-rief",
  "scavenger grounds",
  "sea gate wreckage",
  "shrine of the forsaken gods",
  "tomb of the spirit dragon",
  "tyrite sanctum",
  "urza's mine",
  "urza's power plant",
  "urza's tower",
  "war room",
]);

const KNOWN_INSTANTS = new Set([
  "beast within",
  "infernal grasp",
  "putrefy",
  "rakdos charm",
  "tear asunder",
  "windgrace's judgment",
  "arcane denial",
  "big score",
  "chaos warp",
  "dig through time",
  "galvanic iteration",
  "opt",
  "pongify",
  "radical idea",
  "think twice",
  "treasure cruise",
  "warping wail",
  "spatial contortion",
  "not of this world",
  "titan's presence",
]);

const KNOWN_SORCERIES = new Set([
  "blasphemous act",
  "cultivate",
  "escape to the wilds",
  "farseek",
  "gaze of granite",
  "harrow",
  "nature's lore",
  "night's whisper",
  "pest infestation",
  "planetary annihilation",
  "roiling regrowth",
  "skyshroud claim",
  "splendid reclamation",
  "worldsoul's rage",
  "baral's expertise",
  "curse of the swine",
  "deep analysis",
  "elemental eruption",
  "epic experiment",
  "expressive iteration",
  "faithless looting",
  "finale of promise",
  "finale of revelation",
  "mizzix's mastery",
  "ponder",
  "preordain",
  "serum visions",
  "tezzeret's gambit",
  "vandalblast",
  "volcanic torrent",
  "windfall",
  "all is dust",
  "desecrate reality",
  "rise of the eldrazi",
]);

const KNOWN_ENCHANTMENTS = new Set([
  "binding the old gods",
  "hammer of purphoros",
  "arcane bombardment",
  "propaganda",
  "shark typhoon",
  "ugins mastery",
  "forsaken monument",
]);

const KNOWN_ARTIFACTS = new Set([
  "arcane signet",
  "sol ring",
  "cursed mirror",
  "forger's foundry",
  "izzet signet",
  "midnight clock",
  "winged boots",
  "abstruse archaic",
  "ancient stone idol",
  "burnished hart",
  "crashing drawbridge",
  "darksteel monolith",
  "dreamstone hedron",
  "duplicant",
  "endless atlas",
  "everflowing chalice",
  "fireshrieker",
  "hangarback walker",
  "hedron archive",
  "investigator's journal",
  "kaldra compleat",
  "lightning greaves",
  "mazemind tome",
  "mind stone",
  "mirage mirror",
  "mystic forge",
  "ornithopter of paradise",
  "palladium myr",
  "perilous vault",
  "phyrexian triniform",
  "stonecoil serpent",
  "thought vessel",
  "thran dynamo",
  "transmogrifying wand",
  "unstable obelisk",
  "worn powerstone",
]);

const KNOWN_PLANESWALKERS = new Set(["ugin, the ineffable"]);

const KNOWN_CREATURES = new Set([
  "aftermath analyst",
  "augur of autumn",
  "baloth prime",
  "braids, arisen nightmare",
  "centaur vinecrasher",
  "evendo brushrazer",
  "god-eternal bontu",
  "groundskeeper",
  "horizon explorer",
  "juri, master of the revue",
  "korvold, fae-cursed king",
  "loamcrafter faun",
  "mayhem devil",
  "mazirek, kraul death priest",
  "moraug, fury of akoum",
  "multani, yavimaya's avatar",
  "omnath, locus of rage",
  "oracle of mul daya",
  "rampaging baloths",
  "satyr wayfinder",
  "scouring swarm",
  "soul of windgrace",
  "springbloom druid",
  "sprouting goblin",
  "the gitrog monster",
  "tireless tracker",
  "titania, protector of argoth",
  "uurg, spawn of turg",
  "world breaker",
  "archmage emeritus",
  "bloodthirsty adversary",
  "crackling spellslinger",
  "electrostatic field",
  "eris, roar of the storm",
  "goblin electromancer",
  "guttersnipe",
  "haughty djinn",
  "kaza, roil chaser",
  "leyline dowser",
  "murmuring mystic",
  "niv-mizzet, parun",
  "octavia, living thesis",
  "pteramander",
  "storm-kiln artist",
  "talrand, sky summoner",
  "third path iconoclast",
  "thunderclap drake",
  "veyran, voice of duality",
  "young pyromancer",
  "artisan of kozilek",
  "bane of bala ged",
  "calamity of the titans",
  "endbringer",
  "endless one",
  "flayer of loyalties",
  "geode golem",
  "it that betrays",
  "kozilek, the great distortion",
  "matter reshaper",
  "metalwork colossus",
  "meteor golem",
  "myriad construct",
  "oblivion sower",
  "omarthis, ghostfire initiate",
  "scaretiller",
  "skittering cicada",
  "solemn simulacrum",
  "soul of new phyrexia",
  "steel hellkite",
  "suspicious bookcase",
]);

function normalizeNameForId(name) {
  return String(name || "card")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function toOpponentPermanent(card, controllerId, entryMeta = {}) {
  return hydratePermanentEffects(
    createPermanent({
      ...card,
      id: createId(`simperm-${controllerId}`),
      controller: controllerId,
      owner: controllerId,
      ownedByCommanderDeck: true,
      zone: "battlefield",
      sourcePermanentId: entryMeta.sourcePermanentId || "",
      createdByTriggerId: entryMeta.createdByTriggerId || "",
      tokenTemplateId: entryMeta.tokenTemplateId || "",
      tokenCopyOfId: entryMeta.tokenCopyOfId || "",
    })
  );
}
