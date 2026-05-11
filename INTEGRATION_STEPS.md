# BoardState Vanilla Repo Integration Steps

Your repo is a vanilla Vite app using:
- `index.html`
- `styles.css`
- `script.js`
- `/automation`
- `/multiplayer`

Do not paste React/TypeScript files into it directly.

## Step 1: Add docs and modules

Copy these into the repo root:
- `ARCHITECTURE_RULES.md`
- `UI_PRESERVATION_RULES.md`
- `ENGINE_SCOPE.md`
- `MULTIPLAYER_AUTHORITY_RULES.md`
- `src/boardstate-upgrades/`

Do not edit existing layout yet.

## Step 2: Import safe CSS

In `index.html`, under the existing `styles.css` link, add:

```html
<link rel="stylesheet" href="./src/boardstate-upgrades/visualSafeAdditions.css" />
```

## Step 3: Import upgrade helpers carefully

At the top of `script.js`, add:

```js
import * as BoardStateUpgrades from "./src/boardstate-upgrades/boardstateUpgrades.js";
```

Do not call anything yet. Run build first.

## Step 4: Extend state safely

Inside `createDefaultState()`, add these fields:

```js
trackerMultiplier: 1,
actionHistory: BoardStateUpgrades.createActionHistoryState(),
archive: BoardStateUpgrades.createDefaultArchiveState(),
stats: BoardStateUpgrades.createDefaultStatsProfile("Player 1"),
turnTimer: BoardStateUpgrades.createTurnTimerState(),
combatRecommendationSettings: BoardStateUpgrades.DEFAULT_COMBAT_RECOMMENDATION_SETTINGS,
rulesRegistry: BoardStateUpgrades.createDefaultRulesRegistry(),
```

## Step 5: Integrate one feature at a time

Recommended order:
1. viewport lock
2. life multiplier
3. archive storage
4. action history/autosave
5. virtual play choices
6. stats timer
7. multiplayer authority helpers
8. advanced combat toggles

Do not integrate all features in one commit.
