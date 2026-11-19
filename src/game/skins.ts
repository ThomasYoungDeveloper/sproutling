import type { GameState, OwnedPet, Skin } from './types';
import { type Rng, defaultRng } from './random';

export const SKINS: Skin[] = ['mono', 'silver', 'gold', 'rainbow', 'pastel', 'retro', 'sakura', 'ocean', 'ember', 'moonlit', 'crystal', 'shadow', 'galaxy', 'ancient', 'slime', 'harvest'];

export const SKIN_INFO: Record<Skin, { label: string; emoji: string; color: string; chance: number }> = {
  mono: { label: 'Ink', emoji: '🖌️', color: '#3B3B4F', chance: 0.05 },
  silver: { label: 'Silver', emoji: '🥈', color: '#8FA3B5', chance: 0.03 },
  gold: { label: 'Gold', emoji: '🥇', color: '#E5A800', chance: 0.015 },
  rainbow: { label: 'Rainbow', emoji: '🌈', color: '#B45FE0', chance: 0.005 },
  // Dye skins: bought or won as dyes, and a small chance to hatch with one.
  pastel: { label: 'Pastel', emoji: '', color: '#C9A3E8', chance: 0.008 },
  retro: { label: 'Retro', emoji: '', color: '#5E8F1A', chance: 0.008 },
  sakura: { label: 'Sakura', emoji: '', color: '#E0679A', chance: 0.004 },
  ocean: { label: 'Ocean', emoji: '', color: '#1E8AB8', chance: 0.004 },
  ember: { label: 'Ember', emoji: '', color: '#D9382A', chance: 0.004 },
  moonlit: { label: 'Moonlit', emoji: '', color: '#4A54B8', chance: 0.004 },
  crystal: { label: 'Crystal', emoji: '', color: '#5F7FE0', chance: 0.002 },
  shadow: { label: 'Shadow', emoji: '', color: '#6A3CC2', chance: 0.002 },
  galaxy: { label: 'Galaxy', emoji: '', color: '#8A3FB8', chance: 0.001 },
  ancient: { label: 'Ancient', emoji: '', color: '#B8892A', chance: 0.001 },
  slime: { label: 'Slime', emoji: '', color: '#4FB82A', chance: 0.005 },
  harvest: { label: 'Harvest', emoji: '', color: '#D2601C', chance: 0 },
};

/** Rarest first, so a lucky roll lands on the best skin. Silver, Gold and Rainbow can only hatch. */
const HATCH_ORDER: Skin[] = ['rainbow', 'ancient', 'galaxy', 'gold', 'shadow', 'crystal', 'silver', 'sakura', 'ocean', 'ember', 'moonlit', 'slime', 'pastel', 'retro', 'mono'];

/** Bred eggs are three times as likely to hatch with a skin. */
export const BRED_SKIN_BOOST = 3;
/** Chance that each skinned parent passes its skin straight down. */
export const INHERIT_CHANCE = 0.25;

/**
 * Rolls a skin for a newly hatched pet. Rarest first, so a lucky roll always lands on the best skin.
 * Normal eggs: 10% total (5% Ink, 3% Silver, 1.5% Gold, 0.5% Rainbow). Bred eggs: 30% total, plus inheritance.
 */
export function rollSkin(rng: Rng = defaultRng, boost = 1, parentSkins: (Skin | null | undefined)[] = []): Skin | undefined {
  for (const ps of parentSkins) if (ps && rng() < INHERIT_CHANCE) return ps;
  const r = rng();
  let acc = 0;
  for (const s of HATCH_ORDER) {
    acc += SKIN_INFO[s].chance * boost;
    if (r < acc) return s;
  }
  return undefined;
}

export const skinKey = (speciesId: string, skin: Skin) => `${speciesId}:${skin}`;

/** Records a pet's skin in the Skin-dex. */
export function noteSkin(s: GameState, pet: Pick<OwnedPet, 'speciesId' | 'skin'>): GameState {
  if (!pet.skin) return s;
  const key = skinKey(pet.speciesId, pet.skin);
  return s.skinDex?.[key] ? s : { ...s, skinDex: { ...s.skinDex, [key]: true } };
}

export const skinDexCount = (s: GameState) => Object.keys(s.skinDex ?? {}).length;
export const ownsSkin = (s: GameState, skin: Skin) => Object.keys(s.skinDex ?? {}).some((k) => k.endsWith(':' + skin));
