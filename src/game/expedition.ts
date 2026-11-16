import type { ChestKind, GameState, Rarity } from './types';
import { pickOne, pickWeighted, randInt, type Rng, defaultRng } from './random';
import { levelFor } from './scoring';
import { COLLECTIBLES } from './loot';
import { grantCosmetic, rollChestCosmetic } from './cosmetics';
import * as A from './actions';

/**
 * Expeditions: send a pet on an adventure. It comes back when the timer runs out,
 * or sooner if you walk: every step you take after it leaves brings it home faster.
 */

export interface Place {
  id: string;
  name: string;
  emoji: string;
  minLevel: number;
  /** How long it takes if you don't walk at all. */
  hours: number;
  /** Walking this many steps brings the pet home right away. */
  steps: number;
  coins: [number, number];
  chest?: { kind: ChestKind; chance: number };
  egg?: { chance: number; rarity: Partial<Record<Rarity, number>> };
  itemChance: number;
  cosmeticChance: number;
  events: string[];
}

export const PLACES: Place[] = [
  {
    id: 'meadow', name: 'Mossy Meadow', emoji: '🌼', minLevel: 1, hours: 1, steps: 1500, coins: [15, 30], itemChance: 50, cosmeticChance: 0,
    events: ['chased a butterfly all the way across the meadow', 'made friends with a sleepy ladybug', 'rolled down the biggest hill (three times)', 'found a four-leaf clover'],
  },
  {
    id: 'caves', name: 'Crystal Caves', emoji: '💎', minLevel: 3, hours: 3, steps: 4000, coins: [30, 60], chest: { kind: 'bronze', chance: 50 }, itemChance: 60, cosmeticChance: 5,
    events: ['followed glowing crystals deep underground', 'heard a mysterious echo singing back', 'slid down a sparkly crystal slide', 'woke up a very polite bat'],
  },
  {
    id: 'shrine', name: 'Sakura Shrine', emoji: '⛩️', minLevel: 5, hours: 6, steps: 7000, coins: [50, 90], chest: { kind: 'bronze', chance: 70 }, egg: { chance: 30, rarity: { common: 60, uncommon: 35, rare: 5 } }, itemChance: 60, cosmeticChance: 15,
    events: ['rang the shrine bell for good luck', 'caught falling cherry blossoms', 'shared mochi with a friendly fox spirit', 'climbed a thousand stone steps'],
  },
  {
    id: 'mountain', name: 'Moon Mountain', emoji: '🌙', minLevel: 8, hours: 12, steps: 12000, coins: [80, 150], chest: { kind: 'silver', chance: 45 }, egg: { chance: 30, rarity: { uncommon: 50, rare: 40, epic: 10 } }, itemChance: 70, cosmeticChance: 25,
    events: ['climbed above the clouds to touch the moon', 'counted shooting stars until sunrise', 'found a cave full of moonflowers', 'surfed down the mountain on a snow cloud'],
  },
];

export const PLACE_BY_ID: Record<string, Place> = Object.fromEntries(PLACES.map((p) => [p.id, p]));

/** "Now" in the game's clock (the demo skip-a-day button moves it forward too). */
export const gameNow = (s: GameState, now = Date.now()) => now + s.dayOffset * 86_400_000;
export const totalSteps = (s: GameState) => Object.values(s.days).reduce((a, d) => a + (d.steps || 0), 0);

export type StartCheck = { ok: true } | { ok: false; reason: string };

export function canStart(s: GameState, petId: string, placeId: string): StartCheck {
  const pet = s.pets.find((p) => p.id === petId);
  const place = PLACE_BY_ID[placeId];
  if (!pet || !place) return { ok: false, reason: 'Pick a pet and a place.' };
  if (s.expedition) return { ok: false, reason: 'Someone is already exploring. Wait for them to come home!' };
  if (levelFor(pet.xp) < place.minLevel) return { ok: false, reason: `${pet.nickname} needs to be level ${place.minLevel} to explore ${place.name}.` };
  return { ok: true };
}

export function start(s: GameState, petId: string, placeId: string, now = Date.now()): GameState {
  if (!canStart(s, petId, placeId).ok) return s;
  return { ...s, expedition: { petId, placeId, startedAt: gameNow(s, now), startSteps: totalSteps(s) } };
}

export interface Progress {
  place: Place;
  pct: number;
  done: boolean;
  msLeft: number;
  stepsLeft: number;
  stepsWalked: number;
}

export function progress(s: GameState, now = Date.now()): Progress | null {
  const e = s.expedition;
  if (!e) return null;
  const place = PLACE_BY_ID[e.placeId];
  if (!place) return null;
  const ms = place.hours * 3_600_000;
  const elapsed = Math.max(0, gameNow(s, now) - e.startedAt);
  const walked = Math.max(0, totalSteps(s) - e.startSteps);
  const pct = Math.min(1, Math.max(elapsed / ms, walked / place.steps));
  // Walking also shortens the timer: both kinds of progress count toward the same bar.
  const msLeft = pct >= 1 ? 0 : Math.round(ms * (1 - pct));
  const stepsLeft = pct >= 1 ? 0 : Math.ceil(place.steps * (1 - pct));
  return { place, pct, done: pct >= 1, msLeft, stepsLeft, stepsWalked: walked };
}

export interface ExpeditionLoot {
  coins: number;
  xp: number;
  chest: ChestKind | null;
  egg: Rarity | null;
  item: string | null;
  cosmetic: string | null;
  story: string;
  petName: string;
  speciesId: string;
}

/** Brings the pet home with its loot and a little story. */
export function finish(s: GameState, rng: Rng = defaultRng, now = Date.now()): { state: GameState; loot: ExpeditionLoot } | null {
  const p = progress(s, now);
  if (!p || !p.done || !s.expedition) return null;
  const place = p.place;
  const pet = s.pets.find((x) => x.id === s.expedition!.petId);
  const name = pet?.nickname ?? 'Your pet';
  const coins = randInt(place.coins[0], place.coins[1], rng);
  const xp = Math.round(place.steps / 50);
  const chest = place.chest && rng() * 100 < place.chest.chance ? place.chest.kind : null;
  const egg = place.egg && rng() * 100 < place.egg.chance ? (pickWeighted(place.egg.rarity as Record<Rarity, number>, rng) as Rarity) : null;
  const item = rng() * 100 < place.itemChance ? pickOne(COLLECTIBLES, rng) : null;
  let next: GameState = A.bump({ ...s, expedition: undefined, coins: s.coins + coins }, 'expeditions');
  const cosmetic = place.cosmeticChance && rng() * 100 < place.cosmeticChance ? rollChestCosmetic(next, 'gold', () => 0) : null;
  if (pet) next = { ...next, pets: next.pets.map((x) => (x.id === pet.id ? { ...x, xp: x.xp + xp } : x)) };
  if (chest) next = A.grantChest(next, chest, `Found at ${place.name}`, rng);
  if (egg) next = { ...next, eggs: [...next.eggs, A.newEgg(next, egg, rng)] };
  if (item) next = { ...next, items: { ...next.items, [item]: (next.items[item] ?? 0) + 1 } };
  if (cosmetic) next = grantCosmetic(next, cosmetic);
  const event = pickOne(place.events, rng);
  const found = [item ? `a ${item}` : null, chest ? `a ${chest[0].toUpperCase() + chest.slice(1)} chest` : null, egg ? 'a mysterious egg' : null].filter(Boolean);
  const story = `${name} ${event}${found.length ? `, and came home with ${found.join(' and ')}` : ''}!`;
  return { state: next, loot: { coins, xp, chest, egg, item, cosmetic, story, petName: name, speciesId: pet?.speciesId ?? 'p01' } };
}

/** Cancels an expedition early. The pet comes home with nothing, but nothing is lost either. */
export const recall = (s: GameState): GameState => ({ ...s, expedition: undefined });

export function formatLeft(ms: number): string {
  const m = Math.ceil(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
