// PAGE WIDTH (read-only). Every page's main content runs the full width of the List/Ledger on the same device and text size, and no row stops short of its container:
//   1. each block of a page's column (the direct children of the page's stack, list or card column) is at least as wide as the Logbook list is on that device;
//   2. a row with a right-aligned trailing cell (its last child sits at the right end of the row's content box: a card header's chevron, a list item's hours, a status or progress
//      value, a disclosure; a row whose text just ends is not measured) ends within 1.75rem of its own right edge, so nothing keeps
//      a permanent strip clear for the floating Add button (the Log's List and Ledger lost theirs on 2026-10-15; Stats still had it on 2026-10-18).
// Phones in portrait (one column) and the narrow landscape phone, at 100%, 130% and 200% text.
//
//   PLAYWRIGHT_CORE=<playwright-core folder> BROWSER_EXE=<chrome.exe for the Android size> node client/scripts/check-page-width.mjs [--base http://localhost:4175] [--text 100,130,200]
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { openContext, launchBrowsers } from './lib/devices.mjs';
import { AUDIT_DEVICES, routesFor } from './lib/uiAudit.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:4175');
const TEXTS = arg('--text', '100,130,200').split(',').map(Number);
if (!process.env.PLAYWRIGHT_CORE) { console.error('Set PLAYWRIGHT_CORE (and BROWSER_EXE for the Android size).'); process.exit(2); }
const pw = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);
// one column only: portrait phones and the Android size, and the narrowest landscape phone (667px is still one column)
const devices = AUDIT_DEVICES.filter((d) => (d.name.endsWith('portrait') && d.width < 720) || d.name === 'iPhone SE landscape');
const browsers = await launchBrowsers(pw, { chromiumExe: process.env.BROWSER_EXE, need: [...new Set(devices.map((d) => d.engine))] });

const probeCtx = await browsers.webkit.newContext();
const probe = await probeCtx.newPage();
await probe.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
const ids = await probe.evaluate(async () => {
  const j = async (u) => (await fetch(u)).json().catch(() => []);
  const [f, g, a, e] = await Promise.all([j('/api/flights'), j('/api/costs/ground-sessions'), j('/api/aircraft'), j('/api/expirations')]);
  return { pilot: f.find((x) => x.role === 'pilot')?.id ?? 1, pax: f.find((x) => x.role === 'passenger' && x.airline)?.id ?? 1, ground: g[0]?.id ?? 1, aircraft: a[0]?.id ?? 1, expiration: e[0]?.id ?? null };
});
await probeCtx.close();
// content pages only (a form's fields are measured by check-card-width and check-phone-forms; the map and the print view have their own frame)
const routes = routesFor(ids).filter((r) => !/(\/new|\/edit|\/quick|\/map|\/print|view=ledger)/.test(r));

const measure = () => {
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const shown = (e) => { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const col = document.querySelector('main .cl') ?? document.querySelector('main');
  const level = (el) => [...el.children].filter((k) => shown(k) && !['absolute', 'fixed'].includes(getComputedStyle(k).position));
  const blocks = [];
  if (col) {
    for (const k of level(col)) {
      if (k.classList.contains('bc-stack') || k.classList.contains('bc-list')) for (const kk of level(k)) blocks.push(kk); else blocks.push(k);
    }
  }
  const trailing = [];
  for (const row of document.querySelectorAll('main button.hd, main .bc-item, main .mn-fold, main .mn-prog, main .mn-st, main .bc-status, main .bc-pickrow, main .bc-row, main .bc-mh')) {
    if (!shown(row)) continue;
    const r = row.getBoundingClientRect();
    // only a row with a right-aligned trailing cell counts: its last child sits at the right end of the row's own content box (pushed there by space-between, an auto margin or a
    // fixed column), so the row's right padding is what keeps a strip clear. A row whose text simply ends where the text ends has no trailing cell and is not measured.
    const cs = getComputedStyle(row);
    const contentRight = r.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
    const kids = [...row.children].filter((k) => shown(k) && !['absolute', 'fixed'].includes(getComputedStyle(k).position));
    if (kids.length < 2) continue;
    const last = kids[kids.length - 1].getBoundingClientRect();
    if (last.right < contentRight - 1) continue;
    trailing.push({ name: (row.getAttribute('aria-label') || row.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30), cls: row.className.split(' ')[0], gap: Math.round((r.right - last.right) * 10) / 10 });
  }
  const list = document.querySelector('.bc-list');
  const bx = (b) => b.getBoundingClientRect();
  return { root, vw: innerWidth, listWidth: list ? bx(list).width : null, blocks: blocks.map((b) => ({ cls: (b.className || b.tagName).toString().split(' ').slice(0, 2).join('.'), left: Math.round(bx(b).left), width: Math.round(bx(b).width * 10) / 10 })), trailing };
};

const rows = []; const fails = [];
for (const d of devices) for (const TEXT of TEXTS) {
  const ctx = await openContext(browsers, d);
  await ctx.addInitScript((t) => { const set = () => { if (document.documentElement) document.documentElement.style.fontSize = `${t}%`; }; set(); document.addEventListener('DOMContentLoaded', set); }, TEXT);
  const p = await ctx.newPage();
  await p.route(/planespotters|plnspttrs|arcgisonline|cartocdn|tile\.openstreetmap/, (r) => r.abort());
  const load = async (route) => {
    await p.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('main', { timeout: 8000 }).catch(() => {});
    await p.waitForFunction(() => !document.querySelector('.skel, [aria-busy="true"]'), null, { timeout: 4000 }).catch(() => {});
    await p.waitForTimeout(350);
  };
  await load('/logbook');
  const ref = (await p.evaluate(measure)).listWidth;
  for (const route of routes) {
    await load(route);
    const m = await p.evaluate(measure);
    const why = [];
    for (const b of m.blocks) if (ref && b.width < ref - 1.5) why.push(`block ${b.cls} is ${b.width}px wide, the List is ${ref}px`);
    for (const t of m.trailing) if (t.gap > m.root * 1.75) why.push(`row "${t.name}" (${t.cls}) stops ${t.gap}px short of its right edge (limit ${Math.round(m.root * 1.75)}px)`);
    rows.push({ device: d.name, text: TEXT, route: route.replace(/\/\d+/g, '/:id'), blocks: m.blocks.length, rowsChecked: m.trailing.length });
    if (why.length) fails.push(...[...new Set(why)].map((w) => `${d.name} ${route.replace(/\/\d+/g, '/:id')} text ${TEXT}%: ${w}`));
  }
  await ctx.close();
}
for (const b of Object.values(browsers)) await b.close();
const uniq = [...new Set(fails)];
if (uniq.length) console.log(`\n${uniq.length} page-width failure(s):\n - ${uniq.slice(0, 25).join('\n - ')}${uniq.length > 25 ? `\n ... ${uniq.length - 25} more` : ''}`);
const checked = rows.reduce((n, r) => n + r.blocks + r.rowsChecked, 0);
console.log(`Page width: ${rows.length} pages (${devices.length} devices x text ${TEXTS.join('/')}% x ${routes.length} routes), ${checked} blocks and rows measured, ${uniq.length} failures. ${BASE}`);
process.exit(uniq.length ? 1 : 0);
