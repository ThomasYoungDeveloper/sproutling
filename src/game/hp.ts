import type { GameState, OwnedPet } from './types';
import type { Battle, Fighter } from './battle';
/** Game time: real time plus the demo skip-a-day offset. */
const nowOf = (s: GameState, now = Date.now()) => now + s.dayOffset * 86_400_000;

/**
 * Pet HP that carries over. Fights on trips and wild pets on walks lower it; it only comes back
 * with a potion. Friend, live, ranked and arena battles always start at full HP.
 * HP is stored as a percent so it stays right when a pet levels up.
 */

export const SMALL = 'Small Potion';
export const FULL = 'Full Potion';
export type PotionKind = 'small' | 'full';
export const POTION_ITEM: Record<PotionKind, string> = { small: SMALL, full: FULL };
export const POTION_HEAL: Record<PotionKind, number> = { small: 50, full: 100 };
export const POTION_PRICE: Record<PotionKind, number> = { small: 60, full: 150 };
export const POTION_INFO: Record<PotionKind, string> = { small: 'Heals half your pet’s HP', full: 'Heals all of your pet’s HP' };
/** A knocked-out pet rests: its HP comes back by itself, 10% an hour, up to 30%. Potions can’t wake it. */
export const REST_PER_HOUR = 10;
export const REST_UP_TO = 30;
const HOUR = 3_600_000;
/** Below this a pet is "hurt" and a trip is risky. */
export const HURT_BELOW = 50;

export const hpPct = (p: Pick<OwnedPet, 'hpPct'> | undefined) => (p?.hpPct == null ? 100 : Math.max(0, Math.min(100, p.hpPct)));
export const isKnockedOut = (p: Pick<OwnedPet, 'hpPct'> | undefined) => hpPct(p) <= 0;
export const hpState = (p: Pick<OwnedPet, 'hpPct'> | undefined): 'ready' | 'hurt' | 'out' =>
  isKnockedOut(p) ? 'out' : hpPct(p) < HURT_BELOW ? 'hurt' : 'ready';

export const potionsOf = (s: GameState, kind: PotionKind) => s.items[POTION_ITEM[kind]] ?? 0;

export function addPotions(s: GameState, kind: PotionKind, n = 1): GameState {
  if (n <= 0) return s;
  const key = POTION_ITEM[kind];
  return { ...s, items: { ...s.items, [key]: (s.items[key] ?? 0) + n } };
}

export function setHp(s: GameState, petId: string, pct: number): GameState {
  const v = pct > 0 ? Math.max(1, Math.min(100, Math.round(pct))) : 0;
  return { ...s, pets: s.pets.map((p) => (p.id === petId ? (v >= 100 ? withoutHp(p) : v === 0 ? { ...p, hpPct: 0, restFrom: nowOf(s) } : (({ restFrom: _k, ...rest }) => ({ ...rest, hpPct: v }))(p)) : p)) };
}
const withoutHp = (p: OwnedPet): OwnedPet => {
  const { hpPct: _drop, restFrom: _r, ...rest } = p;
  return rest;
};

export function usePotion(s: GameState, petId: string, kind: PotionKind): { ok: true; state: GameState; healed: number } | { ok: false; reason: string } {
  const pet = s.pets.find((p) => p.id === petId);
  if (!pet) return { ok: false, reason: 'Pick a pet.' };
  if (potionsOf(s, kind) < 1) return { ok: false, reason: `You don’t have a ${POTION_ITEM[kind]}.` };
  const before = hpPct(pet);
  if (before <= 0) return { ok: false, reason: `Potions can’t wake a knocked-out pet. ${pet.nickname} is resting; its HP comes back over the next hour.` };
  if (before >= 100) return { ok: false, reason: `${pet.nickname} already has full HP.` };
  const after = Math.min(100, before + POTION_HEAL[kind]);
  const key = POTION_ITEM[kind];
  const left = (s.items[key] ?? 0) - 1;
  const items = { ...s.items };
  if (left > 0) items[key] = left;
  else delete items[key];
  return { ok: true, state: setHp({ ...s, items }, petId, after), healed: after - before };
}

/** The potion that fits best: a Small one unless the pet is knocked out or very low and you have a Full one. */
export function bestPotion(s: GameState, pet: OwnedPet): PotionKind | null {
  const pct = hpPct(pet);
  if (pct >= 100 || pct <= 0) return null;
  if (pct <= 50 && potionsOf(s, 'full') > 0 && potionsOf(s, 'small') === 0) return 'full';
  if (potionsOf(s, 'small') > 0) return 'small';
  return potionsOf(s, 'full') > 0 ? 'full' : null;
}

/** Uses one potion from your bag (in a battle). Returns null if you have none. */
export function takePotion(s: GameState, kind: PotionKind): GameState | null {
  const key = POTION_ITEM[kind];
  const n = s.items[key] ?? 0;
  if (n < 1) return null;
  const items = { ...s.items };
  if (n > 1) items[key] = n - 1;
  else delete items[key];
  return { ...s, items };
}

/** Resting pets (knocked out) slowly get HP back by themselves, up to 30%. Run it now and then. */
export function restPets(s: GameState, now = Date.now()): GameState {
  const t = nowOf(s, now);
  let changed = false;
  const pets = s.pets.map((p) => {
    if (p.restFrom == null) {
      if (hpPct(p) > 0) return p;
      changed = true; // Knocked out with no start time yet: start resting now.
      return { ...p, restFrom: t };
    }
    const gained = Math.min(REST_UP_TO, Math.floor(((t - p.restFrom) / HOUR) * REST_PER_HOUR));
    const hp = Math.max(hpPct(p), gained);
    if (hp >= REST_UP_TO) {
      changed = true;
      const { restFrom: _r, ...rest } = p;
      return { ...rest, hpPct: Math.max(hpPct(p), REST_UP_TO) };
    }
    if (hp !== hpPct(p)) {
      changed = true;
      return { ...p, hpPct: hp };
    }
    return p;
  });
  return changed ? { ...s, pets } : s;
}

/** Minutes until a resting pet has any HP again (0 if it's awake). */
export function minutesToWake(p: OwnedPet, s: GameState, now = Date.now()): number {
  if (hpPct(p) > 0 || p.restFrom == null) return 0;
  const firstHp = HOUR / REST_PER_HOUR; // 1% comes back every 6 minutes
  return Math.max(1, Math.ceil((p.restFrom + firstHp - nowOf(s, now)) / 60_000));
}

export function buyPotion(s: GameState, kind: PotionKind): GameState {
  if (s.coins < POTION_PRICE[kind]) return s;
  return addPotions({ ...s, coins: s.coins - POTION_PRICE[kind] }, kind, 1);
}

/** Starts a fighter at the pet's saved HP. */
export function atSavedHp(f: Fighter, pct: number): Fighter {
  const hp = Math.max(0, Math.round((f.maxHp * Math.max(0, Math.min(100, pct))) / 100));
  return { ...f, hp: pct > 0 ? Math.max(1, hp) : 0 };
}

/** After a battle that counts, saves each of your pets' HP. `ids` lines up with battle.mine. */
export function saveTeamHp(s: GameState, b: Battle, ids: string[]): GameState {
  let next = s;
  b.mine.forEach((f, i) => {
    const id = ids[i];
    if (!id) return;
    next = setHp(next, id, f.maxHp ? (Math.max(0, f.hp) / f.maxHp) * 100 : 100);
  });
  return next;
}
