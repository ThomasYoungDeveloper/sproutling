import type { ChestKind, DayLog, GameState } from './types';
import { SPECIES } from './species';
import { scoreDay } from './scoring';
import { totalSteps } from './expedition';
import { grantCosmetic } from './cosmetics';
import * as A from './actions';

/**
 * Badges: 16 of them, each with five tiers (Wooden, Bronze, Silver, Gold, Rainbow) that need more of the same thing.
 * Tiers are worked out from the save, so anything already done counts. badgeTiers records the tiers already
 * rewarded; a newly reached tier waits there for its tier-up moment and reward.
 */
export type TierName = 'wooden' | 'bronze' | 'silver' | 'gold' | 'rainbow';
export const TIERS: { id: TierName; label: string }[] = [
  { id: 'wooden', label: 'Wooden' },
  { id: 'bronze', label: 'Bronze' },
  { id: 'silver', label: 'Silver' },
  { id: 'gold', label: 'Gold' },
  { id: 'rainbow', label: 'Rainbow' },
];
export const TIER_REWARD: { coins?: number; chest?: ChestKind }[] = [{ coins: 50 }, { chest: 'bronze' }, { chest: 'silver' }, { chest: 'gold' }, { chest: 'rainbow' }];

export interface Badge {
  id: string;
  name: string;
  icon: string;
  what: string;
  steps: [number, number, number, number, number];
  value: (s: GameState) => number;
  unit?: (n: number) => string;
}

const days = (s: GameState) => Object.values(s.days ?? {}) as DayLog[];
function longestStreak(s: GameState): number {
  const keys = Object.keys(s.days ?? {}).sort();
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const k of keys) {
    const d = s.days[k];
    const t = Date.parse(k + 'T12:00:00Z');
    if (!(d.shielded || scoreDay(d).total >= 50)) {
      run = 0;
      prev = t;
      continue;
    }
    run = prev !== null && Math.round((t - prev) / 86_400_000) === 1 ? run + 1 : 1;
    prev = t;
    best = Math.max(best, run);
  }
  return Math.max(best, A.streak(s));
}
const big = (n: number) => (n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${Math.round(n / 1000)}K` : n.toLocaleString());

export const BADGES: Badge[] = [
  { id: 'walker', name: 'Walker', icon: 'walk', what: 'Total steps', steps: [10_000, 100_000, 500_000, 1_000_000, 5_000_000], value: totalSteps, unit: big },
  { id: 'eggs', name: 'Egg Whisperer', icon: 'egg', what: 'Eggs hatched', steps: [5, 25, 100, 250, 500], value: (s) => s.stats?.hatched ?? 0 },
  { id: 'collector', name: 'Collector', icon: 'book', what: 'Pet kinds found', steps: [10, 25, 50, 75, SPECIES.length], value: (s) => Object.keys(s.dex).length },
  { id: 'streak', name: 'Streak Keeper', icon: 'flame', what: 'Best streak (days)', steps: [3, 7, 30, 100, 365], value: longestStreak },
  { id: 'water', name: 'Hydrated', icon: 'drop', what: 'Days at your water goal', steps: [10, 50, 100, 250, 500], value: (s) => days(s).filter((d) => d.water > 0 && d.water >= (d.waterGoal ?? 8)).length },
  { id: 'sleep', name: 'Well Rested', icon: 'moon', what: 'Nights with 7+ hours', steps: [10, 50, 100, 250, 500], value: (s) => days(s).filter((d) => d.sleepHours >= 7).length },
  { id: 'battler', name: 'Battler', icon: 'sword', what: 'Battles won', steps: [10, 50, 150, 400, 1000], value: (s) => s.battle?.wins ?? 0 },
  { id: 'explorer', name: 'Explorer', icon: 'map', what: 'Trips finished', steps: [10, 50, 150, 400, 1000], value: (s) => s.stats?.expeditions ?? 0 },
  { id: 'gifts', name: 'Gift Giver', icon: 'gift', what: 'Gifts sent to friends', steps: [10, 50, 150, 400, 1000], value: (s) => s.stats?.gifts ?? 0 },
  { id: 'trader', name: 'Trader', icon: 'swap', what: 'Trades finished', steps: [5, 25, 75, 200, 500], value: (s) => Object.keys(s.appliedTrades ?? {}).length },
  { id: 'cheer', name: 'Cheerleader', icon: 'cheer', what: 'Reactions on friends’ and guild moments', steps: [10, 50, 150, 400, 1000], value: (s) => s.stats?.reactions ?? 0 },
  { id: 'boss', name: 'Boss Slayer', icon: 'shield', what: 'Guild bosses beaten', steps: [1, 5, 15, 40, 100], value: (s) => s.stats?.bosses ?? 0 },
  { id: 'nursery', name: 'Nursery', icon: 'nest', what: 'Eggs made in the Nursery', steps: [5, 25, 75, 200, 500], value: (s) => s.stats?.bred ?? 0 },
  { id: 'fashion', name: 'Fashionista', icon: 'hat', what: 'Dress-up items owned', steps: [5, 15, 30, 50, 80], value: (s) => Object.keys(s.wardrobe ?? {}).length },
  { id: 'chests', name: 'Treasure Hunter', icon: 'chest', what: 'Chests opened', steps: [10, 50, 150, 400, 1000], value: (s) => s.stats?.chests ?? 0 },
  { id: 'shiny', name: 'Shiny Hunter', icon: 'star', what: 'Shiny pets found', steps: [1, 3, 10, 25, 50], value: (s) => Math.max(s.stats?.shinies ?? 0, s.pets.filter((p) => p.shiny).length) },
];
export const BADGE_BY_ID: Record<string, Badge> = Object.fromEntries(BADGES.map((b) => [b.id, b]));
export const fmt = (b: Badge, n: number) => (b.unit ? b.unit(n) : n.toLocaleString());

/** Tier reached by doing (0 = none yet, 1 Wooden … 5 Rainbow). */
export const reachedTier = (b: Badge, v: number) => b.steps.filter((t) => v >= t).length;

export interface BadgeStatus {
  b: Badge;
  value: number;
  tier: number;
  claimed: number;
  next?: number;
}
export function badgeStatus(s: GameState): BadgeStatus[] {
  return BADGES.map((b) => {
    const value = b.value(s);
    const tier = reachedTier(b, value);
    return { b, value, tier, claimed: Math.min(tier, s.badgeTiers?.[b.id] ?? 0), next: b.steps[tier] };
  });
}
export const tiersEarned = (s: GameState) => badgeStatus(s).reduce((n, x) => n + x.tier, 0);
/** The next tier-up waiting for its moment, if any. */
export const pendingTierUp = (s: GameState) => badgeStatus(s).find((x) => x.tier > x.claimed);

/**
 * First time badges arrive: everything already reached counts as earned without a pile of rewards at once
 * (old achievement rewards were already paid).
 */
export function ensureBadges(s: GameState): GameState {
  if (s.badgeTiers) return s;
  const badgeTiers: Record<string, number> = {};
  for (const x of badgeStatus(s)) if (x.tier) badgeTiers[x.b.id] = x.tier;
  const showcase = badgeStatus(s)
    .filter((x) => x.tier)
    .sort((a, b) => b.tier - a.tier)
    .slice(0, 3)
    .map((x) => x.b.id);
  return { ...s, badgeTiers, showcase };
}

/** Pays the next waiting tier for a badge (one tier at a time, so each gets its moment). */
export function claimTier(s: GameState, id: string): GameState {
  const b = BADGE_BY_ID[id];
  if (!b) return s;
  const have = s.badgeTiers?.[id] ?? 0;
  const tier = reachedTier(b, b.value(s));
  if (tier <= have) return s;
  const next = have + 1;
  const r = TIER_REWARD[next - 1];
  let out: GameState = { ...s, coins: s.coins + (r.coins ?? 0), badgeTiers: { ...s.badgeTiers, [id]: next } };
  if (r.chest) out = A.grantChest(out, r.chest, `${b.name} badge: ${TIERS[next - 1].label}`);
  // Rainbow on every badge's top tier also brings the rainbow profile frame; Collector Rainbow keeps the old trophy.
  if (next === 5 && id === 'collector') out = grantCosmetic(out, 'trophy');
  return out;
}

export function setShowcase(s: GameState, ids: string[]): GameState {
  return { ...s, showcase: ids.filter((id) => BADGE_BY_ID[id]).slice(0, 3) };
}
export const hasRainbow = (s: GameState) => Object.values(s.badgeTiers ?? {}).some((t) => t >= 5);
