import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
const { run, get, all } = await import('../db.js');
const { migrate } = await import('../migrate.js');

test('adds certificate to every rate table, backfilling existing rows to private', async () => {
  await migrate();
  for (const table of ['aircraft_rates', 'instructor_rates', 'ground_rates', 'simulator_rates']) {
    const cols = (await all(`SELECT name FROM pragma_table_info('${table}')`)).map((c) => c.name);
    assert.ok(cols.includes('certificate'), `${table} should have certificate`);
  }
  const instructor = await get('SELECT * FROM instructor_rates LIMIT 1');
  assert.equal(instructor.certificate, 'private'); // backfilled by the DEFAULT clause
});

test('adds track_costs to training_phases and seeds a Private phase, on if none existed', async () => {
  const cols = (await all("SELECT name FROM pragma_table_info('training_phases')")).map((c) => c.name);
  assert.ok(cols.includes('track_costs'));
  const phase = await get("SELECT * FROM training_phases WHERE certificate = 'private'");
  assert.equal(phase.start_date, '2026-07-10');
  assert.equal(phase.end_date, null);
  assert.equal(phase.track_costs, 1);
});

test('does not overwrite an existing Private phase\'s own edited dates', async () => {
  await run("UPDATE training_phases SET start_date = '2026-06-01', end_date = '2026-12-31' WHERE certificate = 'private'");
  const up015 = (await import('./015_phase_scoped_costs.js')).default;
  await up015({ all, get, run });
  const phase = await get("SELECT * FROM training_phases WHERE certificate = 'private'");
  assert.equal(phase.start_date, '2026-06-01');
  assert.equal(phase.end_date, '2026-12-31');
});

test('migrate() run twice does not error or duplicate the Private phase', async () => {
  await migrate();
  const count = (await get("SELECT COUNT(*) AS n FROM training_phases WHERE certificate = 'private'")).n;
  assert.equal(count, 1);
});
