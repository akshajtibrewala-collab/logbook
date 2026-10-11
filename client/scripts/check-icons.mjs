// ICON CHECK (read-only, runs against the BUILT output in client/dist; build first with `npx vite build`). An iOS home-screen icon comes from the page's
// apple-touch-icon link, and an installed app's from the manifest; this fails unless both point at real, correctly sized PNG files that are really in the build:
//   - index.html has the apple-touch-icon link, the manifest link and the favicon links, and every file they name exists in dist
//   - both apple-touch-icon files (-v2 first, then the default name) are real PNGs (signature, not an HTML fallback page), exactly 180 x 180, and opaque (iOS fills transparency with black)
//   - every icon in manifest.json exists, is a real PNG, and has the size the manifest declares; maskable icons are opaque (they are cropped to a shape)
//   - the manifest's id, start_url and scope are still "/" (changing them would make the installed app a different app)
//   node client/scripts/check-icons.mjs [--dist client/dist]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const DIST = path.resolve(arg('--dist', path.join(here, '..', 'dist')));
const bad = []; const rows = [];
const fail = (m) => bad.push(m);
if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error(`No build at ${DIST}: run "npx vite build" in client/ first.`); process.exit(2); }

const SIG = '89504e470d0a1a0a';
const fileOf = (href) => path.join(DIST, href.split('?')[0].replace(/^\//, ''));
async function png(href, what, expect = {}) {
  const f = fileOf(href);
  if (!fs.existsSync(f)) { fail(`${what}: ${href} is not in the build`); return; }
  const b = fs.readFileSync(f);
  if (b.subarray(0, 8).toString('hex') !== SIG) { fail(`${what}: ${href} is not a PNG (the first bytes are not a PNG signature)`); return; }
  const m = await sharp(b).metadata(); let opaque = true;
  if (m.hasAlpha) { const s = await sharp(b).stats(); opaque = s.channels[3].min === 255; }
  if (expect.w && (m.width !== expect.w || m.height !== expect.h)) fail(`${what}: ${href} is ${m.width}x${m.height}, expected ${expect.w}x${expect.h}`);
  if (expect.opaque && !opaque) fail(`${what}: ${href} has transparent pixels`);
  rows.push(`${what.padEnd(34)} ${href.padEnd(30)} ${m.width}x${m.height}  ${opaque ? 'opaque' : 'transparent parts'}`);
}

const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
const attr = (tag, a) => { const m = tag.match(new RegExp('[ \\t]' + a + '[ ]*=[ ]*"([^"]*)"', 'i')); return m ? m[1] : undefined; };
const touch = links.filter((l) => /rel="apple-touch-icon"/i.test(l));
// Two links, in this order: the versioned file first (sizes="180x180", a new name no old cache can hold), then the default /apple-touch-icon.png that iOS asks for by itself.
if (touch.length !== 2) fail(`index.html must have exactly two apple-touch-icon links, the -v2 file first (found ${touch.length})`);
else {
  if (attr(touch[0], 'href') !== '/apple-touch-icon-v2.png') fail(`the first apple-touch-icon link must be /apple-touch-icon-v2.png (found ${attr(touch[0], 'href')})`);
  if (attr(touch[0], 'sizes') !== '180x180') fail(`the first apple-touch-icon link must declare sizes="180x180" (found ${attr(touch[0], 'sizes')})`);
  if (attr(touch[1], 'href') !== '/apple-touch-icon.png') fail(`the second apple-touch-icon link must be /apple-touch-icon.png (found ${attr(touch[1], 'href')})`);
}
for (const t of touch) await png(attr(t, 'href'), 'apple-touch-icon (iOS home screen)', { w: 180, h: 180, opaque: true });
// the default path is requested directly by iOS whatever the markup says: it must exist and be valid even if no link names it
if (!touch.some((t) => attr(t, 'href') === '/apple-touch-icon.png')) await png('/apple-touch-icon.png', 'apple-touch-icon (default path)', { w: 180, h: 180, opaque: true });
for (const l of links.filter((x) => /rel="icon"/i.test(x))) {
  const href = attr(l, 'href'); if (!href) { fail('an icon link has no href'); continue; }
  if (!fs.existsSync(fileOf(href))) fail(`favicon ${href} is not in the build`); else rows.push(`${'favicon link'.padEnd(34)} ${href}`);
}
const man = links.find((l) => /rel="manifest"/i.test(l));
if (!man) fail('index.html has no manifest link');
else {
  const mf = fileOf(attr(man, 'href'));
  if (!fs.existsSync(mf)) fail(`the manifest ${attr(man, 'href')} is not in the build`);
  else {
    const j = JSON.parse(fs.readFileSync(mf, 'utf8'));
    for (const k of ['id', 'start_url', 'scope']) if (j[k] !== '/') fail(`manifest ${k} is ${JSON.stringify(j[k])}, expected "/" (it must not change)`);
    if (!Array.isArray(j.icons) || !j.icons.length) fail('the manifest lists no icons');
    for (const ic of j.icons || []) {
      const [w, h] = String(ic.sizes).split('x').map(Number);
      if (ic.type !== 'image/png') fail(`manifest icon ${ic.src}: type ${ic.type}, expected image/png`);
      await png(ic.src, `manifest icon (${ic.purpose || 'any'})`, { w, h, opaque: ic.purpose === 'maskable' });
    }
  }
}
console.log(rows.join('\n'));
console.log(`\nicons: ${bad.length} problem(s)`);
for (const b of bad) console.log('  ' + b);
process.exit(bad.length ? 1 : 0);
