import { createId } from "../state/ids.js";
import { createPermanent, PHASES } from "../state/schema.js";
import { WORLD_SHAPER_PRECON_NAME, expandWorldShaperDeck } from "./worldShaperPrecon.js";

export function createWorldShaperOpponent(name = "Simulated Opponent") {
  const library = expandWorldShaperDeck();
  const battlefieldCard =
    library.find((card) => /\bLand\b/i.test(card.typeLine || "")) ||
    library.find((card) => /\b(Creature|Artifact|Enchantment|Planeswalker)\b/i.test(card.typeLine || ""));
  const battlefield = battlefieldCard
    ? [
        createPermanent({
          ...battlefieldCard,
          id: createId("simperm"),
          owner: "sim-opponent",
          controller: "sim-opponent",
          ownedByCommanderDeck: true,
        }),
      ]
    : [];

  return {
    id: "sim-opponent",
    name,
    deckName: WORLD_SHAPER_PRECON_NAME,
    life: 40,
    commanderDamage: {},
    currentPhase: PHASES[0],
    phaseIndex: 0,
    battlefield,
    zones: {
      library,
      hand: [],
      battlefield,
      graveyard: [],
      exile: [],
    },
    publicBoardSnapshot: createPublicBoardSnapshot({ name, life: 40, phaseIndex: 0, battlefield }),
    actionQueue: [],
    legalActions: [],
    placeholders: {
      drawStepReady: true,
      landPlayReady: true,
      castPermanentReady: true,
      combatReady: true,
      priorityReady: true,
      legalActionCheckerReady: true,
    },
    updatedAt: Date.now(),
  };
}

export function createPublicBoardSnapshot(opponent) {
  return {
    id: opponent.id || "sim-opponent",
    name: opponent.name || "Simulated Opponent",
    life: opponent.life ?? 40,
    currentPhase: PHASES[opponent.phaseIndex || 0] || PHASES[0],
    battlefield: (opponent.battlefield || []).map((permanent) => ({
      id: permanent.id,
      name: permanent.name,
      typeLine: permanent.typeLine,
      tapped: permanent.tapped,
      quantity: permanent.quantity,
      counters: permanent.counters,
    })),
    updatedAt: Date.now(),
  };
}

export function prepareSimulatedDrawStep(opponent) {
  return {
    ...opponent,
    actionQueue: [...(opponent.actionQueue || []), { type: "sim-draw-placeholder", at: Date.now() }],
  };
}

export function prepareSimulatedLandPlay(opponent) {
  return {
    ...opponent,
    actionQueue: [...(opponent.actionQueue || []), { type: "sim-land-play-placeholder", at: Date.now() }],
  };
}

export function prepareSimulatedCastPermanent(opponent) {
  return {
    ...opponent,
    actionQueue: [...(opponent.actionQueue || []), { type: "sim-cast-permanent-placeholder", at: Date.now() }],
  };
}

export function prepareSimulatedCombat(opponent) {
  return {
    ...opponent,
    actionQueue: [...(opponent.actionQueue || []), { type: "sim-combat-placeholder", at: Date.now() }],
  };
}

export function prepareSimulatedPriority(opponent) {
  return {
    ...opponent,
    actionQueue: [...(opponent.actionQueue || []), { type: "sim-priority-placeholder", at: Date.now() }],
  };
}

export function prepareSimulatedLegalActionCheck(opponent) {
  return {
    ...opponent,
    legalActions: ["draw-step-placeholder", "land-play-placeholder", "cast-permanent-placeholder", "combat-placeholder"],
  };
}
