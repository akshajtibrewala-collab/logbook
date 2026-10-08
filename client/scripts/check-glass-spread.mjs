// Regression guard for glass over a busy backdrop: on the Map, every glass element (rail, top bar, tab bar) must stay under a colour-spread
// limit, measured on REAL rendered pixels with the labels hidden (so only the glass over the map is measured). Over a black page the same
// elements are measured as the calm reference. Read-only: drives a running production build and never writes.
//   metrics per element (over its pixels): meanChroma, chromaStd (std of (max-min)/255), hueSpread (circular std of hue in degrees over the
//   coloured pixels) and p95 luminance. A mottled panel has a high chromaStd and hueSpread; the neutral busy state has neither.
// Usage: PLAYWRIGHT_CORE=<playwright-core folder> BROWSER_EXE=<chromium> node client/scripts/check-glass-spread.mjs
//          [--base http://localhost:4173] [--emulate-before] [--out <folder for before/after crops>]
// --emulate-before re-applies the pre-fix glass (no busy state: 6px blur, saturation 1.9, 70% tint) so the same script can print "before".
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', process.env.BASE_URL || 'http://localhost:4173');
const OUT = arg('--out', '');
const BEFORE = process.argv.includes('--emulate-before');
if (!process.env.PLAYWRIGHT_CORE || !process.env.BROWSER_EXE) { console.error('Set PLAYWRIGHT_CORE and BROWSER_EXE (see check-controls.mjs).'); process.exit(2); }
const { chromium } = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);

// Limits (the neutral busy state measures well under these; the old saturated glass measured well over them; see docs/design/GLASS_BUSY.md).
const LIMITS = { chromaStd: 0.012, meanChroma: 0.02, hueSpread: 8, p95Lum: 0.03, minTextContrast: 7 };
const WIDTHS = [[390, 844], [1440, 900], [2560, 1300]];

const OLD_GLASS = `.ds-glass[data-busy] > .g-scrim{background:var(--ds-g-tint-hi)!important}
.ds-glass[data-busy] > .g-core{-webkit-backdrop-filter:blur(var(--ds-g-blur)) saturate(var(--ds-g-sat)) brightness(var(--ds-g-bri))!important;backdrop-filter:blur(var(--ds-g-blur)) saturate(var(--ds-g-sat)) brightness(var(--ds-g-bri))!important}
.ds-glass[data-busy] > .g-lens{-webkit-backdrop-filter:blur(1px) saturate(2.1) brightness(1.2)!important;backdrop-filter:blur(1px) saturate(2.1) brightness(1.2)!important}`;
const HIDE_LABELS = `.ds-glass > .g-in, .ds-fab{visibility:hidden!important}`;

const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXE });
const analyzer = await (await browser.newContext()).newPage();
const analyze = (b64) => analyzer.evaluate(async (data) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data; const n = d.length / 4;
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  let cs = 0, cs2 = 0, sx = 0, sy = 0, nc = 0; const lums = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), ch = (mx - mn) / 255;
    cs += ch; cs2 += ch * ch; lums[i] = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    if (ch >= 0.04) { const dd = mx - mn; const h = (mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4) * 60 * Math.PI / 180; sx += Math.cos(h); sy += Math.sin(h); nc++; }
  }
  const mean = cs / n, std = Math.sqrt(Math.max(0, cs2 / n - mean * mean));
  const R = nc ? Math.hypot(sx, sy) / nc : 1; const hue = nc > 1 ? Math.sqrt(-2 * Math.log(Math.min(1, R))) * 180 / Math.PI : 0;
  lums.sort(); return { meanChroma: mean, chromaStd: std, hueSpread: hue, p95Lum: lums[Math.floor(n * 0.95)] };
}, b64);

// The sandbox this runs in often has no internet, so the basemap tiles are stood in by synthetic grayscale tiles (dark sea, lighter land,
// coastline strokes, small bright label specks) in the style of the dark-gray basemap; the routes and markers drawn over them are the app's real ones.
const tileCache = new Map();
const makeTile = (key) => {
  if (tileCache.has(key)) return tileCache.get(key);
  const p = analyzer.evaluate(async (k) => {
    let a = 0; for (const ch of k) a = (a * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = 'rgb(24,25,27)'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5; i++) { x.fillStyle = `rgb(${46 + rnd() * 14},${47 + rnd() * 14},${50 + rnd() * 14})`; x.beginPath(); x.moveTo(rnd() * 256, rnd() * 256); for (let j = 0; j < 7; j++) x.lineTo(rnd() * 256, rnd() * 256); x.closePath(); x.fill(); }
    x.strokeStyle = 'rgb(88,90,96)'; x.lineWidth = 1; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(rnd() * 256, rnd() * 256); x.lineTo(rnd() * 256, rnd() * 256); x.stroke(); }
    x.fillStyle = 'rgb(170,172,178)'; for (let i = 0; i < 30; i++) x.fillRect(rnd() * 250, rnd() * 250, 6 + rnd() * 18, 3);
    return c.toDataURL('image/png').split(',')[1];
  }, key).then((b64) => Buffer.from(b64, 'base64'));
  tileCache.set(key, p); return p;
};
// Worst case for the glass: a route-dense map. Sky and violet route lines, airport dots and bright label specks are laid across the whole
// viewport inside the map container, under every glass element (the app's own routes only cover the places you have flown).
const FIXTURE = `(() => { const c = document.querySelector('.leaflet-container'); if (!c) return; const W = innerWidth, H = innerHeight; let s = '';
  const cols = ['rgb(91,185,255)', 'rgb(183,160,255)', 'rgb(91,185,255)']; let a = 7; const r = () => (a = (a * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 70; i++) { const x1 = r() * W, y1 = r() * H, x2 = r() * W, y2 = r() * H; s += '<path d="M' + x1 + ' ' + y1 + ' Q' + ((x1 + x2) / 2 + (r() - .5) * 120) + ' ' + ((y1 + y2) / 2 - 60) + ' ' + x2 + ' ' + y2 + '" stroke="' + cols[i % 3] + '" stroke-width="' + (1 + r() * 1.5) + '" fill="none" opacity=".9"/>'; }
  for (let i = 0; i < 160; i++) s += '<circle cx="' + r() * W + '" cy="' + r() * H + '" r="' + (2 + r() * 2) + '" fill="rgb(245,245,247)"/>';
  const d = document.createElement('div'); d.setAttribute('data-test-fixture', ''); d.style.cssText = 'position:absolute;inset:0;z-index:450;pointer-events:none';
  d.innerHTML = '<svg width="' + W + '" height="' + H + '" style="position:absolute;inset:0">' + s + '</svg>'; c.appendChild(d); })()`;
const rows = []; let failed = 0;
for (const [w, h] of WIDTHS) {
  // 'logbook' and 'home' are scrolled so the big numeral, the thin line and the controls pass UNDER the top bar: bright and saturated content must not ghost through it
  for (const [label, route, scrollY] of [['map', '/map'], ['black', '/more'], ['logbook', '/logbook', 150], ['home', '/', 150]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.route(/arcgisonline|basemaps\.cartocdn|tile\.openstreetmap/, async (route) => route.fulfill({ contentType: 'image/png', body: await makeTile(route.request().url()) }));
    const page = await ctx.newPage();
    await page.goto(BASE + route, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(label === 'map' ? 4500 : 1500); // tiles, then the throttled sampler
    if (label === 'map') { await page.evaluate(FIXTURE); await page.waitForTimeout(1200); }
    if (scrollY) { await page.evaluate((y) => window.scrollTo(0, y), scrollY); await page.waitForTimeout(900); }
    if (BEFORE) await page.addStyleTag({ content: OLD_GLASS });
    const els = await page.evaluate(() => [...document.querySelectorAll('.ds-glass')].map((e) => { const r = e.getBoundingClientRect(); const cls = e.className.toString(); return { name: /tabbar/.test(cls) ? (r.width > r.height ? 'tab bar' : 'rail') : /topbar/.test(cls) ? 'top bar' : cls.split(' ').filter((c) => c.startsWith('ds-'))[1] || 'glass', x: r.left, y: r.top, w: r.width, h: r.height, busy: e.hasAttribute('data-busy'), hi: e.getAttribute('data-bk'), vis: getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).opacity !== '0' }; }).filter((e) => e.vis && e.w > 40 && e.h > 30 && e.y + e.h > 0 && e.y < innerHeight));
    if (OUT && label === 'map') { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: path.join(OUT, `${BEFORE ? 'before' : 'after'}-map-${w}-full.png`) }); }
    await page.addStyleTag({ content: HIDE_LABELS });
    await page.waitForTimeout(300);
    for (const e of els) {
      const clip = { x: Math.max(0, e.x + 6), y: Math.max(0, e.y + 6), width: Math.max(8, e.w - 12), height: Math.max(8, e.h - 12) };
      const buf = await page.screenshot({ clip });
      const m = await analyze(buf.toString('base64'));
      if (OUT) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, `${BEFORE ? 'before' : 'after'}-${label}-${w}-${e.name.replace(' ', '')}.png`), buf); }
      const textContrast = (0.84 + 0.05) / (m.p95Lum + 0.05); // the glass's secondary text (#ededf0, luminance about 0.84) over the brightest 5% of the backdrop
      const over = label !== 'black' && (textContrast < LIMITS.minTextContrast || m.chromaStd > LIMITS.chromaStd || m.meanChroma > LIMITS.meanChroma || m.hueSpread > LIMITS.hueSpread || m.p95Lum > LIMITS.p95Lum);
      if (over && !BEFORE) failed++;
      rows.push(`${String(w).padStart(4)}px ${label.padEnd(5)} ${e.name.padEnd(8)} busy=${e.busy ? 'y' : 'n'} chromaStd=${m.chromaStd.toFixed(3)} meanChroma=${m.meanChroma.toFixed(3)} hueSpread=${m.hueSpread.toFixed(0).padStart(3)}deg p95Lum=${m.p95Lum.toFixed(3)} textContrast=${textContrast.toFixed(1)}:1${over ? '  OVER LIMIT' : ''}`);
    }
    await page.context().close();
  }
}
console.log(`${BEFORE ? 'BEFORE (emulated pre-fix glass)' : 'AFTER'}  limits: chromaStd<=${LIMITS.chromaStd} meanChroma<=${LIMITS.meanChroma} hueSpread<=${LIMITS.hueSpread}deg p95Lum<=${LIMITS.p95Lum} text contrast>=${LIMITS.minTextContrast}:1 (map rows only)`);
rows.forEach((r) => console.log(r));
await browser.close();
if (failed) { console.log(`FAIL: ${failed} glass element(s) over the colour-spread limit on the Map`); process.exit(1); }
console.log(BEFORE ? 'done' : 'OK: glass over the Map stays under the colour-spread limit');
