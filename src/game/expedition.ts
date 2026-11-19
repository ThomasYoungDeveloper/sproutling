import type { ChestKind, GameState, Rarity } from './types';
import { pickOne, pickWeighted, randInt, type Rng, defaultRng } from './random';
import { levelFor } from './scoring';
import { COLLECTIBLES } from './loot';
import { grantCosmetic, rollChestCosmetic } from './cosmetics';
import * as A from './actions';
import * as B from './battle';
import * as H from './hp';
import { WALK_FOODS, addFood } from './food';
import { seededRng } from './random';

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
  /** How many wild fights there can be on the way (picked at random each trip). */
  fights: [number, number];
}

export const PLACES: Place[] = [
  {
    id: 'meadow', fights: [0, 2], name: 'Mossy Meadow', emoji: '🌼', minLevel: 1, hours: 2, steps: 1500, coins: [15, 30], itemChance: 50, cosmeticChance: 0,
    events: ['chased a butterfly all the way across the meadow', 'made friends with a sleepy ladybug', 'rolled down the biggest hill (three times)', 'found a four-leaf clover'],
  },
  {
    id: 'caves', fights: [1, 3], name: 'Crystal Caves', emoji: '💎', minLevel: 3, hours: 5, steps: 4000, coins: [30, 60], chest: { kind: 'bronze', chance: 50 }, itemChance: 60, cosmeticChance: 5,
    events: ['followed glowing crystals deep underground', 'heard a mysterious echo singing back', 'slid down a sparkly crystal slide', 'woke up a very polite bat'],
  },
  {
    id: 'shrine', fights: [2, 4], name: 'Sakura Shrine', emoji: '⛩️', minLevel: 5, hours: 10, steps: 7000, coins: [50, 90], chest: { kind: 'bronze', chance: 70 }, egg: { chance: 10, rarity: { common: 60, uncommon: 35, rare: 5 } }, itemChance: 60, cosmeticChance: 15,
    events: ['rang the shrine bell for good luck', 'caught falling cherry blossoms', 'shared mochi with a friendly fox spirit', 'climbed a thousand stone steps'],
  },
  {
    id: 'mountain', fights: [2, 5], name: 'Moon Mountain', emoji: '🌙', minLevel: 8, hours: 18, steps: 12000, coins: [80, 150], chest: { kind: 'silver', chance: 45 }, egg: { chance: 10, rarity: { uncommon: 50, rare: 40, epic: 10 } }, itemChance: 70, cosmeticChance: 25,
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
  if (H.isKnockedOut(pet)) return { ok: false, reason: `${pet.nickname} is knocked out and resting. Its HP starts coming back within a few minutes.` };
  return { ok: true };
}

/** Wild pets on trips start with this share of their HP. */
export const WILD_STRENGTH = 0.5;

export interface TripFight {
  speciesId: string;
  name: string;
  won: boolean;
  /** Your pet's HP (percent) after this fight. */
  hpAfter: number;
  /** Where on the route it happens (0–1). */
  at?: number;
}

/**
 * Works out the wild fights on the way when the pet leaves (one pet against one wild pet each).
 * HP carries from fight to fight. If the pet is knocked out, the trip ends there.
 */
export function planFights(s: GameState, petId: string, place: Place, seed: string): TripFight[] {
  const pet = s.pets.find((p) => p.id === petId);
  if (!pet) return [];
  const rng = seededRng(seed);
  const setup = B.myBattleSetup(s);
  const lv = levelFor(pet.xp);
  let hp = H.hpPct(pet);
  const out: TripFight[] = [];
  // A random number of fights at random spots along the way, so no two trips feel the same.
  const count = randInt(place.fights[0], place.fights[1], rng);
  const spots = Array.from({ length: count }, () => 0.12 + rng() * 0.76).sort((a, b) => a - b);
  for (let i = 0; i < count; i++) {
    // Wild pets on the way are a little below your level, untrained, and not at full strength.
    // Foes match the place, not your pet: stronger pets breeze through easy places.
    const foeLevel = Math.max(1, Math.min(lv, place.minLevel + Math.floor(i / 2)) - 1);
    const foe = { ...B.wildTeam([foeLevel], rng)[0], train: {} };
    const b0 = B.startBattle([pet], [foe], setup.buffs, { care: setup.care, streak: setup.streak });
    const t = b0.theirs[0];
    const foeHp = Math.max(1, Math.round(t.maxHp * WILD_STRENGTH));
    const b = { ...b0, mine: [H.atSavedHp(b0.mine[0], hp)], theirs: [{ ...t, maxHp: foeHp, hp: foeHp }] };
    const end = B.simulate(b, rng).battle;
    const f = end.mine[0];
    hp = f.maxHp ? Math.max(0, Math.round((Math.max(0, f.hp) / f.maxHp) * 100)) : 0;
    const won = end.over === 'win';
    if (!won) hp = 0;
    out.push({ speciesId: foe.speciesId, name: foe.nickname, won, hpAfter: won ? Math.max(1, hp) : 0, at: Math.round(spots[i] * 1000) / 1000 });
    if (!won) break;
  }
  return out;
}

export function start(s: GameState, petId: string, placeId: string, now = Date.now()): GameState {
  if (!canStart(s, petId, placeId).ok) return s;
  const place = PLACE_BY_ID[placeId];
  const startedAt = gameNow(s, now);
  const fights = planFights(s, petId, place, `${petId}:${placeId}:${startedAt}`);
  const lost = fights.findIndex((f) => !f.won);
  // The loot is rolled now too, so the Live Activity can show stops along the way.
  const rng = seededRng(`loot:${petId}:${placeId}:${startedAt}`);
  const wins = fights.filter((f) => f.won).length;
  const foods: string[] = [];
  for (let i = 0; i < wins; i++) {
    const pool = WALK_FOODS.filter((f) => f.rarity === (rng() < 0.75 ? 'common' : 'uncommon'));
    foods.push((pool[Math.floor(rng() * pool.length)] ?? WALK_FOODS[0]).id);
  }
  const done = lost < 0;
  const planned: PlannedLoot = {
    foods,
    chest: done && place.chest && rng() * 100 < place.chest.chance ? place.chest.kind : null,
    egg: done && place.egg && rng() * 100 < place.egg.chance ? (pickWeighted(place.egg.rarity as Record<Rarity, number>, rng) as Rarity) : null,
    item: done && rng() * 100 < place.itemChance ? pickOne(COLLECTIBLES, rng) : null,
  };
  return {
    ...s,
    expedition: { petId, placeId, startedAt, startSteps: totalSteps(s), fights, planned, ...(lost >= 0 ? { koAt: fights[lost].at ?? 0.5 } : {}) },
  };
}

export interface PlannedLoot {
  foods: string[];
  chest: ChestKind | null;
  egg: Rarity | null;
  item: string | null;
}

/** Stops along the trip for the Live Activity: fights, food, and the treasure at the end. Times are fractions of the trip (0–1 of the full route). */
export function tripStops(s: GameState): { frac: number; kind: 'fight' | 'food' | 'end'; label: string; won?: boolean }[] {
  const e = s.expedition;
  const place = e && PLACE_BY_ID[e.placeId];
  if (!e || !place) return [];
  const out: { frac: number; kind: 'fight' | 'food' | 'end'; label: string; won?: boolean }[] = [];
  const fights = e.fights ?? [];
  let food = 0;
  fights.forEach((f, i) => {
    const frac = f.at ?? (i + 1) / (fights.length + 1);
    out.push({ frac, kind: 'fight', label: f.won ? 'Won' : 'Knocked out', won: f.won });
    if (f.won && e.planned?.foods[food]) out.push({ frac: frac + 0.04, kind: 'food', label: FOOD_NAME(e.planned.foods[food++]) });
  });
  if (!e.koAt) {
    const p = e.planned;
    out.push({ frac: 1, kind: 'end', label: p?.egg ? 'Egg' : p?.chest ? `${p.chest[0].toUpperCase() + p.chest.slice(1)} chest` : 'Treasure' });
  }
  return out;
}
const FOOD_NAME = (id: string) => WALK_FOODS.find((f) => f.id === id)?.name ?? 'Food';

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
  // A knocked-out pet comes home early: its trip ends at the fight it lost.
  const end = e.koAt ?? 1;
  // Time and steps add up: every step brings the pet home sooner, on top of the clock.
  const raw = elapsed / ms + walked / place.steps;
  const pct = Math.min(1, raw / end);
  // Walking also shortens the timer: both kinds of progress count toward the same bar.
  const msLeft = pct >= 1 ? 0 : Math.round(ms * end * (1 - pct));
  const stepsLeft = pct >= 1 ? 0 : Math.ceil(place.steps * end * (1 - pct));
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
  fights: TripFight[];
  knockedOut: boolean;
  /** Food won in fights on the way. */
  foods: string[];
  placeName: string;
  placeId: string;
}

/** Brings the pet home with its loot and a little story. */
export function finish(s: GameState, rng: Rng = defaultRng, now = Date.now()): { state: GameState; loot: ExpeditionLoot } | null {
  const p = progress(s, now);
  if (!p || !p.done || !s.expedition) return null;
  const place = p.place;
  const fights = s.expedition.fights ?? [];
  const knockedOut = fights.some((f) => !f.won);
  const wins = fights.filter((f) => f.won).length;
  // Knocked out: keep a share of the coins and XP for each fight won before that, and nothing else.
  const share = knockedOut ? (s.expedition.koAt ?? 0.5) * 0.6 : 1;
  const pet = s.pets.find((x) => x.id === s.expedition!.petId);
  const name = pet?.nickname ?? 'Your pet';
  const coins = Math.round(randInt(place.coins[0], place.coins[1], rng) * share);
  const xp = Math.round((place.steps / 50) * share);
  const planned = s.expedition.planned;
  const chest = knockedOut ? null : planned ? planned.chest : place.chest && rng() * 100 < place.chest.chance ? place.chest.kind : null;
  const egg = knockedOut ? null : planned ? planned.egg : place.egg && rng() * 100 < place.egg.chance ? (pickWeighted(place.egg.rarity as Record<Rarity, number>, rng) as Rarity) : null;
  const item = knockedOut ? null : planned ? planned.item : rng() * 100 < place.itemChance ? pickOne(COLLECTIBLES, rng) : null;
  let next: GameState = A.bump({ ...s, expedition: undefined, coins: s.coins + coins }, 'expeditions');
  const cosmetic = !knockedOut && place.cosmeticChance && rng() * 100 < place.cosmeticChance ? rollChestCosmetic(next, 'gold', () => 0) : null;
  // Each wild pet beaten on the way drops a piece of food.
  const foods: string[] = planned ? planned.foods.slice(0, wins) : [];
  if (!planned) {
    for (let i = 0; i < wins; i++) {
      const pool = WALK_FOODS.filter((f) => f.rarity === (rng() < 0.75 ? 'common' : 'uncommon'));
      foods.push((pool[Math.floor(rng() * pool.length)] ?? WALK_FOODS[0]).id);
    }
  }
  for (const id of foods) next = addFood(next, id);
  if (pet && fights.length) next = H.setHp(next, pet.id, fights[fights.length - 1].hpAfter);
  if (pet) next = { ...next, pets: next.pets.map((x) => (x.id === pet.id ? { ...x, xp: x.xp + xp } : x)) };
  if (chest) next = A.grantChest(next, chest, `Found at ${place.name}`, rng);
  let eggCoins = 0;
  if (egg) {
    const r = A.addEgg(next, egg, rng);
    next = r.state;
    eggCoins = r.coins;
  }
  if (item) next = { ...next, items: { ...next.items, [item]: (next.items[item] ?? 0) + 1 } };
  if (cosmetic) next = grantCosmetic(next, cosmetic);
  const event = pickOne(place.events, rng);
  const found = [item ? `a ${item}` : null, chest ? `a ${chest[0].toUpperCase() + chest.slice(1)} chest` : null, egg && !eggCoins ? 'a mysterious egg' : null, eggCoins ? `an egg that became ${eggCoins} coins (basket full)` : null].filter(Boolean);
  const lostTo = fights.find((f) => !f.won);
  const story = knockedOut
    ? `${name} was knocked out by a ${lostTo?.name ?? 'wild pet'} and came home early.`
    : `${name} ${event}${found.length ? `, and came home with ${found.join(' and ')}` : ''}!`;
  return { state: next, loot: { coins: coins + eggCoins, xp, chest, egg: eggCoins ? null : egg, item, cosmetic, story, petName: name, speciesId: pet?.speciesId ?? 'p01', fights, knockedOut, foods, placeName: place.name, placeId: place.id } };
}

/** Cancels an expedition early. The pet comes home with nothing, but nothing is lost either. */
export const recall = (s: GameState): GameState => ({ ...s, expedition: undefined });

export function formatLeft(ms: number): string {
  const m = Math.ceil(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
