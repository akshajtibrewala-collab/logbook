import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
const { all, get } = await import('../db.js');
const { migrate } = await import('../migrate.js');

test('seeds milestone requirements for private, instrument and commercial', async () => {
  await migrate();
  const rows = await all('SELECT * FROM milestones_config ORDER BY certificate, sort_order');
  assert.ok(rows.length >= 15);
  const certs = new Set(rows.map((r) => r.certificate));
  assert.deepEqual([...certs].sort(), ['commercial', 'instrument', 'private']);
});

test('the complex/turbine/TAA requirement expresses the OR as an aircraft_flags gate, not hardcoded per-flag rows', async () => {
  const row = await get("SELECT * FROM milestones_config WHERE certificate = 'commercial' AND requirement_key = 'complex_turbine_taa'");
  assert.ok(row);
  const filter = JSON.parse(row.flight_filter);
  assert.deepEqual(filter, [{ aircraft_flags: ['is_complex', 'is_turbine', 'is_taa'] }]);
  assert.equal(row.sum_field, 'dual_received');
  assert.equal(row.min_value, 10);
});

test('migrate() run twice does not duplicate or error (ON CONFLICT DO NOTHING)', async () => {
  const before = (await get('SELECT COUNT(*) AS n FROM milestones_config')).n;
  await migrate();
  const after = (await get('SELECT COUNT(*) AS n FROM milestones_config')).n;
  assert.equal(before, after);
});

test('manual requirements (single-flight geometry, recency windows) are flagged, not approximated', async () => {
  const manual = await all('SELECT requirement_key FROM milestones_config WHERE manual = 1');
  assert.ok(manual.some((r) => r.requirement_key === 'solo_xc_150nm'));
  assert.ok(manual.some((r) => r.requirement_key === 'checkride_prep'));
  assert.ok(manual.some((r) => r.requirement_key === 'instrument_xc'));
  assert.ok(manual.some((r) => r.requirement_key === 'solo_xc_300nm'));
});
