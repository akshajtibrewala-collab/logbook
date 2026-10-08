import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLevel, stepDown, createFrameMonitor } from './glassQuality.js';

test('resolveLevel: explicit preference wins, Auto uses the settled level', () => {
  assert.equal(resolveLevel({ pref: 'full' }), 'full');
  assert.equal(resolveLevel({ pref: 'lite' }), 'lite');
  assert.equal(resolveLevel({ pref: 'auto', autoLevel: 'lite' }), 'lite');
  assert.equal(resolveLevel({ pref: 'auto' }), 'full');
  assert.equal(resolveLevel({ pref: 'bogus' }), 'full');
});

test('resolveLevel: reduce transparency and unsupported backdrop-filter always map to solid', () => {
  assert.equal(resolveLevel({ pref: 'full', reduce: true }), 'solid');
  assert.equal(resolveLevel({ pref: 'auto', autoLevel: 'full', supported: false }), 'solid');
});

test('stepDown only goes down', () => {
  assert.equal(stepDown('full'), 'lite');
  assert.equal(stepDown('lite'), 'solid');
  assert.equal(stepDown('solid'), 'solid');
});

const feed = (m, dt, n) => { let r = false; for (let i = 0; i < n; i++) r = m.push(dt) || r; return r; };

test('frame monitor: steady 60fps never drops', () => {
  const m = createFrameMonitor();
  assert.equal(feed(m, 16.7, 600), false);
});

test('frame monitor: a sustained ~30fps drops after two bad windows, not one', () => {
  const m = createFrameMonitor();
  assert.equal(feed(m, 33, 31), false); // first bad window
  assert.equal(feed(m, 33, 31), true); // second in a row
});

test('frame monitor: one slow window followed by a good one resets', () => {
  const m = createFrameMonitor();
  feed(m, 33, 31);
  assert.equal(feed(m, 16, 70), false);
  assert.equal(feed(m, 33, 31), false); // counter restarted
});

test('frame monitor: long gaps (hidden tab, paused scroll) are ignored, not counted as slow', () => {
  const m = createFrameMonitor();
  assert.equal(feed(m, 1200, 20), false);
  assert.equal(feed(m, 16, 100), false);
});

test('frame monitor: a very slow stretch (10fps) counts as bad even though few frames land in the window', () => {
  const m = createFrameMonitor();
  assert.equal(feed(m, 100, 10), false); // first bad window
  assert.equal(feed(m, 100, 10), true);
});

test('frame monitor: a handful of frames is not a verdict', () => {
  const m = createFrameMonitor({ minFrames: 4 });
  assert.equal(feed(m, 240, 4), false); // 4 frames, ~1s: only one window so far
  assert.equal(feed(m, 240, 3), false); // an incomplete second window
});
