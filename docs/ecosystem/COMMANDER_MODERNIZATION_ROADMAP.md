# Commander Modernization Roadmap

This roadmap preserves the existing BoardState application and evolves it in place. Each phase must follow `docs/ecosystem/BOARDSTATE_CONSTITUTION.md`: inspect first, reuse existing systems, refactor before replacing, extend before rebuilding, and avoid duplicate rules, state, event, save, sync, AI, tutorial, or bridge implementations.

## Completed Foundations

### Prompt 1: Repository Audit, Preservation Plan, And Foundation

- Audited existing architecture, state ownership, Commander and multiplayer limits, landscape battlefield, event/history systems, confidence/recovery handling, and Hub readiness.
- Preserved the current BoardState background, theme, gameplay, saves, sync, Dry Run, tutorials, and rules engine.
- Added low-risk shared contracts and compatibility utilities that later prompts can reuse.

### Prompt 2: Canonical Commander Session And Ten-Player Readiness

- `src/shared-contracts/commanderSession.js` adds canonical Commander session topology over `createSharedGameSession()` rather than creating a second game state.
- Stable IDs cover participants, seats, clients, connections, invitations, replays, backups, rule amendments, and sync revisions in `src/shared-contracts/ids.js`.
- `src/state/schema.js`, `src/shared-contracts/adapters.js`, `src/storage/saveState.js`, and `src/multiplayer/syncManager.js` preserve participants, players, seats, seat order, independent turn order, visibility policy, reconnect metadata, lifecycle, revisions, capabilities, and Commander metadata.
- One-player training/simulation remains a nonstandard safe state; canonical Commander/Brawl architecture validates two through ten active players.

### Prompt 2.5: Project Constitution, Architecture Charter, And Engineering Standards

- `docs/ecosystem/BOARDSTATE_CONSTITUTION.md` is the permanent project Constitution, ecosystem architecture, architecture charter, authoritative pipeline, engineering standard, UI philosophy, modernization strategy, continuity guide, and roadmap entry point.
- Future prompts must review the Constitution, prior audit, session architecture, and roadmap before changing code.

### Prompt 3: Authoritative Core Architecture And Event Knowledge Engine

- `src/authoritative-core/` now establishes the permanent State Engine, Event Knowledge Engine, and authoritative pipeline seams while preserving the existing rules engine and reducer/store integration.
- `src/game/eventBus.js` and `src/state/gameReducer.js` promote existing game events and action history into Event Knowledge records with provenance, event groups, confidence, tags, undo references, sync metadata, and reconstructable snapshots.
- `src/storage/saveState.js` and `src/multiplayer/syncManager.js` preserve or summarize State Engine and Event Knowledge metadata without exposing hidden information.
- `docs/ecosystem/AUTHORITATIVE_CORE_ARCHITECTURE.md` records the Prompt 3 architecture.

## Remaining Roadmap

### Prompt 4: Persistence, Replay And Save Architecture

- Harden the save envelope, replay references, event history references, migration metadata, imported snapshot references, backup metadata, and recovery paths.
- Preserve legacy saves and current local profile storage.
- Add version detection, migration attempts, backup preservation, compatibility reporting, and recovery/export paths where schemas change.

### Prompt 5: Commander Battlefield Modernization

- Modernize the existing landscape battlefield into the approved Commander-first layout without replacing the BoardState background or identity.
- Keep the local battlefield on the bottom, one opponent battlefield on top, life totals at corresponding ends, and stack/phase/priority/triggers/combat/card previews in a central shared interaction space.
- Replace gameplay-time navigation jumps with overlays where practical.
- Do not split life tracking and battlefield inspection into separate gameplay pages.

### Prompt 6: Battlefield Camera And Opponent Carousel

- Implement the reusable Battlefield Camera System over canonical player/seat state.
- Add opponent carousel behavior for two through ten players, preserving seating order and rendering only the focused opponent fully.
- Add Follow Active Player, manual interruption, temporary inspection, focus lock, deterministic smart exceptions, and standard cinematic transitions.
- Respect reduced motion and performance limits.

### Prompt 7: Full Control And Live Tracking Convergence

- Implement Full Control and Live Tracking as two input models over the same authoritative rules engine, canonical game state, event stream, save system, sync foundation, and replay/explanation foundation.
- Live Tracking accepts physical-table-reported actions with honest unknowns and confidence indicators.
- Full Control accepts direct digital card and zone manipulation through rules-engine legal action paths.
- Do not create separate engines or duplicate state authorities.

### Prompt 8: Question System

- Add the permanent battlefield question control for What, Who, When, Where, Why, How, and What If.
- Answer using the authoritative rules engine and Event Knowledge Engine rather than a disconnected explanation engine.
- Allow selection of cards, permanents, players, life totals, counters, commanders, statuses, zones, stack objects, triggers, game events, and battlefield states.
- Route What If through Dry Run/simulation forks without mutating the live authoritative session.

### Prompt 9: Remind Me And Timeline Experience

- Unify game history, change notifications, action summaries, relationship visualization, turn timeline, and replay under one Remind Me system.
- Add quick reminders, live battlefield replay, relationship explanations, and phase/turn timeline inspection.
- Reuse existing event history, replay state, effect logs, tutorial explanations, and saves.
- Ensure replay always returns safely to the current synchronized state.

### Prompt 10: Confidence, Rules Recovery And Rule Amendments

- Add Rules Recovery for official rules text, Gatherer rulings, release notes, Oracle text, Scryfall Oracle/rulings, trusted judge references, and table interpretations.
- Preserve imported source text as non-executable plain text and map it only through constrained approved rule operations.
- Distinguish source confidence from execution confidence.
- Require unanimous approval from every player before any proposed interpretation, local rule patch, waiver of an interaction, or amendment alters synchronized game state.
- Record every proposal, vote, rejection, revision, accepted amendment, and recovery action in immutable event history.

### Prompt 11: AI Integration

- Route AI decisions through the same canonical session, rules engine, state engine, Event Knowledge Engine, action pipeline, and confidence model as human decisions.
- Preserve existing Dry Run, simulation, NPC decks, deterministic learning, and tutorial behavior.
- Do not allow AI to waive rules or bypass legality.

### Prompt 12: Hub, Lite And Deck Nexus Interoperability

- Harden BoardState boundaries for future Hub coordination of profiles, friends, invitations, tournaments, notifications, app links, backups, shared local vaults, active session discovery, spectators, and ecosystem navigation.
- Keep BoardState authoritative for rules, sessions, priority, stack, triggers, replacement effects, continuous effects, layers, legality, combat, state-based actions, Full Control, Live Tracking authority, Dry Runs, simulations, tutorials, replay truth, and game-history causation.
- Finalize import/export manifests, capability negotiation, launch/return contexts, roles, permissions, offline capability reporting, backup manifests, and compatibility reports.
- Do not claim live Hub, BoardState Lite, or Deck Nexus integration until those applications implement and verify their counterpart workflows.

### Prompt 13: Performance And Accessibility

- Audit large Commander board states, ten-player session metadata, opponent carousel projection, event history growth, replay memory, reduced-motion behavior, keyboard/screen-reader access, and mobile landscape constraints.
- Preserve deterministic rules performance and avoid rendering all opponent battlefields simultaneously.
- Keep accessibility settings safe and compatible with existing Helper Sprite and tutorial flows.

### Prompt 14: Visual Polish And Animation

- Add restrained cinematic feedback for commander casting, permanents entering/leaving, tapping, combat, targeting, attachments, counters, token creation, life changes, stack movement, zone movement, and carousel rotation.
- Preserve BoardState artwork, wallpapers, color palette, gold accents, cosmic tribal aesthetic, and overall visual language.
- Respect reduced motion and performance settings.

### Prompt 15: Final Production Audit

- Audit source tree, contracts, rules engine, state engine, Event Knowledge Engine, battlefield, camera, Full Control, Live Tracking, Question System, Remind Me, Rules Recovery, AI, Hub/Lite/Nexus boundaries, performance, accessibility, saves, sync, deployment, package artifacts, privacy, and false integration claims.
- Fix regressions before release.
- Verify tests, build, package, deployment, and live production behavior through the repository's actual tooling.
