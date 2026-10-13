import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNarrowForRem } from './layoutmode.js';

test('1024px at the default root size is wide; a larger root size makes it narrow', () => {
  assert.equal(isNarrowForRem(1024, 16), false);
  assert.equal(isNarrowForRem(1024, 17.6), true); // 110%
  assert.equal(isNarrowForRem(1024, 32), true); // 200%
  assert.equal(isNarrowForRem(1366, 16), false);
  assert.equal(isNarrowForRem(1366, 24), true); // 150%: 56.9rem
});

test('desktop widths: 1920px stays wide up to 3/2 text, then narrow', () => {
  assert.equal(isNarrowForRem(1920, 24), false); // 80rem
  assert.equal(isNarrowForRem(1920, 32), true); // 60rem
});

test('awkward values never flip the layout', () => {
  for (const bad of [NaN, Infinity, -1, 0, undefined, null, '16']) {
    assert.equal(isNarrowForRem(bad, 16), false);
    assert.equal(isNarrowForRem(1024, bad), false);
  }
});
