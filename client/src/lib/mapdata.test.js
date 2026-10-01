import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMapData, placeableMapData } from './mapdata.js';

const A = { ident: 'KAAA', lat: 1, lon: 1 };
const B = { ident: 'KBBB', lat: 2, lon: 2 };
const airports = { KAAA: A, KBBB: B };

test('a route remembers the direction of its most recent flight', () => {
  const flights = [
    { id: 1, date: '2026-01-01', departure_airport: 'KAAA', arrival_airport: 'KBBB', total_time: 1 },
    { id: 2, date: '2026-02-01', departure_airport: 'KBBB', arrival_airport: 'KAAA', total_time: 1 },
  ];
  const [route] = buildMapData(flights, airports).routes;
  assert.equal(route.origin, 'KBBB');
  const [reordered] = buildMapData([...flights].reverse(), airports).routes;
  assert.equal(reordered.origin, 'KBBB'); // independent of the order flights arrive in
});

test('stops carry per-flight hours and notes for the pin summary', () => {
  const flights = [{ id: 1, date: '2026-01-01', departure_airport: 'KAAA', arrival_airport: 'KBBB', total_time: 1.5, remarks: 'windy' }];
  const stop = buildMapData(flights, airports).stops.find((s) => s.ident === 'KAAA');
  assert.equal(stop.flights[0].hours, 1.5);
  assert.equal(stop.flights[0].note, 'windy');
});

test('a flight naming only unplaceable airports is counted, not silently dropped', () => {
  const bothUnknown = buildMapData([{ id: 1, date: '2026-01-01', departure_airport: 'ZZZZ', arrival_airport: 'YYYY', total_time: 1 }], airports);
  assert.equal(bothUnknown.unresolvedFlightCount, 1);
  const oneKnown = buildMapData([{ id: 2, date: '2026-01-01', departure_airport: 'KAAA', arrival_airport: 'ZZZZ', total_time: 1 }], airports);
  assert.equal(oneKnown.unresolvedFlightCount, 0); // a real (if lonely) stop, not "missing"
  const blank = buildMapData([{ id: 3, date: '2026-01-01', departure_airport: null, arrival_airport: '', total_time: 1 }], airports);
  assert.equal(blank.unresolvedFlightCount, 0); // nothing entered isn't a data problem
});

test('placeableMapData drops a stop with no coordinates, and the routes that touched it', () => {
  const noCoords = { ident: 'KCCC', lat: null, lon: null };
  const airportsWithGap = { ...airports, KCCC: noCoords };
  const flights = [
    { id: 1, date: '2026-01-01', departure_airport: 'KAAA', arrival_airport: 'KBBB', total_time: 1 },
    { id: 2, date: '2026-01-02', departure_airport: 'KAAA', arrival_airport: 'KCCC', total_time: 1 },
  ];
  const data = buildMapData(flights, airportsWithGap);
  const placeable = placeableMapData(data);
  assert.deepEqual(placeable.stops.map((s) => s.ident).sort(), ['KAAA', 'KBBB']);
  assert.deepEqual(placeable.routes.map((r) => [r.a.ident, r.b.ident].sort()), [['KAAA', 'KBBB']]); // KAAA-KCCC can't be drawn
});

test('placeableMapData counts a flight as omitted only when NONE of its stops can be placed', () => {
  const noCoords = { ident: 'KCCC', lat: undefined, lon: undefined };
  const airportsWithGap = { ...airports, KCCC: noCoords };
  const bothBad = buildMapData([{ id: 1, date: '2026-01-01', departure_airport: 'KCCC', arrival_airport: 'KCCC', total_time: 1 }], { KCCC: noCoords });
  assert.equal(placeableMapData(bothBad).omittedFlightCount, 1);

  const oneGood = buildMapData([{ id: 2, date: '2026-01-01', departure_airport: 'KAAA', arrival_airport: 'KCCC', total_time: 1 }], airportsWithGap);
  assert.equal(placeableMapData(oneGood).omittedFlightCount, 0); // KAAA still shows as a dot
});

test('routes carry a great-circle distance in nautical miles, rolled up into a running total', () => {
  const flights = [
    { id: 1, date: '2026-01-01', departure_airport: 'KAAA', arrival_airport: 'KBBB', total_time: 1 },
    { id: 2, date: '2026-01-02', departure_airport: 'KAAA', arrival_airport: 'KBBB', total_time: 1 },
  ];
  const data = buildMapData(flights, airports);
  assert.equal(data.routes.length, 1);
  assert.ok(data.routes[0].distanceNm > 0);
  assert.equal(data.totalDistanceNm, data.routes[0].distanceNm * 2); // flown twice
});
