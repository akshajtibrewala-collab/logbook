import { test } from 'node:test';
import assert from 'node:assert/strict';

// A dedicated file (node --test runs each test file in its own process) so this database starts life
// hand-shaped like the app's very first schema — before route/airline existed and before airports was
// reshaped — with no migrations tracked yet, the way your real local file or Turso database once did.
process.env.DB_FILE = ':memory:';
const { client, run, all } = await import('./db.js');
const { migrate } = await import('./migrate.js');

test('001_init catches up a pre-migrations database without losing its data', async () => {
  await client.executeMultiple(`
    CREATE TABLE flights (
      id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, departure_airport TEXT, arrival_airport TEXT,
      aircraft_type TEXT, tail_number TEXT, total_time REAL NOT NULL DEFAULT 0, pic_time REAL NOT NULL DEFAULT 0,
      sic_time REAL NOT NULL DEFAULT 0, dual_received REAL NOT NULL DEFAULT 0, solo_time REAL NOT NULL DEFAULT 0,
      night_time REAL NOT NULL DEFAULT 0, instrument_actual REAL NOT NULL DEFAULT 0, instrument_simulated REAL NOT NULL DEFAULT 0,
      cross_country_time REAL NOT NULL DEFAULT 0, day_landings INTEGER NOT NULL DEFAULT 0, night_landings INTEGER NOT NULL DEFAULT 0,
      approaches INTEGER NOT NULL DEFAULT 0, holds INTEGER NOT NULL DEFAULT 0, remarks TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE airports (icao TEXT PRIMARY KEY, iata TEXT, name TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL);
  `);
  await run("INSERT INTO flights (date, departure_airport, arrival_airport, tail_number, total_time) VALUES ('2020-05-01','KPAO','KSQL','N123AB',2.3)");
  await run("INSERT INTO airports (icao, name, lat, lon) VALUES ('KPAO','Palo Alto Airport',37.46,-122.11)");

  await migrate();

  const flights = await all('SELECT * FROM flights');
  assert.equal(flights.length, 1);
  assert.equal(flights[0].tail_number, 'N123AB'); // old data intact
  assert.equal(flights[0].date, '2020-05-01');
  assert.equal(flights[0].route, null); // new column added, backward compatible
  const airportCols = await all("SELECT name FROM pragma_table_info('airports')");
  assert.ok(airportCols.some((c) => c.name === 'ident')); // reshaped to the current airports schema
});
