import { alphaDeck } from "./alphaDeck.js";
import { betaDeck } from "./betaDeck.js";
import { omegaDeck } from "./omegaDeck.js";

export const SIM_OPPONENT_IDS = ["alpha", "beta", "omega"];

export const simulationDecks = {
  alpha: alphaDeck,
  beta: betaDeck,
  omega: omegaDeck,
};

export function getSimulationDeckById(id) {
  return simulationDecks[id] || null;
}

export function getDeckMainboardCount(deck) {
  return (deck?.cards || []).reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);
}

export function summarizeDeckIntegrity(deck) {
  const cards = deck?.cards || [];
  const unresolved = cards.filter((entry) => entry.unresolvedDefinition).map((entry) => ({
    name: entry.name,
    quantity: entry.quantity || 1,
  }));
  return {
    mainboardCount: getDeckMainboardCount(deck),
    unresolved,
  };
}
