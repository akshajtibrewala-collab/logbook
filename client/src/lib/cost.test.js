import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickRate, findPhaseForDate, computeFlightCost, computeGroundSessionCost, totalSpent, spentPerCertificate,
  averageCostPerFlightHour, projectRemainingCost, fmtMoney,
} from './cost.js';

const round2 = (n) => Math.round(n * 100) / 100;

const rates = {
  aircraft_rates: [{ certificate: 'private', aircraft_id: 1, effective_date: '2026-01-01', rental_rate_per_hr: 195, fuel_surcharge_per_hr: 15 }],
  instructor_rates: [{ certificate: 'private', effective_date: '2026-01-01', hourly_rate: 85 }],
  ground_rates: [{ certificate: 'private', effective_date: '2026-01-01', hourly_rate: 85 }],
  simulator_rates: [],
};
const privatePhase = { certificate: 'private', start_date: '2026-01-01', end_date: null, track_costs: 1 };
const phases = [privatePhase];

test('pickRate: latest effective row at or before the date, ignores future rows', () => {
  const r = [
    { effective_date: '2026-01-01', hourly_rate: 85 },
    { effective_date: '2026-06-01', hourly_rate: 95 },
  ];
  assert.equal(pickRate(r, '2026-03-01').hourly_rate, 85);
  assert.equal(pickRate(r, '2026-06-01').hourly_rate, 95);
  assert.equal(pickRate(r, '2025-12-31'), null);
});

test('findPhaseForDate: matches the phase whose range contains the date; open end_date covers everything after start', () => {
  const twoPhases = [
    { certificate: 'private', start_date: '2026-01-01', end_date: '2026-06-30' },
    { certificate: 'instrument', start_date: '2026-07-01', end_date: null },
  ];
  assert.equal(findPhaseForDate(twoPhases, '2026-03-01').certificate, 'private');
  assert.equal(findPhaseForDate(twoPhases, '2026-09-01').certificate, 'instrument');
  assert.equal(findPhaseForDate(twoPhases, '2025-01-01'), null);
});

test('1.5 hr dual lesson = $442.50 (per the plan\'s worked example)', () => {
  const flight = { date: '2026-05-01', aircraft_id: 1, total_time: 1.5, dual_received: 1.5, solo_time: 0, simulator_time: 0, ground_time: 0, cost_override: null };
  const c = computeFlightCost(flight, rates, phases);
  assert.equal(c.total, 442.5);
  assert.equal(c.tracked, true);
  assert.equal(c.override, false);
});

test('1.5 hr solo flight = $315 (no instructor charge without dual received)', () => {
  const flight = { date: '2026-05-01', aircraft_id: 1, total_time: 1.5, dual_received: 0, solo_time: 1.5, simulator_time: 0, ground_time: 0, cost_override: null };
  const c = computeFlightCost(flight, rates, phases);
  assert.equal(c.total, 315);
});

test('1.5 hr dual lesson with 0.5 hr ground = $485.00', () => {
  const flight = { date: '2026-05-01', aircraft_id: 1, total_time: 1.5, dual_received: 1.5, solo_time: 0, simulator_time: 0, ground_time: 0.5, cost_override: null };
  const c = computeFlightCost(flight, rates, phases);
  assert.equal(c.total, 485);
  assert.equal(c.breakdown.groundCost, 42.5);
});

test('a flight outside any cost-tracked phase gets total: null, not 0, and is not "tracked"', () => {
  const flight = { date: '2025-01-01', aircraft_id: 1, total_time: 1.5, dual_received: 1.5, solo_time: 0, simulator_time: 0, ground_time: 0, cost_override: null };
  const c = computeFlightCost(flight, rates, phases);
  assert.equal(c.total, null);
  assert.equal(c.tracked, false);
});

test('a flight whose phase has track_costs off also gets total: null', () => {
  const untracked = [{ ...privatePhase, track_costs: 0 }];
  const flight = { date: '2026-05-01', aircraft_id: 1, total_time: 1.5, dual_received: 1.5, solo_time: 0, simulator_time: 0, ground_time: 0, cost_override: null };
  const c = computeFlightCost(flight, rates, untracked);
  assert.equal(c.total, null);
});

test('cost_override applies even outside a tracked phase, and always applies inside one', () => {
  const flight = { date: '2025-01-01', aircraft_id: 1, total_time: 1.5, dual_received: 1.5, solo_time: 0, simulator_time: 0, ground_time: 0, cost_override: 400 };
  const outside = computeFlightCost(flight, rates, phases);
  assert.equal(outside.total, 400);
  assert.equal(outside.tracked, true); // an override always "shows", even though the flight itself isn't in a tracked phase
  assert.equal(outside.computedTotal, null); // no phase to compute a breakdown from

  const inside = computeFlightCost({ ...flight, date: '2026-05-01' }, rates, phases);
  assert.equal(inside.total, 400);
  assert.equal(inside.computedTotal, 442.5); // still computed, for "calculated was $442.50" display
});

test('a rate from a different certificate never applies, even if effective-dated earlier', () => {
  const mixedRates = {
    ...rates,
    instructor_rates: [...rates.instructor_rates, { certificate: 'instrument', effective_date: '2025-01-01', hourly_rate: 1 }],
  };
  const flight = { date: '2026-05-01', aircraft_id: 1, total_time: 1.5, dual_received: 1.5, solo_time: 0, simulator_time: 0, ground_time: 0, cost_override: null };
  const c = computeFlightCost(flight, mixedRates, phases); // date falls in the 'private' phase
  assert.equal(c.total, 442.5); // uses the private $85/hr rate, not instrument's stray $1/hr row
});

test('simulator time is billed at the simulator rate, not the aircraft rate', () => {
  const withSimRate = { ...rates, simulator_rates: [{ certificate: 'private', effective_date: '2026-01-01', hourly_rate: 50 }] };
  const flight = { date: '2026-05-01', aircraft_id: null, total_time: 0, dual_received: 0, solo_time: 0, simulator_time: 2, ground_time: 0, cost_override: null };
  const c = computeFlightCost(flight, withSimRate, phases);
  assert.equal(c.total, 100);
  assert.equal(c.missingRate, false);

  const noSimRate = computeFlightCost(flight, rates, phases); // simulator_rates is blank in the shared fixture
  assert.equal(noSimRate.total, 0);
  assert.equal(noSimRate.missingRate, true);
});

test('a flight on an aircraft with no rate yet flags missingRate instead of silently costing $0', () => {
  const flight = { date: '2026-05-01', aircraft_id: 99, total_time: 1, dual_received: 0, solo_time: 1, simulator_time: 0, ground_time: 0, cost_override: null };
  const c = computeFlightCost(flight, rates, phases);
  assert.equal(c.missingRate, true);
  assert.equal(c.total, 0);
});

test('ground-only session cost uses the ground rate in effect on its own date, within the phase covering it', () => {
  const c = computeGroundSessionCost({ date: '2026-05-01', hours: 1 }, rates, phases);
  assert.equal(c.total, 85);
});

test('ground session outside a tracked phase gets total: null unless overridden', () => {
  const untracked = computeGroundSessionCost({ date: '2025-01-01', hours: 1 }, rates, phases);
  assert.equal(untracked.total, null);
  const overridden = computeGroundSessionCost({ date: '2025-01-01', hours: 1, cost_override: 88.5 }, rates, phases);
  assert.equal(overridden.total, 88.5);
});

test('totalSpent sums flights, ground sessions and expenses within an optional date range, skipping untracked entries', () => {
  const flights = [
    { date: '2026-01-10', aircraft_id: 1, total_time: 1.5, dual_received: 1.5, solo_time: 0, simulator_time: 0, ground_time: 0, cost_override: null },
    { date: '2026-06-10', aircraft_id: 1, total_time: 1.5, dual_received: 0, solo_time: 1.5, simulator_time: 0, ground_time: 0, cost_override: null },
    { date: '2025-01-01', aircraft_id: 1, total_time: 1.5, dual_received: 0, solo_time: 1.5, simulator_time: 0, ground_time: 0, cost_override: null }, // outside any phase
  ];
  const groundSessions = [{ date: '2026-01-15', hours: 1 }];
  const expenses = [{ date: '2026-01-20', amount: 50 }];

  assert.equal(totalSpent(flights, groundSessions, expenses, rates, phases), 442.5 + 315 + 85 + 50);
  assert.equal(totalSpent(flights, groundSessions, expenses, rates, phases, { to: '2026-02-01' }), 442.5 + 85 + 50);
});

test('spentPerCertificate splits by each certificate\'s training-phase date range, not by which milestones a flight satisfies', () => {
  const flights = [
    { date: '2026-01-10', aircraft_id: 1, total_time: 1.5, dual_received: 1.5, solo_time: 0, simulator_time: 0, ground_time: 0, cost_override: null },
    { date: '2027-01-10', aircraft_id: 1, total_time: 1.5, dual_received: 0, solo_time: 1.5, simulator_time: 0, ground_time: 0, cost_override: null },
  ];
  const twoPhases = [
    { certificate: 'private', start_date: '2026-01-01', end_date: '2026-12-31', track_costs: 1 },
    { certificate: 'instrument', start_date: '2027-01-01', end_date: null, track_costs: 1 },
  ];
  const twoPhaseRates = {
    aircraft_rates: [
      { certificate: 'private', aircraft_id: 1, effective_date: '2026-01-01', rental_rate_per_hr: 195, fuel_surcharge_per_hr: 15 },
      { certificate: 'instrument', aircraft_id: 1, effective_date: '2027-01-01', rental_rate_per_hr: 195, fuel_surcharge_per_hr: 15 },
    ],
    instructor_rates: [
      { certificate: 'private', effective_date: '2026-01-01', hourly_rate: 85 },
      { certificate: 'instrument', effective_date: '2027-01-01', hourly_rate: 85 },
    ],
    ground_rates: [], simulator_rates: [],
  };
  const spent = spentPerCertificate(twoPhases, flights, [], [], twoPhaseRates, '2027-06-01');
  assert.equal(spent.private, 442.5);
  assert.equal(spent.instrument, 315);
});

test('averageCostPerFlightHour divides total cost by aircraft + simulator hours, over tracked flights only', () => {
  const flights = [
    { date: '2026-01-10', aircraft_id: 1, total_time: 1.5, dual_received: 1.5, solo_time: 0, simulator_time: 0, ground_time: 0, cost_override: null },
    { date: '2026-01-11', aircraft_id: 1, total_time: 1.5, dual_received: 0, solo_time: 1.5, simulator_time: 0, ground_time: 0, cost_override: null },
    { date: '2025-01-01', aircraft_id: 1, total_time: 10, dual_received: 0, solo_time: 10, simulator_time: 0, ground_time: 0, cost_override: null }, // untracked, excluded from both sides of the ratio
  ];
  assert.equal(averageCostPerFlightHour(flights, rates, phases), round2((442.5 + 315) / 3));
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
