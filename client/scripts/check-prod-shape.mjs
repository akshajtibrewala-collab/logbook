// PRODUCTION-SHAPED CHECK (read-only). Run against a scratch COPY built from a production backup (never against production itself). It reads the production
// expectations from the private local config (client/scripts/.local-expected.json, "production": totals, total spent, cost per pilot hour, and the blank-instructor
// "cases"), then proves on the screens:
//   - the Costs page: total spent and cost per pilot hour
//   - the Logbook rows: the cases (a flight with no instructor says "Solo" only when it has solo time), the usual instructor shows nothing on a row, any other
//     instructor shows as first initial and surname, and the accessible names still carry the full name
//
//   PLAYWRIGHT_CORE=<..> BROWSER_EXE=<..> node client/scripts/check-prod-shape.mjs --base http://localhost:4177 --api http://localhost:3005
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { profileExpected, loadLocalExpected } from './lib/localExpected.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:4177'), API = arg('--api', 'http://localhost:3005');
const exp = profileExpected('production'); const inst = loadLocalExpected()?.instructors;
if (!exp || !inst) { console.error('Needs client/scripts/.local-expected.json with "production" and "instructors".'); process.exit(2); }
if (!process.env.PLAYWRIGHT_CORE || !process.env.BROWSER_EXE) { console.error('Set PLAYWRIGHT_CORE and BROWSER_EXE.'); process.exit(2); }
const { chromium } = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);
const rows = []; const fails = [];
const rec = (check, found, expected, ok) => { rows.push({ check, found, expected, result: ok ? 'pass' : 'FAIL' }); if (!ok) fails.push(`${check}: found ${found}, expected ${expected}`); };
const money = (s) => Number(String(s).replace(/[^\d.]/g, ''));
const get = async (p) => (await fetch(`${API}/api${p}`)).json();
const flights = await get('/flights'); const pilot = flights.filter((f) => f.role === 'pilot');
const initial = (n) => { const p = n.trim().split(/\s+/); return `${p[0][0].toUpperCase()}. ${p[p.length - 1]}`; };

const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXE });
const page = await (await browser.newContext({ viewport: { width: 1100, height: 900 }, reducedMotion: 'reduce' })).newPage();
await page.goto(`${BASE}/costs`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
const ct = (await page.locator('#main').innerText()).replace(/\s+/g, ' ');
rec('Costs: total spent', money(ct.match(/Total spent \$([\d,.]+)/)?.[1]), exp.totalSpent, Math.abs(money(ct.match(/Total spent \$([\d,.]+)/)?.[1]) - exp.totalSpent) < 0.005);
rec('Costs: per pilot hour', money(ct.match(/Per pilot hour \$([\d,.]+)/)?.[1]), exp.perPilotHour, Math.abs(money(ct.match(/Per pilot hour \$([\d,.]+)/)?.[1]) - exp.perPilotHour) < 0.005);
rec('pilot flights in the data', pilot.length, exp.pilotFlights, pilot.length === exp.pilotFlights);

await page.goto(`${BASE}/logbook`, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { sessionStorage.clear(); localStorage.setItem('aerohub-logbook-view', 'list'); } catch { /* ignore */ } }); await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(900);
const closed = page.locator('.bc-mh[aria-expanded="false"]');
for (let i = 0; i < 60 && (await closed.count()); i++) { await closed.first().click(); await page.waitForTimeout(60); }
const ui = await page.locator('.bc-row').evaluateAll((els) => els.map((e) => ({ label: e.getAttribute('aria-label') || '', em: (e.querySelector('.t > em')?.textContent || '').trim() })));
rec('Logbook rows on screen', ui.length, pilot.length, ui.length === pilot.length);
const mdy = (d) => `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}`;
for (const c of exp.cases || []) {
  const f = pilot.find((x) => x.date === c.date && (x.tail_number || '') === c.tail && Math.abs(x.total_time - c.hours) < 0.001);
  const shape = f ? `dual ${f.dual_received}, solo ${f.solo_time}, instructor ${f.instructor ? 'set' : 'blank'}` : 'flight not found';
  const r = f && ui.find((u) => u.label.startsWith(mdy(c.date)) && u.label.includes(c.tail) && u.label.includes(`${c.hours.toFixed(2)} hours`));
  rec(`case ${c.date} ${c.hours} h (${c.note}): the flight exists`, shape, 'found', Boolean(f));
  if (r) rec(`case ${c.date} ${c.hours} h: row says ${c.expectSolo ? '"Solo"' : 'nothing extra'}`, r.em || '(nothing)', c.expectSolo ? 'Solo' : '(nothing)', c.expectSolo ? r.em === 'Solo' : r.em === '' || r.em === undefined);
}
const usual = inst.usual, others = inst.others || [];
const usualRows = ui.filter((u) => u.label.includes(`instructor ${usual}`));
rec(`usual instructor: rows naming them carry no visible instructor`, `${usualRows.length} rows, ${usualRows.filter((u) => u.em).length} with a visible name`, '0 visible', usualRows.length > 0 && usualRows.every((u) => !u.em));
rec('usual instructor is the most frequent', usual ? 'yes' : 'no', 'yes', usualRows.length >= Math.max(...others.map((o) => ui.filter((u) => u.label.includes(`instructor ${o}`)).length), 0));
for (const o of others) {
  const orows = ui.filter((u) => u.label.includes(`instructor ${o}`));
  rec(`another instructor shows as initial and surname`, `${orows.length} row(s): ${[...new Set(orows.map((u) => u.em))].map((x) => (x === initial(o) ? 'initial+surname' : 'WRONG')).join(', ') || 'none'}`, 'initial+surname', orows.length > 0 && orows.every((u) => u.em === initial(o)));
}
await browser.close();
console.table(rows);
console.log(fails.length ? `\n${fails.length} production-shape failure(s):\n - ${fails.join('\n - ')}` : '\nProduction-shaped checks pass.');
process.exit(fails.length ? 1 : 0);
