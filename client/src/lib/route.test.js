import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flightStops, flightCodes, routeTokens, airportCode } from './flightpath.js';
import { buildMapData } from './mapdata.js';
import { topRoutes, topAirports } from './stats.js';
import { parseImport } from './csv.js';

const SUS = { ident: 'KSUS', icao: 'KSUS', name: 'Spirit of St Louis', lat: 38.66, lon: -90.65 };
const FYG = { ident: 'KFYG', icao: 'KFYG', name: 'Washington Regional', lat: 38.59, lon: -91.0 };
const airports = { KSUS: SUS, KFYG: FYG };
const flight = (id, route, extra = {}) => ({
  id, date: `2026-08-${10 + id}`, departure_airport: 'KSUS', arrival_airport: 'KSUS', route, total_time: 1.5,
  aircraft_type: 'C172S', tail_number: 'N1', ...extra,
});

test('flight stops: departure, via airports, arrival; junk and repeats removed', () => {
  assert.deepEqual(routeTokens('kfyg, ksqL;  V23 /x'), ['KFYG', 'KSQL', 'V23']);
  assert.deepEqual(flightStops(flight(1, 'KFYG')), ['KSUS', 'KFYG', 'KSUS']);
  assert.deepEqual(flightStops(flight(1, null)), ['KSUS']);
  assert.deepEqual(flightCodes(flight(1, 'KFYG')), ['KSUS', 'KFYG']);
});

test('map: a via airport becomes a stop and a leg; out-and-back counts once per flight', () => {
  const data = buildMapData([flight(1, 'KFYG'), flight(2, null)], airports);
  assert.deepEqual(data.stops.map((s) => [s.ident, s.visits]), [['KSUS', 2], ['KFYG', 1]]);
  assert.equal(data.routes.length, 1);
  assert.equal(data.routes[0].count, 1); // KSUS -> KFYG -> KSUS is one flight on that leg
  assert.deepEqual(data.routes[0].flights.map((f) => f.id), [1]);
  assert.deepEqual(data.unresolved, []);
});

test('map: unknown via codes (airways, fixes) are ignored, not reported', () => {
  const data = buildMapData([flight(1, 'KFYG V23')], airports);
  assert.equal(data.stops.length, 2);
  assert.deepEqual(data.unresolved, []);
});

test('stats: legs and via airports count; plain local flights stay "local"', () => {
  const flights = [flight(1, 'KFYG'), flight(2, 'KFYG'), flight(3, null)];
  assert.deepEqual(topRoutes(flights, airports), [
    { label: 'KFYG ↔ KSUS', count: 2, hours: 3 },
    { label: 'KSUS local', count: 1, hours: 1.5 },
  ]);
  assert.deepEqual(topAirports(flights, airports).map((a) => [a.code, a.count]), [['KSUS', 3], ['KFYG', 2]]);
});

test('import: ForeFlight Route column becomes the via airports', () => {
  const csv = 'Date,AircraftID,From,To,Route,TotalTime\n2026-09-04,N370SP,KSUS,KSUS,KFYG,1.6\n2026-09-05,N370SP,KSUS,KSUS,,1.0\n';
  const { rows, ignored } = parseImport(csv);
  assert.deepEqual(rows.map((r) => r.flight.route), ['KFYG', null]);
  assert.ok(!ignored.includes('Route'));
});

test('airport display code: ICAO, else K + FAA code for US airports', () => {
  assert.equal(airportCode({ ident: 'KSUS', icao: 'KSUS' }), 'KSUS');
  assert.equal(airportCode({ ident: 'KMO6', icao: null, local_code: 'FYG', country: 'US' }), 'KFYG');
  assert.equal(airportCode({ ident: '4AR8', icao: null, local_code: '4AR8', country: 'US' }), '4AR8');
  assert.equal(airportCode({ ident: 'CYYZ', icao: 'CYYZ' }), 'CYYZ');
});
