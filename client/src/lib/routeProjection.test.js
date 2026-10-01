import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProjection, MIN_SPAN_DEG } from './routeProjection.js';

test('no points: returns null rather than a projector', () => {
  assert.equal(buildProjection([], 300, 150), null);
});

test('a single point projects to the center of the box', () => {
  const project = buildProjection([[37.5, -122.3]], 300, 150);
  const [x, y] = project([37.5, -122.3]);
  assert.ok(Math.abs(x - 150) < 0.5);
  assert.ok(Math.abs(y - 75) < 0.5);
});

test('every point of an ordinary spread lands within the padded box, and north stays above south', () => {
  const points = [[37.5, -122.3], [40.6, -73.8], [25.8, -80.2]];
  const project = buildProjection(points, 400, 200);
  const padding = 200 * 0.08;
  const projected = points.map((p) => project(p));
  for (const [x, y] of projected) {
    assert.ok(x >= padding - 0.5 && x <= 400 - padding + 0.5, `x ${x} out of bounds`);
    assert.ok(y >= padding - 0.5 && y <= 200 - padding + 0.5, `y ${y} out of bounds`);
  }
  const [, nyY] = projected[1]; // New York, 40.6N
  const [, miaY] = projected[2]; // Miami, 25.8N
  assert.ok(nyY < miaY);
});

test('a narrow north-south spread does not divide by zero', () => {
  const project = buildProjection([[37.0, -122.0], [37.0001, -121.9999]], 300, 150);
  const [x1, y1] = project([37.0, -122.0]);
  const [x2, y2] = project([37.0001, -121.9999]);
  assert.ok(Number.isFinite(x1) && Number.isFinite(y1) && Number.isFinite(x2) && Number.isFinite(y2));
});

// Case 1: a single airport, or a handful close together, never zooms in past a sensible floor.
test('a tight cluster is floored at MIN_SPAN_DEG rather than zooming in absurdly', () => {
  const points = [[38.70, -90.37], [38.71, -90.36], [38.705, -90.365]]; // all within ~0.01 degree
  const width = 400, height = 110;
  const project = buildProjection(points, width, height);
  const innerW = width - 2 * width * 0.08;
  const [xA] = project(points[0]);
  const [xB] = project(points[1]);
  // The real spread (~0.01deg) is tiny; MIN_SPAN_DEG governs the scale, so the two points stay close
  // together in pixels too, nowhere near filling the frame on their own.
  assert.ok(Math.abs(xA - xB) < innerW * 0.05, `points spread too far apart for a floored span: ${Math.abs(xA - xB)}`);
});

test('a single airport still gets the same MIN_SPAN_DEG-floored scale as a tight cluster', () => {
  const one = buildProjection([[38.70, -90.37]], 400, 110);
  const pair = buildProjection([[38.70, -90.37], [38.7001, -90.3701]], 400, 110);
  const [x1a] = one([38.70, -90.37]);
  const [x1b] = one([38.7001, -90.3701]); // off the actual data set, but exercises the same scale
  const [x2a] = pair([38.70, -90.37]);
  const [x2b] = pair([38.7001, -90.3701]);
  assert.ok(Math.abs((x1b - x1a) - (x2b - x2a)) < 0.1, 'scale should match MIN_SPAN_DEG regardless of 1 vs 2 points');
  void MIN_SPAN_DEG;
});

// Case 2: a far-away outlier (one flight to Sydney) must not shrink the main cluster to a smudge.
test('a single intercontinental outlier is excluded from the fit, keeping the main cluster readable', () => {
  const cluster = [
    [38.70, -90.37], [38.75, -90.20], [38.62, -90.65], [39.10, -89.90], [38.55, -90.80], [38.90, -90.10],
  ]; // St. Louis-area airports, all within ~1 degree of each other
  const sydney = [-33.87, 151.21];
  const width = 400, height = 110;
  const withOutlier = buildProjection([...cluster, sydney], width, height);
  const clusterOnly = buildProjection(cluster, width, height);

  // The cluster's own spread in pixels should match whether or not Sydney is in the data set — i.e. Sydney
  // did not force a zoom-out that shrinks the cluster.
  const spreadX = (proj) => {
    const xs = cluster.map((p) => proj(p)[0]);
    return Math.max(...xs) - Math.min(...xs);
  };
  const spreadWithOutlier = spreadX(withOutlier);
  const spreadClusterOnly = spreadX(clusterOnly);
  assert.ok(Math.abs(spreadWithOutlier - spreadClusterOnly) < 2, `cluster spread changed too much: ${spreadWithOutlier} vs ${spreadClusterOnly}`);

  // Sydney itself lands far outside the viewBox (left to be clipped), not squeezed in.
  const [sx, sy] = withOutlier(sydney);
  const padding = Math.min(width, height) * 0.08;
  const inBox = sx >= padding && sx <= width - padding && sy >= padding && sy <= height - padding;
  assert.equal(inBox, false, 'the outlier should fall outside the padded box, not be squeezed into frame');
});

// Case 3: routes that cross the antimeridian take the short way, not the long way around.
test('the frame itself fits the short arc across the antimeridian, not the long way around', () => {
  const honolulu = [21.3, -157.9];
  const tokyo = [35.6, 139.7]; // the short way across the Pacific is ~62 degrees, not ~298
  const shortArcMidpoint = [28.45, 170.9]; // sits on the short arc between them, near the date line
  const project = buildProjection([honolulu, tokyo], 400, 110);
  const [xHnl] = project(honolulu);
  const [xNrt] = project(tokyo);
  const [xMid] = project(shortArcMidpoint);
  // If the fit had instead spanned the long way (treating them as ~298 degrees apart), this midpoint —
  // which only lies on the SHORT arc — would land outside the Honolulu/Tokyo span, not between them.
  assert.ok(xMid > Math.min(xHnl, xNrt) && xMid < Math.max(xHnl, xNrt), 'short-arc midpoint should land between the two endpoints');
});

test('the nearLon parameter picks the longitude representative closest to it, for per-edge unwrapping', () => {
  // A plain pair straddling nothing in particular: the projector's own reference naturally resolves point
  // [0,10] to lon=10. Passing a `near` on the opposite side of the globe (205, i.e. ~195 degrees away)
  // forces a different representative (370, a full 360 degrees further around) — proving a caller (e.g. a
  // route segment unwrapping its second endpoint relative to the first's raw, un-normalized longitude) can
  // steer which way a specific edge is drawn independent of the frame's own reference.
  const project = buildProjection([[0, 0], [0, 10]], 400, 110);
  const [xDefault] = project([0, 10]);
  const [xNear] = project([0, 10], 205);
  const scale = Math.abs(xNear - xDefault) / 360;
  assert.ok(scale > 0, 'nearLon should shift the projected point by a multiple of the lon scale');
  assert.ok(Math.abs(Math.abs(xNear - xDefault) / scale - 360) < 1e-6, 'the shift should be exactly 360 degrees worth of scale');
});
