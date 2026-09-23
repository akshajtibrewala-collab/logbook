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

test('GET starts empty', async () => {
  const res = await call('GET', '/milestone-completions');
  assert.deepEqual(await res.json(), []);
});

test('PUT marks a requirement complete; GET reflects it; PUT again overwrites (not duplicates) it', async () => {
  const put = await call('PUT', '/milestone-completions/private/solo_xc_150nm', { completed_at: '2026-03-01', note: 'KPAO-KSNS-KWVI-KPAO' });
  assert.equal(put.status, 200);
  assert.deepEqual(await put.json(), { certificate: 'private', requirement_key: 'solo_xc_150nm', completed_at: '2026-03-01', note: 'KPAO-KSNS-KWVI-KPAO' });

  await call('PUT', '/milestone-completions/private/solo_xc_150nm', { completed_at: '2026-03-05' });
  const list = await (await call('GET', '/milestone-completions')).json();
  assert.equal(list.length, 1);
  assert.equal(list[0].completed_at, '2026-03-05');
  assert.equal(list[0].note, null);
});

test('PUT rejects a missing/invalid date', async () => {
  const res = await call('PUT', '/milestone-completions/private/solo_xc_150nm', { completed_at: 'not-a-date' });
  assert.equal(res.status, 400);
  assert.ok(res.headers.get('content-type').includes('json'));
});

test('DELETE undoes a completion, and is a no-op if it was never set', async () => {
  const del = await call('DELETE', '/milestone-completions/private/solo_xc_150nm');
  assert.equal(del.status, 204);
  assert.deepEqual(await (await call('GET', '/milestone-completions')).json(), []);

  const again = await call('DELETE', '/milestone-completions/private/solo_xc_150nm');
  assert.equal(again.status, 204);
});
