import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ledgerModel } from './ledger.js';
import { groupByMonth, pilotTotals, calmRow, countsLine, summarize } from './logbookList.js';
import { totalTimeProgress, logbookProgress } from './logbookProgress.js';
import { formatDate } from './calendar.js';
import { buildShareSummary } from '../../../server/src/lib/share-summary.js';

const f = (id, date, o = {}) => ({ id, date, role: 'pilot', departure_airport: 'KSUS', arrival_airport: 'KSUS', aircraft_type: 'C172S', tail_number: 'N1', total_time: 1.5, pic_time: 1.5, dual_received: 1.5, solo_time: 0, night_time: 0, cross_country_time: 0, day_landings: 3, night_landings: 0, ...o });
const FLIGHTS = [f(1, '2026-07-28', { total_time: 1.1, pic_time: 1.1, dual_received: 1.1, day_landings: 1 }), f(2, '2026-08-03', { total_time: 1.3, pic_time: 0, dual_received: 1.3, night_time: 0.4 }), f(3, '2026-08-11', { solo_time: 1.5, dual_received: 0, cross_country_time: 1.5 }),
  f(4, '2026-09-02', { total_time: 2.6, pic_time: 2.6, dual_received: 2.6 }), f(5, '2026-09-10', { night_landings: 2 })];
const GROUND = [{ id: 1, date: '2026-08-05', hours: 1.8, topics: 'Airspace' }, { id: 2, date: '2026-09-04', hours: 1.2, topics: '' }, { id: 3, date: '2026-07-20', hours: 1, topics: 'Intro' }];
const entries = [...FLIGHTS.map((x) => ({ kind: 'flight', id: x.id, date: x.date, hours: x.total_time, data: x })), ...GROUND.map((g) => ({ kind: 'ground', id: g.id, date: g.date, hours: g.hours, data: g }))]
  .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
const TODAY = '2026-10-05';
const r2 = (n) => Math.round(n * 100) / 100;

test('month and year headers show FLIGHT hours only and the months add up to the pilot total', () => {
  const months = groupByMonth(entries);
  const flightTotal = r2(FLIGHTS.reduce((s, x) => s + x.total_time, 0));
  assert.equal(r2(months.reduce((s, m) => s + m.hours, 0)), flightTotal);
  for (const m of months) {
    const flightsOnly = r2(m.entries.filter((e) => e.kind === 'flight').reduce((s, e) => s + e.hours, 0));
    assert.equal(m.hours, flightsOnly, `${m.label} header must not include ground time`);
  }
  assert.ok(months.some((m) => m.groundHours > 0), 'ground time is tracked apart from flight hours');
});

test('Ledger totals equal the strip totals and the print / share summary totals', () => {
  const ledger = ledgerModel(entries);
  const strip = pilotTotals(FLIGHTS, TODAY);
  const share = buildShareSummary({ flights: FLIGHTS, share: { show_recent_flights: 0 }, settings: null, now: new Date(`${TODAY}T12:00:00Z`) }).totals;
  assert.equal(ledger.totals.total, strip.total);
  assert.equal(ledger.totals.total, share.total);
  assert.equal(ledger.totals.pic, strip.pic);
  assert.equal(ledger.totals.pic, share.pic);
  assert.equal(ledger.totals.dual, strip.dual);
  assert.equal(ledger.totals.dual, share.dual_received);
  assert.equal(ledger.totals.solo, share.solo);
  assert.equal(ledger.totals.night, share.night);
  assert.equal(ledger.totals.xc, share.cross_country);
  assert.equal(ledger.totals.landings, strip.landings);
  assert.equal(ledger.totals.landings, share.landings);
  assert.equal(ledger.totals.flights, share.flights);
});

test('Ledger month subtotals sum to the totals and never include ground sessions', () => {
  const ledger = ledgerModel(entries);
  assert.equal(r2(ledger.months.reduce((s, m) => s + m.subtotal.total, 0)), ledger.totals.total);
  assert.equal(r2(ledger.months.reduce((s, m) => s + m.subtotal.pic, 0)), ledger.totals.pic);
  assert.equal(ledger.months.reduce((s, m) => s + m.subtotal.landings, 0), ledger.totals.landings);
  assert.equal(ledger.groundHours, summarize(entries).groundHours);
  assert.equal(r2(ledger.months.reduce((s, m) => s + m.groundHours, 0)), ledger.groundHours);
  for (const m of ledger.months) assert.equal(m.lines.filter((l) => l.kind === 'flight').length, m.flights);
});

test('counts line says what it counts: flights and hours, then ground sessions and hours', () => {
  assert.equal(countsLine(entries), '5 flights · 8.00 h · 3 ground sessions · 4.00 h');
  assert.match(countsLine(entries, true), /^Matching: /);
});

test('every list row carries its date, and shows at most three pieces: primary, secondary, one value', () => {
  for (const e of entries) {
    const row = calmRow(e, formatDate);
    assert.match(row.secondary, /\d{2}\/\d{2}\/\d{4}/, 'MM/DD/YYYY on every row');
    assert.deepEqual(Object.keys(row).sort(), ['ground', 'hours', 'primary', 'secondary']);
    assert.ok(row.primary);
  }
  assert.equal(calmRow(entries.find((e) => e.kind === 'ground' && e.data.topics === ''), formatDate).primary, 'Ground session');
});

test('Logbook progress comes from the milestone engine and never counts passenger flights', () => {
  const config = [{ certificate: 'private', requirement_key: 'total_time', label: 'Total', min_value: 40, sum_field: 'total_time', flight_filter: null, manual: 0, sort_order: 1 }];
  const withPax = [...FLIGHTS, { ...f(99, '2026-09-20', { total_time: 50, role: 'passenger' }) }];
  const p = logbookProgress({ config, flights: withPax, aircraft: [], completions: [] });
  assert.equal(p.current, r2(FLIGHTS.reduce((s, x) => s + x.total_time, 0)));
  assert.equal(p.remaining, r2(40 - p.current));
  assert.equal(p.met, false);
  assert.equal(totalTimeProgress([], 'private'), null);
});

test('Logbook progress names the certificate in proper case and counts requirements met', () => {
  const config = [
    { certificate: 'private', requirement_key: 'total_time', label: 'Total', min_value: 40, sum_field: 'total_time', flight_filter: null, manual: 0, sort_order: 1 },
    { certificate: 'private', requirement_key: 'solo', label: 'Solo', min_value: 10, sum_field: 'solo', flight_filter: null, manual: 0, sort_order: 2 },
  ];
  const p = logbookProgress({ config, flights: FLIGHTS, aircraft: [], completions: [] });
  assert.equal(p.label, 'Private Pilot');
  assert.equal(p.requirementsTotal, 2);
  assert.ok(p.requirementsMet >= 0 && p.requirementsMet <= 2);
  assert.equal(p.min, 40);
});
