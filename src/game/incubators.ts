import type { GameState } from './types';

/** Extra incubators bought with coins: each one costs more, up to 4 in total. */
export const MAX_INCUBATORS = 4;
const PRICE_FOR_SLOT: Record<number, number> = { 2: 1500, 3: 4000, 4: 10000 };

/** Price of the next incubator, or null when you already have the most. */
export function nextIncubatorPrice(s: GameState): number | null {
  const next = s.incubatorSlots + 1;
  return next > MAX_INCUBATORS ? null : PRICE_FOR_SLOT[next] ?? null;
}

/** Price of a specific slot number (2–4), for showing locked slots. */
export const incubatorPrice = (slot: number) => PRICE_FOR_SLOT[slot] ?? null;

export function buyIncubator(s: GameState): { ok: true; state: GameState } | { ok: false; reason: string } {
  const price = nextIncubatorPrice(s);
  if (price === null) return { ok: false, reason: `You already have all ${MAX_INCUBATORS} incubators.` };
  if (s.coins < price) return { ok: false, reason: `You need ${(price - s.coins).toLocaleString()} more coins.` };
  return { ok: true, state: { ...s, coins: s.coins - price, incubatorSlots: s.incubatorSlots + 1 } };
}
