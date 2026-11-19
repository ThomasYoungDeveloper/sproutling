import type { GameState } from './types';
import * as A from './actions';

/** Watch-an-ad bonuses: always optional, up to 3 a day. */
export const AD_BONUSES_PER_DAY = 3;
export type AdBonusKind = 'chest' | 'trip' | 'login';

export function adBonusesLeft(s: GameState): number {
  const day = A.todayKey(s);
  const used = s.adBonus?.day === day ? s.adBonus.used : 0;
  return Math.max(0, AD_BONUSES_PER_DAY - used);
}

/** Records one bonus used today and applies its reward. */
export function useAdBonus(s: GameState, reward: (s: GameState) => GameState): GameState {
  if (adBonusesLeft(s) < 1) return s;
  const day = A.todayKey(s);
  const used = s.adBonus?.day === day ? s.adBonus.used : 0;
  return reward({ ...s, adBonus: { day, used: used + 1 } });
}

export const addCoins = (n: number) => (s: GameState): GameState => ({ ...s, coins: s.coins + n });

/** Takes an hour off the pet's current trip. */
export const speedUpTrip = (s: GameState): GameState =>
  s.expedition ? { ...s, expedition: { ...s.expedition, startedAt: s.expedition.startedAt - 3600_000 } } : s;
