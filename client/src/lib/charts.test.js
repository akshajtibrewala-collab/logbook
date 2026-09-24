import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hoursByMonth, hoursByTail, cumulativeHours } from './charts.js';

const flights = [
  { date: '2026-01-10', total_time: 1.5, tail_number: 'N1', aircraft_type: 'C172' },
  { date: '2026-01-20', total_time: 0.75, tail_number: 'n1', aircraft_type: 'C172' },
  { date: '2026-03-02', total_time: 2, tail_number: '', aircraft_type: 'PA28' },
  { date: '2025-02-01', total_time: 9, tail_number: 'N2' }, // outside a 12-month window ending 2026-03
];

test('hoursByMonth zero-fills a rolling window and totals each month', () => {
  const r = hoursByMonth(flights, { months: 4, now: '2026-03-15' });
  assert.deepEqual(r.map((m) => m.month), ['2025-12', '2026-01', '2026-02', '2026-03']);
  assert.deepEqual(r.map((m) => m.hours), [0, 2.25, 0, 2]);
  assert.equal(r[0].label, 'Dec 25');
});

test('hoursByMonth handles no data', () => {
  const r = hoursByMonth([], { months: 3, now: '2026-03-15' });
  assert.equal(r.length, 3);
  assert.ok(r.every((m) => m.hours === 0));
});

test('hoursByTail merges tail spellings, falls back to type, sorts by hours', () => {
  assert.deepEqual(hoursByTail(flights), [
    { tail: 'N2', hours: 9 }, { tail: 'N1', hours: 2.25 }, { tail: 'PA28', hours: 2 },
  ]);
  assert.deepEqual(hoursByTail([{ total_time: 1 }]), [{ tail: 'Unknown', hours: 1 }]);
  assert.deepEqual(hoursByTail([]), []);
});

test('cumulativeHours builds a running total and progress toward the target', () => {
  const r = cumulativeHours(flights.slice(0, 3), { target: 40, now: '2026-03-15' });
  assert.deepEqual(r.points, [
    { date: '2026-01-10', hours: 1.5 }, { date: '2026-01-20', hours: 2.25 }, { date: '2026-03-02', hours: 4.25 },
  ]);
  assert.equal(r.total, 4.25);
  assert.equal(r.percent, 11);
  assert.equal(r.remaining, 35.75);
});

test('same-day flights collapse into one point', () => {
  const r = cumulativeHours([{ date: '2026-01-01', total_time: 1 }, { date: '2026-01-01', total_time: 0.5 }], {});
  assert.deepEqual(r.points, [{ date: '2026-01-01', hours: 1.5 }]);
});

test('projection extrapolates the last 90 days; none without pace, target or with the goal met', () => {
  const pace = [{ date: '2026-03-01', total_time: 9 }]; // 9 h in 90 days = 0.1 h/day
  const r = cumulativeHours(pace, { target: 10, now: '2026-03-10' });
  assert.equal(r.projectedDate, '2026-03-20'); // 1 h left at 0.1 h/day = 10 days
  assert.equal(cumulativeHours([{ date: '2020-01-01', total_time: 5 }], { target: 40, now: '2026-03-10' }).projectedDate, null);
  assert.equal(cumulativeHours(pace, { now: '2026-03-10' }).projectedDate, null);
  const done = cumulativeHours(pace, { target: 5, now: '2026-03-10' });
  assert.equal(done.percent, 100);
  assert.equal(done.remaining, 0);
  assert.equal(done.projectedDate, null);
});

test('no flights and no target are handled', () => {
  const r = cumulativeHours([], {});
  assert.deepEqual(r, { points: [], total: 0, target: null, percent: null, remaining: null, projectedDate: null });
});
