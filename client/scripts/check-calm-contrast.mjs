// Contrast of every text style of the calm surfaces, measured on the RENDERED colours (the text colour against the solid surface actually behind
// it: the page, a card, or a row), at 390px and 1440px on the Logbook, Ledger, Travel, detail screens and the log-a-flight screen. Text must reach
// WCAG AA (4.5:1; 3:1 for text of 24px or more or bold 19px or more). Glass controls carry their own measured recipe (check-contrast.mjs).
// Usage: PLAYWRIGHT_CORE=<playwright-core folder> BROWSER_EXE=<chromium> node client/scripts/check-calm-contrast.mjs [--base http://localhost:4173]
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', process.env.BASE_URL || 'http://localhost:4173');
if (!process.env.PLAYWRIGHT_CORE || !process.env.BROWSER_EXE) { console.error('Set PLAYWRIGHT_CORE and BROWSER_EXE (see check-controls.mjs).'); process.exit(2); }
const { chromium } = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXE });

const probe = await (await browser.newContext()).newPage();
await probe.goto(`${BASE}/`, { waitUntil: 'networkidle' });
const ids = await probe.evaluate(async () => {
  const f = await (await fetch('/api/flights')).json(), g = await (await fetch('/api/costs/ground-sessions')).json();
  return { pilot: f.find((x) => x.role === 'pilot')?.id, pax: f.find((x) => x.role === 'passenger')?.id, ground: g[0]?.id };
});
const ROUTES = ['logbook', 'LEDGER', `logbook/${ids.pilot}`, `logbook/ground/${ids.ground}`, 'travel', `travel/${ids.pax}`, 'logbook/new', 'logbook/new?role=passenger&from=travel'];

const measure = () => {
  const parse = (s) => { const m = s.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const behind = (el) => { // composite the ancestors' backgrounds, nearest first, over black
    const layers = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a > 0) layers.push(c); if (c.a >= 1) break; }
    let out = { r: 0, g: 0, b: 0 }; for (const c of layers.reverse()) out = { r: c.r * c.a + out.r * (1 - c.a), g: c.g * c.a + out.g * (1 - c.a), b: c.b * c.a + out.b * (1 - c.a) };
    return out;
  };
  const rows = new Map();
  for (const el of document.querySelectorAll('main *, form *')) {
    if (el.closest('.ds-glass, svg, button.gl, a.gl')) continue; // glass controls: their own measured recipe
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()); if (!own) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const fg = parse(cs.color), bg = behind(el);
    const a = fg.a, mix = { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) };
    const L1 = lum(mix), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700, large = px >= 24 || (bold && px >= 18.66);
    const key = `${el.className.toString().split(' ')[0] || el.tagName.toLowerCase()} ${px}px/${cs.fontWeight}`;
    const prev = rows.get(key); if (!prev || ratio < prev.ratio) rows.set(key, { key, ratio, need: large ? 3 : 4.5, text: el.textContent.trim().slice(0, 24) });
  }
  return [...rows.values()];
};

let fails = 0, styles = 0, minRatio = 99;
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  for (const route of ROUTES) {
    if (route === 'LEDGER') { await p.evaluate(() => localStorage.setItem('aerohub-logbook-view', 'ledger')).catch(() => {}); await p.goto(`${BASE}/logbook`, { waitUntil: 'networkidle' }); }
    else await p.goto(`${BASE}/${route}`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);
    for (const r of await p.evaluate(measure)) {
      styles++; minRatio = Math.min(minRatio, r.ratio);
      if (r.ratio < r.need) { fails++; console.log(`FAIL ${route} @${w}: "${r.text}" (${r.key}) ${r.ratio.toFixed(2)}:1 < ${r.need}:1`); }
    }
    if (route === 'LEDGER') await p.evaluate(() => localStorage.removeItem('aerohub-logbook-view'));
  }
  await ctx.close();
}
await browser.close();
console.log(`${styles - fails}/${styles} text styles reach AA on the calm surfaces (lowest ${minRatio.toFixed(2)}:1)`);
process.exit(fails ? 1 : 0);
