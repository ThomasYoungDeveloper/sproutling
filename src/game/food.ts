import type { DayLog, GameState, OwnedPet, Rarity } from './types';
import { STAT_INFO, type Stat } from './stats';
import { seededRng } from './random';

/**
 * Food and needs.
 *
 * - Pellets are always free: they fill the food bar but give nothing extra.
 * - Every other food raises one battle stat by a small percent, more for rarer food (up to +10% per stat). Food is found on walks
 *   or bought at the Food Market (game/market.ts). The first BOOSTS_PER_DAY each day give a stat bonus.
 * - Four needs bars (food, fun, water, energy) drift down slowly and never hit zero.
 */

export interface FoodDef {
  id: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  stat: Stat;
  /** How much it fills the food bar (0–100). */
  fill: number;
  /** Can turn up on walks. (Every food can appear at the Food Market: see game/market.ts.) */
  walk?: boolean;
}

export const PELLETS = { id: 'pellets', name: 'Pellets', emoji: '🟤', fill: 45 } as const;

/** How much a food raises its stat, as a percent of that stat, by rarity. Small, so it adds up over time. */
export const BOOST_BY_RARITY: Record<Rarity, number> = { common: 0.8, uncommon: 1.2, rare: 1.8, epic: 2.5, legendary: 4 };
export const boostOf = (f: Pick<FoodDef, 'rarity' | 'stat'>) => BOOST_BY_RARITY[f.rarity];
/** Shows a percent boost like "+0.2%". */
export const pct = (n: number) => `+${Number(n.toFixed(1))}%`;

export const FOODS: FoodDef[] = [
  // Found on walks (and sometimes at the market)
  { id: 'berries', name: 'Berries', emoji: '🍓', rarity: 'common', stat: 'hp', fill: 45, walk: true },
  { id: 'mushroom', name: 'Mushroom', emoji: '🍄', rarity: 'common', stat: 'def', fill: 45, walk: true },
  { id: 'carrot', name: 'Carrot', emoji: '🥕', rarity: 'common', stat: 'spd', fill: 45, walk: true },
  { id: 'chestnut', name: 'Chestnut', emoji: '🌰', rarity: 'uncommon', stat: 'atk', fill: 55, walk: true },
  { id: 'melon', name: 'Melon', emoji: '🍈', rarity: 'uncommon', stat: 'hp', fill: 55, walk: true },
  { id: 'peach', name: 'Peach', emoji: '🍑', rarity: 'rare', stat: 'spd', fill: 65, walk: true },
  { id: 'goldapple', name: 'Golden apple', emoji: '🍎', rarity: 'epic', stat: 'hp', fill: 80, walk: true },
  // Market foods
  { id: 'onigiri', name: 'Onigiri', emoji: '🍙', rarity: 'common', stat: 'atk', fill: 50 },
  { id: 'egg', name: 'Tamago', emoji: '🍳', rarity: 'common', stat: 'def', fill: 50 },
  { id: 'dango', name: 'Dango', emoji: '🍡', rarity: 'uncommon', stat: 'spd', fill: 60 },
  { id: 'ramen', name: 'Ramen', emoji: '🍜', rarity: 'uncommon', stat: 'hp', fill: 70 },
  { id: 'bento', name: 'Bento', emoji: '🍱', rarity: 'rare', stat: 'def', fill: 80 },
  { id: 'sushi', name: 'Sushi', emoji: '🍣', rarity: 'epic', stat: 'atk', fill: 90 },
  { id: 'mooncake', name: 'Mooncake', emoji: '🥮', rarity: 'legendary', stat: 'spd', fill: 100 },
];
export const FOOD_BY_ID: Record<string, FoodDef> = Object.fromEntries(FOODS.map((f) => [f.id, f]));
export const WALK_FOODS = FOODS.filter((f) => f.walk);

export const BOOSTS_PER_DAY = 3;
/** No pet can gain more than this percent from food in one stat, so food can't outgrow training. */
export const FOOD_CAP = 10;
export const foodCapFor = (_stat: Stat) => FOOD_CAP;

export const foodsOf = (s: GameState) => s.foods ?? {};
export const foodCount = (s: GameState, id: string) => s.foods?.[id] ?? 0;

export function addFood(s: GameState, id: string, n = 1): GameState {
  if (!FOOD_BY_ID[id] || n <= 0) return s;
  return { ...s, foods: { ...foodsOf(s), [id]: foodCount(s, id) + n } };
}

/* ---------- Needs bars ---------- */

export const NEED_FLOOR = 10;
const DRIFT_PER_HOUR = 6;

export type Needs = { food: number; fun: number; water: number; energy: number };

/** A level that drifts down from where it was set, never below the floor. */
function drifted(level: number | undefined, at: number | undefined, now: number) {
  if (level === undefined || at === undefined) return NEED_FLOOR + 10;
  const hours = Math.max(0, (now - at) / 3600000);
  return Math.round(Math.max(NEED_FLOOR, Math.min(100, level - hours * DRIFT_PER_HOUR)));
}

export function needsFor(d: DayLog, now = Date.now(), waterGoal = 8): Needs {
  const c = d.care ?? {};
  const playLevel = c.funAt ? c.fun : (c.played ?? 0) > 0 ? Math.min(100, 20 + (c.played ?? 0) * 30) : undefined;
  return {
    food: drifted(c.food ?? (c.fed ? 70 : undefined), c.foodAt ?? (c.fed ? now : undefined), now),
    fun: drifted(playLevel, c.funAt ?? (playLevel !== undefined ? now : undefined), now),
    water: Math.round(NEED_FLOOR + (100 - NEED_FLOOR) * Math.min(1, (d.water ?? 0) / waterGoal)),
    energy: d.sleepHours > 0 ? Math.round(NEED_FLOOR + (100 - NEED_FLOOR) * Math.min(1, d.sleepHours / 8)) : 50,
  };
}

export const allFull = (n: Needs) => n.food >= 80 && n.fun >= 80 && n.water >= 80 && n.energy >= 80;

/* ---------- Feeding ---------- */

export const boostsUsedToday = (d: DayLog) => d.care?.boosts ?? 0;

export type FeedCheck = { ok: true } | { ok: false; reason: string };

export function canFeed(s: GameState, d: DayLog, petId: string, foodId: string): FeedCheck {
  if (foodId === PELLETS.id) return { ok: true };
  const f = FOOD_BY_ID[foodId];
  const pet = s.pets.find((p) => p.id === petId);
  if (!f || !pet) return { ok: false, reason: 'Pick a food.' };
  if (foodCount(s, foodId) < 1) return { ok: false, reason: `You're out of ${f.name}.` };
  return { ok: true };
}

/** Every pet secretly loves one food (double boost) and dislikes one (half boost), fixed from the day it hatched. */
export function tasteOf(pet: Pick<OwnedPet, 'id'>): { fav: string; dislike: string } {
  const pool = FOODS.filter((f) => f.id !== PELLETS.id).map((f) => f.id);
  const rng = seededRng('taste:' + pet.id);
  const fav = pool[Math.floor(rng() * pool.length) % pool.length];
  const rest = pool.filter((x) => x !== fav);
  return { fav, dislike: rest[Math.floor(rng() * rest.length) % rest.length] };
}

export const TASTE_MULT = { fav: 2, dislike: 0.5 };
export function tasteMult(pet: Pick<OwnedPet, 'id'>, foodId: string) {
  const t = tasteOf(pet);
  return foodId === t.fav ? TASTE_MULT.fav : foodId === t.dislike ? TASTE_MULT.dislike : 1;
}
/** What the player has found out: 'fav', 'dislike', 'tried' or 'new'. */
export function tasteKnown(pet: Pick<OwnedPet, 'id' | 'tasted'>, foodId: string): 'fav' | 'dislike' | 'tried' | 'new' {
  if (!pet.tasted?.includes(foodId)) return 'new';
  const t = tasteOf(pet);
  return foodId === t.fav ? 'fav' : foodId === t.dislike ? 'dislike' : 'tried';
}

/** How much this food would actually raise the pet's stat (0 once the stat's food cap is reached). */
export function boostFor(pet: OwnedPet, f: FoodDef, day?: DayLog): number {
  if (day && boostsUsedToday(day) >= BOOSTS_PER_DAY) return 0; // Still tasty, just no stat bonus today.
  const have = pet.foodBoost?.[f.stat] ?? 0;
  const base = boostOf(f) * tasteMult(pet, f.id);
  return Math.round(Math.max(0, Math.min(base, foodCapFor(f.stat) - have)) * 10) / 10;
}

/**
 * Feeds a pet. `updateDay` applies a change to today's log (passed in to keep this file free of
 * a circular import with actions). Returns the new state.
 */
export function feedPet(
  s: GameState,
  petId: string,
  foodId: string,
  updateDay: (s: GameState, f: (d: DayLog) => DayLog) => GameState,
  day: DayLog,
  now = Date.now(),
): GameState {
  if (!canFeed(s, day, petId, foodId).ok) return s;
  const isPellet = foodId === PELLETS.id;
  const f = FOOD_BY_ID[foodId];
  let next = s;
  if (!isPellet) {
    const left = foodCount(s, foodId) - 1;
    const foods = { ...foodsOf(s) };
    if (left > 0) foods[foodId] = left;
    else delete foods[foodId];
    const pet = s.pets.find((p) => p.id === petId)!;
    const gain = boostFor(pet, f, day);
    next = {
      ...s,
      foods,
      pets: s.pets.map((p) => {
        if (p.id !== petId) return p;
        const tasted = p.tasted?.includes(foodId) ? p.tasted : [...(p.tasted ?? []), foodId];
        return gain > 0 ? { ...p, tasted, foodBoost: { ...p.foodBoost, [f.stat]: Math.round(((p.foodBoost?.[f.stat] ?? 0) + gain) * 10) / 10 } } : { ...p, tasted };
      }),
    };
  }
  const fill = isPellet ? PELLETS.fill : f.fill;
  const current = needsFor(day, now).food;
  return updateDay(next, (d) => ({
    ...d,
    care: {
      ...d.care,
      fed: true,
      food: Math.min(100, current + fill),
      foodAt: now,
      ...(isPellet || boostFor(s.pets.find((p) => p.id === petId)!, f, day) === 0 ? {} : { boosts: (d.care?.boosts ?? 0) + 1 }),
    },
  }));
}

/** Play fills the fun bar. */
export function funAfterPlay(d: DayLog, now = Date.now()) {
  return { fun: Math.min(100, needsFor(d, now).fun + 30), funAt: now };
}

export const statLabel = (stat: Stat) => STAT_INFO[stat].short;
