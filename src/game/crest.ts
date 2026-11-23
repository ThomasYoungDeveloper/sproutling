/** Guild crests: built from parts by the guild leader. Borders and extra symbols unlock with guild levels. */
export type CrestShape = 'shield' | 'round' | 'banner' | 'kite';
export type CrestPattern = 'plain' | 'split' | 'chevron' | 'stripe';
export type CrestTrim = 'wooden' | 'bronze' | 'silver' | 'gold';
export interface Crest {
  shape: CrestShape;
  c1: string;
  c2: string;
  pattern: CrestPattern;
  symbol: string;
  trim: CrestTrim;
}
export const DEFAULT_CREST: Crest = { shape: 'shield', c1: '#1F6B52', c2: '#2FB58A', pattern: 'plain', symbol: 'leaf', trim: 'wooden' };
export const SHAPES: CrestShape[] = ['shield', 'round', 'banner', 'kite'];
export const PATTERNS: CrestPattern[] = ['plain', 'split', 'chevron', 'stripe'];
export const COLORS = ['#7A2E3A', '#B8452E', '#E08A2E', '#F2C14E', '#1F6B52', '#2FB58A', '#2E7FB8', '#3B3F9E', '#6C72E0', '#8B4FB8', '#E0607E', '#24323A'];
export const TRIMS: { id: CrestTrim; label: string; color: string; level: number }[] = [
  { id: 'wooden', label: 'Wooden', color: '#8A5A2B', level: 1 },
  { id: 'bronze', label: 'Bronze', color: '#C07A3A', level: 3 },
  { id: 'silver', label: 'Silver', color: '#C9CED8', level: 6 },
  { id: 'gold', label: 'Gold', color: '#F2C14E', level: 10 },
];
export const SYMBOLS: { id: string; label: string; level: number }[] = [
  { id: 'leaf', label: 'Leaf', level: 1 },
  { id: 'sword', label: 'Sword', level: 1 },
  { id: 'sun', label: 'Sun', level: 1 },
  { id: 'moon', label: 'Moon', level: 1 },
  { id: 'heart', label: 'Heart', level: 1 },
  { id: 'mountain', label: 'Mountain', level: 1 },
  { id: 'star', label: 'Star', level: 2 },
  { id: 'wave', label: 'Wave', level: 3 },
  { id: 'paw', label: 'Paw', level: 4 },
  { id: 'crown', label: 'Crown', level: 5 },
  { id: 'flame', label: 'Flame', level: 7 },
  { id: 'dragon', label: 'Dragon', level: 9 },
];
export const VIBES: { id: string; label: string }[] = [
  { id: 'casual', label: 'Casual' },
  { id: 'competitive', label: 'Competitive' },
  { id: 'family', label: 'Family friendly' },
  { id: 'morning', label: 'Morning walks' },
  { id: 'evening', label: 'Evening walks' },
];
export const vibeLabel = (v?: string | null) => VIBES.find((x) => x.id === v)?.label;

/** Guild XP for a level (same as the server's guild_xp_for): 600 for level 2, 4,200 for level 5. */
export const guildXpFor = (level: number) => (level <= 1 ? 0 : 150 * (level - 1) * (level + 2));
export function guildProgress(xp: number) {
  let level = 1;
  while (guildXpFor(level + 1) <= xp && level < 99) level++;
  const base = guildXpFor(level);
  return { level, into: xp - base, need: guildXpFor(level + 1) - base };
}

export function readCrest(raw: unknown): Crest {
  const r = (raw ?? {}) as Partial<Crest>;
  return {
    shape: SHAPES.includes(r.shape as CrestShape) ? (r.shape as CrestShape) : DEFAULT_CREST.shape,
    c1: typeof r.c1 === 'string' ? r.c1 : DEFAULT_CREST.c1,
    c2: typeof r.c2 === 'string' ? r.c2 : DEFAULT_CREST.c2,
    pattern: PATTERNS.includes(r.pattern as CrestPattern) ? (r.pattern as CrestPattern) : DEFAULT_CREST.pattern,
    symbol: SYMBOLS.some((s) => s.id === r.symbol) ? (r.symbol as string) : DEFAULT_CREST.symbol,
    trim: TRIMS.some((t) => t.id === r.trim) ? (r.trim as CrestTrim) : DEFAULT_CREST.trim,
  };
}
