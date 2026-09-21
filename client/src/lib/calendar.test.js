import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseISO, toISO, daysInMonth, firstWeekday, monthGrid, shiftMonth, formatDate } from './calendar.js';

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

test('formats without time zone drift', () => {
  assert.match(formatDate('2026-09-04'), /Sep/);
  assert.match(formatDate('2026-09-04'), /4/);
  assert.equal(formatDate(''), '');
  assert.equal(formatDate('nope'), '');
});
