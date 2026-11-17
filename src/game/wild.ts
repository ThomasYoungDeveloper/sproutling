import type { GameState, OwnedPet, Rarity } from './types';
import type { PetLike } from './battle';
import type { WildEncounter } from './walkFinds';
import { SPECIES_BY_ID } from './species';
import { xpForLevel } from './scoring';
import { randomPersonality, rollIvs } from './stats';
import { WALK_FOODS, addFood } from './food';
import { makeId, randInt, type Rng, defaultRng } from './random';
import * as A from './actions';

/**
 * Wild pets met on walks. You battle them with your pets' real HP (it stays down afterwards).
 * Winning gives a surprise: coins and food, and a 10% chance the wild pet joins your team.
 */

export const JOIN_CHANCE = 0.1;
const COINS: Record<Rarity, [number, number]> = { common: [10, 20], uncommon: [15, 30], rare: [25, 45], epic: [40, 70], legendary: [60, 100] };
const FOOD_RARITY: Record<Rarity, Rarity> = { common: 'common', uncommon: 'uncommon', rare: 'rare', epic: 'rare', legendary: 'epic' };

export function wildOpponent(w: WildEncounter): PetLike {
  const sp = SPECIES_BY_ID[w.speciesId];
  return { id: w.id, speciesId: w.speciesId, nickname: `Wild ${sp?.name ?? 'pet'}`, xp: xpForLevel(w.level) + 5, shiny: false };
}

export interface WildReward {
  coins: number;
  foodId: string | null;
  joined: OwnedPet | null;
}

/** Removes the encounter. A win pays out; a loss means it ran off. */
export function resolveWild(s: GameState, encounterId: string, won: boolean, rng: Rng = defaultRng): { state: GameState; reward: WildReward | null } {
  const w = (s.wildPending ?? []).find((x) => x.id === encounterId);
  let next: GameState = { ...s, wildPending: (s.wildPending ?? []).filter((x) => x.id !== encounterId) };
  if (!w || !won) return { state: next, reward: null };
  const [lo, hi] = COINS[w.rarity] ?? COINS.common;
  const coins = randInt(lo, hi, rng);
  next = { ...next, coins: next.coins + coins };
  const pool = WALK_FOODS.filter((f) => f.rarity === FOOD_RARITY[w.rarity]);
  const food = pool.length ? pool[Math.floor(rng() * pool.length)] : null;
  if (food) next = addFood(next, food.id);
  let joined: OwnedPet | null = null;
  if (rng() < JOIN_CHANCE) {
    const sp = SPECIES_BY_ID[w.speciesId];
    joined = {
      id: makeId(rng),
      speciesId: w.speciesId,
      nickname: sp?.name ?? 'Pet',
      xp: xpForLevel(Math.max(1, w.level - 1)),
      shiny: false,
      hatchedOn: A.todayKey(s),
      personality: randomPersonality(rng),
      ivs: rollIvs(rng),
    };
    next = { ...next, pets: [...next.pets, joined], dex: { ...next.dex, [w.speciesId]: true } };
  }
  return { state: next, reward: { coins, foodId: food?.id ?? null, joined } };
}

/** Lets a wild pet go without a fight. */
export const letGo = (s: GameState, encounterId: string): GameState => ({ ...s, wildPending: (s.wildPending ?? []).filter((x) => x.id !== encounterId) });
