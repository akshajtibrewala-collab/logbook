import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesQuery, groupByMonth, summarize, limitGroups, groupByYear, headerParts, countsLine, rowLabels, dateBlock, activeChips, clearChip, pilotTotals, monthLabel, minimalRow, initialSurname, calmRowModel, monthLineName, monthIsOpen, calmGreeting, fleetChips, recentFleet, showsFullDate, usualInstructor, instructorCounts, matchesInstructor, SOLO_FILTER, travelRowModel, defaultOpenYears } from './logbookList.js';

const flight = (o) => ({ kind: 'flight', id: o.id ?? 1, date: o.date, hours: o.total_time, data: { departure_airport: 'KSUS', arrival_airport: 'KCPS', ...o } });
const ground = (o) => ({ kind: 'ground', id: o.id ?? 1, date: o.date, hours: o.hours, data: o });

test('search covers route, via stops, tail, aircraft type, airport, remarks and instructor', () => {
  const e = flight({ date: '2026-09-28', total_time: 1.8, route: 'KALN', aircraft_type: 'C172S', tail_number: 'N123AB', remarks: 'Crosswind at the lake', instructor: 'J. Rivera', arrival_airport: 'KJEF' });
  for (const q of ['ksus', 'kjef', 'kaln', 'n123ab', 'c172', 'crosswind', 'rivera', 'KSUS c172s']) assert.ok(matchesQuery(e, q), q);
  assert.equal(matchesQuery(e, 'pa28'), false);
  assert.equal(matchesQuery(e, 'ksus pa28'), false, 'every word must match');
  assert.ok(matchesQuery(e, ''), 'an empty query matches everything');
});

test('search covers a ground session by instructor, topics and notes, and never matches an airport', () => {
  const g = ground({ date: '2026-10-01', hours: 1.1, instructor: 'M. Chen', topics: 'Instrument theory', notes: 'holds' });
  assert.ok(matchesQuery(g, 'chen')); assert.ok(matchesQuery(g, 'theory')); assert.ok(matchesQuery(g, 'ground'));
  assert.equal(matchesQuery(g, 'ksus'), false);
});

test('groupByMonth keeps the order; month hours are FLIGHT hours only and ground time is counted separately', () => {
  const rows = [flight({ id: 3, date: '2026-10-03', total_time: 1.4 }), ground({ id: 1, date: '2026-10-01', hours: 1.1 }), flight({ id: 2, date: '2026-09-28', total_time: 1.8 }), flight({ id: 1, date: '2026-09-21', total_time: 0.9 })];
  const g = groupByMonth(rows);
  assert.deepEqual(g.map((x) => [x.label, x.hours, x.flights, x.groundHours, x.grounds]), [['October 2026', 1.4, 1, 1.1, 1], ['September 2026', 2.7, 2, 0, 0]]);
  assert.equal(monthLabel('2026-01'), 'January 2026');
  assert.deepEqual(groupByMonth([]), []);
});

test('invariant: the month flight hours add up to the pilot total, and no month exceeds it (ground hours never leak in)', () => {
  const flights = Array.from({ length: 23 }, (_, i) => flight({ id: i, date: `2026-${String((i % 6) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`, total_time: round(0.1 * (i % 9 + 1)) }));
  const grounds = Array.from({ length: 9 }, (_, i) => ground({ id: i, date: `2026-${String((i % 6) + 1).padStart(2, '0')}-15`, hours: 1.3 }));
  const rows = [...flights, ...grounds].sort((a, b) => b.date.localeCompare(a.date));
  const total = pilotTotals(flights.map((e) => e.data), '2026-12-31').total;
  const months = groupByMonth(rows);
  assert.ok(Math.abs(months.reduce((s, g) => s + g.hours, 0) - total) < 0.011, 'sum of month flight hours equals the pilot total');
  for (const g of months) assert.ok(g.hours <= total + 1e-9, 'no month exceeds the total');
  assert.ok(Math.abs(months.reduce((s, g) => s + g.groundHours, 0) - 9 * 1.3) < 0.011, 'ground hours are kept apart');
  assert.equal(months.reduce((s, g) => s + g.flights, 0), 23);
});
function round(n) { return Math.round(n * 100) / 100; }

test('the counts line names what it counts, with flight and ground parts kept apart', () => {
  const rows = [flight({ id: 1, date: '2026-09-28', total_time: 1.8 }), flight({ id: 2, date: '2026-09-21', total_time: 0.9 }), ground({ id: 1, date: '2026-09-20', hours: 1.5 })];
  assert.deepEqual(summarize(rows), { flights: 2, grounds: 1, flightHours: 2.7, groundHours: 1.5 });
  assert.equal(countsLine(rows), '2 flights · 2.70 h · 1 ground session · 1.50 h');
  assert.equal(countsLine(rows.slice(0, 1), true), 'Matching: 1 flight · 1.80 h');
  const h = headerParts(groupByMonth(rows)[0]);
  assert.deepEqual([h.flight, h.flights, h.ground], ['2.70 h', '2 flights', '1.50 h ground · 1 session']);
});

test('same-airport flights are labelled "Local · KSUS" with aircraft, tail and instructor as the details', () => {
  const l = rowLabels(flight({ date: '2026-09-21', total_time: 0.9, arrival_airport: 'ksus', aircraft_type: 'PA28', tail_number: 'N456CD', instructor: 'J. Rivera' }));
  assert.equal(l.title, 'Local · KSUS'); assert.equal(l.local, true); assert.equal(l.details, 'PA28 · N456CD · with J. Rivera');
  assert.equal(l.via, '');
});

test('a cross-country shows the route and any via stops; a flight with no stops has no via', () => {
  const x = rowLabels(flight({ date: '2026-09-28', total_time: 1.8, arrival_airport: 'KALN', route: 'KCPS' }));
  assert.equal(x.title, 'KSUS → KALN'); assert.equal(x.via, 'KCPS'); assert.equal(x.local, false);
  assert.equal(rowLabels(flight({ date: '2026-09-28', total_time: 1 })).via, '');
});

test('a ground session row', () => {
  assert.deepEqual(rowLabels(ground({ date: '2026-10-01', hours: 1.1, instructor: 'M. Chen', topics: 'Instrument theory' })), { title: 'Ground session', local: false, via: '', details: 'Instrument theory · M. Chen' });
});

test('the date block is string based (no time-zone shift)', () => {
  assert.deepEqual(dateBlock('2026-09-28'), { day: '28', mon: 'SEP' });
  assert.deepEqual(dateBlock('2026-01-01'), { day: '01', mon: 'JAN' });
});

test('active filters become removable chips, and clearing one resets only that filter', () => {
  const filters = { from: '2026-01-01', to: '', type: 'C172S', category: 'night_time', kind: 'flight' };
  const chips = activeChips(filters, 'crosswind', { night_time: 'Night' });
  assert.deepEqual(chips.map((c) => c.key), ['q', 'kind', 'range', 'type', 'category']);
  assert.equal(chips.find((c) => c.key === 'category').label, 'Night');
  const r = clearChip('type', filters, 'crosswind');
  assert.equal(r.filters.type, ''); assert.equal(r.filters.category, 'night_time'); assert.equal(r.query, 'crosswind');
  assert.equal(clearChip('q', filters, 'crosswind').query, '');
  assert.deepEqual(clearChip('range', filters, '').filters.from, '');
  assert.deepEqual(activeChips({ from: '', to: '', type: '', category: '', kind: 'all' }, ''), []);
});

test('pilotTotals: pilot-only flight time, trailing 12 months, PIC and landings, ignoring future-dated rows', () => {
  const rows = [
    { date: '2026-10-03', total_time: 1.4, pic_time: 0, day_landings: 2, night_landings: 0 },
    { date: '2025-12-01', total_time: 2, pic_time: 2, day_landings: 1, night_landings: 1 },
    { date: '2024-01-01', total_time: 3, pic_time: 3, day_landings: 3, night_landings: 0 },
    { date: '2027-01-01', total_time: 9, pic_time: 9, day_landings: 9, night_landings: 0 },
  ];
  assert.deepEqual(pilotTotals(rows, '2026-10-04'), { total: 6.4, last12: 3.4, pic: 5, dual: 0, landings: 7 });
});

test('invariant: Travel year headers (passenger only) add up to the Travel total, and none exceeds it', () => {
  const pax = Array.from({ length: 31 }, (_, i) => ({ id: i, date: `${2019 + (i % 7)}-0${(i % 9) + 1}-1${i % 9}`, total_time: round(1.1 + (i % 5) * 0.7), role: 'passenger' }));
  const total = round(pax.reduce((s, f) => s + f.total_time, 0));
  const years = groupByYear(pax);
  assert.ok(Math.abs(years.reduce((s, y) => s + y.hours, 0) - total) < 0.011);
  for (const y of years) assert.ok(y.hours <= total);
  assert.equal(years.reduce((s, y) => s + y.flights, 0), 31);
  assert.deepEqual(years.map((y) => y.year), [...years.map((y) => y.year)].sort().reverse());
});

test('paging never changes a month header: a month cut by "Show more" still shows all of its flight hours', () => {
  const rows = [flight({ id: 4, date: '2026-09-02', total_time: 1.5 }), flight({ id: 3, date: '2026-08-28', total_time: 1.2 }), ground({ id: 1, date: '2026-08-20', hours: 2 }), flight({ id: 2, date: '2026-08-10', total_time: 1.3 })];
  const groups = groupByMonth(rows);
  const first = limitGroups(groups, 2);
  assert.deepEqual(first.map((x) => [x.label, x.hours, x.entries.length]), [['September 2026', 1.5, 1], ['August 2026', 2.5, 1]]);
  assert.equal(limitGroups(groups, 1).length, 1);
  assert.equal(limitGroups(groups, 99).reduce((s, x) => s + x.entries.length, 0), 4);
});

const mdy = (iso) => { const [y, m, d] = iso.split('-'); return `${m}/${d}/${y}`; };

test('a minimal row is at most six words; the tail sits beside the instructor and the full date is the accessible name', () => {
  const e = flight({ id: 4, date: '2026-09-10', total_time: 1.7, arrival_airport: 'KSUS', tail_number: 'N456CD', instructor: 'Pat Rivera' });
  const r = minimalRow(e, mdy);
  assert.equal(r.primary, 'KSUS'); assert.equal(r.local, true); assert.equal(r.secondary, 'N456CD · P. Rivera'); assert.equal(r.day, '10'); assert.equal(r.date, '09/10/2026');
  assert.ok(r.label.startsWith('09/10/2026, local KSUS, N456CD, instructor Pat Rivera, 1.70 hours'));
  const words = (x) => x.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  assert.ok(words(r.primary) + words(r.secondary) + 1 <= 6, 'primary + secondary + hours (the date block is not charged)');
  const cross = minimalRow(flight({ date: '2026-09-11', total_time: 2.1, arrival_airport: 'KCPS', tail_number: 'N1' }), mdy);
  assert.equal(cross.primary, 'KSUS → KCPS'); assert.equal(cross.secondary, 'N1');
});

test('a ground row says Ground, carries the instructor, and its label names the date and topics', () => {
  const r = minimalRow(ground({ id: 2, date: '2026-08-14', hours: 1.2, instructor: 'Pat Rivera', topics: 'Weight and balance' }), mdy);
  assert.deepEqual([r.primary, r.secondary, r.ground, r.hours], ['Ground', 'P. Rivera', true, 1.2]);
  assert.equal(r.label, '08/14/2026, ground session, Weight and balance, instructor Pat Rivera, 1.20 hours');
});

test('fleet chips list each tail once with its flight hours, skipping blank tails', () => {
  const fl = [{ tail_number: 'N2', total_time: 1.1 }, { tail_number: 'N1', total_time: 2 }, { tail_number: 'N2', total_time: 0.4 }, { tail_number: '', total_time: 9 }];
  assert.deepEqual(fleetChips(fl).map(({ tail, hours, flights }) => ({ tail, hours, flights })), [{ tail: 'N1', hours: 2, flights: 1 }, { tail: 'N2', hours: 1.5, flights: 2 }]);
});

test('the tail filter has a chip and clears; full dates show for any search, filter or non-date sort', () => {
  const f = { from: '', to: '', type: '', category: '', kind: 'all', tail: 'N1' };
  assert.deepEqual(activeChips(f, '').map((c) => c.key), ['tail']);
  assert.equal(clearChip('tail', f, '').filters.tail, '');
  assert.equal(showsFullDate('', { ...f, tail: '' }, 'newest'), false);
  assert.ok(showsFullDate('', f, 'newest')); assert.ok(showsFullDate('ksus', { ...f, tail: '' }, 'newest')); assert.ok(showsFullDate('', { ...f, tail: '' }, 'longest'));
});

test('only the most recently flown aircraft show as chips, plus the one being filtered on', () => {
  const fl = [['N1', '2026-01-01'], ['N2', '2026-03-01'], ['N3', '2026-02-01'], ['N4', '2026-04-01'], ['N5', '2025-12-01']].map(([tail_number, date]) => ({ tail_number, date, total_time: 1 }));
  const fleet = fleetChips(fl);
  assert.deepEqual(recentFleet(fleet, 3).map((c) => c.tail), ['N2', 'N3', 'N4']);
  assert.deepEqual(recentFleet(fleet, 3, 'N5').map((c) => c.tail), ['N2', 'N3', 'N4', 'N5']);
  assert.deepEqual(recentFleet(fleet.slice(0, 2), 3).map((c) => c.tail), ['N1', 'N2']);
});

test('instructors read as first initial and surname; a row that cannot fit the initial falls back to the surname', () => {
  assert.equal(initialSurname('Pat Rivera'), 'P. Rivera'); assert.equal(initialSurname('Lee Novak'), 'L. Novak'); assert.equal(initialSurname('Madonna'), 'Madonna'); assert.equal(initialSurname(''), '');
  const e = flight({ date: '2026-09-10', total_time: 1, tail_number: 'N1 N2', instructor: 'Pat Rivera', departure_airport: 'KSUS', arrival_airport: 'KCPS' });
  assert.equal(minimalRow(e, mdy).secondary, 'N1 N2 · Rivera', 'two words of tail leave no room for the initial');
});

test('a calm row: day, tail, P. Rivera, hours; the route only when the airports differ; local is the default with no marker', () => {
  const local = calmRowModel(flight({ id: 4, date: '2026-09-10', total_time: 1.7, arrival_airport: 'KSUS', tail_number: 'N222BB', instructor: 'Pat Rivera' }), mdy);
  assert.deepEqual([local.day, local.tail, local.who, local.route, local.local, local.hours], ['10', 'N222BB', 'P. Rivera', '', true, 1.7]);
  assert.equal(local.label, '09/10/2026, Local flight at KSUS, N222BB, instructor Pat Rivera, 1.70 hours');
  const xc = calmRowModel(flight({ date: '2026-09-11', total_time: 2.1, arrival_airport: 'KCPS', tail_number: 'N1' }), mdy);
  assert.equal(xc.route, 'KSUS → KCPS'); assert.equal(xc.local, false); assert.ok(xc.label.startsWith('09/11/2026, KSUS to KCPS, N1'));
  const g = calmRowModel(ground({ id: 2, date: '2026-08-14', hours: 1, instructor: 'Pat Rivera', topics: 'Weight and balance' }), mdy);
  assert.equal(g.ground, true); assert.equal(g.label, '08/14/2026, ground session, Weight and balance, instructor Pat Rivera, 1.00 hours');
});

test('month names, open state and the greeting', () => {
  assert.equal(monthLineName({ label: 'August 2026' }, false), 'August'); assert.equal(monthLineName({ label: 'August 2026' }, true), 'August 2026');
  const open = new Set(['2026-09']);
  assert.equal(monthIsOpen({ key: '2026-09', filterActive: false, openKeys: open, closedUnderFilter: new Set() }), true);
  assert.equal(monthIsOpen({ key: '2026-08', filterActive: false, openKeys: open, closedUnderFilter: new Set() }), false);
  assert.equal(monthIsOpen({ key: '2026-08', filterActive: true, openKeys: open, closedUnderFilter: new Set() }), true, 'a search opens matching months');
  assert.equal(monthIsOpen({ key: '2026-08', filterActive: true, openKeys: open, closedUnderFilter: new Set(['2026-08']) }), false);
  assert.equal(calmGreeting(new Date(2026, 9, 6, 20), 'Akshaj'), 'Good evening, Akshaj'); assert.equal(calmGreeting(new Date(2026, 9, 6, 8), 'Akshaj'), 'Good morning, Akshaj');
  assert.equal(calmGreeting(new Date(2026, 9, 6, 14), ''), 'Good afternoon'); assert.equal(calmGreeting(new Date(2026, 9, 6, 2), 'A'), 'Good evening, A');
});

test('the usual instructor is the most frequent one; a row shows another instructor, "Solo", or nothing', () => {
  const mdy = (iso) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
  const rows = [
    flight({ id: 1, date: '2026-09-01', total_time: 1, instructor: 'Pat Rivera' }), flight({ id: 2, date: '2026-09-02', total_time: 1, instructor: ' pat  rivera ' }),
    flight({ id: 3, date: '2026-09-03', total_time: 1, instructor: 'Sam Ortiz' }), flight({ id: 4, date: '2026-09-04', total_time: 1, solo_time: 1 }),
    ground({ id: 5, date: '2026-09-05', hours: 1, instructor: 'Pat Rivera' }),
  ];
  assert.equal(usualInstructor(rows), 'Pat Rivera'); assert.equal(usualInstructor([flight({ id: 9, date: '2026-09-01', total_time: 1 })]), '');
  assert.deepEqual(instructorCounts(rows).map((i) => [i.name, i.count]), [['Pat Rivera', 3], ['Sam Ortiz', 1]]);
  const who = (i) => calmRowModel(rows[i], mdy, 'Pat Rivera').who;
  assert.deepEqual([who(0), who(1), who(2), who(3), calmRowModel(rows[4], mdy, 'Pat Rivera').who], ['', '', 'S. Ortiz', 'Solo', '']);
  assert.ok(calmRowModel(rows[0], mdy, 'Pat Rivera').label.includes('instructor Pat Rivera'), 'the full name stays in the accessible name');
  assert.ok(calmRowModel(rows[3], mdy, 'Pat Rivera').label.indexOf('instructor') === -1);
  assert.deepEqual(rows.filter((e) => matchesInstructor(e, 'pat rivera')).map((e) => e.id), [1, 2, 5]);
  assert.deepEqual(rows.filter((e) => matchesInstructor(e, SOLO_FILTER)).map((e) => e.id), [4]);
  assert.equal(rows.filter((e) => matchesInstructor(e, '')).length, 5);
  assert.deepEqual(activeChips({ from: '', to: '', type: '', category: '', kind: 'all', instructor: 'Sam Ortiz' }, '').map((c) => c.label), ['S. Ortiz']);
  assert.equal(clearChip('instructor', { instructor: 'x' }, '').filters.instructor, '');
  assert.ok(showsFullDate('', { instructor: 'x' }, 'newest'));
});

test('a calm Travel row has three items; the airline stays in the accessible name; years open by default only for the current year', () => {
  const mdy = (iso) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
  const r = travelRowModel({ date: '2026-03-14', departure_airport: 'ksfo', arrival_airport: 'KJFK', total_time: 5.4, airline: 'United Airlines', flight_number: 'UA 12' }, mdy);
  assert.deepEqual([r.day, r.date, r.tail, r.hours, r.who, r.route], ['03/14', '03/14/2026', 'KSFO → KJFK', 5.4, '', '']);
  assert.equal(r.label, '03/14/2026, KSFO to KJFK, United Airlines UA 12, 5.40 hours as passenger');
  assert.equal(travelRowModel({ date: '2026-03-14', total_time: 1 }, mdy).tail, '— → —');
  assert.deepEqual([...defaultOpenYears(['2026', '2025'], '2026')], ['2026']);
  assert.deepEqual([...defaultOpenYears(['2025', '2024'], '2026')], ['2025'], 'no flights this year: the newest year opens');
  assert.equal(defaultOpenYears([], '2026').size, 0);
  const yrs = groupByYear([{ id: 1, date: '2026-01-02', total_time: 1.25 }, { id: 2, date: '2026-02-02', total_time: 2.5 }, { id: 3, date: '2025-02-02', total_time: 0.1 }]);
  assert.equal(Math.round(yrs.reduce((s, g) => s + g.hours, 0) * 100) / 100, 3.85, 'year headers sum to the total');
});

test('"Solo" shows only for flights with solo time, never because the instructor is blank (the production shapes)', () => {
  const mdy = (iso) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
  const who = (o) => calmRowModel(flight({ id: 1, ...o }), mdy, 'Pat Rivera').who;
  assert.equal(who({ date: '2026-09-23', tail_number: 'N444DD', total_time: 1.7, dual_received: 1.7, instructor: '' }), '', 'dual with no instructor recorded');
  assert.equal(who({ date: '2026-09-26', tail_number: 'N333CC', total_time: 1.0, instructor: null }), '', 'neither dual nor solo');
  assert.equal(who({ date: '2026-09-26', tail_number: 'N333CC', total_time: 0.6, solo_time: 0.6, instructor: '' }), 'Solo', 'solo time');
  assert.equal(who({ date: '2026-09-26', total_time: 0.6, solo_time: 0.6, instructor: 'Pat Rivera' }), '', 'the usual instructor shows nothing');
  assert.equal(who({ date: '2026-09-26', total_time: 1, instructor: 'Sam Ortiz' }), 'S. Ortiz', 'a different instructor shows initial and surname');
  const rows = [flight({ id: 1, date: '2026-09-23', total_time: 1.7, dual_received: 1.7 }), flight({ id: 2, date: '2026-09-26', total_time: 0.6, solo_time: 0.6 })];
  assert.deepEqual(rows.filter((e) => matchesInstructor(e, SOLO_FILTER)).map((e) => e.id), [2], 'the Solo filter follows the same meaning');
});
