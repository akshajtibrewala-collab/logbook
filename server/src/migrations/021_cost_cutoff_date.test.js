import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
const { run, get } = await import('../db.js');
const { migrate } = await import('../migrate.js');

test('adds pilot_settings.cost_cutoff_date, empty by default', async () => {
  await migrate();
  await run('INSERT INTO pilot_settings (id) VALUES (1)');
  assert.equal((await get('SELECT cost_cutoff_date FROM pilot_settings WHERE id = 1')).cost_cutoff_date, null);
  await run("UPDATE pilot_settings SET cost_cutoff_date = '2026-06-15' WHERE id = 1");
  assert.equal((await get('SELECT cost_cutoff_date FROM pilot_settings WHERE id = 1')).cost_cutoff_date, '2026-06-15');
});

test('running migrate() again does not error', async () => {
  await migrate();
  assert.ok(true);
});
