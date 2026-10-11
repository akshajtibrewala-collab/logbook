// Map tile health, as pure functions. The Esri canvas services answer with HTTP 200 and a light-gray "Map data not yet available" picture wherever they have no
// detail at a zoom (open ocean from zoom 13, everywhere from 17). On the app's dark map that picture reads as a white screen. The Map replaces such a tile with
// an empty one (the dark surface shows through) and says so calmly instead.

/** The tile is the provider's light placeholder: its mean luminance (0-255) is far above any tile of the dark canvas (flat land is about 40, never above about 90). */
export const isPlaceholderMean = (mean, threshold = 150) => typeof mean === 'number' && Number.isFinite(mean) && mean > threshold;

/** Mean luminance (0-255) of RGBA pixel data (a downscaled tile). NaN for empty data. */
export function meanLuminance(rgba) {
  const n = Math.floor((rgba?.length ?? 0) / 4);
  if (!n) return NaN;
  let s = 0;
  for (let i = 0; i < n * 4; i += 4) s += 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2];
  return s / n;
}

/**
 * The calm note for the tiles of the current view, or null. `loaded` are real tiles, `placeholders` the provider's "no data" tiles (replaced by empty ones),
 * `errors` tiles that failed twice. With fewer than 4 tiles settled there is nothing to say yet.
 */
export function tileNote({ loaded = 0, placeholders = 0, errors = 0, online = true }) {
  const total = loaded + placeholders + errors;
  if (total < 4) return null;
  if (errors / total >= 0.6) return online ? "Map tiles aren't loading right now" : 'Offline: map tiles unavailable';
  if (placeholders / total >= 0.6) return "No map detail here at this zoom";
  return null;
}

/** The same tile URL with a retry marker the provider ignores, so a failed request is really made again (a cached error is not reused). */
export const retryUrl = (src) => `${src}${String(src).includes('?') ? '&' : '?'}retry=1`;
