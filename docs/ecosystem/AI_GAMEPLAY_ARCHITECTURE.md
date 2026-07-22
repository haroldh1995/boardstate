# AI Gameplay Engine, Dry Runs, Simulations, And Analysis

Date: 2026-07-21

Prompt 11 adds BoardState's explainable local AI gameplay analysis layer without creating a second rules engine, state engine, event engine, save format, networking system, or cloud AI service.

## Implementation Paths

- `src/authoritative-core/aiGameplayEngine.js` owns AI profiles, AI memory normalization, explainable decision records, threat analysis, board analysis, replay analysis, play-pattern recognition, and decision-comparison scaffolding.
- `src/simulation/commanderSimulation.js`, `src/simulation/simulatedOpponent.js`, and `src/simulation/decks/` remain the reusable Dry Run and Alpha/Beta/Omega simulation foundations.
- `src/state/gameReducer.js` continues to run simulation actions through existing reducer and rules-engine paths, then refreshes non-authoritative AI analysis metadata.
- `src/state/schema.js`, `src/storage/localDatabase.js`, `src/storage/saveState.js`, and `src/persistence/canonicalPersistence.js` persist AI preferences, session analysis, memory, and save metadata without replacing canonical game state.
- `src/ui/landscapeBattlefield.js` exposes an `aiGameplay` projection for the battlefield.
- `src/ui/render.js` adds the contextual AI Analysis panel for Dry Run status, latest decision reasoning, threat analysis, board analysis, replay turning points, play patterns, and local AI preferences.

## Authority Boundary

The AI Gameplay Engine derives from BoardState's authoritative data:

- Rules Engine legality, priority, stack, triggers, replacement effects, state-based actions, and Commander-specific rules.
- State Engine battlefield, zones, stack, turn, phase, counters, life, Commander state, and simulation state.
- Event Knowledge Engine action history, event provenance, replay metadata, confidence, and causation.

The AI never mutates authoritative gameplay state directly, waives rules, bypasses legality, exposes hidden zones outside the selected information mode, uses external LLMs, calls cloud AI services, performs deck-building recommendations, or synchronizes with Hub services.

## AI Profiles

`AI_PROFILE_CATALOG` defines reusable Commander archetype tendencies for aggro, control, midrange, combo, stax, group hug, chaos, politics, casual, competitive, and experimental analysis.

`AI_DIFFICULTY_TIERS` defines Alpha, Beta, and Omega behavior tiers. The existing simulation decks remain the source of concrete NPC gameplay, and all AI actions continue through BoardState's reducer and rules-engine flow.

## Dry Run And Simulation Analysis

Dry Run remains separate from live games. The AI analysis layer reports:

- active simulation status
- active AI profiles
- current information mode
- latest explainable AI decision
- legal alternatives and rejected alternatives
- public threat signals
- public board advantage signals
- replay turning points
- recurring play patterns

The analysis is recommendation and explanation metadata only. It does not script outcomes or modify session truth.

## Hidden Information Policy

Public information mode limits opponent analysis to public board, public counts, stack, triggers, and Event Knowledge available to the viewer. Perfect-information and training modes are explicit simulation modes and are not used to expose unauthorized hidden data in normal play.

## Persistence

AI gameplay state is saved with the active session and summarized in local and canonical save metadata. Saved AI metadata records version, information mode, active profile IDs, analysis availability, and explicit `externalAiServicesEnabled: false` / `generativeAiEnabled: false` boundaries.

## Deferred Work

Prompt 11 does not add cloud AI, external LLM chat, strategic coaching, voice interaction, deck-building AI, tournament matchmaking, Hub synchronization, or a separate simulation engine. Later prompts must reuse this AI boundary and keep all gameplay mutations inside BoardState's authoritative pipeline.
