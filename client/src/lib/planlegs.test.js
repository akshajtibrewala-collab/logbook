import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  blankLeg, changeAirport, applyResolved, setLegWall, legWall, legZone, legTimeLabel, tzNotice, planPayload, FALLBACK_ZONE,
} from './planlegs.js';

const resolved = (ident, tz) => ({ [ident]: { ident, tz } });
const at = (ident, tz, wall) => setLegWall(applyResolved({ ...blankLeg(), ident }, resolved(ident, tz)), wall);

// ---- The reported bug: changing the airport must not move the instant --------------------------------

test('changing the airport to another US time zone keeps the same UTC instant (was shifting by hours)', () => {
  const jfk = at('KJFK', 'America/New_York', '2026-09-24T00:10');
  assert.equal(jfk.etaUtc, '2026-09-24T04:10:00.000Z');
  const lax = applyResolved(changeAirport(jfk, 'KLAX'), resolved('KLAX', 'America/Los_Angeles'));
  assert.equal(lax.etaUtc, '2026-09-24T04:10:00.000Z'); // the moment did not change...
  assert.equal(legWall(lax), '2026-09-23T21:10'); // ...only how the clock reads there (and on the previous date)
  assert.match(legTimeLabel(lax), /21:10 PDT/);
  assert.match(legTimeLabel(lax), /04:10Z/);
});

test('every zone hop in a row (ET -> CT -> MT -> PT -> AK) preserves the instant', () => {
  let leg = at('KJFK', 'America/New_York', '2026-09-24T00:10');
  const original = leg.etaUtc;
  for (const [ident, tz] of [['KORD', 'America/Chicago'], ['KDEN', 'America/Denver'], ['KLAX', 'America/Los_Angeles'], ['PANC', 'America/Anchorage'], ['KPHX', 'America/Phoenix']]) {
    leg = applyResolved(changeAirport(leg, ident), resolved(ident, tz));
    assert.equal(leg.etaUtc, original, `after switching to ${ident}`);
  }
});

test('during the lookup (zone unknown yet) the time is kept, not re-read in some other zone', () => {
  const jfk = at('KJFK', 'America/New_York', '2026-09-24T00:10');
  const pending = changeAirport(jfk, 'KLAX');
  assert.equal(pending.tz, null);
  assert.equal(pending.tzStatus, 'pending');
  assert.equal(pending.etaUtc, jfk.etaUtc);
});

test('typing a new time is interpreted in the current airport zone and stored as UTC', () => {
  const den = at('KDEN', 'America/Denver', '2026-09-24T14:00'); // MDT = UTC-6
  assert.equal(den.etaUtc, '2026-09-24T20:00:00.000Z');
  assert.equal(legWall(den), '2026-09-24T14:00');
});

// ---- Labels ----------------------------------------------------------------------------------------

test('label shows local time with its abbreviation and Zulu', () => {
  const ord = at('KORD', 'America/Chicago', '2026-09-24T14:00');
  assert.equal(legTimeLabel(ord), 'Thu 14:00 CDT / 19:00Z');
});

test('label names both days when local and Zulu fall on different dates', () => {
  const ord = at('KORD', 'America/Chicago', '2026-09-23T23:10');
  assert.equal(legTimeLabel(ord), 'Wed 23:10 CDT / Thu 04:10Z');
});

// ---- Landing on a different calendar day / across the date line ---------------------------------------

test('a flight that lands on a different calendar day: the instant is shared, the local dates differ', () => {
  const dep = at('KLAX', 'America/Los_Angeles', '2026-09-23T22:00'); // Wed evening PDT
  const arr = { ...applyResolved(changeAirport(dep, 'KJFK'), resolved('KJFK', 'America/New_York')) };
  assert.equal(dep.etaUtc, arr.etaUtc);
  assert.equal(legWall(dep).slice(0, 10), '2026-09-23');
  assert.equal(legWall(arr).slice(0, 10), '2026-09-24'); // already Thursday in New York
  assert.equal(legWall(arr), '2026-09-24T01:00');
});

test('across the date line (Honolulu <-> Auckland) the calendar date changes but the instant does not', () => {
  const hnl = at('PHNL', 'Pacific/Honolulu', '2026-09-23T22:00'); // UTC-10
  assert.equal(hnl.etaUtc, '2026-09-24T08:00:00.000Z');
  const akl = applyResolved(changeAirport(hnl, 'NZAA'), resolved('NZAA', 'Pacific/Auckland')); // NZST UTC+12 until Sep 27
  assert.equal(akl.etaUtc, hnl.etaUtc);
  assert.equal(legWall(akl), '2026-09-24T20:00');
  const kiritimati = applyResolved(changeAirport(hnl, 'PLCH'), resolved('PLCH', 'Pacific/Kiritimati')); // UTC+14: two calendar days ahead of Honolulu's evening
  assert.equal(legWall(kiritimati), '2026-09-24T22:00');
});

// ---- Daylight saving time ------------------------------------------------------------------------------

test('DST fall-back: the same UTC instant reads differently before and after the change, and round-trips', () => {
  // 2026-11-01: US clocks fall back at 02:00 EDT (06:00Z) -> 01:00 EST.
  const before = at('KJFK', 'America/New_York', '2026-11-01T00:30'); // still EDT (UTC-4)
  assert.equal(before.etaUtc, '2026-11-01T04:30:00.000Z');
  const after = at('KJFK', 'America/New_York', '2026-11-01T03:30'); // EST (UTC-5)
  assert.equal(after.etaUtc, '2026-11-01T08:30:00.000Z');
  assert.match(legTimeLabel(before), /EDT/);
  assert.match(legTimeLabel(after), /EST/);
  assert.equal(legWall(after), '2026-11-01T03:30');
});

test('DST spring-forward: changing zones across the transition keeps the instant and uses the right abbreviation', () => {
  // 2026-03-08: US clocks spring forward. 12:00Z is 08:00 EDT in New York but 05:00 MST... Phoenix has no DST.
  const ny = at('KJFK', 'America/New_York', '2026-03-08T08:00');
  assert.equal(ny.etaUtc, '2026-03-08T12:00:00.000Z');
  const phx = applyResolved(changeAirport(ny, 'KPHX'), resolved('KPHX', 'America/Phoenix'));
  assert.equal(phx.etaUtc, ny.etaUtc);
  assert.equal(legWall(phx), '2026-03-08T05:00');
  assert.match(legTimeLabel(phx), /MST/);
});

test('a wall-clock time that does not exist (spring-forward gap) resolves to a real instant without throwing', () => {
  const gap = at('KJFK', 'America/New_York', '2026-03-08T02:30'); // 02:30 never happens in New York that day
  assert.ok(gap.etaUtc, 'still produces an instant');
  assert.ok(Number.isFinite(Date.parse(gap.etaUtc)));
  const wall = legWall(gap);
  assert.match(wall, /^2026-03-08T0[1-3]:30$/); // reads back as a real clock time near the gap
});

// ---- Missing / wrong timezone data --------------------------------------------------------------------

test('unknown time zone: falls back to UTC with a clear message, never a crash or a guessed zone', () => {
  const mystery = applyResolved({ ...blankLeg(), ident: 'ZZZZ' }, resolved('ZZZZ', null));
  assert.equal(mystery.tzStatus, 'unknown');
  assert.equal(legZone(mystery), FALLBACK_ZONE);
  assert.match(tzNotice(mystery), /ZZZZ/);
  assert.match(tzNotice(mystery), /UTC/);
  const withTime = setLegWall(mystery, '2026-09-24T14:00');
  assert.equal(withTime.etaUtc, '2026-09-24T14:00:00.000Z'); // entered as Zulu, said so
  assert.equal(legTimeLabel(withTime), 'Thu 14:00Z (UTC — airport time zone unknown)');
});

test('an airport the lookup could not find at all is treated as unknown-zone, not as the previous zone', () => {
  const jfk = at('KJFK', 'America/New_York', '2026-09-24T00:10');
  const typo = applyResolved(changeAirport(jfk, 'KXYZ'), {});
  assert.equal(typo.tz, null);
  assert.equal(typo.tzStatus, 'unknown');
  assert.equal(typo.etaUtc, jfk.etaUtc);
});

test('an invalid zone name from bad data is rejected the same way as a missing one', () => {
  const bad = applyResolved({ ...blankLeg(), ident: 'KBAD' }, resolved('KBAD', 'Not/AZone'));
  assert.equal(bad.tzStatus, 'unknown');
  assert.equal(legZone(bad), FALLBACK_ZONE);
});

test('short or empty idents have no lookup status and no notice', () => {
  assert.equal(changeAirport(blankLeg(), '').tzStatus, 'none');
  assert.equal(changeAirport(blankLeg(), 'KJ').tzStatus, 'none');
  assert.equal(tzNotice(changeAirport(blankLeg(), 'KJ')), null);
});

// ---- Request payload ---------------------------------------------------------------------------------

test('the request sends UTC instants only, for legs that have both an airport and a time', () => {
  const a = at('KJFK', 'America/New_York', '2026-09-24T00:10');
  const b = { ...blankLeg(), ident: 'KLAX' }; // no time yet
  assert.deepEqual(planPayload([a, b]), [{ ident: 'KJFK', eta: '2026-09-24T04:10:00.000Z' }]);
  assert.deepEqual(planPayload([blankLeg()]), []);
});
