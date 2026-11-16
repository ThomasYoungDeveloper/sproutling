import type { GameState } from './types';
import { dateKey } from './dates';

/** Starting state for a new player: a starter Mochi, one Common egg already warming, and a sample week. */
export function newGame(): GameState {
  const m = (name: string, calories: number | null, veggies: boolean) => ({ name, calories, veggies });
  const days: GameState['days'] = {};
  const sample: [number, GameState['days'][string]][] = [
    [-3, { steps: 8200, sleepHours: 7, water: 6, workoutMinutes: 30, meals: [m('Greek yogurt', 180, true), m('Chicken salad', 420, true), m('Tacos', 600, false)] }],
    [-2, { steps: 7100, sleepHours: 7.5, water: 5, workoutMinutes: 15, meals: [m('Cereal', 250, false), m('Burger', 780, false), m('Veggie soup', 320, true)] }],
    [-1, { steps: 9300, sleepHours: 8, water: 8, workoutMinutes: 30, meals: [m('Eggs & toast', 380, false), m('Sushi', 500, false), m('Chicken & rice', 700, true)] }],
    [0, { steps: 4200, sleepHours: 7.5, water: 3, workoutMinutes: 0, meals: [m('Oatmeal & berries', 320, true)] }],
  ];
  sample.forEach(([o, d]) => (days[dateKey(o)] = d));
  return {
    version: 1,
    coins: 120,
    activePetId: 'starter',
    pets: [{ id: 'starter', speciesId: 'mochi', nickname: 'Mochi', xp: 240, shiny: false, hatchedOn: dateKey(-3) }],
    eggs: [
      { id: 'egg1', rarity: 'common', stepsWalked: 2100, incubating: true, foundOn: dateKey(-1) },
      { id: 'egg2', rarity: 'rare', stepsWalked: 0, incubating: false, foundOn: dateKey(0) },
    ],
    chests: [{ id: 'chest1', kind: 'bronze', earnedOn: dateKey(-1), reason: 'Finished all daily quests' }],
    incubatorSlots: 1,
    items: { 'Moon Seed': 1 },
    dex: { mochi: true },
    days,
    questChestDays: { [dateKey(-1)]: true, [dateKey(-3)]: true },
    dayOffset: 0,
  };
}
