import type { DayLog, GameState } from './types';
import { levelFor, scoreDay, stepGoalOf } from './scoring';

/**
 * Account level: one level for the player, separate from pets. It comes from what you've done
 * (days played, goals, steps, water and sleep logged, hatches, battles, trips, breeding, 7-day streaks),
 * worked out from the save itself, so it can't be traded and never goes down. Existing players start at
 * least at the level their best pet had when this arrived (account.floor).
 */
export const XP_FOR = {
  dayPlayed: 20,
  stepGoal: 100,
  per1000Steps: 10,
  stepsCapPerDay: 300,
  water: 25,
  sleep: 25,
  hatch: 50,
  battleWin: 20,
  trip: 15,
  bred: 30,
  streak7: 300,
} as const;

/** Total account XP needed to reach a level: 100 for level 2, 250 for 3, 700 for 5, 2,700 for 10. */
export const accountXpFor = (level: number) => (level <= 1 ? 0 : 25 * (level - 1) * (level + 2));

export function accountLevelFor(xp: number): number {
  let l = 1;
  while (accountXpFor(l + 1) <= xp) l++;
  return l;
}

const played = (d: DayLog) => d.steps > 0 || d.water > 0 || d.sleepHours > 0 || !!d.care && Object.values(d.care).some(Boolean);
const counts = (d?: DayLog) => !!d && (!!d.shielded || scoreDay(d).total >= 50);

export function dayXp(d: DayLog): number {
  if (!played(d)) return 0;
  let xp = XP_FOR.dayPlayed;
  if (d.steps >= stepGoalOf(d)) xp += XP_FOR.stepGoal;
  xp += Math.min(XP_FOR.stepsCapPerDay, Math.floor(d.steps / 1000) * XP_FOR.per1000Steps);
  if (d.water > 0) xp += XP_FOR.water;
  if (d.sleepHours > 0) xp += XP_FOR.sleep;
  return xp;
}

/** +300 for every full 7 days in a row (counted the same way as the streak). */
function streakXp(days: Record<string, DayLog>): number {
  const keys = Object.keys(days).sort();
  let run = 0;
  let prev: number | null = null;
  let xp = 0;
  for (const k of keys) {
    const t = Date.parse(k + 'T12:00:00Z');
    if (!counts(days[k])) {
      run = 0;
      prev = t;
      continue;
    }
    run = prev !== null && Math.round((t - prev) / 86_400_000) === 1 ? run + 1 : 1;
    prev = t;
    if (run % 7 === 0) xp += XP_FOR.streak7;
  }
  return xp;
}

/** XP earned from everything you've done (before the starting floor). */
export function earnedXp(s: GameState): number {
  let xp = 0;
  for (const d of Object.values(s.days ?? {})) xp += dayXp(d);
  xp += streakXp(s.days ?? {});
  xp += (s.stats?.hatched ?? 0) * XP_FOR.hatch;
  xp += (s.battle?.wins ?? 0) * XP_FOR.battleWin;
  xp += (s.stats?.expeditions ?? 0) * XP_FOR.trip;
  xp += (s.stats?.bred ?? 0) * XP_FOR.bred;
  return xp;
}

export const bestPetLevel = (s: GameState) => s.pets.reduce((m, p) => Math.max(m, levelFor(p.xp)), 1);

/** Your account XP: what you've earned, but never below your starting floor. */
export const accountXp = (s: GameState) => Math.max(earnedXp(s), accountXpFor(s.account?.floor ?? 1));
export const accountLevel = (s: GameState) => accountLevelFor(accountXp(s));

export function accountProgress(s: GameState): { level: number; xp: number; into: number; need: number } {
  const xp = accountXp(s);
  const level = accountLevelFor(xp);
  const base = accountXpFor(level);
  return { level, xp, into: xp - base, need: accountXpFor(level + 1) - base };
}

/**
 * Sets the starting floor once (best pet's level at that moment) so nobody loses what was already open,
 * and marks the current level as already rewarded so the switch-over doesn't pay out a pile of coins.
 */
export function ensureAccount(s: GameState): GameState {
  if (s.account) return s;
  const floor = bestPetLevel(s);
  const withFloor: GameState = { ...s, account: { floor, rewarded: 1 } };
  return { ...withFloor, account: { floor, rewarded: accountLevel(withFloor) } };
}

/** Coins for each level reached since the last reward, plus a Silver chest at every 5th level. */
export const LEVEL_COINS = 100;
export function levelReward(from: number, to: number): { coins: number; silver: number } {
  let coins = 0;
  let silver = 0;
  for (let l = from + 1; l <= to; l++) {
    coins += LEVEL_COINS;
    if (l % 5 === 0) silver++;
  }
  return { coins, silver };
}

/** Badge color: green to start, then bronze at 10, silver at 20, gold at 30. */
export function badgeTier(level: number): 'green' | 'bronze' | 'silver' | 'gold' {
  return level >= 30 ? 'gold' : level >= 20 ? 'silver' : level >= 10 ? 'bronze' : 'green';
}
