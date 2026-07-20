# Commander Modernization Audit

Date: 2026-07-19
Baseline commit: d81d5c3
Package version before this prompt: 1.24.0

This audit covers the existing BoardState application before the Commander/Brawl modernization prompts begin. The modernization rule is reuse first: keep working gameplay, rules processing, saves, sync, tutorials, simulations, and the established BoardState visual identity unless evidence shows a specific incompatibility.

## Repository Structure Evidence

| Area | Evidence | Modernization finding |
| --- | --- | --- |
| Framework and runtime | `index.html`, `vite.config.mjs`, `package.json`, `src/main.js` | Vite web app with vanilla ES modules. The app is not greenfield and should be modernized in place. |
| Entry point | `src/main.js` | Creates the store, mounts UI, applies the existing loading/background experience, and dispatches boot-time actions. Reusable. |
| Routing and layouts | `src/ui/render.js`, `src/ui/events.js`, `src/state/gameReducer.js` | Route state is profile/page driven, with old deep links handled through reducer events. Refactor carefully rather than replacing. |
| Landscape foundation | `src/styles.css`, `src/ui/render.js` | Existing arena and HUD classes support landscape battlefield presentation. Preserve background and theme assets. |
| Theme and assets | `index.html`, `assets/boardstate-loading-dragon.jpg`, `src/styles.css` | Dark cosmic fantasy HUD, gold labels, translucent panels, cyan/blue/purple accents. No visual identity rewrite needed in this prompt. |
| State management | `src/state/store.js`, `src/state/schema.js`, `src/state/gameReducer.js`, `src/state/actions.js` | Central reducer/store already own application state. Continue using this authority instead of creating another store. |
| Rules engine | `src/rules-engine/engine.js`, `src/rules-engine/boardStateAdapter.js`, `src/rules-engine/index.js` | UI-independent rules boundary exists. It should remain the authoritative engine. |
| Game structures | `src/state/schema.js`, `src/shared-contracts/contracts.js` | Runtime and canonical shared-session structures both exist. Future work should tighten adapters, not create a second game state. |
| Player structures | `src/state/schema.js`, `src/shared-contracts/contracts.js`, `src/shared-session/perspective.js` | Canonical players support stable IDs and interface metadata; runtime still has some local/opponent assumptions. |
| Card and zone structures | `src/state/schema.js`, `src/shared-contracts/contracts.js`, `src/shared-contracts/adapters.js` | Cards, zones, battlefield groups, stack objects, and deck snapshots exist. Full Control can build on these. |
| Commander structures | `src/game/commanderSystem.js`, `src/state/schema.js`, `src/shared-contracts/contracts.js` | Commander tax/damage/zone fields exist. Partner/background/multiple commander handling is represented more strongly in deck snapshots than runtime UI. |
| Events and actions | `src/state/actions.js`, `src/game/eventBus.js`, `src/state/gameReducer.js`, `src/shared-contracts/contracts.js` | Event/action foundations exist and are reusable for Event Knowledge Engine work. |
| Reducers and command handlers | `src/state/gameReducer.js`, `src/rules-engine/boardStateAdapter.js`, `src/effects/effectEngine.js` | Current reducer centralizes gameplay and persistence transitions. Later modernization should extract seams without bypassing reducer authority. |
| Middleware and observers | `src/state/store.js`, `src/game/eventBus.js`, `src/multiplayer/syncManager.js` | Store subscribers, event queue/history, and sync manager are existing extension points. |
| Rules traces and logs | `src/support/debugExport.js`, `src/effects/effectEngine.js`, `src/game/eventBus.js` | Rules confidence logs, effect logs, event history, action history, and debug exports can seed Event Knowledge and Question System data. |
| Replay and undo | `src/state/schema.js`, `src/state/gameReducer.js` | `history`, `undoStack`, `redoStack`, action history, event history, and replay fields exist. Needs consolidation before rich replay. |
| Saves and persistence | `src/storage/saveState.js`, `src/storage/localStore.js`, `src/shared-contracts/adapters.js` | Local saves, save envelopes, import/export, and adapters exist. Must preserve legacy load behavior. |
| Multiplayer sync | `src/multiplayer/syncManager.js`, `src/state/store.js`, `src/shared-session/perspective.js` | Gameplay sync namespace, revisions, public peer state, participant metadata, interface mode, and advanced sync event dedupe exist. |
| Session authority | `src/state/store.js`, `src/state/gameReducer.js`, `src/rules-engine/engine.js` | Local reducer plus rules engine own authoritative transitions; sync merges compatible public peer state. Hub must not become rules authority. |
| AI and simulation | `src/simulation/`, `src/state/gameReducer.js` | Dry Run and AI behavior exist and should be routed through existing legality paths rather than rewritten. |
| Tutorial | `src/tutorial/`, `src/state/gameReducer.js`, `src/ui/render.js` | Tutorial state, helper flow, and autosave exist. Preserve and extend. |
| Card data and Scryfall | `src/data/`, `src/lib/scryfall.js`, `src/game/cardDatabase.js` | Card lookup/cache and Scryfall integration exist. Deck Nexus imports should normalize into these references. |
| Legality systems | `src/rules-engine/engine.js`, `src/game/targeting.js`, `src/game/manaSystem.js`, `src/game/combatSystem.js` | Legality is distributed behind the engine adapter. Prompt 2/3 should continue centralization. |
| Tests | `test/*.test.js`, `package.json` | Existing Node test runner is sufficient. Do not introduce a second framework. |
| Deployment | `.github/workflows/deploy.yml`, `vite.config.mjs` | GitHub Pages deployment runs tests and production build from `main`. |
| Package/release | `.github/workflows/release-package.yml`, `android-app/`, `flutter-app/`, `scripts/` | Web, Android wrapper, Flutter wrapper, and release artifacts already have scripts. Do not use Xcode. |
| Ecosystem adapters | `src/bridge/appLinkAdapters.js`, `src/shared-session/handoff.js`, `src/migration/legacyMigration.js` | BoardState-side Lite/Nexus/Hub readiness exists with honest non-live integration statuses. |
| Duplicate/obsolete systems | Legacy deck/profile/friend/tournament/navigation paths remain reachable through Legacy & Migration | Preserve access and data. Consolidate only through compatibility routes and export paths. |

## Reuse Map

| Future subsystem | Current implementation | Reuse status | Required migration path |
| --- | --- | --- | --- |
| Commander battlefield | `src/ui/render.js`, `src/styles.css`, `src/shared-session/perspective.js` | Exists but needs refactoring | Preserve existing background/HUD. Move toward Commander-first static battlefield and opponent carousel without replacing the renderer wholesale. |
| Live Tracking | Life/counter/commander flows in `src/state/gameReducer.js`, sync in `src/multiplayer/syncManager.js` | Partially exists | Treat physical-table reported actions as another input model over canonical sessions. Track confidence and unknowns. |
| Full Control | Rules engine actions, battlefield interactions, stack/combat/mana modules | Partially exists | Route direct digital manipulation through engine actions and canonical events. Avoid separate game engine. |
| Rules engine | `src/rules-engine/engine.js`, `src/rules-engine/boardStateAdapter.js` | Exists and reusable | Harden all gameplay actions to use validation/resolution paths. |
| Stack | `src/effects/effectEngine.js`, `src/rules-engine/engine.js`, `src/shared-contracts/contracts.js` | Exists and reusable | Add richer provenance and event metadata for replay/explanations. |
| Priority | `src/rules-engine/engine.js`, `src/game/fsm.js`, `src/shared-session/perspective.js` | Exists and reusable | Continue prompt ownership routing by player ID and sync revision. |
| Combat | `src/game/combatSystem.js`, `src/rules-engine/engine.js`, `src/shared-session/perspective.js` | Exists and reusable | Extend for Commander pod focus and explicit attacker/defender event causation. |
| Triggers | `src/effects/effectEngine.js`, `src/rules-engine/engine.js` | Exists and reusable | Record trigger provenance and choice owners in structured events. |
| Replacement effects | `src/effects/effectEngine.js` | Partially exists | Add confidence and amendment support for unsupported interactions. |
| Layers | `src/effects/layerSystem.js` | Exists but needs explanation metadata | Preserve calculations; add trace output usable by Why/How questions. |
| State-based actions | `src/rules-engine/engine.js`, `src/effects/effectEngine.js` | Partially exists | Prevent double-application and record cause/result events. |
| Card interactions | `src/game/targeting.js`, `src/game/manaSystem.js`, `src/effects/effectEngine.js` | Exists and reusable | Keep official card data lookup and unknown-card fallbacks. |
| Zones | `src/state/schema.js`, `src/shared-contracts/contracts.js` | Exists and reusable | Add Live Tracking unknown markers without inventing hidden information. |
| Saves | `src/storage/saveState.js`, `src/shared-contracts/adapters.js` | Exists and reusable | Preserve legacy load adapters, embed imported snapshots where needed. |
| Multiplayer | `src/multiplayer/syncManager.js`, `src/shared-session/perspective.js` | Exists but needs normalization | Support two through ten players by seat IDs, not UI indices. |
| Opponent carousel | `src/ui/render.js` opponent board index and opponent navigation actions | Partially exists | Promote into reusable Battlefield Camera System with seating order and active-player follow. |
| Camera system | Perspective/focus fields in `src/shared-session/perspective.js` and `src/state/schema.js` | Partially exists | Add deterministic camera modes and event priorities before visual overhaul. |
| Event knowledge | `src/game/eventBus.js`, `src/state/actions.js`, `src/support/debugExport.js` | Partially exists | Consolidate logs, histories, sync events, and rules traces into one causation model. |
| Replay | `src/state/schema.js`, `src/state/gameReducer.js` | Partially exists | Reuse event history and snapshots; avoid separate replay truth. |
| Remind Me | Game log/debug export/effect log/tutorial summaries | Partially exists | Generate reminders from Event Knowledge Engine events and rules provenance. |
| Question System | Rules explanation stubs, debug exports, targeting/layer/commander metadata | Does not exist as UI | Add question schema and answer adapters on top of rules/event data. |
| Confidence system | `src/support/debugExport.js`, `src/state/schema.js` recovery/confidence logs | Partially exists | Split information confidence from execution confidence. |
| Rules Recovery | Manual Choice Required, Waive Rules, import validation | Partially exists | Add safe pasted-reference preservation and unanimous amendment events. |
| Unanimous rule amendments | Waiver scopes/history exist; unanimous patch flow does not | Missing | Add contract first; UI and sync voting later. Majority approval must remain invalid. |
| Tutorials | `src/tutorial/`, `src/ui/render.js` | Exists and reusable | Reuse tutorial state with Event Knowledge explanations. |
| Dry Run | `src/simulation/`, reducer setup/resume, save metadata | Exists and reusable | Use as What If fork target without modifying live session. |
| AI | `src/simulation/ai*`, rules-engine validation | Exists and reusable | Keep AI behind legal action paths; AI cannot waive rules. |
| Hub adapters | `src/bridge/appLinkAdapters.js`, `src/migration/legacyMigration.js` | Partially exists | Keep Hub as future/unavailable. Add stable contract seams only. |
| Deck Nexus compatibility | `src/bridge/appLinkAdapters.js`, imported deck snapshots | Exists as BoardState-side readiness | Do not claim live link. Use immutable snapshots in gameplay setup. |
| BoardState Lite compatibility | `src/bridge/appLinkAdapters.js`, `src/shared-session/handoff.js` | Exists as BoardState-side readiness | Do not claim live handoff until Lite implements counterpart. |

## Current State Ownership

Authoritative runtime state is currently stored on the active profile in `profile.activeSession`, created by `createGameSession()` in `src/state/schema.js`. Actions are created through `src/state/actions.js`, dispatched through `src/state/store.js`, and reduced in `src/state/gameReducer.js`. Rules actions use `src/rules-engine/boardStateAdapter.js` and `src/rules-engine/engine.js` for validation and resolution.

Transitions are recorded through `history`, `undoStack`, `redoStack`, `actionHistory`, `eventQueue`, `eventHistory`, `effectLog`, `recoveryLog`, and `rulesConfidenceLog`. Prompt 3 promotes those reusable evidence sources into the explicit Event Knowledge Engine foundation in `src/authoritative-core/eventKnowledgeEngine.js`.

Multiplayer synchronization is owned by `src/multiplayer/syncManager.js` and wired in `src/state/store.js`. Gameplay sync uses a gameplay namespace and public peer state. Tournament and friend sync managers are separate and should remain separate. Revisions are present in canonical sessions, save metadata, sync messages, and advanced sync event handling.

Player perspectives are currently derived by `src/shared-session/perspective.js`. The canonical session is not mutated by perspective calculation. Runtime UI still contains older `battlefield.player` and `battlefield.opponent` assumptions, so future Commander modernization must avoid treating UI position as authoritative seat identity.

Hidden information protection exists through canonical visibility/private metadata, unknown zone counts, import/export redaction, save sanitization, and sync public-state sharing. Live Tracking must preserve unknown markers instead of guessing missing hand, library, graveyard, exile, attachment, timing, or controller data.

Dry Run and simulations fork session state through simulation reducers and save metadata. Tutorials operate over active session/tutorial state. The UI primarily dispatches actions; where direct runtime fields are still shaped for rendering, future work should adapt through canonical session/perspective helpers before changing visuals.

## Commander And Multiplayer Limits

The product direction is now Commander/Brawl exclusive. The approved player range is two through ten players, with one-player training/simulation allowed as a nonstandard training state. This prompt adds `src/shared-contracts/commanderModernization.js` to make that boundary explicit without changing current gameplay behavior.

Current structures support stable player IDs and arbitrary canonical players in `src/shared-contracts/contracts.js`, but older runtime and UI paths still assume local/opponent or player/opponent arrays. Two-player mirrored and Commander pod perspectives exist in `src/shared-session/perspective.js`, but the carousel/camera behavior is not yet a complete reusable Battlefield Camera System.

Commander tax, commander damage, commander zone movement, commander eligibility, and assignment have reusable foundations in `src/game/commanderSystem.js` and `src/state/schema.js`. Partner, background, companion, and multiple-commander metadata exists in deck snapshot contracts; runtime commander UI and rules flows need future hardening to avoid one-commander-only assumptions.

Spectators, reconnecting players, connection status, controller type, and interface mode are represented in sync/profile/session metadata. Late joins, controlled turns, extra turns, changing turn order, and team concepts require additional verification and should be added through canonical player/seat/session contracts instead of UI indices.

## Landscape Battlefield Audit

The existing battlefield should be retained as the starting point. Reusable pieces include the arena layout classes in `src/styles.css`, battlefield rendering in `src/ui/render.js`, card tiles, tap/untap actions, opponent board rendering, stack/priority/phase HUD, commander/life indicators, full-card previews, overlay panels, counters, tokens, attachments, and rules prompts.

The current layout already presents local and opponent areas and includes compact opponent/perspective state, but the approved future battlefield needs a stronger static Commander-first arrangement: local battlefield fixed at the bottom, one opponent battlefield at the top, central shared interaction space, and overlays instead of navigation away from active gameplay.

Known migration risk: rendering ten complete battlefields would be too heavy and unusable on phones. The future opponent carousel must retain synchronized state for every opponent while rendering one focused opponent plus compact seats.

## Event And Explanation Capabilities

Reusable evidence exists in `src/state/actions.js` action envelopes, `src/game/eventBus.js` immutable event queue/history, `src/effects/effectEngine.js` effect logs and traces, `src/support/debugExport.js` game log/rules confidence export, save metadata, replay fields, undo/redo fields, sync events, simulation logs, and tutorial explanations.

The existing data can partially answer What, Who, When, and Where questions for visible events. Why and How require stronger causation links across rules validation, effects, layers, replacement effects, state-based actions, and sync revisions. What If should fork through Dry Run or simulation state rather than mutating the live session.

Future Event Knowledge Engine work should promote the current action/event/log structures into a single canonical event knowledge layer. It should not create a disconnected history system.

## Rule Confidence And Patchability

Current confidence and recovery sources include Manual Choice Required, Waive Rules, waiver history, rules confidence logs in `src/support/debugExport.js`, unsupported/manual review returns in `src/rules-engine/engine.js`, malformed import handling in bridge adapters, and save/import compatibility reports.

The modernization requires two separate confidence axes: information confidence and execution confidence. This prompt adds shared constants for both axes. Unknown card data, unsupported mechanics, parse failures, Oracle/ruling drift, imported snapshots, and Live Tracking omissions should be marked honestly and routed to Manual Choice Required or unanimous rule amendment flows.

Imported rule/ruling text must remain plain text and must never become executable code. This prompt adds a conservative `isSafeRuleReferenceImportPayload()` foundation that rejects script-like or command-like content.

Unanimous rule amendments do not currently exist as a full gameplay UI. This prompt adds a small validation foundation requiring every player in the session to approve a proposed rule amendment. Majority approval is explicitly invalid.

## Hub Readiness Matrix

| Hub boundary | Current readiness | Evidence and required work |
| --- | --- | --- |
| Stable app IDs | Already ready | `src/shared-contracts/contracts.js` has `APP_IDS`; BoardState remains rules authority. |
| Semantic contract versions | Already ready | `src/shared-contracts/version.js`; new modernization version added in `commanderModernization.js`. |
| Canonical game/session IDs | Already ready | `createGameId()`, `createSessionId()`, shared sessions, saves, linked sessions. |
| Player and seat IDs | Requires normalization | Canonical IDs exist; some UI/runtime paths still use local/opponent positions. |
| Profile references | Requires adapters | Profiles exist locally; Hub will own global profile later. |
| Deck snapshot references | Already ready for import readiness | Deck Nexus adapter imports immutable snapshots; live link remains not installed. |
| Invitation references | Missing contract | Future Hub prompt should add invitation references without using gameplay sync namespace. |
| Tournament references | Requires adapters | Legacy tournament data exists; Hub-ready export exists but Hub import is not live. |
| Notification references | Requires adapters | Legacy notification preferences exist; Hub owns future global notifications. |
| Deep-link routing | Partially ready | Bridge parser foundation exists; external launch is not claimed live. |
| Launch and return context | Missing contract | Add when Hub/Lite/Nexus counterparts exist. |
| External session discovery | Intentionally deferred | Do not implement speculative networking. |
| Linked-app capabilities | Partially ready | `src/bridge/appLinkAdapters.js`; new modernization capability report reinforces false-live-link prevention. |
| Sync revisions | Already ready | Sync messages and shared sessions include revisions and duplicate/stale handling. |
| Backup/import/export manifests | Partially ready | Migration bundles and save envelopes exist; Hub manifest can reuse these. |
| Permissions and roles | Partially ready | Controller type, spectator role, host/controller metadata exist; Hub permissions need formal contract later. |
| Offline capability reporting | Partially ready | App-link status cards and adapter capabilities can report unavailable/offline states. |
| Adapter boundaries | Already ready for BoardState side | Lite/Nexus/Hub adapters avoid external repo dependencies and do not claim live integrations. |

## Compatibility Protection

Existing saved games, user preferences, deck data, card data, tutorials, simulations, replays, rules tests, routes, deployment configuration, package metadata, and production behavior must remain loadable and reachable. Any future schema change must include version detection, migration attempt, backup preservation, compatibility reporting, and recovery/export paths.

No legacy data should be deleted during modernization. Legacy features should remain reachable through Legacy & Migration, compatibility routes, existing feature panels, or export/recovery tools until destination apps actually accept the data.

## Foundation Added In This Prompt

`src/shared-contracts/commanderModernization.js` adds low-risk shared constants and utilities for:

- Commander/Brawl supported formats and two-to-ten-player bounds.
- Live Tracking and Full Control input-mode terminology over the same canonical state.
- Battlefield Camera System mode names and deterministic priority ordering.
- Question System question types.
- Separate information confidence and execution confidence vocabularies.
- Unanimous-only rule amendment approval validation.
- Conservative plain-text rule reference import safety checks.
- A modernization capability report that keeps Lite, Deck Nexus, and Hub live links false by default.

Focused tests for these foundations live in `test/commander-modernization-foundation.test.js`.

## Prompt 2 Commander Session Foundation

`src/shared-contracts/commanderSession.js` now records the canonical Commander/Brawl topology used by later battlefield, camera, Event Knowledge, Live Tracking, Full Control, Question System, Remind Me, Rules Recovery, and Hub-readiness prompts. It extends `createSharedGameSession()` with participants, seats, independent seat/turn order, role permissions, visibility policy, reconnect metadata, capability manifests, launch/return contexts, immutable deck snapshot references, Commander source ledgers, and local perspective selectors. It does not create a second game state or second rules engine.

State ownership remains unchanged: `profile.activeSession` and the reducer/rules-engine path own runtime transitions. `src/shared-contracts/adapters.js`, `src/storage/saveState.js`, and `src/multiplayer/syncManager.js` now preserve the new Commander session metadata when exporting/importing shared sessions, saving/loading games, and publishing privacy-safe sync summaries.

The participant/player/seat distinction is explicit. Participants are humans, AI/system agents, tutorial agents, local guests, spectators, or external-app clients. Players are in-game rules entities. Seats are stable table positions and carousel anchors. `seatOrder` is separate from `turnOrder`, so extra turns, skipped turns, controlled turns, elimination, and concession do not rewrite table identity.

Commander metadata is keyed by stable commander source identity. Partner commanders, background commanders, multiple Commander objects, Commander tax, cast count, zone, and Commander damage ledgers are represented without a fixed two-player or four-player matrix.

Visibility is enforced through projection helpers before data leaves the canonical session. Hosts and spectators do not receive hidden zones by default. Future Hub summaries remain privacy-safe and explicitly report that the Hub is not gameplay authority.

Focused tests for this foundation live in `test/commander-session-architecture.test.js` with reusable fixtures in `test/fixtures/commanderSessionFixtures.js`. Detailed Prompt 2 handoff documentation lives in `docs/ecosystem/COMMANDER_SESSION_ARCHITECTURE.md`.

## Prompt 2.5 Constitution And Engineering Charter

`docs/ecosystem/BOARDSTATE_CONSTITUTION.md` now serves as the permanent repository Constitution, ecosystem architecture, architecture charter, authoritative pipeline, engineering standard, UI philosophy, modernization strategy, continuity guide, and roadmap entry point. Future modernization prompts must review it alongside this audit, `COMMANDER_SESSION_ARCHITECTURE.md`, and `COMMANDER_MODERNIZATION_ROADMAP.md` before changing source code.

The active roadmap now uses the Prompt 3 through Prompt 15 sequence for Event Knowledge, persistence/replay, battlefield modernization, camera/carousel, Full Control and Live Tracking convergence, Question System, Remind Me, Rules Recovery, AI integration, Hub/Lite/Nexus interoperability, performance/accessibility, visual polish, and final production audit.

## Prompt 3 Authoritative Core Architecture

`src/authoritative-core/` now provides the permanent authoritative pipeline, State Engine metadata/commit helpers, Event Knowledge Engine records, event grouping, provenance, confidence metadata, undo references, deterministic event IDs, and state reconstruction helpers. It reuses the existing `src/rules-engine/` implementation as the sole Rules Engine and does not create a second rules engine or state store.

`src/game/eventBus.js` and `src/state/gameReducer.js` now feed existing game events and reducer action history into Event Knowledge. `src/storage/saveState.js` preserves State Engine and Event Knowledge data in saves, and `src/multiplayer/syncManager.js` shares only privacy-safe Event Knowledge summaries. Detailed handoff documentation lives in `docs/ecosystem/AUTHORITATIVE_CORE_ARCHITECTURE.md`.

## Prompt 4 Persistence, Replay, Save Architecture And Recovery

`src/persistence/canonicalPersistence.js` now provides the canonical save, checkpoint, replay timeline, auto-save, recovery, import/export, validation, corruption detection, and legacy migration foundation. It uses Prompt 3 Event Knowledge and State Engine snapshots rather than creating a separate persistence authority.

`src/storage/saveState.js` embeds canonical saves and replay export bundles while preserving the existing local save shape, legacy imports, tutorial autosaves, and profile persistence compatibility. `src/state/gameReducer.js` appends persistence checkpoints after relevant reducer actions, and `src/multiplayer/syncManager.js` publishes only privacy-safe persistence summaries. Detailed documentation lives in `docs/ecosystem/PERSISTENCE_REPLAY_ARCHITECTURE.md`.

## Prompt 5 Landscape Battlefield Modernization

`src/ui/landscapeBattlefield.js` now provides the reusable landscape-first Commander battlefield presentation model used by the gameplay renderer. It derives local/opponent public boards through the existing perspective layer, groups permanents into Commander-readable lanes, summarizes Commander HUD data, creates selected-card details, reports token stack summaries, and marks future Question, Remind Me, visual replay, and AI panels as unavailable instead of live.

`src/ui/render.js` now renders gameplay as stable regions: global information rail, focused opponent battlefield, center command center, local battlefield, and context action rail. The command center keeps stack, priority, phase, trigger, selected-card, Commander tax, and combat information in the active battlefield instead of requiring page navigation for standard gameplay information.

`src/styles.css` adds the landscape Commander battlefield layout while preserving the existing BoardState background assets, glass panels, cosmic palette, and gold accents. Prompt 5 does not implement the opponent carousel, camera system, Follow Active Player, Spectator Mode, Question UI, Remind Me UI, visual replay UI, or AI battlefield interface.

Focused tests live in `test/landscape-battlefield.test.js` and cover region modeling, lane classification, token stack summaries, selected-card details, high-player-count public projection, hidden-information protection, and honest future-action availability. Detailed documentation lives in `docs/ecosystem/LANDSCAPE_BATTLEFIELD_ARCHITECTURE.md`.
