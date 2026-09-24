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

const AUTH = { 'x-app-passcode': 'test-passcode' };
const call = (method, path, body, headers = AUTH) =>
  fetch(base + path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body && JSON.stringify(body) });

const PIXEL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

async function makeFlight(extra = {}) {
  const res = await call('POST', '/flights', { date: '2026-03-01', departure_airport: 'KPAO', arrival_airport: 'KSQL', total_time: 1.5, remarks: 'private note', instructor: 'Jane', ...extra });
  return res.json();
}

test('photos: validate, attach, count, delete with the flight', async () => {
  const f = await makeFlight();
  let res = await call('POST', `/photos/flight/${f.id}`, { data_url: 'not an image' });
  assert.equal(res.status, 400);
  res = await call('POST', `/photos/flight/${f.id}`, { data_url: PIXEL, width: 1, height: 1 });
  assert.equal(res.status, 201);
  assert.deepEqual(await (await call('GET', '/photos/counts')).json(), { [f.id]: 1 });
  assert.equal((await (await call('GET', `/photos/flight/${f.id}`)).json()).length, 1);
  assert.equal((await call('POST', '/photos/flight/99999', { data_url: PIXEL })).status, 404);
  await call('DELETE', `/flights/${f.id}`);
  assert.deepEqual(await (await call('GET', '/photos/counts')).json(), {});
});

test('hours target is saved with the pilot settings and validated', async () => {
  let res = await call('PUT', '/settings', { hours_target: 0 });
  assert.equal(res.status, 400);
  res = await call('PUT', '/settings', { hours_target: 40, hours_target_label: 'Private certificate' });
  const s = await res.json();
  assert.equal(s.hours_target, 40);
  assert.equal(s.hours_target_label, 'Private certificate');
});

test('share link: private by default, token gates access, revoke and regenerate kill old links', async () => {
  assert.equal((await (await call('GET', '/share')).json()).enabled, false);
  assert.equal((await call('GET', '/public/whatever', undefined, {})).status, 404);

  const f = await makeFlight({ date: '2026-04-01' });
  await call('POST', `/photos/flight/${f.id}`, { data_url: PIXEL });

  const on = await (await call('POST', '/share')).json();
  assert.equal(on.enabled, true);
  assert.ok(on.token.length >= 30);
  const open = (t, path = '') => call('GET', `/public/${t}${path}`, undefined, {}); // no passcode at all

  let res = await open(on.token);
  assert.equal(res.status, 200);
  let body = await res.json();
  assert.ok(body.totals.total >= 1.5);
  const text = JSON.stringify(body);
  assert.ok(!text.includes('private note'));
  assert.ok(!text.includes('Jane'));
  assert.equal((await open(on.token, `/photos/1`)).status, 404); // photos off by default

  await call('PUT', '/share', { show_notes: true, show_photos: true });
  body = await (await open(on.token)).json();
  const listed = body.recent.find((r) => r.id === f.id);
  assert.equal(listed.note, 'private note');
  assert.equal(listed.photo_ids.length, 1);
  res = await open(on.token, `/photos/${listed.photo_ids[0]}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/jpeg');

  // The public surface is read-only: no write verbs are routed at all.
  assert.notEqual((await call('DELETE', `/public/${on.token}`, undefined, {})).status, 204);
  assert.notEqual((await call('POST', `/public/${on.token}`, { x: 1 }, {})).status, 200);
  assert.equal((await call('GET', '/flights', undefined, {})).status, 401);

  const regen = await (await call('POST', '/share/regenerate')).json();
  assert.notEqual(regen.token, on.token);
  assert.equal((await open(on.token)).status, 404);
  assert.equal((await open(regen.token)).status, 200);

  await call('DELETE', '/share');
  assert.equal((await open(regen.token)).status, 404);
  const again = await (await call('POST', '/share')).json();
  assert.notEqual(again.token, regen.token);
  assert.equal((await open(regen.token)).status, 404);
});
