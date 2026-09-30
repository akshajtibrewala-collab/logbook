import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passengerDuration, parseTime } from './passengerDuration.js';

test('parseTime accepts 24h HH:MM and rejects junk', () => {
  assert.deepEqual(parseTime('16:25'), { hour: 16, minute: 25 });
  assert.deepEqual(parseTime('00:00'), { hour: 0, minute: 0 });
  assert.deepEqual(parseTime('23:59'), { hour: 23, minute: 59 });
  assert.equal(parseTime('24:00'), null);
  assert.equal(parseTime('9:30'), null); // must be zero-padded
  assert.equal(parseTime(''), null);
  assert.equal(parseTime(null), null);
});

test('same-zone same-day flight: simple subtraction', () => {
  // STL -> RDU is both America/Chicago -> America/New_York in real life, but pin same zone here to isolate
  // the plain-subtraction case.
  const r = passengerDuration({ date: '2026-07-01', depTime: '16:25', arrTime: '19:15', depTz: 'America/Chicago', arrTz: 'America/Chicago', arrDayOffset: 0 });
  assert.equal(r.hours, 2.83); // 2h50m
  assert.equal(r.arrDayOffset, 0);
  assert.equal(r.warning, null);
});

test('STL 16:25 -> RDU 19:15 (Central -> Eastern) is 1h50m, not 2h50m', () => {
  const r = passengerDuration({ date: '2026-07-01', depTime: '16:25', arrTime: '19:15', depTz: 'America/Chicago', arrTz: 'America/New_York', arrDayOffset: 0 });
  assert.equal(r.hours, 1.83); // 1h50m
  assert.equal(r.warning, null);
});

test('overnight flight: auto-resolves arrDayOffset to 1 when arrival clock time is earlier than departure', () => {
  // Depart 23:10 local, arrive 04:10 the next local day — same zone for isolation.
  const r = passengerDuration({ date: '2026-05-10', depTime: '23:10', arrTime: '04:10', depTz: 'America/Denver', arrTz: 'America/Denver' });
  assert.equal(r.arrDayOffset, 1);
  assert.equal(r.hours, 5);
});

test('DST spring-forward date: 2026-03-08 America/Denver loses an hour', () => {
  // 01:00 -> 04:00 wall-clock reads as 3 hours, but the 02:00-03:00 hour doesn't exist that day, so only
  // 2 real hours elapse.
  const r = passengerDuration({ date: '2026-03-08', depTime: '01:00', arrTime: '04:00', depTz: 'America/Denver', arrTz: 'America/Denver', arrDayOffset: 0 });
  assert.equal(r.hours, 2);
});

test('DST fall-back date: 2026-11-01 America/Denver repeats an hour', () => {
  // 00:30 -> 03:30 wall-clock reads as 3 hours, but the repeated 01:00-02:00 hour adds a real hour.
  const r = passengerDuration({ date: '2026-11-01', depTime: '00:30', arrTime: '03:30', depTz: 'America/Denver', arrTz: 'America/Denver', arrDayOffset: 0 });
  assert.equal(r.hours, 4);
});

test('eastbound long-haul: JFK evening departure lands in London the next local morning, ~7h', () => {
  const r = passengerDuration({ date: '2026-06-01', depTime: '22:00', arrTime: '09:50', depTz: 'America/New_York', arrTz: 'Europe/London' });
  assert.equal(r.arrDayOffset, 1);
  assert.equal(r.hours, 6.83);
});

test('westbound long-haul: London morning departure lands in LA the same local afternoon, over 11h', () => {
  const r = passengerDuration({ date: '2026-06-01', depTime: '10:30', arrTime: '13:45', depTz: 'Europe/London', arrTz: 'America/Los_Angeles' });
  assert.equal(r.arrDayOffset, 0);
  assert.equal(r.hours, 11.25);
});

test('flight over 15 hours: SIN -> JFK ultra-long-haul warns long past 20h but not at ~18h', () => {
  const r = passengerDuration({ date: '2026-02-01', depTime: '23:35', arrTime: '06:00', depTz: 'Asia/Singapore', arrTz: 'America/New_York', arrDayOffset: 1 });
  assert.ok(r.hours > 15, `expected > 15h, got ${r.hours}`);
  assert.equal(r.warning, null);
});

test('warns "short" under 20 minutes', () => {
  const r = passengerDuration({ date: '2026-07-01', depTime: '10:00', arrTime: '10:15', depTz: 'America/Chicago', arrTz: 'America/Chicago', arrDayOffset: 0 });
  assert.equal(r.hours, 0.25);
  assert.equal(r.warning, 'short');
});

test('warns "long" over 20 hours', () => {
  const r = passengerDuration({ date: '2026-07-01', depTime: '00:00', arrTime: '01:00', depTz: 'UTC', arrTz: 'UTC', arrDayOffset: 1 });
  assert.equal(r.hours, 25);
  assert.equal(r.warning, 'long');
});

test('missing/invalid inputs return null instead of throwing', () => {
  assert.equal(passengerDuration({ date: '', depTime: '10:00', arrTime: '11:00' }), null);
  assert.equal(passengerDuration({ date: '2026-07-01', depTime: '25:00', arrTime: '11:00' }), null);
  assert.equal(passengerDuration({ date: '2026-07-01', depTime: '10:00', arrTime: '' }), null);
});

test('missing time zone falls back to UTC on both ends', () => {
  const r = passengerDuration({ date: '2026-07-01', depTime: '10:00', arrTime: '12:30', depTz: null, arrTz: null, arrDayOffset: 0 });
  assert.equal(r.hours, 2.5);
});

test('a manually-set arrDayOffset that is too small produces a non-positive duration (caller must reject, not silently fix)', () => {
  const r = passengerDuration({ date: '2026-07-01', depTime: '23:00', arrTime: '01:00', depTz: 'UTC', arrTz: 'UTC', arrDayOffset: 0 });
  assert.ok(r.hours <= 0);
});
