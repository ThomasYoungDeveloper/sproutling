import type { ChestKind, Element, GameState, Rarity } from './types';
import type { Battle, PetLike } from './battle';
import { ELEMENT_LABEL, weakTo } from './battle';
import { SPECIES } from './species';
import { levelFor, xpForLevel } from './scoring';
import { seededRng, type Rng } from './random';
import { weekStart } from './team';
import * as A from './actions';
import * as H from './hp';
import { addCrystals } from './powerups';
import { STATS, type Training } from './stats';

/**
 * The weekly Sky Tower: 10 floors of 3 v 3 battles with a theme that changes every Monday.
 * Your pets fight with their real HP (it carries from floor to floor). After each floor you pick a
 * blessing that lasts the week. Knocked out = your climb ends for today; tomorrow you continue.
 */

export const FLOORS = 10;

export interface Theme {
  id: string;
  name: string;
  element: Element;
  /** What beats it (shown as a hint). */
  weakTo: string;
  sky: [string, string, string];
}

const hitBy = (e: Element) => `${weakTo(e).map((x) => ELEMENT_LABEL[x]).join(' and ')} moves hit harder`;
/** One tower a week. The order keeps the week the 9 types arrived on Bloom Tower. */
export const THEMES: Theme[] = ([
  ['ember', 'Ember Tower', ['#1B0F2E', '#4A1F3F', '#F08A3C']],
  ['tide', 'Tide Tower', ['#0E1B33', '#24477A', '#8FD0F0']],
  ['moon', 'Moonlit Tower', ['#0B0A22', '#2C2466', '#8E7CE0']],
  ['stone', 'Stone Tower', ['#1E1712', '#4A3A2C', '#C9A27A']],
  ['spark', 'Spark Tower', ['#0D0B24', '#2A1F5C', '#FFD23F']],
  ['frost', 'Frost Tower', ['#0C1E2C', '#2C5C78', '#BDEFF7']],
  ['flower', 'Bloom Tower', ['#14301F', '#2E6B45', '#F2B6C6']],
  ['wind', 'Wind Tower', ['#10261F', '#2F6B5A', '#BFF0D6']],
  ['toxic', 'Toxic Tower', ['#1A0E22', '#4A1F5A', '#C77DDB']],
] as [Element, string, [string, string, string]][]).map(([element, name, sky]) => ({ id: element, name, element, weakTo: hitBy(element), sky }));

export const weekOf = (s: GameState) => weekStart(A.todayKey(s));

export function themeFor(week: string): Theme {
  const n = Math.floor(Date.UTC(+week.slice(0, 4), +week.slice(5, 7) - 1, +week.slice(8, 10)) / (7 * 86_400_000));
  return THEMES[((n % THEMES.length) + THEMES.length) % THEMES.length];
}

export interface Blessing {
  id: 'heal' | 'surge' | 'guard' | 'swift' | 'lucky';
  name: string;
  text: string;
  tier: 'COMMON' | 'RARE' | 'EPIC';
}

export const BLESSINGS: Record<Blessing['id'], (t: Theme) => Blessing> = {
  heal: () => ({ id: 'heal', name: 'Second Wind', text: 'Heal every pet 30% now', tier: 'COMMON' }),
  guard: () => ({ id: 'guard', name: 'Stone Skin', text: 'Your pets take less damage in this tower', tier: 'COMMON' }),
  swift: () => ({ id: 'swift', name: 'Tailwind', text: 'Your pets are faster in this tower', tier: 'RARE' }),
  surge: (t) => ({ id: 'surge', name: 'Power Surge', text: `Your pets hit harder in this tower (${t.weakTo.toLowerCase()} anyway)`, tier: 'RARE' }),
  lucky: () => ({ id: 'lucky', name: 'Lucky Paw', text: 'Double coins for the next 2 floors', tier: 'EPIC' }),
};

export interface TowerState {
  week: string;
  /** Floors cleared this week (0–10). */
  floor: number;
  blessings: Blessing['id'][];
  /** Floors left with double coins. */
  lucky?: number;
  /** A blessing choice waiting after a cleared floor. */
  choose?: boolean;
  /** Day you were knocked out (climb again tomorrow). */
  restDay?: string;
}

export function towerOf(s: GameState): TowerState {
  const week = weekOf(s);
  const t = s.tower;
  return t && t.week === week ? t : { week, floor: 0, blessings: [] };
}

export const canClimb = (s: GameState) => {
  const t = towerOf(s);
  if (t.floor >= FLOORS) return { ok: false as const, reason: 'You reached the top this week! A new tower opens Monday.' };
  if (t.restDay === A.todayKey(s)) return { ok: false as const, reason: 'Your team is resting after being knocked out. Climb again tomorrow from the same floor.' };
  if (!s.pets.some((p) => !H.isKnockedOut(p))) return { ok: false as const, reason: 'All your pets are knocked out and resting. Their HP starts coming back within a few minutes.' };
  return { ok: true as const };
};

export const chestFor = (floor: number): ChestKind | null => (floor === 10 ? 'rainbow' : floor === 6 ? 'silver' : floor === 3 ? 'bronze' : null);
export const coinsFor = (floor: number) => 20 + floor * 6;

/** The team guarding a floor: themed pets that get stronger as you climb; a rare-or-better boss on top. */
export function floorTeam(s: GameState, floor: number): PetLike[] {
  const week = weekOf(s);
  const theme = themeFor(week);
  const rng = seededRng(`tower:${week}:${floor}`);
  const top = Math.max(1, ...s.pets.map((p) => levelFor(p.xp)));
  const base = Math.max(1, top - 3 + Math.floor(floor * 0.6));
  const themed = SPECIES.filter((x) => x.element === theme.element);
  const pool = (r: Rarity[]) => themed.filter((x) => r.includes(x.rarity));
  const size = floor <= 2 ? 2 : 3;
  return Array.from({ length: size }, (_, i) => {
    const boss = floor === FLOORS && i === 0;
    const list = boss ? pool(['epic', 'legendary', 'rare']) : pool(floor >= 7 ? ['uncommon', 'rare'] : ['common', 'uncommon']);
    const sp = list[Math.floor(rng() * list.length)] ?? themed[0] ?? SPECIES[0];
    const level = base + (boss ? 3 : 0) + (i === 0 ? 1 : 0);
    const t: Training = {};
    for (let k = 1; k < level; k++) {
      const st = STATS[Math.floor(rng() * STATS.length)];
      t[st] = (t[st] ?? 0) + 1;
    }
    return { id: `tw${floor}-${i}`, speciesId: sp.id, nickname: `${boss ? 'Boss ' : ''}${sp.name}`, xp: xpForLevel(level) + 5, shiny: boss, train: t };
  });
}

/** Applies this week's blessings to your fighters. */
export function bless(b: Battle, blessings: Blessing['id'][]): Battle {
  const n = (id: Blessing['id']) => blessings.filter((x) => x === id).length;
  const atk = 1 + 0.15 * n('surge');
  const def = 1 + 0.15 * n('guard');
  const spd = 1 + 0.15 * n('swift');
  if (atk === 1 && def === 1 && spd === 1) return b;
  return {
    ...b,
    mine: b.mine.map((f) => ({ ...f, stats: { ...f.stats, atk: Math.round(f.stats.atk * atk), def: Math.round(f.stats.def * def), spd: Math.round(f.stats.spd * spd) } })),
  };
}

/** Three blessings to pick from after a floor (same choices all day, so no rerolling). */
export function blessingChoices(s: GameState): Blessing[] {
  const t = towerOf(s);
  const theme = themeFor(t.week);
  const rng: Rng = seededRng(`bless:${t.week}:${t.floor}`);
  const ids: Blessing['id'][] = ['heal', 'guard', 'swift', 'surge', 'lucky'];
  const picks: Blessing['id'][] = ['heal'];
  while (picks.length < 3) {
    const id = ids[1 + Math.floor(rng() * (ids.length - 1))];
    if (!picks.includes(id)) picks.push(id);
  }
  return picks.map((id) => BLESSINGS[id](theme));
}

export function chooseBlessing(s: GameState, id: Blessing['id']): GameState {
  const t = towerOf(s);
  if (!t.choose) return s;
  let next: GameState = { ...s, tower: { ...t, choose: false, blessings: id === 'heal' ? t.blessings : [...t.blessings, id], ...(id === 'lucky' ? { lucky: 2 } : {}) } };
  if (id === 'heal') for (const p of next.pets) next = H.setHp(next, p.id, H.hpPct(p) + 30);
  return next;
}

export interface FloorResult {
  state: GameState;
  coins: number;
  chest: ChestKind | null;
  crystals: number;
  cleared: number;
}

/** After a floor's battle (HP already saved). */
export function finishFloor(s: GameState, won: boolean): FloorResult {
  const t = towerOf(s);
  if (!won) return { state: { ...s, tower: { ...t, restDay: A.todayKey(s) } }, coins: 0, chest: null, crystals: 0, cleared: t.floor };
  const floor = t.floor + 1;
  const lucky = (t.lucky ?? 0) > 0;
  const coins = coinsFor(floor) * (lucky ? 2 : 1);
  const chest = chestFor(floor);
  const crystals = floor === FLOORS ? 2 : 0;
  let next: GameState = { ...s, coins: s.coins + coins, tower: { ...t, floor, choose: floor < FLOORS, lucky: lucky ? (t.lucky ?? 1) - 1 : t.lucky } };
  let given: ChestKind | null = chest;
  if (chest === 'rainbow') {
    const r = A.grantRainbow(next, 'tower', t.week, `Sky Tower top, week of ${t.week}`);
    next = r.state;
    given = r.kind;
  } else if (chest) next = A.grantChest(next, chest, `Sky Tower floor ${floor}`);
  if (crystals) next = addCrystals(next, crystals);
  return { state: next, coins, chest: given, crystals, cleared: floor };
}
