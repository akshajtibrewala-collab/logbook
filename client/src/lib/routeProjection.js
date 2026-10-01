// A simple equirectangular projection for the Home map preview: lays out [lat, lon] points into an SVG
// viewBox without pulling in Leaflet (or any map tiles) just to draw a static route overview. Longitude is
// scaled by cos(midLatitude) so the shape isn't visibly stretched east-west at the pilot's own latitudes.
// This is deliberately not navigation-grade — it's a glance-sized preview that links through to the real
// Map page for anything more.

/**
 * Builds a `([lat, lon]) => [x, y]` projector that fits every point into `width`x`height` with `padding`
 * on each side, preserving aspect ratio (never stretching one axis to fill the box). Returns null when
 * there are no points to fit.
 */
export function buildProjection(points, width, height, padding = 12) {
  if (!points.length) return null;
  const lats = points.map((p) => p[0]);
  const lons = points.map((p) => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const midLat = (minLat + maxLat) / 2;
  // Never let cos(lat) collapse the scale near the poles — floored well above zero for a tiny preview.
  const cos = Math.max(Math.cos((midLat * Math.PI) / 180), 0.15);
  const innerW = Math.max(width - padding * 2, 1);
  const innerH = Math.max(height - padding * 2, 1);
  const rawSpanLon = (maxLon - minLon) * cos;
  const rawSpanLat = maxLat - minLat;
  // Every point coincides (one airport, or a cluster of local flights) — center it rather than let an
  // arbitrary floor on the span turn "no spread" into a large, meaningless scale factor.
  if (rawSpanLon < 1e-6 && rawSpanLat < 1e-6) {
    const [cx, cy] = [padding + innerW / 2, padding + innerH / 2];
    return () => [cx, cy];
  }
  const spanLon = Math.max(rawSpanLon, 1e-6);
  const spanLat = Math.max(rawSpanLat, 1e-6);
  const scale = Math.min(innerW / spanLon, innerH / spanLat);
  const offsetX = padding + (innerW - spanLon * scale) / 2;
  const offsetY = padding + (innerH - spanLat * scale) / 2;
  return ([lat, lon]) => [
    offsetX + (lon - minLon) * cos * scale,
    offsetY + (maxLat - lat) * scale, // SVG y grows downward, so north (higher lat) maps to a smaller y
  ];
}
