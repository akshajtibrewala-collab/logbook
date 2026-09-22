import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
const { migrate, appliedMigrations } = await import('./migrate.js');
const { all, run, get } = await import('./db.js');

test('migrate() applies every migration once and records it', async () => {
  await migrate();
  const applied = await appliedMigrations();
  assert.ok(applied.includes('001_init.js'));
  assert.ok((await all("SELECT name FROM sqlite_master WHERE type='table' AND name='flights'")).length === 1);
});

test('migrate() is idempotent: running it again does not re-apply or error', async () => {
  const before = await appliedMigrations();
  await migrate(); // second run
  const after = await appliedMigrations();
  assert.deepEqual(before, after);
});

test('migrate() never loses data that already exists: a flight logged before a later migration survives it', async () => {
  // Simulate real usage: log a flight against today's schema, then run migrate() again (standing in
  // for "a future migration ships and the app restarts") and confirm the flight is untouched.
  const { lastId } = await run(
    "INSERT INTO flights (date, departure_airport, arrival_airport, total_time, pic_time) VALUES ('2026-01-01','KPAO','KSQL',1.5,1.5)",
  );
  await migrate();
  const flight = await get('SELECT * FROM flights WHERE id = ?', [lastId]);
  assert.equal(flight.departure_airport, 'KPAO');
  assert.equal(flight.total_time, 1.5);
});
