import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tzForAirport } from './timezone.js';

test('resolves well-known US airports to their IANA zones', () => {
  assert.equal(tzForAirport(37.4611, -122.1150), 'America/Los_Angeles'); // KPAO, Palo Alto
  assert.equal(tzForAirport(39.8561, -104.6737), 'America/Denver'); // KDEN, Denver
  assert.equal(tzForAirport(41.9742, -87.9073), 'America/Chicago'); // KORD, Chicago
  assert.equal(tzForAirport(40.6413, -73.7781), 'America/New_York'); // KJFK, New York
  assert.equal(tzForAirport(33.4342, -112.0116), 'America/Phoenix'); // KPHX, Arizona (no DST)
});

test('returns null for non-finite or missing coordinates', () => {
  assert.equal(tzForAirport(null, -122), null);
  assert.equal(tzForAirport(37, undefined), null);
  assert.equal(tzForAirport(NaN, NaN), null);
});
