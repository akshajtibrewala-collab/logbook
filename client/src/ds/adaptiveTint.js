// Adaptive tint for glass: nearly clear when the content behind is dark, a higher-tint scrim when it is bright.
// Pure functions (tested); the DOM sampler is in glass.js. Thresholds are the dark-theme values measured in
// docs/design/contrast2.mjs: with them text on glass stays >= 6.1:1 (secondary >= 5.2:1, accent icons >= 3.3:1)
// over every gray backdrop 0-255, even if the sampler under-reads the backdrop luminance by 0.05.

export const TINT_UP = 0.08; // clear -> scrim when the sampled backdrop luminance rises above this
export const TINT_DOWN = 0.07; // scrim -> clear only once it falls below this (hysteresis stops flicker)

export function relLuminance(r, g, b) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Parses "rgb(1, 2, 3)" / "rgba(1 2 3 / .5)" / "color(srgb ...)"-free browser output; null when unparseable. */
export function parseColor(str) {
  const m = typeof str === 'string' && str.match(/[\d.]+/g);
  if (!m || m.length < 3) return null;
  return { r: +m[0], g: +m[1], b: +m[2], a: m.length > 3 ? +m[3] : 1 };
}

/** Next tint state for one glass element, given its current state ('lo' | 'hi') and the sampled luminance. */
export function nextTintState(current, lum) {
  if (current === 'hi') return lum < TINT_DOWN ? 'lo' : 'hi';
  return lum > TINT_UP ? 'hi' : 'lo';
}

// ---- busyness: brightness alone is not enough. A map's dark land, sea, route lines and labels are dark on average yet
// busy and coloured, and the glass's saturation boost turns that into a mottled multicolour panel. Over a busy backdrop
// the glass switches to a neutral, higher-tint, heavier-blur state with NO saturation boost (see glass.css [data-busy]).
export const BUSY_UNKNOWN_UP = 0.25; // share of samples over pixels we cannot read (map tiles, canvas, images, video)
export const BUSY_UNKNOWN_DOWN = 0.1;
export const BUSY_CHROMATIC = 0.12; // a sample is "coloured" when (max - min) / 255 of its colour is above this
export const BUSY_COLOR_SHARE_UP = 0.3; // share of coloured samples that, with hue or brightness spread, makes it busy
export const BUSY_HUE_SPREAD_DEG = 35; // circular standard deviation of the coloured samples' hues
export const BUSY_LUM_RANGE_UP = 0.12; // p90 - p10 of the sampled luminance
export const BUSY_LUM_RANGE_DOWN = 0.04;

/** (max - min) / 255 of an sRGB colour: 0 for any gray, up to 1 for a fully saturated one. */
export const chromaOf = (r, g, b) => (Math.max(r, g, b) - Math.min(r, g, b)) / 255;

/** Hue in degrees (0..360) of an sRGB colour, or null for a gray (no hue to speak of). */
export function hueOf(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d / 255 < 0.04) return null;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** Circular standard deviation of hues in degrees (0 = all the same hue). */
export function hueSpread(hues) {
  if (hues.length < 2) return 0;
  let c = 0, s = 0;
  for (const h of hues) { c += Math.cos((h * Math.PI) / 180); s += Math.sin((h * Math.PI) / 180); }
  const R = Math.hypot(c, s) / hues.length;
  return R <= 1e-9 ? 180 : (Math.sqrt(-2 * Math.log(Math.min(1, R))) * 180) / Math.PI;
}

/**
 * Busyness of a set of samples. Each sample is { lum, rgb?, unknown? }: `unknown` marks pixels we cannot read from the DOM
 * (map tiles, canvas, images), which are treated as busy; `rgb` is a known flat colour.
 */
export function busyMetrics(samples) {
  const n = samples.length || 1;
  const lums = samples.map((s) => s.lum);
  const known = samples.filter((s) => s.rgb);
  const coloured = known.filter((s) => chromaOf(s.rgb.r, s.rgb.g, s.rgb.b) >= BUSY_CHROMATIC);
  return {
    unknownShare: samples.filter((s) => s.unknown).length / n,
    colorShare: coloured.length / n,
    hueSpread: hueSpread(coloured.map((s) => hueOf(s.rgb.r, s.rgb.g, s.rgb.b)).filter((h) => h !== null)),
    lumRange: percentile(lums, 0.9) - percentile(lums, 0.1),
  };
}

/** Next busy state ('calm' | 'busy') for one glass element, with hysteresis so it does not flicker at a threshold. */
export function nextBusyState(current, m) {
  if (current === 'busy') return m.unknownShare < BUSY_UNKNOWN_DOWN && m.lumRange < BUSY_LUM_RANGE_DOWN && m.colorShare < BUSY_COLOR_SHARE_UP / 2 ? 'calm' : 'busy';
  const mottled = m.colorShare >= BUSY_COLOR_SHARE_UP && (m.hueSpread >= BUSY_HUE_SPREAD_DEG || m.lumRange >= BUSY_LUM_RANGE_DOWN);
  return m.unknownShare >= BUSY_UNKNOWN_UP || m.lumRange >= BUSY_LUM_RANGE_UP || mottled ? 'busy' : 'calm';
}

/** p in 0..1; conservative percentile of the sampled luminances (dark glass has light text, so bright spots matter). */
export function percentile(values, p) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
}
