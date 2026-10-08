// The Logbook invariants, measured in a real browser on the rendered pages (read-only: it only loads pages and taps non-writing controls).
//   - the hero total equals the sum of every month line (FLIGHT hours only, ground time apart; every month is opened to read it)
//   - the Ledger's "Pilot totals" row equals the hero total
//   - the print view's "Total time" equals the hero total
//   - every row has a day (or date) and the full MM/DD/YYYY in its accessible name
//   - counts say what they count: the hero's details sheet names flights and ground sessions
// Pass the expected pilot total for the data set under test to also pin it (`--pilot <hours>`, or `--profile real|production` to read it from the private local config, see lib/localExpected.mjs).
//
//   PLAYWRIGHT_CORE=<playwright-core folder> BROWSER_EXE=<chromium> node client/scripts/check-invariants.mjs [--base http://localhost:4173] [--pilot <hours> | --profile real|production]
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:4173');
import { profileExpected } from './lib/localExpected.mjs';
const PROFILE = arg('--profile', '');
const PILOT = arg('--pilot', '') || (PROFILE ? String(profileExpected(PROFILE)?.pilot ?? '') : '');
if (!process.env.PLAYWRIGHT_CORE || !process.env.BROWSER_EXE) { console.error('Set PLAYWRIGHT_CORE and BROWSER_EXE (see check-controls.mjs).'); process.exit(2); }
const { chromium } = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXE });
const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const num = (s) => Number(String(s).replace(/[^0-9.\-]/g, ''));
const r2 = (n) => Math.round(n * 100) / 100;

for (const [w, h] of [[390, 844], [1440, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/logbook`, { waitUntil: 'networkidle' });
  await p.evaluate(() => { localStorage.setItem('aerohub-logbook-view', 'list'); sessionStorage.clear(); }); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(900);
  const hero = num(await p.locator('.bc-hero .n [data-final]').first().getAttribute('data-final'));
  // open every month (a month line toggles it), then read every month's FLIGHT hours from its line
  const closed = p.locator('.bc-mh[aria-expanded="false"]');
  for (let i = 0; i < 40 && (await closed.count()); i++) { await closed.first().click(); await p.waitForTimeout(80); }
  const months = (await p.locator('.bc-mh .r').allTextContents()).map(num);
  const sum = r2(months.reduce((a, b) => a + b, 0));
  ok(Math.abs(sum - hero) < 0.011, `@${w}: month lines sum to ${sum}, the hero says ${hero}`);
  if (PILOT) ok(Math.abs(hero - Number(PILOT)) < 0.005, `@${w}: pilot total ${hero}, expected ${PILOT}`);
  const rows = await p.locator('.bc-row').evaluateAll((els) => els.map((e) => ({ day: (e.querySelector('.day')?.textContent || '').trim(), label: e.getAttribute('aria-label') || '' })));
  ok(rows.length > 0 && rows.every((r) => r.day && /\d{2}\/\d{2}\/\d{4}/.test(r.label)), `@${w}: ${rows.filter((r) => !r.day || !/\d{2}\/\d{2}\/\d{4}/.test(r.label)).length} of ${rows.length} rows lack a day or the full date in their name`);
  ok(!(await p.locator('.bc-row svg').count()), `@${w}: a row carries an icon (local flights have no marker)`);
  // the hero's details sheet names what it counts
  await p.locator('.bc-hero').first().click(); await p.waitForTimeout(700);
  const sheet = (await p.locator('.ds-sheet.is-open').innerText()).replace(/\s+/g, ' ');
  ok(/\d+ flights? · [\d.]+ h/.test(sheet), `@${w}: the hero's sheet does not state its flight count and hours`);
  ok(/requirements met/i.test(sheet) || /Milestones/.test(sheet), `@${w}: the hero's sheet does not lead to the requirements`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(600);
  // the Ledger
  await p.evaluate(() => localStorage.setItem('aerohub-logbook-view', 'ledger')); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(900);
  const foot = (await p.locator('.mn-led tfoot td').allTextContents()).map((t) => t.trim());
  ok(foot.length > 4 && Math.abs(num(foot[2]) - hero) < 0.011, `@${w}: Ledger totals row ${foot.slice(0, 3).join(' | ')} vs hero ${hero}`);
  await p.evaluate(() => localStorage.setItem('aerohub-logbook-view', 'list'));
  // the print view
  await p.goto(`${BASE}/logbook/print`, { waitUntil: 'networkidle' }); await p.waitForTimeout(900);
  const printTotal = await p.evaluate(() => {
    const sec = document.querySelector('section[aria-label="Totals"]'); if (!sec) return null;
    for (const box of sec.children) if (/Total time/i.test(box.textContent)) return box.textContent;
    return null;
  });
  ok(printTotal !== null && Math.abs(num(printTotal.replace(/Total time/i, '')) - hero) < 0.011, `@${w}: print view Total time "${printTotal}" vs hero ${hero}`);
  console.log(`${w}px: hero ${hero} h = ${months.length} month lines (${sum}), ${rows.length} rows, Ledger ${foot[2]}, print ${printTotal ? num(printTotal.replace(/Total time/i, '')) : 'n/a'}`);
  await ctx.close();
}
await browser.close();
for (const f of fails) console.log('FAIL', f);
console.log(`${checks - fails.length}/${checks} invariant checks passed`);
process.exit(fails.length ? 1 : 0);
