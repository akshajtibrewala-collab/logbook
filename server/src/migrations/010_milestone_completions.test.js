import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
const { run, get } = await import('../db.js');
const { migrate } = await import('../migrate.js');

test('creates the milestone_completions table, keyed by (certificate, requirement_key)', async () => {
  await migrate();
  await run(
    "INSERT INTO milestone_completions (certificate, requirement_key, completed_at, note) VALUES ('private', 'solo_xc_150nm', '2026-03-01', 'Flew KPAO-KSNS-KWVI-KPAO')",
  );
  const row = await get("SELECT * FROM milestone_completions WHERE certificate = 'private' AND requirement_key = 'solo_xc_150nm'");
  assert.equal(row.completed_at, '2026-03-01');
  assert.equal(row.note, 'Flew KPAO-KSNS-KWVI-KPAO');

  await assert.rejects(run(
    "INSERT INTO milestone_completions (certificate, requirement_key, completed_at) VALUES ('private', 'solo_xc_150nm', '2026-04-01')",
  )); // primary key prevents a duplicate; the route uses INSERT OR REPLACE for the toggle-on case
});

test('migrate() run twice does not error', async () => {
  await migrate();
  assert.ok(true);
});
