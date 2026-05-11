# Repo Audit Notes

PR #6 is currently only a placeholder with one added line, so there is no real update code inside that PR yet.

The real app is currently a vanilla Vite app. The existing `index.html` contains the correct old Life Tracker and Board State structure. The existing `styles.css` contains the correct dragon background and transparent glass-panel styling.

The compiled update files were adjusted from React/TypeScript-style packages into vanilla ES modules that can be imported from `script.js`.

Protected files:
- `styles.css`
- `index.html`
- `/assets/dragon-background.png`
- `/assets/planeswalker-symbol.png`

Do not paste the earlier React component files directly into the repo.
Use the adjusted vanilla modules in `src/boardstate-upgrades/`.
