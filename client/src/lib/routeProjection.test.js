import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProjection } from './routeProjection.js';

test('no points: returns null rather than a projector', () => {
  assert.equal(buildProjection([], 300, 150), null);
});

test('a single point projects to the center of the box', () => {
  const project = buildProjection([[37.5, -122.3]], 300, 150, 12);
  const [x, y] = project([37.5, -122.3]);
  assert.ok(Math.abs(x - 150) < 0.5);
  assert.ok(Math.abs(y - 75) < 0.5);
});

test('every point lands within the padded box, and north stays above south (smaller y)', () => {
  const points = [[37.5, -122.3], [40.6, -73.8], [25.8, -80.2]];
  const project = buildProjection(points, 400, 200, 10);
  const projected = points.map(project);
  for (const [x, y] of projected) {
    assert.ok(x >= 9 && x <= 391, `x ${x} out of bounds`);
    assert.ok(y >= 9 && y <= 191, `y ${y} out of bounds`);
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
