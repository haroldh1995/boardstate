# BoardState Android Wrapper Release Notes

## App
- Name: BoardState
- Version: 1.10.6
- Version code: 20
- Package: `com.boardstate.app`

## Summary
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
