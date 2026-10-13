// TAB BAR STABILITY (read-only; it only loads pages, scrolls, taps tabs and opens/closes menus, sheets and a text field).
// Drives real navigation sequences and records the floating tab bar's position after every step. It fails when:
//   - its layout offset from the bottom (CSS `bottom`) ever differs from the value it had on the first page (a stuck keyboard or toolbar inset
//     would show here), or on the wide layout's side rail when its `top` changes;
//   - its visual gap is neither the expanded gap nor the collapsed gap (8px lower), or it is collapsed at scrollY 0 (a stale collapsed state);
//   - after a step settles the visual viewport is still offset, zoomed or shorter than the layout viewport (an inset that did not reset), or a
//     scrim/overlay is still open that nothing opened.
// Steps: every tab to every other tab, a scroll down then a tab, the Add menu opened and closed, a form opened with a field focused, a
// simulated on-screen keyboard (viewport shrunk 320px and restored) and the field blurred, a sheet opened and closed, browser Back.
//
//   PLAYWRIGHT_CORE=<playwright-core folder> BROWSER_EXE=<chrome.exe for Android profiles> \
//     node client/scripts/check-tabbar.mjs [--base http://localhost:4174] [--matrix quick|full] [--only "phone 390,ipad 820"]
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { openContext, launchBrowsers, pickProfile } from './lib/devices.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:4174');
if (!process.env.PLAYWRIGHT_CORE) { console.error('Set PLAYWRIGHT_CORE (and BROWSER_EXE for Android profiles).'); process.exit(2); }
const pw = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);
const profiles = pickProfile(arg('--matrix', 'quick'), arg('--only', ''));
const browsers = await launchBrowsers(pw, { chromiumExe: process.env.BROWSER_EXE, need: [...new Set(profiles.map((d) => d.engine))] });

const sample = () => {
  const el = document.querySelector('.ds-tabbar');
  if (!el) return { missing: true };
  const cs = getComputedStyle(el), r = el.getBoundingClientRect(), vv = window.visualViewport;
  const rail = getComputedStyle(el.querySelector('.ds-tabs') || el).flexDirection === 'column'; // the rail runs the tab capsule vertically
  return {
    rail, layout: rail ? parseFloat(cs.top) : parseFloat(cs.bottom), collapsed: el.classList.contains('is-collapsed'),
    gap: window.innerHeight - r.bottom, scrollY: Math.round(window.scrollY), innerHeight: window.innerHeight,
    vvTop: vv ? Math.round(vv.offsetTop * 10) / 10 : 0, vvScale: vv ? Math.round(vv.scale * 100) / 100 : 1, vvH: vv ? Math.round(vv.height) : window.innerHeight,
    overlays: document.querySelectorAll('.ds-scrim-dim.is-on').length, path: location.pathname,
  };
};

const TABS = ['Home', 'Flying', 'Travel', 'Map', 'More'];
const rows = [];
const t0 = Date.now();

for (const d of profiles) {
  const ctx = await openContext(browsers, d);
  const page = await ctx.newPage();
  await page.route(/planespotters|plnspttrs|arcgisonline|cartocdn|tile\.openstreetmap/, (r) => r.abort());
  const fails = [];
  let base = null, steps = 0;
  const record = async (step, { atRest = true } = {}) => {
    await page.waitForTimeout(480);
    const s = await page.evaluate(sample);
    steps += 1;
    if (s.missing) {
      // Focused forms (new, edit, quick log) hide the tab bar on purpose; any other page without one is a fault.
      const path = await page.evaluate(() => location.pathname);
      if (!/\/(new|edit|quick)(\/|$)/.test(path)) fails.push(`${step}: no tab bar on ${path}`);
      return s;
    }
    if (base === null) base = { layout: s.layout, rail: s.rail };
    if (s.rail !== base.rail) fails.push(`${step}: bar switched between bottom bar and rail`);
    else if (Math.abs(s.layout - base.layout) > 0.6) fails.push(`${step}: layout offset ${s.layout}px, first page ${base.layout}px`);
    if (!s.rail) {
      const expected = [s.layout, s.layout - 8];
      if (!expected.some((e) => Math.abs(s.gap - e) < 1.5)) fails.push(`${step}: visual gap ${Math.round(s.gap * 10) / 10}px is neither expanded (${s.layout}) nor collapsed (${s.layout - 8})`);
      if (s.collapsed && s.scrollY <= 0) fails.push(`${step}: collapsed at scrollY 0`);
    }
    if (atRest) {
      if (Math.abs(s.vvTop) > 0.5) fails.push(`${step}: visual viewport offsetTop ${s.vvTop}`);
      if (Math.abs(s.vvScale - 1) > 0.01) fails.push(`${step}: visual viewport scale ${s.vvScale}`);
      if (Math.abs(s.vvH - s.innerHeight) > 1) fails.push(`${step}: visual viewport height ${s.vvH} vs layout ${s.innerHeight}`);
      if (s.overlays) fails.push(`${step}: ${s.overlays} overlay(s) left open`);
    }
    return s;
  };
  const tab = (name) => page.locator('.ds-tabbar').getByRole('link', { name, exact: false }).first();

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-tabbar', { timeout: 8000 }).catch(() => {});
  await record('load /');

  // every tab to every other tab
  for (const a of TABS) for (const b of TABS) {
    if (a === b) continue;
    await tab(a).click().catch(() => {}); await page.waitForTimeout(200);
    await tab(b).click().catch(() => {});
    await record(`${a} -> ${b}`);
  }
  // scroll down (bar collapses), then navigate: the new page starts at the top and the bar is expanded again
  await tab('Home').click().catch(() => {});
  await page.waitForTimeout(250);
  await page.evaluate(() => window.scrollTo(0, 99999)); await record('scrolled to the bottom', { atRest: true });
  await tab('Travel').click().catch(() => {});
  await record('scrolled page -> Travel');
  await page.evaluate(() => window.scrollTo(0, 400)); await page.evaluate(() => window.scrollTo(0, 0)); await record('scrolled down and back to top');
  // Add menu open and closed
  const fab = page.locator('.ds-fab').first();
  if (await fab.count()) { await fab.click().catch(() => {}); await record('Add menu open', { atRest: false }); await page.keyboard.press('Escape'); await record('Add menu closed'); }
  // a form with a focused field, a simulated keyboard, blur
  await page.goto(BASE + '/logbook/new', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input', { timeout: 8000 }).catch(() => {});
  await record('form opened');
  const field = page.locator('input[type="text"], input:not([type]), textarea').first();
  if (await field.count()) {
    await field.focus().catch(() => {});
    await page.setViewportSize({ width: d.width, height: Math.max(240, d.height - 320) }); // the keyboard takes the bottom of the viewport
    await record('keyboard up (field focused)', { atRest: false });
    await page.evaluate(() => document.activeElement?.blur());
    await page.setViewportSize({ width: d.width, height: d.height });
    await record('keyboard down (field blurred)');
  }
  // a sheet opened and closed (the form's date or the page's own sheet trigger), then Back
  await page.goto(BASE + '/logbook', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-tabbar', { timeout: 8000 }).catch(() => {});
  const sheetTrigger = page.getByRole('button', { name: /filter|jump to|search/i }).first();
  if (await sheetTrigger.count()) {
    await sheetTrigger.click().catch(() => {});
    await record('sheet open', { atRest: false });
    await page.keyboard.press('Escape');
    await record('sheet closed');
  }
  await page.goBack().catch(() => {}); await record('Back');
  await page.goBack().catch(() => {}); await record('Back again');

  await ctx.close();

  // Fault injection: a visual viewport that is stuck 38px down with no field focused and no zoom (what a keyboard that closed badly can leave on
  // iOS). The app must correct it by scrolling to the position it is already at; the fixed bars are anchored again after that. A fake
  // window.visualViewport is installed before the page loads, and window.scrollTo is counted.
  {
    const fctx = await openContext(browsers, d);
    await fctx.addInitScript(() => {
      const state = { offsetTop: 0, offsetLeft: 0, scale: 1, height: window.innerHeight, width: window.innerWidth };
      const fake = new EventTarget();
      for (const k of Object.keys(state)) Object.defineProperty(fake, k, { get: () => state[k] });
      Object.defineProperty(window, 'visualViewport', { value: fake, configurable: true });
      window.__vvSet = (o) => { Object.assign(state, o); fake.dispatchEvent(new Event('resize')); fake.dispatchEvent(new Event('scroll')); };
      window.__scrollToCalls = 0;
      const orig = window.scrollTo.bind(window);
      window.scrollTo = (...a) => { window.__scrollToCalls += 1; return orig(...a); };
    });
    const fp = await fctx.newPage();
    await fp.route(/planespotters|plnspttrs|arcgisonline|cartocdn|tile\.openstreetmap/, (r) => r.abort());
    await fp.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await fp.waitForSelector('.ds-tabbar', { timeout: 8000 }).catch(() => {});
    await fp.waitForTimeout(600);
    await fp.evaluate(() => { window.__scrollToCalls = 0; window.__vvSet({ offsetTop: 38 }); });
    await fp.waitForTimeout(900);
    const calls = await fp.evaluate(() => window.__scrollToCalls);
    if (calls < 1) fails.push('a visual viewport stuck 38px down with no field focused was not corrected (no scroll nudge)');
    steps += 1;
    await fp.evaluate(() => { window.__scrollToCalls = 0; window.__vvSet({ offsetTop: 0, scale: 2 }); }); // pinch-zoomed on purpose: must be left alone
    await fp.waitForTimeout(900);
    if (await fp.evaluate(() => window.__scrollToCalls) > 0) fails.push('a pinch-zoomed viewport was nudged');
    steps += 1;
    await fctx.close();
  }

  rows.push({ device: d.name, steps, fails: [...new Set(fails)] });
}
for (const b of Object.values(browsers)) await b.close();

let bad = 0;
for (const r of rows) {
  if (r.fails.length) { bad += 1; console.log(`FAIL ${r.device}: ${r.fails.length} problem(s)`); r.fails.slice(0, 5).forEach((f) => console.log(`     ${f}`)); }
}
const steps = rows.reduce((n, r) => n + r.steps, 0);
console.log(`Tab bar stability: ${profiles.length} devices, ${steps} recorded steps, ${bad} device(s) with a problem in ${Math.round((Date.now() - t0) / 1000)} s. ${BASE}`);
process.exit(bad ? 1 : 0);
