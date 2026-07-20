# Current Architecture Audit

## Baseline

- Repository: `https://github.com/haroldh1995/boardstate.git`
- Production branch: `main`
- Preparation branch: `ecosystem/boardstate-preparation`
- Baseline rollback point: `60b273e Add five-turn Helper Sprite tutorial and profile-bound local save states`
- App version at audit: `1.16.0`
- Deployment: `.github/workflows/deploy.yml` deploys GitHub Pages from `main`.
- Release packaging: `.github/workflows/release-package.yml` runs on `v*` tags.
- Build script: `npm run build`
- Test script: `npm test`
- Lint/typecheck scripts: none configured in `package.json`.
- Android wrapper: `android-app/`
- Flutter wrapper: `flutter-app/`
- Generated or packaging artifacts not to edit manually: `dist/`, `output/`, `android-app/app/build/`, `android-app/build/`, `android-app/release/download-package/`, generated Android WebView assets, release zips, Flutter generated assets.

## Baseline Verification

- `npm test`: passed, 96 tests.
- `npm run build`: passed. Vite reported the existing chunk-size warning for the main JS chunk.
- No live web preview was required for this preparation task.
- No user data was deleted.
- No runtime feature was removed.

## Repository Structure Inventory

| Area | Primary files | Responsibility | State ownership | Persistence ownership | Future category | Coupling risks |
| --- | --- | --- | --- | --- | --- | --- |
| App entry | `src/main.js`, `index.html`, `src/ui/loadingScreen.js` | Boot, profile loading, first screen | Delegates to store/profile | IndexedDB/localStorage through storage layer | Keep in BoardState until Hub routing exists | Hash navigation and loading concerns are UI-specific |
| Store/reducer | `src/state/store.js`, `src/state/gameReducer.js`, `src/state/actions.js`, `src/state/schema.js` | Canonical local profile/session mutations | Main source of truth for profile and active session | Calls `saveProfile` after dispatch | Keep, then split into shared contracts and rules-engine adapter | Reducer mixes rules, UI actions, notifications, simulation, friends, tournaments |
| Advanced UI | `src/ui/render.js`, `src/styles.css` | Life tracker, battlefield, options, modals, searches, tutorial panels | Holds transient local UI variables and dispatches store actions | Indirect via store | Keep advanced battlefield, streamline non-core areas later | Rules-sensitive dispatches are embedded directly in event handlers |
| Rules/effects | `src/effects/*`, `src/game/*` | Card parsing, effects, targeting, layers, combat, mana, entry, commander, tournament | Mutates session objects returned to reducer | Indirect via active session save | Keep/extract to `@boardstate/rules-engine` | Some engine functions assume current session shape and local player/opponent sides |
| Dry Run/simulation | `src/simulation/*` | NPC decks, AI turns, simulation learning, action selection | `activeSession.simulation`, `simulationMemory`, `simulationStats` | Profile storage | Keep in BoardState | Simulation calls reducer/rules helpers directly and uses simplified hidden-zone assumptions |
| Scryfall | `src/services/scryfallService.js` | Search, cache, card normalization | Search-local cache and card result objects | `localStorage` cache | Deck Nexus long-term for builder/search, BoardState keeps tactical search | Search results feed both deck and battlefield actions |
| Storage | `src/storage/localDatabase.js`, `src/storage/saveState.js` | IndexedDB/localStorage profiles, password metadata, profile-bound saves | Profile, local saves, guest data, protected profile | IndexedDB plus local/session fallback | Hub for shared profile/backups, BoardState for advanced gameplay saves | Save format stores whole active session, not shared-session slices |
| Sync | `src/multiplayer/syncManager.js`, `src/multiplayer/tournamentSyncManager.js`, `src/multiplayer/friendSyncManager.js`, `scripts/multiplayer-server.mjs` | BroadcastChannel and WebSocket relay sync by namespace | Sync peers and public state snapshots | Runtime only, profile settings keep room config | Bridge adapters/Hub coordination | Gameplay, tournament, and friend sync are separated but share settings namespace |
| Friends | `src/social/friendSystem.js`, friend UI in `render.js` | Friend codes, local friends, invites | `profile.friends` | Profile storage | Move to Hub | Friend actions are reducer actions and notification producers |
| Tournaments | `src/game/tournamentSystem.js`, tournament UI in `render.js`, `tournamentSyncManager.js` | Local tournament setup, rounds, standings, sudden death | `profile.tournament` | Profile storage | Move administration to Hub; keep gameplay references | Tournament system lives in `game/` but is not rules-engine core |
| Tutorial | `src/onboarding/tutorialSystem.js`, tutorial UI/helper in `render.js` | First-run guided MTG lesson and practice state | `profile.onboarding`, `activeSession.tutorial` | Profile/local saves | Keep in BoardState | Tutorial currently seeds real session state and should become rules-engine client |
| Helper Sprite | `render.js`, settings in `schema.js` | Guidance, reminders, tutorial prompts | `activeSession.helper`, settings | Profile storage | Keep in BoardState; Lite may have separate lightweight helper | UI-rendered and tightly coupled to DOM positioning |
| Notifications | Reducer notification helpers, UI rendering, settings schema | Toast/full-window notices, preferences | `profile.notifications`, `settings.notifications` | Profile storage | Global preferences move to Hub, gameplay notifications stay BoardState | Notifications are emitted in reducer side paths |
| Deck builder/archive | `commanderSystem.js`, `archiveService.js`, deck UI in `render.js` | Commander assignment, deck card additions, archive/export | `profile.commanders`, `archives`, deck-like fields | Profile storage | Move to Deck Nexus; keep migration bridge | Deck actions share reducer and Scryfall UI with battlefield casting |
| Analytics/diagnostics | `src/analytics/statsService.js`, `src/support/debugExport.js` | Stats summaries, debug export, confidence labels | Profile/session snapshots | Export only | Keep diagnostics in BoardState, ecosystem summaries in Hub | Debug export knows current schema directly |
| Tests | `test/*.test.js` | Node tests for effects, event-ready flows, simulation, spell system, friends, onboarding, tournaments | Test fixtures create profiles/sessions | None | Expand for package extraction | Tests mostly exercise reducer-level behavior, not package-level contracts |
| Build/release | `package.json`, `vite.config.mjs`, workflows, scripts, Android/Flutter wrappers | Web build, package build, wrapper asset sync | Build artifacts only | Release zips/GitHub releases | Keep per app | Generated assets can obscure source diffs |

## Rules Engine Inventory

| Feature | Current status | Primary files | Extraction classification |
| --- | --- | --- | --- |
| Card parsing and type flags | Partially implemented | `schema.js`, `cardDefinition.js`, `effectParser.js`, `scryfallService.js` | Requires shared card-instance schema |
| Oracle-text parsing | Partially implemented | `effectParser.js`, `targeting.js`, `cardBehaviorOverrides.js` | Safe to extract after fixtures and card overrides are externalized |
| Action validation | Partially implemented | `gameReducer.js`, `combatSystem.js`, `manaSystem.js`, `effectEngine.js` | Coupled directly to reducer and UI action names |
| Action resolution | Partially implemented | `gameReducer.js`, `effectEngine.js`, `combatSystem.js` | Requires command/result boundary |
| Mana validation/payment/auto-tap | Partially implemented | `manaSystem.js`, reducer `prepareCastManaPayment` | Safe to extract after active-game/free-play mode is explicit in session |
| Target validation | Partially implemented | `targeting.js`, `effectEngine.js`, UI selection handlers | Needs legal-target API separated from DOM selection |
| Timing restrictions | Partially implemented/UI-assisted | `fsm.js`, reducer settings, UI controls | Requires enforcement-mode contract |
| Summoning sickness | Partially implemented | `schema.js`, `combatSystem.js`, reducer tap/cost helpers | Needs full turn-control ownership |
| Priority and stack order | Partially implemented | `effectEngine.js`, reducer stack actions, UI auto-run handlers | Coupled to UI auto-run and manual stack controls |
| Triggered abilities | Partially implemented | `effectParser.js`, `effectEngine.js`, `eventBus.js` | Extractable after trigger schema stabilizes |
| Activated abilities | Partially implemented | `schema.js`, `effectParser.js`, reducer manual trigger/tap cost actions | Needs explicit activated-ability action contract |
| Replacement/prevention effects | Partial replacement, prevention mostly missing | `effectParser.js`, `effectEngine.js` | Requires deeper rule model |
| Continuous effects/layers | Partially implemented | `layerSystem.js`, `effectEngine.js` | Extractable, but layer indices are simplified and nonstandard |
| Copy/control/type/color/ability/P-T layers | Partially implemented | `layerSystem.js`, `cardDefinition.js` | Requires refactor before extraction |
| Counters/damage/loyalty | Partially implemented | `schema.js`, `gameReducer.js`, `combatSystem.js` | Extractable after state-based actions are centralized |
| State-based actions | Partially implemented | `combatSystem.js`, reducer loyalty removal, effect resolution paths | Needs single SBA pass |
| Legend rule | Missing | none found | Must be added in rules engine |
| Zero toughness/lethal/deathtouch | Partial | `combatSystem.js`, layer tests | Needs full SBA integration |
| Indestructible/regeneration/shield | Placeholder or missing | scattered text/manual choice paths | Requires new prevention/replacement model |
| Attackers/blockers/combat damage | Partially implemented | `combatSystem.js`, UI blocker popup handlers | Extractable after multi-player sides are generalized |
| First/double strike/protection | Missing or UI/manual only | keyword parsing only | Requires rules work |
| Trample/menace/flying/reach/deathtouch | Partial | `combatSystem.js` | Extractable after combat tests expand |
| Commander damage/replacement | Partial | `commanderSystem.js`, `combatSystem.js`, reducer | Needs generalized player damage model |
| Tokens/token doublers/counter doublers | Partial | `effectParser.js`, `effectEngine.js`, tests | Extractable after replacement effects schema |
| Landfall | Partially implemented | `effectEngine.js`, `eventBus.js`, reducer land-copy path | Extractable after event schema formalization |
| Planeswalker loyalty | Partially implemented | `schema.js`, reducer, `combatSystem.js` | Needs ability/timing rules |
| Crew/Saddle/Station/Max Speed | Partially implemented | `schema.js`, reducer tap-cost and max-speed actions, tests | Requires explicit mechanic schemas |
| Spacecraft/Planet | Type support partial | `schema.js`, `targeting.js`, tests | Needs card data contract |
| Modal/DFC/Adventure/split/X/alt/additional costs | Mostly partial/manual | `effectEngine.js`, `manaSystem.js`, reducer cast options | Requires casting-choice contract |
| Convoke/Improvise | UI/manual cost support partial | reducer tap-cost actions | Requires cost payment model |
| Manual Choice Required | Implemented as recovery/pending effects | `effectEngine.js`, `entrySystem.js`, reducer/UI | Keep as engine output, not UI-side fallback |
| Rules confidence | Implemented | `debugExport.js`, effect logs | Keep as explanation metadata |
| Undo/replay/deterministic snapshots | Partially implemented | `actions.js`, reducer history/replay | Needs revisioned shared-session history |

## UI-Coupled Rules Logic

- `src/ui/render.js` dispatches `CAST_SPELL`, `ADD_PERMANENT`, `DECLARE_ATTACKERS`, `ASSIGN_BLOCKER`, `RESOLVE_COMBAT`, `RESOLVE_TOP_SPELL`, `PASS_PRIORITY`, `ADD_COUNTER`, `TAP_SELECTED_FOR_COST`, `TRIGGER_QUEUE_RESOLVE`, and many other rules-sensitive actions directly from DOM handlers.
- `src/ui/render.js` contains search-to-cast routing, source-zone selection, stack auto-run handlers, blocker popup actions, battlefield gestures, and selected-card menus.
- `src/state/gameReducer.js` is a reducer but also performs rules resolution, mana payment preparation, simulation turns, friend/tournament notifications, persistence-oriented save actions, and local game setup.
- `src/state/store.js` decides which action namespaces sync and which stay local. This is currently transport-aware application logic rather than a shared sync adapter boundary.

## Current State Ownership Map

| State category | Current source of truth | Duplicate/derived copies | Persistence | Sync | Future owner |
| --- | --- | --- | --- | --- | --- |
| Profiles/player identity | `profile.player`, `localAuth`, `friends.friendDisplayName` | Protected profile fallback, guest fallback | IndexedDB/localStorage/sessionStorage | Public name in sync payloads | Hub, with local BoardState cache |
| Life/commander damage/poison/counters | `activeSession.life`, `commander`, `playerCounters` | UI controls and public sync snapshots | Profile save | Gameplay sync public state | Shared session, BoardState authoritative for rules |
| Turn/phase/active player | `activeSession.turn`, `phaseIndex`, `fsm`, `priority`, `simulation.currentPlayerId` | `syncedMultiplayer.currentPlayerId` | Profile save | Gameplay sync action stream | Shared session with engine authority |
| Battlefield/zones/tokens/stacks/counters | `activeSession.battlefield`, `zones`, permanent objects | UI tile state from render; public sync sanitized permanents | Profile save/local save | Public battlefield snapshot | Shared session, BoardState advanced state |
| Stack/trigger queue/manual choices | `activeSession.stack`, `triggerQueue`, `pendingEffects` | UI stack review and manual choice panels | Profile save/local save | Actions only, limited public count | BoardState rules engine/shared session |
| Combat | `activeSession.combat` | UI blocker modal, damage preview | Profile save/local save | Actions only | BoardState rules engine/shared session |
| Mana | `activeSession.manaPool`, tapped permanents | UI mana pin panel | Profile save/local save | Actions only | BoardState rules engine/shared session |
| Decklists/card definitions | `commanders`, archive/deck fields, Scryfall result objects | Simulation deck files, commander decks | Profile save, hardcoded decks | Not canonical | Deck Nexus |
| Dry Run/AI | `activeSession.simulation`, `simulationMemory`, `simulationStats` | NPC deck source files | Profile save | Simulated local presence only | BoardState |
| Tournaments | `profile.tournament` | tournament sync presence/status, pinned panel | Profile save | Tournament namespace | Hub long-term, BoardState local reference |
| Friends | `profile.friends` | nearby peers, friend display name | Profile save | Friend namespace | Hub |
| Notifications | `profile.notifications`, `settings.notifications` | UI unread count | Profile save | Not separately synced | Hub global prefs, BoardState gameplay events |
| Tutorial | `onboarding`, `activeSession.tutorial`, local save metadata | Helper Sprite UI message | Profile/local saves | Not synced | BoardState |
| Rules settings/enforcement | `settings.strictPhaseEnforcement`, `manualStackConfirmation`, gameTracking mode | UI toggles | Profile save | Actions/settings sync limited | Shared session plus BoardState rules engine |
| Waived rules | Not implemented as explicit state | Recovery/rules confidence logs only | None dedicated | None | Shared session and rules engine |

## Extraction Risk Report

- Highest risk: `gameReducer.js` is the central integration point for rules, UI actions, simulation, saves, notifications, friends, and tournaments.
- Highest risk: `render.js` has rules-sensitive event handlers that build action payloads and sometimes run flow logic before dispatch.
- Medium risk: `activeSession.battlefield.player/opponent` assumes two board sides, while the future shared session must support multi-player Commander and Lite/Advanced perspective switching.
- Medium risk: sync payloads are action-based plus limited public snapshots; they do not yet carry deterministic revision/conflict metadata.
- Medium risk: rule enforcement mode is split across `gameTracking.active`, `strictPhaseEnforcement`, and free-training assumptions.
- Prompt 4 update: local saves still preserve whole-session rollback compatibility, and `src/persistence/canonicalPersistence.js` now adds a versioned canonical save, checkpoint, replay, recovery, and migration bundle foundation.
- Lower risk: effects, targeting, mana, combat, and layer modules are already separated enough to become extraction seeds once schemas are stabilized.

