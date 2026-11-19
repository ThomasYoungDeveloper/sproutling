import type { ChestKind, GameState } from './types';
import { grantChest, grantRainbow, todayKey } from './actions';
import { grantCosmetic } from './cosmetics';

/** Ranked battle tiers. A season is one calendar month. */
export const TIERS = [
  { id: 'bronze', name: 'Bronze', emoji: '🥉', min: 0, color: '#B87333', coins: 50, chest: null as ChestKind | null },
  { id: 'silver', name: 'Silver', emoji: '🥈', min: 100, color: '#9AA5B1', coins: 100, chest: 'bronze' as ChestKind },
  { id: 'gold', name: 'Gold', emoji: '🥇', min: 250, color: '#E3A81E', coins: 150, chest: 'silver' as ChestKind },
  { id: 'platinum', name: 'Platinum', emoji: '💠', min: 500, color: '#3FB8C9', coins: 200, chest: 'gold' as ChestKind },
  { id: 'diamond', name: 'Diamond', emoji: '💎', min: 900, color: '#5B8DEF', coins: 300, chest: 'rainbow' as ChestKind },
  { id: 'legend', name: 'Legend', emoji: '👑', min: 1500, color: '#A05BE0', coins: 500, chest: 'rainbow' as ChestKind },
] as const;
export type Tier = (typeof TIERS)[number];

export const RANKED_POINTS = { friendWin: 20, friendLoss: -8, wildWin: 5, perFriendPerDay: 3, wildPerDay: 5 };

export function tierFor(points: number): Tier {
  let t: Tier = TIERS[0];
  for (const x of TIERS) if (points >= x.min) t = x;
  return t;
}

/** Progress toward the next tier (1 at Legend). */
export function tierProgress(points: number): { next: Tier | null; frac: number; need: number } {
  const i = TIERS.indexOf(tierFor(points));
  const next = TIERS[i + 1] ?? null;
  if (!next) return { next: null, frac: 1, need: 0 };
  const cur = TIERS[i];
  return { next, frac: (points - cur.min) / (next.min - cur.min), need: next.min - points };
}

/** Days left in the current season (month), counting today. */
export function seasonDaysLeft(now = new Date()): number {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return Math.max(1, Math.ceil((end - now.getTime()) / 86400000));
}

export function seasonName(season: string): string {
  const d = new Date(season + 'T12:00:00Z');
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) + ' season';
}

/** The end-of-season reward for finishing with these points. Legends also get the Champion Laurel. */
export function seasonReward(s: GameState, points: number): { state: GameState; tier: Tier } {
  const tier = tierFor(points);
  let next: GameState = { ...s, coins: s.coins + tier.coins };
  if (tier.chest === 'rainbow') next = grantRainbow(next, 'ranked', todayKey(s).slice(0, 7), `${tier.name} season reward`).state;
  else if (tier.chest) next = grantChest(next, tier.chest, `${tier.name} season reward`);
  if (tier.id === 'legend') next = grantCosmetic(next, 'trophy');
  return { state: next, tier };
}
