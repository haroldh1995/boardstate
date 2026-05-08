# BoardState

BoardState is a mobile-first Magic: The Gathering Commander companion app built for quick in-game tracking on phones, tablets, and desktops.

It combines:

- a polished life tracker
- a compact Board State battlefield view
- Scryfall-powered card and token import
- rules-aware automation helpers for supported permanent-based effects
- local-only multiplayer preview tools for table-side viewing

BoardState is an MTG companion assistant, not a full official rules simulator.

## Features

- Single-screen Commander life tracking
- Custom player names
- Commander damage, tax, mana, and player counters
- Board State battlefield with creature and NCP tracking
- Scryfall search and import for official cards and supported tokens
- Scryfall rulings-aware automation suggestions
- Combat helpers, tap/untap tracking, and phase progression
- Simulated local multiplayer read-only views
- Local storage persistence

  BOARDSTATE QUICK OPERATING GUIDE

APP LINK
https://haroldh1995.github.io/boardstate/

1) NAVIGATION
- Use the left/right arrows (or swipe) to switch between:
  - Life Tracker
  - Board State

2) FIRST-TIME SETUP (1 minute)
- Tap Game Options.
- Tap Edit Player Names to set your player/opponent names.
- In Player Counters, toggle Poison / Energy / Experience / Tickets as needed.
- In Commander Damage, set number of opponent trackers.
- Close Game Options.

3) LIFE TRACKER PAGE (during game)
- Center box:
  - Tap + / - to change Life Total.
- Side boxes:
  - Tax: track commander tax.
  - Damage: open opponent commander damage trackers.
  - Mana: track floating mana.
  - Counters: open counter tray for enabled counters.
- Bottom labels:
  - “Life Tracker” is your current page.
  - “Game Options” opens settings anytime.

4) BOARD STATE PAGE (adding cards/permanents)
- Use Scryfall Search box:
  - Type card name.
  - Tap Search.
  - Pick a result.
- Add behavior:
  - Creature / Artifact Creature -> goes to Battlefield.
  - Non-creature permanent -> goes to NCP section.
  - Token result -> adds as token.
- If needed, use Manual Add after selecting a result.
- Use Cancel to clear search and close results instantly.

5) PHASE + COMBAT FLOW
- Tap Next Phase to cycle turn phases.
- In Combat, use Combat Simulation:
  - Attack with Selected
  - Attack with All Creatures
  - Confirm Combat (runs supported combat automation)
  - Clear Attackers

6) BATTLEFIELD ACTIONS
- Tap a permanent to select/deselect.
- Use Show P/T to show/hide total power/toughness overlay.
- Use Remove All for mass removal options.
- Use permanent details/menus for individual actions like destroy/exile/sacrifice.
- NCP row is for non-creature permanents on board.

7) AUTOMATION
- Automation is enabled by default.
- Open Game Options -> Automation Rules to manage behavior.
- High-confidence effects can auto-run.
- Lower-confidence/ambiguous effects ask for confirmation.
- Use Undo Last Automation if needed.

8) MULTIPLAYER (LOCAL PREVIEW)
- Game Options -> Multiplayer.
- Use Simulated Local Connection to test connected-player views.

------------------------------------------------------------
BOARDSTATE FOR ADHD (30-SECOND VERSION)

Think of the app as 2 screens:
- Life Tracker = your life/counters/commander damage math.
- Board State = your battlefield and turn/combat helper.

You update life on Tracker.
You add cards and run combat on Board State.
Next Phase moves the turn forward.
Automation helps with tokens/counters when rules are clear.
If rules are unclear, the app asks before doing anything risky.


## Scryfall Note

BoardState uses the public [Scryfall API](https://api.scryfall.com/cards/search?q=) for card search and rulings lookup.

- No API key is required
- Official Scryfall data is used where available
- Manual/custom cards can still be tracked, but they do not receive automatic official-rules parsing

## Disclaimer

BoardState references Scryfall card data, Scryfall rulings, and selected official MTG rules categories where available, but it is intentionally conservative.

- It is not a full tournament rules engine
- It does not simulate the full stack, hidden zones, or full combat damage assignment
- Ambiguous effects require confirmation or manual handling

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

3. Open the local URL shown by Vite.

## Production Build

Build the app with:

```bash
npm run build
```

Preview the production build locally with:

```bash
npm run preview
```

## GitHub Pages Hosting

This repository is configured for GitHub Pages deployment from GitHub Actions.

Expected live URL:

[https://haroldh1995.github.io/boardstate/](https://haroldh1995.github.io/boardstate/)

If you publish under a different account or rename the repository, update:

- `vite.config.mjs`
- this README
- the GitHub remote URL you push to

## Deployment Workflow

The repository includes:

- Vite base path configured for `/boardstate/`
- a GitHub Actions workflow at `.github/workflows/deploy.yml`
- MIT licensing for public release

## Manual GitHub Publish

If you are publishing from a fresh local clone or a folder that is not yet a Git repository, use:

```bash
git init
git add .
git commit -m "Official BoardState release"
git branch -M main
git remote add origin https://github.com/haroldh1995/boardstate.git
git push -u origin main
```

## GitHub Pages Setup

1. Create a GitHub repository named `boardstate`
2. Push this project to the `main` branch
3. Open the repository on GitHub
4. Go to `Settings`
5. Go to `Pages`
6. Set `Source` to `GitHub Actions`
7. Wait for the `Deploy to GitHub Pages` workflow to finish
8. Open the live site at:

[https://haroldh1995.github.io/boardstate/](https://haroldh1995.github.io/boardstate/)

## Public URL Placeholder

Public URL format:

`https://YOUR_GITHUB_USERNAME.github.io/boardstate/`

For this release, the expected account-specific URL is:

`https://haroldh1995.github.io/boardstate/`
