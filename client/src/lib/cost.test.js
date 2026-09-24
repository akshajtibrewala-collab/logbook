import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickRate, findPhaseForDate, computeFlightCost, computeGroundSessionCost, totalSpent, spentPerCertificate,
  spentPerFlightHour, remainingHoursByType, lessonAverages, recentFlyingFrequency, estimateFinishDate,
  buildCertificateProjection, fmtMoney,
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

test('fmtMoney formats to two decimal places with thousands separators', () => {
  assert.equal(fmtMoney(442.5), '$442.50');
  assert.equal(fmtMoney(1234.5), '$1,234.50');
  assert.equal(fmtMoney(0), '$0.00');
});

// ---- Real numbers: 20 flights, 29.9 flight hrs, 5.9 ground hrs, $10,736.42 total spent ----

test('spentPerFlightHour: $10,736.42 over 29.9 flight hours = $359.08 (not the per-flight-cost average)', () => {
  const flights = Array.from({ length: 20 }, (_, i) => ({ total_time: i < 10 ? 1.5 : 1.49, simulator_time: 0 }));
  const hours = flights.reduce((s, f) => s + f.total_time, 0);
  assert.equal(round2(hours), 29.9);
  assert.equal(spentPerFlightHour(10736.42, flights), 359.08);
  assert.equal(spentPerFlightHour(100, []), 0);
});

const req = (key, min, current, extra = {}) => ({
  requirement_key: key, min_value: min, current, met: current != null && current >= min, manual: 0, unit: 'hours',
  sum_field: key, flight_filter: null, ...extra,
});
const dualFilter = JSON.stringify([{ field: 'cross_country_time', op: '>', value: 0 }]);
const privateReqs = [
  req('total_time', 40, 29.9),
  req('dual_received', 20, 29.9),
  req('dual_xc', 3, 0, { sum_field: 'dual_received', flight_filter: dualFilter }),
  req('dual_night', 3, 0, { sum_field: 'dual_received', flight_filter: dualFilter }),
  req('solo_time', 10, 0),
  req('solo_xc', 5, 0, { sum_field: 'solo_time', flight_filter: dualFilter }),
  { requirement_key: 'solo_xc_150nm', manual: 1, current: null, met: false, min_value: 1, unit: 'count' },
  { requirement_key: 'checkride_prep', manual: 1, current: null, met: false, min_value: 1, unit: 'count' },
];

test('remainingHoursByType: real private requirements -> 6.00h dual (3 xc/night binding + 3 checkride prep), 10.00h solo', () => {
  assert.deepEqual(remainingHoursByType(privateReqs), { dualHours: 6, soloHours: 10 });
});

test('remainingHoursByType: a total-time gap beyond dual+solo is folded into solo; completed checkride prep adds nothing', () => {
  const reqs = [req('total_time', 40, 10), req('dual_received', 20, 15), { requirement_key: 'checkride_prep', manual: 1, met: true }];
  assert.deepEqual(remainingHoursByType(reqs), { dualHours: 5, soloHours: 25 });
});

const realFlights = [
  ...Array.from({ length: 10 }, (_, i) => ({ date: `2026-08-${String(i + 1).padStart(2, '0')}`, total_time: 1.5, ground_time: 0.3 })),
  ...Array.from({ length: 10 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, total_time: 1.49, ground_time: 0.29 })),
];

test('lessonAverages: average lesson length and ground hours per lesson', () => {
  const a = lessonAverages(realFlights);
  assert.ok(Math.abs(a.avgLessonLength - 1.495) < 1e-9);
  assert.ok(Math.abs(a.avgGroundPerLesson - 0.295) < 1e-9);
  assert.deepEqual(lessonAverages([]), { avgLessonLength: 0, avgGroundPerLesson: 0 });
});

test('recentFlyingFrequency and estimateFinishDate: pace from recent flights, null with too little data', () => {
  const f = recentFlyingFrequency(realFlights, '2026-09-23');
  assert.equal(f.sampleSize, 20);
  assert.ok(f.lessonsPerWeek > 2 && f.lessonsPerWeek < 3); // 20 flights over ~7.5 weeks
  assert.equal(recentFlyingFrequency([realFlights[0]], '2026-09-23'), null);
  assert.equal(estimateFinishDate(14, 2, '2026-09-23'), '2026-11-11'); // 7 weeks out
  assert.equal(estimateFinishDate(14, 0, '2026-09-23'), null);
});

const projRates = {
  aircraftRate: { rental_rate_per_hr: 195, fuel_surcharge_per_hr: 15 },
  instructorRate: { hourly_rate: 85 },
  groundRate: { hourly_rate: 85 },
};

test('buildCertificateProjection: FAA minimum = 6h dual + 10h solo at $210 aircraft, $85 instructor, $85 ground + one-time costs', () => {
  const p = buildCertificateProjection({ requirements: privateReqs, flights: realFlights, ...projRates, oneTimeCostsTotal: 800, today: '2026-09-23' });
  const e = p.faaMinEstimate;
  assert.equal(e.dualHours, 6);
  assert.equal(e.soloHours, 10);
  assert.equal(e.aircraftCost, 3360); // 16h x $210
  assert.equal(e.instructorCost, 510); // 6h x $85
  assert.equal(e.lessons, round2(16 / 1.495)); // 10.70 lessons at the average lesson length
  assert.equal(e.groundHours, round2((16 / 1.495) * 0.295)); // 3.16h at avg 0.295 ground/lesson
  assert.equal(e.groundCost, round2((16 / 1.495) * 0.295 * 85));
  assert.equal(e.oneTimeCosts, 800);
  assert.equal(e.cost, round2(3360 + 510 + (16 / 1.495) * 0.295 * 85 + 800));
});

test('buildCertificateProjection: realistic estimate pads to the 50h default target with extra hours costed as solo', () => {
  const p = buildCertificateProjection({ requirements: privateReqs, flights: realFlights, ...projRates, today: '2026-09-23' });
  const e = p.realisticEstimate;
  assert.equal(e.dualHours, 6);
  assert.equal(e.soloHours, 14.1); // 10 + (50 - 29.9 - 16)
  assert.equal(e.aircraftCost, round2(20.1 * 210));
  assert.equal(p.breakdown.targetTotalHours, 50);
  assert.equal(p.breakdown.targetRaised, false);
  assert.ok(p.finishDate > '2026-09-23');
});

test('buildCertificateProjection: already past the target without finishing raises the target instead of $0 remaining', () => {
  const p = buildCertificateProjection({ requirements: privateReqs, flights: realFlights, ...projRates, targetTotalHours: 25, today: '2026-09-23' });
  assert.equal(p.breakdown.targetRaised, true);
  assert.equal(p.breakdown.targetTotalHours, 45.9); // flown 29.9 + 16 remaining minimum
  assert.equal(p.realisticEstimate.cost, p.faaMinEstimate.cost);
  assert.ok(p.realisticEstimate.cost > 0);
});
