import type { GameState } from './types';
import * as A from './actions';
import * as C from './care';
import * as Ex from './expedition';
import { needsFor } from './food';
import { levelFor, stepGoalOf, waterGoalOf } from './scoring';
import { RARITY_INFO, eggSteps } from './rarity';
import { OZ_PER_GLASS } from './intro';

/**
 * What the Apple Watch app shows. The phone sends this to the watch whenever it changes;
 * the watch reads live steps itself and uses these for everything else.
 */
export interface WatchSnapshot {
  v: 1;
  day: string;
  pet: { name: string; species: string; level: number } | null;
  status: { key: 'good' | 'hungry' | 'bored' | 'thirsty' | 'tired'; text: string };
  needs: { food: number; fun: number; water: number; energy: number };
  steps: number;
  goal: number;
  egg: { label: string; stepsLeft: number } | null;
  guild: { label: string; stepsLeft: number } | null;
  trip: { name: string; species: string; place: string; endAt: number; note: string } | null;
}

const STATUS = {
  hungry: 'Hungry',
  bored: 'Wants to play',
  thirsty: 'Thirsty',
  tired: 'Sleepy',
  good: 'All good',
} as const;

export function watchSnapshot(s: GameState, team?: { total: number; goal: number } | null, now = Date.now()): WatchSnapshot {
  const d = A.today(s);
  const pet = A.activePet(s) ?? s.pets[0];
  const needs = needsFor(d, now, waterGoalOf(d));
  // The lowest need under 45 is the one the pet asks for.
  const low = (
    [
      ['hungry', needs.food],
      ['thirsty', needs.water],
      ['bored', needs.fun],
      ['tired', needs.energy],
    ] as const
  )
    .filter(([, v]) => v < 45)
    .sort((a, b) => a[1] - b[1])[0];
  const key = low ? low[0] : 'good';

  const eggs = s.eggs.filter((e) => e.incubating && !e.overflow && !e.nestUntil);
  const nextEgg = eggs.map((e) => ({ e, left: Math.max(0, eggSteps(e) - e.stepsWalked) })).sort((a, b) => a.left - b.left)[0];

  let guild: WatchSnapshot['guild'] = null;
  if (team && team.goal > 0) {
    const silver = Math.round(team.goal / 2);
    if (team.total < silver) guild = { label: 'Guild Silver chest', stepsLeft: silver - team.total };
    else if (team.total < team.goal) guild = { label: 'Guild Gold chest', stepsLeft: team.goal - team.total };
  }

  let trip: WatchSnapshot['trip'] = null;
  const prog = Ex.progress(s, now);
  const tripPet = s.expedition ? s.pets.find((p) => p.id === s.expedition!.petId) : undefined;
  if (prog && tripPet && !prog.done) {
    const fights = s.expedition?.fights ?? [];
    const reached = Ex.tripNow(s, now)?.reached ?? [];
    const won = reached.filter((f) => f.won).length;
    const ahead = Math.max(0, fights.length - reached.length);
    trip = {
      name: tripPet.nickname,
      species: tripPet.speciesId,
      place: prog.place.name,
      endAt: now + prog.msLeft,
      note: fights.length ? `Won ${won} fight${won === 1 ? '' : 's'}${ahead ? ` · ${ahead} to go` : ''}` : 'Exploring',
    };
  }

  return {
    v: 1,
    day: A.todayKey(s),
    pet: pet ? { name: pet.nickname, species: pet.speciesId, level: levelFor(pet.xp) } : null,
    status: { key, text: STATUS[key] },
    needs,
    steps: d.steps,
    goal: stepGoalOf(d),
    egg: nextEgg ? { label: `${RARITY_INFO[nextEgg.e.rarity].label} egg`, stepsLeft: nextEgg.left } : null,
    guild,
    trip,
  };
}

export type WatchAction = { id: string; kind: 'feed' | 'water' };

/** Applies a button pressed on the watch: free Pellets, or one glass of water. */
export function applyWatchAction(s: GameState, a: WatchAction): GameState {
  if (a.kind === 'feed') return C.feed(s);
  if (a.kind === 'water') {
    const glass = (s.goals?.glass ?? 8) / OZ_PER_GLASS;
    return A.setWater(s, Math.round((A.today(s).water + glass) * 100) / 100);
  }
  return s;
}
