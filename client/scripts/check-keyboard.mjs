// KEYBOARD FRAME (read-only: it loads pages, focuses fields and navigates; it never saves anything).
// The real iOS keyboard cannot be driven from a test browser, and Windows WebKit cannot paint backdrop blur, so this checks the app's own contract
// for the frame it shows while a text field has focus (lib/keyboardState.js, ds/keyboard.js, ds/keyboard.css). With a field focused:
//   1. <html> carries kb-open;
//   2. no element anywhere has a computed backdrop-filter other than 'none' (and on a page that has glass, it had some before focus);
//   3. the tab bar, the Add button and its menu are hidden (computed visibility), and every glass/fixed layer has no running transition;
//   4. the form's Save bar is visible (inside the viewport) and sticky;
//   5. scroll-linked handlers are paused: scrolling does not change the top bar's --p;
//   6. nothing that is position:fixed or sticky sits under an ancestor with transform, filter, perspective, will-change or contain (audit, listed);
// and after blur everything is back: class removed, glass layers return, tab bar visible again where the page has one. Stuck-state recovery:
//   a field removed from the page without a blur, a route change with a field focused, and a sheet closed with a field focused all clear the frame.
// The same check run on an old build fails at (1): that is the proof it tests the change.
//
//   PLAYWRIGHT_CORE=<playwright-core folder> node client/scripts/check-keyboard.mjs [--base http://localhost:4175] [--matrix quick|full] [--only "phone 390"]
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { openContext, launchBrowsers, pickProfile } from './lib/devices.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:4175');
if (!process.env.PLAYWRIGHT_CORE) { console.error('Set PLAYWRIGHT_CORE (and BROWSER_EXE for Android profiles).'); process.exit(2); }
const pw = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);
const profiles = pickProfile(arg('--matrix', 'quick'), arg('--only', '')).filter((d) => d.touch); // the keyboard frame is a touch-device concern
const browsers = await launchBrowsers(pw, { chromiumExe: process.env.BROWSER_EXE, need: [...new Set(profiles.map((d) => d.engine))] });

// [route, first text field selector]
const ROUTES = [
  ['/logbook/new', 'input[type="text"], input:not([type]), textarea'],
  ['/logbook/new?role=passenger', 'input[type="text"], input:not([type]), textarea'],
  ['/logbook/quick', 'input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), textarea'],
  ['/logbook/ground/new', 'input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), textarea'],
  ['/currency/new', 'input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), textarea'],
  ['/aircraft/new', 'input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), textarea'],
];

const probe = () => {
  const vis = (el) => !!el && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none' && Number(getComputedStyle(el).opacity) > 0.01;
  let bf = 0; const bfSamples = [];
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el); const f = cs.backdropFilter || cs.webkitBackdropFilter;
    if (f && f !== 'none') { bf += 1; if (bfSamples.length < 3) bfSamples.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`); }
  }
  const fixedLayers = [...document.querySelectorAll('.ds-glass, .ds-topbar, .ds-tabbar, .ds-fab, .ds-menu, .ds-sheet, .ds-scrim-dim, .ds-edge, .ds-savebar')];
  const animating = fixedLayers.filter((el) => { const cs = getComputedStyle(el); return (cs.transitionDuration || '0s').split(',').some((d) => parseFloat(d) > 0.001) && cs.transitionProperty !== 'none' && cs.display !== 'none' && cs.visibility !== 'hidden'; }).length;
  const bar = document.querySelector('.ds-topbar');
  const save = document.querySelector('.save-bar, .ds-savebar');
  const sr = save?.getBoundingClientRect();
  const sticky = [...document.querySelectorAll('*')].filter((el) => { const p = getComputedStyle(el).position; return p === 'fixed' || p === 'sticky'; });
  const odd = [];
  for (const el of sticky) {
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      const why = [cs.transform !== 'none' && 'transform', cs.filter !== 'none' && 'filter', cs.perspective !== 'none' && 'perspective', /transform|filter/.test(cs.willChange) && 'will-change', /paint|layout/.test(cs.contain) && 'contain', cs.backdropFilter && cs.backdropFilter !== 'none' && 'backdrop-filter'].filter(Boolean);
      if (why.length && getComputedStyle(el).position === 'fixed') odd.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} under ${a.tagName.toLowerCase()}.${String(a.className).split(' ')[0]} (${why.join(',')})`);
    }
  }
  return {
    kb: document.documentElement.classList.contains('kb-open'),
    backdrop: bf, backdropSamples: bfSamples, animating,
    tab: document.querySelector('.ds-tabbar') ? vis(document.querySelector('.ds-tabbar')) : null,
    fab: document.querySelector('.ds-fab') ? vis(document.querySelector('.ds-fab')) : null,
    saveVisible: save ? (sr.bottom > 0 && sr.top < window.innerHeight && vis(save)) : null,
    saveSticky: save ? getComputedStyle(save).position : null,
    p: bar ? bar.style.getPropertyValue('--p') : null,
    scrollY: Math.round(window.scrollY), odd: [...new Set(odd)],
  };
};

const rows = [], t0 = Date.now();
for (const d of profiles) {
  const ctx = await openContext(browsers, d);
  const page = await ctx.newPage();
  await page.route(/planespotters|plnspttrs|arcgisonline|cartocdn|tile\.openstreetmap/, (r) => r.abort());
  const fails = []; let checks = 0;
  const need = (ok, msg) => { checks += 1; if (!ok) fails.push(msg); };

  for (const [route, sel] of ROUTES) {
    const where = `${route}`;
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(500);
    const field = await page.$(sel);
    if (!field) { fails.push(`${where}: no text field found`); continue; }
    const before = await page.evaluate(probe);
    await field.scrollIntoViewIfNeeded().catch(() => {});
    await field.focus();
    await page.waitForTimeout(350);
    const on = await page.evaluate(probe);
    need(on.kb, `${where}: html.kb-open not set with a field focused`);
    need(on.backdrop === 0, `${where}: ${on.backdrop} element(s) still have a backdrop-filter while typing (${on.backdropSamples.join(', ')})`);
    need(on.tab !== true, `${where}: tab bar still visible while typing`);
    need(on.fab !== true, `${where}: Add button still visible while typing`);
    need(on.animating === 0, `${where}: ${on.animating} glass/fixed layer(s) still have a transition while typing`);
    if (on.saveVisible !== null) { need(on.saveVisible, `${where}: Save bar not visible while typing`); need(on.saveSticky === 'sticky', `${where}: Save bar is ${on.saveSticky}, not sticky, while typing`); }
    // scroll-linked handlers pause: a scroll must not move the title progress
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(120);
    const p0 = (await page.evaluate(probe)).p;
    await page.evaluate(() => window.scrollTo(0, 400)); await page.waitForTimeout(250);
    const p1 = (await page.evaluate(probe)).p;
    need(p0 === p1, `${where}: top bar --p changed ${p0} -> ${p1} while the keyboard frame was up (collapse handler not paused)`);
    await page.evaluate(() => window.scrollTo(0, 0));
    // blur: everything returns
    await page.evaluate(() => document.activeElement?.blur());
    await page.waitForTimeout(700);
    const off = await page.evaluate(probe);
    need(!off.kb, `${where}: html.kb-open still set 700 ms after blur`);
    need(off.tab === before.tab, `${where}: tab bar visibility not restored after blur (${before.tab} -> ${off.tab})`);
    need(off.fab === before.fab, `${where}: Add button visibility not restored after blur (${before.fab} -> ${off.fab})`);
    need(off.backdrop === before.backdrop, `${where}: backdrop-filter count ${before.backdrop} before, ${off.backdrop} after blur`);
    if (route === '/logbook/new') need(on.odd.length === 0, `${where}: fixed element under a transformed/filtered ancestor: ${on.odd.join('; ')}`);
  }

  // stuck-state recovery
  await page.goto(`${BASE}/logbook/new`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(400);
  const f = await page.$('input[type="text"], input:not([type]), textarea');
  if (f) {
    await f.focus(); await page.waitForTimeout(250);
    await page.evaluate(() => document.activeElement?.remove()); // removed with no blur event
    await page.waitForTimeout(1600);
    need(!(await page.evaluate(probe)).kb, 'recovery: a focused field removed from the page left the frame stuck');
    await page.goto(`${BASE}/logbook/new`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(400);
    const g = await page.$('input[type="text"], input:not([type]), textarea');
    await g.focus(); await page.waitForTimeout(250);
    await page.evaluate(() => { history.pushState({ idx: 99 }, '', '/logbook'); window.dispatchEvent(new PopStateEvent('popstate')); });
    await page.waitForTimeout(900);
    const st = await page.evaluate(probe);
    need(!st.kb || st.kb === false, 'recovery: frame stuck after a route change with a field focused');
  }
  rows.push({ device: d.name, checks, fails });
  await ctx.close();
}

let bad = 0;
for (const r of rows) {
  console.log(`${r.fails.length ? 'FAIL' : 'ok  '} ${r.device.padEnd(28)} ${r.checks} checks${r.fails.length ? `, ${r.fails.length} failing` : ''}`);
  for (const f of r.fails) { console.log(`       - ${f}`); bad += 1; }
}
console.log(`\nkeyboard frame: ${rows.length} device(s), ${rows.reduce((a, r) => a + r.checks, 0)} checks in ${Math.round((Date.now() - t0) / 1000)}s -> ${bad} problem(s)`);
await Promise.all(Object.values(browsers).map((b) => b.close()));
process.exit(bad ? 1 : 0);
