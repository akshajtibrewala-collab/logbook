import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
const { convertRow, convertFlightdiary, resolveDurations, cleanAircraftType, applyCorrectionsOverlay } = await import('./convert-flightdiary-import.js');
const { migrate } = await import('../src/migrate.js');
const { run } = await import('../src/db.js');

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

test('cleanAircraftType: a bare empty parenthetical (Flightdiary\'s "unknown type" placeholder) becomes blank', () => {
  assert.equal(cleanAircraftType(' ()'), '');
  assert.equal(cleanAircraftType('()'), '');
  assert.equal(cleanAircraftType('  '), '');
  assert.equal(cleanAircraftType(''), '');
  assert.equal(cleanAircraftType(undefined), '');
  assert.equal(cleanAircraftType('Boeing 737-800 (B738)'), 'Boeing 737-800 (B738)');
});

test('convertRow: an empty-parenthetical Aircraft column becomes a blank aircraft_type, not the literal "()"', () => {
  const out = convertRow(row({ Aircraft: ' ()' }), col);
  assert.equal(out[6], ''); // aircraft_type
});

test('convertFlightdiary: reports airlines with no branded badge, others are silent', () => {
  const body = [row({ Airline: 'Southwest Airlines (WN/SWA)' }), row({ Airline: 'Not A Real Airline (ZZ/ZZZ)' })];
  const { rowCount, unresolvedAirlines, csv } = convertFlightdiary(HEAD, body);
  assert.equal(rowCount, 2);
  assert.deepEqual(unresolvedAirlines, ['Not A Real Airline']);
  assert.match(csv, /^role,date,departure_airport/);
});

test('convertRow: dep_time/arr_time keep Flightdiary\'s local HH:MM (seconds dropped); arr_day_offset starts blank', () => {
  const out = convertRow(row({ 'Dep time': '16:25:00', 'Arr time': '19:15:00' }), col);
  assert.equal(out[28], '16:25'); // dep_time
  assert.equal(out[29], '19:15'); // arr_time
  assert.equal(out[30], ''); // arr_day_offset, filled in by resolveDurations()
});

test('resolveDurations: recomputes total_time and arr_day_offset from local times across a time zone change', async () => {
  await migrate();
  await run("INSERT INTO airports (ident, icao, iata, local_code, name, city, country, type, lat, lon) VALUES ('KSTL','KSTL','STL','STL','St Louis Lambert','St Louis','US','large_airport',38.75,-90.37)");
  await run("INSERT INTO airports (ident, icao, iata, local_code, name, city, country, type, lat, lon) VALUES ('KRDU','KRDU','RDU','RDU','Raleigh-Durham','Raleigh','US','large_airport',35.88,-78.79)");

  const body = [row({ From: 'St Louis / St Louis (STL/KSTL)', To: 'Raleigh / Durham (RDU/KRDU)', 'Dep time': '16:25:00', 'Arr time': '19:15:00', Duration: '02:50:00' })];
  const { rows } = convertFlightdiary(HEAD, body);
  const { comparisons } = await resolveDurations(rows);

  assert.equal(rows[0][8], '1.83'); // total_time recomputed to the real 1h50m elapsed, not Flightdiary's naive 2h50m
  assert.equal(rows[0][30], '0'); // arr_day_offset
  assert.equal(comparisons.length, 1);
  assert.equal(comparisons[0].matched, false); // Flightdiary's own naive Duration was off by an hour here
  assert.equal(comparisons[0].diffMinutes, 60);
});

// Real rows from the pilot's own 73-row export (2026-09-30 --check run), locked down here so the two known
// discrepancy clusters (see the comment above printComparisons() in convert-flightdiary-import.js) stay
// explained and don't silently change if tz-lookup's boundary data or passengerDuration ever changes.
test('resolveDurations: KIAD->VIDP 2023-07-23 (India, UTC+5:30) computes ~14.25h, not Flightdiary\'s naive 14.75h', async () => {
  await migrate();
  await run("INSERT INTO airports (ident, icao, iata, local_code, name, city, country, type, lat, lon) VALUES ('KIAD','KIAD','IAD','IAD','Washington Dulles','Dulles','US','large_airport',38.9445,-77.4558)");
  await run("INSERT INTO airports (ident, icao, iata, local_code, name, city, country, type, lat, lon) VALUES ('VIDP','VIDP','DEL',NULL,'Indira Gandhi Intl','New Delhi','IN','large_airport',28.55563,77.09519)");

  const body = [row({
    Date: '2023-07-23', 'Flight number': 'AI104', From: 'Washington / Dulles (IAD/KIAD)', To: 'Delhi / Indira Gandhi (DEL/VIDP)',
    'Dep time': '11:15:00', 'Arr time': '11:00:00', Duration: '14:45:00', Airline: 'Air India (AI/AIC)', Aircraft: 'Boeing 787-8 (B788)', Registration: '',
  })];
  const { rows } = convertFlightdiary(HEAD, body);
  const { comparisons } = await resolveDurations(rows);

  assert.equal(rows[0][8], '14.25');
  assert.equal(rows[0][30], '1'); // arrives the next local day in Delhi
  assert.equal(comparisons[0].diffMinutes, 30); // the India half-hour-zone discrepancy
});

test('resolveDurations: KATL->MDPP 2024-12-21 (Dominican Republic, fixed UTC-4) computes ~3.15h, not Flightdiary\'s naive 4.1h', async () => {
  await migrate();
  await run("INSERT INTO airports (ident, icao, iata, local_code, name, city, country, type, lat, lon) VALUES ('KATL','KATL','ATL','ATL','Hartsfield-Jackson','Atlanta','US','large_airport',33.6367,-84.4281)");
  await run("INSERT INTO airports (ident, icao, iata, local_code, name, city, country, type, lat, lon) VALUES ('MDPP','MDPP','POP',NULL,'Gregorio Luperon Intl','Puerto Plata','DO','large_airport',19.7579,-70.57)");

  const body = [row({
    Date: '2024-12-21', 'Flight number': 'DL1777', From: 'Atlanta / Hartsfield-Jackson (ATL/KATL)', To: 'Puerto Plata / Puerto Plata (POP/MDPP)',
    'Dep time': '11:23:00', 'Arr time': '15:32:00', Duration: '04:06:00', Airline: 'Delta Air Lines (DL/DAL)', Aircraft: 'Boeing 737-800 (B738)', Registration: 'N3767',
  })];
  const { rows } = convertFlightdiary(HEAD, body);
  const { comparisons } = await resolveDurations(rows);

  assert.equal(rows[0][8], '3.15');
  assert.equal(rows[0][30], '0');
  assert.equal(comparisons[0].diffMinutes, 57); // the Dominican-Republic-vs-Haiti-zone discrepancy
});

test('resolveDurations: an airport not in the local table leaves total_time as Flightdiary gave it (manual fallback)', async () => {
  const body = [row({ From: 'Nowhere / Nowhere (ZZZ/ZZZZ)', To: 'Raleigh / Durham (RDU/KRDU)', 'Dep time': '16:25:00', 'Arr time': '19:15:00', Duration: '02:50:00' })];
  const { rows } = convertFlightdiary(HEAD, body);
  await resolveDurations(rows);
  assert.equal(rows[0][8], '2.83'); // unchanged: Flightdiary's own Duration
  assert.equal(rows[0][30], ''); // arr_day_offset stays blank
});

test('applyCorrectionsOverlay: patches the one matching row and reports before/after', () => {
  const body = [row({ Date: '2023-08-16', 'Flight number': 'AA4789', From: 'New York / JFK (JFK/KJFK)', To: 'Raleigh-Durham / Durham (RDU/KRDU)', 'Arr time': '02:17:00' })];
  const { rows } = convertFlightdiary(HEAD, body);
  const report = applyCorrectionsOverlay(rows, [
    { match: { date: '2023-08-16', flight_number: 'AA4789', departure_airport: 'KJFK', arrival_airport: 'KRDU' }, patch: { arr_time: '14:17' } },
  ]);
  assert.equal(rows[0][29], '14:17'); // arr_time column
  assert.deepEqual(report[0].before, { arr_time: '02:17' });
  assert.deepEqual(report[0].after, { arr_time: '14:17' });
});

test('applyCorrectionsOverlay: can patch a field other than a time (e.g. a wrong arrival airport)', () => {
  const body = [row({ Date: '2023-08-18', 'Flight number': 'AA121', From: 'Doha (DOH/OTHH)', To: 'Philadelphia (PHL/KPHL)' })];
  const { rows } = convertFlightdiary(HEAD, body);
  const report = applyCorrectionsOverlay(rows, [
    { match: { date: '2023-08-18', flight_number: 'AA121', departure_airport: 'OTHH', arrival_airport: 'KPHL' }, patch: { arrival_airport: 'KJFK' } },
  ]);
  assert.equal(rows[0][3], 'KJFK'); // arrival_airport column
  assert.deepEqual(report[0].before, { arrival_airport: 'KPHL' });
  assert.deepEqual(report[0].after, { arrival_airport: 'KJFK' });
});

test('applyCorrectionsOverlay: throws rather than silently skip when a match hits zero or several rows', () => {
  const body = [row(), row()];
  const { rows } = convertFlightdiary(HEAD, body);
  assert.throws(() => applyCorrectionsOverlay(rows, [
    { match: { date: '2026-01-15', flight_number: 'WN123', departure_airport: 'KSTL', arrival_airport: 'KORD' }, patch: { arr_time: '12:00' } },
  ]), /matched 2 row\(s\), expected exactly 1/);
  assert.throws(() => applyCorrectionsOverlay(rows, [
    { match: { date: '1999-01-01', flight_number: 'ZZ999', departure_airport: 'ZZZZ', arrival_airport: 'ZZZZ' }, patch: { arr_time: '12:00' } },
  ]), /matched 0 row\(s\), expected exactly 1/);
});
