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
  /** A streak shield saved this day. */
  shielded?: boolean;
  /** Today's pet care. Each completed care task boosts today's XP. */
  care?: DayCare;
  /** Apple Watch / iPhone activity rings as a fraction of each goal (1 = closed). Only from Apple Health. */
  rings?: { move: number; exercise: number; stand: number };
  /** Apple Health's step count at the last sync today, so eggs warm from real walking even if steps were also typed in. */
  healthSteps?: number;
  /** Exercise minutes (any kind of workout counts). Only from Apple Health. */
  exerciseMin?: number;
  /** Mindful minutes (meditation, breathing). Only from Apple Health. */
  mindfulMin?: number;
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
  /** A rare color variant, if this pet has one. */
  skin?: Skin;
  /** Battle personality (older pets get one worked out from their id). */
  personality?: import('./stats').Personality;
  /** Stat points spent through training. */
  train?: import('./stats').Training;
  /** Hidden quality values (0–15 each) that make up the pet's grade. */
  ivs?: import('./stats').Ivs;
  /** The moves this pet brings to battle (up to 4). */
  moves?: string[];
  /** Game time (ms) until this pet can breed again. */
  restUntil?: number;
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
  /** Eggs from the Pet Nursery: who the parents were and which pet will hatch. */
  bred?: { speciesId: string; parents: [string, string]; parentSkins: (Skin | null)[]; parentIvs?: [import('./stats').Ivs, import('./stats').Ivs]; lucky?: number };
}

/** Rare color variants of a pet. */
export type Skin = 'mono' | 'silver' | 'gold' | 'rainbow';

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
  /** Streak shields ready to protect a missed day (up to 2). */
  shields?: number;
  /** The last day a shield was earned (one per 7-day streak). */
  shieldEarnedOn?: string;
  /** Lifetime counters for achievements. */
  stats?: { hatched?: number; chests?: number; expeditions?: number; toys?: number; bred?: number };
  /** Every pet-and-skin combination you've ever owned, keyed "p15:gold". */
  skinDex?: Record<string, true>;
  /** Achievements whose rewards you've claimed. */
  achievements?: Record<string, true>;
  /** Seasonal event rewards claimed, by event run (e.g. "winter-2026") → milestone indexes. */
  events?: Record<string, number[]>;
  /** A pet out exploring. */
  expedition?: { petId: string; placeId: string; startedAt: number; startSteps: number };
  /** Cosmetics you own. */
  wardrobe?: Record<string, true>;
  /** The scene behind your pet (cosmetic id); the home meadow when unset. */
  scene?: string;
  /** Completed trades already swapped into this save. */
  appliedTrades?: Record<string, true>;
  /** Walking finds today: how many 1,000-step marks were rolled and how many finds came up. */
  walkFinds?: { day: string; checked: number; found: number };
  /** The day a Training Crystal was last bought in the shop (one a day). */
  crystalShopDay?: string;
  /** The first-time walkthrough has been seen. */
  tutorialDone?: boolean;
  /** Battle record and today's rewarded battles. */
  battle?: { day: string; rewarded: number; wonToday: boolean; wins: number; losses: number };
}
