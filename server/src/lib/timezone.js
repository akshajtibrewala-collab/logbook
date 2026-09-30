// Resolves an airport's IANA time zone from its coordinates. The airports table has no time zone
// column, so every airport's local time (weather display, "Plan a flight" ETAs, passenger flight local
// times) is derived from its lat/lon via tz-lookup, which ships its own geo boundary data rather than
// depending on any online API.
import tzlookup from 'tz-lookup';

/** IANA time zone name (e.g. "America/Denver") for a point, or null if lat/lon aren't usable. */
export function tzForAirport(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  try {
    return tzlookup(lat, lon);
  } catch {
    return null; // open ocean / poles: tz-lookup throws rather than guessing
  }
}

// Pure conversions between a time zone's local wall-clock and the absolute UTC instant it represents —
// mirrors client/src/lib/timezone.js's zonedToUtc/utcToZonedParts so server-side validation (passenger
// flight duration) can recompute exactly what the client shows, without adding a date library. No date
// library is needed: the JS engine's own Intl data already knows every zone's DST rules.

const partsFmt = new Map();
function formatter(timeZone) {
  let f = partsFmt.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    partsFmt.set(timeZone, f);
  }
  return f;
}

/** { y, m, d, hour, minute, second } — the wall-clock time in `timeZone` at the instant `date`. */
export function utcToZonedParts(date, timeZone) {
  const parts = formatter(timeZone).formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return {
    y: Number(parts.year), m: Number(parts.month), d: Number(parts.day),
    hour: Number(parts.hour === '24' ? '00' : parts.hour), minute: Number(parts.minute), second: Number(parts.second),
  };
}

/** `timeZone`'s offset from UTC, in minutes, at the instant `date` (e.g. -360 for MDT). */
export function tzOffsetMinutes(date, timeZone) {
  const p = utcToZonedParts(date, timeZone);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hour, p.minute, p.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/**
 * The UTC instant for a wall-clock date/time (`{ y, m, d, hour, minute }`, month 1-12) as it would read
 * on a clock in `timeZone`. Converges in two passes, which is enough for every real IANA zone's rules.
 */
export function zonedToUtc({ y, m, d, hour, minute, second = 0 }, timeZone) {
  const naive = Date.UTC(y, m - 1, d, hour, minute, second);
  let guess = naive;
  for (let i = 0; i < 2; i++) {
    const offset = tzOffsetMinutes(new Date(guess), timeZone);
    guess = naive - offset * 60000;
  }
  return new Date(guess);
}
