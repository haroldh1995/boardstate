# Ecosystem Integration Architecture

Prompt 12 prepares BoardState as the authoritative gameplay application inside the future BoardState ecosystem. The implementation keeps the existing rules, state, event, save, replay, AI, tutorial, and bridge systems intact and adds versioned privacy-safe integration seams around them.

## Runtime Ownership

- `src/ecosystem/ecosystemIntegration.js` owns the BoardState-side ecosystem projection layer.
- `src/state/schema.js` stores `profile.ecosystemIntegration` defaults and `settings.ecosystem` without making Hub, Lite, or Deck Nexus required for local play.
- `src/state/gameReducer.js` handles ecosystem refresh, offline sync queueing, sync acknowledgement, presence updates, shared preference patches, and privacy-safe bundle export through `ECOSYSTEM_*` actions.
- `src/bridge/appLinkAdapters.js` keeps BoardState Lite and Deck Nexus file/clipboard bridges and now exposes honest Hub launch, return, capability, and privacy-safe bundle contracts.
- `src/storage/saveState.js` and `src/persistence/canonicalPersistence.js` persist ecosystem metadata as session metadata only. UI state, secrets, credentials, and hidden zones are not included in Hub-safe summaries.

BoardState remains authoritative for gameplay. Hub coordination is prepared but does not own rules, gameplay state, replay truth, rule amendments, priority, stack, triggers, combat, legality, or hidden-information policy.

## Hub Boundary

Hub-ready contracts now cover:

- shared profile projection
- shared preference projection
- notification references
- presence status
- privacy-safe session discovery
- offline cloud-sync queue metadata
- launch context
- return context
- capability manifest
- privacy-safe ecosystem bundle

No live Hub endpoint is configured. Production status must remain `Hub Not Connected` until a real Hub service is installed, authenticated, and verified.

## BoardState Lite Boundary

Lite readiness remains contract based:

- BoardState can export a Lite handoff bundle through the existing bridge adapter.
- BoardState can import validated Lite session snapshots.
- Lite can later attach to the same canonical Commander session through shared session references.
- Lite never receives or owns a duplicate rules engine from BoardState.
- Live Lite return remains disabled until the Lite app implements its counterpart flow.

## Deck Nexus Boundary

Deck Nexus readiness remains snapshot based:

- BoardState accepts immutable Deck Nexus deck snapshots through the existing bridge adapter.
- Imported snapshots are stored locally and embedded into saves where needed.
- BoardState never mutates source Deck Nexus decks.
- Deck ownership and collection metadata are not gameplay authority.
- Live Deck Nexus linking remains disabled until Deck Nexus implements its counterpart flow.

## Privacy And Security

The ecosystem projection layer rejects or redacts:

- password, token, auth, credential, and secret-like fields
- script-like payload values
- hidden gameplay zones such as hand, library, and sideboard
- gameplay payloads submitted to Hub as authoritative actions

Hub sync can carry profile, preferences, notifications, presence, session discovery, app-link, deck, and gameplay-summary domains. It cannot mutate BoardState authoritative gameplay.

## Offline And Multi-Device Readiness

`createCloudSyncState()` keeps offline sessions functional and queues versioned sync envelopes locally. `createEcosystemSyncEnvelope()` records target app, domain, sync namespace, canonical sync message, expected revision, checksum, and privacy metadata. Envelopes are not submitted live because no endpoint is configured.

The architecture supports later multi-device continuation by preserving canonical session IDs, game IDs, revision metadata, session discovery summaries, and safe return contexts without requiring fake network services.

## UI Surface

`src/ui/render.js` exposes a compact Linked Apps ecosystem panel with:

- honest Hub, Lite, Deck Nexus, and BoardState status
- local offline sync queue actions
- privacy-safe Hub bundle copy/download
- existing Lite handoff import/export
- existing Deck Nexus snapshot import

The UI must not display `Connected to Hub`, live Lite return, or live Deck Nexus link claims until those integrations are actually implemented and verified.

## Tests

Prompt 12 coverage is in:

- `test/ecosystem-integration.test.js`
- `test/app-link-bridge.test.js`

The tests validate honest app status, privacy-safe bundle export, offline sync queue behavior, Hub launch/return contexts, shared preference patching, save metadata, canonical persistence metadata, and absence of false live Hub claims.
