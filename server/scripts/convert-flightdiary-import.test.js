import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertRow, convertFlightdiary } from './convert-flightdiary-import.js';

// Synthetic fixture rows only — no real personal flight data. Column order matches a real Flightdiary export.
const HEAD = [
  'Date', 'Flight number', 'From', 'To', 'Dep time', 'Arr time', 'Duration', 'Airline', 'Aircraft', 'Registration',
  'Seat number', 'Seat type', 'Flight class', 'Flight reason', 'Note', 'Dep_id', 'Arr_id', 'Airline_id', 'Aircraft_id',
];
const col = Object.fromEntries(HEAD.map((h, i) => [h, i]));

const row = (overrides = {}) => {
  const base = {
    Date: '2026-01-15', 'Flight number': 'WN123', From: 'St Louis / St Louis (STL/KSTL)', To: 'Chicago / OHare (ORD/KORD)',
    'Dep time': '10:00:00', 'Arr time': '11:30:00', Duration: '01:30:00', Airline: 'Southwest Airlines (WN/SWA)',
    Aircraft: 'Boeing 737-800 (B738)', Registration: 'N123AB', 'Seat number': '9A', 'Seat type': '1', 'Flight class': '1',
    'Flight reason': '1', Note: 'ignored', Dep_id: '1', Arr_id: '2', Airline_id: '3', Aircraft_id: '4',
    ...overrides,
  };
  return HEAD.map((h) => base[h]);
};

test('convertRow: extracts ICAO from parens, plain airline name, decimal hours, seat note, and seat_class mapping', () => {
  const out = convertRow(row(), col);
  const field = (name) => out[[
    'role', 'date', 'departure_airport', 'arrival_airport', 'airline', 'flight_number', 'aircraft_type', 'tail_number',
    'total_time', 'pic_time', 'sic_time', 'dual_received', 'dual_given', 'solo_time', 'simulator_time', 'ground_time',
    'night_time', 'instrument_actual', 'instrument_simulated', 'cross_country_time',
    'day_landings', 'full_stop_day_landings', 'night_landings', 'full_stop_night_landings',
    'approaches', 'holds', 'remarks', 'seat_class',
  ].indexOf(name)];

  assert.equal(field('role'), 'passenger');
  assert.equal(field('date'), '2026-01-15');
  assert.equal(field('departure_airport'), 'KSTL');
  assert.equal(field('arrival_airport'), 'KORD');
  assert.equal(field('airline'), 'Southwest Airlines');
  assert.equal(field('flight_number'), 'WN123');
  assert.equal(field('aircraft_type'), 'Boeing 737-800 (B738)');
  assert.equal(field('tail_number'), 'N123AB');
  assert.equal(field('total_time'), '1.5');
  assert.equal(field('remarks'), 'Seat 9A');
  assert.equal(field('seat_class'), 'economy'); // Flight class 1
  for (const zeroField of ['pic_time', 'sic_time', 'dual_received', 'night_time', 'day_landings', 'approaches', 'holds']) {
    assert.equal(field(zeroField), '0');
  }
});

test('convertRow: seat_class mapping for every confirmed Flight class code', () => {
  assert.equal(convertRow(row({ 'Flight class': '1' }), col)[27], 'economy');
  assert.equal(convertRow(row({ 'Flight class': '2' }), col)[27], 'business');
  assert.equal(convertRow(row({ 'Flight class': '3' }), col)[27], 'first');
  assert.equal(convertRow(row({ 'Flight class': '4' }), col)[27], 'premium_economy');
  assert.equal(convertRow(row({ 'Flight class': '' }), col)[27], ''); // no class recorded -> blank, not guessed
});

test('convertRow: a missing seat number leaves remarks blank; a missing registration leaves tail_number blank', () => {
  const out = convertRow(row({ 'Seat number': '', Registration: '' }), col);
  assert.equal(out[26], ''); // remarks
  assert.equal(out[7], ''); // tail_number
});

test('convertFlightdiary: reports airlines with no branded badge, others are silent', () => {
  const body = [row({ Airline: 'Southwest Airlines (WN/SWA)' }), row({ Airline: 'Not A Real Airline (ZZ/ZZZ)' })];
  const { rowCount, unresolvedAirlines, csv } = convertFlightdiary(HEAD, body);
  assert.equal(rowCount, 2);
  assert.deepEqual(unresolvedAirlines, ['Not A Real Airline']);
  assert.match(csv, /^role,date,departure_airport/);
});
