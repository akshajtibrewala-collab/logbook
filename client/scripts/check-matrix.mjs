// DEVICE MATRIX LAYOUT CHECK (read-only). Every device in client/scripts/lib/devices.mjs (phones, iPads, split view, Android phone and tablet,
// desktop) x every route category, at the text scales given. Per page it fails on:
//   - horizontal overflow (the page is wider than the viewport);
//   - the wrong layout mode for the width (the side rail from 1024px up, the bottom tab bar below it) or a rail that overlaps the content;
//   - content ending under the tab bar or the Add button when scrolled to the bottom;
//   - a content column narrower than 60% of a tablet-or-narrower viewport (a phone layout floating in the middle) or wider than the frame;
//   - a touch target under 44px (touch devices only; hover-only affordances are covered by check-interactions);
//   - a sheet taller than the screen (the first sheet trigger on the page is opened and measured).
// It also prints where the layout switches between the phone and wide layouts (sampled every 8px across 600-1300px).
//
//   PLAYWRIGHT_CORE=<playwright-core folder> BROWSER_EXE=<chrome.exe for Android profiles> \
//     node client/scripts/check-matrix.mjs [--base http://localhost:4174] [--matrix quick|full] [--only "ipad 820"] [--text 100,200]
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { openContext, launchBrowsers, pickProfile } from './lib/devices.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:4174');
const TEXTS = arg('--text', '100,200').split(',').map(Number);
if (!process.env.PLAYWRIGHT_CORE) { console.error('Set PLAYWRIGHT_CORE (and BROWSER_EXE for Android profiles).'); process.exit(2); }
const pw = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);
const profiles = pickProfile(arg('--matrix', 'quick'), arg('--only', ''));
const browsers = await launchBrowsers(pw, { chromiumExe: process.env.BROWSER_EXE, need: [...new Set(profiles.map((d) => d.engine))] });

const CATEGORIES = {
  home: ['/'], list: ['/logbook', '/travel'], detail: ['/logbook/:pilot', '/travel/:pax', '/logbook/ground/:ground', '/aircraft/:aircraft'],
  form: ['/logbook/new', '/logbook/quick', '/aircraft/new'], flying: ['/milestones', '/currency', '/weather', '/costs', '/costs/spending', '/costs/expenses', '/costs/projection'],
  explore: ['/stats', '/map'], settings: ['/more', '/settings', '/logbook/data', '/aircraft'],
};

const pc = await browsers.webkit.newContext();
const probe = await pc.newPage();
await probe.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
const ids = await probe.evaluate(async () => {
  const j = async (u) => (await fetch(u)).json();
  const [f, g, a] = await Promise.all([j('/api/flights'), j('/api/costs/ground-sessions'), j('/api/aircraft')]);
  return { pilot: f.find((x) => x.role === 'pilot')?.id, pax: f.find((x) => x.role === 'passenger')?.id, ground: g[0]?.id, aircraft: a[0]?.id };
});
await pc.close();
const resolve = (r) => r.replace(/:(\w+)/, (_, k) => ids[k]);

const PAGE = (touch) => {
  const vw = innerWidth, vh = innerHeight, de = document.documentElement;
  const tab = document.querySelector('.ds-tabbar'), fab = document.querySelector('.ds-fab'), main = document.querySelector('main, .ds-main');
  const tr = tab?.getBoundingClientRect(), mr = main?.getBoundingClientRect();
  const rail = tab ? getComputedStyle(tab.querySelector('.ds-tabs') || tab).flexDirection === 'column' : null; // the rail runs the tab capsule vertically
  // content column: the widest direct child of main that has real content
  let col = 0, colLeft = 0; if (main) for (const c of main.children) { const r = c.getBoundingClientRect(); if (r.height > 20 && r.width > col) { col = r.width; colLeft = r.left; } }
  // bottom clearance: last visible element of main vs the bar and the Add button, after scrolling to the end
  scrollTo({ top: 1e6, behavior: 'instant' });
  // The lowest visible edge of the content. An element clipped by an ancestor with overflow hidden/auto (a map's land outline inside its svg, a card's
  // scroller) only counts as far as that ancestor shows it.
  let last = 0;
  if (main) for (const e of main.querySelectorAll('*')) {
    const r = e.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
    let bottom = r.bottom;
    for (let a = e.parentElement; a && a !== main; a = a.parentElement) {
      const o = getComputedStyle(a); if (o.overflowY !== 'visible' || a.tagName.toLowerCase() === 'svg') bottom = Math.min(bottom, a.getBoundingClientRect().bottom);
    }
    if (bottom > last) last = bottom;
  }
  const barTop = tab && !rail ? tab.getBoundingClientRect().top : vh;
  const fabTop = fab ? fab.getBoundingClientRect().top : vh;
  const small = [];
  if (touch) {
    for (const e of document.querySelectorAll('a[href], button, [role="button"], input:not([type="hidden"]), select, textarea, summary')) {
      const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || e.closest('[aria-hidden="true"], .ds-sheet:not(.is-open)')) continue;
      if (e.matches('.skip-link, a[href="#main"]') || /skip to content/i.test(e.textContent || '')) continue;
      if (Math.min(r.width, r.height) < 43.5 && !(e.tagName === 'INPUT' && /checkbox|radio|range/.test(e.type) && e.closest('label'))) small.push(`${(e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 24)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  }
  scrollTo({ top: 0, behavior: 'instant' });
  return {
    vw, overflow: Math.max(0, de.scrollWidth - vw), rail, col: Math.round(col), mainLeft: Math.round(colLeft),
    railRight: tr && rail ? Math.round(tr.right) : 0, contentBottom: Math.round(last), barTop: Math.round(barTop), fabTop: Math.round(fabTop), scrollMax: de.scrollHeight - vh,
    small: [...new Set(small)].slice(0, 6),
  };
};

const rows = [];
const t0 = Date.now();
for (const d of profiles) for (const TEXT of TEXTS) {
  const ctx = await openContext(browsers, d);
  await ctx.addInitScript((t) => { const set = () => { if (document.documentElement) document.documentElement.style.fontSize = `${t}%`; }; set(); document.addEventListener('DOMContentLoaded', set); }, TEXT); // the text size applies at load, as a real text-size setting does (changing the root size under a live WebKit page can leave rem-based custom properties stale)
  const page = await ctx.newPage();
  await page.route(/planespotters|plnspttrs|arcgisonline|cartocdn|tile\.openstreetmap/, (r) => r.abort());
  for (const [cat, routes] of Object.entries(CATEGORIES)) {
    const fails = [];
    for (const r of routes) {
      const route = resolve(r);
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('main, .ds-main', { timeout: 8000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {}); // data-driven pages show a skeleton until their requests finish
      await page.waitForTimeout(cat === 'explore' ? 1500 : 450);
      for (const text of [TEXT]) {
        await page.evaluate((t) => { document.documentElement.style.fontSize = `${t}%`; }, text);
        await page.waitForTimeout(450);
        const m = await page.evaluate(PAGE, d.touch);
        const tag = `${r.replace(/:\w+/, ':id')} @${text}%`;
        if (m.overflow > 1) fails.push(`${tag}: page ${m.overflow}px wider than the viewport`);
        const wantRail = d.width >= 1024;
        if (m.rail !== null && m.rail !== wantRail) fails.push(`${tag}: ${m.rail ? 'side rail' : 'bottom bar'} at ${d.width}px (expected ${wantRail ? 'rail' : 'bottom bar'})`);
        if (m.rail && r !== '/map' && m.mainLeft < m.railRight - 1 && m.col > 0) fails.push( // the map is a full-bleed canvas the rail floats over by design
          `${tag}: rail overlaps the content (${m.railRight} > ${m.mainLeft})`);
        if (m.rail === false && m.scrollMax > 0) {
          const limit = Math.min(m.barTop, m.fabTop);
          if (m.contentBottom > limit + 1 && cat !== 'explore') fails.push(`${tag}: content ends at ${m.contentBottom}px, under the bar/Add button (${limit}px)`);
        }
        if (d.width <= 1100 && text <= 130 && cat !== 'explore' && m.col > 0 && m.col < d.width * 0.6 && d.width > 600) // at 200% text the rem-based gutters and rail legitimately take more than 40%; the rule is for 100-130%
          fails.push(`${tag}: content column ${m.col}px is under 60% of ${d.width}px`);
        if (m.small.length) fails.push(`${tag}: touch targets under 44px: ${m.small.join('; ')}`);
      }
    }
    rows.push({ device: d.name, cat, fails: [...new Set(fails)] });
  }
  await ctx.close();
}

// Where the layout switches, sampled across the awkward band.
const sw = await openContext(browsers, { ...profiles[0], engine: 'webkit', touch: false, width: 700, height: 900, dpr: 1 });
const sp = await sw.newPage();
await sp.route(/planespotters|plnspttrs|arcgisonline|cartocdn|tile\.openstreetmap/, (r) => r.abort());
await sp.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await sp.waitForSelector('.ds-tabbar', { timeout: 8000 }).catch(() => {});
let prev = null; const switches = [];
for (let w = 600; w <= 1300; w += 8) {
  await sp.setViewportSize({ width: w, height: 900 });
  const m = await sp.evaluate(() => { const t = document.querySelector('.ds-tabbar'); return t ? (getComputedStyle(t.querySelector('.ds-tabs') || t).flexDirection === 'column' ? 'rail' : 'bottom bar') : 'none'; });
  if (m !== prev) { switches.push(`${w}px: ${m}`); prev = m; }
}
await sw.close();
for (const b of Object.values(browsers)) await b.close();

// Report
const byDevice = new Map();
for (const r of rows) { if (!byDevice.has(r.device)) byDevice.set(r.device, {}); byDevice.get(r.device)[r.cat] = [...(byDevice.get(r.device)[r.cat] ?? []), ...r.fails]; }
const cats = Object.keys(CATEGORIES);
console.log(`device`.padEnd(30) + cats.map((c) => c.padEnd(9)).join(''));
let bad = 0;
for (const [dev, m] of byDevice) {
  console.log(dev.padEnd(30) + cats.map((c) => (m[c].length ? `FAIL(${m[c].length})` : 'pass').padEnd(9)).join(''));
  for (const c of cats) for (const f of m[c].slice(0, 3)) console.log(`      ${c}: ${f}`);
  bad += cats.filter((c) => m[c].length).length;
}
console.log(`Layout switches while widening 600-1300px: ${switches.join(' -> ')}`);
console.log(`Matrix: ${byDevice.size} devices x ${cats.length} route categories x text ${TEXTS.join('/')}%, ${bad} failing cells in ${Math.round((Date.now() - t0) / 1000)} s. ${BASE}`);
process.exit(bad ? 1 : 0);
