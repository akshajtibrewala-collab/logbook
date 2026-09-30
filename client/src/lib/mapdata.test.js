import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMapData } from './mapdata.js';

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
