# BoardState Constitution

Date: 2026-07-19

This document is the permanent architecture and engineering charter for BoardState modernization. BoardState is an existing production application. Modernization must inspect, reuse, refactor, and extend the current repository before replacing any working system.

## Project Identity

BoardState is an authoritative, explainable Commander operating system for Magic: The Gathering. It does not just track Commander. It understands Commander through the rules engine, canonical state, event history, replay, confidence reporting, tutorials, AI, and synchronized multiplayer foundations already present in this repository.

## Constitutional Principles

1. Commander First: BoardState exists exclusively for Commander and Brawl-style Commander gameplay. When generic architecture conflicts with better Commander architecture, choose Commander architecture.
2. Rules Above All: BoardState models Magic as defined by Wizards of the Coast. Official rules remain canonical. Table rulings are supported only when clearly identified as non-canonical.
3. One Source Of Truth: The repository must have exactly one authoritative Rules Engine, one State Engine, and one Event Knowledge Engine. No duplicate ownership.
4. Evolve, Do Not Rewrite: Reuse existing implementations whenever possible. Refactor before replacing. Preserve proven systems.
5. Explain Everything: Every game decision should eventually be explainable through the Question System, replay, event history, and confidence reporting.
6. Never Pretend: If BoardState cannot determine something with confidence, it must communicate uncertainty instead of guessing.
7. Physical And Digital Are Equals: BoardState supports physical Commander tracking and fully digital gameplay as input models over the same authoritative session.
8. Commander Tables Come First: Core architecture must naturally support two through ten player Commander tables.
9. Hub Coordinates: BoardState Hub may coordinate the ecosystem, but BoardState remains the gameplay and rules authority.
10. Correctness Over Convenience: When presentation conflicts with authoritative game state, authoritative game state wins.
11. Respect The Player: BoardState assists players, reduces bookkeeping, explains complex interactions, and avoids unnecessary interruptions.
12. Every Second Saved Matters: Features should make Commander faster, clearer, easier, or more enjoyable. Complexity that does not improve Commander should be reconsidered.
13. Every App Has One Job: Each ecosystem application has a clearly defined responsibility. Avoid unnecessary duplication.

## Ecosystem Architecture

### BoardState Hub

BoardState Hub coordinates profiles, friends, invitations, notifications, synchronization, cloud workflows, ecosystem settings, session discovery, and cross-app launching. Hub is not the gameplay authority and must not own legality, priority, stack, turn structure, or canonical game-state mutation.

### BoardState Lite

BoardState Lite is the fastest, most frictionless way for an individual player to track their own Commander battlefield during a physical game. Lite is optimized for portrait, one-handed use, personal battlefield state, personal counters, commander damage, life totals, quick interactions, and minimal bookkeeping. Lite participates in the same canonical Commander session. Lite is not a separate game and must not duplicate the BoardState rules authority.

### BoardState

BoardState is the complete Commander battlefield and authoritative gameplay application. It is landscape-only for gameplay and owns the Rules Engine, State Engine, Event Knowledge Engine, advanced battlefield, complete battlefield visibility, replay, AI, tutorials, Question System, Remind Me, Dry Runs, spectators, advanced rules, and tournament-grade gameplay. BoardState records and understands the complete game. Lite tracks an individual player's battlefield and owns portrait physical-table companion workflows.

## Canonical Commander Session

The ecosystem revolves around one canonical Commander session. Applications must not export, recreate, or fork live games into independent authorities. They provide different interfaces into the same authoritative session.

The current Prompt 2 foundation is documented in `docs/ecosystem/COMMANDER_SESSION_ARCHITECTURE.md` and implemented through `src/shared-contracts/commanderSession.js`, `src/shared-contracts/contracts.js`, `src/shared-contracts/adapters.js`, `src/state/schema.js`, `src/storage/saveState.js`, and `src/multiplayer/syncManager.js`.

The Prompt 4 persistence foundation is documented in `docs/ecosystem/PERSISTENCE_REPLAY_ARCHITECTURE.md` and implemented through `src/persistence/canonicalPersistence.js`, `src/storage/saveState.js`, `src/state/gameReducer.js`, and `src/multiplayer/syncManager.js`.

The Prompt 12 ecosystem foundation is documented in `docs/ecosystem/ECOSYSTEM_INTEGRATION_ARCHITECTURE.md` and implemented through `src/ecosystem/ecosystemIntegration.js`, `src/bridge/appLinkAdapters.js`, `src/state/gameReducer.js`, `src/storage/saveState.js`, and `src/persistence/canonicalPersistence.js`. It prepares Hub coordination, BoardState Lite handoff, and Deck Nexus snapshot boundaries without claiming live counterpart connections or moving gameplay authority out of BoardState.

## Architecture Charter

### Rules Engine

The Rules Engine determines legality, priority, Oracle interpretation, Comprehensive Rules behavior, replacement effects, trigger generation, layers, and state-based actions. It answers: What is legal?

Existing evidence and boundaries are documented in `docs/ecosystem/CURRENT_ARCHITECTURE_AUDIT.md` and `docs/ecosystem/SHARED_CONTRACT_PLAN.md`.

### State Engine

The State Engine owns battlefield, stack, zones, counters, life, commander damage, mana, continuous effects, and turn structure. It answers: What is true?

Today, runtime state is centralized through `src/state/schema.js`, `src/state/store.js`, `src/state/gameReducer.js`, and the canonical session adapters. Future work may refine boundaries but must not create a second canonical game state.

### Event Knowledge Engine

The Event Knowledge Engine owns immutable history, provenance, replay metadata, undo relationships, confidence, event groups, synchronization history, and AI references. It answers: How did we get here?

The Prompt 3 foundation promotes existing action history, event history, effect logs, replay state, undo/redo state, simulation records, sync metadata, rules traces, and confidence logs into this engine. It extends existing evidence sources rather than creating a disconnected second history system.

## Authoritative Pipeline

Permanent gameplay architecture follows this pipeline:

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

No production system may bypass this architecture for rules-sensitive gameplay. UI shortcuts, AI actions, Live Tracking reports, Full Control actions, replay, synchronization, and future Hub/Lite/Nexus entry points must route through the same authority.

## Engineering Standards

Always inspect existing code before implementing. Reuse existing systems. Refactor before replacing. Extend before rebuilding. Preserve working functionality. Remove duplicate implementations when a single authoritative implementation exists. Remove obsolete code only when an access path, migration path, or recovery path remains. Reduce technical debt with each modernization step. Minimize regressions. Maintain deterministic behavior for rules, simulation, replay, tests, and saves. Favor explicit architecture over accidental architecture.

## Native Game UI Philosophy

Preserve BoardState's visual identity. Do not redesign for the sake of redesign. Preserve existing artwork, wallpapers, color palette, gold accents, cosmic tribal aesthetic, and overall visual language.

The battlefield is the application. Gameplay must feel like a premium native digital Commander table, not a website, dashboard, admin panel, or responsive productivity app. UI stays quiet until it communicates gameplay, enables gameplay, improves clarity, or exposes relevant context.

BoardState gameplay is permanently landscape-only. Portrait gameplay, portrait navigation, portrait layout switching, and portrait-specific optimization belong to BoardState Lite. BoardState remains responsive by revealing more battlefield, table, atmosphere, or contextual information across display sizes without changing into a separate portrait composition.

The Prompt 12.1 visual foundation is documented in `docs/ecosystem/NATIVE_GAME_VISUAL_ARCHITECTURE.md` and implemented through `src/main.js`, `src/state/schema.js`, `src/storage/localDatabase.js`, `src/state/gameReducer.js`, `src/ui/render.js`, and `src/ecosystem/ecosystemIntegration.js`.

## Modernization Strategy

Modernize the repository. Do not rewrite it. Preserve valuable systems. Replace obsolete architecture only when evidence shows it is incompatible with the approved architecture. Each prompt must leave the repository cleaner, better documented, and less duplicative than before.

## Repository Continuity

Every future prompt must review this Constitution, `docs/ecosystem/COMMANDER_MODERNIZATION_AUDIT.md`, `docs/ecosystem/COMMANDER_SESSION_ARCHITECTURE.md`, `docs/ecosystem/NATIVE_GAME_VISUAL_ARCHITECTURE.md`, `docs/ecosystem/COMMANDER_MODERNIZATION_ROADMAP.md`, and relevant implementation files before making changes. Future prompts must inspect previous implementations, verify architectural consistency, detect drift, continue modernization without duplicating systems, preserve the landscape-only native game direction, and keep external integrations honest until counterpart applications exist.

## Remaining Roadmap

The active modernization roadmap is maintained in `docs/ecosystem/COMMANDER_MODERNIZATION_ROADMAP.md`. That roadmap is the authoritative prompt sequence when later implementation prompts supersede earlier numbering or split/merge planned phases.
