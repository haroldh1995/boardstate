import test from "node:test";
import assert from "node:assert/strict";

import {
  CONFIDENCE_ENGINE_VERSION,
  PROACTIVE_ASSISTANT_VERSION,
  REMIND_ME_ENGINE_VERSION,
  RULE_AMENDMENT_SYSTEM_VERSION,
  buildConfidenceReport,
  createMissedTriggerRecoveryReport,
  createProactiveAssistantState,
  createReminder,
  createRuleAmendmentProposal,
  detectGameplayOpportunities,
  evaluateReminderSet,
  recordRuleAmendmentVote,
} from "../src/authoritative-core/proactiveAssistant.js";
import {
  createEventKnowledgeState,
  createKnowledgeEvent,
} from "../src/authoritative-core/eventKnowledgeEngine.js";
import { createDefaultProfile, createPermanent } from "../src/state/schema.js";
import { reduceProfile } from "../src/state/gameReducer.js";
import { buildLocalSave } from "../src/storage/saveState.js";
import { createCommanderTestSession } from "./fixtures/commanderSessionFixtures.js";

function createAssistantSession() {
  const profile = createDefaultProfile();
  const commander = createPermanent({
    id: "local-commander",
    name: "Astra, Dawn Marshal",
    typeLine: "Legendary Creature - Human Soldier",
    oracleText: "Vigilance.",
    isCommander: true,
    controller: "local-player",
    owner: "local-player",
    zone: "battlefield",
    currentPower: 3,
    currentToughness: 4,
  });
  const triggerEvent = createKnowledgeEvent({
    sessionId: "session-remind-me",
    gameId: "game-remind-me",
    eventId: "event-trigger-created",
    eventType: "TRIGGER_CREATED",
    summary: "Upkeep trigger was created",
    tags: ["trigger"],
    turn: 3,
    phase: "Beginning",
    playerId: "local-player",
    objectNames: ["Astra, Dawn Marshal"],
  });
  return {
    ...profile.activeSession,
    sessionId: "session-remind-me",
    gameId: "game-remind-me",
    turn: 3,
    phaseIndex: 2,
    commander: {
      name: "Astra, Dawn Marshal",
      cardId: "local-commander",
      zone: "battlefield",
      castCount: 1,
      commanderTax: 2,
    },
    battlefield: {
      ...profile.activeSession.battlefield,
      player: [
        commander,
        createPermanent({
          id: "local-creature",
          name: "Skyguard",
          typeLine: "Creature - Bird",
          controller: "local-player",
          owner: "local-player",
          currentPower: 2,
          currentToughness: 2,
        }),
      ],
      opponent: [],
    },
    manaPool: { W: 1, U: 0, B: 0, R: 0, G: 2, C: 0, Generic: 0 },
    stack: [
      {
        id: "stack-removal",
        name: "Swords to Plowshares",
        controllerPlayerId: "opponent-player",
        targetIds: ["local-commander"],
      },
    ],
    triggerQueue: [
      {
        id: "trigger-upkeep",
        sourceName: "Astra, Dawn Marshal",
        eventType: "upkeep",
        status: "pending",
        optional: false,
        createdTurn: 2,
      },
    ],
    eventKnowledge: createEventKnowledgeState({
      events: [triggerEvent],
    }),
  };
}

test("proactive assistant evaluates contextual reminders without mutating game state", () => {
  const session = createAssistantSession();
  const reminder = createReminder({
    text: "Remind me if anyone targets my commander.",
    createdAt: 100,
  }, session);
  const before = JSON.stringify(session);
  const result = evaluateReminderSet(session, [reminder], { at: 200 });
  const model = createProactiveAssistantState({
    ...session,
    remindMe: { reminders: [reminder] },
  }, { at: 200 });

  assert.equal(reminder.version, REMIND_ME_ENGINE_VERSION);
  assert.equal(result.dueNotifications.length >= 1, true);
  assert.equal(model.version, PROACTIVE_ASSISTANT_VERSION);
  assert.equal(model.boundaries.recommendationsDoNotPlayForUser, true);
  assert.equal(model.strategicAdviceEnabled, false);
  assert.ok(model.notifications.some((entry) => /Commander is being targeted/i.test(entry.title)));
  assert.equal(JSON.stringify(session), before);
});

test("confidence engine reports knowns, uncertainty, waivers, sync, and replay state", () => {
  const session = {
    ...createAssistantSession(),
    enforcementMode: "waived",
    activeRuleWaivers: [{ waiverId: "waiver-1" }],
    pendingEffects: [{ id: "choice-1", status: "pending", reason: "Manual resolution required" }],
    zones: {
      ...createAssistantSession().zones,
      unknownCounts: { hand: 2, library: 5 },
    },
    syncedMultiplayer: { active: true },
    participants: [
      { participantId: "participant-local", controlledPlayerIds: ["local-player"], connectionStatus: "local" },
      { participantId: "participant-away", controlledPlayerIds: ["opponent-player"], connectionStatus: "disconnected" },
    ],
  };
  const report = buildConfidenceReport(session, { at: 300 });

  assert.equal(report.version, CONFIDENCE_ENGINE_VERSION);
  assert.equal(report.overall.needsAttention, true);
  assert.equal(report.dimensions.information.level, "inferred");
  assert.equal(report.dimensions.execution.level, "enforcement-waived");
  assert.equal(report.dimensions.synchronization.level, "estimated");
  assert.ok(report.dimensions.information.uncertain.some((entry) => /hidden or unknown zone/i.test(entry)));
});

test("rule amendment system requires unanimous approval and rejects executable text", () => {
  const session = createCommanderTestSession(4);
  const unsafe = createRuleAmendmentProposal({
    proposedText: "<script>alert(1)</script>",
    sourceText: "<script>alert(1)</script>",
  }, session);
  assert.equal(unsafe.status, "needs-revision");
  assert.equal(unsafe.validation.valid, false);

  let proposal = createRuleAmendmentProposal({
    proposedText: "Table ruling: this copied trigger resolves once for this interaction.",
    sourceText: "Official ruling text discussed at the table.",
    proposedByPlayerId: "player-a",
    createdAt: 400,
  }, session);
  assert.equal(proposal.version, RULE_AMENDMENT_SYSTEM_VERSION);
  assert.equal(proposal.status, "pending-unanimous-approval");
  assert.equal(proposal.majorityApprovalAllowed, false);

  proposal = recordRuleAmendmentVote(proposal, { playerId: "player-a", vote: "approve", votedAt: 401 });
  proposal = recordRuleAmendmentVote(proposal, { playerId: "player-b", vote: "approve", votedAt: 402 });
  proposal = recordRuleAmendmentVote(proposal, { playerId: "player-c", vote: "approve", votedAt: 403 });
  assert.equal(proposal.status, "pending-unanimous-approval");
  assert.deepEqual(proposal.approvalReport.missingApprovals, ["player-d"]);

  proposal = recordRuleAmendmentVote(proposal, { playerId: "player-d", vote: "approve", votedAt: 404 });
  assert.equal(proposal.status, "accepted");
  assert.equal(proposal.applicationStatus, "accepted-not-applied-to-state");

  const rejected = recordRuleAmendmentVote(proposal, { playerId: "player-c", vote: "reject", votedAt: 405 });
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.mutatesAuthoritativeState, false);
});

test("missed trigger recovery and opportunity detection are non-strategic", () => {
  const session = createAssistantSession();
  const recovery = createMissedTriggerRecoveryReport(session, { at: 500 });
  const opportunities = detectGameplayOpportunities(session);

  assert.equal(recovery.pendingCount, 1);
  assert.equal(recovery.likelyMissedCount, 1);
  assert.equal(recovery.items[0].mandatory, true);
  assert.ok(recovery.items[0].recoveryOptions.length >= 2);
  assert.ok(opportunities.some((entry) => entry.opportunityId === "mana:floating"));
  assert.ok(opportunities.every((entry) => entry.strategyAdvice === false));
});

test("reducer stores reminders and table ruling proposals without losing save compatibility", () => {
  let profile = createDefaultProfile();
  profile.activeSession = {
    ...createCommanderTestSession(2),
    battlefield: profile.activeSession.battlefield,
    manaPool: profile.activeSession.manaPool,
    helper: profile.activeSession.helper,
    simulation: profile.activeSession.simulation,
    tutorial: profile.activeSession.tutorial,
    syncedMultiplayer: profile.activeSession.syncedMultiplayer,
    gameTracking: profile.activeSession.gameTracking,
  };
  profile = reduceProfile(profile, {
    type: "REMIND_ME_ADD",
    reminder: {
      text: "Remind me before combat.",
      createdAt: 600,
    },
  });
  assert.equal(profile.activeSession.remindMe.reminders.length, 1);

  profile = reduceProfile(profile, {
    type: "RULE_AMENDMENT_PROPOSE",
    proposal: {
      proposedText: "Table ruling: resolve this missed trigger now.",
      sourceText: "Table discussion.",
      proposedByPlayerId: "player-a",
      createdAt: 601,
    },
  });
  assert.equal(profile.activeSession.ruleAmendments.proposals.length, 1);
  assert.equal(profile.activeSession.ruleAmendments.proposals[0].status, "pending-unanimous-approval");

  const save = buildLocalSave(profile, { saveId: "save-remind-me", createdAt: 700, updatedAt: 700 });
  assert.equal(save.gameState.activeSession.remindMe.reminders.length, 1);
  assert.equal(save.metadata.ruleAmendments.approvalPolicy, "unanimous");
  assert.equal(save.metadata.remindMe.reminderCount, 1);
});
