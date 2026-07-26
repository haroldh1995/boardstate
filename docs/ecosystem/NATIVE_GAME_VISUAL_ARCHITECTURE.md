# Native Game Visual Architecture

Date: 2026-07-23

Prompt 12.1 establishes BoardState's permanent visual and interaction foundation. This is not a feature layer, alternate gameplay surface, or Arena clone. It is the repository-owned standard that future BoardState work must use when changing gameplay presentation.

## Foundational Principle

The battlefield is the application.

Every visible system exists to support Commander gameplay. When no contextual information is required, the player should primarily see the battlefield, permanents, commanders, stack state, turn/phase/priority status, and relevant table context. UI should become quiet when gameplay does not need it.

## Permanent Design Laws

1. Commander First: BoardState is not Arena and is not a general MTG client. If a decision benefits Commander but differs from Arena or another digital card game, choose the Commander solution.
2. Landscape Is Canonical: BoardState gameplay is landscape-only. Portrait gameplay, portrait navigation, portrait layout switches, and portrait optimization belong to BoardState Lite, not Advanced BoardState.
3. The Battlefield Is The Application: Gameplay must not feel like a page inside a web app. The interface should disappear until it has useful game information or a legal action to expose.
4. Digital Game First: BoardState may run on web technology, but gameplay must not resemble a website, dashboard, admin panel, enterprise tool, or responsive webpage.
5. Responsive Without Redesign: Devices reveal more battlefield, more table, more atmosphere, or more contextual information. They must not fundamentally reorganize gameplay into a separate portrait experience.
6. The Spectator Test: A passerby should quickly understand whose turn it is, who controls commanders, where combat or stack resolution is happening, and where attention belongs.
7. The Five Second Test: A first-time viewer should identify BoardState as a premium digital Commander game within five seconds.
8. The Local Game Store Test: BoardState should be visually memorable enough that another Commander player would ask what app is being used.

## Runtime Standards

- `src/main.js` preloads the landscape battlefield wallpaper for every gameplay startup path. The portrait wallpaper remains an asset for historical compatibility but is no longer selected by BoardState runtime.
- `src/state/schema.js` sets `settings.appearance.compositionMode` to `landscape`.
- `src/storage/localDatabase.js` normalizes legacy saved profiles back to `landscape` and retires `edgeSwipeShortcuts`, `compactMobileHud`, and `mobileFocusView` for BoardState runtime.
- `src/state/gameReducer.js` rejects attempts to switch `appearance.compositionMode` away from `landscape`.
- `src/ui/render.js` reports `data-gameplay-composition="landscape"` and `data-visual-foundation="boardstate-native-game-visual-foundation-0.1.0"` while keeping the existing widescreen CSS compatibility selector until the stylesheet can be fully consolidated.
- `src/ecosystem/ecosystemIntegration.js` exports shared preferences with `compositionMode: "landscape"` and refuses external preference patches that attempt to re-enable portrait/mobile gameplay composition.

## Retired Runtime Behavior

- BoardState no longer switches gameplay layout based on `orientationchange`.
- BoardState no longer exposes Auto Detect, Mobile View, or Widescreen View gameplay composition controls.
- BoardState no longer renders mobile page-swipe navigation controls for gameplay.
- BoardState no longer renders edge-swipe navigation zones.
- BoardState no longer selects the portrait wallpaper during startup.

Legacy CSS selectors containing `mobile`, `portrait`, or `body[data-composition="mobile"]` are compatibility remnants from earlier prompts. They are not active in the canonical runtime and should be removed opportunistically only when doing so does not risk current battlefield, tutorial, save, or accessibility behavior.

## Digital Tabletop Composition

The canonical BoardState gameplay composition keeps one game layout across phones, foldables, tablets, Chromebooks, desktops, and ultrawide monitors:

- Battlefield space is primary.
- Local battlefield remains visually anchored.
- One focused opponent battlefield remains readable.
- Command center stays compact unless stack, priority, combat, triggers, choices, selected cards, or explanations require expansion.
- Global table information is compact and contextual.
- Utilities appear as contextual overlays or rails, not permanent dashboard panels.
- Hidden or incomplete future systems remain hidden until production ready.

## Battlefield Reconstruction Standard

Prompt 12.2A supersedes earlier battlefield layout assumptions where they conflict. The battlefield is no longer treated as a set of permanent panels inside a page. It is a digital Commander tabletop with contextual overlays only when gameplay needs them.

Permanent standards:

- `src/ui/render.js` exposes `boardstate-tabletop-reconstruction-0.1.0` through `data-tabletop-reconstruction-version` and `document.body.dataset.tabletopReconstructionVersion`.
- The active battlefield must not render a permanent dashboard grid, fixed empty preview panel, idle stack box, large empty opponent rectangle, or boxed local battlefield container.
- The top application chrome is visually quiet during gameplay. Primary gameplay controls belong to the battlefield and Commander Action Hand, not a website-style header.
- Empty battlefields use subtle table-space cues instead of dashed placeholder panels or large bordered rectangles.
- The opponent and local areas remain actual table regions. Permanents, commanders, life totals, stack activity, combat, and selected-card context appear only as gameplay-relevant information.
- The reconstruction preserves BoardState's existing cosmic background and gold-accented identity while removing software-style containers that made the battlefield feel secondary.

## Commander Action Hand Standard

Prompt 12.3C supersedes the Prompt 12.3 Command HUD exploration. The bottom of the battlefield now carries the interaction role normally occupied by a digital player's hand, but it displays a living hand of available Commander decisions instead of Magic cards, generic web buttons, a toolbar, a ribbon, or a static dock.

Permanent standards:

- `src/ui/render.js` exposes `boardstate-commander-action-hand-0.1.0` through `data-commander-action-hand-version` and `document.body.dataset.commanderActionHandVersion`.
- The Commander Action Hand is the only bottom gameplay command surface on the battlefield.
- `renderCommanderActionHand()` replaces the old bottom HUD renderer. `createCommanderActionCards()` filters unavailable actions and orders visible cards by deterministic priority.
- Action Cards are gameplay decisions. They may open existing tools, utilities, rules assistance, reminders, Commander tools, search, combat, stack resolution, phase advancement, selected-card inspection, or undo. They do not own gameplay state.
- Inactive or irrelevant actions are not kept as permanent disabled toolbar items. Combat, resolve, selected-card inspection, and undo cards appear only when state makes them useful.
- The highest-priority Action Card migrates toward the center of the fan. Secondary cards alternate left and right from center.
- Action Cards overlap, fan, lift on hover/focus, move neighboring cards aside, and retain reduced-motion-safe equivalents.
- Utility, Rules Assistant, Remind Me, AI Analysis, and history surfaces open as contextual overlays while the battlefield remains visible.
- The Action Hand preserves BoardState's cosmic, gold-accented, glass-treated identity and must not copy Arena's cards, hand layout, artwork, animation, branding, or protected interface details.

The design process and rejected concepts are recorded in `docs/ecosystem/COMMANDER_ACTION_HAND_DESIGN.md`.

## HUD Composition And Visual Hierarchy Standard

Prompt 12.3E refines the active battlefield into a single scene without changing gameplay behavior or replacing the Commander Action Hand interaction model.

Permanent standards:

- `src/ui/render.js` exposes `boardstate-hud-composition-0.1.0` through `data-hud-composition-version` and `document.body.dataset.hudCompositionVersion`.
- The battlefield remains the first visual read. The Commander Action Hand is second, opponent/life information is third, contextual gameplay information follows, and secondary utilities remain visually quiet.
- Top application chrome, idle phase status, empty-board text, and inactive Action Cards must recede until hovered, focused, pending, selected, expanded, or resolving.
- Decorative rails, hard scene dividers, full-width idle strips, and equal-weight widget clusters are not allowed to compete with battlefield space.
- Action Cards keep their accessible button semantics, overlap, focus lift, neighbor displacement, priority ordering, and contextual visibility.

The corrective composition record lives in `docs/ecosystem/HUD_COMPOSITION_VISUAL_HIERARCHY.md`.

## Rotating Command Deck Standard

Prompt 12.3F replaces the fixed linear Action Hand projection with a circular Rotating Command Deck while preserving the existing Action Card material identity and action routing.

Permanent standards:

- `src/ui/render.js` exposes `boardstate-rotating-command-deck-0.1.0` through `data-command-deck-version` and `document.body.dataset.commandDeckVersion`.
- The deck is circular. Rotation must wrap through `normalizeCommandDeckIndex()` and must not expose a first or last card to the player.
- Only a visible hand-sized window of the full deck renders at once through `getVisibleCommandDeckCards()`.
- Core Command Cards keep stable order for muscle memory. User favorites may group near the front through `settings.commandDeck.favoriteIds`.
- Contextual Command Cards enter only when relevant and may be centered by `resolveCommandDeckPriorityCard()` without becoming permanent inactive clutter.
- Wheel, drag, keyboard, and controller-ready key aliases must produce the same rotation behavior.

The interaction architecture record lives in `docs/ecosystem/ROTATING_COMMAND_DECK_ARCHITECTURE.md`.

## Motion Language Standard

Prompt 12.4 establishes BoardState's motion language as a permanent visual and interaction standard.

Permanent standards:

- `src/ui/motionTokens.js` is the single source of truth for motion timing, easing, inertia, physics, state catalogs, ownership, and debug fields.
- `src/ui/landscapeBattlefield.js` consumes Motion Tokens through the existing presentation-only battlefield motion model instead of creating a parallel animation authority.
- `src/ui/render.js` exposes safe `data-motion-*` metadata and a development-only Motion Debug Overlay that is gated by `import.meta.env.DEV` and `boardstate-motion-debug=true`.
- `src/styles.css` uses root `--motion-*` variables for battlefield, Action Card, Rotating Command Deck, panel, notification, and reduced-motion behavior.
- Motion must answer why an object moved, where it is going, and why it stopped there.
- Gameplay-critical motion has priority. Supporting motion stays subtle. Ambient motion must never compete with the battlefield.

The permanent motion architecture record lives in `docs/ecosystem/MOTION_LANGUAGE_ARCHITECTURE.md`.

## Visual Language And Material System Standard

Prompt 12.5 establishes BoardState's visual language as a permanent material, lighting, depth, shadow, glow, and accessibility standard.

Permanent standards:

- `src/ui/visualTokens.js` is the single source of truth for color, material, border, radius, elevation, shadow, glow, blur, opacity, outline, layer, and visual-debug contracts.
- `src/ui/render.js` exposes `boardstate-visual-language-0.1.0` through `document.body.dataset.visualLanguageVersion`, active battlefield `data-visual-*` metadata, Command Hand metadata, Action Card material metadata, utility overlay metadata, and a development-only Visual Debug Overlay gated by `import.meta.env.DEV` and `boardstate-visual-debug=true`.
- `src/styles.css` maps existing BoardState cosmic, glass, gold-accented, Action Card, and overlay treatments to root `--visual-*` tokens.
- Materials are semantic: battlefield atmosphere, glass, polished glass, metal, stone, energy, parchment, premium card stock, gold accent, and magical crystal each communicate a distinct gameplay or interface role.
- Visual polish must preserve contrast, legibility, touch accuracy, keyboard focus, controller readiness, and long Commander-session comfort.

The permanent visual architecture record lives in `docs/ecosystem/VISUAL_LANGUAGE_MATERIAL_SYSTEM.md`.

## Audio Language And Haptics Standard

Prompt 12.6 establishes BoardState's sensory language as a permanent audio and haptic standard.

Permanent standards:

- `src/ui/sensoryTokens.js` is the single source of truth for generated Web Audio tokens, haptic tokens, sensory channels, priority levels, preference defaults, notification/action mapping, and sensory-debug contracts.
- `src/ui/render.js` exposes `boardstate-sensory-language-0.1.0` through `document.body.dataset.sensoryLanguageVersion`, battlefield `data-sensory-*` metadata, Rotating Command Deck metadata, Action Card sensory metadata, centralized notification/test feedback, and a development-only Sensory Debug Overlay gated by `import.meta.env.DEV` and `boardstate-sensory-debug=true`.
- `src/state/schema.js` and `src/storage/localDatabase.js` preserve `settings.sensory` with master, UI, gameplay, ambient, music, and reduced-haptics preferences while keeping existing sound and haptic opt-in controls compatible.
- Sensory feedback is presentation-only. Gameplay must remain fully understandable when muted, without haptics, or on browsers that do not support Web Audio or vibration.

The permanent sensory architecture record lives in `docs/ecosystem/SENSORY_LANGUAGE_ARCHITECTURE.md`.

## Adaptive Learning And Onboarding Standard

Prompt 13.1 establishes BoardState's first-time user experience and progressive learning standard.

Permanent standards:

- `src/onboarding/tutorialSystem.js` remains the single onboarding and tutorial owner. Future learning work must extend its Adaptive Learning Engine instead of adding parallel onboarding systems.
- `src/ui/render.js` exposes `boardstate-adaptive-learning-0.1.0` through `document.body.dataset.onboardingExperienceVersion`, first-launch choices, Helper Sprite guidance, and the Help and Learning options area.
- First-time users may choose guided practice or direct battlefield entry. Direct entry enables gentle contextual guidance; Do Not Show Again disables it.
- Guidance is brief, optional, dismissible, profile-scoped, and reduced as proficiency increases.
- Help remains available from Game Options without restarting onboarding.
- The Learning Debug Overlay is development-only and gated by `import.meta.env.DEV` plus `boardstate-learning-debug=true`.

The permanent onboarding architecture record lives in `docs/ecosystem/ADAPTIVE_LEARNING_ONBOARDING.md`.

## Reference Principles From Premium Digital Card Games

The attached Arena reference and comparable digital card games are used only for principles:

- Cards and permanents should be the visual center of gravity.
- Life totals, turn/phase/priority, stack activity, and combat state should be instantly scannable.
- Inactive UI should recede.
- Contextual controls should appear near the object or game state that caused them.
- Motion and focus should communicate change, not decorate the screen.
- Dense information should be grouped by gameplay meaning rather than by application feature category.
- Actions should happen while the battlefield remains visible.

BoardState must not copy Arena artwork, protected layout details, assets, branding, animations, or visual identity. BoardState remains cosmic, gold-accented, glass-treated, Commander-first, and rules-authoritative.

## Visual Audit Baseline

The Prompt 12.1 audit compared the current BoardState landscape runtime against the provided Arena landscape reference only for gameplay emphasis, visual hierarchy, information density, battlefield visibility, and native game presentation. The resulting implementation keeps BoardState's existing artwork and theme while making landscape composition permanent and removing runtime routes back to portrait/mobile gameplay composition.

## Future Work Rules

Future prompts that touch gameplay UI must:

- Review this document before changing battlefield presentation.
- Preserve the battlefield as the primary surface.
- Keep BoardState landscape-only.
- Avoid dashboard, admin, form-first, or website-style gameplay composition.
- Treat BoardState Lite as the owner of portrait physical-table companion interactions.
- Keep Hub, Lite, and Deck Nexus as ecosystem participants, not gameplay layout authorities.
- Preserve hidden-information boundaries, authoritative state, deterministic replay, rules explanations, confidence reporting, AI analysis, and save compatibility.

## Deferred Cleanup

Full stylesheet consolidation remains deferred. The current safe boundary retires portrait gameplay at runtime and documents remaining legacy selectors as noncanonical compatibility code. Removing those selectors should happen with dedicated visual regression coverage because `src/styles.css` also contains shared small-screen, overlay, accessibility, and reduced-motion behavior that is not purely portrait gameplay logic.
