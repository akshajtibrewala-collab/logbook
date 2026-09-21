import { test } from 'node:test';
import assert from 'node:assert/strict';
import { greatCircle } from './geo.js';
import { buildMapData } from './mapdata.js';

test('great circle starts and ends at the endpoints', () => {
  const pts = greatCircle([37.6, -122.4], [51.5, -0.45]);
  assert.equal(pts.length, 49);
  assert.ok(Math.abs(pts[0][0] - 37.6) < 1e-6 && Math.abs(pts[0][1] + 122.4) < 1e-6);
  assert.ok(Math.abs(pts[48][0] - 51.5) < 1e-6 && Math.abs(pts[48][1] + 0.45) < 1e-6);
});

test('great circle bulges poleward (SFO to LHR peaks well north of both)', () => {
  const maxLat = Math.max(...greatCircle([37.6, -122.4], [51.5, -0.45]).map((p) => p[0]));
  assert.ok(maxLat > 58);
});

test('great circle stays continuous across the antimeridian', () => {
  const pts = greatCircle([35.5, 139.8], [37.6, -122.4]); // Tokyo -> SFO
  for (let i = 1; i < pts.length; i++) assert.ok(Math.abs(pts[i][1] - pts[i - 1][1]) < 30);
  assert.ok(Math.abs(pts[pts.length - 1][1] - 237.6) < 1e-6); // -122.4 unwrapped to the east of Tokyo
});

test('great circle between identical points does not blow up', () => {
  assert.equal(greatCircle([10, 10], [10, 10]).length, 2);
});

const A = { ident: 'KPAO', name: 'Palo Alto', lat: 37.46, lon: -122.11 };
const B = { ident: 'KSQL', name: 'San Carlos', lat: 37.51, lon: -122.25 };
const airports = { KPAO: A, PAO: A, KSQL: B };
const flight = (id, date, dep, arr) => ({ id, date, departure_airport: dep, arrival_airport: arr, total_time: 1, aircraft_type: 'C172', tail_number: 'N1' });

test('map data counts visits and merges routes in both directions', () => {
  const data = buildMapData([
    flight(1, '2026-01-01', 'KPAO', 'KSQL'),
    flight(2, '2026-01-05', 'KSQL', 'PAO'),
    flight(3, '2026-01-09', 'KPAO', 'KPAO'),
  ], airports);
  assert.equal(data.routes.length, 1);
  assert.equal(data.routes[0].count, 2);
  assert.deepEqual(data.routes[0].flights.map((f) => f.id), [2, 1]); // newest first
  assert.equal(data.routes[0].hours, 2);
  assert.equal(data.routes[0].first, '2026-01-01');
  assert.equal(data.routes[0].last, '2026-01-05');
  const pao = data.stops.find((s) => s.ident === 'KPAO');
  assert.equal(pao.visits, 3); // local flight counts once
  assert.deepEqual(pao.flights.map((f) => f.id), [3, 2, 1]); // newest first
  assert.equal(data.stops.find((s) => s.ident === 'KSQL').visits, 2);
  assert.equal(pao.first, '2026-01-01');
  assert.equal(pao.last, '2026-01-09');
});

test('map data reports unknown codes and skips their routes', () => {
  const data = buildMapData([flight(1, '2026-01-01', 'KPAO', 'zzzz'), flight(2, '2026-01-02', null, '')], airports);
  assert.deepEqual(data.unresolved, ['ZZZZ']);
  assert.equal(data.routes.length, 0);
  assert.equal(data.stops.length, 1);
});
