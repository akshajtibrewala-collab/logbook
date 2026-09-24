import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDelimited, flightsToCsv, parseImport, normalizeDate, TEMPLATE_CSV, formatApproachTypes, parseApproachTypesCell } from './csv.js';

test('parses quoted fields, escaped quotes, embedded newlines, BOM and CRLF', () => {
  const rows = parseDelimited('﻿a,b\r\n"x, y","say ""hi"""\r\n"line1\nline2",z\r\n');
  assert.deepEqual(rows, [['a', 'b'], ['x, y', 'say "hi"'], ['line1\nline2', 'z']]);
});

test('normalizes dates', () => {
  assert.equal(normalizeDate('2026-3-4'), '2026-03-04');
  assert.equal(normalizeDate('3/14/2026'), '2026-03-14');
  assert.equal(normalizeDate('14/3/2026'), '2026-03-14');
  assert.equal(normalizeDate('2026-03-14 10:00'), '2026-03-14');
  assert.equal(normalizeDate('2026-02-30'), null);
  assert.equal(normalizeDate('soon'), null);
});

test('export then import round-trips every field, including tricky text', () => {
  const flight = {
    date: '2026-03-14', departure_airport: 'KPAO', arrival_airport: 'KSQL', route: 'KCOU KJEF',
    stops: [{ airport_code: 'KCOU', stop_type: 'full_stop' }, { airport_code: 'KJEF', stop_type: 'full_stop' }],
    tail_number: 'N123AB', aircraft_type: 'C172', airline: 'Delta', flight_number: 'DL123', instructor: 'Jane Smith',
    remarks: '=cmd|"x", with comma\nand newline', debrief_went_well: 'Smooth, stable approach', debrief_work_on: 'Crosswind landings',
    total_time: 1.5, pic_time: 1.5, sic_time: 0, dual_received: 0, dual_given: 0.5, solo_time: 0, simulator_time: 0.2,
    ground_time: 0.5, night_time: 0.25, instrument_actual: 0, instrument_simulated: 0.3, cross_country_time: 0,
    day_landings: 3, night_landings: 1, day_landings_full_stop: 2, night_landings_full_stop: 1,
    approaches: 3, holds: 1, approach_types: [{ approach_type: 'ILS', count: 2 }, { approach_type: 'RNAV (GPS)', count: 1 }],
  };
  const csv = flightsToCsv([flight]);
  assert.match(csv, /"'=cmd/); // formula guard on export
  assert.match(csv, /,KCOU KJEF,/); // stops readable as plain codes
  assert.match(csv, /ILS:2; RNAV \(GPS\):1/); // approaches readable in a spreadsheet
  const { rows, error } = parseImport(csv);
  assert.equal(error, undefined);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'ready');
  assert.deepEqual(rows[0].flight, flight);
});

test('approach type cells parse leniently: missing counts default to 1, junk parts are dropped', () => {
  assert.deepEqual(parseApproachTypesCell('ILS:2; VOR'), [{ approach_type: 'ILS', count: 2 }, { approach_type: 'VOR', count: 1 }]);
  assert.deepEqual(parseApproachTypesCell(' ; ;'), []);
  assert.equal(formatApproachTypes([]), '');
});

test('an older CSV without any of the new columns still imports, with the new fields defaulted', () => {
  const csv = 'date,total_time,day_landings\n2026-01-01,1.0,2\n';
  const { rows } = parseImport(csv);
  assert.equal(rows[0].status, 'ready');
  assert.equal(rows[0].flight.day_landings_full_stop, 0);
  assert.equal(rows[0].flight.dual_given, 0);
  assert.deepEqual(rows[0].flight.approach_types, []);
  assert.deepEqual(rows[0].flight.stops, []);
});

test('full-stop landings above the total are flagged before import', () => {
  const csv = 'date,total_time,day_landings,full_stop_day_landings\n2026-01-01,1.0,1,3\n';
  assert.equal(parseImport(csv).rows[0].status, 'error');
});

test('the documented template imports cleanly', () => {
  const { rows } = parseImport(TEMPLATE_CSV);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'ready');
});

test('accepts h:mm times, US dates and alternate headers', () => {
  const csv = 'Date,Aircraft ID,From,To,Total Time,PIC,Night,Day Landings,Night Landings\n3/14/2026,n123ab,kpao,ksql,1:30,1:30,0:15,2,1\n';
  const { rows } = parseImport(csv);
  assert.equal(rows[0].status, 'ready');
  assert.deepEqual(
    [rows[0].flight.date, rows[0].flight.tail_number, rows[0].flight.departure_airport, rows[0].flight.total_time, rows[0].flight.night_time],
    ['2026-03-14', 'N123AB', 'KPAO', 1.5, 0.25],
  );
});

test('flags bad rows with reasons and keeps going', () => {
  const csv = 'date,total_time,pic_time,day_landings,departure_airport\n'
    + 'nope,1,1,1,KPAO\n'
    + '2026-01-01,1,2,1,KPAO\n'
    + '2026-01-02,abc,0,0,KPAO\n'
    + '2026-01-03,1,1,1.5,KPAO\n'
    + '2026-01-04,1,1,1,TOOLONG\n'
    + '2026-01-05,1,1,1,KPAO\n';
  const { rows } = parseImport(csv);
  assert.deepEqual(rows.map((r) => r.status), ['error', 'error', 'error', 'error', 'error', 'ready']);
  assert.match(rows[0].errors[0], /Invalid date/);
  assert.match(rows[1].errors[0], /pic time exceeds total time/);
  assert.equal(rows[0].row, 2);
});

test('detects duplicates against the logbook and within the file', () => {
  const existing = [{ date: '2026-01-01', departure_airport: 'KPAO', arrival_airport: 'KSQL', tail_number: 'N1', total_time: 1 }];
  const csv = 'date,departure_airport,arrival_airport,tail_number,total_time\n'
    + '2026-01-01,KPAO,KSQL,N1,1.0\n'
    + '2026-01-02,KPAO,KSQL,N1,1.0\n'
    + '2026-01-02,KPAO,KSQL,N1,1.00\n';
  const { rows } = parseImport(csv, existing);
  assert.deepEqual(rows.map((r) => [r.status, r.duplicateOf]), [['duplicate', 'logbook'], ['ready', undefined], ['duplicate', 'file']]);
});

test('errors when there is no date column', () => {
  assert.match(parseImport('foo,bar\n1,2\n').error, /Date/);
  assert.match(parseImport('').error, /No data/);
});

const FOREFLIGHT = [
  'ForeFlight Logbook Import,This row is required for importing into ForeFlight. Do not delete or modify.',
  '',
  'Aircraft Table',
  'Text,Text,Text,Number',
  'AircraftID,TypeCode,Make,Year',
  'N123AB,C172,Cessna,1978',
  '',
  'Flights Table',
  'Date,Text,Text',
  'Date,AircraftID,From,To,TotalTime,PIC,Night,ActualInstrument,Holds,Approach1,Approach2,Approach3,DayLandingsFullStop,NightLandingsFullStop,PilotComments,FlightReview',
  '2026-02-01,N123AB,KPAO,KSQL,1.5,1.5,0.3,0.2,1,ILS,RNAV,,2,1,"Nice flight, smooth",1',
  '2026-02-08,N123AB,KSQL,KPAO,0.8,0.8,0,0,0,,,,1,0,,',
].join('\n');

test('reads ForeFlight exports: sections, aircraft type lookup, approach columns, review flag', () => {
  const { format, rows, reviews } = parseImport(FOREFLIGHT);
  assert.equal(format, 'foreflight');
  assert.equal(rows.length, 2); // the "Date,Text,Text" type row above the header is skipped
  const [first, second] = rows;
  assert.equal(first.status, 'ready');
  assert.equal(first.flight.aircraft_type, 'C172');
  assert.equal(first.flight.approaches, 2);
  assert.equal(first.flight.holds, 1);
  assert.equal(first.flight.instrument_actual, 0.2);
  assert.equal(first.flight.day_landings, 2);
  assert.equal(first.flight.night_landings, 1);
  assert.equal(first.flight.remarks, 'Nice flight, smooth');
  assert.equal(second.flight.approaches, 0);
  assert.deepEqual(reviews, ['2026-02-01']);
});

test('ForeFlight landings: AllLandings (incl. touch-and-gos) wins over full-stop-only columns', () => {
  const csv = [
    'Date,AircraftID,From,To,TotalTime,Landing Full-Stop Day,Landing Touch-and-Go Day Towered,DayLandingsFullStop,NightLandingsFullStop,AllLandings,Flight Review (FAA)',
    '2026-09-10,N370SP,KSUS,KSUS,1.7,1,13,1,0,14,',
    '2026-09-11,N370SP,KSUS,KSUS,1.0,2,,2,1,3,x',
    '2026-09-12,N370SP,KSUS,KSUS,1.0,4,,4,0,,',
  ].join('\n');
  const { rows, reviews } = parseImport(csv);
  assert.deepEqual(rows.map((r) => [r.flight.day_landings, r.flight.night_landings]), [[14, 0], [2, 1], [4, 0]]);
  assert.deepEqual(reviews, ['2026-09-11']); // "Flight Review (FAA)" header is recognised
});

test('ground-only sessions export as entry_type "ground" rows and import back (round trip), dates stay YYYY-MM-DD', () => {
  const flight = { date: '2026-09-12', departure_airport: 'KSUS', arrival_airport: 'KSUS', total_time: 1.1, dual_received: 1.1, ground_time: 0.3 };
  const sessions = [
    { date: '2026-08-06', hours: 1.5, instructor: 'John Tapia', topics: 'Weather, airspace', notes: 'Went well, "quoted"' },
    { date: '2026-08-10', hours: 2, instructor: null, topics: null, notes: null },
  ];
  const csv = flightsToCsv([flight], sessions);
  assert.match(csv, /2026-08-06/); // ISO in the file, never MM/DD/YYYY
  assert.equal(csv.split(/\r?\n/).filter((l) => l.startsWith('ground,')).length, 2);
  const { rows, ground, error } = parseImport(csv);
  assert.equal(error, undefined);
  assert.equal(rows.length, 1);
  assert.equal(ground.length, 2);
  assert.deepEqual(ground[0].session, { date: '2026-08-06', hours: 1.5, instructor: 'John Tapia', topics: 'Weather, airspace', notes: 'Went well, "quoted"' });
  assert.deepEqual(ground[1].session, { date: '2026-08-10', hours: 2, instructor: null, topics: null, notes: null });
  assert.ok(ground.every((g) => g.status === 'ready'));
});

test('ground import flags duplicates of existing sessions and rejects bad rows', () => {
  const csv = flightsToCsv([], [{ date: '2026-08-06', hours: 1.5, instructor: 'John Tapia' }, { date: '2026-08-07', hours: 1 }]);
  const { ground } = parseImport(csv, [], [{ date: '2026-08-06', hours: 1.5, instructor: 'John Tapia' }]);
  assert.deepEqual(ground.map((g) => g.status), ['duplicate', 'ready']);
  const bad = parseImport(['entry_type,date,ground_time', 'ground,not-a-date,0'].join('\n'));
  assert.equal(bad.ground[0].status, 'error');
  assert.equal(bad.ground[0].errors.length, 2);
});
