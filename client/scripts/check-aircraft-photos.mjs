// AIRCRAFT PHOTO CHECK. The photo of an aircraft by registration (Planespotters), with every answer MOCKED: the real photo host is never contacted.
// WebKit (iPhone profile at 390, desktop at 1440) and Chromium, on the flight detail (pilot, and passenger with and without a registration)
// and the aircraft detail. For each scenario it asserts:
//   photo      the credit "Photo: <name> / Planespotters.net" and a link to the API's own URL (new tab, noopener, not nofollow), the image is a
//              link too, a >= 44px tap target, a popup opens the exact URL, corners follow the card, a scrim under the credit, no caps labels
//   none / error / bad status / malformed / bad JSON / image 404 / slow / offline / Save-Data
//              the calm drawing and NO text at all inside the figure; offline and Save-Data make no request
//   always     the frame and the content under it do not move when the answer arrives (box equal before and after, layout shift 0 on the
//              figure and what follows it), the request is a plain GET of /pub/photos/reg/<REG> with no cookie, no auth header, no query,
//              and a referrer of the origin only; at most one API request per registration; no storage written (localStorage, sessionStorage,
//              cookies, IndexedDB, Cache Storage unchanged from before the photo to after it, and nothing in them names the photo host or
//              the photographer); the figure is display:none in print, and /logbook/print makes no photo request and has no figure
// Read-only: it loads pages and mocks responses (a passenger flight's registration is injected into the response in the browser, not saved).
//   PLAYWRIGHT_CORE=<..> [BROWSER_EXE=<chrome.exe>] node client/scripts/check-aircraft-photos.mjs [--base http://localhost:4174] [--api http://localhost:3002]
//                                                                                                  [--engines webkit,chromium] [--widths 390,1440] [--shots <dir>]
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';
import { PHOTO_ALLOWED_HOSTS, PHOTO_API_HOST } from '../src/lib/aircraftPhoto.js';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:4174'), API = arg('--api', 'http://localhost:3002');
const ENGINES = arg('--engines', 'webkit,chromium').split(',');
const WIDTHS = arg('--widths', '390,1440').split(',').map(Number);
const SHOTS = arg('--shots', '');
if (!process.env.PLAYWRIGHT_CORE) { console.error('Set PLAYWRIGHT_CORE.'); process.exit(2); }
const pw = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href); const { webkit, chromium, devices } = pw.default ?? pw;
const origin = new URL(BASE).origin;
const HOSTS_RE = new RegExp(`^https://(${PHOTO_ALLOWED_HOSTS.map((h) => h.replace(/\./g, '\\.')).join('|')})/`);

const NAME = 'Mock Photographer';
const LINK = 'https://www.planespotters.net/photo/000000/mock-aircraft?utm_source=api';
const IMG_L = 'https://t.plnspttrs.net/00000/mock_280.png';
const IMG_T = 'https://t.plnspttrs.net/00000/mock_t.png';
const CREDIT = `Photo: ${NAME} / Planespotters.net`;
const PNG = await sharp({ create: { width: 420, height: 280, channels: 3, background: { r: 70, g: 110, b: 150 } } }).png().toBuffer();
const GOOD = JSON.stringify({ photos: [{ id: '000000', thumbnail: { src: IMG_T, size: { width: 200, height: 133 } }, thumbnail_large: { src: IMG_L, size: { width: 420, height: 280 } }, link: LINK, photographer: NAME }] });
const CORS = { 'access-control-allow-origin': '*', 'content-type': 'application/json; charset=UTF-8' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const get = async (p) => (await fetch(`${API}/api${p}`)).json();
const flights = await get('/flights'); const aircraft = await get('/aircraft');
const pilotFlight = flights.find((f) => f.role === 'pilot' && f.tail_number);
const paxFlight = flights.find((f) => f.role !== 'pilot' && !f.tail_number);
const acft = aircraft.find((a) => a.tail_number && !a.is_simulator);
if (!pilotFlight || !paxFlight || !acft) { console.error('The scratch data needs a pilot flight with a tail, a passenger flight without one and an aircraft.'); process.exit(2); }
const PAX_REG = 'N900PX';
const norm = (s) => String(s).trim().toUpperCase();

// case: route, the registration the photo must be looked up by (null = no lookup at all), an optional rewrite of the flight response
const CASES = [
  { id: 'pilot-flight', url: `/logbook/${pilotFlight.id}`, reg: norm(pilotFlight.tail_number) },
  { id: 'pax-with-reg', url: `/travel/${paxFlight.id}`, reg: PAX_REG, inject: { flightId: paxFlight.id, tail: PAX_REG } },
  { id: 'pax-no-reg', url: `/travel/${paxFlight.id}`, reg: null },
  { id: 'aircraft', url: `/aircraft/${acft.id}`, reg: norm(acft.tail_number) },
];
// scenario: what the mocked API does, and the end state the figure must reach
const SCENARIOS = [
  { id: 'photo', end: 'photo', api: async (r, gate) => { await gate(); await sleep(150); await r.fulfill({ status: 200, headers: CORS, body: GOOD }); } },
  { id: 'none', end: 'drawing', api: (r) => r.fulfill({ status: 200, headers: CORS, body: '{"photos":[]}' }) },
  { id: 'error', end: 'drawing', api: (r) => r.abort('failed') },
  { id: 'slow', end: 'photo', api: async (r, gate) => { await gate(); await sleep(2500); await r.fulfill({ status: 200, headers: CORS, body: GOOD }); }, early: 'drawing' },
  { id: 'offline', end: 'drawing', offline: true, noRequests: true },
  { id: 'savedata', end: 'drawing', saveData: true, noRequests: true, only: 'pilot-flight' },
  { id: 'status500', end: 'drawing', api: (r) => r.fulfill({ status: 500, headers: CORS, body: '{"error":"x"}' }), only: 'pilot-flight' },
  { id: 'malformed', end: 'drawing', api: (r) => r.fulfill({ status: 200, headers: CORS, body: '{"photos":[{"id":1}]}' }), only: 'pilot-flight' },
  { id: 'badjson', end: 'drawing', api: (r) => r.fulfill({ status: 200, headers: CORS, body: 'not json' }), only: 'pilot-flight' },
  { id: 'image404', end: 'drawing', api: (r) => r.fulfill({ status: 200, headers: CORS, body: GOOD }), img: (r) => r.fulfill({ status: 404, body: '' }), only: 'pilot-flight' },
];

const SNAP = async () => ({
  ls: Object.fromEntries(Object.entries(localStorage)), ss: Object.fromEntries(Object.entries(sessionStorage)), cookie: document.cookie,
  idb: ((await indexedDB.databases?.()) || []).map((d) => d.name).sort(),
  caches: await Promise.all((await caches.keys()).map(async (k) => [k, (await (await caches.open(k)).keys()).map((r) => r.url)])),
});

const results = []; const fails = [];
const record = (key, problems, note) => { results.push({ key, ok: problems.length === 0, note }); for (const p of problems) fails.push(`${key}: ${p}`); };

async function runOne(browser, engine, width, c, s) {
  const key = `${engine} ${width}px ${c.id} / ${s.id}`;
  const problems = [];
  const ctxOpts = width < 700 ? { ...devices['iPhone 13'], viewport: { width, height: 844 } } : { viewport: { width, height: 900 } };
  const ctx = await browser.newContext({ ...ctxOpts, serviceWorkers: 'block' }); // the app's service worker only handles map tiles; blocking it lets route() see every request
  const seen = []; const thirdParty = [];
  // the photo answers are held until the page has been measured (so "before" is really before), then released
  let released = false;
  const gate = async () => { for (let i = 0; i < 300 && !released; i++) await sleep(20); };
  await ctx.route(HOSTS_RE, async (route) => {
    const req = route.request(); const u = new URL(req.url());
    if (u.hostname === PHOTO_API_HOST) {
      seen.push({ kind: 'api', method: req.method(), url: req.url(), path: u.pathname, search: u.search + u.hash, headers: await req.allHeaders() });
      return s.api ? s.api(route, gate) : route.abort('failed');
    }
    if (u.hostname === 't.plnspttrs.net') {
      seen.push({ kind: 'img', method: req.method(), url: req.url(), headers: await req.allHeaders() });
      if (s.img) return s.img(route);
      await sleep(200);
      return route.fulfill({ status: 200, headers: { 'content-type': 'image/png' }, body: PNG });
    }
    return route.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: '<!doctype html><title>mock</title><p>mock</p>' }); // the photo's own page
  });
  if (c.inject) {
    await ctx.route(new RegExp(`/api/flights/${c.inject.flightId}$`), async (route) => {
      const res = await route.fetch(); const json = await res.json();
      await route.fulfill({ response: res, body: JSON.stringify({ ...json, tail_number: c.inject.tail }) });
    });
  }
  const page = await ctx.newPage();
  page.on('request', (r) => { const h = new URL(r.url()).hostname; if (!r.url().startsWith(origin) && !PHOTO_ALLOWED_HOSTS.includes(h) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) thirdParty.push(r.url()); });
  await page.addInitScript(({ offline, saveData }) => {
    if (offline) Object.defineProperty(navigator, 'onLine', { get: () => false });
    if (saveData) Object.defineProperty(navigator, 'connection', { get: () => ({ saveData: true, effectiveType: '4g' }) });
    window.__writes = [];
    const wrap = (proto, name) => { const o = proto[name]; if (!o) return; proto[name] = function (...a) { window.__writes.push(`${name}:${String(a[0])}=${String(a[1] ?? '').slice(0, 200)}`); return o.apply(this, a); }; };
    wrap(Storage.prototype, 'setItem'); wrap(Storage.prototype, 'removeItem');
    window.__cls = []; // layout shifts with the elements they hit
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls.push({ v: e.value, nodes: (e.sources || []).map((x) => x.node) });
      }).observe({ type: 'layout-shift', buffered: true });
    } catch { /* unsupported */ }
  }, { offline: Boolean(s.offline), saveData: Boolean(s.saveData) });

  try {
    await page.goto(BASE + c.url, { waitUntil: 'load' });
    if (c.reg === null) {
      await page.waitForSelector('.mn-detail', { timeout: 8000 });
      await page.waitForTimeout(900);
      if (await page.locator('.ap').count()) problems.push('a figure is on the page without a registration');
      if (seen.length) problems.push(`${seen.length} photo-host request(s) without a registration`);
      if (thirdParty.length) problems.push(`other third-party request: ${thirdParty[0]}`);
      record(key, problems, 'no figure, no request');
      return;
    }

    await page.waitForSelector('figure.ap .ap-frame', { timeout: 8000 });
    await page.waitForTimeout(550); // the page's own entrance motion settles first
    const before = await page.evaluate(() => {
      const fig = document.querySelector('figure.ap'), fr = fig.querySelector('.ap-frame'), next = fig.nextElementSibling;
      const r = fr.getBoundingClientRect(), nt = next ? next.getBoundingClientRect().top + scrollY : null;
      window.__cls.length = 0; // only shifts from here on count
      window.__fig = fig; window.__next = next;
      return { w: r.width, h: r.height, x: r.left, top: r.top + scrollY, nextTop: nt, ratio: r.width / r.height, state: fig.getAttribute('data-ap'), text: fig.innerText.trim() };
    });
    if (Math.abs(before.ratio - 1.5) > 0.01) problems.push(`frame ratio ${before.ratio.toFixed(3)} is not 3:2`);
    if (before.state !== 'drawing') problems.push(`starts as ${before.state}, not the drawing`);
    if (before.text) problems.push(`text in the figure before an answer: "${before.text}"`);
    if (!(await page.locator('figure.ap .ap-art svg').count())) problems.push('no drawing');
    const snapBefore = await page.evaluate(SNAP);
    released = true;

    if (s.early) {
      await page.waitForTimeout(900);
      const st = await page.evaluate(() => document.querySelector('figure.ap').getAttribute('data-ap'));
      if (st !== s.early) problems.push(`while waiting it shows ${st}, not the ${s.early}`);
    }
    if (s.end === 'photo') await page.waitForSelector('figure.ap[data-ap="photo"]', { timeout: 7000 }).catch(() => problems.push('the photo never appeared'));
    else await page.waitForTimeout(1500);
    await page.waitForTimeout(500); // let a fade and any late shift show up

    const after = await page.evaluate(() => {
      const fig = document.querySelector('figure.ap'); if (!fig) return null;
      const fr = fig.querySelector('.ap-frame'), next = fig.nextElementSibling, r = fr.getBoundingClientRect();
      const link = fig.querySelector('a'), img = fig.querySelector('img'), credit = fig.querySelector('.ap-credit');
      const near = (n) => n && (fig.contains(n) || n === window.__next || (window.__next && window.__next.contains(n)));
      const lr = link ? link.getBoundingClientRect() : null;
      const card = document.querySelector('.mn-card, section.card');
      return {
        w: r.width, h: r.height, x: r.left, top: r.top + scrollY, nextTop: next ? next.getBoundingClientRect().top + scrollY : null, state: fig.getAttribute('data-ap'), text: fig.innerText.trim(),
        shift: window.__cls.filter((e) => e.nodes.some(near)).reduce((a, e) => a + e.v, 0),
        link: link ? { href: link.getAttribute('href'), target: link.getAttribute('target'), rel: link.getAttribute('rel') || '', w: lr.width, h: lr.height, hidden: link.getAttribute('aria-hidden'), tag: link.tagName } : null,
        img: img ? { src: img.getAttribute('src'), loaded: img.complete && img.naturalWidth > 0, refpol: img.referrerPolicy } : null,
        credit: credit ? { text: credit.textContent, caps: getComputedStyle(credit).textTransform, bg: getComputedStyle(credit).backgroundImage } : null,
        frameRadius: getComputedStyle(fr).borderTopLeftRadius, cardRadius: card ? getComputedStyle(card).borderTopLeftRadius : null,
        writes: window.__writes.slice(),
      };
    });
    if (!after) { problems.push('the figure disappeared'); record(key, problems); return; }

    // nothing moved
    for (const k of ['w', 'h', 'x', 'top']) if (Math.abs(after[k] - before[k]) > 0.5) problems.push(`frame ${k} changed ${before[k]} -> ${after[k]}`);
    if (before.nextTop != null && Math.abs(after.nextTop - before.nextTop) > 0.5) problems.push(`the content under it moved ${before.nextTop} -> ${after.nextTop}`);
    if (after.shift > 0) problems.push(`layout shift ${after.shift.toFixed(4)} on the figure or what follows`);

    // end state
    if (after.state !== s.end) problems.push(`ends as ${after.state}, expected ${s.end}`);
    if (s.end === 'photo') {
      if (!after.credit || after.credit.text !== CREDIT) problems.push(`credit "${after.credit?.text}"`);
      if (!after.link) problems.push('no link');
      else {
        if (after.link.tag !== 'A') problems.push('not an anchor');
        if (after.link.href !== LINK) problems.push(`link ${after.link.href} is not the API's URL unchanged`);
        if (after.link.target !== '_blank') problems.push('not a new tab');
        if (!/\bnoopener\b/.test(after.link.rel)) problems.push(`rel "${after.link.rel}" lacks noopener`);
        if (/nofollow/.test(after.link.rel)) problems.push('rel has nofollow');
        if (after.link.w < 44 || after.link.h < 44) problems.push(`tap target ${Math.round(after.link.w)}x${Math.round(after.link.h)}`);
        if (after.link.hidden) problems.push('the link is aria-hidden once the photo shows');
      }
      if (!after.img || after.img.src !== IMG_L || !after.img.loaded) problems.push(`image ${JSON.stringify(after.img)}`);
      if (after.credit && after.credit.caps !== 'none') problems.push(`credit text-transform ${after.credit.caps}`);
      if (after.credit && !/gradient/.test(after.credit.bg)) problems.push('no scrim under the credit');
      if (after.cardRadius && after.frameRadius !== after.cardRadius) problems.push(`corner ${after.frameRadius} vs card ${after.cardRadius}`);
    } else {
      if (after.text) problems.push(`text in the figure: "${after.text}"`);
      if (after.link) problems.push('a link is present without a photo');
    }

    // requests
    const api = seen.filter((x) => x.kind === 'api'), imgs = seen.filter((x) => x.kind === 'img');
    if (s.noRequests) { if (seen.length) problems.push(`${seen.length} photo-host request(s) made`); }
    else {
      if (api.length === 0) problems.push('no API request was made');
      if (api.length > 1) problems.push(`${api.length} API requests for one registration`);
      for (const r of api) {
        if (r.method !== 'GET') problems.push(`method ${r.method}`);
        if (r.path !== `/pub/photos/reg/${c.reg}`) problems.push(`path ${r.path}, expected the registration only`);
        if (r.search) problems.push(`query/hash ${r.search}`);
        if (r.headers.cookie) problems.push('cookie sent to the photo API');
        if (r.headers.authorization) problems.push('authorization sent to the photo API');
        const ref = r.headers.referer; if (ref && ref !== origin + '/') problems.push(`referrer ${ref} is more than the origin`);
      }
      for (const r of imgs) { if (r.headers.cookie) problems.push('cookie sent to the image host'); const ref = r.headers.referer; if (ref && ref !== origin + '/') problems.push(`image referrer ${ref}`); if (r.url !== IMG_L) problems.push(`image URL altered: ${r.url}`); }
    }
    if (thirdParty.length) problems.push(`other third-party request: ${thirdParty[0]}`);

    // storage
    const snapAfter = await page.evaluate(SNAP);
    if (JSON.stringify(snapBefore) !== JSON.stringify(snapAfter)) problems.push('storage changed between the drawing and the answer');
    const blob = JSON.stringify(snapAfter) + after.writes.join('\n');
    if (/planespotters|plnspttrs|Mock Photographer/i.test(blob)) problems.push('storage or a storage write names the photo host or the photographer');

    // click, print, screenshots
    if (s.id === 'photo') {
      const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null), page.locator('figure.ap a').click({ timeout: 5000 }).catch((e) => problems.push(`click: ${e.message.split('\n')[0]}`))]);
      if (!popup) problems.push('the link opened no tab');
      else { await popup.waitForLoadState('domcontentloaded').catch(() => {}); if (popup.url() !== LINK) problems.push(`the tab opened ${popup.url()}`); await popup.close().catch(() => {}); }
      await page.emulateMedia({ media: 'print' });
      const shown = await page.evaluate(() => getComputedStyle(document.querySelector('figure.ap')).display);
      if (shown !== 'none') problems.push(`display ${shown} in print`);
      await page.emulateMedia({ media: 'screen' });
    }
    if (SHOTS && ['photo', 'none'].includes(s.id) && ['pilot-flight', 'aircraft'].includes(c.id)) {
      fs.mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: path.join(SHOTS, `${engine}-${width}-${c.id}-${s.id}.png`), fullPage: false });
    }
    record(key, problems, `${s.end}${api.length ? `, ${api.length} api` : ', no request'}`);
  } catch (e) {
    problems.push(`threw: ${e.message.split('\n')[0]}`);
    record(key, problems);
  } finally {
    await ctx.close();
  }
}

for (const engine of ENGINES) {
  const browser = await (engine === 'webkit' ? webkit : chromium).launch(engine === 'chromium' && process.env.BROWSER_EXE ? { executablePath: process.env.BROWSER_EXE } : {});
  for (const width of WIDTHS) {
    for (const c of CASES) {
      for (const s of SCENARIOS) {
        if (s.only && s.only !== c.id) continue;
        if (c.reg === null && s.id !== 'photo') continue; // one scenario is enough to prove "nothing happens"
        await runOne(browser, engine, width, c, s);
      }
    }
  }
  await browser.close();
}

// the print summary: no figure, no photo request, even with every answer available
{
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  let hits = 0;
  await ctx.route(HOSTS_RE, (r) => { hits += 1; return r.abort('failed'); });
  const page = await ctx.newPage();
  await page.goto(BASE + '/logbook/print', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const figs = await page.locator('.ap').count();
  record('print summary /logbook/print', [...(figs ? [`${figs} figure(s)`] : []), ...(hits ? [`${hits} photo-host request(s)`] : [])], 'no figure, no request');
  await browser.close();
}

const w = Math.max(...results.map((r) => r.key.length));
for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.key.padEnd(w)}  ${r.note || ''}`);
console.log(`\naircraft photos: ${results.length} runs, ${fails.length} problem(s)`);
for (const f of fails) console.log('  ' + f);
process.exit(fails.length ? 1 : 0);
