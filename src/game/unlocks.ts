import type { GameState } from './types';
import { levelFor, xpForLevel } from './scoring';

/**
 * The unlock plan: the core game is open from level 1, and the rest opens one thing at a time
 * as your highest pet levels up, so new players aren't hit with everything at once.
 * Players who started before this keep everything open.
 */

export type Feature = 'shop' | 'trips' | 'battles' | 'guild' | 'tower' | 'breeding';

export interface FeatureInfo {
  id: Feature;
  level: number;
  name: string;
  /** Shown on the "now open" card. */
  title: string;
  text: string;
  /** Where to find it, for the card's button. */
  go: 'home' | 'friends' | 'dex' | 'shop';
}

export const FEATURES: FeatureInfo[] = [
  { id: 'shop', level: 2, name: 'Shops', title: 'The shops are open!', text: 'Spend coins at the Food Market and General Store. Food boosts your pet’s stats; outfits are just for fun.', go: 'shop' },
  { id: 'trips', level: 3, name: 'Trips', title: 'Trips are open!', text: 'Send a pet exploring. It brings back coins and items, and walking brings it home sooner.', go: 'home' },
  { id: 'battles', level: 4, name: 'Battles', title: 'Battles are open!', text: 'Practice battles, wild pets on your walks, and potions to heal. Find them under Social › Battle.', go: 'friends' },
  { id: 'guild', level: 5, name: 'Guilds', title: 'Guilds are open!', text: 'Join or start a guild. Walk together to beat the weekly guild boss and earn chests.', go: 'friends' },
  { id: 'tower', level: 6, name: 'Sky Tower', title: 'The Sky Tower is open!', text: 'A new 10-floor climb every week, with a blessing to pick after each floor.', go: 'friends' },
  { id: 'breeding', level: 8, name: 'Nursery and power-ups', title: 'The Nursery is open!', text: 'Breed two pets for a stronger egg, and power pets up with Training Crystals or a spare copy.', go: 'dex' },
];
export const FEATURE_BY_ID = Object.fromEntries(FEATURES.map((f) => [f.id, f])) as Record<Feature, FeatureInfo>;

/** Your highest pet's level. */
export const topLevel = (s: GameState) => s.pets.reduce((m, p) => Math.max(m, levelFor(p.xp)), 1);
/** XP your best pet still needs to reach a level. */
export const xpToLevel = (s: GameState, level: number) => Math.max(0, xpForLevel(level) - s.pets.reduce((m, p) => Math.max(m, p.xp), 0));

export const allOpen = (s: GameState) => !s.onboard || !!s.onboard.legacy;

export function unlocked(s: GameState, f: Feature): boolean {
  return allOpen(s) || topLevel(s) >= FEATURE_BY_ID[f].level;
}

/** The next thing that will open, if any. */
export function nextUnlock(s: GameState): FeatureInfo | undefined {
  if (allOpen(s)) return undefined;
  return FEATURES.find((f) => !unlocked(s, f.id));
}

/** A feature that just opened and hasn't had its card shown yet. */
export function newUnlock(s: GameState): FeatureInfo | undefined {
  if (allOpen(s)) return undefined;
  const seen = new Set(s.onboard?.seen ?? []);
  return FEATURES.find((f) => unlocked(s, f.id) && !seen.has(f.id));
}

export const markSeen = (s: GameState, f: Feature): GameState => ({
  ...s,
  onboard: { ...s.onboard, seen: [...new Set([...(s.onboard?.seen ?? []), f])] },
});

/** "Opens at level 3" for locked spots. */
export const lockedText = (f: Feature) => `Opens when a pet reaches level ${FEATURE_BY_ID[f].level}`;
