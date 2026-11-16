import type { Element, GameState, Rarity, Skin } from './types';
import { levelFor, xpForLevel } from './scoring';
import { SPECIES, SPECIES_BY_ID } from './species';
import { careMultiplier } from './care';
import { pickOne, randInt, type Rng, defaultRng } from './random';
import * as A from './actions';
import {
  MOVES, STATS, equippedMoves, personalityOf, statsFor,
  type Buff, type MoveDef, type Personality, type StatBlock, type Status, type Training,
} from './stats';

/**
 * Battles: up to 3 vs 3. Each turn both sides pick a move (or switch pets).
 * Moves cost energy (⚡), which builds up every turn. Faster pets go first and dodge more.
 * Elements: Flower > Tide > Ember > Moon > Flower. Real-life habits give battle buffs.
 */

export const BEATS: Record<Element, Element> = { flower: 'tide', tide: 'ember', ember: 'moon', moon: 'flower' };
export const ELEMENT_LABEL: Record<Element, string> = { flower: 'Flower', tide: 'Tide', ember: 'Ember', moon: 'Moon' };
export const ELEMENT_COLOR: Record<Element, string> = { flower: '#5DBB63', moon: '#8E7CE0', ember: '#FF8A4C', tide: '#2E9BD6' };
export const NORMAL_COLOR = '#8A9AA0';

export function effectiveness(attacker: Element | 'normal', defender: Element): number {
  if (attacker === 'normal') return 1;
  if (BEATS[attacker] === defender) return 1.5;
  if (BEATS[defender] === attacker) return 0.75;
  return 1;
}

export const TEAM_SIZE = 3;
export const MAX_ENERGY = 5;
export const STATUS_INFO: Record<Status, { label: string; emoji: string; turns: number }> = {
  burn: { label: 'Burned', emoji: '🔥', turns: 3 },
  soak: { label: 'Soaked', emoji: '💧', turns: 3 },
  drowsy: { label: 'Drowsy', emoji: '💤', turns: 2 },
};
export const BUFF_INFO: Record<Buff, { label: string; emoji: string }> = {
  atkUp: { label: 'Attack up', emoji: '⚔️' },
  defUp: { label: 'Defense up', emoji: '🛡️' },
  dodgeUp: { label: 'Evasive', emoji: '🌫️' },
};

/* ---------------- Habit buffs ---------------- */

export interface HabitBuff {
  id: 'rested' | 'hydrated' | 'energized' | 'cared' | 'streak';
  label: string;
  emoji: string;
  text: string;
}

/** Battle buffs from today's real habits. */
export function habitBuffs(s: GameState): HabitBuff[] {
  const d = A.today(s);
  const out: HabitBuff[] = [];
  if (d.sleepHours >= 7) out.push({ id: 'rested', label: 'Well Rested', emoji: '😴', text: '+8% Speed (slept 7+ hours)' });
  if (d.water >= 6) out.push({ id: 'hydrated', label: 'Hydrated', emoji: '💧', text: '+8% Defense (6+ glasses of water)' });
  if (d.steps >= 8000) out.push({ id: 'energized', label: 'Energized', emoji: '👟', text: 'Start with +1 ⚡ (8,000+ steps)' });
  const care = careMultiplier(d);
  if (care > 1) out.push({ id: 'cared', label: 'Well Cared For', emoji: '💖', text: `+${Math.round(((care - 1) / 2) * 100)}% Attack (pet care today)` });
  const st = Math.min(A.streak(s), 10);
  if (st > 0) out.push({ id: 'streak', label: `${st}-Day Streak`, emoji: '⭐', text: `+${Math.round(st / 2)}% to all stats` });
  return out;
}

function applyHabitBuffs(b: StatBlock, buffs: HabitBuff[], care = 1, streak = 0): StatBlock {
  const out = { ...b };
  const all = 1 + streak / 200;
  STATS.forEach((k) => (out[k] = out[k] * all));
  if (buffs.some((x) => x.id === 'rested')) out.spd *= 1.08;
  if (buffs.some((x) => x.id === 'hydrated')) out.def *= 1.08;
  if (buffs.some((x) => x.id === 'cared')) out.atk *= 1 + (care - 1) / 2;
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
  skin?: Skin;
  look?: { hat?: string };
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
    buffs: {},
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
export type Action = { type: 'move'; moveId: string } | { type: 'switch'; index: number };

export interface Battle {
  mine: Fighter[];
  theirs: Fighter[];
  mi: number;
  ti: number;
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
  return f.stats.spd * (f.status?.type === 'soak' ? 0.65 : 1);
}

export const canUse = (f: Fighter, m: MoveDef) => f.energy >= m.cost;

/** The opponent's choice: big hits when charged, heals when hurt, smart about elements. */
export function aiAction(b: Battle, side: Side = 'them', rng: Rng = defaultRng): Action {
  const me = active(b, side);
  const foe = active(b, other(side));
  const usable = me.moves.filter((m) => canUse(me, m));
  const hurt = me.hp / me.maxHp;
  let best: MoveDef = usable[0] ?? MOVES.tackle;
  let bestScore = -1;
  for (const m of usable) {
    let score = 0;
    if (m.kind === 'attack') score = (m.power ?? 0) * effectiveness(m.element, foe.element) * (m.element === me.element ? 1.1 : 1) + (m.status && !foe.status ? 12 : 0);
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
export function playTurn(b0: Battle, myAction: Action, theirAction: Action, rng: Rng = defaultRng): Frame[] {
  if (b0.over) return [];
  const b = clone(b0);
  const frames: Frame[] = [];
  const push = (event: BattleEvent) => frames.push({ event, battle: clone(b) });
  const actions: Record<Side, Action> = { me: myAction, them: theirAction };

  // Switches happen first.
  (['me', 'them'] as Side[]).forEach((side) => {
    const a = actions[side];
    if (a.type !== 'switch') return;
    const t = team(b, side);
    if (!t[a.index] || !alive(t[a.index]) || a.index === activeIdx(b, side)) return;
    const prev = active(b, side);
    if (side === 'me') b.mi = a.index;
    else b.ti = a.index;
    push({ side, kind: 'switch', text: `${prev.nickname}, come back! Go, ${active(b, side).nickname}!` });
  });

  // Moves in order: priority first, then speed (ties are a coin flip).
  const movers = (['me', 'them'] as Side[]).filter((s) => actions[s].type === 'move');
  const moveOf = (side: Side) => {
    const f = active(b, side);
    const id = (actions[side] as { moveId: string }).moveId;
    const m = f.moves.find((x) => x.id === id) ?? MOVES[id] ?? MOVES.tackle;
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
      push({ side, kind: 'doze', text: `${actor.nickname} dozed off… 💤` });
      continue;
    }
    actor.energy -= move.cost;
    if (move.kind === 'energy') {
      actor.energy = Math.min(MAX_ENERGY, actor.energy + (move.energy ?? 2));
      push({ side, kind: 'energy', move, text: `${actor.nickname} focuses and gains ⚡⚡!` });
      continue;
    }
    if (move.kind === 'buff') {
      actor.buffs[move.buff!] = 3;
      push({ side, kind: 'buff', move, text: `${actor.nickname} used ${move.name}! ${BUFF_INFO[move.buff!].label}!` });
      continue;
    }
    if (move.kind === 'heal') {
      const amount = Math.round(actor.maxHp * (move.heal ?? 0.3) * (actor.personality === 'gentle' ? 1.25 : 1));
      const before = actor.hp;
      actor.hp = Math.min(actor.maxHp, actor.hp + amount);
      if (move.id === 'bloom') actor.status = undefined;
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
    const raw = (move.power ?? 40) * (atk / Math.max(1, def)) * 0.34 * effect * stab * (0.88 + rng() * 0.12) * (crit ? 1.5 : 1);
    const damage = Math.max(1, Math.round(raw));
    foe.hp = Math.max(0, foe.hp - damage);
    let text = `${actor.nickname} used ${move.name}!`;
    if (effect > 1) text += ' Super effective!';
    if (effect < 1) text += ' Not very effective…';
    if (crit) text += ' Critical hit!';
    push({ side, kind: 'move', move, damage, effect, crit, target: other(side), text });
    if (move.drain && alive(actor)) {
      const healed = Math.min(actor.maxHp - actor.hp, Math.round(damage * move.drain));
      if (healed > 0) {
        actor.hp += healed;
        push({ side, kind: 'heal', move, healed, text: `${actor.nickname} drained ${healed} HP!` });
      }
    }
    if (move.status && alive(foe) && !foe.status && rng() < move.status.chance) {
      foe.status = { type: move.status.type, turns: STATUS_INFO[move.status.type].turns };
      push({ side: other(side), kind: 'status', text: `${foe.nickname} is ${STATUS_INFO[move.status.type].label.toLowerCase()}! ${STATUS_INFO[move.status.type].emoji}` });
    }
    if (!alive(foe)) faint(b, other(side), push);
  }

  // End of turn: burns, timers and energy.
  if (!b.over) {
    for (const side of ['me', 'them'] as Side[]) {
      if (b.over) break;
      const f = active(b, side);
      if (!alive(f)) continue;
      if (f.status?.type === 'burn') {
        const dmg = Math.max(1, Math.round(f.maxHp * 0.07));
        f.hp = Math.max(0, f.hp - dmg);
        push({ side, kind: 'burn', damage: dmg, target: side, text: `${f.nickname} is hurt by its burn! 🔥` });
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
  push({ side, kind: 'faint', target: side, text: `${f.nickname} fainted! ${side === 'me' ? 'Go' : 'They send out'} ${active(b, side).nickname}!` });
}

/** Runs a whole battle with both sides played by the AI (used for balance tests). */
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
  const coins = rewarded ? (won ? (vsFriend ? 30 : 20) : 5) : 0;
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
export function raidDamage(b: Battle): number {
  const dealt = b.theirs.reduce((a, f) => a + (f.maxHp - Math.max(0, f.hp)), 0);
  return Math.min(400, Math.round(dealt * (b.over === 'win' ? 1.5 : 1)));
}
