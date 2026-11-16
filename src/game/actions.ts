import type { ChestKind, DayLog, Egg, GameState, Meal, OwnedPet, Rarity } from './types';
import { dateKey } from './dates';
import { emptyDay, scoreDay, dailyQuests, streakFrom, COINS_PER_XP } from './scoring';
import { openChest, type ChestResult } from './loot';
import { speciesOfRarity, SPECIES_BY_ID } from './species';
import { SHINY_CHANCE, stepsToHatch } from './rarity';
import { makeId, pickOne, type Rng, defaultRng } from './random';

/**
 * Pure game rules. Every function takes a state and returns a NEW state, so the same
 * logic can later run on the server to verify progress instead of trusting the device.
 */

export const todayKey = (s: GameState) => dateKey(s.dayOffset);
export const getDay = (s: GameState, offset = 0): DayLog | undefined => s.days[dateKey(s.dayOffset + offset)];
export const today = (s: GameState): DayLog => getDay(s) ?? emptyDay();
export const streak = (s: GameState) => streakFrom((o) => getDay(s, o));
export const activePet = (s: GameState): OwnedPet | undefined => s.pets.find((p) => p.id === s.activePetId);

/** Apply a change to today's log and pay out any XP/coins gained by the change. */
export function updateToday(s: GameState, change: (d: DayLog) => DayLog): GameState {
  const key = todayKey(s);
  const before = today(s);
  const after = change({ ...before, meals: [...before.meals] });
  const gained = scoreDay(after).total - scoreDay(before).total;

  let next: GameState = { ...s, days: { ...s.days, [key]: after } };

  // Steps also warm every egg sitting in an incubator.
  const stepDelta = after.steps - before.steps;
  if (stepDelta > 0) {
    next.eggs = next.eggs.map((e) => (e.incubating ? { ...e, stepsWalked: e.stepsWalked + stepDelta } : e));
  }

  if (gained !== 0) {
    next.pets = next.pets.map((p) => (p.id === next.activePetId ? { ...p, xp: Math.max(0, p.xp + gained) } : p));
    // Coins follow the day's total XP, so undoing a habit takes its coins back (no farming by toggling).
    const coinDelta = Math.floor(scoreDay(after).total * COINS_PER_XP) - Math.floor(scoreDay(before).total * COINS_PER_XP);
    next.coins = Math.max(0, next.coins + coinDelta);
  }

  // Finishing all daily quests earns one bronze chest per day.
  if (!next.questChestDays[key] && dailyQuests(after).every((q) => q.done)) {
    next = grantChest(next, 'bronze', 'Finished all daily quests');
    next.questChestDays = { ...next.questChestDays, [key]: true };
  }

  // A silver chest for every 7 days of streak (reached today).
  const st = streak(next);
  const silverKey = `silver-${key}`;
  if (st > 0 && st % 7 === 0 && !next.questChestDays[silverKey] && scoreDay(after).total >= 50) {
    next = grantChest(next, 'silver', `${st}-day streak`);
    next.questChestDays = { ...next.questChestDays, [silverKey]: true };
  }
  return next;
}

export const addSteps = (s: GameState, n: number) => updateToday(s, (d) => ({ ...d, steps: Math.max(0, d.steps + n) }));
export const setSleep = (s: GameState, h: number) => updateToday(s, (d) => ({ ...d, sleepHours: Math.min(14, Math.max(0, h)) }));
export const setWater = (s: GameState, n: number) => updateToday(s, (d) => ({ ...d, water: Math.min(12, Math.max(0, n)) }));
export const addWorkout = (s: GameState, n: number) => updateToday(s, (d) => ({ ...d, workoutMinutes: Math.max(0, d.workoutMinutes + n) }));
export const addMeal = (s: GameState, m: Meal) => updateToday(s, (d) => ({ ...d, meals: [...d.meals, m] }));
export const removeMeal = (s: GameState, i: number) => updateToday(s, (d) => ({ ...d, meals: d.meals.filter((_, j) => j !== i) }));

export function grantChest(s: GameState, kind: ChestKind, reason: string, rng: Rng = defaultRng): GameState {
  return { ...s, chests: [...s.chests, { id: makeId(rng), kind, earnedOn: todayKey(s), reason }] };
}

export function newEgg(s: GameState, rarity: Rarity, rng: Rng = defaultRng): Egg {
  return { id: makeId(rng), rarity, stepsWalked: 0, incubating: false, foundOn: todayKey(s) };
}

export interface OpenedChest {
  state: GameState;
  result: ChestResult;
}

export function openChestById(s: GameState, chestId: string, rng: Rng = defaultRng): OpenedChest | null {
  const chest = s.chests.find((c) => c.id === chestId);
  if (!chest) return null;
  const result = openChest(chest.kind, rng);
  let next: GameState = { ...s, chests: s.chests.filter((c) => c.id !== chestId), coins: s.coins + result.coins };
  if (result.eggRarity) next = { ...next, eggs: [...next.eggs, newEgg(next, result.eggRarity, rng)] };
  if (result.item) next = { ...next, items: { ...next.items, [result.item]: (next.items[result.item] ?? 0) + 1 } };
  return { state: next, result };
}

export const incubatingCount = (s: GameState) => s.eggs.filter((e) => e.incubating).length;

export function incubate(s: GameState, eggId: string): GameState {
  if (incubatingCount(s) >= s.incubatorSlots) return s;
  return { ...s, eggs: s.eggs.map((e) => (e.id === eggId ? { ...e, incubating: true } : e)) };
}

export const isReady = (e: Egg) => e.incubating && e.stepsWalked >= stepsToHatch(e.rarity);

export interface Hatched {
  state: GameState;
  pet: OwnedPet;
  isNew: boolean;
}

export function hatch(s: GameState, eggId: string, rng: Rng = defaultRng): Hatched | null {
  const egg = s.eggs.find((e) => e.id === eggId);
  if (!egg || !isReady(egg)) return null;
  const species = pickOne(speciesOfRarity(egg.rarity), rng);
  const pet: OwnedPet = {
    id: makeId(rng),
    speciesId: species.id,
    nickname: species.name,
    xp: 0,
    shiny: rng() < SHINY_CHANCE,
    hatchedOn: todayKey(s),
  };
  const isNew = !s.dex[species.id];
  return {
    pet,
    isNew,
    state: {
      ...s,
      eggs: s.eggs.filter((e) => e.id !== eggId),
      pets: [...s.pets, pet],
      dex: { ...s.dex, [species.id]: true },
      activePetId: s.activePetId ?? pet.id,
    },
  };
}

export const setActivePet = (s: GameState, id: string): GameState => (s.pets.some((p) => p.id === id) ? { ...s, activePetId: id } : s);
export const renamePet = (s: GameState, id: string, name: string): GameState => ({
  ...s,
  pets: s.pets.map((p) => (p.id === id ? { ...p, nickname: name.trim().slice(0, 14) || SPECIES_BY_ID[p.speciesId].name } : p)),
});
export const nextDay = (s: GameState): GameState => ({ ...s, dayOffset: s.dayOffset + 1 });
