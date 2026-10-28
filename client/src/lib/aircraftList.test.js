import test from 'node:test';
import assert from 'node:assert/strict';
import { aircraftRows, aircraftLabel, aircraftTitle, pilotPickerAircraft } from './aircraftList.js';

const ac = [{ id: 1, tail_number: 'N1', make: 'Cessna', model: '172S' }, { id: 2, tail_number: 'N801XX', make: 'Boeing', model: '737-800 (B738)' }, { id: 3, model: 'Redbird', is_simulator: 1, simulator_device_type: 'AATD' }, { id: 4, tail_number: 'N9' }];
const fl = [
  { aircraft_id: 1, role: 'pilot', total_time: 1.25 }, { aircraft_id: 1, role: 'pilot', total_time: 0.5 }, { aircraft_id: 1, role: 'passenger', total_time: 9 },
  { aircraft_id: 2, role: 'passenger', total_time: 3.1 },
];
test('each aircraft row carries one role and its hours; passenger-only airliners are violet and never counted as flown', () => {
  const all = aircraftRows(ac, fl);
  assert.deepEqual(all.map((r) => [r.title, r.role, r.hours]), [['N1', 'pilot', 1.75], ['N801XX', 'passenger', 3.1], ['Redbird', null, null], ['N9', null, null]]);
  assert.deepEqual(aircraftRows(ac, fl, 'pilot').map((r) => r.id), [1]);
  assert.deepEqual(aircraftRows(ac, fl, 'passenger').map((r) => r.id), [2]);
  assert.equal(aircraftTitle(ac[2]), 'Redbird');
  assert.deepEqual(all.map((r) => r.sub), ['172S', 'B738', 'AATD', '']);
  const f2 = (n) => n.toFixed(2);
  assert.equal(aircraftLabel(all[0], f2), 'N1, Cessna 172S, 1.75 hours as pilot');
  assert.equal(aircraftLabel(all[3], f2), 'N9, not flown yet');
});

test('the pilot picker lists aircraft flown as pilot or never flown, drops passenger-only ones, and always keeps the selected aircraft', () => {
  const ids = (list) => list.map((a) => a.id);
  assert.deepEqual(ids(pilotPickerAircraft(ac, fl)), [1, 3, 4], 'N1 (pilot), the simulator and N9 (no flights yet) stay; the passenger-only airliner goes');
  assert.deepEqual(ids(pilotPickerAircraft(ac, fl, 2)), [1, 2, 3, 4], 'editing a flight on an airliner still shows it');
  assert.deepEqual(ids(pilotPickerAircraft(ac, [])), [1, 2, 3, 4], 'with no flights at all everything is new');
  assert.deepEqual(ids(pilotPickerAircraft(ac, [...fl, { aircraft_id: 4, role: 'passenger', total_time: 1 }])), [1, 3], 'an aircraft that has only passenger flights is out, even if it was added by hand');
  assert.deepEqual(ids(pilotPickerAircraft(null, fl)), []);
  // "Show all aircraft" is the unfiltered list: the filter only ever removes rows, so nothing is lost behind it.
  assert.ok(pilotPickerAircraft(ac, fl).length < ac.length);
});

test('the filtered pilot list, ordered recent-first, never lets a recently used passenger-only aircraft come first (Quick log chips and default)', async () => {
  const { sortByRecency } = await import('./recents.js');
  const ordered = sortByRecency(pilotPickerAircraft(ac, fl), [2, 4, 1]); // 2 = the airliner, flown only as a passenger, was picked most recently
  assert.deepEqual(ordered.map((a) => a.id), [4, 1, 3]);
});
