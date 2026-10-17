// WRAP AUDIT. Looks at how text actually wraps, on the real fonts, in WebKit (an iPhone profile, the engine every iPhone browser uses) and in Chromium, at
// phone widths, with a WIDENING factor (letter-spacing that makes every line that much wider, standing in for a wider font, a different device or a larger
// text setting). It fails on:
//   midword     a word broken across two lines (no hyphen or slash to break at)
//   orphan      a last line of a single number or a word of one or two letters (a unit like "h" or "nm" stranded under its number); a three-letter word is allowed
//   overlap     two pieces of text drawn on top of each other
//   offscreen   text outside the viewport on the left or right (outside a sideways scroller), or the page scrolling sideways
//   toomanylines a control label (button, chip, tab) wrapping onto more than 2 lines, or a row-sized button's label onto more than 3
//   behindbar   at the end of the page (scrolled all the way down) page text still sits behind the tab bar or the Save bar
//   truncated   text cut with an ellipsis inside a list row or a heading (rows and titles must show whole)
//   (a control label on exactly 2 lines is reported as a note, not a failure)
// Read-only: it only loads pages.
//
//   PLAYWRIGHT_CORE=<..> BROWSER_EXE=<chromium> node client/scripts/check-wrap.mjs [--base http://localhost:4174] [--api http://localhost:3002]
//       [--engines webkit,chromium] [--widths 360,390,430] [--factors 1,1.1,1.2] [--routes /,/logbook] [--detail 12] [--json out.json]
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:4174');
const API = arg('--api', 'http://localhost:3002');
const ENGINES = arg('--engines', 'webkit,chromium').split(',');
const WIDTHS = arg('--widths', '360,390,430').split(',').map(Number);
const FACTORS = arg('--factors', '1,1.1,1.2').split(',').map(Number);
const ONLY = arg('--routes', '') ? arg('--routes', '').split(',') : null;
const DETAIL = Number(arg('--detail', 10));
if (!process.env.PLAYWRIGHT_CORE) { console.error('Set PLAYWRIGHT_CORE (and BROWSER_EXE for Chromium).'); process.exit(2); }
const pw = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);
const { webkit, chromium, devices } = pw.default ?? pw;

const get = async (p) => (await fetch(`${API}/api${p}`)).json();
const flights = await get('/flights'); const ground = await get('/costs/ground-sessions').catch(() => []); const aircraft = await get('/aircraft').catch(() => []);
const pilot = flights.find((f) => f.role === 'pilot')?.id, pax = flights.find((f) => f.role === 'passenger')?.id;
const ROUTES = ['/', '/logbook', `/logbook/${pilot}`, `/logbook/ground/${ground[0]?.id ?? 1}`, '/travel', `/travel/${pax}`, '/logbook/data', '/aircraft', '/aircraft/new', `/aircraft/${aircraft[0]?.id ?? 1}`,
  '/logbook/new', '/logbook/new?role=passenger', '/logbook/quick', '/logbook/share', '/logbook/print', `/logbook/${pilot}/edit`, '/logbook/ground/new', '/milestones', '/currency', '/currency/new',
  '/map', '/stats', '/stats?tab=travel', '/stats?tab=places', '/more', '/settings']
  .filter((r) => !ONLY || ONLY.includes(r));

/** Runs in the page. */
const CHROME = '.ds-tabbar, .ds-topbar, .ds-fab, .ds-menu, .ds-sheet, .ds-savebar, .ds-rail, .ds-edge, .ds-skip, .ds-scrim-dim, .ds-popover';
const audit = () => {
  const CHROME = '.ds-tabbar, .ds-topbar, .ds-fab, .ds-menu, .ds-sheet, .ds-savebar, .ds-rail, .ds-edge, .ds-skip, .ds-scrim-dim, .ds-popover';
  const out = []; const add = (type, el, text) => out.push({ type, el: `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''}`, text: String(text).replace(/\s+/g, ' ').slice(0, 60) });
  const vw = innerWidth;
  const visible = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0 || e.getAttribute('aria-hidden') === 'true' && !e.closest('[data-row]') && e.matches('.ds-sheet:not(.is-open)')) return false; } return true; };
  const scroller = (el) => { for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const ox = getComputedStyle(e).overflowX; if ((ox === 'auto' || ox === 'scroll') && e.scrollWidth > e.clientWidth + 1) return true; } return false; };
  if (document.documentElement.scrollWidth > vw + 1) add('offscreen', document.documentElement, `the page scrolls sideways (${document.documentElement.scrollWidth} > ${vw})`);
  const boxes = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (['SCRIPT', 'STYLE', 'SVG', 'PATH', 'OPTION', 'NOSCRIPT'].includes(el.tagName.toUpperCase()) || el.closest('svg')) continue;
    const textNodes = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
    if (!textNodes.length || !visible(el) || el.closest('.ds-sheet:not(.is-open), .ds-menu:not(.is-open), .ds-skip, [inert]')) continue;
    const cs = getComputedStyle(el); const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
    const words = []; // { text, tops: [..], rect }
    for (const n of textNodes) {
      const re = /\S+/g; let m; const t = n.textContent;
      while ((m = re.exec(t))) { const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length); const rects = [...r.getClientRects()].filter((q) => q.width > 0.5 && q.height > 0.5); if (rects.length) words.push({ text: m[0], rects }); }
    }
    if (!words.length) continue;
    // lines: bucket every word's first rect by its top
    const tops = []; for (const w of words) { const top = w.rects[0].top; if (!tops.some((t) => Math.abs(t - top) < lh * 0.5)) tops.push(top); }
    // text box (union) for overlap
    const u = words.reduce((a, w) => w.rects.reduce((b, q) => ({ l: Math.min(b.l, q.left), t: Math.min(b.t, q.top), r: Math.max(b.r, q.right), b: Math.max(b.b, q.bottom) }), a), { l: 1e9, t: 1e9, r: -1e9, b: -1e9 });
    // mid-word
    for (const w of words) {
      if (w.rects.length > 1 && w.text.length >= 4 && !/[-\/·→–—.,:;]/.test(w.text.slice(1, -1))) { const ts = w.rects.map((q) => q.top); if (Math.max(...ts) - Math.min(...ts) > lh * 0.5) add('midword', el, w.text); }
    }
    // orphan: more than one line and the last line is a single short word
    if (tops.length >= 2) {
      const lastTop = Math.max(...tops); const last = words.filter((w) => Math.abs(w.rects[0].top - lastTop) < lh * 0.5);
      if (last.length === 1 && words.length >= 3 && (last[0].text.length <= 2 || /^[d.,$%]{1,7}$/.test(last[0].text))) add('orphan', el, `…${words.slice(-3).map((w) => w.text).join(' ')}`);
    }
    // controls
    const ctl = el.closest('button, a.gl, [role="tab"], .gl-chip, .gl');
    const isRow = ctl && ctl.closest('.mn-prog, .mn-st, .mn-fold, .bc-item, .bc-mrow, .bc-row, .bc-mh, .bc-grow, [data-row]'); // a row-sized button may take 3 lines; a pill control (button, chip, tab) at most 2
    if (ctl && ctl.getBoundingClientRect().height < 120) { if (tops.length > (isRow ? 3 : 2)) add('toomanylines', el, words.map((w) => w.text).join(' ')); else if (tops.length === 2 && !isRow && ctl.matches('button, [role="tab"], .gl-chip')) add('note2lines', el, words.map((w) => w.text).join(' ')); }
    // truncation in rows and headings
    if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1 && (el.closest('[data-row], h1, h2, h3, .bc-item, .bc-row') )) add('truncated', el, words.map((w) => w.text).join(' '));
    // off screen
    if ((u.r > vw + 1 || u.l < -1) && !scroller(el) && !el.closest('.ds-sheet:not(.is-open)')) add('offscreen', el, words.map((w) => w.text).join(' '));
    if (!el.closest(CHROME)) boxes.push({ el, u }); // fixed bars, sheets and menus float over the page by design: page text scrolling under them is not an overlap
  }
  // overlap between pieces of text that are both on top at their own centre
  const textEls = new Set(boxes.map((b) => b.el));
  const top = boxes.filter((b) => { const cx = (b.u.l + b.u.r) / 2, cy = (b.u.t + b.u.b) / 2; if (cx < 0 || cx > vw || cy < 0 || cy > innerHeight) return false; const e = document.elementFromPoint(cx, cy); if (!e) return false; if (b.el === e || b.el.contains(e) || e.contains(b.el)) return true; for (let x = e; x && x !== document.body; x = x.parentElement) if (textEls.has(x)) return true; return false; /* on top, or only under another piece of text (that is the overlap) */ });
  for (let i = 0; i < top.length && out.length < 400; i++) for (let j = i + 1; j < top.length; j++) {
    const a = top[i], b = top[j]; if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const w = Math.min(a.u.r, b.u.r) - Math.max(a.u.l, b.u.l), h = Math.min(a.u.b, b.u.b) - Math.min(Math.max(a.u.t, b.u.t), 1e9) ; const hh = Math.min(a.u.b, b.u.b) - Math.max(a.u.t, b.u.t);
    if (w > 2 && hh > 2) { const area = w * hh, small = Math.min((a.u.r - a.u.l) * (a.u.b - a.u.t), (b.u.r - b.u.l) * (b.u.b - b.u.t)); if (area > small * 0.25) add('overlap', a.el, `${a.el.textContent.trim().slice(0, 24)} / ${b.el.textContent.trim().slice(0, 24)}`); }
  }
  // the end of the page: scrolled all the way down, no page text may sit behind the tab bar or the Save bar (it would be unreachable)
  window.scrollTo(0, document.documentElement.scrollHeight); 
  const bars = [...document.querySelectorAll('.ds-tabbar, .ds-savebar')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 1 && r.height > 1 && getComputedStyle(b).display !== 'none'; }).map((b) => b.getBoundingClientRect());
  if (bars.length) for (const { el } of boxes) { const r = el.getBoundingClientRect(); if (r.height < 1) continue; const lastLine = r.bottom; for (const bar of bars) if (lastLine > bar.top + 6 && r.top < bar.bottom && r.right > bar.left && r.left < bar.right && r.top >= 0 && r.bottom <= innerHeight + 2 && !el.closest(CHROME)) { add('behindbar', el, el.textContent.trim().slice(0, 40)); break; } }
  window.scrollTo(0, 0);
  return out;
};

// --self-test: prove every detector fires on deliberately broken markup (and stays quiet on good markup) before trusting a clean result
if (process.argv.includes('--self-test')) {
  const b = await webkit.launch(); const p = await (await b.newContext({ viewport: { width: 300, height: 600 } })).newPage();
  await p.setContent(`<body style="margin:0;font:16px sans-serif">
    <p id="good" style="width:280px">A short calm sentence that wraps nicely onto two lines here.</p>
    <p id="mid" style="width:60px;overflow-wrap:anywhere">Supercalifragilistic</p>
    <p id="orphan" style="width:280px;margin:0">Total time 12.34<br>h</p>
    <button id="ctl" style="width:70px">One two three four five six seven eight</button>
    <div style="position:relative;height:40px"><span style="position:absolute;left:10px;top:5px">Overlapping text one</span><span style="position:absolute;left:20px;top:8px">Overlapping text two</span></div>
    <div style="width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><h2 id="trunc" style="width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0">A very long heading that is cut</h2></div>
    <div style="width:900px;white-space:nowrap">This line is wider than the phone and sticks out on the right side</div></body>`);
  const found = await p.evaluate(audit); await b.close();
  const types = new Set(found.map((d) => d.type)); const want = ['midword', 'orphan', 'toomanylines', 'overlap', 'truncated', 'offscreen'];
  const miss = want.filter((t) => !types.has(t)); const falseGood = found.filter((d) => d.text.startsWith('A short calm'));
  console.log('self-test found:', [...types].join(', ')); if (miss.length || falseGood.length) { console.log('SELF-TEST FAILED, missing:', miss.join(', '), falseGood.length ? 'and flagged good text' : ''); process.exit(1); } console.log('self-test passed: every detector fires and good text stays quiet'); process.exit(0);
}

const rows = []; const detail = []; const t0 = Date.now();
for (const engine of ENGINES) {
  const browser = engine === 'webkit' ? await webkit.launch() : await chromium.launch({ executablePath: process.env.BROWSER_EXE });
  for (const w of WIDTHS) {
    const profile = engine === 'webkit' ? { ...devices['iPhone 13'], viewport: { width: w, height: 800 }, screen: { width: w, height: 800 } } : { viewport: { width: w, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
    for (const f of FACTORS) {
      const ctx = await browser.newContext({ ...profile, reducedMotion: 'reduce' });
      await ctx.route(/arcgisonline|basemaps\.cartocdn|tile\.openstreetmap/, (r) => r.abort());
      const page = await ctx.newPage();
      for (const route of ROUTES) {
        try {
          await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
          await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500);
          if (f !== 1) { await page.addStyleTag({ content: `*, *::before, *::after { letter-spacing: ${((f - 1) * 0.55).toFixed(3)}em !important; }` }); await page.waitForTimeout(250); }
          const found = await page.evaluate(audit);
          const counts = {}; for (const d of found) counts[d.type] = (counts[d.type] || 0) + 1;
          rows.push({ engine, width: w, factor: f, route, counts });
          for (const d of found) if (d.type !== 'note2lines') detail.push({ engine, width: w, factor: f, route, ...d });
        } catch (e) { rows.push({ engine, width: w, factor: f, route, counts: { error: 1 } }); detail.push({ engine, width: w, factor: f, route, type: 'error', el: '', text: String(e.message).slice(0, 80) }); }
      }
      await ctx.close();
    }
  }
  await browser.close();
}
const FAIL = ['midword', 'orphan', 'overlap', 'offscreen', 'toomanylines', 'truncated', 'behindbar', 'error'];
const total = {}; for (const r of rows) for (const [k, v] of Object.entries(r.counts)) total[k] = (total[k] || 0) + v;
const failing = rows.filter((r) => FAIL.some((k) => r.counts[k]));
// the table: by route, the worst case across the matrix, per type
const byRoute = new Map(); for (const r of rows) { const e = byRoute.get(r.route) ?? {}; for (const k of FAIL) if (r.counts[k]) e[k] = Math.max(e[k] || 0, r.counts[k]); byRoute.set(r.route, e); }
console.log(`Wrap audit: ${rows.length} page checks (${ENGINES.join(' + ')}; widths ${WIDTHS.join('/')}; widening ${FACTORS.join('/')}) in ${Math.round((Date.now() - t0) / 1000)} s. ${BASE}`);
console.table([...byRoute].filter(([, e]) => Object.keys(e).length).map(([route, e]) => ({ route, ...e })));
console.log('totals:', JSON.stringify(total));
const seen = new Set(); let shown = 0;
for (const d of detail.filter((d) => FAIL.includes(d.type))) { const key = `${d.type}|${d.route}|${d.el}|${d.text}`; if (seen.has(key)) continue; seen.add(key); if (shown++ < DETAIL) console.log(`  ${d.type.padEnd(12)} ${d.route.padEnd(18)} ${d.engine} ${d.width}px x${d.factor}  ${d.el}  "${d.text}"`); }
if (seen.size > DETAIL) console.log(`  ... and ${seen.size - DETAIL} more distinct defects`);
const J = arg('--json', ''); if (J) fs.writeFileSync(J, JSON.stringify({ rows, detail }, null, 1));
console.log(failing.length ? `\n${failing.length} of ${rows.length} page checks have wrap defects (${seen.size} distinct).` : `\nAll ${rows.length} page checks wrap cleanly.`);
process.exit(failing.length ? 1 : 0);
