# BoardState Architecture Rules

## Core Identity

BoardState is a battlefield-centric MTG authority assistant.

BoardState is not:
- a shared-table simulator
- a Cockatrice clone
- an XMage clone
- a Forge clone
- a full hidden-zone simulator
- a desktop-style MTG client

BoardState is:
- local-player-authority-first
- battlefield-first
- mobile-first
- Commander-focused
- deterministic where safe
- manual-confirmation-based where needed
- multiplayer through public event synchronization
- visually clean and single-player-feeling

## Core Architecture

BoardState should be structured as:

1. UI Layer
2. Battlefield State Layer
3. Rules Engine Layer
4. Automation Layer
5. Multiplayer Sync Layer
6. Storage / Replay Layer

Each system should be modular and avoid large monolithic files.

## Hidden Zone Philosophy

BoardState does not need visible:
- hand
- library/deck
- graveyard
- exile zone

Scryfall search/import replaces those zones.

If an effect depends on hidden or unavailable information, the app should ask the user to confirm the condition and then generate only the battlefield-visible result.

## Automation Philosophy

Safe deterministic effects may auto-resolve.

Examples:
- token creation
- +1/+1 counters
- battlefield-visible ETB triggers
- death triggers
- attack triggers
- upkeep/end-step triggers
- static buffs
- replacement effects

Ambiguous effects should ask first.

Examples:
- may effects
- target choices
- political choices
- hidden-zone choices
- opponent choices
- effects with unclear parsing

Unsupported effects become manual rules actions.

## Multiplayer Philosophy

Each player owns their own battlefield.

The app should sync:
- public battlefield events
- combat declarations
- combat results
- life changes
- commander damage
- public token/counter changes
- confirmed trigger outcomes

The app should not sync:
- hands
- deck order
- hidden searches
- private notes
- unrevealed face-down cards
- full private game state

## Permanent Rule

Do not add systems that damage the single-player feel.
