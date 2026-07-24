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
- `src/styles.css` makes the battlefield full-screen, quiets application chrome, removes software-style borders and panels around table regions, converts table/player information into compact overlays, and preserves the existing BoardState background and Command HUD.
- `docs/ecosystem/NATIVE_GAME_VISUAL_ARCHITECTURE.md` and `docs/ecosystem/LANDSCAPE_BATTLEFIELD_ARCHITECTURE.md` now define Prompt 12.2A as the battlefield reconstruction standard.

### Prompt 12.3: Command HUD, Digital Hand Replacement, And Player Control Experience

- `src/ui/render.js` replaces the old battlefield bottom toolbar with `renderCommandHud()`, a BoardState-native Command HUD identified by `boardstate-command-hud-0.1.0`.
- The HUD consolidates Tools, Utility, Search, Combat, Next Phase, Resolve, selected-card Context, Commander, Ask Why, Remind, and Undo into card-inspired Command Cards at the bottom battlefield edge.
- The old utility menu and floating Rules Assistant, Remind Me, and AI Analysis launchers are retired from battlefield runtime. Their implemented panels remain available through the Command HUD and existing contextual overlays.
- `src/styles.css` adds a premium bottom fan/arc presentation with BoardState cosmic glass, gold accents, physical lift feedback, keyboard focus states, compact landscape behavior, and reduced-motion protection.
- `docs/ecosystem/NATIVE_GAME_VISUAL_ARCHITECTURE.md` and `docs/ecosystem/LANDSCAPE_BATTLEFIELD_ARCHITECTURE.md` now define the Command HUD as the permanent bottom interaction standard.

## Remaining Roadmap

### Prompt 13: Full Control And Live Tracking Convergence

- Implement Full Control and Live Tracking as two input models over the same authoritative rules engine, canonical game state, event stream, save system, sync foundation, and replay/explanation foundation.
- Live Tracking accepts physical-table-reported actions with honest unknowns and confidence indicators.
- Full Control accepts direct digital card and zone manipulation through rules-engine legal action paths.
- Do not create separate engines or duplicate state authorities.

### Prompt 14: Timeline And Relationship Experience

- Extend the Remind Me foundation with game history, change summaries, relationship visualization, turn timeline, and replay inspection.
- Add live battlefield replay, relationship explanations, and phase/turn timeline inspection.
- Reuse existing event history, replay state, effect logs, tutorial explanations, and saves.
- Ensure replay always returns safely to the current synchronized state.

### Prompt 15: Rules Recovery And Rule Amendments Expansion

- Add Rules Recovery for official rules text, Gatherer rulings, release notes, Oracle text, Scryfall Oracle/rulings, trusted judge references, and table interpretations.
- Preserve imported source text as non-executable plain text and map it only through constrained approved rule operations.
- Extend the Prompt 10 confidence and unanimous-amendment foundations into the full Rules Recovery interface.
- Record every recovery proposal, vote, rejection, revision, accepted amendment, and recovery action in immutable event history.

### Prompt 16: Live Hub, Lite And Deck Nexus Counterpart Verification

- Connect the Prompt 12 BoardState-side ecosystem contracts only after Hub, BoardState Lite, and Deck Nexus counterpart apps provide verified production endpoints or handoff workflows.
- Keep BoardState authoritative for rules, sessions, priority, stack, triggers, replacement effects, continuous effects, layers, legality, combat, state-based actions, Full Control, Live Tracking authority, Dry Runs, simulations, tutorials, replay truth, and game-history causation.
- Finalize authenticated cloud sync, profile sync, notification delivery, app launch/return routing, shared backup discovery, spectator discovery, and cross-device continuation.
- Do not claim live Hub, BoardState Lite, or Deck Nexus integration until those applications implement and verify their counterpart workflows.

### Prompt 17: Performance And Accessibility

- Audit large Commander board states, ten-player session metadata, opponent carousel projection, event history growth, replay memory, reduced-motion behavior, keyboard/screen-reader access, and mobile landscape constraints.
- Preserve deterministic rules performance and avoid rendering all opponent battlefields simultaneously.
- Keep accessibility settings safe and compatible with existing Helper Sprite and tutorial flows.

### Final Production Audit

- Audit source tree, contracts, rules engine, state engine, Event Knowledge Engine, battlefield, camera, Full Control, Live Tracking, Question System, Remind Me, Rules Recovery, AI, Hub/Lite/Nexus boundaries, performance, accessibility, saves, sync, deployment, package artifacts, privacy, and false integration claims.
- Fix regressions before release.
- Verify tests, build, package, deployment, and live production behavior through the repository's actual tooling.
