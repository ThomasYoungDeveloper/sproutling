/** Local calendar date as YYYY-MM-DD, shifted by `offset` days. */
export function dateKey(offset = 0, base = new Date()): string {
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
