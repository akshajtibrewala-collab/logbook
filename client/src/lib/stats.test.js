import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hoursByCategory, hoursByAircraft, topRoutes, topAirports } from './stats.js';

const fl = (o) => ({ total_time: 1, ...o });

test('hours by category sums each column and drops empty ones', () => {
  const out = hoursByCategory([
    fl({ pic_time: 1.25, night_time: 0.5 }),
    fl({ pic_time: 0.75, dual_received: 0.1, night_time: 0.25 }),
  ]);
  assert.deepEqual(out.map((c) => [c.label, c.hours]), [['PIC', 2], ['Dual received', 0.1], ['Night', 0.75]]);
});

test('hours by aircraft groups case-insensitively, sorted by hours, blanks as Unknown', () => {
  const out = hoursByAircraft([
    fl({ aircraft_type: 'c172', total_time: 1.5 }),
    fl({ aircraft_type: 'C172', total_time: 1 }),
    fl({ aircraft_type: 'PA28', total_time: 3 }),
    fl({ aircraft_type: '', total_time: 0.5 }),
  ]);
  assert.deepEqual(out, [{ type: 'PA28', hours: 3 }, { type: 'C172', hours: 2.5 }, { type: 'Unknown', hours: 0.5 }]);
});

test('top routes ignores direction and handles local flights and missing codes', () => {
  const out = topRoutes([
    fl({ departure_airport: 'KPAO', arrival_airport: 'KSQL', total_time: 0.5 }),
    fl({ departure_airport: 'KSQL', arrival_airport: 'KPAO', total_time: 0.75 }),
    fl({ departure_airport: 'KPAO', arrival_airport: 'KPAO' }),
    fl({ departure_airport: 'KPAO', arrival_airport: null }),
  ]);
  assert.deepEqual(out, [
    { label: 'KPAO ↔ KSQL', count: 2, hours: 1.25 },
    { label: 'KPAO local', count: 1, hours: 1 },
  ]);
});

const pao = { ident: 'KPAO', icao: 'KPAO', name: 'Palo Alto Airport' };

test('resolved airports merge alternate codes', () => {
  const airports = { PAO: pao, KPAO: pao };
  const flights = [fl({ departure_airport: 'PAO', arrival_airport: 'KSQL' }), fl({ departure_airport: 'KSQL', arrival_airport: 'KPAO' })];
  assert.equal(topRoutes(flights, airports).length, 1);
  assert.deepEqual(topAirports(flights, airports)[0], { code: 'KPAO', name: 'Palo Alto Airport', count: 2 });
});

test('top airports counts a local flight once and respects the limit', () => {
  const flights = [fl({ departure_airport: 'A1', arrival_airport: 'A1' }), fl({ departure_airport: 'A1', arrival_airport: 'B2' }), fl({ departure_airport: 'C3', arrival_airport: 'D4' })];
  const out = topAirports(flights, {}, 2);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { code: 'A1', name: null, count: 2 });
});
