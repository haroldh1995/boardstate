# BoardState Release Checklist

## Version

- `v1.0.0`

## Release title

- `BoardState v1.0.0`

## Release notes draft

- Initial public release of BoardState
- Mobile-first Tracker page for Commander life, tax, mana, counters, and commander damage
- Board State page with battlefield tracking, Scryfall search/import, token support, and rules-aware automation helpers
- Combat helpers, tap/untap support, and public GitHub Pages hosting setup
- Effect-engine release pass for non-creature permanents, attachments, broad counter targets, manual pending effects, and instant/sorcery spell tracking

## Pre-release checks

- `npm install`
- `npm run dev`
- `npm run build`
- `npm audit --omit=dev`
- GitHub Actions Pages deployment enabled
- README reviewed
- MIT License included

## Native/EAS note

- This repository is currently a Vite web/PWA build. Web and GitHub Pages release are supported directly.
- Do not add placeholder `eas.json`/Expo files unless the project is actually wrapped in Expo; fake EAS config would make Android/iOS release builds fail.
- For native store builds, create an Expo/Capacitor wrapper around the existing production web app as a separate packaging layer while preserving this web release as the source of truth.
