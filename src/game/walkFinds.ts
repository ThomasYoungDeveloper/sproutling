import type { ChestKind, GameState, Rarity } from './types';
import * as A from './actions';
import { pickWeighted, seededRng, type Rng } from './random';

/**
 * Walking finds: every 1,000 steps you walk, your pet might sniff out a chest.
 * With verified steps from Apple Health it can also dig up an egg.
 * Capped per day so finds stay special (and so typed-in steps can't farm them).
 */

export const FIND_EVERY = 1000;
export const MAX_FINDS_PER_DAY = 3;
export const CHEST_CHANCE = 12; // % per 1,000 steps
export const EGG_CHANCE = 8; // % per 1,000 verified steps

const CHEST_ODDS: Partial<Record<ChestKind, number>> = { bronze: 80, silver: 18, gold: 2 };
const EGG_ODDS: Partial<Record<Rarity, number>> = { common: 60, uncommon: 30, rare: 9, epic: 1 };

export type WalkFind = { kind: 'chest'; chest: ChestKind; at: number } | { kind: 'egg'; rarity: Rarity; at: number };

export function walkFindsToday(s: GameState): { checked: number; found: number } {
  const w = s.walkFinds;
  return w && w.day === A.todayKey(s) ? { checked: w.checked, found: w.found } : { checked: 0, found: 0 };
}

/**
 * Rolls once for each new 1,000 steps walked today. Returns the new state and what was found.
 * Each 1,000-step mark has its own fixed roll, so re-running never re-rolls (no luck farming).
 */
export function rollWalkFinds(s: GameState, verified: boolean, rngFor?: (mark: number) => Rng): { state: GameState; finds: WalkFind[] } {
  const day = A.todayKey(s);
  const steps = A.today(s).steps;
  let { checked, found } = walkFindsToday(s);
  const target = Math.floor(steps / FIND_EVERY);
  if (target <= checked) return { state: s, finds: [] };
  let next = s;
  const finds: WalkFind[] = [];
  for (let k = checked + 1; k <= target; k++) {
    if (found >= MAX_FINDS_PER_DAY) break;
    const rng = rngFor ? rngFor(k) : seededRng(`${s.pets[0]?.id ?? 'me'}:${day}:${k}`);
    const r = rng() * 100;
    if (verified && r < EGG_CHANCE) {
      const rarity = pickWeighted(EGG_ODDS as Record<Rarity, number>, rng);
      next = { ...next, eggs: [...next.eggs, A.newEgg(next, rarity, rng)] };
      finds.push({ kind: 'egg', rarity, at: k * FIND_EVERY });
      found++;
    } else if (r >= (verified ? EGG_CHANCE : 0) && r < (verified ? EGG_CHANCE : 0) + CHEST_CHANCE) {
      const chest = pickWeighted(CHEST_ODDS as Record<ChestKind, number>, rng);
      next = A.grantChest(next, chest, 'Found on your walk', rng);
      finds.push({ kind: 'chest', chest, at: k * FIND_EVERY });
      found++;
    }
  }
  return { state: { ...next, walkFinds: { day, checked: target, found } }, finds };
}
