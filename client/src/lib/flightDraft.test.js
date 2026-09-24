import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prefillFromFlight, mostRecentFlight, validateFlightPayload, validateQuickFlight, quickFlightPayload, stepHours } from './flightDraft.js';

const last = {
  id: 9, date: '2026-01-05', departure_airport: 'KPAO', arrival_airport: 'KSQL', route: 'KFYG', aircraft_id: 3, aircraft_type: 'C172', tail_number: 'N1',
  total_time: 1.4, dual_received: 1.4, day_landings: 3, remarks: 'windy', debrief_work_on: 'flare', invoice_ref: 'INV9', cost_override: 250,
  stops: [{ airport_code: 'KFYG', stop_type: 'touch_and_go', id: 5 }], approach_types: [{ approach_type: 'ILS', count: 1, id: 2 }],
};

test('copy last: keeps route/aircraft/times, sets today, drops notes, invoice and cost override', () => {
  const d = prefillFromFlight(last, '2026-09-23');
  assert.equal(d.date, '2026-09-23');
  assert.equal(d.tail_number, 'N1');
  assert.equal(d.total_time, 1.4);
  assert.deepEqual(d.stops, [{ airport_code: 'KFYG', stop_type: 'touch_and_go' }]);
  for (const k of ['remarks', 'debrief_work_on', 'invoice_ref', 'cost_override', 'id']) assert.ok(!(k in d), k);
  assert.equal(prefillFromFlight(null, 'x'), null);
});

test('mostRecentFlight orders by date then id', () => {
  const list = [{ id: 1, date: '2026-01-01' }, { id: 3, date: '2026-02-01' }, { id: 4, date: '2026-02-01' }];
  assert.equal(mostRecentFlight(list).id, 4);
  assert.equal(mostRecentFlight([]), null);
});

test('validateFlightPayload catches negative hours, fake dates, sub-times above total, bad landings', () => {
  assert.deepEqual(validateFlightPayload({ date: '2026-03-01', total_time: 1 }), {});
  assert.ok(validateFlightPayload({ date: '2026-02-30', total_time: 1 }).date);
  assert.ok(validateFlightPayload({ date: '2026-03-01', total_time: -1 }).total_time);
  assert.ok(validateFlightPayload({ date: '2026-03-01', total_time: 1, night_time: 2 }).night_time);
  assert.ok(validateFlightPayload({ date: '2026-03-01', total_time: 1, day_landings: -1 }).day_landings);
  assert.ok(validateFlightPayload({ date: '2026-03-01', total_time: 1, day_landings: 1, day_landings_full_stop: 2 }).day_landings_full_stop);
  assert.ok(validateFlightPayload({ date: '2026-03-01', departure_airport: 'K' }).departure_airport);
  assert.ok(validateFlightPayload({ date: '2027-01-01' }, { today: '2026-09-23' }).date);
  assert.equal(validateFlightPayload({ date: '2026-03-01', total_time: 1, ground_time: 1.5 }).ground_time, undefined); // ground isn't flight time
});

test('quick add needs only a real date and a positive time', () => {
  assert.deepEqual(validateQuickFlight({ date: '2026-03-01', total_time: '1.2' }), {});
  assert.ok(validateQuickFlight({ date: '2026-03-01', total_time: '0' }).total_time);
  assert.ok(validateQuickFlight({ date: 'nope', total_time: '1' }).date);
});

test('quick payload defaults to PIC, or dual when asked, with one full-stop landing', () => {
  const ac = { id: 2, type_designator: 'C172', tail_number: 'N9' };
  const p = quickFlightPayload({ date: '2026-03-01', departure_airport: ' kpao', arrival_airport: 'ksql', aircraft: ac, total_time: '1.25' });
  assert.equal(p.pic_time, 1.25);
  assert.equal(p.departure_airport, 'KPAO');
  assert.equal(p.aircraft_id, 2);
  assert.equal(p.day_landings_full_stop, 1);
  assert.equal(quickFlightPayload({ date: 'd', total_time: 1, dual: true }).dual_received, 1);
});

test('stepHours clamps and formats', () => {
  assert.equal(stepHours('1.50', 0.1), '1.60');
  assert.equal(stepHours('0.00', -0.1), '0.00');
  assert.equal(stepHours('', 0.5), '0.50');
  assert.equal(stepHours('99', 1), '99.00');
});
