import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
const { run, get } = await import('../db.js');
const { migrate } = await import('../migrate.js');

test('creates the planned_costs table', async () => {
  await migrate();
  await run("INSERT INTO planned_costs (certificate, label, amount) VALUES ('private', 'Checkride examiner fee', 700)");
  const row = await get("SELECT * FROM planned_costs WHERE certificate = 'private'");
  assert.equal(row.label, 'Checkride examiner fee');
  assert.equal(row.amount, 700);
});

test('migrate() run twice does not error', async () => {
  await migrate();
  assert.ok(true);
});
