import { createDefaultProfile } from "./schema.js";
import { reduceProfile } from "./gameReducer.js";
import { createPasswordProfile, loadGuestProfile, loadProfile, loginWithPassword, lockProtectedProfile, saveProfile } from "../storage/localDatabase.js";

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
    async createPassword(password) {
      state = await createPasswordProfile(password, state);
      emit();
      await saveProfile(state);
    },
    async login(password) {
      state = await loginWithPassword(password);
      emit();
    },
    async continueGuest() {
      state = await loadGuestProfile();
      emit();
    },
    async lockProfile() {
      state = await lockProtectedProfile();
      emit();
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
