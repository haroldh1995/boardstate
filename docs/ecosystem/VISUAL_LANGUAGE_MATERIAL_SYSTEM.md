# Visual Language And Material System

Date: 2026-07-26

Prompt 12.5 establishes BoardState's permanent visual language. This is not a feature prompt, animation pass, battlefield rewrite, or Arena clone. It defines the material, lighting, depth, shadow, glow, and debug standards that future BoardState interface work must inherit.

## Reference Review

The supplied BoardState screenshot and Arena references were reviewed only for visual principles: battlefield-first hierarchy, card readability, bottom-hand visual gravity, restrained contextual UI, depth clarity, and premium material cohesion.

Useful principles:

- The battlefield must be readable before controls are read.
- Interface surfaces should feel attached to one scene rather than stacked as independent panels.
- Materials need consistent lighting, edge treatment, shadow, and depth.
- Gold and glow should communicate importance, selection, priority, Commander emphasis, warning, or success. They must not be decorative noise.
- Empty space should frame gameplay instead of feeling like an unfinished panel.

BoardState must not copy Arena artwork, card frames, colors, assets, protected layouts, branding, or visual identity.

## AAA Design Process

The Prompt 12.5 visual pass explored multiple material directions before implementation:

- Void Glass: maximum transparency and atmosphere, rejected as too low-contrast for long Commander sessions.
- Obsidian Metal: high durability and strong edge treatment, retained for the Command Hand foundation.
- Ancient Stone Table: stable battlefield grounding, retained for table regions.
- Arcane Crystal: high-energy blue/purple treatment, retained for rules, focus, and information surfaces.
- Parchment Memory: warmer muted treatment for notes, history, and reminder surfaces, retained as a secondary material.
- Gold Relic: prestigious Commander treatment, retained only for Commander and high-priority emphasis.

The selected direction is a restrained BoardState-native blend: cosmic atmosphere, glass overlays, stone battlefield grounding, metal command structure, premium card stock for Action Cards, gold for Commander prestige, crystal for rules/focus, and parchment for memory/history.

## Visual Token System

`src/ui/visualTokens.js` owns the reusable visual contract:

- `BOARDSTATE_VISUAL_LANGUAGE_VERSION`
- `VISUAL_MATERIALS`
- `VISUAL_LAYERS`
- `VISUAL_DEBUG_FIELDS`
- `createVisualTokenSet()`
- `createVisualCssVariables()`
- `createVisualDebugSnapshot()`

The token set defines color, material, border, radius, elevation, shadow, glow, blur, opacity, and outline values. Future visual tuning should modify these shared tokens instead of scattering one-off colors, gradients, shadows, and glows through gameplay components.

`src/styles.css` exposes matching root variables:

- `--visual-color-*`
- `--visual-material-*`
- `--visual-border-*`
- `--visual-radius-*`
- `--visual-shadow-*`
- `--visual-glow-*`
- `--visual-blur-*`
- `--visual-opacity-*`
- `--visual-outline-*`

Existing BoardState colors, gold accents, cosmic wallpaper, and Action Card identity are preserved while becoming more centrally tunable.

## Material System

Materials are semantic, not decorative:

- Battlefield Atmosphere: ambient cosmic table depth behind gameplay.
- Glass: quiet shared surface treatment.
- Polished Glass: overlays, contextual panels, utility panels, and debug surfaces.
- Metal: Command Hand structure and durable table controls.
- Stone: battlefield/table grounding.
- Energy: active command center and high-priority contextual actions.
- Parchment: notes, history, reminders, and memory surfaces.
- Premium Card Stock: default Action Cards.
- Gold Accent: Commander and prestigious high-importance gameplay moments.
- Magical Crystal: rules, focus, and explanation surfaces.

Materials should not be assigned randomly. If a future surface does not fit an existing material, add a new token deliberately and document why.

## Lighting, Depth, Shadow, And Glow

Lighting establishes hierarchy:

- Gameplay and cards remain the primary visual read.
- The Rotating Command Deck is second and uses raised card stock/metal treatment.
- Contextual overlays use polished glass and elevated shadows.
- Debug overlays use the highest layer but render only in development.

Glow communicates state:

- Gold subtle: passive Commander/action readiness.
- Gold strong: promoted Action Cards, Commander emphasis, and selected premium moments.
- Crystal: rules, focus, information, and legal targeting emphasis.
- Warning: errors, illegal actions, or important recovery states.

Shadow communicates depth:

- Ambient shadows ground quiet surfaces.
- Panel shadows support reusable glass.
- Overlay shadows communicate modal/contextual elevation.
- Raised-card shadows communicate handled Action Cards.

## Runtime Integration

`src/ui/render.js` exposes:

- `document.body.dataset.visualLanguageVersion`
- `data-visual-language-version`
- `data-visual-material`
- `data-visual-layer`
- `data-visual-elevation`
- `data-visual-shadow`
- `data-visual-glow`

These attributes are presentation metadata only. They do not mutate gameplay state, alter action routing, persist visual state, expose hidden information, or claim ecosystem connectivity.

## Developer Debug Overlay

`renderVisualDebugOverlay()` in `src/ui/render.js` is gated by `import.meta.env.DEV` and the explicit local setting `boardstate-visual-debug=true`. It renders nothing in production builds.

When enabled locally, it can expose:

- Current Material Token.
- Elevation Level.
- Shadow Token.
- Glow Token.
- Border Token.
- Visual Layer.
- Opacity.
- Theme Reference.

The overlay is development-only and must never appear in production builds.

## Accessibility

Visual polish must not reduce contrast, legibility, touch accuracy, keyboard access, controller readiness, or long-session comfort. Material treatment must preserve readable text and obvious focus states even if color perception is reduced.

The visual language must pass:

- Squint test: battlefield, Action Hand, and active context remain clear.
- Grayscale test: hierarchy remains understandable without color.
- Screenshot test: idle gameplay looks professionally composed without relying on animation.

## Integration Boundary

The visual language is presentation-only. It does not:

- Mutate gameplay state.
- Replace or bypass Rules Engine, State Engine, or Event Knowledge Engine.
- Create a second theme system for gameplay authority.
- Persist transient presentation state in saves.
- Expose hidden information.
- Claim Hub, Lite, or Deck Nexus availability.
- Copy protected Arena visuals or assets.

Future prompts must consume this material, token, layer, and debug architecture before adding new visual treatments.
