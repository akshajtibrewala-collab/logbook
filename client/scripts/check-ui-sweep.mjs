// UI SWEEP 2 REGRESSION CHECKS (read-only). One check per bug the owner reported from the phone on 2026-10-15; each fails on the previous build.
//   icon    the iOS home-screen icon: every URL a phone may ask for (/apple-touch-icon-v2.png, /apple-touch-icon.png, /apple-touch-icon-precomposed.png,
//           /apple-touch-icon-180x180.png) answers 200 with image/png (never the app's HTML fallback), is a real 180x180 PNG with no transparency, the page
//           names the v2 file first, the manifest parses and its icons answer 200 image/png at their declared sizes, and the service worker never touches them.
//   width   the Log's List and Ledger run the full page width: the Ledger's scroller ends where the page content ends (+-1px), the Ledger needs no sideways
//           scroll at 100% text on a phone, and a list row's trailing hours end within 16px of the content's right edge (not 60px short for the Add button).
//   flat    the older form and settings pages (aircraft, expiration, ground session, quick log, cost and weather settings, share, settings): on a phone their
//           fields, selects and buttons span the page column like the redesigned forms (no 17-20px card inset).
//   covered at the end of the page, on the Log's List and Ledger and on Travel, no figure or Ledger column sits under the Add button or the tab bar.
//   field   the departure and arrival time boxes match a text field next to them: same box height, and the value's ink starts at the same x offset and is
//           centred vertically to within 1.5px (measured on a screenshot of each field, so it is what the eye sees).
//
//   PLAYWRIGHT_CORE=<playwright-core folder> node client/scripts/check-ui-sweep.mjs [--base http://localhost:4176] [--matrix quick|full] [--only "phone 390"] [--text 100,130,200]
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { openContext, launchBrowsers, pickProfile } from './lib/devices.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:4176');
const TEXTS = arg('--text', '100,130,200').split(',').map(Number);
if (!process.env.PLAYWRIGHT_CORE) { console.error('Set PLAYWRIGHT_CORE.'); process.exit(2); }
const pw = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);
const profiles = pickProfile(arg('--matrix', 'quick'), arg('--only', '')).filter((d) => d.kind !== 'desktop');
const browsers = await launchBrowsers(pw, { chromiumExe: process.env.BROWSER_EXE, need: [...new Set(profiles.map((d) => d.engine))] });
const problems = [];
const say = (m) => problems.push(m);

// ---- icon (once: it does not depend on the device) ----
{
  const get = async (p) => { const r = await fetch(BASE + p, { redirect: 'manual' }); return { r, b: Buffer.from(await r.arrayBuffer()) }; };
  const html = (await get('/')).b.toString('utf8');
  const links = [...html.matchAll(/<link\b[^>]*rel="apple-touch-icon"[^>]*>/gi)].map((m) => m[0]);
  if (!links.length || !/apple-touch-icon-v2\.png/.test(links[0])) say('icon: the first apple-touch-icon link is not the v2 file');
  for (const p of ['/apple-touch-icon-v2.png', '/apple-touch-icon.png', '/apple-touch-icon-precomposed.png', '/apple-touch-icon-180x180.png']) {
    const { r, b } = await get(p);
    if (r.status !== 200) { say(`icon: ${p} answers ${r.status}`); continue; }
    if (!/^image\/png/.test(r.headers.get('content-type') || '')) say(`icon: ${p} answers ${r.headers.get('content-type')}, not image/png (the app's HTML fallback page)`);
    if (b.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') { say(`icon: ${p} is not a PNG`); continue; }
    const m = await sharp(b).metadata();
    if (m.width !== 180 || m.height !== 180) say(`icon: ${p} is ${m.width}x${m.height}, not 180x180`);
    if (m.hasAlpha && (await sharp(b).stats()).channels[3].min !== 255) say(`icon: ${p} has transparent pixels`);
  }
  try {
    const mf = JSON.parse((await get('/manifest.json')).b.toString('utf8'));
    for (const i of mf.icons || []) {
      const { r, b } = await get(i.src);
      if (r.status !== 200 || !/^image\/png/.test(r.headers.get('content-type') || '')) { say(`icon: manifest icon ${i.src} answers ${r.status} ${r.headers.get('content-type')}`); continue; }
      const m = await sharp(b).metadata();
      if (`${m.width}x${m.height}` !== i.sizes) say(`icon: manifest icon ${i.src} is ${m.width}x${m.height}, declared ${i.sizes}`);
    }
  } catch (e) { say(`icon: manifest.json unreadable (${e.message})`); }
  const sw = (await get('/sw.js')).b.toString('utf8');
  if (/apple-touch|\/icons\/|manifest/.test(sw)) say('icon: the service worker mentions icons or the manifest');
}

const inkBox = async (page, el) => {
  const box = await el.boundingBox();
  const png = await page.screenshot({ clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => { const o = (y * info.width + x) * info.channels; return [data[o], data[o + 1], data[o + 2]]; };
  const bg = px(Math.round(info.width * 0.9), Math.round(info.height / 2));
  const inset = Math.round(info.width / box.width * 7); // ignore the rim and its rounded corners
  let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
  for (let y = inset; y < info.height - inset; y++) for (let x = inset; x < info.width - inset; x++) {
    const p = px(x, y); if (Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]) > 120) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  const k = info.width / box.width;
  return maxX < 0 ? null : { left: minX / k, midY: (minY + maxY) / 2 / k, h: box.height, boxMid: box.height / 2 };
};

for (const d of profiles) for (const TEXT of TEXTS) {
  const ctx = await openContext(browsers, d);
  await ctx.addInitScript((t) => { try { localStorage.setItem('aerohub-logbook-view', 'ledger'); } catch { /* none */ } const set = () => { if (document.documentElement) document.documentElement.style.fontSize = `${t}%`; }; set(); document.addEventListener('DOMContentLoaded', set); }, TEXT);
  const page = await ctx.newPage();
  await page.route(/planespotters|plnspttrs|arcgisonline|cartocdn|tile\.openstreetmap/, (r) => r.abort());
  const tag = `${d.name} text ${TEXT}%`;

  // width: Ledger
  await page.goto(`${BASE}/logbook`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForSelector('.mn-led', { timeout: 6000 }).catch(() => {});
  const led = await page.evaluate(() => {
    const w = document.querySelector('.mn-led-wrap'); if (!w) return null;
    const ref = document.querySelector('main h1, main .mn-hero, main .bc-hero, main [class*="hero"]') || document.querySelector('main > div > *');
    const col = document.querySelector('.bc-cols, .ds-main > div') || w.parentElement;
    const cr = col.getBoundingClientRect(), wr = w.getBoundingClientRect();
    return { wrapRight: wr.right, wrapLeft: wr.left, colRight: cr.right, colLeft: cr.left, scrolls: w.scrollWidth > w.clientWidth + 1, phone: innerWidth < 720 };
  });
  if (led && led.phone) {
    if (Math.abs(led.wrapRight - (led.colRight)) > 1.5 && led.colRight - led.wrapRight > 1.5) say(`width: ${tag}: the Ledger ends ${Math.round(led.colRight - led.wrapRight)}px short of the page content's right edge`);
    if (TEXT <= 100 && led.scrolls) say(`width: ${tag}: the Ledger scrolls sideways at 100% text`);
  }
  // width: List
  await page.locator('button:has-text("List"), [role=radio]:has-text("List"), [role=tab]:has-text("List")').first().click({ timeout: 4000 }).catch(() => say(`width: ${tag}: could not switch to the List view`));
  await page.waitForSelector('.bc-row', { timeout: 6000 }).catch(() => {});
  const list = await page.evaluate(() => {
    const row = document.querySelector('.bc-row'); if (!row) return null;
    const rr = row.getBoundingClientRect();
    const kids = [...row.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent.trim() && e.getBoundingClientRect().width > 0);
    const right = Math.max(...kids.map((e) => e.getBoundingClientRect().right));
    return { rowRight: rr.right, textRight: right, phone: innerWidth < 720 };
  });
  if (list && list.phone && list.rowRight - list.textRight > 16) say(`width: ${tag}: a List row's trailing figure ends ${Math.round(list.rowRight - list.textRight)}px before the row's right edge`);

  // covered: at the end of the page nothing readable is under the Add button or the tab bar
  for (const [route, view] of [['/logbook', 'ledger'], ['/logbook', 'list'], ['/travel', 'list']]) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' }).catch(() => {});
    const label = view === 'ledger' ? 'Ledger' : 'List';
    if (route === '/logbook') await page.locator(`button:has-text("${label}"), [role=radio]:has-text("${label}")`).first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1400); // the Add button returns once the page is idle
    const hidden = await page.evaluate(() => {
      // bottom-anchored floating controls only: on the wide layout the Add button sits in the top bar's row, where content always scrolls underneath
      const over = [document.querySelector('.ds-fab'), document.querySelector('.ds-tabbar')].filter((o) => o && o.getBoundingClientRect().bottom > innerHeight * 0.4);
      const out = [];
      for (const e of document.querySelectorAll('main td, main th, main .bc-row *, main .bc-mh *')) {
        if (e.children.length || !e.textContent.trim()) continue;
        const r = e.getBoundingClientRect(); if (r.width === 0 || r.bottom < 0 || r.top > innerHeight) continue;
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const hit = document.elementFromPoint(x, y);
        if (hit && over.some((o) => o.contains(hit))) out.push(e.textContent.trim().slice(0, 12));
      }
      return out.slice(0, 4);
    });
    if (hidden.length) say(`covered: ${tag} ${route} (${view}): ${hidden.join(', ')} sit under the Add button or the tab bar at the end of the page`);
  }
  // flat: older form pages span the column
  if (d.kind === 'phone') for (const route of ['/aircraft/new', '/currency/new', '/logbook/ground/new', '/logbook/quick', '/weather/settings', '/logbook/share', '/settings']) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(350);
    const m = await page.evaluate(() => {
      const main = document.querySelector('main'); const mr = main.getBoundingClientRect(); const cs = getComputedStyle(main);
      const L = mr.left + parseFloat(cs.paddingLeft), R = mr.right - parseFloat(cs.paddingRight);
      const rects = [...main.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, textarea, button.gl-select, .gl-step, main a.gl, main button.gl.lg')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 60 && r.height > 20);
      if (!rects.length) return null;
      return { left: Math.min(...rects.map((r) => r.left)) - L, right: R - Math.max(...rects.map((r) => r.right)) };
    });
    if (m && (m.left > 3 || m.right > 3)) say(`flat: ${tag} ${route}: fields are inset ${Math.round(m.left)}px left and ${Math.round(m.right)}px right of the page column`);
  }
  // field: time boxes vs a text field
  if (TEXT <= 130) {
    await page.goto(`${BASE}/logbook/new?role=passenger`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(400);
    const time = await page.$('input[type="time"]'), text = await page.$('input[placeholder="DL123"]');
    if (time && text) {
      await time.fill('08:15'); await text.fill('DL123'); await page.evaluate(() => document.activeElement?.blur()); await page.waitForTimeout(250);
      await page.addStyleTag({ content: '.ds-topbar,.ds-tabbar,.ds-fab,.ds-edge,.ds-savebar,.ds-glass{visibility:hidden!important}' }); // nothing floating may sit over a field being measured
      await time.evaluate((e) => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(150);
      const a = await inkBox(page, time);
      await text.evaluate((e) => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(150);
      const b = await inkBox(page, text);
      if (a && b) {
        if (Math.abs(a.h - b.h) > 1) say(`field: ${tag}: time box is ${a.h}px tall, the text field ${b.h}px`);
        if (Math.abs(a.left - b.left) > 2.5) say(`field: ${tag}: time value starts ${a.left.toFixed(1)}px in, the text field's ${b.left.toFixed(1)}px`);
        if (Math.abs((a.midY - a.boxMid) - (b.midY - b.boxMid)) > 1.5) say(`field: ${tag}: time value sits ${((a.midY - a.boxMid) - (b.midY - b.boxMid)).toFixed(1)}px off the text field's vertical centre`);
      } else say(`field: ${tag}: could not measure the field text`);
    } else say(`field: ${tag}: time or text field not found`);
  }
  await ctx.close();
}

const uniq = [...new Set(problems)];
for (const p of uniq) console.log('FAIL', p);
console.log(`UI sweep 2: ${profiles.length} devices x text ${TEXTS.join('/')}% -> ${uniq.length} problem(s)`);
await Promise.all(Object.values(browsers).map((b) => b.close()));
process.exit(uniq.length ? 1 : 0);
