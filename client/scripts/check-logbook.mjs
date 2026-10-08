// Logbook behaviour check (read-only: loads pages, opens and closes sheets, scrolls; nothing is written).
//   - the first screen opens only the newest month; opening an older one is remembered across a reload (same session)
//   - search results show the matching rows with a full date
//   - the month jumper reaches any month in two taps
//   - the ground sheet keeps two columns and never wraps its date or hours (320, 390, 430px; text 100 and 200%)
//   - the Flying switcher: aria-expanded, keyboard (ArrowDown opens, arrows move, Escape closes and returns focus), five pages
//   - the Add button hides on scroll down, returns on scroll up, and never covers a row's hours or the Ledger's last column
//
//   PLAYWRIGHT_CORE=<playwright-core folder> BROWSER_EXE=<chromium> node client/scripts/check-logbook.mjs [--base http://localhost:4174]
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:4174');
if (!process.env.PLAYWRIGHT_CORE || !process.env.BROWSER_EXE) { console.error('Set PLAYWRIGHT_CORE and BROWSER_EXE (see check-controls.mjs).'); process.exit(2); }
const { chromium } = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXE });
const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const openCount = (p) => p.locator('.bc-mh[aria-expanded="true"]').count();
const fresh = async (p, ledger) => {
  await p.goto(`${BASE}/logbook`, { waitUntil: 'networkidle' });
  await p.evaluate((l) => { localStorage.setItem('aerohub-logbook-view', l ? 'ledger' : 'list'); sessionStorage.clear(); }, ledger);
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(700);
};
const openAll = async (p) => {
  for (let i = 0; i < 40 && await p.locator('.bc-mh[aria-expanded="false"]').count(); i++) await p.locator('.bc-mh[aria-expanded="false"]').first().click();
};

// ---- months, search, jumper (phone)
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await fresh(p, false);
  const total = await p.locator('.bc-mh').count();
  ok(total > 1, `need more than one month to test collapsing (found ${total})`);
  ok(await openCount(p) === 1, `first screen opens ${await openCount(p)} months, expected only the newest`);
  ok(await p.locator('.bc-mh').first().getAttribute('aria-expanded') === 'true', 'the open month is not the newest');
  if (total > 1) {
    await p.locator('.bc-mh').nth(1).click(); await p.waitForTimeout(200);
    ok(await openCount(p) === 2, 'opening an older month did not open it');
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(700);
    ok(await openCount(p) === 2, 'an opened month is not remembered across a reload');
    for (let i = 0; i < total; i++) {
      await fresh(p, false);
      await p.getByRole('button', { name: 'Jump to a month' }).click(); await p.waitForTimeout(600);
      const target = p.locator('.bc-pickrow').nth(i); const name = (await target.getAttribute('aria-label')) || '';
      await target.click(); await p.waitForTimeout(800);
      const vis = await p.locator('.bc-mh').nth(i).evaluate((e) => { const r = e.getBoundingClientRect(); return e.getAttribute('aria-expanded') === 'true' && r.bottom > 0 && r.top < innerHeight; });
      ok(vis, `jumper: "${name}" is not open and in view after two taps`);
    }
  }
  await fresh(p, false); await openAll(p);
  const label = (await p.locator('.bc-row').last().getAttribute('aria-label')) || '';
  const tail = (label.match(/N[0-9]{1,5}[A-Z]{0,2}/) || [])[0];
  if (tail) {
    await fresh(p, false);
    await p.getByRole('button', { name: 'Search', exact: true }).click();
    await p.locator('input[type=search]').fill(tail); await p.waitForTimeout(700);
    ok(await p.locator('.bc-row').count() > 0, `search "${tail}" shows no rows`);
    ok(await p.locator('.bc-row').evaluateAll((els) => els.every((e) => /[0-9]{2}\/[0-9]{2}\/[0-9]{4}/.test(e.getAttribute('aria-label') || ''))), 'search results lack a full date in a row name');
    ok(await p.locator('.bc-row.full').count() > 0, 'search results do not show the full date on the row');
  } else ok(false, 'could not find a tail number in the oldest row to search for');
  await ctx.close();
}

// ---- ground sheet: two columns, nothing wraps (3 widths x 2 text sizes)
for (const w of [320, 390, 430]) for (const scale of [100, 200]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await fresh(p, false);
  if (scale === 200) await p.addStyleTag({ content: 'html{font-size:200% !important}' });
  const g = p.locator('.bc-ground').first();
  if (!(await g.count())) { await ctx.close(); continue; }
  await g.scrollIntoViewIfNeeded(); await g.click(); await p.waitForTimeout(900);
  const res = await p.locator('.bc-grow').evaluateAll((els) => els.map((e) => {
    const a = e.querySelector('.a').getBoundingClientRect(); const b = e.querySelector('.b');
    const spans = [...b.children].map((s) => { const r = document.createRange(); r.selectNodeContents(s); const rs = [...r.getClientRects()]; return rs.length ? Math.max(...rs.map((x) => x.top)) - Math.min(...rs.map((x) => x.top)) : 0; });
    const br = b.getBoundingClientRect();
    return { sideBySide: br.left >= a.right - 1, wrapped: spans.some((d) => d > 2), onScreen: br.right <= innerWidth + 1, texts: [...b.children].map((s) => s.textContent) };
  }));
  ok(res.length > 0, `@${w}px ${scale}%: ground sheet has no rows`);
  for (const r of res) {
    ok(r.sideBySide, `@${w}px ${scale}%: date/hours column is not beside the title (${r.texts.join(' | ')})`);
    ok(!r.wrapped, `@${w}px ${scale}%: a ground row wraps its date or hours (${r.texts.join(' | ')})`);
    ok(r.onScreen, `@${w}px ${scale}%: a ground row runs off the screen (${r.texts.join(' | ')})`);
  }
  await ctx.close();
}

// ---- Flying switcher
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await fresh(p, false);
  const sw = p.locator('.bc-sw');
  const menu = p.locator('div:has(> a[role="menuitem"][href="/currency"]) > a[role="menuitem"]');
  ok(await sw.getAttribute('aria-expanded') === 'false', 'switcher starts expanded');
  ok(/Flying pages/.test((await sw.getAttribute('aria-label')) || ''), 'switcher has no accessible name');
  await sw.focus(); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(500);
  ok(await sw.getAttribute('aria-expanded') === 'true', 'ArrowDown does not open the switcher');
  const items = (await menu.allTextContents()).map((t) => t.trim());
  ok(items.length === 5 && ['Logbook', 'Currency', 'Milestones', 'Costs', 'Weather'].every((n) => items.includes(n)), `switcher pages: ${items.join(', ')}`);
  await menu.first().focus(); await p.keyboard.press('ArrowDown');
  ok(await p.evaluate(() => (document.activeElement && document.activeElement.textContent || '').trim()) === 'Currency', 'ArrowDown does not move to the next page');
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  ok(await sw.getAttribute('aria-expanded') === 'false', 'Escape does not close the switcher');
  ok(await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('bc-sw')), 'Escape does not return focus to the switcher');
  for (const [name, re] of [['Currency', /currency/], ['Milestones', /milestones/], ['Costs', /costs/], ['Weather', /weather/], ['Logbook', /logbook$/]]) {
    await p.locator('.bc-sw').click(); await p.waitForTimeout(400);
    await menu.filter({ hasText: name }).click(); await p.waitForTimeout(800);
    ok(re.test(new URL(p.url()).pathname), `switcher: "${name}" went to ${new URL(p.url()).pathname}`);
    ok(await p.locator('.bc-sw').count() === 1, `switcher missing on ${name}`);
  }
  await ctx.close();
}

// ---- Add button: hides on scroll down, returns on scroll up, never covers hours (list) or the last Ledger column
for (const ledger of [false, true]) {
  const name = ledger ? 'Ledger' : 'List';
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await fresh(p, ledger);
  if (!ledger) await openAll(p);
  const fab = p.locator('.ds-fab');
  await p.mouse.move(200, 400);
  await p.mouse.wheel(0, 500); await p.waitForTimeout(250);
  ok(await fab.getAttribute('data-hidden') === 'true', `${name}: Add button stays visible while scrolling down`);
  await p.mouse.wheel(0, -200); await p.waitForTimeout(350);
  ok(await fab.getAttribute('data-hidden') === null, `${name}: Add button does not return on scroll up`);
  const sels = ledger ? ['.mn-led td:last-child', '.mn-led th:last-child'] : ['.bc-row .v'];
  for (const y of [0, 300, 700, 1200, 1000000]) {
    await p.evaluate((yy) => scrollTo(0, yy), y); await p.waitForTimeout(1300);
    const hit = await p.evaluate((ss) => {
      const fe = document.querySelector('.ds-fab'); if (!fe || fe.dataset.hidden) return [];
      const f = fe.getBoundingClientRect(); const out = [];
      for (const s of ss) for (const e of document.querySelectorAll(s)) {
        let r = e.getBoundingClientRect(); if (r.width === 0) continue;
        const clip = e.closest('.mn-led-wrap'); if (clip) { const c = clip.getBoundingClientRect(); r = { left: Math.max(r.left, c.left), right: Math.min(r.right, c.right), top: r.top, bottom: r.bottom }; if (r.right <= r.left) continue; } // only what is visible: a cell clipped by its scroller is not under the button
        if (r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight && r.left < f.right && r.right > f.left && r.top < f.bottom && r.bottom > f.top) out.push(e.textContent.trim().slice(0, 12));
      }
      return out;
    }, sels);
    ok(hit.length === 0, `${name} @scroll ${y === 1000000 ? 'end' : y}: Add button covers ${hit.join(', ')}`);
  }
  await ctx.close();
}

await browser.close();
if (fails.length) { console.error(`${fails.length} of ${checks} logbook checks FAILED:`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`${checks}/${checks} logbook behaviour checks passed`);
