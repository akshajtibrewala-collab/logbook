import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeHighlights } from './homeHighlights.js';

const flight = (o) => ({ id: 1, date: '2026-01-01', departure_airport: 'KPAO', arrival_airport: 'KSQL', total_time: 1, route: '', airline: null, role: 'pilot', ...o });
const airports = {
  KPAO: { ident: 'KPAO', lat: 37.46, lon: -122.11, country: 'US' },
  KSQL: { ident: 'KSQL', lat: 37.51, lon: -122.25, country: 'US' },
  EGLL: { ident: 'EGLL', lat: 51.47, lon: -0.46, country: 'GB' },
};

test('an empty year returns nothing, even with plenty of prior history', () => {
  const before = [flight({ date: '2025-06-01' })];
  assert.deepEqual(homeHighlights({ flights: before, airports, now: '2026-06-01' }), []);
});

test('with no prior year to compare against, "new" airport/country/airline counts are skipped entirely', () => {
  const flights = [flight({ date: '2026-01-01', departure_airport: 'KPAO', arrival_airport: 'EGLL', airline: 'British Airways' })];
  const items = homeHighlights({ flights, airports, now: '2026-06-01' });
  assert.ok(!items.some((i) => i.id === 'airports'));
  assert.ok(!items.some((i) => i.id === 'countries'));
  assert.ok(!items.some((i) => i.id === 'airlines'));
});

test('flags a genuinely new airport, country and airline this year relative to prior years', () => {
  const before = [flight({ id: 1, date: '2025-01-01', departure_airport: 'KPAO', arrival_airport: 'KPAO' })];
  const thisYear = [flight({ id: 2, date: '2026-02-01', departure_airport: 'KPAO', arrival_airport: 'EGLL', airline: 'British Airways', total_time: 10 })];
  const items = homeHighlights({ flights: [...before, ...thisYear], airports, now: '2026-06-01' });
  assert.ok(items.find((i) => i.id === 'airports')?.text.includes('1 new airport'));
  assert.ok(items.find((i) => i.id === 'countries')?.text.includes('1 new countr'));
  assert.ok(items.find((i) => i.id === 'airlines')?.text.includes('British Airways'));
});

test('a repeat airport/country/airline is never reported as new', () => {
  const before = [flight({ id: 1, date: '2025-01-01', departure_airport: 'KPAO', arrival_airport: 'KSQL' })];
  const thisYear = [flight({ id: 2, date: '2026-01-01', departure_airport: 'KPAO', arrival_airport: 'KSQL' })];
  const items = homeHighlights({ flights: [...before, ...thisYear], airports, now: '2026-06-01' });
  assert.ok(!items.some((i) => i.id === 'airports'));
  assert.ok(!items.some((i) => i.id === 'countries'));
});

test('reports the longest flight this year by total_time', () => {
  const flights = [
    flight({ id: 1, date: '2025-01-01', total_time: 99 }), // last year — never a candidate
    flight({ id: 2, date: '2026-01-01', total_time: 1.5, departure_airport: 'KPAO', arrival_airport: 'KSQL' }),
    flight({ id: 3, date: '2026-02-01', total_time: 3.2, departure_airport: 'KSQL', arrival_airport: 'KPAO' }),
  ];
  const items = homeHighlights({ flights, airports, now: '2026-06-01' });
  const longest = items.find((i) => i.id === 'longest');
  assert.ok(longest.text.includes('3.2h'));
});

test('surfaces the most recently completed milestone this year, using its config label when available', () => {
  const flights = [flight({ date: '2026-01-01' })];
  const config = [{ certificate: 'private', requirement_key: 'solo_xc_150nm', label: 'Solo cross-country' }];
  const completions = [{ certificate: 'private', requirement_key: 'solo_xc_150nm', completed_at: '2026-03-01' }];
  const items = homeHighlights({ flights, airports, completions, config, now: '2026-06-01' });
  assert.ok(items.find((i) => i.id === 'milestone')?.text.includes('Solo cross-country'));
});

test('ignores a milestone completed in a prior year', () => {
  const flights = [flight({ date: '2026-01-01' })];
  const completions = [{ certificate: 'private', requirement_key: 'solo_xc_150nm', completed_at: '2025-03-01' }];
  const items = homeHighlights({ flights, airports, completions, now: '2026-06-01' });
  assert.ok(!items.some((i) => i.id === 'milestone'));
});

test('caps at 4 highlights', () => {
  const before = [flight({ id: 1, date: '2025-01-01', departure_airport: 'KPAO', arrival_airport: 'KPAO' })];
  const thisYear = [flight({ id: 2, date: '2026-01-01', departure_airport: 'KPAO', arrival_airport: 'EGLL', airline: 'British Airways', total_time: 5 })];
  const completions = [{ certificate: 'private', requirement_key: 'solo_xc_150nm', completed_at: '2026-01-02' }];
  const items = homeHighlights({ flights: [...before, ...thisYear], airports, completions, now: '2026-06-01' });
  assert.ok(items.length <= 4);
});
