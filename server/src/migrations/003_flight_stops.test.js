import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.DB_FILE = ':memory:';
const { run, all, get, client } = await import('../db.js');
const { migrate } = await import('../migrate.js');

// Seed data "pre-existing" a schema change has to exist before that migration runs, so create the base
// schema directly rather than through migrate() (which would run 003's backfill immediately, before
// there's anything to back-fill).
const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'schema.sql');
await client.executeMultiple(readFileSync(schemaPath, 'utf8'));

test('backfills flight_stops from route text, defaulting to full_stop, keeping route untouched', async () => {
  await run("INSERT INTO flights (date, departure_airport, arrival_airport, route, total_time) VALUES ('2024-01-01','KSUS','KSUS','KFYG',1)");
  await run("INSERT INTO flights (date, departure_airport, arrival_airport, route, total_time) VALUES ('2024-01-02','KPAO','KSQL','KHAF KOAK',1)");
  await run("INSERT INTO flights (date, total_time) VALUES ('2024-01-03', 1)"); // no route at all

  await migrate();

  const [f1, f2, f3] = await Promise.all([1, 2, 3].map((id) => get('SELECT * FROM flights WHERE id = ?', [id])));
  assert.equal(f1.route, 'KFYG'); // untouched
  assert.equal(f2.route, 'KHAF KOAK');

  const stops1 = await all('SELECT sequence, airport_code, stop_type FROM flight_stops WHERE flight_id = 1 ORDER BY sequence');
  assert.deepEqual(stops1, [{ sequence: 0, airport_code: 'KFYG', stop_type: 'full_stop' }]);

  const stops2 = await all('SELECT sequence, airport_code, stop_type FROM flight_stops WHERE flight_id = 2 ORDER BY sequence');
  assert.deepEqual(stops2.map((s) => s.airport_code), ['KHAF', 'KOAK']);
  assert.ok(stops2.every((s) => s.stop_type === 'full_stop'));

  const stops3 = await all('SELECT * FROM flight_stops WHERE flight_id = 3');
  assert.equal(stops3.length, 0);
});

test('migrate() run twice does not duplicate stops', async () => {
  const before = (await get('SELECT COUNT(*) AS n FROM flight_stops')).n;
  await migrate();
  const after = (await get('SELECT COUNT(*) AS n FROM flight_stops')).n;
  assert.equal(before, after);
});

test('deleting a flight also removes its stops', async () => {
  const stopsBefore = (await get('SELECT COUNT(*) AS n FROM flight_stops WHERE flight_id = 1')).n;
  assert.ok(stopsBefore > 0);
  await run('DELETE FROM flight_stops WHERE flight_id = ?', [1]); // the app route does this explicitly, not via FK cascade
  await run('DELETE FROM flights WHERE id = ?', [1]);
  const stopsAfter = (await get('SELECT COUNT(*) AS n FROM flight_stops WHERE flight_id = 1')).n;
  assert.equal(stopsAfter, 0);
});
