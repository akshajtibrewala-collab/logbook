// Computes a passenger flight's duration the way MyFlightRadar24 does: the pilot enters departure and
// arrival time on each airport's own local clock, and the duration is the real elapsed time between those
// two instants — never a naive subtraction of the clock digits, which would be wrong whenever the two
// airports are in different zones or observe DST differently on the flight's date.
//
// This file is deliberately duplicated (not imported) between client/src/lib and server/src/lib, following
// the existing client/server split of client/src/lib/timezone.js — see server/src/lib/passengerDuration.js.
// Keep the two in sync; passengerDuration.test.js in each workspace covers the same cases.
import { zonedToUtc } from './timezone.js';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseDate(date) {
  const m = DATE_RE.exec(String(date ?? ''));
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
}

/** { hour, minute } from a "HH:MM" 24h string, or null if it isn't one. */
export function parseTime(time) {
  const m = TIME_RE.exec(String(time ?? ''));
  return m ? { hour: Number(m[1]), minute: Number(m[2]) } : null;
}

function addDays({ y, m, d }, offset) {
  const dt = new Date(Date.UTC(y, m - 1, d + offset));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

// A same-day-or-later arrival within 3 days after departure covers every real airline itinerary,
// including the longest eastbound/westbound long-hauls that cross the date line.
export const MAX_ARR_DAY_OFFSET = 3;
export const SHORT_WARNING_MINUTES = 20;
export const LONG_WARNING_HOURS = 20;

/**
 * `date` ("YYYY-MM-DD", the departure's local calendar date), `depTime`/`arrTime` ("HH:MM", 24h, on each
 * airport's own clock), `depTz`/`arrTz` (IANA zone, or falsy to fall back to UTC — matching planlegs.js's
 * FALLBACK_ZONE convention for an airport with no usable coordinates). `arrDayOffset`: how many calendar
 * days after `date` the arrival lands (counted on the same calendar `date` uses, i.e. before applying
 * `arrTz`), or null/undefined to auto-resolve to the smallest non-negative offset (0, 1, 2, ...) that makes
 * the duration positive.
 *
 * Returns null if date/depTime/arrTime aren't well-formed. Otherwise
 * { hours, arrDayOffset, warning: 'short' | 'long' | null }. `hours` can be zero or negative when a
 * manually-set arrDayOffset is too small — callers should treat that as a validation error, not a stored
 * value, and prompt the day offset to be adjusted (e.g. +1).
 */
export function passengerDuration({ date, depTime, arrTime, depTz, arrTz, arrDayOffset }) {
  const day = parseDate(date);
  const dep = parseTime(depTime);
  const arr = parseTime(arrTime);
  if (!day || !dep || !arr) return null;

  const depZone = depTz || 'UTC';
  const arrZone = arrTz || 'UTC';
  const depInstant = zonedToUtc({ ...day, ...dep }, depZone);

  const minutesFor = (offset) => {
    const arrDay = addDays(day, offset);
    const arrInstant = zonedToUtc({ ...arrDay, hour: arr.hour, minute: arr.minute }, arrZone);
    return Math.round((arrInstant.getTime() - depInstant.getTime()) / 60000);
  };

  let offset = arrDayOffset;
  if (offset === null || offset === undefined) {
    offset = 0;
    while (offset < MAX_ARR_DAY_OFFSET && minutesFor(offset) <= 0) offset += 1;
  }

  const minutes = minutesFor(offset);
  const hours = Math.round((minutes / 60) * 100) / 100;
  const warning = minutes <= 0 ? null
    : minutes < SHORT_WARNING_MINUTES ? 'short'
    : hours > LONG_WARNING_HOURS ? 'long'
    : null;
  return { hours, arrDayOffset: offset, warning };
}
