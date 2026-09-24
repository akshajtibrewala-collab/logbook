import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitWithin } from './image.js';

test('fitWithin scales the longer edge down to the max and keeps aspect ratio', () => {
  assert.deepEqual(fitWithin(4000, 3000, 1280), { width: 1280, height: 960 });
  assert.deepEqual(fitWithin(3000, 4000, 1280), { width: 960, height: 1280 });
});

test('fitWithin never enlarges and rejects empty images', () => {
  assert.deepEqual(fitWithin(800, 600, 1280), { width: 800, height: 600 });
  assert.deepEqual(fitWithin(0, 10), { width: 0, height: 0 });
});
