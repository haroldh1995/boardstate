# Commander Action Hand Design Record

Date: 2026-07-23

Prompt 12.3C supersedes Prompt 12.3 where the two conflict. The prior Command HUD was an exploration and is no longer BoardState's bottom interaction foundation.

## Research

Reference images were reviewed only for interaction principles:

- Current BoardState: the battlefield dominated the screen, but the bottom control surface still read as a static toolbar with equal-weight cards.
- Premium digital card games: players naturally check the lower screen area because the hand is where available decisions live.
- Arena close-up hand reference: the useful principle is not card appearance, but a fan that implies physical handling, focus lift, overlap, and attention migration.

BoardState should not copy Arena's artwork, card frame, layout, branding, animation, or protected identity. BoardState uses the same instinct for a different Commander-native object: a living hand of available decisions.

## Ideation

Five concepts were compared before choosing the production model:

1. Curved fan: familiar and readable, but too close to a simple row unless inactive actions are removed and priority controls the center.
2. Adaptive arc: strong screen balance, but becomes vague when many Commander utilities are present.
3. Layered fan: best physicality and overlap, but requires strict filtering so the hand never becomes a pile of inactive utilities.
4. Floating cluster: distinctive, but less instinctive for card-game players and weaker for keyboard traversal.
5. Radial grouping: strong for touch, but too menu-like and likely to compete with battlefield permanents.
6. Contextual cascade: expressive for stack and trigger chains, but too unstable as the default always-present interaction anchor.

## Whiteboarding

The selected model combines the curved fan and layered fan:

- Cards exist only for currently available or useful decisions.
- The highest-priority decision occupies the center slot.
- Secondary decisions alternate left and right from center.
- Cards overlap instead of occupying equal-width toolbar cells.
- Hovered or focused cards lift toward the player and move neighbors aside.
- The hand remains bottom-centered, compact, and smaller than the battlefield.

## Visual Mockups

Temporary visual mockup evaluation used three states:

- Empty battlefield: phase, commander, search, rules, reminders, and table tools should form a compact living hand without disabled combat or stack cards.
- Pending stack or trigger: resolve should be drawn into the center and visually promoted.
- Selected permanent or combat state: inspect or combat cards should appear and displace lower-priority cards.

Mockups that resembled a full-width toolbar, equal button row, ribbon, dashboard dock, or generic HTML controls were rejected.

## Interactive Prototype Gate

The accepted prototype requirements were:

- `renderCommanderActionHand()` uses existing action attributes rather than a second action system.
- `createCommanderActionCards()` filters unavailable actions and orders visible cards by priority.
- `renderCommanderActionCard()` exposes action identity, state, priority, and accessible labels.
- CSS uses overlapped fan layout, priority-based scale/lift, focus-visible states, neighbor displacement, subtle idle breathing, and reduced-motion fallbacks.

## Internal Design Critique

Rejected issues:

- Permanent disabled combat, resolve, context, and undo cards made the surface read as a toolbar.
- Equal card spacing reduced physicality.
- A full-width rail competed with the battlefield.
- Keeping the old Command HUD class names would make future prompts inherit the wrong mental model.

Accepted decisions:

- Table tools, search, commander, rules, reminder, and phase remain visible because they are valid ongoing Commander decisions.
- Combat, resolve, selected-card inspection, and undo are drawn only when useful.
- Action Cards remain `<button>` elements for accessibility, but they are styled and animated as handled game objects rather than application buttons.

## Production Standard

The production implementation lives in:

- `src/ui/render.js`: `COMMANDER_ACTION_HAND_VERSION`, `renderCommanderActionHand()`, `createCommanderActionCards()`, and `renderCommanderActionCard()`.
- `src/styles.css`: `.commander-action-hand`, `.action-card`, action-card states, fan physics, neighbor focus behavior, and reduced-motion handling.

The Commander Action Hand is presentation and action entry only. It does not own gameplay state, bypass the Rules Engine, duplicate the State Engine, create another save format, or expose hidden information.
