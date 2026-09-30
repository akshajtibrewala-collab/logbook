import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
const { run, get } = await import('../db.js');
const { migrate } = await import('../migrate.js');

test('adds dep_time, arr_time, arr_day_offset to flights, NULL by default', async () => {
  await migrate();
  await run(
    `INSERT INTO flights (date, departure_airport, arrival_airport, role, total_time) VALUES (:date, :dep, :arr, :role, :t)`,
    { date: '2026-01-01', dep: 'KSTL', arr: 'KORD', role: 'pilot', t: 1 },
  );
  const row = await get('SELECT dep_time, arr_time, arr_day_offset FROM flights ORDER BY id DESC LIMIT 1');
  assert.equal(row.dep_time, null);
  assert.equal(row.arr_time, null);
  assert.equal(row.arr_day_offset, null);
});

test('dep_time/arr_time/arr_day_offset round-trip', async () => {
  await migrate();
  await run(
    `INSERT INTO flights (date, departure_airport, arrival_airport, role, total_time, dep_time, arr_time, arr_day_offset)
     VALUES (:date, :dep, :arr, :role, :t, :dt, :at, :off)`,
    { date: '2026-06-15', dep: 'KSTL', arr: 'KJFK', role: 'passenger', t: 1.83, dt: '16:25', at: '19:15', off: 0 },
  );
  const row = await get('SELECT dep_time, arr_time, arr_day_offset FROM flights ORDER BY id DESC LIMIT 1');
  assert.equal(row.dep_time, '16:25');
  assert.equal(row.arr_time, '19:15');
  assert.equal(row.arr_day_offset, 0);
});

test('running migrate() again does not error', async () => {
  await migrate();
  assert.ok(true);
});
