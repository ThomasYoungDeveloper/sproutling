import type { GameState } from './types';
import * as A from './actions';
import * as Br from './breeding';
import { dailyQuests, glassesText, stepGoalOf, waterGoalOf } from './scoring';

const joinList = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
import { progress } from './expedition';
import { stepsToHatch, eggSteps } from './rarity';
import { raidBoss } from './team';

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

export function planReminders(s: GameState, opts: { now?: number; inGuild?: boolean; raidHitsLeft?: number; raidBeaten?: boolean; raidHpLeft?: number; guildSteps?: number; guildGoal?: number } = {}): Reminder[] {
  const now = opts.now ?? Date.now();
  const pet = s.pets.find((p) => p.id === s.activePetId);
  const name = pet?.nickname ?? 'Your pet';
  const out: Reminder[] = [];
  if (!pet) return out;

  const prefs = s.reminderPrefs ?? {};
  const hour = Math.min(21, Math.max(18, prefs.hour ?? EVENING_HOUR));

  // 1. Evening check-in: tonight only if today's habits aren't done (says what's left), then the next two evenings
  // in case the app isn't opened. Never more than one habit reminder a day.
  if (prefs.evening !== false) {
    const streak = A.streak(s);
    const d = A.today(s);
    const quests = dailyQuests(d);
    const todayDone = quests.every((q) => q.done);
    const tonight = atHour(now, 0, hour);
    if (!todayDone && tonight > now) {
      const left: string[] = [];
      const stepsLeft = stepGoalOf(d) - d.steps;
      const waterLeft = waterGoalOf(d) - d.water;
      if (stepsLeft > 0) left.push(`${stepsLeft.toLocaleString()} steps`);
      if (waterLeft > 0) left.push(`${glassesText(waterLeft)} glass${waterLeft === 1 ? '' : 'es'} of water`);
      if (!quests.find((q) => q.id === 'sleep')?.done && d.sleepHours === 0) left.push('last night’s sleep');
      out.push({
        id: 'habits-0',
        at: tonight,
        title: `${name} is waiting for you`,
        body: `${left.length ? `${joinList(left)} left.` : 'Almost done for today.'}${streak > 0 ? ` Your ${streak}-day streak is still safe.` : ''}`,
      });
    }
    for (const dd of [1, 2]) {
      out.push({
        id: `habits-${dd}`,
        at: atHour(now, dd, hour),
        title: dd === 1 && streak > 0 ? `Don’t lose your ${streak + (todayDone ? 1 : 0)}-day streak` : `${name} is waiting for you`,
        body: dd === 1 ? `Check in and log today’s habits.` : `${name} has been wondering where you went. Come say hi!`,
      });
    }
  }

  // 2. Expedition home.
  const exp = progress(s, now);
  if (prefs.trips !== false && exp && !exp.done && exp.msLeft > 0) {
    const explorer = s.pets.find((p) => p.id === s.expedition?.petId)?.nickname ?? name;
    out.push({ id: 'expedition', at: now + exp.msLeft, title: `${explorer} is home from ${exp.place.name}`, body: 'Back with something to show you. Come see!' });
  }

  // 3. An egg is ready but not hatched yet.
  const ready = s.eggs.filter(A.isReady);
  if (prefs.eggs === false) {
    // Egg reminders are off.
  } else if (ready.length) {
    out.push({ id: 'egg', at: now + EGG_NUDGE_HOURS * 3_600_000, title: 'Your egg is ready to hatch!', body: ready.length > 1 ? `${ready.length} eggs are cracking. Come see who's inside.` : `It's cracking! Come see who's inside.` });
  } else {
    // An egg that's close: remind them a walk will hatch it.
    const close = s.eggs.filter((e) => e.incubating).map((e) => eggSteps(e) - e.stepsWalked).filter((left) => left > 0 && left <= 2000);
    if (close.length) {
      const left = Math.min(...close);
      out.push({ id: 'egg', at: atHour(now, 1, 12), title: 'Your egg is almost ready', body: `Just ${left.toLocaleString()} more steps to hatch it. A short walk will do it!` });
    }
  }

  // 3b. A nursery egg finishes nesting.
  const nestLeft = Br.nestLeftMs(s, now);
  if (prefs.eggs !== false && Br.nestingEgg(s) && nestLeft > 0) out.push({ id: 'nest', at: now + nestLeft, title: 'Your nursery egg is ready!', body: 'Come see how rare it is.' });

  // 4. Guild week ends Sunday night. Midweek (Wednesday) and Saturday evening: one message with what's left —
  // steps to the next guild chest and the boss's HP — so the guild walks together.
  if (prefs.raid !== false && opts.inGuild) {
    const d = new Date(now);
    const toSat = (6 - d.getDay() + 7) % 7;
    const sat = atHour(now, toSat, 18);
    const toWed = (3 - d.getDay() + 7) % 7;
    const wed = atHour(now, toWed, 18);
    const parts: string[] = [];
    if (opts.guildGoal && opts.guildSteps != null) {
      const silverLeft = opts.guildGoal - opts.guildSteps;
      const goldLeft = opts.guildGoal * 2 - opts.guildSteps;
      const [left, chest] = silverLeft > 0 ? [silverLeft, 'Silver'] : [goldLeft, 'Gold'];
      if (left > 0) parts.push(`${left.toLocaleString()} more steps for the ${chest} chest`);
    }
    if (!opts.raidBeaten && opts.raidHpLeft) parts.push(`the boss has ${opts.raidHpLeft.toLocaleString()} HP left`);
    if (parts.length) {
      const body = `Your guild needs ${parts.join(', and ')}. Every step counts!`;
      out.push({ id: 'guild', at: sat, title: 'Guild week ends tomorrow!', body });
      // Wednesday only if the week is still behind (the Silver chest isn't reached yet).
      if (toWed !== 0 || wed > now) {
        if (opts.guildGoal && opts.guildSteps != null && opts.guildSteps < opts.guildGoal * 0.5)
          out.push({ id: 'guild-mid', at: wed, title: 'Halfway through the guild week', body: `Your guild needs ${parts[0]}. A walk today helps everyone!` });
      }
    }

    // A new boss shows up every Monday: let them know at lunchtime.
    const toMon = ((8 - d.getDay()) % 7) || 7;
    const mon = atHour(now, toMon, 12);
    const m = new Date(mon);
    const week = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`;
    out.push({ id: 'raid-new', at: mon, title: 'A new guild boss appeared!', body: `${raidBoss(week).name} is here. Team up with your guild to take it down.` });
  }

  return out.filter((r) => r.at > now).sort((a, b) => a.at - b.at);
}

/** The guild facts the planner needs, from the guild loaded in the app (null when not in one). */
export function guildReminderOpts(team: { raid: { hp: number; damage: number; hits_left: number }; total: number; goal: number } | null | undefined) {
  if (!team) return { inGuild: false };
  return {
    inGuild: true,
    raidHitsLeft: team.raid.hits_left,
    raidBeaten: team.raid.hp > 0 && team.raid.damage >= team.raid.hp,
    raidHpLeft: Math.max(0, team.raid.hp - team.raid.damage),
    guildSteps: team.total,
    guildGoal: team.goal,
  };
}
