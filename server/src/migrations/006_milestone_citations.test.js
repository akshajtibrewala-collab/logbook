import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
const { all, get } = await import('../db.js');
const { migrate } = await import('../migrate.js');

test('every milestone requirement has a real regulation citation, not the un-symbolled placeholder text', async () => {
  await migrate();
  const rows = await all('SELECT certificate, requirement_key, notes FROM milestones_config');
  assert.ok(rows.length > 0);
  for (const r of rows) {
    assert.ok(r.notes && r.notes.includes('§'), `${r.certificate}/${r.requirement_key} has no § citation: ${r.notes}`);
  }
});

test('the commercial complex/turbine/TAA requirement cites the correct subsection, (a)(3)(ii) not (a)(3)(i)', async () => {
  const row = await get("SELECT * FROM milestones_config WHERE certificate = 'commercial' AND requirement_key = 'complex_turbine_taa'");
  assert.match(row.notes, /§61\.129\(a\)\(3\)\(ii\)/);
  // and the OR-gate itself is untouched by this citation-only migration
  assert.deepEqual(JSON.parse(row.flight_filter), [{ aircraft_flags: ['is_complex', 'is_turbine', 'is_taa'] }]);
});

test('commercial PIC time and instrument training moved to their correct subsections', async () => {
  const pic = await get("SELECT notes FROM milestones_config WHERE certificate = 'commercial' AND requirement_key = 'pic_time'");
  assert.match(pic.notes, /§61\.129\(a\)\(2\)$/);
  const instr = await get("SELECT * FROM milestones_config WHERE certificate = 'commercial' AND requirement_key = 'instrument_training'");
  assert.match(instr.notes, /§61\.129\(a\)\(3\)\(i\)/);
  assert.equal(instr.sum_field, 'instrument_actual,instrument_simulated');
  assert.equal(instr.min_value, 10);
});

test('previously-missing manual requirements now exist for all three certificates', async () => {
  const keys = async (cert) => (await all('SELECT requirement_key FROM milestones_config WHERE certificate = ?', [cert])).map((r) => r.requirement_key);
  assert.ok((await keys('private')).includes('solo_towered_landings'));
  assert.ok((await keys('instrument')).includes('checkride_prep'));
  const commercialKeys = await keys('commercial');
  for (const k of ['day_xc_100nm', 'night_xc_100nm', 'checkride_prep', 'night_vfr_towered']) {
    assert.ok(commercialKeys.includes(k), `missing commercial/${k}`);
  }
});

test('migrate() run twice does not duplicate the new rows or re-apply the citation updates destructively', async () => {
  const before = (await get('SELECT COUNT(*) AS n FROM milestones_config')).n;
  await migrate();
  const after = (await get('SELECT COUNT(*) AS n FROM milestones_config')).n;
  assert.equal(before, after);
});
