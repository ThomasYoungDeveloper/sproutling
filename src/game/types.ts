export type Element = 'flower' | 'moon' | 'ember' | 'tide';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type Stage = 'baby' | 'teen' | 'adult';

export interface Species {
  id: string;
  name: string;
  rarity: Rarity;
  element: Element;
  blurb: string;
}

export interface Meal {
  name: string;
  calories: number | null;
  veggies: boolean;
}

export interface DayLog {
  steps: number;
  sleepHours: number;
  water: number;
  workoutMinutes: number;
  meals: Meal[];
}

export interface OwnedPet {
  id: string;
  speciesId: string;
  nickname: string;
  xp: number;
  shiny: boolean;
  hatchedOn: string;
}

export interface Egg {
  id: string;
  rarity: Rarity;
  /** Steps walked while this egg sat in an incubator. */
  stepsWalked: number;
  incubating: boolean;
  foundOn: string;
}

export type ChestKind = 'bronze' | 'silver' | 'gold';

export interface Chest {
  id: string;
  kind: ChestKind;
  earnedOn: string;
  reason: string;
}

export interface GameState {
  version: 1;
  coins: number;
  activePetId: string | null;
  pets: OwnedPet[];
  eggs: Egg[];
  chests: Chest[];
  incubatorSlots: number;
  items: Record<string, number>;
  /** Species ids the player has ever hatched. */
  dex: Record<string, true>;
  days: Record<string, DayLog>;
  /** Dates (YYYY-MM-DD) whose daily quest chest was already earned. */
  questChestDays: Record<string, true>;
  /** Demo-only: shift "today" forward to test multi-day play. */
  dayOffset: number;
  /** Daily login rewards: last day claimed and how many claimed in total. */
  login?: { last: string; count: number };
}
