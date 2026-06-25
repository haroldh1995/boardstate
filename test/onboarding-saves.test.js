import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultProfile, createPermanent } from "../src/state/schema.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createAction } from "../src/state/actions.js";
import { shouldShowFirstLaunch, TUTORIAL_STEPS } from "../src/onboarding/tutorialSystem.js";
import { buildLocalSave, exportLocalSave, validateLocalSave } from "../src/storage/saveState.js";
import { parseImportedProfile } from "../src/storage/localDatabase.js";

function dispatch(profile, input) {
  return reduceProfile(profile, createAction(input, profile));
}

test("first-launch onboarding shows only for fresh profiles and can be skipped", () => {
  let profile = createDefaultProfile();
  assert.equal(shouldShowFirstLaunch(profile.onboarding), true);

  profile = dispatch(profile, { type: "ONBOARDING_EXPLORE" });
  assert.equal(profile.onboarding.firstLaunchComplete, true);
  assert.equal(profile.onboarding.tutorialSkipped, true);
  assert.equal(shouldShowFirstLaunch(profile.onboarding), false);

  const migrated = parseImportedProfile(JSON.stringify({ player: { name: "Returning Player" } }));
  assert.equal(migrated.onboarding.firstLaunchComplete, true);
  assert.equal(shouldShowFirstLaunch(migrated.onboarding), false);
});

test("guided tutorial starts deterministic five-turn practice and autosaves", () => {
  let profile = dispatch(createDefaultProfile(), { type: "TUTORIAL_START" });
  assert.equal(profile.onboarding.tutorialStarted, true);
  assert.equal(profile.settings.helperSprite.enabled, true);
  assert.equal(profile.activeSession.tutorial.active, true);
  assert.equal(profile.activeSession.tutorial.totalSteps, TUTORIAL_STEPS.length);
  assert.equal(profile.activeSession.life, 40);
  assert.ok(profile.activeSession.zones.hand.some((card) => card.name === "Spark Cub"));
  assert.equal(profile.localSaves.items.length, 1);
  assert.equal(validateLocalSave(profile.localSaves.items[0]).valid, true);

  for (let index = 1; index < TUTORIAL_STEPS.length; index += 1) {
    profile = dispatch(profile, { type: "TUTORIAL_ADVANCE" });
  }

  assert.equal(profile.activeSession.tutorial.completionPending, true);
  assert.equal(profile.onboarding.tutorialCompleted, true);
  assert.equal(profile.onboarding.tutorialCurrentTurn, 5);
  assert.ok(profile.activeSession.battlefield.player.some((card) => card.name === "Insect Token"));
  assert.equal(profile.localSaves.items.length, 1);
});

test("tutorial can pause, resume, save, complete, and transition to free play", () => {
  let profile = dispatch(createDefaultProfile(), { type: "TUTORIAL_START" });
  profile = dispatch(profile, { type: "TUTORIAL_ADVANCE" });
  profile = dispatch(profile, { type: "TUTORIAL_PAUSE" });
  assert.equal(profile.activeSession.tutorial.status, "paused");
  assert.equal(profile.onboarding.tutorialPaused, true);
  const saveId = profile.localSaves.activeSaveId;
  assert.ok(saveId);

  profile = dispatch(profile, { type: "TUTORIAL_RESUME" });
  assert.equal(profile.activeSession.tutorial.status, "active");
  assert.equal(profile.onboarding.tutorialPaused, false);

  for (let index = profile.activeSession.tutorial.currentStep + 1; index < TUTORIAL_STEPS.length; index += 1) {
    profile = dispatch(profile, { type: "TUTORIAL_ADVANCE" });
  }
  profile = dispatch(profile, { type: "TUTORIAL_COMPLETE_FREE_PLAY" });
  assert.equal(profile.activeSession.tutorial.active, false);
  assert.equal(profile.activeSession.tutorial.status, "free-play");
  assert.equal(profile.activeSession.gameTracking.mode, "tutorial-free-play");
});

test("profile-bound local saves restore battlefield, turn, phase, stack, and tutorial data", () => {
  const bear = createPermanent({
    id: "save-bear",
    name: "Save Bear",
    typeLine: "Creature - Bear",
    basePower: 2,
    baseToughness: 2,
  });
  let profile = createDefaultProfile();
  profile = {
    ...profile,
    player: { ...profile.player, id: "profile-a", name: "Saver" },
    localAuth: { mode: "protected", locked: false, hasPassword: true },
    activeSession: {
      ...profile.activeSession,
      turn: 3,
      phaseIndex: 2,
      life: 27,
      stack: [{ id: "stack-1", name: "Saved Spell", status: "pending" }],
      battlefield: {
        ...profile.activeSession.battlefield,
        player: [bear],
      },
      tutorial: {
        ...profile.activeSession.tutorial,
        active: true,
        currentStep: 6,
        currentTurn: 2,
      },
    },
  };

  profile = dispatch(profile, { type: "LOCAL_SAVE_CURRENT", saveName: "Profile A Save" });
  const saveId = profile.localSaves.activeSaveId;
  assert.equal(profile.localSaves.items[0].profileId, "profile-a");
  assert.equal(profile.localSaves.items[0].profileName, "Saver");

  profile = {
    ...profile,
    activeSession: {
      ...profile.activeSession,
      turn: 9,
      phaseIndex: 4,
      life: 5,
      stack: [],
      battlefield: { ...profile.activeSession.battlefield, player: [] },
    },
  };
  profile = dispatch(profile, { type: "LOCAL_SAVE_LOAD", saveId });
  assert.equal(profile.activeSession.turn, 3);
  assert.equal(profile.activeSession.phaseIndex, 2);
  assert.equal(profile.activeSession.life, 27);
  assert.equal(profile.activeSession.stack[0].name, "Saved Spell");
  assert.equal(profile.activeSession.battlefield.player[0].name, "Save Bear");
  assert.equal(profile.activeSession.tutorial.currentStep, 6);
});

test("local save export excludes plaintext password data and malformed saves fail safely", () => {
  let profile = createDefaultProfile();
  profile = {
    ...profile,
    localAuth: { mode: "protected", locked: false, hasPassword: true, password: "do-not-store" },
    settings: { ...profile.settings, authToken: "secret-token" },
  };
  const save = buildLocalSave(profile, { saveName: "Safe Export" });
  const exported = exportLocalSave(save);
  assert.doesNotMatch(exported, /do-not-store|secret-token/);
  assert.equal(validateLocalSave(save).valid, true);

  profile = dispatch(profile, { type: "LOCAL_SAVE_IMPORT", save: { saveId: "broken" } });
  assert.match(profile.localSaves.lastError, /missing required game state/i);
});
