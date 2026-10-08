// CHUNK-LOAD RECOVERY CHECK. A lazy page can fail to load after a deploy (the old hashed file is gone). This simulates a missing chunk on the SCRATCH build and fails unless:
//   A  one failure recovers by itself: a calm "Updated, reloading" note, exactly one automatic reload, then the page works (and the one-reload guard flag is set)
//   B  a persistent failure never loops: after the one reload the page shows "Couldn't load." with a single "Tap to reload" action; fixing the cause and tapping it loads the page
//   C  the offline outbox and a log-a-flight draft in localStorage are byte-for-byte unchanged through A and B (their keys are never touched)
//   D  a failure of the Travel page chunk (a different route) recovers the same way
// It writes nothing to the API; the only storage it writes is two test entries in the browser profile it creates itself.
//
//   PLAYWRIGHT_CORE=<..> BROWSER_EXE=<..> node client/scripts/check-chunk-recovery.mjs [--base http://localhost:4174]
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://localhost:4174');
if (!process.env.PLAYWRIGHT_CORE || !process.env.BROWSER_EXE) { console.error('Set PLAYWRIGHT_CORE and BROWSER_EXE.'); process.exit(2); }
const { chromium } = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);
const rows = []; const fails = [];
const rec = (check, ok, detail = '') => { rows.push({ check, result: ok ? 'pass' : 'FAIL', detail }); if (!ok) fails.push(`${check} ${detail}`); };
// marked `rejected` so the app never tries to send it (it only keeps it listed): this check must not write anything to the API
const OUTBOX = JSON.stringify([{ id: 'test-outbox', payload: { date: '2026-01-02', note: 'test' }, rejected: 'kept for the recovery test', attempts: 1 }]);
const DRAFT = JSON.stringify({ savedAt: 1, value: { date: '2026-01-02', remarks: 'test draft' } });

const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXE });
async function session(chunk, failFirstOnly) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await ctx.route(/arcgisonline|basemaps\.cartocdn|tile\.openstreetmap/, (r) => r.abort());
  const state = { hits: 0, broken: true };
  await ctx.route(new RegExp(`/assets/${chunk}-[^/]+\\.js`), (r) => { state.hits += 1; if (state.broken && (!failFirstOnly || state.hits === 1)) r.fulfill({ status: 404, body: 'gone' }); else r.continue(); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  let navs = 0; p.on('request', (r) => { if (r.isNavigationRequest() && r.frame() === p.mainFrame()) navs += 1; }); // real document loads only (not in-page route changes)
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await p.evaluate(([o, d]) => { localStorage.setItem('aerotrail-outbox', o); localStorage.setItem('aerotrail-draft:flight-new', d); sessionStorage.removeItem('aerohub-chunk-reload'); }, [OUTBOX, DRAFT]);
  await p.waitForTimeout(1800); // the idle prefetch tries (and fails) the chunk
  return { ctx, p, state, errs, navs: () => navs };
}
const keep = (p) => p.evaluate(() => [localStorage.getItem('aerotrail-outbox'), localStorage.getItem('aerotrail-draft:flight-new')]);
const nav = (p, name) => p.locator('.ds-tabbar a, .ds-rail a, nav a', { hasText: name }).first();

// A: one failure, then the chunk is back
{
  const s = await session('Logbook', true); const { p } = s; const before = s.navs();
  await nav(p, 'Flying').click();
  await p.waitForSelector('text=Updated, reloading', { timeout: 4000 }).then(() => rec('A: the calm "Updated, reloading" note shows', true), () => rec('A: the calm "Updated, reloading" note shows', false));
  await p.waitForSelector('.bc-hero', { timeout: 8000 }).then(() => rec('A: after the automatic reload the Logbook loads', true), () => rec('A: after the automatic reload the Logbook loads', false, 'no hero'));
  rec('A: exactly one automatic reload', s.navs() - before === 1, `navigations: ${s.navs() - before}`);
  rec('A: the one-reload guard flag is set', Boolean(await p.evaluate(() => sessionStorage.getItem('aerohub-chunk-reload'))));
  rec('A: outbox and draft untouched', JSON.stringify(await keep(p)) === JSON.stringify([OUTBOX, DRAFT]));
  rec('A: no unhandled page errors', s.errs.length === 0, s.errs.join(' | ').slice(0, 120));
  await s.ctx.close();
}
// B: the chunk stays missing
{
  const s = await session('Logbook', false); const { p } = s; const before = s.navs();
  await nav(p, 'Flying').click();
  await p.waitForSelector('text=Tap to reload', { timeout: 12000 }).then(() => rec('B: after one reload the page shows "Couldn\'t load" with "Tap to reload"', true), () => rec('B: after one reload the page shows "Couldn\'t load" with "Tap to reload"', false));
  await p.waitForTimeout(2500);
  rec('B: no reload loop (exactly one automatic reload)', s.navs() - before === 1, `navigations: ${s.navs() - before}`);
  rec('B: one single action', (await p.locator('[role="alert"] button').count()) === 1);
  rec('B: outbox and draft untouched', JSON.stringify(await keep(p)) === JSON.stringify([OUTBOX, DRAFT]));
  s.state.broken = false; await p.locator('text=Tap to reload').click();
  await p.waitForSelector('.bc-hero', { timeout: 8000 }).then(() => rec('B: once fixed, Tap to reload loads the page', true), () => rec('B: once fixed, Tap to reload loads the page', false));
  rec('B: outbox and draft still untouched', JSON.stringify(await keep(p)) === JSON.stringify([OUTBOX, DRAFT]));
  await s.ctx.close();
}
// D: another route
{
  const s = await session('PassengerFlights', true); const { p } = s;
  await nav(p, 'Travel').click();
  await p.waitForSelector('.bc-hero, [role="status"] >> text=Updated', { timeout: 4000 }).catch(() => {});
  await p.waitForSelector('.bc-hero', { timeout: 9000 }).then(() => rec('D: the Travel page recovers the same way', true), () => rec('D: the Travel page recovers the same way', false));
  await s.ctx.close();
}
await browser.close();
console.table(rows);
console.log(fails.length ? `\n${fails.length} chunk-recovery failure(s):\n - ${fails.join('\n - ')}` : '\nA missing chunk recovers once on its own, never loops, and never touches the outbox or the draft.');
process.exit(fails.length ? 1 : 0);
