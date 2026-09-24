import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orientation, aspectOf, tileStyle, orientedSize, FALLBACK_ASPECT } from './photoLayout.js';

test('orientation: landscape, portrait, square, unknown', () => {
  assert.equal(orientation(1280, 960), 'landscape');
  assert.equal(orientation(960, 1280), 'portrait');
  assert.equal(orientation(1000, 1000), 'square');
  assert.equal(orientation(1000, 990), 'square'); // within a couple of percent counts as square
  assert.equal(orientation(null, 100), 'unknown');
  assert.equal(orientation(0, 0), 'unknown');
  assert.equal(orientation('abc', 5), 'unknown');
});

test('aspectOf uses the real ratio, falls back when unknown, and clamps extremes', () => {
  assert.equal(aspectOf(1280, 960), 4 / 3);
  assert.equal(aspectOf(960, 1280), 0.75);
  assert.equal(aspectOf(null, null), FALLBACK_ASPECT);
  assert.equal(aspectOf(undefined, 500, 1.5), 1.5); // custom fallback
  assert.equal(aspectOf(4000, 500), 2.4); // panorama capped
  assert.equal(aspectOf(500, 4000), 0.5); // very tall capped
});

test('tileStyle sizes width by aspect ratio and caps the height', () => {
  const wide = tileStyle(1.5, 140, 320);
  assert.equal(wide.aspectRatio, '1.5');
  assert.equal(wide.flex, '1.5 1 210px');
  assert.equal(wide.maxWidth, 'min(100%, 480px)'); // 480 / 1.5 = 320 max height
  const tall = tileStyle(0.75, 140, 320);
  assert.equal(tall.flex, '0.75 1 105px');
  assert.equal(tall.maxWidth, 'min(100%, 240px)'); // 240 / 0.75 = 320 max height
});

test('a mixed row gets equal heights: widths are proportional to aspect ratio', () => {
  const [a, b] = [tileStyle(1.5), tileStyle(0.75)].map((s) => parseInt(s.flex.split(' ')[2], 10));
  assert.equal(a / 1.5, b / 0.75);
});

test('EXIF orientations 5-8 swap width and height; 1-4 do not', () => {
  assert.deepEqual(orientedSize(800, 600, 1), { width: 800, height: 600 });
  assert.deepEqual(orientedSize(800, 600, 3), { width: 800, height: 600 }); // upside down: same box
  assert.deepEqual(orientedSize(800, 600, 6), { width: 600, height: 800 }); // typical phone portrait
  assert.deepEqual(orientedSize(800, 600, 8), { width: 600, height: 800 });
  assert.deepEqual(orientedSize(800, 600), { width: 800, height: 600 });
});
