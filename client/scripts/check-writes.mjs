// WRITE TEST for the redesigned screens, through the real UI, on the SCRATCH app only. It prints which backend it points at BEFORE the first write and
// refuses to run against anything that looks like the real local database. Every change is read back from the API (not from the screen).
//   covers: add / edit / delete an expense (confirm step), log a ground session, Quick log, log a flight review, mark a manual milestone complete and
//   undo it, log a pilot flight with an instructor suggestion and an invoice reference, log a passenger flight, save Cost settings.
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

// ---- expenses
await go('/costs/expenses');
const ex0 = (await api('/costs/expenses')).length;
await press('Add expense');
await p.getByLabel('Amount ($)').fill('12.34'); await p.getByLabel('Note (optional)').fill('Write test item');
await p.locator('[role="dialog"]').getByRole('button', { name: 'Save', exact: true }).click(); await p.waitForTimeout(900);
let ex = await api('/costs/expenses'); const mine = ex.find((e) => e.note === 'Write test item');
ok(ex.length === ex0 + 1 && mine && Number(mine.amount) === 12.34, 'an expense was added and read back (12.34, "Write test item")');
ok(await p.getByText('Write test item').count() > 0, 'the new expense appears in the list');
await p.getByRole('button', { name: /Write test item.*Edit/ }).click(); await p.waitForTimeout(500);
await p.getByLabel('Amount ($)').fill('15.50'); await p.locator('[role="dialog"]').getByRole('button', { name: 'Save', exact: true }).click(); await p.waitForTimeout(900);
ok(Number((await api('/costs/expenses')).find((e) => e.id === mine.id)?.amount) === 15.5, 'the expense was edited (15.50)');
await p.getByRole('button', { name: 'Delete Write test item' }).click(); await p.waitForTimeout(500);
ok((await api('/costs/expenses')).some((e) => e.id === mine.id), 'delete asks first: nothing deleted before the confirmation');
await p.locator('[role="dialog"]').getByRole('button', { name: 'Delete', exact: true }).click(); await p.waitForTimeout(900);
ok(!(await api('/costs/expenses')).some((e) => e.id === mine.id), 'confirming the delete removed it');

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

// ---- log a pilot flight: suggestion and invoice reference
await go('/logbook');
await p.evaluate(() => localStorage.clear()); await go('/logbook/new');
const sugg = await p.locator('#instructor-names option').evaluateAll((os) => os.map((o) => o.value));
ok(sugg.includes('Pat Rivera') || sugg.length > 0, `the instructor field offers the names already used (${sugg.slice(0, 3).join(', ') || 'none yet'})`);
await p.getByLabel('Instructor').fill(sugg[0] || 'Pat Rivera'); await p.keyboard.press('Tab'); await p.waitForTimeout(200);
if (!(await p.getByLabel('Invoice reference (optional)').isVisible())) { await p.getByRole('button', { name: /More details/ }).click(); await p.waitForTimeout(300); }
await p.getByLabel('Invoice reference (optional)').fill('WRITE-TEST-1');
await press('Add flight');
await p.waitForTimeout(900);
const fl = (await api('/flights')).find((f) => f.invoice_ref === 'WRITE-TEST-1');
ok(Boolean(fl) && fl.role === 'pilot' && Boolean(fl.instructor), `a pilot flight was saved with an instructor and invoice reference (${fl?.instructor ?? '-'}, ${fl?.invoice_ref ?? '-'})`);

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

// ---- cost settings
await go('/costs/settings');
await p.getByLabel(/Default ground briefing time/).fill('1.2'); await press('Save');
ok(Number((await api('/settings')).default_ground_time) === 1.2 && (await p.getByRole('status').filter({ hasText: 'Saved' }).count()) === 1, 'Cost settings saved, persisted and confirmed');

ok(errs.length === 0, `no console or page errors (${errs.slice(0, 2).join(' | ') || 'none'})`);
await browser.close();
console.log(`${checks - fails.length}/${checks} write checks passed`);
process.exit(fails.length ? 1 : 0);
