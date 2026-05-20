import { createId } from "../state/ids.js";
import { createGameSession, createPermanent, PHASES } from "../state/schema.js";
import { hydratePermanentEffects } from "../effects/effectEngine.js";
import { getSimulationDeckById, SIM_OPPONENT_IDS } from "./decks/index.js";

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
  const speed = String(options.speed || "normal").toLowerCase();
  const opponents = Object.fromEntries(safeOpponents.map((id) => [id, createNpcStateFromDeck(id)]));
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
    selectedOpponents: safeOpponents,
    opponents,
    turnOrder: ["local-player", ...safeOpponents],
    turnIndex: 0,
    currentPlayerId: "local-player",
    currentPhaseIndex: 0,
    round: 1,
    waitingForUser: true,
    log: [createSimLog("system", "Simulation started. Your turn is active.")],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  session.phaseIndex = 0;
  session.turn = 1;
  return {
    session,
    connectedPlayers,
  };
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
  };
  const commanderCard = toDeckCard(deck.commander, deck.id);
  const library = expandDeckCards(deck.cards || [], deck.id);
  const openingHand = library.splice(0, 7);
  return {
    id: deck.id,
    name: deck.name,
    deckName: deck.deckName,
    deckStatus: deck.status || "placeholder",
    isPlaceholder: Boolean(deck.isPlaceholder),
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
  return {
    cardId: card.cardId || createId("simcard"),
    name: card.name || "Simulation Card Placeholder",
    manaCost: card.manaCost || "",
    manaValue: Number.isFinite(Number(card.manaValue)) ? Number(card.manaValue) : inferManaValue(card.manaCost || ""),
    typeLine: card.typeLine || "Permanent",
    power: Number.isFinite(Number(card.power)) ? Number(card.power) : 0,
    toughness: Number.isFinite(Number(card.toughness)) ? Number(card.toughness) : 0,
    oracleText: card.oracleText || "",
    keywords: Array.isArray(card.keywords) ? card.keywords : [],
    role: card.role || "",
    quantity: 1,
    owner: ownerId,
    controller: ownerId,
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

