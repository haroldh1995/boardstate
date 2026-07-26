import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultProfile, createPermanent } from "../src/state/schema.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createAction } from "../src/state/actions.js";
import {
  ONBOARDING_EXPERIENCE_VERSION,
  ONBOARDING_TOKEN_IDS,
  createAdaptiveLearningState,
  createHelpLearningCatalog,
  createLearningDebugSnapshot,
  createOnboardingState,
  createOnboardingTokenSet,
  selectAdaptiveGuidance,
} from "../src/onboarding/tutorialSystem.js";
import { createSharedPreferenceSnapshot } from "../src/ecosystem/ecosystemIntegration.js";
import { parseImportedProfile } from "../src/storage/localDatabase.js";

function dispatch(profile, input) {
  return reduceProfile(profile, createAction(input, profile));
}

test("onboarding tokens and adaptive state are versioned and profile-scoped", () => {
  const onboarding = createOnboardingState();
  const tokenSet = createOnboardingTokenSet();
  assert.equal(onboarding.experienceVersion, ONBOARDING_EXPERIENCE_VERSION);
  assert.equal(tokenSet.version, ONBOARDING_EXPERIENCE_VERSION);
  assert.equal(onboarding.adaptiveLearning.version, ONBOARDING_EXPERIENCE_VERSION);
  assert.equal(onboarding.adaptiveLearning.enabled, true);
  assert.equal(onboarding.adaptiveLearning.confidence, "new");
});

test("fresh users receive adaptive battlefield guidance after direct entry while returning imports stay quiet", () => {
  let profile = createDefaultProfile();
  profile = dispatch(profile, { type: "ONBOARDING_EXPLORE" });
  assert.equal(profile.settings.helperSprite.enabled, true);
  assert.equal(profile.onboarding.adaptiveLearning.enabled, true);

  const guidance = selectAdaptiveGuidance(profile, { page: "battlefield", force: true });
  assert.equal(guidance.source, "adaptive-learning");
  assert.equal(guidance.tokenId, ONBOARDING_TOKEN_IDS.commandHand);

  const returning = parseImportedProfile(JSON.stringify({ player: { name: "Returning Player" } }));
  assert.equal(returning.onboarding.firstLaunchComplete, true);
  assert.equal(returning.settings.helperSprite.enabled, false);
  assert.equal(selectAdaptiveGuidance(returning, { page: "battlefield", force: true }), null);
});

test("learning hints are teach-once and interaction records reduce future guidance", () => {
  let profile = dispatch(createDefaultProfile(), { type: "ONBOARDING_EXPLORE" });
  const firstHint = selectAdaptiveGuidance(profile, { page: "battlefield", force: true });
  assert.equal(firstHint.tokenId, ONBOARDING_TOKEN_IDS.commandHand);

  profile = dispatch(profile, { type: "HELPER_DISMISS_MESSAGE", messageKey: firstHint.key });
  assert.notEqual(selectAdaptiveGuidance(profile, { page: "battlefield", force: true })?.tokenId, ONBOARDING_TOKEN_IDS.commandHand);

  profile = dispatch(profile, {
    type: "LEARNING_RECORD_INTERACTION",
    interactionType: "command-deck-rotate",
    featureId: "commandHand",
  });
  assert.ok(profile.onboarding.adaptiveLearning.proficiencyScore > 0);
  assert.equal(profile.onboarding.adaptiveLearning.featureDiscovery.commandHand.completed, true);
});

test("help catalog, shared preferences, and debug snapshot expose safe learning metadata", () => {
  let profile = createDefaultProfile();
  profile = dispatch(profile, {
    type: "LEARNING_RECORD_INTERACTION",
    interactionType: "help-center-open",
    featureId: "helpCenter",
    topicId: "getting-started",
  });

  const catalog = createHelpLearningCatalog(profile);
  assert.equal(catalog.version, ONBOARDING_EXPERIENCE_VERSION);
  assert.ok(catalog.topics.some((topic) => topic.id === "command-deck"));

  const preferences = createSharedPreferenceSnapshot(profile);
  assert.equal(preferences.learning.onboardingExperienceVersion, ONBOARDING_EXPERIENCE_VERSION);
  assert.equal(preferences.learning.completedCount, profile.onboarding.adaptiveLearning.completedSteps.length);

  const debug = createLearningDebugSnapshot(profile);
  assert.equal(debug.productionHidden, true);
  assert.equal(debug.version, ONBOARDING_EXPERIENCE_VERSION);
});

test("adaptive guidance responds to selection and undo without mutating gameplay state", () => {
  const permanent = createPermanent({
    id: "learning-bear",
    name: "Learning Bear",
    typeLine: "Creature - Bear",
    basePower: 2,
    baseToughness: 2,
  });
  let profile = dispatch(createDefaultProfile(), { type: "ONBOARDING_EXPLORE" });
  profile = {
    ...profile,
    activeSession: {
      ...profile.activeSession,
      selectedIds: [permanent.id],
      undoStack: [{ reason: "TEST", snapshot: profile.activeSession }],
      battlefield: {
        ...profile.activeSession.battlefield,
        player: [permanent],
      },
    },
  };
  profile = dispatch(profile, {
    type: "LEARNING_RECORD_INTERACTION",
    interactionType: "command-deck-rotate",
    featureId: "commandHand",
  });
  profile = dispatch(profile, {
    type: "LEARNING_RECORD_INTERACTION",
    interactionType: "permanent-select",
    featureId: "firstPermanent",
  });

  const guidance = selectAdaptiveGuidance(profile, { page: "battlefield", force: true });
  assert.equal(guidance.tokenId, ONBOARDING_TOKEN_IDS.selectedCard);
  assert.equal(profile.activeSession.battlefield.player[0].name, "Learning Bear");
});

test("adaptive learning can be disabled and reset independently from gameplay", () => {
  let profile = dispatch(createDefaultProfile(), { type: "ONBOARDING_DO_NOT_SHOW" });
  assert.equal(profile.onboarding.adaptiveLearning.enabled, false);
  assert.equal(selectAdaptiveGuidance(profile, { page: "battlefield", force: true }), null);

  profile = dispatch(profile, {
    type: "LEARNING_RECORD_INTERACTION",
    interactionType: "search-query",
    featureId: "search",
  });
  assert.ok(profile.onboarding.adaptiveLearning.proficiencyScore > 0);

  profile = dispatch(profile, { type: "LEARNING_RESET" });
  const learning = createAdaptiveLearningState(profile.onboarding.adaptiveLearning);
  assert.equal(learning.proficiencyScore, 0);
  assert.equal(learning.resetCount, 1);
});
