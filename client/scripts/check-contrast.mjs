// Contrast on REAL PIXELS for the switch (knob against its track), at every glass quality level and with Reduce transparency on and off.
// Each reading is two screenshots of the same spot — knob visible, then knob hidden — so the colours are what is actually painted
// (never a computed style, which is wrong whenever a quality level swaps the colour through a fallback variable). The knob is a non-text
// control part, so the bar is WCAG 1.4.11's 3:1. Read-only. Exit 1 when a reading is below the bar.
// Usage: PLAYWRIGHT_CORE=<playwright-core folder> BROWSER_EXE=<chromium> node client/scripts/check-contrast.mjs [--base http://localhost:4173]
//
// Background: the first version (a scratch script that was never committed) reported 1.1:1 for the Reduce transparency switch while the real
// colours (knob rgb 0,26,46 on track rgb 91,185,255) are about 8:1. It took the knob colour from getComputedStyle and the track from a fixed
// sample box; I did not isolate which of the two was wrong. This version reads both from painted pixels and gives 8.3:1.
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', process.env.BASE_URL || 'http://localhost:4173');
if (!process.env.PLAYWRIGHT_CORE || !process.env.BROWSER_EXE) { console.error('Set PLAYWRIGHT_CORE and BROWSER_EXE (see check-controls.mjs).'); process.exit(2); }
const { chromium } = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXE });

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

// The centre pixel of a PNG, decoded in a scratch page's canvas.
const decoder = await (await browser.newContext()).newPage();
const centre = async (buf) => decoder.evaluate(async (b64) => {
  const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  return [...x.getImageData(Math.floor(img.width / 2), Math.floor(img.height / 2), 1, 1).data].slice(0, 3);
}, buf.toString('base64'));

const rows = []; let bad = 0;
for (const [level, reduce] of [['full', 0], ['lite', 0], ['solid', 0], ['full', 1], ['solid', 1]]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  await ctx.addInitScript(([g, r]) => { try { localStorage.setItem('aerohub-glass-level', g); localStorage.setItem('aerohub-reduce-transparency', r ? '1' : '0'); } catch { /* ignore */ } }, [level, reduce]);
  const p = await ctx.newPage();
  for (const route of ['settings', 'logbook/new', 'weather/settings']) {
    await p.goto(`${BASE}/${route}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(600);
    await p.addStyleTag({ content: '*{transition:none!important;animation:none!important}' });
    const n = await p.locator('.gl-switch').count();
    for (let i = 0; i < n; i++) {
      const sw = p.locator('.gl-switch').nth(i);
      await sw.scrollIntoViewIfNeeded(); await p.waitForTimeout(100);
      const info = await sw.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, on: e.getAttribute('aria-checked') === 'true' || e.classList.contains('on'), vis: r.top > 60 && r.bottom < innerHeight - 60 }; });
      if (!info.vis) continue;
      // The knob is a 24px circle 3px in from the left (on: moved 20px right); sample its centre and the same spot with the knob hidden.
      const clip = { x: info.x + 3 + 12 + (info.on ? 20 : 0) - 2, y: info.y + info.h / 2 - 2, width: 4, height: 4 };
      const knob = await centre(await p.screenshot({ clip }));
      await p.addStyleTag({ content: '.gl-switch::after{display:none!important}' });
      const track = await centre(await p.screenshot({ clip }));
      await p.evaluate(() => { const s = [...document.querySelectorAll('style')].pop(); s.remove(); });
      const cr = ratio(knob, track);
      rows.push({ level, reduce, route, on: info.on, cr });
      if (cr < 3) { bad++; console.log(`FAIL switch knob ${cr.toFixed(2)}:1 at glass ${level}${reduce ? ' + reduce transparency' : ''} on /${route} (${info.on ? 'on' : 'off'})`); }
    }
  }
  await ctx.close();
}
const worst = {};
for (const r of rows) { const k = `${r.level}${r.reduce ? ' + reduce transparency' : ''} · ${r.on ? 'on' : 'off'}`; worst[k] = Math.min(worst[k] ?? 99, r.cr); }
for (const [k, v] of Object.entries(worst)) console.log(k.padEnd(36), `${v.toFixed(1)}:1`);
console.log(`${rows.length} switch readings, ${bad} below 3:1`);
await browser.close();
process.exit(bad ? 1 : 0);
