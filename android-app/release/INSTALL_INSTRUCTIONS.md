# Direct Install Instructions

## 1) Install debug APK
1. Copy `app/build/outputs/apk/debug/app-debug.apk` to your Android device.
2. Enable install from unknown sources for your file manager.
3. Open the APK and install.

## 2) Install release APK
1. Copy `app/build/outputs/apk/release/app-release.apk` to your Android device.
2. Enable install from unknown sources for your file manager.
3. Open the APK and install.

## 3) Play Store upload package
- Use `app/build/outputs/bundle/release/app-release.aab` in Play Console.

## 4) Build commands
```powershell
cd android-app
.\gradlew.bat :app:assembleDebug :app:assembleRelease :app:bundleRelease
```
