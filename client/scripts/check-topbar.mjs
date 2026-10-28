// Top bar and page-frame regression guard. For every route at every width below, the glass top bar must have exactly Home's left edge, right edge, height
// and top offset, and no visible control may sit under the bar or the desktop rail (or, on the full-bleed Map, the phone tab bar).
//
//   PLAYWRIGHT_CORE=<playwright-core folder> BROWSER_EXE=<chromium> node client/scripts/check-topbar.mjs [--base http://localhost:4173] [--widths 390,1100]
//
// The ONE page frame (Task 3): the content column is the top bar's width. On every route the content must stay inside the bar's left and right edges; on
// every non-form route the first content element starts exactly at the bar's left edge; on
// every Flying root the top bar's title is the Flying switcher (it replaced the tab strip); and no unexplained vertical gap over 48px (empty space between content) exists. Forms may use a narrower inner column.
//
// The title is centred on the BAR (added 2026-10-27, feat/topbar-center): the top bar is a three-column grid (slot | title | slot) with equal slot minimums, so the title's centre must equal the
// bar's centre on every route at every width, and at 390/430 portrait and 844 landscape, at 100% and 200% text, also the viewport's centre, within 0.5px. No control in a slot may touch the
// title, and a title keeps at least half the bar (or all of what it needs when that is less).
//
// Drives a real browser against a RUNNING production build; it only ever reads (GET /api/flights for ids). Include it in every verification.
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', process.env.BASE_URL || 'http://localhost:4173');
const API = process.env.API_URL || 'http://localhost:3001';
const WIDTHS = arg('--widths', '390,768,1024,1100,1280,1366,1440,1536,1920,2560').split(',').map(Number);
if (!process.env.PLAYWRIGHT_CORE || !process.env.BROWSER_EXE) { console.error('Set PLAYWRIGHT_CORE and BROWSER_EXE (see check-controls.mjs).'); process.exit(2); }
const { chromium } = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);

let pilot = 5, pax = 181;
try { const f = await (await fetch(`${API}/api/flights`)).json(); pilot = f.find((x) => x.role === 'pilot')?.id ?? pilot; pax = f.find((x) => x.role === 'passenger')?.id ?? pax; } catch { /* defaults */ }
const ROUTES = ['', 'logbook', `logbook/${pilot}`, 'logbook/ground/1', 'travel', `travel/${pax}`, 'logbook/data', 'aircraft', 'aircraft/new', 'aircraft/15',
  'logbook/new', 'logbook/new?role=passenger', 'logbook/quick', 'logbook/share', `logbook/${pilot}/edit`, 'logbook/ground/new', 'logbook/ground/1/edit',
  'milestones', 'currency', 'currency/new', 'currency/1', 'map', 'stats', 'more', 'settings', 'flying'];

const FORM = /^(logbook\/(new|quick|ground\/new|\d+\/edit|ground\/\d+\/edit|share)|aircraft\/(new|\d+)|currency\/(new|\d+)|settings)/;
const FLYING = /^(logbook$|logbook\/\d+$|logbook\/ground\/\d+$|currency$|milestones$|flying$)/;
const measure = () => {
  const rect = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
  const bar = document.querySelector('header.ds-topbar'), nav = document.querySelector('nav[aria-label="Primary"]');
  if (!bar) return { missing: true };
  const B = rect(bar), N = nav && getComputedStyle(nav).display !== 'none' && getComputedStyle(nav).visibility !== 'hidden' ? rect(nav) : null;
  const rail = N && N.h > N.w ? N : null;
  const hit = (a, b, pad = 0) => a.l < b.r - pad && a.r > b.l + pad && a.t < b.b - pad && a.b > b.t + pad;
  const overlaps = [], fab = !rail && document.querySelector('.ds-fab') ? rect(document.querySelector('.ds-fab')) : null;
  const sel = 'a[href],button,input,select,textarea,summary,[role="button"],[role="menuitem"],[tabindex]:not([tabindex="-1"])';
  for (const el of document.querySelectorAll(sel)) {
    if (el.classList.contains('leaflet-container') || bar.contains(el) || (nav && nav.contains(el)) || el.closest('.ds-fab,.ds-menu,.ds-skip,.ds-toasts,.leaflet-map-pane,[inert],[aria-hidden="true"]')) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    let hidden = false; for (let n = el; n && n !== document.body; n = n.parentElement) { if (Number(getComputedStyle(n).opacity) === 0) { hidden = true; break; } }
    if (hidden) continue;
    const r = rect(el); if (r.w < 2 || r.h < 2) continue;
    const name = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30);
    if (hit(r, B, 1)) overlaps.push(`"${name}" under the top bar`);
    if (rail && hit(r, rail, 1)) overlaps.push(`"${name}" under the rail`);
    if (fab && location.pathname === '/map' && hit(r, fab, 1)) overlaps.push(`"${name}" under the Add button`);
    if (!rail && N && location.pathname === '/map' && hit(r, N, 1)) overlaps.push(`"${name}" under the tab bar`);
  }
  // ---- the frame: where the page content sits relative to the bar ----
  const main = document.querySelector('#main');
  let frame = null;
  if (main && location.pathname !== '/map') {
    const items = [];
    const alpha = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return 0; const p = m[1].split(/[ ,\/]+/); return p.length > 3 ? Number(p[3]) : 1; };
    for (const el of main.querySelectorAll('*')) {
      if (el.closest('.ds-toasts,.leaflet-container,[hidden]') || el.matches('.sr-only')) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || cs.display === 'contents' || cs.position === 'fixed') continue;
      let hid = false; for (let n = el; n && n !== main; n = n.parentElement) if (Number(getComputedStyle(n).opacity) === 0) { hid = true; break; }
      if (hid) continue;
      const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 2) continue;
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      const leaf = hasText || (el.children.length === 0 && ['svg', 'img', 'input', 'textarea', 'canvas', 'select', 'path', 'i'].includes(el.tagName.toLowerCase()));
      const gl = el.matches('.gl, .gl-seg, .gl-field, .gl-select, .gl-switch, button, input, select, textarea'); // .gl-switch added 2026-10-16: a switch is a control (it has no text of its own), and a page of switch rows read as a 56px gap once its card background was gone
      const painted = alpha(cs.backgroundColor) > 0.05 || ['svg', 'img', 'canvas'].includes(el.tagName.toLowerCase());
      // what a clipping or scrolling ancestor hides is not content on the page: clamp to it
      let cl = r.left, cr = r.right;
      for (let n = el.parentElement; n && n !== main; n = n.parentElement) {
        const o = getComputedStyle(n);
        if (o.overflowX !== 'visible') { const pr = n.getBoundingClientRect(); cl = Math.max(cl, pr.left); cr = Math.min(cr, pr.right); }
      }
      if (cr - cl < 4) continue;
      if (leaf || painted || gl) items.push({ l: cl, r: cr, t: r.top + scrollY, b: r.bottom + scrollY, w: cr - cl });
    }
    if (items.length) {
      // the first content row: the leftmost element among those that start within 40px of the page's topmost one (columns side by side start together)
      const topT = Math.min(...items.map((i) => i.t));
      const first = items.filter((i) => i.t <= topT + 40).sort((a, b) => a.l - b.l)[0];
      const minL = Math.min(...items.map((i) => i.l)), maxR = Math.max(...items.map((i) => i.r));
      const ivs = items.map((i) => [i.t, i.b]).sort((a, b) => a[0] - b[0]); let end = ivs[0][1], gap = 0, gapAt = 0;
      for (const [t, b] of ivs) { if (t - end > gap) { gap = t - end; gapAt = end; } end = Math.max(end, b); }
      const sw = document.querySelector('button.bc-sw');
      frame = { minL, maxR, firstL: first.l, gap: Math.round(gap), gapAt: Math.round(gapAt), switcher: Boolean(sw) && sw.getAttribute('aria-haspopup') === 'menu' && sw.getAttribute('aria-expanded') === 'false' && Boolean(sw.getAttribute('aria-label')) };
    }
  }
  // ---- the title: where it sits in the bar, and whether a slot control runs into it ----
  const ttl = bar.querySelector('.ttl'), T = rect(ttl), clash = [];
  bar.querySelectorAll(':scope > .g-in > .side').forEach((side, k) => {
    for (const c of side.children) {
      if (getComputedStyle(c).display === 'none') continue;
      const r = rect(c); if (r.w < 1) continue;
      if (k === 0 ? r.r > T.l + 0.5 : r.l < T.r - 0.5) clash.push(`${k === 0 ? 'left' : 'right'} slot "${(c.getAttribute('aria-label') || c.textContent || c.className).trim().slice(0, 20)}" touches the title`);
    }
  });
  const title = { l: T.l, r: T.r, w: T.w, natural: ttl.scrollWidth, vw: document.documentElement.clientWidth, clash };
  return { bar: B, overlaps, frame, title };
};

const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXE });
let checks = 0; const fails = []; const tabsSeen = [];
for (const w of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  const run = async (route) => { await p.goto(`${BASE}/${route}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(350); return p.evaluate(measure); };
  const home = await run('');
  if (home.missing) { fails.push(`no top bar on Home at ${w}px`); await ctx.close(); continue; }
  for (const route of ROUTES) {
    const m = route === '' ? home : await run(route);
    checks++;
    if (m.missing) { fails.push(`/${route} @${w}: no top bar`); continue; }
    for (const k of ['l', 'r', 'h', 't']) if (Math.abs(m.bar[k] - home.bar[k]) > 0.6) fails.push(`/${route} @${w}: bar ${k} ${m.bar[k].toFixed(1)} vs Home ${home.bar[k].toFixed(1)}`);
    { const off = (m.title.l + m.title.r) / 2 - (m.bar.l + m.bar.r) / 2; if (Math.abs(off) > 0.5) fails.push(`/${route} @${w}: title centre is ${off.toFixed(1)}px off the bar centre`); }
    for (const o of m.overlaps) fails.push(`/${route} @${w}: ${o}`);
    if (m.frame) {
      const f = m.frame, form = FORM.test(route.split('?')[0]);
      if (f.minL < m.bar.l - 1) fails.push(`/${route} @${w}: content starts ${(m.bar.l - f.minL).toFixed(0)}px left of the bar (${f.minL.toFixed(0)} vs ${m.bar.l.toFixed(0)})`);
      if (f.maxR > m.bar.r + 1) fails.push(`/${route} @${w}: content runs ${(f.maxR - m.bar.r).toFixed(0)}px past the bar's right edge (${f.maxR.toFixed(0)} vs ${m.bar.r.toFixed(0)})`);
      if (!form && w >= 768 && Math.abs(f.firstL - m.bar.l) > 1.5) fails.push(`/${route} @${w}: first content element at ${f.firstL.toFixed(0)}, the bar's left edge is ${m.bar.l.toFixed(0)}`);
      if (f.gap > 48) fails.push(`/${route} @${w}: ${f.gap}px of empty space at y=${f.gapAt}`);
      if (/^(logbook|currency|milestones|flying)$/.test(route)) { // a Flying root: the title is the switcher (the Flying pages became its menu)
        tabsSeen.push(route);
        if (!f.switcher) fails.push(`/${route} @${w}: no Flying switcher (a menu button with aria-expanded and an accessible name) in the top bar`);
      }
    }
  }
  console.log(`${w}px: Home bar ${home.bar.l.toFixed(0)}..${home.bar.r.toFixed(0)} (${home.bar.w.toFixed(0)} wide, ${home.bar.h.toFixed(0)} high, top ${home.bar.t.toFixed(0)})`);
  await ctx.close();
}
// ---- title centring on phones and in landscape, at normal and large text ----
const VIEWS = [['390x844 portrait', 390, 844], ['430x932 portrait', 430, 932], ['844x390 landscape', 844, 390]];
let worst = 0;
for (const [vname, w, h] of VIEWS) for (const text of [100, 200]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  for (const route of ROUTES) {
    await p.goto(`${BASE}/${route}`, { waitUntil: 'networkidle' });
    await p.addStyleTag({ content: `html{font-size:${text}% !important}` });
    await p.waitForTimeout(350);
    const m = await p.evaluate(measure); checks++;
    const tag = `/${route} @${vname} ${text}% text`;
    if (m.missing) { fails.push(`${tag}: no top bar`); continue; }
    const off = (m.title.l + m.title.r) / 2 - m.title.vw / 2; worst = Math.max(worst, Math.abs(off));
    if (Math.abs(off) > 0.5) fails.push(`${tag}: title centre is ${off.toFixed(1)}px off the viewport centre`);
    for (const c of m.title.clash) fails.push(`${tag}: ${c}`);
    const want = Math.min(m.title.natural, m.bar.w * 0.5);
    if (m.title.w < want - 1) fails.push(`${tag}: title is ${m.title.w.toFixed(0)}px wide, needs ${want.toFixed(0)}px (it needs ${m.title.natural}px, half the bar is ${(m.bar.w / 2).toFixed(0)}px)`);
  }
  await ctx.close();
}
console.log(`title centring: ${VIEWS.length * 2 * ROUTES.length} route/view/text checks, worst offset from the viewport centre ${worst.toFixed(2)}px`);
await browser.close();
for (const f of fails) console.log('FAIL', f);
console.log(`${checks} route/width checks (Flying switcher present on ${new Set(tabsSeen).size} Flying roots), ${fails.length} failures.`);
process.exit(fails.length ? 1 : 0);
