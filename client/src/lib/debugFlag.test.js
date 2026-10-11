import { test } from 'node:test';
import assert from 'node:assert/strict';
import { debugEnabled } from './debugFlag.js';

const store = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

test('off by default, with no storage, and for any value other than 1', () => {
  assert.equal(debugEnabled('', store()), false);
  assert.equal(debugEnabled('?debug=true', store()), false);
  assert.equal(debugEnabled('?debug=1', null), true);
  assert.equal(debugEnabled('', null), false);
});

test('?debug=1 is remembered for the session and ?debug=0 turns it off', () => {
  const s = store();
  assert.equal(debugEnabled('?x=2&debug=1', s), true);
  assert.equal(debugEnabled('', s), true);
  assert.equal(debugEnabled('?debug=0', s), false);
  assert.equal(debugEnabled('', s), false);
});

test('a throwing storage never throws', () => {
  const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(debugEnabled('?debug=1', bad), true);
  assert.equal(debugEnabled('', bad), false);
});
