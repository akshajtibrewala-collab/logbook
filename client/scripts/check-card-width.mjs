// CARD WIDTH CONSISTENCY (read-only). Inside every card (.mn-card) the rows must span the card's inner width and line up with each other:
//   1. every key/value row, disclosure row and opened block equals the card's inner width (within 1px);
//   2. every key/value label and every disclosure label in one card starts at the same x, and every value and disclosure value/chevron ends at
//      the same x (a disclosure used to be inset 8px further in and, on a phone, a further Add-button clearance on its right, so "All times",
//      "Landings and approaches", "Cost" and "Local times" looked narrower than the card they sit in).
// Run across the device matrix (client/scripts/lib/devices.mjs) and text scales. Opens every disclosure so opened blocks are measured too.
//
//   PLAYWRIGHT_CORE=<playwright-core folder> BROWSER_EXE=<chrome.exe for the Android profiles> \
//     node client/scripts/check-card-width.mjs [--base http://localhost:4174] [--matrix quick|full] [--only "phone 390,ipad 820"] [--text 100,130,200]
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { openContext, launchBrowsers, pickProfile } from './lib/devices.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:4174');
const MATRIX = arg('--matrix', 'quick');
const TEXTS = arg('--text', '100,200').split(',').map(Number);
const TOL = 1;
if (!process.env.PLAYWRIGHT_CORE) { console.error('Set PLAYWRIGHT_CORE (and BROWSER_EXE for Android profiles).'); process.exit(2); }
const pw = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);
const profiles = pickProfile(MATRIX, arg('--only', ''));
const browsers = await launchBrowsers(pw, { chromiumExe: process.env.BROWSER_EXE, need: [...new Set(profiles.map((d) => d.engine))] });

// Pick the richest and the barest pilot and passenger flight, plus a ground session and an aircraft, from the API behind BASE.
const probeCtx = await browsers.webkit.newContext();
const probe = await probeCtx.newPage();
await probe.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
const ids = await probe.evaluate(async () => {
  const j = async (u) => (await fetch(u)).json();
  const [f, g, a] = await Promise.all([j('/api/flights'), j('/api/costs/ground-sessions'), j('/api/aircraft')]);
  const weight = (x) => Object.values(x).filter((v) => v !== null && v !== '' && v !== 0).length;
  const by = (role) => f.filter((x) => x.role === role).sort((p, q) => weight(q) - weight(p));
  const pilot = by('pilot'), pax = by('passenger');
  return { pilotRich: pilot[0]?.id, pilotBare: pilot.at(-1)?.id, paxRich: pax[0]?.id, paxBare: pax.at(-1)?.id, ground: g[0]?.id, aircraft: a[0]?.id };
});
await probeCtx.close();

const ROUTES = [
  `/logbook/${ids.pilotRich}`, `/logbook/${ids.pilotBare}`, `/travel/${ids.paxRich}`, `/travel/${ids.paxBare}`, `/logbook/ground/${ids.ground}`, `/aircraft/${ids.aircraft}`,
  '/', '/logbook', '/travel', '/milestones', '/currency', '/weather', '/costs', '/costs/spending', '/costs/phases', '/costs/expenses', '/costs/projection', '/stats', '/more', '/settings', '/aircraft', '/logbook/data',
];

const measure = () => {
  const out = [];
  document.querySelectorAll('.mn-card').forEach((card, ci) => {
    const cs = getComputedStyle(card), cr = card.getBoundingClientRect();
    if (cr.width === 0) return;
    const innerL = cr.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
    const innerR = cr.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
    const rows = [...card.querySelectorAll(':scope > .mn-kv, :scope > .mn-fold, :scope > .mn-open')];
    const lefts = [], rights = [];
    for (const row of rows) {
      const r = row.getBoundingClientRect();
      if (r.width === 0) continue;
      const kind = row.classList.contains('mn-kv') ? 'row' : row.classList.contains('mn-fold') ? 'fold' : 'open';
      out.push({ ci, kind, label: (row.textContent || '').trim().slice(0, 24), widthOff: Math.round((r.width - (innerR - innerL)) * 10) / 10, leftOff: Math.round((r.left - innerL) * 10) / 10 });
      if (kind === 'row') {
        const k = row.querySelector('.k'), v = row.querySelector('.v');
        if (k && v) { lefts.push(k.getBoundingClientRect().left); rights.push(v.getBoundingClientRect().right); }
      } else if (kind === 'fold') {
        const k = row.querySelector(':scope > span:first-child'), v = row.querySelector('.r');
        if (k && v) { lefts.push(k.getBoundingClientRect().left); rights.push(v.getBoundingClientRect().right); }
      }
    }
    if (lefts.length > 1) {
      out.push({ ci, kind: 'align', label: 'labels and values', leftSpread: Math.round((Math.max(...lefts) - Math.min(...lefts)) * 10) / 10, rightSpread: Math.round((Math.max(...rights) - Math.min(...rights)) * 10) / 10 });
    }
  });
  return out;
};

const rows = [];
const t0 = Date.now();
for (const d of profiles) for (const TEXT of TEXTS) {
  const ctx = await openContext(browsers, d);
  await ctx.addInitScript((t) => { const set = () => { if (document.documentElement) document.documentElement.style.fontSize = `${t}%`; }; set(); document.addEventListener('DOMContentLoaded', set); }, TEXT); // the text size applies at load, as a real text-size setting does (changing the root size under a live WebKit page can leave rem-based custom properties stale)
  const page = await ctx.newPage();
  await page.route(/planespotters|plnspttrs|arcgisonline|cartocdn|tile\.openstreetmap/, (r) => r.abort());
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.mn-card, .mn-empty, h1', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(350);
    for (const text of [TEXT]) {
      await page.evaluate((t) => { document.documentElement.style.fontSize = `${t}%`; }, text);
      // open every disclosure (a click on each, inside the page, so a re-render cannot leave a stale handle)
      await page.evaluate(() => document.querySelectorAll('button.mn-fold[aria-expanded="false"]').forEach((b) => b.click()));
      await page.waitForTimeout(250);
      const m = await page.evaluate(measure);
      const bad = m.filter((x) => (x.kind === 'align' ? x.leftSpread > TOL || x.rightSpread > TOL : Math.abs(x.widthOff) > TOL || Math.abs(x.leftOff) > TOL));
      rows.push({ device: d.name, route: route.replace(/\/\d+/g, '/:id'), text, cards: new Set(m.map((x) => x.ci)).size, checks: m.length, bad });
    }
  }
  await ctx.close();
}
for (const b of Object.values(browsers)) await b.close();

const fails = rows.filter((r) => r.bad.length);
const seen = new Set();
for (const f of fails) {
  for (const b of f.bad) {
    const key = `${f.device}|${f.route}|${b.kind}|${b.label}`;
    if (seen.has(key) || seen.size > 40) continue;
    seen.add(key);
    console.log(`FAIL ${f.device} ${f.route} text ${f.text}%: ${b.kind} "${b.label}" ${b.kind === 'align' ? `label edges differ by ${b.leftSpread}px, value edges by ${b.rightSpread}px` : `width off by ${b.widthOff}px, left off by ${b.leftOff}px`}`);
  }
}
const total = rows.reduce((n, r) => n + r.checks, 0);
console.log(`Card width: ${rows.length} page runs, ${total} row measurements, ${fails.length} page runs with a row that does not span or align (${profiles.length} devices, text ${TEXTS.join('/')}%) in ${Math.round((Date.now() - t0) / 1000)} s. ${BASE}`);
process.exit(fails.length ? 1 : 0);
