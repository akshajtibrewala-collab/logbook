import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
const { run, get, all } = await import('../db.js');
const { migrate } = await import('../migrate.js');
const job = await import('./registration-job.js');
const { FIXTURES } = await import('./flight-data.fixtures.js');

const NOW = new Date('2026-06-15T06:00:00.000Z');
const UNITS = 'x-ratelimit-api-units-remaining';
const noSleep = async () => {};

await migrate();

let seq = 0;
async function addFlight(over = {}) {
  seq += 1;
  const f = {
    date: '2026-05-20', dep: 'ZZAA', arr: 'ZZBB', role: 'passenger', fn: `ZZ${100 + seq}`, tail: null, total: 1,
    ...over,
  };
  const { lastId } = await run(
    `INSERT INTO flights (date, departure_airport, arrival_airport, role, total_time, flight_number, tail_number, aircraft_type,
        aircraft_id, reg_cleared_at, reg_checked_at, reg_check_count)
     VALUES (:date, :dep, :arr, :role, :total, :fn, :tail, :type, :aid, :cleared, :checked, :count)`,
    { date: f.date, dep: f.dep, arr: f.arr, role: f.role, total: f.total, fn: f.fn, tail: f.tail, type: f.type ?? null,
      aid: f.aid ?? null, cleared: f.cleared ?? null, checked: f.checked ?? null, count: f.count ?? null },
  );
  return lastId;
}

// A provider stub: answers by call order from `answers`, records every request, never touches the network.
function stub(answers) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, headers: opts.headers });
    const a = answers[Math.min(calls.length - 1, answers.length - 1)];
    return {
      status: a.status ?? 200,
      headers: new Headers({ [UNITS]: '400', ...(a.headers ?? {}) }),
      json: async () => { if (a.badJson) throw new Error('bad'); return a.body; },
    };
  };
  return { fetchImpl, calls };
}

const baseOpts = (s, extra = {}) => ({ key: 'test-key', fetchImpl: s.fetchImpl, sleep: noSleep, now: NOW, maxCalls: 5, reserve: 40, log: () => {}, ...extra });
const row = (id) => get('SELECT * FROM flights WHERE id = ?', [id]);

beforeEach(async () => {
  await run('DELETE FROM flights');
  await run('DELETE FROM aircraft');
});

test('no eligible flight: nothing is called and nothing is written', async () => {
  await addFlight({ role: 'pilot' });
  await addFlight({ tail: 'N9KEEP' });
  const s = stub([{ body: FIXTURES.normal }]);
  const r = await job.runRegistrationJob(baseOpts(s));
  assert.equal(r.due, 0);
  assert.equal(s.calls.length, 0);
});

test('fills a blank registration, records provenance, links an auto-created aircraft', async () => {
  const id = await addFlight();
  const before = await row(id);
  const s = stub([{ body: FIXTURES.normal, headers: { [UNITS]: '300' } }]);
  const r = await job.runRegistrationJob(baseOpts(s));
  assert.equal(r.filled, 1);
  assert.equal(r.remainingUnits, 300);
  const f = await row(id);
  assert.equal(f.tail_number, 'N1TEST');
  assert.equal(f.reg_source, 'aerodatabox');
  assert.equal(f.reg_filled_at, NOW.toISOString());
  assert.equal(f.reg_check_count, 1);
  assert.ok(f.aircraft_id);
  const ac = await get('SELECT * FROM aircraft WHERE id = ?', [f.aircraft_id]);
  assert.equal(ac.tail_number, 'N1TEST');
  assert.equal(ac.auto_created_at, NOW.toISOString());
  assert.equal(f.updated_at, before.updated_at); // the job writes no other column, not even updated_at
});

test('an existing aircraft row is linked, not duplicated, and is not marked auto-created', async () => {
  await run("INSERT INTO aircraft (tail_number, model) VALUES ('N1TEST', 'Mine')");
  const id = await addFlight();
  await job.runRegistrationJob(baseOpts(stub([{ body: FIXTURES.normal }])));
  assert.equal((await all('SELECT id FROM aircraft')).length, 1);
  const ac = await get('SELECT * FROM aircraft');
  assert.equal(ac.auto_created_at, null);
  assert.equal((await row(id)).aircraft_id, ac.id);
});

test('idempotent: a second run makes no calls and changes nothing', async () => {
  const id = await addFlight();
  const s = stub([{ body: FIXTURES.normal }]);
  await job.runRegistrationJob(baseOpts(s));
  const after1 = await row(id);
  const s2 = stub([{ body: FIXTURES.normal }]);
  const r2 = await job.runRegistrationJob(baseOpts(s2));
  assert.equal(s2.calls.length, 0);
  assert.equal(r2.due, 0);
  assert.deepEqual(await row(id), after1);
});

test('never overwrites a registration that appears between selection and write', async () => {
  const id = await addFlight();
  await run("UPDATE flights SET tail_number = 'N7MINE' WHERE id = ?", [id]);
  assert.equal(await job.fillRegistration(id, 'N1TEST', NOW.toISOString()), false);
  assert.equal((await row(id)).tail_number, 'N7MINE');
  assert.equal((await row(id)).reg_source, null);
});

test('never fills a pilot flight, a cleared flight or one already linked to an aircraft', async () => {
  const pilot = await addFlight({ role: 'pilot' });
  const cleared = await addFlight({ cleared: '2026-06-01T00:00:00.000Z' });
  await run("INSERT INTO aircraft (tail_number) VALUES ('N5LINK')");
  const linked = await addFlight({ aid: (await get('SELECT id FROM aircraft')).id });
  const s = stub([{ body: FIXTURES.normal }]);
  await job.runRegistrationJob(baseOpts(s));
  assert.equal(s.calls.length, 0);
  for (const id of [pilot, cleared, linked]) assert.equal((await row(id)).tail_number, null);
  assert.equal(await job.fillRegistration(pilot, 'N1TEST', NOW.toISOString()), false);
  assert.equal(await job.fillRegistration(cleared, 'N1TEST', NOW.toISOString()), false);
});

test('window: older than the provider window, today and the future are not looked up', async () => {
  await addFlight({ date: '2025-01-01' });
  await addFlight({ date: '2026-06-15' });
  await addFlight({ date: '2026-07-01' });
  const inside = await addFlight({ date: '2026-06-14' });
  const due = await job.selectDue(NOW);
  assert.deepEqual(due.map((d) => d.id), [inside]);
});

test('rechecks wait 3 days and stop after the maximum number of checks', async () => {
  const recent = await addFlight({ checked: '2026-06-14T06:00:00.000Z', count: 1 });
  const old = await addFlight({ checked: '2026-06-10T06:00:00.000Z', count: 1 });
  const spent = await addFlight({ checked: '2026-06-01T06:00:00.000Z', count: 4 });
  const ids = (await job.selectDue(NOW)).map((d) => d.id);
  assert.ok(ids.includes(old));
  assert.ok(!ids.includes(recent));
  assert.ok(!ids.includes(spent));
});

test('a no-match only marks the row as checked; the registration stays blank', async () => {
  const id = await addFlight();
  const r = await job.runRegistrationJob(baseOpts(stub([{ body: FIXTURES.wrongAirports }])));
  assert.equal(r.nomatch, 1);
  const f = await row(id);
  assert.equal(f.tail_number, null);
  assert.equal(f.reg_source, null);
  assert.equal(f.reg_check_count, 1);
  assert.equal(f.reg_checked_at, NOW.toISOString());
  assert.equal(f.aircraft_id, null);
});

test('the per-run cap limits provider calls and the rest wait for the next run', async () => {
  for (let i = 0; i < 6; i++) await addFlight({ date: `2026-05-${10 + i}` });
  const s = stub([{ body: FIXTURES.normal }]);
  const r = await job.runRegistrationJob(baseOpts(s, { maxCalls: 2 }));
  assert.equal(s.calls.length, 2);
  assert.equal(r.capped, true);
  assert.equal(r.due, 6);
  assert.equal((await job.selectDue(NOW)).length, 4);
});

test('429 stops the run at once and writes nothing for the rest', async () => {
  for (let i = 0; i < 3; i++) await addFlight({ date: `2026-05-${10 + i}` });
  const s = stub([{ status: 429 }]);
  const r = await job.runRegistrationJob(baseOpts(s));
  assert.equal(s.calls.length, 1);
  assert.equal(r.rateLimited, true);
  assert.equal((await all('SELECT id FROM flights WHERE reg_check_count IS NOT NULL')).length, 0);
});

test('stops when the response shows fewer remaining units than the reserve', async () => {
  for (let i = 0; i < 4; i++) await addFlight({ date: `2026-05-${10 + i}` });
  const s = stub([{ body: FIXTURES.normal, headers: { [UNITS]: '39' } }]);
  const r = await job.runRegistrationJob(baseOpts(s, { reserve: 40 }));
  assert.equal(s.calls.length, 1);
  assert.equal(r.reserveStop, true);
  assert.equal(r.remainingUnits, 39);
  assert.equal(r.filled, 1); // the call that revealed the low balance is still used
});

test('a 5xx is retried once, then counted as an error without marking the row', async () => {
  const id = await addFlight();
  const s = stub([{ status: 503 }, { status: 503 }]);
  const r = await job.runRegistrationJob(baseOpts(s));
  assert.equal(s.calls.length, 2);
  assert.equal(r.errors, 1);
  assert.equal((await row(id)).reg_check_count, null);
});

test('a transient 5xx that succeeds on the retry fills the row', async () => {
  const id = await addFlight();
  const r = await job.runRegistrationJob(baseOpts(stub([{ status: 502 }, { body: FIXTURES.normal }])));
  assert.equal(r.filled, 1);
  assert.equal((await row(id)).tail_number, 'N1TEST');
});

test('401 stops the run and is reported without any detail', async () => {
  await addFlight();
  await addFlight({ date: '2026-05-21' });
  const s = stub([{ status: 401 }]);
  const r = await job.runRegistrationJob(baseOpts(s));
  assert.equal(r.authFailed, true);
  assert.equal(s.calls.length, 1);
});

test('missing key does nothing; invalid cap is rejected', async () => {
  await addFlight();
  const s = stub([{ body: FIXTURES.normal }]);
  const r = await job.runRegistrationJob({ ...baseOpts(s), key: undefined });
  assert.equal(r.configured, false);
  assert.equal(s.calls.length, 0);
  await assert.rejects(job.runRegistrationJob(baseOpts(s, { maxCalls: 1.5 })));
});

test('units header missing: the run stops after that one response and makes no further call', async () => {
  for (let i = 0; i < 3; i++) await addFlight({ date: `2026-05-${10 + i}` });
  const lines = [];
  const calls = [];
  const fetchImpl = async (url) => { calls.push(url); return { status: 200, headers: new Headers({ 'x-ratelimit-requests-remaining': '1446', 'x-ratelimit-units-remaining': '300' }), json: async () => FIXTURES.normal }; };
  const r = await job.runRegistrationJob({ ...baseOpts(stub([])), fetchImpl, log: (l) => lines.push(l) });
  assert.equal(calls.length, 1);
  assert.equal(r.unitsHeaderMissing, true);
  assert.equal(r.remainingUnits, null);
  assert.match(lines[0], /units header missing/);
  assert.equal((await job.selectDue(NOW)).length, 2);
});

test('limit and reset are reported from the pinned headers, counts only', async () => {
  await addFlight();
  const lines = [];
  const s = stub([{ body: FIXTURES.normal, headers: { [UNITS]: '120', 'x-ratelimit-api-units-limit': '400', 'x-ratelimit-api-units-reset': '3600' } }]);
  const r = await job.runRegistrationJob(baseOpts(s, { log: (l) => lines.push(l) }));
  assert.equal(r.unitsLimit, 400);
  assert.equal(r.resetSeconds, 3600);
  assert.match(lines[0], /remainingUnits=120 unitsLimit=400 resetSeconds=3600$/);
});

test('the key is sent only in a header and the log line holds counts only', async () => {
  await addFlight({ fn: 'ZZ9999' });
  const lines = [];
  const s = stub([{ body: FIXTURES.normal, headers: { [UNITS]: '120' } }]);
  await job.runRegistrationJob(baseOpts(s, { key: 'SECRET-KEY-VALUE', log: (l) => lines.push(l) }));
  assert.ok(!s.calls[0].url.includes('SECRET-KEY-VALUE'));
  assert.equal(s.calls[0].headers['x-rapidapi-key'], 'SECRET-KEY-VALUE');
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^registrations: due=1 checked=1 filled=1 nomatch=0 errors=0 rateLimited=0 capped=0 reserveStop=0 remainingUnits=120 unitsLimit=unknown resetSeconds=unknown$/);
  for (const secret of ['SECRET-KEY-VALUE', 'ZZ9999', 'N1TEST', '2026-05-20']) assert.ok(!lines[0].includes(secret));
});

test('repair pass links an auto-filled flight a previous run left without an aircraft', async () => {
  const id = await addFlight({ tail: 'N8REPR' });
  await run("UPDATE flights SET reg_source = 'aerodatabox', reg_filled_at = ? WHERE id = ?", [NOW.toISOString(), id]);
  const r = await job.runRegistrationJob(baseOpts(stub([{ body: [] }])));
  assert.equal(r.linked, 1);
  assert.ok((await row(id)).aircraft_id);
});

test('budgetFromEnv: defaults are 1 lookup and a reserve of 40; bad values fall back, never raise the cap', () => {
  assert.deepEqual(job.budgetFromEnv({}), { maxCalls: 1, reserve: 40 });
  assert.deepEqual(job.budgetFromEnv({ FLIGHT_DATA_MAX_PER_RUN: '3', FLIGHT_DATA_UNITS_RESERVE: '100' }), { maxCalls: 3, reserve: 100 });
  assert.deepEqual(job.budgetFromEnv({ FLIGHT_DATA_MAX_PER_RUN: '0' }), { maxCalls: 0, reserve: 40 });
  assert.deepEqual(job.budgetFromEnv({ FLIGHT_DATA_MAX_PER_RUN: '-2', FLIGHT_DATA_UNITS_RESERVE: 'lots' }), { maxCalls: 1, reserve: 40 });
  assert.deepEqual(job.budgetFromEnv({ FLIGHT_DATA_MAX_PER_RUN: '2.5' }), { maxCalls: 1, reserve: 40 });
});
