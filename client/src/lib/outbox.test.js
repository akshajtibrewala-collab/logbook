import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveDraft, loadDraft, clearDraft, enqueue, outboxList, flushOutbox, isNetworkError, removeFromOutbox } from './outbox.js';

const fakeStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

test('drafts round-trip and clear', () => {
  const s = fakeStorage();
  assert.equal(loadDraft('flight', s), null);
  saveDraft('flight', { date: '2026-03-01', total_time: '1.2' }, s);
  assert.deepEqual(loadDraft('flight', s).value, { date: '2026-03-01', total_time: '1.2' });
  clearDraft('flight', s);
  assert.equal(loadDraft('flight', s), null);
});

test('corrupt or missing storage never throws', () => {
  const bad = { getItem: () => '{oops', setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
  assert.equal(loadDraft('x', bad), null);
  assert.equal(saveDraft('x', {}, bad), false);
  assert.deepEqual(outboxList(bad), []);
  assert.equal(enqueue({ a: 1 }, bad), null);
  assert.equal(loadDraft('x', null), null);
});

test('flush sends queued flights in order and empties the queue', async () => {
  const s = fakeStorage();
  enqueue({ n: 1 }, s); enqueue({ n: 2 }, s);
  const seen = [];
  const r = await flushOutbox(async (p) => { seen.push(p.n); }, s);
  assert.deepEqual(seen, [1, 2]);
  assert.deepEqual(r, { sent: 2, remaining: 0 });
});

test('a network failure keeps everything queued; a later flush succeeds', async () => {
  const s = fakeStorage();
  enqueue({ n: 1 }, s); enqueue({ n: 2 }, s);
  const offline = () => { const e = new TypeError('Failed to fetch'); throw e; };
  assert.deepEqual(await flushOutbox(offline, s), { sent: 0, remaining: 2 });
  assert.deepEqual(await flushOutbox(async () => {}, s), { sent: 2, remaining: 0 });
});

test('a server rejection is kept (flagged), not deleted or retried forever', async () => {
  const s = fakeStorage();
  enqueue({ n: 1 }, s); enqueue({ n: 2 }, s);
  const sent = [];
  await flushOutbox(async (p) => { if (p.n === 1) throw new Error('Date must be YYYY-MM-DD'); sent.push(p.n); }, s);
  assert.deepEqual(sent, [2]);
  const left = outboxList(s);
  assert.equal(left.length, 1);
  assert.equal(left[0].rejected, 'Date must be YYYY-MM-DD');
  const again = await flushOutbox(async () => { throw new Error('should not retry'); }, s);
  assert.equal(again.remaining, 1);
  removeFromOutbox(left[0].id, s);
  assert.equal(outboxList(s).length, 0);
});

test('isNetworkError recognises fetch failures only', () => {
  assert.equal(isNetworkError(new TypeError('Failed to fetch')), true);
  assert.equal(isNetworkError(Object.assign(new Error('x'), { network: true })), true);
  assert.equal(isNetworkError(new Error('Request failed')), false);
});
