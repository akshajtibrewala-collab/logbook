import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
const { run, get, all } = await import('../db.js');
const { migrate } = await import('../migrate.js');

const cols = async (table) => (await all(`SELECT name FROM pragma_table_info('${table}')`)).map((c) => c.name);

test('adds the five flight columns and the aircraft column, NULL by default', async () => {
  await migrate();
  const f = await cols('flights');
  for (const c of ['reg_source', 'reg_filled_at', 'reg_cleared_at', 'reg_checked_at', 'reg_check_count']) assert.ok(f.includes(c), c);
  assert.ok((await cols('aircraft')).includes('auto_created_at'));

  await run(
    "INSERT INTO flights (date, departure_airport, arrival_airport, role, total_time) VALUES ('2026-01-01', 'KSTL', 'KORD', 'passenger', 1)",
  );
  const row = await get('SELECT * FROM flights ORDER BY id DESC LIMIT 1');
  for (const c of ['reg_source', 'reg_filled_at', 'reg_cleared_at', 'reg_checked_at', 'reg_check_count']) assert.equal(row[c], null, c);
});

test('reg_source accepts NULL and a known provider, rejects anything else', async () => {
  await migrate();
  await run("INSERT INTO flights (date, departure_airport, arrival_airport, role, total_time, reg_source) VALUES ('2026-01-02', 'KSTL', 'KORD', 'passenger', 1, 'aerodatabox')");
  await assert.rejects(
    run("INSERT INTO flights (date, departure_airport, arrival_airport, role, total_time, reg_source) VALUES ('2026-01-03', 'KSTL', 'KORD', 'passenger', 1, 'someone-else')"),
  );
});

test('existing rows and values are unchanged by running migrate() again', async () => {
  await migrate();
  const before = await get('SELECT COUNT(*) n, COALESCE(SUM(total_time),0) h FROM flights');
  await migrate();
  const after = await get('SELECT COUNT(*) n, COALESCE(SUM(total_time),0) h FROM flights');
  assert.deepEqual(after, before);
  assert.equal((await cols('flights')).filter((c) => c === 'reg_source').length, 1);
});
