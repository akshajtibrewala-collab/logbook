// Pure currency and summary calculations. All dates are ISO "YYYY-MM-DD" strings
// and `today` is always passed in, so every function is deterministic and testable.

const DAY_MS = 86400000;
const toUTC = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const fromUTC = (ms) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (iso, n) => fromUTC(toUTC(iso) + n * DAY_MS);
/** Whole days from a to b (positive when b is later). */
export const daysBetween = (a, b) => Math.round((toUTC(b) - toUTC(a)) / DAY_MS);
export const startOfMonth = (iso, plusMonths = 0) =>
  fromUTC(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1 + plusMonths, 1));
export const endOfMonth = (iso, plusMonths = 0) =>
  fromUTC(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) + plusMonths, 0));

export const WARN_DAYS = { passenger: 14, instrument: 30, review: 60 };
export const PASSENGER_DAYS = 90;
export const INSTRUMENT = { approaches: 6, holds: 1, months: 6 };
export const REVIEW_MONTHS = 24;

/**
 * status: 'current' | 'expiring' (current, but within warnDays of lapsing) | 'expired'.
 * daysRemaining is days until the last valid day (0 = last day); negative once lapsed.
 */
function result(expires, today, warnDays, extra = {}) {
  if (!expires) return { status: 'expired', expires: null, daysRemaining: null, ...extra };
  const daysRemaining = daysBetween(today, expires);
  const status = daysRemaining < 0 ? 'expired' : daysRemaining <= warnDays ? 'expiring' : 'current';
  return { status, expires, daysRemaining, ...extra };
}

/**
 * 3 takeoffs and landings within the preceding 90 days. Each logged landing is
 * treated as one takeoff/landing pair. `fields` picks which landing counts qualify.
 */
function landingCurrency(flights, today, fields) {
  const dates = [];
  for (const f of flights) {
    if (f.date > today) continue;
    const n = fields.reduce((s, k) => s + (Number(f[k]) || 0), 0);
    for (let i = 0; i < n; i++) dates.push(f.date);
  }
  dates.sort().reverse();
  const count = dates.filter((d) => daysBetween(d, today) <= PASSENGER_DAYS).length;
  const expires = dates.length >= 3 ? addDays(dates[2], PASSENGER_DAYS) : null;
  return result(expires, today, WARN_DAYS.passenger, { count, required: 3 });
}

/** Day passenger currency: any 3 landings in the last 90 days. */
export const dayCurrency = (flights, today) => landingCurrency(flights, today, ['day_landings', 'night_landings']);
/** Night passenger currency: 3 night landings in the last 90 days. */
export const nightCurrency = (flights, today) => landingCurrency(flights, today, ['night_landings']);
export const passengerCurrency = (flights, today) => ({ day: dayCurrency(flights, today), night: nightCurrency(flights, today) });

/**
 * Instrument currency: 6 approaches plus holding within the preceding 6 calendar months.
 * Once met, currency lasts to the end of the 6th calendar month after the month in which
 * the requirements were satisfied. (Intercepting/tracking is not logged, so holds stand in.)
 */
export function instrumentCurrency(flights, today) {
  const countsFrom = (k) => {
    const start = startOfMonth(today, k - INSTRUMENT.months);
    let approaches = 0;
    let holds = 0;
    for (const f of flights) {
      if (f.date < start || f.date > today) continue;
      approaches += Number(f.approaches) || 0;
      holds += Number(f.holds) || 0;
    }
    return { approaches, holds, ok: approaches >= INSTRUMENT.approaches && holds >= INSTRUMENT.holds };
  };
  const now = countsFrom(0);
  const extra = { approaches: now.approaches, holds: now.holds, requiredApproaches: INSTRUMENT.approaches, requiredHolds: INSTRUMENT.holds };
  if (!now.ok) return result(null, today, WARN_DAYS.instrument, extra);
  // The window start slides forward one month per step; find the last month it still holds.
  let k = 0;
  while (k < INSTRUMENT.months && countsFrom(k + 1).ok) k++;
  return result(endOfMonth(today, k), today, WARN_DAYS.instrument, extra);
}

/** Flight review: due at the end of the 24th calendar month after the last review. */
export function flightReviewStatus(reviews, today) {
  const dates = reviews.map((r) => r.date).filter((d) => d <= today).sort();
  const last = dates[dates.length - 1] ?? null;
  return result(last ? endOfMonth(last, REVIEW_MONTHS) : null, today, WARN_DAYS.review, { lastReview: last });
}

const round2 = (n) => Math.round(n * 100) / 100;

/** Total hours, this calendar month and this calendar year. */
export function summarize(flights, today) {
  const sum = (pred) => round2(flights.filter(pred).reduce((s, f) => s + (Number(f.total_time) || 0), 0));
  return {
    total: sum((f) => f.date <= today),
    month: sum((f) => f.date.slice(0, 7) === today.slice(0, 7) && f.date <= today),
    year: sum((f) => f.date.slice(0, 4) === today.slice(0, 4) && f.date <= today),
  };
}
