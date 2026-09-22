import { test } from 'node:test';
import assert from 'node:assert/strict';

// Its own file (node --test runs each test file in its own process) so this database starts with a table
// no migration creates and no _migrations table — the shape production Turso was found in after another
// branch added tables outside the tracked migrations system. See docs/TURSO_RECONCILE.md.
process.env.DB_FILE = ':memory:';
const { client } = await import('./db.js');
const { migrate } = await import('./migrate.js');

test('migrate() refuses a database with untracked tables it does not recognize', async () => {
  await client.executeMultiple('CREATE TABLE flights (id INTEGER PRIMARY KEY); CREATE TABLE certificates (id INTEGER PRIMARY KEY);');
  await assert.rejects(migrate(), /Refusing to migrate/);
  await assert.rejects(migrate(), /certificates/);
});
