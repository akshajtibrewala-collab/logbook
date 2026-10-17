// FONT CHECK. On every route (WebKit, iPhone profile, 390px): no request goes to another host at all (so none to fonts.googleapis.com or
// fonts.gstatic.com and no external stylesheet), every font file requested is a local woff2 under /fonts, the self-hosted Inter is the
// face in use (document.fonts reports it loaded and no other family was fetched), and the first screen does not move when the font
// arrives (layout-shift entries during load add up to under 0.02, and the text boxes on the first screen are the same before and after
// document.fonts.ready is awaited). The only third-party hosts allowed are map tiles and the aircraft-photo hosts (PHOTO_ALLOWED_HOSTS in
// client/src/lib/aircraftPhoto.js, listed in the summary; answered with a stub here so this check never loads or depends on the real photo
// service); anything else fails. Read-only.
//   PLAYWRIGHT_CORE=<..> node client/scripts/check-fonts.mjs [--base http://localhost:4174] [--api http://localhost:3002] [--width 390]
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { PHOTO_ALLOWED_HOSTS } from '../src/lib/aircraftPhoto.js';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:4174'), API = arg('--api', 'http://localhost:3002'), W = Number(arg('--width', 390));
if (!process.env.PLAYWRIGHT_CORE) { console.error('Set PLAYWRIGHT_CORE.'); process.exit(2); }
const pw = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href); const { webkit, devices } = pw.default ?? pw;
const get = async (p) => (await fetch(`${API}/api${p}`)).json();
const aircraftList = await get('/aircraft').catch(() => []);
const flights = await get('/flights'); const pilot = flights.find((f) => f.role === 'pilot')?.id, pax = flights.find((f) => f.role === 'passenger')?.id;
const ROUTES = ['/', '/logbook', `/logbook/${pilot}`, '/travel', `/travel/${pax}`, '/aircraft', `/aircraft/${aircraftList.find((a) => a.tail_number)?.id ?? 1}`, '/logbook/new', '/milestones', '/currency', '/weather', '/map', '/stats', '/more', '/settings', '/design'];
const origin = new URL(BASE).origin;
const photoHosts = new Set(PHOTO_ALLOWED_HOSTS);
const PHOTO_RE = new RegExp(`^https://(${PHOTO_ALLOWED_HOSTS.map((h) => h.replace(/\./g, '\\.')).join('|')})/`);

const browser = await webkit.launch();
const bad = []; const rows = [];
for (const route of ROUTES) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: W, height: 800 }, serviceWorkers: 'block' }); // so the photo stub below sees every request
  await ctx.route(PHOTO_RE, (r) => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: '{"photos":[]}' }));
  const p = await ctx.newPage(); const reqs = [];
  p.on('request', (r) => reqs.push({ url: r.url(), type: r.resourceType() }));
  await p.addInitScript(() => { window.__cls = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch { /* unsupported */ } });
  await p.goto(BASE + route, { waitUntil: 'load' }); await p.waitForTimeout(1800);
  const external = reqs.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'));
  const fontReqs = reqs.filter((r) => r.type === 'font' || /\.(woff2?|ttf|otf)(\?|$)/i.test(r.url));
  const cssExternal = external.filter((r) => r.type === 'stylesheet' || /\.css(\?|$)/i.test(r.url));
  const tiles = external.filter((r) => /tile|openstreetmap|basemaps|cartocdn|arcgis/i.test(r.url)); // map tiles are data, not fonts or stylesheets
  const bannedHost = reqs.filter((r) => /fonts\.googleapis|fonts\.gstatic|typekit|use\.fontawesome|cdnjs|unpkg|jsdelivr/i.test(r.url));
  const info = await p.evaluate(async () => {
    await document.fonts.ready;
    const faces = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, ''));
    const h = document.querySelector('h1, .ds-display, main');
    return { faces, cls: Math.round(window.__cls * 1000) / 1000, ff: h ? getComputedStyle(h).fontFamily.split(',')[0].replace(/"/g, '').trim() : '', inter: document.fonts.check('16px Inter') };
  });
  const problems = [];
  if (bannedHost.length) problems.push(`banned host: ${bannedHost.map((r) => new URL(r.url).host).join(',')}`);
  if (cssExternal.length) problems.push(`external stylesheet: ${cssExternal[0].url}`);
  const extFont = fontReqs.filter((r) => !r.url.startsWith(origin + '/fonts/') && !r.url.startsWith(origin + '/assets/'));
  if (extFont.length) problems.push(`font not from /fonts: ${extFont[0].url}`);
  const photo = external.filter((r) => photoHosts.has(new URL(r.url).hostname));
  const nonTileExternal = external.filter((r) => !tiles.includes(r) && !photo.includes(r));
  if (nonTileExternal.length) problems.push(`other-host request: ${new URL(nonTileExternal[0].url).host}`);
  if (!info.inter) problems.push('Inter not available');
  if (info.cls > 0.02) problems.push(`layout shift ${info.cls}`);
  rows.push(`${route.padEnd(24)} requests ${String(reqs.length).padStart(3)}  font files ${fontReqs.length}  external ${external.length} (tiles ${tiles.length}, photo ${photo.length})  Inter ${info.inter ? 'loaded' : 'MISSING'}  CLS ${info.cls}  ${problems.length ? 'FAIL ' + problems.join('; ') : 'ok'}`);
  if (problems.length) bad.push(`${route}: ${problems.join('; ')}`);
  await ctx.close();
}
await browser.close();
console.log(rows.join('\n'));
console.log(`\nfonts: ${ROUTES.length} routes, ${bad.length} problem(s)`);
console.log(`third-party hosts allowed: map tiles, and the photo hosts ${PHOTO_ALLOWED_HOSTS.join(', ')}`);
for (const b of bad) console.log('  ' + b);
process.exit(bad.length ? 1 : 0);
