import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNight } from './daynight.js';

const SFO = [37.6188, -122.3750];

test('midday is day, midnight is night, at a real airport on a real date', () => {
  assert.equal(isNight(...SFO, new Date('2026-06-21T20:00:00Z')), false); // ~1pm local, summer
  assert.equal(isNight(...SFO, new Date('2026-06-21T09:00:00Z')), true); // ~2am local, summer
});

test('crosses the sunrise/sunset boundary correctly', () => {
  // SFO sunrise on 2026-06-21 is ~12:48Z; sunset is ~03:34Z the following day.
  assert.equal(isNight(...SFO, new Date('2026-06-21T12:00:00Z')), true); // just before sunrise
  assert.equal(isNight(...SFO, new Date('2026-06-21T13:30:00Z')), false); // just after sunrise
  assert.equal(isNight(...SFO, new Date('2026-06-22T03:00:00Z')), false); // just before sunset
  assert.equal(isNight(...SFO, new Date('2026-06-22T04:00:00Z')), true); // just after sunset
});

test('winter days are shorter: an evening hour that is day in June is night in January', () => {
  assert.equal(isNight(...SFO, new Date('2026-01-01T01:30:00Z')), true); // ~5:30pm local, winter -> already dark
});
