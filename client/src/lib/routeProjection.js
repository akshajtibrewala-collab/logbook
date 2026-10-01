// An equirectangular-ish projection for the Home map preview: lays out [lat, lon] points into an SVG
// viewBox without pulling in Leaflet (or any map tiles) just to draw a static route overview. This is
// deliberately not navigation-grade — it's a glance-sized preview that links through to the real Map page
// for anything more. Three things make it behave well as the pilot's data grows, rather than only looking
// right for today's flights:
//
// 1. Antimeridian safety: longitudes are unwrapped relative to a reference point chosen from the WIDEST
//    GAP in the data (not always +/-180), so a route or coastline that actually crosses the date line is
//    drawn the short way instead of stretched across the whole width.
// 2. Span clamps: the visible span is floored (a tight local cluster still shows enough context to read as
//    "a place," not a blown-up smudge) and ceilinged at one wide-world view, cropped to roughly 70N-50S —
//    a pilot's own flights are never going to need the poles.
// 3. Outlier exclusion: if one or a few points sit far outside where the rest of the data lives (e.g. a
//    single intercontinental flight among many local ones), the FRAME fits the main cluster and lets the
//    outlier draw wherever its real coordinates land — which is usually off-canvas, clipped by the SVG
//    viewBox, rather than shrinking the whole cluster into an unreadable dot. See `OUTLIER_RADIUS_DEG`.

export const PADDING_FRAC = 0.08; // ~8% of the smaller dimension, on every side
export const MIN_SPAN_DEG = 14; // never zoom in tighter than this, even for airports a block apart
export const MAX_LAT_SPAN_DEG = 120; // the 70N..50S band below
export const LAT_CLAMP = [-50, 70];
// A point further than this (independently on each axis, longitude cos-adjusted) from the plain mean of
// all points is treated as an outlier and left out of the fit, so it can't single-handedly force the whole
// view to zoom out. Chosen generously — big enough that a pilot who flies mainland + Hawaii + Alaska, or
// mainland + the Caribbean, still gets one fitted cluster; only a genuinely different-continent/ocean-away
// flight (the "one trip to Sydney" case) gets excluded and left to draw off-canvas.
export const OUTLIER_RADIUS_DEG = 75;

/** Wraps `lon` to within (-180, 180] of `near`, i.e. picks the representative closest to `near`. */
function wrapNear(lon, near) {
  return near + (((lon - near + 180) % 360 + 360) % 360 - 180);
}

// The longitude "opposite" the widest empty gap in the data's longitudes — a safe place to treat the
// circle of longitude as cut, so a bounding box over the data never wraps the long way around (and is used
// as the default reference every point gets unwrapped relative to).
function referenceLon(lons) {
  const uniq = [...new Set(lons)];
  if (uniq.length <= 1) return uniq[0] ?? 0;
  const sorted = [...uniq].sort((a, b) => a - b);
  let maxGap = -1;
  let gapMid = 0;
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const b = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + 360;
    const gap = b - a;
    if (gap > maxGap) { maxGap = gap; gapMid = (a + b) / 2; }
  }
  return wrapNear(gapMid + 180, sorted[0]); // the representative point opposite the empty gap
}

/**
 * Builds a `([lat, lon], nearLon?) => [x, y]` projector fit to `points` within `width`x`height`. `nearLon`
 * lets a caller unwrap a point relative to something other than the data's own reference longitude — e.g.
 * a route segment unwraps its second endpoint relative to the first's raw longitude, so that one line
 * always takes the shorter path, independent of where the overall view happens to be centered. Returns
 * null when there are no points to fit.
 */
export function buildProjection(points, width, height, opts = {}) {
  if (!points.length) return null;
  const {
    paddingFrac = PADDING_FRAC, minSpanDeg = MIN_SPAN_DEG, maxLatSpanDeg = MAX_LAT_SPAN_DEG, latClamp = LAT_CLAMP,
    outlierRadiusDeg = OUTLIER_RADIUS_DEG,
  } = opts;

  const ref = referenceLon(points.map((p) => p[1]));
  const normPoints = points.map(([lat, lon]) => [lat, wrapNear(lon, ref)]);
  const midCos = Math.max(Math.cos((((Math.min(...normPoints.map((p) => p[0])) + Math.max(...normPoints.map((p) => p[0]))) / 2) * Math.PI) / 180), 0.15);

  // Pass 1: which points are the "main cluster"? A point further than outlierRadiusDeg from the plain mean
  // on either axis is set aside; fitting only kicks the outliers out when that still leaves most of the
  // data (so two genuinely distant but similar-sized groups don't collapse to an arbitrary half).
  let core = normPoints;
  if (normPoints.length > 2) {
    const meanLat = normPoints.reduce((s, p) => s + p[0], 0) / normPoints.length;
    const meanLon = normPoints.reduce((s, p) => s + p[1], 0) / normPoints.length;
    const kept = normPoints.filter(([lat, lon]) => Math.abs(lat - meanLat) <= outlierRadiusDeg && Math.abs(lon - meanLon) * midCos <= outlierRadiusDeg);
    if (kept.length > 0 && kept.length < normPoints.length) core = kept;
  }

  const lats = core.map((p) => p[0]);
  const lons = core.map((p) => p[1]);
  const minLat = Math.max(Math.min(...lats), latClamp[0]);
  const maxLat = Math.min(Math.max(...lats), latClamp[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const midLat = (minLat + maxLat) / 2;
  const cos = Math.max(Math.cos((midLat * Math.PI) / 180), 0.15);

  const padding = Math.min(width, height) * paddingFrac;
  const innerW = Math.max(width - padding * 2, 1);
  const innerH = Math.max(height - padding * 2, 1);

  const spanLon = Math.min(Math.max((maxLon - minLon) * cos, minSpanDeg * cos), 360 * cos);
  const spanLat = Math.min(Math.max(maxLat - minLat, minSpanDeg), maxLatSpanDeg);
  const scale = Math.min(innerW / spanLon, innerH / spanLat);

  // Centered on the core's own bounding box, not the full data's — every core point is guaranteed to fit
  // inside the padded box this way; an excluded outlier is not, and is left to the SVG viewBox to clip.
  const centerLon = (minLon + maxLon) / 2;
  const centerLat = (minLat + maxLat) / 2;

  return (point, nearLon = ref) => {
    const lon = wrapNear(point[1], nearLon);
    return [
      width / 2 + (lon - centerLon) * cos * scale,
      height / 2 - (point[0] - centerLat) * scale, // SVG y grows downward: north maps to smaller y
    ];
  };
}
