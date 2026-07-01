# Legacy Data Migration Plan

## Scope

This plan identifies legacy data and destinations. No destructive migration is performed in Prompt 1.

## Data Categories and Destinations

| Legacy data | Current location | Destination | Migration status |
| --- | --- | --- | --- |
| Profiles and display names | `profile.player`, `localAuth`, `localDatabase.js` | Hub profile with BoardState local cache | Preserve until Hub exists |
| Local password metadata | `auth-meta` IndexedDB/localStorage fallback | Local-only credential metadata, not Hub plaintext | Never migrate plaintext passwords |
| Friends/favorites/blocked users | `profile.friends` | Hub friends | Preserve local archive; map codes to Hub identities later |
| Global notification preferences | `settings.notifications` | Hub global prefs plus app-specific overrides | Split later |
| Tutorial progress | `profile.onboarding`, `activeSession.tutorial`, local saves | BoardState | Keep in BoardState |
| Advanced gameplay saves | `profile.localSaves` | BoardState, optionally Hub backup | Keep, then export as versioned save bundle |
| Dry Run state and learning | `activeSession.simulation`, `simulationMemory`, `simulationStats` | BoardState | Keep |
| Tournament data | `profile.tournament` | Hub tournament admin, BoardState gameplay references | Preserve local admin data until Hub migration is verified |
| Deck definitions/commander decks | `profile.commanders`, archive/deck UI state, simulation deck files | Deck Nexus | Export snapshots first; keep simulation fixture decks in BoardState |
| Collection/scanner data | Not found as a complete native scanner system | Deck Nexus | Future Deck Nexus only |
| Physical table/life records | `activeSession.life`, commander damage, player counters | Shared session plus BoardState Lite UI | Preserve via shared session |
| Rules settings | `settings.strictPhaseEnforcement`, `manualStackConfirmation` | Shared session/BoardState | Keep and add enforcement mode later |
| Waived rules | Not yet explicit | Shared session/BoardState rules engine | Add in future prompts |
| Sync sessions | `settings.multiplayer`, sync managers | Bridge adapters/Hub coordination | Preserve existing local/wifi options |
| Accessibility settings | `settings.adhdMode`, `helperSprite`, haptics/sound | Hub global prefs plus BoardState overrides | Split later |

## Migration Safety Requirements

- Create a full local backup before migration.
- Never delete original local data during the first migration pass.
- Write migrated output beside legacy data with schema/version metadata.
- Validate migrated output before marking migration successful.
- Provide rollback by retaining legacy keys and old save bundles.
- Record migration status, source version, destination version, failures, and warnings.
- Show partial failures clearly to the user.
- Do not migrate plaintext passwords or private tokens.
- Do not expose hidden debug state or private sync credentials.
- Keep a legacy archive until the user confirms the destination app works.

## Cross-App Handoff Risk Analysis

| Option | Works now | Same-origin only | Separate domains | Android wrapper | Risk |
| --- | --- | --- | --- | --- | --- |
| Shared Hub/session service | Not implemented | No | Yes if service exists | Yes | Safest long-term, requires backend/service |
| Same-origin shared storage | Possible if apps hosted together | Yes | No | Only same WebView origin | Browser security blocks separate origins |
| IndexedDB direct sharing | BoardState uses IndexedDB | Yes | No | Same origin only | Cannot be seamless across domains |
| BroadcastChannel | Used for local gameplay/friends/tournaments | Yes | No | Same origin WebView only | Good local adapter, not cross-origin |
| Service Worker messaging | Not found | Yes | No | Wrapper-dependent | Requires implementation |
| WiFi sync transport | Exists via `scripts/multiplayer-server.mjs` and WebSocket managers | No | Yes on same relay | Yes if reachable | Good fallback; needs revision/conflict model |
| Deep link/session identifier | Tournament/friend links exist | No | Yes | Android intents possible later | Requires session service or import fetch |
| Custom URI/app links | Android wrapper exists but no full intent handoff audited | No | Yes | Future work | Requires native/manifest planning |
| Versioned save bundle | Local saves/export exist | No | Yes via file/share | Yes | Safest offline fallback but manual |
| Manual import | Exists for profile/local save paths | No | Yes | Yes | Last fallback, highest user friction |

Recommended first implementation order:

1. Shared Hub/session service if available.
2. Same-origin shared storage for hosted ecosystem pages.
3. Existing local/WiFi sync transport with revision metadata.
4. Deep link carrying session identifier.
5. Versioned shared save bundle.
6. Manual import only as last fallback.

## Future BoardState Navigation Plan

Primary BoardState actions:

- Start Dry Run
- Continue Dry Run
- Start Advanced Gameplay
- Continue Linked Lite Game
- Load Game State
- Tutorial
- Recent Simulations

Secondary BoardState actions:

- Linked Deck Nexus
- Linked BoardState Lite
- Rules Enforced / Waive Rules
- Shared Session Status
- Saves
- Accessibility
- Rules Settings

Features to remove from primary BoardState navigation after migration:

- Full native deck builder
- Full collection manager
- Scanner
- Tournament administration
- Global friends administration
- Global profile management
- Unrelated global settings

Deprecation strategy:

- Keep legacy routes accessible under a Legacy or Migration section.
- Add export/link actions to destination apps before hiding primary entry points.
- Preserve old data until migration success is confirmed.
- Keep read-only legacy archive views for one major release after migration.

