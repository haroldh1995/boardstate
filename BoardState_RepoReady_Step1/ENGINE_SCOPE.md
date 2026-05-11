# BoardState Engine Scope

## What BoardState Simulates

BoardState focuses on battlefield-visible gameplay.

Supported engine focus:
- permanents on the battlefield
- tokens
- counters
- static buffs
- replacement effects
- ETB triggers
- attack triggers
- death triggers
- sacrifice triggers
- exile triggers
- upkeep triggers
- end-step triggers
- combat declarations
- commander combat damage
- public multiplayer combat results

## What BoardState Does Not Fully Simulate Yet

BoardState should not fully simulate:
- hand contents
- deck order
- full graveyard browsing
- exile-zone browsing
- full spell stack
- full priority passing
- full tournament-level rules enforcement
- complete game-state replication

## Hidden Zone Replacement

Scryfall search/import replaces hidden-zone selection.

Examples:
- If a card would be played from hand, search/import it.
- If a card would be returned from graveyard, search/import it and confirm the condition.
- If a card would be found from deck, search/import it and confirm the condition.
- If a card would be cast from exile, search/import it and confirm the condition.

## Rules Confidence Levels

Every automated action should be classified as:

1. Safe Auto-Resolve
2. Ask First
3. Manual Only

## Safe Auto-Resolve

Use for deterministic battlefield-visible effects.

## Ask First

Use for:
- may effects
- target choices
- opponent choices
- political choices
- uncertain parsing

## Manual Only

Use for:
- hidden zones
- unknown game information
- unsupported effects
- unclear card text
- unusual rulings

## Future Expansion

Future systems should remain dormant until needed:
- stack engine
- dependency layers
- full replacement layering
- multiplayer combat arbitration
- deeper state-based actions
