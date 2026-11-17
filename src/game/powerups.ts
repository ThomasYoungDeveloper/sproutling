import type { GameState, OwnedPet } from './types';
import { IV_MAX, STATS, ivsOf, type Stat } from './stats';
import { type Rng, defaultRng } from './random';

/**
 * Two ways to raise a pet's grade after it hatches:
 * - Training Crystals: spend one to add +1 to a stat (up to 15).
 * - Combine duplicates: a spare copy of the same species joins your pet, which keeps the higher
 *   value of each stat plus a +1 bonus on one stat.
 */

export const CRYSTAL = 'Training Crystal';
export const CRYSTAL_PRICE = 250;

export const crystalsOf = (s: GameState) => s.items[CRYSTAL] ?? 0;

export function addCrystals(s: GameState, n: number): GameState {
  if (n <= 0) return s;
  return { ...s, items: { ...s.items, [CRYSTAL]: crystalsOf(s) + n } };
}

/** Crystals that come with a chest: Gold always has 1–2, Silver sometimes has 1. */
export function chestCrystals(kind: 'bronze' | 'silver' | 'gold', rng: Rng = defaultRng): number {
  if (kind === 'gold') return rng() < 0.5 ? 1 : 2;
  if (kind === 'silver') return rng() < 0.4 ? 1 : 0;
  return 0;
}

export type PowerCheck = { ok: true } | { ok: false; reason: string };

export function canUseCrystal(s: GameState, petId: string, stat: Stat): PowerCheck {
  const pet = s.pets.find((p) => p.id === petId);
  if (!pet) return { ok: false, reason: 'Pick a pet.' };
  if (crystalsOf(s) < 1) return { ok: false, reason: 'You don’t have any Training Crystals yet.' };
  if (ivsOf(pet)[stat] >= IV_MAX) return { ok: false, reason: 'That stat is already maxed out.' };
  return { ok: true };
}

export function useCrystal(s: GameState, petId: string, stat: Stat): GameState {
  if (!canUseCrystal(s, petId, stat).ok) return s;
  const left = crystalsOf(s) - 1;
  const items = { ...s.items };
  if (left > 0) items[CRYSTAL] = left;
  else delete items[CRYSTAL];
  return {
    ...s,
    items,
    pets: s.pets.map((p) => (p.id === petId ? { ...p, ivs: { ...ivsOf(p), [stat]: ivsOf(p)[stat] + 1 } } : p)),
  };
}

/** The shop sells one crystal a day. */
export const crystalBoughtToday = (s: GameState, today: string) => s.crystalShopDay === today;

export function buyCrystal(s: GameState, today: string): GameState {
  if (crystalBoughtToday(s, today) || s.coins < CRYSTAL_PRICE) return s;
  return { ...addCrystals({ ...s, coins: s.coins - CRYSTAL_PRICE }, 1), crystalShopDay: today };
}

/** Spare copies of this pet's species that could be combined into it. */
export function sparesFor(s: GameState, pet: OwnedPet): OwnedPet[] {
  return s.pets.filter((p) => p.id !== pet.id && p.speciesId === pet.speciesId);
}

export function canCombine(s: GameState, keepId: string, spareId: string, busyIds: string[] = []): PowerCheck {
  const keep = s.pets.find((p) => p.id === keepId);
  const spare = s.pets.find((p) => p.id === spareId);
  if (!keep || !spare || keep.id === spare.id) return { ok: false, reason: 'Pick a spare pet.' };
  if (keep.speciesId !== spare.speciesId) return { ok: false, reason: 'Only two of the same pet can combine.' };
  if (s.activePetId === spare.id) return { ok: false, reason: `${spare.nickname} is your active pet. Make another pet active first.` };
  if (s.expedition?.petId === spare.id) return { ok: false, reason: `${spare.nickname} is out exploring.` };
  if (busyIds.includes(spare.id)) return { ok: false, reason: `${spare.nickname} is in a trade.` };
  return { ok: true };
}

/** What combining would do, without doing it (for the preview). The bonus stat is the lowest one left. */
export function combinePreview(keep: OwnedPet, spare: OwnedPet): { before: Record<Stat, number>; after: Record<Stat, number>; bonus: Stat | null } {
  const a = ivsOf(keep);
  const b = ivsOf(spare);
  const after = {} as Record<Stat, number>;
  for (const k of STATS) after[k] = Math.max(a[k], b[k]);
  const open = STATS.filter((k) => after[k] < IV_MAX);
  const bonus = open.length ? open.reduce((lo, k) => (after[k] < after[lo] ? k : lo), open[0]) : null;
  if (bonus) after[bonus] += 1;
  return { before: a, after, bonus };
}

export function combinePets(s: GameState, keepId: string, spareId: string, busyIds: string[] = []): GameState {
  if (!canCombine(s, keepId, spareId, busyIds).ok) return s;
  const keep = s.pets.find((p) => p.id === keepId)!;
  const spare = s.pets.find((p) => p.id === spareId)!;
  const { after } = combinePreview(keep, spare);
  return {
    ...s,
    pets: s.pets.filter((p) => p.id !== spareId).map((p) => (p.id === keepId ? { ...p, ivs: after } : p)),
  };
}
