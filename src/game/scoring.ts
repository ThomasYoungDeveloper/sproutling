import type { DayLog, Element, Stage } from './types';

export const emptyDay = (): DayLog => ({ steps: 0, sleepHours: 0, water: 0, workoutMinutes: 0, meals: [] });

export interface DayScore {
  steps: number;
  sleep: number;
  water: number;
  workout: number;
  meals: number;
  quests: number;
  /** Extra XP from the active pet's element. */
  bonus: number;
  total: number;
}

export interface Quest {
  id: string;
  label: string;
  done: boolean;
  progress: string;
}

export function dailyQuests(d: DayLog): Quest[] {
  return [
    { id: 'walk', label: 'Walk 8,000 steps', done: d.steps >= 8000, progress: `${Math.min(d.steps, 8000).toLocaleString()} / 8,000` },
    { id: 'water', label: 'Drink 6 glasses of water', done: d.water >= 6, progress: `${Math.min(d.water, 6)} / 6` },
    { id: 'sleep', label: 'Sleep 7 hours or more', done: d.sleepHours >= 7, progress: `${d.sleepHours} / 7 h` },
  ];
}

/** XP is capped per habit so steady days beat one extreme day. */
/** Your active pet's element doubles the XP from one habit (Ember gives +50% walking). */
export const ELEMENT_HABIT: Record<Element, { habit: 'steps' | 'sleep' | 'water' | 'quests'; mult: number; label: string; emoji: string }> = {
  ember: { habit: 'steps', mult: 1.5, label: '+50% walking XP', emoji: '🔥' },
  tide: { habit: 'water', mult: 2, label: 'Double water XP', emoji: '🌊' },
  moon: { habit: 'sleep', mult: 2, label: 'Double sleep XP', emoji: '🌙' },
  flower: { habit: 'quests', mult: 2, label: 'Double quest XP', emoji: '🌸' },
};

export function scoreDay(d: DayLog, element?: Element): DayScore {
  let steps = Math.min(Math.floor(d.steps / 100), 120) + (d.steps >= 8000 ? 20 : 0);
  let sleep = 0;
  if (d.sleepHours >= 7 && d.sleepHours <= 9) sleep = 30;
  else if ((d.sleepHours >= 6 && d.sleepHours < 7) || (d.sleepHours > 9 && d.sleepHours <= 10)) sleep = 15;
  let water = Math.min(d.water, 8) * 4;
  const workout = Math.min(d.workoutMinutes, 60);
  const logged = d.meals.slice(0, 4);
  const meals = logged.length * 5 + logged.filter((m) => m.veggies).length * 5;
  let quests = dailyQuests(d).filter((q) => q.done).length * 15;
  let bonus = 0;
  if (element) {
    const eb = ELEMENT_HABIT[element];
    const base = { steps, sleep, water, quests }[eb.habit];
    bonus = Math.floor(base * (eb.mult - 1));
    if (eb.habit === 'steps') steps += bonus;
    if (eb.habit === 'sleep') sleep += bonus;
    if (eb.habit === 'water') water += bonus;
    if (eb.habit === 'quests') quests += bonus;
  }
  return { steps, sleep, water, workout, meals, quests, bonus, total: steps + sleep + water + workout + meals + quests };
}

/* ---------- Levels ---------- */

/** Total XP needed to reach a level: Lv2 50, Lv3 150, Lv4 300, Lv5 500, Lv7 1,050, Lv10 2,250. */
export const xpForLevel = (level: number) => 25 * level * (level - 1);
export const MAX_LEVEL = 50;

export function levelFor(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}

/** Where a pet is inside its current level, for the XP bar. */
export function levelProgress(xp: number): { level: number; into: number; need: number; max: boolean } {
  const level = levelFor(xp);
  if (level >= MAX_LEVEL) return { level, into: 1, need: 1, max: true };
  const from = xpForLevel(level);
  return { level, into: xp - from, need: xpForLevel(level + 1) - from, max: false };
}

/** Pets grow into a teen at level 4 and an adult at level 7. */
export const STAGE_LEVEL: Record<Stage, number> = { baby: 1, teen: 4, adult: 7 };
export const STAGE_XP: Record<Stage, number> = { baby: 0, teen: xpForLevel(STAGE_LEVEL.teen), adult: xpForLevel(STAGE_LEVEL.adult) };

export function stageFor(xp: number): Stage {
  if (xp >= STAGE_XP.adult) return 'adult';
  if (xp >= STAGE_XP.teen) return 'teen';
  return 'baby';
}

export function nextStage(stage: Stage): Stage | null {
  return stage === 'baby' ? 'teen' : stage === 'teen' ? 'adult' : null;
}

/** 1 coin for every 4 XP earned. */
export const COINS_PER_XP = 1 / 4;

/** Consecutive days (ending today, or yesterday if today has no activity yet) with 50+ XP. */
export function streakFrom(getDay: (offset: number) => DayLog | undefined): number {
  let offset = 0;
  const counts = (d?: DayLog) => !!d && (d.shielded || scoreDay(d).total >= 50);
  if (!counts(getDay(0))) offset = -1;
  let n = 0;
  while (counts(getDay(offset))) {
    n++;
    offset--;
  }
  return n;
}
