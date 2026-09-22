// Draws the app icon and writes every size the browser, iOS and Android need into client/public.
//   npm run icons -w client
// The artwork lives in this file — a swept-wing silhouette (shared by the favicon and the large tile)
// above three stacked "logbook" lines on the large tile only; edit it and re-run to change the icon.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const pub = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(path.join(pub, 'icons'), { recursive: true });

// A swept-wing delta silhouette, centered on (256,256) in a 0-512 viewBox. The "root kink" partway down
// each leading edge (300,168 / 212,168) pulls the edge in toward the fuselage before it flares to the
// wingtip — this is what reads as "wings on a fuselage" rather than a solid arrowhead/cursor — and the
// shallow V at the trailing edge (278,268 -> 256,300 -> 234,268) suggests a tail cut. One filled path,
// no thin strokes, so it survives being shrunk to a 16px favicon (as a simpler bold triangle, once the
// concave detail is too fine to render at that size — not as anything resembling a pin or cursor).
const WING = 'M256,88 L300,168 L446,320 L278,268 L256,300 L234,268 L66,320 L212,168 Z';

const DEFS = `
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#24365c"/><stop offset="1" stop-color="#0a0f1c"/></linearGradient>
  <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bae6fd"/><stop offset="1" stop-color="#38bdf8"/></linearGradient>
`;

// corner: 'rounded' = a tile with rounded corners (favicon, apple-touch, "any"-purpose PWA icons);
//         'square'  = edge-to-edge, for the maskable icon, which the OS crops to its own shape (a circle
//                     on stock Android) — content must stay inside the safe-zone circle (see `scale`).
// border: adds a subtle light edge + lightened gradient top so the tile doesn't disappear into dark
//         browser chrome or a dark phone wallpaper at a glance (it read as near-invisible without this).
function tile({ corner, content, border = true }) {
  const rx = corner === 'rounded' ? 112 : 0;
  const edge = border
    ? `<rect x="1.5" y="1.5" width="509" height="509" rx="${Math.max(0, rx - 1)}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="3"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>${DEFS}</defs>
  <rect width="512" height="512" rx="${rx}" fill="url(#bg)"/>
  ${content}
  ${edge}
</svg>`;
}

const LOG_LINES = `
    <rect x="146" y="336" width="220" height="30" rx="15" fill="url(#fg)"/>
    <rect x="176" y="384" width="160" height="30" rx="15" fill="url(#fg)" opacity="0.72"/>
    <rect x="206" y="432" width="100" height="30" rx="15" fill="url(#fg)" opacity="0.48"/>`;

const variants = {
  // Favicon: the wing alone, enlarged since there are no log lines competing for space.
  favicon: tile({ corner: 'rounded', content: `<g transform="translate(256 256) scale(1.28) translate(-256 -256)"><path d="${WING}" fill="url(#fg)"/></g>` }),
  // apple-touch-icon / the 192 & 512 "any"-purpose PWA icons: wing + log lines, rounded tile.
  rounded: tile({ corner: 'rounded', content: `<path d="${WING}" fill="url(#fg)"/>${LOG_LINES}` }),
  // Maskable: same content, scaled to 0.78x and centered. Worst-case corner (the bottom log line's
  // outer-bottom corner) sits at ~166px from center once scaled, comfortably inside the ~205px-radius
  // safe-zone circle (512 * 0.8 / 2) that Android's circular crop uses — see check-maskable-crop.mjs.
  maskable: tile({ corner: 'square', border: false, content: `<g transform="translate(256 256) scale(0.78) translate(-256 -256)"><path d="${WING}" fill="url(#fg)"/>${LOG_LINES}</g>` }),
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
