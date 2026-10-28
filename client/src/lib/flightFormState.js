// The flight form's state, as pure functions so the edit round-trip can be tested: a stored flight becomes form text (fromFlight) and the form
// becomes an API payload (toPayload). The server replaces the whole row on a save, so every field the form carries without an input
// (instructor, invoice_ref, debrief notes, cost_override, dual_given, simulator_time, sic_time, ground_time, airline, flight_number...) must come back unchanged.
import { fmtHours, parseHours } from './hours.js';
import { approachTotal } from './flightDraft.js';

export const TIME_FIELDS = [
  ['total_time', 'Total'], ['pic_time', 'PIC'], ['sic_time', 'SIC'],
  ['dual_received', 'Dual received'], ['dual_given', 'Dual given'],
  ['solo_time', 'Solo'], ['simulator_time', 'Simulator'], ['ground_time', 'Ground instruction'],
  ['night_time', 'Night'], ['cross_country_time', 'Cross-country'],
  ['instrument_actual', 'Instrument (actual)'], ['instrument_simulated', 'Instrument (simulated)'],
];
// These have no input on the pilot form any more; their stored values ride along unchanged on edit.
export const HIDDEN_TIME = new Set(['dual_given', 'simulator_time', 'sic_time', 'ground_time']);
// Every field the pilot form carries without an input (hours and text): validation skips them, so a stored value can never block a save.
export const HIDDEN_FIELDS = [...HIDDEN_TIME, 'airline', 'flight_number'];
export const COUNT_FIELDS = ['day_landings', 'day_landings_full_stop', 'night_landings', 'night_landings_full_stop', 'approaches', 'holds'];

export const todayLocal = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

export const blank = (role, today = todayLocal()) => ({
  date: today, role: role === 'passenger' ? 'passenger' : 'pilot', departure_airport: '', arrival_airport: '', route: '', stops: [], aircraft_id: null, aircraft_type: '', tail_number: '',
  airline: '', flight_number: '', seat_class: '', confirmation_code: '', remarks: '', debrief_went_well: '', debrief_work_on: '', approach_types: [], cost_override: '',
  instructor: '', invoice_ref: '', // carried through unchanged on edit (no inputs): the server replaces the whole row, so leaving them out would erase them
  dep_time: '', arr_time: '', arr_day_offset: '',
  ...Object.fromEntries(TIME_FIELDS.map(([k]) => [k, fmtHours(0)])),
  ...Object.fromEntries(COUNT_FIELDS.map((k) => [k, '0'])),
});

export function fromFlight(f) {
  const s = blank();
  for (const k of Object.keys(s)) {
    if (k === 'cost_override') { s[k] = f[k] == null ? '' : String(f[k]); continue; }
    if (f[k] === null || f[k] === undefined) continue;
    if (k === 'aircraft_id' || k === 'stops' || k === 'approach_types') { s[k] = f[k]; continue; } // not text-input values
    s[k] = TIME_FIELDS.some(([t]) => t === k) ? fmtHours(f[k]) : String(f[k]);
  }
  return s;
}

/** The API payload for a save, or { errors } when an hours field can't be read. Rows with no airport or no approach type are dropped. */
export function toPayload(form) {
  const approachTypes = form.approach_types.filter((a) => a.approach_type);
  const payload = { ...form, stops: form.stops.filter((s) => s.airport_code.trim()), approach_types: approachTypes };
  if (approachTypes.length) payload.approaches = String(approachTotal(approachTypes));
  payload.cost_override = form.cost_override.trim() === '' ? null : form.cost_override;
  const errors = {};
  for (const [k, label] of TIME_FIELDS) {
    const n = parseHours(form[k]);
    if (n === null) errors[k] = `${label}: use 1.5 or 1:30`;
    payload[k] = n;
  }
  return Object.keys(errors).length ? { payload, errors } : { payload, errors: null };
}
