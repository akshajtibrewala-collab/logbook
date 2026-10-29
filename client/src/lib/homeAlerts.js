import { customExpirations, daysBetween } from './currency.js';

// How Home's single status line decides what counts as "needs attention" — deliberately narrower than
// the Currency page's own current/expiring/expired split, which still shows everything in full.

/** The one threshold for Home's status line: within this many days of lapsing, or already lapsed. */
export const ALERT_WINDOW_DAYS = 30;
/** Days since the last pilot flight at which Home shows its calm "N days since your last flight" subline (not an alert). */
export const LONG_GAP_DAYS = 7;

/**
 * True when a currency.js-shaped `{ status, expires, daysRemaining }` result has genuinely changed or is
 * about to: it was established at some point (a real `daysRemaining`, not null) and is now within
 * `ALERT_WINDOW_DAYS` of lapsing or already past it. An item with `daysRemaining === null` has never been
 * current at all (no qualifying history yet) — that's not a change, so it's never alert-worthy here; it's
 * still visible in full, always, on the Currency page.
 */
export function isAlertWorthy(result) {
  return Boolean(result) && result.daysRemaining !== null && result.daysRemaining <= ALERT_WINDOW_DAYS;
}

/**
 * Builds Home's single status-line count and tap target from the same results the Currency page already
 * shows, plus the backup job status and days since the last pilot flight.
 *
 * `currencyResults` is every currency.js-shaped result Home already computes (day/night passenger,
 * instrument, flight review, medical) — `expirations` supplies the "other expirations" custom items via
 * the same `customExpirations()` the Currency page itself calls, so this never re-derives a currency
 * calculation of its own.
 *
 * `to` prefers `/currency`, where every currency/review/medical item above lives — the common case.
 * With no currency-category item alert-worthy, a backup warning alone links to Import & export.
 * A long gap since the last pilot flight is NOT an alert: it never changes `count` or `to`. It is returned
 * as `daysSinceLastFlight` so Home can show a plain, calm subline once it reaches `LONG_GAP_DAYS`.
 */
export function homeStatusAlerts({ currencyResults = [], expirations = [], backupWarn = false, lastPilotFlightDate = null, today }) {
  let currencyCount = 0;
  for (const r of currencyResults) if (isAlertWorthy(r)) currencyCount++;
  for (const r of customExpirations(expirations, today)) if (isAlertWorthy(r)) currencyCount++;

  const daysSinceLastFlight = lastPilotFlightDate ? daysBetween(lastPilotFlightDate, today) : null;

  const count = currencyCount + (backupWarn ? 1 : 0);
  const to = currencyCount > 0 ? '/currency' : backupWarn ? '/logbook/data' : '/currency';
  return { count, to, daysSinceLastFlight };
}
