// UI AUDIT (read-only on the app: it only opens pages and sheets). Every route and every sheet, on iPhone SE, iPhone 15, iPhone 15 Pro Max, iPad and one Android size,
// portrait and landscape, at 100% and 200% text. For each page it runs the in-page defect detector (lib/uiAudit.mjs: content cut off or sticking out sideways, text drawn
// over other text, icons outside or off the centre of their control, field heights, unbalanced rows, spacing off the 8px grid) and, with --out, saves a screenshot.
// Prints every distinct defect once (with the devices it shows on), writes the full list to --report, and fails on any.
//
//   PLAYWRIGHT_CORE=<playwright-core folder> BROWSER_EXE=<chrome.exe for the Android size> \
//     node client/scripts/check-ui-audit.mjs [--base http://localhost:4175] [--out <screenshot folder>] [--report <json file>] [--text 100,200] [--only "iPhone SE,Android"]
//     [--routes /stats,/logbook] [--no-sheets] [--end]   (--end also saves the bottom of any page that scrolls)
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { openContext, launchBrowsers } from './lib/devices.mjs';
import { AUDIT_DEVICES, routesFor, SHEETS, detect } from './lib/uiAudit.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const has = (n) => process.argv.includes(n);
const BASE = arg('--base', 'http://localhost:4175');
const OUT = arg('--out', '');
const REPORT = arg('--report', '');
const TEXTS = arg('--text', '100,200').split(',').map(Number);
const ONLY = arg('--only', '');
const ROUTES_ONLY = arg('--routes', '');
if (!process.env.PLAYWRIGHT_CORE) { console.error('Set PLAYWRIGHT_CORE (and BROWSER_EXE for the Android size).'); process.exit(2); }
const pw = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);
const devices = AUDIT_DEVICES.filter((d) => !ONLY || ONLY.split(',').some((s) => d.name.includes(s.trim())));
const browsers = await launchBrowsers(pw, { chromiumExe: process.env.BROWSER_EXE, need: [...new Set(devices.map((d) => d.engine))] });
if (OUT) fs.mkdirSync(OUT, { recursive: true });

const probeCtx = await browsers.webkit.newContext();
const probe = await probeCtx.newPage();
await probe.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
const ids = await probe.evaluate(async () => {
  const j = async (u) => (await fetch(u)).json().catch(() => []);
  const [f, g, a, e] = await Promise.all([j('/api/flights'), j('/api/costs/ground-sessions'), j('/api/aircraft'), j('/api/expirations')]);
  return { pilot: f.find((x) => x.role === 'pilot')?.id ?? 1, pax: f.find((x) => x.role === 'passenger' && x.airline)?.id ?? 1, ground: g[0]?.id ?? 1, aircraft: a[0]?.id ?? 1, expiration: e[0]?.id ?? null };
});
await probeCtx.close();
const routes = routesFor(ids).filter((r) => !ROUTES_ONLY || ROUTES_ONLY.split(',').includes(r.split('?')[0]) || ROUTES_ONLY.split(',').includes(r));
const slug = (s) => s.replace(/\/\d+/g, '/id').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home';

const all = []; // { device, text, page, kind, sel, detail }
const t0 = Date.now(); let pages = 0, shots = 0;
for (const d of devices) for (const TEXT of TEXTS) {
  const ctx = await openContext(browsers, d);
  await ctx.addInitScript((t) => { const set = () => { if (document.documentElement) document.documentElement.style.fontSize = `${t}%`; }; set(); document.addEventListener('DOMContentLoaded', set); }, TEXT);
  let page;
  const newPage = async () => { page = await ctx.newPage(); await page.route(/planespotters|plnspttrs|arcgisonline|cartocdn|tile\.openstreetmap/, (r) => r.abort()); };
  await newPage();
  // a page that crashes or times out is recorded as a defect and replaced, so one bad state never stops the audit
  const safe = async (label, fn) => {
    try { await fn(); } catch (e) {
      all.push({ device: d.name, text: TEXT, page: label, kind: 'page-error', sel: '-', detail: String(e.message).split('\n')[0].slice(0, 90) });
      await page.close().catch(() => {}); await newPage();
    }
  };
  const settle = () => page.waitForFunction(() => !document.querySelector('.skel, [aria-busy="true"], .mn-skel'), null, { timeout: 4000 }).catch(() => {});
  const run = async (label, file) => {
    await page.waitForTimeout(300);
    const found = await page.evaluate(detect, { scale: TEXT / 100 });
    pages++;
    for (const f of found) all.push({ device: d.name, text: TEXT, page: label, ...f });
    if (OUT) { await page.screenshot({ path: path.join(OUT, `${d.short}_${TEXT}_${file}.png`) }); shots++; }
    if (OUT && has('--end')) {
      const scrolls = await page.evaluate(() => { const s = document.scrollingElement; if (s.scrollHeight > innerHeight + 60) { window.scrollTo(0, s.scrollHeight); return true; } return false; });
      if (scrolls) { await page.waitForTimeout(500); await page.screenshot({ path: path.join(OUT, `${d.short}_${TEXT}_${file}_end.png`) }); shots++; await page.evaluate(() => window.scrollTo(0, 0)); }
    }
  };
  for (const route of routes) await safe(route, async () => {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('main, h1', { timeout: 8000 }).catch(() => {});
    await settle();
    if (route.includes('view=ledger')) await page.getByRole('button', { name: 'Ledger' }).first().click().catch(() => {});
    await run(route.replace(/\/\d+/g, '/:id'), slug(route));
  });
  if (!has('--no-sheets')) {
    for (const [route, how, optional] of SHEETS) await safe(`${route} sheet`, async () => {
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
      await settle();
      await page.waitForTimeout(400);
      const loc = how.css ? page.locator(how.css).first() : page.getByRole('button', { name: how.name }).first();
      await loc.waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
      if (!(await loc.count())) { if (!optional) all.push({ device: d.name, text: TEXT, page: `${route} sheet`, kind: 'sheet-missing', sel: how.css || String(how.name), detail: 'could not find the control that opens it' }); return; }
      await loc.click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(700);
      await run(`${route} sheet ${how.css || how.name}`, `sheet_${slug(route)}_${slug(how.css || String(how.name))}`);
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    });
  }
  await ctx.close();
}
for (const b of Object.values(browsers)) await b.close();

// one line per distinct defect, with where it shows
const groups = new Map();
for (const f of all) {
  const key = `${f.page}|${f.kind}|${f.sel}`;
  const g = groups.get(key) ?? { page: f.page, kind: f.kind, sel: f.sel, detail: f.detail, where: new Set() };
  g.where.add(`${f.device.replace(' portrait', ' p').replace(' landscape', ' l')} ${f.text}%`);
  groups.set(key, g);
}
const list = [...groups.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.page.localeCompare(b.page));
const byKind = {};
for (const g of list) byKind[g.kind] = (byKind[g.kind] ?? 0) + 1;
if (REPORT) fs.writeFileSync(REPORT, JSON.stringify({ base: BASE, texts: TEXTS, pages, defects: list.map((g) => ({ ...g, where: [...g.where] })), raw: all.length }, null, 1));
for (const g of list.slice(0, Number(arg('--show', 60)))) console.log(`${g.kind.padEnd(22)} ${g.page}  ${g.sel}  ${g.detail}  [${[...g.where].slice(0, 4).join(', ')}${g.where.size > 4 ? ` +${g.where.size - 4}` : ''}]`);
if (list.length > Number(arg('--show', 60))) console.log(`... ${list.length - Number(arg('--show', 60))} more in the report`);
console.log(`UI audit: ${pages} page states (${devices.length} devices x text ${TEXTS.join('/')}% x routes and sheets)${OUT ? `, ${shots} screenshots` : ''}, ${list.length} distinct defects ${JSON.stringify(byKind)} in ${Math.round((Date.now() - t0) / 1000)} s. ${BASE}`);
process.exit(list.length ? 1 : 0);
