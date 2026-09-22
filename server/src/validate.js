export const TIME_FIELDS = [
  'total_time', 'pic_time', 'sic_time', 'dual_received', 'solo_time',
  'night_time', 'instrument_actual', 'instrument_simulated', 'cross_country_time',
];
export const COUNT_FIELDS = ['day_landings', 'night_landings', 'approaches', 'holds'];
export const TEXT_FIELDS = ['aircraft_type', 'tail_number', 'airline', 'remarks'];
export const AIRPORT_FIELDS = ['departure_airport', 'arrival_airport'];
export const FLIGHT_FIELDS = ['date', ...AIRPORT_FIELDS, 'route', 'aircraft_id', ...TEXT_FIELDS, ...TIME_FIELDS, ...COUNT_FIELDS];

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

  // Optional link to an aircraft row; aircraft_type/tail_number stay as free text regardless, so a
  // flight without a linked aircraft (e.g. from an older CSV import) still displays and exports fine.
  const aircraftId = isBlank(b.aircraft_id) ? null : Number(b.aircraft_id);
  if (aircraftId !== null && (!Number.isInteger(aircraftId) || aircraftId <= 0)) errors.aircraft_id = 'Invalid aircraft';
  else v.aircraft_id = aircraftId;
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

/**
 * Validates an optional structured stops list: [{ airport_code, stop_type }, ...], in the order they'll
 * be flown. Returns { value, errors } where errors, if present, is keyed by index ("0", "1", ...).
 * Sequence is implicit in array order, not a field the caller sends.
 */
export function parseStops(list) {
  if (!Array.isArray(list)) return { value: null, errors: null }; // not provided: caller leaves stops alone
  const errors = {};
  const value = [];
  list.forEach((s, i) => {
    const code = String(s?.airport_code ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9]{3,4}$/.test(code)) { errors[i] = 'Use a 3-4 character ICAO/IATA code'; return; }
    value.push({ airport_code: code, stop_type: s?.stop_type === 'touch_and_go' ? 'touch_and_go' : 'full_stop' });
  });
  return { value, errors: Object.keys(errors).length ? errors : null };
}

export const AIRCRAFT_TEXT_FIELDS = [
  'tail_number', 'make', 'model', 'type_designator', 'category', 'class',
  'type_rating_designation', 'simulator_device_type', 'notes',
];
export const AIRCRAFT_FLAG_FIELDS = [
  'is_complex', 'is_high_performance', 'is_tailwheel', 'is_turbine', 'is_taa', 'type_rating_required', 'is_simulator',
];
export const AIRCRAFT_FIELDS = [...AIRCRAFT_TEXT_FIELDS, ...AIRCRAFT_FLAG_FIELDS];

/** Validates and normalises an aircraft payload (also used for simulators/training devices). */
export function parseAircraft(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = {};
  const v = {};

  for (const f of AIRCRAFT_TEXT_FIELDS) {
    const s = String(b[f] ?? '').trim();
    v[f] = s || null;
  }
  if (v.tail_number) v.tail_number = v.tail_number.toUpperCase();
  if (!v.tail_number && !v.model && !v.type_designator) {
    errors.tail_number = 'Enter a tail number, or at least a make/model';
  }

  for (const f of AIRCRAFT_FLAG_FIELDS) v[f] = b[f] ? 1 : 0;
  if (v.type_rating_required && !v.type_rating_designation) {
    errors.type_rating_designation = 'Enter the type rating (e.g. B737)';
  }
  if (v.is_simulator && !v.simulator_device_type) {
    errors.simulator_device_type = 'Choose a device type';
  }

  return { value: v, errors: Object.keys(errors).length ? errors : null };
}
