import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CANONICAL_CARD_LIFECYCLE_VERSION,
  CARD_PRESENTATION_ROLES,
  DIRECT_LIVE_TRACKING_ACTIONS,
  GAMEPLAY_EVENT_TYPES,
  GAMEPLAY_MODES,
  NOTIFICATION_PRIORITY_LEVELS,
  assertModeParityOutcome,
  classifyNotificationPriority,
  classifyTriggerForPresentation,
  createCardLifecycleSnapshot,
  createCardPresentationPayload,
  createGameplayEventIdentity,
  createGameplayLifecycleEvent,
  createModeInteractionPolicy,
  createPostResolveDecisionPipeline,
  createPresentationLedger,
  createPreviewState,
  createReplayObservation,
  createResolveInteractionPlan,
  createTriggerPresentationPlan,
  dismissPreviewState,
  isReplacementEffectStackObject,
  markPresentationEventPlayed,
  resolveGameplayAttentionOwner,
  shouldDeferNotification,
  shouldPlayPresentationEvent,
} from "../src/gameplay/cardLifecycle.js";
import { castSpellToStack, resolveTopOfStack } from "../src/effects/effectEngine.js";
import { createDefaultProfile, createGameSession, createPermanent } from "../src/state/schema.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { createAction } from "../src/state/actions.js";
import { createLandscapeBattlefieldModel } from "../src/ui/landscapeBattlefield.js";

function readRepositoryFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function stackSession({ stackDepth = 1, pending = [], stackObject = {}, mode = "training-ground" } = {}) {
  const stack = Array.from({ length: stackDepth }, (_, index) => ({
    id: `stack-${index + 1}`,
    name: index === 0 ? stackObject.name || "Current Spell" : `Response ${index + 1}`,
    controller: index === 0 ? stackObject.controller || "player" : "opponent",
    objectType: stackObject.objectType || "spell",
    card: stackObject.card || { name: stackObject.name || "Current Spell", typeLine: "Instant" },
    ...stackObject,
    id: index === 0 ? stackObject.id || "stack-1" : `stack-${index + 1}`,
  }));
  return {
    ...createGameSession(),
    gameTracking: { active: mode !== "training-ground", mode },
    stack,
    pendingEffects: pending,
    priority: { activePlayerId: "local-player", passedPlayerIds: [], responderIds: [], waiting: false },
  };
}

test("Part 3 mode policy separates Live Tracking shortcuts from Full Control rules authority", () => {
  const live = createModeInteractionPolicy(GAMEPLAY_MODES.liveTracking);
  const full = createModeInteractionPolicy({ simulation: { enabled: true } });

  assert.equal(live.mode, GAMEPLAY_MODES.liveTracking);
  assert.equal(live.inferDeterministicConsequences, true);
  assert.equal(live.requestDigitalPriorityPasses, false);
  assert.equal(live.oneResolvePerStackObjectDefault, true);
  assert.equal(live.landPlayRequiresResolve, false);
  assert.equal(full.mode, GAMEPLAY_MODES.fullControl);
  assert.equal(full.requestDigitalPriorityPasses, true);
  assert.equal(full.rulesEngineShared, true);
  assert.equal(full.authoritativeRulesDivergeByMode, false);

  for (const actionKind of DIRECT_LIVE_TRACKING_ACTIONS) {
    const plan = createResolveInteractionPlan(createGameSession(), { actionKind });
    assert.equal(plan.requiredResolveInteractions, 0);
    assert.equal(plan.reason, "direct-deterministic-action");
  }
});

test("Part 3 resolve suite distinguishes one stack-object resolve from genuine decisions", () => {
  const pendingDecision = (kind, stackObjectId = "stack-1") => ({
    id: `pending-${kind}`,
    status: "pending",
    stackObjectId,
    effect: { action: kind, manual: true, choiceKind: kind },
  });
  const cases = [
    ["vanilla creature", stackSession({ stackObject: { name: "Grizzly Bears", objectType: "permanent-spell" } }), 1, false],
    ["automatic ETB permanent", stackSession({ stackObject: { name: "Soul Warden", objectType: "permanent-spell" } }), 1, false],
    ["targeted ETB permanent", stackSession({ pending: [pendingDecision("targets")] }), 0, true],
    ["optional ETB permanent", stackSession({ pending: [pendingDecision("optional-trigger")] }), 0, true],
    ["instant with no targets", stackSession({ stackObject: { name: "Opt" } }), 1, false],
    ["instant with one target chosen", stackSession({ stackObject: { name: "Lightning Bolt", targetIds: ["local-player"] } }), 1, false],
    ["sorcery with multiple targets chosen", stackSession({ stackObject: { name: "Decimate", targetIds: ["a", "b", "c", "d"] } }), 1, false],
    ["spell with modes chosen", stackSession({ stackObject: { name: "Charm", selectedModes: ["draw"] } }), 1, false],
    ["spell with X chosen", stackSession({ stackObject: { name: "Exsanguinate", xValue: 5 } }), 1, false],
    ["spell creating tokens", stackSession({ stackObject: { name: "Secure the Wastes" } }), 1, false],
    ["spell adding counters", stackSession({ stackObject: { name: "Hardened Scales Event" } }), 1, false],
    ["spell creating multiple automatic triggers", { ...stackSession(), triggerQueue: [{ id: "t1" }, { id: "t2" }] }, 1, false],
    ["counterspell on stack", stackSession({ stackDepth: 2, stackObject: { name: "Counterspell" } }), 1, false],
    ["spell copied on stack", stackSession({ stackDepth: 2, stackObject: { name: "Reverberate" } }), 1, false],
    ["replacement effect requires choice", stackSession({ pending: [pendingDecision("replacement-effect")] }), 0, true],
    ["commander cast with tax", stackSession({ stackObject: { name: "Commander", sourceZone: "command" } }), 1, false],
    ["commander replacement choice", stackSession({ pending: [pendingDecision("commander-replacement")] }), 0, true],
    ["board wipe", stackSession({ stackObject: { name: "Wrath of God" } }), 1, false],
    ["mass token event", stackSession({ stackObject: { name: "Avenger of Zendikar" } }), 1, false],
    ["nested stack responses", stackSession({ stackDepth: 3, stackObject: { name: "Top Response" } }), 1, false],
  ];

  for (const [name, session, expectedResolves, expectsDecision] of cases) {
    const plan = createResolveInteractionPlan(session, { mode: GAMEPLAY_MODES.liveTracking });
    assert.equal(plan.requiredResolveInteractions, expectedResolves, name);
    assert.equal(Boolean(plan.nextDecision), expectsDecision, name);
    assert.equal(plan.spellSubstepsAreStackObjects, false, name);
    if (session.stack.length > 1) {
      assert.equal(plan.repeatedResolveAllowed, true, name);
      assert.equal(plan.repeatedResolveReason, "independent-stack-objects-remain", name);
    }
  }
});

test("effect engine presentations carry stable event identity and one Resolve clears uncontested spells", () => {
  let session = castSpellToStack(createGameSession(), {
    name: "Sol Ring",
    typeLine: "Artifact",
    oracleText: "{T}: Add {C}{C}.",
  });
  const castEventId = session.stack[0].eventId;

  assert.equal(session.presentation.presentationRole, CARD_PRESENTATION_ROLES.castingPreview);
  assert.equal(session.presentation.eventId, castEventId);
  assert.equal(session.presentation.shouldReplayOnRender, false);

  session = resolveTopOfStack(session, { stackId: session.stack[0].id });
  assert.equal(session.stack.length, 0);
  assert.equal(session.battlefield.player.some((permanent) => permanent.name === "Sol Ring"), true);
  assert.equal(session.presentation.presentationRole, CARD_PRESENTATION_ROLES.battlefieldPermanent);
  assert.equal(session.presentation.shouldReplayOnRender, false);

  const pipeline = createPostResolveDecisionPipeline(session);
  assert.equal(pipeline.askResolveAgainForSameObject, false);
  assert.equal(pipeline.replayOriginalAnimation, false);
});

test("direct land, life, counter, and token-style changes do not create Resolve requirements", () => {
  let profile = createDefaultProfile();
  profile = reduceProfile(profile, createAction({
    type: "ADD_PERMANENT",
    card: { name: "Forest", typeLine: "Basic Land - Forest" },
  }, profile));

  assert.equal(profile.activeSession.stack.length, 0);
  assert.equal(profile.activeSession.battlefield.player.some((permanent) => permanent.name === "Forest"), true);
  assert.equal(profile.activeSession.presentation.kind, "land-played");
  assert.equal(profile.activeSession.presentation.presentationRole, CARD_PRESENTATION_ROLES.battlefieldPermanent);

  profile = reduceProfile(profile, createAction({ type: "LIFE_DELTA", amount: -3 }, profile));
  assert.equal(profile.activeSession.life, 37);

  const forest = profile.activeSession.battlefield.player.find((permanent) => permanent.name === "Forest");
  profile = reduceProfile(profile, createAction({ type: "ADD_COUNTER", id: forest.id, counterType: "Charge", amount: 1 }, profile));
  const updatedForest = profile.activeSession.battlefield.player.find((permanent) => permanent.id === forest.id);
  assert.equal(updatedForest.counters.Charge, 1);
  assert.equal(createResolveInteractionPlan(profile.activeSession, { actionKind: "counter-change" }).requiredResolveInteractions, 0);
});

test("animation idempotence ledger prevents event replay after unrelated UI changes", () => {
  const presentation = createCardPresentationPayload(
    { id: "bolt", name: "Lightning Bolt", typeLine: "Instant" },
    "cast",
    "player",
    { eventId: "event:cast:bolt", createdAt: 1000 }
  );
  let ledger = createPresentationLedger();
  assert.equal(shouldPlayPresentationEvent(ledger, presentation), true);

  ledger = markPresentationEventPlayed(ledger, presentation);
  assert.equal(shouldPlayPresentationEvent(ledger, presentation), false);

  const unrelatedUpdates = ["command-hand-rotation", "notification-received", "inspection-opened", "opponent-switched", "trigger-queue-updated"];
  for (const update of unrelatedUpdates) {
    const rerendered = { ...presentation, unrelatedUpdate: update };
    assert.equal(shouldPlayPresentationEvent(ledger, rerendered), false, update);
  }
});

test("preview roles keep battlefield permanents, cast previews, inspection previews, and stack objects distinct", () => {
  const permanent = createPermanent({ id: "sol-ring", name: "Sol Ring", typeLine: "Artifact" });
  const battlefield = createCardLifecycleSnapshot(permanent, "battlefield");
  const casting = createCardPresentationPayload(permanent, "cast", "player", { eventId: "cast-sol-ring" });
  const stackObject = createCardLifecycleSnapshot(permanent, "on-stack");
  const inspection = createPreviewState(CARD_PRESENTATION_ROLES.inspectionPreview, permanent, {
    focusedOpponentId: "alpha",
    commandHandFocusedId: "inspect",
    selectedIds: [permanent.id],
    zoneScrollPositions: { "player:creature-zone": 40 },
  });
  const dismissed = dismissPreviewState(inspection);

  assert.equal(battlefield.presentationRole, CARD_PRESENTATION_ROLES.battlefieldPermanent);
  assert.equal(casting.presentationRole, CARD_PRESENTATION_ROLES.castingPreview);
  assert.equal(stackObject.presentationRole, CARD_PRESENTATION_ROLES.stackObject);
  assert.equal(inspection.deliberate, true);
  assert.equal(inspection.mutatesAuthoritativeState, false);
  assert.equal(dismissed.restoredContext.focusedOpponentId, "alpha");
  assert.equal(dismissed.mutatesAuthoritativeState, false);
});

test("trigger, replacement, and trigger-flood presentation classify automatic work separately from decisions", () => {
  const automaticTriggers = Array.from({ length: 8 }, (_, index) => ({
    id: `trigger-auto-${index}`,
    sourceName: "Soul Warden",
    eventType: "ENTER_BATTLEFIELD",
    effectDefinitions: [{ action: "life", amount: 1 }],
  }));
  const optionalTrigger = {
    id: "trigger-may",
    sourceName: "Rhystic Study",
    optional: true,
    effectDefinitions: [{ action: "draw", optional: true }],
  };
  const manualTrigger = {
    id: "trigger-target",
    sourceName: "Acidic Slime",
    effectDefinitions: [{ action: "remove-permanent", manual: true, target: "target-permanent" }],
  };
  const plan = createTriggerPresentationPlan([...automaticTriggers, optionalTrigger, manualTrigger]);

  assert.equal(classifyTriggerForPresentation(automaticTriggers[0]).automatic, true);
  assert.equal(classifyTriggerForPresentation(optionalTrigger).kind, "optional-trigger");
  assert.equal(plan.autoProcessWithoutPrompt, 8);
  assert.equal(plan.promptCount, 2);
  assert.equal(plan.batchAutomaticPresentation, true);
  assert.equal(plan.preventNotificationFlood, true);
  assert.equal(isReplacementEffectStackObject({ kind: "replacement", action: "double-tokens" }), false);
  assert.equal(isReplacementEffectStackObject({ kind: "replacement", stackBehavior: "stack" }), true);
});

test("notification and helper communication yield to protected gameplay focus", () => {
  const castingSession = {
    ...createGameSession(),
    presentation: createCardPresentationPayload(
      { id: "spell", name: "Cultivate", typeLine: "Sorcery" },
      "cast",
      "player",
      { eventId: "event-cultivate" }
    ),
  };
  const focus = resolveGameplayAttentionOwner({ session: castingSession, helper: true });
  const social = { category: "friend", severity: "info", title: "Friend joined" };
  const educational = { category: "tutorial", severity: "info", title: "Tip" };
  const gameplay = { category: "gameplay", severity: "warning", title: "Manual choice" };
  const critical = { category: "system", severity: "error", title: "Storage failed" };

  assert.equal(focus.owner, "active-casting-resolution");
  assert.equal(shouldDeferNotification(social, { session: castingSession }).defer, true);
  assert.equal(shouldDeferNotification(educational, { session: castingSession }).defer, true);
  assert.equal(shouldDeferNotification(gameplay, { session: castingSession }).defer, false);
  assert.equal(shouldDeferNotification(critical, { session: castingSession }).defer, false);
  assert.equal(classifyNotificationPriority(critical), NOTIFICATION_PRIORITY_LEVELS.critical);
});

test("replay observations and lifecycle events remain presentation of history, not second execution", () => {
  const event = createGameplayLifecycleEvent({
    eventType: GAMEPLAY_EVENT_TYPES.resolve,
    card: { id: "wrath", name: "Wrath of God" },
    fromZone: "stack",
    toZone: "graveyard",
    stackObjectId: "stack-wrath",
    timestamp: 20,
  });
  const replay = createReplayObservation(event);

  assert.equal(event.presentationOnly, false);
  assert.equal(replay.observationalOnly, true);
  assert.equal(replay.mutatesAuthoritativeState, false);
  assert.equal(replay.executesRules, false);
  assert.equal(replay.sourceEvent.eventId, event.eventId);
});

test("Full Control and Live Tracking keep equivalent authoritative outcomes while interaction depth differs", () => {
  const authoritativeState = {
    life: 37,
    battlefield: { player: ["Sol Ring"], opponent: [] },
    stack: [],
    zones: { graveyard: ["Lightning Bolt"] },
  };
  const parity = assertModeParityOutcome(
    { authoritativeState, requiredResolveInteractions: 1, mode: GAMEPLAY_MODES.liveTracking },
    { authoritativeState, requiredResolveInteractions: 3, mode: GAMEPLAY_MODES.fullControl }
  );

  assert.equal(parity.authoritativeRulesMatch, true);
  assert.equal(parity.interactionDepthMayDiffer, true);
});

test("battlefield model and renderer expose Part 3 lifecycle architecture without web-only gameplay logic", () => {
  const model = createLandscapeBattlefieldModel(createDefaultProfile(), { viewport: "desktop" });
  const render = readRepositoryFile("src/ui/render.js");
  const doc = readRepositoryFile("docs/ecosystem/CANONICAL_GAMEPLAY_ARCHITECTURE.md");

  assert.equal(model.canonicalGameplay.cardLifecycle.version, CANONICAL_CARD_LIFECYCLE_VERSION);
  assert.equal(model.canonicalGameplay.cardLifecycle.presentationStateIsRulesAuthority, false);
  assert.equal(model.gameplayFlow.modePolicy.rulesEngineShared, true);
  assert.equal(model.gameplayFlow.resolvePlan.spellSubstepsAreStackObjects, false);
  assert.match(render, /data-card-lifecycle-version/);
  assert.match(render, /data-presentation-event-id/);
  assert.match(render, /shouldDeferNotification/);
  assert.match(doc, /Live Tracking versus Full Control policy separation/i);
  assert.match(doc, /Event identity/i);
});
