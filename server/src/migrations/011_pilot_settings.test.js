import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
const { run, get } = await import('../db.js');
const { migrate } = await import('../migrate.js');

test('creates a single-row pilot_settings table with nullable minimums', async () => {
  await migrate();
  await run('INSERT INTO pilot_settings (id, home_airport_ident, min_ceiling_ft) VALUES (1, ?, ?)', ['KPAO', 1000]);
  const row = await get('SELECT * FROM pilot_settings WHERE id = 1');
  assert.equal(row.home_airport_ident, 'KPAO');
  assert.equal(row.min_ceiling_ft, 1000);
  assert.equal(row.max_crosswind_kt, null); // unset limits stay null rather than defaulting to 0
});

test('the id = 1 check constraint rejects a second row', async () => {
  // The previous test already inserted the id = 1 row; this only has to prove id = 2 is refused.
  await assert.rejects(run('INSERT INTO pilot_settings (id) VALUES (2)'));
});

test('migrate() run twice does not error', async () => {
  await migrate();
  assert.ok(true);
});
