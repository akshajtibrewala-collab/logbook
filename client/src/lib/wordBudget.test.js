import test from 'node:test';
import assert from 'node:assert/strict';
import { countWords, BUDGETS, ROW_MAX_WORDS } from './wordBudget.js';

test('countWords counts tokens with a letter or digit and ignores separators', () => {
  assert.equal(countWords('Local KSUS'), 2);
  assert.equal(countWords('09/12/2026 · J. Rivera'), 3);
  assert.equal(countWords('— · •'), 0);
  assert.equal(countWords('  2.60  '), 1);
  assert.equal(countWords(null), 0);
});

test('a minimal logbook row fits the six-word limit', () => {
  assert.ok(countWords('12') + countWords('Local KSUS') + countWords('J. Rivera') + countWords('2.60') <= ROW_MAX_WORDS);
});

test('every budget is a positive whole number and the Logbook stays at about 40', () => {
  for (const v of Object.values(BUDGETS)) assert.ok(Number.isInteger(v) && v > 0);
  assert.equal(BUDGETS.logbook, 40);
});
