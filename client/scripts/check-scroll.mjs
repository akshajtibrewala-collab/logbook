// ROUND-TRIP SCROLL INVARIANT CHECK. Every route, at 360 / 390 / 430px, in WebKit (iPhone profile) and Chromium:
//   load -> read the state flags + screenshot -> scroll to the middle, to the bottom, fling up and down, back to 0 (instant and smooth)
//   -> let it settle -> read the flags + screenshot again. Back at 0 the page must be the page that loaded:
//   flags      title progress (--p), top and tab bar tint (clear / scrim, busy), Add button, tab bar collapse: equal to the initial ones
//   pixels     the two screenshots match (changed pixels under --maxdiff percent; the map and live animation get a looser limit)
//   rubber     a synthetic iOS rubber-band (scrollY reported below 0 and past the end, scroll events fired): flags at -60 equal the
//              flags at 0, and at max + 60 equal the flags at max; nothing throws
//   back       leave a scrolled list and come back with the browser Back button: the flags are consistent with the position,
//              and scrolling to 0 gives the initial flags again
// Real iOS rubber-band, the collapsing Safari toolbar and touch momentum do not exist in a headless browser: this proves the logic and
// the layout, not the phone. Read-only: it loads pages and scrolls, it writes nothing.
//   PLAYWRIGHT_CORE=<..> node client/scripts/check-scroll.mjs [--base http://localhost:4174] [--api http://localhost:3002] [--widths 360,390,430] [--engines webkit,chromium] [--routes /,/logbook] [--maxdiff 0.3] [--detail 30]
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:4174'), API = arg('--api', 'http://localhost:3002');
const WIDTHS = arg('--widths', '360,390,430').split(',').map(Number);
const ENGINES = arg('--engines', 'webkit,chromium').split(',');
const ONLY = arg('--routes', '') ? arg('--routes', '').split(',') : null;
const MAXDIFF = Number(arg('--maxdiff', 0.3)), DETAIL = Number(arg('--detail', 30));
if (!process.env.PLAYWRIGHT_CORE) { console.error('Set PLAYWRIGHT_CORE.'); process.exit(2); }
const pw = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href); const { webkit, chromium, devices } = pw.default ?? pw;
const get = async (p) => (await fetch(`${API}/api${p}`)).json();
const flights = await get('/flights'); const ground = await get('/costs/ground-sessions').catch(() => []); const aircraft = await get('/aircraft').catch(() => []);
const pilot = flights.find((f) => f.role === 'pilot')?.id, pax = flights.find((f) => f.role === 'passenger')?.id;
const ROUTES = ['/', '/logbook', `/logbook/${pilot}`, `/logbook/ground/${ground[0]?.id ?? 1}`, '/travel', `/travel/${pax}`, '/logbook/data', '/aircraft', '/aircraft/new', `/aircraft/${aircraft[0]?.id ?? 1}`,
  '/logbook/new', '/logbook/new?role=passenger', '/logbook/quick', '/logbook/share', '/logbook/print', `/logbook/${pilot}/edit`, '/logbook/ground/new', '/milestones', '/currency', '/currency/new',
  '/weather', '/weather/settings', '/costs', '/costs/settings', '/costs/spending', '/costs/phases', '/costs/expenses', '/costs/projection', '/map', '/stats', '/more', '/settings']
  .filter((r) => !ONLY || ONLY.includes(r));
const LOOSE = new Set(['/']); // the greeting and the animated numbers: allow a larger changed area
const NO_PIXELS = new Set(['/map']); // live map tiles arrive from the network and pop in at their own time: flags are still compared

const FLAGS = () => {
  const d = document.documentElement, bar = document.querySelector('.ds-topbar'), tab = document.querySelector('.ds-tabbar'), fab = document.querySelector('.ds-fab');
  return {
    y: Math.round(scrollY * 10) / 10, max: d.scrollHeight - innerHeight,
    p: bar ? Math.round(parseFloat(bar.style.getPropertyValue('--p') || '0') * 100) / 100 : null,
    tint: bar ? `${bar.getAttribute('data-bk') || 'lo'}${bar.hasAttribute('data-busy') ? '+busy' : ''}` : null,
    tabtint: tab ? `${tab.getAttribute('data-bk') || 'lo'}${tab.hasAttribute('data-busy') ? '+busy' : ''}` : null,
    fab: fab ? fab.getAttribute('data-hidden') === 'true' : null,
    tab: tab ? tab.classList.contains('is-collapsed') : null,
    kb: d.hasAttribute('data-kb'),
  };
};
const same = (a, b) => a.p === b.p && a.tint === b.tint && a.tabtint === b.tabtint && a.fab === b.fab && a.tab === b.tab && a.kb === b.kb;
const show = (f) => `p=${f.p} tint=${f.tint} tabtint=${f.tabtint} fab=${f.fab ? 'hidden' : 'shown'} tab=${f.tab ? 'collapsed' : 'expanded'} kb=${f.kb}`;
const settle = (p, ms = 1300) => p.waitForTimeout(ms);

async function diffPct(a, b) {
  const [A, B] = await Promise.all([sharp(a).raw().toBuffer({ resolveWithObject: true }), sharp(b).raw().toBuffer({ resolveWithObject: true })]);
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) return 100;
  const ch = A.info.channels; let n = 0;
  for (let i = 0; i < A.data.length; i += ch) if (Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]) > 36) n++;
  return (n / (A.data.length / ch)) * 100;
}

const results = []; let pages = 0;
for (const engine of ENGINES) {
  const browser = await (engine === 'webkit' ? webkit : chromium).launch();
  for (const w of WIDTHS) {
    const dev = engine === 'webkit' ? devices['iPhone 13'] : devices['Pixel 5'];
    const ctx = await browser.newContext({ ...dev, viewport: { width: w, height: 800 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
    for (const route of ROUTES) {
      const tag = `${engine} ${w}px ${route}`; const bad = (type, msg) => results.push({ tag, type, msg }); pages++;
      try {
        errs.length = 0;
        await p.goto(BASE + route, { waitUntil: 'load' }); await settle(p, 1400);
        await p.evaluate(() => scrollTo(0, 0)); await settle(p, 500);
        const f0 = await p.evaluate(FLAGS); const s0 = await p.screenshot();
        if (f0.max <= 4) { // nothing to scroll: still prove the invariant for the flags
          await p.evaluate(() => { scrollTo(0, 400); scrollTo(0, 0); }); await settle(p, 500);
          const f = await p.evaluate(FLAGS); if (!same(f0, f)) bad('flags', `short page changed: ${show(f0)} -> ${show(f)}`);
        }
        const mid = Math.max(0, Math.floor(f0.max / 2)), bottom = f0.max;
        // 1. middle, bottom
        for (const y of [mid, bottom]) { await p.evaluate((t) => scrollTo(0, t), y); await settle(p, 450); }
        const fb = await p.evaluate(FLAGS);
        // 2. fast fling up and down, three times, in small steps
        await p.evaluate(async () => {
          const step = () => new Promise((r) => requestAnimationFrame(r));
          for (let k = 0; k < 3; k++) {
            const max = document.documentElement.scrollHeight - innerHeight;
            for (let i = 0; i <= 12; i++) { scrollTo(0, (max * i) / 12); await step(); }
            for (let i = 12; i >= 0; i--) { scrollTo(0, (max * i) / 12); await step(); }
          }
        });
        // 3. down again then instant return, settle, compare
        await p.evaluate(() => scrollTo(0, 99999)); await settle(p, 350);
        await p.evaluate(() => scrollTo(0, 0)); await settle(p, 1400);
        const f1 = await p.evaluate(FLAGS); const s1 = await p.screenshot();
        if (f1.y !== 0) bad('position', `back at ${f1.y}, not 0`);
        if (!same(f0, f1)) bad('flags', `instant return: ${show(f0)} -> ${show(f1)}`);
        const pct = await diffPct(s0, s1); const lim = LOOSE.has(route) ? Math.max(MAXDIFF, 2) : MAXDIFF;
        if (pct > lim && !NO_PIXELS.has(route)) bad('pixels', `${pct.toFixed(2)}% of pixels changed after the round trip (limit ${lim}%)`);
        // 4. smooth return
        await p.evaluate(() => scrollTo(0, 99999)); await settle(p, 350);
        await p.evaluate(() => scrollTo({ top: 0, behavior: 'smooth' })); await settle(p, 1800);
        const f2 = await p.evaluate(FLAGS);
        if (f2.y !== 0 || !same(f0, f2)) bad('flags', `smooth return: y=${f2.y} ${show(f0)} -> ${show(f2)}`);
        // 5. synthetic rubber-band: scrollY reported out of range, with scroll events fired, as iOS does while it bounces
        const fake = (v) => p.evaluate((val) => { if (!window.__sy) window.__sy = Object.getOwnPropertyDescriptor(window, 'scrollY') || Object.getOwnPropertyDescriptor(Window.prototype, 'scrollY'); Object.defineProperty(window, 'scrollY', { configurable: true, get: () => val }); window.dispatchEvent(new Event('scroll')); }, v);
        const unfake = () => p.evaluate(() => { Object.defineProperty(window, 'scrollY', window.__sy); });
        await p.evaluate((t) => scrollTo(0, t), bottom); await settle(p, 500);
        const fB = await p.evaluate(FLAGS);
        await fake(bottom + 60); await settle(p, 450);
        const fPast = await p.evaluate(FLAGS);
        if (!same(fB, fPast)) bad('rubber', `bounce past the end changed the state: ${show(fB)} -> ${show(fPast)}`);
        await fake(-60); await settle(p, 450);
        const fNeg = await p.evaluate(FLAGS);
        if (f0.max > 4 && (fNeg.tab || fNeg.fab)) bad('rubber', `pulled below the top but ${show(fNeg)}`);
        for (const v of [NaN, Infinity, -Infinity, -0]) await fake(v);
        await unfake(); await p.evaluate(() => scrollTo(0, 0)); await settle(p, 1300);
        const f4 = await p.evaluate(FLAGS);
        if (!same(f0, f4)) bad('rubber', `after synthetic overscroll: ${show(f0)} -> ${show(f4)}`);
        if (errs.length) bad('errors', errs.join(' | '));
      } catch (e) { bad('error', String(e).split('\n')[0].slice(0, 160)); }
    }
    // Back button: leave a scrolled list, return, flags consistent with the position, 0 gives the initial flags.
    for (const list of ['/logbook', '/travel'].filter((r) => !ONLY || ONLY.includes(r))) {
      const tag = `${engine} ${w}px ${list} (back button)`; const bad = (type, msg) => results.push({ tag, type, msg });
      try {
        await p.goto(BASE + list, { waitUntil: 'load' }); await settle(p, 1200);
        const f0 = await p.evaluate(FLAGS);
        await p.evaluate(() => scrollTo(0, 500)); await settle(p, 500);
        await p.goto(BASE + '/more', { waitUntil: 'load' }); await settle(p, 800);
        await p.goBack({ waitUntil: 'load' }); await settle(p, 1400);
        const fr = await p.evaluate(FLAGS);
        if (fr.y <= 0 && (fr.tab || fr.fab)) bad('back', `at the top after Back but ${show(fr)}`);
        await p.evaluate(() => scrollTo(0, 0)); await settle(p, 1300);
        const f1 = await p.evaluate(FLAGS);
        if (!same(f0, f1)) bad('back', `${show(f0)} -> ${show(f1)}`);
      } catch (e) { bad('error', String(e).split('\n')[0].slice(0, 160)); }
    }
    await ctx.close();
  }
  await browser.close();
}
const by = {}; for (const r of results) (by[r.type] ||= []).push(r);
console.log(`\nscroll round trip: ${pages} page runs (${ENGINES.join(', ')}; ${WIDTHS.join('/')}px) -> ${results.length} problem(s)`);
for (const [t, rs] of Object.entries(by)) { console.log(`  ${t}: ${rs.length}`); for (const r of rs.slice(0, DETAIL)) console.log(`    ${r.tag}  ${r.msg}`); }
process.exit(results.length ? 1 : 0);
