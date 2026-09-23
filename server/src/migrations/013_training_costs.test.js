import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
const { run, get, all } = await import('../db.js');
const { migrate } = await import('../migrate.js');

test('adds ground_time/cost_override to flights and two settings columns', async () => {
  await migrate();
  const flightCols = (await all("SELECT name FROM pragma_table_info('flights')")).map((c) => c.name);
  assert.ok(flightCols.includes('ground_time'));
  assert.ok(flightCols.includes('cost_override'));
  const settingsCols = (await all("SELECT name FROM pragma_table_info('pilot_settings')")).map((c) => c.name);
  assert.ok(settingsCols.includes('default_ground_time'));
  assert.ok(settingsCols.includes('private_realistic_total_hours'));
});

test('creates the rate, expense, ground-session and training-phase tables', async () => {
  for (const t of ['aircraft_rates', 'instructor_rates', 'ground_rates', 'simulator_rates', 'other_expenses', 'ground_sessions', 'training_phases']) {
    assert.ok(await get(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${t}'`), `${t} should exist`);
  }
});

test('seeds instructor/ground rates at $85 effective 2026-07-10, and no aircraft rates when no aircraft exist', async () => {
  const instructor = await get('SELECT * FROM instructor_rates ORDER BY id LIMIT 1');
  assert.equal(instructor.hourly_rate, 85);
  assert.equal(instructor.effective_date, '2026-07-10');
  const ground = await get('SELECT * FROM ground_rates ORDER BY id LIMIT 1');
  assert.equal(ground.hourly_rate, 85);
  assert.equal(ground.effective_date, '2026-07-10');
  const aircraftRateCount = (await get('SELECT COUNT(*) AS n FROM aircraft_rates')).n;
  assert.equal(aircraftRateCount, 0); // no aircraft rows existed to seed a rate for
});

test('migrate() run twice does not error and does not duplicate seeded rates', async () => {
  await migrate();
  const count = (await get('SELECT COUNT(*) AS n FROM instructor_rates')).n;
  assert.equal(count, 1);
});
