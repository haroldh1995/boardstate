import { createGameSession, createManaPool, createPermanent } from "../state/schema.js";
import { createId, clone } from "../state/ids.js";

export const TUTORIAL_VERSION = "five-turn-v1";
export const ONBOARDING_EXPERIENCE_VERSION = "boardstate-adaptive-learning-0.1.0";
export const CONTEXTUAL_ASSISTANCE_VERSION = "boardstate-contextual-assistance-0.1.0";

export const ONBOARDING_TOKEN_IDS = Object.freeze({
  welcomeChoice: "welcome-choice",
  commandHand: "command-hand-first-touch",
  battlefieldFirstUse: "battlefield-first-use",
  firstPermanent: "first-permanent",
  firstUndo: "first-undo",
  searchDiscovery: "search-discovery",
  selectedCard: "selected-card",
  stackReview: "stack-review",
  commanderTools: "commander-tools",
  reminders: "reminders",
  helpCenter: "help-center",
  accessibility: "accessibility",
});

export const LEARNING_HINT_PRIORITIES = Object.freeze({
  critical: "critical",
  contextual: "contextual",
  gentle: "gentle",
  reference: "reference",
});

export const ASSISTANCE_PRIORITY_LEVELS = Object.freeze({
  critical: "critical",
  important: "important",
  helpful: "helpful",
  educational: "educational",
  optional: "optional",
  decorative: "decorative",
});

export const ASSISTANCE_TOKEN_IDS = Object.freeze({
  suggestionCard: "assistance-suggestion-card",
  reminder: "assistance-reminder",
  quickTip: "assistance-quick-tip",
  coachMark: "assistance-coach-mark",
  workflowRecommendation: "assistance-workflow-recommendation",
  priorityLevel: "assistance-priority-level",
  dismissStyle: "assistance-dismiss-style",
  persistence: "assistance-persistence",
  pauseTiming: "assistance-pause-timing",
  featureDiscovery: "assistance-feature-discovery",
});

const ASSISTANCE_PRIORITY_WEIGHT = Object.freeze({
  [ASSISTANCE_PRIORITY_LEVELS.critical]: 100,
  [ASSISTANCE_PRIORITY_LEVELS.important]: 80,
  [ASSISTANCE_PRIORITY_LEVELS.helpful]: 60,
  [ASSISTANCE_PRIORITY_LEVELS.educational]: 40,
  [ASSISTANCE_PRIORITY_LEVELS.optional]: 20,
  [ASSISTANCE_PRIORITY_LEVELS.decorative]: 5,
});

const ASSISTANCE_COOLDOWN_MS = Object.freeze({
  [ASSISTANCE_PRIORITY_LEVELS.critical]: 0,
  [ASSISTANCE_PRIORITY_LEVELS.important]: 45000,
  [ASSISTANCE_PRIORITY_LEVELS.helpful]: 90000,
  [ASSISTANCE_PRIORITY_LEVELS.educational]: 180000,
  [ASSISTANCE_PRIORITY_LEVELS.optional]: 240000,
  [ASSISTANCE_PRIORITY_LEVELS.decorative]: 360000,
});

export function createOnboardingTokenSet(source = {}) {
  const tokenOverrides = source.tokens || {};
  return {
    version: ONBOARDING_EXPERIENCE_VERSION,
    dismissBehavior: source.dismissBehavior || "teach-once",
    tooltip: {
      material: "polished-glass",
      tone: "gentle",
      maxWords: 28,
      allowBlocking: false,
      ...(tokenOverrides.tooltip || {}),
    },
    coachMark: {
      material: "magical-crystal",
      tone: "contextual",
      obscureGameplay: false,
      ...(tokenOverrides.coachMark || {}),
    },
    highlight: {
      glow: "gold-subtle",
      motionToken: "gentle-emphasis",
      reducedMotionFallback: "outline",
      ...(tokenOverrides.highlight || {}),
    },
    learningCard: {
      material: "premium-card-stock",
      elevation: "contextual",
      size: "compact",
      ...(tokenOverrides.learningCard || {}),
    },
    featureIntroduction: {
      priority: LEARNING_HINT_PRIORITIES.gentle,
      repeatPolicy: "once-unless-reset",
      ...(tokenOverrides.featureIntroduction || {}),
    },
    persistence: {
      profileScoped: true,
      futureHubSync: true,
      resettable: true,
      ...(tokenOverrides.persistence || {}),
    },
  };
}

export function createAssistanceTokenSet(source = {}) {
  const tokenOverrides = source.tokens || source || {};
  return {
    version: CONTEXTUAL_ASSISTANCE_VERSION,
    suggestionCard: {
      id: ASSISTANCE_TOKEN_IDS.suggestionCard,
      material: "polished-glass",
      tone: "respectful",
      maxWords: 24,
      allowBlocking: false,
      stealFocus: false,
      obscureGameplay: false,
      ...(tokenOverrides.suggestionCard || {}),
    },
    reminder: {
      id: ASSISTANCE_TOKEN_IDS.reminder,
      priority: ASSISTANCE_PRIORITY_LEVELS.helpful,
      repeatPolicy: "only-when-context-changes",
      ...(tokenOverrides.reminder || {}),
    },
    quickTip: {
      id: ASSISTANCE_TOKEN_IDS.quickTip,
      priority: ASSISTANCE_PRIORITY_LEVELS.educational,
      dismissible: true,
      ...(tokenOverrides.quickTip || {}),
    },
    coachMark: {
      id: ASSISTANCE_TOKEN_IDS.coachMark,
      priority: ASSISTANCE_PRIORITY_LEVELS.educational,
      reducedMotionFallback: "static-highlight",
      ...(tokenOverrides.coachMark || {}),
    },
    workflowRecommendation: {
      id: ASSISTANCE_TOKEN_IDS.workflowRecommendation,
      priority: ASSISTANCE_PRIORITY_LEVELS.helpful,
      automaticAction: false,
      requiresPlayerChoice: true,
      ...(tokenOverrides.workflowRecommendation || {}),
    },
    priorityLevel: {
      id: ASSISTANCE_TOKEN_IDS.priorityLevel,
      levels: Object.values(ASSISTANCE_PRIORITY_LEVELS),
      onlyHighestVisible: true,
      ...(tokenOverrides.priorityLevel || {}),
    },
    dismissStyle: {
      id: ASSISTANCE_TOKEN_IDS.dismissStyle,
      behavior: "remember-and-respect",
      resettable: true,
      ...(tokenOverrides.dismissStyle || {}),
    },
    persistence: {
      id: ASSISTANCE_TOKEN_IDS.persistence,
      profileScoped: true,
      futureHubSync: true,
      gameplayAuthoritative: false,
      ...(tokenOverrides.persistence || {}),
    },
    pauseTiming: {
      id: ASSISTANCE_TOKEN_IDS.pauseTiming,
      waitForNaturalPause: true,
      suppressDuringAnimation: true,
      suppressDuringCombatResolution: true,
      suppressDuringRapidInput: true,
      suppressDuringSearchTyping: true,
      ...(tokenOverrides.pauseTiming || {}),
    },
    featureDiscovery: {
      id: ASSISTANCE_TOKEN_IDS.featureDiscovery,
      progressive: true,
      veteranQuietMode: true,
      ...(tokenOverrides.featureDiscovery || {}),
    },
  };
}

export const TUTORIAL_STEPS = [
  {
    id: "welcome-life",
    turn: 1,
    title: "Starting Life",
    feature: "Life Tracker",
    prompt: "Start at 40 life for this Commander practice game. BoardState keeps the life total visible while you play the real table.",
    actionLabel: "Show phases",
  },
  {
    id: "turn-order-phases",
    turn: 1,
    title: "Turn Order and Phases",
    feature: "Next Phase",
    prompt: "A turn moves through beginning, main, combat, second main, and ending. Use Next Phase when the table moves on.",
    actionLabel: "Play first land",
  },
  {
    id: "turn1-play-land",
    turn: 1,
    title: "Play One Land",
    feature: "Land controls",
    prompt: "Most turns let you play one land. Lands go in the resource lane and usually tap for mana.",
    actionLabel: "Tap Plains",
  },
  {
    id: "turn1-tap-land",
    turn: 1,
    title: "Tap for Mana",
    feature: "Mana pool",
    prompt: "A Plains taps for white mana. BoardState rotates the land and adds the mana to the pool.",
    actionLabel: "End turn 1",
  },
  {
    id: "turn1-end",
    turn: 1,
    title: "End Step",
    feature: "Opponent turn",
    prompt: "You are done for the turn. The practice opponent takes a simple turn without asking you to make its choices.",
    actionLabel: "Begin turn 2",
  },
  {
    id: "turn2-draw-land",
    turn: 2,
    title: "Draw and Land",
    feature: "Opening hand",
    prompt: "Draw a card, then play a second land. More lands let you pay larger mana costs.",
    actionLabel: "Cast creature",
  },
  {
    id: "turn2-cast-creature",
    turn: 2,
    title: "Cast a Creature",
    feature: "Cast flow",
    prompt: "Choose Cast from Hand. During active games, BoardState can auto-tap legal lands for the mana cost.",
    actionLabel: "Resolve creature",
  },
  {
    id: "turn2-stack-resolution",
    turn: 2,
    title: "The Stack",
    feature: "Stack Review",
    prompt: "Spells use the stack before resolving. The opponent passes priority, then your creature enters the battlefield.",
    actionLabel: "Learn summoning sickness",
  },
  {
    id: "turn2-summoning-sickness",
    turn: 2,
    title: "Summoning Sickness",
    feature: "Creature area",
    prompt: "A creature normally cannot attack or use tap abilities the turn it comes under your control.",
    actionLabel: "Begin turn 3",
  },
  {
    id: "turn3-noncreature",
    turn: 3,
    title: "Non-Creature Permanents",
    feature: "Permanent menu",
    prompt: "Artifacts and enchantments resolve into the support area. Tap a non-creature permanent to open its action menu.",
    actionLabel: "Add counter",
  },
  {
    id: "turn3-trigger",
    turn: 3,
    title: "Triggered Abilities",
    feature: "Trigger Queue",
    prompt: "When, whenever, and at usually mean a triggered ability. BoardState queues the trigger so you can review it.",
    actionLabel: "Resolve trigger",
  },
  {
    id: "turn3-end",
    turn: 3,
    title: "Review the Board",
    feature: "Board review",
    prompt: "Creatures, lands, and non-creature permanents stay visually separated so crowded boards remain readable.",
    actionLabel: "Begin combat turn",
  },
  {
    id: "turn4-attackers",
    turn: 4,
    title: "Declare Attackers",
    feature: "Attackers",
    prompt: "Move to combat, choose an eligible attacker, and choose what it attacks.",
    actionLabel: "Declare blocker",
  },
  {
    id: "turn4-blockers",
    turn: 4,
    title: "Declare Blockers",
    feature: "Blocker popup",
    prompt: "The defender chooses blockers. Simulated opponents handle their own blocks; you only make your own choices.",
    actionLabel: "Resolve damage",
  },
  {
    id: "turn4-damage",
    turn: 4,
    title: "Combat Damage",
    feature: "Combat log",
    prompt: "Unblocked damage changes life totals. Blocked creatures deal damage to each other and may go to the graveyard.",
    actionLabel: "Begin turn 5",
  },
  {
    id: "turn5-landfall",
    turn: 5,
    title: "Landfall",
    feature: "Landfall trigger",
    prompt: "Landfall triggers whenever a land enters under your control. This practice land creates a token.",
    actionLabel: "Create token",
  },
  {
    id: "turn5-stats",
    turn: 5,
    title: "Inspect and Save",
    feature: "Stats Overlay",
    prompt: "Toggle Stats Overlay when you want visible counters, damage, loyalty, and power/toughness, then save the game.",
    actionLabel: "Save tutorial",
  },
  {
    id: "tutorial-complete",
    turn: 5,
    title: "Free Play",
    feature: "Free-play transition",
    prompt: "The five guided turns are complete. Continue freely, finish the practice game, start a new simulation, create a profile, or load another save.",
    actionLabel: "Complete tutorial",
  },
];

export function createOnboardingState(source = {}) {
  const now = Date.now();
  return {
    experienceVersion: source.experienceVersion || ONBOARDING_EXPERIENCE_VERSION,
    firstLaunchComplete: Boolean(source.firstLaunchComplete),
    tutorialOffered: Boolean(source.tutorialOffered),
    tutorialStarted: Boolean(source.tutorialStarted),
    tutorialCompleted: Boolean(source.tutorialCompleted),
    tutorialSkipped: Boolean(source.tutorialSkipped),
    tutorialVersion: source.tutorialVersion || TUTORIAL_VERSION,
    tutorialCurrentTurn: Number(source.tutorialCurrentTurn || 0),
    tutorialCurrentStep: Number(source.tutorialCurrentStep || 0),
    tutorialPaused: Boolean(source.tutorialPaused),
    tutorialSaveId: source.tutorialSaveId || "",
    helperSpriteEnabled: source.helperSpriteEnabled === true,
    screenReaderPromptsEnabled: Boolean(source.screenReaderPromptsEnabled),
    tutorialReducedMotion: Boolean(source.tutorialReducedMotion),
    helpCenterOpened: Boolean(source.helpCenterOpened),
    lastHelpTopic: source.lastHelpTopic || "",
    onboardingTokens: createOnboardingTokenSet(source.onboardingTokens),
    adaptiveLearning: createAdaptiveLearningState(source.adaptiveLearning || source.learning),
    assistanceTokens: createAssistanceTokenSet(source.assistanceTokens),
    contextualAssistance: createContextualAssistanceState(source.contextualAssistance || source.assistance),
    tutorialLastUpdatedAt: Number(source.tutorialLastUpdatedAt || (source.tutorialStarted ? now : 0)),
  };
}

export function createAdaptiveLearningState(source = {}) {
  const now = Date.now();
  const completedSteps = normalizeStringList(source.completedSteps);
  const dismissedHints = normalizeStringList(source.dismissedHints);
  const proficiencyScore = clampNumber(source.proficiencyScore ?? source.proficiency, 0, 100, inferProficiencyScore(source));
  return {
    version: source.version || ONBOARDING_EXPERIENCE_VERSION,
    enabled: source.enabled !== false,
    mode: source.mode || "adaptive",
    confidence: normalizeLearningConfidence(source.confidence || source.proficiencyLevel || scoreToConfidence(proficiencyScore)),
    proficiencyScore,
    completedSteps,
    dismissedHints,
    featureDiscovery: normalizeFeatureDiscovery(source.featureDiscovery),
    interactionCounts: normalizeCountRecord(source.interactionCounts),
    mistakeCounts: normalizeCountRecord(source.mistakeCounts),
    hesitationSignals: normalizeCountRecord(source.hesitationSignals),
    featureAvoidance: normalizeCountRecord(source.featureAvoidance),
    lastGuidanceAt: Number(source.lastGuidanceAt || 0),
    lastHintId: source.lastHintId || "",
    repeatedSearchCount: Number(source.repeatedSearchCount || 0),
    resetCount: Number(source.resetCount || 0),
    debugEnabled: Boolean(source.debugEnabled),
    updatedAt: Number(source.updatedAt || (source.version ? now : 0)),
  };
}

export function createContextualAssistanceState(source = {}) {
  const now = Date.now();
  return {
    version: source.version || CONTEXTUAL_ASSISTANCE_VERSION,
    enabled: source.enabled !== false,
    mode: source.mode || "respectful",
    acceptedSuggestions: normalizeAssistanceHistory(source.acceptedSuggestions),
    dismissedSuggestions: normalizeAssistanceHistory(source.dismissedSuggestions),
    shownSuggestions: normalizeAssistanceHistory(source.shownSuggestions),
    suppressedSuggestions: normalizeAssistanceHistory(source.suppressedSuggestions),
    interactionCounts: normalizeCountRecord(source.interactionCounts),
    workflowCounts: normalizeCountRecord(source.workflowCounts),
    repeatedActions: normalizeCountRecord(source.repeatedActions),
    familiarFeatures: normalizeCountRecord(source.familiarFeatures),
    ignoredFeatures: normalizeCountRecord(source.ignoredFeatures),
    lastSuggestionAt: Number(source.lastSuggestionAt || 0),
    lastAcceptedAt: Number(source.lastAcceptedAt || 0),
    lastDismissedAt: Number(source.lastDismissedAt || 0),
    lastOpportunityId: source.lastOpportunityId || "",
    quietUntil: Number(source.quietUntil || 0),
    rapidInteractionUntil: Number(source.rapidInteractionUntil || 0),
    resetCount: Number(source.resetCount || 0),
    debugEnabled: Boolean(source.debugEnabled),
    updatedAt: Number(source.updatedAt || (source.version ? now : 0)),
  };
}

export function shouldShowFirstLaunch(onboarding = {}) {
  return !onboarding.firstLaunchComplete && !onboarding.tutorialSkipped && !onboarding.tutorialCompleted;
}

export function getTutorialStep(tutorialState = {}) {
  const index = clampStepIndex(tutorialState.currentStep ?? tutorialState.step ?? 0);
  return TUTORIAL_STEPS[index] || TUTORIAL_STEPS[0];
}

export function getTutorialProgress(tutorialState = {}) {
  const step = getTutorialStep(tutorialState);
  return {
    step,
    index: clampStepIndex(tutorialState.currentStep ?? tutorialState.step ?? 0),
    total: TUTORIAL_STEPS.length,
    percent: Math.round(((clampStepIndex(tutorialState.currentStep ?? tutorialState.step ?? 0) + 1) / TUTORIAL_STEPS.length) * 100),
    completed: Boolean(tutorialState.completionPending || tutorialState.status === "complete"),
  };
}

export function startFiveTurnTutorial(profile, options = {}) {
  const now = Date.now();
  const helperSpriteOptedIn = profile.settings?.helperSprite?.userEnabled === true && profile.settings?.helperSprite?.enabled === true;
  const session = applyTutorialMilestone(createTutorialPracticeSession(profile, now), 0, profile);
  const onboarding = markFeatureDiscovered(
    createOnboardingState(profile.onboarding),
    ONBOARDING_TOKEN_IDS.welcomeChoice,
    now
  );
  return {
    ...profile,
    onboarding: {
      ...onboarding,
      firstLaunchComplete: true,
      tutorialOffered: true,
      tutorialStarted: true,
      tutorialCompleted: false,
      tutorialSkipped: false,
      tutorialVersion: TUTORIAL_VERSION,
      tutorialCurrentTurn: 1,
      tutorialCurrentStep: 0,
      tutorialPaused: false,
      tutorialLastUpdatedAt: now,
    },
    settings: {
      ...(profile.settings || {}),
      helperSprite: {
        ...(profile.settings?.helperSprite || {}),
        enabled: helperSpriteOptedIn,
        screenReaderPrompts: Boolean(options.screenReaderPrompts || profile.settings?.helperSprite?.screenReaderPrompts),
        tutorialNarration: true,
      },
    },
    activeSession: session,
  };
}

export function advanceFiveTurnTutorial(profile, direction = 1) {
  const tutorial = profile.activeSession?.tutorial || {};
  if (!tutorial.active || tutorial.status === "complete") {
    return profile;
  }
  const now = Date.now();
  const nextIndex = clampStepIndex(Number(tutorial.currentStep ?? tutorial.step ?? 0) + Number(direction || 1));
  const step = TUTORIAL_STEPS[nextIndex];
  const completed = step.id === "tutorial-complete" && Number(direction || 1) > 0;
  const nextSession = applyTutorialMilestone(
    {
      ...profile.activeSession,
      tutorial: {
        ...tutorial,
        step: nextIndex,
        currentStep: nextIndex,
        currentStepId: step.id,
        currentTurn: step.turn,
        status: completed ? "complete" : "active",
        paused: false,
        completionPending: completed,
        forcedGuidance: !completed,
        lessonLog: [
          {
            stepId: step.id,
            title: step.title,
            turn: step.turn,
            completedAt: now,
          },
          ...(tutorial.lessonLog || []),
        ].slice(0, 80),
      },
      updatedAt: now,
    },
    nextIndex,
    profile
  );
  return {
    ...profile,
    onboarding: {
      ...recordLearningInteraction({ ...profile, onboarding: createOnboardingState(profile.onboarding) }, {
        interactionType: "tutorial-step",
        featureId: "tutorial",
        stepId: step.id,
        amount: 3,
      }).onboarding,
      firstLaunchComplete: true,
      tutorialOffered: true,
      tutorialStarted: true,
      tutorialCompleted: completed || Boolean(profile.onboarding?.tutorialCompleted),
      tutorialSkipped: false,
      tutorialCurrentTurn: step.turn,
      tutorialCurrentStep: nextIndex,
      tutorialPaused: false,
      tutorialLastUpdatedAt: now,
    },
    activeSession: nextSession,
  };
}

export function pauseTutorial(profile) {
  const now = Date.now();
  return {
    ...profile,
    onboarding: {
      ...createOnboardingState(profile.onboarding),
      tutorialPaused: true,
      tutorialLastUpdatedAt: now,
    },
    activeSession: {
      ...profile.activeSession,
      tutorial: {
        ...(profile.activeSession?.tutorial || {}),
        paused: true,
        status: "paused",
      },
    },
  };
}

export function resumeTutorial(profile) {
  const now = Date.now();
  const helperSpriteOptedIn = profile.settings?.helperSprite?.userEnabled === true && profile.settings?.helperSprite?.enabled === true;
  return {
    ...profile,
    onboarding: {
      ...createOnboardingState(profile.onboarding),
      firstLaunchComplete: true,
      tutorialPaused: false,
      tutorialLastUpdatedAt: now,
    },
    settings: {
      ...(profile.settings || {}),
      helperSprite: {
        ...(profile.settings?.helperSprite || {}),
        enabled: helperSpriteOptedIn,
      },
    },
    activeSession: {
      ...profile.activeSession,
      tutorial: {
        ...(profile.activeSession?.tutorial || {}),
        active: true,
        paused: false,
        status: "active",
      },
    },
  };
}

export function skipTutorial(profile) {
  const now = Date.now();
  return {
    ...profile,
    onboarding: {
      ...createOnboardingState(profile.onboarding),
      firstLaunchComplete: true,
      tutorialOffered: true,
      tutorialStarted: Boolean(profile.onboarding?.tutorialStarted),
      tutorialSkipped: true,
      tutorialPaused: false,
      tutorialLastUpdatedAt: now,
    },
    activeSession: {
      ...profile.activeSession,
      tutorial: {
        ...(profile.activeSession?.tutorial || {}),
        active: false,
        paused: false,
        forcedGuidance: false,
        status: "skipped",
      },
    },
  };
}

export function completeTutorialToFreePlay(profile) {
  const now = Date.now();
  const onboarding = recordLearningInteraction(
    {
      ...profile,
      onboarding: createOnboardingState(profile.onboarding),
    },
    {
      interactionType: "tutorial-complete",
      featureId: "tutorial",
      hintId: ONBOARDING_TOKEN_IDS.welcomeChoice,
      amount: 12,
    }
  ).onboarding;
  return {
    ...profile,
    onboarding: {
      ...onboarding,
      firstLaunchComplete: true,
      tutorialOffered: true,
      tutorialStarted: true,
      tutorialCompleted: true,
      tutorialSkipped: false,
      tutorialPaused: false,
      tutorialCurrentTurn: 5,
      tutorialCurrentStep: TUTORIAL_STEPS.length - 1,
      tutorialLastUpdatedAt: now,
    },
    activeSession: {
      ...profile.activeSession,
      tutorial: {
        ...(profile.activeSession?.tutorial || {}),
        active: false,
        forcedGuidance: false,
        paused: false,
        completionPending: false,
        status: "free-play",
        completedAt: now,
      },
      gameTracking: {
        ...(profile.activeSession?.gameTracking || {}),
        active: true,
        mode: "tutorial-free-play",
      },
    },
  };
}

export function resetOnboardingProgress(profile) {
  return {
    ...profile,
    onboarding: createOnboardingState({}),
    activeSession: {
      ...profile.activeSession,
      tutorial: {
        ...createGameSession().tutorial,
      },
    },
  };
}

export function markOnboardingExplored(profile, options = {}) {
  const now = Date.now();
  const adaptiveEnabled = options.adaptiveLearningEnabled !== false;
  const helperSpriteOptedIn = profile.settings?.helperSprite?.userEnabled === true && profile.settings?.helperSprite?.enabled === true;
  const onboarding = recordLearningInteraction(
    {
      ...profile,
      onboarding: createOnboardingState(profile.onboarding),
    },
    {
      interactionType: options.doNotShowAgain === true && adaptiveEnabled === false ? "onboarding-dismissed" : "onboarding-explore",
      featureId: "firstLaunch",
      hintId: ONBOARDING_TOKEN_IDS.welcomeChoice,
      amount: adaptiveEnabled ? 5 : 2,
    }
  ).onboarding;
  return {
    ...profile,
    onboarding: {
      ...onboarding,
      firstLaunchComplete: true,
      tutorialOffered: true,
      tutorialSkipped: options.doNotShowAgain !== false,
      adaptiveLearning: {
        ...onboarding.adaptiveLearning,
        enabled: adaptiveEnabled,
      },
      tutorialLastUpdatedAt: now,
    },
    settings: {
      ...(profile.settings || {}),
      helperSprite: {
        ...(profile.settings?.helperSprite || {}),
        enabled: helperSpriteOptedIn,
      },
    },
  };
}

export function recordLearningInteraction(profile, event = {}) {
  const now = Date.now();
  const onboarding = createOnboardingState(profile.onboarding);
  const learning = createAdaptiveLearningState(onboarding.adaptiveLearning);
  const interactionType = event.interactionType || event.type || "interaction";
  const featureId = normalizeFeatureId(event.featureId || interactionToFeature(interactionType));
  const hintId = event.hintId || event.stepId || "";
  const hintShownOnly = interactionType === "hint-shown";
  const interactionCounts = incrementRecord(learning.interactionCounts, interactionType, 1);
  const featureDiscovery = hintShownOnly
    ? learning.featureDiscovery
    : {
        ...learning.featureDiscovery,
        [featureId]: markDiscoveryEntry(learning.featureDiscovery[featureId], now, interactionType),
      };
  const completedSteps = hintShownOnly
    ? learning.completedSteps
    : normalizeStringList([
        ...learning.completedSteps,
        featureId,
        hintId,
      ]);
  const amount = Number.isFinite(Number(event.amount)) ? Number(event.amount) : learningAmountFor(interactionType);
  const proficiencyScore = clampNumber(learning.proficiencyScore + amount, 0, 100, learning.proficiencyScore);
  return {
    ...profile,
    onboarding: {
      ...onboarding,
      helpCenterOpened: onboarding.helpCenterOpened || featureId === "helpCenter",
      lastHelpTopic: featureId === "helpCenter" ? event.topicId || onboarding.lastHelpTopic || "" : onboarding.lastHelpTopic,
      adaptiveLearning: {
        ...learning,
        confidence: scoreToConfidence(proficiencyScore),
        proficiencyScore,
        completedSteps,
        featureDiscovery,
        interactionCounts,
        repeatedSearchCount: interactionType === "search-query" ? learning.repeatedSearchCount + 1 : learning.repeatedSearchCount,
        lastHintId: hintId || learning.lastHintId,
        lastGuidanceAt: interactionType === "hint-shown" ? now : learning.lastGuidanceAt,
        updatedAt: now,
      },
    },
  };
}

export function dismissLearningHint(profile, hintId = "") {
  const id = normalizeHintId(hintId);
  if (!id) {
    return profile;
  }
  const now = Date.now();
  const onboarding = createOnboardingState(profile.onboarding);
  const learning = createAdaptiveLearningState(onboarding.adaptiveLearning);
  return {
    ...profile,
    onboarding: {
      ...onboarding,
      adaptiveLearning: {
        ...learning,
        dismissedHints: normalizeStringList([...learning.dismissedHints, id]),
        completedSteps: normalizeStringList([...learning.completedSteps, id]),
        lastHintId: id,
        lastGuidanceAt: now,
        updatedAt: now,
      },
    },
  };
}

export function resetAdaptiveLearning(profile) {
  const onboarding = createOnboardingState(profile.onboarding);
  const previous = createAdaptiveLearningState(onboarding.adaptiveLearning);
  return {
    ...profile,
    onboarding: {
      ...onboarding,
      helpCenterOpened: false,
      lastHelpTopic: "",
      adaptiveLearning: {
        ...createAdaptiveLearningState({}),
        resetCount: previous.resetCount + 1,
        updatedAt: Date.now(),
      },
    },
  };
}

export function selectAdaptiveGuidance(profile = {}, context = {}) {
  const onboarding = createOnboardingState(profile.onboarding);
  const learning = createAdaptiveLearningState(onboarding.adaptiveLearning);
  if (!learning.enabled || profile.settings?.learning?.adaptiveGuidance === false) {
    return null;
  }
  const tutorial = profile.activeSession?.tutorial || {};
  if (tutorial.active || tutorial.completionPending || tutorial.status === "paused") {
    return null;
  }
  const candidates = buildAdaptiveGuidanceCandidates(profile, context, learning);
  const next = candidates.find((candidate) => shouldShowLearningCandidate(candidate, learning, context));
  if (!next) {
    return null;
  }
  const keyScope = next.scope || "global";
  return {
    key: `learning:${next.id}:${keyScope}`,
    source: "adaptive-learning",
    text: next.text,
    title: next.title,
    tokenId: next.tokenId,
    priority: next.priority || LEARNING_HINT_PRIORITIES.gentle,
    dismissBehavior: "teach-once",
    ariaLabel: next.ariaLabel || next.text,
    ttlMs: next.ttlMs || 6400,
  };
}

export function createHelpLearningCatalog(profile = {}) {
  const onboarding = createOnboardingState(profile.onboarding);
  const learning = createAdaptiveLearningState(onboarding.adaptiveLearning);
  const discovered = learning.featureDiscovery || {};
  const topics = [
    {
      id: "getting-started",
      title: "Start Tracking",
      summary: "Use BoardState as a quiet Commander tabletop. Life and phase controls stay visible; deeper tools wait until needed.",
      actions: ["Enter the battlefield", "Use Next Phase when the table moves", "Track only what matters first"],
      tokenId: ONBOARDING_TOKEN_IDS.battlefieldFirstUse,
    },
    {
      id: "command-deck",
      title: "Rotating Command Deck",
      summary: "The bottom Action Hand is a circular deck of decisions. Rotate with swipe, wheel, arrows, Q/E, or controller shoulders.",
      actions: ["Center card is primary", "Pin favorites", "Context cards enter only when legal/relevant"],
      tokenId: ONBOARDING_TOKEN_IDS.commandHand,
    },
    {
      id: "undo-safety",
      title: "Undo And Recovery",
      summary: "Undo is available for reversible actions and uses BoardState's tracked action history instead of guessing.",
      actions: ["Use Undo for recent mistakes", "Saves preserve tutorial and game state", "Recovery messages explain risky imports"],
      tokenId: ONBOARDING_TOKEN_IDS.firstUndo,
    },
    {
      id: "rules-assistant",
      title: "Ask Why",
      summary: "Rules answers are derived from the current session, event history, Oracle text already present, and BoardState confidence metadata.",
      actions: ["Ask what happened", "Inspect stack or selected cards", "Use beginner/intermediate/advanced explanations"],
      tokenId: ONBOARDING_TOKEN_IDS.stackReview,
    },
    {
      id: "accessibility",
      title: "Accessibility",
      summary: "Learning supports screen-reader prompts, reduced motion, quiet guidance, large text, keyboard, mouse, touch, and controller-ready navigation.",
      actions: ["Toggle Helper Sprite", "Enable screen-reader prompts", "Use reduced visual noise"],
      tokenId: ONBOARDING_TOKEN_IDS.accessibility,
    },
  ];
  return {
    version: ONBOARDING_EXPERIENCE_VERSION,
    opened: onboarding.helpCenterOpened,
    proficiency: learning.confidence,
    proficiencyScore: learning.proficiencyScore,
    completedCount: learning.completedSteps.length,
    topics: topics.map((topic) => ({
      ...topic,
      discovered: Boolean(discovered[normalizeFeatureId(topic.tokenId)]?.completed || learning.completedSteps.includes(topic.tokenId)),
    })),
  };
}

export function createLearningDebugSnapshot(profile = {}) {
  const onboarding = createOnboardingState(profile.onboarding);
  const learning = createAdaptiveLearningState(onboarding.adaptiveLearning);
  return {
    version: ONBOARDING_EXPERIENCE_VERSION,
    productionHidden: true,
    enabled: learning.enabled,
    mode: learning.mode,
    confidence: learning.confidence,
    proficiencyScore: learning.proficiencyScore,
    completedSteps: learning.completedSteps,
    pendingOnboarding: shouldShowFirstLaunch(onboarding),
    lastHintId: learning.lastHintId,
    lastGuidanceAt: learning.lastGuidanceAt,
    dismissedHints: learning.dismissedHints,
    featureDiscovery: learning.featureDiscovery,
    hintSuppression: {
      helperDisabled: profile.settings?.helperSprite?.enabled === false,
      adaptiveDisabled: profile.settings?.learning?.adaptiveGuidance === false || learning.enabled === false,
      highProficiency: learning.proficiencyScore >= 80,
    },
  };
}

export function recordAssistanceInteraction(profile, event = {}) {
  const now = Date.now();
  const onboarding = createOnboardingState(profile.onboarding);
  const assistance = createContextualAssistanceState(onboarding.contextualAssistance);
  const interactionType = event.interactionType || event.type || "interaction";
  const suggestionId = normalizeAssistanceId(event.suggestionId || event.messageKey || event.opportunityId || event.assistanceId || interactionType);
  const workflowId = normalizeAssistanceId(event.workflowId || event.featureId || assistanceSuggestionToFeature(suggestionId) || interactionToFeature(interactionType));
  const shown = /shown|displayed|presented/i.test(interactionType);
  const accepted = /accept|opened|used|followed/i.test(interactionType);
  const dismissed = /dismiss|ignored|declined/i.test(interactionType);
  const rapid = Boolean(event.rapid || /rapid|repeat-tap|fast-drag|scroll/i.test(interactionType));
  const quietMs = dismissed ? 300000 : accepted ? 120000 : 0;
  const historyEntry = {
    id: suggestionId,
    at: now,
    context: event.context || event.reason || interactionType,
    priority: event.priority || "",
  };
  return {
    ...profile,
    onboarding: {
      ...onboarding,
      contextualAssistance: {
        ...assistance,
        interactionCounts: incrementRecord(assistance.interactionCounts, interactionType, 1),
        workflowCounts: workflowId ? incrementRecord(assistance.workflowCounts, workflowId, 1) : assistance.workflowCounts,
        repeatedActions: incrementRecord(assistance.repeatedActions, workflowId || interactionType, 1),
        familiarFeatures: accepted && workflowId ? incrementRecord(assistance.familiarFeatures, workflowId, 1) : assistance.familiarFeatures,
        ignoredFeatures: dismissed && workflowId ? incrementRecord(assistance.ignoredFeatures, workflowId, 1) : assistance.ignoredFeatures,
        shownSuggestions: shown ? upsertAssistanceHistory(assistance.shownSuggestions, historyEntry) : assistance.shownSuggestions,
        acceptedSuggestions: accepted ? upsertAssistanceHistory(assistance.acceptedSuggestions, historyEntry) : assistance.acceptedSuggestions,
        dismissedSuggestions: dismissed ? upsertAssistanceHistory(assistance.dismissedSuggestions, historyEntry) : assistance.dismissedSuggestions,
        lastSuggestionAt: shown ? now : assistance.lastSuggestionAt,
        lastAcceptedAt: accepted ? now : assistance.lastAcceptedAt,
        lastDismissedAt: dismissed ? now : assistance.lastDismissedAt,
        lastOpportunityId: suggestionId || assistance.lastOpportunityId,
        quietUntil: quietMs ? Math.max(assistance.quietUntil || 0, now + quietMs) : assistance.quietUntil,
        rapidInteractionUntil: rapid ? Math.max(assistance.rapidInteractionUntil || 0, now + 1800) : assistance.rapidInteractionUntil,
        updatedAt: now,
      },
    },
  };
}

export function dismissAssistanceSuggestion(profile, suggestionId = "") {
  return recordAssistanceInteraction(profile, {
    interactionType: "assistance-dismissed",
    suggestionId,
    workflowId: assistanceSuggestionToFeature(suggestionId),
  });
}

export function acceptAssistanceSuggestion(profile, suggestionId = "") {
  return recordAssistanceInteraction(profile, {
    interactionType: "assistance-accepted",
    suggestionId,
    workflowId: assistanceSuggestionToFeature(suggestionId),
  });
}

export function resetContextualAssistance(profile) {
  const onboarding = createOnboardingState(profile.onboarding);
  const previous = createContextualAssistanceState(onboarding.contextualAssistance);
  return {
    ...profile,
    onboarding: {
      ...onboarding,
      contextualAssistance: {
        ...createContextualAssistanceState({}),
        resetCount: previous.resetCount + 1,
        updatedAt: Date.now(),
      },
    },
  };
}

export function selectContextualAssistance(profile = {}, context = {}) {
  const onboarding = createOnboardingState(profile.onboarding);
  const assistance = createContextualAssistanceState(onboarding.contextualAssistance);
  if (!assistance.enabled || profile.settings?.assistance?.contextualAssistance === false || profile.settings?.learning?.contextualAssistance === false) {
    return null;
  }
  const tutorial = profile.activeSession?.tutorial || {};
  if (tutorial.active || tutorial.completionPending || tutorial.status === "paused") {
    return null;
  }
  const candidates = buildContextualAssistanceCandidates(profile, context, assistance)
    .filter((candidate) => shouldShowAssistanceCandidate(candidate, assistance, context))
    .sort((left, right) =>
      (ASSISTANCE_PRIORITY_WEIGHT[right.priority] || 0) - (ASSISTANCE_PRIORITY_WEIGHT[left.priority] || 0) ||
      Number(right.score || 0) - Number(left.score || 0)
    );
  const next = candidates[0];
  if (!next) {
    return null;
  }
  return {
    key: `assistance:${next.id}:${next.scope || "battlefield"}`,
    source: "contextual-assistance",
    assistanceId: next.id,
    opportunityId: next.id,
    text: next.text,
    title: next.title,
    tokenId: next.tokenId || ASSISTANCE_TOKEN_IDS.suggestionCard,
    priority: next.priority || ASSISTANCE_PRIORITY_LEVELS.helpful,
    dismissBehavior: next.dismissBehavior || "remember-and-respect",
    suggestedPanel: next.suggestedPanel || "",
    ariaLabel: next.ariaLabel || next.text,
    ttlMs: next.ttlMs || 7000,
  };
}

export function createAssistanceCenterModel(profile = {}) {
  const onboarding = createOnboardingState(profile.onboarding);
  const assistance = createContextualAssistanceState(onboarding.contextualAssistance);
  const candidates = buildContextualAssistanceCandidates(profile, { page: "battlefield", force: true, fromLearningCenter: true }, assistance);
  return {
    version: CONTEXTUAL_ASSISTANCE_VERSION,
    enabled: assistance.enabled,
    mode: assistance.mode,
    priorityLevels: Object.values(ASSISTANCE_PRIORITY_LEVELS),
    tokenIds: Object.values(ASSISTANCE_TOKEN_IDS),
    acceptedCount: assistance.acceptedSuggestions.length,
    dismissedCount: assistance.dismissedSuggestions.length,
    shownCount: assistance.shownSuggestions.length,
    lastOpportunityId: assistance.lastOpportunityId,
    opportunities: candidates.slice(0, 6).map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      priority: candidate.priority,
      visible: Boolean(candidate.visible),
      reason: candidate.reason || "",
    })),
  };
}

export function createAssistanceDebugSnapshot(profile = {}, context = {}) {
  const onboarding = createOnboardingState(profile.onboarding);
  const assistance = createContextualAssistanceState(onboarding.contextualAssistance);
  const opportunities = buildContextualAssistanceCandidates(profile, { ...context, force: true }, assistance);
  const selected = selectContextualAssistance(profile, { ...context, force: true });
  return {
    version: CONTEXTUAL_ASSISTANCE_VERSION,
    productionHidden: true,
    enabled: assistance.enabled,
    mode: assistance.mode,
    selectedOpportunityId: selected?.opportunityId || "",
    opportunities: opportunities.map((candidate) => ({
      id: candidate.id,
      priority: candidate.priority,
      visible: Boolean(candidate.visible),
      reason: candidate.reason || "",
    })),
    suppressedSuggestions: assistance.suppressedSuggestions,
    dismissedSuggestions: assistance.dismissedSuggestions,
    acceptedSuggestions: assistance.acceptedSuggestions,
    workflowCounts: assistance.workflowCounts,
    contextEvaluation: {
      naturalPause: !isAssistanceTimingSuppressed(assistance, context),
      helperDisabled: profile.settings?.helperSprite?.enabled === false,
      assistanceDisabled: profile.settings?.assistance?.contextualAssistance === false || profile.settings?.learning?.contextualAssistance === false,
      rapidInput: Date.now() < Number(assistance.rapidInteractionUntil || 0) || Boolean(context.rapidInteraction),
      combatResolving: Boolean(context.combatResolving),
      animationActive: Boolean(context.animationActive || context.isAnimating),
      searchTyping: Boolean(context.keepSearchInputFocus || context.searchFocused),
    },
  };
}

export function buildTutorialHelperMessage(session = {}) {
  const tutorial = session.tutorial || {};
  if (!tutorial.active && !tutorial.completionPending) {
    return null;
  }
  const step = getTutorialStep(tutorial);
  return {
    key: `guided-tutorial:${tutorial.currentStep || 0}:${step.id}:${tutorial.status || "active"}`,
    source: "guided-tutorial",
    text: step.prompt,
    step,
  };
}

export function buildTutorialScreenReaderText(session = {}) {
  const message = buildTutorialHelperMessage(session);
  if (!message) return "";
  return `Tutorial turn ${message.step.turn}. ${message.step.title}. ${message.text}`;
}

const LEARNING_FEATURE_IDS = [
  "firstLaunch",
  "tutorial",
  "battlefield",
  "commandHand",
  "firstPermanent",
  "undo",
  "search",
  "selection",
  "stack",
  "commander",
  "reminders",
  "rulesAssistant",
  "helpCenter",
  "accessibility",
];

function buildContextualAssistanceCandidates(profile = {}, context = {}, assistance = createContextualAssistanceState()) {
  const session = profile.activeSession || {};
  const learning = createAdaptiveLearningState(profile.onboarding?.adaptiveLearning);
  const page = context.page || "battlefield";
  const playerPermanents = session.battlefield?.player || [];
  const opponentPermanents = session.battlefield?.opponent || [];
  const playerPermanentCount = playerPermanents.length;
  const opponentPermanentCount = opponentPermanents.length;
  const totalPermanentCount = playerPermanentCount + opponentPermanentCount;
  const tokenCount = [...playerPermanents, ...opponentPermanents].filter((entry) => entry.isToken || Number(entry.quantity || 1) > 1).length;
  const stackCount = (session.stack || []).length;
  const triggerCount = (session.triggerQueue || []).filter((entry) => entry.status === "pending").length;
  const undoCount = (session.undoStack || []).length;
  const selectedCount = Array.isArray(session.selectedIds) ? session.selectedIds.length : 0;
  const hasCommander = Boolean(session.commander?.name || Object.keys(profile.commanders || {}).length);
  const repeatedSearchCount = Number(learning.repeatedSearchCount || 0) + Number(assistance.workflowCounts.search || 0);
  const highProficiency = learning.proficiencyScore >= 80;
  const activeUtilityPanel = context.activeUtilityPanel || "";
  const workflowEnabled = profile.settings?.learning?.workflowSuggestions !== false && profile.settings?.assistance?.workflowSuggestions !== false;
  const featureDiscoveryEnabled = profile.settings?.learning?.featureDiscovery !== false && profile.settings?.assistance?.featureDiscovery !== false;
  if (page !== "battlefield" && !context.fromLearningCenter) {
    return [];
  }
  return [
    {
      id: "stack-chain-review",
      title: "Review Stack Chain",
      text: "Several stack or trigger items are pending. Open the stack view at the next pause to resolve them in order.",
      tokenId: ASSISTANCE_TOKEN_IDS.workflowRecommendation,
      priority: ASSISTANCE_PRIORITY_LEVELS.important,
      suggestedPanel: "triggers",
      scope: `turn-${session.turn || 1}`,
      score: stackCount * 8 + triggerCount * 6,
      reason: "large stack or trigger queue",
      visible: workflowEnabled && stackCount + triggerCount >= 3 && activeUtilityPanel !== "triggers",
    },
    {
      id: "undo-safety",
      title: "Undo Is Available",
      text: "Undo can restore recent reversible tracking changes if the table corrects something.",
      tokenId: ASSISTANCE_TOKEN_IDS.reminder,
      priority: ASSISTANCE_PRIORITY_LEVELS.helpful,
      suggestedPanel: "history",
      scope: "undo",
      score: undoCount * 5,
      reason: "recent reversible actions exist",
      visible: workflowEnabled && undoCount >= 3 && !featureFamiliar(assistance, "undo"),
    },
    {
      id: "crowded-board-density",
      title: "Crowded Board Help",
      text: "If the table gets crowded, Display & Performance can tune card density without changing game state.",
      tokenId: ASSISTANCE_TOKEN_IDS.workflowRecommendation,
      priority: ASSISTANCE_PRIORITY_LEVELS.helpful,
      suggestedPanel: "display",
      scope: `board-${Math.floor(totalPermanentCount / 6)}`,
      score: totalPermanentCount + tokenCount * 2,
      reason: "large battlefield or token pressure",
      visible: workflowEnabled && (totalPermanentCount >= 12 || tokenCount >= 4),
    },
    {
      id: "search-workflow",
      title: "Search Shortcut",
      text: "Search stays in the Action Hand. Pin it if you reach for Oracle or card lookup often.",
      tokenId: ASSISTANCE_TOKEN_IDS.quickTip,
      priority: ASSISTANCE_PRIORITY_LEVELS.helpful,
      suggestedPanel: "search",
      scope: "search",
      score: repeatedSearchCount * 4,
      reason: "repeated search behavior",
      visible: workflowEnabled && repeatedSearchCount >= 2 && activeUtilityPanel !== "search" && !featureFamiliar(assistance, "search"),
    },
    {
      id: "selection-inspector",
      title: "Selected Card Context",
      text: "Selected permanents expose context actions and inspection without leaving the battlefield.",
      tokenId: ASSISTANCE_TOKEN_IDS.quickTip,
      priority: ASSISTANCE_PRIORITY_LEVELS.educational,
      suggestedPanel: "selection",
      scope: "selection",
      score: selectedCount * 5,
      reason: "selected permanent with hidden context",
      visible: featureDiscoveryEnabled && selectedCount > 0 && !featureFamiliar(assistance, "selection"),
    },
    {
      id: "commander-workflow",
      title: "Commander Tools",
      text: "Commander tools track zone, tax, and commander damage from the battlefield.",
      tokenId: ASSISTANCE_TOKEN_IDS.workflowRecommendation,
      priority: ASSISTANCE_PRIORITY_LEVELS.educational,
      suggestedPanel: "commander",
      scope: "commander",
      score: hasCommander ? 18 : 0,
      reason: "commander-specific workflow available",
      visible: featureDiscoveryEnabled && hasCommander && !highProficiency && !featureFamiliar(assistance, "commander"),
    },
    {
      id: "reminder-workflow",
      title: "Future Reminder",
      text: "Use Remind when a card, phase, or future table state matters. Stale reminders stay quiet.",
      tokenId: ASSISTANCE_TOKEN_IDS.reminder,
      priority: ASSISTANCE_PRIORITY_LEVELS.educational,
      suggestedPanel: "remind-me",
      scope: `turn-${session.turn || 1}`,
      score: Number(session.turn || 1),
      reason: "future-state reminder discovery",
      visible: featureDiscoveryEnabled && Number(session.turn || 1) >= 2 && !highProficiency && !featureFamiliar(assistance, "reminders"),
    },
    {
      id: "learning-center-reference",
      title: "Learning Center",
      text: "Help & Learning stores tips and assistance history so you can revisit guidance without restarting onboarding.",
      tokenId: ASSISTANCE_TOKEN_IDS.featureDiscovery,
      priority: ASSISTANCE_PRIORITY_LEVELS.optional,
      suggestedPanel: "learning",
      scope: "learning",
      score: assistance.dismissedSuggestions.length + learning.proficiencyScore / 10,
      reason: "help reference available",
      visible: featureDiscoveryEnabled && learning.proficiencyScore >= 20 && !featureFamiliar(assistance, "helpCenter"),
    },
  ].filter((candidate) => candidate.visible);
}

function shouldShowAssistanceCandidate(candidate, assistance, context = {}) {
  if (!candidate?.id || !candidate.visible) {
    return false;
  }
  if (!context.force && isAssistanceTimingSuppressed(assistance, context)) {
    return false;
  }
  const id = normalizeAssistanceId(candidate.id);
  const shown = hasAssistanceHistory(assistance.shownSuggestions, id);
  const dismissed = hasAssistanceHistory(assistance.dismissedSuggestions, id);
  const accepted = hasAssistanceHistory(assistance.acceptedSuggestions, id);
  if (!context.force && (dismissed || accepted || shown)) {
    return false;
  }
  const priority = candidate.priority || ASSISTANCE_PRIORITY_LEVELS.helpful;
  const now = Date.now();
  const minInterval = ASSISTANCE_COOLDOWN_MS[priority] ?? 90000;
  if (!context.force && assistance.lastSuggestionAt && now - Number(assistance.lastSuggestionAt || 0) < minInterval) {
    return false;
  }
  return true;
}

function isAssistanceTimingSuppressed(assistance, context = {}) {
  const now = Date.now();
  return Boolean(
    context.optionsOpen ||
    context.keepSearchInputFocus ||
    context.searchFocused ||
    context.searchLoading ||
    context.combatResolving ||
    context.animationActive ||
    context.isAnimating ||
    context.continuousScrolling ||
    context.rapidInteraction ||
    now < Number(assistance.quietUntil || 0) ||
    now < Number(assistance.rapidInteractionUntil || 0)
  );
}

function featureFamiliar(assistance, featureId = "") {
  const id = normalizeFeatureId(featureId);
  const alt = normalizeAssistanceId(featureId);
  return Number(assistance.familiarFeatures?.[id] || assistance.familiarFeatures?.[alt] || 0) > 0 ||
    Number(assistance.workflowCounts?.[id] || assistance.workflowCounts?.[alt] || 0) >= 3;
}

function buildAdaptiveGuidanceCandidates(profile, context, learning) {
  const session = profile.activeSession || {};
  const page = context.page || "battlefield";
  const selectedCount = Array.isArray(session.selectedIds) ? session.selectedIds.length : 0;
  const playerPermanentCount = (session.battlefield?.player || []).length;
  const stackCount = (session.stack || []).length;
  const triggerCount = (session.triggerQueue || []).filter((entry) => entry.status === "pending").length;
  const undoCount = (session.undoStack || []).length;
  const searchActive = context.activeUtilityPanel === "search" || Boolean(context.searchQuery);
  const hasCommander = Boolean(session.commander?.name || Object.keys(profile.commanders || {}).length);
  const isFirstSession = Boolean(profile.onboarding?.firstLaunchComplete && learning.proficiencyScore < 25);
  if (page !== "battlefield") {
    return [];
  }
  return [
    {
      id: ONBOARDING_TOKEN_IDS.commandHand,
      tokenId: ONBOARDING_TOKEN_IDS.commandHand,
      featureId: "commandHand",
      scope: "battlefield",
      priority: LEARNING_HINT_PRIORITIES.gentle,
      title: "Action Hand",
      text: "Rotate the Action Hand with swipe, wheel, arrows, Q/E, or controller shoulders. The center card is your current decision.",
      visible: isFirstSession && !featureCompleted(learning, "commandHand"),
    },
    {
      id: ONBOARDING_TOKEN_IDS.battlefieldFirstUse,
      tokenId: ONBOARDING_TOKEN_IDS.battlefieldFirstUse,
      featureId: "battlefield",
      scope: `turn-${session.turn || 1}`,
      priority: LEARNING_HINT_PRIORITIES.gentle,
      title: "Quiet Battlefield",
      text: "BoardState starts quiet. Add only the cards and changes the table needs tracked; empty space stays reserved for gameplay.",
      visible: playerPermanentCount === 0 && isFirstSession && featureCompleted(learning, "commandHand"),
    },
    {
      id: ONBOARDING_TOKEN_IDS.firstPermanent,
      tokenId: ONBOARDING_TOKEN_IDS.firstPermanent,
      featureId: "firstPermanent",
      scope: "permanents",
      priority: LEARNING_HINT_PRIORITIES.contextual,
      title: "Card Interaction",
      text: "Tap a permanent to select it. Double tap to tap or untap. Long press opens direct card handling.",
      visible: playerPermanentCount > 0 && !featureCompleted(learning, "firstPermanent"),
    },
    {
      id: ONBOARDING_TOKEN_IDS.selectedCard,
      tokenId: ONBOARDING_TOKEN_IDS.selectedCard,
      featureId: "selection",
      scope: "selection",
      priority: LEARNING_HINT_PRIORITIES.contextual,
      title: "Selected Card",
      text: "Selection keeps gameplay visible. Inspect, move, counter, or ask why without leaving the battlefield.",
      visible: selectedCount > 0 && !featureCompleted(learning, "selection"),
    },
    {
      id: ONBOARDING_TOKEN_IDS.firstUndo,
      tokenId: ONBOARDING_TOKEN_IDS.firstUndo,
      featureId: "undo",
      scope: "undo",
      priority: LEARNING_HINT_PRIORITIES.contextual,
      title: "Safe Undo",
      text: "Undo uses recorded action history for recent reversible changes. It is there for table-tracking mistakes.",
      visible: undoCount > 0 && !featureCompleted(learning, "undo"),
    },
    {
      id: ONBOARDING_TOKEN_IDS.searchDiscovery,
      tokenId: ONBOARDING_TOKEN_IDS.searchDiscovery,
      featureId: "search",
      scope: "search",
      priority: LEARNING_HINT_PRIORITIES.contextual,
      title: "Search",
      text: "Search can find Oracle text, add cards, and preserve keyboard focus while the battlefield remains visible.",
      visible: searchActive && !featureCompleted(learning, "search"),
    },
    {
      id: ONBOARDING_TOKEN_IDS.stackReview,
      tokenId: ONBOARDING_TOKEN_IDS.stackReview,
      featureId: "stack",
      scope: `stack-${stackCount}-${triggerCount}`,
      priority: LEARNING_HINT_PRIORITIES.contextual,
      title: "Stack And Triggers",
      text: "Stack, priority, and trigger help appears only when it matters. Ask Why explains the chain from game history.",
      visible: (stackCount > 0 || triggerCount > 0) && !featureCompleted(learning, "stack"),
    },
    {
      id: ONBOARDING_TOKEN_IDS.commanderTools,
      tokenId: ONBOARDING_TOKEN_IDS.commanderTools,
      featureId: "commander",
      scope: "commander",
      priority: LEARNING_HINT_PRIORITIES.reference,
      title: "Commander Tools",
      text: "The Commander card tracks tax, zone, damage, and Commander-specific decisions without requiring a separate screen.",
      visible: hasCommander && !featureCompleted(learning, "commander") && learning.proficiencyScore < 45,
    },
    {
      id: ONBOARDING_TOKEN_IDS.helpCenter,
      tokenId: ONBOARDING_TOKEN_IDS.helpCenter,
      featureId: "helpCenter",
      scope: "options",
      priority: LEARNING_HINT_PRIORITIES.reference,
      title: "Learning Center",
      text: "Need a refresher later? Game Options contains Help and Learning without restarting onboarding.",
      visible: learning.proficiencyScore >= 15 && !featureCompleted(learning, "helpCenter"),
    },
  ].filter((candidate) => candidate.visible);
}

function shouldShowLearningCandidate(candidate, learning, context = {}) {
  if (!candidate?.id) {
    return false;
  }
  const id = normalizeHintId(candidate.id);
  if (learning.dismissedHints.includes(id) || learning.completedSteps.includes(id)) {
    return false;
  }
  if (candidate.featureId && featureCompleted(learning, candidate.featureId)) {
    return false;
  }
  const now = Date.now();
  const minInterval = context.force ? 0 : learning.proficiencyScore >= 45 ? 180000 : 42000;
  if (learning.lastGuidanceAt && now - learning.lastGuidanceAt < minInterval) {
    return false;
  }
  return true;
}

function featureCompleted(learning, featureId = "") {
  const id = normalizeFeatureId(featureId);
  const discovery = learning.featureDiscovery?.[id];
  return Boolean(discovery?.completed || learning.completedSteps.includes(id));
}

function markFeatureDiscovered(onboarding, featureId = "", now = Date.now()) {
  const learning = createAdaptiveLearningState(onboarding.adaptiveLearning);
  const normalized = normalizeFeatureId(featureId);
  return {
    ...onboarding,
    adaptiveLearning: {
      ...learning,
      completedSteps: normalizeStringList([...learning.completedSteps, normalized]),
      featureDiscovery: {
        ...learning.featureDiscovery,
        [normalized]: markDiscoveryEntry(learning.featureDiscovery[normalized], now, "onboarding"),
      },
      updatedAt: now,
    },
  };
}

function normalizeFeatureDiscovery(source = {}) {
  const result = {};
  LEARNING_FEATURE_IDS.forEach((featureId) => {
    result[featureId] = normalizeDiscoveryEntry(source[featureId]);
  });
  Object.entries(source || {}).forEach(([featureId, entry]) => {
    const normalized = normalizeFeatureId(featureId);
    result[normalized] = normalizeDiscoveryEntry(entry);
  });
  return result;
}

function normalizeDiscoveryEntry(source = {}) {
  return {
    completed: Boolean(source.completed || source.discovered),
    firstSeenAt: Number(source.firstSeenAt || source.discoveredAt || 0),
    lastSeenAt: Number(source.lastSeenAt || source.updatedAt || source.firstSeenAt || 0),
    count: Math.max(0, Number(source.count || 0)),
    lastInteraction: source.lastInteraction || "",
  };
}

function markDiscoveryEntry(source = {}, now = Date.now(), interactionType = "interaction") {
  const previous = normalizeDiscoveryEntry(source);
  return {
    completed: true,
    firstSeenAt: previous.firstSeenAt || now,
    lastSeenAt: now,
    count: previous.count + 1,
    lastInteraction: interactionType,
  };
}

function interactionToFeature(interactionType = "") {
  const normalized = String(interactionType || "").toLowerCase();
  if (normalized.includes("command")) return "commandHand";
  if (normalized.includes("search")) return "search";
  if (normalized.includes("undo")) return "undo";
  if (normalized.includes("select")) return "selection";
  if (normalized.includes("permanent")) return "firstPermanent";
  if (normalized.includes("stack") || normalized.includes("trigger")) return "stack";
  if (normalized.includes("commander")) return "commander";
  if (normalized.includes("remind")) return "reminders";
  if (normalized.includes("rules") || normalized.includes("question")) return "rulesAssistant";
  if (normalized.includes("help") || normalized.includes("learning")) return "helpCenter";
  if (normalized.includes("accessibility") || normalized.includes("screen-reader")) return "accessibility";
  if (normalized.includes("tutorial")) return "tutorial";
  return "battlefield";
}

function assistanceSuggestionToFeature(value = "") {
  const id = normalizeAssistanceId(value);
  if (id.includes("stack") || id.includes("trigger")) return "stack";
  if (id.includes("undo")) return "undo";
  if (id.includes("search")) return "search";
  if (id.includes("selection") || id.includes("inspector")) return "selection";
  if (id.includes("commander")) return "commander";
  if (id.includes("reminder") || id.includes("remind")) return "reminders";
  if (id.includes("learning") || id.includes("help")) return "helpCenter";
  if (id.includes("board") || id.includes("density")) return "battlefield";
  return "";
}

function learningAmountFor(interactionType = "") {
  const normalized = String(interactionType || "").toLowerCase();
  if (normalized.includes("complete")) return 12;
  if (normalized.includes("tutorial")) return 3;
  if (normalized.includes("hint-shown")) return 1;
  if (normalized.includes("dismiss")) return 2;
  if (normalized.includes("search")) return 2;
  return 4;
}

function normalizeFeatureId(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "battlefield";
  const map = {
    [ONBOARDING_TOKEN_IDS.welcomeChoice]: "firstLaunch",
    [ONBOARDING_TOKEN_IDS.commandHand]: "commandHand",
    [ONBOARDING_TOKEN_IDS.battlefieldFirstUse]: "battlefield",
    [ONBOARDING_TOKEN_IDS.firstPermanent]: "firstPermanent",
    [ONBOARDING_TOKEN_IDS.firstUndo]: "undo",
    [ONBOARDING_TOKEN_IDS.searchDiscovery]: "search",
    [ONBOARDING_TOKEN_IDS.selectedCard]: "selection",
    [ONBOARDING_TOKEN_IDS.stackReview]: "stack",
    [ONBOARDING_TOKEN_IDS.commanderTools]: "commander",
    [ONBOARDING_TOKEN_IDS.reminders]: "reminders",
    [ONBOARDING_TOKEN_IDS.helpCenter]: "helpCenter",
    [ONBOARDING_TOKEN_IDS.accessibility]: "accessibility",
  };
  if (map[raw]) return map[raw];
  if (LEARNING_FEATURE_IDS.includes(raw)) return raw;
  return raw.replace(/[^a-z0-9]+([a-z0-9])/gi, (_, letter) => letter.toUpperCase()).replace(/[^a-z0-9]/gi, "") || "battlefield";
}

function normalizeHintId(value = "") {
  const key = String(value || "").trim();
  const match = key.match(/^learning:([^:]+)/);
  return match?.[1] || key;
}

function normalizeAssistanceId(value = "") {
  const key = String(value || "").trim();
  const match = key.match(/^assistance:([^:]+)/);
  const raw = match?.[1] || key;
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function normalizeLearningConfidence(value = "") {
  const normalized = String(value || "").toLowerCase();
  if (["new", "learning", "comfortable", "expert"].includes(normalized)) {
    return normalized;
  }
  return "new";
}

function scoreToConfidence(score = 0) {
  const value = Number(score || 0);
  if (value >= 80) return "expert";
  if (value >= 45) return "comfortable";
  if (value >= 15) return "learning";
  return "new";
}

function inferProficiencyScore(source = {}) {
  const completed = normalizeStringList(source.completedSteps).length;
  const interactions = Object.values(source.interactionCounts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  return clampNumber(completed * 5 + interactions, 0, 100, 0);
}

function normalizeStringList(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean))].slice(-160);
}

function normalizeAssistanceHistory(values = []) {
  return (Array.isArray(values) ? values : [])
    .map((entry) => {
      if (typeof entry === "string") {
        return { id: normalizeAssistanceId(entry), at: 0, count: 1, context: "", priority: "" };
      }
      const id = normalizeAssistanceId(entry?.id || entry?.suggestionId || entry?.opportunityId || entry?.key || "");
      if (!id) {
        return null;
      }
      return {
        id,
        at: Number(entry.at || entry.timestamp || entry.shownAt || 0),
        count: Math.max(1, Math.floor(Number(entry.count || 1))),
        context: String(entry.context || entry.reason || "").slice(0, 80),
        priority: String(entry.priority || "").slice(0, 32),
      };
    })
    .filter(Boolean)
    .slice(-160);
}

function upsertAssistanceHistory(values = [], entry = {}) {
  const history = normalizeAssistanceHistory(values);
  const id = normalizeAssistanceId(entry.id || entry.suggestionId || entry.opportunityId || entry.key || "");
  if (!id) {
    return history;
  }
  const previous = history.find((item) => item.id === id);
  const next = {
    id,
    at: Number(entry.at || Date.now()),
    count: Math.max(1, Number(previous?.count || 0) + 1),
    context: String(entry.context || previous?.context || "").slice(0, 80),
    priority: String(entry.priority || previous?.priority || "").slice(0, 32),
  };
  return [next, ...history.filter((item) => item.id !== id)].slice(0, 160);
}

function hasAssistanceHistory(values = [], id = "") {
  const normalized = normalizeAssistanceId(id);
  return normalizeAssistanceHistory(values).some((entry) => entry.id === normalized);
}

function normalizeCountRecord(source = {}) {
  return Object.fromEntries(
    Object.entries(source || {}).map(([key, value]) => [
      String(key || "").trim(),
      Math.max(0, Math.floor(Number(value || 0))),
    ]).filter(([key]) => Boolean(key))
  );
}

function incrementRecord(source = {}, key = "", amount = 1) {
  const normalized = normalizeCountRecord(source);
  const id = String(key || "interaction");
  return {
    ...normalized,
    [id]: Math.max(0, Number(normalized[id] || 0) + Number(amount || 1)),
  };
}

function clampNumber(value, min, max, fallback = min) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, number));
}

function createTutorialPracticeSession(profile, now = Date.now()) {
  const session = createGameSession();
  const hand = [
    tutorialCard("Plains", "Basic Land - Plains", "{T}: Add {W}.", { isLand: true }),
    tutorialCard("Island", "Basic Land - Island", "{T}: Add {U}.", { isLand: true }),
    tutorialCard("Forest", "Basic Land - Forest", "{T}: Add {G}.", { isLand: true }),
    tutorialCard("Spark Cub", "Creature - Elemental Bear", "A simple creature used to learn casting and combat.", { manaCost: "{1}{G}", basePower: 2, baseToughness: 2 }),
    tutorialCard("Practice Relic", "Artifact", "Whenever you put a counter on Practice Relic, scry 1.", { manaCost: "{2}" }),
    tutorialCard("Helpful Growth", "Sorcery", "Put a +1/+1 counter on target creature.", { manaCost: "{G}" }),
    tutorialCard("Landfall Sprout", "Creature - Plant", "Landfall - Whenever a land enters the battlefield under your control, create a 1/1 green Insect creature token.", { manaCost: "{1}{G}", basePower: 1, baseToughness: 3 }),
  ];
  const opponentBlocker = createPermanent({
    id: "tutorial-opponent-sentinel",
    name: "Practice Sentinel",
    typeLine: "Creature - Soldier",
    oracleText: "The tutorial opponent uses this to demonstrate blocking.",
    basePower: 1,
    baseToughness: 3,
    controller: "tutorial-opponent",
    owner: "tutorial-opponent",
    summoningSick: false,
  });
  return {
    ...session,
    id: createId("tutorial-game"),
    createdAt: now,
    updatedAt: now,
    turn: 1,
    phaseIndex: 0,
    life: 40,
    manaPool: createManaPool(),
    zones: {
      ...session.zones,
      hand,
      library: [
        tutorialCard("Practice Plains", "Basic Land - Plains", "{T}: Add {W}.", { isLand: true }),
        tutorialCard("Practice Bolt", "Instant", "Practice Bolt deals 2 damage to any target.", { manaCost: "{R}" }),
      ],
      unknownCounts: {
        ...session.zones.unknownCounts,
        hand: hand.length,
        library: 2,
      },
    },
    battlefield: {
      ...session.battlefield,
      player: [],
      opponent: [opponentBlocker],
    },
    gameTracking: {
      active: true,
      startedAt: now,
      mode: "guided-tutorial",
    },
    simulation: {
      ...session.simulation,
      enabled: true,
      status: "paused",
      speed: "step",
      selectedOpponents: ["tutorial-opponent"],
      opponents: {
        "tutorial-opponent": {
          id: "tutorial-opponent",
          name: "Practice Opponent",
          life: 40,
          zones: {
            battlefield: [opponentBlocker],
            hand: [],
            graveyard: [],
            exile: [],
            library: [],
          },
          strategy: { label: "Tutorial scripted opponent", aggression: 0 },
        },
      },
      players: {
        "local-player": { id: "local-player", name: profile.player?.name || "Player" },
        "tutorial-opponent": { id: "tutorial-opponent", name: "Practice Opponent" },
      },
      turnOrder: ["local-player", "tutorial-opponent"],
      currentPlayerId: "local-player",
      log: [{ id: createId("sim-log"), at: now, actorId: "tutorial", text: "Guided five-turn practice game started." }],
      createdAt: now,
      updatedAt: now,
    },
    tutorial: {
      active: true,
      loadedAt: now,
      step: 0,
      currentTurn: 1,
      currentStep: 0,
      currentStepId: TUTORIAL_STEPS[0].id,
      totalSteps: TUTORIAL_STEPS.length,
      status: "active",
      paused: false,
      forcedGuidance: true,
      completionPending: false,
      autoSaveId: "",
      canClear: true,
      version: TUTORIAL_VERSION,
      lessonLog: [],
    },
    helper: {
      ...session.helper,
      reminderQueue: [],
      replayQueue: [],
    },
    effectLog: [
      {
        id: createId("effect"),
        at: now,
        sourceName: "Guided Tutorial",
        summary: "Loaded deterministic five-turn Commander practice setup.",
        status: "resolved",
      },
    ],
  };
}

function applyTutorialMilestone(session, stepIndex, profile = {}) {
  const step = TUTORIAL_STEPS[clampStepIndex(stepIndex)];
  let next = clone(session);
  next.turn = step.turn;
  next.phaseIndex = getTutorialPhaseIndex(step.id);
  next.updatedAt = Date.now();
  const addPlayerPermanent = (card) => {
    if ((next.battlefield.player || []).some((entry) => entry.name === card.name)) return;
    next.battlefield.player = [...(next.battlefield.player || []), createPermanent({ ...card, controller: "player", owner: "player" })];
  };
  const tapPermanent = (name) => {
    next.battlefield.player = (next.battlefield.player || []).map((entry) => entry.name === name ? { ...entry, tapped: true } : entry);
  };
  const untapAll = () => {
    next.battlefield.player = (next.battlefield.player || []).map((entry) => ({ ...entry, tapped: false, summoningSick: false }));
  };

  switch (step.id) {
    case "turn1-play-land":
      addPlayerPermanent({ name: "Plains", typeLine: "Basic Land - Plains", oracleText: "{T}: Add {W}.", isLand: true });
      break;
    case "turn1-tap-land":
      addPlayerPermanent({ name: "Plains", typeLine: "Basic Land - Plains", oracleText: "{T}: Add {W}.", isLand: true });
      tapPermanent("Plains");
      next.manaPool = { ...createManaPool(), W: 1 };
      break;
    case "turn1-end":
      next.manaPool = createManaPool();
      next.simulation.log = addTutorialLog(next.simulation.log, "Practice Opponent plays a tapped land and passes.");
      break;
    case "turn2-draw-land":
      untapAll();
      addPlayerPermanent({ name: "Island", typeLine: "Basic Land - Island", oracleText: "{T}: Add {U}.", isLand: true });
      break;
    case "turn2-cast-creature":
      addPlayerPermanent({ name: "Island", typeLine: "Basic Land - Island", oracleText: "{T}: Add {U}.", isLand: true });
      next.battlefield.player = (next.battlefield.player || []).map((entry) => ["Plains", "Island"].includes(entry.name) ? { ...entry, tapped: true } : entry);
      next.stack = [createTutorialStackObject("Spark Cub", "Creature - Elemental Bear", "Creature spell on the stack.", "permanent-spell")];
      next.presentation = createTutorialPresentation("Spark Cub", "Creature - Elemental Bear", "spell-cast");
      break;
    case "turn2-stack-resolution":
    case "turn2-summoning-sickness":
      next.stack = [];
      addPlayerPermanent({ name: "Spark Cub", typeLine: "Creature - Elemental Bear", oracleText: "A simple creature used to learn casting and combat.", basePower: 2, baseToughness: 2, summoningSick: step.id === "turn2-stack-resolution" });
      break;
    case "turn3-noncreature":
      untapAll();
      addPlayerPermanent({ name: "Forest", typeLine: "Basic Land - Forest", oracleText: "{T}: Add {G}.", isLand: true });
      addPlayerPermanent({ name: "Practice Relic", typeLine: "Artifact", oracleText: "Whenever you put a counter on Practice Relic, scry 1.", counters: { Charge: 0 } });
      next.presentation = createTutorialPresentation("Practice Relic", "Artifact", "entered-battlefield");
      break;
    case "turn3-trigger":
      addPlayerPermanent({ name: "Practice Relic", typeLine: "Artifact", oracleText: "Whenever you put a counter on Practice Relic, scry 1.", counters: { Charge: 1 } });
      next.battlefield.player = (next.battlefield.player || []).map((entry) => entry.name === "Practice Relic" ? { ...entry, counters: { ...(entry.counters || {}), Charge: Math.max(1, Number(entry.counters?.Charge || 0)) } } : entry);
      next.triggerQueue = [createTutorialTrigger("Practice Relic", "Counter added: scry 1."), ...(next.triggerQueue || [])].slice(0, 20);
      break;
    case "turn3-end":
      next.triggerQueue = (next.triggerQueue || []).map((entry) => entry.sourceName === "Practice Relic" ? { ...entry, status: "resolved", resolvedAt: Date.now() } : entry);
      break;
    case "turn4-attackers":
      untapAll();
      next.combat = {
        ...(next.combat || {}),
        step: "declare-attackers",
        attackerIds: (next.battlefield.player || []).filter((entry) => entry.name === "Spark Cub").map((entry) => entry.id),
        attackTargets: { "tutorial-opponent": ["tutorial-opponent"] },
      };
      next.battlefield.player = (next.battlefield.player || []).map((entry) => entry.name === "Spark Cub" ? { ...entry, attacking: true, attackedObjectId: "tutorial-opponent" } : entry);
      break;
    case "turn4-blockers":
      next.combat = { ...(next.combat || {}), step: "declare-blockers", blockerAssignments: { "tutorial-opponent-sentinel": (next.combat?.attackerIds || [])[0] || "spark-cub" } };
      next.battlefield.opponent = (next.battlefield.opponent || []).map((entry) => entry.name === "Practice Sentinel" ? { ...entry, blocking: true } : entry);
      break;
    case "turn4-damage":
      next.combat = { ...(next.combat || {}), step: "damage", resolved: true };
      next.battlefield.player = (next.battlefield.player || []).map((entry) => entry.name === "Spark Cub" ? { ...entry, damageMarked: 1, attacking: false } : entry);
      next.battlefield.opponent = (next.battlefield.opponent || []).map((entry) => entry.name === "Practice Sentinel" ? { ...entry, damageMarked: 2, blocking: false } : entry);
      next.simulation.opponents["tutorial-opponent"].life = 38;
      next.simulation.log = addTutorialLog(next.simulation.log, "Combat resolved. The practice opponent remains in the game.");
      break;
    case "turn5-landfall":
      untapAll();
      addPlayerPermanent({ name: "Landfall Sprout", typeLine: "Creature - Plant", oracleText: "Landfall - Whenever a land enters the battlefield under your control, create a 1/1 green Insect creature token.", basePower: 1, baseToughness: 3 });
      addPlayerPermanent({ name: "Practice Plains", typeLine: "Basic Land - Plains", oracleText: "{T}: Add {W}.", isLand: true });
      next.triggerQueue = [createTutorialTrigger("Landfall Sprout", "Landfall: create a 1/1 green Insect token."), ...(next.triggerQueue || [])].slice(0, 20);
      break;
    case "turn5-stats":
      addPlayerPermanent({ name: "Insect Token", typeLine: "Token Creature - Insect", oracleText: "Created by the tutorial landfall trigger.", basePower: 1, baseToughness: 1, isToken: true });
      next.triggerQueue = (next.triggerQueue || []).map((entry) => entry.sourceName === "Landfall Sprout" ? { ...entry, status: "resolved", resolvedAt: Date.now() } : entry);
      break;
    default:
      break;
  }
  const message = buildTutorialHelperMessage(next);
  next.helper = {
    ...(next.helper || {}),
    replayQueue: message ? [message] : [],
  };
  return next;
}

function tutorialCard(name, typeLine, oracleText, extra = {}) {
  return {
    cardId: `tutorial-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name,
    typeLine,
    oracleText,
    manaCost: extra.manaCost || "",
    basePower: extra.basePower,
    baseToughness: extra.baseToughness,
    isLand: extra.isLand || /\bLand\b/i.test(typeLine),
    ownedByCommanderDeck: false,
  };
}

function createTutorialStackObject(name, typeLine, summary, objectType) {
  return {
    id: createId("tutorial-stack"),
    name,
    typeLine,
    summary,
    objectType,
    controller: "player",
    owner: "player",
    status: "pending",
    createdAt: Date.now(),
  };
}

function createTutorialPresentation(name, typeLine, kind) {
  const now = Date.now();
  return {
    id: createId("tutorial-presentation"),
    kind,
    controller: "player",
    createdAt: now,
    expiresAt: now + 1400,
    card: { name, typeLine, imageUrl: "", imageSmall: "", imageArt: "" },
  };
}

function createTutorialTrigger(sourceName, summary) {
  return {
    id: createId("tutorial-trigger"),
    chainId: createId("tutorial-chain"),
    sourceId: sourceName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    sourceName,
    eventType: "TUTORIAL_TRIGGER",
    status: "pending",
    effectDefinitions: [{ action: "tutorial", summary }],
    rulesConfidence: "auto-resolved",
    createdAt: Date.now(),
    summary,
  };
}

function addTutorialLog(log = [], text = "") {
  return [{ id: createId("sim-log"), at: Date.now(), actorId: "tutorial-opponent", text }, ...(log || [])].slice(0, 80);
}

function getTutorialPhaseIndex(stepId = "") {
  if (/combat|attack|block|damage/.test(stepId)) return 2;
  if (/end/.test(stepId)) return 4;
  if (/welcome|turn-order/.test(stepId)) return 0;
  return 1;
}

function clampStepIndex(value) {
  return Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, Number.isFinite(Number(value)) ? Math.floor(Number(value)) : 0));
}
