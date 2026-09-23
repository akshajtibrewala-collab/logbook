import { test } from 'node:test';
import assert from 'node:assert/strict';
import { declination, magneticToTrue } from './magvar.js';

const close = (a, b, tol) => Math.abs(a - b) <= tol;

test('declination sign matches known real-world variation (east positive, west negative)', () => {
  // Tolerances are generous (WMM drifts slowly, and these are well-known approximate current values)
  // rather than exact expected numbers — the point is to catch a sign flip or a badly wrong model pick.
  assert.ok(close(declination(39.7392, -104.9903, new Date('2026-01-01')), 8, 3)); // Denver: ~8E
  assert.ok(close(declination(40.7128, -74.0060, new Date('2026-01-01')), -13, 3)); // NYC: ~13W
  assert.ok(close(declination(37.6188, -122.3750, new Date('2026-01-01')), 13, 3)); // SFO: ~13E
});

test('declination does not throw for an out-of-range date, thanks to allowOutOfBoundsModel', () => {
  assert.doesNotThrow(() => declination(39.7392, -104.9903, new Date('2040-01-01')));
});

test('magneticToTrue adds declination and wraps into [0, 360)', () => {
  // Runway 13 (magnetic 130) near Denver, where declination is positive (east) -> true > magnetic.
  const trueHeading = magneticToTrue(13, 39.7392, -104.9903, new Date('2026-01-01'));
  assert.ok(trueHeading > 130 && trueHeading < 140);

  // Runway 36 (magnetic 360) near NYC, where declination is negative (west) -> should wrap under 360.
  const wrapped = magneticToTrue(36, 40.7128, -74.0060, new Date('2026-01-01'));
  assert.ok(wrapped >= 0 && wrapped < 360);
  assert.ok(close(wrapped, 347.5, 3)); // 360 - ~12.5W
});
