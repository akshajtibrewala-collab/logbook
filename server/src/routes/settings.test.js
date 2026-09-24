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

test('GET before anything is set returns an all-null row, not a 404', async () => {
  const res = await call('GET', '/settings');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.id, 1);
  assert.equal(body.home_airport_ident, null);
  assert.equal(body.max_crosswind_kt, null);
});

test('PUT sets the home airport and minimums; unset fields stay null rather than defaulting to 0', async () => {
  const res = await call('PUT', '/settings', {
    home_airport_ident: 'kpao', min_ceiling_ft: 1000, min_visibility_sm: 3, max_wind_kt: 20, max_gust_kt: 25, max_crosswind_kt: 10,
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.home_airport_ident, 'KPAO'); // normalized to uppercase
  assert.equal(body.min_ceiling_ft, 1000);
  assert.equal(body.night_min_ceiling_ft, null); // never set
});

test('PUT with a blank field clears it back to null (not 0)', async () => {
  await call('PUT', '/settings', { home_airport_ident: 'KPAO', min_ceiling_ft: 1000 });
  const cleared = await call('PUT', '/settings', { home_airport_ident: 'KPAO' });
  const body = await cleared.json();
  assert.equal(body.min_ceiling_ft, null);
});

test('PUT rejects an invalid airport code and an out-of-range number', async () => {
  const res = await call('PUT', '/settings', { home_airport_ident: 'nowhere', max_wind_kt: -5 });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.errors.home_airport_ident);
  assert.ok(body.errors.max_wind_kt);
});

test('cost cutoff date: saved as a calendar day, blank clears it, invalid dates are rejected', async () => {
  let res = await call('PUT', '/settings', { cost_cutoff_date: '2026-06-15' });
  assert.equal((await res.json()).cost_cutoff_date, '2026-06-15');
  res = await call('PUT', '/settings', { cost_cutoff_date: '2026-02-30' });
  assert.equal(res.status, 400);
  assert.ok((await res.json()).errors.cost_cutoff_date);
  res = await call('PUT', '/settings', { cost_cutoff_date: '' });
  assert.equal((await res.json()).cost_cutoff_date, null);
});
