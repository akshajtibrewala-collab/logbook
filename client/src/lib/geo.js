const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

/**
 * Points along the great-circle arc between two coordinates as [lat, lon] pairs.
 * Longitudes are unwrapped so the line stays continuous across the antimeridian
 * (Leaflet renders longitudes beyond ±180 on the neighbouring world copy).
 */
export function greatCircle([lat1, lon1], [lat2, lon2], segments = 48) {
  const p1 = rad(lat1), l1 = rad(lon1), p2 = rad(lat2), l2 = rad(lon2);
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2));
  if (d < 1e-9) return [[lat1, lon1], [lat2, lon2]];

  const pts = [];
  let prevLon = lon1;
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
    const z = A * Math.sin(p1) + B * Math.sin(p2);
    const lat = deg(Math.atan2(z, Math.hypot(x, y)));
    let lon = deg(Math.atan2(y, x));
    while (lon - prevLon > 180) lon -= 360;
    while (lon - prevLon < -180) lon += 360;
    prevLon = lon;
    pts.push([lat, lon]);
  }
  return pts;
}
