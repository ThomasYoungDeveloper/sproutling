import type { GameState } from './types';
import { seededRng } from './random';
import * as A from './actions';

/**
 * Pet wishes: once a day, at a random time, the active pet asks for one small thing tied to a habit.
 * About 1 day in 3 a second wish shows up later. Granting one gives +25 XP and nothing else.
 * A wish lasts until the end of its day; missing one is fine.
 */
export type WishKind = 'walk' | 'water' | 'play';
export const WISH_XP = 25;
export const SECOND_WISH_CHANCE = 1 / 3;

export const WISHES: Record<WishKind, { ask: string; label: string; need: number; unit: string }> = {
  walk: { ask: 'Can we go for a walk?', label: 'a 2,000-step walk', need: 2000, unit: 'steps' },
  water: { ask: 'I’m thirsty too. Drink with me?', label: '2 glasses of water', need: 2, unit: 'glasses' },
  play: { ask: 'Play with me? Pretty please?', label: 'play together 3 times', need: 3, unit: 'plays' },
};

export interface PlannedWish {
  kind: WishKind;
  /** Minutes after midnight when it appears. */
  at: number;
}

/** The day's wishes, the same all day for this player: one between 9am and 5pm, sometimes a second 3 to 5 hours later. */
export function wishPlan(day: string, who: string): PlannedWish[] {
  const rng = seededRng(`wish:${who}:${day}`);
  const kinds: WishKind[] = ['walk', 'water', 'play'];
  const first = kinds[Math.floor(rng() * 3) % 3];
  const at1 = 9 * 60 + Math.floor(rng() * 8 * 60);
  const plan: PlannedWish[] = [{ kind: first, at: at1 }];
  if (rng() < SECOND_WISH_CHANCE) {
    const rest = kinds.filter((k) => k !== first);
    plan.push({ kind: rest[Math.floor(rng() * 2) % 2], at: Math.min(21 * 60, at1 + 180 + Math.floor(rng() * 120)) });
  }
  return plan;
}

const who = (s: GameState) => s.pets[0]?.id ?? 'me';
const minutesNow = (now: number) => {
  const d = new Date(now);
  return d.getHours() * 60 + d.getMinutes();
};

/** The amount counted toward a wish right now (steps, glasses or plays today). */
function measure(s: GameState, kind: WishKind): number {
  const d = A.today(s);
  if (kind === 'walk') return d.steps;
  if (kind === 'water') return d.water;
  return d.care?.played ?? 0;
}

export interface ActiveWish {
  index: number;
  kind: WishKind;
  have: number;
  need: number;
  done: boolean;
}

/** The wish showing now, if any: the first one that has appeared and isn't granted yet. Needs a baseline (see noticeWishes). */
export function activeWish(s: GameState, now = Date.now()): ActiveWish | null {
  if (!s.pets.length) return null;
  const day = A.todayKey(s);
  const rec = s.wishes?.day === day ? s.wishes : undefined;
  const plan = wishPlan(day, who(s));
  const mins = s.dayOffset ? 24 * 60 : minutesNow(now);
  for (let i = 0; i < plan.length; i++) {
    if (plan[i].at > mins) break;
    if (rec?.granted?.includes(i)) continue;
    const base = rec?.base?.[i];
    if (base === undefined) return null;
    const w = WISHES[plan[i].kind];
    const have = Math.max(0, measure(s, plan[i].kind) - base);
    return { index: i, kind: plan[i].kind, have: Math.min(have, w.need), need: w.need, done: have >= w.need };
  }
  return null;
}

/** Records where each newly appeared wish starts counting from. Returns the same state when nothing changed. */
export function noticeWishes(s: GameState, now = Date.now()): GameState {
  if (!s.pets.length) return s;
  const day = A.todayKey(s);
  const rec = s.wishes?.day === day ? s.wishes : { day, base: {}, granted: [] };
  const plan = wishPlan(day, who(s));
  const mins = s.dayOffset ? 24 * 60 : minutesNow(now);
  let base = rec.base ?? {};
  let changed = rec !== s.wishes;
  plan.forEach((w, i) => {
    if (w.at <= mins && base[i] === undefined) {
      // A wish counts from the moment it appears, so earlier steps or water don't fill it.
      base = { ...base, [i]: measure(s, w.kind) };
      changed = true;
    }
  });
  return changed ? { ...s, wishes: { ...rec, base } } : s;
}

/** Grants a finished wish: +25 XP for the active pet. */
export function grantWish(s: GameState, now = Date.now()): GameState {
  const w = activeWish(s, now);
  if (!w || !w.done) return s;
  const day = A.todayKey(s);
  const rec = s.wishes!;
  const pid = s.activePetId;
  return {
    ...s,
    wishes: { ...rec, day, granted: [...(rec.granted ?? []), w.index] },
    pets: s.pets.map((p) => (p.id === pid ? { ...p, xp: p.xp + WISH_XP } : p)),
  };
}
