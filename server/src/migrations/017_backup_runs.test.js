import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
const { run, get } = await import('../db.js');
const { migrate } = await import('../migrate.js');

test('creates backup_runs and enforces status/trigger values', async () => {
  await migrate();
  await run("INSERT INTO backup_runs (ran_at, status, trigger, size_bytes) VALUES ('2026-09-28T12:00:00Z', 'ok', 'cron', 1234)");
  assert.equal((await get('SELECT * FROM backup_runs')).size_bytes, 1234);
  await assert.rejects(run("INSERT INTO backup_runs (ran_at, status, trigger) VALUES ('x', 'weird', 'cron')"));
  await migrate();
});
