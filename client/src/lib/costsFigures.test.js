import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { computeCostsFigures } from './costsFigures.js';

const TODAY = '2026-10-05';
const NOW = new Date('2026-10-05T12:00:00Z');
const round2 = (n) => Math.round(n * 100) / 100;

const phases = [{ certificate: 'private', start_date: '2026-07-01', end_date: null, track_costs: 1 }];
const rates = {
  aircraft_rates: [{ certificate: 'private', aircraft_id: 1, effective_date: '2026-01-01', rental_rate_per_hr: 150, fuel_surcharge_per_hr: 20 }],
  instructor_rates: [{ certificate: 'private', effective_date: '2026-01-01', hourly_rate: 60 }],
  ground_rates: [{ certificate: 'private', effective_date: '2026-01-01', hourly_rate: 60 }],
  simulator_rates: [], cost_cutoff_date: null,
};
const milestonesConfig = [
  { certificate: 'private', requirement_key: 'total_time', sum_field: 'total_time', flight_filter: null, min_value: 40, manual: 0, sort_order: 1 },
  { certificate: 'private', requirement_key: 'dual', sum_field: 'dual_received', flight_filter: null, min_value: 20, manual: 0, sort_order: 2 },
  { certificate: 'private', requirement_key: 'solo', sum_field: 'solo_time', flight_filter: null, min_value: 10, manual: 0, sort_order: 3 },
];
const pilotFlight = (i) => ({
  id: i, role: 'pilot', date: `2026-09-${String(i).padStart(2, '0')}`, aircraft_id: 1,
  total_time: 1.5, dual_received: 1.5, solo_time: 0, ground_time: 0.3, simulator_time: 0, cost_override: null,
});
const pilot = Array.from({ length: 6 }, (_, i) => pilotFlight(i + 10)); // 6 flights, 9.00 h
const passenger = Array.from({ length: 12 }, (_, i) => ({
  id: 100 + i, role: 'passenger', date: `2026-09-${String(i + 1).padStart(2, '0')}`, aircraft_id: 1,
  total_time: 8, dual_received: 0, solo_time: 0, ground_time: 0.5, simulator_time: 0, cost_override: null,
}));
const base = {
  groundSessions: [{ id: 1, date: '2026-09-20', hours: 1, cost_override: null }],
  expenses: [{ id: 1, date: '2026-09-02', amount: 100, category: 'books' }],
  rates, phases, milestonesConfig, settings: {}, plannedCosts: [], aircraft: [{ id: 1 }], completions: [],
};
const figures = (flights) => computeCostsFigures({ ...base, flights }, 'private', TODAY, NOW);

test('adding passenger flights changes no Costs figure: cost per hour, projection, pace, finish date, totals', () => {
  assert.deepEqual(figures([...passenger, ...pilot]), figures(pilot));
  assert.deepEqual(figures([...pilot.slice(0, 3), ...passenger, ...pilot.slice(3)]), figures(pilot));
});

test('cost per flight hour divides by the pilot total only (independent sum)', () => {
  const f = figures([...passenger, ...pilot]);
  const pilotHours = round2(pilot.reduce((s, x) => s + x.total_time, 0));
  assert.equal(pilotHours, 9);
  assert.equal(f.perHour, round2(f.total / pilotHours));
  assert.equal(f.projection.breakdown.flownTotal, pilotHours);
  assert.equal(f.projection.breakdown.avgLessonLength, 1.5);
  assert.equal(f.projection.breakdown.avgGroundPerLesson, 0.3);
  assert.equal(f.projection.breakdown.targetTotalHours, 50); // the 50 h default, not raised by passenger hours
  assert.equal(f.projection.breakdown.frequency.sampleSize, 6);
});

test('passenger rows are never read by any cost, pace or milestone code', () => {
  const poisoned = passenger.map((p) => {
    const o = { role: 'passenger' };
    for (const k of Object.keys(p)) if (k !== 'role') Object.defineProperty(o, k, { get() { throw new Error(`passenger flight field "${k}" was read`); }, enumerable: true });
    return o;
  });
  assert.deepEqual(figures([...poisoned, ...pilot]), figures(pilot));
});

test('the Costs page filters at the load point and computes only through computeCostsFigures', () => {
  const src = fs.readFileSync(new URL('../pages/Costs.jsx', import.meta.url), 'utf8');
  assert.match(src, /setData\(\{ flights: pilotFlights\(flights\)/);
  assert.match(src, /computeCostsFigures\(data,/);
  for (const banned of ['computeMilestones(', 'spentPerFlightHour(', 'buildCertificateProjection(', 'recentFlyingFrequency(']) {
    assert.ok(!src.includes(banned), `Costs.jsx must not call ${banned} directly`);
  }
});
