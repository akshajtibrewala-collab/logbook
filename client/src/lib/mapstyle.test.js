import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeColorFor, passengerRouteColorFor, PASSENGER_ROUTE_DASH, usState, countryOf, visitedCounts, airportSummary, shouldAnimateRoutes, loadAnimatePref, saveAnimatePref, orientedPositions } from './mapstyle.js';

test('routes use one colour per theme: a bright blue on dark tiles, a deeper blue on light tiles', () => {
  assert.equal(routeColorFor('dark'), '#38bdf8');
  assert.equal(routeColorFor('light'), '#0369a1');
  assert.equal(routeColorFor(undefined), '#38bdf8'); // anything unexpected falls back to the dark colour
  assert.notEqual(routeColorFor('dark'), routeColorFor('light'));
});

test('passenger routes get their own per-theme colour, distinct from pilot routes, plus a dash pattern (never color alone)', () => {
  assert.notEqual(passengerRouteColorFor('dark'), routeColorFor('dark'));
  assert.notEqual(passengerRouteColorFor('light'), routeColorFor('light'));
  assert.notEqual(passengerRouteColorFor('dark'), passengerRouteColorFor('light'));
  assert.ok(PASSENGER_ROUTE_DASH.length > 0);
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

// Regression: the countries count was previously hidden (nulled) behind `regionsKnown` at every call site
// (Stats' Travel/Places tabs, the passenger-flights summary), even though country data comes from the
// airports table's own `country` column and has nothing to do with whether region/state data has been
// seeded. None of these airports carry region data (regionsKnown stays false throughout), so this is
// exactly the case that was undercounting to zero/hidden before the fix.
test('visitedCounts counts countries even when no region data is seeded (the bug: countries was gated on regionsKnown)', () => {
  const stops = [{ region: null, country: 'US' }, { region: null, country: 'US' }, { region: null, country: 'CA' }];
  const counts = visitedCounts(stops);
  assert.equal(counts.regionsKnown, false); // region genuinely unknown — states legitimately hidden
  assert.equal(counts.countries, 2); // but countries must still be reported, not hidden/zeroed
});

// The pilot's real 26 pilot/passenger airports, resolved via the airports table (country codes as returned
// by GET /api/airports/resolve — see server/src/routes/airports.js), covering 9 distinct countries. None
// of these carry region data, matching production today.
const REAL_AIRPORTS = [
  { ident: 'CYUL', icao: 'CYUL', country: 'CA' }, { ident: 'CYYZ', icao: 'CYYZ', country: 'CA' },
  { ident: 'EGLL', icao: 'EGLL', country: 'GB' }, { ident: 'EPWA', icao: 'EPWA', country: 'PL' },
  { ident: 'KATL', icao: 'KATL', country: 'US' }, { ident: 'KBNA', icao: 'KBNA', country: 'US' },
  { ident: 'KDEN', icao: 'KDEN', country: 'US' }, { ident: 'KDFW', icao: 'KDFW', country: 'US' },
  { ident: 'KEWR', icao: 'KEWR', country: 'US' }, { ident: 'KMO6', icao: null, country: 'US' }, // KFYG, local-code only
  { ident: 'KIAD', icao: 'KIAD', country: 'US' }, { ident: 'KJFK', icao: 'KJFK', country: 'US' },
  { ident: 'KLAX', icao: 'KLAX', country: 'US' }, { ident: 'KORD', icao: 'KORD', country: 'US' },
  { ident: 'KPHL', icao: 'KPHL', country: 'US' }, { ident: 'KRDU', icao: 'KRDU', country: 'US' },
  { ident: 'KSFO', icao: 'KSFO', country: 'US' }, { ident: 'KSTL', icao: 'KSTL', country: 'US' },
  { ident: 'KSUS', icao: 'KSUS', country: 'US' }, { ident: 'LSZH', icao: 'LSZH', country: 'CH' },
  { ident: 'MDPP', icao: 'MDPP', country: 'DO' }, { ident: 'OMAA', icao: 'OMAA', country: 'AE' },
  { ident: 'OTHH', icao: 'OTHH', country: 'QA' }, { ident: 'VARP', icao: 'VERP', country: 'IN' },
  { ident: 'VASU', icao: 'VASU', country: 'IN' }, { ident: 'VEBS', icao: 'VEBS', country: 'IN' },
  { ident: 'VIDP', icao: 'VIDP', country: 'IN' }, { ident: 'VOBL', icao: 'VOBL', country: 'IN' },
];
const PILOT_ONLY_AIRPORTS = REAL_AIRPORTS.filter((a) => a.ident === 'KSUS' || a.ident === 'KMO6'); // the only two airports pilot-role flights touch

test('visitedCounts on the real 26 pilot/passenger airports reports 9 distinct countries', () => {
  assert.equal(visitedCounts(REAL_AIRPORTS).countries, 9);
});

test('visitedCounts on the pilot-only airports (both US) reports 1 country', () => {
  assert.equal(PILOT_ONLY_AIRPORTS.length, 2);
  assert.equal(visitedCounts(PILOT_ONLY_AIRPORTS).countries, 1);
});

test('countryOf uses the country column when present, regardless of case or surrounding whitespace', () => {
  assert.equal(countryOf({ country: 'US' }), 'US');
  assert.equal(countryOf({ country: ' gb ' }), 'GB');
});

test('countryOf falls back to a guess from the ICAO/ident prefix when country is missing', () => {
  assert.equal(countryOf({ country: null, icao: 'KABC' }), 'US'); // K -> US
  assert.equal(countryOf({ country: '', ident: 'PHNL' }), 'US'); // P -> US
  assert.equal(countryOf({ country: undefined, icao: 'CYXY' }), 'CA'); // C -> Canada
  assert.equal(countryOf({ country: null, icao: 'EGKK' }), 'GB'); // EG -> UK
});

test('countryOf reports "Unknown" — never dropped, never merged with another airport\'s country — when nothing resolves', () => {
  assert.equal(countryOf({ country: null, icao: null, ident: null }), 'Unknown');
  assert.equal(countryOf({}), 'Unknown');
  const stops = [{ country: 'US' }, { country: null, ident: 'ZZZZ' }, { country: null, ident: 'ZZZZ' }];
  assert.equal(visitedCounts(stops).countries, 2); // US + one Unknown bucket, not zero and not two Unknowns
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
