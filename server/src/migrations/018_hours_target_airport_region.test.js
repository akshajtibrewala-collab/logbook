import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
const { run, get, all } = await import('../db.js');
const { migrate } = await import('../migrate.js');

test('adds hours target columns to pilot_settings and region to airports', async () => {
  await migrate();
  await run("INSERT INTO pilot_settings (id, hours_target, hours_target_label) VALUES (1, 40, 'Private certificate')");
  const s = await get('SELECT hours_target, hours_target_label FROM pilot_settings WHERE id = 1');
  assert.deepEqual({ ...s }, { hours_target: 40, hours_target_label: 'Private certificate' });
  const cols = (await all("SELECT name FROM pragma_table_info('airports')")).map((c) => c.name);
  assert.ok(cols.includes('region'));
});

test('running migrate() again does not error', async () => {
  await migrate();
  assert.ok(true);
});
