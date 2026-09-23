// Resolves an airport's IANA time zone from its coordinates. The airports table has no time zone
// column, so every airport's local time (weather display, "Plan a flight" ETAs) is derived from its
// lat/lon via tz-lookup, which ships its own geo boundary data rather than depending on any online API.
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
