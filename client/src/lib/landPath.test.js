import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLandPath } from './landPath.js';

const project = ([lat, lon]) => [lon * 2, lat * -2]; // trivial stand-in projector for the test

test('buildLandPath returns empty string with no projector or no rings', () => {
  assert.equal(buildLandPath([[0, 0, 1, 1, 2, 0]], null), '');
  assert.equal(buildLandPath([], project), '');
  assert.equal(buildLandPath(null, project), '');
});

test('buildLandPath projects each ring into an M/L/Z subpath, lon/lat swapped for the projector', () => {
  const rings = [[0, 0, 10, 0, 10, 10]]; // one ring: [lon, lat] pairs
  const d = buildLandPath(rings, project);
  assert.equal(d, 'M0.0 0.0 L20.0 0.0 L20.0 -20.0 Z');
});

test('buildLandPath concatenates multiple rings into separate subpaths', () => {
  const rings = [[0, 0, 1, 1], [5, 5, 6, 6]];
  const d = buildLandPath(rings, project);
  assert.equal(d.split('M').length - 1, 2); // one "M" per ring
  assert.ok(d.includes('Z Z') === false && d.trim().endsWith('Z'));
});
