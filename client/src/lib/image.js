// Client-side photo compression: photos are shrunk to a sensible size before upload so they fit a
// serverless request body (and the database) comfortably.
export const MAX_EDGE = 1280;
export const JPEG_QUALITY = 0.72;

/** Scales (w, h) down to fit within `max` on the longer edge, never up. Whole pixels. */
export function fitWithin(w, h, max = MAX_EDGE) {
  if (!(w > 0) || !(h > 0)) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** Reads an image File, returns { data_url, width, height } as a resized JPEG. Browser only. */
export async function compressImage(file, { max = MAX_EDGE, quality = JPEG_QUALITY } = {}) {
  if (!file || !/^image\//.test(file.type)) throw new Error('That file isn’t an image.');
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error('Couldn’t read that image.');
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // JPEG has no transparency
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  return { data_url: canvas.toDataURL('image/jpeg', quality), width, height };
}
