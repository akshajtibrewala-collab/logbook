import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
process.env.APP_PASSCODE = 'pass';
const express = (await import('express')).default;
const { makeRegistrationCronRouter } = await import('./registration-job.js');
const { app: realApp } = await import('../app.js');

let server;
let base;
let calls = [];
const plan = { maxCalls: 5, reserve: 40 };

before(async () => {
  const app = express();
  app.use('/api/cron', makeRegistrationCronRouter({
    runJob: async (opts) => { calls.push(opts); return { configured: true, due: 0, checked: 0, filled: 0, nomatch: 0, errors: 0 }; },
    budget: () => plan,
  }));
  await new Promise((resolve) => { server = app.listen(0, () => { base = `http://localhost:${server.address().port}/api`; resolve(); }); });
});
after(() => server.close());

const get = (headers = {}) => fetch(`${base}/cron/registrations`, { headers });

test('no secret configured: 401 even with a header (fails closed), and no job runs', async () => {
  delete process.env.CRON_SECRET;
  assert.equal((await get({ authorization: 'Bearer anything' })).status, 401);
  assert.equal((await get()).status, 401);
  assert.equal(calls.length, 0);
});

test('wrong secret and the app passcode are rejected', async () => {
  process.env.CRON_SECRET = 'cron-secret';
  assert.equal((await get({ authorization: 'Bearer nope' })).status, 401);
  assert.equal((await get({ 'x-app-passcode': 'pass' })).status, 401);
  assert.equal(calls.length, 0);
});

test('correct secret but no provider key: idle, no job', async () => {
  process.env.CRON_SECRET = 'cron-secret';
  delete process.env.FLIGHT_DATA_API_KEY;
  const res = await get({ authorization: 'Bearer cron-secret' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'idle', reason: 'provider-key-not-set' });
  assert.equal(calls.length, 0);
});

test('correct secret, key and budget: runs the job with the cap and reserve, returns counts only', async () => {
  process.env.FLIGHT_DATA_API_KEY = 'k';
  const res = await get({ authorization: 'Bearer cron-secret' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.configured, undefined);
  assert.deepEqual(calls.at(-1), { key: 'k', maxCalls: 5, reserve: 40 });
  assert.ok(!JSON.stringify(body).includes('"k"'));
});

test('the real app mounts the route and stays idle without a provider key', async () => {
  delete process.env.FLIGHT_DATA_API_KEY;
  const s = realApp.listen(0);
  try {
    const url = `http://localhost:${s.address().port}/api/cron/registrations`;
    assert.equal((await fetch(url)).status, 401);
    const ok = await fetch(url, { headers: { authorization: 'Bearer cron-secret' } });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).status, 'idle');
  } finally { s.close(); }
});
