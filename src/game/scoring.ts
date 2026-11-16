import type { DayLog, Stage } from './types';

export const emptyDay = (): DayLog => ({ steps: 0, sleepHours: 0, water: 0, workoutMinutes: 0, meals: [] });

export interface DayScore {
  steps: number;
  sleep: number;
  water: number;
  workout: number;
  meals: number;
  quests: number;
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
    { id: 'meals', label: 'Log 3 meals', done: d.meals.length >= 3, progress: `${Math.min(d.meals.length, 3)} / 3` },
  ];
}

/** XP is capped per habit so steady days beat one extreme day. */
export function scoreDay(d: DayLog): DayScore {
  const steps = Math.min(Math.floor(d.steps / 100), 120) + (d.steps >= 8000 ? 20 : 0);
  let sleep = 0;
  if (d.sleepHours >= 7 && d.sleepHours <= 9) sleep = 30;
  else if ((d.sleepHours >= 6 && d.sleepHours < 7) || (d.sleepHours > 9 && d.sleepHours <= 10)) sleep = 15;
  const water = Math.min(d.water, 8) * 4;
  const workout = Math.min(d.workoutMinutes, 60);
  const logged = d.meals.slice(0, 4);
  const meals = logged.length * 5 + logged.filter((m) => m.veggies).length * 5;
  const quests = dailyQuests(d).filter((q) => q.done).length * 15;
  return { steps, sleep, water, workout, meals, quests, total: steps + sleep + water + workout + meals + quests };
}

export const STAGE_XP: Record<Stage, number> = { baby: 0, teen: 300, adult: 1000 };

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
  if (scoreDay(getDay(0) ?? emptyDay()).total < 50) offset = -1;
  let n = 0;
  while (scoreDay(getDay(offset) ?? emptyDay()).total >= 50) {
    n++;
    offset--;
  }
  return n;
}
