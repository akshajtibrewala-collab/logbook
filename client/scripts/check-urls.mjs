// Click-through of every existing URL: each route loads, shows content, throws no page error and logs no console error (map tile network
// failures aside), at 390px and 1440px. Read-only (GET and page reads; the only writes are the browser's own localStorage draft/prefs).
// Usage: PLAYWRIGHT_CORE=<playwright-core folder> BROWSER_EXE=<chromium> node client/scripts/check-urls.mjs [--base http://localhost:4173]
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', process.env.BASE_URL || 'http://localhost:4173');
if (!process.env.PLAYWRIGHT_CORE || !process.env.BROWSER_EXE) { console.error('Set PLAYWRIGHT_CORE and BROWSER_EXE (see check-controls.mjs).'); process.exit(2); }
const { chromium } = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXE });

const probe = await (await browser.newContext()).newPage();
await probe.goto(`${BASE}/`, { waitUntil: 'networkidle' });
const ids = await probe.evaluate(async () => {
  const f = await (await fetch('/api/flights')).json(), g = await (await fetch('/api/costs/ground-sessions')).json();
  const a = await (await fetch('/api/aircraft')).json(), e = await (await fetch('/api/expirations')).json();
  return { pilot: f.find((x) => x.role === 'pilot')?.id, pax: f.find((x) => x.role === 'passenger')?.id, ground: g[0]?.id, aircraft: a[0]?.id, expiration: Array.isArray(e) ? e[0]?.id : e?.id };
});

// [route, expected final path (default: the same)]
const URLS = [
  ['/'], ['/logbook'], [`/logbook/${ids.pilot}`], [`/logbook/ground/${ids.ground}`], ['/flying', '/logbook'], ['/travel'], [`/travel/${ids.pax}`], ['/logbook/data'],
  ['/aircraft'], ['/aircraft/new'], [`/aircraft/${ids.aircraft}`], ['/logbook/new'], ['/logbook/new?role=passenger&from=travel', '/logbook/new'], ['/logbook/quick'], ['/logbook/share'], ['/logbook/print'],
  [`/logbook/${ids.pilot}/edit`], ['/logbook/ground/new'], [`/logbook/ground/${ids.ground}/edit`], ['/milestones'], ['/currency'], ['/currency/new'], ['/currency/' + (ids.expiration ?? 1)],
  ['/weather'], ['/weather/settings'], ['/costs'], ['/costs/settings'], ['/costs/spending'], ['/costs/phases'], ['/costs/expenses'], ['/costs/projection'], ['/map'], ['/stats'], ['/more'], ['/settings'], ['/no-such-page', '/'],
];
let fails = 0, checks = 0;
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.route(/arcgisonline|basemaps\.cartocdn|tile\.openstreetmap/, (r) => r.abort());
  for (const [route, final] of URLS) {
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message.slice(0, 100)));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|tile|arcgis|net::ERR/.test(m.text())) errs.push(m.text().slice(0, 100)); });
    const res = await p.goto(BASE + route, { waitUntil: 'networkidle' }); await p.waitForTimeout(600);
    const text = (await p.locator('body').innerText()).trim().length;
    const where = new URL(p.url()).pathname;
    const good = res.ok() && errs.length === 0 && text > 40 && where === (final ?? route.split('?')[0]);
    checks++; if (!good) { fails++; console.log(`FAIL ${route} @${w}: status ${res.status()} path ${where} text ${text} ${errs.join(' | ')}`); }
    await p.close();
  }
  await ctx.close();
}
await browser.close();
console.log(`${checks - fails}/${checks} URL loads passed (${URLS.length} URLs x 2 widths)`);
process.exit(fails ? 1 : 0);
