import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
process.env.APP_PASSCODE = 'pass';
const { app } = await import('../app.js');
const { migrate } = await import('../migrate.js');
const { runBackup } = await import('./backup-job.js');
let server;
let base;

before(async () => {
  await migrate();
  await new Promise((resolve) => {
    server = app.listen(0, () => { base = `http://localhost:${server.address().port}/api`; resolve(); });
  });
});
after(() => server.close());

const call = (method, path, headers = {}) => fetch(base + path, { method, headers });

test('cron endpoint: no secret configured -> 401 even with a header (fails closed)', async () => {
  delete process.env.CRON_SECRET;
  assert.equal((await call('GET', '/cron/backup', { authorization: 'Bearer anything' })).status, 401);
  assert.equal((await call('GET', '/cron/backup')).status, 401);
});

test('cron endpoint: wrong secret 401; app passcode is not accepted in its place', async () => {
  process.env.CRON_SECRET = 'cron-secret';
  assert.equal((await call('GET', '/cron/backup', { authorization: 'Bearer nope' })).status, 401);
  assert.equal((await call('GET', '/cron/backup', { 'x-app-passcode': 'pass' })).status, 401);
});

test('status and run-now require the app passcode', async () => {
  assert.equal((await call('GET', '/backup-job/status')).status, 401);
  assert.equal((await call('POST', '/backup-job/run')).status, 401);
});

test('a run without email configured records a failed run, and status warns', async () => {
  delete process.env.RESEND_API_KEY;
  delete process.env.BACKUP_EMAIL_TO;
  const res = await call('POST', '/backup-job/run', { 'x-app-passcode': 'pass' });
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.equal(body.state, 'failed');
  assert.equal(body.warn, true);
  assert.match(body.last.error, /not configured/);
});

test('a successful run emails one attachment without airports/runways, records ok, and prunes to 12', async () => {
  process.env.RESEND_API_KEY = 'k';
  process.env.BACKUP_EMAIL_TO = 'me@example.com';
  const sent = [];
  for (let i = 0; i < 14; i++) {
    const r = await runBackup('cron', { send: async (m) => sent.push(m), now: new Date(Date.now() + (i + 1) * 86400000) });
    assert.equal(r.status, 'ok', r.error);
  }
  const mail = sent[0];
  assert.equal(mail.to, 'me@example.com');
  const backup = JSON.parse(mail.content.toString());
  assert.equal(backup.app, 'AeroTrail');
  assert.ok(!('airports' in backup.tables) && !('runways' in backup.tables));
  assert.ok(!('backup_runs' in backup.tables));
  const status = await (await call('GET', '/backup-job/status', { 'x-app-passcode': 'pass' })).json();
  assert.equal(status.last.status, 'ok');
  const { get } = await import('../db.js');
  assert.equal((await get('SELECT COUNT(*) AS n FROM backup_runs')).n, 12);
});

test('cron endpoint with the right secret runs the job (send failure is recorded, not thrown)', async () => {
  process.env.CRON_SECRET = 'cron-secret';
  process.env.RESEND_API_KEY = 'k';
  process.env.BACKUP_EMAIL_TO = 'me@example.com';
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => (String(url).includes('api.resend.com')
    ? new Response('{"message":"invalid key"}', { status: 403 })
    : realFetch(url, opts));
  try {
    const res = await call('GET', '/cron/backup', { authorization: 'Bearer cron-secret' });
    assert.equal(res.status, 500);
    assert.match((await res.json()).error, /Resend 403/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
