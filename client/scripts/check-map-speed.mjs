// MAP LOAD SPEED. Measures how long the Map tab takes to show something useful, in the way the installed app meets it: the app has been opened once
// (the service worker is installed and controlling), then the Map tab is opened from Home. Tile requests are answered locally with synthetic JPEG tiles
// (about 8 KB each) after a realistic delay, so the numbers do not depend on the sandbox's internet.
//   phases     cold     first Map visit after the app was installed (service worker controls the page, tile cache empty)
//              warm     leave to Home and open the Map again (tiles in the service worker cache)
//              reload   a full reload on /map (what a force-close and reopen does)
//   profiles   wifi     tiles 150-400 ms each; network as is
//              slow4g   tiles +180 ms; page requests through CDP emulation at 1.6 Mbps, 150 ms RTT (Chromium)
//   metrics    container    the map surface is on screen (before it: only the page frame)
//              firstTile    the first tile image has loaded and is visible
//              routes       a route line has been drawn
//              allTiles     every tile in view has loaded (stable for 300 ms)
//              tileReqs     tile requests that reached the network (service-worker cache hits are not counted)
//              long / tbt   main-thread long tasks (Chromium) and total blocking time after the tap
//   Budget mode (--budget): exits 1 when firstTile, routes or allTiles exceed the stated budgets under the profile, or the map is blank (no container) for
//   longer than the container budget, or the service worker adds more than the stated per-tile latency, or the placeholder check exceeds its cost budget.
//   PLAYWRIGHT_CORE=<..> node client/scripts/check-map-speed.mjs [--base http://localhost:4174] [--engine chromium|webkit] [--profile wifi|slow4g] [--cpu 4] [--budget] [--runs 1]
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1'; // lets Playwright route the service worker's own tile fetches (Chromium)
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:4174'), ENGINE = arg('--engine', 'chromium'), PROFILE = arg('--profile', 'wifi'), CPU = Number(arg('--cpu', 1));
const REAL = process.argv.includes('--real'); // real Esri tiles instead of synthetic ones (network permitting)
const BUDGET = process.argv.includes('--budget'), RUNS = Number(arg('--runs', 1)), LABEL = arg('--label', BASE);
// Budgets (milliseconds; slow 4G, 4x CPU, synthetic tiles delayed 330-580 ms), set from the measurements of fix/map-speed with about 50% headroom.
// swKeep and phTotal are the service worker's background keep time per tile and the placeholder check's total cost on the main thread.
const B = {
  cold:   { container: 600, firstTile: 900, routes: 1300, allTiles: 2300 },
  warm:   { container: 400,  firstTile: 400,  routes: 1500, allTiles: 1000 },
  reload: { container: 3500, firstTile: 3500, routes: 4500, allTiles: 4500 },
  tileMs: 600, swKeep: 60, phTotal: 150,
};
if (!process.env.PLAYWRIGHT_CORE) { console.error('Set PLAYWRIGHT_CORE.'); process.exit(2); }
const pw = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href); const { webkit, chromium, devices } = pw.default ?? pw;

// synthetic tile: low-amplitude noise around the dark canvas colour, as JPEG (about 8 KB), so transfer and decode costs are realistic
const px = Buffer.alloc(256 * 256 * 3); let seed = 7; for (let i = 0; i < px.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; px[i] = 38 + ((seed >> 16) % 14); }
const TILE = await sharp(px, { raw: { width: 256, height: 256, channels: 3 } }).jpeg({ quality: 45 }).toBuffer();
const CLEAR = await sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();

const OBSERVER = () => {
  window.__sp = { long: [], t: {}, t0: 0 };
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__sp.long.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true }); } catch { /* no long tasks in this engine */ }
  window.__spMark = () => { window.__sp.t0 = performance.now(); window.__sp.t = {}; window.__sp.long = []; window.__sp.lastChange = 0; window.__sp.sig = ''; };
  try { if (sessionStorage.getItem('__spAuto')) window.__spMark(); } catch { /* storage blocked */ } // a reload marks itself at navigation start
  setInterval(() => {
    const s = window.__sp; if (!s.t0) return; const now = performance.now() - s.t0;
    const c = document.querySelector('.leaflet-container'); if (c && s.t.container == null) s.t.container = now;
    if (!c) return;
    const imgs = [...c.querySelectorAll('img.leaflet-tile')]; const inView = imgs.filter((i) => { const r = i.getBoundingClientRect(); return r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight; });
    const ok = inView.filter((i) => i.complete && i.naturalWidth > 0);
    if (ok.length && s.t.firstTile == null) s.t.firstTile = now;
    if (c.querySelector('.leaflet-overlay-pane path') && s.t.routes == null) s.t.routes = now;
    const sig = `${inView.length}/${ok.length}`; if (sig !== s.sig) { s.sig = sig; s.lastChange = now; }
    if (inView.length >= 4 && ok.length === inView.length && now - s.lastChange > 300 && s.t.allTiles == null) s.t.allTiles = s.lastChange;
  }, 25);
};

const delayFor = (url) => { let h = 0; for (const ch of url) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return 150 + (h % 250) + (PROFILE === 'slow4g' ? 180 : 0); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function once() {
  const browser = await (ENGINE === 'webkit' ? webkit : chromium).launch();
  const ctx = await browser.newContext({ ...(ENGINE === 'webkit' ? devices['iPhone 13'] : devices['Pixel 5']), viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const net = { tiles: 0, bytes: 0 }; const tileLog = [];
  if (!REAL) await ctx.route(/server\.arcgisonline\.com/, async (r) => {
    const u = r.request().url(); await sleep(delayFor(u)); net.tiles += 1;
    const ref = /_Reference/.test(u); const body = ref ? CLEAR : TILE; net.bytes += body.length;
    return r.fulfill({ status: 200, contentType: ref ? 'image/png' : 'image/jpeg', body, headers: { 'access-control-allow-origin': '*', 'cache-control': 'max-age=86400' } });
  });
  const p = await ctx.newPage(); await p.addInitScript(OBSERVER);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 80)));
  let cdp = null;
  if (ENGINE === 'chromium') { cdp = await ctx.newCDPSession(p); if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU }); if (PROFILE === 'slow4g') await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1e6) / 8, uploadThroughput: (0.75 * 1e6) / 8 }); }
  // install: open the app once so the service worker is registered and controlling
  await p.goto(`${BASE}/`, { waitUntil: 'load' }); await p.waitForTimeout(2500);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(2000);
  const controlled = await p.evaluate(() => Boolean(navigator.serviceWorker?.controller));
  const result = { controlled };
  const measure = async (label, open) => {
    net.tiles = 0; net.bytes = 0;
    await p.evaluate(() => window.__spMark()); await open();
    await p.waitForFunction(() => window.__sp?.t?.allTiles != null && window.__sp?.t?.routes != null, null, { timeout: 40000 }).catch(() => {});
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => ({ t: window.__sp.t, long: window.__sp.long, nTiles: document.querySelectorAll('img.leaflet-tile').length, res: performance.getEntriesByType('resource').filter((e) => e.name.includes('arcgisonline') && e.startTime >= window.__sp.t0).map((e) => [Math.round(e.responseEnd - e.startTime), e.transferSize]), dbg: window.__aeroMap ? { ...window.__aeroMap } : null }));
    const tbt = r.long.reduce((s, [, d]) => s + Math.max(0, d - 50), 0);
    result[label] = { ...Object.fromEntries(Object.entries(r.t).map(([k, v]) => [k, Math.round(v)])), tileReqs: REAL ? r.res.length : net.tiles, kb: Math.round((REAL ? r.res.reduce((x, y) => x + y[1], 0) : net.bytes) / 1024), tileMs: r.res.length ? Math.round(r.res.reduce((x, y) => x + y[0], 0) / r.res.length) : null, imgs: r.nTiles, long: r.long.length, tbt: Math.round(tbt), dbg: r.dbg };
  };
  const toMap = async () => { await p.evaluate(() => { history.pushState({}, '', '/map'); window.dispatchEvent(new PopStateEvent('popstate')); }); }; // client-side, like the tab bar link
  await measure('cold', async () => { await p.getByRole('link', { name: 'Map' }).first().click(); });
  await p.getByRole('link', { name: 'Home' }).first().click(); await p.waitForTimeout(1500);
  await measure('warm', async () => { await p.getByRole('link', { name: 'Map' }).first().click(); });
  await p.evaluate(() => { try { sessionStorage.setItem('__spAuto', '1'); } catch { /* ignore */ } });
  net.tiles = 0; net.bytes = 0;
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => window.__sp?.t?.allTiles != null && window.__sp?.t?.routes != null, null, { timeout: 40000 }).catch(() => {});
  await p.waitForTimeout(400);
  { const r = await p.evaluate(() => ({ t: window.__sp.t, long: window.__sp.long, nTiles: document.querySelectorAll('img.leaflet-tile').length, dbg: window.__aeroMap ? { ...window.__aeroMap } : null }));
    result.reload = { ...Object.fromEntries(Object.entries(r.t).map(([k, v]) => [k, Math.round(v)])), tileReqs: net.tiles, kb: Math.round(net.bytes / 1024), imgs: r.nTiles, long: r.long.length, tbt: Math.round(r.long.reduce((x, [, d]) => x + Math.max(0, d - 50), 0)), dbg: r.dbg }; }
  await p.evaluate(() => { try { sessionStorage.removeItem('__spAuto'); } catch { /* ignore */ } });
  void toMap;
  result.errors = errs.length;
  await browser.close();
  return result;
}

const all = []; for (let i = 0; i < RUNS; i++) all.push(await once());
const med = (xs) => { const a = xs.filter((v) => v != null).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
const rows = ['cold', 'warm', 'reload'].map((ph) => { const f = (k) => med(all.map((r) => r[ph]?.[k])); return { release: LABEL, engine: ENGINE, profile: PROFILE, cpu: CPU, phase: ph, container: f('container'), firstTile: f('firstTile'), routes: f('routes'), allTiles: f('allTiles'), tileReqs: f('tileReqs'), kb: f('kb'), tileMs: f('tileMs'), imgs: f('imgs'), tbt: f('tbt'), long: f('long') }; });
console.log(`controlled by the service worker: ${all.map((r) => r.controlled).join(', ')}   page errors: ${all.map((r) => r.errors).join(', ')}`);
console.table(rows.map(({ release, ...r }) => r));
const dbg = all[0].cold?.dbg; if (dbg) console.log('debug counters (cold):', JSON.stringify(dbg));
if (BUDGET) {
  const bad = [];
  for (const r of rows) {
    const b = B[r.phase];
    if (r.container == null) { bad.push(`${r.phase}: the Map never appeared`); continue; }
    for (const [k2, label] of [['container', 'map surface'], ['firstTile', 'first tile'], ['routes', 'routes drawn'], ['allTiles', 'all visible tiles']]) {
      if (r[k2] == null || r[k2] > b[k2]) bad.push(`${r.phase}: ${label} after ${r[k2]} ms (budget ${b[k2]})`);
    }
  }
  const cold = rows.find((r) => r.phase === 'cold');
  if (cold?.tileMs != null && cold.tileMs > B.tileMs) bad.push(`a tile takes ${cold.tileMs} ms on average from request to response end (budget ${B.tileMs}; the delay itself is about 450)`);
  const d = all[0].cold?.dbg;
  if (d && d.phMs > B.phTotal) bad.push(`placeholder check cost ${Math.round(d.phMs)} ms over ${d.phCount} tiles (budget ${B.phTotal})`);
  if (d && d.swTiles && d.swMs / d.swTiles > B.swKeep) bad.push(`service worker keeps a tile in ${Math.round(d.swMs / d.swTiles)} ms (budget ${B.swKeep}, in the background)`);
  if (all.some((r) => r.errors)) bad.push('page errors during load');
  console.log(bad.length ? `\nmap speed budget: ${bad.length} problem(s)\n  ${bad.join('\n  ')}` : '\nmap speed budget: within budget');
  process.exit(bad.length ? 1 : 0);
}
