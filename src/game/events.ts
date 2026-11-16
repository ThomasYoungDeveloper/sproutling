import type { GameState } from './types';
import { dailyQuests } from './scoring';
import { grantChest, todayKey } from './actions';
import { grantCosmetic, COSMETIC_BY_ID } from './cosmetics';

/**
 * Seasonal events. Each runs on the same dates every year.
 * During an event, every daily quest you finish (walk, water, sleep) earns 1 event token (up to 3 a day).
 * Tokens unlock limited items that can't be bought or found anywhere else.
 */

export interface Milestone {
  tokens: number;
  item?: string;
  chest?: 'silver' | 'gold';
  coins?: number;
}

export interface SeasonEvent {
  id: string;
  name: string;
  emoji: string;
  token: string;
  blurb: string;
  colors: [string, string];
  /** Inclusive month-day range, e.g. ['11-01', '11-30']. May wrap past New Year. */
  from: string;
  to: string;
  milestones: Milestone[];
}

export const EVENTS: SeasonEvent[] = [
  {
    id: 'harvest',
    name: 'Harvest Festival',
    emoji: '🍂',
    token: '🌰',
    blurb: 'The leaves are turning! Finish your daily quests to gather acorns for cozy autumn gear.',
    colors: ['#D9792B', '#7A3F1D'],
    from: '11-01',
    to: '11-30',
    milestones: [
      { tokens: 3, item: 'pie' },
      { tokens: 8, item: 'acorn' },
      { tokens: 15, item: 'leaves' },
      { tokens: 24, item: 'autumn' },
      { tokens: 32, chest: 'gold', coins: 200 },
    ],
  },
  {
    id: 'winter',
    name: 'Winter Festival',
    emoji: '❄️',
    token: '⭐',
    blurb: 'Snow is falling! Finish your daily quests to collect stars for festive winter gear.',
    colors: ['#3B7DD8', '#1B2E5A'],
    from: '12-01',
    to: '01-06',
    milestones: [
      { tokens: 3, item: 'snowman' },
      { tokens: 8, item: 'santa' },
      { tokens: 15, item: 'lights' },
      { tokens: 24, item: 'winterfest' },
      { tokens: 32, chest: 'gold', coins: 200 },
    ],
  },
];

export const TOKENS_PER_DAY = 3;

const md = (day: string) => day.slice(5);
const inRange = (m: string, from: string, to: string) => (from <= to ? m >= from && m <= to : m >= from || m <= to);

/** The event running on this day, with a key unique to this year's run (e.g. "winter-2026"). */
export function eventOn(day: string): { event: SeasonEvent; key: string; start: string; end: string } | null {
  const m = md(day);
  const ev = EVENTS.find((e) => inRange(m, e.from, e.to));
  if (!ev) return null;
  const y = Number(day.slice(0, 4));
  const startYear = ev.from <= ev.to || m >= ev.from ? y : y - 1;
  const endYear = ev.from <= ev.to ? startYear : startYear + 1;
  return { event: ev, key: `${ev.id}-${startYear}`, start: `${startYear}-${ev.from}`, end: `${endYear}-${ev.to}` };
}

export function currentEvent(s: GameState) {
  return eventOn(todayKey(s));
}

/** The next event to start after this day. */
export function nextEvent(day: string): { event: SeasonEvent; start: string } {
  const y = Number(day.slice(0, 4));
  const starts = EVENTS.flatMap((e) => [y, y + 1].map((yy) => ({ event: e, start: `${yy}-${e.from}` }))).filter((x) => x.start > day);
  starts.sort((a, b) => (a.start < b.start ? -1 : 1));
  return starts[0];
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
}

/** Tokens earned during this run of the event: 1 per daily quest done, up to 3 a day. */
export function eventTokens(s: GameState, run: { start: string; end: string }): number {
  let n = 0;
  for (const [day, log] of Object.entries(s.days)) {
    if (day < run.start || day > run.end) continue;
    n += Math.min(TOKENS_PER_DAY, dailyQuests(log).filter((q) => q.done).length);
  }
  return n;
}

export function claimedMilestones(s: GameState, key: string): number[] {
  return s.events?.[key] ?? [];
}

export function claimableCount(s: GameState): number {
  const run = currentEvent(s);
  if (!run) return 0;
  const t = eventTokens(s, run);
  const got = claimedMilestones(s, run.key);
  return run.event.milestones.filter((m, i) => t >= m.tokens && !got.includes(i)).length;
}

export function milestoneLabel(m: Milestone): string {
  if (m.item) return COSMETIC_BY_ID[m.item]?.name ?? m.item;
  return `${m.chest === 'gold' ? 'Gold' : 'Silver'} chest${m.coins ? ` + ${m.coins} coins` : ''}`;
}

export function claimMilestone(s: GameState, index: number): { state: GameState; ok: boolean; reason?: string } {
  const run = currentEvent(s);
  if (!run) return { state: s, ok: false, reason: 'No event is running right now.' };
  const m = run.event.milestones[index];
  if (!m) return { state: s, ok: false, reason: 'Unknown reward.' };
  const got = claimedMilestones(s, run.key);
  if (got.includes(index)) return { state: s, ok: false, reason: 'Already claimed.' };
  if (eventTokens(s, run) < m.tokens) return { state: s, ok: false, reason: `Collect ${m.tokens} ${run.event.token} first.` };
  let next: GameState = { ...s, events: { ...(s.events ?? {}), [run.key]: [...got, index] } };
  if (m.item) next = grantCosmetic(next, m.item);
  if (m.chest) next = grantChest(next, m.chest, run.event.name);
  if (m.coins) next = { ...next, coins: next.coins + m.coins };
  return { state: next, ok: true };
}
