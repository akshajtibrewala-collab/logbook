import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeColorFor, usState, visitedCounts, airportSummary, shouldAnimateRoutes, loadAnimatePref, saveAnimatePref, orientedPositions } from './mapstyle.js';

test('routes use one colour per theme: a bright blue on dark tiles, a deeper blue on light tiles', () => {
  assert.equal(routeColorFor('dark'), '#38bdf8');
  assert.equal(routeColorFor('light'), '#0369a1');
  assert.equal(routeColorFor(undefined), '#38bdf8'); // anything unexpected falls back to the dark colour
  assert.notEqual(routeColorFor('dark'), routeColorFor('light'));
});

test('a leftover colour-mode value in storage is simply never read (no such preference exists any more)', () => {
  const s = { getItem: (k) => (k === 'aerotrail-map-color-mode' ? 'year' : null), setItem: () => {} };
  assert.equal(loadAnimatePref(false, s), true); // unaffected by an old saved colour mode
});

test('usState only reads US regions', () => {
  assert.equal(usState({ region: 'US-CA' }), 'CA');
  assert.equal(usState({ region: 'CA-ON' }), null);
  assert.equal(usState({}), null);
});

test('visitedCounts counts distinct states and flags missing region data', () => {
  const stops = [{ region: 'US-CA', country: 'US' }, { region: 'US-CA', country: 'US' }, { region: 'US-NV', country: 'US' }, { region: 'CA-ON', country: 'CA' }];
  assert.deepEqual(visitedCounts(stops), { airports: 4, states: 2, countries: 2, regionsKnown: true });
  assert.equal(visitedCounts([{ country: 'US' }]).regionsKnown, false);
  assert.equal(visitedCounts([]).airports, 0);
});

test('airportSummary totals hours and reports first/last visit', () => {
  const s = airportSummary({ visits: 2, first: '2026-01-01', last: '2026-02-01', flights: [{ hours: 1.25 }, { hours: 0.5 }] });
  assert.deepEqual(s, { visits: 2, hours: 1.75, last: '2026-02-01', first: '2026-01-01' });
});

test('animation runs only when enabled and the route count is affordable', () => {
  assert.equal(shouldAnimateRoutes(21, true), true);
  assert.equal(shouldAnimateRoutes(21, false), false);
  assert.equal(shouldAnimateRoutes(500, true), false);
  assert.equal(shouldAnimateRoutes(0, true), false);
});

const fakeStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };

test('animate preference: default on, default off for reduced motion, a saved choice always wins', () => {
  const s = fakeStorage();
  assert.equal(loadAnimatePref(false, s), true);
  assert.equal(loadAnimatePref(true, s), false);
  saveAnimatePref(true, s); // switched on manually despite reduced motion
  assert.equal(loadAnimatePref(true, s), true);
  saveAnimatePref(false, s);
  assert.equal(loadAnimatePref(false, s), false);
});

test('animate preference tolerates blocked storage', () => {
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(loadAnimatePref(false, blocked), true);
  assert.doesNotThrow(() => saveAnimatePref(true, blocked));
});

test('orientedPositions flips a line so it runs from the route origin', () => {
  const pts = [[0, 0], [1, 1], [2, 2]];
  assert.deepEqual(orientedPositions({ origin: 'A', b: { ident: 'B' } }, pts), pts);
  assert.deepEqual(orientedPositions({ origin: 'B', b: { ident: 'B' } }, pts), [[2, 2], [1, 1], [0, 0]]);
  assert.deepEqual(orientedPositions({ origin: null, b: { ident: 'B' } }, pts), pts);
});
