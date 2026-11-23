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

/** Typed-in steps count up to this many a day toward guild goals and the boss; Apple Health steps always count in full. */
export const TYPED_DAILY_CAP = 10_000;

/** Your steps from Monday through today for the guild: Health steps in full, typed-in steps up to 10,000 a day. */
export function guildWeekSteps(s: GameState): number {
  const today = A.todayKey(s);
  const from = weekStart(today);
  return Object.entries(s.days)
    .filter(([k]) => k >= from && k <= today)
    .reduce((sum, [, d]) => {
      const steps = d.steps || 0;
      const verified = Math.min(steps, d.healthSteps ?? 0);
      return sum + verified + Math.min(TYPED_DAILY_CAP, steps - verified);
    }, 0);
}

export const TEAM_EMOJIS = ['🌱', '🦊', '🐉', '⭐', '🌸', '🚀', '🐼', '🍙'];

/** The weekly guild boss: a giant legendary, rotating each week. */
export const RAID_BOSSES = [
  { speciesId: 'p29', name: 'Giant Komainu', title: 'Shrine Guardian' },
  { speciesId: 'p31', name: 'Giant Void Wraith', title: 'Starlight Terror' },
  { speciesId: 'p62', name: 'Giant Torii Spirit', title: 'Gate of Trials' },
  { speciesId: 'p15', name: 'Giant Kitsune', title: 'Nine-Tailed Trickster' },
] as const;
export const RAID_HITS_PER_DAY = 5;
export const RAID_MAX_HIT = 400;

export function raidBoss(week: string) {
  const n = Math.floor(Date.parse(week + 'T12:00:00Z') / (7 * 86400000));
  return RAID_BOSSES[((n % RAID_BOSSES.length) + RAID_BOSSES.length) % RAID_BOSSES.length];
}
