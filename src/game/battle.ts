import type { Element, GameState, Rarity, Skin } from './types';
import { levelFor } from './scoring';
import { SPECIES, SPECIES_BY_ID } from './species';
import { careMultiplier } from './care';
import { pickOne, randInt, type Rng, defaultRng } from './random';
import * as A from './actions';

/**
 * Battles: 3 vs 3, one pet out at a time, against a snapshot of a friend's team (or wild pets).
 * Pets get stronger by leveling up, which only happens through healthy habits. Today's care boost
 * and your streak also power up your team, so the healthiest trainer has the edge.
 */

/** Each element beats the next one: Flower > Tide > Ember > Moon > Flower. */
export const BEATS: Record<Element, Element> = { flower: 'tide', tide: 'ember', ember: 'moon', moon: 'flower' };
export const ELEMENT_LABEL: Record<Element, string> = { flower: 'Flower', tide: 'Tide', ember: 'Ember', moon: 'Moon' };
export const ELEMENT_COLOR: Record<Element, string> = { flower: '#5DBB63', moon: '#8E7CE0', ember: '#FF8A4C', tide: '#2E9BD6' };

export function effectiveness(attacker: Element, defender: Element): number {
  if (BEATS[attacker] === defender) return 1.5;
  if (BEATS[defender] === attacker) return 0.75;
  return 1;
}

const RARITY_BONUS: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 5 };

export const TEAM_SIZE = 3;
export const SPECIAL_COST = 2;

export interface Fighter {
  key: string;
  hat?: string;
  skin?: Skin;
  speciesId: string;
  nickname: string;
  shiny: boolean;
  xp: number;
  level: number;
  element: Element;
  rarity: Rarity;
  maxHp: number;
  hp: number;
  atk: number;
  charge: number;
}

export interface PetLike {
  id?: string;
  hat?: string;
  skin?: Skin;
  look?: { hat?: string };
  speciesId: string;
  nickname: string;
  xp: number;
  shiny: boolean;
}

export function makeFighter(p: PetLike, key: string, power = 1): Fighter {
  const sp = SPECIES_BY_ID[p.speciesId];
  const level = levelFor(p.xp);
  const rb = RARITY_BONUS[sp.rarity];
  const maxHp = Math.round(60 + level * 8 + rb * 12);
  return {
    key,
    hat: p.hat ?? p.look?.hat,
    skin: p.skin,
    speciesId: p.speciesId,
    nickname: p.nickname || sp.name,
    shiny: p.shiny,
    xp: p.xp,
    level,
    element: sp.element,
    rarity: sp.rarity,
    maxHp,
    hp: maxHp,
    atk: Math.round((12 + level * 2.2 + rb * 3) * power),
    charge: 0,
  };
}

/** How much your healthy habits power up your team today: +2% per streak day (up to 10) plus today's care boost. */
export function battlePower(s: GameState): number {
  return Math.round((1 + Math.min(A.streak(s), 10) * 0.02 + (careMultiplier(A.today(s)) - 1)) * 100) / 100;
}

/** Your three highest-level pets, with your active pet always included. */
export function defaultTeam(s: GameState): string[] {
  const sorted = [...s.pets].sort((a, b) => Number(b.id === s.activePetId) - Number(a.id === s.activePetId) || b.xp - a.xp);
  return sorted.slice(0, TEAM_SIZE).map((p) => p.id);
}

/** Wild pets near your team's level, so there's always someone to battle. */
export function wildTeam(myLevels: number[], rng: Rng = defaultRng): PetLike[] {
  const avg = myLevels.length ? Math.round(myLevels.reduce((a, b) => a + b, 0) / myLevels.length) : 1;
  const pool = SPECIES.filter((x) => x.rarity === 'common' || x.rarity === 'uncommon' || (avg >= 8 && x.rarity === 'rare'));
  return Array.from({ length: TEAM_SIZE }, () => {
    const sp = pickOne(pool, rng);
    const level = Math.max(1, avg + randInt(-1, 0, rng));
    return { speciesId: sp.id, nickname: `Wild ${sp.name}`, xp: 25 * level * (level - 1) + 5, shiny: false };
  });
}

export type Move = 'attack' | 'special' | 'guard';
export type Side = 'me' | 'them';

export interface TurnEvent {
  side: Side;
  move: Move;
  damage: number;
  effect: number;
  crit: boolean;
  fainted: boolean;
  /** The pet that came out after a faint, if any. */
  next?: string;
}

export interface Battle {
  mine: Fighter[];
  theirs: Fighter[];
  mi: number;
  ti: number;
  turn: number;
  over: null | 'win' | 'lose';
}

export function startBattle(mine: PetLike[], theirs: PetLike[], myPower = 1, theirPower = 1): Battle {
  return {
    mine: mine.slice(0, TEAM_SIZE).map((p, i) => makeFighter(p, `m${i}`, myPower)),
    theirs: theirs.slice(0, TEAM_SIZE).map((p, i) => makeFighter(p, `t${i}`, theirPower)),
    mi: 0,
    ti: 0,
    turn: 0,
    over: null,
  };
}

/** The opponent's choice: specials when charged, mostly attacks, sometimes a guard. */
export function aiMove(f: Fighter, rng: Rng = defaultRng): Move {
  if (f.charge >= SPECIAL_COST && rng() < 0.75) return 'special';
  return rng() < 0.22 ? 'guard' : 'attack';
}

/** Plays one round. Guards protect for the whole round. */
export function playTurn(b: Battle, myMove: Move, theirMove: Move, rng: Rng = defaultRng): { battle: Battle; events: TurnEvent[] } {
  if (b.over) return { battle: b, events: [] };
  const mine = b.mine.map((f) => ({ ...f }));
  const theirs = b.theirs.map((f) => ({ ...f }));
  let mi = b.mi;
  let ti = b.ti;
  const events: TurnEvent[] = [];
  const moves: Record<Side, Move> = {
    me: myMove === 'special' && mine[mi].charge < SPECIAL_COST ? 'attack' : myMove,
    them: theirMove === 'special' && theirs[ti].charge < SPECIAL_COST ? 'attack' : theirMove,
  };
  const guarding: Record<Side, boolean> = { me: moves.me === 'guard', them: moves.them === 'guard' };

  const act = (side: Side) => {
    const att = side === 'me' ? mine[mi] : theirs[ti];
    const def = side === 'me' ? theirs[ti] : mine[mi];
    const move = moves[side];
    if (move === 'guard') {
      att.charge = Math.min(SPECIAL_COST, att.charge + 1);
      events.push({ side, move, damage: 0, effect: 1, crit: false, fainted: false });
      return;
    }
    const effect = effectiveness(att.element, def.element);
    const crit = rng() < 0.1;
    const base = att.atk * (move === 'special' ? 2 : 1) * effect * (0.85 + rng() * 0.15) * (crit ? 1.5 : 1);
    const damage = Math.max(1, Math.round(base * (guarding[side === 'me' ? 'them' : 'me'] ? 0.5 : 1)));
    if (move === 'special') att.charge -= SPECIAL_COST;
    else att.charge = Math.min(SPECIAL_COST, att.charge + 1);
    def.hp = Math.max(0, def.hp - damage);
    const ev: TurnEvent = { side, move, damage, effect, crit, fainted: def.hp === 0 };
    if (def.hp === 0) {
      if (side === 'me') {
        ti++;
        if (ti < theirs.length) ev.next = theirs[ti].nickname;
      } else {
        mi++;
        if (mi < mine.length) ev.next = mine[mi].nickname;
      }
    }
    events.push(ev);
  };

  // Guards go first. Otherwise the higher-level pet moves first, and ties are a coin flip.
  const lvMe = mine[mi].level;
  const lvThem = theirs[ti].level;
  const meFirst = guarding.me !== guarding.them ? guarding.me : lvMe !== lvThem ? lvMe > lvThem : rng() < 0.5;
  const order: Side[] = meFirst ? ['me', 'them'] : ['them', 'me'];
  act(order[0]);
  // A pet knocked out before it moved doesn't get to act; the newcomer waits for the next round.
  const firstKo = events[events.length - 1]?.fainted;
  if (!firstKo && mi < mine.length && ti < theirs.length) act(order[1]);

  const over = ti >= theirs.length ? 'win' : mi >= mine.length ? 'lose' : null;
  return { battle: { mine, theirs, mi: Math.min(mi, mine.length - 1), ti: Math.min(ti, theirs.length - 1), turn: b.turn + 1, over }, events };
}

/* ---------- Rewards ---------- */

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
    battle: { day, rewarded: rec.rewarded + (rewarded ? 1 : 0), wonToday: rec.wonToday || won, wins: rec.wins + (won ? 1 : 0), losses: rec.losses + (won ? 0 : 1) },
  };
  if (chest) next = A.grantChest(next, 'bronze', 'First battle win of the day', rng);
  return { state: next, reward: { coins, chest, rewarded } };
}

export function battlesLeftToday(s: GameState): number {
  const day = A.todayKey(s);
  return Math.max(0, REWARDED_PER_DAY - (s.battle && s.battle.day === day ? s.battle.rewarded : 0));
}
