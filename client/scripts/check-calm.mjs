// VISUAL CALM check: measures how busy a screen's FIRST viewport is, on the rendered page, and fails any screen over its limits. The word budget
// (check-words.mjs) says how much TEXT a screen has; this says how much there is to LOOK at.
//
//   PLAYWRIGHT_CORE=<playwright-core folder> BROWSER_EXE=<chromium> node client/scripts/check-calm.mjs [--base http://localhost:4173] [--widths 390,1440] [--routes /logbook,/]
//   ... node client/scripts/check-calm.mjs --mockups file:///.../docs/design/logbook-bcalm.html     every <figure data-calm="list|summary"> of a static mockup
//   flags: --table (numbers only, never fail)   --detail (name the elements counted)
//
// Read-only (it only loads pages). Measured per screen, first viewport (390x844 phone, 1440x900 desktop), main content only unless stated:
//   above    visible content elements (text, controls, icons, bars) ABOVE the first list row  (the "wall" before the first flight)
//   chrome   the same for the glass bars and Flying tabs, reported separately (not charged)
//   accent   elements coloured with an accent (sky or violet): text, icons, bars, the selected tab, the Add button; one bright thing per screen
//   share    accent-coloured TEXT as a percentage of the viewport area
//   rows     list rows fully visible on the first screen (calm screens show about six)
//   weights  distinct font weights in the viewport
//   shapes   distinct row shapes in the viewport (what a row is made of)
//   lines    visible dividers and borders (outside the glass controls)
//   numerals list numerals (a row's hours) that are accent-coloured: none allowed
//   firstRow how far down the screen the first row starts (px)
// LIMITS are the thresholds (docs/design/DESIGN_LANGUAGE.md "Visual calm"). A screen without list rows only checks the measures that apply.
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', process.env.BASE_URL || 'http://localhost:4173');
const MOCK = arg('--mockups', '');
const WIDTHS = arg('--widths', '390,1440').split(',').map(Number);
const ROUTES = arg('--routes', '/logbook,/travel,/').split(',');
const DETAIL = process.argv.includes('--detail');
const TABLE_ONLY = process.argv.includes('--table'); // report numbers, never fail
if (!process.env.PLAYWRIGHT_CORE || !process.env.BROWSER_EXE) { console.error('Set PLAYWRIGHT_CORE and BROWSER_EXE (see check-controls.mjs).'); process.exit(2); }
const { chromium } = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);

// Limits by screen kind. `list` screens have rows; `summary` screens do not. Phone and desktop share them: a wide screen must not be busier.
export const LIMITS = {
  list: { above: 10, accent: 4, share: 0.5, rowsMin: 3, rowsMax: 8, weights: 3, shapes: 2, lines: 3, firstRow: 400 },
  home: { above: 8, accent: 4, share: 0.5, weights: 4, lines: 3 },
  summary: { above: 12, accent: 6, share: 2.5, weights: 4, lines: 6 },
};
const KIND = (route) => (["/logbook", "/travel"].includes(route) ? "list" : route === "/" ? "home" : "summary");

/** Runs in the page. `root` is null for a whole page, or the frame element of a mockup (its box is then the viewport). */
const measure = (root) => {
  const scope = root || document;
  const fr = root ? root.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
  const vw = fr.width, vh = fr.height;
  const R = (e) => { const r = e.getBoundingClientRect(); return { left: r.left - fr.left, right: r.right - fr.left, top: r.top - fr.top, bottom: r.bottom - fr.top, width: r.width, height: r.height }; };
  const parse = (c) => {
    let m = c.match(/rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
    m = c.match(/color\(srgb ([^)]+)\)/);
    if (m) { const p = m[1].split(/[ \/]+/).filter(Boolean).map(Number); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 }; }
    return null;
  };
  // accent = a saturated blue or violet (sky #5bb9ff, violet #b7a0ff and their glass variants); white, greys and the semantic green/amber/red are not accents
  const isAccent = (c) => { const k = parse(c); if (!k || k.a < 0.35) return false; const mx = Math.max(k.r, k.g, k.b), mn = Math.min(k.r, k.g, k.b); return mx - mn >= 55 && k.b >= k.r - 10 && k.b >= k.g && k.b > 150; };
  const alphaOf = (c) => { const k = parse(c); return k ? k.a : 0; };
  const inView = (r) => r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
  const visible = (el) => {
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || cs.display === 'contents') return false;
    for (let n = el; n && n !== (root ? root.parentElement : document.body); n = n.parentElement) { if (Number(getComputedStyle(n).opacity) === 0) return false; if (n.getAttribute('aria-hidden') === 'true' && !n.closest('[data-row]')) return false; }
    return true;
  };
  const chromeSel = '.ds-topbar, .ds-tabbar, .ds-fab, .ds-menu, .fl-tabs, .ds-skip, .ds-toasts, .ds-edge, .mk-rail';
  const rowsAll = [...scope.querySelectorAll('[data-row]')].filter(visible);
  const firstRowTop = rowsAll.length ? Math.min(...rowsAll.map((r) => R(r).top)) : Infinity;

  const textOwners = [], icons = [], bars = [], controls = [], lines = [];
  const all = [...scope.querySelectorAll('*')].filter((e) => !e.closest('script,style') && (!e.closest('svg') || e.tagName.toLowerCase() === 'svg'));
  for (const el of all) {
    if (!visible(el)) continue;
    const r = R(el); if (!inView(r)) continue;
    const cs = getComputedStyle(el);
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const inChrome = Boolean(el.closest(chromeSel));
    const isControl = el.matches('a[href], button, input, select, textarea, [role="tab"], [role="button"], summary') && !el.closest('[data-row]');
    const rec = { el, r, cs, inChrome, own };
    if (own) textOwners.push(rec);
    if (el.tagName.toLowerCase() === 'svg' && !el.closest('[data-row]')) icons.push(rec);
    if (el.matches('[role="img"][aria-label] i, .mn-bar i, .mn-bar, .bc-line i, .bc-line') && alphaOf(cs.backgroundColor) > 0.35) bars.push(rec);
    if (isControl) controls.push(rec);
    const bw = ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(cs[`border${s}Width`]) >= 1 && cs[`border${s}Style`] !== 'none' && alphaOf(cs[`border${s}Color`]) > 0.04);
    if ((bw || el.tagName === 'HR') && !inChrome && !el.matches('.gl, .gl *, .gl-seg, .gl-seg *, .gl-field, .gl-select, .mk-fig, .mk-desk, .mk-phone')) lines.push(rec);
  }
  // elements above the first row: text owners, icons and controls above the first row's top (a control with text counts once, via the control)
  const above = new Set();
  const consider = (rec) => { if (!rec.inChrome && rec.r.bottom <= firstRowTop + 1) above.add(rec.el); };
  controls.forEach(consider); textOwners.forEach((t) => { if (!t.el.closest('a[href], button, [role="tab"], [role="button"], summary')) consider(t); });
  icons.forEach((i) => { if (!i.el.closest('a[href], button, [role="tab"], [role="button"]')) consider(i); }); bars.forEach(consider);
  const chromeCount = new Set([...controls, ...textOwners, ...icons].filter((x) => x.inChrome && x.r.bottom <= vh).map((x) => x.el)).size;

  // accent-coloured elements (anywhere on screen, chrome included: it all competes for attention)
  const accent = new Set();
  for (const t of textOwners) if (isAccent(t.cs.color)) accent.add(t.el);
  for (const i of icons) { const s = getComputedStyle(i.el); if (isAccent(s.color) || isAccent(s.stroke)) accent.add(i.el); }
  for (const b of bars) if (isAccent(b.cs.backgroundColor)) accent.add(b.el);
  for (const c of controls) if (isAccent(c.cs.backgroundColor) || isAccent(c.cs.borderTopColor)) accent.add(c.el);
  // glass pilot / pax buttons are tinted by gradients: count a control that carries the pilot or pax role; inside a segmented control or the Flying tabs every
  // button carries the role class but only the selected one is tinted
  for (const c of controls) {
    if (!(/(^|\s)(pilot|pax)(\s|$)/.test(String(c.el.className)) && c.el.matches('.gl'))) continue;
    const inSeg = Boolean(c.el.closest('.gl-seg, .fl-tabs'));
    const on = c.el.getAttribute('aria-selected') === 'true' || c.el.getAttribute('aria-current') === 'page' || c.el.getAttribute('aria-pressed') === 'true';
    if (!inSeg || on) accent.add(c.el);
  }
  for (const c of controls) if (c.el.getAttribute('aria-selected') === 'true' || c.el.getAttribute('aria-current') === 'page') accent.add(c.el);
  for (const f of scope.querySelectorAll('.ds-fab')) if (inView(R(f))) accent.add(f); // the Add button's violet-to-sky ring

  let accentArea = 0;
  for (const t of textOwners) if (isAccent(t.cs.color)) accentArea += Math.max(0, Math.min(t.r.right, vw) - Math.max(t.r.left, 0)) * Math.max(0, Math.min(t.r.bottom, vh) - Math.max(t.r.top, 0));
  const share = (accentArea / (vw * vh)) * 100;

  const weights = new Set(textOwners.filter((t) => !t.inChrome && t.el.textContent.trim()).map((t) => t.cs.fontWeight));
  const rowsFull = rowsAll.filter((r) => { const b = R(r); return b.top >= 0 && b.bottom <= vh; });
  const shape = (r) => `${r.tagName}.${[...r.classList].filter((c) => !/^(sel|full|dm|mn-press|press)$/.test(c)).join('.')}|icons:${r.querySelectorAll('svg').length}|text:${r.querySelectorAll('.t > *').length}`;
  const shapes = new Set(rowsFull.map(shape));
  const accentNumerals = rowsAll.filter((r) => { const v = r.querySelector('.v'); return v && isAccent(getComputedStyle(v).color); }).length;
  const name = (e) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''} "${(e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24)}"`;
  return {
    detail: { above: [...above].map(name), accent: [...accent].map(name), lines: lines.map((l) => name(l.el)) },
    above: above.size, chrome: chromeCount, accent: accent.size, share: Math.round(share * 100) / 100, rows: rowsFull.length, weights: weights.size, shapes: shapes.size,
    lines: lines.length, numerals: accentNumerals, hasRows: rowsAll.length > 0, firstRow: Number.isFinite(firstRowTop) ? Math.round(firstRowTop) : 0,
  };
};

const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXE });
const table = []; const fails = [];
const judge = (label, kind, m) => {
  const L = LIMITS[kind];
  table.push({ screen: label, above: m.above, chrome: m.chrome, accent: m.accent, 'accent %': m.share, rows: m.rows, 'first row px': m.firstRow, weights: m.weights, shapes: m.shapes, lines: m.lines, 'accent numerals': m.numerals });
  if (DETAIL) console.log(`\n${label}\n  above the first row: ${m.detail.above.join(' | ')}\n  accent: ${m.detail.accent.join(' | ')}\n  lines: ${m.detail.lines.join(' | ')}`);
  const bad = (msg) => fails.push(`${label}: ${msg}`);
  if (m.above > L.above) bad(`${m.above} elements above the first row (limit ${L.above})`);
  if (m.accent > L.accent) bad(`${m.accent} accent-coloured elements (limit ${L.accent})`);
  if (m.share > L.share) bad(`accent text covers ${m.share}% of the screen (limit ${L.share}%)`);
  if (m.weights > L.weights) bad(`${m.weights} font weights (limit ${L.weights})`);
  if (m.lines > L.lines) bad(`${m.lines} dividers and borders (limit ${L.lines})`);
  if (kind === 'list' && m.hasRows) {
    if (m.rows < L.rowsMin) bad(`only ${m.rows} rows on the first screen (at least ${L.rowsMin})`);
    if (m.rows > L.rowsMax) bad(`${m.rows} rows on the first screen (at most ${L.rowsMax})`);
    if (m.shapes > L.shapes) bad(`${m.shapes} distinct row shapes (limit ${L.shapes})`);
    if (m.numerals > 0) bad(`${m.numerals} list numerals are accent-coloured (none allowed)`);
    if (L.firstRow && m.firstRow > L.firstRow && m.firstRow > 0 && label.includes('390')) bad(`the first row starts ${m.firstRow}px down (limit ${L.firstRow}px)`);
  }
};

if (MOCK) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(MOCK, { waitUntil: 'load' }); await p.waitForTimeout(800);
  const figs = p.locator('figure[data-calm]');
  const n = await figs.count();
  for (let i = 0; i < n; i++) {
    const f = figs.nth(i); const kind = await f.getAttribute('data-calm'); const name = await f.getAttribute('data-name');
    const frame = f.locator('.mk-phone, .mk-desk').first();
    judge(name, kind, await frame.evaluate(measure));
  }
  await ctx.close();
} else {
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, reducedMotion: 'reduce' });
    await ctx.route(/arcgisonline|basemaps\.cartocdn|tile\.openstreetmap/, (r) => r.abort());
    const p = await ctx.newPage();
    for (const route of ROUTES) {
      await p.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      await p.evaluate(() => { try { localStorage.setItem('aerohub-logbook-view', 'list'); } catch { /* ignore */ } });
      await p.waitForTimeout(1300);
      judge(`${route || '/'} @${w}`, KIND(route), await p.evaluate(measure, null));
    }
    await ctx.close();
  }
}
await browser.close();
console.table(table);
const JSON_OUT = arg('--json', '');
if (JSON_OUT) { const { writeFileSync, readFileSync, existsSync } = await import('node:fs'); const set = arg('--set', 'measured'); const prev = existsSync(JSON_OUT) ? JSON.parse(readFileSync(JSON_OUT, 'utf8')) : []; writeFileSync(JSON_OUT, JSON.stringify([...prev.filter((r) => !(r.set === set && table.some((t) => t.screen === r.screen))), ...table.map((r) => ({ set, ...r }))], null, 1)); }
if (TABLE_ONLY) { console.log('(--table: numbers only, nothing fails)'); process.exit(0); }
for (const f of fails) console.log('FAIL', f);
console.log(`${table.length - new Set(fails.map((f) => f.split(':')[0])).size}/${table.length} screens within the calm limits`);
process.exit(fails.length ? 1 : 0);
