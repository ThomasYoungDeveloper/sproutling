import type { GameState } from './types';
import * as A from './actions';
import * as Br from './breeding';
import { dailyQuests } from './scoring';
import { progress } from './expedition';
import { stepsToHatch, eggSteps } from './rarity';

/**
 * Which reminders to schedule, worked out from the save. The phone app turns these into
 * local notifications (no server needed) and re-plans them every time the app opens or changes.
 * At most one habit reminder a day, so it never feels spammy.
 */

export interface Reminder {
  id: string;
  at: number; // epoch ms, real clock
  title: string;
  body: string;
}

export const EVENING_HOUR = 19;
export const EGG_NUDGE_HOURS = 2;

function atHour(now: number, daysAhead: number, hour: number): number {
  const d = new Date(now);
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

export function planReminders(s: GameState, opts: { now?: number; inGuild?: boolean; raidHitsLeft?: number } = {}): Reminder[] {
  const now = opts.now ?? Date.now();
  const pet = s.pets.find((p) => p.id === s.activePetId);
  const name = pet?.nickname ?? 'Your pet';
  const out: Reminder[] = [];
  if (!pet) return out;

  // 1. Evening habit nudge: tonight if today's habits aren't done, then the next two evenings in case the app isn't opened.
  const streak = A.streak(s);
  const todayDone = dailyQuests(A.today(s)).every((q) => q.done);
  const tonight = atHour(now, 0, EVENING_HOUR);
  if (!todayDone && tonight > now) {
    out.push({
      id: 'habits-0',
      at: tonight,
      title: streak > 0 ? `🔥 Keep your ${streak}-day streak!` : `🌱 ${name} misses you`,
      body: streak > 0 ? `Finish today's habits so ${name} keeps growing.` : `Log a walk, some water or your sleep to help ${name} grow.`,
    });
  }
  for (const d of [1, 2]) {
    out.push({
      id: `habits-${d}`,
      at: atHour(now, d, EVENING_HOUR),
      title: d === 1 && streak > 0 ? `🔥 Don't lose your ${streak + (todayDone ? 1 : 0)}-day streak` : `🌱 ${name} is waiting for you`,
      body: d === 1 ? `Check in and log today's habits.` : `${name} has been wondering where you went. Come say hi!`,
    });
  }

  // 2. Expedition home.
  const exp = progress(s, now);
  if (exp && !exp.done && exp.msLeft > 0) {
    const explorer = s.pets.find((p) => p.id === s.expedition?.petId)?.nickname ?? name;
    out.push({ id: 'expedition', at: now + exp.msLeft, title: `${exp.place.emoji} ${explorer} is home!`, body: `Back from ${exp.place.name}. See what they found.` });
  }

  // 3. An egg is ready but not hatched yet.
  const ready = s.eggs.filter(A.isReady);
  if (ready.length) {
    out.push({ id: 'egg', at: now + EGG_NUDGE_HOURS * 3_600_000, title: '🥚 Your egg is ready to hatch!', body: ready.length > 1 ? `${ready.length} eggs are cracking. Come see who's inside.` : `It's cracking! Come see who's inside.` });
  } else {
    // An egg that's close: remind them a walk will hatch it.
    const close = s.eggs.filter((e) => e.incubating).map((e) => eggSteps(e) - e.stepsWalked).filter((left) => left > 0 && left <= 2000);
    if (close.length) {
      const left = Math.min(...close);
      out.push({ id: 'egg', at: atHour(now, 1, 12), title: '🥚 Your egg is almost ready', body: `Just ${left.toLocaleString()} more steps to hatch it. A short walk will do it!` });
    }
  }

  // 3b. A nursery egg finishes nesting.
  const nestLeft = Br.nestLeftMs(s, now);
  if (Br.nestingEgg(s) && nestLeft > 0) out.push({ id: 'nest', at: now + nestLeft, title: 'Your nursery egg is ready!', body: 'Come see how rare it is.' });

  // 4. Guild raid ends Sunday night: nudge on Saturday evening if you still have hits left.
  if (opts.inGuild && (opts.raidHitsLeft ?? 1) > 0) {
    const d = new Date(now);
    const toSat = (6 - d.getDay() + 7) % 7;
    const sat = atHour(now, toSat, 18);
    if (sat > now) out.push({ id: 'raid', at: sat, title: '⚔️ Guild raid ends tomorrow!', body: 'Hit the boss before it escapes. Your guild is counting on you.' });
  }

  return out.filter((r) => r.at > now).sort((a, b) => a.at - b.at);
}
