# BoardState Android Wrapper

This folder is a complete Android Studio project that wraps the BoardState web app in a production WebView shell.

## Clone + Build (No Coding Needed)

From repo root:

```bash
npm install
npm run android:build:all
```

That command chain will:

1. Build the web app
2. Sync web assets into `app/src/main/assets/www`
3. Build:
   - debug APK
   - release APK
   - release AAB

## Build Outputs

- Debug APK: `android-app/app/build/outputs/apk/debug/app-debug.apk`
- Release APK: `android-app/app/build/outputs/apk/release/app-release.apk`
- Release AAB: `android-app/app/build/outputs/bundle/release/app-release.aab`

## Android Studio Flow

1. Open Android Studio
2. `Open` -> select `android-app`
3. Wait for Gradle sync
4. Use:
   - `Build > Build Bundle(s) / APK(s) > Build APK(s)` for direct install APKs
   - `Build > Build Bundle(s) / APK(s) > Build Bundle(s)` for Play Console upload AAB

## Signing Behavior

- Release builds use externally supplied `android-app/keystore.properties` or the
  `BOARDSTATE_KEYSTORE_*` environment variables when all credentials are present.
- Without production credentials, Gradle creates a minified release artifact signed
  with the standard Android test key. It is installable for release-candidate testing
  but must not be uploaded to Google Play.
- BoardState never generates a predictable production upload key or commits signing
  passwords. Copy `keystore.properties.example` and supply private values outside Git
  for a production Play build.

## WebView Features Included

- JavaScript, DOM storage, and database storage enabled
- Offline bundled fallback if network is unavailable
- Safe URL handling (external hosts open outside app)
- File chooser support for upload fields
- Back navigation wired to WebView history
- Loading and error overlays for user feedback
