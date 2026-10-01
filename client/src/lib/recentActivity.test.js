import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recentActivity } from './recentActivity.js';

const flight = (o) => ({ id: 1, date: '2026-01-01', departure_airport: 'KPAO', arrival_airport: 'KSQL', total_time: 1, ...o });

test('sorts newest first by date, then by id on a tie', () => {
  const flights = [
    flight({ id: 1, date: '2026-01-01' }),
    flight({ id: 3, date: '2026-02-01' }),
    flight({ id: 2, date: '2026-02-01' }),
  ];
  const rows = recentActivity(flights);
  assert.deepEqual(rows.map((r) => r.id), [3, 2, 1]);
});

test('caps at the given limit', () => {
  const flights = Array.from({ length: 10 }, (_, i) => flight({ id: i, date: `2026-01-${String(i + 1).padStart(2, '0')}` }));
  assert.equal(recentActivity(flights, 6).length, 6);
});

test('defaults a missing role to pilot (same rule as flightRoles.js) and carries through flight fields', () => {
  const [pilotRow] = recentActivity([flight({ aircraft_type: 'C172', tail_number: 'N123AB', airline: null })]);
  assert.equal(pilotRow.role, 'pilot');
  assert.equal(pilotRow.aircraft_type, 'C172');
  assert.equal(pilotRow.tail_number, 'N123AB');

  const [paxRow] = recentActivity([flight({ role: 'passenger', airline: 'Delta' })]);
  assert.equal(paxRow.role, 'passenger');
  assert.equal(paxRow.airline, 'Delta');
});

test('mixes pilot and passenger flights in one merged, date-ordered feed', () => {
  const flights = [
    flight({ id: 1, date: '2026-01-01', role: 'pilot' }),
    flight({ id: 2, date: '2026-01-05', role: 'passenger' }),
  ];
  const rows = recentActivity(flights);
  assert.deepEqual(rows.map((r) => r.role), ['passenger', 'pilot']);
});

test('an empty flight list returns an empty feed', () => {
  assert.deepEqual(recentActivity([]), []);
  assert.deepEqual(recentActivity(undefined), []);
});
