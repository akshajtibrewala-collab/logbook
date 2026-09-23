import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
const { run, all } = await import('../db.js');
const { migrate } = await import('../migrate.js');

test('creates the runways table, indexed by airport_ident, keyed by (airport, le, he)', async () => {
  await migrate();
  await run(
    'INSERT INTO runways (airport_ident, le_ident, le_heading_true, he_ident, he_heading_true, length_ft, surface) VALUES (?,?,?,?,?,?,?)',
    ['KPAO', '13', 132, '31', 312, 2443, 'ASP'],
  );
  const rows = await all('SELECT * FROM runways WHERE airport_ident = ?', ['KPAO']);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].le_heading_true, 132);
  assert.equal(rows[0].he_heading_true, 312);
});

test('le_heading_true/he_heading_true may be null (no true heading published for that runway)', async () => {
  await run('INSERT INTO runways (airport_ident, le_ident, he_ident) VALUES (?,?,?)', ['KHAF', '30', '12']);
  const [row] = await all('SELECT * FROM runways WHERE airport_ident = ?', ['KHAF']);
  assert.equal(row.le_heading_true, null);
});

test('migrate() run twice does not error', async () => {
  await migrate();
  assert.ok(true);
});
