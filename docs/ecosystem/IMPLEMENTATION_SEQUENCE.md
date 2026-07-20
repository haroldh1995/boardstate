# Ecosystem Implementation Sequence

## Authoritative Sequence

Future prompt sequencing is maintained in `COMMANDER_MODERNIZATION_ROADMAP.md` and governed by `BOARDSTATE_CONSTITUTION.md`. This file preserves continuity procedure and test-matrix guidance only; it is not a competing roadmap.

## Safe Baseline Procedure for Each Prompt

- Review `BOARDSTATE_CONSTITUTION.md`, `COMMANDER_MODERNIZATION_AUDIT.md`, `COMMANDER_SESSION_ARCHITECTURE.md`, and `COMMANDER_MODERNIZATION_ROADMAP.md`.
- Inspect existing source files referenced by those documents.
- Start from a clean branch or clean worktree.
- Record current commit, branch, build status, and test status.
- Reuse existing implementations before refactoring, extending, replacing, or creating code.
- Avoid destructive data migration unless the prompt specifically authorizes it.
- Add tests before replacing runtime behavior.
- Keep legacy paths until adapters and migration are verified.
- Keep BoardState Hub, BoardState Lite, and Deck Nexus integration statuses honest until counterpart apps are implemented and verified.
- Do not use Xcode or iPhone build steps unless a future prompt explicitly changes scope.

## Future Test Matrix

### Rules Engine Tests

- Legal action accepted.
- Illegal action blocked.
- Waived action warned and logged.
- Target validation.
- Timing validation.
- Mana validation.
- Stack order.
- Priority order.
- Trigger creation.
- Replacement effects.
- State-based actions.
- Combat.
- Layers.
- Planeswalkers.
- Vehicles.
- Mounts.
- Spacecraft.
- Planets.
- Station.
- Max Speed.

### Shared-Session Tests

- Lite to Advanced.
- Advanced to Lite.
- No state loss.
- One player Advanced.
- Two players Advanced.
- Mixed Lite/Advanced pod.
- Mirrored perspective.
- Reconnect.
- Revision conflict.
- Stale-state rejection.
- Save/load.
- Rules-engine version mismatch.

### Migration Tests

- Legacy profile.
- Legacy deck.
- Legacy Dry Run.
- Legacy tournament.
- Legacy friends.
- Partial migration.
- Rollback.
- Malformed data.
- Old schema versions.

## Current Test Infrastructure

- Test runner: Node built-in test runner via `npm test`.
- Current suites:
- `test/effect-engine.test.js`
- `test/event-ready.test.js`
- `test/friend-system.test.js`
- `test/onboarding-saves.test.js`
- `test/qol-release.test.js`
- `test/simulation.test.js`
- `test/spell-system.test.js`

Current coverage strengths:

- Reducer-level gameplay flows.
- Spell stack and permanent routing.
- Effects, triggers, landfall, counters, layers, combat basics.
- Simulation/Dry Run behavior.
- Friends and tournament namespace separation.
- Tutorial and local save behavior.

Coverage gaps before extraction:

- Package-level rules-engine API tests.
- Shared-session revision/conflict tests.
- Multi-player Commander state model tests beyond current simulated opponents.
- Full rule waiver tests.
- Full state-based action pass tests.
- Cross-app adapter tests for Lite and Deck Nexus.

