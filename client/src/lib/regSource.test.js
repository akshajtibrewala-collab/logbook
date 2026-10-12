import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registrationMarker } from './regSource.js';

const filled = { role: 'passenger', tail_number: 'N1TEST', reg_source: 'aerodatabox', reg_filled_at: '2026-06-15T06:00:00.000Z', reg_cleared_at: null };

test('an automatically filled registration shows the marker with its source and date', () => {
  assert.deepEqual(registrationMarker(filled), { provider: 'AeroDataBox', url: 'https://aerodatabox.com', filledOn: '2026-06-15' });
});

test('the date is taken from the stored text, never shifted through a Date', () => {
  assert.equal(registrationMarker({ ...filled, reg_filled_at: '2026-06-15T23:59:59.000Z' }).filledOn, '2026-06-15');
  assert.equal(registrationMarker({ ...filled, reg_filled_at: null }).filledOn, null);
});

test('no marker for a typed value, a cleared value, a blank tail, a pilot flight or an unknown source', () => {
  assert.equal(registrationMarker({ ...filled, reg_source: null }), null);
  assert.equal(registrationMarker({ ...filled, reg_cleared_at: '2026-06-16T00:00:00.000Z' }), null);
  assert.equal(registrationMarker({ ...filled, tail_number: '  ' }), null);
  assert.equal(registrationMarker({ ...filled, tail_number: null }), null);
  assert.equal(registrationMarker({ ...filled, role: 'pilot' }), null);
  assert.equal(registrationMarker({ ...filled, reg_source: 'other' }), null);
  assert.equal(registrationMarker(null), null);
  assert.equal(registrationMarker({}), null);
});
