// SEARCH CLEAR BUTTON (read-only on the app). Open the Logbook and Travel search, type a query, and measure the clear (x) button:
//   1. it sits inside the field (its box is within the field's box) at the right edge (a few px from it, never past it);
//   2. it is vertically centred in the field (within 1px);
//   3. the x glyph itself is centred in the button (within 1.5px), so the cross never drifts out of its circle.
// iPhone SE, iPhone 15, iPhone 15 Pro Max and an Android size in portrait, at 100%, 130% and 200% text. (The glyph used to be pulled out of its button by a CSS
// selector meant for the search icon: `.cl-search svg` matched the x's svg too.)
//
//   PLAYWRIGHT_CORE=<playwright-core folder> BROWSER_EXE=<chrome.exe for the Android size> node client/scripts/check-search-clear.mjs [--base http://localhost:4175] [--text 100,130,200]
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { openContext, launchBrowsers } from './lib/devices.mjs';
import { AUDIT_DEVICES } from './lib/uiAudit.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:4175');
const TEXTS = arg('--text', '100,130,200').split(',').map(Number);
if (!process.env.PLAYWRIGHT_CORE) { console.error('Set PLAYWRIGHT_CORE (and BROWSER_EXE for the Android size).'); process.exit(2); }
const pw = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);
const devices = AUDIT_DEVICES.filter((d) => d.name.endsWith('portrait') && d.width < 720);
const browsers = await launchBrowsers(pw, { chromiumExe: process.env.BROWSER_EXE, need: [...new Set(devices.map((d) => d.engine))] });

const measure = () => {
  const i = document.querySelector('input[type="search"]'), c = document.querySelector('button[aria-label="Clear search"]');
  if (!i || !c) return { missing: !i ? 'search field' : 'clear button' };
  const a = i.getBoundingClientRect(), b = c.getBoundingClientRect(), s = c.querySelector('svg')?.getBoundingClientRect();
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const r1 = (n) => Math.round(n * 10) / 10;
  return {
    insideLeft: r1(b.left - a.left), insideRight: r1(a.right - b.right), insideTop: r1(b.top - a.top), insideBottom: r1(a.bottom - b.bottom),
    vOff: r1((b.top + b.bottom) / 2 - (a.top + a.bottom) / 2),
    glyphDx: s ? r1((s.left + s.right) / 2 - (b.left + b.right) / 2) : null, glyphDy: s ? r1((s.top + s.bottom) / 2 - (b.top + b.bottom) / 2) : null,
    root,
  };
};

const rows = []; const fails = [];
for (const d of devices) for (const TEXT of TEXTS) for (const route of ['/logbook', '/travel']) {
  const ctx = await openContext(browsers, d);
  await ctx.addInitScript((t) => { const set = () => { if (document.documentElement) document.documentElement.style.fontSize = `${t}%`; }; set(); document.addEventListener('DOMContentLoaded', set); }, TEXT);
  const p = await ctx.newPage();
  await p.route(/planespotters|plnspttrs|arcgisonline|cartocdn|tile\.openstreetmap/, (r) => r.abort());
  await p.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('main', { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(600);
  await p.getByRole('button', { name: /^Search/ }).first().click().catch(() => {});
  await p.waitForTimeout(300);
  await p.locator('input[type="search"]').first().fill('N4').catch(() => {});
  await p.waitForTimeout(400);
  const m = await p.evaluate(measure);
  const why = [];
  if (m.missing) why.push(`${m.missing} not found`);
  else {
    const maxInset = Math.max(12, m.root * 0.75);
    if (m.insideLeft < 0 || m.insideTop < -0.5 || m.insideBottom < -0.5 || m.insideRight < -0.5) why.push(`the button is not inside the field (left ${m.insideLeft}, top ${m.insideTop}, bottom ${m.insideBottom}, right ${m.insideRight})`);
    if (m.insideRight > maxInset) why.push(`the button is ${m.insideRight}px from the right edge (limit ${maxInset}px)`);
    if (Math.abs(m.vOff) > 1) why.push(`the button is ${m.vOff}px off the field's vertical centre`);
    if (m.glyphDx === null || Math.abs(m.glyphDx) > 1.5 || Math.abs(m.glyphDy) > 1.5) why.push(`the x glyph is ${m.glyphDx}px across and ${m.glyphDy}px down from its button's centre`);
  }
  rows.push({ device: d.name, route, text: TEXT, result: why.length ? 'FAIL' : 'pass' });
  if (why.length) fails.push(`${d.name} ${route} text ${TEXT}%: ${why.join('; ')}`);
  await ctx.close();
}
for (const b of Object.values(browsers)) await b.close();
if (fails.length) console.log(`\n${fails.length} of ${rows.length} search-clear measurements fail:\n - ${[...new Set(fails)].slice(0, 12).join('\n - ')}`);
console.log(`Search clear button: ${rows.length - fails.length}/${rows.length} measurements in place (${devices.length} devices x text ${TEXTS.join('/')}% x Logbook and Travel). ${BASE}`);
process.exit(fails.length ? 1 : 0);
