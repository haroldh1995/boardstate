# Rules Assistant And Question System

Date: 2026-07-21

Prompt 9 adds BoardState's explainable gameplay assistant without creating a second rules engine, state engine, event engine, AI chat system, or internet-backed answer service.

## Implementation Paths

- `src/authoritative-core/rulesAssistant.js` owns the Rules Assistant and Question System projection.
- `src/authoritative-core/eventKnowledgeEngine.js` remains the source of immutable event provenance, confidence metadata, event groups, rule references, and reconstruction hooks.
- `src/ui/landscapeBattlefield.js` exposes a non-authoritative `rulesAssistant` model on the landscape battlefield.
- `src/ui/render.js` renders the battlefield question control and contextual Rules Assistant panel over the existing battlefield.
- `src/styles.css` keeps the assistant compact, BoardState-native, reduced-motion safe, and secondary to the battlefield.

## Authority Boundary

The assistant answers from BoardState's existing authoritative data:

- Rules Engine outputs and rule references.
- State Engine current battlefield, stack, trigger queue, commander state, zones, counters, and priority metadata.
- Event Knowledge Engine history, causation, confidence, event groups, and replay-safe IDs.
- Stored Oracle text and current card characteristics already available in the local session.

It does not use generative AI, external internet search, executable imported text, hidden opponent data, or private raw payloads.

## Supported Questions

The first production surface supports the canonical question set from `QUESTION_SYSTEM_TYPES`:

- What
- Who
- When
- Where
- Why
- How
- What If

Answers include the strongest available headline, short explanation, confidence, evidence records, rule references, Oracle excerpts where already present, event-chain provenance, and follow-up prompts.

## Explanation Levels

`beginner`, `intermediate`, and `advanced` explanation levels are supported by `rulesAssistant.explanationLevel` settings. Beginner answers stay concise. Advanced answers may include event IDs, group IDs, layer summaries, and reconstruction availability.

## Privacy And Safety

The assistant excludes hidden zones such as hands, libraries, sideboards, face-down private data, raw private payloads, credentials, and opponent-only private information. Unknown or incomplete state is reported as unknown instead of guessed.

## What If Foundation

What If answers create a safe Dry Run fork boundary with `mutatesAuthoritativeSession: false`. Prompt 9 does not build a separate simulation UI. Future Dry Run integration can consume this boundary without mutating live authoritative sessions.

## Deferred Work

The assistant does not implement voice, generative AI chat, external online search, spectator explanations, cinematic replay UI, Hub services, or full Rules Recovery imports. Those remain deferred and must continue to use the same Rules Engine, State Engine, Event Knowledge Engine, and canonical session authority.
