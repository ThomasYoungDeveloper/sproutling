import type { GameState, OwnedPet, Skin } from './types';
import { SKINS, noteSkin } from './skins';
import { makeId, type Rng, defaultRng } from './random';
import { SPECIES_BY_ID } from './species';
import { ivsOf, personalityOf, readIvs, PERSONALITIES, type Ivs, type Personality } from './stats';

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
});

export type OfferCheck = { ok: true } | { ok: false; reason: string };

/** Your active pet and your last pet can't be traded, and a pet can only be in one trade at a time. */
export function canOffer(s: GameState, petId: string, busy: Set<string>): OfferCheck {
  const pet = s.pets.find((p) => p.id === petId);
  if (!pet) return { ok: false, reason: 'That pet isn’t on your team anymore.' };
  if (s.pets.length <= 1) return { ok: false, reason: 'You can’t trade your only pet.' };
  if (pet.id === s.activePetId) return { ok: false, reason: 'Your active pet can’t be traded. Pick a different active pet first.' };
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
  const isNew = !s.dex[get.speciesId];
  const pets = [...s.pets.filter((p) => p.id !== giveId), received];
  const activePetId = s.activePetId === giveId || !pets.some((p) => p.id === s.activePetId) ? received.id : s.activePetId;
  return {
    state: noteSkin({ ...s, pets, activePetId, dex: { ...s.dex, [get.speciesId]: true }, appliedTrades: { ...s.appliedTrades, [tradeId]: true } }, received),
    received,
    isNew,
  };
}
