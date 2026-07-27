import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createDefaultProfile, createPermanent } from "../src/state/schema.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createAction } from "../src/state/actions.js";
import {
  ASSISTANCE_PRIORITY_LEVELS,
  ASSISTANCE_TOKEN_IDS,
  CONTEXTUAL_ASSISTANCE_VERSION,
  createAssistanceCenterModel,
  createAssistanceDebugSnapshot,
  createAssistanceTokenSet,
  createContextualAssistanceState,
  createOnboardingState,
  selectContextualAssistance,
} from "../src/onboarding/tutorialSystem.js";
import { createSharedPreferenceSnapshot } from "../src/ecosystem/ecosystemIntegration.js";

function dispatch(profile, input) {
  return reduceProfile(profile, createAction(input, profile));
}

function assistanceReadyProfile() {
  const profile = createDefaultProfile();
  return {
    ...profile,
    settings: {
      ...(profile.settings || {}),
      helperSprite: { ...(profile.settings?.helperSprite || {}), enabled: true },
    },
    onboarding: {
      ...createOnboardingState(profile.onboarding),
      firstLaunchComplete: true,
      tutorialSkipped: true,
      contextualAssistance: createContextualAssistanceState({}),
      adaptiveLearning: {
        ...profile.onboarding.adaptiveLearning,
        proficiencyScore: 50,
        confidence: "comfortable",
      },
    },
  };
}

test("contextual assistance tokens and state are versioned and profile-scoped", () => {
  const onboarding = createOnboardingState();
  const tokenSet = createAssistanceTokenSet();
  const state = createContextualAssistanceState();

  assert.equal(tokenSet.version, CONTEXTUAL_ASSISTANCE_VERSION);
  assert.equal(state.version, CONTEXTUAL_ASSISTANCE_VERSION);
  assert.equal(onboarding.contextualAssistance.version, CONTEXTUAL_ASSISTANCE_VERSION);
  assert.equal(tokenSet.suggestionCard.id, ASSISTANCE_TOKEN_IDS.suggestionCard);
  assert.deepEqual(Object.values(ASSISTANCE_PRIORITY_LEVELS), ["critical", "important", "helpful", "educational", "optional", "decorative"]);
});

test("assistance chooses the highest useful opportunity and suppresses during bad timing", () => {
  const profile = {
    ...assistanceReadyProfile(),
    activeSession: {
      ...assistanceReadyProfile().activeSession,
      stack: [{ id: "spell-1" }, { id: "spell-2" }],
      triggerQueue: [
        { id: "trigger-1", status: "pending" },
        { id: "trigger-2", status: "pending" },
      ],
      undoStack: [
        { reason: "one", snapshot: {} },
        { reason: "two", snapshot: {} },
        { reason: "three", snapshot: {} },
      ],
    },
  };

  const assistance = selectContextualAssistance(profile, { page: "battlefield", force: true });
  assert.equal(assistance.source, "contextual-assistance");
  assert.equal(assistance.opportunityId, "stack-chain-review");
  assert.equal(assistance.priority, ASSISTANCE_PRIORITY_LEVELS.important);

  assert.equal(selectContextualAssistance(profile, { page: "battlefield", combatResolving: true }), null);
  assert.equal(selectContextualAssistance(profile, { page: "battlefield", keepSearchInputFocus: true }), null);
});

test("dismissed and accepted suggestions are remembered without mutating gameplay", () => {
  const permanent = createPermanent({ id: "assist-bear", name: "Assist Bear", typeLine: "Creature - Bear" });
  let profile = {
    ...assistanceReadyProfile(),
    activeSession: {
      ...assistanceReadyProfile().activeSession,
      selectedIds: [permanent.id],
      battlefield: {
        ...assistanceReadyProfile().activeSession.battlefield,
        player: [permanent],
      },
    },
  };

  const suggestion = selectContextualAssistance(profile, { page: "battlefield", force: true });
  assert.equal(suggestion.opportunityId, "selection-inspector");

  profile = dispatch(profile, { type: "HELPER_MARK_SHOWN", messageKey: suggestion.key });
  profile = dispatch(profile, { type: "HELPER_DISMISS_MESSAGE", messageKey: suggestion.key });
  assert.equal(profile.onboarding.contextualAssistance.shownSuggestions[0].id, "selection-inspector");
  assert.equal(profile.onboarding.contextualAssistance.dismissedSuggestions[0].id, "selection-inspector");
  assert.equal(selectContextualAssistance(profile, { page: "battlefield" }), null);
  assert.equal(profile.activeSession.battlefield.player[0].name, "Assist Bear");

  profile = dispatch(profile, { type: "ASSISTANCE_RESET" });
  assert.equal(profile.onboarding.contextualAssistance.resetCount, 1);
});

test("workflow signals, shared preferences, and debug snapshots expose safe assistance metadata", () => {
  let profile = assistanceReadyProfile();
  profile = dispatch(profile, {
    type: "ASSISTANCE_RECORD_INTERACTION",
    interactionType: "search-query",
    workflowId: "search",
  });
  profile = dispatch(profile, {
    type: "ASSISTANCE_ACCEPT_SUGGESTION",
    suggestionId: "assistance:search-workflow:search",
  });

  const model = createAssistanceCenterModel(profile);
  assert.equal(model.version, CONTEXTUAL_ASSISTANCE_VERSION);
  assert.equal(model.acceptedCount, 1);

  const preferences = createSharedPreferenceSnapshot(profile);
  assert.equal(preferences.learning.contextualAssistanceVersion, CONTEXTUAL_ASSISTANCE_VERSION);
  assert.equal(preferences.learning.assistanceAcceptedCount, 1);
  assert.equal(preferences.assistance.contextualAssistance, true);

  const debug = createAssistanceDebugSnapshot(profile, { page: "battlefield" });
  assert.equal(debug.productionHidden, true);
  assert.equal(debug.version, CONTEXTUAL_ASSISTANCE_VERSION);
});

test("runtime and documentation expose contextual assistance without production debug leakage", () => {
  const render = readFileSync(new URL("../src/ui/render.js", import.meta.url), "utf8");
  const docs = readFileSync(new URL("../docs/ecosystem/README.md", import.meta.url), "utf8");

  assert.match(render, /CONTEXTUAL_ASSISTANCE_VERSION/);
  assert.match(render, /document\.body\.dataset\.contextualAssistanceVersion/);
  assert.match(render, /function renderAssistanceDebugOverlay/);
  assert.match(render, /boardstate-assistance-debug/);
  assert.match(render, /source === "contextual-assistance"/);
  assert.match(docs, /CONTEXTUAL_ASSISTANCE_SYSTEM\.md/);
});
