# Android Permissions

## Requested
- `android.permission.INTERNET`
  - Used to load the production BoardState web app and live Scryfall requests.
- `android.permission.ACCESS_NETWORK_STATE`
  - Used to detect connectivity and decide remote vs bundled offline load behavior.
- `android.permission.READ_MEDIA_IMAGES` (API 33+)
  - Used only when file/image picking is requested by web content.
- `android.permission.READ_EXTERNAL_STORAGE` (maxSdkVersion 32)
  - Legacy image/file selection support on older Android versions.

## Not requested
- Camera
- Location
- Contacts
- Microphone
