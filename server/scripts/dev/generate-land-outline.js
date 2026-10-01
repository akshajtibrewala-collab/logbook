#!/usr/bin/env node
// One-time generator for client/src/lib/landOutline.json — a simplified world land/coastline outline used
// only by the Home map preview's land backdrop (client/src/components/MapPreviewCard.jsx). Not run at
// build or runtime; re-run by hand if the source data or simplification tolerance ever needs to change.
//
// Source data: Natural Earth 110m Land (ne_110m_land), public domain. No attribution required.
//   https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/
//   Fetched from the maintained mirror: https://github.com/nvkelso/natural-earth-vector
//
// Usage: node server/scripts/dev/generate-land-outline.js <path-to-ne_110m_land.geojson>
// Uses only Node built-ins — no npm dependency needed for this simplification pass.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.join(__dirname, '../../../client/src/lib/landOutline.json');

const srcPath = process.argv[2];
if (!srcPath) {
  console.error('Usage: node generate-land-outline.js <path-to-ne_110m_land.geojson>');
  process.exit(1);
}

const geojson = JSON.parse(fs.readFileSync(srcPath, 'utf8'));

// Perpendicular-distance Douglas-Peucker simplification in plain lon/lat degrees (good enough for a
// 400x110px static preview — this is deliberately not navigation-grade).
function simplify(points, epsilon) {
  if (points.length < 3) return points;
  let maxDist = 0;
  let index = 0;
  const [x1, y1] = points[0];
  const [x2, y2] = points[points.length - 1];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const norm = Math.sqrt(dx * dx + dy * dy) || 1;
  for (let i = 1; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const dist = Math.abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / norm;
    if (dist > maxDist) { maxDist = dist; index = i; }
  }
  if (maxDist > epsilon) {
    const left = simplify(points.slice(0, index + 1), epsilon);
    const right = simplify(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}

// Every source ring is closed (first point === last point), which breaks plain Douglas-Peucker (its
// baseline chord would have zero length). Split the ring at the point farthest from the start, simplify
// each half as an open path, then rejoin — a standard fix for simplifying closed polygons.
function simplifyRing(ring, epsilon) {
  let farIndex = 1;
  let farDist = -1;
  const [x0, y0] = ring[0];
  for (let i = 1; i < ring.length - 1; i++) {
    const [x, y] = ring[i];
    const d = (x - x0) ** 2 + (y - y0) ** 2;
    if (d > farDist) { farDist = d; farIndex = i; }
  }
  const part1 = simplify(ring.slice(0, farIndex + 1), epsilon);
  const part2 = simplify(ring.slice(farIndex), epsilon);
  return part1.slice(0, -1).concat(part2);
}

const EPSILON_DEG = 0.25; // simplification tolerance
const MIN_RING_SPAN_DEG = 0.6; // drop slivers/tiny islands too small to read at preview scale

const rings = [];
for (const feature of geojson.features) {
  const g = feature.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const poly of polys) {
    for (const ring of poly) {
      let simplified = simplifyRing(ring, EPSILON_DEG);
      // Round to 2 decimal degrees (~1km) and drop consecutive duplicates left by rounding.
      const rounded = [];
      for (const [lon, lat] of simplified) {
        const r = [Math.round(lon * 100) / 100, Math.round(lat * 100) / 100];
        const last = rounded[rounded.length - 1];
        if (!last || last[0] !== r[0] || last[1] !== r[1]) rounded.push(r);
      }
      if (rounded.length < 4) continue;
      const lons = rounded.map((p) => p[0]);
      const lats = rounded.map((p) => p[1]);
      const span = Math.max(Math.max(...lons) - Math.min(...lons), Math.max(...lats) - Math.min(...lats));
      if (span < MIN_RING_SPAN_DEG) continue;
      rings.push(rounded.flat());
    }
  }
}

fs.writeFileSync(OUT_FILE, JSON.stringify(rings));
const stats = fs.statSync(OUT_FILE);
console.log(`Wrote ${rings.length} rings to ${OUT_FILE} (${(stats.size / 1024).toFixed(1)} KB raw)`);
