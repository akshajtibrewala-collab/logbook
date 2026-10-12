/**
 * Provider side of the automatic registration job (AeroDataBox through RapidAPI). Pure functions only: no
 * network, no database, no environment reads, so every rule here is unit tested with synthetic fixtures.
 *
 * The one guard that keeps a wrong match rare: a result is used only when BOTH of its airports equal the
 * recorded ones, exactly one distinct registration remains, and the registration is shaped like one.
 */

export const PROVIDER = 'aerodatabox';
export const PROVIDER_HOST = 'aerodatabox.p.rapidapi.com';

/** A registration ready to store ("d-abcd " -> "D-ABCD"), or null when it is blank or not shaped like one. */
export function normalizeRegistration(raw) {
  if (typeof raw !== 'string') return null;
  const reg = raw.trim().toUpperCase().replace(/\s+/g, '');
  return /^[A-Z0-9]{1,3}-?[A-Z0-9]{1,5}$/.test(reg) && reg.length >= 2 && reg.length <= 7 ? reg : null;
}

/** "ab 1234" -> "AB1234"; null when blank or not shaped like a flight number (the provider accepts IATA or ICAO). */
export function normalizeFlightNumber(raw) {
  if (typeof raw !== 'string') return null;
  const n = raw.trim().toUpperCase().replace(/\s+/g, '');
  return /^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(n) ? n : null;
}

/** The request for one flight on one local departure date. `key` is only ever placed in a header. */
export function buildRequest(flightNumber, date, key) {
  const n = normalizeFlightNumber(flightNumber);
  if (!n || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return null;
  return {
    url: `https://${PROVIDER_HOST}/flights/number/${encodeURIComponent(n)}/${date}?dateLocalRole=Departure`,
    headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': PROVIDER_HOST, accept: 'application/json' },
  };
}

const up = (s) => String(s ?? '').trim().toUpperCase();

/**
 * Decides what a provider answer means for one recorded flight.
 *   { kind: 'match', registration }       use it
 *   { kind: 'no-match', reason }          nothing usable; the row is only marked as checked
 * `reason` is one of: 'empty', 'malformed', 'no-airport-match', 'no-registration', 'ambiguous', 'bad-format'.
 */
export function pickRegistration(body, { departure, arrival }) {
  if (!Array.isArray(body)) return { kind: 'no-match', reason: 'malformed' };
  if (body.length === 0) return { kind: 'no-match', reason: 'empty' };
  const dep = up(departure);
  const arr = up(arrival);
  const matched = body.filter((leg) => leg && typeof leg === 'object'
    && up(leg.departure?.airport?.icao) === dep && dep !== ''
    && up(leg.arrival?.airport?.icao) === arr && arr !== '');
  if (!matched.length) return { kind: 'no-match', reason: 'no-airport-match' };
  const raws = [...new Set(matched.map((leg) => up(leg.aircraft?.reg)).filter(Boolean))];
  if (!raws.length) return { kind: 'no-match', reason: 'no-registration' };
  if (raws.length > 1) return { kind: 'no-match', reason: 'ambiguous' };
  const registration = normalizeRegistration(raws[0]);
  if (!registration) return { kind: 'no-match', reason: 'bad-format' };
  return { kind: 'match', registration };
}

/**
 * Quota headers the provider returns on every response. The names are pinned to what the provider documents and
 * what its responses were seen to carry; there is deliberately no fallback to a request counter, because a request
 * counter says nothing reliable about units.
 */
export const UNITS_HEADERS = {
  remaining: 'x-ratelimit-api-units-remaining',
  limit: 'x-ratelimit-api-units-limit',
  resetSeconds: 'x-ratelimit-api-units-reset',
};

const wholeNumber = (v) => {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 ? v : null;
  return typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v.trim()) : null;
};

/**
 * The units headers of a response as { remaining, limit, resetSeconds } (each a whole number or null).
 * `headers` is a Headers object or a plain object. `remaining` is null when its header is missing or not a whole
 * number, and the job treats that as "stop": without it the reserve cannot be enforced.
 */
export function readUnitsHeaders(headers) {
  const out = { remaining: null, limit: null, resetSeconds: null };
  if (!headers) return out;
  const get = (name) => {
    if (typeof headers.get === 'function') return headers.get(name);
    const k = Object.keys(headers).find((h) => h.toLowerCase() === name);
    return k ? headers[k] : null;
  };
  for (const [field, name] of Object.entries(UNITS_HEADERS)) out[field] = wholeNumber(get(name));
  return out;
}
