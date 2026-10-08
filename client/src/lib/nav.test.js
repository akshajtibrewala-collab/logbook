import test from 'node:test';
import assert from 'node:assert/strict';
import { TABS, sectionOf, titleOf, isRoot, showAdd, addItemsFor, isFocusedForm, LEGACY_ROUTES } from './nav.js';

test('five tabs: Home, Flying, Travel, Map, More', () => {
  assert.deepEqual(TABS.map((t) => t.label), ['Home', 'Flying', 'Travel', 'Map', 'More']);
});

test('every pre-redesign URL maps to a tab and gets a real title (nothing falls through)', () => {
  const keys = new Set(TABS.map((t) => t.key));
  for (const url of LEGACY_ROUTES) {
    assert.ok(keys.has(sectionOf(url)), `section for ${url}`);
    assert.notEqual(titleOf(url), 'AeroHub', `title for ${url}`);
  }
});

test('sections: Flying owns the logbook, currency, milestones, weather and costs; More owns stats, aircraft, data and share', () => {
  for (const u of ['/logbook', '/logbook/5', '/logbook/quick', '/currency', '/currency/new', '/milestones', '/weather', '/weather/settings', '/costs', '/costs/settings', '/flying']) assert.equal(sectionOf(u), 'flying', u);
  for (const u of ['/stats', '/aircraft', '/aircraft/15', '/logbook/data', '/logbook/share', '/logbook/print', '/settings', '/more', '/airports/KSUS']) assert.equal(sectionOf(u), 'more', u);
  assert.equal(sectionOf('/travel'), 'travel'); assert.equal(sectionOf('/travel/181'), 'travel');
  assert.equal(sectionOf('/map'), 'map'); assert.equal(sectionOf('/'), 'home');
});

test('trailing slashes and unknown paths behave', () => {
  assert.equal(sectionOf('/travel/'), 'travel');
  assert.equal(titleOf('/stats/'), 'Stats');
  assert.equal(sectionOf('/nope'), 'home');
});

test('tab roots have no back button, detail pages do', () => {
  for (const u of ['/', '/logbook', '/travel', '/map', '/more']) assert.equal(isRoot(u), true, u);
  for (const u of ['/logbook/5', '/travel/181', '/stats', '/aircraft', '/currency']) assert.equal(isRoot(u), false, u);
});

test('the Add button hides on forms and leaf settings pages only', () => {
  for (const u of ['/', '/logbook', '/travel', '/map', '/stats', '/more', '/aircraft', '/currency', '/milestones', '/weather', '/costs', '/logbook/5', '/travel/181']) assert.equal(showAdd(u), true, u);
  for (const u of ['/logbook/new', '/logbook/quick', '/logbook/5/edit', '/logbook/ground/new', '/aircraft/new', '/aircraft/15', '/currency/new', '/weather/settings', '/costs/settings', '/logbook/print', '/settings']) assert.equal(showAdd(u), false, u);
});

test('forms are focused screens (no tab bar); lists, details and tab roots are not', () => {
  for (const u of ['/logbook/new', '/logbook/quick', '/logbook/5/edit', '/logbook/ground/new', '/logbook/ground/1/edit', '/currency/new', '/currency/1', '/weather/settings', '/costs/settings', '/aircraft/new']) assert.equal(isFocusedForm(u), true, u);
  for (const u of ['/', '/logbook', '/logbook/5', '/logbook/ground/1', '/travel', '/travel/181', '/aircraft', '/aircraft/15', '/currency', '/costs', '/map', '/stats', '/logbook/data']) assert.equal(isFocusedForm(u), false, u);
});

test('the Add menu offers Quick log, Copy last, Pilot, Passenger and Log ground session in that order, with the right targets', () => {
  const items = addItemsFor('/');
  assert.deepEqual(items.map((i) => i.key), ['quick', 'copy', 'pilot', 'pax', 'ground']);
  assert.equal(items[0].to, '/logbook/quick');
  assert.equal(items[1].to, '/logbook/new?copy=last');
  assert.equal(items[2].to, '/logbook/new');
  assert.ok(items[3].to.startsWith('/logbook/new?role=passenger'));
  assert.equal(items[4].to, '/logbook/ground/new');
  assert.ok(addItemsFor('/logbook').some((i) => i.key === 'ground'));
  assert.ok(addItemsFor('/aircraft').some((i) => i.key === 'aircraft'));
});

test('the Costs sub-screens are titled, belong to Flying, and keep a Back button', () => {
  for (const [u, t] of [['/costs/spending', 'Spending'], ['/costs/phases', 'Training phases'], ['/costs/expenses', 'Expenses'], ['/costs/projection', 'Projection']]) {
    assert.equal(titleOf(u), t, u); assert.equal(sectionOf(u), 'flying', u); assert.equal(isRoot(u), false, u);
  }
  assert.equal(titleOf('/costs'), 'Costs'); assert.equal(isRoot('/costs'), false);
});
