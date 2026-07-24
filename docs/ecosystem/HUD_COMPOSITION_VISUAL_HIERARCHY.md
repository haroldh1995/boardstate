# HUD Composition And Visual Hierarchy

Date: 2026-07-23

Prompt 12.3E is a corrective refinement pass over the Prompt 12.2A tabletop reconstruction and Prompt 12.3C Commander Action Hand. It does not add gameplay features, replace action routing, or create a new interaction model.

## Reference Review

The supplied BoardState and Arena screenshots were reviewed only for visual hierarchy, composition, eye movement, negative space, layering, readability, and player focus.

Useful reference principles:

- The battlefield must be the first read.
- The lower decision surface can be familiar and prominent without becoming a toolbar.
- Inactive UI should sit at the edge of awareness.
- Persistent chrome should recede until hovered, focused, or needed.
- Long guide rails and full-width decorative strips make a game scene feel like software.

BoardState must not copy Arena layouts, artwork, card frames, branding, assets, or protected UI styling.

## Corrective Standard

The active gameplay screen should read as one living Commander table:

- Battlefield first.
- Commander Action Hand second.
- Opponent and life information third.
- Contextual stack, phase, trigger, inspector, and utility surfaces only when relevant.
- Rare controls should remain visually quiet until hovered, focused, or explicitly opened.

The center of the display belongs to gameplay. Persistent controls should bias toward edges, corners, or the lower hand area.

## Implemented Runtime Boundary

- `src/ui/render.js` exposes `HUD_COMPOSITION_VERSION` as `boardstate-hud-composition-0.1.0`.
- `document.body.dataset.hudCompositionVersion` records the active composition pass.
- The battlefield root exposes `data-hud-composition-version`.
- `src/styles.css` adds the Prompt 12.3E composition pass after the existing battlefield and Action Hand styles so it refines presentation without changing interaction contracts.

## Accepted Refinements

- Top application chrome now recedes during gameplay and strengthens only on hover or keyboard focus.
- The tabletop guide ring is softened so it frames the scene instead of drawing a hard divider through the battlefield.
- Empty-board messaging is quieter and no longer competes with the table art.
- The phase chip remains readable but has lower idle weight.
- The Commander Action Hand keeps its fan, overlap, and priority-centered behavior, but its idle aura is narrower and less rail-like.
- Idle Action Cards recede through opacity, saturation, and shadow reduction while promoted, selected, expanded, waiting, and resolving cards remain strong.
- Idle "Action Hand Ready" status is hidden by default and appears only through interaction or when pending stack or trigger status needs the space.

## Rejected Changes

- Replacing the Commander Action Hand with a new concept.
- Moving core gameplay actions into a menu.
- Hiding the Action Hand entirely while idle.
- Enlarging battlefield art by sacrificing touch targets.
- Adding new gameplay controls or utilities.
- Removing accessible button semantics from Action Cards.

## Regression Rules

Future HUD work must preserve:

- `renderCommanderActionHand()` action routing.
- Action Card keyboard focus and button semantics.
- Contextual visibility of combat, resolve, inspect, and undo cards.
- Hidden-information boundaries.
- Landscape-only gameplay composition.
- No false Hub, Lite, or Deck Nexus availability.

Future visual work should use the squint, blur, five-second, and local-game-store tests before increasing persistent HUD weight.
