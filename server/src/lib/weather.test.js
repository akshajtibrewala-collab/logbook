import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeWind, decodeVisibility, decodeCeiling, decodeMetar, decodeTaf, conditionsAt,
  crosswindComponent, resolveRunwayEnds, bestRunway, compareToMinimums, overallStatus,
} from './weather.js';

// ---- real sample data, fetched live from aviationweather.gov/api/data while building this ----

const KDEN_METAR = {
  icaoId: 'KDEN', obsTime: 1790131980, temp: 15.6, dewp: 10.6, wdir: 160, wspd: 25, wgst: 34, visib: 7,
  altim: 1021.1, wxString: '-RA', metarType: 'METAR',
  rawOb: 'METAR KDEN 230253Z 16025G34KT 7SM -RA BKN060 BKN075 OVC100 16/11 A3015 RMK AO2 PK WND 17056/0223 RAB23 SLP156 P0003 60003 T01560106 53029',
  lat: 39.8466, lon: -104.6562, elev: 1656, name: 'Denver Intl, CO, US',
  clouds: [{ cover: 'BKN', base: 6000 }, { cover: 'BKN', base: 7500 }, { cover: 'OVC', base: 10000 }],
};

const KJFK_METAR = {
  icaoId: 'KJFK', obsTime: 1790131860, temp: 16.1, dewp: 8.9, wdir: 50, wspd: 14, wgst: 24, visib: '10+',
  altim: 1028.5, metarType: 'METAR',
  rawOb: 'METAR KJFK 230251Z 05014G24KT 10SM SCT048 BKN250 16/09 A3037 RMK AO2 SLP284 T01610089 51012',
  lat: 40.6392, lon: -73.7639, elev: 3, name: 'New York/JF Kennedy Intl, NY, US',
  clouds: [{ cover: 'SCT', base: 4800 }, { cover: 'BKN', base: 25000 }],
};

const KDEN_TAF = {
  icaoId: 'KDEN', issueTime: '2026-09-23T02:53:00.000Z', validTimeFrom: 1790132400, validTimeTo: 1790229600,
  rawTAF: 'TAF KDEN 230253Z 2303/2406 15020G30KT P6SM FEW060 BKN120 BKN220 TEMPO 2303/2304 VRB20G40KT -TSRA BKN080CB '
    + 'FM230400 17011KT P6SM FEW080 SCT120 BKN200 FM231200 VRB06KT P6SM SCT100 BKN200 FM231800 10008KT P6SM SCT070 BKN120 '
    + 'PROB30 2322/2402 VRB15G25KT -SHRA BKN070 FM240200 11007KT P6SM SCT070 BKN100 TEMPO 2402/2406 VRB15G25KT -SHRA BKN070',
  fcsts: [
    { timeFrom: 1790132400, timeTo: 1790136000, fcstChange: null, probability: null, wdir: 150, wspd: 20, wgst: 30, visib: '6+', wxString: null, clouds: [{ cover: 'FEW', base: 6000 }, { cover: 'BKN', base: 12000 }, { cover: 'BKN', base: 22000 }] },
    { timeFrom: 1790132400, timeTo: 1790136000, fcstChange: 'TEMPO', probability: null, wdir: 'VRB', wspd: 20, wgst: 40, visib: '', wxString: '-TSRA', clouds: [{ cover: 'BKN', base: 8000, type: 'CB' }] },
    { timeFrom: 1790136000, timeTo: 1790164800, fcstChange: 'FM', probability: null, wdir: 170, wspd: 11, wgst: null, visib: '6+', wxString: null, clouds: [{ cover: 'FEW', base: 8000 }, { cover: 'SCT', base: 12000 }, { cover: 'BKN', base: 20000 }] },
    { timeFrom: 1790164800, timeTo: 1790186400, fcstChange: 'FM', probability: null, wdir: 'VRB', wspd: 6, wgst: null, visib: '6+', wxString: null, clouds: [{ cover: 'SCT', base: 10000 }, { cover: 'BKN', base: 20000 }] },
    { timeFrom: 1790186400, timeTo: 1790215200, fcstChange: 'FM', probability: null, wdir: 100, wspd: 8, wgst: null, visib: '6+', wxString: null, clouds: [{ cover: 'SCT', base: 7000 }, { cover: 'BKN', base: 12000 }] },
    { timeFrom: 1790200800, timeTo: 1790215200, fcstChange: 'PROB', probability: 30, wdir: 'VRB', wspd: 15, wgst: 25, visib: '', wxString: '-SHRA', clouds: [{ cover: 'BKN', base: 7000 }] },
    { timeFrom: 1790215200, timeTo: 1790229600, fcstChange: 'FM', probability: null, wdir: 110, wspd: 7, wgst: null, visib: '6+', wxString: null, clouds: [{ cover: 'SCT', base: 7000 }, { cover: 'BKN', base: 10000 }] },
    { timeFrom: 1790215200, timeTo: 1790229600, fcstChange: 'TEMPO', probability: null, wdir: 'VRB', wspd: 15, wgst: 25, visib: '', wxString: '-SHRA', clouds: [{ cover: 'BKN', base: 7000 }] },
  ],
};

// ---- field decoding ----

test('decodeWind: normal, calm, gusting, variable, and missing', () => {
  assert.deepEqual(decodeWind(160, 25, 34), { calm: false, variable: false, directionTrue: 160, speedKt: 25, gustKt: 34 });
  assert.deepEqual(decodeWind(0, 0, null), { calm: true, variable: false, directionTrue: null, speedKt: 0, gustKt: null });
  assert.deepEqual(decodeWind('VRB', 6, null), { calm: false, variable: true, directionTrue: null, speedKt: 6, gustKt: null });
  assert.deepEqual(decodeWind(undefined, undefined, undefined), { calm: false, variable: false, directionTrue: null, speedKt: null, gustKt: null });
});

test('decodeVisibility: plain numbers, at-least, fractions, below-minimum, and unset', () => {
  assert.equal(decodeVisibility(7), 7);
  assert.equal(decodeVisibility('10+'), 10);
  assert.equal(decodeVisibility('6+'), 6); // TAF's form of the same thing
  assert.equal(decodeVisibility('P6SM'), 6);
  assert.equal(decodeVisibility('1/2'), 0.5);
  assert.equal(decodeVisibility('1 1/2'), 1.5);
  assert.equal(decodeVisibility('M1/4'), 0.25);
  assert.equal(decodeVisibility(''), null); // TAF TEMPO/PROB group not restating visibility
  assert.equal(decodeVisibility(null), null);
});

test('decodeCeiling: lowest BKN/OVC layer wins, SCT/FEW never count, vertical visibility counts, none is unlimited', () => {
  assert.equal(decodeCeiling(KDEN_METAR.clouds, null), 6000);
  assert.equal(decodeCeiling(KJFK_METAR.clouds, null), 25000); // the lower SCT layer doesn't count as a ceiling
  assert.equal(decodeCeiling([], 200), 200); // fog: indefinite ceiling by vertical visibility
  assert.equal(decodeCeiling([{ cover: 'BKN', base: 3000 }], 200), 200); // VV lower than the cloud layer wins
  assert.equal(decodeCeiling([], null), null); // no ceiling reported at all
  assert.equal(decodeCeiling([{ cover: 'SCT', base: 2000 }], null), null); // scattered only: still unlimited
});

test('decodeMetar end to end against two real live samples', () => {
  const den = decodeMetar(KDEN_METAR);
  assert.equal(den.wind.directionTrue, 160);
  assert.equal(den.wind.speedKt, 25);
  assert.equal(den.wind.gustKt, 34);
  assert.equal(den.visibilitySm, 7);
  assert.equal(den.ceilingFt, 6000);
  assert.equal(den.wxString, '-RA');

  const jfk = decodeMetar(KJFK_METAR);
  assert.equal(jfk.visibilitySm, 10);
  assert.equal(jfk.ceilingFt, 25000);
  assert.equal(jfk.wxString, null); // no weather phenomena reported
});

// ---- TAF periods, TEMPO/PROB merging ----

test('conditionsAt: the plain base period, with no overlay active', () => {
  const taf = decodeTaf(KDEN_TAF);
  const { conditions, source } = conditionsAt(taf, new Date(1790164800 * 1000)); // 231200Z, FM231200 in force
  assert.equal(conditions.wind.directionTrue, null); // VRB06KT
  assert.equal(conditions.wind.variable, true);
  assert.equal(conditions.visibilitySm, 6);
  assert.equal(conditions.ceilingFt, 20000); // lowest BKN layer of that period
  assert.equal(source.wind, null); // base period, not an overlay
});

test('conditionsAt: an active TEMPO overlays its own fields and is attributed as the source', () => {
  const taf = decodeTaf(KDEN_TAF);
  const { conditions, source } = conditionsAt(taf, new Date(1790133000 * 1000)); // inside 2303/2304 TEMPO
  assert.equal(conditions.wind.variable, true); // TEMPO's VRB overrides the base's steady 150
  assert.equal(conditions.wind.gustKt, 40); // TEMPO's gust (40) beats the base's (30) as the worse case
  assert.equal(conditions.wxString, '-TSRA');
  assert.equal(source.wind, 'TEMPO');
  // TEMPO didn't restate visibility/ceiling ("" / no clouds override lower than base's) so those still
  // come from the base period, per TAF convention.
  assert.equal(conditions.visibilitySm, 6);
  assert.equal(source.visibility, null);
});

test('conditionsAt: a PROB group is labelled with its percentage and only applies within its own window', () => {
  const taf = decodeTaf(KDEN_TAF);
  const inside = conditionsAt(taf, new Date(1790205000 * 1000)); // inside 2322/2402 PROB30
  assert.equal(inside.source.wind, 'PROB30');
  assert.equal(inside.conditions.wxString, '-SHRA');

  const outside = conditionsAt(taf, new Date(1790190000 * 1000)); // same FM period, before the PROB window opens
  assert.equal(outside.source.wind, null);
});

// ---- crosswind ----

test('crosswindComponent: headwind, pure crosswind, and tailwind', () => {
  const headOn = crosswindComponent(180, 20, 180);
  assert.ok(Math.abs(headOn.headwindKt - 20) < 0.001 && Math.abs(headOn.crosswindKt) < 0.001);

  const pureCross = crosswindComponent(270, 20, 180);
  assert.ok(Math.abs(pureCross.headwindKt) < 0.001 && Math.abs(pureCross.crosswindKt - 20) < 0.001);

  const tailwind = crosswindComponent(0, 20, 180);
  assert.ok(Math.abs(tailwind.headwindKt + 20) < 0.001 && Math.abs(tailwind.crosswindKt) < 0.001);
});

test('resolveRunwayEnds: uses a published true heading when present, else converts the magnetic number', () => {
  const rows = [
    { le_ident: '17', le_heading_true: 172, he_ident: '35', he_heading_true: 352 },
    { le_ident: '13', le_heading_true: null, he_ident: '31', he_heading_true: null },
  ];
  const ends = resolveRunwayEnds(rows, 39.7392, -104.9903, new Date('2026-01-01'));
  const byIdent = Object.fromEntries(ends.map((e) => [e.ident, e]));
  assert.equal(byIdent['17'].headingTrue, 172);
  assert.equal(byIdent['17'].headingSource, 'published');
  assert.equal(byIdent['13'].headingSource, 'computed');
  assert.ok(byIdent['13'].headingTrue > 130 && byIdent['13'].headingTrue < 140); // 130 + ~7.5E declination
});

test('bestRunway: picks the end with the smallest crosswind', () => {
  const ends = [{ ident: '17', headingTrue: 170 }, { ident: '35', headingTrue: 350 }];
  const { runway } = bestRunway(ends, { calm: false, variable: false, directionTrue: 340, speedKt: 20, gustKt: null });
  assert.equal(runway.ident, '35'); // wind nearly aligned with 35, far off 17
  assert.ok(runway.crosswindKt < 10);
});

test('bestRunway: calm wind has zero crosswind on any runway; variable/missing direction cannot be computed', () => {
  const ends = [{ ident: '17', headingTrue: 170 }];
  assert.equal(bestRunway(ends, { calm: true, variable: false, directionTrue: null, speedKt: 0, gustKt: null }).runway.crosswindKt, 0);
  assert.equal(bestRunway(ends, { calm: false, variable: true, directionTrue: null, speedKt: 15, gustKt: null }).runway, null);
  assert.equal(bestRunway([], { calm: false, variable: false, directionTrue: 170, speedKt: 10, gustKt: null }).reason, 'no runway data for this airport');
});

// ---- minimums comparison ----

const minimums = {
  min_ceiling_ft: 1000, min_visibility_sm: 3, max_wind_kt: 20, max_gust_kt: 25, max_crosswind_kt: 10,
  night_min_ceiling_ft: 1500, night_min_visibility_sm: 5, night_max_wind_kt: 15, night_max_gust_kt: 20, night_max_crosswind_kt: 8,
};

function check(checks, key) { return checks.find((c) => c.key === key); }

test('compareToMinimums: everything comfortably within limits', () => {
  const conditions = { ceilingFt: 5000, visibilitySm: 10, wind: { calm: false, variable: false, directionTrue: 180, speedKt: 5, gustKt: null }, wxString: null };
  const runwayResult = { runway: { ident: '18', crosswindKt: 2, gustCrosswindKt: null } };
  const checks = compareToMinimums(conditions, minimums, false, runwayResult);
  for (const c of checks) assert.notEqual(c.status, 'outside');
  assert.equal(overallStatus(checks), 'within');
});

test('compareToMinimums: ceiling below minimum names the exact numbers', () => {
  const conditions = { ceilingFt: 800, visibilitySm: 10, wind: { calm: false, variable: false, directionTrue: 180, speedKt: 5, gustKt: null }, wxString: null };
  const c = check(compareToMinimums(conditions, minimums, false, { runway: { ident: '18', crosswindKt: 1 } }), 'ceiling');
  assert.equal(c.status, 'outside');
  assert.equal(c.message, 'Ceiling 800 ft is below your 1000 ft minimum');
});

test('compareToMinimums: crosswind exceeding the limit names the runway, and gust crosswind is reported separately', () => {
  const conditions = { ceilingFt: 5000, visibilitySm: 10, wind: { calm: false, variable: false, directionTrue: 270, speedKt: 12, gustKt: 20 }, wxString: null };
  const runwayResult = { runway: { ident: '19', crosswindKt: 12, gustCrosswindKt: 19.9 } };
  const checks = compareToMinimums(conditions, minimums, false, runwayResult);
  const cw = check(checks, 'crosswind');
  assert.equal(cw.status, 'outside');
  assert.equal(cw.message, 'Crosswind 12 kt exceeds your 10 kt limit on runway 19');
  const gcw = check(checks, 'gustCrosswind');
  assert.equal(gcw.status, 'outside');
  assert.equal(gcw.actual, 20);
});

test('compareToMinimums: night uses the night minimums, and says so via which fields are checked against', () => {
  const conditions = { ceilingFt: 1200, visibilitySm: 4, wind: { calm: false, variable: false, directionTrue: 180, speedKt: 5, gustKt: null }, wxString: null };
  const day = compareToMinimums(conditions, minimums, false, { runway: { ident: '18', crosswindKt: 1 } });
  const night = compareToMinimums(conditions, minimums, true, { runway: { ident: '18', crosswindKt: 1 } });
  assert.notEqual(check(day, 'ceiling').status, 'outside'); // 1200 >= day min 1000
  assert.equal(check(night, 'ceiling').status, 'outside'); // 1200 < night min 1500
  assert.equal(check(night, 'ceiling').limit, 1500);
});

test('compareToMinimums: a TEMPO-driven verdict is attributed by name, matching the plan\'s example wording', () => {
  const taf = decodeTaf({
    icaoId: 'KXYZ', issueTime: '2026-01-01T00:00:00.000Z', validTimeFrom: 1790000000, validTimeTo: 1790100000,
    rawTAF: 'n/a',
    fcsts: [
      { timeFrom: 1790000000, timeTo: 1790100000, fcstChange: null, probability: null, wdir: 200, wspd: 10, wgst: null, visib: '6+', wxString: null, clouds: [] },
      { timeFrom: 1790000000, timeTo: 1790050000, fcstChange: 'TEMPO', probability: null, wdir: 200, wspd: 10, wgst: null, visib: '1', wxString: '-RA', clouds: [] },
    ],
  });
  const { conditions, source } = conditionsAt(taf, new Date(1790010000 * 1000));
  const c = check(compareToMinimums(conditions, minimums, false, { runway: { ident: '18', crosswindKt: 1 } }, source), 'visibility');
  assert.equal(c.status, 'outside');
  assert.equal(c.message, 'TEMPO -RA Visibility 1SM is below your 3SM minimum');
});

test('compareToMinimums: missing visibility is unavailable, but no gust reported is fine (not unavailable)', () => {
  const conditions = { ceilingFt: null, visibilitySm: null, wind: { calm: false, variable: false, directionTrue: 180, speedKt: 5, gustKt: null }, wxString: null };
  const checks = compareToMinimums(conditions, minimums, false, { runway: { ident: '18', crosswindKt: 1 } });
  assert.equal(check(checks, 'visibility').status, 'unavailable');
  assert.equal(check(checks, 'ceiling').status, 'within'); // no ceiling reported = unlimited, not missing
  assert.equal(check(checks, 'gust').status, 'within'); // no gust field = no significant gust, not missing
  assert.equal(overallStatus(checks), 'unavailable');
});

test('compareToMinimums: no runway data makes crosswind unavailable, without failing the whole check', () => {
  const conditions = { ceilingFt: 5000, visibilitySm: 10, wind: { calm: false, variable: false, directionTrue: 180, speedKt: 5, gustKt: null }, wxString: null };
  const checks = compareToMinimums(conditions, minimums, false, { runway: null, reason: 'no runway data for this airport' });
  const cw = check(checks, 'crosswind');
  assert.equal(cw.status, 'unavailable');
  assert.equal(cw.reason, 'no runway data for this airport');
});

test('a limit left unset (null) is simply not checked', () => {
  const conditions = { ceilingFt: 200, visibilitySm: 10, wind: { calm: false, variable: false, directionTrue: 180, speedKt: 5, gustKt: null }, wxString: null };
  const checks = compareToMinimums(conditions, { min_ceiling_ft: null }, false, { runway: null });
  assert.equal(check(checks, 'ceiling').status, null);
  assert.equal(check(checks, 'wind').status, null);
});
