// PRINT CHECK. The print summary (/logbook/print) and the public share page (/share/:token) must PRINT solid white with dark ink, no shadows, no blur or glass,
// and must be PILOT-ONLY. This drives a real browser in print media, prints each page to a real PDF (written to --out) and fails on:
//   - a page, article or text element whose print background is not white or near-white, or whose ink is not dark (contrast under 7:1 against white)
//   - any box-shadow, text-shadow or backdrop-filter on a visible element; any visible glass layer
//   - app chrome in print (tab bar, top bar, Add button, nav, buttons)
//   - a summary that counts or lists anything but pilot flights (the summary's flight count must equal the pilot flights in the API; no passenger flight id may appear)
// Read-only: it only loads pages and GETs the API. The share page needs a token: pass --token, or the script reads GET /api/share (the link must be on).
//
//   PLAYWRIGHT_CORE=<playwright-core folder> BROWSER_EXE=<chromium> node client/scripts/check-print.mjs [--base http://localhost:4173] [--api http://localhost:3001] [--out <folder>] [--token <t>]
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', process.env.BASE_URL || 'http://localhost:4173');
const API = arg('--api', process.env.API_URL || 'http://localhost:3001');
const OUT = arg('--out', '');
if (!process.env.PLAYWRIGHT_CORE || !process.env.BROWSER_EXE) { console.error('Set PLAYWRIGHT_CORE and BROWSER_EXE (see check-controls.mjs).'); process.exit(2); }
const { chromium } = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);

const get = async (p) => (await fetch(`${API}/api${p}`)).json();
const flights = await get('/flights');
const pilotIds = new Set(flights.filter((f) => f.role === 'pilot').map((f) => f.id));
const paxIds = new Set(flights.filter((f) => f.role === 'passenger').map((f) => f.id));
let token = arg('--token', '');
if (!token) { try { const s = await get('/share'); if (s && s.enabled && s.token) token = s.token; } catch { /* none */ } }

const pages = [['print summary', '/logbook/print'], ...(token ? [['public share', `/share/${token}`]] : [])];
const fails = []; const rows = [];
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXE });
if (OUT) fs.mkdirSync(OUT, { recursive: true });

// runs in the page, print media on
const audit = () => {
  const lum = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return { L: 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b), a }; };
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
  const out = { badBg: [], badInk: [], shadows: [], glass: [], chrome: [], lowest: 21 };
  const page = getComputedStyle(document.body).backgroundColor, root = getComputedStyle(document.documentElement).backgroundColor;
  for (const [n, c] of [['html', root], ['body', page]]) { const l = lum(c); if (l && l.a > 0.05 && l.L < 0.93) out.badBg.push(`${n} ${c}`); }
  const sc = document.querySelector('[data-print-surface], .sd') || document.body;
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    const bg = lum(cs.backgroundColor); if (bg && bg.a > 0.05 && bg.L < 0.88 && !el.matches('.bar, .bar > i')) /* a progress track and its fill are data marks, not surfaces */ out.badBg.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 24)} ${cs.backgroundColor}`);
    if (cs.boxShadow !== 'none') out.shadows.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 24)} box-shadow`);
    if (cs.textShadow !== 'none') out.shadows.push(`${el.tagName.toLowerCase()} text-shadow`);
    if ((cs.backdropFilter && cs.backdropFilter !== 'none') || (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== 'none')) out.glass.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 24)} backdrop-filter`);
    if (el.matches('.ds-glass, .ds-tabbar, .ds-topbar, .ds-fab, nav, button, [role="tablist"]')) out.chrome.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)}`);
    if (sc.contains(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
      const ink = lum(cs.color); if (ink) { const ratio = 1.05 / (ink.L + 0.05); out.lowest = Math.min(out.lowest, ratio); if (ratio < 7) out.badInk.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 24)} ${cs.color} (${ratio.toFixed(1)}:1)`); }
    }
  }
  const text = (sc.innerText || '');
  const m = text.match(/(\d+) flights?/);
  out.flightCount = m ? Number(m[1]) : null;
  return out;
};

for (const [name, route] of pages) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 1200 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(`${BASE}${route}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  const screenBg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await p.emulateMedia({ media: 'print' });
  await p.waitForTimeout(700);
  const a = await p.evaluate(audit);
  if (OUT) await p.pdf({ path: path.join(OUT, `${name.replace(/ /g, '-')}.pdf`), format: 'Letter', printBackground: true, margin: { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' } });
  // pilot-only: the summary's flight count against the API, and no passenger flight id in the page's links or text
  const apiSummary = route.startsWith('/share') ? await (await fetch(`${API}/api/public/${token}`)).json() : await get('/share/summary?limit=25');
  const listed = (apiSummary.recent || []).map((f) => f.id);
  const paxListed = listed.filter((id) => paxIds.has(id));
  const bad = (m) => fails.push(`${name}: ${m}`);
  if (a.badBg.length) bad(`not white in print: ${a.badBg.slice(0, 3).join('; ')}`);
  if (a.badInk.length) bad(`ink not dark: ${a.badInk.slice(0, 3).join('; ')}`);
  if (a.shadows.length) bad(`shadows: ${a.shadows.slice(0, 3).join('; ')}`);
  if (a.glass.length) bad(`glass or blur: ${a.glass.slice(0, 3).join('; ')}`);
  if (a.chrome.length) bad(`app chrome visible in print: ${a.chrome.slice(0, 3).join('; ')}`);
  if (a.flightCount !== apiSummary.totals.flights) bad(`page says ${a.flightCount} flights, the summary says ${apiSummary.totals.flights}`);
  if (apiSummary.totals.flights !== pilotIds.size) bad(`the summary counts ${apiSummary.totals.flights} flights but the API has ${pilotIds.size} pilot flights`);
  if (paxListed.length) bad(`passenger flights listed: ${paxListed.join(', ')}`);
  rows.push({ page: name, 'screen bg': screenBg, 'print bg': 'white', 'lowest ink contrast': `${a.lowest.toFixed(1)}:1`, shadows: a.shadows.length, glass: a.glass.length, chrome: a.chrome.length, 'flights (page / summary / pilot in API)': `${a.flightCount} / ${apiSummary.totals.flights} / ${pilotIds.size}`, 'passenger listed': paxListed.length, result: fails.some((f) => f.startsWith(name)) ? 'FAIL' : 'pass' });
  await ctx.close();
}
await browser.close();
if (!token) console.log('(no public share link is on in this API: only the print summary was checked)');
console.table(rows);
console.log(fails.length ? `\n${fails.length} print failure(s):\n - ${fails.join('\n - ')}` : '\nPrint pages are solid white with dark ink, no shadows or glass, and pilot-only.');
process.exit(fails.length ? 1 : 0);
