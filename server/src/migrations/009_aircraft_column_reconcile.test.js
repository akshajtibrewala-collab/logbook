import { test } from 'node:test';
import assert from 'node:assert/strict';

// Its own file (node --test runs each test file in its own process) so this database starts with an
// `aircraft` table shaped the way production Turso's turned out to be: created outside this migrations
// system, with icao_type/type_designation instead of type_designator/type_rating_designation, and no
// archived_at. See docs/TURSO_RECONCILE.md.
//
// This tests 009's up() directly rather than through migrate() — migrate()'s safety net correctly
// refuses to run at all against a database with an untracked, pre-existing `aircraft` table (that's the
// exact situation server/scripts/reconcile-turso.js exists to handle deliberately, once), so a
// full-migrate() test can't exercise this migration the way it will actually run in that incident.
process.env.DB_FILE = ':memory:';
const { client, run, all, get } = await import('../db.js');
const up = (await import('./009_aircraft_column_reconcile.js')).default;

test('009 renames the diverged aircraft columns and adds archived_at, keeping existing data', async () => {
  await client.executeMultiple(`
    CREATE TABLE aircraft (
      id INTEGER PRIMARY KEY AUTOINCREMENT, tail_number TEXT NOT NULL, make TEXT, model TEXT,
      icao_type TEXT, category TEXT, class TEXT,
      is_complex INTEGER NOT NULL DEFAULT 0, is_high_performance INTEGER NOT NULL DEFAULT 0,
      is_tailwheel INTEGER NOT NULL DEFAULT 0, is_turbine INTEGER NOT NULL DEFAULT 0,
      type_rating_required INTEGER NOT NULL DEFAULT 0, type_designation TEXT,
      is_simulator INTEGER NOT NULL DEFAULT 0, simulator_device_type TEXT, notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  await run("INSERT INTO aircraft (tail_number, make, model, icao_type, type_designation) VALUES ('N123AB','Cessna','172S','C172','B737')");

  await up({ all, run });

  const cols = (await all("SELECT name FROM pragma_table_info('aircraft')")).map((c) => c.name);
  assert.ok(cols.includes('type_designator'));
  assert.ok(cols.includes('type_rating_designation'));
  assert.ok(cols.includes('archived_at'));
  assert.ok(!cols.includes('icao_type'));
  assert.ok(!cols.includes('type_designation'));

  const aircraft = await get('SELECT * FROM aircraft WHERE tail_number = ?', ['N123AB']);
  assert.equal(aircraft.type_designator, 'C172'); // old data preserved under the new name
  assert.equal(aircraft.type_rating_designation, 'B737');
  assert.equal(aircraft.archived_at, null);
});

test('009 is a no-op against a normal, already-current aircraft table', async () => {
  await client.executeMultiple(`
    DROP TABLE aircraft;
    CREATE TABLE aircraft (
      id INTEGER PRIMARY KEY AUTOINCREMENT, tail_number TEXT, make TEXT, model TEXT,
      type_designator TEXT, category TEXT, class TEXT,
      is_complex INTEGER NOT NULL DEFAULT 0, is_high_performance INTEGER NOT NULL DEFAULT 0,
      is_tailwheel INTEGER NOT NULL DEFAULT 0, is_turbine INTEGER NOT NULL DEFAULT 0, is_taa INTEGER NOT NULL DEFAULT 0,
      type_rating_required INTEGER NOT NULL DEFAULT 0, type_rating_designation TEXT,
      is_simulator INTEGER NOT NULL DEFAULT 0, simulator_device_type TEXT, notes TEXT, archived_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  await run("INSERT INTO aircraft (tail_number, type_designator) VALUES ('N456CD','C172')");

  await up({ all, run }); // must not throw or touch anything

  const aircraft = await get('SELECT * FROM aircraft WHERE tail_number = ?', ['N456CD']);
  assert.equal(aircraft.type_designator, 'C172');
});
