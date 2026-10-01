// Turns the simplified land outline (landOutline.json) into an SVG path, projected with the exact same
// linear scale/center the Home map preview already uses for routes and airports (lib/routeProjection.js)
// — reusing those exact numbers is what keeps the land, routes and pins pixel-aligned, rather than two
// projections that merely agree on paper. See server/scripts/dev/generate-land-outline.js for where
// landOutline.json comes from and how to regenerate it.
//
// Natural Earth's 110m land data is ALREADY cut at +/-180 degrees (that's how a rectangular world dataset
// is distributed) — a ring never needs its longitude "unwrapped" to stay contiguous; every consecutive
// pair of points in the source data is already close together in raw degrees. routes/routeProjection.js's
// per-edge "nearest representative" wrapping is correct for a two-point ROUTE, where the shorter of two
// real paths must be chosen — but applying that same logic point-by-point along a closed ring is what used
// to tear rings apart into a stray edge sweeping across the whole frame. Land is projected here with NO
// wrapping at all: every point at its literal coordinate, via `project.rawX`/`project.rawY`. To still show
// correctly no matter where the frame is centered, each ring is drawn three times, shifted by a full
// 360-degree wrap each way (`project.wrapPx`) — whichever copy lines up with the visible frame renders
// normally, and the other two fall outside the SVG viewBox and are clipped, the standard technique for a
// wrapping world map.
//
// One real exception: Antarctica's ring (and any other landmass touching the bottom edge of a rectangular
// world dataset) closes by running along that bottom edge from +180 to -180 at the pole — a seam of the
// DATA FORMAT, not a geographic edge. Drawn raw, that single edge spans a full 360-degree wrap no matter
// which copy it's in, reproducing the exact artifact this file exists to avoid. SEAM_DELTA_DEG catches it:
// any consecutive pair further apart than that (real simplified coastline segments never are, even near
// the poles) starts a new subpath instead of being connected by a line.
const SEAM_DELTA_DEG = 300;

/** `rings` are flat [lon, lat, lon, lat, ...] arrays (GeoJSON order). Returns one SVG path `d` string. */
export function buildLandPath(rings, project) {
  if (!project || !rings?.length) return '';
  const parts = [];
  for (const ring of rings) {
    for (const dx of [-project.wrapPx, 0, project.wrapPx]) {
      let d = '';
      let prevLon;
      for (let i = 0; i < ring.length; i += 2) {
        const lon = ring[i];
        const lat = ring[i + 1];
        const x = project.rawX(lon) + dx;
        const y = project.rawY(lat);
        const atSeam = prevLon !== undefined && Math.abs(lon - prevLon) > SEAM_DELTA_DEG;
        d += (i === 0 || atSeam ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
        prevLon = lon;
      }
      parts.push(d + 'Z');
    }
  }
  return parts.join(' ');
}
