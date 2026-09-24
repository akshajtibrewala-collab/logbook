import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
const { run, get } = await import('../db.js');
const { migrate } = await import('../migrate.js');

test('creates share_settings as a single-row table with private-by-default flags', async () => {
  await migrate();
  await run("INSERT INTO share_settings (id, token) VALUES (1, 'abc')");
  const row = await get('SELECT * FROM share_settings');
  assert.equal(row.show_notes, 0);
  assert.equal(row.show_photos, 0);
  await assert.rejects(run("INSERT INTO share_settings (id, token) VALUES (2, 'x')"));
  await migrate();
});
