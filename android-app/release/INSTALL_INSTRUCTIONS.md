# Direct Install + Play Upload Instructions

## 1) Build everything from repo root
```bash
npm install
npm run android:build:all
```

This generates:
- `android-app/app/build/outputs/apk/debug/app-debug.apk`
- `android-app/app/build/outputs/apk/release/app-release.apk`
- `android-app/app/build/outputs/bundle/release/app-release.aab`
- `android-app/release/upload_certificate.pem`

## 2) Install directly on Android device
1. Copy `app-release.apk` (or `app-debug.apk`) to your device.
2. Enable install from unknown sources for your file manager/browser.
3. Open the APK and install.

## 3) Upload to Google Play
1. In Play Console, create/update app with package `com.boardstate.app`.
2. Upload `app-release.aab`.
3. If Play asks for upload certificate details, use:
   - `android-app/release/upload_certificate.pem`

## 4) Android Studio path (no coding)
1. Open Android Studio -> `Open` -> choose `android-app`.
2. Let Gradle sync.
3. Use:
   - `Build > Build APK(s)` for direct installs.
   - `Build > Build Bundle(s)` for Play upload AAB.
