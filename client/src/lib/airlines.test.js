import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAirline, AIRLINE_NAMES } from './airlines.js';
import { hoursByAirline } from './stats.js';

test('known airlines resolve from name, short name or IATA code', () => {
  for (const input of ['Delta', 'delta air lines', 'DL', ' Delta  Air-Lines ']) {
    const a = resolveAirline(input);
    assert.deepEqual([a.name, a.code, a.known], ['Delta Air Lines', 'DL', true]);
  }
  assert.equal(resolveAirline('united').code, 'UA');
  assert.equal(resolveAirline('Spirit').fg, '#111111'); // dark text on the yellow badge
});

test('unknown airlines keep their name and get initials on a neutral badge', () => {
  const sc = resolveAirline('Sun Country');
  assert.deepEqual([sc.name, sc.code, sc.known], ['Sun Country', 'SC', false]);
  assert.equal(resolveAirline('Breeze').code, 'BRE');
  assert.equal(resolveAirline('Sun Country').color, resolveAirline('Breeze').color);
});

test('blank input has no airline', () => {
  assert.equal(resolveAirline(''), null);
  assert.equal(resolveAirline('   '), null);
  assert.equal(resolveAirline(null), null);
});

test('newly added international airlines resolve by name, code, or alias, with known: true', () => {
  for (const [input, name, code] of [
    ['Air India', 'Air India', 'AI'],
    ['Etihad', 'Etihad Airways', 'EY'],
    ['IndiGo', 'IndiGo', '6E'],
    ['Indigo', 'IndiGo', '6E'],
    ['LOT', 'LOT Polish Airlines', 'LO'],
    ['Swiss International Airlines', 'Swiss International Airlines', 'LX'],
    ['SWISS', 'Swiss International Airlines', 'LX'],
  ]) {
    const a = resolveAirline(input);
    assert.deepEqual([a.name, a.code, a.known], [name, code, true]);
  }
});

test('every listed airline is unique by name and code', () => {
  assert.equal(new Set(AIRLINE_NAMES).size, AIRLINE_NAMES.length);
  const codes = AIRLINE_NAMES.map((n) => resolveAirline(n).code);
  assert.equal(new Set(codes).size, codes.length);
});

test('hours by airline groups spellings, sorts by hours, and buckets missing airlines as Unknown', () => {
  const out = hoursByAirline([
    { airline: 'Delta', total_time: 2.5 },
    { airline: 'DL', total_time: 1 },
    { airline: 'united', total_time: 5 },
    { airline: null, total_time: 9 },
    { airline: '', total_time: 9 },
  ]);
  assert.deepEqual(out.map((a) => [a.name, a.code, a.flights, a.hours]), [
    ['Unknown', '?', 2, 18],
    ['United Airlines', 'UA', 1, 5],
    ['Delta Air Lines', 'DL', 2, 3.5],
  ]);
});
