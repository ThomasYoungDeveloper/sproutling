import type { GameState, Rarity, Skin } from './types';
import { defaultRng, type Rng } from './random';
import * as A from './actions';
import { dailyQuests } from './scoring';
import { addPotions } from './hp';
import { CRYSTAL } from './powerups';
import { COSMETICS, grantCosmetic, owns, type Cosmetic } from './cosmetics';
import { addDye, rollDye, type Dye } from './dyes';

/**
 * The Lucky Wheel: finish your 3 daily habit quests to earn one spin a day.
 * (A second spin from a short ad comes with the ads update.)
 * Odds are shown in the app.
 */
export type SlotKind = 'coins' | 'potion' | 'crystal' | 'outfit' | 'dye' | 'egg';
export interface WheelSlot {
  kind: SlotKind;
  label: string;
  sub?: string;
  coins?: number;
  /** Chance out of 100. */
  odds: number;
  color: string;
}

/** In wheel order, clockwise from the top. */
export const SLOTS: WheelSlot[] = [
  { kind: 'coins', label: '20', sub: 'coins', coins: 20, odds: 22, color: '#FFE27A' },
  { kind: 'outfit', label: 'Outfit', odds: 10, color: '#FFC2D6' },
  { kind: 'coins', label: '75', sub: 'coins', coins: 75, odds: 13, color: '#FFD24D' },
  { kind: 'potion', label: 'Potion', odds: 12, color: '#F7B3C6' },
  { kind: 'coins', label: '300', sub: 'JACKPOT', coins: 300, odds: 1, color: '#E8590C' },
  { kind: 'crystal', label: 'Crystal', odds: 9, color: '#B9E4F5' },
  { kind: 'coins', label: '40', sub: 'coins', coins: 40, odds: 18, color: '#FFE9A8' },
  { kind: 'dye', label: 'Dye', sub: 'RARE', odds: 6, color: '#6E56CF' },
  { kind: 'coins', label: '150', sub: 'coins', coins: 150, odds: 6, color: '#FFB547' },
  { kind: 'egg', label: 'Egg', sub: 'RARE', odds: 3, color: '#F2617A' },
];

export const EGG_ODDS: [Rarity, number][] = [['common', 55], ['uncommon', 28], ['rare', 12], ['epic', 4], ['legendary', 1]];
export const OUTFIT_ODDS = { common: 70, rare: 25, epic: 5 } as const;

export type Prize =
  | { kind: 'coins'; coins: number; jackpot: boolean }
  | { kind: 'potion' }
  | { kind: 'crystal' }
  | { kind: 'outfit'; item: Cosmetic }
  | { kind: 'dye'; dye: Dye }
  | { kind: 'egg'; rarity: Rarity; coins: number };

/** Spins earned today: 1 once all 3 habit quests are done. */
export function spinsEarned(s: GameState): number {
  const d = A.today(s);
  return dailyQuests(d).every((q) => q.done) ? 1 : 0;
}
export function spinsLeft(s: GameState): number {
  const day = A.todayKey(s);
  const used = s.wheel?.day === day ? s.wheel.used : 0;
  const extra = s.wheel?.day === day ? s.wheel.extra ?? 0 : 0;
  return Math.max(0, spinsEarned(s) + extra - used);
}

function pickSlot(rng: Rng): number {
  const total = SLOTS.reduce((a, b) => a + b.odds, 0);
  let r = rng() * total;
  for (let i = 0; i < SLOTS.length; i++) {
    r -= SLOTS[i].odds;
    if (r < 0) return i;
  }
  return 0;
}

function pickOutfit(s: GameState, rng: Rng): Cosmetic | null {
  const pool = COSMETICS.filter((c) => c.slot !== 'toy' && c.price > 0 && !c.premium && !c.special && !owns(s, c.id));
  if (!pool.length) return null;
  const r = rng() * 100;
  const want = r < OUTFIT_ODDS.common ? 'common' : r < OUTFIT_ODDS.common + OUTFIT_ODDS.rare ? 'rare' : 'epic';
  const tier = pool.filter((c) => c.rarity === want);
  const from = tier.length ? tier : pool;
  return from[Math.floor(rng() * from.length) % from.length];
}

function pickEgg(rng: Rng): Rarity {
  let r = rng() * 100;
  for (const [k, n] of EGG_ODDS) {
    r -= n;
    if (r < 0) return k;
  }
  return 'common';
}

/** Spins the wheel. Returns null if no spin is left today. */
export function spin(s: GameState, rng: Rng = defaultRng): { state: GameState; slot: number; prize: Prize } | null {
  if (spinsLeft(s) < 1) return null;
  const day = A.todayKey(s);
  const rec = s.wheel?.day === day ? s.wheel : { day, used: 0 };
  let next: GameState = { ...s, wheel: { ...rec, used: rec.used + 1 } };
  const slot = pickSlot(rng);
  const sl = SLOTS[slot];
  let prize: Prize;
  if (sl.kind === 'coins') {
    next = { ...next, coins: next.coins + sl.coins! };
    prize = { kind: 'coins', coins: sl.coins!, jackpot: sl.coins! >= 300 };
  } else if (sl.kind === 'potion') {
    next = addPotions(next, 'small');
    prize = { kind: 'potion' };
  } else if (sl.kind === 'crystal') {
    next = { ...next, items: { ...next.items, [CRYSTAL]: (next.items[CRYSTAL] ?? 0) + 1 } };
    prize = { kind: 'crystal' };
  } else if (sl.kind === 'outfit') {
    const item = pickOutfit(next, rng);
    if (item) {
      next = grantCosmetic(next, item.id);
      prize = { kind: 'outfit', item };
    } else {
      next = { ...next, coins: next.coins + 75 };
      prize = { kind: 'coins', coins: 75, jackpot: false };
    }
  } else if (sl.kind === 'dye') {
    const dye = rollDye(rng);
    next = addDye(next, dye.skin as Skin);
    prize = { kind: 'dye', dye };
  } else {
    const rarity = pickEgg(rng);
    const r = A.addEgg(next, rarity, rng);
    next = r.state;
    prize = { kind: 'egg', rarity, coins: r.coins };
  }
  return { state: next, slot, prize };
}
