// Draws the app icon (direction C "Large Type", on true black) and writes every size the browser, iOS and Android need.
//   npm run icons -w client            writes client/public/*  (master SVG, favicons, apple-touch, PWA icons)
//   npm run icons -w client -- --preview   also writes docs/design/icon-preview.png (512 / 192 / 64 / 32 side by side)
// The artwork lives in this file: a heavy white capital "A" (one filled chevron shape) with a sky-blue flight arc as the
// crossbar and a violet destination dot — sky = pilot, violet = passenger, the app's only two accent colours.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, '..', 'public');
mkdirSync(path.join(pub, 'icons'), { recursive: true });

const BLACK = '#000000'; // matches manifest.json background_color/theme_color and index.html
const WHITE = '#f5f5f7';
const SKY = '#5bb9ff'; // --ds-pilot
const VIOLET = '#b7a0ff'; // --ds-pax

// 1024 viewBox. Outer apex (512,150), legs 120 wide at the base (y=800), inner apex (512,465) on the same slope.
const A = 'M512,150 L760,800 L640,800 L512,465 L384,800 L264,800 Z';
const ARC = 'M300,705 Q512,545 724,705';
// Every point sits within ~380px of the centre (512,512), inside the 410px safe-zone radius (80% of 1024 / 2) that
// Android's circular maskable crop keeps, so the same artwork works full-bleed for the maskable icon unchanged.
const art = () => `<path d="${A}" fill="${WHITE}"/><path d="${ARC}" fill="none" stroke="${SKY}" stroke-width="72" stroke-linecap="round"/><circle cx="724" cy="705" r="46" fill="${VIOLET}"/>`;

// corner 'rounded' = a tile with rounded corners (favicon, "any" PWA icons); 'square' = edge to edge (maskable, apple-touch: opaque).
const tile = ({ corner, edge = false }) => {
  const rx = corner === 'rounded' ? 224 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" rx="${rx}" fill="${BLACK}"/>
  ${art()}
  ${edge ? `<rect x="3" y="3" width="1018" height="1018" rx="${Math.max(0, rx - 3)}" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="6"/>` : ''}
</svg>`;
};

const variants = { master: tile({ corner: 'square' }), rounded: tile({ corner: 'rounded', edge: true }), square: tile({ corner: 'square' }) };

const png = async (svg, size, { crisp = false } = {}) => {
  let img = sharp(Buffer.from(svg), { density: 384 }).resize(size, size);
  if (crisp) img = img.sharpen({ sigma: 0.5 });
  return img.png({ compressionLevel: 9 }).toBuffer();
};
const write = (file, data) => writeFileSync(path.join(pub, file), data);

/** .ico container holding PNG images (supported by every current browser). */
function ico(images) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(data.length, 8); e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([head, ...entries, ...images.map((i) => i.data)]);
}

write('icon-master.svg', variants.master); // 1024, full-bleed black square: the source for everything below
write('favicon.svg', variants.rounded);
write('favicon.ico', ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(variants.rounded, size, { crisp: size <= 32 }) })))));
write('favicon-32.png', await png(variants.rounded, 32, { crisp: true }));
write('apple-touch-icon.png', await png(variants.square, 180)); // 180x180, opaque black; iOS rounds the corners itself
for (const size of [192, 512]) write(`icons/icon-${size}.png`, await png(variants.rounded, size));
for (const size of [192, 512]) write(`icons/icon-maskable-${size}.png`, await png(variants.square, size));
console.log('Icons written to client/public');

if (process.argv.includes('--preview')) {
  const sizes = [512, 192, 64, 32], pad = 40, w = sizes.reduce((a, s) => a + s + pad, pad), h = 512 + pad * 2;
  const layers = []; let x = pad;
  for (const s of sizes) { layers.push({ input: await png(variants.rounded, s, { crisp: s <= 64 }), left: x, top: pad + Math.round((512 - s) / 2) }); x += s + pad; }
  const out = path.join(here, '..', '..', 'docs', 'design', 'icon-preview.png');
  await sharp({ create: { width: w, height: h, channels: 3, background: '#1c1c1e' } }).composite(layers).png().toFile(out);
  console.log('Preview written to docs/design/icon-preview.png');
}
