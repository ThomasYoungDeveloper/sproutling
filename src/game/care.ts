import type { DayLog, GameState } from './types';
import { scoreDay } from './scoring';
import { stepsToHatch, RARITY_INFO } from './rarity';
import * as A from './actions';

/** Each care task adds +10% to today's XP. Pets are never punished for being left alone. */
export const CARE_BONUS = 0.1;
export const PLAYS_NEEDED = 3;

export interface CareTask {
  id: 'feed' | 'play' | 'treat';
  label: string;
  done: boolean;
  progress?: string;
}

export function careTasks(d: DayLog): CareTask[] {
  const c = d.care ?? {};
  const played = Math.min(c.played ?? 0, PLAYS_NEEDED);
  return [
    { id: 'feed', label: 'Feed', done: !!c.fed },
    { id: 'play', label: 'Play', done: played >= PLAYS_NEEDED, progress: `${played}/${PLAYS_NEEDED}` },
    { id: 'treat', label: 'Treat', done: !!c.treat },
  ];
}

/** 1.0× with no care, up to 1.3× with all three care tasks done. */
export function careMultiplier(d: DayLog): number {
  return 1 + careTasks(d).filter((t) => t.done).length * CARE_BONUS;
}

/** Today's XP after the care boost. This is what pets and coins actually receive. */
export function boostedTotal(d: DayLog): number {
  return Math.round(scoreDay(d).total * careMultiplier(d));
}

export type Mood = 'joy' | 'happy' | 'sleepy' | 'hungry' | 'thirsty' | 'bored';

export const MOOD_INFO: Record<Mood, { label: string; emoji: string; color: string }> = {
  joy: { label: 'Overjoyed', emoji: '🤩', color: '#E5A800' },
  happy: { label: 'Happy', emoji: '😊', color: '#1E8A68' },
  sleepy: { label: 'Sleepy', emoji: '😴', color: '#6E62C6' },
  hungry: { label: 'Hungry', emoji: '🍙', color: '#C4562F' },
  thirsty: { label: 'Thirsty', emoji: '💧', color: '#2E7FB8' },
  bored: { label: 'Wants to play', emoji: '🎾', color: '#9A6A00' },
};

/** How the active pet feels right now, from your habits and its care. */
export function moodFor(d: DayLog): Mood {
  const c = d.care ?? {};
  if (d.sleepHours > 0 && d.sleepHours < 6) return 'sleepy';
  if (!c.fed) return 'hungry';
  if (d.water < 3) return 'thirsty';
  if ((c.played ?? 0) < PLAYS_NEEDED) return 'bored';
  if (careMultiplier(d) >= 1 + 3 * CARE_BONUS - 1e-9 && scoreDay(d).total >= 100) return 'joy';
  return 'happy';
}

export function moodLine(mood: Mood, name: string): string {
  switch (mood) {
    case 'sleepy': return 'So sleepy… early bedtime tonight?';
    case 'hungry': return 'My tummy is rumbling!';
    case 'thirsty': return 'Could we drink some water?';
    case 'bored': return 'Tap me! Let’s play!';
    case 'joy': return 'Best. Day. Ever!';
    default: return 'Let’s go for a walk!';
  }
}

/* ---------- Care actions ---------- */

export const feed = (s: GameState) => A.updateToday(s, (d) => ({ ...d, care: { ...d.care, fed: true } }));
export const play = (s: GameState) => A.updateToday(s, (d) => ({ ...d, care: { ...d.care, played: (d.care?.played ?? 0) + 1 } }));

export const trinketCount = (s: GameState) => Object.values(s.items).reduce((a, n) => a + n, 0);

/** Gives one trinket from your bag (the one you have most of) as today's treat. */
export function treat(s: GameState): GameState {
  if (A.today(s).care?.treat) return s;
  const pick = Object.entries(s.items).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])[0];
  if (!pick) return s;
  const next = A.updateToday(s, (d) => ({ ...d, care: { ...d.care, treat: true } }));
  return { ...next, items: { ...next.items, [pick[0]]: pick[1] - 1 } };
}

/* ---------- Reminders ---------- */

export interface Reminder {
  id: string;
  icon: string;
  text: string;
  action?: 'feed' | 'play' | 'treat' | 'eggs' | 'chests' | 'water' | 'steps' | 'sleep';
}

/** Friendly nudges, most useful first. On the phone app these become notifications. */
export function reminders(s: GameState): Reminder[] {
  const d = A.today(s);
  const pet = A.activePet(s);
  const name = pet?.nickname ?? 'Your pet';
  const c = d.care ?? {};
  const out: Reminder[] = [];
  const ready = s.eggs.filter(A.isReady).length;
  if (ready) out.push({ id: 'ready', icon: '🥚', text: ready === 1 ? 'An egg is ready to hatch!' : `${ready} eggs are ready to hatch!`, action: 'eggs' });
  if (!c.fed) out.push({ id: 'feed', icon: '🍙', text: `Feed ${name} for +10% XP today`, action: 'feed' });
  if ((c.played ?? 0) < PLAYS_NEEDED) out.push({ id: 'play', icon: '🎾', text: `Play with ${name} (${Math.min(c.played ?? 0, PLAYS_NEEDED)}/${PLAYS_NEEDED}) for +10% XP`, action: 'play' });
  if (d.sleepHours === 0) out.push({ id: 'sleep', icon: '🌙', text: 'Log last night’s sleep', action: 'sleep' });
  if (d.water < 6) out.push({ id: 'water', icon: '💧', text: `${6 - d.water} more glass${6 - d.water === 1 ? '' : 'es'} of water for today’s quest`, action: 'water' });
  const close = s.eggs
    .filter((e) => e.incubating && !A.isReady(e))
    .map((e) => ({ e, left: stepsToHatch(e.rarity) - e.stepsWalked }))
    .sort((a, b) => a.left - b.left)[0];
  if (close && close.left <= 1500) out.push({ id: 'egg', icon: '👣', text: `Your ${RARITY_INFO[close.e.rarity].label} egg hatches in ${close.left.toLocaleString()} steps!`, action: 'steps' });
  if (d.steps < 8000) out.push({ id: 'steps', icon: '👟', text: `${(8000 - d.steps).toLocaleString()} steps to today’s walking quest`, action: 'steps' });
  if (!c.treat && trinketCount(s) > 0) out.push({ id: 'treat', icon: '✨', text: `Give ${name} a treat from your bag for +10% XP`, action: 'treat' });
  if (s.chests.length) out.push({ id: 'chests', icon: '🎁', text: s.chests.length === 1 ? 'You have a chest to open' : `You have ${s.chests.length} chests to open`, action: 'chests' });
  return out;
}
