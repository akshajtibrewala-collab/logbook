import test from 'node:test';
import assert from 'node:assert/strict';
import { relLuminance, parseColor, nextTintState, percentile, TINT_UP, TINT_DOWN, chromaOf, hueOf, hueSpread, busyMetrics, nextBusyState } from './adaptiveTint.js';

test('relLuminance: black 0, white 1, mid gray in between', () => {
  assert.equal(relLuminance(0, 0, 0), 0);
  assert.ok(Math.abs(relLuminance(255, 255, 255) - 1) < 1e-9);
  assert.ok(relLuminance(128, 128, 128) > 0.2 && relLuminance(128, 128, 128) < 0.25);
});

test('parseColor handles browser rgb/rgba output', () => {
  assert.deepEqual(parseColor('rgb(10, 20, 30)'), { r: 10, g: 20, b: 30, a: 1 });
  assert.deepEqual(parseColor('rgba(10, 20, 30, 0.5)'), { r: 10, g: 20, b: 30, a: 0.5 });
  assert.equal(parseColor('transparent'), null);
});

test('nextTintState switches up above TINT_UP and back only below TINT_DOWN', () => {
  assert.equal(nextTintState('lo', TINT_UP + 0.01), 'hi');
  assert.equal(nextTintState('lo', TINT_UP - 0.01), 'lo');
  assert.equal(nextTintState('hi', (TINT_UP + TINT_DOWN) / 2), 'hi'); // inside the hysteresis band
  assert.equal(nextTintState('hi', TINT_DOWN - 0.01), 'lo');
});

test('percentile picks a conservative bright-end value', () => {
  assert.equal(percentile([0.01, 0.02, 0.03, 0.04, 0.9], 0.8), 0.9);
  assert.equal(percentile([], 0.8), 0);
});

test('a white backdrop always gets the scrim, pure black never does', () => {
  assert.equal(nextTintState('lo', relLuminance(255, 255, 255)), 'hi');
  assert.equal(nextTintState('hi', relLuminance(0, 0, 0)), 'lo');
});

const flat = (r, g, b) => ({ lum: relLuminance(r, g, b), rgb: { r, g, b } });
const many = (s, n) => Array.from({ length: n }, () => s);

test('chroma and hue: grays have none, primaries sit at their hue angles', () => {
  assert.equal(chromaOf(120, 120, 120), 0);
  assert.equal(hueOf(120, 120, 120), null);
  assert.ok(Math.abs(hueOf(255, 0, 0) - 0) < 1e-6 || Math.abs(hueOf(255, 0, 0) - 360) < 1e-6);
  assert.ok(Math.abs(hueOf(0, 255, 0) - 120) < 1e-6);
  assert.ok(Math.abs(hueOf(0, 0, 255) - 240) < 1e-6);
});

test('hueSpread: one hue is 0, opposite hues spread wide', () => {
  assert.ok(hueSpread([200, 200, 200]) < 1e-6);
  assert.ok(hueSpread([0, 180, 0, 180]) > 60);
});

test('flat black and flat dark gray surfaces are calm', () => {
  const m = busyMetrics([...many(flat(0, 0, 0), 15), ...many(flat(10, 10, 11), 6)]);
  assert.equal(nextBusyState('calm', m), 'calm');
});

test('pixels we cannot read (map tiles, canvas, images) are busy', () => {
  const m = busyMetrics([...many({ lum: 0.35, unknown: true }, 21)]);
  assert.equal(nextBusyState('calm', m), 'busy');
});

test('a mottled mix of dark land, sea and coloured route lines is busy even though it is dark on average', () => {
  const samples = [...many(flat(10, 21, 34), 5), ...many(flat(29, 33, 40), 5), ...many(flat(91, 185, 255), 4), ...many(flat(183, 160, 255), 3), ...many(flat(0, 0, 0), 4)];
  const m = busyMetrics(samples);
  assert.ok(percentile(samples.map((s) => s.lum), 0.8) < 0.5);
  assert.equal(nextBusyState('calm', m), 'busy');
});

test('busy has hysteresis: it stays busy at the edge and calms only when clearly quiet', () => {
  const edge = { unknownShare: 0.15, colorShare: 0, hueSpread: 0, lumRange: 0.02 };
  assert.equal(nextBusyState('busy', edge), 'busy');
  assert.equal(nextBusyState('calm', edge), 'calm');
  assert.equal(nextBusyState('busy', { unknownShare: 0, colorShare: 0, hueSpread: 0, lumRange: 0.01 }), 'calm');
});