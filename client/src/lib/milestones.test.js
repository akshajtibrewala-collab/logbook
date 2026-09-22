import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesFilter, computeRequirement, computeMilestones, certificateLabel } from './milestones.js';

const flight = (o) => ({ total_time: 0, pic_time: 0, dual_received: 0, solo_time: 0, cross_country_time: 0, night_time: 0, aircraft_id: null, ...o });

test('a plain sum requirement with no filter totals the field across every flight', () => {
  const req = { sum_field: 'total_time', flight_filter: null, min_value: 40, manual: false };
  const flights = [flight({ total_time: 15 }), flight({ total_time: 10.5 })];
  const r = computeRequirement(req, flights);
  assert.equal(r.current, 25.5);
  assert.equal(r.met, false);
  assert.ok(Math.abs(r.percent - 63.75) < 0.01);
});

test('sum_field can list several columns summed together (e.g. actual + simulated instrument)', () => {
  const req = { sum_field: 'instrument_actual,instrument_simulated', flight_filter: null, min_value: 40, manual: false };
  const flights = [flight({ instrument_actual: 1.2, instrument_simulated: 0.5 }), flight({ instrument_actual: 0, instrument_simulated: 2 })];
  assert.equal(computeRequirement(req, flights).current, 3.7);
});

test('a flight-field filter clause restricts which flights count', () => {
  const req = { sum_field: 'dual_received', flight_filter: JSON.stringify([{ field: 'cross_country_time', op: '>', value: 0 }]), min_value: 3, manual: false };
  const flights = [flight({ dual_received: 1.5, cross_country_time: 1.5 }), flight({ dual_received: 2, cross_country_time: 0 })];
  assert.equal(computeRequirement(req, flights).current, 1.5); // only the XC flight's dual counts
});

test('the OR-across-aircraft-flags mechanism: any one of the listed flags qualifies, purely from config', () => {
  const clauses = [{ aircraft_flags: ['is_complex', 'is_turbine', 'is_taa'] }];
  const aircraftById = {
    1: { is_complex: 1, is_turbine: 0, is_taa: 0 },
    2: { is_complex: 0, is_turbine: 0, is_taa: 1 },
    3: { is_complex: 0, is_turbine: 0, is_taa: 0 },
  };
  assert.equal(matchesFilter(flight({ aircraft_id: 1 }), clauses, aircraftById), true); // complex only
  assert.equal(matchesFilter(flight({ aircraft_id: 2 }), clauses, aircraftById), true); // TAA only
  assert.equal(matchesFilter(flight({ aircraft_id: 3 }), clauses, aircraftById), false); // none of the three
  assert.equal(matchesFilter(flight({ aircraft_id: null }), clauses, aircraftById), false); // no aircraft linked
  assert.equal(matchesFilter(flight({ aircraft_id: 999 }), clauses, aircraftById), false); // unknown aircraft id

  // Swapping which flags are OR'd is a pure config change — the same code, a different clause, a
  // different qualifying set. This is the requirement: the OR-set lives in data, not in this file.
  const differentGate = [{ aircraft_flags: ['is_tailwheel'] }];
  assert.equal(matchesFilter(flight({ aircraft_id: 1 }), differentGate, { 1: { is_tailwheel: 1 } }), true);
});

test('the seeded commercial complex/turbine/TAA requirement end-to-end, via the real filter JSON shape', () => {
  const req = {
    certificate: 'commercial', requirement_key: 'complex_turbine_taa', sum_field: 'dual_received',
    flight_filter: JSON.stringify([{ aircraft_flags: ['is_complex', 'is_turbine', 'is_taa'] }]),
    min_value: 10, manual: false,
  };
  const aircraftById = { 5: { is_complex: 0, is_turbine: 1, is_taa: 0 }, 6: { is_complex: 0, is_turbine: 0, is_taa: 0 } };
  const flights = [
    flight({ aircraft_id: 5, dual_received: 6 }), // turbine — counts
    flight({ aircraft_id: 6, dual_received: 4 }), // plain — does not count
  ];
  const r = computeRequirement(req, flights, aircraftById);
  assert.equal(r.current, 6);
  assert.equal(r.met, false);
});

test('manual requirements have no computable progress', () => {
  const r = computeRequirement({ manual: true, min_value: 1 }, [flight({ total_time: 999 })]);
  assert.equal(r.current, null);
  assert.equal(r.met, null);
  assert.equal(r.percent, null);
});

test('computeMilestones groups by certificate in config order', () => {
  const config = [
    { certificate: 'private', sort_order: 1, sum_field: 'total_time', flight_filter: null, min_value: 40, manual: false },
    { certificate: 'commercial', sort_order: 1, sum_field: 'total_time', flight_filter: null, min_value: 250, manual: false },
    { certificate: 'private', sort_order: 2, sum_field: 'solo_time', flight_filter: null, min_value: 10, manual: false },
  ];
  const grouped = computeMilestones(config, [flight({ total_time: 5, solo_time: 2 })]);
  assert.deepEqual([...grouped.keys()], ['private', 'commercial']);
  assert.equal(grouped.get('private').length, 2);
  assert.equal(grouped.get('private')[0].current, 5);
});

test('certificateLabel gives a readable name, falling back to the raw key for anything unlisted', () => {
  assert.equal(certificateLabel('private'), 'Private Pilot');
  assert.equal(certificateLabel('seaplane'), 'seaplane');
});
