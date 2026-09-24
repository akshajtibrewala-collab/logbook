import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
delete process.env.APP_PASSCODE;
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
  fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });

test('rates: no aircraft existed at migration time, so aircraft/simulator rates start empty', async () => {
  // instructor_rates and ground_rates are seeded by migration 013 itself even with no flights (effective
  // today), so those two are asserted separately below rather than expected empty here.
  for (const kind of ['aircraft', 'simulator']) {
    const res = await call('GET', `/costs/rates/${kind}`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), []);
  }
});

test('instructor rate CRUD (on top of the one row migration 013 already seeded)', async () => {
  const seeded = await (await call('GET', '/costs/rates/instructor')).json();
  assert.equal(seeded.length, 1);
  assert.equal(seeded[0].hourly_rate, 85);

  const created = await (await call('POST', '/costs/rates/instructor', { certificate: 'private', effective_date: '2026-01-01', hourly_rate: 85 })).json();
  assert.equal(created.hourly_rate, 85);

  const updated = await (await call('PUT', `/costs/rates/instructor/${created.id}`, { certificate: 'private', effective_date: '2026-06-01', hourly_rate: 95 })).json();
  assert.equal(updated.hourly_rate, 95);

  const del = await call('DELETE', `/costs/rates/instructor/${created.id}`);
  assert.equal(del.status, 204);
  assert.equal((await (await call('GET', '/costs/rates/instructor')).json()).length, 1); // back to just the seeded row
});

test('instructor rate rejects a bad date, a negative rate, and a missing certificate', async () => {
  const res = await call('POST', '/costs/rates/instructor', { effective_date: 'not-a-date', hourly_rate: -5 });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.errors.effective_date);
  assert.ok(body.errors.hourly_rate);
  assert.ok(body.errors.certificate);
});

test('aircraft rate CRUD, linked to a real aircraft and a training phase', async () => {
  const aircraft = await (await call('POST', '/aircraft', { tail_number: 'N123AB', model: '172S' })).json();
  const created = await (await call('POST', '/costs/rates/aircraft', {
    certificate: 'private', aircraft_id: aircraft.id, effective_date: '2026-01-01', rental_rate_per_hr: 195, fuel_surcharge_per_hr: 15,
  })).json();
  assert.equal(created.certificate, 'private');
  assert.equal(created.rental_rate_per_hr, 195);
  assert.equal(created.fuel_surcharge_per_hr, 15);

  const list = await (await call('GET', '/costs/rates/aircraft')).json();
  assert.equal(list.length, 1);

  const del = await call('DELETE', `/costs/rates/aircraft/${created.id}`);
  assert.equal(del.status, 204);
});

test('aircraft rate requires a valid aircraft_id', async () => {
  const res = await call('POST', '/costs/rates/aircraft', { certificate: 'private', aircraft_id: 0, effective_date: '2026-01-01', rental_rate_per_hr: 195 });
  assert.equal(res.status, 400);
  assert.ok((await res.json()).errors.aircraft_id);
});

test('expenses CRUD, unknown category falls back to "other"', async () => {
  const created = await (await call('POST', '/costs/expenses', { category: 'headset', date: '2026-05-01', amount: 899, note: 'Bose A20' })).json();
  assert.equal(created.category, 'headset');
  assert.equal(created.amount, 899);

  const bogus = await (await call('POST', '/costs/expenses', { category: 'made-up', date: '2026-05-01', amount: 10 })).json();
  assert.equal(bogus.category, 'other');

  const list = await (await call('GET', '/costs/expenses')).json();
  assert.equal(list.length, 2);

  const del = await call('DELETE', `/costs/expenses/${created.id}`);
  assert.equal(del.status, 204);
});

test('ground sessions CRUD, including GET /:id', async () => {
  const created = await (await call('POST', '/costs/ground-sessions', {
    date: '2026-05-01', hours: 1.5, instructor: 'Jane', topics: 'Weather, ADM', notes: 'Good session',
  })).json();
  assert.equal(created.hours, 1.5);
  assert.equal(created.instructor, 'Jane');

  const fetched = await (await call('GET', `/costs/ground-sessions/${created.id}`)).json();
  assert.equal(fetched.id, created.id);
  assert.equal(fetched.hours, 1.5);

  const notFound = await call('GET', '/costs/ground-sessions/999999');
  assert.equal(notFound.status, 404);

  const updated = await (await call('PUT', `/costs/ground-sessions/${created.id}`, { date: '2026-05-01', hours: 2 })).json();
  assert.equal(updated.hours, 2);
  assert.equal(updated.instructor, null); // omitted on the update, so cleared like other optional text fields

  const del = await call('DELETE', `/costs/ground-sessions/${created.id}`);
  assert.equal(del.status, 204);
});

test('ground session requires hours greater than 0', async () => {
  const res = await call('POST', '/costs/ground-sessions', { date: '2026-05-01', hours: 0 });
  assert.equal(res.status, 400);
  assert.ok((await res.json()).errors.hours);
});

test('training phases: PUT upserts by certificate, one row per certificate, track_costs defaults on', async () => {
  const created = await (await call('PUT', '/costs/phases/private', { start_date: '2026-01-01', end_date: null })).json();
  assert.equal(created.certificate, 'private');
  assert.equal(created.end_date, null);
  assert.equal(created.track_costs, 1);

  const updated = await (await call('PUT', '/costs/phases/private', { start_date: '2026-01-01', end_date: '2026-12-31', track_costs: false })).json();
  assert.equal(updated.end_date, '2026-12-31');
  assert.equal(updated.track_costs, 0);

  const list = await (await call('GET', '/costs/phases')).json();
  assert.equal(list.length, 1); // upsert, not a second row

  const del = await call('DELETE', '/costs/phases/private');
  assert.equal(del.status, 204);
});

test('training phase rejects an end_date before start_date', async () => {
  const res = await call('PUT', '/costs/phases/instrument', { start_date: '2026-06-01', end_date: '2026-01-01' });
  assert.equal(res.status, 400);
  assert.ok((await res.json()).errors.end_date);
});

test('flights: ground_time and cost_override round-trip, and ground_time is not checked against total_time', async () => {
  const flight = await (await call('POST', '/flights', {
    date: '2026-05-01', total_time: 1.5, dual_received: 1.5, ground_time: 2, cost_override: 400,
  })).json();
  assert.equal(flight.ground_time, 2); // exceeds total_time but that's fine — ground isn't flight time
  assert.equal(flight.cost_override, 400);

  const cleared = await (await call('PUT', `/flights/${flight.id}`, {
    date: '2026-05-01', total_time: 1.5, dual_received: 1.5, ground_time: 0.5,
  })).json();
  assert.equal(cleared.ground_time, 0.5);
  assert.equal(cleared.cost_override, null); // omitted on update, clears back to null like other optional fields
});

test('planned costs CRUD', async () => {
  const created = await (await call('POST', '/costs/planned-costs', { certificate: 'private', label: 'Checkride examiner fee', amount: 700 })).json();
  assert.equal(created.label, 'Checkride examiner fee');
  assert.equal(created.amount, 700);

  const updated = await (await call('PUT', `/costs/planned-costs/${created.id}`, { certificate: 'private', label: 'Checkride examiner fee', amount: 750 })).json();
  assert.equal(updated.amount, 750);

  const list = await (await call('GET', '/costs/planned-costs')).json();
  assert.equal(list.length, 1);

  const del = await call('DELETE', `/costs/planned-costs/${created.id}`);
  assert.equal(del.status, 204);
});

test('planned cost requires a label and a certificate', async () => {
  const res = await call('POST', '/costs/planned-costs', { certificate: '', label: '', amount: 10 });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.errors.certificate);
  assert.ok(body.errors.label);
});
