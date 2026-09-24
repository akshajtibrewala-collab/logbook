export const TIME_FIELDS = [
  'total_time', 'pic_time', 'sic_time', 'dual_received', 'dual_given', 'solo_time', 'simulator_time',
  'night_time', 'instrument_actual', 'instrument_simulated', 'cross_country_time',
];
export const COUNT_FIELDS = ['day_landings', 'day_landings_full_stop', 'night_landings', 'night_landings_full_stop', 'approaches', 'holds'];
export const TEXT_FIELDS = ['aircraft_type', 'tail_number', 'airline', 'flight_number', 'remarks', 'debrief_went_well', 'debrief_work_on', 'instructor', 'invoice_ref'];
export const AIRPORT_FIELDS = ['departure_airport', 'arrival_airport'];
// ground_time is hours like TIME_FIELDS but kept separate from it: ground instruction isn't flight time,
// so (unlike TIME_FIELDS) it's never checked against total_time. cost_override is a nullable dollar
// amount, not hours, validated on its own.
export const GROUND_TIME_FIELD = 'ground_time';
export const COST_OVERRIDE_FIELD = 'cost_override';
export const FLIGHT_FIELDS = [
  'date', ...AIRPORT_FIELDS, 'route', 'aircraft_id', ...TEXT_FIELDS, ...TIME_FIELDS,
  GROUND_TIME_FIELD, COST_OVERRIDE_FIELD, ...COUNT_FIELDS,
];

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
    if (f === 'flight_number' && s.length > 20) errors.flight_number = 'Keep it under 20 characters';
    v[f] = s || null;
  }
  if (v.tail_number) v.tail_number = v.tail_number.toUpperCase();
  if (v.flight_number) v.flight_number = v.flight_number.toUpperCase();

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

  {
    const n = isBlank(b[GROUND_TIME_FIELD]) ? 0 : Number(b[GROUND_TIME_FIELD]);
    if (!Number.isFinite(n) || n < 0 || n > 99) errors[GROUND_TIME_FIELD] = 'Must be a number between 0 and 99';
    else v[GROUND_TIME_FIELD] = round2(n);
  }
  if (isBlank(b[COST_OVERRIDE_FIELD])) {
    v[COST_OVERRIDE_FIELD] = null;
  } else {
    const n = Number(b[COST_OVERRIDE_FIELD]);
    if (!Number.isFinite(n) || n < 0 || n > 999999) errors[COST_OVERRIDE_FIELD] = 'Must be a number, 0 or more';
    else v[COST_OVERRIDE_FIELD] = round2(n);
  }

  if (!errors.total_time) {
    for (const f of TIME_FIELDS) {
      if (f !== 'total_time' && !errors[f] && v[f] > v.total_time) errors[f] = 'Cannot exceed total time';
    }
  }
  if (!errors.day_landings && !errors.day_landings_full_stop && v.day_landings_full_stop > v.day_landings) {
    errors.day_landings_full_stop = 'Cannot exceed day landings';
  }
  if (!errors.night_landings && !errors.night_landings_full_stop && v.night_landings_full_stop > v.night_landings) {
    errors.night_landings_full_stop = 'Cannot exceed night landings';
  }
  return { value: v, errors: Object.keys(errors).length ? errors : null };
}

/**
 * Validates an optional typed-approach breakdown: [{ approach_type, count }, ...]. Returns
 * { value, errors } where errors, if present, is keyed by index ("0", "1", ...) — same shape as
 * parseStops. The flight's plain `approaches` total is independent of this and not derived here; the
 * client computes and sends whichever total it wants stored.
 */
export function parseApproaches(list) {
  if (!Array.isArray(list)) return { value: null, errors: null }; // not provided: caller leaves it alone
  const errors = {};
  const value = [];
  list.forEach((a, i) => {
    const type = String(a?.approach_type ?? '').trim();
    if (!type) { errors[i] = 'Choose an approach type'; return; }
    const count = Number(a?.count);
    if (!Number.isInteger(count) || count < 1 || count > 99) { errors[i] = 'Count must be a whole number, 1 or more'; return; }
    value.push({ approach_type: type, count });
  });
  return { value, errors: Object.keys(errors).length ? errors : null };
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

/** Validates a manual milestone completion payload: { completed_at, note? }. Returns { value, errors }. */
export function parseMilestoneCompletion(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = {};
  const v = {};

  if (!isIsoDate(b.completed_at)) errors.completed_at = 'Date must be YYYY-MM-DD';
  else v.completed_at = b.completed_at;

  const note = String(b.note ?? '').trim();
  v.note = note || null;

  return { value: v, errors: Object.keys(errors).length ? errors : null };
}

export const PILOT_SETTINGS_CEILING_FIELDS = ['min_ceiling_ft', 'night_min_ceiling_ft'];
export const PILOT_SETTINGS_WIND_FIELDS = ['max_wind_kt', 'max_gust_kt', 'max_crosswind_kt', 'night_max_wind_kt', 'night_max_gust_kt', 'night_max_crosswind_kt'];
export const PILOT_SETTINGS_REAL_FIELDS = ['min_visibility_sm', 'night_min_visibility_sm', 'default_ground_time'];
// Validated separately from PILOT_SETTINGS_REAL_FIELDS: those all share a 0-99 cap sized for weather
// minimums and a briefing length, but a realistic total-hours target can reasonably run into the hundreds.
export const PILOT_SETTINGS_HOURS_TARGET_FIELDS = ['private_realistic_total_hours'];
export const PILOT_SETTINGS_FIELDS = [
  'home_airport_ident', ...PILOT_SETTINGS_CEILING_FIELDS, ...PILOT_SETTINGS_WIND_FIELDS,
  ...PILOT_SETTINGS_REAL_FIELDS, ...PILOT_SETTINGS_HOURS_TARGET_FIELDS,
];

/**
 * Validates a pilot_settings payload. Every minimum is optional — a blank field means "don't check this
 * limit yet" (null), not zero, so an incomplete settings form still lets everything else work.
 */
export function parsePilotSettings(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = {};
  const v = {};

  const airport = String(b.home_airport_ident ?? '').trim().toUpperCase();
  if (airport && !/^[A-Z0-9]{3,4}$/.test(airport)) errors.home_airport_ident = 'Use a 3-4 character ICAO/IATA code';
  v.home_airport_ident = airport || null;

  const validateInt = (f, max) => {
    if (isBlank(b[f])) { v[f] = null; return; }
    const n = Number(b[f]);
    if (!Number.isInteger(n) || n < 0 || n > max) errors[f] = `Must be a whole number from 0 to ${max}`;
    else v[f] = n;
  };
  for (const f of PILOT_SETTINGS_CEILING_FIELDS) validateInt(f, 60000); // service ceiling of light GA aircraft
  for (const f of PILOT_SETTINGS_WIND_FIELDS) validateInt(f, 200); // well above any GA aircraft's demonstrated crosswind

  for (const f of PILOT_SETTINGS_REAL_FIELDS) {
    if (isBlank(b[f])) { v[f] = null; continue; }
    const n = Number(b[f]);
    if (!Number.isFinite(n) || n < 0 || n > 99) errors[f] = 'Must be a number, 0 or more';
    else v[f] = round2(n);
  }
  for (const f of PILOT_SETTINGS_HOURS_TARGET_FIELDS) {
    if (isBlank(b[f])) { v[f] = null; continue; }
    const n = Number(b[f]);
    if (!Number.isFinite(n) || n < 1 || n > 500) errors[f] = 'Must be a number from 1 to 500';
    else v[f] = round2(n);
  }

  return { value: v, errors: Object.keys(errors).length ? errors : null };
}

export const EXPIRATION_FIELDS = ['kind', 'label', 'issued_date', 'expires_date', 'notes'];

/** Validates and normalises an expiration payload (medical certificate, passport, or any custom item). */
export function parseExpiration(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = {};
  const v = {};

  v.kind = String(b.kind ?? '').trim() || 'custom';
  const label = String(b.label ?? '').trim();
  if (!label) errors.label = 'Enter a label';
  v.label = label;

  if (b.issued_date && !isIsoDate(b.issued_date)) errors.issued_date = 'Date must be YYYY-MM-DD';
  else v.issued_date = b.issued_date || null;

  if (!isIsoDate(b.expires_date)) errors.expires_date = 'Date must be YYYY-MM-DD';
  else v.expires_date = b.expires_date;

  const notes = String(b.notes ?? '').trim();
  v.notes = notes || null;

  return { value: v, errors: Object.keys(errors).length ? errors : null };
}

const parseCertificate = (b, v, errors) => {
  const certificate = String(b.certificate ?? '').trim();
  if (!certificate) errors.certificate = 'Choose a training phase';
  else v.certificate = certificate;
};

/** Validates a simple {certificate, effective_date, hourly_rate} rate row (instructor, ground, or simulator rate) — belongs to one training phase's own rate history. */
export function parseHourlyRate(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = {};
  const v = {};

  parseCertificate(b, v, errors);

  if (!isIsoDate(b.effective_date)) errors.effective_date = 'Date must be YYYY-MM-DD';
  else v.effective_date = b.effective_date;

  const rate = Number(b.hourly_rate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 99999) errors.hourly_rate = 'Must be a number, 0 or more';
  else v.hourly_rate = round2(rate);

  return { value: v, errors: Object.keys(errors).length ? errors : null };
}

/** Validates a per-aircraft rate row: {certificate, aircraft_id, effective_date, rental_rate_per_hr, fuel_surcharge_per_hr} — belongs to one training phase's own rate history. */
export function parseAircraftRate(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = {};
  const v = {};

  parseCertificate(b, v, errors);

  const aircraftId = Number(b.aircraft_id);
  if (!Number.isInteger(aircraftId) || aircraftId <= 0) errors.aircraft_id = 'Choose an aircraft';
  else v.aircraft_id = aircraftId;

  if (!isIsoDate(b.effective_date)) errors.effective_date = 'Date must be YYYY-MM-DD';
  else v.effective_date = b.effective_date;

  const rental = Number(b.rental_rate_per_hr);
  if (!Number.isFinite(rental) || rental < 0 || rental > 99999) errors.rental_rate_per_hr = 'Must be a number, 0 or more';
  else v.rental_rate_per_hr = round2(rental);

  const fuel = isBlank(b.fuel_surcharge_per_hr) ? 0 : Number(b.fuel_surcharge_per_hr);
  if (!Number.isFinite(fuel) || fuel < 0 || fuel > 99999) errors.fuel_surcharge_per_hr = 'Must be a number, 0 or more';
  else v.fuel_surcharge_per_hr = round2(fuel);

  return { value: v, errors: Object.keys(errors).length ? errors : null };
}

export const EXPENSE_CATEGORIES = ['books', 'headset', 'medical', 'written_test', 'checkride_fee', 'other'];

/** Validates a one-off training expense: {category, date, amount, note, invoice_ref}. */
export function parseExpense(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = {};
  const v = {};

  v.category = EXPENSE_CATEGORIES.includes(b.category) ? b.category : 'other';

  if (!isIsoDate(b.date)) errors.date = 'Date must be YYYY-MM-DD';
  else v.date = b.date;

  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount < 0 || amount > 999999) errors.amount = 'Must be a number, 0 or more';
  else v.amount = round2(amount);

  const note = String(b.note ?? '').trim();
  v.note = note || null;
  const invoiceRef = String(b.invoice_ref ?? '').trim();
  v.invoice_ref = invoiceRef || null;

  return { value: v, errors: Object.keys(errors).length ? errors : null };
}

/** Validates a ground-only training session (no flight logged): {date, hours, instructor, topics, notes, cost_override, invoice_ref}. */
export function parseGroundSession(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = {};
  const v = {};

  if (!isIsoDate(b.date)) errors.date = 'Date must be YYYY-MM-DD';
  else v.date = b.date;

  const hours = Number(b.hours);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) errors.hours = 'Must be a number greater than 0, up to 24';
  else v.hours = round2(hours);

  const instructor = String(b.instructor ?? '').trim();
  v.instructor = instructor || null;
  const topics = String(b.topics ?? '').trim();
  v.topics = topics || null;
  const notes = String(b.notes ?? '').trim();
  v.notes = notes || null;
  const invoiceRef = String(b.invoice_ref ?? '').trim();
  v.invoice_ref = invoiceRef || null;

  if (isBlank(b.cost_override)) {
    v.cost_override = null;
  } else {
    const override = Number(b.cost_override);
    if (!Number.isFinite(override) || override < 0 || override > 999999) errors.cost_override = 'Must be a number, 0 or more';
    else v.cost_override = round2(override);
  }

  return { value: v, errors: Object.keys(errors).length ? errors : null };
}

/** Validates a certificate's training-phase date range: {certificate, start_date, end_date, track_costs}. */
export function parseTrainingPhase(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = {};
  const v = {};

  parseCertificate(b, v, errors);

  if (!isIsoDate(b.start_date)) errors.start_date = 'Date must be YYYY-MM-DD';
  else v.start_date = b.start_date;

  if (b.end_date && !isIsoDate(b.end_date)) errors.end_date = 'Date must be YYYY-MM-DD';
  else v.end_date = b.end_date || null;

  if (v.start_date && v.end_date && v.end_date < v.start_date) errors.end_date = 'Cannot be before the start date';

  v.track_costs = b.track_costs === false ? 0 : 1;

  return { value: v, errors: Object.keys(errors).length ? errors : null };
}

/** Validates a one-time planned cost still ahead for a certificate: {certificate, label, amount}. */
export function parsePlannedCost(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = {};
  const v = {};

  parseCertificate(b, v, errors);

  const label = String(b.label ?? '').trim();
  if (!label) errors.label = 'Enter a label';
  else v.label = label;

  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount < 0 || amount > 999999) errors.amount = 'Must be a number, 0 or more';
  else v.amount = round2(amount);

  return { value: v, errors: Object.keys(errors).length ? errors : null };
}
