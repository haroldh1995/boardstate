# Native Portability Audit

BoardState must remain ready for future native shells, including a Swift Playground prototype. The permanent rule is: gameplay systems own game behavior, while platform shells own platform APIs.

## Platform Boundary

Allowed browser shell files:

- `src/main.js`
- `src/ui/render.js`
- `src/ui/loadingScreen.js`
- `src/styles.css`

These files may use DOM, CSS, browser events, and visual rendering because they are the current web shell. A Swift shell should replace this layer rather than port it verbatim.

Portable gameplay and data layers:

- `src/authoritative-core`
- `src/rules-engine`
- `src/state`
- `src/game`
- `src/gameplay`
- `src/effects`
- `src/simulation`
- `src/persistence`
- `src/shared-contracts`
- `src/shared-session`
- `src/storage`
- `src/services`
- `src/support`
- `src/bridge`
- `src/social`

These modules must avoid direct DOM, browser storage, browser location, browser navigator, browser crypto, and browser fetch access.

## Runtime Adapter

`src/platform/runtimeEnvironment.js` is the single non-UI location allowed to resolve runtime APIs.

It provides:

- Storage adapters with memory fallback.
- Location and navigator snapshots.
- Fetch, IndexedDB, crypto, timer, text encoding, and base64 hooks.
- Native-testable defaults that do not require DOM access.

Native shells should provide platform equivalents through this adapter instead of modifying gameplay modules.

## Command Deck Model

`src/gameplay/commandDeckModel.js` owns the platform-neutral Command Deck geometry, snap math, wheel math, pointer math, and card projection values.

`src/ui/render.js` only applies those values to DOM/CSS. A Swift implementation should reuse the model behavior and render the projection through native views.

## Audit Result

Direct browser assumptions removed from:

- `src/services/scryfallService.js`
- `src/storage/localDatabase.js`
- `src/support/debugExport.js`
- `src/bridge/appLinkAdapters.js`
- `src/social/friendSystem.js`

The repository now has `test/native-portability.test.js` to prevent non-UI systems from drifting back into web-only APIs.

## Future Standard

Do not add new direct browser API access to gameplay, rules, state, persistence, storage, service, bridge, support, social, ecosystem, or simulation code. Add platform behavior through `runtimeEnvironment.js` or a similarly explicit adapter.
