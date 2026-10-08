// Regression guard: every visible interactive control on every route must use the glass recipe (or be on the explicit allowlist in
// src/lib/controlAudit.js), and each route must stay inside the blur-layer budget (tab bar + top bar + one open overlay).
//
//   node client/scripts/check-controls.mjs [--table] [--width 390]
//
// It drives a real browser against a RUNNING production build (default http://localhost:4173) and only ever READS from the API
// (GET /api/flights for ids); it never writes. Playwright is not a project dependency, so point it at a copy:
//   PLAYWRIGHT_CORE=<path to the playwright-core package folder>   BROWSER_EXE=<path to chromium / chrome-headless-shell>
// (e.g. `npm i --no-save playwright-core` in a scratch folder, then PLAYWRIGHT_CORE=<scratch>/node_modules/playwright-core).
// Exit code 1 when any control lacks the marker or any route is over the blur budget. Include it in every phase's verification.
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { classifyControl, blurLayerReport } from '../src/lib/controlAudit.js';

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const API = process.env.API_URL || 'http://localhost:3001';
const WIDTH = Number((process.argv.find((a, i) => process.argv[i - 1] === '--width')) || 390);
const TABLE = process.argv.includes('--table');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const GLASS = arg('--glass', 'full'); // full | lite | solid (the quality level to test; Auto would settle to Solid in a headless browser)
const REDUCE = process.argv.includes('--reduce'); // the Reduce transparency setting
if (!process.env.PLAYWRIGHT_CORE || !process.env.BROWSER_EXE) { console.error('Set PLAYWRIGHT_CORE and BROWSER_EXE (see the header of this file).'); process.exit(2); }
const { chromium } = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);

async function ids() {
  try {
    const flights = await (await fetch(`${API}/api/flights`)).json();
    return { pilot: flights.find((f) => f.role === 'pilot')?.id ?? 5, pax: flights.find((f) => f.role === 'passenger')?.id ?? 181 };
  } catch { return { pilot: 5, pax: 181 }; }
}
const { pilot, pax } = await ids();
const ROUTES = ['', 'logbook', `logbook/${pilot}`, 'logbook/ground/1', 'travel', `travel/${pax}`, 'logbook/data', 'aircraft', 'aircraft/new', 'aircraft/15',
  'logbook/new', 'logbook/new?role=passenger', 'logbook/quick', 'logbook/share', `logbook/${pilot}/edit`, 'logbook/ground/new', 'logbook/ground/1/edit',
  'milestones', 'currency', 'currency/new', 'currency/1', 'weather', 'weather/settings', 'costs', 'costs/settings', 'costs/spending', 'costs/phases', 'costs/expenses', 'costs/projection', 'map', 'stats', 'more', 'settings', 'flying'];

const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXE });
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 800 }, reducedMotion: 'reduce' });
await ctx.addInitScript(([g, r]) => { try { localStorage.setItem('aerohub-glass-level', g); localStorage.setItem('aerohub-reduce-transparency', r ? '1' : '0'); } catch { /* ignore */ } }, [GLASS, REDUCE]);
const page = await ctx.newPage();
let failures = 0, over = 0, total = 0;
const MD = (() => { const i = process.argv.indexOf('--md'); return i > -1 ? process.argv[i + 1] : ''; })(); // write a markdown table (by route: control, class, recipe yes/no)
const md = [];
for (const route of ROUTES) {
  await page.goto(`${BASE}/${route}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(700);
  const { controls, blurs } = await page.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('.sr-only') && !e.closest('.ds-menu:not(.is-open)') && !e.closest('[aria-hidden="true"]') && !e.classList.contains('ds-skip'); };
    const controls = [...document.querySelectorAll('a[href], button, select, input:not([type=hidden]), textarea, summary, [role=button], [role=tab], [role=switch], [role=checkbox]')].filter(vis).map((e) => ({
      tag: e.tagName.toLowerCase(), type: e.type || '', cls: String(e.className).replace(/\s+/g, ' ').trim(), text: (e.getAttribute('aria-label') || e.textContent || e.placeholder || '').trim().slice(0, 30),
      area: e.closest('.ds-tabbar') ? 'tabbar' : e.closest('.ds-menu') ? 'menu' : e.closest('.ds-topbar') ? 'topbar' : 'page', inField: Boolean(e.closest('.gl-step')),
    }));
    const blurs = [...document.querySelectorAll('*')].filter((e) => { const cs = getComputedStyle(e); return (cs.backdropFilter && cs.backdropFilter !== 'none') || (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== 'none'); }).filter((e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('.ds-menu:not(.is-open)') && !e.closest('.ds-sheet:not(.is-open)'); })
      .map((e) => ({ group: (e.closest('.ds-glass') && (e.closest('.ds-tabbar') ? 'tabbar' : e.closest('.ds-topbar') ? 'topbar' : e.closest('.ds-menu') ? 'menu' : e.closest('.ds-sheet') ? 'sheet' : 'glass')) || `OTHER ${e.tagName.toLowerCase()}.${String(e.className).slice(0, 30)}` }));
    return { controls, blurs };
  });
  const rows = controls.map((c) => ({ ...c, ...classifyControl(c) }));
  const bad = rows.filter((r) => r.status === 'fail'), blur = blurLayerReport(blurs);
  if (MD) {
    const by = new Map(); for (const r of rows) { const k = `${r.tag}${r.type ? ':' + r.type : ''} | ${r.cls.slice(0, 70)}`; const e = by.get(k) || { n: 0, text: r.text, r }; e.n++; by.set(k, e); }
    md.push(['', `### /${route}`, '', '| Control (example text) | Element and classes | Count | Recipe |', '|---|---|---|---|'].join('\n'));
    const cell = (t) => String(t).replace(/\|/g, '/');
    for (const [k, e] of by) md.push('| ' + (cell(e.text) || '—') + ' | `' + cell(k) + '` | ' + e.n + ' | ' + (e.r.status === 'recipe' ? 'yes' : e.r.status === 'allowed' ? 'no — allowed (' + e.r.rule + ')' : '**NO**') + ' |');
  }
  total += rows.length; failures += bad.length; if (!blur.ok) over++;
  console.log(`${('/' + route).padEnd(30)} controls ${String(rows.length).padStart(3)}  recipe ${String(rows.filter((r) => r.status === 'recipe').length).padStart(3)}  allowed ${String(rows.filter((r) => r.status === 'allowed').length).padStart(3)}  FAIL ${bad.length}  blur layers ${blur.layers}/${blur.budget} [${blur.groups.join(", ")}]${blur.ok ? "" : "  OVER BUDGET"}`);
  for (const b of bad) console.log(`    FAIL  <${b.tag}${b.type ? ':' + b.type : ''}> "${b.text}"  class="${b.cls.slice(0, 90)}"`);
  if (TABLE) for (const r of rows) console.log(`    ${r.status.padEnd(7)} ${(r.rule || '').padEnd(16)} <${r.tag}> ${r.cls.slice(0, 60)}  "${r.text}"`);
}
await browser.close();
if (MD) {
  const fsm = await import('node:fs');
  const head = [`# Control audit (${WIDTH}px, glass ${GLASS}${REDUCE ? ' + reduce transparency' : ''})`, '', 'Generated by `client/scripts/check-controls.mjs --md`. Every visible interactive control per route. "Recipe" is yes when it carries the glass recipe marker; otherwise it must be on the explicit allowlist in `src/lib/controlAudit.js` (shown as "allowed").'];
  fsm.writeFileSync(MD, head.concat(md).join('\n') + '\n');
}
console.log(`\nglass level ${GLASS}${REDUCE ? ' + reduce transparency' : ''}`);
console.log(`${ROUTES.length} routes at ${WIDTH}px: ${total} controls, ${failures} without the recipe marker, ${over} routes over the blur budget.`);
process.exit(failures || over ? 1 : 0);
