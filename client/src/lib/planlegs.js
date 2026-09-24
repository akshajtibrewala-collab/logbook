// State model for the weather "Plan a flight" legs. Pure functions, so the cross-time-zone behaviour is
// unit-tested (planlegs.test.js) rather than living inside a component.
//
// THE RULE: a leg's time is stored as ONE thing — a UTC instant (`etaUtc`, an ISO string). An airport's
// time zone is only ever used to (a) turn what the pilot types into that instant and (b) turn the instant
// back into a wall-clock reading for display. Changing the airport therefore changes how the clock reads,
// never which moment is meant.
//
// (Previously a leg stored the *wall-clock string* the picker produced, and re-read it in whatever zone
// the airport currently had. Switching KJFK -> KLAX silently moved the requested time by three hours, and
// KORD -> KDEN by one — the same "12:10 AM" now meant a different instant, sometimes a different date.)
import { parseDateTime, parseISO, toDateTime, toISO } from './calendar.js';
import { utcToZonedParts, zonedToUtc, zoneAbbreviation, zuluHHMM } from './timezone.js';

/** Used when an airport's zone can't be determined: UTC is at least unambiguous, and the UI says so. */
export const FALLBACK_ZONE = 'UTC';

const MIN_IDENT = 3;
const cleanIdent = (ident) => String(ident ?? '').trim().toUpperCase();

/** tzStatus: 'none' (no airport yet) | 'pending' (lookup in flight) | 'ok' | 'unknown' (no usable zone). */
export const blankLeg = () => ({ ident: '', etaUtc: null, tz: null, tzStatus: 'none' });

export function isValidZone(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

/** The zone used to read or write this leg's wall clock. */
export const legZone = (leg) => (leg.tz && isValidZone(leg.tz) ? leg.tz : FALLBACK_ZONE);

/**
 * Switch the leg to another airport. The time (an instant) is kept; the zone is cleared until the lookup
 * for the new airport answers, so nothing is ever read in the previous airport's zone.
 */
export function changeAirport(leg, ident) {
  const clean = cleanIdent(ident);
  return { ...leg, ident, tz: null, tzStatus: clean.length >= MIN_IDENT ? 'pending' : 'none' };
}

/** Applies a lookup result (`found` maps an upper-case ident to { tz, ... }). Missing or invalid zone => 'unknown'. */
export function applyResolved(leg, found) {
  const clean = cleanIdent(leg.ident);
  if (clean.length < MIN_IDENT) return { ...leg, tz: null, tzStatus: 'none' };
  const tz = found?.[clean]?.tz;
  return isValidZone(tz) ? { ...leg, tz, tzStatus: 'ok' } : { ...leg, tz: null, tzStatus: 'unknown' };
}

/** The leg's time as "YYYY-MM-DDTHH:mm" on the airport's clock (what the date picker shows), or "". */
export function legWall(leg) {
  if (!leg.etaUtc) return '';
  const p = utcToZonedParts(new Date(leg.etaUtc), legZone(leg));
  return toDateTime(toISO(p.y, p.m, p.d), p.hour, p.minute);
}

/** The pilot typed/picked `wall` ("YYYY-MM-DDTHH:mm") on this airport's clock: store the instant it means. */
export function setLegWall(leg, wall) {
  const parsed = parseDateTime(wall);
  if (!parsed) return { ...leg, etaUtc: null };
  const day = parseISO(parsed.date);
  return { ...leg, etaUtc: zonedToUtc({ ...day, hour: parsed.hour, minute: parsed.minute }, legZone(leg)).toISOString() };
}

const weekday = (date, timeZone) => new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);

/**
 * The standard label, always local AND Zulu: "Thu 14:00 CDT / 19:00Z". When the local and Zulu calendar
 * days differ, both days are named: "Wed 23:10 CDT / Thu 04:10Z". With no known zone it says so.
 */
export function legTimeLabel(leg) {
  if (!leg.etaUtc) return '';
  const date = new Date(leg.etaUtc);
  const zulu = `${zuluHHMM(date)}Z`;
  if (legZone(leg) === FALLBACK_ZONE && !(leg.tz && isValidZone(leg.tz))) {
    return `${weekday(date, 'UTC')} ${zulu} (UTC — airport time zone unknown)`;
  }
  const tz = legZone(leg);
  const p = utcToZonedParts(date, tz);
  const localDay = weekday(date, tz);
  const zuluDay = weekday(date, 'UTC');
  const local = `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')} ${zoneAbbreviation(date, tz)}`;
  return `${localDay} ${local} / ${localDay === zuluDay ? '' : `${zuluDay} `}${zulu}`;
}

/** A clear message when this leg's airport has no usable time zone, else null. */
export function tzNotice(leg) {
  if (leg.tzStatus !== 'unknown') return null;
  return `Time zone for ${cleanIdent(leg.ident)} isn't available — times for this stop are entered and shown in UTC (Z).`;
}

/** What the server receives: an airport and a UTC instant per leg, nothing zone-dependent. */
export function planPayload(legs) {
  return legs.filter((l) => l.ident.trim() && l.etaUtc).map((l) => ({ ident: l.ident.trim(), eta: l.etaUtc }));
}
