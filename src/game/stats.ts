import type { Element, OwnedPet, Rarity } from './types';
import { SPECIES_BY_ID } from './species';
import { levelFor } from './scoring';

/**
 * Battle stats. Every pet has HP, Attack, Defense and Speed from its species, rarity and element.
 * Each level gives one stat point to train, and a personality nudges one stat.
 */

export type Stat = 'hp' | 'atk' | 'def' | 'spd';
export const STATS: Stat[] = ['hp', 'atk', 'def', 'spd'];
export const STAT_INFO: Record<Stat, { label: string; short: string; emoji: string; color: string; perPoint: number }> = {
  hp: { label: 'Health', short: 'HP', emoji: '❤️', color: '#2FB58A', perPoint: 10 },
  atk: { label: 'Attack', short: 'ATK', emoji: '⚔️', color: '#E5484D', perPoint: 3 },
  def: { label: 'Defense', short: 'DEF', emoji: '🛡️', color: '#3D8FD6', perPoint: 3 },
  spd: { label: 'Speed', short: 'SPD', emoji: '💨', color: '#E5A800', perPoint: 3 },
};

export type Personality = 'brave' | 'sturdy' | 'swift' | 'hardy' | 'lucky' | 'gentle';
export const PERSONALITIES: Record<Personality, { label: string; emoji: string; text: string }> = {
  brave: { label: 'Brave', emoji: '🦁', text: 'Attack grows faster' },
  sturdy: { label: 'Sturdy', emoji: '🪨', text: 'Defense grows faster' },
  swift: { label: 'Swift', emoji: '⚡', text: 'Speed grows faster' },
  hardy: { label: 'Hardy', emoji: '💪', text: 'Health grows faster' },
  lucky: { label: 'Lucky', emoji: '🍀', text: 'More critical hits' },
  gentle: { label: 'Gentle', emoji: '🌷', text: 'Heals 25% more' },
};
/** The stat each nature favors: it grows faster every level (on top of training points) and gets +10% at the end. */
export const NATURE_STAT: Partial<Record<Personality, Stat>> = { brave: 'atk', sturdy: 'def', swift: 'spd', hardy: 'hp' };
/** Normal growth per level, and the extra the favored stat gets each level. */
export const LEVEL_GROWTH: Record<Stat, number> = { hp: 8, atk: 2, def: 1.5, spd: 1.5 };
export const NATURE_GROWTH: Record<Stat, number> = { hp: 4, atk: 1, def: 1, spd: 1 };

const PERSONALITY_IDS = Object.keys(PERSONALITIES) as Personality[];

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A pet's personality: stored when hatched, or worked out from its id for older pets so it never changes. */
export function personalityOf(p: Pick<OwnedPet, 'id' | 'personality'> & { speciesId?: string; nickname?: string }): Personality {
  if (p.personality && PERSONALITIES[p.personality]) return p.personality;
  return PERSONALITY_IDS[hash(p.id || `${p.speciesId}${p.nickname}`) % PERSONALITY_IDS.length];
}

export const randomPersonality = (rng: () => number): Personality => PERSONALITY_IDS[Math.floor(rng() * PERSONALITY_IDS.length)];

export type Training = Partial<Record<Stat, number>>;

/* ====================== Grade (hidden quality) ====================== */

/** Hidden quality values from 0 to 15 for each stat, rolled when a pet hatches (like Pokémon GO). */
export type Ivs = Record<Stat, number>;
export const IV_MAX = 15;
const clampIv = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(IV_MAX, Math.round(n))) : null);

export function rollIvs(rng: () => number, floor = 0): Ivs {
  const one = () => floor + Math.floor(rng() * (IV_MAX - floor + 1));
  return { hp: one(), atk: one(), def: one(), spd: one() };
}

/** Nursery babies: each stat comes from a random parent half the time, otherwise a fresh roll of at least 5. */
/** Breeding odds for each stat: copy the stronger parent, copy the other parent, or a fresh roll. */
export const INHERIT_BETTER = 0.6;
export const INHERIT_OTHER = 0.25;
/** Chance a bred egg is a Lucky egg, and what it adds to every stat. */
export const LUCKY_CHANCE = 0.15;

/**
 * A bred baby's quality values. Each stat leans toward the stronger parent (60%), sometimes copies the
 * other parent (25%), and otherwise rolls fresh (5–15). A Lucky egg adds +1 or +2 to every stat.
 */
export function inheritIvs(rng: () => number, a: Ivs, b: Ivs, lucky = 0): Ivs {
  const out = {} as Ivs;
  for (const k of ['hp', 'atk', 'def', 'spd'] as Stat[]) {
    const hi = Math.max(a[k], b[k]);
    const lo = Math.min(a[k], b[k]);
    const r = rng();
    const v = r < INHERIT_BETTER ? hi : r < INHERIT_BETTER + INHERIT_OTHER ? lo : 5 + Math.floor(rng() * (IV_MAX - 4));
    out[k] = Math.min(IV_MAX, v + lucky);
  }
  return out;
}

/** The likely grade range (10th to 90th percentile) of a baby from these parents, without luck. */
export function likelyGrade(a: Ivs, b: Ivs): { low: number; high: number } {
  // A fixed seed keeps the numbers steady while the player looks at them.
  let seed = 12345;
  const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
  const grades: number[] = [];
  for (let i = 0; i < 400; i++) {
    const v = inheritIvs(rng, a, b);
    grades.push(Math.round(((v.hp + v.atk + v.def + v.spd) / (IV_MAX * 4)) * 100));
  }
  grades.sort((x, y) => x - y);
  return { low: grades[40], high: grades[359] };
}

/** Cleans up values that came from a trade or a friend's card. */
export function readIvs(v: unknown): Ivs | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const r = { hp: clampIv(o.hp), atk: clampIv(o.atk), def: clampIv(o.def), spd: clampIv(o.spd) };
  return r.hp === null || r.atk === null || r.def === null || r.spd === null ? undefined : (r as Ivs);
}

/** A pet's quality values: stored when hatched, or worked out from its id for older pets so they never change. */
export function ivsOf(p: { ivs?: Ivs; id?: string; speciesId?: string; nickname?: string }): Ivs {
  const own = readIvs(p.ivs);
  if (own) return own;
  const h = hash(`iv:${p.id || `${p.speciesId}${p.nickname}`}`);
  return { hp: h & 15, atk: (h >>> 4) & 15, def: (h >>> 8) & 15, spd: (h >>> 12) & 15 };
}

/** 0 to 100. 100% means every stat is perfect. */
export function gradeOf(p: { ivs?: Ivs; id?: string; speciesId?: string; nickname?: string }): number {
  const v = ivsOf(p);
  return Math.round(((v.hp + v.atk + v.def + v.spd) / (IV_MAX * 4)) * 100);
}

export function gradeInfo(g: number): { label: string; stars: number; color: string } {
  if (g >= 100) return { label: 'Perfect', stars: 4, color: '#E3A81E' };
  if (g >= 82) return { label: 'Amazing', stars: 3, color: '#E5484D' };
  if (g >= 67) return { label: 'Great', stars: 2, color: '#9C5FD8' };
  if (g >= 51) return { label: 'Good', stars: 1, color: '#3D8FD6' };
  return { label: 'Okay', stars: 0, color: '#6B9E86' };
}
/** Stars for a grade (empty for the lowest grades, so text never starts with a stray dot). */
export const gradeStars = (g: number) => { const n = gradeInfo(g).stars; return n === 4 ? '💯' : '⭐'.repeat(n); };

const RARITY_TIER: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
const ELEMENT_BONUS: Record<Element, Partial<Record<Stat, number>>> = {
  ember: { atk: 3 },
  tide: { def: 3 },
  moon: { spd: 3 },
  flower: { hp: 15 },
};

export const pointsEarned = (xp: number) => levelFor(xp) - 1;
export const pointsSpent = (t?: Training) => STATS.reduce((a, s) => a + (t?.[s] ?? 0), 0);
export const pointsLeft = (p: Pick<OwnedPet, 'xp' | 'train'>) => Math.max(0, pointsEarned(p.xp) - pointsSpent(p.train));

export interface StatBlock {
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

/** Final battle stats for a pet. */
export function statsFor(p: { speciesId: string; xp: number; train?: Training; foodBoost?: Training; personality?: Personality; id?: string; nickname?: string; ivs?: Ivs }): StatBlock {
  const sp = SPECIES_BY_ID[p.speciesId];
  const tier = RARITY_TIER[sp.rarity];
  const lv = levelFor(p.xp);
  const el = ELEMENT_BONUS[sp.element];
  const t = p.train ?? {};
  const pers = personalityOf({ id: p.id ?? '', personality: p.personality, speciesId: p.speciesId, nickname: p.nickname });
  const fav = NATURE_STAT[pers];
  const grow = (k: Stat) => (lv - 1) * (LEVEL_GROWTH[k] + (fav === k ? NATURE_GROWTH[k] : 0));
  const raw: StatBlock = {
    hp: 60 + tier * 12 + (el.hp ?? 0) + grow('hp') + (t.hp ?? 0) * STAT_INFO.hp.perPoint,
    atk: 12 + tier * 3 + (el.atk ?? 0) + grow('atk') + (t.atk ?? 0) * STAT_INFO.atk.perPoint,
    def: 10 + tier * 2 + (el.def ?? 0) + grow('def') + (t.def ?? 0) * STAT_INFO.def.perPoint,
    spd: 10 + tier * 2 + (el.spd ?? 0) + grow('spd') + (t.spd ?? 0) * STAT_INFO.spd.perPoint,
  };
  if (fav) raw[fav] *= 1.1;
  // Grade: a perfect stat is up to 10% stronger.
  const iv = ivsOf(p);
  for (const k of ['hp', 'atk', 'def', 'spd'] as Stat[]) raw[k] *= 1 + iv[k] / 150;
  // Food boosts: a small percent per stat, up to +10%.
  // (Capped here too, so a friend's card can't carry more than food could ever give: see game/food.ts.)
  for (const k of ['hp', 'atk', 'def', 'spd'] as Stat[]) raw[k] *= 1 + Math.max(0, Math.min(10, Number(p.foodBoost?.[k]) || 0)) / 100;
  return { hp: Math.round(raw.hp), atk: Math.round(raw.atk), def: Math.round(raw.def), spd: Math.round(raw.spd) };
}

/** How much a pet's nature adds to its favored stat right now (null for Lucky and Gentle, which don't favor a stat). */
export function natureBonus(p: Parameters<typeof statsFor>[0]): { stat: Stat; amount: number } | null {
  const pers = personalityOf({ id: p.id ?? '', personality: p.personality, speciesId: p.speciesId, nickname: p.nickname });
  const stat = NATURE_STAT[pers];
  if (!stat) return null;
  return { stat, amount: statsFor({ ...p, personality: pers }) [stat] - statsFor({ ...p, personality: 'lucky' })[stat] };
}

/** Spends one stat point. Returns the pet unchanged if it has none left. */
export function train(p: OwnedPet, stat: Stat): OwnedPet {
  if (pointsLeft(p) <= 0) return p;
  return { ...p, train: { ...p.train, [stat]: (p.train?.[stat] ?? 0) + 1 } };
}


/* ====================== Moves ====================== */

export type MoveKind = 'attack' | 'heal' | 'buff' | 'energy';
export type Status = 'burn' | 'soak' | 'drowsy';
export type Buff = 'atkUp' | 'defUp' | 'dodgeUp';

export interface MoveDef {
  id: string;
  name: string;
  emoji: string;
  element: Element | 'normal';
  kind: MoveKind;
  /** Energy it costs. */
  cost: number;
  power?: number;
  /** Goes before normal moves. */
  priority?: boolean;
  status?: { type: Status; chance: number };
  /** Heals this share of the damage dealt. */
  drain?: number;
  /** Heals this share of max HP. */
  heal?: number;
  buff?: Buff;
  energy?: number;
  learn: number;
  desc: string;
}

export const MOVES: Record<string, MoveDef> = {
  tackle: { id: 'tackle', name: 'Tackle', emoji: '💥', element: 'normal', kind: 'attack', cost: 0, power: 40, learn: 1, desc: 'A solid hit. Free to use.' },
  focus: { id: 'focus', name: 'Focus', emoji: '🧘', element: 'normal', kind: 'energy', cost: 0, energy: 2, learn: 3, desc: 'Skip attacking to gain 2 extra ⚡.' },
  quick: { id: 'quick', name: 'Quick Jab', emoji: '👊', element: 'normal', kind: 'attack', cost: 0, power: 28, priority: true, learn: 5, desc: 'Weaker, but always goes first.' },
  cry: { id: 'cry', name: 'Battle Cry', emoji: '📣', element: 'normal', kind: 'buff', cost: 1, buff: 'atkUp', learn: 9, desc: 'Attack up for 3 turns.' },
  snack: { id: 'snack', name: 'Snack Break', emoji: '🍙', element: 'normal', kind: 'heal', cost: 2, heal: 0.3, learn: 12, desc: 'Heal 30% of max HP.' },

  spark: { id: 'spark', name: 'Ember Spark', emoji: '🔥', element: 'ember', kind: 'attack', cost: 1, power: 50, status: { type: 'burn', chance: 0.3 }, learn: 1, desc: '30% chance to burn.' },
  dash: { id: 'dash', name: 'Flame Dash', emoji: '☄️', element: 'ember', kind: 'attack', cost: 2, power: 75, priority: true, learn: 7, desc: 'Strong and goes first.' },
  inferno: { id: 'inferno', name: 'Inferno', emoji: '🌋', element: 'ember', kind: 'attack', cost: 3, power: 115, status: { type: 'burn', chance: 0.5 }, learn: 15, desc: 'Huge damage, 50% burn.' },

  bubble: { id: 'bubble', name: 'Bubble Blast', emoji: '🫧', element: 'tide', kind: 'attack', cost: 1, power: 50, status: { type: 'soak', chance: 0.35 }, learn: 1, desc: '35% chance to soak (slows).' },
  wall: { id: 'wall', name: 'Splash Wall', emoji: '🌊', element: 'tide', kind: 'buff', cost: 1, buff: 'defUp', learn: 7, desc: 'Defense way up for 3 turns.' },
  tidal: { id: 'tidal', name: 'Tidal Wave', emoji: '🌀', element: 'tide', kind: 'attack', cost: 3, power: 115, status: { type: 'soak', chance: 0.5 }, learn: 15, desc: 'Huge damage, 50% soak.' },

  beam: { id: 'beam', name: 'Moon Beam', emoji: '🌙', element: 'moon', kind: 'attack', cost: 1, power: 50, status: { type: 'drowsy', chance: 0.25 }, learn: 1, desc: '25% chance to make drowsy.' },
  veil: { id: 'veil', name: 'Night Veil', emoji: '🌫️', element: 'moon', kind: 'buff', cost: 1, buff: 'dodgeUp', learn: 7, desc: 'Much harder to hit for 3 turns.' },
  eclipse: { id: 'eclipse', name: 'Eclipse', emoji: '🌑', element: 'moon', kind: 'attack', cost: 3, power: 115, status: { type: 'drowsy', chance: 0.4 }, learn: 15, desc: 'Huge damage, 40% drowsy.' },

  vine: { id: 'vine', name: 'Vine Whip', emoji: '🌿', element: 'flower', kind: 'attack', cost: 1, power: 50, drain: 0.3, learn: 1, desc: 'Heals you for 30% of the damage.' },
  bloom: { id: 'bloom', name: 'Bloom', emoji: '🌸', element: 'flower', kind: 'heal', cost: 2, heal: 0.35, learn: 7, desc: 'Heal 35% and cure status.' },
  petal: { id: 'petal', name: 'Petal Storm', emoji: '💮', element: 'flower', kind: 'attack', cost: 3, power: 110, drain: 0.25, learn: 15, desc: 'Huge damage that heals you.' },
};

const ELEMENT_MOVES: Record<Element, string[]> = {
  ember: ['spark', 'dash', 'inferno'],
  tide: ['bubble', 'wall', 'tidal'],
  moon: ['beam', 'veil', 'eclipse'],
  flower: ['vine', 'bloom', 'petal'],
};

/** Every move a species can learn, in level order. */
export function learnset(speciesId: string): MoveDef[] {
  const el = SPECIES_BY_ID[speciesId].element;
  return [...['tackle', 'focus', 'quick', 'cry', 'snack'], ...ELEMENT_MOVES[el]].map((id) => MOVES[id]).sort((a, b) => a.learn - b.learn);
}

export const learned = (speciesId: string, xp: number) => learnset(speciesId).filter((m) => m.learn <= levelFor(xp));

export const MAX_MOVES = 4;

/** The four moves a pet brings to battle: its own picks, or the best ones it knows. */
export function equippedMoves(p: { speciesId: string; xp: number; moves?: string[] }): MoveDef[] {
  const known = learned(p.speciesId, p.xp);
  const knownIds = new Set(known.map((m) => m.id));
  const chosen = (p.moves ?? []).filter((id) => knownIds.has(id)).slice(0, MAX_MOVES);
  if (chosen.length) return chosen.map((id) => MOVES[id]);
  // Default kit: strongest element attack, element basic, a free move, then a support move.
  const el = SPECIES_BY_ID[p.speciesId].element;
  const order = [ELEMENT_MOVES[el][2], ELEMENT_MOVES[el][0], 'quick', 'tackle', ELEMENT_MOVES[el][1], 'snack', 'cry', 'focus'];
  return order.filter((id) => knownIds.has(id)).slice(0, MAX_MOVES).map((id) => MOVES[id]);
}

/** Toggles a move in or out of a pet's four. */
export function toggleMove(p: OwnedPet, moveId: string): OwnedPet {
  const current = equippedMoves(p).map((m) => m.id);
  if (current.includes(moveId)) {
    if (current.length <= 1) return p;
    return { ...p, moves: current.filter((id) => id !== moveId) };
  }
  if (!learned(p.speciesId, p.xp).some((m) => m.id === moveId)) return p;
  if (current.length >= MAX_MOVES) return p;
  return { ...p, moves: [...current, moveId] };
}

/** Moves newly learned at exactly this level (for "learned a new move!" messages). */
export const movesLearnedAt = (speciesId: string, level: number) => learnset(speciesId).filter((m) => m.learn === level);
