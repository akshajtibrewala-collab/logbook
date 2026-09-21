// Hours are stored as decimal numbers and always displayed with two decimals.

export const fmtHours = (n) => (Number(n) || 0).toFixed(2);

/**
 * Parses "1.5", "1,5" or "1:30" into decimal hours (rounded to 2 places).
 * Blank input is 0; anything unparseable returns null.
 */
export function parseHours(input) {
  const s = String(input ?? '').trim().replace(',', '.');
  if (s === '') return 0;
  const hm = s.match(/^(\d+):(\d{1,2})$/);
  if (hm) {
    const minutes = Number(hm[2]);
    if (minutes >= 60) return null;
    return Math.round((Number(hm[1]) + minutes / 60) * 100) / 100;
  }
  if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return null;
  return Math.round(Number(s) * 100) / 100;
}
