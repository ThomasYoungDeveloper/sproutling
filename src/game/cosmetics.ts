import type { GameState } from './types';
import { pickWeighted, type Rng, defaultRng } from './random';
import * as A from './actions';

/**
 * Dress-up: hats sit on a pet's head, auras float around it, and scenes change the world behind it.
 * Items are owned in your wardrobe and can be put on any of your pets. Trading a pet never trades its outfit.
 */

export type Slot = 'hat' | 'aura' | 'scene' | 'toy';

/** How a pet reacts when you drop a toy on it. */
export type ToyReaction = 'hop' | 'munch' | 'spin' | 'bubbles' | 'notes' | 'rocket';
export type ItemRarity = 'common' | 'rare' | 'epic';

export interface Cosmetic {
  id: string;
  name: string;
  slot: Slot;
  rarity: ItemRarity;
  price: number;
  /** Shown as a Premium perk; not sold for coins. */
  premium?: boolean;
  /** Can only come from contests or achievements, never the shop or chests. */
  special?: boolean;
  /** Limited item from a seasonal event (also special). */
  event?: string;
  /** Toys: the emoji drawn for it and how the pet reacts. */
  emoji?: string;
  reaction?: ToyReaction;
  line?: string;
}

export const COSMETICS: Cosmetic[] = [
  { id: 'party', name: 'Party Hat', slot: 'hat', rarity: 'common', price: 150 },
  { id: 'flower', name: 'Flower Crown', slot: 'hat', rarity: 'common', price: 150 },
  { id: 'beanie', name: 'Cozy Beanie', slot: 'hat', rarity: 'common', price: 150 },
  { id: 'bow', name: 'Big Bow', slot: 'hat', rarity: 'common', price: 150 },
  { id: 'bunny', name: 'Bunny Ears', slot: 'hat', rarity: 'rare', price: 400 },
  { id: 'cat', name: 'Cat Ears', slot: 'hat', rarity: 'rare', price: 400 },
  { id: 'chef', name: 'Chef Hat', slot: 'hat', rarity: 'rare', price: 400 },
  { id: 'wizard', name: 'Wizard Hat', slot: 'hat', rarity: 'rare', price: 400 },
  { id: 'tophat', name: 'Top Hat', slot: 'hat', rarity: 'rare', price: 400 },
  { id: 'crown', name: 'Royal Crown', slot: 'hat', rarity: 'epic', price: 900 },
  { id: 'halo', name: 'Halo', slot: 'hat', rarity: 'epic', price: 900 },
  { id: 'kabuto', name: 'Samurai Helmet', slot: 'hat', rarity: 'epic', price: 900 },
  { id: 'goldcrown', name: 'Golden Crown', slot: 'hat', rarity: 'epic', price: 0, premium: true },
  { id: 'trophy', name: 'Champion Laurel', slot: 'hat', rarity: 'epic', price: 0, special: true },
  { id: 'acorn', name: 'Acorn Cap', slot: 'hat', rarity: 'rare', price: 0, special: true, event: 'harvest' },
  { id: 'scarecrow', name: 'Scarecrow Hat', slot: 'hat', rarity: 'epic', price: 0, special: true, event: 'harvest' },
  { id: 'santa', name: 'Holiday Hat', slot: 'hat', rarity: 'rare', price: 0, special: true, event: 'winter' },

  { id: 'hearts', name: 'Floating Hearts', slot: 'aura', rarity: 'common', price: 150 },
  { id: 'bubbles', name: 'Bubbles', slot: 'aura', rarity: 'common', price: 150 },
  { id: 'snowfall', name: 'Snowfall', slot: 'aura', rarity: 'common', price: 150 },
  { id: 'sparkles', name: 'Sparkles', slot: 'aura', rarity: 'rare', price: 400 },
  { id: 'petals', name: 'Sakura Petals', slot: 'aura', rarity: 'rare', price: 400 },
  { id: 'fireflies', name: 'Fireflies', slot: 'aura', rarity: 'rare', price: 400 },
  { id: 'stars', name: 'Shooting Stars', slot: 'aura', rarity: 'epic', price: 900 },
  { id: 'galaxy', name: 'Galaxy Swirl', slot: 'aura', rarity: 'epic', price: 0, premium: true },
  { id: 'leaves', name: 'Autumn Leaves', slot: 'aura', rarity: 'rare', price: 0, special: true, event: 'harvest' },
  { id: 'lights', name: 'Twinkle Lights', slot: 'aura', rarity: 'epic', price: 0, special: true, event: 'winter' },

  { id: 'meadow', name: 'Home Meadow', slot: 'scene', rarity: 'common', price: 0 },
  { id: 'beach', name: 'Sunny Beach', slot: 'scene', rarity: 'common', price: 250 },
  { id: 'snow', name: 'Snowy Hills', slot: 'scene', rarity: 'common', price: 250 },
  { id: 'sakura', name: 'Sakura Garden', slot: 'scene', rarity: 'rare', price: 600 },
  { id: 'candy', name: 'Candy Land', slot: 'scene', rarity: 'rare', price: 600 },
  { id: 'space', name: 'Outer Space', slot: 'scene', rarity: 'epic', price: 1200 },
  { id: 'aurora', name: 'Northern Lights', slot: 'scene', rarity: 'epic', price: 0, premium: true },
  { id: 'autumn', name: 'Harvest Grove', slot: 'scene', rarity: 'epic', price: 0, special: true, event: 'harvest' },
  { id: 'winterfest', name: 'Winter Festival', slot: 'scene', rarity: 'epic', price: 0, special: true, event: 'winter' },

  { id: 'ball', name: 'Bouncy Ball', slot: 'toy', rarity: 'common', price: 0, emoji: '⚽', reaction: 'hop', line: 'Bounce bounce! Again!' },
  { id: 'cookie', name: 'Cookie', slot: 'toy', rarity: 'common', price: 50, emoji: '🍪', reaction: 'munch', line: 'Nom nom nom!' },
  { id: 'strawberry', name: 'Strawberry', slot: 'toy', rarity: 'common', price: 50, emoji: '🍓', reaction: 'munch', line: 'So juicy!' },
  { id: 'fish', name: 'Fishy Snack', slot: 'toy', rarity: 'common', price: 50, emoji: '🐟', reaction: 'munch', line: 'Yum, fishy!' },
  { id: 'yarn', name: 'Yarn Ball', slot: 'toy', rarity: 'common', price: 80, emoji: '🧶', reaction: 'spin', line: 'Wheee!' },
  { id: 'duck', name: 'Squeaky Duck', slot: 'toy', rarity: 'common', price: 80, emoji: '🦆', reaction: 'hop', line: 'Squeak! Squeak!' },
  { id: 'bubblewand', name: 'Bubble Wand', slot: 'toy', rarity: 'rare', price: 120, emoji: '🫧', reaction: 'bubbles', line: 'Pop! Pop! Pop!' },
  { id: 'musicbox', name: 'Music Box', slot: 'toy', rarity: 'rare', price: 150, emoji: '🎵', reaction: 'notes', line: 'La la laaa!' },
  { id: 'kite', name: 'Kite', slot: 'toy', rarity: 'rare', price: 150, emoji: '🪁', reaction: 'spin', line: 'Look how high!' },
  { id: 'rocket', name: 'Toy Rocket', slot: 'toy', rarity: 'epic', price: 250, emoji: '🚀', reaction: 'rocket', line: 'To the moon!' },
  { id: 'pie', name: 'Pumpkin Pie', slot: 'toy', rarity: 'rare', price: 0, special: true, event: 'harvest', emoji: '🥧', reaction: 'munch', line: 'Warm and spicy!' },
  { id: 'snowman', name: 'Mini Snowman', slot: 'toy', rarity: 'rare', price: 0, special: true, event: 'winter', emoji: '⛄', reaction: 'hop', line: 'Brrr, so cool!' },
];

export const COSMETIC_BY_ID: Record<string, Cosmetic> = Object.fromEntries(COSMETICS.map((c) => [c.id, c]));
export const ITEM_RARITY_COLOR: Record<ItemRarity, string> = { common: '#6B9E86', rare: '#3D8FD6', epic: '#9C5FD8' };

/** Everyone starts with the home meadow and a bouncy ball. */
export const owns = (s: GameState, id: string) => id === 'meadow' || id === 'ball' || !!s.wardrobe?.[id];

/** Items that can come from the shop and chests. */
const SELLABLE = COSMETICS.filter((c) => c.price > 0 && !c.premium && !c.special && c.slot !== 'toy');

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const SHOP_SIZE = 5;

/** Today's shop: the same items for everyone on a given day, always with hats, an aura and a scene. Toys aren't sold (the free ball stays). */
export function shopToday(s: GameState): Cosmetic[] {
  const day = A.todayKey(s);
  const ranked = [...SELLABLE].sort((a, b) => hash(day + a.id) - hash(day + b.id));
  const pick: Cosmetic[] = [];
  (['hat', 'hat', 'aura', 'scene'] as Slot[]).forEach((slot) => {
    const c = ranked.find((x) => x.slot === slot && !pick.includes(x));
    if (c) pick.push(c);
  });
  for (const c of ranked) {
    if (pick.length >= SHOP_SIZE) break;
    if (!pick.includes(c)) pick.push(c);
  }
  const order: Slot[] = ['toy', 'hat', 'aura', 'scene'];
  return pick.sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot));
}

/** Seconds until the shop changes (at local midnight). */
export function shopRefreshIn(now = new Date()): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(0, Math.round((next.getTime() - now.getTime()) / 1000));
}

export const ownedToys = (s: GameState) => COSMETICS.filter((c) => c.slot === 'toy' && owns(s, c.id));

export type BuyResult = { ok: true; state: GameState } | { ok: false; reason: string };

export function buy(s: GameState, id: string): BuyResult {
  const c = COSMETIC_BY_ID[id];
  if (!c || c.premium || c.special || c.price <= 0) return { ok: false, reason: 'That item isn’t for sale.' };
  if (owns(s, id)) return { ok: false, reason: 'You already have it!' };
  if (!shopToday(s).some((x) => x.id === id)) return { ok: false, reason: 'That item isn’t in today’s shop.' };
  if (s.coins < c.price) return { ok: false, reason: `You need ${c.price - s.coins} more coins.` };
  return { ok: true, state: { ...s, coins: s.coins - c.price, wardrobe: { ...s.wardrobe, [id]: true } } };
}

export function grantCosmetic(s: GameState, id: string): GameState {
  return owns(s, id) ? s : { ...s, wardrobe: { ...s.wardrobe, [id]: true } };
}

/** Puts an item on a pet (hats and auras) or sets your scene. Pass null to take it off. */
export function equip(s: GameState, slot: Slot, id: string | null, petId?: string): GameState {
  if (id && (!owns(s, id) || COSMETIC_BY_ID[id]?.slot !== slot)) return s;
  if (slot === 'toy') return s;
  if (slot === 'scene') return { ...s, scene: id && id !== 'meadow' ? id : undefined };
  const target = petId ?? s.activePetId;
  return { ...s, pets: s.pets.map((p) => (p.id === target ? { ...p, look: { ...p.look, [slot]: id ?? undefined } } : p)) };
}

/** Chance (percent) that a chest also holds a cosmetic you don't own yet. */
export const CHEST_COSMETIC_CHANCE = { bronze: 10, silver: 30, gold: 60 } as const;

export function rollChestCosmetic(s: GameState, kind: keyof typeof CHEST_COSMETIC_CHANCE, rng: Rng = defaultRng): string | null {
  if (rng() * 100 >= CHEST_COSMETIC_CHANCE[kind]) return null;
  const pool = SELLABLE.filter((c) => !owns(s, c.id));
  if (!pool.length) return null;
  const rarity = pickWeighted({ common: kind === 'gold' ? 30 : 60, rare: 30, epic: kind === 'bronze' ? 5 : 15 }, rng) as ItemRarity;
  const inRarity = pool.filter((c) => c.rarity === rarity);
  const from = inRarity.length ? inRarity : pool;
  return from[Math.floor(rng() * from.length)].id;
}
