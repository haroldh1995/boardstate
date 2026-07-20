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
- `src/ui/landscapeBattlefield.js` reports only available context actions in the production battlefield model; future Question, Remind Me, replay, AI, and external-app actions remain hidden until implemented.
- `src/styles.css` makes the battlefield dominate desktop, tablet, foldable, and landscape-phone play by suppressing duplicate state strips, mobile swipe scaffolding, oversized command controls, and permanent empty rails on the gameplay page.
- Non-gameplay friend-discovery status toasts are filtered from the battlefield so Commander play is not obscured by ecosystem status noise.

The completion pass preserves the existing background image, cosmic glass treatment, gold accents, card/permanent rendering, rules engine integration, State Engine state, Event Knowledge metadata, persistence, tutorials, Dry Run, and sync foundations.

## Deferred Work

Prompt 5 does not implement the opponent carousel, camera system, Follow Active Player, Spectator Mode, visual replay UI, Question UI, Remind Me UI, or AI battlefield interface. Those remain deferred to later modernization prompts and must reuse this landscape battlefield foundation.
