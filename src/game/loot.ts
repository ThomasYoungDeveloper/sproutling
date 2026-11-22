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
    eggChance: 10,
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
  rainbow: {
    label: 'Rainbow Chest',
    howToEarn: 'A 30-day streak, the top of the Sky Tower, Diamond in ranked, or a lucky Gold chest',
    coins: [500, 1000],
    eggChance: 100,
    eggRarity: { common: 0, uncommon: 0, rare: 0, epic: 75, legendary: 25 },
    itemChance: 100,
  },
};

/** Any Gold chest has this chance to turn into a Rainbow Chest as it opens. */
export const RAINBOW_UPGRADE_CHANCE = 1 / 40;
/** Days of streak for each Rainbow Chest. */
export const RAINBOW_STREAK = 30;

/** Snacks: found in chests and on trips; the yard's Snack button gives your pet one a day (+10% XP). */
export const COLLECTIBLES = ['Ember Cookie', 'Moon Mochi', 'Tide Taffy', 'Star Candy', 'Acorn Biscuit', 'Starlight Drop'];
/** The old trinket names, moved to the snack with the same spot in the list. */
export const OLD_SNACK_NAMES: Record<string, string> = { 'Ember Sticker': 'Ember Cookie', 'Moon Seed': 'Moon Mochi', 'Tide Shell': 'Tide Taffy', 'Star Stamp': 'Star Candy', 'Acorn Charm': 'Acorn Biscuit', 'Starlight Seed': 'Starlight Drop' };

export interface ChestResult {
  coins: number;
  eggRarity: Rarity | null;
  /** The chest had an egg but the basket was full: the egg is waiting for the player to make room. */
  basketFull?: boolean;
  item: string | null;
  /** A dress-up item, if the chest held one (added when opened). */
  cosmetic?: string | null;
  /** Training Crystals in the chest (Gold always, Silver sometimes). */
  crystals?: number;
  /** Potions in the chest (Gold always, Silver sometimes). */
  potions?: { small: number; full: number };
  /** A Gold chest that turned into a Rainbow Chest as it opened. */
  upgraded?: boolean;
  /** A dye from a Rainbow Chest. */
  dye?: import('./types').Skin;
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
