import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPlaceholderMean, meanLuminance, tileNote, retryUrl } from './mapTiles.js';

test('meanLuminance and the placeholder rule: dark canvas tiles are not placeholders, the light provider tile is', () => {
  const flat = (v, n = 64) => Uint8ClampedArray.from({ length: n * 4 }, (_, i) => (i % 4 === 3 ? 255 : v));
  assert.equal(Math.round(meanLuminance(flat(40))), 40);
  assert.equal(isPlaceholderMean(meanLuminance(flat(40))), false);
  assert.equal(isPlaceholderMean(meanLuminance(flat(90))), false);
  assert.equal(isPlaceholderMean(meanLuminance(flat(200))), true);
  assert.ok(Number.isNaN(meanLuminance(new Uint8ClampedArray(0))));
  assert.equal(isPlaceholderMean(NaN), false);
  assert.equal(isPlaceholderMean(undefined), false);
});

test('tileNote stays silent for a healthy or tiny view and speaks for mostly missing detail or failing tiles', () => {
  assert.equal(tileNote({ loaded: 20 }), null);
  assert.equal(tileNote({ loaded: 1, errors: 2 }), null); // too few to say
  assert.equal(tileNote({ loaded: 6, placeholders: 14 }), 'No map detail here at this zoom');
  assert.equal(tileNote({ loaded: 14, placeholders: 6 }), null);
  assert.equal(tileNote({ loaded: 2, errors: 18 }), "Map tiles aren't loading right now");
  assert.equal(tileNote({ loaded: 0, errors: 12, online: false }), 'Offline: map tiles unavailable');
  assert.equal(tileNote({}), null);
});

test('retryUrl adds one marker, with ? or &', () => {
  assert.equal(retryUrl('https://x/tile/1/2/3'), 'https://x/tile/1/2/3?retry=1');
  assert.equal(retryUrl('https://x/t?a=1'), 'https://x/t?a=1&retry=1');
});
