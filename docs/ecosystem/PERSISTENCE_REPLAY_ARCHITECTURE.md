# Persistence, Replay, Save Architecture And Game Recovery

Date: 2026-07-20

This document records the Prompt 4 persistence foundation. It modernizes existing local saves, replay snapshots, undo/redo snapshots, recovery logs, shared save envelopes, sync revisions, and Prompt 3 Event Knowledge records in place. It does not redesign gameplay or the UI.

## Continuity Findings

BoardState already had reusable persistence and replay foundations:

- local profile persistence in `src/storage/localDatabase.js`
- local save creation, loading, import, export, and validation in `src/storage/saveState.js`
- canonical save envelopes in `src/shared-contracts/contracts.js`, `src/shared-contracts/adapters.js`, and `src/shared-contracts/validation.js`
- replay and undo snapshots in `src/state/gameReducer.js`
- recovery entries in `activeSession.recoveryLog`
- Event Knowledge state, snapshots, event groups, provenance, and reconstruction helpers in `src/authoritative-core/eventKnowledgeEngine.js`
- State Engine snapshots and revision metadata in `src/authoritative-core/stateEngine.js`
- multiplayer revision and public sync summaries in `src/multiplayer/syncManager.js`

Prompt 4 keeps these working systems and adds a canonical persistence layer instead of creating a second save stack.

## Canonical Persistence Layer

Implementation lives in `src/persistence/canonicalPersistence.js`.

The canonical save model records:

- session metadata
- rules version
- game metadata
- player metadata
- deck metadata
- State Engine snapshot
- Event Knowledge event history
- replay metadata
- confidence metadata
- Rule Amendment history placeholders
- synchronization metadata
- undo/redo dependency metadata
- checkpoint metadata
- auto-save metadata
- recovery metadata
- future expansion fields

The local save system in `src/storage/saveState.js` embeds this canonical save while preserving the existing local save shape for backward compatibility.

## Save Philosophy

Canonical saves persist gameplay, not presentation.

`createPersistenceStateSnapshot()` removes transient presentation data including active card presentation, camera placeholders, animation placeholders, visual transition placeholders, runtime queues, transient selections, and Advanced multiplayer presentation events. Existing legacy local save payloads still embed the full active session for compatibility, but the canonical save model is the future persistence authority.

## Checkpoints

Checkpoints are created through `createCheckpoint()` and appended by `recordPersistenceAfterAction()`.

Supported checkpoint reasons are:

- beginning of game
- beginning of turn
- beginning of phase
- before spell resolves
- after completed stack
- before elimination
- before game ending
- manual
- recovery

Checkpoints accelerate replay and recovery. They do not replace Event Knowledge history.

## Replay Architecture

Replay architecture is data-first and UI-independent.

`buildReplayTimeline()` exposes replay modes, playback speeds, event jumps, turn jumps, phase jumps, checkpoint jumps, event summaries, groups, and checkpoints.

`reconstructReplayState()` reconstructs from Event Knowledge snapshots when available and falls back to the nearest checkpoint with a deterministic replay plan for events after that checkpoint.

Supported modes are full replay, turn replay, phase replay, combat replay, stack replay, player replay, and event replay. Supported speed identifiers are pause, step, normal, 2x, 4x, and 8x.

## Versioning And Migration

Every canonical save records:

- `canonicalSaveVersion`
- `saveFormatVersion`
- `schemaVersion`
- `rulesEngineVersion`
- `engineVersion`
- `eventKnowledgeEngineVersion`
- `replayVersion`
- `serializationVersion`
- `migrationVersion`

`migrateCanonicalSave()` upgrades recoverable legacy local saves into canonical saves while preserving the original legacy input. Migration failure returns explicit errors and does not mutate the only copy of legacy data.

## Auto Save And Recovery

`createAutoSaveState()` supports configurable auto-save policies:

- every action
- every priority change
- every spell
- every turn
- every phase
- manual only

The browser profile persistence path in `src/storage/localDatabase.js` continues to save the whole profile after dispatch. Prompt 4 adds canonical auto-save and recovery metadata inside the session so later UI and recovery tooling can distinguish checkpointed, clean, and recovered states without changing gameplay authority.

## Import, Export, And Corruption Detection

`parseImportedCanonicalSave()` validates imported canonical or legacy save payloads, rejects malformed JSON, rejects oversized payloads, and migrates recoverable legacy saves.

`createPersistenceExportBundle()` and `createReplayExport()` prepare versioned export bundles for future replay, bug reports, judge review, tournament archives, statistics, spectator packages, and training data.

`validateCanonicalSave()` detects missing versions, unsupported versions, duplicate event IDs, missing checkpoint snapshots, invalid checkpoint checksums, invalid canonical checksums, duplicate object identities, presentation-state leakage, and unsafe private fields. It does not silently continue after corruption.

## Synchronization

`src/multiplayer/syncManager.js` now includes a privacy-safe persistence summary in public sync state: persistence version, canonical save version, replay version, checkpoint count, latest checkpoint ID, and recovery status. It does not expose hidden zones, full checkpoints, or private recovery payloads.

## Tests

Focused tests live in `test/persistence-replay.test.js`. They cover:

- canonical save creation and validation
- presentation-state exclusion
- checkpoint creation
- replay timeline construction
- reconstruction paths
- auto-save policies
- local save integration
- replay export validation
- legacy migration
- malformed import rejection
- duplicate object detection
- private field rejection
- reducer integration with Event Knowledge and checkpoints

Existing regression tests continue to cover local save compatibility, tutorial autosaves, replay-to-action, undo/redo, shared contracts, rules behavior, simulation, and multiplayer synchronization.

## Deferred Work

Prompt 4 does not build the visual replay UI, battlefield replay animation, Question System, Remind Me timeline, Rules Recovery behavior, AI behavior changes, camera, carousel, or battlefield redesign. Later prompts must consume this persistence foundation rather than creating parallel save or replay formats.
