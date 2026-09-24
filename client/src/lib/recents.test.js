import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRecents, recordRecent, sortByRecency } from './recents.js';

const fakeStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

test('most recent first, deduplicated case-insensitively, capped', () => {
  const s = fakeStorage();
  recordRecent('airports', 'KPAO', s);
  recordRecent('airports', 'KSQL', s);
  recordRecent('airports', 'kpao', s);
  assert.deepEqual(getRecents('airports', s), ['kpao', 'KSQL']);
  for (let i = 0; i < 20; i++) recordRecent('airports', `K${i}XX`, s, 5);
  assert.equal(getRecents('airports', s).length, 5);
});

test('blank values are ignored and broken storage never throws', () => {
  const s = fakeStorage();
  assert.deepEqual(recordRecent('a', '', s), []);
  assert.deepEqual(getRecents('a', { getItem: () => { throw new Error('blocked'); } }), []);
  assert.deepEqual(recordRecent('a', 'X', { getItem: () => null, setItem: () => { throw new Error('full'); } }), ['X']);
});

test('sortByRecency floats recently used ids to the front', () => {
  const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
  assert.deepEqual(sortByRecency(items, [3, 1]).map((x) => x.id), [3, 1, 2]);
});
