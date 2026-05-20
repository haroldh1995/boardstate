# Privacy and Data Storage

BoardState Android is a WebView wrapper around the BoardState web application.

## Local data
- App/session data is stored on-device via WebView local storage/DOM storage.
- Profile/password behavior is local device protection logic from the wrapped app.
- Data is not cloud-authenticated by the wrapper itself.

## Network data
- Network is used for:
  - loading the hosted app when online
  - Scryfall API search/data retrieval
  - multiplayer/network features implemented in the wrapped app

## Offline behavior
- If remote load is unavailable, bundled offline assets are loaded from `android_asset`.

## Notes
- This wrapper does not add external analytics SDKs.
- This wrapper does not provide independent account systems.
