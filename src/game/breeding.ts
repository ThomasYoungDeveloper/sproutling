import { ivsOf, LUCKY_CHANCE } from './stats';
import type { Egg, GameState, OwnedPet, Rarity } from './types';
import { SPECIES, SPECIES_BY_ID } from './species';
import { levelFor } from './scoring';
import { makeId, pickOne, type Rng, defaultRng } from './random';
import { gameNow } from './expedition';
import * as A from './actions';

/**
 * The Pet Nursery: two adult pets make an egg together.
 * The egg still has to be walked to hatch, and nursery eggs are much more likely to hatch with a skin.
 */

export const ADULT_LEVEL = 7;
export const BREED_COST = 300;
export const REST_HOURS = 24;
/** Bred eggs nest in the nursery this long before they're ready (steps make it shorter). */
export const NEST_HOURS: Record<Rarity, number> = { common: 1, uncommon: 2, rare: 4, epic: 8, legendary: 12 };
/** The egg nesting in the nursery right now, if any. */
export const nestingEgg = (s: GameState) => s.eggs.find((e) => e.nestUntil != null);
export const nestLeftMs = (s: GameState, now = Date.now()) => {
  const e = nestingEgg(s);
  return e ? Math.max(0, e.nestUntil! - gameNow(s, now)) : 0;
};
/** Moves a finished nest egg into the basket (or the waiting spot when the basket is full). */
export function collectNest(s: GameState, now = Date.now()): { state: GameState; egg: Egg; overflow: boolean } | { error: string } | null {
  const e = nestingEgg(s);
  if (!e || nestLeftMs(s, now) > 0) return null;
  const full = A.basketFull(s);
  if (full && A.overflowEggs(s).length >= A.MAX_OVERFLOW) return { error: 'Your basket is full. Hatch or leave an egg first.' };
  const egg: Egg = { ...e, nestUntil: undefined, ...(full ? { overflow: true } : {}) };
  delete (egg as any).nestUntil;
  return { state: { ...s, eggs: s.eggs.map((x) => (x.id === e.id ? egg : x)) }, egg, overflow: full };
}
/** Chance the baby is a surprise species that shares a parent's element. */
export const SURPRISE_CHANCE = 0.1;

const RANK: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

export type BreedCheck = { ok: true } | { ok: false; reason: string };

export function restLeftMs(s: GameState, pet: OwnedPet, now = Date.now()): number {
  return Math.max(0, (pet.restUntil ?? 0) - gameNow(s, now));
}

export function canBreed(s: GameState, aId: string, bId: string, now = Date.now()): BreedCheck {
  const a = s.pets.find((p) => p.id === aId);
  const b = s.pets.find((p) => p.id === bId);
  if (!a || !b) return { ok: false, reason: 'Pick two pets.' };
  if (a.id === b.id) return { ok: false, reason: 'Pick two different pets.' };
  for (const p of [a, b]) {
    if (levelFor(p.xp) < ADULT_LEVEL) return { ok: false, reason: `${p.nickname} needs to be an adult (level ${ADULT_LEVEL}) first.` };
    if (restLeftMs(s, p, now) > 0) return { ok: false, reason: `${p.nickname} is resting after the last egg.` };
    if (s.expedition?.petId === p.id) return { ok: false, reason: `${p.nickname} is out exploring.` };
  }
  if (nestingEgg(s)) return { ok: false, reason: 'An egg is already nesting. Collect it first.' };
  if (A.basketFull(s)) return { ok: false, reason: `Your egg basket is full (${A.EGG_BASKET} / ${A.EGG_BASKET}). Hatch an egg to make room first.` };
  if (s.coins < BREED_COST) return { ok: false, reason: `The nursery costs ${BREED_COST} coins.` };
  return { ok: true };
}

/** Which species the baby could be, and how likely each is. */
export function outcomes(a: OwnedPet, b: OwnedPet): { speciesId: string; chance: number }[] {
  const same = a.speciesId === b.speciesId;
  const parentShare = (1 - SURPRISE_CHANCE) / (same ? 1 : 2);
  const list = same ? [{ speciesId: a.speciesId, chance: parentShare }] : [{ speciesId: a.speciesId, chance: parentShare }, { speciesId: b.speciesId, chance: parentShare }];
  return [...list, { speciesId: '?', chance: SURPRISE_CHANCE }];
}

function surprisePool(a: OwnedPet, b: OwnedPet): string[] {
  const sa = SPECIES_BY_ID[a.speciesId];
  const sb = SPECIES_BY_ID[b.speciesId];
  const elements = new Set([sa.element, sb.element]);
  // Surprises share an element with a parent and are never rarer than the rarer parent.
  const maxRank = Math.max(RANK[sa.rarity], RANK[sb.rarity]);
  return SPECIES.filter((x) => elements.has(x.element) && RANK[x.rarity] <= maxRank && x.id !== a.speciesId && x.id !== b.speciesId).map((x) => x.id);
}

export function breed(s: GameState, aId: string, bId: string, rng: Rng = defaultRng, now = Date.now()): { state: GameState; egg: Egg; surprise: boolean } | null {
  if (!canBreed(s, aId, bId, now).ok) return null;
  const a = s.pets.find((p) => p.id === aId)!;
  const b = s.pets.find((p) => p.id === bId)!;
  const pool = surprisePool(a, b);
  const surprise = pool.length > 0 && rng() < SURPRISE_CHANCE;
  const speciesId = surprise ? pickOne(pool, rng) : rng() < 0.5 ? a.speciesId : b.speciesId;
  // A Lucky egg: +1 or +2 to every stat when it hatches.
  const lucky = rng() < LUCKY_CHANCE ? (rng() < 0.5 ? 1 : 2) : 0;
  const egg: Egg = {
    id: makeId(rng),
    rarity: SPECIES_BY_ID[speciesId].rarity,
    stepsWalked: 0,
    incubating: false,
    foundOn: A.todayKey(s),
    nestUntil: gameNow(s, now) + NEST_HOURS[SPECIES_BY_ID[speciesId].rarity] * 3_600_000,
    bred: { speciesId, parents: [a.speciesId, b.speciesId], parentSkins: [a.skin ?? null, b.skin ?? null], parentIvs: [ivsOf(a), ivsOf(b)], ...(lucky ? { lucky } : {}) },
  };
  const rest = gameNow(s, now) + REST_HOURS * 3_600_000;
  const pets = s.pets.map((p) => (p.id === aId || p.id === bId ? { ...p, restUntil: rest } : p));
  const state = A.bump({ ...s, coins: s.coins - BREED_COST, pets, eggs: [...s.eggs, egg] }, 'bred');
  return { state, egg, surprise };
}
