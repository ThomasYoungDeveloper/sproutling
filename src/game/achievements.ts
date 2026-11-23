import { badgeStatus, tiersEarned } from './badges';
import type { ChestKind, GameState } from './types';
import { SPECIES, SPECIES_BY_ID } from './species';
import { levelFor } from './scoring';
import { grantCosmetic } from './cosmetics';
import { ownsSkin, skinDexCount } from './skins';
import { totalSteps } from './expedition';
import * as A from './actions';

/** Badges you earn for milestones. Each one has a reward you claim once. */

export interface Reward {
  coins?: number;
  chest?: ChestKind;
  cosmetic?: string;
}

export interface Achievement {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  group: 'Walking' | 'Collecting' | 'Skins & Nursery' | 'Growing' | 'Habits' | 'Adventure' | 'Style';
  goal: number;
  value: (s: GameState) => number;
  reward: Reward;
}

const maxLevel = (s: GameState) => Math.max(0, ...s.pets.map((p) => levelFor(p.xp)));
const dexCount = (s: GameState) => Object.keys(s.dex).length;
const loginCount = (s: GameState) => s.login?.count ?? 0;
const wardrobeCount = (s: GameState) => Object.keys(s.wardrobe ?? {}).length;
const bestStreak = (s: GameState) => A.streak(s);

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'steps10k', name: 'First Steps', emoji: '👟', desc: 'Walk 10,000 steps in total', group: 'Walking', goal: 10_000, value: (s) => totalSteps(s), reward: { coins: 30 } },
  { id: 'steps100k', name: 'Trail Blazer', emoji: '🥾', desc: 'Walk 100,000 steps in total', group: 'Walking', goal: 100_000, value: (s) => totalSteps(s), reward: { chest: 'bronze', coins: 100 } },
  { id: 'steps500k', name: 'Marathoner', emoji: '🏃', desc: 'Walk 500,000 steps in total', group: 'Walking', goal: 500_000, value: (s) => totalSteps(s), reward: { chest: 'silver', coins: 300 } },
  { id: 'steps1m', name: 'Globe Trotter', emoji: '🌍', desc: 'Walk 1,000,000 steps in total', group: 'Walking', goal: 1_000_000, value: (s) => totalSteps(s), reward: { chest: 'gold', coins: 600 } },

  { id: 'dex10', name: 'Collector', emoji: '📗', desc: 'Discover 10 kinds of pets', group: 'Collecting', goal: 10, value: dexCount, reward: { chest: 'bronze', coins: 50 } },
  { id: 'dex25', name: 'Pet Expert', emoji: '📘', desc: 'Discover 25 kinds of pets', group: 'Collecting', goal: 25, value: dexCount, reward: { chest: 'silver', coins: 150 } },
  { id: 'dex50', name: 'Pet Professor', emoji: '📕', desc: 'Discover 50 kinds of pets', group: 'Collecting', goal: 50, value: dexCount, reward: { chest: 'gold', coins: 400 } },
  { id: 'dexall', name: 'Gotta Grow Them All', emoji: '🏆', desc: `Discover all ${SPECIES.length} kinds of pets`, group: 'Collecting', goal: SPECIES.length, value: dexCount, reward: { chest: 'gold', coins: 500, cosmetic: 'trophy' } },
  { id: 'hatch5', name: 'Egg Whisperer', emoji: '🥚', desc: 'Hatch 5 eggs', group: 'Collecting', goal: 5, value: (s) => s.stats?.hatched ?? 0, reward: { coins: 60 } },
  { id: 'shiny', name: 'Ooh, Shiny!', emoji: '✨', desc: 'Own a shiny pet', group: 'Collecting', goal: 1, value: (s) => (s.pets.some((p) => p.shiny) ? 1 : 0), reward: { chest: 'silver' } },
  { id: 'legend', name: 'Living Legend', emoji: '🐉', desc: 'Own a Legendary pet', group: 'Collecting', goal: 1, value: (s) => (s.pets.some((p) => SPECIES_BY_ID[p.speciesId]?.rarity === 'legendary') ? 1 : 0), reward: { chest: 'gold' } },

  { id: 'skin1', name: 'Something Special', emoji: '🎨', desc: 'Get a pet with a skin', group: 'Skins & Nursery', goal: 1, value: (s) => Math.min(1, skinDexCount(s)), reward: { chest: 'silver' } },
  { id: 'skins10', name: 'Color Collector', emoji: '🖍️', desc: 'Collect 10 different pet skins', group: 'Skins & Nursery', goal: 10, value: skinDexCount, reward: { chest: 'gold', coins: 200 } },
  { id: 'goldskin', name: 'Solid Gold', emoji: '🥇', desc: 'Get a Gold skin', group: 'Skins & Nursery', goal: 1, value: (s) => (ownsSkin(s, 'gold') ? 1 : 0), reward: { chest: 'gold', coins: 100 } },
  { id: 'rainbow', name: 'Over the Rainbow', emoji: '🌈', desc: 'Get a Rainbow skin', group: 'Skins & Nursery', goal: 1, value: (s) => (ownsSkin(s, 'rainbow') ? 1 : 0), reward: { chest: 'gold', coins: 250 } },
  { id: 'breed1', name: 'Proud Parent', emoji: '💞', desc: 'Make an egg in the Pet Nursery', group: 'Skins & Nursery', goal: 1, value: (s) => s.stats?.bred ?? 0, reward: { coins: 50 } },
  { id: 'breed10', name: 'Nursery Pro', emoji: '🍼', desc: 'Make 10 eggs in the Pet Nursery', group: 'Skins & Nursery', goal: 10, value: (s) => s.stats?.bred ?? 0, reward: { chest: 'silver', coins: 150 } },

  { id: 'lv7', name: 'All Grown Up', emoji: '🌳', desc: 'Raise a pet to level 7 (adult)', group: 'Growing', goal: 7, value: maxLevel, reward: { chest: 'bronze', coins: 40 } },
  { id: 'lv15', name: 'Pet Pro', emoji: '💪', desc: 'Raise a pet to level 15', group: 'Growing', goal: 15, value: maxLevel, reward: { chest: 'silver', coins: 150 } },
  { id: 'lv25', name: 'Super Star', emoji: '🌟', desc: 'Raise a pet to level 25', group: 'Growing', goal: 25, value: maxLevel, reward: { chest: 'gold', coins: 400 } },

  { id: 'streak3', name: 'On a Roll', emoji: '🔥', desc: 'Keep a 3-day streak', group: 'Habits', goal: 3, value: bestStreak, reward: { coins: 30 } },
  { id: 'streak7', name: 'Week Warrior', emoji: '📅', desc: 'Keep a 7-day streak', group: 'Habits', goal: 7, value: bestStreak, reward: { chest: 'bronze', coins: 75 } },
  { id: 'streak30', name: 'Habit Hero', emoji: '🦸', desc: 'Keep a 30-day streak', group: 'Habits', goal: 30, value: bestStreak, reward: { chest: 'gold', coins: 400 } },
  { id: 'login7', name: 'Regular', emoji: '🗓️', desc: 'Collect 7 daily rewards', group: 'Habits', goal: 7, value: loginCount, reward: { chest: 'bronze', coins: 50 } },
  { id: 'login30', name: 'Super Fan', emoji: '💚', desc: 'Collect 30 daily rewards', group: 'Habits', goal: 30, value: loginCount, reward: { chest: 'gold', coins: 300 } },

  { id: 'win1', name: 'First Victory', emoji: '⚔️', desc: 'Win a battle', group: 'Adventure', goal: 1, value: (s) => s.battle?.wins ?? 0, reward: { coins: 30 } },
  { id: 'win10', name: 'Champion', emoji: '🥇', desc: 'Win 10 battles', group: 'Adventure', goal: 10, value: (s) => s.battle?.wins ?? 0, reward: { chest: 'silver', coins: 100 } },
  { id: 'win50', name: 'Arena Legend', emoji: '👑', desc: 'Win 50 battles', group: 'Adventure', goal: 50, value: (s) => s.battle?.wins ?? 0, reward: { chest: 'gold', coins: 400 } },
  { id: 'explore1', name: 'Explorer', emoji: '🧭', desc: 'Finish an expedition', group: 'Adventure', goal: 1, value: (s) => s.stats?.expeditions ?? 0, reward: { coins: 30 } },
  { id: 'explore10', name: 'Adventurer', emoji: '🗺️', desc: 'Finish 10 expeditions', group: 'Adventure', goal: 10, value: (s) => s.stats?.expeditions ?? 0, reward: { chest: 'silver', coins: 100 } },
  { id: 'trade1', name: 'Trading Buddy', emoji: '🤝', desc: 'Complete a trade with a friend', group: 'Adventure', goal: 1, value: (s) => Object.keys(s.appliedTrades ?? {}).length, reward: { chest: 'bronze' } },

  { id: 'style5', name: 'Fashionista', emoji: '👗', desc: 'Own 5 dress-up items', group: 'Style', goal: 5, value: wardrobeCount, reward: { coins: 60 } },
  { id: 'style15', name: 'Trendsetter', emoji: '🎀', desc: 'Own 15 dress-up items', group: 'Style', goal: 15, value: wardrobeCount, reward: { chest: 'silver', coins: 150 } },
  { id: 'toys25', name: 'Playtime Pal', emoji: '🧸', desc: 'Play with your pet 25 times', group: 'Style', goal: 25, value: (s) => s.stats?.toys ?? 0, reward: { coins: 50 } },
  { id: 'chests10', name: 'Treasure Hunter', emoji: '🗝️', desc: 'Open 10 chests', group: 'Style', goal: 10, value: (s) => s.stats?.chests ?? 0, reward: { coins: 80 } },
];

export const ACHIEVEMENT_BY_ID: Record<string, Achievement> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

export interface AchievementStatus {
  a: Achievement;
  value: number;
  done: boolean;
  claimed: boolean;
}

export function statusAll(s: GameState): AchievementStatus[] {
  return ACHIEVEMENTS.map((a) => {
    const value = a.value(s);
    return { a, value: Math.min(value, a.goal), done: value >= a.goal, claimed: !!s.achievements?.[a.id] };
  });
}

/** Badges replaced achievements: tier-ups waiting count as "claimable", and the count is tiers earned. */
export const claimable = (s: GameState) => badgeStatus(s).filter((x) => x.tier > x.claimed);
export const badgeCount = (s: GameState) => tiersEarned(s);

export function claim(s: GameState, id: string): GameState | null {
  const a = ACHIEVEMENT_BY_ID[id];
  if (!a || s.achievements?.[id] || a.value(s) < a.goal) return null;
  let next: GameState = { ...s, coins: s.coins + (a.reward.coins ?? 0), achievements: { ...s.achievements, [id]: true } };
  if (a.reward.chest) next = A.grantChest(next, a.reward.chest, `Badge: ${a.name}`);
  if (a.reward.cosmetic) next = grantCosmetic(next, a.reward.cosmetic);
  return next;
}

export function rewardText(r: Reward, withArticle = false): string {
  const parts: string[] = [];
  if (r.coins) parts.push(`${r.coins} coins`);
  if (r.chest) parts.push(`${withArticle ? 'a ' : ''}${r.chest[0].toUpperCase() + r.chest.slice(1)} chest`);
  if (r.cosmetic) parts.push(`${withArticle ? 'the ' : ''}Champion Laurel`);
  return parts.join(' + ');
}
