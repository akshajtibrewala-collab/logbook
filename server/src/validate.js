export const TIME_FIELDS = [
  'total_time', 'pic_time', 'sic_time', 'dual_received', 'solo_time',
  'night_time', 'instrument_actual', 'instrument_simulated', 'cross_country_time',
];
export const COUNT_FIELDS = ['day_landings', 'night_landings', 'approaches', 'holds'];
export const TEXT_FIELDS = ['aircraft_type', 'tail_number', 'airline', 'remarks'];
export const AIRPORT_FIELDS = ['departure_airport', 'arrival_airport'];
export const FLIGHT_FIELDS = ['date', ...AIRPORT_FIELDS, 'route', ...TEXT_FIELDS, ...TIME_FIELDS, ...COUNT_FIELDS];

export function isIsoDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const round2 = (n) => Math.round(n * 100) / 100;
const isBlank = (x) => x === undefined || x === null || x === '';

/**
 * Validates and normalises a flight payload. Returns { value, errors }.
 * Missing numeric fields default to 0; times are rounded to 2 decimals.
 */
export function parseFlight(body) {
  const errors = {};
  const v = {};
  const b = body && typeof body === 'object' ? body : {};

  if (!isIsoDate(b.date)) errors.date = 'Date must be YYYY-MM-DD';
  else v.date = b.date;

  for (const f of AIRPORT_FIELDS) {
    const s = String(b[f] ?? '').trim().toUpperCase();
    if (s && !/^[A-Z0-9]{3,4}$/.test(s)) errors[f] = 'Use a 3-4 character ICAO/IATA code';
    v[f] = s || null;
  }
  // Airports flown via: keep only plausible 3-4 character codes, space separated.
  const via = String(b.route ?? '').toUpperCase().split(/[\s,;>/-]+/).filter((t) => /^[A-Z0-9]{3,4}$/.test(t));
  v.route = via.length ? via.join(' ') : null;
  for (const f of TEXT_FIELDS) {
    const s = String(b[f] ?? '').trim();
    if (f === 'airline' && s.length > 40) errors.airline = 'Keep the airline name under 40 characters';
    v[f] = s || null;
  }
  if (v.tail_number) v.tail_number = v.tail_number.toUpperCase();

  for (const f of TIME_FIELDS) {
    const n = isBlank(b[f]) ? 0 : Number(b[f]);
    if (!Number.isFinite(n) || n < 0 || n > 99) errors[f] = 'Must be a number between 0 and 99';
    else v[f] = round2(n);
  }
  for (const f of COUNT_FIELDS) {
    const n = isBlank(b[f]) ? 0 : Number(b[f]);
    if (!Number.isInteger(n) || n < 0 || n > 999) errors[f] = 'Must be a whole number, 0 or more';
    else v[f] = n;
  }

  if (!errors.total_time) {
    for (const f of TIME_FIELDS) {
      if (f !== 'total_time' && !errors[f] && v[f] > v.total_time) errors[f] = 'Cannot exceed total time';
    }
  }
  return { value: v, errors: Object.keys(errors).length ? errors : null };
}
