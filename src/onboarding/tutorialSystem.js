import { createGameSession, createManaPool, createPermanent } from "../state/schema.js";
import { createId, clone } from "../state/ids.js";

export const TUTORIAL_VERSION = "five-turn-v1";

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
    helperSpriteEnabled: source.helperSpriteEnabled !== false,
    screenReaderPromptsEnabled: Boolean(source.screenReaderPromptsEnabled),
    tutorialReducedMotion: Boolean(source.tutorialReducedMotion),
    tutorialLastUpdatedAt: Number(source.tutorialLastUpdatedAt || (source.tutorialStarted ? now : 0)),
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
  const session = applyTutorialMilestone(createTutorialPracticeSession(profile, now), 0, profile);
  return {
    ...profile,
    onboarding: {
      ...createOnboardingState(profile.onboarding),
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
        enabled: options.helperSpriteEnabled ?? true,
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
      ...createOnboardingState(profile.onboarding),
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
        enabled: true,
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
  return {
    ...profile,
    onboarding: {
      ...createOnboardingState(profile.onboarding),
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
  return {
    ...profile,
    onboarding: {
      ...createOnboardingState(profile.onboarding),
      firstLaunchComplete: true,
      tutorialOffered: true,
      tutorialSkipped: options.doNotShowAgain !== false,
      tutorialLastUpdatedAt: now,
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
