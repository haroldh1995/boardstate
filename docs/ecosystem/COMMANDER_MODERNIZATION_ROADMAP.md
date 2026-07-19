# Commander Modernization Roadmap

This roadmap preserves the existing BoardState application and evolves it in place. Each phase should reuse working rules, state, UI, save, sync, AI, tutorial, and bridge systems before refactoring or extending them.

## Prompt 1: Repository Audit, Preservation Plan, And Foundation

- Audit existing architecture, state ownership, Commander/multiplayer limits, landscape battlefield, event/history systems, confidence/recovery handling, and Hub readiness.
- Preserve the current BoardState background, theme, gameplay, saves, sync, Dry Run, tutorials, and rules engine.
- Add only low-risk shared contracts and compatibility utilities that later prompts need.

## Prompt 2: Canonical Commander Session And Ten-Player Readiness

- Normalize Commander/Brawl sessions around stable game IDs, session IDs, player IDs, seat IDs, and two-to-ten-player support.
- Remove remaining authoritative dependence on UI positions such as player/opponent arrays.
- Preserve one-player training/simulation as a nonstandard mode while keeping Commander/Brawl sessions two-to-ten players.
- Harden commander tax, commander damage, partner/background/multiple commander metadata, elimination, concession, turn order, extra turns, controlled turns, spectators, and reconnect metadata.

## Prompt 3: Event Knowledge Engine Modernization

- Promote existing actions, game events, effect logs, rules confidence logs, replay state, undo/redo state, simulation records, and sync metadata into one reusable event knowledge layer.
- Preserve existing saves and histories through adapters.
- Add provenance and confidence metadata for costs, targets, zones, stack placement, priority transitions, triggers, replacement effects, prevention effects, layers, state-based actions, combat, counters, commander tax, commander damage, token creation, copies, attachments, control changes, corrections, and sync causation.

## Prompt 4: Landscape Static Commander Battlefield

- Modernize the existing landscape battlefield into the approved Commander-first Arena-readable layout without replacing the BoardState background or identity.
- Keep the local battlefield on the bottom, one opponent battlefield on top, life totals at their corresponding ends, and stack/phase/priority/triggers/combat/card previews in a central shared interaction space.
- Replace gameplay-time navigation jumps with overlays where practical.
- Do not split life tracking and battlefield inspection into separate gameplay pages.

## Prompt 5: Opponent Carousel And Battlefield Camera System

- Implement the reusable Battlefield Camera System over canonical player/seat state.
- Add opponent carousel behavior for two through ten players, preserving seating order and rendering only the focused opponent fully.
- Add Follow Active Player, manual interruption, temporary inspection, focus lock, deterministic smart exceptions, and standard cinematic transitions.
- Respect reduced motion and performance limits.

## Prompt 6: Full Control And Live Tracking Input Models

- Implement Full Control and Live Tracking as two input models over the same authoritative rules engine, canonical game state, event stream, save system, sync foundation, and replay/explanation foundation.
- Live Tracking accepts physical-table-reported actions with honest unknowns and confidence indicators.
- Full Control accepts direct digital card and zone manipulation through rules-engine legal action paths.
- Do not create separate engines or duplicate state authorities.

## Prompt 7: Question System

- Add the permanent battlefield question control for What, Who, When, Where, Why, How, and What If.
- Answer using the authoritative rules engine and Event Knowledge Engine rather than a disconnected explanation engine.
- Allow selection of cards, permanents, players, life totals, counters, commanders, statuses, zones, stack objects, triggers, game events, and battlefield states.
- Route What If through Dry Run/simulation forks without mutating the live authoritative session.

## Prompt 8: Remind Me And Live Replay

- Unify game history, change notifications, action summaries, relationship visualization, turn timeline, and replay under one Remind Me system.
- Add quick reminders, live battlefield replay, relationship explanations, and phase/turn timeline inspection.
- Reuse existing event history, replay state, effect logs, tutorial explanations, and saves.
- Ensure replay always returns safely to the current synchronized state.

## Prompt 9: Rules Recovery And Unanimous Rule Amendments

- Add Rules Recovery for official rules text, Gatherer rulings, release notes, Oracle text, Scryfall Oracle/rulings, trusted judge references, and table interpretations.
- Preserve imported source text as non-executable plain text and map it only through constrained approved rule operations.
- Distinguish source confidence from execution confidence.
- Require unanimous approval from every player before any proposed interpretation, local rule patch, waiver of an interaction, or amendment alters synchronized game state.
- Record every proposal, vote, rejection, revision, accepted amendment, and recovery action in immutable event history.

## Prompt 10: Hub-Ready Adapters And Final Ecosystem Hardening

- Harden BoardState boundaries for future Hub coordination of profiles, friends, invitations, tournaments, notifications, app links, backups, shared local vaults, active session discovery, spectators, and ecosystem navigation.
- Keep BoardState authoritative for rules, sessions, priority, stack, triggers, replacement effects, continuous effects, layers, legality, combat, state-based actions, Full Control, Live Tracking authority, Dry Runs, simulations, tutorials, replay truth, and game-history causation.
- Finalize import/export manifests, capability negotiation, launch/return contexts, roles, permissions, offline capability reporting, backup manifests, and compatibility reports.
- Do not claim live Hub, BoardState Lite, or Deck Nexus integration until those applications implement and verify their counterpart workflows.
