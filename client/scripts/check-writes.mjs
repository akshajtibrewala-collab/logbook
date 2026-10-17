// WRITE TEST for the redesigned screens, through the real UI, on the SCRATCH app only. It prints which backend it points at BEFORE the first write and
// refuses to run against anything that looks like the real local database. Every change is read back from the API (not from the screen).
//   covers: log a ground session, Quick log, log a flight review, mark a manual milestone complete and undo it, log a pilot flight
//   (the flight form has no instructor input since 2026-10-17), log a passenger flight, and that editing a flight and a ground session leaves the stored
//   cost override, invoice reference, instructor, debrief notes, dual-given and simulator time exactly as they were. Photos and the auto-registration marker are gone.
//
//   PLAYWRIGHT_CORE=<playwright-core folder> BROWSER_EXE=<chromium> node client/scripts/check-writes.mjs --scratch --base http://localhost:4174
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:4174');
const REAL_FLIGHTS = Number(process.env.REAL_LOCAL_FLIGHTS || 93);
if (!process.argv.includes('--scratch')) { console.error('Refusing: this test writes. Pass --scratch and point --base at the scratch app (:4174).'); process.exit(2); }
if (!process.env.PLAYWRIGHT_CORE || !process.env.BROWSER_EXE) { console.error('Set PLAYWRIGHT_CORE and BROWSER_EXE (see check-controls.mjs).'); process.exit(2); }
const api = async (p, init) => (await fetch(`${BASE}/api${p}`, init)).json();
const flights0 = await api('/flights');
console.log(`BACKEND for this write test: ${BASE} -> API with ${flights0.length} flights (${flights0.filter((f) => f.role === 'pilot').length} pilot): scratch placeholder data`);
if (flights0.length === REAL_FLIGHTS) { console.error(`Refusing: ${REAL_FLIGHTS} flights looks like the real local database.`); process.exit(2); }

const { chromium } = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXE });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const p = await ctx.newPage();
await p.route(/arcgisonline|basemaps\.cartocdn|tile\.openstreetmap/, (r) => r.abort());
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && !/tile|Failed to load|net::ERR/.test(m.text()) && errs.push(m.text().slice(0, 100)));
let checks = 0; const fails = [];
const ok = (c, m) => { checks++; console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m); };
const go = async (r) => { await p.goto(BASE + r, { waitUntil: 'networkidle' }); await p.waitForTimeout(400); };
const press = async (name, exact = true) => { await p.getByRole('button', { name, exact }).first().click(); await p.waitForTimeout(500); };

// ---- ground session
const g0 = (await api('/costs/ground-sessions')).length;
await go('/logbook/ground/new');
await p.getByLabel('Topics covered (optional)').fill('Write test topic');
await p.getByLabel('Instructor (optional)').fill('Pat Rivera');
await press('Log ground session');
const gs = await api('/costs/ground-sessions');
ok(gs.length === g0 + 1 && gs.some((g) => g.topics === 'Write test topic' && g.instructor === 'Pat Rivera'), 'a ground session was logged with its instructor');

// ---- Quick log
const f0 = (await api('/flights')).length;
await go('/logbook/quick');
await p.getByRole('button', { name: /^N\d/ }).first().click().catch(() => {});
await press('Save flight');
await p.waitForTimeout(800);
ok((await api('/flights')).length === f0 + 1, 'Quick log saved one flight');

// ---- flight review
await go('/currency');
const r0 = (await api('/reviews')).length;
await p.getByRole('button', { name: /^Flight review:/ }).click(); await p.waitForTimeout(600);
await press('Log a flight review');
await p.locator('.ds-sheet.is-open').getByRole('button', { name: 'Save', exact: true }).click(); await p.waitForTimeout(900);
ok((await api('/reviews')).length === r0 + 1, 'a flight review was logged from its sheet');

// ---- manual milestone
await go('/milestones');
const done0 = (await api('/milestone-completions')).length;
let marked = false; let markedLabel = '';
for (const row of await p.locator('.mn-prog').all()) {
  if ((await row.innerText()).includes('To do')) { markedLabel = await row.locator('.l').innerText(); await row.click(); await p.waitForTimeout(500); await press('Mark complete'); await p.locator('[role="dialog"]').getByRole('button', { name: 'Save', exact: true }).click(); await p.waitForTimeout(900); marked = true; break; }
}
const done1 = await api('/milestone-completions');
ok(marked ? done1.length === done0 + 1 : true, marked ? 'a manual requirement was marked complete' : 'no open manual requirement on the scratch data (skipped)');
if (marked) {
  await go('/milestones');
  const row = p.locator('.mn-prog', { hasText: markedLabel }).first(); await row.click(); await p.waitForTimeout(500); await press('Undo completion'); await p.waitForTimeout(800);
  ok((await api('/milestone-completions')).length === done0, 'the completion was undone');
}

// ---- log a pilot flight: suggestion
const idsBefore = new Set((await api('/flights')).map((f) => f.id));
await go('/logbook');
await p.evaluate(() => localStorage.clear()); await go('/logbook/new');
ok(!(await p.getByLabel('Instructor').count()) && !(await p.locator('#instructor-names').count()), 'the pilot flight form has no instructor input');
await press('Add flight');
await p.waitForTimeout(900);
const fl = (await api('/flights')).find((f) => !idsBefore.has(f.id));
ok(Boolean(fl) && fl.role === 'pilot', 'a pilot flight was saved');
ok(!(await p.getByText(/invoice|cost/i).count()), 'the flight form shows no invoice or cost wording');

// ---- log a passenger flight
await go('/logbook/new?role=passenger&from=travel');
await p.getByLabel('Airline').first().fill('Write Test Air');
await p.getByLabel('Flight number').fill('WT1');
await p.getByLabel('From').first().fill('KSUS'); await p.getByLabel('To').first().fill('KORD');
await press('Enter duration manually instead').catch(() => {});
await p.waitForTimeout(300);
const total = p.getByLabel(/Flight time|Duration|Hours/).first(); if (await total.count()) await total.fill('2.5').catch(() => {});
await press('Add flight');
await p.waitForTimeout(900);
const pax = (await api('/flights')).find((f) => f.airline === 'Write Test Air');
ok(Boolean(pax) && pax.role === 'passenger', 'a passenger flight was saved through the shared form');

// ---- the automatic registration marker and its Clear action are gone
if (pax) {
  await go(`/travel/${pax.id}`);
  ok(await p.getByRole('button', { name: /filled automatically/i }).count() === 0, 'no auto-registration marker on a passenger flight');
  const gone = await fetch(`${BASE}/api/flights/${pax.id}/clear-registration`, { method: 'POST' });
  ok(gone.status === 404, `the clear-registration route is gone (${gone.status})`);
}

// ---- cost data survives edits (no cost screen or field is left in the UI, but the stored values must not be erased by an edit)
const post = async (path, body) => (await fetch(`${BASE}/api${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();
const tmpl = (await api('/flights')).find((f) => f.role === 'pilot');
const { id: _i, created_at: _c, updated_at: _u, ...base } = tmpl;
const kept = await post('/flights', { ...base, remarks: 'keep test', cost_override: 123.45, invoice_ref: 'KEEP-1', instructor: 'Pat Keep', debrief_went_well: 'kept well', debrief_work_on: 'kept work', dual_given: 0.4, simulator_time: 0.3 });
ok(Boolean(kept.id) && Number(kept.cost_override) === 123.45, 'a scratch flight with a stored cost override and invoice reference was created through the API');
await go(`/logbook/${kept.id}`);
ok(!(await p.getByText(/\bcost\b/i).count()) && !(await p.getByText(/invoice/i).count()), 'the flight detail shows no cost or invoice');
await go(`/logbook/${kept.id}/edit`);
if (!(await p.getByLabel('Remarks').isVisible())) { await p.getByRole('button', { name: /More details/ }).click(); await p.waitForTimeout(300); }
ok(!(await p.getByText(/invoice|manual override|calculated cost/i).count()), 'the flight edit form has no cost or invoice inputs');
ok(!(await p.getByLabel('Instructor').count()) && !(await p.getByText('What went well').count()) && !(await p.getByText('Dual given').count()) && !(await p.getByLabel('Simulator').count()) && !(await p.getByText('Photos').count()), 'the flight edit form has no instructor, debrief, dual-given, simulator or photo inputs');
await p.getByLabel('Remarks').fill('keep test, edited'); await press('Save changes'); await p.waitForTimeout(900);
const after = (await api('/flights')).find((f) => f.id === kept.id);
ok(after && after.instructor === 'Pat Keep' && after.debrief_went_well === 'kept well' && after.debrief_work_on === 'kept work' && Number(after.dual_given) === 0.4 && Number(after.simulator_time) === 0.3, `editing the flight kept its instructor, debrief notes, dual given and simulator time (${after?.instructor ?? '-'})`);
ok(after && after.remarks === 'keep test, edited' && Number(after.cost_override) === 123.45 && after.invoice_ref === 'KEEP-1', `editing the flight kept its cost override and invoice reference (${after?.cost_override ?? '-'}, ${after?.invoice_ref ?? '-'})`);
const gk = await post('/costs/ground-sessions', { date: '2026-01-05', hours: 1, instructor: 'Pat Keep', topics: 'keep ground', notes: '', cost_override: 77.7 });
await go(`/logbook/ground/${gk.id}/edit`);
ok(!(await p.getByText(/manual cost override|calculated cost|^cost$/i).count()), 'the ground session form has no cost inputs');
await p.getByLabel('Topics covered (optional)').fill('keep ground, edited'); await press('Save changes'); await p.waitForTimeout(900);
const gafter = (await api('/costs/ground-sessions')).find((g) => g.id === gk.id);
ok(gafter && gafter.topics === 'keep ground, edited' && Number(gafter.cost_override) === 77.7, `editing the ground session kept its cost override (${gafter?.cost_override ?? '-'})`);
await go(`/logbook/ground/${gk.id}`);
ok(!(await p.getByText(/\bcost\b/i).count()), 'the ground session detail shows no cost');
// tidy the scratch rows this section made (scratch only; the test refuses to run anywhere else)
await fetch(`${BASE}/api/flights/${kept.id}`, { method: 'DELETE' }); await fetch(`${BASE}/api/costs/ground-sessions/${gk.id}`, { method: 'DELETE' });

ok(errs.length === 0, `no console or page errors (${errs.slice(0, 2).join(' | ') || 'none'})`);
await browser.close();
console.log(`${checks - fails.length}/${checks} write checks passed`);
process.exit(fails.length ? 1 : 0);
