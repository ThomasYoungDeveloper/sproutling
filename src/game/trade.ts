import type { GameState, OwnedPet, Skin } from './types';
import { SKINS, noteSkin } from './skins';
import { makeId, type Rng, defaultRng } from './random';
import { SPECIES_BY_ID } from './species';
import { ivsOf, personalityOf, readIvs, PERSONALITIES, STATS, pointsEarned, learned, MAX_MOVES, type Ivs, type Personality, type Training } from './stats';
import { foodCapFor } from './food';

/** A pet as it travels in a trade. */
export interface TradePet {
  id: string;
  speciesId: string;
  nickname: string;
  xp: number;
  shiny: boolean;
  hatchedOn?: string;
  skin?: Skin;
  ivs?: Ivs;
  personality?: Personality;
  /** Training points spent, food boosts and chosen moves travel with the pet. */
  train?: Training;
  foodBoost?: Training;
  moves?: string[];
}

export const toTradePet = (p: OwnedPet): TradePet => ({
  id: p.id,
  speciesId: p.speciesId,
  nickname: (p.nickname || SPECIES_BY_ID[p.speciesId]?.name || 'Pal').slice(0, 24),
  xp: Math.max(0, Math.floor(p.xp)),
  shiny: !!p.shiny,
  hatchedOn: p.hatchedOn,
  ...(p.skin ? { skin: p.skin } : {}),
  ivs: ivsOf(p),
  personality: personalityOf(p),
  ...(p.train && Object.keys(p.train).length ? { train: p.train } : {}),
  ...(p.foodBoost && Object.keys(p.foodBoost).length ? { foodBoost: p.foodBoost } : {}),
  ...(p.moves?.length ? { moves: p.moves.slice(0, MAX_MOVES) } : {}),
});

/** Training from a trade: whole points, and never more than the pet's level has earned. */
export function readTraining(t: unknown, xp: number): Training | undefined {
  if (!t || typeof t !== 'object') return undefined;
  const out: Training = {};
  let sum = 0;
  for (const k of STATS) {
    const v = (t as Record<string, unknown>)[k];
    if (typeof v === 'number' && Number.isInteger(v) && v > 0) {
      out[k] = v;
      sum += v;
    }
  }
  if (!sum || sum > pointsEarned(xp)) return undefined;
  return out;
}

/** Food boosts from a trade, each kept within that stat's food cap. */
export function readFoodBoost(b: unknown): Training | undefined {
  if (!b || typeof b !== 'object') return undefined;
  const out: Training = {};
  for (const k of STATS) {
    const v = (b as Record<string, unknown>)[k];
    if (typeof v === 'number' && v > 0) out[k] = Math.round(Math.min(v, foodCapFor(k)) * 10) / 10;
  }
  return Object.keys(out).length ? out : undefined;
}

export type OfferCheck = { ok: true } | { ok: false; reason: string };

/** Your active pet and your last pet can't be traded, and a pet can only be in one trade at a time. */
export function canOffer(s: GameState, petId: string, busy: Set<string>): OfferCheck {
  const pet = s.pets.find((p) => p.id === petId);
  if (!pet) return { ok: false, reason: 'That pet isn’t on your team anymore.' };
  if (s.pets.length <= 1) return { ok: false, reason: 'You can’t trade your only pet.' };
  if (pet.id === s.activePetId) return { ok: false, reason: 'Your active pet can’t be traded. Pick a different active pet first.' };
  if (s.expedition?.petId === pet.id) return { ok: false, reason: `${pet.nickname} is out on a trip.` };
  if (busy.has(pet.id)) return { ok: false, reason: 'That pet is already in another trade.' };
  return { ok: true };
}

export interface AppliedTrade {
  state: GameState;
  received: OwnedPet;
  isNew: boolean;
}

/**
 * Swaps the pets for a completed trade. Safe to call more than once: each trade is applied only once per save.
 * The received pet keeps its level and shine, and gets a fresh id so it can never clash with your own pets.
 */
export function applyTrade(s: GameState, tradeId: string, giveId: string, get: TradePet, rng: Rng = defaultRng): AppliedTrade | null {
  if (s.appliedTrades?.[tradeId]) return null;
  if (!SPECIES_BY_ID[get.speciesId]) return null;
  const received: OwnedPet = {
    id: makeId(rng),
    speciesId: get.speciesId,
    nickname: get.nickname.slice(0, 14) || SPECIES_BY_ID[get.speciesId].name,
    xp: Math.max(0, Math.floor(get.xp)),
    shiny: !!get.shiny,
    hatchedOn: get.hatchedOn ?? '',
    ...(get.skin && SKINS.includes(get.skin) ? { skin: get.skin } : {}),
    ...(readIvs(get.ivs) ? { ivs: readIvs(get.ivs) } : {}),
    ...(get.personality && PERSONALITIES[get.personality] ? { personality: get.personality } : {}),
  };
  // The pet arrives as it was trained: same points, food boosts and moves (checked, so a bad copy can't add stats).
  const train = readTraining(get.train, received.xp);
  if (train) received.train = train;
  const foodBoost = readFoodBoost(get.foodBoost);
  if (foodBoost) received.foodBoost = foodBoost;
  const known = new Set(learned(get.speciesId, received.xp).map((m) => m.id));
  const moves = Array.isArray(get.moves) ? get.moves.filter((m) => typeof m === 'string' && known.has(m)).slice(0, MAX_MOVES) : [];
  if (moves.length) received.moves = moves;
  const isNew = !s.dex[get.speciesId];
  const pets = [...s.pets.filter((p) => p.id !== giveId), received];
  const activePetId = s.activePetId === giveId || !pets.some((p) => p.id === s.activePetId) ? received.id : s.activePetId;
  return {
    state: noteSkin({ ...s, pets, activePetId, dex: { ...s.dex, [get.speciesId]: true }, appliedTrades: { ...s.appliedTrades, [tradeId]: true } }, received),
    received,
    isNew,
  };
}

/** The friend's pet being asked for, sent as a small snapshot taken from their public card. */
export function toWantPet(p: { id?: string; speciesId: string; nickname: string; xp: number; shiny: boolean; skin?: Skin }): TradePet | null {
  if (!p.id || !SPECIES_BY_ID[p.speciesId]) return null;
  return {
    id: p.id,
    speciesId: p.speciesId,
    nickname: (p.nickname || SPECIES_BY_ID[p.speciesId].name).slice(0, 24),
    xp: Math.max(0, Math.floor(p.xp)),
    shiny: !!p.shiny,
    ...(p.skin ? { skin: p.skin } : {}),
  };
}

/**
 * Can you give this pet to answer a friend's request? Like canOffer, except your active pet is allowed:
 * they asked for it by name, and the pet you get back becomes your active pet.
 */
export function canGive(s: GameState, petId: string, busy: Set<string>): OfferCheck {
  const pet = s.pets.find((p) => p.id === petId);
  if (!pet) return { ok: false, reason: 'You don’t have that pet anymore.' };
  if (s.pets.length <= 1) return { ok: false, reason: 'You can’t trade your only pet.' };
  if (s.expedition?.petId === pet.id) return { ok: false, reason: `${pet.nickname} is out on a trip. Try again when they’re back.` };
  if (busy.has(pet.id)) return { ok: false, reason: 'That pet is already in another trade.' };
  return { ok: true };
}
