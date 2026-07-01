# Shared Contract Plan

## Package Boundaries

### `@boardstate/rules-engine`

Responsibilities:

- Validate and resolve rules-sensitive actions.
- Own stack, priority, triggers, replacement effects, continuous effects, state-based actions, combat, targeting, mana, rules explanations, rules confidence, rule waivers, and rules-engine versioning.
- Emit deterministic state deltas, user-choice requests, warnings, and audit events.

Initial extraction candidates:

- `src/effects/effectEngine.js`
- `src/effects/effectParser.js`
- `src/effects/cardDefinition.js`
- `src/effects/targeting.js`
- `src/effects/layerSystem.js`
- `src/game/combatSystem.js`
- `src/game/manaSystem.js`
- `src/game/entrySystem.js`
- `src/game/eventBus.js`
- `src/game/fsm.js`
- selected reducer helpers currently embedded in `src/state/gameReducer.js`

### `@boardstate/shared-contracts`

Responsibilities:

- Define shared profile, deck, game-session, player, card-instance, permanent, zone, stack, trigger, combat, tournament-reference, app-link, save-bundle, action/event, sync-message, migration, and validator schemas.
- Version every schema and provide migrations.
- Provide JSON-safe validators usable by web apps, wrappers, local sync, and future Hub APIs.

### `@boardstate/bridge-adapters`

Responsibilities:

- Translate current BoardState state/actions into shared contracts.
- Translate BoardState Lite compact inputs into engine actions.
- Translate Deck Nexus deck snapshots into game-ready deck/card references.
- Parse deep links, shared files, local handoffs, and sync transport payloads.
- Keep gameplay, tournament, friend/discovery, and notification namespaces separated.

## Versioning Strategy

- Every shared session should carry `schemaVersion`, `rulesEngineVersion`, `contractVersion`, and `revision`.
- Every action should carry `actionId`, `actorPlayerId`, `clientId`, `baseRevision`, `createdAt`, and optional `waiverId`.
- Every emitted event should carry `eventId`, `causationId`, `correlationId`, `revision`, `visibility`, and `rulesConfidence`.
- Migrations should be additive first and should never delete legacy local data during the first successful migration.

## Canonical Action Inventory

| Action | Existing implementation | Current source | Coupling | Future schema needs |
| --- | --- | --- | --- | --- |
| `CREATE_GAME` | Partial via `createGameSession` | `schema.js` | Profile-local | Game format, players, seed, enforcement mode |
| `START_GAME` | Partial via `START_GAME_TRACKING` | `gameReducer.js` | UI/gameTracking | Status transition, initial revision |
| `END_GAME` | Partial via simulation/tournament only | `gameReducer.js` | Context-specific | Winner/result payload |
| `ADD_PLAYER` | Partial tournament/sync presence | `tournamentSystem.js`, `syncManager.js` | Non-game-specific | Shared player identity and seat |
| `REMOVE_PLAYER` | Partial tournament only | `tournamentSystem.js` | Tournament-specific | Removal reason, replacement handling |
| `SET_LIFE` | Implemented | `gameReducer.js` | Direct UI dispatch | Player ID, source, waiver |
| `CHANGE_LIFE` | Implemented as `LIFE_DELTA` | `gameReducer.js` | Direct UI dispatch | Amount, source, damage/loss distinction |
| `SET_COMMANDER_DAMAGE` | Implemented | `gameReducer.js` | Direct UI dispatch | Source commander, damaged player |
| `CHANGE_COMMANDER_DAMAGE` | Implemented as `COMMANDER_DAMAGE_DELTA` | `gameReducer.js` | Direct UI dispatch | Commander source and player |
| `ADD_POISON` | Partial through player counters | `gameReducer.js` | Generic counter UI | Counter type contract |
| `REMOVE_POISON` | Partial through player counters | `gameReducer.js` | Generic counter UI | Counter type contract |
| `ADVANCE_PHASE` | Implemented | `fsm.js`, `gameReducer.js` | Phase UI and sync | Active player, expected phase, enforcement |
| `SET_PHASE` | Missing as canonical action | none | UI uses advance only | Direct phase target and validation |
| `PASS_PRIORITY` | Implemented | `effectEngine.js`, `gameReducer.js` | Stack UI | Priority round, responder ordering |
| `CAST_SPELL` | Implemented partially | `effectEngine.js`, `gameReducer.js` | UI builds cast/source options | Card ref, mode, costs, targets, source zone |
| `PLAY_LAND` | Partial via `ADD_PERMANENT`/land copy | reducer/effect events | Not canonical | Land play count, permissions |
| `PUT_ONTO_BATTLEFIELD` | Implemented as `ADD_PERMANENT` | `gameReducer.js`, `entrySystem.js` | Search/UI driven | Source zone/effect/ref |
| `ACTIVATE_ABILITY` | Partial/manual | reducer tap/manual trigger paths | UI selected-card menus | Ability ID, costs, targets, modes |
| `TRIGGER_ABILITY` | Implemented as `ADD_MANUAL_TRIGGER` and event triggers | `effectEngine.js`, `gameReducer.js` | Manual UI | Trigger ID, count, conditions |
| `SELECT_TARGET` | Partial as `SET_SPELL_TARGET`/selection | `targeting.js`, `gameReducer.js` | UI selected IDs | Target role, legality result |
| `SELECT_MODE` | Partial in cast payload | `effectEngine.js` | UI/user choices | Mode IDs and modal face |
| `PAY_COST` | Partial in mana/tap helpers | `manaSystem.js`, reducer | Cast flow specific | Cost parts, payment sources |
| `TAP_PERMANENT` | Implemented as `TOGGLE_TAPPED`/cost tap | `gameReducer.js` | UI direct | Cause, cost/effect distinction |
| `UNTAP_PERMANENT` | Implemented through tap toggle | `gameReducer.js` | UI direct | Cause and legality |
| `ADD_COUNTER` | Implemented | `gameReducer.js` | Direct UI | Counter type, target, replacement effects |
| `REMOVE_COUNTER` | Partial/missing canonical | reducer counter helpers | UI-specific | Counter type/count/source |
| `CREATE_TOKEN` | Implemented as `ADD_CUSTOM_TOKEN`/effects | `effectEngine.js`, `gameReducer.js` | UI/effect paths | Token definition and provenance |
| `DECLARE_ATTACKERS` | Implemented partial | `combatSystem.js`, `gameReducer.js` | UI attacker gestures | Multi-player attackers/targets |
| `DECLARE_BLOCKERS` | Implemented as `ASSIGN_BLOCKER`/`CONFIRM_BLOCKERS` | `combatSystem.js`, UI | Blocker modal | Assignments and legality report |
| `ASSIGN_COMBAT_DAMAGE` | Partial automatic | `combatSystem.js` | Not exposed | Damage assignment order/rules |
| `RESOLVE_STACK_OBJECT` | Implemented as `RESOLVE_TOP_SPELL` | `effectEngine.js` | UI auto-run/manual stack | Stack object ID, choice policy |
| `COUNTER_SPELL` | Partial in spell effects | `effectEngine.js` | Effect parser | Stack target/ref |
| `DESTROY_PERMANENT` | Implemented through `REMOVE_SELECTED` modes | `gameReducer.js` | UI selection | Permanent ID, destruction rules |
| `SACRIFICE_PERMANENT` | Implemented through `REMOVE_SELECTED` modes | `gameReducer.js` | UI selection | Controller and sacrifice cause |
| `EXILE_OBJECT` | Implemented through `REMOVE_SELECTED` modes | `gameReducer.js` | UI selection | Object/zone visibility |
| `RETURN_TO_HAND` | Partial in effects | `effectParser.js`, `effectEngine.js` | Effect-specific | Zone move contract |
| `RETURN_TO_LIBRARY` | Partial in zones/effects | `effectEngine.js` | Effect-specific | Library position/hidden info |
| `MOVE_ZONE` | Partial | reducer/effects | Ad hoc zone moves | From/to zone, visibility |
| `CREW_VEHICLE` | Partial via `TAP_SELECTED_FOR_COST` | reducer/schema/tests | UI selected cards | Vehicle ID, crew sources |
| `SADDLE_MOUNT` | Partial via `TAP_SELECTED_FOR_COST` | reducer/schema/tests | UI selected cards | Mount ID, saddle sources |
| `STATION_PERMANENT` | Partial via `TAP_SELECTED_FOR_COST` | reducer/schema/tests | UI selected cards | Station permanent, progress |
| `UPDATE_MAX_SPEED` | Implemented as `ADVANCE_MAX_SPEED` | reducer/schema/tests | UI selected-card menu | Player/permanent state |
| `ACTIVATE_LOYALTY_ABILITY` | Partial as loyalty adjustment | reducer/schema | UI/manual | Ability ID, once-per-turn rule |
| `APPLY_RULE_WAIVER` | Missing | none | Recovery logs only | Waiver reason, action ref, actor |
| `REVOKE_RULE_WAIVER` | Missing | none | none | Waiver ID and scope |
| `SAVE_GAME` | Implemented as `LOCAL_SAVE_CURRENT` | `saveState.js`, reducer | Profile-local | Shared save-bundle version |
| `LOAD_GAME` | Implemented as `LOCAL_SAVE_LOAD` | `saveState.js`, reducer | Profile-local | Conflict/confirmation/result |
| `SWITCH_INTERFACE_MODE` | Missing | none | Current UI page only | Lite/Advanced mode per player |

## Canonical Event Inventory

| Event | Existing implementation | Current source | Coupling | Future schema needs |
| --- | --- | --- | --- | --- |
| `GAME_CREATED` | Partial | `createGameSession` | Not emitted | Session ID/revision |
| `GAME_STARTED` | Partial | `START_GAME_TRACKING` | Reducer | Start reason/mode |
| `PLAYER_ADDED` | Partial | tournament/sync presence | Non-game-specific | Player identity/seat |
| `LIFE_CHANGED` | Implemented | `eventBus.js`, reducer | Action mapped | Damage/life-loss subtype |
| `COMMANDER_DAMAGE_CHANGED` | Implemented | `eventBus.js`, reducer | Action mapped | Source commander |
| `PHASE_CHANGED` | Implemented | `eventBus.js`, `fsm.js` | Reducer action | Phase/step IDs |
| `PRIORITY_CHANGED` | Partial | `effectEngine.js` priority state | Not explicit event | Priority pass/order metadata |
| `SPELL_CAST` | Implemented | `eventBus.js`, `effectEngine.js` | Stack object state | Cast choices/costs |
| `LAND_PLAYED` | Partial | land entry events | Not distinct | Land-play action versus ETB |
| `PERMANENT_ENTERED` | Implemented as `ENTER_BATTLEFIELD` | `eventBus.js`, reducer | Event bus | From zone, replacement effects |
| `PERMANENT_LEFT_BATTLEFIELD` | Implemented as `LEAVE_BATTLEFIELD` | `eventBus.js` | Action mapped | Destination and cause |
| `SPELL_RESOLVED` | Partial | `effectEngine.js` logs | Not canonical | Stack object result |
| `SPELL_COUNTERED` | Partial | `effectEngine.js` | Effect-specific | Countering source |
| `ABILITY_TRIGGERED` | Implemented through trigger queue | `effectEngine.js` | Queue entry | Trigger ID/repeats |
| `ABILITY_ACTIVATED` | Partial | `eventBus.js` tap action | Generic | Ability ID/costs |
| `STACK_OBJECT_ADDED` | Partial | stack mutation | Not explicit | Stack position |
| `STACK_OBJECT_RESOLVED` | Partial | `resolveTopOfStack` | Not explicit | Result delta |
| `TARGET_SELECTED` | Partial | `SET_SPELL_TARGET` | UI-specific | Target role and legality |
| `MANA_ADDED` | Partial | `ADD_MANA`, land taps | Reducer | Source/permanent/color |
| `MANA_SPENT` | Partial | `planManaPayment` result | Cast-only | Cost payment links |
| `PERMANENT_TAPPED` | Partial | `TOGGLE_TAPPED`, cost taps | Reducer | Cause/cost/effect |
| `PERMANENT_UNTAPPED` | Partial | tap toggle/phase | Reducer | Cause |
| `COUNTER_ADDED` | Implemented | `eventBus.js` | Action mapped | Counter target/source |
| `COUNTER_REMOVED` | Partially declared | `eventBus.js` | Not broadly emitted | Counter target/source |
| `TOKEN_CREATED` | Implemented | `eventBus.js`, effects | Action mapped | Token provenance |
| `ATTACKERS_DECLARED` | Implemented as `ATTACK_DECLARED` | `eventBus.js`, combat | Naming mismatch | Attack target details |
| `BLOCKERS_DECLARED` | Implemented as `BLOCK_DECLARED` | `eventBus.js`, combat | Naming mismatch | Assignments |
| `COMBAT_DAMAGE_DEALT` | Partial | `combatSystem.js` logs | Not evented | Damage assignment details |
| `PLAYER_DAMAGED` | Partial | combat/effects | Not distinct from life | Damage source/type |
| `STATE_BASED_ACTION_PERFORMED` | Missing canonical | scattered removals | Coupled | SBA type/object |
| `RULE_VIOLATION` | Partial as recovery logs | `debugExport.js`, reducer | UI recovery | Violation code/severity |
| `RULE_WAIVED` | Missing | none | none | Waiver ID/action |
| `MANUAL_CHOICE_REQUIRED` | Implemented as pending effects/rules confidence | `effectEngine.js`, `entrySystem.js` | UI panel | Choice schema |
| `SAVE_CREATED` | Partial | `saveState.js` | Not evented | Save metadata |
| `SAVE_LOADED` | Partial | `saveState.js` | Not evented | Loaded revision |
| `INTERFACE_MODE_CHANGED` | Missing | none | none | Lite/Advanced mode |

## Future Shared Game Session Model

Proposed fields:

- `gameId`
- `schemaVersion`
- `rulesEngineVersion`
- `contractVersion`
- `status`
- `format`
- `enforcementMode`
- `activeWaivers`
- `players`
- `playerInterfaceModes`
- `turnState`
- `priorityState`
- `battlefieldState`
- `zoneState`
- `stackState`
- `triggerState`
- `combatState`
- `manaState`
- `continuousEffects`
- `delayedEffects`
- `publicInformation`
- `privateInformationReferences`
- `tournamentReference`
- `revision`
- `createdAt`
- `updatedAt`

Ownership plan:

- Engine-authoritative fields: turn, priority, stack, triggers, combat legality, mana payment, state-based actions, continuous effects, enforcement decisions, waivers.
- Shared-session fields: game ID, players, public state, revision, interface modes, tournament reference, sync metadata.
- Lite presentation fields: compact layout, local quick controls, local UI preferences.
- Advanced presentation fields: battlefield camera/layout, selected panels, overlays, tutorial/helper UI state.
- Deck Nexus references: deck IDs, deck version IDs, commander/card references, owned-card snapshots.
- Hub coordination references: profile IDs, friend/tournament membership, active app links, backups.

## Bridge Adapter Requirements

- BoardState adapter should translate current `profile.activeSession` into the shared session and translate reducer actions into canonical actions.
- Lite adapter should translate compact table inputs into canonical actions and consume engine events/deltas.
- Deck Nexus adapter should provide immutable deck snapshots, card references, commander legality hints, and deck version IDs.
- Hub adapter should coordinate identities, sessions, invites, notifications, backups, and migration status without making rules decisions.

