# Commander Modernization Roadmap

This roadmap preserves the existing BoardState application and evolves it in place. Each phase must follow `docs/ecosystem/BOARDSTATE_CONSTITUTION.md`: inspect first, reuse existing systems, refactor before replacing, extend before rebuilding, and avoid duplicate rules, state, event, save, sync, AI, tutorial, or bridge implementations.

## Completed Foundations

### Prompt 1: Repository Audit, Preservation Plan, And Foundation

- Audited existing architecture, state ownership, Commander and multiplayer limits, landscape battlefield, event/history systems, confidence/recovery handling, and Hub readiness.
- Preserved the current BoardState background, theme, gameplay, saves, sync, Dry Run, tutorials, and rules engine.
- Added low-risk shared contracts and compatibility utilities that later prompts can reuse.

### Prompt 2: Canonical Commander Session And Ten-Player Readiness

- `src/shared-contracts/commanderSession.js` adds canonical Commander session topology over `createSharedGameSession()` rather than creating a second game state.
- Stable IDs cover participants, seats, clients, connections, invitations, replays, backups, rule amendments, and sync revisions in `src/shared-contracts/ids.js`.
- `src/state/schema.js`, `src/shared-contracts/adapters.js`, `src/storage/saveState.js`, and `src/multiplayer/syncManager.js` preserve participants, players, seats, seat order, independent turn order, visibility policy, reconnect metadata, lifecycle, revisions, capabilities, and Commander metadata.
- One-player training/simulation remains a nonstandard safe state; canonical Commander/Brawl architecture validates two through ten active players.

### Prompt 2.5: Project Constitution, Architecture Charter, And Engineering Standards

- `docs/ecosystem/BOARDSTATE_CONSTITUTION.md` is the permanent project Constitution, ecosystem architecture, architecture charter, authoritative pipeline, engineering standard, UI philosophy, modernization strategy, continuity guide, and roadmap entry point.
- Future prompts must review the Constitution, prior audit, session architecture, and roadmap before changing code.

### Prompt 3: Authoritative Core Architecture And Event Knowledge Engine

- `src/authoritative-core/` now establishes the permanent State Engine, Event Knowledge Engine, and authoritative pipeline seams while preserving the existing rules engine and reducer/store integration.
- `src/game/eventBus.js` and `src/state/gameReducer.js` promote existing game events and action history into Event Knowledge records with provenance, event groups, confidence, tags, undo references, sync metadata, and reconstructable snapshots.
- `src/storage/saveState.js` and `src/multiplayer/syncManager.js` preserve or summarize State Engine and Event Knowledge metadata without exposing hidden information.
- `docs/ecosystem/AUTHORITATIVE_CORE_ARCHITECTURE.md` records the Prompt 3 architecture.

### Prompt 4: Persistence, Replay And Save Architecture

- `src/persistence/canonicalPersistence.js` establishes canonical save, checkpoint, replay timeline, auto-save, recovery, import/export, validation, corruption detection, and legacy migration foundations over Event Knowledge and State Engine snapshots.
- `src/storage/saveState.js` embeds canonical saves and replay exports while preserving existing local save compatibility.
- `src/state/schema.js`, `src/state/gameReducer.js`, and `src/multiplayer/syncManager.js` preserve persistence metadata, append checkpoints, and publish privacy-safe persistence summaries.
- `docs/ecosystem/PERSISTENCE_REPLAY_ARCHITECTURE.md` records the Prompt 4 architecture.

### Prompt 5: Commander Battlefield Modernization

- `src/ui/landscapeBattlefield.js` adds a non-authoritative landscape battlefield model over existing perspective, runtime session, and permanent data.
- `src/ui/render.js` now renders a landscape-first gameplay surface with global info rail, one focused opponent battlefield, central command center, bottom local battlefield, right context actions, expanded permanent lanes, Commander HUD summaries, selected-card inspection, stack/priority, triggers, phase, and combat controls.
- `src/styles.css` preserves the existing BoardState background and visual language while adding the landscape Commander battlefield layout.
- `docs/ecosystem/LANDSCAPE_BATTLEFIELD_ARCHITECTURE.md` records the Prompt 5 architecture.

### Prompt 5.5: Battlefield Completion And AAA UX Gate

- `src/ui/render.js` removes production battlefield scaffolding by hiding unfinished future actions, suppressing duplicate state/status strips, compacting the command center, and keeping card inspection, stack, triggers, phase, combat, and battlefield actions contextual.
- `src/styles.css` makes the battlefield the dominant surface across desktop, tablet, foldable, and landscape-phone viewports while retaining BoardState's existing background, cosmic glass panels, and gold accents.
- At that point, `src/ui/landscapeBattlefield.js` exposed only production-available context actions; Prompt 9 now implements the Question System, while Remind Me, visual replay, AI, and other unavailable surfaces remain hidden until implemented.
- Focused UI validation verifies no visible Future, Coming Soon, Unavailable, Placeholder, Scaffold, Prototype, Developer, or Mock text appears in the active battlefield.

### Prompt 6: Battlefield Camera And Opponent Carousel

- `src/ui/landscapeBattlefield.js` adds the intelligent battlefield presentation model: opponent carousel, contextual HUD states, token intelligence, adaptive density, and deterministic camera focus priorities.
- `src/ui/render.js` replaces static opponent visibility controls with a compact carousel that renders one focused public opponent battlefield, supports loop navigation, quick jump seats, keyboard/controller-compatible arrows, mouse wheel, and swipe navigation.
- `src/styles.css` keeps the Prompt 5.5 battlefield dominant while adding compact carousel presentation and contextual stack/combat collapse behavior.
- The camera foundation records focus targets for selected permanents, stack, priority, combat, Commander status, crowded boards, and active player following without implementing the later animation overhaul.

### Prompt 7: AAA Gameplay Flow And Commander Interaction

- `src/ui/landscapeBattlefield.js` adds the contextual gameplay-flow presentation model over the existing session, perspective, command center, reducer actions, and rules-engine paths.
- `src/ui/render.js` replaces the fixed selected-permanent action panel with a compact gameplay context dock. Permanent tile buttons now appear only when a local permanent is selected.
- Selected lands, creatures, commanders, planeswalkers, mechanics, triggers, priority windows, and pending choices expose only currently wired actions. Opponent permanents remain public-inspection only.
- Trigger groups, priority controls, Commander workflow shortcuts, and selected-card context keep gameplay on the battlefield without adding a second action engine.

### Prompt 8: AAA Animation, Motion Design, Camera System And Premium Presentation

- `src/ui/landscapeBattlefield.js` adds a presentation-only battlefield motion model and deterministic camera transition plan over the existing intelligent battlefield.
- `src/ui/render.js` exposes motion and camera metadata to the gameplay surface without creating a second game state, second camera authority, or persisted animation state.
- `src/styles.css` adds BoardState-native motion for camera focus, selected cards, Commander emphasis, combat, targeting, stack activity, contextual HUD surfaces, notifications, and carousel controls.
- Reduced-motion and performance preferences remove nonessential animation while preserving gameplay information and visual feedback.

### Prompt 9: Intelligent Rules Assistant And Question System

- `src/authoritative-core/rulesAssistant.js` adds the explainable Rules Assistant and Question System over the existing Rules Engine, State Engine, Event Knowledge Engine, and current session.
- The battlefield now exposes a compact Ask Why control and contextual Rules Assistant panel for What, Who, When, Where, Why, How, and What If questions.
- Answers include confidence, evidence, rule references, Oracle text already present in session data, event chains, layer/counter explanations, stack explanations, trigger explanations, and safe follow-up prompts.
- What If is prepared as a non-mutating Dry Run fork boundary. No generative AI, external internet search, executable imported text, fake Hub service, or hidden-information leak is introduced.

### Prompt 10: Remind Me, Proactive Assistant, Confidence, And Rule Amendments

- `src/authoritative-core/proactiveAssistant.js` adds the Remind Me engine, smart notification priority model, confidence engine, missed-trigger recovery summaries, legal opportunity detection, player-memory projection, and unanimous Rule Amendment system.
- The battlefield now exposes a compact Remind Me launcher and contextual panel for reminders, confidence, trigger recovery, non-strategic opportunity notices, player preferences, and table ruling votes.
- Rule Amendment proposals preserve plain text, reject executable/script-like content, require unanimous player approval, never allow majority approval, and do not directly mutate authoritative gameplay state.
- Reminders and table ruling records are saved with the session and canonical persistence metadata without deleting legacy data or creating a second notification authority.

### Prompt 11: AI Gameplay Engine, Dry Runs, Simulations, And Analysis

- `src/authoritative-core/aiGameplayEngine.js` adds the explainable local AI Gameplay Engine over BoardState's existing Rules Engine, State Engine, Event Knowledge Engine, Dry Run, and simulation systems.
- Dry Run keeps using the existing Alpha, Beta, and Omega simulation decks and reducer/rules-engine action paths. AI analysis never mutates game state directly or waives rules.
- The battlefield now exposes a contextual AI Analysis panel for active profiles, latest decision reasoning, threat analysis, board analysis, replay turning points, play patterns, and local AI preferences.
- AI gameplay metadata persists through profile defaults, local saves, and canonical save metadata without introducing cloud AI, external LLMs, deck-building AI, tournament matchmaking, or Hub synchronization.

### Prompt 12: BoardState Ecosystem Integration, Hub Connectivity, And Cross-App Experience

- `src/ecosystem/ecosystemIntegration.js` adds the BoardState-side ecosystem projection layer for Hub coordination, shared profile/preferences/notifications, presence, session discovery, offline sync queueing, launch contexts, return contexts, and privacy-safe ecosystem bundles.
- `src/bridge/appLinkAdapters.js` exposes honest Hub capability and payload handling while preserving existing BoardState Lite handoff and Deck Nexus immutable snapshot bridges.
- `src/state/schema.js`, `src/state/gameReducer.js`, `src/storage/saveState.js`, and `src/persistence/canonicalPersistence.js` preserve ecosystem metadata and offline queue state without exposing hidden zones, credentials, or gameplay authority to Hub.
- The Linked Apps UI now shows Hub as `Hub Not Connected`, keeps BoardState as gameplay authority, supports local privacy-safe bundle export, and keeps live Lite/Nexus links disabled until counterpart apps implement verified live flows.
- `docs/ecosystem/ECOSYSTEM_INTEGRATION_ARCHITECTURE.md` records the Prompt 12 boundary.

### Prompt 12.1: Landscape Foundation, Native Game Constitution, And Digital Tabletop Architecture

- `docs/ecosystem/NATIVE_GAME_VISUAL_ARCHITECTURE.md` establishes the permanent visual laws: Commander-first, landscape-only, battlefield-first, native digital game presentation, responsive without redesign, spectator test, five-second test, and local game store test.
- `src/main.js`, `src/state/schema.js`, `src/storage/localDatabase.js`, `src/state/gameReducer.js`, `src/ui/render.js`, and `src/ecosystem/ecosystemIntegration.js` now keep BoardState gameplay composition canonical landscape and prevent runtime or shared-preference patches from restoring portrait/mobile gameplay composition.
- Mobile page-swipe controls, edge-swipe zones, orientation-change layout switching, and composition mode UI toggles are retired from BoardState runtime.
- Portrait physical-table companion gameplay is assigned to BoardState Lite. BoardState preserves its existing cosmic background, gold accents, glass HUD, and Commander battlefield identity.

### Prompt 12.2A: Battlefield Reconstruction And Commander Table Redesign

- `src/ui/render.js` adds `TABLETOP_RECONSTRUCTION_VERSION` as `boardstate-tabletop-reconstruction-0.1.0` and applies it to the body and active battlefield surface.
- The active battlefield is reconstructed as a digital Commander table instead of a dashboard: idle card preview, idle stack, large hidden-opponent placeholder, generic empty-state panel, and always-visible combat strip are removed from idle gameplay.
- `src/styles.css` makes the battlefield full-screen, quiets application chrome, removes software-style borders and panels around table regions, converts table/player information into compact overlays, and preserves the existing BoardState background and bottom decision-entry foundation.
- `docs/ecosystem/NATIVE_GAME_VISUAL_ARCHITECTURE.md` and `docs/ecosystem/LANDSCAPE_BATTLEFIELD_ARCHITECTURE.md` now define Prompt 12.2A as the battlefield reconstruction standard.

### Prompt 12.3: Command HUD, Digital Hand Replacement, And Player Control Experience

- Superseded by Prompt 12.3C where the two conflict.
- This exploration replaced the old battlefield bottom toolbar with `renderCommandHud()`, a BoardState-native Command HUD identified by `boardstate-command-hud-0.1.0`.
- The exploration consolidated Tools, Utility, Search, Combat, Next Phase, Resolve, selected-card Context, Commander, Ask Why, Remind, and Undo into card-inspired Command Cards at the bottom battlefield edge.
- The old utility menu and floating Rules Assistant, Remind Me, and AI Analysis launchers were retired from battlefield runtime. Their implemented panels remained available through the exploration HUD and existing contextual overlays.
- `src/styles.css` added a premium bottom fan/arc presentation with BoardState cosmic glass, gold accents, physical lift feedback, keyboard focus states, compact landscape behavior, and reduced-motion protection.
- Prompt 12.3C replaces this exploration as the active permanent bottom interaction standard.

### Prompt 12.3C: Commander Action Hand

- `docs/ecosystem/COMMANDER_ACTION_HAND_DESIGN.md` records the AAA design process, five-plus explored concepts, rejected alternatives, whiteboard rules, visual mockup gate, interactive prototype gate, critique, and selected production model.
- `src/ui/render.js` replaces the Prompt 12.3 HUD renderer with `COMMANDER_ACTION_HAND_VERSION`, `renderCommanderActionHand()`, `createCommanderActionCards()`, and `renderCommanderActionCard()`.
- The bottom gameplay surface now renders dynamic Action Cards for available Commander decisions. Irrelevant combat, resolve, selected-card inspection, and undo actions are not kept as permanent disabled toolbar items.
- `src/styles.css` replaces the old HUD stylesheet block with an overlapped, priority-centered, physically handled action-card fan with hover/focus lift, neighbor displacement, state-specific treatment, idle breathing, and reduced-motion safety.
- Existing reducer and overlay actions remain reused through their current `data-*` attributes. No second rules engine, state owner, save format, action bus, Hub dependency, or hidden-information path was introduced.

### Prompt 12.3E: HUD Composition And Visual Hierarchy Corrective Pass

- `docs/ecosystem/HUD_COMPOSITION_VISUAL_HIERARCHY.md` records the corrective composition audit, reference principles, accepted refinements, rejected changes, and regression rules.
- `src/ui/render.js` exposes `HUD_COMPOSITION_VERSION` as `boardstate-hud-composition-0.1.0` through the body and active battlefield surface.
- `src/styles.css` refines the completed tabletop and Action Hand presentation so idle application chrome, phase status, empty-board text, decorative guide geometry, and idle Action Cards recede behind battlefield attention.
- The existing Commander Action Hand interaction remains intact: Action Cards still overlap, fan, lift on hover/focus, displace neighbors, preserve button semantics, and use existing action-entry attributes.
- No gameplay feature, action system, rules authority, state owner, save format, Hub/Lite/Nexus dependency, or hidden-information path was introduced.

### Prompt 12.3F: Rotating Command Deck System

- `docs/ecosystem/ROTATING_COMMAND_DECK_ARCHITECTURE.md` records the circular deck interaction model, reference principles, runtime boundary, core/contextual card split, input contract, favorites, and regression rules.
- `src/ui/render.js` exposes `COMMAND_DECK_VERSION` as `boardstate-rotating-command-deck-0.1.0` through the body and Action Hand root.
- `createCommanderActionCards()`, `resolveCommandDeckPriorityCard()`, `resolveCommandDeckCenterIndex()`, `getVisibleCommandDeckCards()`, and `normalizeCommandDeckIndex()` convert the bottom hand into a circular deck projection with a small visible fan.
- `bindCommandDeck()` supports wheel, pointer-drag, keyboard, and controller-ready rotation while preserving existing Action Card click semantics and action attributes.
- `src/state/schema.js` adds `settings.commandDeck.favoriteIds` as preference metadata only.
- No gameplay feature, action system, rules authority, state owner, save format, Hub/Lite/Nexus dependency, hidden-information path, or digital hand of Magic cards was introduced.

### Prompt 12.4: Motion Language, Interaction Physics, And Animation Architecture

- `docs/ecosystem/MOTION_LANGUAGE_ARCHITECTURE.md` records the permanent motion language, reference principles, Motion Token system, animation state catalog, motion ownership boundaries, accessibility policy, motion budget, and development-only debug overlay contract.
- `src/ui/motionTokens.js` owns `BOARDSTATE_MOTION_LANGUAGE_VERSION`, reusable timing/easing/physics/opacity tokens, motion owners, state catalogs, CSS variable generation, and debug snapshot helpers.
- `src/ui/landscapeBattlefield.js` now exposes `boardstate-battlefield-motion-0.2.0` over the existing presentation-only motion model and consumes the centralized token set rather than maintaining local timing constants.
- `src/ui/render.js` exposes motion-language metadata through body and battlefield `data-motion-*` attributes and keeps the Motion Debug Overlay gated behind `import.meta.env.DEV` plus the explicit `boardstate-motion-debug=true` local setting.
- `src/styles.css` defines root motion-token variables and maps battlefield, permanent, notification, Commander Action Hand, and Rotating Command Deck motion to those tokens with reduced-motion fallbacks.
- No gameplay feature, animation authority, rules authority, state owner, save format, sync protocol, hidden-information path, fake Hub/Lite/Nexus dependency, protected Arena asset, or production-visible developer overlay was introduced.

### Prompt 12.5: Visual Language, Material System, And Atmospheric Polish

- `docs/ecosystem/VISUAL_LANGUAGE_MATERIAL_SYSTEM.md` records the permanent visual language, reference principles, explored material directions, selected BoardState-native material system, accessibility checks, and development-only visual debug overlay contract.
- `src/ui/visualTokens.js` owns `BOARDSTATE_VISUAL_LANGUAGE_VERSION`, semantic visual materials, visual layers, reusable color/border/radius/elevation/shadow/glow/blur/opacity/outline tokens, CSS variable generation, and debug snapshot helpers.
- `src/ui/render.js` exposes visual-language metadata through body and gameplay `data-visual-*` attributes for battlefield atmosphere, table regions, command center, Rotating Command Deck, Action Cards, and utility overlays.
- `src/styles.css` defines root visual-token variables and maps existing cosmic atmosphere, glass, stone, metal, card-stock, gold, crystal, parchment, elevation, shadow, glow, blur, and focus treatment to those tokens.
- No gameplay feature, rules authority, state owner, save format, sync protocol, hidden-information path, fake Hub/Lite/Nexus dependency, protected Arena asset, or production-visible developer overlay was introduced.

### Prompt 12.6: Audio Language, Haptics, And Sensory Feedback

- `docs/ecosystem/SENSORY_LANGUAGE_ARCHITECTURE.md` records the permanent audio language, haptic language, reference principles, selected restrained tactile direction, accessibility checks, and development-only audio debug overlay contract.
- `src/ui/sensoryTokens.js` owns `BOARDSTATE_SENSORY_LANGUAGE_VERSION`, Audio Token IDs, Haptic Token IDs, sensory channels, priority levels, preference defaults, notification/action mapping, and debug snapshot helpers.
- `src/ui/render.js` exposes sensory-language metadata through body and gameplay `data-sensory-*`, `data-audio-token`, and `data-haptic-token` attributes for the battlefield, Rotating Command Deck, and Action Cards.
- Existing notification sound, notification haptics, and gameplay haptic hooks now route through generated browser-safe Web Audio and haptic tokens rather than hard-coded per-call feedback.
- `src/state/schema.js`, `src/storage/localDatabase.js`, and `src/ecosystem/ecosystemIntegration.js` preserve sensory preferences and shared preference summaries without introducing sound assets, music, a second notification authority, gameplay state mutation, hidden-information leakage, or fake Hub/Lite/Nexus connectivity.

### Prompt 13.1: First-Time User Experience And Adaptive Learning

- `docs/ecosystem/ADAPTIVE_LEARNING_ONBOARDING.md` records the permanent onboarding philosophy, progressive disclosure rules, Onboarding Tokens, Adaptive Learning Engine, Help and Learning Center, and development-only Learning Debug Overlay contract.
- `src/onboarding/tutorialSystem.js` extends the existing onboarding/tutorial owner with versioned learning tokens, profile-scoped adaptive learning memory, contextual guidance selection, help catalog generation, and debug snapshots.
- `src/ui/render.js` keeps first-run education on the battlefield through the existing Helper Sprite, adds a Help and Learning options area, records low-friction learning interactions from the Rotating Command Deck, search, accessibility, and utility surfaces, and exposes production-safe onboarding version metadata.
- `src/state/schema.js`, `src/state/gameReducer.js`, `src/storage/localDatabase.js`, and `src/ecosystem/ecosystemIntegration.js` preserve learning settings and profile memory without creating a second tutorial engine, gameplay authority, save format, or Hub dependency.

### Prompt 13.2: Contextual Assistance And Player Support

- `docs/ecosystem/CONTEXTUAL_ASSISTANCE_SYSTEM.md` records the permanent contextual assistance philosophy, Assistance Priority Levels, Assistance Tokens, natural-pause timing rules, profile-scoped assistance memory, safe shared preference summaries, and development-only Assistance Debug Overlay contract.
- `src/onboarding/tutorialSystem.js` extends the existing onboarding/tutorial owner with contextual assistance token creation, profile memory normalization, candidate selection, accepted/dismissed workflow signals, reset handling, assistance center models, and debug snapshots.
- `src/ui/render.js` routes assistance through the existing Helper Sprite and Help and Learning panel, opens only existing panels when a suggestion is accepted, records low-cost behavior signals, and exposes production-safe contextual assistance version metadata.
- `src/state/schema.js`, `src/state/gameReducer.js`, `src/storage/localDatabase.js`, and `src/ecosystem/ecosystemIntegration.js` preserve assistance settings and memory without creating a second assistant, rules advisor, AI gameplay path, save format, or Hub dependency.

## Modernization Completion Status

### Prompt 13: Full Control And Live Tracking Convergence

Status: Completed through the canonical 13.2.6 Part 3 mode-policy baseline.

- Live Tracking and Full Control are interaction policies over the same authoritative reducer, rules engine, State Engine, Event Knowledge, persistence, stack, trigger, battlefield, and explanation systems.
- Live Tracking accepts physical-table-reported actions, preserves honest hidden/unknown information, applies deterministic consequences automatically, and retains Single Resolve.
- Strict Full Control and Dry Run route direct casting, mana, land timing, targets, combat, priority, stack, and zone actions through the existing rules-engine boundary.
- Mode parity and no-fork guardrails live in `test/canonical-gameplay-part3.test.js`, `test/land-play-system.test.js`, `test/rules-engine-boundary.test.js`, and the Part 5/6 suites.

### Prompt 14: Timeline And Relationship Experience

Status: Completed in baseline `boardstate-timeline-relationship-1.0.0`.

- The Event Knowledge timeline presents readable change summaries, turn/phase grouping, category filters, bounded pagination, and public battlefield relationship explanations.
- Replay inspection is a frozen presentation-only observation. It cannot replace the live session, execute rules, replay animation, or mutate authoritative state.
- The legacy authoritative `REPLAY_TO_ACTION` path is quarantined as a reducer no-op; returning to live always uses the current synchronized session.
- Relationship projection covers control, attachment, targeting, combat, stack, and causation while excluding private-zone objects.
- Architecture and regression protection are recorded in `TIMELINE_RELATIONSHIP_ARCHITECTURE.md` and `test/timeline-relationship.test.js`.

### Prompt 15: Rules Recovery And Rule Amendments Expansion

Status: Completed in baseline `boardstate-rules-recovery-1.0.0`.

- Rules Recovery imports reviewed official rules, Oracle, Gatherer/Scryfall rulings, release notes, judge references, and table interpretations as bounded inert plain text.
- Unsupported or conditional effects remain explicit pending effects; recovery cases identify their source, missing information, mandatory status, confidence, and constrained continuation operation.
- Imported text never executes. A player records the missing information and explicitly confirms continuation through the existing pending-effect action without replaying the original event.
- Rule amendments retain the Prompt 10 unanimous approval contract and remain clearly non-canonical.
- Reference imports, recovery cases, revisions, amendment actions, and continuation actions remain auditable through recovery history, action history, and Event Knowledge.
- Architecture and regression protection are recorded in `RULES_RECOVERY_ARCHITECTURE.md` and `test/rules-recovery.test.js`.

### Prompt 16: Live Hub, Lite And Deck Nexus Counterpart Verification

Status: Externally blocked; BoardState-side contracts and honest offline adapters are complete.

- Connect the Prompt 12 BoardState-side ecosystem contracts only after Hub, BoardState Lite, and Deck Nexus counterpart apps provide verified production endpoints or handoff workflows.
- Keep BoardState authoritative for rules, sessions, priority, stack, triggers, replacement effects, continuous effects, layers, legality, combat, state-based actions, Full Control, Live Tracking authority, Dry Runs, simulations, tutorials, replay truth, and game-history causation.
- Finalize authenticated cloud sync, profile sync, notification delivery, app launch/return routing, shared backup discovery, spectator discovery, and cross-device continuation.
- Do not claim live Hub, BoardState Lite, or Deck Nexus integration until those applications implement and verify their counterpart workflows.

### Prompt 17: Performance And Accessibility

Status: Completed and retained as a continuous release gate.

- Reproducible stress coverage validates 360-object battlefield geometry, repeated Command Hand projection, 5,000-event paged timelines, and ten-player Commander metadata while rendering only the focused opponent battlefield.
- Presentation performance boundaries prohibit Command Hand, zone-scroll, opponent-focus, timeline, and animation state from recomputing authoritative rules or mounting unbounded history rows.
- Phone, tablet, desktop, and ultrawide models retain fixed landscape composition, safe-area semantics, zone-local overflow, and no global gameplay scroll.
- Keyboard navigation, screen-reader labels, 44-pixel touch targets, non-color state cues, reduced motion, larger text, and no hover-only essential actions remain part of the canonical accessibility contract.
- Focused protection lives in `test/performance-accessibility-baseline.test.js` alongside the Part 4 through Part 6 gameplay regression suites.

### Final Production Audit

- Audit source tree, contracts, rules engine, state engine, Event Knowledge Engine, battlefield, camera, Full Control, Live Tracking, Question System, Remind Me, Rules Recovery, AI, Hub/Lite/Nexus boundaries, performance, accessibility, saves, sync, deployment, package artifacts, privacy, and false integration claims.
- Fix regressions before release.
- Verify tests, build, package, deployment, and live production behavior through the repository's actual tooling.
