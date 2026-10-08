// Word-budget guard for the minimalist design language (docs/design/DESIGN_LANGUAGE.md, "Minimalism rules"). Counts the visible words and
// distinct text styles in the first viewport of a screen and fails (exit 1) when a screen is over its budget. Include it in every verification.
//
//   PLAYWRIGHT_CORE=<playwright-core folder> BROWSER_EXE=<chromium> node client/scripts/check-words.mjs [--base http://localhost:4173]
//       the app: every route in lib/wordBudget.js at 390px (read-only; it only loads pages)
//   ... node client/scripts/check-words.mjs --mockups http://localhost:5180/logbook-bmin.html [--report]
//       static mockups: every <figure class="mk-fig"> is one screen; its budget comes from data-words-max (and data-kind="phone"|"desk")
//
// What it checks per screen (first viewport only, chrome included in "chrome words" but not charged to the budget):
//   words      visible content words (a "word" has a letter or digit; separators like "·" do not count) <= the screen's budget
//   row        every [data-row] has at most 6 words
//   card       every [data-card] has at most 1 headline number + 1 supporting line, and at most 3 text sizes
//   caps       at most 1 all-caps micro-label on the screen
//   tone       secondary text uses one muted tone only (--ds-text-2); the dimmer --ds-text-3 is not used for words
//   exempt     a figure with data-exempt="ledger" (the dense paper-logbook view) skips the word, size and caps limits; only the tone rule applies
//   nav        the Flying tab strip counts as navigation chrome, like the top bar and tab bar: reported, not charged to the budget
//   sizes      at most 4 distinct text sizes on the screen, plus the large numerals (>= 28px)
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { BUDGETS, ROW_MAX_WORDS, CARD_MAX_SIZES, SCREEN_MAX_SIZES, MAX_CAPS, countWords } from '../src/lib/wordBudget.js';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const flag = (n) => process.argv.includes(n);
if (!process.env.PLAYWRIGHT_CORE || !process.env.BROWSER_EXE) { console.error('Set PLAYWRIGHT_CORE and BROWSER_EXE (see check-controls.mjs).'); process.exit(2); }
const { chromium } = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXE });
const fails = []; const table = [];

// Runs in the page. `rootSel` limits the search, `frameSel` is the visible viewport box (the whole window when null).
const inPage = ({ rootSel, frameSel, chromeSel }) => {
  const root = rootSel ? document.querySelector(rootSel) : document.body;
  const frame = (frameSel ? document.querySelector(frameSel) : document.documentElement).getBoundingClientRect();
  const vp = frameSel ? frame : { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  const chrome = chromeSel ? [...document.querySelectorAll(chromeSel)] : [];
  const words = (t) => t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const hidden = (el) => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0 || e.hasAttribute('hidden')) return true; } return false; };
  const out = { content: 0, chrome: 0, pieces: [], sizes: new Set(), caps: [], dim: [] };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode());) {
    const t = n.nodeValue.trim(); if (!t || !words(t)) continue;
    const el = n.parentElement; if (!el || ['SCRIPT', 'STYLE'].includes(el.tagName) || hidden(el)) continue;
    const r = document.createRange(); r.selectNodeContents(n); const q = [...r.getClientRects()].find((x) => x.width > 0 && x.height > 0); if (!q) continue;
    if (q.right <= vp.left || q.left >= vp.right || q.bottom <= vp.top || q.top >= vp.bottom) continue;
    const cs = getComputedStyle(el); const size = Math.round(parseFloat(cs.fontSize)); const caps = cs.textTransform === 'uppercase';
    const isChrome = chrome.some((c) => c.contains(el)); const w = words(t);
    if (isChrome) { out.chrome += w; continue; }
    out.content += w;
    const style = `${size}px/${cs.fontWeight}${caps ? '/CAPS' : ''}`;
    out.pieces.push({ t, w, style, color: cs.color });
    if (size < 28 && !el.closest('.gl')) out.sizes.add(size); // control labels follow the control recipe, not the text scale
    if (caps) out.caps.push(t);
    if (cs.color === 'rgb(142, 142, 150)') out.dim.push(t); // --ds-text-3, the dimmer tone
  }
  const rows = [...root.querySelectorAll('[data-row]')].filter((e) => !hidden(e)).map((e) => ({ w: words(e.innerText) - words(e.querySelector('.day')?.innerText || '') })); // the date block is not charged to a row's six words
  const cards = [...root.querySelectorAll('[data-card]')].filter((e) => !hidden(e)).map((e) => {
    const sizes = new Set(); const w2 = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
    for (let n; (n = w2.nextNode());) if (n.nodeValue.trim() && words(n.nodeValue)) sizes.add(Math.round(parseFloat(getComputedStyle(n.parentElement).fontSize)));
    return { sizes: sizes.size, w: words(e.innerText) };
  });
  return { ...out, sizes: [...out.sizes], rows, cards };
};

const evaluate = (name, m, budget, exempt = null) => {
  const row = { screen: name, words: m.content, budget, chrome: m.chrome, styles: new Set(m.pieces.map((p) => p.style)).size, sizes: m.sizes.length, caps: m.caps.length, maxRow: Math.max(0, ...m.rows.map((r) => r.w)) };
  table.push(row);
  const bad = (msg) => { fails.push(`${name}: ${msg}`); console.log('FAIL', name, msg); };
  if (exempt) { console.log(`note ${name}: exempt from word, size and caps limits (${exempt}); ${m.content} words`); if (m.dim.length) bad('dim tone used'); return; }
  if (budget != null && m.content > budget) bad(`${m.content} words, budget ${budget}`);
  if (m.sizes.length > SCREEN_MAX_SIZES) bad(`${m.sizes.length} text sizes (${m.sizes.join(', ')}), max ${SCREEN_MAX_SIZES} plus large numerals`);
  if (m.dim.length) bad(`dim text tone used for words: ${m.dim.slice(0, 3).join(' | ')}`);
  if (m.caps.length > MAX_CAPS) bad(`${m.caps.length} all-caps labels (${m.caps.join(' | ')}), max ${MAX_CAPS}`);
  m.rows.forEach((r, i) => { if (r.w > ROW_MAX_WORDS) bad(`row ${i + 1} has ${r.w} words, max ${ROW_MAX_WORDS}`); });
  m.cards.forEach((c, i) => { if (c.sizes > CARD_MAX_SIZES) bad(`card ${i + 1} has ${c.sizes} text sizes, max ${CARD_MAX_SIZES}`); });
  if (flag('--report')) { console.log(`\n== ${name}: ${m.content} words, ${m.sizes.length} small sizes (${m.sizes.join(', ')}), ${m.caps.length} caps`); for (const p of m.pieces) console.log(`   ${String(p.w).padStart(2)}  ${p.style.padEnd(16)} ${p.t.slice(0, 70)}`); }
};

const mock = arg('--mockups', null);
if (mock) {
  const p = await (await browser.newContext({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' })).newPage();
  await p.goto(mock, { waitUntil: 'load' }); await p.waitForTimeout(800);
  const figs = p.locator('figure.mk-fig'); const n = await figs.count();
  for (let i = 0; i < n; i++) {
    const f = figs.nth(i); const kind = (await f.locator('.mk-phone').count()) ? 'phone' : 'desk';
    const budget = Number(await f.getAttribute('data-words-max')) || null; const name = (await f.getAttribute('data-name')) || `figure ${i + 1} (${kind})`;
    await f.evaluate((el, i) => el.setAttribute('data-fig', String(i)), i);
    const frame = `figure[data-fig="${i}"] ${kind === 'phone' ? '.mk-phone' : '.mk-desk'}`;
    const m = await p.evaluate(inPage, { rootSel: frame, frameSel: frame, chromeSel: `${frame} .ds-topbar, ${frame} .ds-tabbar, ${frame} .ds-fab, ${frame} .mk-rail, ${frame} .fl-tabs` });
    evaluate(name, m, budget, (await f.getAttribute('data-exempt')) || null);
  }
} else {
  const base = arg('--base', process.env.BASE_URL || 'http://localhost:4173');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }); const p = await ctx.newPage();
  for (const [route, budget] of Object.entries(BUDGETS)) {
    await p.goto(`${base}/${route}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(600);
    const m = await p.evaluate(inPage, { rootSel: '#main', frameSel: null, chromeSel: '.fl-tabs' }).catch(() => null);
    if (m) evaluate(`/${route} @390`, m, budget); else { fails.push(`/${route}: no #main`); console.log('FAIL /' + route + ' no #main'); }
  }
}
await browser.close();
console.table(table);
console.log(fails.length ? `\n${fails.length} word-budget failure(s)` : '\nAll screens within the word budget');
process.exit(fails.length ? 1 : 0);
