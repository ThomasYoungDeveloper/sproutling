/**
 * Short numbers for tight spots: 999 stays as is, then 1K, 1.25K, 12.5K, 1.2M, 3B.
 * Prices and totals with room to spare keep the full number.
 */
export function shortNumber(n: number): string {
  const a = Math.abs(n);
  const fmt = (v: number, suffix: string) => {
    // Up to 2 decimals, rounded down so it never shows more than you have: 1.25K, 12.5K, 1.1K.
    const r = v >= 100 ? Math.floor(v * 10) / 10 : Math.floor(v * 100) / 100;
    return `${n < 0 ? '-' : ''}${r.toFixed(2).replace(/\.?0+$/, '')}${suffix}`;
  };
  if (a >= 1e9) return fmt(a / 1e9, 'B');
  if (a >= 1e6) return fmt(a / 1e6, 'M');
  if (a >= 1e3) return fmt(a / 1e3, 'K');
  return n.toLocaleString();
}
