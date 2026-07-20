# Authoritative Core Architecture

Date: 2026-07-20

This document records the Prompt 3 authoritative backend foundation. It modernizes existing BoardState systems in place. It does not redesign gameplay or the UI.

## Continuity Findings

BoardState already had reusable rules, state, event, replay, undo, save, sync, tutorial, and simulation foundations:

- Rules authority: `src/rules-engine/engine.js`, `src/rules-engine/boardStateAdapter.js`, `src/effects/effectEngine.js`, `src/game/combatSystem.js`, `src/game/manaSystem.js`, `src/game/fsm.js`, `src/effects/targeting.js`, and `src/effects/layerSystem.js`.
- State authority: `src/state/schema.js`, `src/state/store.js`, `src/state/gameReducer.js`, `src/state/actions.js`, and the canonical Commander session adapters.
- Event/history evidence: `src/game/eventBus.js`, `activeSession.history`, `actionHistory`, `eventHistory`, `effectLog`, `recoveryLog`, `rulesConfidenceLog`, `undoStack`, `redoStack`, replay snapshots, simulation logs, sync metadata, and save envelopes.

Prompt 3 promotes those existing systems into explicit authoritative boundaries instead of creating parallel engines.

## Rules Engine

The Rules Engine answers: What is legal?

Implementation remains in `src/rules-engine/`. It owns legality validation, priority/stack legality, target legality, trigger generation, replacement/prevention hooks where implemented, state-based action helpers, continuous effect/layer evaluation, commander-specific legality hooks, mana validation, combat legality, and turn-structure validation. It must not directly own mutable gameplay state.

The reducer and future input systems should route rules-sensitive actions through the rules-engine boundary and adapters instead of making UI-driven legality decisions authoritative.

## State Engine

The State Engine answers: What is true right now?

Implementation lives in `src/authoritative-core/stateEngine.js` and is integrated into runtime sessions through `src/state/schema.js` and `src/state/gameReducer.js`.

The State Engine:

- declares the mutable state ownership boundary through `STATE_ENGINE_OWNED_FIELDS`
- creates `stateEngine` metadata on every new session
- commits state transitions with `commitStateTransition()`
- maintains `gameStateRevision`, `stateEngine.revision`, `lastCommittedAt`, and `lastActionId`
- creates non-recursive snapshots for replay, reconstruction, bug reports, Dry Runs, AI, and future spectators
- validates that Hub is not gameplay authority and Event Knowledge is using the expected engine version

The current reducer remains the integration point for existing gameplay behavior, but committed runtime truth is now explicitly marked as State Engine owned.

## Event Knowledge Engine

The Event Knowledge Engine answers: How did we get here?

Implementation lives in `src/authoritative-core/eventKnowledgeEngine.js` and is integrated through `src/game/eventBus.js`, `src/state/gameReducer.js`, `src/storage/saveState.js`, and `src/multiplayer/syncManager.js`.

Each Event Knowledge entry records:

- immutable event ID, parent event ID, root event ID, event group ID, session ID, game ID, sync revision, and event version
- information confidence, execution confidence, importance, searchable tags, rule references, Rule Amendment references, and undo references
- Who, What, When, Where, Why, How, and What Changed sections
- replay metadata, synchronization metadata, AI metadata, Question System metadata, debugging metadata, and analytics metadata

Events are appended through `appendKnowledgeEvent()` and duplicate event IDs are ignored. Existing events are not edited. Corrections must be represented as new events.

## Authoritative Pipeline

`src/authoritative-core/authoritativePipeline.js` records the permanent pipeline:

1. Player Intent
2. Input Validation
3. Rules Engine
4. State Engine
5. Event Knowledge Engine
6. UI Rendering
7. Replay
8. AI
9. Synchronization
10. Question System
11. Remind Me
12. Analytics
13. Spectator Mode

`createAuthoritativePipelineReport()` exposes this pipeline for tests and future diagnostics. UI, Hub, Lite, Deck Nexus, AI, replay, sync, analytics, and spectators are not gameplay authorities.

## Event Groups And Provenance

`createEventGroup()` and `recordActionKnowledge()` group related transaction events by action and session. The current foundation records reducer actions and existing game-event-bus events into one Event Knowledge stream. Later prompts can expand each group into cast announcement, target selection, cost determination, mana payment, stack entry, responses, resolution, replacement effects, state-based actions, trigger placement, and priority return without changing the engine boundary.

Provenance is recorded in `why.originatingActionId`, `why.originatingRule`, `why.originatingTriggerId`, `why.originatingReplacementEffectId`, `why.causationChain`, `parentEventId`, and `rootEventId`.

## State Reconstruction

`reconstructStateAfterEvent(session, eventId)` reconstructs complete authoritative state after an Event Knowledge ID using event snapshots or existing action-history snapshots. Snapshots intentionally remove recursive event queues and large nested Event Knowledge event arrays.

This supports future replay, undo, Dry Runs, AI analysis, bug reports, spectators, Remind Me, and the Question System.

## Determinism

Event Knowledge IDs can be derived deterministically from session, group, parent/root, action, event type, and sequence via `createDeterministicKnowledgeId()`. Given stable action IDs, state, rules version, and inputs, the Event Knowledge layer produces stable event identity and grouping.

Existing runtime actions still use the repository's existing action ID creation path. Prompt 3 does not rewrite that proven action system.

## Synchronization And Saves

`src/multiplayer/syncManager.js` now includes privacy-safe Event Knowledge summaries in public sync state: engine version, event count, last event ID, and last event revision. It does not expose hidden zones or private event payloads.

`src/storage/saveState.js` preserves State Engine and Event Knowledge metadata in local saves while embedding the full active session for existing compatibility.

## Tests

Focused tests live in `test/authoritative-core.test.js`. They cover:

- permanent pipeline ownership
- Event Knowledge metadata, tags, importance, confidence, and immutability
- reducer integration with State Engine revisions
- reconstructable Event Knowledge snapshots
- duplicate event prevention
- canonical event metadata compatibility
- no UI/DOM/storage/network dependencies in authoritative-core modules
- non-recursive state snapshots

Existing regression tests continue to cover legality evaluation, trigger generation, replacement-adjacent effects, stack behavior, combat, synchronization, multiplayer consistency, tutorials, AI, saves, and deployment build behavior.

## Deferred Work

Prompt 3 does not redesign the battlefield, navigation, animations, camera, loading screens, wallpapers, artwork, styling, or visual effects.

Prompt 4 will harden persistence/replay/save architecture. Later prompts will expand Event Knowledge usage in battlefield replay, Question System answers, Remind Me timelines, Rules Recovery, AI reasoning, Hub/Lite/Nexus interoperability, analytics, and spectator mode.
