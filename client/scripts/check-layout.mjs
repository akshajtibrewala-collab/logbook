// Layout regression guard for the two-pane screens and the shell. Drives a real browser against a RUNNING production build (read-only: it
// never writes) and fails (exit 1) when any of these breaks:
//   nav      a primary navigation (left rail or bottom tab bar) is visible, on screen, and on top, at every desktop width and pixel ratio
//   fit      no horizontal page scroll at 320/390/430px with text 100-200%
//   input    no search placeholder is wider than its input at 320-430px with text 100-200%
//   tabs     the Flying tabs either all fit, or the strip shows a scroll fade, and the selected tab is in view
//   columns  on wide screens the summary (or open entry) column sits right of the list and starts level with it
//   rows     every Logbook/Travel row has a day or date and the full MM/DD/YYYY in its accessible name
// Usage: PLAYWRIGHT_CORE=<playwright-core folder> BROWSER_EXE=<chromium> node client/scripts/check-layout.mjs [--base http://localhost:4173]
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', process.env.BASE_URL || 'http://localhost:4173');
if (!process.env.PLAYWRIGHT_CORE || !process.env.BROWSER_EXE) { console.error('Set PLAYWRIGHT_CORE and BROWSER_EXE (see check-controls.mjs).'); process.exit(2); }
const { chromium } = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXE });
const fails = []; let checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails.push(msg); console.log('FAIL', msg); } };
const newPage = async (width, height, dpr = 1) => {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, reducedMotion: 'reduce' });
  return { ctx, p: await ctx.newPage() };
};
const go = async (p, route, text = 100) => {
  await p.goto(`${BASE}/${route}`, { waitUntil: 'networkidle' });
  await p.evaluate((t) => { document.documentElement.style.fontSize = `${t}%`; }, text);
  await p.waitForTimeout(500);
};

// ---- nav: visible at every width and pixel ratio, on every top-level page
const DESKTOP = [920, 1024, 1100, 1180, 1280, 1366, 1440, 1536, 1680, 1920];
for (const dpr of [1, 1.25, 1.5]) for (const w of DESKTOP) {
  const { ctx, p } = await newPage(w, 800, dpr);
  for (const route of ['', 'logbook', 'travel', 'aircraft', 'stats', 'map']) {
    await go(p, route);
    const r = await p.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Primary"]'); if (!nav) return { missing: true };
      const b = nav.getBoundingClientRect(), cs = getComputedStyle(nav);
      const links = [...nav.querySelectorAll('a')].map((a) => { const q = a.getBoundingClientRect(); const top = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2); return q.width > 0 && q.height > 0 && q.left >= 0 && q.right <= innerWidth && q.top >= 0 && q.bottom <= innerHeight && top && a.contains(top); });
      return { w: b.width, h: b.height, vis: cs.visibility === 'visible' && cs.display !== 'none' && Number(cs.opacity) > 0.5, links, rail: b.height > b.width };
    });
    ok(!r.missing && r.vis && r.w > 0 && r.links.length === 5 && r.links.every(Boolean), `nav: no usable primary navigation at ${w}px dpr ${dpr} on /${route} (${JSON.stringify(r)})`);
    if (w >= 1024) ok(r.rail, `nav: expected the left rail at ${w}px on /${route}`); else ok(!r.rail, `nav: expected the bottom tab bar at ${w}px on /${route}`);
  }
  await ctx.close();
}

// ---- narrow widths with large text: fit, placeholders, tabs
for (const w of [320, 390, 430]) for (const text of [100, 150, 200]) {
  const { ctx, p } = await newPage(w, 800);
  for (const route of ['', 'logbook', 'travel', 'aircraft', 'stats', 'currency', 'milestones', 'costs', 'weather']) {
    await go(p, route, text);
    const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
    ok(r.sw <= r.iw + 1, `fit: horizontal scroll on /${route} at ${w}px text ${text}% (${r.sw} > ${r.iw})`);
    const inp = await p.evaluate(() => [...document.querySelectorAll('input[placeholder]')].filter((i) => i.getBoundingClientRect().width > 0).map((i) => {
      const cs = getComputedStyle(i), c = document.createElement('canvas').getContext('2d'); c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const room = i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      return { ph: i.placeholder, need: c.measureText(i.placeholder).width, room };
    }));
    for (const i of inp) ok(i.need <= i.room + 0.5, `input: placeholder "${i.ph}" clipped on /${route} at ${w}px text ${text}% (${Math.round(i.need)} > ${Math.round(i.room)})`);
    if (['logbook', 'currency', 'milestones', 'costs', 'weather'].includes(route)) {
      const t = await p.evaluate(() => {
        const n = document.querySelector('.fl-tabs'); if (!n) return null;
        const cur = n.querySelector('[aria-current="page"]'), nb = n.getBoundingClientRect(), cb = cur?.getBoundingClientRect();
        return { clipped: n.scrollWidth > n.clientWidth + 1, fade: n.classList.contains('more-r') || n.classList.contains('more-l'), curIn: !cb || (cb.left >= nb.left - 1 && cb.right <= nb.right + 1), n: n.querySelectorAll('a').length };
      });
      if (t) { ok(t.n === 5, `tabs: expected 5 Flying tabs on /${route}`); ok(!t.clipped || t.fade, `tabs: strip clipped with no scroll fade on /${route} at ${w}px text ${text}%`); ok(t.curIn, `tabs: selected tab out of view on /${route} at ${w}px text ${text}%`); }
    }
  }
  await ctx.close();
}

// ---- two columns on a wide screen (list left, summary or open entry right, top-aligned inside the one frame) and rows
for (const w of [1024, 1280, 1440, 1920]) {
  const { ctx, p } = await newPage(w, 800);
  for (const [route, scope] of [['logbook', ''], ['travel', '.pax']]) {
    await go(p, route);
    const sel = { side: '.bc-side', list: '.bc-list', row: '.bc-row' }; // the Logbook and Travel are B-calm
    const r = await p.evaluate((sel) => {
      const side = document.querySelector(sel.side), list = document.querySelector(sel.list);
      const rows = [...document.querySelectorAll(sel.row)];
      const tabs = document.querySelector('.fl-tabs');
      const sb = side?.getBoundingClientRect(), lb = list?.getBoundingClientRect();
      return {
        cols: Boolean(sb && lb) && sb.left > lb.right - 1, topDelta: sb && lb ? Math.round(Math.abs(sb.top - lb.top)) : 999,
        rows: rows.length, undated: rows.filter((rw) => !/\d{2}\/\d{2}\/\d{4}/.test(rw.getAttribute('aria-label') || '')).length,
        noDay: rows.filter((rw) => !(rw.querySelector('.day')?.textContent || '').trim()).length,
        tabsFit: tabs ? tabs.scrollWidth <= tabs.clientWidth + 1 : true,
      };
    }, sel);
    ok(r.cols, `columns: the summary column is not to the right of the list on /${route} at ${w}px`);
    ok(r.topDelta <= 40, `columns: the two columns start ${r.topDelta}px apart on /${route} at ${w}px`);
    ok(r.rows > 0, `rows: no rows on /${route}`);
    ok(r.undated === 0, `rows: ${r.undated} rows without the full date in their accessible name on /${route}`);
    ok(r.noDay === 0, `rows: ${r.noDay} rows without a day or date on /${route}`);
    if (route === 'logbook') ok(r.tabsFit, `tabs: the five Flying tabs should fit the frame at 100% text (${w}px)`);
  }
  await ctx.close();
}
await browser.close();
console.log(`${checks - fails.length}/${checks} layout checks passed`);
process.exit(fails.length ? 1 : 0);
