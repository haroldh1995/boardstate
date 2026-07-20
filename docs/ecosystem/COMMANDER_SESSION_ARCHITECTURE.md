# Commander Session Architecture

Date: 2026-07-19

This document records the Prompt 2 canonical Commander session foundation. BoardState remains the gameplay and rules authority; the future Hub may coordinate launch, discovery, profile, friend, tournament, notification, and backup workflows, but it is not a rules or game-state authority.

## Implemented Boundaries

- Canonical session ownership: `src/shared-contracts/contracts.js` still owns `createSharedGameSession()`. `src/shared-contracts/commanderSession.js` extends that contract with Commander session topology instead of creating a second game state.
- Runtime session defaults: `src/state/schema.js` now initializes session lifecycle, participants, seats, seat order, independent turn order, visibility policy, reconnect metadata, capability manifest, and Commander session metadata on `createGameSession()`.
- Runtime adapters: `src/shared-contracts/adapters.js` preserves participant, seat, turn-order, revision, capability, visibility, reconnect, and Commander metadata when converting between `profile.activeSession` and shared sessions.
- Save/load: `src/storage/saveState.js` preserves Commander session topology and metadata in local save envelopes while keeping existing save compatibility paths.
- Sync projection: `src/multiplayer/syncManager.js` shares privacy-safe participant, seat, lifecycle, revision, reconnect, and capability metadata without exposing hidden zones or private credentials.

## Participant, Player, And Seat

- Participants represent humans, AI agents, tutorial agents, local guests, spectators, or external-app participants. `createParticipantReference()` records `participantId`, optional profile reference, role, permissions, connection status, client references, local/remote relationship, capabilities, visibility grants, controlled player IDs, spectator metadata, and source app.
- Players represent in-game rules-engine entities. `createCanonicalPlayer()` now carries `participantId`, `seatId`, life, poison, energy, commander damage, Commander source IDs, per-commander tax/cast/zone metadata, priority eligibility, turn eligibility, elimination, concession, deck snapshot references, and public/private metadata references.
- Seats are stable table positions, not array indexes. `createSeatReference()` records `seatId`, table/display order, occupancy, assigned player/participant, previous/next seat, and carousel order. `linkSeatTraversal()` makes traversal loop across the table.

## Identity And Ordering

- Stable ID support lives in `src/shared-contracts/ids.js` and includes application, session, game, participant, player, seat, profile, client, connection, deck snapshot, invitation, tournament, replay, backup, rule amendment, sync revision, card, permanent, stack object, trigger, choice, action, event, save, and notification IDs.
- Seat order is kept in `session.seatOrder`; turn order is kept separately in `session.turnOrder` and `session.turnState`. Extra turns, skipped turns, controlled turns, elimination, and concession can alter turn eligibility without reordering seats.
- Raw array indexes, display names, and UI positions are not valid persistent identities for canonical session architecture.

## Commander State

- `createCommanderSession()` and `createCommanderSessionState()` model one commander, partners, backgrounds, and multiple Commander objects through stable commander source IDs.
- Commander tax, cast count, current zone, and damage are keyed by commander source identity, not card name or a fixed player matrix.
- `getCommanderSources()` and `getCommanderDamage()` provide stable selectors for Prompt 3 event knowledge and Prompt 4/5 battlefield work.

## Perspective And Visibility

- `buildLocalPerspectiveProjection()` derives local participant, controlled players, local seat, opponents, seat-relative carousel order, top/bottom battlefield owners, active player, priority holder, visible zones, permissions, and reconnect state without mutating the canonical session.
- `getVisibleZonesForPerspective()` enforces public, owner-visible, controller-visible, explicitly revealed, participant-specific, spectator, and Live Tracking unknown boundaries before projection output is used by UI or sync.
- `projectSessionForParticipant()` returns privacy-safe public summaries and redacted zone data for unauthorized viewers. Hosts and spectators do not receive hidden zones by default.

## Roles, Permissions, And Reconnect

- Roles are `host`, `player`, `spectator`, `ai-agent`, `tutorial-agent`, and `local-guest`. Default permissions live in `DEFAULT_PERMISSIONS_BY_ROLE`.
- `canParticipantSubmitAction()` blocks spectators, unauthorized cross-player control, host-only rule imposition, and Rule Amendment application without unanimous approval.
- `applyParticipantDisconnect()` and `applyParticipantReconnect()` preserve participant, player, seat, priority, pending decision, and revision identity. The current trust model is documented as `local-session-reference`; cryptographic identity is not claimed.

## Lifecycle, Revisions, And Capabilities

- `SESSION_LIFECYCLE_STATES` covers setup, lobby, ready check, initializing, active, paused, reconnecting, suspended, completed, abandoned, archived, corrupted, incompatible, replay-only, and recovery-required states.
- Shared sessions preserve `revision`, `gameStateRevision`, and `eventRevision`. Sync public state exposes revision metadata for stale/duplicate event handling without replacing the current transport.
- `createCapabilityManifest()` reports BoardState as the rules authority with canonical session, Live Tracking input readiness, Full Control input readiness, spectator role, hidden-information filtering, ten-player Commander, offline support, and future compatibility seams. It keeps live Hub, Deck Nexus, and BoardState Lite links false.

## Ecosystem Contracts

- `createSessionReference()` emits privacy-safe session summaries for future Hub/Lite/Nexus handoffs.
- `createParticipantReference()` and `createSeatReference()` provide stable external references without hidden gameplay state.
- `createDeckSnapshotReference()` records immutable Deck Nexus-compatible snapshot identity, source references, commander references, card-data version, and integrity hash without depending on a mutable live deck.
- `createLaunchContext()` and `createReturnContext()` validate future external launch/return boundaries while avoiding fake Hub endpoints or success states.
- `validateCapabilityManifest()` rejects live Hub, live Deck Nexus, or live BoardState Lite handoff claims during this preparation phase.

## Legacy Migration

- `migrateLegacySessionToCommanderSession()` adds canonical participants, seats, turn order, Commander metadata, perspective metadata, and visibility defaults while preserving the original legacy session separately.
- Legacy saves without the new metadata still load through existing save normalization and receive safe defaults. The migration path does not delete, overwrite, or destructively transform the only copy of legacy data.

## Tests

- `test/fixtures/commanderSessionFixtures.js` provides two-player, four-player, ten-player, partner/background Commander, local/remote, AI, spectator, disconnected/reconnecting, Deck Nexus snapshot, hidden-zone, and legacy migration fixtures.
- `test/commander-session-architecture.test.js` covers stable identity, serialization, player counts, seat traversal, seat-versus-turn order, elimination, concession, Commander tax/damage, local perspective, hidden information, role permissions, reconnect, public summaries, immutable Deck Nexus references, launch/return contexts, and legacy migration/save compatibility.

## Deferred Work

- Prompt 3 will promote existing action, event, effect, sync, replay, and rules trace data into the Event Knowledge Engine.
- Prompt 4 will modernize the landscape battlefield using this canonical session and existing BoardState background.
- Prompt 5 will implement the opponent carousel and Battlefield Camera System over `seatOrder`, `turnOrder`, and local perspectives.
- Prompt 6 will wire Full Control and Live Tracking input models over this same canonical session and rules engine.
- Later roadmap prompts will add Question System, Remind Me/replay, Rules Recovery/unanimous amendments, AI integration, Hub/Lite/Nexus interoperability, performance/accessibility, visual polish, and final production audit without making external apps authoritative.
