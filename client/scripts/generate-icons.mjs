// Draws the app icon and writes every size the browser, iOS and Android need into client/public.
//   npm run icons -w client
// The artwork lives in this file (a plane inside a compass ring); edit it and re-run to change the icon.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const pub = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(path.join(pub, 'icons'), { recursive: true });

// A plane pointing straight up, centered on (0,0), about 220 units across. Parts are separate <path>s: inside one
// path, overlapping shapes with opposite winding would punch holes where wings meet the fuselage.
const PLANE_PARTS = [
  'M0,-104 C10,-104 14,-90 14,-70 L14,80 C14,92 8,104 0,110 C-8,104 -14,92 -14,80 L-14,-70 C-14,-90 -10,-104 0,-104 Z', // fuselage
  'M12,-20 L108,52 L108,72 L12,34 Z', 'M-12,-20 L-108,52 L-108,72 L-12,34 Z', // wings
  'M10,72 L48,100 L48,116 L10,100 Z', 'M-10,72 L-48,100 L-48,116 L-10,100 Z', // tailplane
];

/**
 * corner: 'rounded' = a tile with rounded corners on a transparent background (favicon, "any" icons);
 *         'square'  = edge-to-edge, for iOS and Android's maskable icons, which apply their own mask.
 * ring:   compass ring with ticks (dropped at tiny sizes where it would just be noise).
 * plane:  size of the plane. Keep ring + plane inside the middle 80% so masks never clip them.
 */
function svg({ corner, ring, plane }) {
  const rx = corner === 'rounded' ? 112 : 0;
  const ticks = [0, 90, 180, 270]
    .map((a) => `<line x1="256" y1="${a === 0 ? 62 : 68}" x2="256" y2="88" stroke="#38bdf8" stroke-opacity="${a === 0 ? 1 : 0.55}" stroke-width="7" stroke-linecap="round" transform="rotate(${a} 256 256)"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2a4a"/><stop offset="1" stop-color="#07090d"/></linearGradient>
    <radialGradient id="glow" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#38bdf8" stop-opacity="0.24"/><stop offset="1" stop-color="#38bdf8" stop-opacity="0"/></radialGradient>
    <linearGradient id="plane" gradientUnits="userSpaceOnUse" x1="0" y1="-110" x2="0" y2="110"><stop offset="0" stop-color="#bae6fd"/><stop offset="1" stop-color="#38bdf8"/></linearGradient>
  </defs>
  <rect width="512" height="512" rx="${rx}" fill="url(#bg)"/>
  <rect width="512" height="512" rx="${rx}" fill="url(#glow)"/>
  ${ring ? `<circle cx="256" cy="256" r="188" fill="none" stroke="#38bdf8" stroke-opacity="0.35" stroke-width="6"/>${ticks}` : ''}
  <g transform="translate(256 256) rotate(45) scale(${plane})">${PLANE_PARTS.map((d) => `<path d="${d}" fill="url(#plane)"/>`).join("")}</g>
</svg>`;
}

const FULL = { ring: true, plane: 1.25 };
const variants = {
  favicon: svg({ corner: 'rounded', ring: false, plane: 1.6 }),
  rounded: svg({ corner: 'rounded', ...FULL }),
  square: svg({ corner: 'square', ...FULL }),
};

const png = (source, size) => sharp(Buffer.from(source), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
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
write('favicon.ico', ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(variants.favicon, size) })))));
write('apple-touch-icon.png', await png(variants.square, 180)); // iOS rounds the corners itself, so no transparency
for (const size of [192, 512]) {
  write(`icons/icon-${size}.png`, await png(variants.rounded, size));
  write(`icons/icon-maskable-${size}.png`, await png(variants.square, size));
}
console.log('Icons written to client/public');
