import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blank, fromFlight, toPayload, HIDDEN_TIME } from './flightFormState.js';

const stored = {
  id: 7, date: '2026-05-04', role: 'pilot', departure_airport: 'KPAO', arrival_airport: 'KSQL', route: '', aircraft_id: 3, aircraft_type: 'C172', tail_number: 'N1',
  airline: 'Delta', flight_number: 'DL123', instructor: 'Pat Keep', invoice_ref: 'KEEP-1', cost_override: 123.45, debrief_went_well: 'well', debrief_work_on: 'work',
  total_time: 1.5, pic_time: 1.5, sic_time: 0.4, ground_time: 0.7, dual_given: 0.3, simulator_time: 0.2, dual_received: 0, solo_time: 0, night_time: 0, cross_country_time: 0,
  instrument_actual: 0, instrument_simulated: 0.3, day_landings: 2, day_landings_full_stop: 2, night_landings: 0, night_landings_full_stop: 0, approaches: 0, holds: 0, remarks: 'r',
  stops: [], approach_types: [],
};

test('editing a pilot flight keeps the fields that have no input: airline, flight number, SIC, ground instruction, dual given, simulator, instructor, invoice, cost override, debrief', () => {
  const { payload, errors } = toPayload(fromFlight(stored));
  assert.equal(errors, null);
  assert.equal(payload.airline, 'Delta');
  assert.equal(payload.flight_number, 'DL123');
  assert.equal(payload.sic_time, 0.4);
  assert.equal(payload.ground_time, 0.7);
  assert.equal(payload.dual_given, 0.3);
  assert.equal(payload.simulator_time, 0.2);
  assert.equal(payload.instructor, 'Pat Keep');
  assert.equal(payload.invoice_ref, 'KEEP-1');
  assert.equal(payload.cost_override, '123.45');
  assert.equal(payload.debrief_went_well, 'well');
  assert.equal(payload.debrief_work_on, 'work');
  assert.equal(payload.instrument_simulated, 0.3, 'the one kept input still round-trips');
});

test('SIC and ground instruction are among the hidden time fields, but still parsed into the payload', () => {
  for (const k of ['sic_time', 'ground_time', 'dual_given', 'simulator_time']) assert.ok(HIDDEN_TIME.has(k), k);
  assert.ok(!HIDDEN_TIME.has('instrument_simulated'));
  const form = { ...blank('pilot', '2026-01-01'), sic_time: '0.50', ground_time: '1:30' };
  const { payload } = toPayload(form);
  assert.equal(payload.sic_time, 0.5);
  assert.equal(payload.ground_time, 1.5);
});

test('a typed approach sets the total from typed rows only; untyped rows are dropped and a typeless row leaves the typed total alone', () => {
  const f = { ...blank('pilot', '2026-01-01'), approaches: '4', approach_types: [{ approach_type: 'ILS', count: '2' }, { approach_type: '', count: '9' }, { approach_type: 'VOR', count: '1' }] };
  const { payload } = toPayload(f);
  assert.deepEqual(payload.approach_types, [{ approach_type: 'ILS', count: '2' }, { approach_type: 'VOR', count: '1' }]);
  assert.equal(payload.approaches, '3');
  const only = toPayload({ ...f, approach_types: [{ approach_type: '', count: '1' }] }).payload;
  assert.deepEqual(only.approach_types, []);
  assert.equal(only.approaches, '4', 'with no typed row the plain total is untouched');
});

test('an unreadable hours field is reported instead of saved', () => {
  const { errors } = toPayload({ ...blank('pilot', '2026-01-01'), pic_time: 'abc' });
  assert.match(errors.pic_time, /PIC/);
});

test('editing a flight whose stored SIC is above its total builds a payload that validates and still carries the SIC', async () => {
  const { validateFlightPayload } = await import('./flightDraft.js');
  const { HIDDEN_FIELDS } = await import('./flightFormState.js');
  const odd = { ...stored, total_time: 1, pic_time: 1, sic_time: 3, instrument_simulated: 0, dual_given: 5, airline: 'Keep Air' };
  const { payload, errors } = toPayload(fromFlight(odd));
  assert.equal(errors, null);
  assert.deepEqual(validateFlightPayload(payload, { today: '2026-10-27', skip: HIDDEN_FIELDS }), {});
  assert.equal(payload.sic_time, 3);
  assert.equal(payload.dual_given, 5);
  assert.ok(validateFlightPayload(payload, { today: '2026-10-27' }).sic_time, 'without the skip it would have blocked');
});
