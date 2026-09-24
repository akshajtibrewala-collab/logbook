import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseISO, toISO, daysInMonth, firstWeekday, monthGrid, shiftMonth, formatDate, formatDateWithWeekday, formatInstant, toDateTime, parseDateTime, formatDateTime } from './calendar.js';

test('parses only real calendar dates', () => {
  assert.deepEqual(parseISO('2026-09-04'), { y: 2026, m: 9, d: 4 });
  assert.equal(parseISO('2026-02-30'), null);
  assert.equal(parseISO('2026-13-01'), null);
  assert.equal(parseISO('2026-9-4'), null);
  assert.equal(parseISO(''), null);
  assert.equal(parseISO(null), null);
  assert.equal(toISO(2026, 3, 5), '2026-03-05');
});

test('month lengths and weekdays, including leap years', () => {
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(daysInMonth(1900, 2), 28);
  assert.equal(daysInMonth(2026, 9), 30);
  assert.equal(firstWeekday(2026, 9), 2); // Sep 1, 2026 is a Tuesday
  assert.equal(firstWeekday(2024, 2), 4); // Feb 1, 2024 is a Thursday
});

test('month grid is Sunday-first rows of 7 with null padding', () => {
  const grid = monthGrid(2026, 9);
  assert.ok(grid.every((row) => row.length === 7));
  assert.deepEqual(grid[0], [null, null, 1, 2, 3, 4, 5]);
  assert.deepEqual(grid[grid.length - 1], [27, 28, 29, 30, null, null, null]);
  assert.equal(grid.flat().filter(Boolean).length, 30);
  assert.equal(monthGrid(2015, 2).length, 4); // 28 days starting on a Sunday
});

test('shifts months across year boundaries', () => {
  assert.deepEqual(shiftMonth(2026, 1, -1), { y: 2025, m: 12 });
  assert.deepEqual(shiftMonth(2026, 12, 1), { y: 2027, m: 1 });
  assert.deepEqual(shiftMonth(2026, 3, 14), { y: 2027, m: 5 });
  assert.deepEqual(shiftMonth(2026, 3, -14), { y: 2025, m: 1 });
});

test('formatDate is MM/DD/YYYY, pure string formatting (no day ever shifts)', () => {
  assert.equal(formatDate('2026-09-04'), '09/04/2026');
  assert.equal(formatDate('2026-12-31'), '12/31/2026');
  assert.equal(formatDate('2026-01-01'), '01/01/2026');
  assert.equal(formatDate('2028-02-29'), '02/29/2028');
  assert.equal(formatDate('2026-02-30'), '');
  assert.equal(formatDate(''), '');
  assert.equal(formatDate('nope'), '');
});

test('formatDateWithWeekday names the weekday of that calendar date', () => {
  assert.equal(formatDateWithWeekday('2026-09-12'), 'Sat 09/12/2026');
  assert.equal(formatDateWithWeekday('2026-01-01'), 'Thu 01/01/2026');
  assert.equal(formatDateWithWeekday('bad'), '');
});

test('formatInstant formats a real timestamp as MM/DD/YYYY with a time', () => {
  assert.equal(formatInstant('2026-09-12T15:30:00'), '09/12/2026, 3:30 PM');
  assert.equal(formatInstant('garbage'), '');
});

test('toDateTime combines a date and hour/minute into the datetime-local shape, zero-padded', () => {
  assert.equal(toDateTime('2026-09-04', 9, 5), '2026-09-04T09:05');
  assert.equal(toDateTime('2026-09-04', 23, 0), '2026-09-04T23:00');
});

test('parseDateTime accepts only the exact datetime-local shape with a real date and valid time', () => {
  assert.deepEqual(parseDateTime('2026-09-04T14:30'), { date: '2026-09-04', hour: 14, minute: 30 });
  assert.equal(parseDateTime('2026-02-30T10:00'), null); // not a real date
  assert.equal(parseDateTime('2026-09-04T24:00'), null); // hour out of range
  assert.equal(parseDateTime('2026-09-04T10:60'), null); // minute out of range
  assert.equal(parseDateTime('2026-09-04'), null); // no time part
  assert.equal(parseDateTime(''), null);
  assert.equal(parseDateTime(null), null);
});

test('formatDateTime is MM/DD/YYYY plus a 12-hour wall-clock time, with no zone conversion', () => {
  assert.equal(formatDateTime('2026-09-04T14:30'), '09/04/2026, 2:30 PM');
  assert.equal(formatDateTime('2026-09-04T00:05'), '09/04/2026, 12:05 AM');
  assert.equal(formatDateTime('2026-09-04T12:00'), '09/04/2026, 12:00 PM');
  assert.equal(formatDateTime(''), '');
  assert.equal(formatDateTime('nope'), '');
});
