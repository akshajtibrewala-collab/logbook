// Pure logic for the Dashboard's rotating greeting: a headline (random, time-of-day flavored, from
// ./greetings.js) and a subline (one data-driven line, picked in priority order from what the app
// actually knows). `date`/`random`/`facts` are always passed in explicitly so both halves are
// deterministic and testable — nothing here calls `new Date()` or `Math.random()` on its own.

import { HEADLINES, PILOT_NAME } from './greetings.js';

/** Which headline pool matches local time: morning 5–12, afternoon 12–17, evening 17–22, else lateNight. */
export function timeBucket(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'lateNight';
}

/** Headline templates appropriate right now: the current time-of-day pool, plus the always-OK "anytime" one. */
export function candidateHeadlines(date = new Date()) {
  return [...HEADLINES[timeBucket(date)], ...HEADLINES.anytime];
}

/**
 * Picks a random headline template for `date` and fills in `name`, avoiding `previous` (the template
 * shown last time) whenever another option exists in the pool. `random` is injectable for deterministic
 * tests; it should return a value in [0, 1), same contract as Math.random().
 *
 * Returns `{ template, text }` — the caller should persist `template` (not `text`) as tomorrow's
 * `previous`, so a name change alone never defeats the no-repeat check.
 */
export function pickHeadline({ date = new Date(), name = PILOT_NAME, previous = null, random = Math.random } = {}) {
  const pool = candidateHeadlines(date);
  const choices = pool.length > 1 ? pool.filter((t) => t !== previous) : pool;
  const template = choices[Math.floor(random() * choices.length)];
  return { template, text: template.replace('{name}', name) };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Picks the Dashboard subline: one short, data-driven line with an optional action, tried in priority
 * order and stopping at the first that applies. Always returns something (the last tier is an
 * unconditional fallback), as `{ text, action: { label, to } | null }`.
 *
 * `facts` is everything the picker is allowed to know, precomputed by the caller from already-tested
 * logic (currency.js, milestones.js) so this function only prioritizes and phrases, never recomputes
 * currency or progress itself:
 *   - currencyItems: [{ label, result }], one entry per tracked currency/expiration item, where `result`
 *     is a currency.js-shaped { status, expires, daysRemaining }. Only entries with a real `expires`
 *     date are ever treated as expired/expiring — a null `expires` means "never established", not
 *     "lapsed", and must never be reported as an alarm.
 *   - hasFlights: boolean
 *   - daysSinceLastFlight: number | null
 *   - reviewCount: number of recently-logged flights missing an aircraft link (so aircraft-specific
 *     milestones can't count them yet)
 *   - closestMilestone: { label, certificateLabel, percent } | null, the nearest-to-complete requirement
 *     that isn't met yet
 *   - totalHoursThisYear: number
 */
export function pickSubline(facts) {
  const {
    currencyItems = [], hasFlights = false, daysSinceLastFlight = null,
    reviewCount = 0, closestMilestone = null, totalHoursThisYear = 0,
  } = facts;

  // 1. Expiring or expired items — the only tier allowed alarming wording, and only for items with a
  // real, established expiry date (never "expired" for something that was simply never logged).
  const urgent = currencyItems
    .filter((i) => i.result.expires !== null && (i.result.status === 'expired' || i.result.status === 'expiring'))
    .sort((a, b) => a.result.daysRemaining - b.result.daysRemaining);
  if (urgent.length) {
    const { label, result } = urgent[0];
    const text = result.status === 'expired'
      ? (result.daysRemaining === 0 ? `Your ${label} expired today.` : `Your ${label} expired ${plural(Math.abs(result.daysRemaining), 'day')} ago.`)
      : `Your ${label} expires in ${plural(result.daysRemaining, 'day')}.`;
    return { text, action: { label: 'Review', to: '/currency' } };
  }

  // 2. Recently logged flights that aren't linked to an aircraft yet.
  if (reviewCount > 0) {
    const isAre = reviewCount === 1 ? 'isn’t' : 'aren’t';
    return { text: `${plural(reviewCount, 'recent flight')} ${isAre} linked to an aircraft yet.`, action: { label: 'Review', to: '/logbook' } };
  }

  // 3. No flight logged in a while.
  if (hasFlights && daysSinceLastFlight !== null && daysSinceLastFlight >= 7) {
    return { text: `It’s been ${plural(daysSinceLastFlight, 'day')} since your last flight. Log it?`, action: { label: 'Add flight', to: '/logbook/new' } };
  }

  // (4. Last flight's "what to work on" note — no such field exists in the data model yet, so this tier
  // is skipped rather than guessed at. See the debrief field noted as future work.)

  // 5. Closest milestone progress.
  if (closestMilestone) {
    const pct = Math.round(closestMilestone.percent);
    return {
      text: `${pct}% toward ${closestMilestone.label} for your ${closestMilestone.certificateLabel}.`,
      action: { label: 'View milestones', to: '/milestones' },
    };
  }

  // 6. A calm currency nudge — the soonest-expiring item that's still comfortably current.
  const calm = currencyItems
    .filter((i) => i.result.status === 'current' && i.result.daysRemaining !== null)
    .sort((a, b) => a.result.daysRemaining - b.result.daysRemaining);
  if (calm.length) {
    const { label, result } = calm[0];
    return { text: `${label}: ${plural(result.daysRemaining, 'day')} left.`, action: null };
  }

  // 7. Fallback: a friendly stat, or a plain question if there's nothing yet to report.
  if (totalHoursThisYear > 0) {
    const hours = Math.round(totalHoursThisYear * 10) / 10;
    return { text: `You’ve logged ${plural(hours, 'hour')} this year.`, action: null };
  }
  return { text: 'Where to next?', action: null };
}
