import { createDefaultProfile } from "./schema.js";
import { reduceProfile } from "./gameReducer.js";
import { loadProfile, saveProfile } from "../storage/localDatabase.js";

export function createStore() {
  let state = createDefaultProfile();
  const listeners = new Set();

  return {
    async init() {
      state = await loadProfile();
      emit();
    },
    getState() {
      return state;
    },
    async dispatch(event) {
      state = reduceProfile(state, event);
      emit();
      await saveProfile(state);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  function emit() {
    listeners.forEach((listener) => listener(state));
  }
}
