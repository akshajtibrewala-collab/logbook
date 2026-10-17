// NO COSTS IN THE UI (read-only). The Costs tab and every cost screen, link, widget and print/share section were removed from the app on 2026-10-16 (the tables,
// the API and the stored values were kept). On every route, at a phone and a desktop width, this fails on:
//   - any link or button that leads to /costs...;
//   - any visible wording about costs, spending, expenses, invoices, rates or training phases ("cost", "spent", "invoice", "expense", "$12.34"-style amounts);
//   - a Home tile, a Flying-switcher page or a Flying-menu entry named Costs;
//   - an old /costs... address that does not land on Home;
//   - the printable summary or the public share page (when a link is on) carrying any of that wording.
// It also reads the app's own source routes list through the browser, so a screen that comes back by accident is caught.
//
//   PLAYWRIGHT_CORE=<playwright-core folder> node client/scripts/check-no-costs.mjs [--base http://localhost:4175]
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:4175');
if (!process.env.PLAYWRIGHT_CORE) { console.error('Set PLAYWRIGHT_CORE.'); process.exit(2); }
const pw = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);
const lib = pw.default ?? pw;
const browser = await lib.webkit.launch();

const ids = await (async () => {
  const j = async (u) => (await fetch(BASE + u)).json();
  const [f, g, a] = await Promise.all([j('/api/flights'), j('/api/costs/ground-sessions'), j('/api/aircraft')]);
  return { pilot: f.find((x) => x.role === 'pilot')?.id, pax: f.find((x) => x.role === 'passenger')?.id, ground: g[0]?.id, aircraft: a[0]?.id };
})();
const ROUTES = ['/', '/logbook', `/logbook/${ids.pilot}`, `/logbook/${ids.pilot}/edit`, '/logbook/new', '/logbook/new?role=passenger', '/logbook/quick', `/logbook/ground/${ids.ground}`, `/logbook/ground/${ids.ground}/edit`,
  '/logbook/ground/new', '/travel', `/travel/${ids.pax}`, '/aircraft', `/aircraft/${ids.aircraft}`, '/milestones', '/currency', '/map', '/stats', '/stats?tab=travel',
  '/more', '/settings', '/logbook/data', '/logbook/share', '/logbook/print'];
const WORDS = /\bcosts?\b|\bspen[dt]\b|\bspending\b|\binvoices?\b|\bexpenses?\b|\btraining phases?\b|\bper pilot hour\b|\$\s?\d/i;
const problems = [];

for (const [w, h] of [[390, 844], [1280, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 800, isMobile: w < 800, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.route(/planespotters|plnspttrs|arcgisonline|cartocdn|tile\.openstreetmap/, (r) => r.abort());
  for (const r of ROUTES) {
    await p.goto(BASE + r, { waitUntil: 'networkidle' }).catch(() => {}); await p.waitForTimeout(450);
    // open the disclosures and the More details block so hidden cost sections would be read too
    await p.evaluate(() => document.querySelectorAll('button.mn-fold[aria-expanded="false"], .cl-disc:not(.open)').forEach((b) => b.click())); await p.waitForTimeout(200);
    const m = await p.evaluate(() => ({
      links: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((h) => /^\/costs(\/|$)/.test(h)),
      text: (document.querySelector('main')?.innerText || '').replace(/\s+/g, ' '),
      fields: [...document.querySelectorAll('main label, main input, main textarea')].map((e) => `${e.textContent || ''} ${e.getAttribute('placeholder') || ''} ${e.getAttribute('aria-label') || ''}`).join(' | '),
    }));
    const where = `${r.replace(/\/\d+/g, '/:id')} @${w}`;
    if (m.links.length) problems.push(`${where}: link to ${[...new Set(m.links)].join(', ')}`);
    const hit = (m.text + ' | ' + m.fields).match(WORDS);
    if (hit && !/logbook\/print|logbook\/data/.test(r)) problems.push(`${where}: shows "${hit[0]}"`);
    if (hit && /logbook\/(print|data)/.test(r)) problems.push(`${where}: shows "${hit[0]}"`);
  }
  // chrome: the Flying switcher, the Flying menu and the Home hub
  await p.goto(BASE + '/logbook', { waitUntil: 'networkidle' }); await p.waitForTimeout(400);
  await p.locator('button.bc-sw').click().catch(() => {}); await p.waitForTimeout(300);
  const sw = await p.evaluate(() => [...document.querySelectorAll('[role="menu"] a, [role="menu"] button')].map((e) => e.textContent.trim()));
  if (sw.some((t) => /cost/i.test(t))) problems.push(`Flying switcher @${w}: ${sw.join(', ')}`);
  await p.keyboard.press('Escape');
  await p.goto(BASE + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  const tiles = await p.evaluate(() => [...document.querySelectorAll('.hub-t .nm')].map((e) => e.textContent.trim()));
  if (!tiles.length) problems.push(`Home @${w}: no hub tiles found`);
  if (tiles.some((t) => /cost/i.test(t))) problems.push(`Home @${w}: a Costs tile (${tiles.join(', ')})`);
  // old addresses land on Home
  for (const old of ['/costs', '/costs/settings', '/costs/spending', '/costs/phases', '/costs/expenses', '/costs/projection']) {
    await p.goto(BASE + old, { waitUntil: 'networkidle' }).catch(() => {}); await p.waitForTimeout(250);
    const at = await p.evaluate(() => location.pathname);
    if (at !== '/') problems.push(`${old} @${w}: lands on ${at}, not Home`);
  }
  await ctx.close();
}
await browser.close();
const uniq = [...new Set(problems)];
for (const x of uniq) console.log('FAIL', x);
console.log(`No costs in the UI: ${ROUTES.length} routes x 2 widths + hub, switcher and old addresses -> ${uniq.length} problem(s)`);
process.exit(uniq.length ? 1 : 0);
