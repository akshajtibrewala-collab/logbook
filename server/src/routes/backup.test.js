import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
process.env.APP_PASSCODE = 'test-passcode';
const { app } = await import('../app.js');
const { migrate } = await import('../migrate.js');
let server;
let base;

before(async () => {
  await migrate();
  await new Promise((resolve) => {
    server = app.listen(0, () => { base = `http://localhost:${server.address().port}/api`; resolve(); });
  });
});
after(() => server.close());

const call = (method, path, body) =>
  fetch(base + path, { method, headers: { 'content-type': 'application/json', 'x-app-passcode': 'test-passcode' }, body: body && JSON.stringify(body) });

test('export shape: format_version, exported_at, and every table present, even when empty', async () => {
  const res = await call('GET', '/backup/export');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.format_version, 1);
  assert.ok(body.exported_at);
  for (const t of [
    'aircraft', 'flights', 'flight_stops', 'flight_approaches', 'flight_reviews', 'expirations',
    'milestone_completions', 'pilot_settings', 'aircraft_rates', 'instructor_rates', 'ground_rates',
    'simulator_rates', 'other_expenses', 'ground_sessions', 'training_phases', 'planned_costs',
  ]) {
    assert.ok(Array.isArray(body.tables[t]), `${t} should be an array`);
  }
});

test('restore refuses when flights already exist, unless mode: replace', async () => {
  await call('POST', '/flights', { date: '2026-01-01', total_time: 1 });
  const backup = await (await call('GET', '/backup/export')).json();

  const blocked = await call('POST', '/backup/restore', { ...backup });
  assert.equal(blocked.status, 409);

  const ok = await call('POST', '/backup/restore', { ...backup, mode: 'replace' });
  assert.equal(ok.status, 200);
});

test('round trip: export -> restore into an empty database -> export again matches exactly', async () => {
  // Build a database with something in every table, all linked correctly.
  const aircraft = await (await call('POST', '/aircraft', { tail_number: 'N123AB', model: '172S', is_complex: true })).json();
  const flight = await (await call('POST', '/flights', {
    date: '2026-05-01', departure_airport: 'KPAO', arrival_airport: 'KSQL', total_time: 1.5, pic_time: 1.5,
    aircraft_id: aircraft.id, flight_number: 'N123', dual_given: 0.2, day_landings: 2, day_landings_full_stop: 1,
    debrief_went_well: 'Smooth', debrief_work_on: 'Radio calls',
    stops: [{ airport_code: 'KHAF', stop_type: 'touch_and_go' }],
    approach_types: [{ approach_type: 'ILS', count: 1 }],
  })).json();
  await call('POST', '/reviews', { date: '2026-05-01' });
  await call('POST', '/expirations', { kind: 'medical', label: '3rd Class', expires_date: '2027-01-01' });
  await call('PUT', '/milestone-completions/private/solo_xc_150nm', { completed_at: '2026-04-01', note: 'KPAO-KSNS-KWVI-KPAO' });
  await call('PUT', '/settings', { home_airport_ident: 'KPAO', min_ceiling_ft: 1000, max_crosswind_kt: 10 });
  await call('POST', '/costs/rates/aircraft', { certificate: 'private', aircraft_id: aircraft.id, effective_date: '2026-01-01', rental_rate_per_hr: 195, fuel_surcharge_per_hr: 15 });
  await call('POST', '/costs/rates/instructor', { certificate: 'private', effective_date: '2026-01-01', hourly_rate: 85 });
  await call('POST', '/costs/rates/ground', { certificate: 'private', effective_date: '2026-01-01', hourly_rate: 85 });
  await call('POST', '/costs/rates/simulator', { certificate: 'private', effective_date: '2026-01-01', hourly_rate: 50 });
  await call('POST', '/costs/expenses', { category: 'headset', date: '2026-05-01', amount: 899, note: 'Bose A20' });
  await call('POST', '/costs/ground-sessions', { date: '2026-05-01', hours: 1, instructor: 'Jane', topics: 'Weather' });
  await call('PUT', '/costs/phases/private', { start_date: '2026-01-01', end_date: null });
  await call('POST', '/costs/planned-costs', { certificate: 'private', label: 'Checkride examiner fee', amount: 700 });

  const before = await (await call('GET', '/backup/export')).json();
  assert.equal(before.tables.flights.length, 2); // the one from the previous test plus this one
  assert.equal(before.tables.flight_stops.length, 1);
  assert.equal(before.tables.flight_approaches.length, 1);
  assert.equal(before.tables.aircraft.length, 1);
  assert.equal(before.tables.flight_reviews.length, 1);
  assert.equal(before.tables.expirations.length, 1);
  assert.equal(before.tables.milestone_completions.length, 1);
  assert.equal(before.tables.pilot_settings.length, 1);
  assert.equal(before.tables.pilot_settings[0].home_airport_ident, 'KPAO');
  assert.equal(before.tables.aircraft_rates.length, 1);
  // Migration 013 itself already seeded one instructor_rates and one ground_rates row (effective today,
  // since this test database had no flights at migration time) — the POSTs above add a second of each.
  assert.equal(before.tables.instructor_rates.length, 2);
  assert.equal(before.tables.ground_rates.length, 2);
  assert.equal(before.tables.simulator_rates.length, 1);
  assert.equal(before.tables.other_expenses.length, 1);
  assert.equal(before.tables.ground_sessions.length, 1);
  assert.equal(before.tables.training_phases.length, 1);
  assert.equal(before.tables.planned_costs.length, 1);

  const restore = await call('POST', '/backup/restore', { ...before, mode: 'replace' });
  assert.equal(restore.status, 200);
  const { restored } = await restore.json();
  assert.equal(restored.flights, 2);

  const after = await (await call('GET', '/backup/export')).json();
  assert.deepEqual(after.tables, before.tables); // byte-for-byte identical, ids included

  // And the relational links actually still resolve, not just the raw counts.
  const restoredFlight = after.tables.flights.find((f) => f.id === flight.id);
  assert.equal(restoredFlight.aircraft_id, aircraft.id);
  assert.equal(after.tables.flight_stops[after.tables.flight_stops.length - 1].flight_id, flight.id);
  assert.equal(after.tables.aircraft_rates[after.tables.aircraft_rates.length - 1].aircraft_id, aircraft.id);
});

test('restore drops unknown columns instead of erroring, so a future or past export shape is still readable', async () => {
  const backup = await (await call('GET', '/backup/export')).json();
  backup.tables.aircraft = [{ ...backup.tables.aircraft[0], made_up_future_column: 'whatever' }];
  const res = await call('POST', '/backup/restore', { ...backup, mode: 'replace' });
  assert.equal(res.status, 200);
});
