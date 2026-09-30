import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
const { client, run, all, get } = await import('../db.js');
const up = (await import('./022_flight_role.js')).default;

// A minimal stand-in for 001_init's flights table — enough columns to prove the backfill and constraint,
// without depending on every later migration having already run (same approach as
// 009_aircraft_column_reconcile.test.js).
async function freshFlightsTable() {
  await client.executeMultiple(`
    DROP TABLE IF EXISTS flights;
    CREATE TABLE flights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      total_time REAL NOT NULL DEFAULT 0
    );
  `);
}

test('022 backfills every existing flight to role=pilot with no separate UPDATE', async () => {
  await freshFlightsTable();
  await run("INSERT INTO flights (date, total_time) VALUES ('2026-01-01', 1.5)");

  await up({ all, run });

  const cols = (await all("SELECT name FROM pragma_table_info('flights')")).map((c) => c.name);
  assert.ok(cols.includes('role'));
  assert.ok(cols.includes('seat_class'));
  assert.ok(cols.includes('confirmation_code'));

  const flight = await get('SELECT * FROM flights WHERE date = ?', ['2026-01-01']);
  assert.equal(flight.role, 'pilot');
  assert.equal(flight.seat_class, null);
  assert.equal(flight.confirmation_code, null);
});

test('022 defaults a new row with no role given to pilot', async () => {
  await freshFlightsTable();
  await up({ all, run });
  await run("INSERT INTO flights (date, total_time) VALUES ('2026-02-01', 1)");
  assert.equal((await get("SELECT role FROM flights WHERE date = '2026-02-01'")).role, 'pilot');
});

test('022 CHECK constraint rejects a role outside pilot/passenger/observer', async () => {
  await freshFlightsTable();
  await up({ all, run });
  await assert.rejects(
    () => run("INSERT INTO flights (date, total_time, role) VALUES ('2026-03-01', 1, 'crew')"),
  );
});

test('022 accepts every valid role', async () => {
  await freshFlightsTable();
  await up({ all, run });
  for (const role of ['pilot', 'passenger', 'observer']) {
    await run('INSERT INTO flights (date, total_time, role) VALUES (?, 1, ?)', ['2026-04-01', role]);
  }
  const rows = await all("SELECT role FROM flights WHERE date = '2026-04-01' ORDER BY role");
  assert.deepEqual(rows.map((r) => r.role), ['observer', 'passenger', 'pilot']);
});

test('022 is a no-op when run again (idempotent, matches migrate()\'s retry-safety rule)', async () => {
  await freshFlightsTable();
  await up({ all, run });
  await up({ all, run }); // must not throw
  const cols = (await all("SELECT name FROM pragma_table_info('flights')")).map((c) => c.name);
  assert.equal(cols.filter((c) => c === 'role').length, 1);
});
