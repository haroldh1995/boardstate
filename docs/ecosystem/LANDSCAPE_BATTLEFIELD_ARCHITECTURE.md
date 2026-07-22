# Landscape Battlefield Modernization

Date: 2026-07-20

Prompt 5 modernizes the existing gameplay interface into a landscape-first Commander battlefield while preserving BoardState's existing cosmic background, gold HUD accents, glass panels, card rendering, rules engine, State Engine, Event Knowledge Engine, persistence, synchronization, tutorials, Dry Run, and AI behavior.

## Continuity Findings

BoardState already had reusable battlefield foundations in `src/ui/render.js`, `src/styles.css`, `src/shared-session/perspective.js`, `src/state/schema.js`, and the existing reducer/rules-engine action path.

Prompt 5 extends those systems instead of replacing them:

- `src/ui/render.js` still renders the gameplay page and dispatches the existing battlefield, stack, combat, phase, search, trigger, and settings actions.
- `src/shared-session/perspective.js` still provides local and opponent public-board perspective projection.
- `src/state/schema.js` still defines runtime permanents, zones, stack, phase, combat, and Commander metadata.
- `src/styles.css` still owns the BoardState visual identity and background assets.

## Landscape Battlefield Model

`src/ui/landscapeBattlefield.js` defines the Prompt 5 non-authoritative presentation model:

- `LANDSCAPE_BATTLEFIELD_VERSION`
- `LANDSCAPE_BATTLEFIELD_REGIONS`
- `PERMANENT_LANE_ORDER`
- `createLandscapeBattlefieldModel()`
- `organizePermanentsByLane()`
- `createPermanentPresentation()`
- `createTokenStacks()`
- `createSelectedCardDetails()`

The model is UI-only. It does not create a second game state, second rules engine, second session model, or alternate save format.

## Permanent Gameplay Regions

The gameplay page is now organized into stable regions:

- left global game information rail
- top focused opponent battlefield
- center command center
- bottom local battlefield
- right context action rail

The center command space displays turn, phase, active player, priority, stack summary, trigger/choice counts, selected card details, combat actions, Commander tax summary, and floating prompt notices without requiring navigation away from the battlefield.

## Battlefield Lanes

Permanents are grouped for readability into Commander-native battlefield lanes:

- commanders
- creatures
- lands
- artifacts
- enchantments
- planeswalkers
- battles
- tokens
- other permanents

Existing permanent identity, stack quantity, counters, tapped state, targeting data, and surface actions are preserved.

## Commander Presentation

Commander HUD summaries now remain close to each battlefield region and display Commander zone, tax, cast count, and Commander damage when available. Commander permanents continue using the existing `commander-spotlight` styling.

## Selection And Public Information

Selecting a card updates a central selected-card panel with Oracle text, current characteristics, counters, continuous effects, attachments, owner, controller, power/toughness, and status labels. Opponent cards remain public-only projections and do not expose hand, library, private deck notes, hidden choices, or unauthorized private zones.

## Prompt 5.5 Completion Pass

Prompt 5.5 completes the first commercial-quality battlefield pass without changing gameplay authority:

- `src/ui/render.js` keeps the active battlefield visible by using a compact table ribbon, focused opponent region, center command center, bottom local board, contextual card preview, and compact battlefield action dock.
- At Prompt 5.5, `src/ui/landscapeBattlefield.js` reported only then-available context actions; the Question System, Remind Me, and AI Analysis surfaces are now implemented by Prompts 9 through 11, while replay and external-app action surfaces remain hidden until implemented.
- `src/styles.css` makes the battlefield dominate desktop, tablet, foldable, and landscape-phone play by suppressing duplicate state strips, mobile swipe scaffolding, oversized command controls, and permanent empty rails on the gameplay page.
- Non-gameplay friend-discovery status toasts are filtered from the battlefield so Commander play is not obscured by ecosystem status noise.

The completion pass preserves the existing background image, cosmic glass treatment, gold accents, card/permanent rendering, rules engine integration, State Engine state, Event Knowledge metadata, persistence, tutorials, Dry Run, and sync foundations.

## Prompt 6 Intelligent Battlefield

Prompt 6 extends the same non-authoritative battlefield model with intelligent presentation behavior:

- `src/ui/landscapeBattlefield.js` now exposes `createOpponentCarouselModel()`, `createBattlefieldCameraModel()`, and `createBattlefieldIntelligenceModel()`.
- The opponent carousel supports two through ten Commander players by rendering one focused public opponent battlefield while keeping compact opponent summaries, loop navigation, quick jump seats, keyboard/controller-compatible arrows, mouse wheel, and swipe navigation.
- The camera foundation records deterministic focus priorities for selected permanents, stack objects, priority decisions, combat, Commander status, large battlefield changes, active player following, and table fallback. It does not animate or create a second camera authority.
- Contextual HUD metadata lets the renderer collapse idle stack, trigger, priority, and combat controls while expanding them when the current game state makes them relevant.
- Token intelligence summarizes large token boards with stack counts and total token counts while preserving individual permanent IDs internally.
- Public opponent summaries include Commander, tax, life, poison, energy, experience, hand count when known, permanent count, Commander damage, monarch, initiative, city blessing, and public effects without exposing private zones.

The intelligent battlefield remains presentation-only. It does not mutate game state, replace the rules engine, duplicate State Engine state, create a new save format, claim future camera animation work, or expose hidden opponent information.

## Prompt 7 Gameplay Flow

Prompt 7 keeps gameplay on the battlefield by promoting selected permanents, triggers, priority, and pending choices into one contextual Commander workflow:

- `src/ui/landscapeBattlefield.js` exposes `GAMEPLAY_FLOW_VERSION`, `createGameplayFlowModel()`, `createPermanentInteractionModel()`, `createTriggerWorkflowGroups()`, `createPriorityFlowModel()`, and `createSearchWorkflowModel()`.
- The gameplay flow remains UI-only and consumes the existing session, perspective projection, command center, reducer actions, and rules-engine paths.
- `src/ui/render.js` replaces the fixed selected-permanent action panel with a compact contextual dock. Permanent surface buttons only appear on selected local permanents.
- Selected lands expose mana/tap and copy actions without creature-only controls. Selected creatures expose attack, tap, counter, trigger, inspect, and zone-change actions through existing dispatch hooks. Opponent permanents expose public inspection only.
- Commander permanents surface Commander status, tax, cast count, damage access, and Commander tools without creating a separate Commander workflow engine.
- Trigger queues are grouped for readability, priority controls expand only when a meaningful window exists, and manual choices point back to the existing trigger/manual-choice tools.

Prompt 7 does not add animation, spectator mode, the Question UI, the Remind Me UI, fake Hub/Lite/Nexus status, or a second action system.

## Prompt 8 Motion, Camera, And Premium Presentation

Prompt 8 adds presentation-only motion and intelligent camera behavior over the existing battlefield model:

- `src/ui/landscapeBattlefield.js` exposes `BATTLEFIELD_MOTION_VERSION`, `createBattlefieldMotionModel()`, `createCameraTransitionPlan()`, `createCardMotionEvents()`, `createHudMotionPlan()`, and `resolveMotionPreferences()`.
- The camera now produces deterministic transition plans for selected permanents, stack objects, priority decisions, combat, Commander status, crowded boards, active players, and table fallback.
- Card motion metadata covers draw/cast/resolve/counter/destroy/exile/return/bounce/mill/discard/reveal/shuffle, token creation/grouping, copies, transforms, meld, mutate, equipment, auras, tap/untap, phasing, blink, Commander movement, Commander tax, life, Commander damage, priority, trigger chains, board wipes, elimination, winning moments, stack movement, and replacement effects.
- `src/ui/render.js` exposes safe `data-motion-*` attributes for the active battlefield, command center, stack, contextual dock, opponent carousel, card presentations, and permanents.
- `src/styles.css` adds restrained BoardState-native motion for card focus, Commander radiance, combat emphasis, legal and illegal targeting, stack emphasis, contextual dock arrival, carousel interaction, and camera settle.
- Reduced-motion preferences and `prefers-reduced-motion` disable nonessential motion while preserving legal/illegal targeting, priority, selected-object, Commander, combat, and stack information.

The motion system is not gameplay authority. It does not mutate game state, create a second camera authority, persist transient animation state, alter saves, bypass the rules engine, or expose hidden information.

## Prompt 9 Rules Assistant

Prompt 9 adds the first production Question System surface without changing battlefield authority:

- `src/authoritative-core/rulesAssistant.js` derives What, Who, When, Where, Why, How, and What If answers from the Rules Engine, State Engine, Event Knowledge Engine, current stack, trigger queue, selected permanent, and local Oracle text.
- `src/ui/landscapeBattlefield.js` exposes a non-authoritative `rulesAssistant` model and an available `question` context action.
- `src/ui/render.js` adds the compact Ask Why battlefield launcher and a contextual Rules Assistant panel that stays over the active battlefield.
- `src/styles.css` keeps the assistant small, reduced-motion safe, and secondary to cards and gameplay.

The assistant does not use generative AI, external search, private hidden zones, raw payload dumps, or fake ecosystem services. If authoritative evidence is missing, it reports the gap instead of inventing state.

## Prompt 10 Proactive Assistant

Prompt 10 adds the first production Remind Me and confidence surface without changing battlefield authority:

- `src/authoritative-core/proactiveAssistant.js` derives proactive reminders, smart notifications, confidence reports, missed-trigger recovery summaries, legal opportunity notices, player-memory preferences, and Rule Amendment proposal status from existing Rules Engine, State Engine, Event Knowledge, and session data.
- `src/ui/landscapeBattlefield.js` exposes a non-authoritative `proactiveAssistant` model and an available `remind-me` context action.
- `src/ui/render.js` adds the compact Remind Me battlefield launcher and contextual panel for reminders, confidence, trigger recovery, non-strategic opportunities, and unanimous table ruling votes.
- `src/styles.css` keeps proactive assistance compact, reduced-motion safe, and secondary to the battlefield.

The proactive assistant does not recommend strategy, play for users, execute imported text, expose hidden zones, or claim Hub/Lite/Nexus services.

## Prompt 11 AI Gameplay Analysis

Prompt 11 adds the first production AI Gameplay Analysis surface without changing battlefield authority:

- `src/authoritative-core/aiGameplayEngine.js` derives local AI profiles, Dry Run analysis, explainable decision records, threat analysis, board analysis, replay turning points, play-pattern recognition, and AI memory from existing Rules Engine, State Engine, Event Knowledge, and simulation data.
- `src/ui/landscapeBattlefield.js` exposes a non-authoritative `aiGameplay` model and an available `ai-analysis` context action.
- `src/ui/render.js` adds the contextual AI Analysis panel for Dry Run status, active profiles, latest decision reasoning, public threat signals, board summaries, replay summaries, patterns, and local preferences.
- `src/styles.css` keeps AI analysis compact, BoardState-native, reduced-motion safe, and secondary to battlefield visibility.

The AI layer does not mutate game state, waive rules, bypass the rules engine, expose unauthorized hidden zones, use cloud AI, call external LLMs, recommend decks, claim tournament matchmaking, or claim Hub services.

## Deferred Work

The battlefield, gameplay-flow, motion, Rules Assistant, proactive assistant, and AI analysis prompts do not implement particle effects, spectator mode, visual replay UI, sound, haptics, cloud AI, strategic coaching, external judge search, or full Rules Recovery imports. Those remain deferred to later modernization prompts and must reuse this intelligent landscape battlefield foundation.
