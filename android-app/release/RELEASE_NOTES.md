# BoardState Android Wrapper Release Notes

## App
- Name: BoardState
- Version: 1.24.0
- Version code: 39
- Package: `com.boardstate.app`

## Version 1.24.0
- Finalizes the original BoardState ecosystem preparation pass for the next BoardState Lite, Deck Nexus, and Hub prompt series.
- Adds final handoff readiness documentation that states BoardState remains the authoritative advanced rules engine and that live Lite, Nexus, and Hub integrations are not yet claimed.
- Hardens Rules Waived mode behind an explicit confirmation while preserving rules-engine validation, waiver logging, non-waivable errors, Manual Choice Required, and AI rules enforcement.
- Updates linked-session details and bridge status copy to prefer honest import/export readiness labels over legacy linked flags.
- Adds final regression coverage for future-app boundary documentation, false integration claims, honest linked-app statuses, and Rules Waived confirmation.
- Preserves legacy data, non-destructive migration readiness, bridge adapters, shared sessions, Advanced Gameplay, mirrored Advanced Mode, Dry Run, Tutorial, saves, sync compatibility, and package workflows.
- Updates production web package metadata, Android wrapper metadata, Flutter wrapper metadata, local package artifacts, and release notes for version 1.24.0.

## Version 1.23.0
- Adds a non-destructive legacy migration readiness system that inventories profiles, protected profile metadata, decks, collections, physical table records, saves, tournaments, friends, notifications, sync data, settings, diagnostics, and unknown legacy blocks without mutating source data.
- Adds migration readiness classification, future owner mapping, archive records, persistent migration history, and safe Legacy Data Browser metadata with no delete or cleanup expansion.
- Adds full BoardState legacy backup bundles with validation hashes, privacy exclusion lists, safe restore validation, and emergency backup/recovery report actions.
- Adds destination-specific export bundles for Deck Nexus, BoardState Lite, BoardState keep/archive data, and future Hub migration readiness without claiming external import success.
- Adds export validation, protected profile handling, unsafe private field exclusion, malformed data rejection, save validation, imported snapshot validation, shared-session reference checks, and recovery reports.
- Updates the Legacy & Migration UI with Migration Overview, Full Backup, BoardState-Owned Data, Export to Deck Nexus, Export to BoardState Lite, Prepare for Future Hub, Legacy Data Browser, Failed/Unknown Data, Migration History, and Recovery Tools.
- Preserves existing legacy access paths, old save load behavior, current sync, rules enforcement, Waive Rules, mirrored Advanced Mode, Dry Run, Tutorial, and bridge adapters.
- Adds focused regression coverage for inventory detection, empty inventory, backup/export validation, private-field exclusion, archive/history persistence, safe browser metadata, recovery reports, and non-destructive reducer behavior.
- Updates production web package metadata, Android wrapper metadata, Flutter wrapper metadata, local package artifacts, and release notes for version 1.23.0.

## Version 1.22.0
- Adds BoardState-side app-link bridge adapter infrastructure for future BoardState Lite, Deck Nexus, and Hub integrations without modifying external app repositories.
- Adds honest capability handshakes for supported payload types, file/clipboard import, handoff export, shared sessions, deck snapshots, unavailable live sync, and future Hub coordination.
- Adds BoardState Lite snapshot validation/import, compatibility reports, safe unknown-data handling, and future Lite handoff export bundles that avoid private credentials.
- Adds Deck Nexus immutable deck snapshot validation/import, local imported snapshot management, newer-snapshot warnings, and Dry Run / Advanced Gameplay deck-source references.
- Adds linked-app UI actions for Lite session import/export, Deck Nexus snapshot import, imported data management, failed import quarantine, and explicit “coming after app update” states.
- Adds deep-link handoff parser foundations that require user confirmation, reject oversized payloads, and safely ignore malformed app-link data.
- Updates save/load metadata so imported Deck Nexus snapshots and Lite session records can be embedded or restored without requiring live external app availability.
- Adds focused regression coverage for capability metadata, Lite snapshot import/export, Deck Nexus import/use, deep-link safety, malformed/private payload rejection, and imported-data save round trips.
- Updates production web package metadata, Android wrapper metadata, Flutter wrapper metadata, local package artifacts, and release notes for version 1.22.0.

## Version 1.21.0
- Adds synchronized mirrored Advanced Mode support so two BoardState Advanced clients can render the same canonical session from each local player's perspective.
- Adds Advanced multiplayer view modes for solo Advanced, two-player mirrored Arena, Commander pod Advanced, mixed-interface sessions, imported-session views, and recovery views.
- Adds a local perspective layer that keeps the local player's board primary, focuses relevant opponent boards, and exposes compact Commander pod opponent lanes without mutating canonical rules state.
- Adds participant status, interface mode, priority, pass, waiting-for-choice, and connection indicators for Advanced shared sessions.
- Routes priority prompts, required choices, blocker prompts, and AI-owned choices to the correct owner while other clients show waiting/manual recovery states.
- Adds public-only opponent board inspection, synchronized presentation-only full-card preview metadata, cross-board targeting metadata, and shared stack context.
- Adds Advanced sync event handling for gameplay namespace events with duplicate-event protection, stale-revision recovery, and no tournament/friend/deck namespace crossover.
- Persists Advanced multiplayer perspective metadata in saves and defaults legacy saves safely to solo Advanced mode.
- Adds focused regression coverage for mirrored perspectives, Commander pod focus, mixed interfaces, choice ownership, sync dedupe/stale recovery, targeting metadata, save/load metadata, and hidden information protection.
- Updates production web package metadata, Android wrapper metadata, Flutter wrapper metadata, local package artifacts, and release notes for version 1.21.0.

## Version 1.20.0
- Adds shared-session handoff infrastructure for future BoardState Lite Simple Mode and original BoardState Advanced Mode continuity without claiming live Lite integration.
- Adds persisted canonical interface mode state, `activeInterfaceByPlayer`, interface mode history, local/preferred interface metadata, switch revisions, and `INTERFACE_MODE_CHANGED` event records.
- Identifies original BoardState as Advanced Mode on the home screen, battlefield header, session details, linked-app views, save metadata, and shared-session exports.
- Adds canonical linked-session snapshot import and safe Advanced continuation from valid external/simple-shaped session bundles, with missing-data warnings and Manual Choice readiness.
- Adds shared-session export, copy handoff JSON, and downloadable handoff bundle actions for future Simple Mode, Hub, and migration consumers while excluding private credentials.
- Completes Continue Linked Game with real imported canonical session records, session details, duplicate-as-Advanced, remove, import, and export actions plus honest empty states.
- Adds session capability metadata for Advanced Mode, rules engine, enforcement, waivers, stack, priority, combat, handoff import/export, save round trips, and unavailable mirrored/Lite live features.
- Updates sync/save adapters to preserve interface metadata, source app, capabilities, enforcement mode, schema/rules versions, revisions, linked-session metadata, and legacy Advanced Mode defaults.
- Adds focused regression coverage for interface defaults, interface events, export/import round trips, linked sessions, malformed imports, sync metadata, legacy save defaults, and no false Lite status.
- Updates production web package metadata, Android wrapper metadata, Flutter wrapper metadata, local package artifacts, and release notes for version 1.20.0.

## Version 1.19.0
- Streamlines BoardState around the focused Advanced Gameplay, Dry Run, Tutorial, Saves, Linked Sessions, Rules, Accessibility, and Legacy & Migration experience.
- Adds a new primary BoardState home screen with large action cards for Start Dry Run, Continue Dry Run, Start Advanced Gameplay, Continue Linked Game, Load Game State, Tutorial, and Recent Simulations.
- Keeps Rules Enforced / Rules Waived visible on the home screen, Game Options, session metadata, and save metadata, with active waiver and waiver-history controls.
- Adds honest linked-app status cards for BoardState Lite, Deck Nexus, and the future Hub without claiming unavailable integrations.
- Reorganizes Game Options into focused Rules, Gameplay, Dry Run, Tutorial, Saves, Linked Apps, Accessibility, Display & Performance, Legacy & Migration, and Diagnostics categories.
- Adds grouped save views for Advanced Games, Dry Runs, Tutorial Saves, Imported Sessions, Legacy Saves, and Recovery Saves with rules-engine/schema compatibility metadata.
- Preserves legacy decks, collection/archive, profiles, friends, tournaments, notifications, multiplayer data, and saves behind Legacy & Migration access instead of deleting data.
- Adds canonical session metadata to new sessions and advanced gameplay starts while preserving existing save, sync, tutorial, Dry Run, battlefield, and rules-engine behavior.
- Adds regression coverage for the streamlined home model, rules controls, advanced session startup, save grouping, linked-app status, and legacy migration inventory.
- Updates production web package metadata, Android wrapper metadata, Flutter wrapper metadata, local package artifacts, and release notes for version 1.19.0.

## Version 1.18.0
- Adds canonical shared contracts for BoardState ecosystem IDs, profile references, linked apps, players, cards, deck snapshots, shared game sessions, turn/priority state, battlefield/zones, stack objects, triggers, choices, combat, mana payments, rules violations, warnings, waivers, actions, events, sync messages, tournament references, notifications, save envelopes, and ecosystem bundles.
- Adds independent shared schema, rules-engine, save-format, and sync-protocol version metadata with validation and compatibility results for unsupported versions, malformed data, recoverable data, and corrupted payloads.
- Adds non-destructive adapters for current BoardState runtime state to canonical shared sessions, canonical sessions back to runtime state, legacy local saves to canonical save envelopes, canonical envelopes back to legacy saves, and legacy sync payloads to canonical sync messages.
- Adds canonical action/event conversion to the BoardState rules-engine adapter while preserving current reducer, save, sync, and gameplay behavior.
- Adds version metadata to local saves and exports canonical save envelopes alongside legacy save payloads while keeping legacy saves loadable.
- Adds focused regression coverage for shared contracts, hidden/public information boundaries, namespace separation, malformed save rejection, canonical save round trips, and no UI dependency in shared contracts.
- Updates production web package metadata, Android wrapper metadata, Flutter wrapper metadata, local package artifacts, and release notes for version 1.18.0.

## Version 1.17.0
- Adds the first reusable BoardState rules-engine boundary with explicit validation, resolution, event, trigger, stack, priority, combat, mana, targeting, state-based-action, serialization, and explanation APIs.
- Routes the current BoardState reducer, Battlefield mana helpers, and Dry Run simulation hydration through the extracted rules-engine boundary while preserving current gameplay behavior and save/sync compatibility.
- Adds a BoardState adapter that converts existing profile/session actions into explicit engine requests and applies engine results without moving UI presentation, storage, network, focus, animation, or notification work into the engine.
- Adds rules-engine versioning for future shared-session compatibility checks and ecosystem contract work.
- Adds focused rules-engine regression coverage for UI dependency isolation, active-game mana validation/payment, free casting outside active games, targeting, combat, state-based actions, adapter requests, serialization, and reducer/Dry Run routing.
- Updates production web package metadata, Android wrapper metadata, Flutter wrapper metadata, local package artifacts, and release notes for version 1.17.0.

## Version 1.16.0
- Adds a first-time onboarding window with Start Guided Tutorial, Explore App Freely, Create Profile, Load Local Save, accessibility, watch-later, and do-not-show-again paths.
- Adds a Helper Sprite guided tutorial that teaches BoardState controls and basic Magic turns through short contextual prompts, screen-reader announcements, pause/resume/repeat/remind controls, reduced-motion support, and skip/restart confirmation.
- Adds a deterministic five-turn practice game covering life totals, phases, land play, mana, creature casting, full-card preview, stack/priority, non-creature permanents, counters, triggers, combat, blockers, landfall, tokens, stats overlays, and saving.
- Adds tutorial completion choices to continue the practice game freely, finish the simulated game, start a new simulated game, create or complete a profile, save the current game, load another save, or return to the main app.
- Adds profile-bound local save states with save/load/rename/duplicate/delete/import/export, malformed-save recovery, versioned serialization, and protection against storing plaintext profile passwords or private auth tokens.
- Adds guest tutorial persistence and guest-to-profile continuity so tutorial progress, settings, and saves can be retained without forcing returning users through onboarding again.
- Adds tutorial and save controls to Profile & Saves, Accessibility / ADHD Assist, Data Management, About / Help, the profile page, and active-game save surfaces.
- Adds automated coverage for first-launch gating, tutorial progression, five-turn completion, pause/resume, autosave, free-play transition, profile-bound save serialization/restoration, export safety, and malformed-save handling.
- Updates production web package metadata, Android wrapper metadata, local package artifacts, and release notes for version 1.16.0.

## Version 1.15.0
- Adds a full Friends category in Game Options with a dedicated Friends subpage for friend codes, nearby players, pending requests, favorites, blocked users, profiles, and multiplayer shortcuts.
- Adds simple 4-6 character uppercase friend codes with copy, browser share, safe regeneration confirmation, local persistence, and unsafe-code filtering.
- Adds Add Friend by Code, friend request accept/decline, remove, block, favorite, nickname/profile notes, and local persistence through refresh.
- Adds Nearby Players/Friends discovery using supported local browser channels and the existing WiFi relay room, with honest fallback messaging when true automatic browser LAN discovery is unavailable.
- Adds friend-based game invites and tournament invites with direct join shortcuts where discovery/session data is available, plus invite-link/code fallback.
- Keeps friend discovery/invite messages in a separate `friend` namespace so gameplay sync and tournament sync stay isolated.
- Adds friend notification preferences for requests, nearby alerts, game/tournament invites, joined alerts, sound, haptics, sync unavailable, and block/remove confirmations.
- Updates tests, production web package metadata, Android wrapper metadata, Flutter wrapper web assets, and release notes for version 1.15.0.

## Version 1.14.0
- Overhauls Game Options into a compact category command center with focused subpages for Profile & Saves, Gameplay & Multiplayer, Tournament, Notifications, HUD & Layout, Accessibility / ADHD Assist, Diagnostics & Support, Data Management, and About BoardState.
- Adds a Tournament Options subpage with tournament status, pin/unpin controls, full bracket access, tournament code copy, invite link copy, and browser share support where available.
- Adds hash/query based tournament invite links such as `#tournament/join/CODE`; shared links open BoardState directly to a Join Tournament sign-up window.
- Adds local tournament join handling from invite links while preserving the dedicated tournament sync namespace and keeping normal gameplay sync separate.
- Adds full-window tournament notifications for invite opened, player join/leave, tournament create/start, round posted/locked, table assignment, 1v1 completion, Sudden Death, Sudden Death extension, result submission/correction, tournament end, and final winners.
- Adds Notification Options with master, popup, toast, sound, haptics, tournament, gameplay, Dry Run, Manual Choice, sync, reminder, tournament-event, and gameplay-event preference toggles.
- Adds unread notification badge support, notification persistence, acknowledgement/dismiss tracking, and test notification/sound/haptic controls.
- Adds browser-safe WebAudio notification sounds and `navigator.vibrate` haptics with unsupported-device no-op fallbacks and local preference persistence.
- Keeps screenshots/reference images out of the repository and does not run iPhone/Xcode/native iOS build steps for this release.
- Updates tests, production web build output, Android wrapper metadata, Flutter wrapper metadata, package artifacts, and release package notes for version 1.14.0.

## Version 1.13.1
- Runs a full regression audit across the automated event-ready suite, production web build, live web preview, mobile viewport preview, and local WebSocket relay transport.
- Adds WiFi relay support for tournament sync using separate `tournament:*` rooms, `tournament-action` packet types, tournament namespace filtering, peer presence, and relay URL controls.
- Preserves tournament sync mode, relay URL, connected peers, and status through tournament normalization, result recalculation, local persistence, and stale-code join replacement.
- Keeps tournament sync separate from normal gameplay sync; joining or hosting a tournament does not join/end a gameplay session, and gameplay relay action packets remain distinct from tournament packets.
- Adds Tournament Sync and WiFi Tournament Relay URL controls to tournament create/join surfaces inside the Tournament page and Game Options overlay.
- Adds Strict Turn Phase Enforcement to the Battlefield Utility Phase panel while preserving the existing Game Options toggle and phase tracker visibility.
- Confirms free casting/placement remains unrestricted outside active games and Dry Run, while active games and Dry Run keep mana-source enforcement and auto-mana behavior.
- Updates release/package metadata and known limitations for version 1.13.1.

## Version 1.13.0
- Adds a full 10-player casual MTG tournament page with Options-menu access, host/create and join flows, local join codes, pinned tournament panels, and local persistence.
- Implements the 10-player casual win ladder preset with two 4-player pods plus one 1v1 table per round, randomized Round 1 seating, reviewable round generation, and manual seating overrides before lock/start.
- Adds elimination-order next-round generation, 1v1 rotation that avoids repeat 1v1s until all players have one where possible, standings-balanced pod filling, and exact-round assignment safeguards.
- Adds result entry for pods and 1v1 matches, including winners, losses, elimination order, eliminator tracking, pod placements, life totals, commander damage notes, manual corrections, and correction history.
- Adds standings ranked by total wins, pod wins, 1v1 wins, fewest losses, head-to-head summaries, pod eliminations, and average pod placement, with top-three highlighting and final announcements.
- Adds Sudden Death management: reporting the 1v1 result marks active pods as Sudden Death, shows damage-doubling rules, and supports final three-turn extension tracking with tie-break inputs.
- Adds a compact in-app rules reference covering match structure, records, deck changes, 1v1 rotation, Sudden Death, extension rules, seating, conduct, disputes, rankings, end conditions, and winners.
- Keeps tournament sync isolated from gameplay sync with a dedicated tournament namespace/session/channel and local-only BroadcastChannel adapter; gameplay sessions are not joined or ended by tournament actions.
- Updates browser regression coverage, web build output, Android wrapper metadata, Flutter wrapper metadata, and release/package artifacts for version 1.13.0.

## Version 1.12.0
- Removes battlefield selection layout expansion and preserves the active page/board scroll position through card, menu, search, stack, combat, and Dry Run interactions.
- Simplifies land tile surfaces to exactly `+1` and `Tap`; tapping lands now produces parsed mana by default while special non-mana tap abilities remain safely manual.
- Adds active-game and Dry Run source-aware auto-mana payment that prefers legal simple sources, avoids tapped/non-mana sources, and keeps training-ground placement unrestricted.
- Routes `+1` land copies and all normal land additions through the shared land-entry event pipeline so landfall triggers once per added land, including Planet lands.
- Moves non-creature permanent actions into a compact selected-card menu and preserves Planeswalker loyalty, Crew, Saddle/Mount, Station, removal, tap, trigger, and counter controls.
- Makes full card art the battlefield tile surface with clean state overlays, stacked-copy badges, image fallbacks, and Stats Overlay compatibility.
- Normalizes Spacecraft, Vehicle, Mount, Planet, Station, and Max Speed state; Planet is treated as a land, Station progress is tracked, and player Max Speed persists up to speed 4.
- Keeps Dry Run AI autonomous while validating and tapping its own legal mana sources.
- Synchronizes web, Android wrapper, Flutter wrapper, package metadata, and downloadable release artifacts at version 1.12.0.

## Version 1.11.1
- Enter/Return/Search now immediately submits Battlefield and Deck Page Scryfall searches, blurs the search input, and dismisses the browser keyboard where supported.
- Search result, cast/source, and Deck Page actions keep the original Scryfall input blurred instead of reopening the keyboard after state updates.
- Battlefield cast/source confirmation now closes search before the full-card cast/entry presentation, preventing an intermediate jump back to search.
- Adds browser-safe search metadata and focus regression coverage for portrait, landscape, desktop, and Dry Run search updates.
- Synchronizes web, Android wrapper, Flutter wrapper, package metadata, and downloadable release artifacts at version 1.11.1.

## Summary
- Completes the event-ready BoardState pass with smoother Dry Run rendering, first-tap controls, faster non-blocking notices, stable search focus/scroll, reduced simulation animation churn, and performance-safe overlays.
- Fixes casting routing so permanent spells use the permanent stack path, instants/sorceries use the non-permanent stack path, lands use battlefield entry, and the caster is not redundantly asked to confirm their own cast.
- Adds responder-only priority, automatic stack processing after priority passes, manual Stack Review, visible pending counts, user-only target/manual-choice pauses, and first-tap Manual Choice targeting above utility panels.
- Adds MTG Arena-style full-card cast/entry previews, permanent battlefield drop presentation, reduced-motion handling, and local presentation for normal gameplay and Dry Run-compatible actions.
- Adds MTG Arena-style blocker declaration with attacker/defender boards, legal-block filtering, multiple blockers, menace validation, No Blockers, trample/deathtouch-aware damage, planeswalker/battle damage, and user-creature graveyard movement.
- Hides permanent stats overlays by default and adds a persistent top-right Stats On/Off toggle while retaining critical tapped, attacking, blocking, counter, loyalty, token, and stack indicators.
- Orders the battlefield as creatures, lands, then non-creature permanents without large labels and adds automatic portrait-to-landscape Arena-style battlefield lanes without hand/deck/exile/graveyard zones.
- Fixes Deck Page Scryfall context/actions, adds resilient embedded common-card fallback results, Add to selected deck, Add to new deck, and commander eligibility actions without leaking Battlefield cast actions.
- Adds tapped/conditional entry handling with user entry-choice prompts, optional strict phase enforcement, manual trigger count/condition controls, and full exact-copy stack trigger defaults.
- Keeps Alpha/Beta/Omega hidden by default with visibility toggles, independent Dry Run choices, preserved learning data, throttled visual updates, and no user decisions for simulated players.
- Completes starting Planeswalker loyalty, loyalty adjustments/removal, and safer Crew/Saddle/Station/Convoke/Improvise tap-cost helpers that exclude the source permanent from its own payment.
- Adds local Commander tournament creation, players, result reporting, corrections, win-ranked standings, top-three announcement, persistence, and a tournament-only BroadcastChannel adapter separated from gameplay sync.
- Adds event-ready browser regression coverage for phone portrait, landscape, desktop, casting, target choices, blockers, search contexts, tournament controls, opponent visibility, and Dry Run controls.
- Wraps the production BoardState web app in Android WebView.
- Supports remote-first loading with bundled offline fallback.
- Keeps JavaScript + DOM storage enabled for local-first app state.
- Uses the provided dragon icon as the official launcher/app icon set.
- Updates the battlefield mobile dashboard with a smaller footprint, raised center phase control, and full gold filigree border treatment.
- Fixes the center Next Phase badge position so the full button stays visible and centered inside the compact dashboard.
- Adds release QOL systems: friendly error recovery, rules confidence indicators, copy/export debug tools, tutorial sample board, and safer confirmations for destructive local-data actions.
- Fixes modal confirmation stacking and mobile dashboard hit-testing discovered during visual browser audit.
- Adds the animated BoardState dragon loading screen with real startup checkpoints, blue glowing progress bar, reduced-motion support, and smooth fade into the app.
- Keeps startup from flashing half-loaded UI while profile/settings, route state, rules systems, Scryfall cache, deck data, and visual assets initialize.
- Fixes the loading screen handoff so storage/profile startup can no longer stall the app behind the splash screen.
- Adjusts the live blue loading bar lower in the dragon artwork so the BoardState title remains readable while the bar fills.
- Fixes dirty hash routes such as `#life?...` and `#battlefield?...` so startup normalizes to the intended app page.
- Improves Battlefield dashboard accessibility/state hooks so Next Phase and all six dashboard actions are reliably addressable.
- Fixes action notices so Activate, Resolve, and other dashboard feedback appears immediately instead of waiting for a later render.
- Updates the bundled Android WebView assets so the direct-download package includes the latest loader, Battlefield dashboard, and Decks search action fixes.
- Fixes non-blocking toast behavior so phase/status notices no longer consume the next Battlefield dashboard tap.
- Restores Decks-page search actions to Add to deck and Make commander instead of Battlefield Cast actions.
- Removes the baked sample loading bar from the splash wallpaper so only the live animated loading bar is shown during startup.
- Speeds up the splash screen asset load, keeps the app hidden until the active page finishes painting, and prevents half-loaded pages from showing during startup.
- Adds a safer instant/sorcery resolution pipeline with stack placement, targeting, common effect handling, hidden-zone updates, NPC Dry Run decisions, and Manual Choice fallback for unsupported rules text.
- Stabilizes Dry Run menus and searches so simulation updates no longer force scrollable panels back to the top.
- Forces tablets and iPads to use the same streamlined mobile layout as phones.
- Adds real Scryfall card-art backgrounds to compact Battlefield tiles while preserving readable HUD information, token fallbacks, stacked copies, and tapped/attacking/targeted states.
- Replaces static Battlefield search cast controls with a contextual Cast popup that closes immediately after an action while preserving search focus and scroll position.
- Removes the blocking Dry Run status window from the Battlefield and moves real simulation controls into the Tools menu.
- Prevents the Battlefield or page behind a menu from scrolling while Scryfall Search, Tools, Player Controls, Manual Choice, Stack, Trigger Queue, or other temporary panels are open.
- Fits complete Scryfall card images inside compact Battlefield tiles instead of cropping their frames.
- Adds final battlefield graphic polish for tapped, attacking, blocking, selected, targeted, summoning-sick, commander, stacked-token, counter, damage, and pending-trigger states.
- Adds a compact selected-card action HUD and a scan-style card detail inspector without changing core gameplay actions.
- Adds typed battlefield zone cues, themed empty states, standardized rules-confidence chips, improved toasts, phase-advance feedback, and pending Resolve emphasis.
- Fixes a mobile command-console overflow found during final visual QA so all six dashboard actions and Next Phase stay inside the viewport.
- Fixes selected-card action buttons being swallowed by advanced permanent gesture handling.
- Completes the selected-card action HUD with existing Tap/Untap, Counters, Attack, Move, Remove, and Details flows, including clear disabled attack states for noncreatures.
- Adds explicit Tapped, Targeted, and Locked battlefield state badges so critical card state remains readable over card art.
- Gives Alpha, Beta, and Omega distinct strategy identity cards in Dry Run setup.
- Adds an honest simulation-results podium using recorded Dry Run win/loss data without introducing a separate tournament rules system.
- Stops Dry Run simulation ticks from replaying page and panel entrance animations, eliminating the recurring UI blink while preserving normal transitions outside simulation.
- Coalesces hidden NPC phase updates into a single visual refresh per NPC turn and emits no repaint while Dry Run waits for the local player.
- Adds permanent spells to the stack/casting pipeline, including countering, Aura target review, battlefield resolution, and safe land-play routing.
- Adds planeswalker starting loyalty, loyalty controls, and zero-loyalty state-based removal.
- Adds Manual Trigger entry and safe Convoke, Improvise, Crew, Saddle, and Station tap-cost helpers that preserve Manual Choice confirmation.
- Organizes battlefield permanents by card type and adds a horizontal widescreen battlefield lane layout without changing mobile/tablet composition.

## Included behavior
- WebView back navigation
- Search, multiplayer, gameplay UI, trigger tooling, history, and profile flows from the wrapped app
- Local storage persistence across app restarts

## Build artifacts
- Debug APK
- Release APK
- Release AAB
- Upload certificate PEM (`release/upload_certificate.pem`)

## Build automation
- Root command `npm run android:build:all` now:
  - builds the web app
  - syncs assets into Android wrapper
  - builds debug/release APK + AAB
  - exports Play upload certificate
