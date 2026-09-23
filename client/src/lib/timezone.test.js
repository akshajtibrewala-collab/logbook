import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ageMinutes, localAndZulu, observedAgeLabel, tzOffsetMinutes, utcToZonedParts, zonedToUtc, zoneAbbreviation, zonedHHMM, zuluHHMM,
} from './timezone.js';

test('utcToZonedParts reads the correct local wall clock in standard and daylight time', () => {
  // 2026-01-15 12:00 UTC -> Denver is on MST (UTC-7) in January.
  assert.deepEqual(utcToZonedParts(new Date('2026-01-15T12:00:00Z'), 'America/Denver'), { y: 2026, m: 1, d: 15, hour: 5, minute: 0, second: 0 });
  // 2026-07-15 12:00 UTC -> Denver is on MDT (UTC-6) in July.
  assert.deepEqual(utcToZonedParts(new Date('2026-07-15T12:00:00Z'), 'America/Denver'), { y: 2026, m: 7, d: 15, hour: 6, minute: 0, second: 0 });
  // Arizona never observes DST.
  assert.deepEqual(utcToZonedParts(new Date('2026-07-15T12:00:00Z'), 'America/Phoenix'), { y: 2026, m: 7, d: 15, hour: 5, minute: 0, second: 0 });
});

test('tzOffsetMinutes matches the standard/daylight offset', () => {
  assert.equal(tzOffsetMinutes(new Date('2026-01-15T12:00:00Z'), 'America/Denver'), -7 * 60);
  assert.equal(tzOffsetMinutes(new Date('2026-07-15T12:00:00Z'), 'America/Denver'), -6 * 60);
  assert.equal(tzOffsetMinutes(new Date('2026-07-15T12:00:00Z'), 'America/Phoenix'), -7 * 60);
});

test('zonedToUtc is the inverse of utcToZonedParts across several US zones', () => {
  const cases = [
    { zone: 'America/New_York', wall: { y: 2026, m: 3, d: 1, hour: 9, minute: 30 } },
    { zone: 'America/Chicago', wall: { y: 2026, m: 6, d: 20, hour: 14, minute: 0 } },
    { zone: 'America/Denver', wall: { y: 2026, m: 11, d: 5, hour: 22, minute: 15 } },
    { zone: 'America/Los_Angeles', wall: { y: 2026, m: 12, d: 25, hour: 6, minute: 45 } },
    { zone: 'America/Phoenix', wall: { y: 2026, m: 8, d: 4, hour: 18, minute: 0 } },
  ];
  for (const { zone, wall } of cases) {
    const utc = zonedToUtc(wall, zone);
    assert.deepEqual({ ...utcToZonedParts(utc, zone), second: undefined }, { ...wall, second: undefined }, `${zone} round-trip`);
  }
});

test('DST spring-forward: 2026-03-08 America/Denver loses the 02:00-03:00 hour', () => {
  // Just before the spring-forward transition (01:59 MST, UTC-7) and just after it (03:00 MDT, UTC-6).
  const before = zonedToUtc({ y: 2026, m: 3, d: 8, hour: 1, minute: 59 }, 'America/Denver');
  const after = zonedToUtc({ y: 2026, m: 3, d: 8, hour: 3, minute: 0 }, 'America/Denver');
  assert.equal(before.toISOString(), '2026-03-08T08:59:00.000Z');
  assert.equal(after.toISOString(), '2026-03-08T09:00:00.000Z');
  // Clocks spring forward from 02:00 to 03:00 instantaneously, so 61 minutes of wall time (01:59 to
  // 03:00) is really just 1 minute of elapsed real time.
  assert.equal(after.getTime() - before.getTime(), 60 * 1000);
});

test('DST fall-back: 2026-11-01 America/Denver repeats the 01:00-02:00 hour', () => {
  // 00:30 MDT (before the repeated hour) and 03:30 MST (well after it) are 3 real hours apart even
  // though they're only 3 wall-clock hours apart on paper, because the repeated hour adds a real hour.
  const beforeFallback = zonedToUtc({ y: 2026, m: 11, d: 1, hour: 0, minute: 30 }, 'America/Denver');
  const afterFallback = zonedToUtc({ y: 2026, m: 11, d: 1, hour: 3, minute: 30 }, 'America/Denver');
  assert.equal(afterFallback.getTime() - beforeFallback.getTime(), 4 * 3600 * 1000);
});

test('zoneAbbreviation names standard vs daylight time correctly', () => {
  assert.equal(zoneAbbreviation(new Date('2026-01-15T12:00:00Z'), 'America/Denver'), 'MST');
  assert.equal(zoneAbbreviation(new Date('2026-07-15T12:00:00Z'), 'America/Denver'), 'MDT');
  assert.equal(zoneAbbreviation(new Date('2026-07-15T12:00:00Z'), 'America/Phoenix'), 'MST');
});

test('zonedHHMM / zuluHHMM / localAndZulu format as the app expects', () => {
  const t = new Date('2026-07-15T21:00:00Z'); // 15:00 MDT
  assert.equal(zonedHHMM(t, 'America/Denver'), '15:00');
  assert.equal(zuluHHMM(t), '21:00');
  assert.equal(localAndZulu(t, 'America/Denver'), '15:00 MDT · 21:00Z');
});

test('a cross-time-zone flight plan: two legs entered in their own local times compare correctly in UTC', () => {
  // Depart Denver 08:00 MDT, arrive San Francisco the "same day" at 09:00 PDT local — but since PDT is
  // one hour behind MDT, that arrival is actually only 60 minutes of flight time after departure, not
  // negative or same-instant, which a naive device-local comparison would get wrong.
  const departureUtc = zonedToUtc({ y: 2026, m: 7, d: 10, hour: 8, minute: 0 }, 'America/Denver');
  const arrivalUtc = zonedToUtc({ y: 2026, m: 7, d: 10, hour: 9, minute: 0 }, 'America/Los_Angeles');
  assert.equal(departureUtc.toISOString(), '2026-07-10T14:00:00.000Z');
  assert.equal(arrivalUtc.toISOString(), '2026-07-10T16:00:00.000Z');
  assert.ok(arrivalUtc.getTime() > departureUtc.getTime());
  assert.equal(arrivalUtc.getTime() - departureUtc.getTime(), 2 * 3600 * 1000);
});

test('ageMinutes and observedAgeLabel flag staleness around the 90-minute threshold', () => {
  const now = new Date('2026-07-15T12:00:00Z');
  assert.equal(ageMinutes(new Date('2026-07-15T11:13:00Z'), now), 47);
  assert.equal(observedAgeLabel(new Date('2026-07-15T11:13:00Z'), now).label, 'observed 47 min ago');
  assert.equal(observedAgeLabel(new Date('2026-07-15T11:13:00Z'), now).stale, false);

  const stale = observedAgeLabel(new Date('2026-07-15T10:00:00Z'), now); // 120 min ago
  assert.equal(stale.minutes, 120);
  assert.equal(stale.stale, true);
  assert.equal(stale.label, 'observed 2 hr 0 min ago');

  // Never negative even if the observation timestamp is (slightly) in the future relative to `now`.
  assert.equal(ageMinutes(new Date('2026-07-15T12:05:00Z'), now), 0);
});
