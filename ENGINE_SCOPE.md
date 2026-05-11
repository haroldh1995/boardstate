# BoardState Engine Scope

BoardState simulates battlefield-visible gameplay.

In scope:
- permanents
- tokens
- counters
- static buffs
- ETB triggers
- death/sacrifice/exile triggers
- attack/combat triggers
- phase triggers
- commander damage
- public multiplayer events
- action history
- autosave
- manual confirmations

Out of scope for now:
- visible hand
- visible deck
- visible graveyard browser
- visible exile browser
- full stack UI
- full tournament simulator
- shared global game table

All new systems must adapt to the current app structure:
- `index.html`
- `styles.css`
- `script.js`
- `/automation`
- `/multiplayer`
