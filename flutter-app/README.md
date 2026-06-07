# BoardState Flutter Wrapper

This folder contains a Flutter WebView shell that loads the current BoardState production web app from bundled local assets. The goal is to keep the app visually exact while making it iPhone-ready without rewriting the BoardState UI in Dart.

## What This Wrapper Does

- Loads `assets/boardstate/index.html` with Flutter's WebView controller.
- Uses the same BoardState web build as GitHub Pages/Android, but with relative asset paths for local iOS/Android WebView loading.
- Keeps JavaScript enabled for the rules engine, simulation, Scryfall search, local storage, and UI systems.
- Leaves App Store signing/distribution out of scope until you are ready.

## Prepare The Bundled BoardState App

Run from the repo root:

```bash
npm install
npm run flutter:prepare
```

That builds BoardState with relative paths and syncs it into:

```text
flutter-app/assets/boardstate
```

Run `npm run flutter:prepare` any time the web app changes.

## Generate Platform Folders

Flutter is not installed in this Windows workspace right now. On a machine with Flutter installed, run:

```bash
cd flutter-app
flutter create . --platforms=ios,android
flutter pub get
```

This generates current-version Flutter platform files without changing the wrapper source.

You can also run this from the repo root:

```bash
npm run flutter:create-platforms
```

## iPhone / iOS Notes

To test on an iPhone or simulator:

```bash
cd flutter-app
flutter run -d ios
```

To build an unsigned iOS app bundle on macOS:

```bash
cd flutter-app
flutter build ios --debug --no-codesign
```

Important: normal iPhones cannot install a truly unsigned IPA. A physical developer iPhone still needs a development provisioning profile/team for direct device installation, even when you are not signing for App Store release. Simulator builds can run without App Store signing.

## App Store Signing Later

When you are ready for App Store release:

1. Open `flutter-app/ios/Runner.xcworkspace` in Xcode.
2. Set the bundle identifier and Apple Developer Team.
3. Create an archive from Xcode or run Flutter's iOS release build from macOS.

No App Store signing files are committed by this wrapper.
