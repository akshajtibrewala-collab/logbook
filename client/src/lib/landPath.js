// Turns the simplified land outline (landOutline.json) into an SVG path, projected with the exact same
// `project([lat, lon]) => [x, y]` function the Home map preview already uses for routes and airports
// (lib/routeProjection.js) — reusing that one closure is what keeps the land, routes and pins pixel-aligned,
// rather than two projections that merely agree on paper. See server/scripts/dev/generate-land-outline.js
// for where landOutline.json comes from and how to regenerate it.

/** `rings` are flat [lon, lat, lon, lat, ...] arrays (GeoJSON order). Returns one SVG path `d` string. */
export function buildLandPath(rings, project) {
  if (!project || !rings?.length) return '';
  const parts = [];
  for (const ring of rings) {
    let d = '';
    for (let i = 0; i < ring.length; i += 2) {
      const [x, y] = project([ring[i + 1], ring[i]]); // ring stores [lon, lat]; project wants [lat, lon]
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    parts.push(d + 'Z');
  }
  return parts.join(' ');
}
