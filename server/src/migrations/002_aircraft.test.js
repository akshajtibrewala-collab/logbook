import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.DB_FILE = ':memory:';
const { run, all, get, client } = await import('../db.js');
const { migrate } = await import('../migrate.js');

// The flights table has to exist before we can seed "pre-existing" flights for the backfill to act on,
// so create it directly from the baseline schema rather than going through migrate() (which would also
// run 002 immediately, before there's any data to back-fill).
const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'schema.sql');
await client.executeMultiple(readFileSync(schemaPath, 'utf8'));

test('backfills one aircraft per normalised tail number, deduplicating case/whitespace, and links flights', async () => {
  // Same real aircraft, entered inconsistently across three flights (as pre-existing data might be).
  await run("INSERT INTO flights (date, tail_number, aircraft_type, total_time) VALUES ('2024-01-01','N123AB','C172',1)");
  await run("INSERT INTO flights (date, tail_number, aircraft_type, total_time) VALUES ('2024-01-02','n123ab','C172',1)");
  await run("INSERT INTO flights (date, tail_number, aircraft_type, total_time) VALUES ('2024-01-03',' N123AB ','C172S',1)");
  // A second, distinct aircraft.
  await run("INSERT INTO flights (date, tail_number, aircraft_type, total_time) VALUES ('2024-01-04','N999ZZ','PA28',1)");
  // A flight with no tail number at all (e.g. a very old import) — should not crash, stays unlinked.
  await run("INSERT INTO flights (date, total_time) VALUES ('2024-01-05',1)");

  await migrate();

  const aircraft = await all('SELECT * FROM aircraft ORDER BY tail_number');
  assert.equal(aircraft.length, 2); // the three N123AB variants collapsed into one
  assert.deepEqual(aircraft.map((a) => a.tail_number), ['N123AB', 'N999ZZ']);

  const flights = await all('SELECT tail_number, aircraft_id FROM flights ORDER BY date');
  const n123 = aircraft.find((a) => a.tail_number === 'N123AB').id;
  assert.deepEqual(flights.slice(0, 3).map((f) => f.aircraft_id), [n123, n123, n123]);
  assert.equal(flights[3].aircraft_id, aircraft.find((a) => a.tail_number === 'N999ZZ').id);
  assert.equal(flights[4].aircraft_id, null); // no tail/type to key on — left unlinked, not guessed at

  // The original, unnormalised text on the flights themselves is untouched.
  const raw = await all("SELECT tail_number FROM flights WHERE date = '2024-01-02'");
  assert.equal(raw[0].tail_number, 'n123ab');
});

test('migrate() run twice does not create duplicate aircraft', async () => {
  const before = (await get('SELECT COUNT(*) AS n FROM aircraft')).n;
  await migrate();
  const after = (await get('SELECT COUNT(*) AS n FROM aircraft')).n;
  assert.equal(before, after);
});
