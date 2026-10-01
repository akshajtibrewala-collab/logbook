// Turns the simplified land outline (landOutline.json) into an SVG path, projected with the exact same
// `project([lat, lon]) => [x, y]` function the Home map preview already uses for routes and airports
// (lib/routeProjection.js) — reusing that one closure is what keeps the land, routes and pins pixel-aligned,
// rather than two projections that merely agree on paper. See server/scripts/dev/generate-land-outline.js
// for where landOutline.json comes from and how to regenerate it.

/**
 * `rings` are flat [lon, lat, lon, lat, ...] arrays (GeoJSON order). Returns one SVG path `d` string.
 *
 * Each ring is projected as a continuation: every point after the first unwraps relative to the PREVIOUS
 * point's raw longitude (`project`'s optional second argument — see routeProjection.js), not the frame's
 * own reference. A ring that genuinely crosses the antimeridian (e.g. the Russian coastline) stays one
 * contiguous shape this way; projecting every point independently against a single fixed reference would
 * tear it into two pieces wherever the ring happened to cross whatever longitude that reference sits at.
 */
export function buildLandPath(rings, project) {
  if (!project || !rings?.length) return '';
  const parts = [];
  for (const ring of rings) {
    let d = '';
    let prevLon;
    for (let i = 0; i < ring.length; i += 2) {
      const lon = ring[i];
      const lat = ring[i + 1];
      const [x, y] = project([lat, lon], prevLon); // ring stores [lon, lat]; project wants [lat, lon]
      prevLon = lon;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    parts.push(d + 'Z');
  }
  return parts.join(' ');
}
