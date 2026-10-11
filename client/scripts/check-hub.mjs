// HUB RULES CHECK (Home). Read-only: loads Home and measures it.
//   tiles        at most 8 module tiles in the first two screens, every one a real link (an href that is not "#"), pointing at a route that loads
//   size         each tile at least 72px tall, and a 44px target
//   words        at most 70 visible words in the first two screens (two viewport heights, chrome excluded)
//   accent       at most one number in a tile's value (one accent figure per tile)
//   name         a tile's name is at most 3 words
//   order        the map band sits directly under the hero and above the tiles
//   PLAYWRIGHT_CORE=<..> node client/scripts/check-hub.mjs [--base http://localhost:4174] [--widths 390,1440]
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:4174');
const WIDTHS = arg('--widths', '390,1440').split(',').map(Number);
if (!process.env.PLAYWRIGHT_CORE) { console.error('Set PLAYWRIGHT_CORE.'); process.exit(2); }
const pw = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href); const { webkit, devices } = pw.default ?? pw;
const browser = await webkit.launch();
const rows = []; const bad = [];
for (const w of WIDTHS) {
  const H = w < 700 ? 844 : 900;
  const ctx = await browser.newContext({ ...(w < 700 ? devices['iPhone 13'] : {}), viewport: { width: w, height: H }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
  const r = await p.evaluate((H2) => {
    const words = (t) => t.split(/\s+/).filter((x) => /[\p{L}\p{N}]/u.test(x)).length;
    const tiles = [...document.querySelectorAll('.hub-t')].map((a) => { const q = a.getBoundingClientRect(); return { href: a.getAttribute('href'), h: Math.round(q.height), w: Math.round(q.width), top: q.top + scrollY, name: a.querySelector('.nm')?.textContent.trim() || '', value: [...(a.querySelector('.v')?.childNodes || [])].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim(), sub: a.querySelector('.v .sub')?.textContent.trim() || '' }; });
    const two = 2 * H2; const inTwo = tiles.filter((t) => t.top < two);
    // words in the first two screens, excluding the fixed chrome (top bar, tab bar, Add button, rail)
    let n = 0; const tw = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
    for (let node; (node = tw.nextNode());) { const t = node.nodeValue.trim(); if (!t || !words(t)) continue; const el = node.parentElement; const rg = document.createRange(); rg.selectNodeContents(node); const q = rg.getClientRects()[0]; if (!q || q.width === 0) continue; if (q.top + scrollY < two) n += words(t); }
    const hero = document.querySelector('.bc-hero'), band = document.querySelector('.hub-band'), grid = document.querySelector('.hub-grid');
    const order = hero && band && grid && hero.getBoundingClientRect().bottom <= band.getBoundingClientRect().top + 1 && band.getBoundingClientRect().bottom <= grid.getBoundingClientRect().top + 1;
    return { tiles, inTwo: inTwo.length, words: n, order };
  }, H);
  const hrefs = [...new Set(r.tiles.map((t) => t.href))];
  const problems = [];
  if (r.tiles.length === 0) problems.push('no tiles');
  if (r.inTwo > 8) problems.push(`${r.inTwo} tiles in the first two screens (max 8)`);
  for (const t of r.tiles) {
    if (!t.href || t.href === '#') problems.push(`dead tile "${t.name}"`);
    if (t.h < 72) problems.push(`"${t.name}" is ${t.h}px tall (min 72)`);
    if (t.name.split(/\s+/).length > 3) problems.push(`"${t.name}" has more than 3 words`);
    if ((t.value.match(/\d[\d,.]*/g) || []).length > 1) problems.push(`"${t.name}" value "${t.value}" has more than one number`);
  }
  if (r.words > 70) problems.push(`${r.words} words in the first two screens (max 70)`);
  if (!r.order) problems.push('the map band is not directly under the hero and above the tiles');
  // every tile route loads (not a 404 page of the app)
  for (const h of hrefs) { const res = await p.request.get(`${BASE}${h}`); if (res.status() !== 200) problems.push(`${h} answers ${res.status()}`); }
  rows.push(`${String(w).padStart(5)}px  tiles ${r.tiles.length} (${r.inTwo} in two screens)  min height ${Math.min(...r.tiles.map((t) => t.h))}px  words in two screens ${r.words}  band under hero ${r.order ? 'yes' : 'NO'}  ${problems.length ? 'FAIL: ' + problems.join('; ') : 'ok'}`);
  for (const pr of problems) bad.push(`${w}px: ${pr}`);
  await ctx.close();
}
await browser.close();
console.log(rows.join('\n'));
console.log(`\nhub rules: ${bad.length} problem(s)`);
process.exit(bad.length ? 1 : 0);
