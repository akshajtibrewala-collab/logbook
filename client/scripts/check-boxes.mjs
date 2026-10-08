// Bounding-box checker: on the Logbook, Travel, detail, form and Aircraft screens, no element's box may leave the viewport sideways (a box wider
// than the screen, or pushed off an edge), except inside an intended sideways scroller (the Flying tabs strip and the Ledger table wrapper).
// Run at 320 / 390 / 430px with text 100 / 150 / 200%, and at 1100 / 1280 / 1366 / 1440 / 1536 / 1920px at 100%. Read-only (it only loads pages).
// Usage: PLAYWRIGHT_CORE=<playwright-core folder> BROWSER_EXE=<chromium> node client/scripts/check-boxes.mjs [--base http://localhost:4173]
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', process.env.BASE_URL || 'http://localhost:4173');
if (!process.env.PLAYWRIGHT_CORE || !process.env.BROWSER_EXE) { console.error('Set PLAYWRIGHT_CORE and BROWSER_EXE (see check-controls.mjs).'); process.exit(2); }
const { chromium } = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXE });

const fails = []; let checks = 0;
const SCROLLERS = '.fl-tabs, .cl-ledger-wrap, .mn-led-wrap, .mn-chips, .gl-seg.scroll, .ds-sheet, .ds-menu, .leaflet-container';
async function scan(p, label) {
  const bad = await p.evaluate((sel) => {
    const out = []; const W = document.documentElement.clientWidth;
    for (const e of document.querySelectorAll('main *, form *')) {
      if (e.closest(sel) || e.closest('svg')) continue;
      const cs = getComputedStyle(e); if (cs.position === 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = e.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
      if (r.right > W + 1 || r.left < -1) out.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} ${Math.round(r.left)}..${Math.round(r.right)} of ${W}`);
    }
    return out.slice(0, 4);
  }, SCROLLERS);
  checks++; if (bad.length) { fails.push(`${label}: ${bad.join('; ')}`); console.log('FAIL', label, bad.join('; ')); }
}

// concrete detail ids from the running app's own API
const probe = await (await browser.newContext()).newPage();
await probe.goto(`${BASE}/`, { waitUntil: 'networkidle' });
const ids = await probe.evaluate(async () => {
  const f = await (await fetch('/api/flights')).json(), g = await (await fetch('/api/costs/ground-sessions')).json();
  return { pilot: f.find((x) => x.role === 'pilot')?.id, pax: f.find((x) => x.role === 'passenger')?.id, ground: g[0]?.id };
});
const ROUTES = ['logbook', `logbook/${ids.pilot}`, `logbook/ground/${ids.ground}`, 'logbook/new', 'logbook/new?role=passenger&from=travel', `logbook/${ids.pilot}/edit`, 'travel', `travel/${ids.pax}`, 'aircraft'];

const runs = [...[320, 390, 430].flatMap((w) => [100, 150, 200].map((t) => [w, 800, t])), ...[1100, 1280, 1366, 1440, 1536, 1920].map((w) => [w, 900, 100])];
for (const [w, h, text] of runs) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  for (const route of ROUTES) {
    await p.goto(`${BASE}/${route}`, { waitUntil: 'networkidle' });
    await p.evaluate((t) => { document.documentElement.style.fontSize = `${t}%`; }, text);
    await p.waitForTimeout(350);
    await scan(p, `/${route} at ${w}px text ${text}%`);
  }
  // the Ledger view on the Logbook
  await p.evaluate(() => localStorage.setItem('aerohub-logbook-view', 'ledger'));
  await p.goto(`${BASE}/logbook`, { waitUntil: 'networkidle' }); await p.evaluate((t) => { document.documentElement.style.fontSize = `${t}%`; }, text); await p.waitForTimeout(350);
  await scan(p, `/logbook (Ledger) at ${w}px text ${text}%`);
  await p.evaluate(() => localStorage.removeItem('aerohub-logbook-view'));
  await ctx.close();
}
await browser.close();
console.log(`${checks - fails.length}/${checks} bounding-box checks passed`);
process.exit(fails.length ? 1 : 0);
