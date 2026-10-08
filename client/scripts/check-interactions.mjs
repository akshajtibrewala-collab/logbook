// INTERACTION AUDIT. For every route at 390 and 1440px it taps every visible control and fails on:
//   - a control with no effect (no navigation, DOM change, overlay, focus or state change)
//   - a console error, a page error or a failed API request
//   - an overlay (sheet, dialog, menu) that cannot be closed by the X button, Escape, a tap on the scrim, or browser back, or that will not re-open
//   - a control covered at its own centre (elementFromPoint)
//   - a tap target under 44px
// It CLICKS, so it only runs against the SCRATCH app (placeholder data): it refuses unless --scratch is given AND the API behind the base URL
// is not the real local database (it prints the flight count and backend it found first). Never point it at :4173 or production.
//
//   PLAYWRIGHT_CORE=<playwright-core folder> BROWSER_EXE=<chromium> node client/scripts/check-interactions.mjs --scratch --base http://localhost:4174 [--widths 390,1440] [--routes /logbook,/costs] [--max 80]
//
// Destructive controls (delete, remove, sign out, restore, import, reset) are listed as skipped, not clicked.
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:4174');
const WIDTHS = arg('--widths', '390,1440').split(',').map(Number);
const ONLY = arg('--routes', '') ? arg('--routes', '').split(',') : null;
const MAX = Number(arg('--max', 80));
const REAL_FLIGHTS = Number(process.env.REAL_LOCAL_FLIGHTS || 93);
if (!process.argv.includes('--scratch')) { console.error('Refusing: this audit writes. Pass --scratch and point --base at the scratch app (:4174).'); process.exit(2); }
if (!process.env.PLAYWRIGHT_CORE || !process.env.BROWSER_EXE) { console.error('Set PLAYWRIGHT_CORE and BROWSER_EXE (see check-controls.mjs).'); process.exit(2); }
const { chromium } = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);

const flightsRes = await fetch(`${BASE}/api/flights`).then((r) => r.json());
console.log(`Backend behind ${BASE}: ${flightsRes.length} flights (${flightsRes.filter((f) => f.role === 'pilot').length} pilot)`);
if (flightsRes.length === REAL_FLIGHTS) { console.error(`Refusing: ${REAL_FLIGHTS} flights looks like the real local database, not scratch data.`); process.exit(2); }
const ground = await fetch(`${BASE}/api/costs/ground-sessions`).then((r) => r.json());
const ids = { pilot: flightsRes.find((f) => f.role === 'pilot')?.id, pax: flightsRes.find((f) => f.role === 'passenger')?.id, ground: ground[0]?.id };
const ROUTES = ['/', '/logbook', `/logbook/${ids.pilot}`, `/logbook/ground/${ids.ground}`, '/travel', `/travel/${ids.pax}`, '/aircraft', '/logbook/new', '/logbook/new?role=passenger&from=travel',
  '/logbook/quick', '/logbook/ground/new', '/milestones', '/currency', '/weather', '/costs', '/costs/spending', '/costs/phases', '/costs/expenses', '/costs/projection', '/costs/settings', '/map', '/stats', '/more', '/settings', '/logbook/data', '/logbook/share', '/costs/settings', '/weather/settings']
  .filter((r) => !ONLY || ONLY.includes(r));
const SKIP = /delete|remove|sign out|log out|restore|import|reset|erase|discard|revoke|turn off|clear all|run backup/i;

const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXE });
const defects = []; const skipped = []; let tapped = 0;
const add = (route, w, control, defect, cause = '') => defects.push({ route, w, control, defect, cause });

const COLLECT = () => {
  document.querySelectorAll('[data-ia]').forEach((e) => e.removeAttribute('data-ia')); // a fresh numbering never leaves stale tags behind
  const sel = 'a[href],button,[role="button"],[role="tab"],[role="switch"],summary,input[type="checkbox"],input[type="radio"],select';
  const out = [];
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest('[aria-hidden="true"],[inert]') || el.closest('.ds-skip')) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || el.disabled) continue;
    let hid = false; for (let n = el; n && n !== document.body; n = n.parentElement) if (Number(getComputedStyle(n).opacity) === 0) { hid = true; break; }
    if (hid) continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    if (r.bottom + scrollY < 0 || r.top + scrollY > document.documentElement.scrollHeight) continue; // document-relative: scrolling must never change the numbering
    const name = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 40);
    el.setAttribute('data-ia', String(out.length)); // numbering is fixed at collect time, so scrolling or re-rendering can never shift it
    out.push({ name, tag: el.tagName.toLowerCase(), href: el.getAttribute('href') || '' });
  }
  return out;
};
const NTH = (i) => { const el = document.querySelector(`[data-ia="${i}"]`); if (!el) return false; window.__ia = el; return true; };
const GEOM = () => {
  const el = window.__ia; el.scrollIntoView({ block: 'center', inline: 'center' });
  const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const top = document.elementFromPoint(cx, cy);
  const inView = cx >= 0 && cy >= 0 && cx <= innerWidth && cy <= innerHeight;
  const covered = inView && top && !(el === top || el.contains(top) || top.contains(el));
  return { id: `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)}[${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 20)}]`, w: r.width, h: r.height, covered: covered ? `${top.tagName.toLowerCase()}.${String(top.className).slice(0, 40)}` : '', inView, cx, cy };
};
const OVERLAY = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 10 && r.height > 10 && cs.visibility !== 'hidden' && el.getAttribute('aria-hidden') !== 'true'; };
  const dlg = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].filter(vis);
  const menu = [...document.querySelectorAll('.ds-menu.is-open,[role="menu"]')].filter((m) => m.closest('.ds-menu.is-open') && vis(m));
  return dlg.length + menu.length;
};
const STATE = () => ({ url: location.pathname + location.search, h: document.body.innerHTML.length, text: document.body.innerText.length, ov: window.__ov(), ae: document.activeElement?.outerHTML?.slice(0, 80), scroll: Math.round(scrollY), pressed: [...document.querySelectorAll('[aria-pressed],[aria-expanded],[aria-selected],[aria-checked]')].map((e) => e.getAttribute('aria-pressed') + e.getAttribute('aria-expanded') + e.getAttribute('aria-selected') + e.getAttribute('aria-checked')).join(''), val: [...document.querySelectorAll('input,select,textarea')].map((e) => e.value + e.checked).join('|') });

for (const w of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, reducedMotion: 'reduce' });
  await ctx.route(/arcgisonline|basemaps\.cartocdn|tile\.openstreetmap/, (r) => r.abort());
  const p = await ctx.newPage();
  await p.addInitScript(`window.__ov = ${OVERLAY.toString()}`);
  let errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message.slice(0, 120)));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|tile|arcgis|net::ERR/.test(m.text())) errs.push('console: ' + m.text().slice(0, 120)); });
  p.on('response', (r) => { if (r.status() >= 400 && /\/api\//.test(r.url())) errs.push(`API ${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
  const ensure = async (i) => { if (await p.evaluate(NTH, i)) return true; await p.evaluate(COLLECT); return p.evaluate(NTH, i); }; // after Back the page may have re-rendered without our tags
  const flush = (route, control) => { for (const e of new Set(errs)) add(route, w, control, e, 'console error or failed request'); errs = []; };
  const load = async (route) => { await p.goto(BASE + route, { waitUntil: 'networkidle' }); await p.waitForTimeout(300); await p.evaluate(COLLECT); };

  for (const route of ROUTES) {
    await load(route);
    const list = await p.evaluate(COLLECT); if (process.env.IA_DEBUG) console.log(route, w, "controls found:", list.length);
    flush(route, '(page load)');
    const n = Math.min(list.length, MAX);
    for (let i = 0; i < n; i++) {
      const meta = list[i];
      if (SKIP.test(meta.name)) { skipped.push(`${route} @${w}: "${meta.name}"`); continue; }
      if (new URL(p.url()).pathname + new URL(p.url()).search !== route) await load(route);
      if (!(await ensure(i))) { skipped.push(`${route} @${w}: "${meta.name}" (gone after navigation)`); continue; }
      // the Add button hides while the page scrolls and returns when idle: let it come back before testing it
      if (await p.evaluate(() => Boolean(window.__ia && window.__ia.dataset && window.__ia.dataset.hidden))) await p.waitForTimeout(1100);
      const g = await p.evaluate(GEOM);
      const label = `${meta.name || meta.tag}`;
      if (g.inView && Math.min(g.w, g.h) < 44 && !(meta.tag === 'a' && g.h >= 24 && !p.url().includes('travel') && false)) add(route, w, label, `tap target ${Math.round(g.w)}x${Math.round(g.h)} under 44px <${g.id}>`, 'small hit area');
      if (g.covered) { add(route, w, label, `covered at its own centre by ${g.covered}`, 'stacking context, bar or overlay above it'); continue; }
      if (!g.inView) continue;
      const before = await p.evaluate(STATE);
      tapped++;
      try { await p.mouse.click(g.cx, g.cy); } catch (e) { add(route, w, label, 'click failed: ' + e.message.slice(0, 60)); continue; }
      await p.waitForTimeout(350);
      const after = await p.evaluate(STATE);
      flush(route, label);
      const changed = before.url !== after.url || before.h !== after.h || before.text !== after.text || before.ov !== after.ov || before.ae !== after.ae || before.scroll !== after.scroll || before.pressed !== after.pressed || before.val !== after.val;
      if (!changed) { add(route, w, label, 'no effect when tapped', 'dead control, handler missing, or covered'); continue; }
      if (after.ov > before.ov) {
        // an overlay opened: close it every way, re-open it after each
        const opened = async () => { if (!(await ensure(i))) { dbg = 'control no longer found at its position'; return false; } const gg = await p.evaluate(GEOM); const nm = await p.evaluate(() => (window.__ia.getAttribute('aria-label') || window.__ia.textContent || '').trim().slice(0, 25)); await p.mouse.click(gg.cx, gg.cy); await p.waitForTimeout(450); const ov = await p.evaluate(OVERLAY); dbg = `clicked "${nm}" at ${Math.round(gg.cx)},${Math.round(gg.cy)} covered=${gg.covered || 'no'} overlays=${ov}`; return ov > 0; };
        let dbg = '';
        const closers = {
          'X button': async () => {
            // the visible dialog's own small Close button (not a closed sheet's, and not a full-screen scrim button)
            const pt = await p.evaluate(() => {
              for (const b of document.querySelectorAll('[role="dialog"] button[aria-label="Close"], .ds-sheet.is-open button[aria-label="Close"]')) {
                const r = b.getBoundingClientRect(); const cs = getComputedStyle(b);
                if (r.width > 4 && r.width < 120 && cs.visibility !== 'hidden' && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
              }
              return null;
            });
            if (pt) await p.mouse.click(pt.x, pt.y); else hasX = false; // a menu or popover has no X: nothing to test
          },
          Escape: async () => { await p.keyboard.press('Escape'); },
          'scrim tap': async () => { await p.mouse.click(w / 2, 24); }, // above any sheet, over the dimmed page
          'browser back': async () => { await p.goBack({ waitUntil: 'load' }).catch(() => {}); },
        };
        let first = true; let hasX = true;
        for (const [how, close] of Object.entries(closers)) {
          if (!first) { if (new URL(p.url()).pathname + new URL(p.url()).search !== route) await load(route); if (!(await opened())) { add(route, w, label, `would not re-open after closing (before ${how}) [${dbg}]`, 'stale open-state or overlay claim'); break; } }
          first = false;
          await close(); await p.waitForTimeout(900);
          const left = await p.evaluate(OVERLAY).catch(() => 0);
          if (how === 'browser back' && new URL(p.url()).pathname + new URL(p.url()).search !== route) { add(route, w, label, 'browser back left the page instead of closing the overlay', 'overlay not tied to history'); continue; }
          if (left > 0 && how === 'X button' && !hasX) { /* menus have no X */ } else if (left > 0 && how !== 'browser back') add(route, w, label, `overlay did not close with ${how}`, how === 'X button' ? 'pointer capture or covered X' : 'handler missing');
          if (left > 0 && how === 'browser back') add(route, w, label, 'browser back left the overlay open (it should close it first)', 'overlay not tied to history');
          if (left > 0) { await p.keyboard.press('Escape'); await p.waitForTimeout(250); }
        }
        flush(route, label);
        await load(route); continue;
      }
      if (before.url !== after.url) { await p.goBack().catch(() => {}); await p.waitForTimeout(300); }
    }
    flush(route, '(route)');
  }
  await ctx.close();
}
await browser.close();
const seen = new Set(); const uniq = defects.filter((d) => { const k = `${d.route}|${d.w}|${d.control}|${d.defect}`; if (seen.has(k)) return false; seen.add(k); return true; });
const grouped = new Map();
for (const d of uniq) { const key = `${d.route} @${d.w}: ${d.defect.replace(/ <[^>]*>/, '').replace(/ \[[^\]]*\]/, '')}`; const g = grouped.get(key) ?? { n: 0, names: [], cause: d.cause }; g.n++; if (g.names.length < 3) g.names.push(d.control); grouped.set(key, g); }
for (const [k, g] of grouped) console.log(`DEFECT ${k}  x${g.n}  e.g. ${g.names.map((n) => '"' + n + '"').join(', ')}  (${g.cause})`);
console.log(`${tapped} controls tapped; ${skipped.length} destructive controls skipped; ${uniq.length} defects.`);
process.exit(uniq.length ? 1 : 0);
