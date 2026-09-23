import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickRate, computeFlightCost, computeGroundSessionCost, totalSpent, spentPerCertificate,
  averageCostPerFlightHour, projectRemainingCost, fmtMoney,
} from './cost.js';

const round2 = (n) => Math.round(n * 100) / 100;

const rates = {
  aircraft_rates: [{ aircraft_id: 1, effective_date: '2026-01-01', rental_rate_per_hr: 195, fuel_surcharge_per_hr: 15 }],
  instructor_rates: [{ effective_date: '2026-01-01', hourly_rate: 85 }],
  ground_rates: [{ effective_date: '2026-01-01', hourly_rate: 85 }],
  simulator_rates: [],
};

test('pickRate: latest effective row at or before the date, ignores future rows', () => {
  const r = [
    { effective_date: '2026-01-01', hourly_rate: 85 },
    { effective_date: '2026-06-01', hourly_rate: 95 },
  ];
  assert.equal(pickRate(r, '2026-03-01').hourly_rate, 85);
  assert.equal(pickRate(r, '2026-06-01').hourly_rate, 95);
  assert.equal(pickRate(r, '2025-12-31'), null);
});

test('1.5 hr dual lesson = $442.50 (per the plan\'s worked example)', () => {
  const flight = { date: '2026-05-01', aircraft_id: 1, total_time: 1.5, dual_received: 1.5, solo_time: 0, simulator_time: 0, ground_time: 0, cost_override: null };
  const c = computeFlightCost(flight, rates);
  assert.equal(c.total, 442.5);
  assert.equal(c.override, false);
});

test('1.5 hr solo flight = $315 (no instructor charge without dual received)', () => {
  const flight = { date: '2026-05-01', aircraft_id: 1, total_time: 1.5, dual_received: 0, solo_time: 1.5, simulator_time: 0, ground_time: 0, cost_override: null };
  const c = computeFlightCost(flight, rates);
  assert.equal(c.total, 315);
});

test('1.5 hr dual lesson with 0.5 hr ground = $485.00', () => {
  const flight = { date: '2026-05-01', aircraft_id: 1, total_time: 1.5, dual_received: 1.5, solo_time: 0, simulator_time: 0, ground_time: 0.5, cost_override: null };
  const c = computeFlightCost(flight, rates);
  assert.equal(c.total, 485);
  assert.equal(c.breakdown.groundCost, 42.5);
});

test('cost_override replaces the total but the computed breakdown is still available', () => {
  const flight = { date: '2026-05-01', aircraft_id: 1, total_time: 1.5, dual_received: 1.5, solo_time: 0, simulator_time: 0, ground_time: 0, cost_override: 400 };
  const c = computeFlightCost(flight, rates);
  assert.equal(c.total, 400);
  assert.equal(c.override, true);
  assert.equal(c.computedTotal, 442.5);
});

test('simulator time is billed at the simulator rate, not the aircraft rate', () => {
  const withSimRate = { ...rates, simulator_rates: [{ effective_date: '2026-01-01', hourly_rate: 50 }] };
  const flight = { date: '2026-05-01', aircraft_id: null, total_time: 0, dual_received: 0, solo_time: 0, simulator_time: 2, ground_time: 0, cost_override: null };
  const c = computeFlightCost(flight, withSimRate);
  assert.equal(c.total, 100);
  assert.equal(c.missingRate, false);

  const noSimRate = computeFlightCost(flight, rates); // simulator_rates is blank in the shared fixture
  assert.equal(noSimRate.total, 0);
  assert.equal(noSimRate.missingRate, true);
});

test('a flight on an aircraft with no rate yet flags missingRate instead of silently costing $0', () => {
  const flight = { date: '2026-05-01', aircraft_id: 99, total_time: 1, dual_received: 0, solo_time: 1, simulator_time: 0, ground_time: 0, cost_override: null };
  const c = computeFlightCost(flight, rates);
  assert.equal(c.missingRate, true);
  assert.equal(c.total, 0);
});

test('ground-only session cost uses the ground rate in effect on its own date', () => {
  const c = computeGroundSessionCost({ date: '2026-05-01', hours: 1 }, rates.ground_rates);
  assert.equal(c.total, 85);
});

test('totalSpent sums flights, ground sessions and expenses within an optional date range', () => {
  const flights = [
    { date: '2026-01-10', aircraft_id: 1, total_time: 1.5, dual_received: 1.5, solo_time: 0, simulator_time: 0, ground_time: 0, cost_override: null },
    { date: '2026-06-10', aircraft_id: 1, total_time: 1.5, dual_received: 0, solo_time: 1.5, simulator_time: 0, ground_time: 0, cost_override: null },
  ];
  const groundSessions = [{ date: '2026-01-15', hours: 1 }];
  const expenses = [{ date: '2026-01-20', amount: 50 }];

  assert.equal(totalSpent(flights, groundSessions, expenses, rates), 442.5 + 315 + 85 + 50);
  assert.equal(totalSpent(flights, groundSessions, expenses, rates, { to: '2026-02-01' }), 442.5 + 85 + 50);
});

test('spentPerCertificate splits by each certificate\'s training-phase date range, not by which milestones a flight satisfies', () => {
  const flights = [
    { date: '2026-01-10', aircraft_id: 1, total_time: 1.5, dual_received: 1.5, solo_time: 0, simulator_time: 0, ground_time: 0, cost_override: null },
    { date: '2027-01-10', aircraft_id: 1, total_time: 1.5, dual_received: 0, solo_time: 1.5, simulator_time: 0, ground_time: 0, cost_override: null },
  ];
  const phases = [
    { certificate: 'private', start_date: '2026-01-01', end_date: '2026-12-31' },
    { certificate: 'instrument', start_date: '2027-01-01', end_date: null },
  ];
  const spent = spentPerCertificate(phases, flights, [], [], rates, '2027-06-01');
  assert.equal(spent.private, 442.5);
  assert.equal(spent.instrument, 315);
});

test('averageCostPerFlightHour divides total cost by aircraft + simulator hours', () => {
  const flights = [
    { date: '2026-01-10', aircraft_id: 1, total_time: 1.5, dual_received: 1.5, solo_time: 0, simulator_time: 0, ground_time: 0, cost_override: null },
    { date: '2026-01-11', aircraft_id: 1, total_time: 1.5, dual_received: 0, solo_time: 1.5, simulator_time: 0, ground_time: 0, cost_override: null },
  ];
  assert.equal(averageCostPerFlightHour(flights, rates), round2((442.5 + 315) / 3));
});

test('projectRemainingCost: FAA-minimum estimate uses remaining dual/solo hours at current rates', () => {
  const { faaMinEstimate } = projectRemainingCost({
    faaMinDualHours: 20, faaMinSoloHours: 10, flownDualHours: 15, flownSoloHours: 5, flownTotalHours: 20,
    realisticTotalHours: 20, // irrelevant to this assertion
    currentAircraftRate: { rental_rate_per_hr: 195, fuel_surcharge_per_hr: 15 },
    currentInstructorRate: { hourly_rate: 85 },
  });
  assert.equal(faaMinEstimate.dualHours, 5);
  assert.equal(faaMinEstimate.soloHours, 5);
  assert.equal(faaMinEstimate.cost, round2(5 * (195 + 15 + 85) + 5 * (195 + 15)));
});

test('projectRemainingCost: realistic estimate beyond the FAA minimum assumes the extra hours are solo', () => {
  const { realisticEstimate } = projectRemainingCost({
    faaMinDualHours: 20, faaMinSoloHours: 10, flownDualHours: 20, flownSoloHours: 10, flownTotalHours: 40,
    realisticTotalHours: 65,
    currentAircraftRate: { rental_rate_per_hr: 195, fuel_surcharge_per_hr: 15 },
    currentInstructorRate: { hourly_rate: 85 },
  });
  assert.equal(realisticEstimate.dualHours, 0); // FAA-min dual already fully flown
  assert.equal(realisticEstimate.soloHours, 25); // all 25 remaining hours (65 - 40) assumed solo
  assert.equal(realisticEstimate.cost, round2(25 * (195 + 15)));
});

test('projectRemainingCost: realistic total at or under the FAA-min remaining total scales both proportionally', () => {
  const { realisticEstimate, faaMinEstimate } = projectRemainingCost({
    faaMinDualHours: 20, faaMinSoloHours: 10, flownDualHours: 0, flownSoloHours: 0, flownTotalHours: 0,
    realisticTotalHours: 15, // half of the 30hr FAA-min remaining total
    currentAircraftRate: { rental_rate_per_hr: 195, fuel_surcharge_per_hr: 15 },
    currentInstructorRate: { hourly_rate: 85 },
  });
  assert.equal(faaMinEstimate.dualHours, 20);
  assert.equal(faaMinEstimate.soloHours, 10);
  assert.equal(realisticEstimate.dualHours, 10); // half of 20
  assert.equal(realisticEstimate.soloHours, 5); // half of 10
});

test('fmtMoney formats to two decimal places with thousands separators', () => {
  assert.equal(fmtMoney(442.5), '$442.50');
  assert.equal(fmtMoney(1234.5), '$1,234.50');
  assert.equal(fmtMoney(0), '$0.00');
});
