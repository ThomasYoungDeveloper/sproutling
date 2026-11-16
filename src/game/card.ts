import type { GameState, Skin } from './types';
import { equippedMoves, personalityOf, type Personality, type Training } from './stats';
import * as A from './actions';
import { scoreDay } from './scoring';

/** A pet as friends see it. */
export interface CardPet {
  speciesId: string;
  nickname: string;
  xp: number;
  shiny: boolean;
  hat?: string;
  aura?: string;
  skin?: Skin;
  personality?: Personality;
  train?: Training;
  moves?: string[];
}

/** The public snapshot of a player that friends can see. Never includes meals, sleep or other health details. */
export interface PublicCard {
  v: 1;
  active?: CardPet;
  team: CardPet[];
  streak: number;
  dex: number;
  pets: number;
  todayXp: number;
  day: string;
  scene?: string;
  badges?: number;
}

const toCardPet = (p: { id: string; speciesId: string; nickname: string; xp: number; shiny: boolean; skin?: Skin; look?: { hat?: string; aura?: string }; personality?: Personality; train?: Training; moves?: string[] }): CardPet => ({
  speciesId: p.speciesId,
  nickname: p.nickname.slice(0, 24),
  xp: p.xp,
  shiny: p.shiny,
  ...(p.skin ? { skin: p.skin } : {}),
  personality: personalityOf(p),
  ...(p.train ? { train: p.train } : {}),
  moves: equippedMoves(p).map((m) => m.id),
  ...(p.look?.hat ? { hat: p.look.hat } : {}),
  ...(p.look?.aura ? { aura: p.look.aura } : {}),
});

export const TEAM_SIZE = 6;

export function buildCard(s: GameState): PublicCard {
  const active = A.activePet(s);
  const team = [...s.pets]
    .sort((a, b) => Number(b.id === s.activePetId) - Number(a.id === s.activePetId) || b.xp - a.xp)
    .slice(0, TEAM_SIZE)
    .map(toCardPet);
  return {
    v: 1,
    active: active ? toCardPet(active) : undefined,
    team,
    streak: A.streak(s),
    dex: Object.keys(s.dex).length,
    pets: s.pets.length,
    todayXp: scoreDay(A.today(s)).total,
    day: A.todayKey(s),
    ...(s.scene ? { scene: s.scene } : {}),
    badges: Object.keys(s.achievements ?? {}).length,
  };
}

/** Reads a card that came from the database, tolerating old or empty ones. */
export function readCard(raw: unknown): PublicCard | null {
  const c = raw as Partial<PublicCard> | null;
  if (!c || c.v !== 1 || !Array.isArray(c.team)) return null;
  return c as PublicCard;
}

