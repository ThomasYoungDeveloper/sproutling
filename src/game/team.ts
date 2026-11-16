import type { GameState } from './types';
import * as A from './actions';

/** Each member adds 25,000 steps to the weekly goal (about 3,500 a day). The super goal is double. */
export const STEPS_PER_MEMBER = 25000;
export const teamGoal = (members: number) => Math.max(1, members) * STEPS_PER_MEMBER;

/** Monday of the week that contains a YYYY-MM-DD date. */
export function weekStart(day: string): string {
  const d = new Date(day + 'T12:00:00Z');
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

/** Your steps from Monday through today. */
export function weekSteps(s: GameState): number {
  const today = A.todayKey(s);
  const from = weekStart(today);
  return Object.entries(s.days)
    .filter(([k]) => k >= from && k <= today)
    .reduce((sum, [, d]) => sum + (d.steps || 0), 0);
}

export const TEAM_EMOJIS = ['🌱', '🦊', '🐉', '⭐', '🌸', '🚀', '🐼', '🍙'];
