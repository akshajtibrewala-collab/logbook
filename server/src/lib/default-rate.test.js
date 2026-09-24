import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickDefaultAircraftRate } from './default-rate.js';

test('defaults to $195 + $15 fuel when the phase has no aircraft rates yet', () => {
  assert.deepEqual(pickDefaultAircraftRate([]), { rental_rate_per_hr: 195, fuel_surcharge_per_hr: 15 });
});

test('otherwise follows the phase\'s most recently effective rate', () => {
  const rows = [
    { id: 1, effective_date: '2026-07-10', rental_rate_per_hr: 195, fuel_surcharge_per_hr: 15 },
    { id: 2, effective_date: '2026-10-01', rental_rate_per_hr: 205, fuel_surcharge_per_hr: 18 },
  ];
  assert.deepEqual(pickDefaultAircraftRate(rows), { rental_rate_per_hr: 205, fuel_surcharge_per_hr: 18 });
});
