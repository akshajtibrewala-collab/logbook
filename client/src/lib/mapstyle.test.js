import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRouteColors, routeKey, usState, visitedCounts, airportSummary, shouldAnimateRoutes, loadAnimatePref, saveAnimatePref, orientedPositions, ROUTE_PALETTE, NEUTRAL_ROUTE } from './mapstyle.js';

const route = (aircraft, date) => ({ flights: [{ aircraft, date, hours: 1 }] });

test('colouring by year: newest year first, stable palette order', () => {
  const routes = [route('C172', '2025-06-01'), route('C172', '2026-01-01'), route('PA28', '2026-02-01')];
  const { colorOf, legend } = buildRouteColors(routes, 'year');
  assert.deepEqual(legend.map((l) => [l.key, l.count]), [['2026', 2], ['2025', 1]]);
  assert.equal(colorOf(routes[1]), ROUTE_PALETTE[0]);
  assert.equal(colorOf(routes[0]), ROUTE_PALETTE[1]);
});

test('colouring by aircraft: most routes first, blank grouped as Unknown', () => {
  const routes = [route('C172 · N1', '2026-01-01'), route('C172 · N1', '2026-01-02'), route('', '2026-01-03')];
  const { legend } = buildRouteColors(routes, 'aircraft');
  assert.deepEqual(legend.map((l) => l.key), ['C172 · N1', 'Unknown']);
  assert.equal(routeKey(routes[2], 'aircraft'), 'Unknown');
});

test('no colouring mode or no routes gives one neutral colour and no legend', () => {
  const r = buildRouteColors([route('a', '2026-01-01')], 'none');
  assert.equal(r.colorOf({}), NEUTRAL_ROUTE);
  assert.deepEqual(r.legend, []);
  assert.deepEqual(buildRouteColors([], 'year').legend, []);
});

test('more keys than palette colours wraps instead of failing', () => {
  const routes = Array.from({ length: 14 }, (_, i) => route('', `${2000 + i}-01-01`));
  const { legend } = buildRouteColors(routes, 'year');
  assert.equal(legend.length, 14);
  assert.ok(legend.every((l) => typeof l.color === 'string'));
});

test('usState only reads US regions', () => {
  assert.equal(usState({ region: 'US-CA' }), 'CA');
  assert.equal(usState({ region: 'CA-ON' }), null);
  assert.equal(usState({}), null);
});

test('visitedCounts counts distinct states and flags missing region data', () => {
  const stops = [{ region: 'US-CA', country: 'US' }, { region: 'US-CA', country: 'US' }, { region: 'US-NV', country: 'US' }, { region: 'CA-ON', country: 'CA' }];
  assert.deepEqual(visitedCounts(stops), { airports: 4, states: 2, stateCodes: ['CA', 'NV'], countries: 2, regionsKnown: true });
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
