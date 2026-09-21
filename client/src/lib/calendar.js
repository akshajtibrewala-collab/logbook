// Calendar math for the date picker. Dates are ISO "YYYY-MM-DD" strings; months are 1-12.
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const pad = (n) => String(n).padStart(2, '0');

export const toISO = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
export const todayISO = () => new Date().toLocaleDateString('en-CA'); // local date

export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** 0 = Sunday. */
export const firstWeekday = (y, m) => new Date(Date.UTC(y, m - 1, 1)).getUTCDay();

/** Parses a real calendar date; anything else (blank, 2026-02-30, junk) is null. */
export function parseISO(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo) ? { y, m: mo, d } : null;
}

/** Weeks (rows of 7, Sunday first) for a month; leading/trailing blanks are null. */
export function monthGrid(y, m) {
  const cells = [...Array(firstWeekday(y, m)).fill(null), ...Array.from({ length: daysInMonth(y, m) }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

export function shiftMonth(y, m, delta) {
  const idx = y * 12 + (m - 1) + delta;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

/** "Sep 4, 2026" (locale-aware); blank or invalid input gives "". */
export function formatDate(iso) {
  const p = parseISO(iso);
  return p ? new Date(Date.UTC(p.y, p.m - 1, p.d)).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }) : '';
}
