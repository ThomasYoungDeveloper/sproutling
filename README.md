# Sproutling

A social, health-powered pet game. Healthy habits earn XP, eggs hatch as you walk, and chests are earned (never sold).

Built with Expo (React Native + TypeScript): one codebase for web now, iPhone and Android later.

## Run it

```bash
npm install
npm run web        # opens the web app
npx tsx scripts/check-game.ts   # checks the game rules
```

## Layout

- `src/game/` – pure game rules (species, rarity, loot tables, scoring, actions). No UI, so the same logic can run on a server later to verify progress.
- `src/state/` – saved game state (browser storage for now; Supabase later).
- `src/components/` – pet, egg and UI pieces. `PetSprite` is placeholder art meant to be swapped for purchased sprites.
- `src/screens/` – Home, Eggs, Chests, Pets.

## Status

Preview build: habits are entered by hand on the web. Verified data from Apple Health / Health Connect comes with the phone apps.
