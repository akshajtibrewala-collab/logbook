import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRegistration, normalizeFlightNumber, buildRequest, pickRegistration, readUnitsHeaders, UNITS_HEADERS, PROVIDER_HOST,
} from './flight-data.js';
import { FIXTURES, RECORDED } from './flight-data.fixtures.js';

test('normalizeRegistration keeps dashes, uppercases, strips spaces, rejects junk', () => {
  assert.equal(normalizeRegistration(' n1test '), 'N1TEST');
  assert.equal(normalizeRegistration('d-test'), 'D-TEST');
  assert.equal(normalizeRegistration('N 1 T'), 'N1T');
  for (const bad of ['', ' ', 'X', 'NOT A REG!!', 'TOOLONGREG1', '--', null, undefined, 42]) assert.equal(normalizeRegistration(bad), null, String(bad));
});

test('normalizeFlightNumber accepts IATA/ICAO shapes with or without a space', () => {
  assert.equal(normalizeFlightNumber('zz 1234'), 'ZZ1234');
  assert.equal(normalizeFlightNumber('9Z123'), '9Z123');
  assert.equal(normalizeFlightNumber('ZZZ12'), 'ZZZ12');
  for (const bad of ['', '1', 'ZZ', 'ZZ-1234', '../x', null, 5]) assert.equal(normalizeFlightNumber(bad), null, String(bad));
});

test('buildRequest puts the key only in a header, never the URL', () => {
  const r = buildRequest('zz 1234', '2026-03-04', 'SECRET-KEY');
  assert.ok(r.url.startsWith(`https://${PROVIDER_HOST}/flights/number/ZZ1234/2026-03-04`));
  assert.ok(r.url.includes('dateLocalRole=Departure'));
  assert.ok(!r.url.includes('SECRET-KEY'));
  assert.equal(r.headers['x-rapidapi-key'], 'SECRET-KEY');
  assert.equal(buildRequest('zz 1234', '03/04/2026', 'k'), null);
  assert.equal(buildRequest('', '2026-03-04', 'k'), null);
});

const pick = (name) => pickRegistration(FIXTURES[name], RECORDED);

test('a normal single leg matches', () => {
  assert.deepEqual(pick('normal'), { kind: 'match', registration: 'N1TEST' });
  assert.deepEqual(pick('dashed'), { kind: 'match', registration: 'D-TEST' });
  assert.deepEqual(pick('lowercaseAndSpaced'), { kind: 'match', registration: 'N1TEST' });
});

test('multi-leg numbers use only the leg that matches both recorded airports', () => {
  assert.deepEqual(pick('multiLeg'), { kind: 'match', registration: 'N1TEST' });
});

test('the same registration listed twice (codeshare row) is not ambiguous', () => {
  assert.deepEqual(pick('codeshareDuplicate'), { kind: 'match', registration: 'N1TEST' });
});

test('every unusable answer is a no-match with a reason, never a guess', () => {
  assert.deepEqual(pick('nullRegistration'), { kind: 'no-match', reason: 'no-registration' });
  assert.deepEqual(pick('missingRegistrationKey'), { kind: 'no-match', reason: 'no-registration' });
  assert.deepEqual(pick('emptyArray'), { kind: 'no-match', reason: 'empty' });
  assert.deepEqual(pick('wrongAirports'), { kind: 'no-match', reason: 'no-airport-match' });
  assert.deepEqual(pick('oneAirportOnly'), { kind: 'no-match', reason: 'no-airport-match' });
  assert.deepEqual(pick('ambiguous'), { kind: 'no-match', reason: 'ambiguous' });
  assert.deepEqual(pick('badFormat'), { kind: 'no-match', reason: 'bad-format' });
  assert.deepEqual(pick('malformedObject'), { kind: 'no-match', reason: 'malformed' });
  assert.deepEqual(pick('malformedLegs'), { kind: 'no-match', reason: 'no-airport-match' });
});

test('blank recorded airports never match a blank provider airport', () => {
  const body = [{ departure: { airport: {} }, arrival: { airport: {} }, aircraft: { reg: 'N1TEST' } }];
  assert.deepEqual(pickRegistration(body, { departure: '', arrival: '' }), { kind: 'no-match', reason: 'no-airport-match' });
});

test('readUnitsHeaders reads only the pinned units headers, whole numbers only', () => {
  const h = new Headers({
    'X-RateLimit-API-Units-Remaining': '94', 'x-ratelimit-api-units-limit': '400', 'x-ratelimit-api-units-reset': '86400',
  });
  assert.deepEqual(readUnitsHeaders(h), { remaining: 94, limit: 400, resetSeconds: 86400 });
  assert.deepEqual(readUnitsHeaders({ 'x-ratelimit-api-units-remaining': 7 }), { remaining: 7, limit: null, resetSeconds: null });
  assert.equal(readUnitsHeaders(new Headers({ 'x-ratelimit-api-units-remaining': 'abc' })).remaining, null);
  assert.equal(readUnitsHeaders(new Headers({ 'x-ratelimit-api-units-remaining': '-3' })).remaining, null);
  assert.equal(readUnitsHeaders(new Headers({ 'x-ratelimit-api-units-remaining': '9.5' })).remaining, null);
  assert.deepEqual(readUnitsHeaders(null), { remaining: null, limit: null, resetSeconds: null });
});

test('request counters are never used as units: only the pinned names count', () => {
  const h = new Headers({
    'x-ratelimit-requests-remaining': '1446', 'x-ratelimit-requests-limit': '1600',
    'x-ratelimit-hard-limit-remaining': '499906', 'x-ratelimit-units-remaining': '55', 'x-ratelimit-remaining': '3',
  });
  assert.deepEqual(readUnitsHeaders(h), { remaining: null, limit: null, resetSeconds: null });
  assert.deepEqual(Object.values(UNITS_HEADERS), ['x-ratelimit-api-units-remaining', 'x-ratelimit-api-units-limit', 'x-ratelimit-api-units-reset']);
});
