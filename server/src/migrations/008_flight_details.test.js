import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
const { run, all, get } = await import('../db.js');
const { migrate } = await import('../migrate.js');

test('adds the new flight columns, defaulting existing rows to 0/null, and creates flight_approaches', async () => {
  await migrate();
  const { lastId } = await run("INSERT INTO flights (date, total_time) VALUES ('2026-01-01', 1)");
  const flight = await get('SELECT * FROM flights WHERE id = ?', [lastId]);
  assert.equal(flight.flight_number, null);
  assert.equal(flight.dual_given, 0);
  assert.equal(flight.simulator_time, 0);
  assert.equal(flight.debrief_went_well, null);
  assert.equal(flight.debrief_work_on, null);
  assert.equal(flight.day_landings_full_stop, 0);
  assert.equal(flight.night_landings_full_stop, 0);

  await run('INSERT INTO flight_approaches (flight_id, approach_type, count) VALUES (?, ?, ?)', [lastId, 'ILS', 2]);
  const approaches = await all('SELECT approach_type, count FROM flight_approaches WHERE flight_id = ?', [lastId]);
  assert.deepEqual(approaches, [{ approach_type: 'ILS', count: 2 }]);
});

test('migrate() run twice does not error or duplicate columns', async () => {
  await migrate();
  const cols = await all("SELECT name FROM pragma_table_info('flights')");
  assert.equal(cols.filter((c) => c.name === 'flight_number').length, 1);
});

test('a flight logged before this migration keeps its existing data untouched', async () => {
  const { lastId } = await run(
    "INSERT INTO flights (date, departure_airport, arrival_airport, total_time, day_landings) VALUES ('2020-01-01','KPAO','KSQL',2.3,3)",
  );
  const flight = await get('SELECT * FROM flights WHERE id = ?', [lastId]);
  assert.equal(flight.departure_airport, 'KPAO');
  assert.equal(flight.day_landings, 3);
  assert.equal(flight.day_landings_full_stop, 0); // new column, defaulted, not guessed at
});
