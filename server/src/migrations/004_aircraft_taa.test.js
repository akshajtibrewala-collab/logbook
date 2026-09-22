import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
const { run, get } = await import('../db.js');
const { migrate } = await import('../migrate.js');

test('is_taa defaults to 0 and can be set', async () => {
  await migrate();
  const { lastId } = await run("INSERT INTO aircraft (tail_number, model) VALUES ('N1TAA','SR22')");
  let a = await get('SELECT * FROM aircraft WHERE id = ?', [lastId]);
  assert.equal(a.is_taa, 0);
  await run('UPDATE aircraft SET is_taa = 1 WHERE id = ?', [lastId]);
  a = await get('SELECT * FROM aircraft WHERE id = ?', [lastId]);
  assert.equal(a.is_taa, 1);
});

test('migrate() run twice does not error (column-exists guard)', async () => {
  await migrate();
  const cols = await run("SELECT 1"); // just confirm no throw above; nothing else to assert
  assert.ok(cols);
});
