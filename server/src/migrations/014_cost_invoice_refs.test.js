import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
const { all } = await import('../db.js');
const { migrate } = await import('../migrate.js');

test('adds instructor/invoice_ref to flights, invoice_ref/cost_override to ground_sessions, invoice_ref to other_expenses', async () => {
  await migrate();
  const flightCols = (await all("SELECT name FROM pragma_table_info('flights')")).map((c) => c.name);
  assert.ok(flightCols.includes('instructor'));
  assert.ok(flightCols.includes('invoice_ref'));

  const groundCols = (await all("SELECT name FROM pragma_table_info('ground_sessions')")).map((c) => c.name);
  assert.ok(groundCols.includes('invoice_ref'));
  assert.ok(groundCols.includes('cost_override'));

  const expenseCols = (await all("SELECT name FROM pragma_table_info('other_expenses')")).map((c) => c.name);
  assert.ok(expenseCols.includes('invoice_ref'));
});

test('migrate() run twice does not error', async () => {
  await migrate();
  assert.ok(true);
});
