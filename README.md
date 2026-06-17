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
- Options command center with focused Profile, Gameplay, Tournament, Notifications, HUD, Accessibility, Diagnostics, Data Management, and About panels.
- Local Commander tournament hosting/joining with pinned tournament panels, invite links, full-window alerts, standings, pods, 1v1 rotation, and separate tournament sync.
- Notification preferences with popup/toast controls plus browser-safe sound and haptic hooks where supported.
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

## Android Studio Wrapper

The repo includes a full Android Studio wrapper at:

```text
android-app/
```

Clone and build without additional coding:

```bash
npm install
npm run android:build:all
```

Outputs:

- `android-app/app/build/outputs/apk/debug/app-debug.apk`
- `android-app/app/build/outputs/apk/release/app-release.apk`
- `android-app/app/build/outputs/bundle/release/app-release.aab`

Open `android-app/README.md` for full Android Studio + Play upload steps.

## Hosting

This app is configured for GitHub Pages at:

```text
https://YOUR_GITHUB_USERNAME.github.io/boardstate/
```

Update `vite.config.mjs` if the repository name changes.

## Disclaimer

BoardState is a gameplay assistant for paper Magic. It is not a tournament rules authority, not MTG Arena, and not affiliated with Wizards of the Coast. Magic: The Gathering card data belongs to its respective owners. Scryfall data is used through Scryfall's public API when online.
