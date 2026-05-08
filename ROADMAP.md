# Board State Roadmap

## Release status

- GitHub Pages release target: `https://haroldh1995.github.io/boardstate/`
- Version target: `v1.0.0`
- Public hosting is prepared for GitHub Actions deployment

## Current foundation

- Tracker and Board State share one mobile-first app shell
- Board State supports Scryfall search/import, compact battlefield tracking, removal, combat helpers, and pseudo-multiplayer viewing
- Automation suggestions use Scryfall oracle text, Scryfall rulings, and curated official rules-reference categories

## Next likely upgrades

- Replace remaining prompt-based manual flows with in-app forms/modals
- Expand official-rules-backed automation coverage for more supported permanent patterns
- Improve per-card attachment relationships for equipment and aura targeting
- Add stronger combat automation review UI and clearer post-resolution summaries
- Expand automation logs with richer "why did this trigger?" drill-down details

## Networking direction

- Same-WiFi multiplayer via WebRTC peers plus optional lightweight signaling
- Web Bluetooth support where browsers and devices expose a safe API
- Better connected-player sync and conflict handling for local tables

## Rules direction

- Safer parsing for official permanents only
- Broader use of rulings to lower false positives
- More granular Commander-aware rules references
- Continued avoidance of full stack, hidden-zone, and full combat-damage simulation unless explicitly designed later
