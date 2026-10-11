// MAP ZOOM REGRESSION CHECK (read-only; no real network: every tile request is answered locally with generated PNG tiles).
// Zooms the Map in and out through every level it allows (double-click and shift double-click, mouse wheel, and in Chromium a CDP pinch), at 390 and
// 1440px, in WebKit (iPhone profile for 390) and Chromium, with three tile servers:
//   ok            every tile exists (dark canvas tiles with a visible grid)
//   placeholder   from --placeholder-z (default 13) up, the provider answers with its light-gray "Map data not yet available" tile, as Esri does over open
//                 ocean from zoom 13 and everywhere from zoom 17
//   failing       from --fail-z (default 13) up the tile requests are refused; and "dead": every tile request fails (offline / blocked)
// After every step it asserts: the map container is never light (it is the dark surface), the share of near-white pixels in the map area stays small
// (an unloaded or placeholder tile must never read as a white map), the tile images present are the right size, and no page error fired. In "dead" mode
// the calm note must be on screen and the pins/routes layer must still exist. The debug panel (?debug=1) on the Map must show the zoom and tile counters.
//   PLAYWRIGHT_CORE=<..> node client/scripts/check-map-zoom.mjs [--base http://localhost:4174] [--engines webkit,chromium] [--legacy] [--detail 30]
//   --legacy: the release before this check existed (no calm note, no debug counters): only the white and size assertions apply.
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:4174');
const ENGINES = arg('--engines', 'webkit,chromium').split(',');
const LEGACY = process.argv.includes('--legacy');
const PLACEHOLDER_Z = Number(arg('--placeholder-z', 13)), FAIL_Z = Number(arg('--fail-z', 13)), DETAIL = Number(arg('--detail', 30));
if (!process.env.PLAYWRIGHT_CORE) { console.error('Set PLAYWRIGHT_CORE.'); process.exit(2); }
const pw = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href); const { webkit, chromium, devices } = pw.default ?? pw;

const png = new Map();
const tilePng = async (kind) => {
  if (png.has(kind)) return png.get(kind);
  const px = Buffer.alloc(256 * 256 * 3);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const o = (y * 256 + x) * 3; let v = kind === 'placeholder' ? 200 : 38; // dark canvas vs the provider's light-gray placeholder
    if (kind === 'ok' && (x % 64 === 0 || y % 64 === 0)) v = 70; // a faint grid so a blank pane is distinguishable from a loaded one
    px[o] = px[o + 1] = px[o + 2] = v;
  }
  const b = kind === 'clear'
    ? await sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer()
    : await sharp(px, { raw: { width: 256, height: 256, channels: 3 } }).png().toBuffer();
  png.set(kind, b); return b;
};

async function route(ctx, mode) {
  await ctx.route(/server\.arcgisonline\.com/, async (r) => {
    const z = Number((/\/tile\/(\d+)\//.exec(r.request().url()) || [])[1]);
    if (mode === 'dead') return r.abort('failed');
    if (/_Reference/.test(r.request().url()) && !(mode === 'failing' && z >= FAIL_Z)) return r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: await tilePng('clear') }); // the label layer is transparent
    if (mode === 'failing' && z >= FAIL_Z) return r.abort('failed');
    const kind = mode === 'placeholder' && z >= PLACEHOLDER_Z ? 'placeholder' : 'ok';
    return r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: await tilePng(kind) });
  });
}

const STATE = () => {
  const c = document.querySelector('.leaflet-container'); if (!c) return null;
  const rgb = /rgba?\((\d+), (\d+), (\d+)/.exec(getComputedStyle(c).backgroundColor) || [0, 0, 0, 0];
  const lum = (0.2126 * rgb[1] + 0.7152 * rgb[2] + 0.0722 * rgb[3]) / 255;
  const tiles = [...document.querySelectorAll('.leaflet-tile-pane img.leaflet-tile')];
  const z = tiles.map((t) => Number((/\/tile\/(\d+)\//.exec(t.src) || [])[1])).filter(Number.isFinite);
  const badSize = tiles.filter((t) => t.complete && t.naturalWidth > 0 && (t.width < 100 || t.width > 600)).length;
  const note = document.querySelector('.ds-map-note')?.textContent.trim() || '';
  return { bgLum: Math.round(lum * 100) / 100, tiles: tiles.length, loaded: tiles.filter((t) => t.complete && t.naturalWidth > 0).length, z: z.length ? Math.max(...z) : null, badSize, note, pins: document.querySelectorAll('.leaflet-overlay-pane path, .leaflet-marker-pane > *').length };
};

async function whiteShare(page, vh) {
  const buf = await page.screenshot({ clip: { x: 0, y: 150, width: page.viewportSize().width, height: Math.max(100, vh - 300) } });
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  let n = 0; const ch = info.channels; for (let i = 0; i < data.length; i += ch) if (data[i] > 170 && data[i + 1] > 170 && data[i + 2] > 170) n++;
  return n / (data.length / ch);
}

const problems = []; let steps = 0;
const rows = [];
for (const engine of ENGINES) {
  const browser = await (engine === 'webkit' ? webkit : chromium).launch();
  for (const [w, h] of [[390, 844], [1440, 900]]) for (const mode of ['ok', 'placeholder', 'failing', 'dead']) {
    const dev = w < 700 ? (engine === 'webkit' ? devices['iPhone 13'] : devices['Pixel 5']) : {};
    const ctx = await browser.newContext({ ...dev, viewport: { width: w, height: h }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    await route(ctx, mode);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 100)));
    const tag = `${engine} ${w}px ${mode}`; const bad = (what) => problems.push(`${tag}: ${what}`);
    await p.goto(`${BASE}/map${LEGACY ? '' : '?debug=1'}`, { waitUntil: 'load' }); await p.waitForTimeout(2500);
    const box = await p.locator('.leaflet-container').boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2 + 40;
    let worst = 0, maxZ = 0, lastNote = '';
    const check = async (label) => {
      steps++;
      await p.waitForTimeout(650);
      const s = await p.evaluate(STATE); if (!s) { bad(`${label}: no map`); return; }
      const wsh = await whiteShare(p, h); worst = Math.max(worst, wsh); if (s.z) maxZ = Math.max(maxZ, s.z); lastNote = s.note || lastNote;
      if (s.bgLum > 0.35) bad(`${label}: the map container is light (luminance ${s.bgLum})`);
      if (wsh > 0.05) bad(`${label}: ${Math.round(wsh * 100)}% of the map is near-white (tile z ${s.z})`);
      if (s.badSize) bad(`${label}: ${s.badSize} tile image(s) with the wrong size`);
      if (mode !== 'dead' && s.loaded === 0 && s.tiles > 0 && mode === 'ok') bad(`${label}: no tile loaded (tile z ${s.z})`);
    };
    await check('load');
    for (let i = 1; i <= 26; i++) { await p.mouse.dblclick(cx, cy); await check(`dblclick ${i}`); }
    await p.keyboard.down('Shift'); for (let i = 1; i <= 6; i++) { await p.mouse.dblclick(cx, cy); await check(`shift-dblclick ${i}`); } await p.keyboard.up('Shift');
    // a wheel gesture as a DOM event (mobile WebKit has no mouse wheel; Leaflet only listens for the event)
    const wheel = (dy) => p.evaluate(([x, y, d]) => { document.querySelector('.leaflet-container').dispatchEvent(new WheelEvent('wheel', { deltaY: d, clientX: x, clientY: y, bubbles: true, cancelable: true })); }, [cx, cy, dy]);
    for (let i = 1; i <= 5; i++) { await wheel(-500); await check(`wheel in ${i}`); }
    for (let i = 1; i <= 3; i++) { await wheel(600); await check(`wheel out ${i}`); }
    if (engine === 'chromium') { // a real two-finger pinch through the DevTools protocol
      const cdp = await ctx.newCDPSession(p);
      for (let i = 1; i <= 3; i++) { await cdp.send('Input.synthesizePinchGesture', { x: cx, y: cy, scaleFactor: 2.2, relativeSpeed: 400 }).catch(() => {}); await check(`pinch in ${i}`); }
      for (let i = 1; i <= 2; i++) { await cdp.send('Input.synthesizePinchGesture', { x: cx, y: cy, scaleFactor: 0.5, relativeSpeed: 400 }).catch(() => {}); await check(`pinch out ${i}`); }
    }
    if (!LEGACY) {
      await p.locator('.dbg-h button').first().click().catch(() => {}); await p.waitForTimeout(300); // the panel is one line until opened
      const dbg = await p.evaluate(() => document.querySelector('.dbg')?.textContent || '');
      if (!/zoom/i.test(dbg) || !/tiles/i.test(dbg)) bad('the debug panel shows no map zoom / tile counters on the Map');
      if (mode === 'dead') { const s = await p.evaluate(STATE); if (!(s.note || lastNote)) bad('every tile failed but no calm note is shown'); if (!s.pins) bad('every tile failed and the routes and pins disappeared'); }
      if (mode === 'ok') { const s = await p.evaluate(STATE); if (/tiles/i.test(s.note)) bad('a calm failure note shows although every tile loads'); }
      if (mode === 'ok' && lastNote) bad('a calm failure note appeared although every tile loads');
      if ((mode === 'placeholder' || mode === 'failing') && !lastNote) bad(`${mode}: no calm note was shown at any zoom`);
    }
    if (errs.length) bad(`page error: ${errs[0]}`);
    rows.push(`${tag.padEnd(26)} max tile z ${String(maxZ).padStart(2)}  worst near-white share ${(worst * 100).toFixed(1)}%  note ${lastNote ? 'yes' : 'no'}`);
    await ctx.close();
  }
  await browser.close();
}
console.log(rows.join('\n'));
console.log(`\nmap zoom: ${steps} steps, ${problems.length} problem(s)`);
const seen = new Set(); let shown = 0;
for (const pr of problems) { const k = pr.replace(/\d+%|\d+(\.\d+)? /g, '#'); if (seen.has(k)) continue; seen.add(k); if (shown++ < DETAIL) console.log('  ' + pr); }
if (seen.size > DETAIL) console.log(`  ... and ${seen.size - DETAIL} more distinct problems`);
process.exit(problems.length ? 1 : 0);
