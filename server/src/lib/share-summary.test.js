import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildShareSummary, recentFlights } from './share-summary.js';

const flights = [
  { id: 1, date: '2026-01-01', departure_airport: 'KPAO', arrival_airport: 'KSQL', total_time: 1.2, pic_time: 1.2, night_time: 0.3, day_landings: 2, night_landings: 1,
    aircraft_type: 'C172', tail_number: 'N1', remarks: 'secret note', debrief_work_on: 'flare', instructor: 'Jane', invoice_ref: 'INV1', cost_override: 200 },
  { id: 2, date: '2026-02-01', departure_airport: 'KSQL', arrival_airport: 'KPAO', total_time: 0.8, dual_received: 0.8, instrument_actual: 0.2, instrument_simulated: 0.1, day_landings: 1, remarks: null },
];
const share = { show_recent_flights: 1, show_aircraft: 1, show_notes: 0, show_photos: 0 };
const now = new Date('2026-03-01T00:00:00Z');

test('totals add up and target progress uses total hours', () => {
  const s = buildShareSummary({ flights, share, settings: { hours_target: 40, hours_target_label: 'Private' }, now });
  assert.equal(s.totals.total, 2);
  assert.equal(s.totals.landings, 4);
  assert.equal(s.totals.instrument, 0.3);
  assert.deepEqual(s.target, { label: 'Private', hours: 40, flown: 2 });
});

test('never leaks costs, instructors, invoices or debriefs; notes only when enabled', () => {
  const off = JSON.stringify(buildShareSummary({ flights, share, now }));
  for (const secret of ['secret note', 'Jane', 'INV1', 'flare', 'cost']) assert.ok(!off.includes(secret), secret);
  const on = buildShareSummary({ flights, share: { ...share, show_notes: 1 }, now });
  assert.equal(on.recent.find((r) => r.id === 1).note, 'secret note');
  assert.ok(!JSON.stringify(on).includes('Jane'));
});

test('recent list is newest first and respects toggles', () => {
  assert.deepEqual(recentFlights(flights).map((f) => f.id), [2, 1]);
  const s = buildShareSummary({ flights, share: { ...share, show_aircraft: 0 }, now });
  assert.ok(!('tail_number' in s.recent[0]));
  assert.deepEqual(buildShareSummary({ flights, share: { ...share, show_recent_flights: 0 }, now }).recent, []);
});

test('photo ids appear only when photos are shared', () => {
  const ids = { 2: [7, 8] };
  assert.ok(!('photo_ids' in buildShareSummary({ flights, share, photoIdsByFlight: ids, now }).recent[0]));
  assert.deepEqual(buildShareSummary({ flights, share: { ...share, show_photos: 1 }, photoIdsByFlight: ids, now }).recent[0].photo_ids, [7, 8]);
});
