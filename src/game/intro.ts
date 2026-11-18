import type { GameState, OwnedPet, Rarity, Skin } from './types';
import { SPECIES_BY_ID, speciesOfRarity } from './species';
import { SHINY_CHANCE } from './rarity';
import { makeId, pickOne, type Rng, defaultRng } from './random';
import { randomPersonality, rollIvs } from './stats';
import { skinKey } from './skins';
import { grantChest, todayKey } from './actions';

/**
 * The new player intro: three mystery eggs in a meadow, then a few questions that set up
 * goals and safety settings. Existing players only answer the birth year and goal questions, once.
 */

export type Focus = 'move' | 'water' | 'sleep';
export type Activity = 'low' | 'some' | 'high';

/** Starter egg odds (percent): mostly Common, a small chance of something rarer. */
export const STARTER_ODDS: { rarity: Rarity; pct: number }[] = [
  { rarity: 'common', pct: 85 },
  { rarity: 'uncommon', pct: 12 },
  { rarity: 'rare', pct: 3 },
];
/** Starter skin odds (percent): 91% normal. */
export const STARTER_SKINS: { skin: Skin; pct: number }[] = [
  { skin: 'mono', pct: 5 },
  { skin: 'silver', pct: 3 },
  { skin: 'gold', pct: 1 },
];

/** What each egg says when you tap it (the eggs give no hints about what's inside). */
export const EGG_LINES = ['A faint heartbeat stirs inside.', 'It’s warm, and humming quietly.', 'A soft glow pulses beneath the shell.'];

export interface StarterEgg {
  rarity: Rarity;
  skin?: Skin;
}

function rollFrom<T>(table: { pct: number }[], rng: Rng): number {
  let r = rng() * 100;
  for (let i = 0; i < table.length; i++) {
    if (r < table[i].pct) return i;
    r -= table[i].pct;
  }
  return -1;
}

/** Rolls what's inside one starter egg. */
export function rollStarterEgg(rng: Rng = defaultRng): StarterEgg {
  const ri = rollFrom(STARTER_ODDS, rng);
  const rarity = STARTER_ODDS[ri < 0 ? 0 : ri].rarity;
  const si = rollFrom(STARTER_SKINS, rng);
  return si < 0 ? { rarity } : { rarity, skin: STARTER_SKINS[si].skin };
}

/** Hatches the chosen starter egg: your first pet, set as active, plus a welcome chest. */
export function hatchStarter(s: GameState, egg: StarterEgg, rng: Rng = defaultRng): { state: GameState; pet: OwnedPet } {
  const pool = speciesOfRarity(egg.rarity);
  const species = pickOne(pool.length ? pool : speciesOfRarity('common'), rng);
  const pet: OwnedPet = {
    id: makeId(rng),
    speciesId: species.id,
    nickname: species.name,
    xp: 0,
    shiny: rng() < SHINY_CHANCE,
    hatchedOn: todayKey(s),
    ...(egg.skin ? { skin: egg.skin } : {}),
    personality: randomPersonality(rng),
    ivs: rollIvs(rng),
  };
  let next: GameState = {
    ...s,
    pets: [...s.pets, pet],
    activePetId: s.activePetId ?? pet.id,
    dex: { ...s.dex, [species.id]: true },
    stats: { ...s.stats, hatched: (s.stats?.hatched ?? 0) + 1 },
    ...(egg.skin ? { skinDex: { ...s.skinDex, [skinKey(species.id, egg.skin)]: true as const } } : {}),
    onboard: { ...s.onboard, hatched: true },
  };
  next = grantChest(next, 'bronze', 'Welcome gift', rng);
  return { state: next, pet };
}

/* ---------- Age ---------- */

export const MIN_AGE = 13;
/** Age at the end of this year (we only ask for the year). */
export const ageFrom = (birthYear: number, now = new Date()) => now.getFullYear() - birthYear;
/** Under 13 by the end of this year. (Someone turning 13 later this year is let in; we only ask the year.) */
export const tooYoung = (birthYear: number, now = new Date()) => ageFrom(birthYear, now) < MIN_AGE;
export const isTeen = (birthYear: number | undefined, now = new Date()) => !!birthYear && ageFrom(birthYear, now) < 18;

/* ---------- Goals ---------- */

export const DEFAULT_STEP_GOAL = 8000;
/** 64 oz a day, counted in 8 oz glasses. */
export const DEFAULT_WATER_GOAL = 8;
export const OZ_PER_GLASS = 8;
export const ML_PER_OZ = 29.57;
export const MIN_STEP_GOAL = 2000;
export const MAX_STEP_GOAL = 20000;

const round100 = (n: number) => Math.round(n / 100) * 100;
export const clampGoal = (n: number) => Math.min(MAX_STEP_GOAL, Math.max(MIN_STEP_GOAL, round100(n)));

/** Starting goal for people who skip Apple Health, from how active they say they are. */
export const ACTIVITY_GOAL: Record<Activity, number> = { low: 5000, some: 7000, high: 9000 };

/** From Apple Health's last 4 weeks: a goal a little above normal (about 10% more, at least 500). */
export function suggestGoal(avgSteps: number): number {
  if (!avgSteps || avgSteps < 500) return ACTIVITY_GOAL.low;
  return clampGoal(avgSteps + Math.max(500, avgSteps * 0.1));
}

export const stepGoal = (s: GameState) => s.goals?.steps ?? DEFAULT_STEP_GOAL;
export const waterGoal = (s: GameState) => s.goals?.water ?? DEFAULT_WATER_GOAL;

/** Water as the player likes to see it: "32 oz" or "950 mL". */
export function waterText(glasses: number, unit: 'oz' | 'ml' = 'oz'): string {
  const oz = glasses * OZ_PER_GLASS;
  return unit === 'ml' ? `${(Math.round((oz * ML_PER_OZ) / 50) * 50).toLocaleString()} mL` : `${Math.round(oz)} oz`;
}

/**
 * Once a week the step goal moves with you: up about 5% after a week with 5 or more goal days,
 * down about 5% after a week with 2 or fewer. Only for goals set up in the intro.
 */
export function weekKey(d: Date): string {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); // Monday
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

export function adjustGoal(s: GameState, now: Date, dayKey: (offsetDays: number) => string): GameState {
  if (!s.goals?.auto) return s;
  const wk = weekKey(now);
  if (s.goals.week === wk) return s;
  if (!s.goals.week) return { ...s, goals: { ...s.goals, week: wk } };
  // Look at the 7 days before this Monday.
  const sinceMonday = (now.getDay() + 6) % 7;
  let hit = 0;
  let logged = 0;
  for (let i = sinceMonday + 1; i <= sinceMonday + 7; i++) {
    const d = s.days[dayKey(-i)];
    if (!d) continue;
    logged++;
    if (d.steps >= (d.stepGoal ?? s.goals.steps)) hit++;
  }
  let steps = s.goals.steps;
  if (logged >= 3 && hit >= 5) steps = clampGoal(steps * 1.05);
  else if (logged >= 3 && hit <= 2) steps = clampGoal(steps * 0.95);
  return { ...s, goals: { ...s.goals, steps, week: wk, ...(steps !== s.goals.steps ? { changed: steps > s.goals.steps ? 'up' : 'down' } : {}) } };
}

/** The real species name, for showing a nickname as "Miso (Kitsune)". */
export const withSpecies = (p: { nickname: string; speciesId: string }) => {
  const sp = SPECIES_BY_ID[p.speciesId];
  return sp && sp.name !== p.nickname ? `${p.nickname} (${sp.name})` : p.nickname;
};

/** The intro (or quick setup) still needs to run. */
export const needsIntro = (s: GameState) => !s.onboard?.done;
