// Pure conversions between an airport's local wall-clock time (in its IANA zone, e.g. "America/Denver")
// and the absolute UTC instant it represents. No date library needed: the JS engine's own Intl data
// already knows every zone's DST rules, so these functions just reformat through it. Used for weather
// display (local time + Zulu, METAR age) and for turning a "Plan a flight" ETA typed as the destination
// airport's local time into the UTC instant the server's TAF logic expects.

const partsFmt = new Map(); // one Intl.DateTimeFormat per zone, reused (they're not cheap to construct)
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
 * on a clock in `timeZone`. Converges in two passes, which is enough for every real IANA zone's rules
 * (whole- and half-hour offsets, DST transitions); the one ambiguous case — a wall-clock time that
 * doesn't exist (spring-forward gap) or occurs twice (fall-back overlap) — resolves deterministically to
 * whichever instant this converges to, which is an acceptable, documented edge case rather than a crash.
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

const ABBR_CACHE = new Map();
/** Short zone abbreviation at that instant, e.g. "MDT"/"MST"/"PDT" ("UTC" falls back to the offset). */
export function zoneAbbreviation(date, timeZone) {
  const key = `${timeZone}|${Math.floor(date.getTime() / 3600000)}`; // stable per hour, cheap to cache
  let abbr = ABBR_CACHE.get(key);
  if (abbr) return abbr;
  const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
    .formatToParts(date).find((p) => p.type === 'timeZoneName');
  abbr = part?.value ?? timeZone;
  ABBR_CACHE.set(key, abbr);
  return abbr;
}

const pad2 = (n) => String(n).padStart(2, '0');

/** "HH:mm" in `timeZone` at `date`. */
export function zonedHHMM(date, timeZone) {
  const p = utcToZonedParts(date, timeZone);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** "HH:mm" in UTC (Zulu) at `date`. */
export function zuluHHMM(date) {
  return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
}

/** "15:00 MDT · 21:00Z" — the app's standard local+Zulu time label. */
export function localAndZulu(date, timeZone) {
  if (!timeZone) return `${zuluHHMM(date)}Z`;
  return `${zonedHHMM(date, timeZone)} ${zoneAbbreviation(date, timeZone)} · ${zuluHHMM(date)}Z`;
}

/** "09/04/2026, 3:00 PM MDT · 21:00Z" — same, with the zoned date/time spelled out for a different-day case. */
export function localAndZuluLong(date, timeZone) {
  if (!timeZone) return `${date.toISOString().slice(0, 16).replace('T', ' ')}Z`;
  const datePart = new Intl.DateTimeFormat('en-US', { timeZone, month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
  return `${datePart} ${zoneAbbreviation(date, timeZone)} · ${zuluHHMM(date)}Z`;
}

const MINUTE_MS = 60000;
export const METAR_STALE_MINUTES = 90;

/** Minutes between `fromDate` and `now` (defaults to the real current time), rounded down, never negative. */
export function ageMinutes(fromDate, now = new Date()) {
  return Math.max(0, Math.floor((now.getTime() - fromDate.getTime()) / MINUTE_MS));
}

/** "observed 47 min ago" / "observed 2 hr 5 min ago", plus whether that counts as stale. */
export function observedAgeLabel(fromDate, now = new Date()) {
  const minutes = ageMinutes(fromDate, now);
  const label = minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} hr ${minutes % 60} min ago`;
  return { minutes, stale: minutes > METAR_STALE_MINUTES, label: `observed ${label}` };
}
