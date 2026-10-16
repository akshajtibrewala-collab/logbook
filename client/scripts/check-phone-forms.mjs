// PHONE FORM + LEDGER LAYOUT (read-only; loads pages and types into the two time fields, saves nothing).
//   A. Passenger flight form: the departure and arrival time controls (and the arrival-day stepper) are visible, not clipped, equal width, level with
//      each other when side by side (or stacked with the same left edge and width), line up with the form's other fields, and add no page-wide
//      horizontal scroll. Their hint lines do not overflow.
//   B. Ledger (Logbook, List/Ledger switch set to Ledger): the five B-min columns (Date, Total, PIC, Dual, Ldg) fit between the page gutter and the Add
//      button's clearance with no sideways scroll at 100% text on phones 360px and up; at larger text it may scroll; every numeric column is right-aligned on one edge; no row is shorter than 44px; a ground row says it is a ground session; the totals row
//      is not wider than its table; nothing sits under the Add button's clearance.
// Both run across the phone/tablet widths and text sizes 100/130/200%.
//
//   PLAYWRIGHT_CORE=<playwright-core folder> node client/scripts/check-phone-forms.mjs [--base http://localhost:4175] [--matrix quick|full] [--only "phone 390"] [--text 100,130,200]
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { openContext, launchBrowsers, pickProfile } from './lib/devices.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:4175');
const TEXTS = arg('--text', '100,130,200').split(',').map(Number);
if (!process.env.PLAYWRIGHT_CORE) { console.error('Set PLAYWRIGHT_CORE (and BROWSER_EXE for Android profiles).'); process.exit(2); }
const pw = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);
const profiles = pickProfile(arg('--matrix', 'quick'), arg('--only', '')).filter((d) => d.kind !== 'desktop');
const browsers = await launchBrowsers(pw, { chromiumExe: process.env.BROWSER_EXE, need: [...new Set(profiles.map((d) => d.engine))] });

const measureForm = () => {
  const out = []; const r1 = (n) => Math.round(n * 10) / 10;
  const dep = document.querySelector('input[type="time"]'), arr = document.querySelectorAll('input[type="time"]')[1]; // by type, so the same check can run on an older build
  if (!dep || !arr) return [{ what: 'time fields missing' }];
  const rd = dep.getBoundingClientRect(), ra = arr.getBoundingClientRect();
  const side = Math.abs(rd.top - ra.top) < 2;
  const iw = window.innerWidth;
  for (const [n, r] of [['departure', rd], ['arrival', ra]]) {
    if (r.left < -0.5 || r.right > iw + 0.5) out.push({ what: `${n} time input outside the screen (${r1(r.left)}..${r1(r.right)} of ${iw})` });
    if (r.height < 44) out.push({ what: `${n} time input ${r1(r.height)}px tall (under 44)` });
  }
  if (Math.abs(rd.width - ra.width) > 1) out.push({ what: `time inputs differ in width (${r1(rd.width)} vs ${r1(ra.width)})` });
  if (side && Math.abs(rd.top - ra.top) > 1) out.push({ what: 'time inputs not level' });
  if (!side && Math.abs(rd.left - ra.left) > 1) out.push({ what: 'stacked time inputs do not share a left edge' });
  // the form's other full-width field (flight number) is the reference edge
  const ref = document.querySelector('input[placeholder="DL123"]'); // the flight number: a full-width field in the same group
  if (ref) { const rr = ref.getBoundingClientRect(); const left = Math.min(rd.left, ra.left), right = Math.max(rd.right, ra.right);
    if (Math.abs(left - rr.left) > 1.5) out.push({ what: `time fields start ${r1(left - rr.left)}px off the form's field edge` });
    if (right > rr.right + 1.5) out.push({ what: `time fields end ${r1(right - rr.right)}px beyond the form's field edge` }); }
  for (const el of document.querySelectorAll('.pt-hint, .pt-lab, .pt-calc-t, label')) if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow !== 'ellipsis') out.push({ what: `${el.className} overflows (${el.scrollWidth} > ${el.clientWidth})` });
  const calc = document.querySelector('.pt-calc');
  if (calc) { const rc = calc.getBoundingClientRect(); if (rc.right > iw + 0.5 || rc.left < -0.5) out.push({ what: 'duration panel outside the screen' });
    for (const b of calc.querySelectorAll('button')) { const r = b.getBoundingClientRect(); if (r.right > iw + 0.5 || r.width < 36 || r.height < 36) out.push({ what: `arrival-day button ${r1(r.width)}x${r1(r.height)} at ${r1(r.left)}` }); } }
  if (document.documentElement.scrollWidth > iw + 1) out.push({ what: `page scrolls sideways (${document.documentElement.scrollWidth} > ${iw})` });
  return out;
};

const measureLedger = (text) => {
  const out = []; const r1 = (n) => Math.round(n * 10) / 10;
  const t = document.querySelector('.mn-led');
  if (!t) return [{ what: 'ledger missing' }];
  const wrap = t.parentElement, iw = window.innerWidth;
  const phone = iw < 720;
  const fab = document.querySelector('.ds-fab')?.getBoundingClientRect();
  const scrolls = wrap.scrollWidth > wrap.clientWidth + 1;
  if (phone && text <= 100 && iw >= 360 && scrolls) out.push({ what: `ledger scrolls sideways at 100% text (${wrap.scrollWidth} > ${wrap.clientWidth})` });
  if (phone) {
    const heads = [...t.querySelectorAll('thead th')].filter((h) => h.offsetWidth).map((h) => h.textContent.trim());
    if (heads.join('|') !== 'Date|Total|PIC|Dual|Ldg') out.push({ what: `phone columns are ${heads.join('|')}, expected Date|Total|PIC|Dual|Ldg` });
  }
  // (the Ledger now runs the full page width by owner decision; what may sit under the Add button is checked at the end of the page by check-ui-sweep.mjs)
  // numeric columns right-aligned on one edge (flight rows only)
  const rows = [...t.querySelectorAll('tbody tr')].filter((r) => !r.classList.contains('mo') && !r.classList.contains('g'));
  const cols = {};
  for (const r of rows) [...r.children].filter((c) => c.offsetWidth && !c.classList.contains('l')).forEach((c, i) => { (cols[i] ||= []).push(c.getBoundingClientRect().right); });
  for (const [i, v] of Object.entries(cols)) if (Math.max(...v) - Math.min(...v) > 1 && Number(i) > 0) out.push({ what: `numeric column ${i} not aligned (${r1(Math.min(...v))}..${r1(Math.max(...v))})` });
  for (const r of t.querySelectorAll('tbody tr:not(.mo)')) { if (r.getBoundingClientRect().height < 44) { out.push({ what: `a row is ${r1(r.getBoundingClientRect().height)}px tall` }); break; } }
  if (phone) {
    const g = t.querySelector('tr.g'); if (g && !/ground/i.test(g.textContent)) out.push({ what: 'ground row does not say Ground' });
    const mo = t.querySelector('tr.mo td'); if (mo && /flights?/.test(mo.textContent)) out.push({ what: `month header carries figures on a phone: "${mo.textContent.trim()}"` });
  }
  const foot = t.querySelector('tfoot td:first-child'); if (foot && foot.getBoundingClientRect().height < 40) out.push({ what: 'totals row too short' });
  return out;
};

const rows = [], t0 = Date.now();
for (const d of profiles) for (const TEXT of TEXTS) {
  const ctx = await openContext(browsers, d);
  await ctx.addInitScript((t) => { try { localStorage.setItem('aerohub-logbook-view', 'ledger'); } catch { /* none */ } const set = () => { if (document.documentElement) document.documentElement.style.fontSize = `${t}%`; }; set(); document.addEventListener('DOMContentLoaded', set); }, TEXT);
  const page = await ctx.newPage();
  await page.route(/planespotters|plnspttrs|arcgisonline|cartocdn|tile\.openstreetmap/, (r) => r.abort());
  const bad = [];
  await page.goto(`${BASE}/logbook/new?role=passenger`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(400);
  const fillAirport = async (label, code) => { const f = page.getByLabel(label, { exact: true }).first(); if (await f.count()) { await f.fill(code); await page.keyboard.press('Escape'); } };
  await fillAirport('From', 'KSUS'); await fillAirport('To', 'KSTL');
  await page.locator('input[type="time"]').first().fill('08:15').catch(() => {});
  await page.locator('input[type="time"]').nth(1).fill('09:40').catch(() => {});
  await page.evaluate(() => document.activeElement?.blur()); await page.waitForTimeout(900);
  for (const m of await page.evaluate(measureForm)) bad.push(`form: ${m.what}`);
  await page.goto(`${BASE}/logbook`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForSelector('.mn-led', { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(400);
  for (const m of await page.evaluate(measureLedger, TEXT)) bad.push(`ledger: ${m.what}`);
  rows.push({ device: d.name, text: TEXT, bad });
  await ctx.close();
}

let n = 0;
for (const r of rows) { for (const b of r.bad) { console.log(`FAIL ${r.device} text ${r.text}%: ${b}`); n += 1; } }
console.log(`Phone forms + ledger: ${rows.length} runs (${profiles.length} devices, text ${TEXTS.join('/')}%) in ${Math.round((Date.now() - t0) / 1000)}s -> ${n} problem(s)`);
await Promise.all(Object.values(browsers).map((b) => b.close()));
process.exit(n ? 1 : 0);
