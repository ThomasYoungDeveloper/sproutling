import type { GameState } from './types';

/** A brand-new player: no pets yet. The first screen asks them to pick an egg. */
export function newGame(): GameState {
  return {
    version: 1,
    coins: 50,
    activePetId: null,
    pets: [],
    eggs: [],
    chests: [],
    incubatorSlots: 1,
    items: {},
    dex: {},
    days: {},
    questChestDays: {},
    dayOffset: 0,
  };
}
