# Canonical Gameplay Architecture

Date: 2026-08-08

Prompt 13.2.6 Part 1 establishes the permanent gameplay architecture for BoardState. This document takes precedence over earlier gameplay, battlefield, HUD, motion, assistance, and layout prompt artifacts wherever they conflict.

This is not a feature prompt, redesign prompt, or optimization prompt. It is the canonical gameplay specification that future gameplay features, animation, UI, interaction, multiplayer, simulation, Dry Run, AI opponent, tutorial, accessibility, and expansion work must follow.

## Core Philosophy

BoardState must feel like the world's best digital Commander table, not a website, dashboard, collection manager, utility app, or digital copy of MTG Arena.

BoardState draws from two sources:

- Physical Commander defines battlefield geography, player expectations, gameplay flow, zone placement, table organization, resolve philosophy, priority assumptions, Commander etiquette, and natural pacing.
- MTG Arena defines presentation quality, responsiveness, motion, animation, visual polish, card readability, digital interaction quality, and input responsiveness.

Arena is a presentation reference only. Physical tabletop Commander is the gameplay architecture.

## Live Tracking Philosophy

BoardState assists a real tabletop game. It does not assume it must enforce every game action like Arena. Actions performed in BoardState represent actions that have already occurred physically unless another player decision is still required.

BoardState reduces friction. It must not add confirmations that do not exist during normal Commander play.

## Live Tracking Assumption Engine

The Live Tracking Assumption Engine is implemented through `src/gameplay/canonicalGameplay.js`.

Unless another meaningful player decision exists, BoardState assumes:

- Played lands enter immediately.
- Creatures enter immediately after Resolve.
- Artifacts, enchantments, battles, planeswalkers, and equipment enter immediately.
- Counters apply immediately.
- Commander tax recalculates automatically.
- Static abilities recalculate automatically.
- Power and toughness update automatically.
- Continuous effects refresh automatically.

The engine may interrupt automatic progression only for genuine choices: unresolved targets, modal choices, replacement decisions, ward/payment decisions, priority windows with a real local response opportunity, or other manual pending effects.

## Single Resolve Law

The Resolve action means: "I am finished resolving this spell."

One Resolve completes the entire uncontested action. For example, resolving a permanent spell must move it from stack to battlefield, generate applicable entry triggers, refresh continuous effects, update available actions, and end resolution without asking for repeated Resolve confirmations.

Multiple Resolve interactions are allowed only when an actual stack interaction or required player decision exists, such as counterspells, copies, responses, priority passes, triggered abilities requiring choices, or replacement effects requiring choices.

Runtime enforcement:

- `createSingleResolvePlan()` defines whether the current stack object can resolve as one uncontested action.
- `shouldAutoProgressLiveTrackingStack()` blocks automatic progression only when manual stack confirmation is enabled or a real decision is required.
- `src/ui/render.js` uses the same plan for the Resolve Action Card and automatic stack processing.

## Canonical Gameplay Laws

These laws are permanent:

1. Gameplay is landscape.
2. Loading and authentication may remain portrait.
3. No global battlefield scrolling.
4. The battlefield always remains a true tabletop.
5. Cards always resemble cards.
6. The battlefield is spatial, never document-based.
7. Player battlefield remains anchored.
8. Opponent battlefield remains anchored.
9. Only overflowing zones may scroll horizontally.
10. Opponent switching and zone scrolling are separate systems.
11. Notifications never cover gameplay.
12. Animations always have priority.
13. Protected gameplay space cannot be obstructed.
14. The Tactical Command Hand remains permanently docked.
15. BoardState assumes the tabletop game has progressed unless another decision is required.

## Gameplay Viewport Law

Gameplay exists inside one fixed viewport. It must never become a webpage, document, vertical scrolling interface, dashboard, or infinitely expanding layout.

Everything needed for active gameplay remains visible without application-level scrolling. Additional information belongs inside dialogs, inspectors, drawers, panels, or overlays. Those surfaces are temporary scroll islands; the gameplay page itself is not.

Runtime enforcement:

- `document.body.dataset.gameViewport` remains `fixed`.
- `.app-shell` is fixed to the viewport.
- `body`, `#app`, `.app-shell`, and `.landscape-battlefield-page` hide global overflow.
- Only temporary overlay selectors and battlefield lane grids retain local scroll behavior.

## Protected Gameplay Corridor

The protected gameplay corridor is the center gameplay space for casting, resolving, targeting, combat, trigger visualization, stack visualization, and priority communication.

The following may not permanently cover this space:

- Notifications.
- Undo messages.
- Friend activity.
- Helper Sprite.
- Contextual guidance.
- Assistant messages.
- Achievement notifications.
- Status toasts.
- Low-priority reminders.

Runtime enforcement:

- Full-window notifications are suppressed on the battlefield.
- Battlefield toast placement is edge-safe and outside the central corridor.
- Helper Sprite is disabled by default and remains a settings-controlled support surface.
- Utility overlays remain temporary and must not become permanent battlefield chrome.

## Canonical Battlefield Geography

The official two-player beginner playmat is the reference for spatial organization only. BoardState must not copy artwork, branding, or decorative elements.

The spatial contract is:

- Player territory is bottom-anchored.
- Opponent territory is top-anchored.
- Creature lanes face combat.
- Land lanes sit nearest the owning player edge.
- Artifacts, enchantments, battles, and planeswalkers remain support lanes.
- Commanders receive prominent identity treatment.
- Library, graveyard, and exile are side zones.
- The center remains shared gameplay space.

BoardState implements this organization using its cosmic, gold-accented, Commander-first visual identity.

## Player Spatial Memory

The battlefield must evolve naturally and preserve player spatial memory. Do not randomly rearrange zones, rebuild battlefield geography after every action, or relocate battlefield lanes for novelty. Intelligent layout may compress or expand zones, but the geography remains stable.

## Forbidden Behaviors

The following are permanently prohibited:

- The battlefield becoming a webpage.
- Vertical battlefield stacking.
- Responsive document layouts.
- Oversized cropped battlefield cards.
- Battlefield permanents rendered as preview panels.
- Card previews replacing permanents.
- Notifications covering gameplay.
- Repeated Resolve confirmations for uncontested actions.
- HUD detaching from gameplay.
- Cards losing proper proportions.
- Random battlefield reflow.
- Global gameplay scrolling.
- Automatic redesign of battlefield architecture.

## Acceptance Criteria

BoardState must immediately communicate:

- Where the player is.
- Where opponents are.
- Where creatures belong.
- Where lands belong.
- Where permanents belong.
- Where combat occurs.
- Where spells resolve.
- Where the player's attention belongs.

A first-time Commander player should recognize the battlefield as a natural digital evolution of a physical tabletop rather than a webpage.

## Part 2 Battlefield Geography

Prompt 13.2.6 Part 2 restores the active battlefield as a fixed digital Commander tabletop. The battlefield is one fixed gameplay viewport with three conceptual territories: focused opponent territory at the top, protected shared gameplay corridor in the middle, and local player territory plus the Tactical Command Hand at the bottom.

The canonical permanent geography is implemented through `src/gameplay/battlefieldGeometry.js` and consumed by `src/ui/landscapeBattlefield.js`:

- Creatures, creature commanders, creature tokens, and planeswalkers occupy the creature zone.
- Planeswalkers are deterministic far-right creature-zone permanents and organize inward from the right.
- Lands occupy the lower land/support zone nearest the owning player edge.
- Noncreature nonland permanents occupy the far-right support portion of the lower zone.
- Library, graveyard, and exile remain side-zone concepts and must not become vertical webpage sections.

The renderer must not turn permanent types into a vertical document. `src/ui/render.js` renders tabletop zones instead of arbitrary stacked lane panels, and `src/styles.css` prevents global battlefield scrolling.

## Part 2 Density And Overflow

Battlefield density uses five explicit states:

- Empty.
- Sparse.
- Normal.
- Busy.
- Extreme.

The mandatory overflow order is:

1. Normal placement.
2. Adaptive spacing.
3. Controlled overlap.
4. Duplicate stacking.
5. Equivalent-object grouping.
6. Permitted nonland-permanent stacking.
7. Adaptive scaling within readability limits.
8. Expandable grouped presentation.
9. Zone-local horizontal scrolling.

Zone-local horizontal scrolling is the last major capacity mechanism. Only the overflowing zone may move. The gameplay viewport, local battlefield, opponent territory, life, Command Hand, and other zones must remain anchored.

## Part 2 Multiplayer Navigation And Gestures

Opponent switching and zone overflow scrolling are separate systems.

- A horizontal gesture beginning inside the Tactical Command Hand belongs to the Command Hand.
- A horizontal gesture beginning inside an overflowing battlefield zone scrolls that zone only.
- A horizontal gesture beginning on usable opponent battlefield background may switch focused opponents.
- Reaching a zone edge must not transfer the active gesture to opponent navigation.
- Opponent arrows remain available whenever multiple opponents exist and navigation remains circular.

Gesture ownership is modeled in `src/gameplay/battlefieldGeometry.js` so native shells can preserve the same behavior without depending on DOM event rules.

## Part 2 Command Hand Focus Law

The Tactical Command Hand has exactly one focus owner. The focused card is the card nearest the mathematical center anchor and must also be the logical focus, visual focus, frontmost card, highest z-order card, strongest highlight, preview source, hit-test owner, and activation target.

`src/gameplay/commandDeckModel.js` owns the platform-neutral focus and projection math. `src/ui/render.js` applies that focus to DOM/CSS. No future implementation may allow CSS order, hover state, stale preview state, or render order to override the canonical focused command.

## Part 2 Resolve And Animation Rules

The Single Resolve Law remains mandatory. An uncontested spell requires one Resolve action. Deterministic post-resolution work completes automatically. Genuine post-resolution choices appear as the next contextual interaction without replaying the casting animation or asking for another Resolve on the same stack object.

Casting and resolution animation space belongs to the protected gameplay corridor. Low-priority notifications, helpers, reminders, friend activity, and assistant messages must yield to gameplay animation.

## Part 2 Platform Portability

Part 2 continues the permanent cross-platform development law. Gameplay state, rules state, interaction intent, navigation state, battlefield geometry, command-deck projection, and business logic must remain platform-independent wherever practical.

Browser-specific behavior belongs in the current web shell or explicit runtime adapters. New gameplay or presentation models must not depend exclusively on DOM, browser storage, browser navigation, CSS layout behavior, hover, or URL state.

## Implementation Boundary

This Part 1 contract is implemented by:

- `src/gameplay/canonicalGameplay.js`
- `src/gameplay/battlefieldGeometry.js`
- `src/gameplay/commandDeckModel.js`
- `src/ui/landscapeBattlefield.js`
- `src/ui/render.js`
- `src/styles.css`
- `test/canonical-gameplay-architecture.test.js`
- `test/canonical-gameplay-part2.test.js`

Future parts must continue from this architecture without redefining these concepts.
