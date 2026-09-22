import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
const { run, get } = await import('../db.js');
const { migrate } = await import('../migrate.js');

test('creates the expirations table with a working index', async () => {
  await migrate();
  const { lastId } = await run(
    "INSERT INTO expirations (kind, label, issued_date, expires_date, notes) VALUES ('medical', '3rd Class Medical', '2025-01-01', '2027-01-31', NULL)",
  );
  const row = await get('SELECT * FROM expirations WHERE id = ?', [lastId]);
  assert.equal(row.kind, 'medical');
  assert.equal(row.expires_date, '2027-01-31');
});

test('migrate() run twice does not error', async () => {
  await migrate();
  assert.ok(true);
});
