# BoardState Android Wrapper Release Notes

## App
- Name: BoardState
- Version: 1.9.3
- Version code: 12
- Package: `com.boardstate.app`

## Summary
- Wraps the production BoardState web app in Android WebView.
- Supports remote-first loading with bundled offline fallback.
- Keeps JavaScript + DOM storage enabled for local-first app state.
- Uses the provided dragon icon as the official launcher/app icon set.
- Updates the battlefield mobile dashboard with a smaller footprint, raised center phase control, and full gold filigree border treatment.

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
