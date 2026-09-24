// Pure helpers for the flight forms: prefilling from a previous flight, client-side validation that
// mirrors the server's rules (so a bad entry is caught before a round trip), and remembered defaults.

const TIME_KEYS = [
  'total_time', 'pic_time', 'sic_time', 'dual_received', 'dual_given', 'solo_time', 'simulator_time',
  'ground_time', 'night_time', 'instrument_actual', 'instrument_simulated', 'cross_country_time',
];
const COUNT_KEYS = ['day_landings', 'day_landings_full_stop', 'night_landings', 'night_landings_full_stop', 'approaches', 'holds'];

// Copied from the last flight: where/what you flew. Deliberately NOT copied: remarks, debrief notes,
// invoice reference and manual cost override — those belong to one specific flight.
const COPIED = [
  'departure_airport', 'arrival_airport', 'route', 'aircraft_id', 'aircraft_type', 'tail_number', 'airline', 'flight_number',
  'instructor', ...TIME_KEYS, ...COUNT_KEYS,
];

/** A new-flight draft (API-shaped) based on `last`, dated `today`. Returns null when there is no last flight. */
export function prefillFromFlight(last, today) {
  if (!last) return null;
  const draft = { date: today };
  for (const k of COPIED) if (last[k] !== undefined && last[k] !== null) draft[k] = last[k];
  if (Array.isArray(last.stops)) draft.stops = last.stops.map((s) => ({ airport_code: s.airport_code, stop_type: s.stop_type }));
  if (Array.isArray(last.approach_types)) draft.approach_types = last.approach_types.map((a) => ({ approach_type: a.approach_type, count: a.count }));
  return draft;
}

/** The most recent flight by date, then id — the "last entry" for Copy last. */
export function mostRecentFlight(flights) {
  if (!flights?.length) return null;
  return [...flights].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)[0];
}

const isRealDate = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/**
 * Validates an API-shaped flight payload (numbers already parsed). Returns { field: message } — empty
 * when fine. Rules match server/src/validate.js: real date, non-negative hours up to 99, none exceeding
 * total time, whole non-negative landings, 3-4 character airport codes.
 */
export function validateFlightPayload(p, { today } = {}) {
  const errors = {};
  if (!isRealDate(p.date)) errors.date = 'Enter a real date';
  else if (today && p.date > today) errors.date = 'That date is in the future';
  for (const k of ['departure_airport', 'arrival_airport']) {
    const s = String(p[k] ?? '').trim();
    if (s && !/^[A-Za-z0-9]{3,4}$/.test(s)) errors[k] = 'Use a 3-4 character airport code';
  }
  for (const k of TIME_KEYS) {
    const n = Number(p[k] ?? 0);
    if (!Number.isFinite(n) || n < 0) errors[k] = 'Hours can’t be negative';
    else if (n > 99) errors[k] = 'Must be 99 or less';
  }
  const total = Number(p.total_time ?? 0);
  if (!errors.total_time) {
    for (const k of TIME_KEYS) {
      if (k === 'total_time' || k === 'ground_time' || errors[k]) continue;
      if (Number(p[k] ?? 0) > total) errors[k] = 'Can’t exceed total time';
    }
  }
  for (const k of COUNT_KEYS) {
    const n = Number(p[k] ?? 0);
    if (!Number.isInteger(n) || n < 0) errors[k] = 'Must be a whole number, 0 or more';
  }
  if (!errors.day_landings_full_stop && Number(p.day_landings_full_stop ?? 0) > Number(p.day_landings ?? 0)) errors.day_landings_full_stop = 'Can’t exceed day landings';
  if (!errors.night_landings_full_stop && Number(p.night_landings_full_stop ?? 0) > Number(p.night_landings ?? 0)) errors.night_landings_full_stop = 'Can’t exceed night landings';
  return errors;
}

/** Quick-add's tiny rule set: a real date and a flight time above zero. */
export function validateQuickFlight({ date, total_time }, { today } = {}) {
  const errors = {};
  if (!isRealDate(date)) errors.date = 'Enter a real date';
  else if (today && date > today) errors.date = 'That date is in the future';
  const n = Number(total_time);
  if (!Number.isFinite(n) || n <= 0) errors.total_time = 'Enter the flight time';
  else if (n > 99) errors.total_time = 'Must be 99 or less';
  return errors;
}

/** Quick-add's API payload: total time is also logged as PIC by default (the common case, editable later). */
export function quickFlightPayload({ date, departure_airport, arrival_airport, aircraft, total_time, dual }) {
  const total = Math.round(Number(total_time) * 100) / 100;
  return {
    date,
    departure_airport: (departure_airport || '').trim().toUpperCase(),
    arrival_airport: (arrival_airport || '').trim().toUpperCase(),
    aircraft_id: aircraft?.id ?? null,
    aircraft_type: aircraft ? (aircraft.type_designator || aircraft.model || '') : '',
    tail_number: aircraft?.tail_number || '',
    total_time: total,
    ...(dual ? { dual_received: total } : { pic_time: total }),
    day_landings: 1,
    day_landings_full_stop: 1,
  };
}

/** Nudges a decimal-hours string by `delta`, clamped to 0–99, two decimals ("1.50"). */
export function stepHours(value, delta) {
  const n = Number(String(value ?? '').replace(',', '.'));
  const base = Number.isFinite(n) ? n : 0;
  return (Math.min(99, Math.max(0, Math.round((base + delta) * 10) / 10))).toFixed(2);
}
