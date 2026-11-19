/**
 * Short numbers for tight spots: 999 stays as is, then 1K, 1.5K, 12.5K, 1.2M, 3B.
 * Prices and totals with room to spare keep the full number.
 */
export function shortNumber(n: number): string {
  const a = Math.abs(n);
  const fmt = (v: number, suffix: string) => {
    const r = v >= 100 ? Math.floor(v) : Math.floor(v * 10) / 10;
    return `${n < 0 ? '-' : ''}${String(r).replace(/\.0$/, '')}${suffix}`;
  };
  if (a >= 1e9) return fmt(a / 1e9, 'B');
  if (a >= 1e6) return fmt(a / 1e6, 'M');
  if (a >= 1e3) return fmt(a / 1e3, 'K');
  return n.toLocaleString();
}
