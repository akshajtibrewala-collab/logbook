import test from 'node:test';
import assert from 'node:assert/strict';
import { instructorNames } from './instructors.js';

test('instructor suggestions are the distinct names used, most used first', () => {
  const flights = [{ instructor: 'Pat Rivera' }, { instructor: 'Pat Rivera' }, { instructor: 'Sam Ortiz' }, { instructor: '' }, { instructor: null }, {}];
  const ground = [{ instructor: 'Pat Rivera' }, { instructor: 'Lee Novak' }];
  assert.deepEqual(instructorNames(flights, ground), ['Pat Rivera', 'Lee Novak', 'Sam Ortiz']);
});

test('names that differ only by case or spacing are one suggestion, in the most used spelling', () => {
  const rows = [{ instructor: 'pat rivera' }, { instructor: 'Pat  Rivera ' }, { instructor: 'Pat Rivera' }, { instructor: 'Pat Rivera' }];
  assert.deepEqual(instructorNames(rows), ['Pat Rivera']);
  assert.deepEqual(instructorNames(), []);
  assert.deepEqual(instructorNames(null, undefined), []);
});
