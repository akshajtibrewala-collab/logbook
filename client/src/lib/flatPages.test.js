import test from 'node:test';
import assert from 'node:assert/strict';
import { isFlatCardPage } from './flatPages.js';

test('the older form and settings routes are flat', () => {
  for (const p of ['/aircraft/new', '/aircraft/12', '/currency/new', '/currency/3', '/logbook/ground/new', '/logbook/ground/4/edit', '/logbook/quick', '/weather/settings', '/logbook/share', '/settings', '/settings/']) assert.equal(isFlatCardPage(p), true, p);
});
test('redesigned pages are not', () => {
  for (const p of ['/', '/logbook', '/logbook/new', '/logbook/12', '/logbook/12/edit', '/travel', '/aircraft', '/logbook/data', '/map', '/stats', '/more']) assert.equal(isFlatCardPage(p), false, p);
});
