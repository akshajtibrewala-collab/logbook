import test from 'node:test';
import assert from 'node:assert/strict';
import { aircraftRows, aircraftLabel, aircraftTitle } from './aircraftList.js';

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
