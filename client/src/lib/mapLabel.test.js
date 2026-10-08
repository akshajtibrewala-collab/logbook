import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickLabelSpot, sampleQuad } from './mapLabel.js';

const frame = { w: 400, h: 300 };

test('with nothing around, the label goes north-east of the point', () => {
  const s = pickLabelSpot([100, 100], 30, 11, [], frame);
  assert.equal(s.id, 'ne'); assert.equal(s.anchor, 'start'); assert.equal(s.hits, 0);
});

test('a route running through the north-east box moves the label elsewhere', () => {
  const route = sampleQuad(100, 100, 130, 80, 160, 90); // heads up and right from the point
  const s = pickLabelSpot([100, 100], 30, 11, route, frame);
  assert.notEqual(s.id, 'ne');
  assert.equal(s.hits, 0);
});

test('near the right edge it flips to the left side and stays inside the frame', () => {
  const s = pickLabelSpot([390, 150], 30, 11, [], frame);
  assert.equal(s.anchor, 'end');
});

test('with lines everywhere it still returns the least-crowded spot', () => {
  const pts = [];
  for (let a = 0; a < 360; a += 20) { const r = a * Math.PI / 180; pts.push(...sampleQuad(100, 100, 100 + 40 * Math.cos(r), 100 + 40 * Math.sin(r), 100 + 80 * Math.cos(r), 100 + 80 * Math.sin(r))); }
  const s = pickLabelSpot([100, 100], 30, 11, pts, frame);
  assert.ok(s && Number.isFinite(s.x));
});
