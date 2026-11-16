import type { ChestKind, Rarity } from './types';
import { pickOne, pickWeighted, randInt, type Rng, defaultRng } from './random';

/**
 * Chests are EARNED through activity only, never sold for real money.
 * Odds are shown to players anyway (see oddsFor).
 */
export interface ChestTable {
  label: string;
  howToEarn: string;
  coins: [number, number];
  /** Percent chance the chest contains an egg. */
  eggChance: number;
  /** Rarity weights for the egg, in percent. */
  eggRarity: Record<Rarity, number>;
  /** Percent chance of a bonus collectible item. */
  itemChance: number;
}

export const CHESTS: Record<ChestKind, ChestTable> = {
  bronze: {
    label: 'Bronze chest',
    howToEarn: 'Finish all 3 daily quests',
    coins: [20, 40],
    eggChance: 35,
    eggRarity: { common: 60, uncommon: 28, rare: 10, epic: 2, legendary: 0 },
    itemChance: 50,
  },
  silver: {
    label: 'Silver chest',
    howToEarn: 'Every 7-day streak',
    coins: [60, 100],
    eggChance: 100,
    eggRarity: { common: 40, uncommon: 35, rare: 18, epic: 6, legendary: 1 },
    itemChance: 75,
  },
  gold: {
    label: 'Gold chest',
    howToEarn: 'Beat a weekly guild raid',
    coins: [150, 250],
    eggChance: 100,
    eggRarity: { common: 15, uncommon: 35, rare: 33, epic: 14, legendary: 3 },
    itemChance: 100,
  },
};

export const COLLECTIBLES = ['Ember Sticker', 'Moon Seed', 'Tide Shell', 'Star Stamp', 'Acorn Charm', 'Starlight Seed'];

export interface ChestResult {
  coins: number;
  eggRarity: Rarity | null;
  item: string | null;
  /** A dress-up item, if the chest held one (added when opened). */
  cosmetic?: string | null;
}

export function openChest(kind: ChestKind, rng: Rng = defaultRng): ChestResult {
  const t = CHESTS[kind];
  const coins = randInt(t.coins[0], t.coins[1], rng);
  const eggRarity = rng() * 100 < t.eggChance ? pickWeighted(t.eggRarity, rng) : null;
  const item = rng() * 100 < t.itemChance ? pickOne(COLLECTIBLES, rng) : null;
  return { coins, eggRarity, item };
}

/** Overall chance (percent) of getting an egg of each rarity from one chest. */
export function oddsFor(kind: ChestKind): Record<Rarity, number> {
  const t = CHESTS[kind];
  const out = {} as Record<Rarity, number>;
  (Object.keys(t.eggRarity) as Rarity[]).forEach((r) => {
    out[r] = Math.round(((t.eggChance * t.eggRarity[r]) / 100) * 10) / 10;
  });
  return out;
}
