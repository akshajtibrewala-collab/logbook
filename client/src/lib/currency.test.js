import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, daysBetween, endOfMonth, dayCurrency, nightCurrency,
  instrumentCurrency, flightReviewStatus, summarize,
} from './currency.js';

const fl = (date, extra = {}) => ({ date, total_time: 1, day_landings: 0, night_landings: 0, approaches: 0, holds: 0, ...extra });

test('date helpers', () => {
  assert.equal(addDays('2026-01-01', 90), '2026-04-01');
  assert.equal(daysBetween('2026-06-30', '2026-08-08'), 39);
  assert.equal(endOfMonth('2024-01-15', 1), '2024-02-29');
  assert.equal(endOfMonth('2026-03-10', 24), '2028-03-31');
});

test('passenger currency expires 90 days after the third most recent landing', () => {
  const flights = [fl('2026-05-01', { day_landings: 1 }), fl('2026-05-10', { day_landings: 1 }), fl('2026-06-01', { day_landings: 1, night_landings: 1 })];
  const r = dayCurrency(flights, '2026-06-30');
  assert.equal(r.status, 'current');
  assert.equal(r.expires, '2026-08-08');
  assert.equal(r.daysRemaining, 39);
  assert.equal(r.count, 4);
});

test('passenger currency: last valid day is day 90, lapsed on day 91', () => {
  const flights = [fl('2026-01-01', { day_landings: 3 })];
  const last = dayCurrency(flights, '2026-04-01');
  assert.equal(last.daysRemaining, 0);
  assert.equal(last.status, 'expiring');
  const lapsed = dayCurrency(flights, '2026-04-02');
  assert.equal(lapsed.status, 'expired');
  assert.equal(lapsed.daysRemaining, -1);
});

test('passenger currency: fewer than 3 landings is not current', () => {
  const r = dayCurrency([fl('2026-06-01', { day_landings: 2 })], '2026-06-10');
  assert.equal(r.status, 'expired');
  assert.equal(r.expires, null);
});

test('passenger currency: old landings do not count and future flights are ignored', () => {
  const flights = [fl('2026-06-01', { day_landings: 2 }), fl('2025-01-01', { day_landings: 5 }), fl('2026-07-01', { day_landings: 5 })];
  const r = dayCurrency(flights, '2026-06-10');
  assert.equal(r.status, 'expired'); // third most recent is 2025-01-01 -> lapsed
  assert.equal(r.count, 2);
});

test('night currency only counts night landings', () => {
  const flights = [fl('2026-06-01', { day_landings: 5, night_landings: 2 })];
  assert.equal(nightCurrency(flights, '2026-06-10').status, 'expired');
  assert.equal(dayCurrency(flights, '2026-06-10').status, 'current');
  const three = [fl('2026-06-01', { night_landings: 3 })];
  assert.equal(nightCurrency(three, '2026-06-10').expires, '2026-08-30');
});

test('instrument currency lasts to end of the 6th month after the requirement was met', () => {
  const flights = [fl('2025-10-05', { approaches: 4, holds: 1 }), fl('2025-10-20', { approaches: 2 })];
  const r = instrumentCurrency(flights, '2026-03-15');
  assert.equal(r.status, 'current'); // 46 days left, outside the 30-day warning window
  assert.equal(r.expires, '2026-04-30');
  assert.equal(r.daysRemaining, 46);
  assert.equal(r.approaches, 6);
});

test('instrument currency is lapsed when the flights are too old', () => {
  const flights = [fl('2025-08-31', { approaches: 6, holds: 1 })];
  assert.equal(instrumentCurrency(flights, '2026-03-15').status, 'expired');
  assert.equal(instrumentCurrency(flights, '2026-02-28').status, 'expiring'); // Aug + 6 = end of Feb
});

test('instrument currency needs both 6 approaches and a hold', () => {
  assert.equal(instrumentCurrency([fl('2026-03-01', { approaches: 5, holds: 1 })], '2026-03-15').status, 'expired');
  const noHold = instrumentCurrency([fl('2026-03-01', { approaches: 8 })], '2026-03-15');
  assert.equal(noHold.status, 'expired');
  assert.equal(noHold.holds, 0);
});

test('instrument currency: a recent flight in the current month gives the full 6 months', () => {
  const r = instrumentCurrency([fl('2026-03-01', { approaches: 6, holds: 2 })], '2026-03-15');
  assert.equal(r.expires, '2026-09-30');
  assert.equal(r.status, 'current');
});

test('flight review is due at the end of the 24th calendar month', () => {
  const r = flightReviewStatus([{ date: '2024-03-10' }, { date: '2022-01-01' }], '2026-02-15');
  assert.equal(r.lastReview, '2024-03-10');
  assert.equal(r.expires, '2026-03-31');
  assert.equal(r.daysRemaining, 44);
  assert.equal(r.status, 'expiring');
  assert.equal(flightReviewStatus([{ date: '2024-03-10' }], '2025-01-15').status, 'current');
  assert.equal(flightReviewStatus([{ date: '2024-03-10' }], '2026-04-01').status, 'expired');
});

test('flight review with none logged is expired', () => {
  const r = flightReviewStatus([], '2026-02-15');
  assert.equal(r.status, 'expired');
  assert.equal(r.expires, null);
});

test('summarize totals hours for all time, this month, this year', () => {
  const flights = [fl('2026-06-02', { total_time: 1.25 }), fl('2026-06-20', { total_time: 0.5 }), fl('2026-02-01', { total_time: 2 }), fl('2025-12-31', { total_time: 3 })];
  assert.deepEqual(summarize(flights, '2026-06-25'), { total: 6.75, month: 1.75, year: 3.75 });
});
