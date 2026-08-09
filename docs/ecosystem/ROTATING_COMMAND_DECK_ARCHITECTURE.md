# Rotating Command Deck Architecture

Date: 2026-07-25

Prompt 12.3F replaces the fixed linear Commander Action Hand projection with a circular Rotating Command Deck. This is an interaction-model refinement only. It does not add a second action system, rules authority, state owner, save format, or hidden-information path.

## Reference Review

The supplied BoardState and Arena screenshots were reviewed only for hand interaction, card spacing, overlap, motion, readability, and player muscle memory.

Useful principles:

- Players naturally return their eyes and hands to the lower decision surface.
- A partially visible fan feels more physical than a complete row of equal controls.
- Stable card order builds muscle memory.
- Rotation should wrap continuously without edge collisions.
- Important contextual decisions should enter near the center without stealing focus unnecessarily.

BoardState must not copy Arena card artwork, card frames, layout details, UI assets, branding, or protected animation identity.

## Runtime Boundary

- `src/ui/render.js` exposes `COMMAND_DECK_VERSION` as `boardstate-rotating-command-deck-0.1.0`.
- `document.body.dataset.commandDeckVersion` records the active deck system.
- The Action Hand root exposes `data-command-deck`, `data-command-deck-version`, `data-command-deck-size`, `data-command-deck-visible-count`, `data-command-deck-rotation`, `data-command-deck-center`, and `data-command-deck-priority-card`.
- `src/styles.css` keeps the existing Action Card material treatment and adds the Prompt 12.3F circular deck projection, edge rotators, center emphasis, favorite marker, and compact landscape behavior.
- `src/state/schema.js` stores only user preference metadata in `settings.commandDeck.favoriteIds`.

## Deck Composition

Core Command Cards remain stable in the deck:

- Phase
- Commander
- Search
- Judge
- Remind Me
- Undo
- Battlefield Focus
- History
- Notes
- Calculator
- Dice
- Coin
- Settings
- More Tools

Contextual Command Cards enter only when relevant:

- Attack
- Resolve
- Inspect

Future contextual cards should enter through the same `createCommanderActionCards()` deck model and preserve the existing action attributes used by `renderCommanderActionCard()`.

## Interaction Contract

The deck supports:

- Infinite wraparound through `normalizeCommandDeckIndex()`.
- A visible circular window through `getVisibleCommandDeckCards()`.
- Priority-aware centering through `resolveCommandDeckPriorityCard()` and `resolveCommandDeckCenterIndex()`.
- Wheel, drag, keyboard, and controller-ready rotation paths.
- Mouse wheel rotation.
- Touch or pointer drag rotation.
- Wheel and pointer movement free-scroll the visible cards inside a locked Action Hand wheel first, then snap once to the nearest Command Card when the gesture ends. The hand anchor itself must not translate across the battlefield.
- Keyboard rotation through Arrow Left, Arrow Right, Page Up, Page Down, Q, and E.
- Controller-ready key aliases for D-pad and shoulder-button style input.
- Favorite pinning through `data-command-deck-favorite`.

Rotation state is transient UI state inside `mountApp()`. Favorites are preferences. Neither changes gameplay authority.

## Regression Rules

Future Command Deck work must preserve:

- Existing Action Card button semantics.
- Existing `data-open-utility`, `data-open-tool-panel`, `data-next-phase`, `data-resolve-combat`, `data-declare-attackers`, `data-undo`, and utility action routes.
- Circular wraparound without visible beginning or end.
- Core card order stability unless the user pins favorites.
- Contextual card entry without permanent inactive clutter.
- Hidden-information boundaries.
- No false Hub, Lite, or Deck Nexus availability.

Future work must not turn the deck into a scrolling list, pagination control, toolbar, ribbon, or carousel menu.
