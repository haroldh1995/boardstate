# BoardState Multiplayer Authority Rules

Each player owns their own battlefield.

Sync only:
- public permanents
- public counters/tokens
- public phase changes
- combat declarations/results
- life changes
- commander damage
- confirmed trigger outcomes

Never sync:
- hands
- deck order
- private notes
- hidden-zone searches
- unrevealed face-down identities

Combat needs involved-player confirmation. Confirmed public actions should be locked from undo.
