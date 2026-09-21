import { test } from 'node:test';
import assert from 'node:assert/strict';
import { greeting, timeOfDayGreeting } from './greeting.js';

const at = (h, m = 0) => new Date(2026, 8, 21, h, m);

test('greeting changes at 5:00, 12:00 and 17:00 local time', () => {
  assert.equal(timeOfDayGreeting(at(4, 59)), 'Good evening');
  assert.equal(timeOfDayGreeting(at(5, 0)), 'Good morning');
  assert.equal(timeOfDayGreeting(at(11, 59)), 'Good morning');
  assert.equal(timeOfDayGreeting(at(12, 0)), 'Good afternoon');
  assert.equal(timeOfDayGreeting(at(16, 59)), 'Good afternoon');
  assert.equal(timeOfDayGreeting(at(17, 0)), 'Good evening');
  assert.equal(timeOfDayGreeting(at(0, 0)), 'Good evening');
  assert.equal(timeOfDayGreeting(at(23, 59)), 'Good evening');
});

test('greeting includes the hardcoded name', () => {
  assert.equal(greeting(at(9)), 'Good morning, Akshaj');
  assert.equal(greeting(at(14)), 'Good afternoon, Akshaj');
  assert.equal(greeting(at(20)), 'Good evening, Akshaj');
});
