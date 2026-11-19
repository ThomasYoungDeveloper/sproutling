import type { GameState, Skin } from './types';
import { seededRng } from './random';
import { SKIN_INFO, noteSkin } from './skins';
import * as A from './actions';

/**
 * Dyes give one pet a skin for good. They show up in the shop's featured spot about 1 day in 3,
 * come from the Lucky Wheel and events, and sit in the Bag until used. Silver, Gold and Rainbow are hatch-only.
 */
export type DyeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Dye {
  skin: Skin;
  rarity: DyeRarity;
  /** Event dyes aren't sold in the shop. */
  event?: boolean;
}

export const DYES: Dye[] = [
  { skin: 'pastel', rarity: 'common' },
  { skin: 'mono', rarity: 'common' },
  { skin: 'retro', rarity: 'common' },
  { skin: 'sakura', rarity: 'rare' },
  { skin: 'ocean', rarity: 'rare' },
  { skin: 'ember', rarity: 'rare' },
  { skin: 'moonlit', rarity: 'rare' },
  { skin: 'crystal', rarity: 'epic' },
  { skin: 'shadow', rarity: 'epic' },
  { skin: 'galaxy', rarity: 'legendary' },
  { skin: 'harvest', rarity: 'rare', event: true },
];

export const DYE_PRICE: Record<DyeRarity, number> = { common: 1800, rare: 4000, epic: 8000, legendary: 15000 };
export const DYE_RARITY_LABEL: Record<DyeRarity, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
export const DYE_RARITY_COLOR: Record<DyeRarity, string> = { common: '#5C6F69', rare: '#2F6FD6', epic: '#7A4FD6', legendary: '#B07A00' };
/** How often the shop's featured spot is a dye, and which rarity it rolls. */
export const DYE_DAY_CHANCE = 1 / 3;
export const SHOP_DYE_ODDS: Record<DyeRarity, number> = { common: 55, rare: 30, epic: 12, legendary: 3 };
/** Odds for a dye won on the Lucky Wheel. */
export const WHEEL_DYE_ODDS: Record<DyeRarity, number> = { common: 70, rare: 24, epic: 5, legendary: 1 };

export const dyeName = (skin: Skin) => `${SKIN_INFO[skin].label} Dye`;
export const dyeOf = (skin: Skin) => DYES.find((d) => d.skin === skin);
export const dyesOwned = (s: GameState, skin: Skin) => s.items[dyeName(skin)] ?? 0;
export const ownedDyes = (s: GameState) => DYES.filter((d) => dyesOwned(s, d.skin) > 0);

function pickRarity(odds: Record<DyeRarity, number>, r: number): DyeRarity {
  const total = Object.values(odds).reduce((a, b) => a + b, 0);
  let acc = 0;
  for (const k of ['common', 'rare', 'epic', 'legendary'] as DyeRarity[]) {
    acc += odds[k] / total;
    if (r < acc) return k;
  }
  return 'common';
}

/** Rolls a dye of a random rarity (event dyes excluded). */
export function rollDye(rng: () => number, odds = WHEEL_DYE_ODDS): Dye {
  const rarity = pickRarity(odds, rng());
  const pool = DYES.filter((d) => d.rarity === rarity && !d.event);
  return pool[Math.floor(rng() * pool.length) % pool.length];
}

/** The shop's dye for a day, the same for everyone, or null on a normal day. */
export function dyeOfDay(day: string): Dye | null {
  const rng = seededRng('dye-day:' + day);
  if (rng() >= DYE_DAY_CHANCE) return null;
  return rollDye(rng, SHOP_DYE_ODDS);
}

export const addDye = (s: GameState, skin: Skin, n = 1): GameState => ({ ...s, items: { ...s.items, [dyeName(skin)]: dyesOwned(s, skin) + n } });

export function buyDye(s: GameState, day: string): { ok: true; state: GameState } | { ok: false; reason: string } {
  const d = dyeOfDay(day);
  if (!d) return { ok: false, reason: 'There’s no dye in the shop today.' };
  const price = DYE_PRICE[d.rarity];
  if ((s.boughtDye ?? '') === day) return { ok: false, reason: 'You already bought today’s dye.' };
  if (s.coins < price) return { ok: false, reason: `You need ${(price - s.coins).toLocaleString()} more coins.` };
  return { ok: true, state: { ...addDye({ ...s, coins: s.coins - price }, d.skin), boughtDye: day } };
}

/** Uses one dye on a pet: it keeps that skin for good (replacing any skin it had). */
export function useDye(s: GameState, uid: string, skin: Skin): { ok: true; state: GameState } | { ok: false; reason: string } {
  if (dyesOwned(s, skin) < 1) return { ok: false, reason: `You don’t have a ${dyeName(skin)}.` };
  const pet = s.pets.find((p) => p.id === uid);
  if (!pet) return { ok: false, reason: 'Pick a pet first.' };
  if (pet.skin === skin) return { ok: false, reason: `${pet.nickname} already has the ${SKIN_INFO[skin].label} skin.` };
  const next = { ...pet, skin };
  let out: GameState = { ...s, items: { ...s.items, [dyeName(skin)]: dyesOwned(s, skin) - 1 }, pets: s.pets.map((p) => (p.id === uid ? next : p)) };
  out = noteSkin(out, next);
  return { ok: true, state: out };
}

export const todayDye = (s: GameState) => dyeOfDay(A.todayKey(s));
