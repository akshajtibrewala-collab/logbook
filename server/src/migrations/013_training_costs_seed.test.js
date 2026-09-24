import { test } from 'node:test';
import assert from 'node:assert/strict';

// Exercises 013's up() function directly against a hand-built database that already has aircraft
// (simulating an existing installation being upgraded), rather than through migrate() — migrate() only
// ever runs 013 once per database, so it can't easily be made to see pre-existing data at the moment 013
// itself runs; 013_training_costs.test.js already covers the normal (empty-database) path through migrate().
process.env.DB_FILE = ':memory:';
const { run, get, all, client } = await import('../db.js');
const up013 = (await import('./013_training_costs.js')).default;

test('seeds one aircraft_rates row per non-simulator aircraft, effective 2026-07-10 regardless of any flight dates', async () => {
  await client.executeMultiple(`
    CREATE TABLE aircraft (id INTEGER PRIMARY KEY AUTOINCREMENT, tail_number TEXT, model TEXT, is_simulator INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE flights (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, total_time REAL NOT NULL DEFAULT 0);
    CREATE TABLE pilot_settings (id INTEGER PRIMARY KEY CHECK (id = 1));
  `);
  await run("INSERT INTO aircraft (tail_number, model) VALUES ('N123AB', '172S')");
  await run("INSERT INTO aircraft (tail_number, model, is_simulator) VALUES ('SIM1', 'Redbird', 1)");
  await run("INSERT INTO flights (date, total_time) VALUES ('2026-08-28', 1)"); // later than the seed date, on purpose

  await up013({ all, get, run, client });

  const rates = await all('SELECT * FROM aircraft_rates ORDER BY id');
  assert.equal(rates.length, 1); // only the non-simulator aircraft got a rate
  assert.equal(rates[0].rental_rate_per_hr, 195);
  assert.equal(rates[0].fuel_surcharge_per_hr, 15);
  assert.equal(rates[0].effective_date, '2026-07-10');

  const instructor = await get('SELECT * FROM instructor_rates');
  assert.equal(instructor.effective_date, '2026-07-10');
  assert.equal(instructor.hourly_rate, 85);
});

test('running up() again does not duplicate rates', async () => {
  await up013({ all, get, run, client });
  const count = (await get('SELECT COUNT(*) AS n FROM aircraft_rates')).n;
  assert.equal(count, 1);
});
