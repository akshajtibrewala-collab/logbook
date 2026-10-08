// SHEET DRAG CHECK. The interaction audit closes every overlay with the X, Escape, a scrim tap and browser Back; this one covers the fifth way, dragging the
// sheet's grabber down. For each sheet below it opens the sheet, drags the grabber from its top to the bottom of the screen, and fails unless the sheet is
// gone and can be opened again. It only opens sheets (no data is written), so it is safe on either build.
//
//   PLAYWRIGHT_CORE=<playwright-core folder> BROWSER_EXE=<chromium> node client/scripts/check-sheet-drag.mjs [--base http://localhost:4174] [--widths 390,1440]
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:4174');
const WIDTHS = arg('--widths', '390,1440').split(',').map(Number);
if (!process.env.PLAYWRIGHT_CORE || !process.env.BROWSER_EXE) { console.error('Set PLAYWRIGHT_CORE and BROWSER_EXE (see check-controls.mjs).'); process.exit(2); }
const { chromium } = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);

// [route, how to open it]: a role+name for a button, or a CSS selector
const SHEETS = [
  ['/logbook', { name: /^Filter and sort/ }], ['/logbook', { name: 'Jump to a month' }], ['/logbook', { css: '.bc-hero' }],
  ['/travel', { name: /^Filter/ }], ['/travel', { name: 'Jump to a year' }], ['/travel', { css: '.bc-hero' }],
  ['/milestones', { css: 'button.mn-prog' }], ['/currency', { css: 'a.mn-st, button.mn-st' }, 'optional'],
];
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXE });
const rows = []; const fails = [];
for (const w of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  const sheetOpen = () => p.evaluate(() => { const s = document.querySelector('.ds-sheet.is-open'); if (!s) return false; const r = s.getBoundingClientRect(); return r.top < innerHeight - 8 && document.querySelector('.ds-scrim-dim.is-on') !== null; });
  for (const [route, how, optional] of SHEETS) {
    await p.goto(`${BASE}${route}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(700);
    const open = async () => {
      const loc = how.css ? p.locator(how.css).first() : p.getByRole('button', { name: how.name }).first();
      if (!(await loc.count())) return false;
      await loc.click(); await p.waitForTimeout(700); return sheetOpen();
    };
    const label = `${route} ${how.css || how.name} @${w}`;
    if (!(await open())) { if (!optional) { rows.push({ sheet: label, drag: 'could not open', result: 'FAIL' }); fails.push(`${label}: could not open`); } continue; }
    const g = await p.evaluate(() => { const e = document.querySelector('.ds-sheet.is-open .ds-grab'); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await p.mouse.move(g.x, g.y); await p.mouse.down();
    for (let i = 1; i <= 12; i++) { await p.mouse.move(g.x, g.y + ((844 - g.y) * i) / 12); await p.waitForTimeout(16); }
    await p.mouse.up(); await p.waitForTimeout(900);
    const closed = !(await sheetOpen());
    const again = closed ? await open() : false;
    rows.push({ sheet: label, drag: closed ? 'closed' : 'stayed open', reopened: closed ? (again ? 'yes' : 'NO') : '-', result: closed && again ? 'pass' : 'FAIL' });
    if (!closed || !again) fails.push(`${label}: ${closed ? 'did not re-open after the drag' : 'the sheet stayed open after a full drag down'}`);
  }
  await ctx.close();
}
await browser.close();
console.table(rows);
console.log(fails.length ? `\n${fails.length} sheet drag failure(s):\n - ${fails.join('\n - ')}` : `\nAll ${rows.length} sheets close by drag and re-open.`);
process.exit(fails.length ? 1 : 0);
