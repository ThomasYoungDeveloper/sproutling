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
  /** Hidden for now (kept so goal-based nutrition and workouts can come back later). */
  workoutMinutes: number;
  meals: Meal[];
  /** Today's pet care. Each completed care task boosts today's XP. */
  care?: DayCare;
}

export interface DayCare {
  fed?: boolean;
  /** Play sessions today (3 completes the task). */
  played?: number;
  /** A trinket from your bag was given as a treat. */
  treat?: boolean;
}

export interface OwnedPet {
  id: string;
  speciesId: string;
  nickname: string;
  xp: number;
  shiny: boolean;
  hatchedOn: string;
  /** What this pet is wearing (cosmetic ids). */
  look?: { hat?: string; aura?: string };
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
  /** Lifetime counters for achievements. */
  stats?: { hatched?: number; chests?: number; expeditions?: number; toys?: number };
  /** Achievements whose rewards you've claimed. */
  achievements?: Record<string, true>;
  /** A pet out exploring. */
  expedition?: { petId: string; placeId: string; startedAt: number; startSteps: number };
  /** Cosmetics you own. */
  wardrobe?: Record<string, true>;
  /** The scene behind your pet (cosmetic id); the home meadow when unset. */
  scene?: string;
  /** Completed trades already swapped into this save. */
  appliedTrades?: Record<string, true>;
  /** Battle record and today's rewarded battles. */
  battle?: { day: string; rewarded: number; wonToday: boolean; wins: number; losses: number };
}
