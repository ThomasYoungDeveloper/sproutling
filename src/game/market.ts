import type { GameState, Rarity } from './types';
import { FOODS, FOOD_BY_ID, addFood, type FoodDef } from './food';
import { pickWeighted, seededRng } from './random';

/**
 * The Food Market: 4 everyday foods plus 1 special, new every day at midnight.
 * Everyone sees the same stock on the same day (the roll only uses the date).
 * Each food has limited stock per player per day.
 */

export const MARKET_PRICE: Record<Rarity, number> = { common: 30, uncommon: 70, rare: 150, epic: 300, legendary: 600 };
export const EVERYDAY_COUNT = 4;

export interface MarketSlot {
  food: FoodDef;
  price: number;
  stock: number;
  special: boolean;
}

const EVERYDAY = FOODS.filter((f) => f.rarity === 'common' || f.rarity === 'uncommon');
const SPECIAL_ODDS: Partial<Record<Rarity, number>> = { rare: 55, epic: 35, legendary: 10 };

/** The special for a given day (also used for tomorrow's hint). */
export function specialFor(day: string): MarketSlot {
  const rng = seededRng(`market-special:${day}`);
  const rarity = pickWeighted(SPECIAL_ODDS as Record<Rarity, number>, rng);
  const pool = FOODS.filter((f) => f.rarity === rarity);
  const food = pool[Math.floor(rng() * pool.length)] ?? FOODS[0];
  return { food, price: MARKET_PRICE[rarity], stock: rarity === 'legendary' ? 1 : 2, special: true };
}

/** Today's stock: the special first, then the 4 everyday foods. */
export function marketFor(day: string): MarketSlot[] {
  const rng = seededRng(`market:${day}`);
  const pool = [...EVERYDAY];
  const picks: MarketSlot[] = [];
  while (picks.length < EVERYDAY_COUNT && pool.length) {
    const food = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    picks.push({ food, price: MARKET_PRICE[food.rarity], stock: 3 + Math.floor(rng() * 3), special: false });
  }
  picks.sort((a, b) => a.price - b.price);
  return [specialFor(day), ...picks];
}

export const boughtToday = (s: GameState, day: string, foodId: string) => (s.market?.day === day ? s.market.bought[foodId] ?? 0 : 0);

export function leftToday(s: GameState, day: string, slot: MarketSlot) {
  return Math.max(0, slot.stock - boughtToday(s, day, slot.food.id));
}

export type BuyResult = { ok: true; state: GameState } | { ok: false; reason: string };

export function buyFromMarket(s: GameState, day: string, foodId: string): BuyResult {
  const slot = marketFor(day).find((m) => m.food.id === foodId);
  if (!slot) return { ok: false, reason: 'That food isn’t at the market today.' };
  if (leftToday(s, day, slot) <= 0) return { ok: false, reason: `Sold out! New stock at midnight.` };
  if (s.coins < slot.price) return { ok: false, reason: `${slot.food.name} costs ${slot.price} coins.` };
  const prev = s.market?.day === day ? s.market.bought : {};
  const next = addFood({ ...s, coins: s.coins - slot.price, market: { day, bought: { ...prev, [foodId]: (prev[foodId] ?? 0) + 1 } } }, foodId);
  return { ok: true, state: next };
}

/** The date after `day` (YYYY-MM-DD). */
export function nextDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export const foodName = (id: string) => FOOD_BY_ID[id]?.name ?? 'food';
