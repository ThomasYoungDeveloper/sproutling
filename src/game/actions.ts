import type { ChestKind, DayLog, Egg, Element, GameState, Meal, OwnedPet, Rarity } from './types';
import { addPotions } from './hp';
import { addCrystals, chestCrystals } from './powerups';
import { dateKey } from './dates';
import { emptyDay, scoreDay, dailyQuests, streakFrom, COINS_PER_XP } from './scoring';
import { boostedTotal } from './care';
import { grantCosmetic, rollChestCosmetic } from './cosmetics';
import { BRED_SKIN_BOOST, rollSkin, skinKey } from './skins';
import { randomPersonality, rollIvs, inheritIvs } from './stats';
import { openChest, type ChestResult } from './loot';
import { speciesOfRarity, SPECIES, SPECIES_BY_ID } from './species';
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
export const activeElement = (s: GameState) => { const p = activePet(s); return p ? SPECIES_BY_ID[p.speciesId]?.element : undefined; };

/** Apply a change to today's log and pay out any XP/coins gained by the change. */
export function updateToday(s: GameState, change: (d: DayLog) => DayLog): GameState {
  const key = todayKey(s);
  const before = today(s);
  const after = change({ ...before, meals: [...before.meals] });
  // XP includes today's care boost and the active pet's element bonus.
  const el = activeElement(s);
  const gained = boostedTotal(after, el) - boostedTotal(before, el);

  let next: GameState = { ...s, days: { ...s.days, [key]: after } };

  // Steps also warm every egg sitting in an incubator.
  const stepDelta = after.steps - before.steps;
  if (stepDelta > 0) {
    next.eggs = next.eggs.map((e) => (e.incubating ? { ...e, stepsWalked: e.stepsWalked + stepDelta } : e));
  }

  if (gained !== 0) {
    next.pets = next.pets.map((p) => (p.id === next.activePetId ? { ...p, xp: Math.max(0, p.xp + gained) } : p));
    // Coins follow the day's total XP, so undoing a habit takes its coins back (no farming by toggling).
    const coinDelta = Math.floor(boostedTotal(after, el) * COINS_PER_XP) - Math.floor(boostedTotal(before, el) * COINS_PER_XP);
    next.coins = Math.max(0, next.coins + coinDelta);
  }

  // Finishing all daily quests earns one bronze chest per day.
  if (!next.questChestDays[key] && dailyQuests(after).every((q) => q.done)) {
    next = grantChest(next, 'bronze', 'Finished all daily quests');
    next = addPotions(next, 'small', 1); // Hitting all 3 goals also gives a Small Potion.
    next.questChestDays = { ...next.questChestDays, [key]: true };
  }

  // A silver chest for every 7 days of streak (reached today).
  const st = streak(next);
  const silverKey = `silver-${key}`;
  if (st > 0 && st % 7 === 0 && !next.questChestDays[silverKey] && scoreDay(after).total >= 50) {
    next = grantChest(next, 'silver', `${st}-day streak`);
    next = addCrystals(next, 1); // Every 7-day streak also gives a Training Crystal.
    next.questChestDays = { ...next.questChestDays, [silverKey]: true };
    // Every 7 days of streak also earns a streak shield (you can hold 2).
    if (next.shieldEarnedOn !== key) next = { ...next, shields: Math.min(MAX_SHIELDS, (next.shields ?? 0) + 1), shieldEarnedOn: key };
  }
  return next;
}

export const MAX_SHIELDS = 2;

/**
 * Streak shields: if you missed a day while on a streak, a shield covers it automatically.
 * Checks the last couple of days; returns how many shields were used.
 */
export function applyShields(s: GameState): { state: GameState; used: number; saved: number } {
  let next = s;
  let used = 0;
  for (let off = -1; off >= -2; off--) {
    if ((next.shields ?? 0) <= 0) break;
    const day = getDay(next, off);
    const missed = !day || (!day.shielded && scoreDay(day).total < 50);
    if (!missed) break;
    // Only worth saving if there was a streak going before the missed day.
    const before = getDay(next, off - 1);
    if (!before || !(before.shielded || scoreDay(before).total >= 50)) break;
    const key = dateKey(next.dayOffset + off);
    next = { ...next, shields: (next.shields ?? 0) - 1, days: { ...next.days, [key]: { ...(day ?? emptyDay()), shielded: true } } };
    used++;
  }
  return { state: next, used, saved: used ? streak(next) : 0 };
}

/** Apple Health extras for today: activity rings, exercise and mindful minutes. Water only ever goes up. */
/**
 * Today's steps from Apple Health. The day's step count only goes up, and every step walked
 * since the last sync warms the eggs in incubators, even when steps typed in by hand earlier
 * already put the day's count above Health's.
 */
export function syncHealthSteps(s: GameState, total: number): GameState {
  const d = today(s);
  const base = d.healthSteps ?? Math.min(d.steps, total);
  const walked = Math.max(0, total - base);
  const raise = Math.max(0, total - d.steps);
  let next = raise > 0 ? addSteps(s, raise) : s;
  const extra = walked - raise;
  if (extra > 0) next = { ...next, eggs: next.eggs.map((e) => (e.incubating ? { ...e, stepsWalked: e.stepsWalked + extra } : e)) };
  const key = todayKey(next);
  return { ...next, days: { ...next.days, [key]: { ...next.days[key], healthSteps: total } } };
}

export const setHealthExtras = (s: GameState, x: { rings?: { move: number; exercise: number; stand: number }; exerciseMin?: number; mindfulMin?: number; water?: number }) =>
  updateToday(s, (d) => ({
    ...d,
    ...(x.rings ? { rings: x.rings } : {}),
    ...(x.exerciseMin !== undefined ? { exerciseMin: x.exerciseMin } : {}),
    ...(x.mindfulMin !== undefined ? { mindfulMin: x.mindfulMin } : {}),
    ...(x.water !== undefined && x.water > d.water ? { water: Math.min(20, x.water) } : {}),
  }));

/** No one walks more than this in a day; stops a stuck button or a typo from flooding guild goals. */
export const MAX_DAY_STEPS = 60000;
export const addSteps = (s: GameState, n: number) => updateToday(s, (d) => ({ ...d, steps: Math.min(MAX_DAY_STEPS, Math.max(0, d.steps + n)) }));

/** Brings an older or edited save in line with today's rules (step cap per day). */
export function cleanSave(s: GameState): GameState {
  let changed = false;
  const days = { ...s.days };
  for (const k of Object.keys(days)) {
    if ((days[k]?.steps ?? 0) > MAX_DAY_STEPS) {
      days[k] = { ...days[k], steps: MAX_DAY_STEPS };
      changed = true;
    }
  }
  return changed ? { ...s, days } : s;
}
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

/** Silver chests sometimes hold a Small Potion; Gold ones always do, and sometimes a Full one. */
export function chestPotions(kind: ChestKind, rng: Rng = defaultRng): { small: number; full: number } {
  if (kind === 'gold') return { small: 1, full: rng() < 0.4 ? 1 : 0 };
  if (kind === 'silver') return { small: rng() < 0.35 ? 1 : 0, full: 0 };
  return { small: 0, full: 0 };
}

export function openChestById(s: GameState, chestId: string, rng: Rng = defaultRng): OpenedChest | null {
  const chest = s.chests.find((c) => c.id === chestId);
  if (!chest) return null;
  const result = openChest(chest.kind, rng);
  let next: GameState = { ...s, chests: s.chests.filter((c) => c.id !== chestId), coins: s.coins + result.coins };
  if (result.eggRarity) next = { ...next, eggs: [...next.eggs, newEgg(next, result.eggRarity, rng)] };
  if (result.item) next = { ...next, items: { ...next.items, [result.item]: (next.items[result.item] ?? 0) + 1 } };
  const cosmetic = rollChestCosmetic(next, chest.kind, rng);
  if (cosmetic) next = grantCosmetic(next, cosmetic);
  const crystals = chestCrystals(chest.kind, rng);
  next = addCrystals(next, crystals);
  const potions = chestPotions(chest.kind, rng);
  if (potions.small) next = addPotions(next, 'small', potions.small);
  if (potions.full) next = addPotions(next, 'full', potions.full);
  next = bump(next, 'chests');
  return { state: next, result: { ...result, cosmetic, crystals, potions } };
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
  // Nursery eggs already know which pet is inside; wild eggs pick one of their rarity.
  const species = (egg.bred && SPECIES_BY_ID[egg.bred.speciesId]) || pickOne(speciesOfRarity(egg.rarity), rng);
  const skin = rollSkin(rng, egg.bred ? BRED_SKIN_BOOST : 1, egg.bred?.parentSkins ?? []);
  const pet: OwnedPet = {
    id: makeId(rng),
    speciesId: species.id,
    nickname: species.name,
    xp: 0,
    shiny: rng() < SHINY_CHANCE,
    hatchedOn: todayKey(s),
    ...(skin ? { skin } : {}),
    personality: randomPersonality(rng),
    ivs: egg.bred?.parentIvs ? inheritIvs(rng, egg.bred.parentIvs[0], egg.bred.parentIvs[1], egg.bred.lucky ?? 0) : rollIvs(rng),
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
      stats: { ...s.stats, hatched: (s.stats?.hatched ?? 0) + 1 },
      ...(skin ? { skinDex: { ...s.skinDex, [skinKey(species.id, skin)]: true as const } } : {}),
    },
  };
}

export const setActivePet = (s: GameState, id: string): GameState => (s.pets.some((p) => p.id === id) ? { ...s, activePetId: id } : s);
export const renamePet = (s: GameState, id: string, name: string): GameState => ({
  ...s,
  pets: s.pets.map((p) => (p.id === id ? { ...p, nickname: name.trim().slice(0, 14) || SPECIES_BY_ID[p.speciesId].name } : p)),
});
export const nextDay = (s: GameState): GameState => ({ ...s, dayOffset: s.dayOffset + 1 });

/** Brand-new players get one mystery egg: it hatches a random Common of any element, plus a welcome chest. */
export function chooseStarter(s: GameState, rng: Rng = defaultRng): Hatched {
  const pool = SPECIES.filter((x) => x.rarity === 'common');
  const species = pickOne(pool, rng);
  const pet: OwnedPet = { id: makeId(rng), speciesId: species.id, nickname: species.name, xp: 0, shiny: rng() < SHINY_CHANCE, hatchedOn: todayKey(s) };
  let next: GameState = { ...s, pets: [pet], activePetId: pet.id, dex: { ...s.dex, [species.id]: true } };
  next = grantChest(next, 'bronze', 'Welcome gift', rng);
  return { state: next, pet, isNew: true };
}

export const needsStarter = (s: GameState) => s.pets.length === 0;

/* ---------- Daily login rewards ---------- */

export interface LoginReward {
  coins: number;
  chest?: ChestKind;
}

/** A 7-day calendar that loops. Missing a day doesn't reset it: you pick up where you left off. */
export const LOGIN_REWARDS: LoginReward[] = [
  { coins: 25 },
  { coins: 40 },
  { coins: 0, chest: 'bronze' },
  { coins: 60 },
  { coins: 80 },
  { coins: 50, chest: 'bronze' },
  { coins: 100, chest: 'silver' },
];

/** Which calendar day (0-6) the next claim pays out, and whether today's is still waiting. */
export function loginStatus(s: GameState): { index: number; canClaim: boolean; claimedTotal: number } {
  const claimedTotal = s.login?.count ?? 0;
  const canClaim = s.login?.last !== todayKey(s);
  const index = canClaim ? claimedTotal % LOGIN_REWARDS.length : (claimedTotal - 1 + LOGIN_REWARDS.length) % LOGIN_REWARDS.length;
  return { index, canClaim, claimedTotal };
}

export function claimLogin(s: GameState, rng: Rng = defaultRng): { state: GameState; reward: LoginReward; day: number } | null {
  const st = loginStatus(s);
  if (!st.canClaim) return null;
  const reward = LOGIN_REWARDS[st.index];
  let next: GameState = { ...s, coins: s.coins + reward.coins, login: { last: todayKey(s), count: st.claimedTotal + 1 } };
  next = addPotions(next, 'small', 1); // Everyone gets one free Small Potion a day.
  if (reward.chest) next = grantChest(next, reward.chest, `Day ${st.index + 1} login reward`, rng);
  return { state: next, reward, day: st.index + 1 };
}

/* ---------- Friend gifts ---------- */

/** What one friend gift holds: coins, with a small chance of a surprise Bronze chest. */
export const GIFT_COINS = 20;
export const GIFT_CHEST_CHANCE = 0.1;
/** How many gifts a player can send per day (one per friend). */
export const GIFTS_PER_DAY = 3;

export function openGifts(s: GameState, count: number, rng: Rng = defaultRng): { state: GameState; coins: number; chests: number } {
  let next = s;
  let chests = 0;
  for (let i = 0; i < count; i++) {
    if (rng() < GIFT_CHEST_CHANCE) {
      next = grantChest(next, 'bronze', 'Surprise in a friend’s gift', rng);
      chests++;
    }
  }
  const coins = count * GIFT_COINS;
  return { state: { ...next, coins: next.coins + coins }, coins, chests };
}

/** Adds to a lifetime counter (used by achievements). */
export const bump = (s: GameState, key: keyof NonNullable<GameState['stats']>, by = 1): GameState => ({ ...s, stats: { ...s.stats, [key]: (s.stats?.[key] ?? 0) + by } });
