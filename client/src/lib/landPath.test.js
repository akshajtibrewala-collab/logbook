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

test('buildLandPath unwraps each ring point relative to the PREVIOUS point, not a single fixed reference', () => {
  // A stub projector that records which `near` value it was called with, and "unwraps" lon toward it —
  // mimicking routeProjection's antimeridian handling without needing real geography.
  const calls = [];
  const near200 = (lon, near) => { calls.push(near); return near === undefined ? lon : lon + (near > 100 ? 1000 : 0); };
  const stubProject = ([lat, lon], near) => [near200(lon, near), lat];

  const ring = [0, 0, 10, 0, 170, 0]; // flat [lon, lat, ...]
  buildLandPath([ring], stubProject);

  // First point: no previous point yet, so `near` is undefined (the frame's own default kicks in).
  assert.equal(calls[0], undefined);
  // Second point: unwraps relative to the first point's raw lon (0), not a single global reference.
  assert.equal(calls[1], 0);
  // Third point: unwraps relative to the SECOND point's raw lon (10), continuing the chain.
  assert.equal(calls[2], 10);
});
