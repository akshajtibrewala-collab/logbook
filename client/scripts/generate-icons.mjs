// Draws the app icon and writes every size the browser, iOS and Android need into client/public.
//   npm run icons -w client
// The artwork lives in this file — a wing-chevron "A" (sky blue) with a thick route arc through it
// (violet) as the crossbar; edit WING/ARC and re-run to change the icon.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const pub = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(path.join(pub, 'icons'), { recursive: true });

const NAVY = '#07090d'; // matches manifest.json's background_color/theme_color
const SKY = '#38bdf8'; // the app's route/accent color
const VIOLET = '#a78bfa'; // the app's passenger/role-pax color

// A bold chevron shaped like a capital "A": a solid triangle with a V notch cut from its base-center
// (apex at 256,264), so the two "legs" read as the letter's strokes. One filled path, no thin strokes.
const WING = 'M256,110 L372,392 L306,392 L256,264 L206,392 L140,392 Z';
// A thick ring-segment "route arc" crossing through the chevron's notch as the letter's crossbar —
// overlapping the legs on both sides so it reads as a real crossbar, not just a sliver in the gap.
// Ring width is 60px (at the 0-512 viewBox) so it's still a clearly visible band once scaled to 32px.
const ARC = 'M106,360 A150,150 0 0 1 406,360 L346,360 A90,90 0 0 0 166,360 Z';

// Every corner of WING/ARC sits at most ~183px from the icon's center (256,256) — comfortably inside the
// ~205px-radius safe-zone circle (512 * 0.8 / 2) Android's circular/maskable crop uses — so the same
// artwork, undistorted, works for the rounded tile, the favicon and the maskable icon with no extra scale.
function art() {
  return `<path d="${WING}" fill="${SKY}"/><path d="${ARC}" fill="${VIOLET}"/>`;
}

// corner: 'rounded' = a tile with rounded corners (favicon, apple-touch, "any"-purpose PWA icons);
//         'square'  = edge-to-edge, for the maskable icon, which the OS crops to its own shape (a circle
//                     on stock Android) — content must stay inside the safe-zone circle (see `art`).
// border: adds a subtle light edge so the tile doesn't disappear into dark browser chrome or a dark
//         phone wallpaper at a glance (it read as near-invisible without this).
function tile({ corner, border = true }) {
  const rx = corner === 'rounded' ? 112 : 0;
  const edge = border
    ? `<rect x="1.5" y="1.5" width="509" height="509" rx="${Math.max(0, rx - 1)}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="3"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="${rx}" fill="${NAVY}"/>
  ${art()}
  ${edge}
</svg>`;
}

const variants = {
  favicon: tile({ corner: 'rounded' }),
  // apple-touch-icon and the 192 & 512 "any"-purpose PWA icons: same artwork, rounded tile.
  rounded: tile({ corner: 'rounded' }),
  // Maskable: same artwork, full-bleed square (no border) — the OS applies its own crop/mask.
  maskable: tile({ corner: 'square', border: false }),
};

/** Renders at the target size; for tiny favicon sizes, a mild sharpen keeps the edges crisp rather than soft. */
const png = async (source, size, { crisp = false } = {}) => {
  let img = sharp(Buffer.from(source), { density: 384 }).resize(size, size);
  if (crisp) img = img.sharpen({ sigma: 0.5 });
  return img.png({ compressionLevel: 9 }).toBuffer();
};
const write = (file, data) => writeFileSync(path.join(pub, file), data);

/** .ico container holding PNG images (supported by every current browser). */
function ico(images) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2); // type: icon
  head.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([head, ...entries, ...images.map((i) => i.data)]);
}

write('favicon.svg', variants.favicon);
write('favicon.ico', ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(variants.favicon, size, { crisp: size <= 32 }) })))));
write('favicon-32.png', await png(variants.favicon, 32, { crisp: true }));
write('apple-touch-icon.png', await png(variants.rounded, 180)); // iOS rounds the corners itself, so no transparency
for (const size of [192, 512]) {
  write(`icons/icon-${size}.png`, await png(variants.rounded, size));
  write(`icons/icon-maskable-${size}.png`, await png(variants.maskable, size));
}
console.log('Icons written to client/public');
