# Canonical Gameplay Architecture

Date: 2026-08-25

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
2. Only loading may remain portrait; every post-loading application surface requires landscape.
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
- Ordinary transient notifications use a 1,500 ms total lifetime with a compositor-only 180 ms exit. Persistent or acknowledgement-required communication must opt out explicitly.
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

## Part 3 Card Lifecycle And Event Identity

Prompt 13.2.6 Part 3 establishes the card lifecycle, event identity, stack, resolve, preview, trigger, notification, replay, and gameplay communication architecture. The platform-neutral implementation lives in `src/gameplay/cardLifecycle.js`.

Card and gameplay-object lifecycle is authoritative state. Animation state is presentation state. A card may move through lifecycle states such as in hand, being selected, being cast, on stack, resolving, entering battlefield, battlefield, moving to graveyard, exiled, returning to command zone, returning to hand, moving to library, revealed, copied, token created, and ceasing to exist.

Every meaningful gameplay event must have a stable event identity. Cast, resolve, zone-change, trigger, token-creation, counter-change, life-change, combat, land-play, replacement-effect, inspection, undo, and replay events use event IDs that presentation adapters can consume. A component rerender, trigger queue update, notification receipt, Command Hand rotation, inspection open/close, or opponent switch must not replay an animation for an event that has already played.

Presentation events are idempotent. `createCardPresentationPayload()`, `createPresentationLedger()`, `shouldPlayPresentationEvent()`, and `markPresentationEventPlayed()` define the canonical contract: one authoritative event creates one primary presentation event. Presentation payloads are explicitly `presentationOnly`, must not mutate rules state, and expose `shouldReplayOnRender: false`.

## Part 3 Live Tracking Versus Full Control Policy Separation

Live Tracking and Full Control share the same rules engine, card state, zone state, stack model, trigger model, animation language, card rendering, and interaction architecture. They differ through mode interaction policy, not through separate gameplay engines.

- Live Tracking infers deterministic consequences, avoids redundant digital priority passes, and uses one Resolve per uncontested stack object.
- Full Control may request more explicit digital choices, priority decisions, costs, modes, targets, and responses because BoardState is acting as the complete digital play surface.
- Both modes must produce equivalent authoritative rules outcomes for equivalent actions.
- Neither mode may fabricate hidden information. If hidden information is required, BoardState must ask the smallest safe question or use an appropriate randomization workflow.

Direct deterministic Live Tracking actions do not require Resolve. This includes land play, life changes, counter changes, token creation, static/continuous effect updates, state-based actions, commander tax updates, and commander damage updates.

## Part 3 Stack And Single Resolve Behavior

The stack is authoritative rules state. A stack object resolves independently only when it is an actual Magic stack object. A spell's deterministic internal instructions are not separate stack objects.

For an uncontested Live Tracking spell or ability, one Resolve completes the current stack object and deterministic consequences. After Resolve, BoardState finishes the object, applies deterministic state changes, processes replacement effects, generates triggers, identifies mandatory choices, and either continues automatically or presents the next genuine decision. It must not replay the original cast/resolution animation or ask Resolve again for the same object.

Repeated Resolve interactions are permitted only when actual independent stack objects remain or a genuine player decision is required.

## Part 3 Preview Roles

Battlefield permanents, casting previews, inspection previews, and stack objects are separate presentation roles:

- A battlefield permanent is compact battlefield representation and remains a real card on the tabletop.
- A casting preview is temporary and belongs to the protected gameplay corridor.
- An inspection preview is deliberate, presentation-only, and must not mutate authoritative state.
- A stack object is temporary stack presentation and resolves according to stack order.

Closing inspection must restore the previous gameplay context, including focused opponent, Command Hand focus, selected IDs, zone scroll positions, and expanded stacks where applicable.

## Part 3 Trigger And Replacement Handling

Trigger presentation distinguishes automatic triggers from decision-requiring triggers. Automatic triggers process without meaningless prompts in Live Tracking. Optional triggers, target choices, ordering decisions, and manual effects surface as contextual decisions.

Trigger floods must be grouped or batched visually where practical while preserving exact authoritative trigger data. Replacement effects are not stack objects unless the rules model explicitly marks them as stack objects. Replacement choices appear at the correct point, then the original event continues without replaying from the beginning.

## Part 3 Gameplay Communication Hierarchy

When multiple systems want attention, use this priority order:

1. Mandatory current player decision.
2. Critical rules state.
3. Active casting/resolution.
4. Active combat.
5. Active stack/priority.
6. Selected or inspected card.
7. Relevant contextual command.
8. Important gameplay notification.
9. Reminders.
10. Helper or educational guidance.
11. Social notifications.
12. Decorative information.

`resolveGameplayAttentionOwner()` is the platform-neutral model for this hierarchy. Notifications use `classifyNotificationPriority()` and `shouldDeferNotification()` so low-priority communication yields to protected gameplay focus. Full-window notifications are still suppressed on the battlefield, and ordinary toasts must remain edge-safe.

Transient presentation timing is platform-neutral policy in `src/gameplay/cardLifecycle.js`. Ordinary notifications dismiss after 1,500 ms, including their 180 ms exit transition, while recovery actions and acknowledgement-required messages remain available until handled. The canonical cast spotlight lasts 1,050 ms. These durations control presentation only and never delay or complete authoritative gameplay.

Helper Sprite, Table Assist, educational guidance, friend activity, reminders, and ordinary notifications must yield during casting, resolving, targeting, combat, important card inspection, and stack interaction.

## Part 3 Replay, Undo, And Event History

Replay is observational. It must reference canonical event history and must never cast a spell again, trigger abilities again, change counters, change life, change zones, re-enter permanents, or modify the stack.

Undo may reverse eligible tracked state changes but must not replay the original forward animation after restoration. Unsafe Undo across complex unresolved stack state must be blocked or explained rather than corrupting authoritative state.

Gameplay event history remains separate from rendered animation history. This supports Remind Me, Why explanations, replay, Undo, debugging, and future synchronization.

The Prompt 14 timeline baseline is `boardstate-timeline-relationship-1.0.0`. `createTimelineExperience()` derives readable filters, turn/phase groups, bounded pages, and public relationship explanations from Event Knowledge and action envelopes. `createReplayObservation()` returns a frozen sanitized presentation view; the legacy `REPLAY_TO_ACTION` reducer command is a compatibility no-op and can never replace the live session. Returning to live dismisses the observation and reveals the current authoritative synchronized state.

## Part 3 Native-Portable Event Architecture

Gameplay events are platform-independent data structures. A cast event means an authoritative gameplay event occurred; it does not mean a DOM element started a CSS animation. Web, SwiftUI, and future native presentation adapters may render the same event differently without altering authoritative rules state.

Modified systems must preserve platform portability and avoid DOM-only behavior, browser-only lifecycle assumptions, URL state as gameplay state, CSS layout as rules logic, hover-only functionality, or browser-only persistence/media/permission behavior outside adapter boundaries.

## Part 4 Input Intent Architecture

Prompt 13.2.6 Part 4 establishes a platform-neutral input intent layer in `src/gameplay/inputIntent.js`. Presentation input resolves into semantic intents such as tap select, inspect, card drag, zone scroll, Command Hand rotation, opponent switch, target, confirm, cancel, context action, allowed pan, and accessibility activation.

Exactly one owner may control an active gesture. Ownership priority is mandatory gameplay, explicit card drag, active targeting, Command Hand, zone-local overflow scrolling, opponent navigation, card inspection, then background interaction. Once a gesture owner is established, the same gesture must not transfer to another system. Reaching a zone edge does not convert zone scrolling into opponent switching.

Touch, pointer, mouse, trackpad, keyboard, screen-reader, and future controller inputs must resolve into the same semantic intent vocabulary. Hover may enhance usability but must never be required for essential gameplay. Browser events are adapter details; gameplay and interaction policy do not depend on DOM-only behavior.

## Part 4 Multiplayer Focus And Opponent Navigation

The local player battlefield remains the fixed anchor. Only the focused opponent presentation changes during opponent navigation. Opponent switching must never move the local battlefield, Command Hand, or protected gameplay corridor.

Two-player games do not show useless opponent carousel navigation. Three-player and four-player games expose circular opponent navigation through swipe, previous/next arrows, and compact direct selection. Opponent order remains stable and follows table seating. Eliminated opponents remain identifiable without causing remaining opponents to swap identities unexpectedly.

The compact table radar answers who is at the table and who is currently focused. It communicates player identity, life, commander marker where available, active turn, priority/focus, and eliminated state. It must not duplicate every opponent battlefield or shrink cards into unreadable miniatures.

Opponent switching and zone-local scrolling remain separate. Swipes that originate inside an overflowing zone scroll that zone only. Swipes on eligible opponent background may switch opponents. Opponent arrows remain reliable whenever multiple opponents exist, including crowded board states where safe swipe space is limited.

## Part 4 Command Hand Focus And Rotation

The Tactical Command Hand remains a permanent gameplay control surface and must read as a fan of premium TCG command cards, not a toolbar, menu strip, or generic carousel.

At rest exactly one command card is focused. The focused command is mathematically centered, frontmost, highest z-order, most elevated, strongest restrained focus, preview owner, activation owner, hit-test owner, and accessibility focus source. These states derive from one canonical command identity. CSS order, hover state, stale preview state, and visual clones may not override it.

During active swiping the hand moves freely inside its locked wheel. When input ends, it decelerates and snaps to the nearest valid command center. Persistent commands form an infinite circular sequence with no visible beginning or end. If visual clones are used for seamless presentation, every clone maps back to one canonical command identity and must not become an independent command.

Hit testing is depth-aware. The foremost focused card wins overlapping hit regions, while exposed portions of rear cards may remain selectable according to the interaction model. Command Hand gestures never switch opponents, scroll battlefield zones, or drag battlefield permanents.

## Part 4 Responsive Landscape Composition

Active gameplay remains one fixed landscape viewport on phones, tablets, desktops, ultrawide displays, and future native shells. Responsive behavior is semantic: available opponent territory, protected corridor, local battlefield, Command Hand footprint, safe areas, density state, and overflow needs determine composition.

Do not convert active gameplay into a portrait-style vertical document. No post-loading application surface or active gameplay requires vertical page scrolling. If landscape space is not available, the platform adapter must request native landscape where supported and otherwise replace the application with orientation guidance until landscape returns. The web adapter must never rotate the full application with CSS to simulate landscape inside a portrait viewport.

Phone landscape prioritizes battlefield, current gameplay interaction, Command Hand, life/essential state, opponent navigation, and secondary utilities in that order. Tablets use extra room for readability and reduced overlap without changing conceptual geography. Desktop and ultrawide preserve intentional table composition rather than becoming dashboards or sidebars.

Safe areas, cutouts, rounded corners, home indicators, and system gesture regions are presentation constraints, not gameplay state. Orientation enforcement remains behind platform-compatible adapters.

## Part 4 Accessibility And Performance

Accessibility preserves the canonical tabletop unless an explicit alternate accessibility mode is intentionally invoked. Screen-reader semantics must expose player, opponent, life, card, zone, tap state, counters, commander, focused command, stack object, current turn/phase, and mandatory decisions. Reduced motion simplifies nonessential transitions while preserving state-change clarity. High contrast cannot rely only on subtle color differences.

Performance is part of quality. Command Hand rotation must not rerender the entire battlefield or recompute rules state. Zone scrolling must not rerender unrelated zones. Opponent switching must not recompute the rules engine. Animation timing is presentation state and must never define authoritative rules state.

High-frequency transitions are limited to compositor-friendly transform and opacity changes. Large groups of battlefield cards must not permanently allocate filter, shadow, or layout animation layers. Card art remains unobstructed during normal battlefield presentation: readability veils and duplicate centered selection previews may not cover an available card image. Selection alone does not activate targeting visuals; those visuals require a real pending target decision. A single populated battlefield lane expands into its available region before density reduction or overflow is considered.

Large Commander states must remain interactive during Command Hand rotation, zone scrolling, card inspection, opponent switching, targeting, and stack interaction. The architecture tracks these boundaries through `createInteractionPerformanceBudget()` and the landscape model's performance contract.

The Prompt 17 reproducible baseline exercises a 360-object battlefield, 500 repeated Command Hand projection cycles, a 5,000-event paged timeline, ten-player opponent metadata, realistic phone safe areas, keyboard semantics, reduced motion, and screen-reader labels in `test/performance-accessibility-baseline.test.js`. These checks protect bounded presentation work without making frame timing or browser primitives authoritative gameplay requirements.

## Part 5 Release Baseline

Prompt 13.2.6 Part 5 is the master proof-of-correctness baseline for Parts 1 through 4. It does not introduce a competing architecture. It verifies that the canonical gameplay laws, battlefield geography, card lifecycle, input intent, Command Hand, responsive landscape composition, accessibility, performance, and portability contracts work together under realistic Commander conditions.

The Platform-portability law remains active during Part 5. Shared gameplay, rules, state, event, geometry, input-intent, resolve, notification-intent, accessibility, and performance models must stay independent of DOM objects, CSS-driven rules truth, browser storage as sole persistence, browser lifecycle as gameplay lifecycle, hover-only required actions, browser event names as semantic gameplay events, and browser-only orientation behavior. Browser-specific behavior belongs in the web presentation adapter, not authoritative gameplay architecture.

Part 5 validates these release gates:

- Empty, early, normal, busy, extreme, token swarm, superfriends, artifact-heavy, enchantment-heavy, and Voltron battlefield states retain fixed landscape tabletop geography.
- Creatures remain horizontal, planeswalkers remain far-right in the creature region, lands remain the primary lower region, and noncreature nonland permanents remain far-right in the lower support region.
- Density escalates through spacing, overlap, duplicate stacking, equivalent grouping, support stacking, scaling, grouped presentation, and only then zone-local horizontal scrolling.
- Authoritative object identity survives grouping, stacking, token quantities, attachments, counters, tapped state, graveyard/exile movement, preview, replay, Undo, and inspection.
- Multiplayer keeps exactly one focused opponent battlefield, compact table awareness, circular opponent navigation, stable seating order, local battlefield anchoring, independent zone-scroll memory, and no mid-gesture transfer from zone scrolling to opponent switching.
- The Tactical Command Hand retains infinite circular navigation, free active motion, post-release snap, exactly one centered focus, frontmost focused card, highest z-order, correct highlight, correct preview, correct activation, depth-aware hit testing, and canonical clone identity.
- Live Tracking uses one Resolve for an uncontested stack object, while deterministic land, life, counter, token, static, continuous, commander-tax, and commander-damage changes do not create redundant Resolve requirements.
- Gameplay events own stable identities, animations are idempotent, and render-only updates such as notifications, inspection, opponent switching, zone scrolling, or Command Hand rotation must not replay previous cast or resolution events.
- Notifications, helpers, reminders, assistant messages, and social messages obey the gameplay communication hierarchy and never permanently obstruct the protected gameplay corridor, focused Command Hand card, casting, resolving, targeting, combat, or active stack work.
- Phone landscape, tablet, desktop, and ultrawide composition remain fixed, safe-area-aware, and game-like rather than dashboard-like or document-like.
- Accessibility exposes meaningful semantics and preserves state-change clarity under reduced motion, large text, high contrast, keyboard navigation, screen readers, and future controller-style focus.
- Shared gameplay, rules, state, event, geometry, input-intent, and performance models remain platform-neutral and suitable for future SwiftUI/native presentation adapters.

The Part 5 automated baseline lives in `test/canonical-gameplay-part5.test.js`. It is intentionally broader than an isolated unit suite: it combines stress board models, multiplayer navigation, gesture-contamination checks, Command Hand focus matrices, Live Tracking resolve behavior, event idempotence, replay/preview separation, notification hierarchy, device composition, accessibility, performance, static renderer/CSS assertions, and shared-code portability scans.

## Regression Blacklist

The following failures are release-blocking for active gameplay:

- Global layout failures: vertical webpage gameplay, global battlefield scrolling, document-style stacked gameplay sections, portrait gameplay after loading, player/opponent battlefield pushed off-screen, Command Hand below scrollable content, dashboard replacement, or permanent center obstruction.
- Card presentation failures: oversized preview permanents, generic UI tiles, cropped horizontal card banners, text-only permanent replacement, stale cast or inspection previews, lost TCG proportions, misplaced planeswalkers, misplaced support permanents, hidden attachments, or stacking that erases authoritative individuality.
- Command Hand failures: center card not foremost, wrong z-order, wrong highlight, wrong preview, wrong activation, wrong hit testing, multiple focus owners, focus/center disagreement, rear card dominance, resting between commands, hard active-swipe locking, visible wrap jump, clone identity corruption, temporary command corruption, or gesture leakage into battlefield navigation.
- Multiplayer failures: missing opponent swipe on manageable boards, missing arrows with multiple opponents, unusable arrows on crowded boards, local battlefield movement during opponent switch, Command Hand reset during opponent switch, lost presentation memory, zone-edge swipe transferring to opponent switch, unstable order, unreadable permanently shrunk opponents, or active player forcibly stealing view focus.
- Resolution failures: redundant Live Tracking Resolve prompts, lands requiring Resolve without rules need, deterministic ETB/token/counter/static consequences requiring Resolve, spell substeps masquerading as stack objects, replacement effects incorrectly treated as stack objects, animation replay after Resolve, and Resolve UI blocking the resolving object.
- Communication failures: notifications, helpers, reminders, social messages, or duplicate assistant surfaces covering casting, resolving, combat, targeting, focused Command Hand, or active mandatory gameplay decisions.
- State failures: inspection, replay, scroll, animation, Command Hand browsing, visual clones, opponent focus, or presentation state mutating authoritative rules state.
- Performance failures: visible Command Hand hitches, normal zone-scroll hitches, whole-game rebuilds during opponent switches, rules recomputation from presentation-only movement, unusable large boards, trigger-flood loops, memory growth from rapid navigation, delayed long sessions, or stale animation queues.
- Platform-portability failures: new browser-only authoritative gameplay implementation, DOM objects in gameplay state, CSS as rules truth, browser event names as semantic gameplay events, hover-only required action, browser storage as sole persistence, browser lifecycle as gameplay lifecycle, or any unnecessary block to future SwiftUI adaptation.

Part 5 does not lock the architecture by itself. It proves that the foundation is ready for the next architecture-lock phase only when local implementation, remote repository, and production deployment all represent the same approved gameplay architecture.

## Part 6 Architecture Lock Baseline

Prompt 13.2.6 Part 6 locks the validated Parts 1 through 5 result as the canonical gameplay baseline. The baseline identifier is `boardstate-13.2.6-locked-baseline`, implemented in `src/gameplay/architectureLockdown.js`.

This lock is a development contract, not a feature freeze. Future work may improve visuals, rules support, Full Control, multiplayer, accessibility, performance, and native presentation, but it must extend the validated architecture unless an explicit architecture migration replaces one or more canonical laws.

The canonical lock requires:

- Active gameplay remains spatial, landscape-first, fixed-viewport, and free of global vertical gameplay scroll.
- Battlefield geography remains playmat-inspired: creatures horizontal, planeswalkers far-right in the creature region, lands primary in the lower region, and noncreature nonland permanents far-right in the lower support region.
- Cards on the battlefield remain card-shaped battlefield permanents, distinct from casting previews, inspection previews, stack objects, search results, and Command Hand cards.
- Density management precedes zone-local horizontal overflow; overflow never moves the entire battlefield or another zone.
- Multiplayer keeps one primary focused opponent, stable circular order, reliable arrows, direct compact selection, local battlefield anchoring, and opponent presentation memory where practical.
- Command Hand focus, center, z-order, highlight, preview, activation, and hit testing derive from one canonical command identity.
- At stable rest, only the centered/frontmost Command Card may execute. Pressing a visible rear card first rotates that canonical command to the focus anchor; it cannot activate a different command through overlap, and rear cards stay outside sequential keyboard focus.
- Command Hand movement remains free during input, snaps after motion, rotates infinitely, and treats visual clones as presentation aliases only.
- Live Tracking keeps the one-Resolve default for uncontested stack objects, automatically completes deterministic consequences, and presents genuine choices directly without replaying original resolution.
- Semantic gameplay event identity owns animation idempotence; presentation rerenders do not recreate authoritative events.
- Notifications, helpers, reminders, and social surfaces yield to mandatory decisions, casting, resolution, targeting, combat, active stack work, inspection, and focused Command Hand interactions.
- Presentation state cannot become authoritative rules state.
- Shared gameplay modules stay platform-neutral and preserve the future Swift Playgrounds / SwiftUI native adaptation path.

## Part 6 Canonical Gameplay Laws

The locked canonical laws are discoverable in `LOCKDOWN_CANONICAL_GAMEPLAY_LAWS`:

- Laws 1-7 protect the spatial fixed landscape battlefield, no global gameplay scroll, anchored local territory, stable tabletop geography, card-shaped permanents, and temporary preview roles.
- Laws 8-15 protect creature geography, planeswalker placement, lower land/support geography, density-before-scroll, zone-local overflow, separate opponent navigation, reliable arrows, and stable opponent order.
- Laws 16-24 protect the Command Hand as a TCG hand with exactly one centered frontmost focus, one focus source of truth, free active movement, snap, circular rotation, clone identity, and temporary contextual commands.
- Laws 25-30 protect Live Tracking speed, one Resolve by default, automatic deterministic consequences, explicit genuine decisions, real stack objects, and hidden-information safety.
- Laws 31-35 protect semantic event identity, presentation-only animation, animation idempotence, gameplay visual priority, and the protected gameplay corridor.
- Laws 36-40 protect deterministic gesture ownership, no mid-gesture transfer, authoritative/presentation state separation, shared Live Tracking / Full Control rules truth, and platform portability.

## Part 6 Responsibility Map

The authoritative implementation locations are:

- Battlefield composition: `src/ui/landscapeBattlefield.js`, `src/gameplay/battlefieldGeometry.js`.
- Battlefield card rendering: `src/ui/render.js`, `src/styles.css`.
- Card-zone assignment, planeswalker placement, support-permanent placement, density management, stacking/grouping, and zone overflow: `src/gameplay/battlefieldGeometry.js`.
- Opponent focus, opponent navigation, table radar, input intent, gesture ownership, responsive landscape composition, accessibility semantics, and interaction performance budgets: `src/gameplay/inputIntent.js`, consumed by `src/ui/landscapeBattlefield.js` and `src/ui/render.js`.
- Command Hand focus math, projection, snap, free rotation, z-order, and infinite rotation: `src/gameplay/commandDeckModel.js`, `src/gameplay/inputIntent.js`, `src/ui/render.js`, and `src/styles.css`.
- Card lifecycle, stack, resolution, trigger presentation, event identity, presentation ledger, preview roles, replay observation, and notification priority: `src/gameplay/cardLifecycle.js`, `src/gameplay/canonicalGameplay.js`, `src/effects/effectEngine.js`, and `src/state/gameReducer.js`.
- Commander assignment, canonical command-zone casting, commander tax, and tracked mana payment: `src/game/commanderSystem.js`, `src/game/manaSystem.js`, `src/effects/effectEngine.js`, and `src/state/gameReducer.js`. A commander cast is a real stack object; a countered local commander creates an explicit destination choice, while simulation opponents use the same zone semantics with deterministic AI policy.
- Event Knowledge timeline, turn/phase grouping, relationship explanations, bounded history presentation, and read-only replay observation: `src/authoritative-core/timelineRelationshipEngine.js`, rendered by `src/ui/render.js`.
- Inert rule-reference imports, explicit no-silent-effect recovery cases, constrained continuation intent, and immutable recovery audit history: `src/authoritative-core/rulesRecoveryEngine.js`, integrated by `src/state/gameReducer.js` and rendered by `src/ui/render.js`.
- Persistence, save/restore, replay metadata, checkpoints, canonical saves, and transient presentation sanitization: `src/persistence/canonicalPersistence.js`, `src/storage/saveState.js`, and `src/state/gameReducer.js`.
- Platform adapters: `src/platform/runtimeEnvironment.js`, `src/storage/localDatabase.js`, and web service adapters such as `src/services/scryfallService.js`.
- Canonical Scryfall search intent, predictive request identity, stale-response suppression, animation-aware suspension, and semantic action deduplication: `src/gameplay/scryfallSearchModel.js`, rendered by `src/ui/render.js` through the platform service boundary in `src/services/scryfallService.js`.
- Land play policy, per-turn allowance, additional-land permissions, and Live Tracking / Full Control timing differences: `src/game/landPlaySystem.js`, integrated through `src/state/gameReducer.js`.
- Architecture lock and guardrail metadata: `src/gameplay/architectureLockdown.js`.
- Regression protection: `test/canonical-gameplay-architecture.test.js`, `test/canonical-gameplay-part2.test.js`, `test/canonical-gameplay-part3.test.js`, `test/canonical-gameplay-part4.test.js`, `test/canonical-gameplay-part5.test.js`, and `test/canonical-gameplay-part6.test.js`.

Do not create duplicate active implementations for these responsibilities. If a legacy path is still needed, quarantine it behind an explicit compatibility boundary and prevent it from activating blacklisted gameplay architecture.

## Part 6 Guardrails

Architecture-critical tests must protect:

- Battlefield invariants: anchored local territory, horizontal creature region, far-right planeswalkers, canonical lower land/support region, no vertical gameplay scroll, card-shaped permanents, zone-local overflow, and grouping that preserves authoritative identity.
- Command Hand invariants: exactly one focus, center means front, highest z-order, correct highlight, correct preview, correct activation, depth-aware hit testing, snap, infinite wrapping, clone identity, contextual command cleanup, high-speed motion, and direction reversal.
- Multiplayer invariants: stable circular order, arrows whenever multiple opponents exist, direct compact selection, local battlefield anchoring, independent zone scrolling, no zone-edge transfer, and opponent state restoration.
- Resolve and event invariants: one Resolve for uncontested Live Tracking objects, deterministic consequences automatic, genuine choices direct, genuine stack objects independent, replacement effects not automatically stack objects, semantic event IDs stable, replay observational, and animations idempotent.
- Gesture invariants: one active gesture owner, no mid-gesture transfer, Command Hand gestures do not leak, zone scroll does not switch opponents, opponent navigation does not drag cards, and targeting can survive allowed presentation navigation.
- Notification invariants: low-priority communication cannot cover casting, resolution, targeting, combat, active stack work, or focused Command Hand interaction.
- Persistence and lifecycle invariants: restore authoritative gameplay first, normalize invalid presentation state, do not restore mid-swipe, active drag, hover, completed toast, or expired helper state, and never replay completed events because a session was restored.
- Portability invariants: shared gameplay modules must not depend on platform-specific presentation primitives; platform behavior belongs behind adapters.
- Performance invariants: presentation-only interactions must not recompute authoritative rules or rebuild unrelated battlefield regions.

## Part 6 Future Feature Integration Contract

Any future feature touching active gameplay must identify:

- What authoritative state it modifies.
- What presentation state it modifies.
- What semantic interaction intent it introduces.
- Which canonical gameplay laws it touches.
- Whether it affects Live Tracking, Full Control, Command Hand behavior, battlefield geography, multiplayer navigation, gesture ownership, mobile landscape, accessibility, performance, or platform portability.

A future feature may intentionally replace a canonical law only through an explicit architecture migration. That migration must identify the law, define replacement behavior, justify the improvement, update this document, update affected tests, and revalidate adjacent systems, Live Tracking, Full Control compatibility, multiplayer, performance, accessibility, and platform portability.

## Part 6 SwiftUI / Native Adaptation Contract

BoardState's shared gameplay architecture must remain copy-adaptable into a Swift Playgrounds / SwiftUI native workflow. Shared modules express gameplay state, card identity, zone state, stack state, trigger state, command focus, opponent focus, interaction intent, animation intent, notification intent, persistence intent, orientation policy, safe-area policy, and accessibility semantics.

Web rendering remains one client. Platform-specific storage, pointer/touch events, orientation enforcement, media, notification behavior, and shell lifecycle handling must remain replaceable at the platform boundary. Browser presentation must not become the definition of BoardState gameplay.

## Part 6 Visual And Performance Baseline

Future visual development is encouraged, but it may not casually destroy spatial battlefield geography, card identity, Command Hand behavior, protected gameplay corridor, fixed landscape composition, opponent navigation, zone-local overflow, touch usability, accessibility semantics, or platform portability.

The reproducible performance baseline covers normal boards, busy boards, 100+ object boards, token floods, counter floods, trigger floods, board wipes, rapid opponent switching, repeated Command Hand rotation and wrap, zone scrolling, targeting, and long sessions. Do not introduce presentation-only work that unnecessarily recomputes authoritative rules, replays completed events, accumulates animation queues, leaks clone state, or degrades long-session interaction.

## Implementation Boundary

This Part 1 contract is implemented by:

- `src/gameplay/canonicalGameplay.js`
- `src/gameplay/battlefieldGeometry.js`
- `src/gameplay/cardLifecycle.js`
- `src/gameplay/commandDeckModel.js`
- `src/gameplay/inputIntent.js`
- `src/gameplay/architectureLockdown.js`
- `src/ui/landscapeBattlefield.js`
- `src/ui/render.js`
- `src/styles.css`
- `test/canonical-gameplay-architecture.test.js`
- `test/canonical-gameplay-part2.test.js`
- `test/canonical-gameplay-part3.test.js`
- `test/canonical-gameplay-part4.test.js`
- `test/canonical-gameplay-part5.test.js`
- `test/canonical-gameplay-part6.test.js`

Future parts must continue from this architecture without redefining these concepts.

## Phase 13.3 Canonical Search And Workflow Baseline

The canonical BoardState card search is a temporary in-scene popup, not a route or full-page gameplay replacement. It opens with a focused search field, debounces predictive lookup, exposes three immediate results by default, rejects stale request identities, preserves battlefield and Command Hand presentation context, supports keyboard and modal dismissal, and degrades safely to the embedded local card reference when Scryfall is unavailable.

Search presentation never owns gameplay event identity. Confirming a card action records one semantic search action, clears the popup before a critical cast or entry presentation begins, and cannot duplicate a cast, land play, token, counter, or trigger through popup rerendering. Duplicate suppression is scoped to one explicit popup invocation: rapid repeat input is rejected, while closing and deliberately reopening search creates a new valid interaction identity. While casting, resolution, combat, board-wipe, or another protected presentation is active, search opening is deferred or an open search is suspended. Query and selection context may return only after the protected window expires and only when no mandatory decision has superseded it.

The search interaction model is platform-neutral. Web focus, keyboard, backdrop, and network cancellation behavior are presentation/service adapters; query state, request identity, result selection, action identity, critical-attention policy, and restore policy are semantic application state suitable for a native SwiftUI renderer.

Land play uses the same shared-mode policy. Live Tracking records a physical-table land play immediately without creating a stack object or Resolve prompt. Strict Full Control and Dry Run enforce main-phase timing, an empty stack, and current land allowance. Additional-land permissions extend the allowance, and turn transition resets only the per-turn play count. Presentation expiration is never gameplay truth: once a protected animation window expires, stale presentation metadata cannot block later commands or card search.

## Commander Casting And Simulation Persistence Baseline

Commander casting uses the canonical casting pipeline rather than bypassing the stack. The current command-zone card snapshot, commander tax paid for this cast, payment-source identity, semantic cast event, response window, resolution, and resulting battlefield state remain coherent. Strict Full Control and Dry Run enforce timing and tracked payment; fast Live Tracking may record physical payment without fabricating additional confirmation steps. Commander tax increases when the commander is cast, not when it returns to the command zone. A countered local commander enters its destination first and presents the genuine command-zone choice without replaying the cast.

Internal AI simulation frames retain semantic Event Knowledge but do not accumulate duplicate full-session replay snapshots or phase checkpoints. User decisions, turn changes, stack boundaries, winners, eliminations, and the maximum autosave interval remain immediate persistence boundaries. Intermediate simulation frames are coalesced into a short settled save. This is a performance policy only: it cannot remove authoritative events, decisions, turn checkpoints, or recovery state.
