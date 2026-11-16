import type { Rarity } from './types';

export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const RARITY_INFO: Record<Rarity, { label: string; color: string; soft: string; eggKm: number }> = {
  common: { label: 'Common', color: '#7C8A8E', soft: '#EEF2F1', eggKm: 2 },
  uncommon: { label: 'Uncommon', color: '#2FA36B', soft: '#DDF4E8', eggKm: 3 },
  rare: { label: 'Rare', color: '#2E7FD0', soft: '#DFEEFB', eggKm: 5 },
  epic: { label: 'Epic', color: '#8A56D6', soft: '#EEE5FB', eggKm: 10 },
  legendary: { label: 'Legendary', color: '#E39A12', soft: '#FFF2D6', eggKm: 20 },
};

/**
 * Rough average: about 1,300 steps per kilometer of walking.
 * The phone app will use real distance from Apple Health / Health Connect instead.
 */
export const STEPS_PER_KM = 1300;

export function stepsToHatch(rarity: Rarity): number {
  return RARITY_INFO[rarity].eggKm * STEPS_PER_KM;
}

/** Chance that a freshly hatched pet is a rare color variant. */
export const SHINY_CHANCE = 1 / 100;
