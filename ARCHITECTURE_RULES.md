# BoardState Architecture Rules

BoardState is a battlefield-centric MTG authority assistant, not a shared-table simulator.

Core rules:
- Preserve the current visual app shell.
- Preserve the purple dragon background.
- Preserve transparent purple/black glass panels.
- Preserve the compact Life Tracker and Board State layouts.
- Add new systems through existing dialogs, Game Options, overlays, action menus, or background engines.
- Do not replace `index.html` layout.
- Do not rewrite `styles.css` globally.
- Do not replace `script.js`; migrate carefully in stages.
- Scryfall search replaces hand/deck/graveyard/exile UI.
- Hidden-zone effects become manual confirmations.
- Deterministic battlefield-visible effects may auto-resolve.
- Ambiguous, may, target, political, or hidden-information effects ask first.
