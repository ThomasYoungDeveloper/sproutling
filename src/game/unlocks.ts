import type { GameState } from './types';
import { levelFor, xpForLevel } from './scoring';

/**
 * The unlock plan: the core game is open from level 1, and the rest opens one thing at a time
 * as your highest pet levels up, so new players aren't hit with everything at once.
 * Players who started before this keep everything open.
 */

export type Feature = 'shop' | 'trips' | 'battles' | 'guild' | 'tower' | 'breeding';

export interface FeatureInfo {
  id: Feature;
  level: number;
  name: string;
  /** Shown on the "now open" card. */
  title: string;
  /** A short, teasing line (not a list of rules). */
  text: string;
  /** The same tease using the pet's name, for the pop-up and notification. */
  tease: (pet: string) => string;
  /** One line for the "Coming up" teaser. */
  soon: string;
  /** The one-line pointer shown on the feature after Try it now. */
  hint?: string;
  /** Where to find it, for the card's button. */
  go: 'home' | 'friends' | 'dex' | 'shop';
}

export const FEATURES: FeatureInfo[] = [
  { id: 'shop', level: 2, name: 'Shops', title: 'The shops are open!', text: 'Two shops just opened their doors. Go see what’s on the shelves.', tease: () => 'Two shops just opened their doors. Go see what’s on the shelves.', soon: 'Spend your coins on new looks', go: 'shop' },
  { id: 'trips', hint: 'Tap here and pick a pet to start your first trip', level: 3, name: 'Trips', title: 'Trips are open!', text: 'Send a pet into the wild. Who knows what it’ll bring home?', tease: (p) => `Send ${p} into the wild. Who knows what it’ll bring home?`, soon: 'Send your pet off exploring', go: 'home' },
  { id: 'battles', hint: 'Wild pets and friend battles live here', level: 4, name: 'Battles', title: 'Battles are open!', text: 'Something’s rustling out there. Is your pet ready?', tease: (p) => `Something’s rustling out there. Is ${p} ready?`, soon: 'Something’s rustling out there', go: 'friends' },
  { id: 'guild', hint: 'Join a guild or start your own here', level: 5, name: 'Guilds', title: 'Guilds are open!', text: 'Team up and take on something too big to face alone.', tease: () => 'Team up and take on something too big to face alone.', soon: 'Team up with other players', go: 'friends' },
  { id: 'tower', hint: 'Climb the Sky Tower here', level: 6, name: 'Sky Tower', title: 'The Sky Tower is open!', text: 'A tower has appeared in the clouds. How high can you climb?', tease: () => 'A tower has appeared in the clouds. How high can you climb?', soon: 'Something is up in the clouds', go: 'friends' },
  { id: 'breeding', hint: 'Pick two pets to make an egg', level: 8, name: 'The Nursery', title: 'The Nursery is open!', text: 'Two pets, one egg… what will hatch?', tease: () => 'Two pets, one egg… what will hatch?', soon: 'Breed stronger pets', go: 'dex' },
];
export const FEATURE_BY_ID = Object.fromEntries(FEATURES.map((f) => [f.id, f])) as Record<Feature, FeatureInfo>;

/** Your highest pet's level. */
export const topLevel = (s: GameState) => s.pets.reduce((m, p) => Math.max(m, levelFor(p.xp)), 1);
/** XP your best pet still needs to reach a level. */
export const xpToLevel = (s: GameState, level: number) => Math.max(0, xpForLevel(level) - s.pets.reduce((m, p) => Math.max(m, p.xp), 0));

export const allOpen = (s: GameState) => !s.onboard || !!s.onboard.legacy;

export function unlocked(s: GameState, f: Feature): boolean {
  return allOpen(s) || topLevel(s) >= FEATURE_BY_ID[f].level;
}

/** The next thing that will open, if any. */
export function nextUnlock(s: GameState): FeatureInfo | undefined {
  if (allOpen(s)) return undefined;
  return FEATURES.find((f) => !unlocked(s, f.id));
}

/** A feature that just opened and hasn't had its card shown yet. */
export function newUnlock(s: GameState): FeatureInfo | undefined {
  if (allOpen(s)) return undefined;
  const seen = new Set(s.onboard?.seen ?? []);
  return FEATURES.find((f) => unlocked(s, f.id) && !seen.has(f.id));
}

export const markSeen = (s: GameState, f: Feature): GameState => ({
  ...s,
  onboard: { ...s.onboard, seen: [...new Set([...(s.onboard?.seen ?? []), f])] },
});

/** "Opens at level 3" for locked spots. */
export const lockedText = (f: Feature) => `Opens when a pet reaches level ${FEATURE_BY_ID[f].level}`;

/** What the level-up pop-up should show: a level your best pet reached that hasn't had its pop-up yet. */
export interface LevelMoment {
  level: number;
  /** Everything that opened since the last pop-up (missed ones included). */
  unlocks: FeatureInfo[];
  /** The next thing to open, for plain level-ups. */
  next?: FeatureInfo;
}

export function levelMoment(s: GameState): LevelMoment | null {
  const shown = s.onboard?.levelShown;
  const top = topLevel(s);
  if (shown === undefined || top <= shown || !s.pets.length) return null;
  const seen = new Set(s.onboard?.seen ?? []);
  const unlocks = allOpen(s) ? [] : FEATURES.filter((f) => f.level <= top && !seen.has(f.id));
  return { level: top, unlocks, next: nextUnlock(s) };
}

/** Records that the pop-up for this level was shown (first run just records the current level, with no pop-up). */
export const markLevelShown = (s: GameState, level = topLevel(s)): GameState => ({
  ...s,
  onboard: { ...s.onboard, levelShown: Math.max(level, s.onboard?.levelShown ?? 0) },
});
