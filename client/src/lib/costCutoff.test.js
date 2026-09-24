import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeFlightCost, computeGroundSessionCost, totalSpent, spentPerCertificate, spentPerFlightHour, lessonAverages,
  isPastCostCutoff, dayBefore, costCutoffNote, entriesCountedForCost,
} from './cost.js';

const base = {
  aircraft_rates: [{ certificate: 'private', aircraft_id: 1, effective_date: '2026-01-01', rental_rate_per_hr: 195, fuel_surcharge_per_hr: 15 }],
  instructor_rates: [{ certificate: 'private', effective_date: '2026-01-01', hourly_rate: 85 }],
  ground_rates: [{ certificate: 'private', effective_date: '2026-01-01', hourly_rate: 85 }],
  simulator_rates: [],
};
const phases = [{ certificate: 'private', start_date: '2026-01-01', end_date: null, track_costs: 1 }];
const CUTOFF = '2026-06-15';
const withCutoff = { ...base, cost_cutoff_date: CUTOFF };

// 1.5 h dual lesson = 1.5 x (195 + 15) + 1.5 x 85 = $442.50
const lesson = (date, extra = {}) => ({ id: date, date, aircraft_id: 1, total_time: 1.5, dual_received: 1.5, ...extra });
const before = lesson('2026-06-14');
const onDay = lesson('2026-06-15');
const after = lesson('2026-07-01');
const flights = [before, onDay, after];
const ground = [{ date: '2026-06-01', hours: 1 }, { date: '2026-06-15', hours: 1 }, { date: '2026-08-01', hours: 1 }];

test('no cutoff set: everything behaves exactly as before', () => {
  for (const rates of [base, { ...base, cost_cutoff_date: null }, { ...base, cost_cutoff_date: '' }]) {
    assert.equal(computeFlightCost(after, rates, phases).total, 442.5);
    assert.equal(totalSpent(flights, ground, [], rates, phases), 442.5 * 3 + 85 * 3);
    assert.equal(costCutoffNote(rates.cost_cutoff_date), '');
    assert.equal(entriesCountedForCost(flights, ground, rates.cost_cutoff_date).flights.length, 3);
  }
});

test('a flight before the cutoff is counted as usual', () => {
  const c = computeFlightCost(before, withCutoff, phases);
  assert.equal(c.total, 442.5);
  assert.equal(c.excluded, undefined);
});

test('the cutoff day itself is excluded, consistently (calendar day comparison)', () => {
  const c = computeFlightCost(onDay, withCutoff, phases);
  assert.equal(c.total, null);
  assert.equal(c.excluded, true);
  assert.equal(c.tracked, false);
  assert.equal(computeGroundSessionCost({ date: '2026-06-15', hours: 1 }, withCutoff, phases).total, null);
  assert.equal(isPastCostCutoff('2026-06-15', CUTOFF), true);
  assert.equal(isPastCostCutoff('2026-06-14', CUTOFF), false);
});

test('a timestamp-shaped date cannot slip across the line: only the calendar day matters', () => {
  assert.equal(isPastCostCutoff('2026-06-15T00:00:00', CUTOFF), true);
  assert.equal(isPastCostCutoff('2026-06-14T23:59:59', CUTOFF), false);
});

test('flights after the cutoff are excluded, even with a manual cost override (which stays stored, just uncounted)', () => {
  assert.equal(computeFlightCost(after, withCutoff, phases).total, null);
  const overridden = lesson('2026-07-01', { cost_override: 999 });
  assert.equal(computeFlightCost(overridden, withCutoff, phases).total, null);
  assert.equal(overridden.cost_override, 999); // the stored field is untouched
  assert.equal(computeFlightCost(overridden, base, phases).total, 999); // ...and counts again without a cutoff
});

test('totals leave out flights and ground sessions on/after the cutoff; expenses are unaffected', () => {
  const expenses = [{ date: '2026-07-10', amount: 100 }];
  assert.equal(totalSpent(flights, ground, [], withCutoff, phases), 442.5 + 85); // one flight + one ground session
  assert.equal(totalSpent(flights, ground, expenses, withCutoff, phases), 442.5 + 85 + 100);
});

test('per-certificate totals and a date range respect the cutoff too', () => {
  assert.equal(spentPerCertificate(phases, flights, ground, [], withCutoff, '2026-12-31').private, 442.5 + 85);
  assert.equal(totalSpent(flights, ground, [], withCutoff, phases, { from: '2026-06-15', to: '2026-12-31' }), 0);
});

test('cost per flight hour and averages use only the entries that count', () => {
  const counted = entriesCountedForCost(flights, ground, CUTOFF);
  assert.deepEqual(counted.flights.map((f) => f.date), ['2026-06-14']);
  assert.deepEqual(counted.groundSessions.map((g) => g.date), ['2026-06-01']);
  const total = totalSpent(flights, ground, [], withCutoff, phases);
  assert.equal(spentPerFlightHour(total, counted.flights), 351.67); // (442.5 + 85) / 1.5 h, not diluted by later flights
  assert.ok(spentPerFlightHour(total, flights) < 351.67); // what it would have been without the filter
  const longAfter = [before, lesson('2026-07-01', { total_time: 5 })];
  assert.equal(lessonAverages(entriesCountedForCost(longAfter, [], CUTOFF).flights).avgLessonLength, 1.5);
});

test('the note names the last counted day and the cutoff day', () => {
  assert.equal(dayBefore('2026-06-15'), '2026-06-14');
  assert.equal(dayBefore('2026-03-01'), '2026-02-28');
  assert.equal(dayBefore('2027-01-01'), '2026-12-31');
  assert.match(costCutoffNote(CUTOFF), /counted through 06\/14\/2026/);
  assert.match(costCutoffNote(CUTOFF), /from 06\/15\/2026 on/);
});

test('flights past the cutoff still count for everything that is not cost (their data is untouched)', () => {
  const list = [before, onDay, after];
  assert.equal(list.reduce((s, f) => s + f.total_time, 0), 4.5); // hours are never filtered by the cost cutoff
  assert.equal(list.length, 3);
});
