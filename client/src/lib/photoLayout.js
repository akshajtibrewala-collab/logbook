// Pure sizing logic for photos, so they keep their natural orientation instead of being cropped square.
// Each photo is laid out with its real aspect ratio (known up front from the stored width/height, so the
// page doesn't jump while images load); a photo whose size is unknown is measured when it loads.

export const FALLBACK_ASPECT = 4 / 3; // used only until an unmeasured photo has loaded
const MIN_ASPECT = 0.5; // taller than 1:2 is letterboxed inside a 1:2 box rather than towering over the page
const MAX_ASPECT = 2.4; // wider than 2.4:1 (a panorama) likewise

const valid = (n) => Number.isFinite(Number(n)) && Number(n) > 0;

/** 'landscape' | 'portrait' | 'square', or 'unknown' when the size isn't known. */
export function orientation(width, height) {
  if (!valid(width) || !valid(height)) return 'unknown';
  const r = Number(width) / Number(height);
  return r > 1.02 ? 'landscape' : r < 0.98 ? 'portrait' : 'square';
}

/** width / height, clamped to a sensible box; the fallback when the size is unknown. */
export function aspectOf(width, height, fallback = FALLBACK_ASPECT) {
  if (!valid(width) || !valid(height)) return fallback;
  return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, Number(width) / Number(height)));
}

/**
 * Style for one tile in a wrapping row of mixed photos: it takes width in proportion to its aspect ratio
 * (so a row of a wide and a tall photo comes out the same height), grows to fill spare room, and is
 * capped so its height never exceeds `maxHeight` — a lone tall photo can't take over the screen.
 */
export function tileStyle(ratio, rowHeight = 140, maxHeight = 320) {
  return {
    flex: `${ratio} 1 ${Math.round(ratio * rowHeight)}px`,
    maxWidth: `min(100%, ${Math.round(ratio * maxHeight)}px)`,
    aspectRatio: String(ratio),
  };
}

/**
 * Dimensions of an image after its EXIF orientation is applied. Orientations 5-8 mean the stored pixels
 * are rotated a quarter turn, so the displayed width and height are swapped.
 */
export function orientedSize(width, height, exifOrientation = 1) {
  return exifOrientation >= 5 && exifOrientation <= 8 ? { width: height, height: width } : { width, height };
}
