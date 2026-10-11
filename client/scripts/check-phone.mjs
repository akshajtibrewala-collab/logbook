// PHONE QUALITY SWEEP. Drives WebKit with iPhone profiles (the engine behind every iPhone browser) over every route and fails on the things that make a web app
// feel wrong on an iPhone. Read-only: it loads pages, opens sheets and focuses fields, and writes nothing.
//   inputfont   a text field, select or textarea under 16px (Safari zooms the whole page when one is focused)
//   tap         a visible control smaller than 44 x 44
//   covered     a control whose centre is covered by something that is not part of it (the Add button, a bar, another element), at the top and at the end of the page
//   fabrow      the Add button resting over a row's trailing number or a control at the end of the page
//   sheetsolid  an open sheet or menu whose own background is see-through enough that page text shows through it where there is no blur (it must stay at least 80% opaque)
//   keyboard    with a keyboard-sized chunk of the screen gone, a focused field is not fully visible above the Save bar
//   fonts       the self-hosted font did not load, or the page fetched a font from another site
//   errors      a console error, a page error or a failed request
//
//   stickycollide  a sticky header (month line, ledger head) that overlaps the top bar at a scroll position
//   Also probes scroll positions 0, 1px, 40px, the middle, the end and after a round trip (fabrow and stickycollide at each; covered at 0, 1, 40 and the end).
//   PLAYWRIGHT_CORE=<..> node client/scripts/check-phone.mjs [--base http://localhost:4174] [--api http://localhost:3002] [--widths 360,390,430] [--profile iphone|se] [--text 100|130] [--routes ...] [--detail 20]
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:4174'), API = arg('--api', 'http://localhost:3002');
const WIDTHS = arg('--widths', '360,390,430').split(',').map(Number);
const ONLY = arg('--routes', '') ? arg('--routes', '').split(',') : null;
const DETAIL = Number(arg('--detail', 20));
const PROFILE = arg('--profile', 'iphone'); // iphone (iPhone 13) | se (iPhone SE: shorter screen)
const TEXT = Number(arg('--text', 100)); // root text size in percent (a stand-in for a larger Dynamic Type / text size)
if (!process.env.PLAYWRIGHT_CORE) { console.error('Set PLAYWRIGHT_CORE.'); process.exit(2); }
const pw = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href); const { webkit, devices } = pw.default ?? pw;
const get = async (p) => (await fetch(`${API}/api${p}`)).json();
const flights = await get('/flights'); const ground = await get('/costs/ground-sessions').catch(() => []); const aircraft = await get('/aircraft').catch(() => []);
const pilot = flights.find((f) => f.role === 'pilot')?.id, pax = flights.find((f) => f.role === 'passenger')?.id;
const ROUTES = ['/', '/logbook', `/logbook/${pilot}`, `/logbook/ground/${ground[0]?.id ?? 1}`, '/travel', `/travel/${pax}`, '/logbook/data', '/aircraft', '/aircraft/new', `/aircraft/${aircraft[0]?.id ?? 1}`,
  '/logbook/new', '/logbook/new?role=passenger', '/logbook/quick', '/logbook/share', '/logbook/print', `/logbook/${pilot}/edit`, '/logbook/ground/new', '/milestones', '/currency', '/currency/new',
  '/weather', '/weather/settings', '/costs', '/costs/settings', '/costs/spending', '/costs/phases', '/costs/expenses', '/costs/projection', '/map', '/stats', '/more', '/settings']
  .filter((r) => !ONLY || ONLY.includes(r));
const FORMS = new Set(['/logbook/new', '/logbook/new?role=passenger', '/logbook/quick', '/logbook/ground/new', '/aircraft/new', '/currency/new', '/weather/settings', '/costs/settings']);

const probe = (mode = 'top') => {
  const out = []; const add = (type, el, text = '') => out.push({ type, el: `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''}`, text: String(text).replace(/\s+/g, ' ').slice(0, 50) });
  const CHROME = '.ds-tabbar, .ds-topbar, .ds-fab, .ds-menu, .ds-sheet, .ds-savebar, .ds-rail, .ds-edge, .ds-skip, .ds-scrim-dim, .ds-popover';
  const textRect = (el) => { const r0 = el.getBoundingClientRect(); if ((el.children.length && !el.matches('.hub-t .v')) || !el.textContent.trim()) return r0; const rg = document.createRange(); rg.selectNodeContents(el); const q = [...rg.getClientRects()].filter((x) => x.width > 0 && x.height > 0); if (!q.length) return r0; const L = Math.min(...q.map((x) => x.left)), R = Math.max(...q.map((x) => x.right)), T = Math.min(...q.map((x) => x.top)), B = Math.max(...q.map((x) => x.bottom)); return { left: L, right: R, top: T, bottom: B, width: R - L, height: B - T }; }; // the words themselves, not the padding around them
  const visible = (el) => { const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return false; for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false; } return true; };
  const ctl = [...document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, [role="tab"], [role="switch"], summary')].filter((e) => visible(e) && !e.closest('.ds-skip, [inert]') && !e.disabled);
  for (const e of ctl) {
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    if (e.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), select, textarea') && parseFloat(cs.fontSize) < 16 - 0.01) add('inputfont', e, `${cs.fontSize} ${e.getAttribute('aria-label') || e.placeholder || e.name || ''}`);
    const real = e.matches('input[type="checkbox"], input[type="radio"]') ? (e.closest('label') || e) : e; const rr = real.getBoundingClientRect();
    if (Math.min(rr.width, rr.height) < 43.5 && !(e.tagName === 'A' && e.closest('p, li') && rr.height < 43.5 && e.closest('p'))) add('tap', e, `${Math.round(rr.width)}x${Math.round(rr.height)} ${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}`);
  }
  // a sticky header must not run under the top bar
  { const bar = document.querySelector('.ds-topbar'); const br = bar?.getBoundingClientRect();
    if (br) for (const e of document.querySelectorAll('.lb-month, .cl-mh, .bc-mh, .sticky')) { if (!visible(e) || getComputedStyle(e).position !== 'sticky') continue; const r = e.getBoundingClientRect(); if (r.bottom > br.top && r.top < br.bottom - 1 && r.right > br.left && r.left < br.right) add('stickycollide', e, `${Math.round(r.top)}..${Math.round(r.bottom)} vs bar ..${Math.round(br.bottom)}`); } }
  if (mode === 'mid') { /* mid page: content passes under the glass by design; only the Add button and sticky rules apply */ } else
  // covered controls at the current scroll position
  for (const e of ctl) {
    const r = e.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2; if (cx < 0 || cx > innerWidth || cy < 0 || cy > innerHeight) continue; // only what is really on screen
    if (r.height > innerHeight * 0.9) continue;
    const top = document.elementFromPoint(cx, cy); if (!top) continue;
    if (e === top || e.contains(top) || top.contains(e) || (e.closest('label') && e.closest('label').contains(top))) continue;
    if (e.closest(CHROME)) continue;
    if (mode === 'end' && !(top.closest('.ds-tabbar, .ds-savebar, .ds-fab') && cy > innerHeight * 0.5)) { if (top.closest(CHROME)) continue; } // at the end only the bottom bars matter: the page's last content must clear them
    if (mode === 'top' && top.closest(CHROME)) continue; // at the top, page content may scroll under the floating bars: that is by design; the end of the page is checked below
    add('covered', e, `${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)} under ${top.tagName.toLowerCase()}.${String(top.className).trim().split(/\s+/)[0]}`);
  }
  // the Add button resting over a row's trailing number or a control
  const fab = document.querySelector('.ds-fab'); if (fab && visible(fab) && fab.getAttribute('data-hidden') !== 'true') {
    const f = fab.getBoundingClientRect();
    for (const e of document.querySelectorAll('[data-row] .v, [data-row] .r, [data-row] .r b, main button, main a[href], main input, main select')) {
      if (!visible(e) || e.closest(CHROME)) continue; let r = e.getBoundingClientRect();
      if ((e.children.length === 0 || e.matches('.hub-t .v')) && e.textContent.trim()) { const rg = document.createRange(); rg.selectNodeContents(e); const q = [...rg.getClientRects()].filter((x) => x.width > 0 && x.height > 0); if (q.length) { const L = Math.min(...q.map((x) => x.left)), R = Math.max(...q.map((x) => x.right)), T = Math.min(...q.map((x) => x.top)), B = Math.max(...q.map((x) => x.bottom)); r = { left: L, right: R, top: T, bottom: B, width: R - L, height: B - T }; } } // a text box: the words themselves, not their padding
      if ((r.width > 160 || e.matches('.hub-t')) && !e.matches('.v, .r, b')) { const last = [...e.querySelectorAll('*')].filter((x) => visible(x) && x.children.length === 0 && x.getBoundingClientRect().height >= 8).pop(); if (!last) continue; r = textRect(last); } /* a wide row: what sits at its trailing end, not the whole row */ const w = Math.min(r.right, f.right) - Math.max(r.left, f.left), h = Math.min(r.bottom, f.bottom) - Math.max(r.top, f.top);
      if (w > 4 && h > 4) add('fabrow', e, (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30));
    }
  }
  return out;
};

const fmtErr = [];
const rows = []; const detail = []; const t0 = Date.now();
const browser = await webkit.launch();
for (const w of WIDTHS) {
  const H = PROFILE === 'se' ? 667 : 800;
  const ctx = await browser.newContext({ ...devices[PROFILE === 'se' ? 'iPhone SE' : 'iPhone 13'], viewport: { width: w, height: H }, screen: { width: w, height: H }, reducedMotion: 'reduce' });
  await ctx.route(/arcgisonline|basemaps\.cartocdn|tile\.openstreetmap/, (r) => r.abort());
  const page = await ctx.newPage(); let errs = []; const external = [];
  page.on('pageerror', (e) => errs.push(`page: ${e.message.slice(0, 80)}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/tile|Failed to load resource.*(arcgis|cartocdn|osm)/i.test(m.text())) errs.push(`console: ${m.text().slice(0, 80)}`); });
  page.on('requestfailed', (r) => { if (!/arcgisonline|cartocdn|openstreetmap/.test(r.url())) errs.push(`request: ${r.url().slice(0, 70)}`); });
  page.on('request', (r) => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) external.push(r.url()); });
  for (const route of ROUTES) {
    errs = []; const found = [];
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 30000 }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500);
      if (TEXT !== 100) { await page.evaluate((t) => { document.documentElement.style.fontSize = `${t}%`; }, TEXT); await page.waitForTimeout(300); }
      found.push(...await page.evaluate(probe));
      for (const [label, y] of [['1px', 1], ['40px', 40]]) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(350); for (const d of await page.evaluate(probe, 'top')) if (['covered', 'fabrow', 'stickycollide'].includes(d.type)) found.push({ ...d, text: `[${label}] ${d.text}` }); }
      await page.evaluate(() => window.scrollTo(0, Math.floor((document.documentElement.scrollHeight - innerHeight) / 2))); await page.waitForTimeout(1200);
      for (const d of await page.evaluate(probe, 'mid')) if (['fabrow', 'stickycollide'].includes(d.type)) found.push({ ...d, text: `[mid] ${d.text}` });
      // the end of the page
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(1300);
      for (const d of await page.evaluate(probe, 'end')) if (['covered', 'fabrow', 'stickycollide'].includes(d.type)) found.push({ ...d, text: `[end] ${d.text}` });
      await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(1300); // the round trip: back at the top, then the top rules again
      for (const d of await page.evaluate(probe, 'top')) if (['covered', 'fabrow', 'stickycollide'].includes(d.type)) found.push({ ...d, text: `[after round trip] ${d.text}` });
      // font
      const font = await page.evaluate(() => ({ loaded: document.fonts.check('16px Inter'), faces: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family).join(',') }));
      if (!/Inter/.test(font.faces)) found.push({ type: 'fonts', el: 'document', text: 'the self-hosted Inter did not load' });
      if (external.length) found.push({ type: 'fonts', el: 'document', text: `fetched a font from another site: ${external[0].slice(0, 50)}` });
      // an open sheet is not see-through (Filter or the hero sheet)
      const opener = page.locator('button[aria-label^="Filter"], .bc-hero:not(.static)').first();
      if (await opener.count() && ['/logbook', '/travel'].includes(route)) { await opener.click().catch(() => {}); await page.waitForTimeout(900);
        const a = await page.evaluate(() => { const s = document.querySelector('.ds-sheet.is-open'); if (!s) return null; const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(s).backgroundColor); const p = m ? m[1].split(/[ ,\/]+/).filter(Boolean).map(Number) : []; return p.length > 3 ? p[3] : 1; });
        if (a != null && a < 0.8) found.push({ type: 'sheetsolid', el: 'ds-sheet', text: `background alpha ${a} (needs at least 0.8, so text behind it cannot show through where there is no blur)` });
        await page.keyboard.press('Escape'); await page.waitForTimeout(500); }
      // keyboard
      if (FORMS.has(route)) {
        const inputs = page.locator('main input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="file"]), main textarea'); const n = Math.min(await inputs.count(), 4);
        for (let i = 0; i < n; i++) {
          const inp = inputs.nth(i); if (!(await inp.isVisible())) continue;
          await page.setViewportSize({ width: w, height: 800 }); await page.evaluate(() => window.scrollTo(0, 0));
          await inp.focus().catch(() => {}); await page.setViewportSize({ width: w, height: 500 }); await page.waitForTimeout(500); // about 300px of keyboard
          const v = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); const bar = document.querySelector('.ds-savebar'); const bt = bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect().top : innerHeight; const tb = document.querySelector('.ds-topbar'); const top = tb ? tb.getBoundingClientRect().bottom : 0; return { top: r.top, bottom: r.bottom, barTop: bt, topBar: top, vh: innerHeight, label: (e.getAttribute('aria-label') || e.placeholder || e.name || e.tagName).toString().slice(0, 24) }; });
          if (v && (v.bottom > Math.min(v.barTop, v.vh) + 1 || v.top < v.topBar - 1)) found.push({ type: 'keyboard', el: 'input', text: `${v.label}: ${Math.round(v.top)}..${Math.round(v.bottom)} with the visible area ${Math.round(v.topBar)}..${Math.round(Math.min(v.barTop, v.vh))}` });
          await inp.evaluate((e) => e.blur()).catch(() => {});
        }
        await page.setViewportSize({ width: w, height: 800 });
      }
    } catch (e) { found.push({ type: 'errors', el: 'page', text: `could not load: ${String(e.message).slice(0, 60)}` }); }
    for (const e of errs.slice(0, 3)) found.push({ type: 'errors', el: 'page', text: e });
    const counts = {}; for (const d of found) counts[d.type] = (counts[d.type] || 0) + 1;
    rows.push({ width: w, route, counts }); for (const d of found) detail.push({ width: w, route, ...d });
  }
  await ctx.close();
}
await browser.close();
const FAIL = ['inputfont', 'tap', 'covered', 'fabrow', 'stickycollide', 'sheetsolid', 'keyboard', 'fonts', 'errors'];
const total = {}; for (const r of rows) for (const [k, v] of Object.entries(r.counts)) total[k] = (total[k] || 0) + v;
const byRoute = new Map(); for (const r of rows) { const e = byRoute.get(r.route) ?? {}; for (const k of FAIL) if (r.counts[k]) e[k] = Math.max(e[k] || 0, r.counts[k]); byRoute.set(r.route, e); }
console.log(`Phone sweep: ${rows.length} page checks (WebKit, ${PROFILE === 'se' ? 'iPhone SE' : 'iPhone'} profile, text ${TEXT}%; widths ${WIDTHS.join('/')}) in ${Math.round((Date.now() - t0) / 1000)} s. ${BASE}`);
console.table([...byRoute].filter(([, e]) => Object.keys(e).length).map(([route, e]) => ({ route, ...e })));
console.log('totals:', JSON.stringify(total));
const seen = new Set(); let shown = 0;
for (const d of detail) { const key = `${d.type}|${d.route}|${d.el}|${d.text}`; if (seen.has(key)) continue; seen.add(key); if (shown++ < DETAIL) console.log(`  ${d.type.padEnd(10)} ${d.route.padEnd(24)} ${d.width}px  ${d.el}  ${d.text}`); }
if (seen.size > DETAIL) console.log(`  ... and ${seen.size - DETAIL} more distinct defects`);
const failing = rows.filter((r) => FAIL.some((k) => r.counts[k]));
console.log(failing.length ? `\n${failing.length} of ${rows.length} page checks have phone defects (${seen.size} distinct).` : `\nAll ${rows.length} page checks are clean on the iPhone profile.`);
process.exit(failing.length ? 1 : 0);
