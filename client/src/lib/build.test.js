import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatBuild, BUILD_ID } from './build.js';

test('outside a Vite build the id falls back to "dev"', () => assert.equal(BUILD_ID, 'dev'));

test('formatBuild shows the id and the local build time as MM/DD/YYYY HH:MM', () => {
  const t = new Date(2026, 9, 4, 21, 5).toISOString(); // built at 21:05 local on 4 Oct 2026
  assert.equal(formatBuild('a1b2c3d+edits', t), 'a1b2c3d+edits · 10/04/2026 21:05');
});

test('formatBuild with no or an invalid time returns just the id', () => {
  assert.equal(formatBuild('a1b2c3d', ''), 'a1b2c3d');
  assert.equal(formatBuild('a1b2c3d', 'not a date'), 'a1b2c3d');
});
