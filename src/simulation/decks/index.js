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

