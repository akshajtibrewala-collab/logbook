import { customExpirations, daysBetween } from './currency.js';

// How Home's single status line decides what counts as "needs attention" — deliberately narrower than
// the Currency page's own current/expiring/expired split, which still shows everything in full.

/** The one threshold for Home's status line: within this many days of lapsing, or already lapsed. */
export const ALERT_WINDOW_DAYS = 30;
/** How many days since the last pilot flight counts as a "long gap" worth a status-line mention. */
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
 * With no currency-category item alert-worthy, it falls back to whichever other page explains the sole
 * alert present (Import & export for a backup warning alone, the Logbook for a flight-logging gap alone).
 */
export function homeStatusAlerts({ currencyResults = [], expirations = [], backupWarn = false, lastPilotFlightDate = null, today }) {
  let currencyCount = 0;
  for (const r of currencyResults) if (isAlertWorthy(r)) currencyCount++;
  for (const r of customExpirations(expirations, today)) if (isAlertWorthy(r)) currencyCount++;

  const daysSinceLastFlight = lastPilotFlightDate ? daysBetween(lastPilotFlightDate, today) : null;
  const longGap = daysSinceLastFlight !== null && daysSinceLastFlight >= LONG_GAP_DAYS;

  const count = currencyCount + (backupWarn ? 1 : 0) + (longGap ? 1 : 0);
  const to = currencyCount > 0 ? '/currency' : backupWarn ? '/logbook/data' : longGap ? '/logbook/new' : '/currency';
  return { count, to, daysSinceLastFlight };
}
