# BoardState

BoardState is a local-first Magic: The Gathering battlefield companion rebuilt as a layered production-ready web app.

It works offline for gameplay, stores profile data locally, and treats Scryfall as an optional online card lookup layer rather than a gameplay dependency.

## Core Systems

- Life tracking, poison/energy/commander counters, and undo history.
- Board-state tracking for creatures, artifacts, enchantments, auras, equipment, planeswalkers, lands, tokens, instants, and sorceries.
- Event-driven effect engine with static buffs, ETB/phase/combat triggers, counters, token creation, and broad target groups.
- Aura and Equipment attachment logic with live stat/keyword recalculation.
- Combat assistant with attacker selection, blocker assignment, trample-aware estimates, and damage logs.
- Commander profiles, commander damage, commander decks, card usage, legality/color identity checks, archives, analytics, and local leaderboards.
- Floating mana tracker with phase clearing.
- Export/import full local player profiles as JSON.

## Local-First Design

All gameplay state is stored locally with IndexedDB first and localStorage fallback. Scryfall search is optional and only improves card import speed.

## Setup

```bash
npm install
npm run dev
```

## Build

```bash
npm run test
npm run build
```

## Hosting

This app is configured for GitHub Pages at:

```text
https://YOUR_GITHUB_USERNAME.github.io/boardstate/
```

Update `vite.config.mjs` if the repository name changes.

## Disclaimer

BoardState is a gameplay assistant for paper Magic. It is not a tournament rules authority, not MTG Arena, and not affiliated with Wizards of the Coast. Magic: The Gathering card data belongs to its respective owners. Scryfall data is used through Scryfall's public API when online.
