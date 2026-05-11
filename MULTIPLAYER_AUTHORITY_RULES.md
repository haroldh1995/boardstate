# BoardState Multiplayer Authority Rules

## Core Rule

Each player owns their own battlefield.

BoardState multiplayer should feel like a single-player app with connected public events, not like a shared-table simulator.

## Local Authority

Each device is authoritative over:
- its own battlefield
- its own life total
- its own commander damage taken
- its own tokens
- its own counters
- its own triggers
- its own archives
- its own stats

## Public Sync

Only public information should sync.

Sync:
- public battlefield permanents
- public token/counter changes
- combat declarations
- combat results
- commander damage
- life total changes
- confirmed trigger outcomes
- public phase changes

Do not sync:
- hands
- deck order
- private notes
- hidden-zone searches
- hidden identities of face-down cards
- private action planning

## Combat Authority

Combat requires involved-player confirmation.

For combat:
- attacker declares combat intent
- defending player confirms public blockers/responses
- app calculates deterministic results
- involved players confirm resolution
- confirmed actions become locked

## Undo Rule

Actions not yet publicly confirmed may be undone.

Actions confirmed by multiplayer combat or public sync should become locked.

## Conflict Rule

If devices disagree:
- board owner controls their own board
- combat damage requires involved-player agreement
- unresolved conflicts should open a transparent conflict resolution panel
- manual override should be allowed and logged

## UI Rule

Opponent boards should not appear unless necessary.

Use:
- temporary combat overlays
- public board snapshots
- small status indicators
- optional board comparison panels

Avoid:
- permanent shared-table view
- always-visible opponent boards
- full multiplayer table UI
