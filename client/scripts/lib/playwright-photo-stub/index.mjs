// A drop-in PLAYWRIGHT_CORE for the verification scripts that must never contact the real aircraft-photo service (Planespotters).
// It re-exports the real playwright-core, but every context it creates blocks service workers (so route() sees every request; the app's
// own worker only handles map tiles) and answers the photo hosts with a stub: the API with one invented photo, the image with a 1px
// PNG, the photo's own page with a blank page. Nothing else changes. Not for the map checks, which rely on the real service worker.
//   PLAYWRIGHT_REAL_CORE=<path to playwright-core> PLAYWRIGHT_CORE=client/scripts/lib/playwright-photo-stub node client/scripts/check-words.mjs
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const real = process.env.PLAYWRIGHT_REAL_CORE;
if (!real) throw new Error('Set PLAYWRIGHT_REAL_CORE to the real playwright-core folder.');
const mod = await import(pathToFileURL(path.join(real, 'index.mjs')).href);
const pw = mod.default ?? mod;

const HOSTS = /^https:\/\/(api\.planespotters\.net|t\.plnspttrs\.net|cdn\.planespotters\.net|www\.planespotters\.net)\//;
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const BODY = JSON.stringify({ photos: [{ id: '000000', thumbnail: { src: 'https://t.plnspttrs.net/00000/stub_t.png', size: { width: 200, height: 133 } },
  thumbnail_large: { src: 'https://t.plnspttrs.net/00000/stub_280.png', size: { width: 420, height: 280 } }, link: 'https://www.planespotters.net/photo/000000/stub?utm_source=api', photographer: 'Stub Photographer' }] });

async function stub(ctx) {
  await ctx.route(HOSTS, (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === 'api.planespotters.net') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: BODY });
    if (u.hostname === 't.plnspttrs.net' || u.hostname === 'cdn.planespotters.net') return route.fulfill({ status: 200, headers: { 'content-type': 'image/png' }, body: PIXEL });
    return route.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: '<!doctype html><title>stub</title>' });
  });
  return ctx;
}

function wrap(type) {
  const launch = type.launch.bind(type);
  return new Proxy(type, {
    get(t, k) {
      if (k !== 'launch') { const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; }
      return async (...a) => {
        const browser = await launch(...a);
        const newContext = browser.newContext.bind(browser);
        browser.newContext = async (o = {}) => stub(await newContext({ ...o, serviceWorkers: 'block' }));
        browser.newPage = async (o = {}) => (await browser.newContext(o)).newPage();
        return browser;
      };
    },
  });
}

const patched = { ...pw, chromium: wrap(pw.chromium), webkit: wrap(pw.webkit), firefox: pw.firefox ? wrap(pw.firefox) : undefined };
export const { chromium, webkit, firefox, devices } = patched;
export default patched;
