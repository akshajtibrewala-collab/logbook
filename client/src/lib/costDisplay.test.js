import test from 'node:test';
import assert from 'node:assert/strict';
import { moneyWhole, moneyExact, expenseRow } from './costDisplay.js';

const label = (v) => ({ headset: 'Headset', books: 'Books & materials', other: 'Other' }[v] ?? v);

test('whole-dollar and exact money', () => {
  assert.equal(moneyWhole(1599.6), '$1,600'); assert.equal(moneyWhole(0), '$0'); assert.equal(moneyWhole(undefined), '$0');
  assert.equal(moneyExact(12345.67), '$12,345.67'); assert.equal(moneyExact(5), '$5.00');
});

test('an expense row shows the item once, with the category as a tag only when it adds something', () => {
  assert.deepEqual(expenseRow({ category: 'headset', note: 'Headset' }, label), { item: 'Headset', tag: '', label: 'Headset' });
  assert.deepEqual(expenseRow({ category: 'headset', note: '' }, label), { item: 'Headset', tag: '', label: 'Headset' });
  assert.deepEqual(expenseRow({ category: 'headset', note: null }, label), { item: 'Headset', tag: '', label: 'Headset' });
  assert.deepEqual(expenseRow({ category: 'books', note: 'Training kit' }, label), { item: 'Training kit', tag: 'Books & materials', label: 'Training kit, Books & materials' });
  assert.deepEqual(expenseRow({ category: 'other', note: 'Sales tax' }, label), { item: 'Sales tax', tag: 'Other', label: 'Sales tax, Other' });
});
