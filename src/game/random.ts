/** A random source returning a number in [0, 1). Injected so tests can be deterministic. */
export type Rng = () => number;

export const defaultRng: Rng = Math.random;

/** Pick one key from a weight table. Weights do not need to sum to 100. */
export function pickWeighted<K extends string>(table: Record<K, number>, rng: Rng = defaultRng): K {
  const entries = Object.entries(table) as [K, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [key, weight] of entries) {
    if (roll < weight) return key;
    roll -= weight;
  }
  return entries[entries.length - 1][0];
}

export function randInt(min: number, max: number, rng: Rng = defaultRng): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function pickOne<T>(items: T[], rng: Rng = defaultRng): T {
  return items[Math.floor(rng() * items.length)];
}

export function makeId(rng: Rng = defaultRng): string {
  return Math.floor(rng() * 1e12).toString(36) + Date.now().toString(36);
}

/** A repeatable random source from a text seed (the same seed always gives the same rolls). */
export function seededRng(seed: string): Rng {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
