import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
process.env.APP_PASSCODE = 'pw';
const { app } = await import('../app.js');
const { migrate } = await import('../migrate.js');
const { run, get, all } = await import('../db.js');
const job = await import('../lib/registration-job.js');
const { FIXTURES } = await import('../lib/flight-data.fixtures.js');
let server;
let base;

before(async () => {
  await migrate();
  await new Promise((resolve) => { server = app.listen(0, () => { base = `http://localhost:${server.address().port}/api`; resolve(); }); });
});
after(() => server.close());

const call = (method, path, body) => fetch(base + path, {
  method, headers: { 'content-type': 'application/json', 'x-app-passcode': 'pw' }, body: body && JSON.stringify(body),
});
const NOW = new Date('2026-06-15T06:00:00.000Z');
let n = 0;

async function autoFilledFlight(extra = {}) {
  n += 1;
  const res = await call('POST', '/flights', {
    date: '2026-05-20', departure_airport: 'ZZAA', arrival_airport: 'ZZBB', role: 'passenger',
    flight_number: `ZZ${200 + n}`, total_time: 1.2, ...extra,
  });
  assert.equal(res.status, 201, JSON.stringify(await res.clone().json()));
  const f = await res.json();
  const fetchImpl = async () => ({ status: 200, headers: new Headers(), json: async () => FIXTURES.normal });
  const r = await job.runRegistrationJob({ key: 'k', fetchImpl, sleep: async () => {}, now: NOW, maxCalls: 1, reserve: 0, log: () => {} });
  assert.equal(r.filled, 1);
  return get('SELECT * FROM flights WHERE id = ?', [f.id]);
}

const reset = async () => { await run('DELETE FROM flights'); await run('DELETE FROM aircraft'); };

test('a client cannot set the provenance columns through the normal write path', async () => {
  await reset();
  const res = await call('POST', '/flights', {
    date: '2026-05-20', departure_airport: 'ZZAA', arrival_airport: 'ZZBB', role: 'passenger', total_time: 1,
    tail_number: 'N9OWN', reg_source: 'aerodatabox', reg_cleared_at: 'x', reg_check_count: 9,
  });
  const f = await res.json();
  const row = await get('SELECT * FROM flights WHERE id = ?', [f.id]);
  assert.equal(row.reg_source, null);
  assert.equal(row.reg_cleared_at, null);
  assert.equal(row.reg_check_count, null);
  await call('PATCH', `/flights/${f.id}`, { reg_source: 'aerodatabox' });
  assert.equal((await get('SELECT reg_source FROM flights WHERE id = ?', [f.id])).reg_source, null);
});

test('saving without touching the tail keeps the automatic marker', async () => {
  await reset();
  const f = await autoFilledFlight();
  const res = await call('PATCH', `/flights/${f.id}`, { remarks: 'note' });
  assert.equal(res.status, 200);
  const row = await get('SELECT * FROM flights WHERE id = ?', [f.id]);
  assert.equal(row.reg_source, 'aerodatabox');
  assert.equal(row.tail_number, 'N1TEST');
  // a full-body save that sends the same tail back (the form) keeps it too
  await call('PUT', `/flights/${f.id}`, { ...(await res.json()), tail_number: 'n1test' });
  assert.equal((await get('SELECT reg_source FROM flights WHERE id = ?', [f.id])).reg_source, 'aerodatabox');
});

test('changing the tail makes it the pilot\'s own value', async () => {
  await reset();
  const f = await autoFilledFlight();
  await call('PATCH', `/flights/${f.id}`, { tail_number: 'N5MINE' });
  const row = await get('SELECT * FROM flights WHERE id = ?', [f.id]);
  assert.equal(row.tail_number, 'N5MINE');
  assert.equal(row.reg_source, null);
});

test('blanking the tail marks it cleared and the job never refills it', async () => {
  await reset();
  const f = await autoFilledFlight();
  await call('PATCH', `/flights/${f.id}`, { tail_number: '' });
  const row = await get('SELECT * FROM flights WHERE id = ?', [f.id]);
  assert.equal(row.tail_number, null);
  assert.ok(row.reg_cleared_at);
  const calls = [];
  const fetchImpl = async (...a) => { calls.push(a); return { status: 200, headers: new Headers(), json: async () => FIXTURES.normal }; };
  const r = await job.runRegistrationJob({ key: 'k', fetchImpl, sleep: async () => {}, now: new Date('2026-06-20T06:00:00Z'), maxCalls: 5, reserve: 0, log: () => {} });
  assert.equal(r.due, 0);
  assert.equal(calls.length, 0);
});

test('clear-registration removes the tail and link, and the aircraft row the job created', async () => {
  await reset();
  const f = await autoFilledFlight();
  assert.ok(f.aircraft_id);
  const res = await call('POST', `/flights/${f.id}/clear-registration`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.tail_number, null);
  assert.equal(body.aircraft_id, null);
  assert.ok(body.reg_cleared_at);
  assert.equal((await all('SELECT id FROM aircraft')).length, 0);
  assert.equal((await get('SELECT COUNT(*) c FROM flights')).c, 1); // nothing deleted
});

test('clear-registration keeps an aircraft that another flight uses, or that the pilot made', async () => {
  await reset();
  const f1 = await autoFilledFlight();
  await run('INSERT INTO flights (date, departure_airport, arrival_airport, role, total_time, aircraft_id, tail_number) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['2026-04-01', 'ZZAA', 'ZZBB', 'passenger', 1, f1.aircraft_id, 'N1TEST']);
  await call('POST', `/flights/${f1.id}/clear-registration`);
  assert.equal((await all('SELECT id FROM aircraft')).length, 1);

  await reset();
  await run("INSERT INTO aircraft (tail_number, model) VALUES ('N1TEST', 'Mine')");
  const f2 = await autoFilledFlight();
  await call('POST', `/flights/${f2.id}/clear-registration`);
  assert.equal((await all('SELECT id FROM aircraft')).length, 1);
});

test('clear-registration refuses a registration the pilot typed, and a missing flight', async () => {
  await reset();
  const res = await call('POST', '/flights', {
    date: '2026-05-20', departure_airport: 'ZZAA', arrival_airport: 'ZZBB', role: 'passenger', total_time: 1, tail_number: 'N9OWN',
  });
  const f = await res.json();
  assert.equal((await call('POST', `/flights/${f.id}/clear-registration`)).status, 400);
  assert.equal((await get('SELECT tail_number FROM flights WHERE id = ?', [f.id])).tail_number, 'N9OWN');
  assert.equal((await call('POST', '/flights/999999/clear-registration')).status, 404);
});

test('clear-registration needs the app passcode', async () => {
  const r = await fetch(`${base}/flights/1/clear-registration`, { method: 'POST' });
  assert.equal(r.status, 401);
});

test('backup export carries the provenance columns, and restore works with and without them', async () => {
  await reset();
  const f = await autoFilledFlight();
  const backup = await (await call('GET', '/backup/export')).json();
  const exported = backup.tables.flights.find((r) => r.id === f.id);
  assert.equal(exported.reg_source, 'aerodatabox');
  assert.ok('reg_filled_at' in exported && 'reg_cleared_at' in exported);
  assert.ok('auto_created_at' in backup.tables.aircraft[0]);

  // round trip keeps provenance
  assert.equal((await call('POST', '/backup/restore', { ...backup, mode: 'replace' })).status, 200);
  assert.equal((await get('SELECT reg_source FROM flights WHERE id = ?', [f.id])).reg_source, 'aerodatabox');

  // an older backup (no reg_* keys at all) still restores, with the new columns NULL
  const old = JSON.parse(JSON.stringify(backup));
  for (const r of old.tables.flights) for (const k of Object.keys(r)) if (k.startsWith('reg_')) delete r[k];
  for (const r of old.tables.aircraft) delete r.auto_created_at;
  assert.equal((await call('POST', '/backup/restore', { ...old, mode: 'replace' })).status, 200);
  const row = await get('SELECT * FROM flights WHERE id = ?', [f.id]);
  assert.equal(row.tail_number, 'N1TEST');
  assert.equal(row.reg_source, null);
});
