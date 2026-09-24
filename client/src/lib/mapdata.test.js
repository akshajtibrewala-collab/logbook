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
