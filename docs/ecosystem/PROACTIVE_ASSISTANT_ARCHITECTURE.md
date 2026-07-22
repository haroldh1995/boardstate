# Proactive Assistant, Remind Me, Confidence, And Rule Amendments

Date: 2026-07-21

Prompt 10 adds BoardState's proactive Commander assistant without creating a second rules engine, state engine, event engine, reminder store, notification authority, or strategy coach.

## Implementation Paths

- `src/authoritative-core/proactiveAssistant.js` owns Remind Me evaluation, smart notification prioritization, confidence reporting, missed-trigger recovery summaries, legal opportunity detection, player-memory projection, and Rule Amendment proposal validation.
- `src/authoritative-core/eventKnowledgeEngine.js` remains the source of event provenance, replay evidence, rule references, confidence metadata, and immutable history.
- `src/state/schema.js` adds default `activeSession.remindMe`, `activeSession.ruleAmendments`, `settings.remindMe`, and `settings.playerMemory` state without migrating or deleting legacy data.
- `src/state/gameReducer.js` stores reminders, reminder dismissals, table-ruling proposals, and player votes through existing session mutation and action-history paths.
- `src/ui/landscapeBattlefield.js` exposes a non-authoritative `proactiveAssistant` model and the production `remind-me` context action.
- `src/ui/render.js` adds the Remind Me battlefield launcher and contextual panel for reminders, confidence, trigger recovery, non-strategic opportunities, player memory, and table ruling votes.

## Authority Boundary

The proactive assistant derives from BoardState's existing authoritative data:

- Rules Engine outcomes, enforcement mode, waiver state, manual choices, and trigger queue.
- State Engine current battlefield, stack, command zone, phase, priority, mana, counters, and Commander state.
- Event Knowledge Engine events, replay-safe IDs, causation, tags, and confidence metadata.
- Existing notifications and Helper Sprite remain reusable presentation paths. The proactive assistant does not make global Hub notifications authoritative.

The assistant does not play for the user, recommend strategy, use generative AI, run external searches, expose hidden zones, execute imported text, or mutate game state directly.

## Remind Me

`createReminder()`, `evaluateReminder()`, and `evaluateReminderSet()` support reminders for cards, permanents, commanders, opponents, turns, phases, triggers, life totals, battlefield states, rules, counters, mana, zones, and future watched states.

Reminder evaluation is contextual. A reminder can become due when phase, trigger, priority, target, zone-change, life-total, counter, mana, card-entering, attacking, or Commander attack conditions are visible in the tracked state. Completed, dismissed, expired, and snoozed reminders remain preserved in session data and timeline records.

## Confidence Engine

`buildConfidenceReport()` reports information, execution, rules, state, synchronization, replay, and AI-readiness confidence. It separates what is known from what is uncertain and explains what additional information would improve confidence.

The confidence engine never treats hidden or omitted Live Tracking information as known. Active waivers, manual choices, recovery issues, disconnected participants, and limited event history lower confidence honestly.

## Rule Amendments

`createRuleAmendmentProposal()`, `recordRuleAmendmentVote()`, and `evaluateRuleAmendmentProposal()` enforce the repository's unanimous-only amendment policy.

Rule Amendment boundaries:

- Official Magic rules remain canonical.
- Table amendments, temporary overrides, house rules, tournament exceptions, and judge decisions are clearly non-canonical.
- Majority approval is never enough.
- Rejected proposals are not applied.
- Accepted proposals are recorded as accepted but still do not mutate authoritative gameplay state directly.
- Source and proposal text are preserved as plain text and rejected if they contain script-like or executable content.

## Missed Trigger Recovery And Opportunities

`createMissedTriggerRecoveryReport()` identifies pending, delayed, and likely missed triggers with recovery options and player-responsibility guidance.

`detectGameplayOpportunities()` surfaces legal opportunities such as local priority, available attackers, floating mana, Commander recasts, optional triggers, and replacement choices. It is explicitly non-strategic and recommendation-only.

## Persistence And Saves

Reminders and Rule Amendments are included in normal session state, local saves, canonical save metadata, and persistence exports. Save compatibility is preserved because defaults are merged for older profiles and saves.

## Deferred Work

Prompt 10 does not add strategic AI coaching, voice assistance, spectator features, Hub services, external judge search, or a full Rules Recovery import interface. Later prompts must reuse this assistant boundary instead of creating disconnected reminder, confidence, or rule-amendment systems.
