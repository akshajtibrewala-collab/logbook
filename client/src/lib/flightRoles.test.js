import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLIGHT_ROLES, roleOf, isPilotFlight, pilotFlights } from './flightRoles.js';

test('roleOf/isPilotFlight: a missing role (old data, before this feature) is treated as pilot', () => {
  assert.equal(roleOf({}), 'pilot');
  assert.equal(roleOf({ role: 'passenger' }), 'passenger');
  assert.ok(isPilotFlight({}));
  assert.ok(isPilotFlight({ role: 'pilot' }));
  assert.ok(!isPilotFlight({ role: 'passenger' }));
});

test('pilotFlights: keeps pilot (and role-less) flights, drops passenger', () => {
  const flights = [
    { id: 1, role: 'pilot' }, { id: 2, role: 'passenger' }, { id: 3 },
  ];
  assert.deepEqual(pilotFlights(flights).map((f) => f.id), [1, 3]);
  assert.deepEqual(pilotFlights([]), []);
  assert.deepEqual(pilotFlights(undefined), []);
});

test('FLIGHT_ROLES lists exactly pilot/passenger, in that order, each with a label', () => {
  assert.deepEqual(FLIGHT_ROLES.map((r) => r.value), ['pilot', 'passenger']);
  assert.ok(FLIGHT_ROLES.every((r) => typeof r.label === 'string' && r.label.length > 0));
});
