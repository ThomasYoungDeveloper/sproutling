import type { Element, GameState, Rarity, Skin } from './types';
import { EXERCISE_MINUTES, MINDFUL_MINUTES, levelFor, ringsClosed, stepGoalOf, waterGoalOf, xpForLevel } from './scoring';
import { SPECIES, SPECIES_BY_ID } from './species';
import { careMultiplier } from './care';
import { pickOne, randInt, seededRng, type Rng, defaultRng } from './random';
import * as A from './actions';
import {
  MOVES, SIGNATURES, STATS, equippedMoves, personalityOf, statsFor,
  type Buff, type MoveDef, type Personality, type StatBlock, type Status, type Training,
} from './stats';

/**
 * Battles: up to 3 vs 3. Each turn both sides pick a move (or switch pets).
 * Moves cost energy (⚡), which builds up every turn. Faster pets go first and dodge more.
 * Types: 9, each strong against two (2×) and weak to two (½); see BEATS. Real-life habits give battle buffs.
 */

/** Each type is strong against two types and weak to two (2× and ½ damage). */
export const BEATS: Record<Element, Element[]> = {
  flower: ['tide', 'stone'],
  tide: ['ember', 'stone'],
  ember: ['frost', 'moon'],
  moon: ['flower', 'frost'],
  stone: ['spark', 'toxic'],
  spark: ['tide', 'toxic'],
  frost: ['spark', 'wind'],
  wind: ['ember', 'moon'],
  toxic: ['flower', 'wind'],
};
/** The types that beat this one. */
export const weakTo = (e: Element): Element[] => (Object.keys(BEATS) as Element[]).filter((a) => BEATS[a].includes(e));
export const ELEMENT_LABEL: Record<Element, string> = { flower: 'Flower', tide: 'Tide', ember: 'Ember', moon: 'Moon', stone: 'Stone', spark: 'Spark', frost: 'Frost', wind: 'Wind', toxic: 'Toxic' };
export const ELEMENT_COLOR: Record<Element, string> = { flower: '#5DBB63', moon: '#8E7CE0', ember: '#FF8A4C', tide: '#2E9BD6', stone: '#A0784F', spark: '#E3A800', frost: '#3FB8C9', wind: '#4FB985', toxic: '#B04FC0' };
export const NORMAL_COLOR = '#8A9AA0';

export function effectiveness(attacker: Element | 'normal', defender: Element): number {
  if (attacker === 'normal') return 1;
  if (BEATS[attacker].includes(defender)) return 2;
  if (BEATS[defender].includes(attacker)) return 0.5;
  return 1;
}

export const TEAM_SIZE = 3;
export const MAX_ENERGY = 5;
export const STATUS_INFO: Record<Status, { label: string; emoji: string; turns: number }> = {
  burn: { label: 'Burned', emoji: '🔥', turns: 3 },
  soak: { label: 'Soaked', emoji: '💧', turns: 3 },
  drowsy: { label: 'Drowsy', emoji: '💤', turns: 2 },
  stun: { label: 'Stunned', emoji: '⚡', turns: 2 },
  chill: { label: 'Chilled', emoji: '❄️', turns: 3 },
  /** Poison lasts until the pet is switched out. */
  poison: { label: 'Poisoned', emoji: '🟣', turns: 99 },
  sleep: { label: 'Asleep', emoji: '💤', turns: 2 },
};
/** What each status does, in a few words (battle screen tips). */
export const STATUS_EFFECT: Record<Status, string> = {
  burn: 'Loses a little HP each turn.',
  soak: 'Slower for a few turns.',
  drowsy: 'May doze off and lose a turn.',
  stun: '35% chance to lose a turn.',
  chill: 'Much slower for a few turns.',
  poison: 'Loses HP every turn until switched out.',
  sleep: 'Usually can’t move for 2 turns.',
};
export const BUFF_INFO: Record<Buff, { label: string; emoji: string }> = {
  atkUp: { label: 'Attack up', emoji: '⚔️' },
  defUp: { label: 'Defense up', emoji: '🛡️' },
  dodgeUp: { label: 'Evasive', emoji: '🌫️' },
  guard: { label: 'Guarded', emoji: '🛡️' },
  spdUp: { label: 'Speed up', emoji: '💨' },
};

/* ---------------- Habit buffs ---------------- */

export interface HabitBuff {
  id: 'rested' | 'hydrated' | 'energized' | 'cared' | 'streak' | 'trained' | 'calm' | 'rings';
  label: string;
  emoji: string;
  text: string;
}

/** Battle buffs from today's real habits. */
export function habitBuffs(s: GameState): HabitBuff[] {
  const d = A.today(s);
  const out: HabitBuff[] = [];
  if (d.sleepHours >= 7) out.push({ id: 'rested', label: 'Well Rested', emoji: '😴', text: '+5% Speed (slept 7+ hours)' });
  if (d.water >= waterGoalOf(d)) out.push({ id: 'hydrated', label: 'Hydrated', emoji: '💧', text: `+5% Defense (water goal reached)` });
  if (d.steps >= stepGoalOf(d)) out.push({ id: 'energized', label: 'Energized', emoji: '👟', text: `Start with +1 ⚡ (step goal reached)` });
  const care = careMultiplier(d);
  if (care > 1) out.push({ id: 'cared', label: 'Well Cared For', emoji: '💖', text: `+${Math.round(((care - 1) / 4) * 100)}% Attack (pet care today)` });
  if ((d.exerciseMin ?? 0) >= EXERCISE_MINUTES || (d.rings?.exercise ?? 0) >= 1) out.push({ id: 'trained', label: 'Trained', emoji: '🏋️', text: '+5% Attack (30+ exercise minutes)' });
  if ((d.mindfulMin ?? 0) >= MINDFUL_MINUTES) out.push({ id: 'calm', label: 'Calm', emoji: '🧘', text: "Can't be made drowsy (5+ mindful minutes)" });
  if (ringsClosed(d) === 3) out.push({ id: 'rings', label: 'Rings Closed', emoji: '⭕', text: '+5% to all stats (all 3 activity rings)' });
  const st = Math.min(A.streak(s), 10);
  if (st > 0) out.push({ id: 'streak', label: `${st}-Day Streak`, emoji: '⭐', text: `+${Math.round(st / 3)}% to all stats` });
  return out;
}

/** Every habit buff, with what it does, how to earn it, and what you did today (for the tap-to-explain sheet). */
export interface BuffInfo {
  id: HabitBuff['id'];
  label: string;
  effect: string;
  how: string;
  have: boolean;
  /** What you did today toward it, e.g. "You slept 7.5 hours". */
  today: string;
  healthOnly?: boolean;
}

export function buffInfo(s: GameState): BuffInfo[] {
  const d = A.today(s);
  const have = new Set(habitBuffs(s).map((b) => b.id));
  const care = careMultiplier(d);
  const c = d.care ?? {};
  const careDone = [c.fed && 'fed', (c.played ?? 0) >= 3 && 'played with', c.treat && 'gave a treat to'].filter(Boolean) as string[];
  const st = Math.min(A.streak(s), 10);
  const sg = stepGoalOf(d);
  const wg = waterGoalOf(d);
  return [
    { id: 'rested', label: 'Well Rested', effect: '+5% Speed', how: 'Sleep 7 or more hours.', have: have.has('rested'), today: d.sleepHours ? `You slept ${d.sleepHours} hours last night.` : 'No sleep logged yet today.' },
    { id: 'hydrated', label: 'Hydrated', effect: '+5% Defense', how: `Reach your water goal (${wg} glasses, ${wg * 8} oz).`, have: have.has('hydrated'), today: `You’ve had ${Math.round(d.water * 10) / 10} of ${wg} glasses today.` },
    { id: 'energized', label: 'Energized', effect: 'Start battles with +1 energy', how: `Reach your step goal (${sg.toLocaleString()} steps).`, have: have.has('energized'), today: `You’ve walked ${d.steps.toLocaleString()} of ${sg.toLocaleString()} steps today.` },
    { id: 'cared', label: 'Well Cared For', effect: 'Up to +7.5% Attack', how: 'Feed, play with (3 times) and give a treat to your pet each day. Each one adds more.', have: have.has('cared'), today: careDone.length ? `Today you ${careDone.join(', ')} your pet (+${Math.round(((care - 1) / 4) * 1000) / 10}% Attack).` : 'No pet care yet today.' },
    { id: 'streak', label: 'Streak', effect: 'Up to +3% to all stats', how: 'Finish your daily quests day after day. Each day adds a little, up to 10 days.', have: st > 0, today: st > 0 ? `You’re on a ${st}-day streak (+${Math.round((st / 3) * 10) / 10}% to all stats).` : 'No streak yet. Finish today’s quests to start one.' },
    { id: 'trained', label: 'Trained', effect: '+5% Attack', how: '30 or more exercise minutes, or close your Exercise ring.', have: have.has('trained'), today: `${d.exerciseMin ?? 0} exercise minutes today.`, healthOnly: true },
    { id: 'calm', label: 'Calm', effect: 'Can’t be made drowsy', how: '5 or more mindful minutes (meditation or breathing).', have: have.has('calm'), today: `${d.mindfulMin ?? 0} mindful minutes today.`, healthOnly: true },
    { id: 'rings', label: 'Rings Closed', effect: '+5% to all stats', how: 'Close all 3 activity rings.', have: have.has('rings'), today: `${ringsClosed(d)} of 3 rings closed today.`, healthOnly: true },
  ];
}

function applyHabitBuffs(b: StatBlock, buffs: HabitBuff[], care = 1, streak = 0): StatBlock {
  const out = { ...b };
  const all = 1 + streak / 300;
  STATS.forEach((k) => (out[k] = out[k] * all));
  if (buffs.some((x) => x.id === 'rested')) out.spd *= 1.05;
  if (buffs.some((x) => x.id === 'hydrated')) out.def *= 1.05;
  if (buffs.some((x) => x.id === 'cared')) out.atk *= 1 + (care - 1) / 4;
  if (buffs.some((x) => x.id === 'trained')) out.atk *= 1.05;
  if (buffs.some((x) => x.id === 'rings')) STATS.forEach((k) => (out[k] *= 1.05));
  STATS.forEach((k) => (out[k] = Math.round(out[k])));
  return out;
}

/* ---------------- Fighters ---------------- */

export interface PetLike {
  id?: string;
  speciesId: string;
  nickname: string;
  xp: number;
  shiny: boolean;
  hat?: string;
  aura?: string;
  skin?: Skin;
  look?: { hat?: string; aura?: string };
  personality?: Personality;
  train?: Training;
  moves?: string[];
}

export interface Fighter {
  key: string;
  speciesId: string;
  nickname: string;
  shiny: boolean;
  hat?: string;
  aura?: string;
  skin?: Skin;
  xp: number;
  level: number;
  element: Element;
  rarity: Rarity;
  personality: Personality;
  stats: StatBlock;
  maxHp: number;
  hp: number;
  energy: number;
  moves: MoveDef[];
  status?: { type: Status; turns: number };
  buffs: Partial<Record<Buff, number>>;
  /** Mindful minutes today: this fighter can't be made drowsy. */
  calm?: boolean;
  /** Legendary and Epic pets: a free signature move, once per battle. */
  sig?: MoveDef;
  sigUsed?: boolean;
}

export function makeFighter(p: PetLike, key: string, buffs: HabitBuff[] = [], care = 1, streak = 0): Fighter {
  const sp = SPECIES_BY_ID[p.speciesId];
  const personality = personalityOf({ id: p.id ?? key, personality: p.personality, speciesId: p.speciesId, nickname: p.nickname });
  const stats = applyHabitBuffs(statsFor({ ...p, personality }), buffs, care, streak);
  return {
    key,
    speciesId: p.speciesId,
    nickname: p.nickname || sp.name,
    shiny: p.shiny,
    hat: p.hat ?? p.look?.hat,
    aura: p.aura ?? p.look?.aura,
    skin: p.skin,
    xp: p.xp,
    level: levelFor(p.xp),
    element: sp.element,
    rarity: sp.rarity,
    personality,
    stats,
    maxHp: stats.hp,
    hp: stats.hp,
    energy: 1 + (buffs.some((x) => x.id === 'energized') ? 1 : 0),
    moves: equippedMoves(p),
    ...(SIGNATURES[p.speciesId] ? { sig: SIGNATURES[p.speciesId] } : {}),
    buffs: {},
    ...(buffs.some((x) => x.id === 'calm') ? { calm: true } : {}),
  };
}

/** Your three highest-level pets, with your active pet first. */
export function defaultTeam(s: GameState): string[] {
  const sorted = [...s.pets].sort((a, b) => Number(b.id === s.activePetId) - Number(a.id === s.activePetId) || b.xp - a.xp);
  return sorted.slice(0, TEAM_SIZE).map((p) => p.id);
}

/** Wild pets near your team's level, with their points spread around, so there's always someone to battle. */
export function wildTeam(myLevels: number[], rng: Rng = defaultRng): PetLike[] {
  const avg = myLevels.length ? Math.round(myLevels.reduce((a, b) => a + b, 0) / myLevels.length) : 1;
  const pool = SPECIES.filter((x) => x.rarity === 'common' || x.rarity === 'uncommon' || (avg >= 8 && x.rarity === 'rare'));
  return Array.from({ length: TEAM_SIZE }, (_, i) => {
    const sp = pickOne(pool, rng);
    const level = Math.max(1, avg + randInt(-1, 0, rng));
    const t: Training = {};
    for (let k = 1; k < level; k++) {
      const st = STATS[Math.floor(rng() * STATS.length)];
      t[st] = (t[st] ?? 0) + 1;
    }
    return { id: `wild${i}${sp.id}`, speciesId: sp.id, nickname: `Wild ${sp.name}`, xp: xpForLevel(level) + 5, shiny: false, train: t };
  });
}

/* ---------------- Battle ---------------- */

export type Side = 'me' | 'them';
/** `lead`: after one of your pets fainted, the pet you chose to send in (free, before the turn). */
export type Action = ({ type: 'move'; moveId: string } | { type: 'switch'; index: number } | { type: 'potion'; heal: number; label: string }) & { lead?: number };

export interface Battle {
  mine: Fighter[];
  theirs: Fighter[];
  mi: number;
  ti: number;
  /** Sides that just lost a pet and may pick who goes in next (otherwise the next one in line steps in). */
  choose?: Side[];
  turn: number;
  over: null | 'win' | 'lose';
}

export interface BattleEvent {
  side: Side;
  kind: 'move' | 'miss' | 'doze' | 'switch' | 'burn' | 'faint' | 'status' | 'heal' | 'buff' | 'energy' | 'statusEnd' | 'end';
  text: string;
  move?: MoveDef;
  damage?: number;
  effect?: number;
  crit?: boolean;
  healed?: number;
  /** The side that took damage (for hit animations). */
  target?: Side;
}

/** One step of a turn, with the battle as it looks right after it, so the screen can play it back. */
export interface Frame {
  event: BattleEvent;
  battle: Battle;
}

export function startBattle(mine: PetLike[], theirs: PetLike[], myBuffs: HabitBuff[] = [], opts: { care?: number; streak?: number } = {}): Battle {
  return {
    mine: mine.slice(0, TEAM_SIZE).map((p, i) => makeFighter(p, `m${i}`, myBuffs, opts.care ?? 1, opts.streak ?? 0)),
    theirs: theirs.slice(0, TEAM_SIZE).map((p, i) => makeFighter(p, `t${i}`)),
    mi: 0,
    ti: 0,
    turn: 0,
    over: null,
  };
}

/** Today's battle buffs plus the numbers they need, ready for startBattle. */
export function myBattleSetup(s: GameState) {
  return { buffs: habitBuffs(s), care: careMultiplier(A.today(s)), streak: Math.min(A.streak(s), 10) };
}

const clone = (b: Battle): Battle => ({
  ...b,
  mine: b.mine.map((f) => ({ ...f, buffs: { ...f.buffs }, status: f.status ? { ...f.status } : undefined })),
  theirs: b.theirs.map((f) => ({ ...f, buffs: { ...f.buffs }, status: f.status ? { ...f.status } : undefined })),
});

const team = (b: Battle, side: Side) => (side === 'me' ? b.mine : b.theirs);
const activeIdx = (b: Battle, side: Side) => (side === 'me' ? b.mi : b.ti);
export const active = (b: Battle, side: Side) => team(b, side)[activeIdx(b, side)];
const other = (side: Side): Side => (side === 'me' ? 'them' : 'me');
const alive = (f: Fighter) => f.hp > 0;

function effSpeed(f: Fighter) {
  return f.stats.spd * (f.status?.type === 'soak' ? 0.65 : f.status?.type === 'chill' ? 0.55 : 1) * (f.buffs.spdUp ? 1.4 : 1);
}

export const canUse = (f: Fighter, m: MoveDef) => f.energy >= m.cost && !(m.signature && f.sigUsed);
/** Every move this fighter could pick right now, signature included. */
export const allMoves = (f: Fighter): MoveDef[] => [...f.moves, ...(f.sig && !f.sigUsed ? [f.sig] : [])];

/** The opponent's choice: big hits when charged, heals when hurt, smart about elements. */
export function aiAction(b: Battle, side: Side = 'them', rng: Rng = defaultRng): Action {
  const me = active(b, side);
  const foe = active(b, other(side));
  const usable = allMoves(me).filter((m) => canUse(me, m));
  const hurt = me.hp / me.maxHp;
  let best: MoveDef = usable[0] ?? MOVES.tackle;
  let bestScore = -1;
  for (const m of usable) {
    let score = 0;
    if (m.kind === 'attack') score = (m.power ?? 0) * (m.slowBonus && effSpeed(me) < effSpeed(foe) ? 1.5 : 1) * effectiveness(m.element, foe.element) * (m.element === me.element ? 1.1 : 1) + (m.status && !foe.status ? 12 + 20 * m.status.chance : 0) + (m.signature ? 25 : 0);
    else if (m.kind === 'heal') score = hurt < 0.4 ? 120 : hurt < 0.65 ? 40 : 0;
    else if (m.kind === 'buff') score = me.buffs[m.buff!] ? 0 : hurt > 0.6 ? 45 : 15;
    else if (m.kind === 'energy') score = me.energy <= 1 && me.moves.some((x) => x.cost >= 3) ? 42 : 5;
    score *= 0.8 + rng() * 0.4;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return { type: 'move', moveId: best.id };
}

/** Plays one turn and returns each step so the screen can animate it. */
/** Shows the pet the player picked right away (the next turn makes it official). */
export function previewLead(b: Battle, side: Side, index: number): Battle {
  const t = team(b, side);
  if (!(b.choose ?? []).includes(side) || !t[index] || !alive(t[index])) return b;
  return side === 'me' ? { ...b, mi: index } : { ...b, ti: index };
}

export function playTurn(b0: Battle, myAction: Action, theirAction: Action, rng: Rng = defaultRng): Frame[] {
  if (b0.over) return [];
  const b = clone(b0);
  const frames: Frame[] = [];
  const push = (event: BattleEvent) => frames.push({ event, battle: clone(b) });
  const actions: Record<Side, Action> = { me: myAction, them: theirAction };

  // A side whose pet fainted last turn sends in the pet it picked (free).
  const choosing = b.choose ?? [];
  b.choose = undefined;
  (['me', 'them'] as Side[]).forEach((side) => {
    const lead = actions[side].lead;
    if (!choosing.includes(side) || lead === undefined) return;
    const t = team(b, side);
    if (!t[lead] || !alive(t[lead]) || lead === activeIdx(b, side)) return;
    if (side === 'me') b.mi = lead;
    else b.ti = lead;
    push({ side, kind: 'switch', text: `Go, ${active(b, side).nickname}!` });
  });

  // Switches happen first.
  (['me', 'them'] as Side[]).forEach((side) => {
    const a = actions[side];
    if (a.type !== 'switch') return;
    const t = team(b, side);
    if (!t[a.index] || !alive(t[a.index]) || a.index === activeIdx(b, side)) return;
    const prev = active(b, side);
    // Switching out cures poison.
    if (prev.status?.type === 'poison') prev.status = undefined;
    if (side === 'me') b.mi = a.index;
    else b.ti = a.index;
    push({ side, kind: 'switch', text: `${prev.nickname}, come back! Go, ${active(b, side).nickname}!` });
  });

  // Potions (trips, wild pets and the tower): drinking one uses your turn and heals the active pet.
  (['me', 'them'] as Side[]).forEach((side) => {
    const a = actions[side];
    if (a.type !== 'potion') return;
    const f = active(b, side);
    if (!alive(f)) return;
    const before = f.hp;
    f.hp = Math.min(f.maxHp, f.hp + Math.round((f.maxHp * a.heal) / 100));
    push({ side, kind: 'heal', healed: f.hp - before, text: `${f.nickname} drank a ${a.label} and healed ${f.hp - before} HP!` });
  });

  // Moves in order: priority first, then speed (ties are a coin flip).
  const movers = (['me', 'them'] as Side[]).filter((s) => actions[s].type === 'move');
  const moveOf = (side: Side) => {
    const f = active(b, side);
    const id = (actions[side] as { moveId: string }).moveId;
    const m = allMoves(f).find((x) => x.id === id) ?? MOVES[id] ?? MOVES.tackle;
    return canUse(f, m) ? m : MOVES.tackle;
  };
  const order = movers
    .map((side) => ({ side, f: active(b, side), m: moveOf(side), r: rng() }))
    .sort((x, y) => Number(!!y.m.priority) - Number(!!x.m.priority) || effSpeed(y.f) - effSpeed(x.f) || x.r - y.r);

  for (const { side, f: actorAtStart } of order) {
    if (b.over) break;
    const actor = active(b, side);
    // The pet may have fainted or been replaced earlier this turn.
    if (actor.key !== actorAtStart.key || !alive(actor)) continue;
    const move = moveOf(side);
    const foe = active(b, other(side));
    if (actor.status?.type === 'drowsy' && rng() < 0.4) {
      push({ side, kind: 'doze', text: `${actor.nickname} dozed off…` });
      continue;
    }
    if (actor.status?.type === 'sleep' && rng() < 0.75) {
      push({ side, kind: 'doze', text: `${actor.nickname} is fast asleep…` });
      continue;
    }
    if (actor.status?.type === 'stun' && rng() < 0.35) {
      push({ side, kind: 'doze', text: `${actor.nickname} is stunned and can’t move!` });
      continue;
    }
    actor.energy -= move.cost;
    if (move.signature) actor.sigUsed = true;
    if (move.kind === 'energy') {
      actor.energy = Math.min(MAX_ENERGY, actor.energy + (move.energy ?? 2));
      push({ side, kind: 'energy', move, text: `${actor.nickname} focuses and gains ⚡⚡!` });
      continue;
    }
    if (move.kind === 'buff') {
      actor.buffs[move.buff!] = move.buffTurns ?? 3;
      push({ side, kind: 'buff', move, text: `${actor.nickname} used ${move.name}! ${BUFF_INFO[move.buff!].label}!` });
      continue;
    }
    if (move.kind === 'heal') {
      const amount = Math.round(actor.maxHp * (move.heal ?? 0.3) * (actor.personality === 'gentle' ? 1.25 : 1));
      const before = actor.hp;
      actor.hp = Math.min(actor.maxHp, actor.hp + amount);
      if (move.id === 'bloom' || move.cure) actor.status = undefined;
      push({ side, kind: 'heal', move, healed: actor.hp - before, text: `${actor.nickname} used ${move.name} and healed ${actor.hp - before} HP!` });
      continue;
    }
    // Attacks: dodge, damage, crit, status, drain.
    const sa = effSpeed(actor);
    const sd = effSpeed(foe);
    const dodge = Math.min(0.45, Math.max(0, 0.04 + ((sd - sa) / (sd + sa)) * 0.3) + (foe.buffs.dodgeUp ? 0.25 : 0));
    if (rng() < dodge) {
      push({ side, kind: 'miss', move, target: other(side), text: `${actor.nickname} used ${move.name}… ${foe.nickname} dodged it!` });
      continue;
    }
    const effect = effectiveness(move.element, foe.element);
    const stab = move.element === actor.element ? 1.15 : 1;
    const crit = rng() < (actor.personality === 'lucky' ? 0.18 : 0.08);
    const atk = actor.stats.atk * (actor.buffs.atkUp ? 1.3 : 1);
    const def = foe.stats.def * (foe.buffs.defUp ? 1.45 : 1);
    const slow = move.slowBonus && sa < sd ? 1.5 : 1;
    const guard = foe.buffs.guard ? 0.6 : 1;
    const raw = (move.power ?? 40) * slow * guard * (atk / Math.max(1, def)) * 0.34 * effect * stab * (0.88 + rng() * 0.12) * (crit ? 1.5 : 1);
    const damage = Math.max(1, Math.round(raw));
    foe.hp = Math.max(0, foe.hp - damage);
    let text = `${actor.nickname} used ${move.name}!`;
    if (effect > 1) text += ' Super effective!';
    if (effect < 1) text += ' Not very effective…';
    if (crit) text += ' Critical hit!';
    push({ side, kind: 'move', move, damage, effect, crit, target: other(side), text });
    if (move.splash) {
      const bench = team(b, other(side)).filter((x) => x !== foe && alive(x));
      bench.forEach((x) => (x.hp = Math.max(1, x.hp - Math.round(damage * move.splash!))));
      if (bench.length) push({ side, kind: 'move', move, target: other(side), text: `The blast hits the whole team!` });
    }
    if (move.drain && alive(actor)) {
      const healed = Math.min(actor.maxHp - actor.hp, Math.round(damage * move.drain));
      if (healed > 0) {
        actor.hp += healed;
        push({ side, kind: 'heal', move, healed, text: `${actor.nickname} drained ${healed} HP!` });
      }
    }
    if (move.status && alive(foe) && !foe.status && !(foe.calm && (move.status.type === 'drowsy' || move.status.type === 'sleep')) && rng() < move.status.chance) {
      foe.status = { type: move.status.type, turns: STATUS_INFO[move.status.type].turns };
      push({ side: other(side), kind: 'status', text: `${foe.nickname} is ${STATUS_INFO[move.status.type].label.toLowerCase()}!` });
    }
    if (!alive(foe)) faint(b, other(side), push);
  }

  // End of turn: burns, timers and energy.
  if (!b.over) {
    for (const side of ['me', 'them'] as Side[]) {
      if (b.over) break;
      const f = active(b, side);
      if (!alive(f)) continue;
      if (f.status?.type === 'burn' || f.status?.type === 'poison') {
        const poison = f.status.type === 'poison';
        const dmg = Math.max(1, Math.round(f.maxHp * (poison ? 0.06 : 0.07)));
        f.hp = Math.max(0, f.hp - dmg);
        push({ side, kind: 'burn', damage: dmg, target: side, text: poison ? `${f.nickname} is hurt by poison!` : `${f.nickname} is hurt by its burn!` });
        if (!alive(f)) {
          faint(b, side, push);
          continue;
        }
      }
      if (f.status) {
        f.status.turns -= 1;
        if (f.status.turns <= 0) {
          const ended = f.status.type;
          f.status = undefined;
          push({ side, kind: 'statusEnd', text: `${f.nickname} is no longer ${STATUS_INFO[ended].label.toLowerCase()}.` });
        }
      }
      (Object.keys(f.buffs) as Buff[]).forEach((k) => {
        f.buffs[k] = (f.buffs[k] ?? 0) - 1;
        if ((f.buffs[k] ?? 0) <= 0) delete f.buffs[k];
      });
      f.energy = Math.min(MAX_ENERGY, f.energy + 1);
    }
  }
  b.turn += 1;
  // A very long battle ends on remaining health.
  if (!b.over && b.turn >= 60) {
    const pct = (t: Fighter[]) => t.reduce((a, f) => a + f.hp / f.maxHp, 0);
    b.over = pct(b.mine) >= pct(b.theirs) ? 'win' : 'lose';
  }
  // The last frame always holds the final state of the turn.
  frames.push({ event: { side: 'me', kind: 'end', text: '' }, battle: clone(b) });
  return frames;
}

function faint(b: Battle, side: Side, push: (e: BattleEvent) => void) {
  const f = active(b, side);
  const next = team(b, side).findIndex((x) => alive(x));
  if (next === -1) {
    b.over = side === 'them' ? 'win' : 'lose';
    push({ side, kind: 'faint', target: side, text: `${f.nickname} fainted!` });
    return;
  }
  if (side === 'me') b.mi = next;
  else b.ti = next;
  // With more than one pet left, the player gets to choose who goes in.
  if (team(b, side).filter(alive).length > 1) b.choose = [...(b.choose ?? []).filter((x) => x !== side), side];
  push({ side, kind: 'faint', target: side, text: `${f.nickname} fainted! ${active(b, side).nickname} steps in!` });
}

/** Runs a whole battle with both sides played by the AI (used for balance tests). */
/* ---------------- Live battles (two real players) ---------------- */

/** One player's side of a live battle: their pets plus that day's habit buffs. */
export interface LiveTeam {
  pets: PetLike[];
  buffs: HabitBuff[];
  care: number;
  streak: number;
}

export type LiveTurn = { c: Action; o: Action };

export function liveTeamFrom(s: GameState, ids: string[]): LiveTeam {
  const setup = myBattleSetup(s);
  const pets = ids
    .map((id) => s.pets.find((p) => p.id === id))
    .filter(Boolean)
    .slice(0, TEAM_SIZE)
    .map((p) => ({ id: p!.id, speciesId: p!.speciesId, nickname: p!.nickname, xp: p!.xp, shiny: p!.shiny, skin: p!.skin, look: p!.look, personality: p!.personality, train: p!.train, moves: p!.moves, ivs: p!.ivs, foodBoost: p!.foodBoost }) as PetLike);
  return { pets, buffs: setup.buffs, care: setup.care, streak: setup.streak };
}

/**
 * The battle as both phones see it, always worked out from the challenger's side ('me' = challenger).
 * Each turn uses its own seeded random numbers, so replaying the history gives the same result anywhere.
 */
export function liveStart(c: LiveTeam, o: LiveTeam): Battle {
  return {
    mine: c.pets.slice(0, TEAM_SIZE).map((p, i) => makeFighter(p, `m${i}`, c.buffs, c.care, c.streak)),
    theirs: o.pets.slice(0, TEAM_SIZE).map((p, i) => makeFighter(p, `t${i}`, o.buffs, o.care, o.streak)),
    mi: 0,
    ti: 0,
    turn: 0,
    over: null,
  };
}

const liveRng = (seed: string, turn: number) => seededRng(`${seed}:${turn}`);

/** Replays every finished turn. Returns the battle now and the frames of the last turn (to animate). */
export function liveReplay(c: LiveTeam, o: LiveTeam, seed: string, history: LiveTurn[]): { battle: Battle; last: Frame[] } {
  let b = liveStart(c, o);
  let last: Frame[] = [];
  history.forEach((t, i) => {
    if (b.over) return;
    last = playTurn(b, t.c, t.o, liveRng(seed, i));
    b = last[last.length - 1].battle;
  });
  return { battle: b, last };
}

/** Turns the challenger's view into the opponent's view (swap sides). */
export function flipBattle(b: Battle): Battle {
  return { ...b, mine: b.theirs, theirs: b.mine, mi: b.ti, ti: b.mi, ...(b.choose ? { choose: b.choose.map((x): Side => (x === 'me' ? 'them' : 'me')) } : {}), over: b.over === 'win' ? 'lose' : b.over === 'lose' ? 'win' : null };
}
export function flipFrames(frames: Frame[]): Frame[] {
  const sw = (x: Side): Side => (x === 'me' ? 'them' : 'me');
  return frames.map((f) => ({
    event: { ...f.event, side: sw(f.event.side), ...(f.event.target ? { target: sw(f.event.target) } : {}) },
    battle: flipBattle(f.battle),
  }));
}

export function simulate(b: Battle, rng: Rng = defaultRng): { battle: Battle; turns: number } {
  let cur = b;
  let n = 0;
  while (!cur.over && n < 100) {
    const frames = playTurn(cur, aiAction(cur, 'me', rng), aiAction(cur, 'them', rng), rng);
    cur = frames[frames.length - 1].battle;
    n++;
  }
  return { battle: cur, turns: n };
}

/* ---------------- Rewards ---------------- */

/** Only the first few battles each day pay out, so battling stays a bonus and walking stays the main way to earn. */
export const REWARDED_PER_DAY = 5;

export interface BattleReward {
  coins: number;
  chest: boolean;
  rewarded: boolean;
}

export function finishBattle(s: GameState, won: boolean, vsFriend: boolean, rng: Rng = defaultRng): { state: GameState; reward: BattleReward } {
  const day = A.todayKey(s);
  const rec = s.battle && s.battle.day === day ? s.battle : { day, rewarded: 0, wonToday: false, wins: s.battle?.wins ?? 0, losses: s.battle?.losses ?? 0 };
  const rewarded = rec.rewarded < REWARDED_PER_DAY;
  const coins = rewarded ? (won ? (vsFriend ? 20 : 15) : 5) : 0;
  const chest = rewarded && won && !rec.wonToday;
  let next: GameState = {
    ...s,
    coins: s.coins + coins,
    battle: { ...s.battle, day, rewarded: rec.rewarded + (rewarded ? 1 : 0), wonToday: rec.wonToday || won, wins: rec.wins + (won ? 1 : 0), losses: rec.losses + (won ? 0 : 1) },
  };
  if (chest) next = A.grantChest(next, 'bronze', 'First battle win of the day', rng);
  return { state: next, reward: { coins, chest, rewarded } };
}

export function battlesLeftToday(s: GameState): number {
  const day = A.todayKey(s);
  return Math.max(0, REWARDED_PER_DAY - (s.battle && s.battle.day === day ? s.battle.rewarded : 0));
}

/** Damage your team dealt in a finished battle, sent to your guild's boss (wins count 1.5×, max 400 a hit). */
/** Battles chip in a little to the guild boss (walking does most of it): up to 80 per battle, 5 a day. */
export const RAID_BATTLE_MAX = 80;
export function raidDamage(b: Battle): number {
  const dealt = b.theirs.reduce((a, f) => a + (f.maxHp - Math.max(0, f.hp)), 0);
  return Math.min(RAID_BATTLE_MAX, Math.round(dealt * 0.3 * (b.over === 'win' ? 1.5 : 1)));
}
