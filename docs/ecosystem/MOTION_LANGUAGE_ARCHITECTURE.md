# Motion Language Architecture

Date: 2026-07-25

Prompt 12.4 establishes BoardState's permanent motion language. This is not a visual-effects pass. Motion is a presentation contract that explains gameplay state, preserves player confidence, and remains separate from Rules Engine, State Engine, Event Knowledge, persistence, synchronization, and hidden-information authority.

## Reference Review

The supplied BoardState and Arena screenshots were reviewed only for motion principles: hand-like decision surfaces, card overlap, center emphasis, object momentum, readability, immediate feedback, and spatial continuity.

Useful principles:

- Input must acknowledge immediately even when a longer state transition continues.
- The center of a card fan should feel heavier and more readable than neighboring cards.
- Cards should accelerate and settle like premium physical collectibles, not bounce like arcade objects.
- Motion must preserve spatial awareness; users should understand where an object came from and why it stopped.
- Large Commander events require grouped, budgeted motion so the battlefield stays readable.

BoardState must not copy Arena assets, artwork, animation values, protected layouts, branding, or visual effects.

## Motion Token System

`src/ui/motionTokens.js` owns the reusable motion contract:

- `BOARDSTATE_MOTION_LANGUAGE_VERSION`
- `createMotionTokenSet()`
- `createMotionCssVariables()`
- `MOTION_STATE_CATALOG`
- `MOTION_OWNERS`
- `MOTION_DEBUG_FIELDS`
- `createMotionDebugSnapshot()`

The token set defines duration, delay, easing, physics, transform, and opacity values. Future tuning should modify these tokens rather than scattering new hard-coded animation values through components.

`src/styles.css` exposes matching CSS custom properties on `:root`:

- `--motion-duration-*`
- `--motion-delay-command-card-stagger`
- `--motion-ease-*`
- `--motion-physics-*`

Battlefield and Rotating Command Deck animation now consume these variables through existing BoardState-native CSS rather than introducing a second animation library.

## Animation States

Motion states are explicit and reusable:

- Cards: idle, hovered, selected, dragging, resolving, disabled, hidden, destroyed.
- Panels: closed, opening, active, inactive, closing.
- Command Cards: idle, rotating, highlighted, contextual-entry, contextual-exit, selected, waiting, disabled, resolving.

`src/ui/render.js` exposes `data-motion-owner`, `data-motion-state`, `data-motion-token`, and duration metadata where motion-capable battlefield surfaces render.

## Motion Ownership

`src/ui/landscapeBattlefield.js` exposes a presentation-only ownership plan:

- Battlefield owns camera focus, battlefield movement, and permanent lane reflow.
- Rotating Command Deck owns Command Card rotation, contextual entry/exit, and favorite feedback.
- Card Inspection owns selected-card lift and inspection overlays.
- Notification System owns toast arrival and non-modal feedback.
- Modal System owns blocking dialog entrance and dismissal.
- Opponent Carousel owns opponent focus movement and follow-active-player transitions.

Systems must not compete to animate the same object.

## Accessibility And Motion Budget

Reduced motion is honored at both model and CSS-token levels. Reduced-motion settings and `prefers-reduced-motion: reduce` collapse nonessential durations while preserving gameplay information through static state, legal/illegal targeting, selected-object emphasis, priority, combat, stack, and Commander indicators.

Motion remains a finite resource:

- Gameplay-critical movement wins.
- Supporting motion stays subtle.
- Ambient motion must never compete with the battlefield.
- Large Commander event groups should sequence or group movement instead of animating everything independently.

## Developer Debug Overlay

`renderMotionDebugOverlay()` in `src/ui/render.js` is gated by `import.meta.env.DEV` and the explicit local setting `boardstate-motion-debug=true`. It renders nothing in production builds.

When enabled locally, the overlay can expose:

- Current animation state.
- Motion token in use.
- Animation owner.
- Duration.
- Queue status.
- Interrupt policy.
- Active transition.
- Frame timing source.

The overlay is development-only and must never become player-facing production UI.

## Integration Boundary

Motion language is presentation-only. It does not:

- Mutate gameplay state.
- Replace or bypass the Rules Engine.
- Persist transient camera or animation state.
- Create a second event, replay, save, or sync authority.
- Expose hidden information.
- Claim Hub, Lite, or Deck Nexus availability.
- Copy protected Arena assets or animation identity.

Future prompts must consume this token, state, and ownership architecture before adding new animation behavior.
