import test from 'node:test';
import assert from 'node:assert/strict';
import { isChunkLoadError, claimAutoReload, RELOAD_FLAG, RELOAD_GUARD_MS } from './chunkRecovery.js';

const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), m }; };

test('failed dynamic imports are recognised in the browsers the app runs in; other errors are not', () => {
  for (const msg of ['Failed to fetch dynamically imported module: https://x/assets/Logbook-abc.js', 'error loading dynamically imported module', 'Importing a module script failed.', 'Loading chunk 42 failed.', 'Unable to preload CSS for /assets/Map-1.css']) {
    assert.equal(isChunkLoadError(new TypeError(msg)), true, msg);
  }
  assert.equal(isChunkLoadError(Object.assign(new Error('x'), { name: 'ChunkLoadError' })), true);
  assert.equal(isChunkLoadError(new Error('Cannot read properties of undefined')), false);
  assert.equal(isChunkLoadError(null), false);
});

test('one automatic reload per 30 seconds, so a missing chunk can never loop', () => {
  const s = store();
  assert.equal(claimAutoReload(s, 1000), true, 'the first failure reloads');
  assert.equal(s.m.get(RELOAD_FLAG), '1000');
  assert.equal(claimAutoReload(s, 1000 + RELOAD_GUARD_MS - 1), false, 'a second failure right after does not reload again');
  assert.equal(claimAutoReload(s, 1000 + RELOAD_GUARD_MS + 1), true, 'much later it may');
  assert.equal(claimAutoReload({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }, 5), false, 'blocked storage: never reload automatically');
});

test('the recovery touches neither the offline outbox nor the flight draft (their keys are not in the recovery code)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('./chunkRecovery.js', import.meta.url), 'utf8') + fs.readFileSync(new URL('../components/ChunkBoundary.jsx', import.meta.url), 'utf8');
  assert.equal(/aerotrail-outbox|localStorage|flight-new|clearDraft|removeFromOutbox/.test(src.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')), false);
});
