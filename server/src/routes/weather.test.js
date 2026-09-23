import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_FILE = ':memory:';
delete process.env.APP_PASSCODE;
const { app } = await import('../app.js');
const { migrate } = await import('../migrate.js');
const { run } = await import('../db.js');

let server;
let base;
const fetchCalls = [];
const originalFetch = globalThis.fetch;
const nowSec = Math.floor(Date.now() / 1000);

const METAR_KPAO = {
  icaoId: 'KPAO', obsTime: nowSec, wdir: 300, wspd: 10, wgst: 18, visib: 10, wxString: null,
  rawOb: 'METAR KPAO 300G18KT 10SM BKN008', clouds: [{ cover: 'BKN', base: 800 }],
};
const METAR_KHAF = {
  icaoId: 'KHAF', obsTime: nowSec, wdir: 250, wspd: 12, wgst: null, visib: 7, wxString: null,
  rawOb: 'METAR KHAF 25012KT 7SM', clouds: [],
};
const TAF_KPAO = {
  icaoId: 'KPAO', issueTime: new Date((nowSec - 3600) * 1000).toISOString(), validTimeFrom: nowSec - 300, validTimeTo: nowSec + 24 * 3600,
  rawTAF: 'TAF KPAO ... TEMPO ... FM ...',
  fcsts: [
    { timeFrom: nowSec - 300, timeTo: nowSec + 24 * 3600, fcstChange: null, probability: null, wdir: 290, wspd: 8, wgst: null, visib: '10+', wxString: null, clouds: [{ cover: 'FEW', base: 5000 }] },
    { timeFrom: nowSec - 300, timeTo: nowSec + 4 * 3600, fcstChange: 'TEMPO', probability: null, wdir: 300, wspd: 15, wgst: 25, visib: '2', wxString: '-RA', clouds: [{ cover: 'BKN', base: 800 }] },
  ],
};

function jsonResponse(body) { return { ok: true, json: async () => body }; }

before(async () => {
  await migrate();
  await run(
    'INSERT INTO airports (ident, icao, iata, local_code, name, city, country, type, lat, lon) VALUES (?,?,?,?,?,?,?,?,?,?)',
    ['KPAO', 'KPAO', null, 'PAO', 'Palo Alto Airport of Santa Clara Co', 'Palo Alto', 'US', 'small_airport', 37.4611, -122.1150],
  );
  await run(
    'INSERT INTO airports (ident, icao, iata, local_code, name, city, country, type, lat, lon) VALUES (?,?,?,?,?,?,?,?,?,?)',
    ['KHAF', 'KHAF', null, 'HAF', 'Half Moon Bay Airport', 'Half Moon Bay', 'US', 'small_airport', 37.5134, -122.5],
  );
  await run(
    'INSERT INTO runways (airport_ident, le_ident, le_heading_true, he_ident, he_heading_true, length_ft, surface) VALUES (?,?,?,?,?,?,?)',
    ['KPAO', '13', 132, '31', 312, 2443, 'ASP'],
  );
  // Both day and night minimums are set to the same values, so these tests don't depend on whether the
  // real clock happens to fall before/after sunrise/sunset at KPAO's real coordinates when they run.
  await run(
    `INSERT INTO pilot_settings (id, min_ceiling_ft, min_visibility_sm, max_wind_kt, max_gust_kt, max_crosswind_kt,
       night_min_ceiling_ft, night_min_visibility_sm, night_max_wind_kt, night_max_gust_kt, night_max_crosswind_kt)
     VALUES (1, 1000, 3, 20, 25, 8, 1000, 3, 20, 25, 8)`,
  );

  globalThis.fetch = async (url) => {
    fetchCalls.push(url);
    const u = new URL(url);
    const type = u.pathname.includes('/metar') ? 'metar' : 'taf';
    const ids = u.searchParams.get('ids');
    if (type === 'metar') return jsonResponse(ids === 'KPAO' ? [METAR_KPAO] : ids === 'KHAF' ? [METAR_KHAF] : []);
    return jsonResponse(ids === 'KPAO' ? [TAF_KPAO] : []); // KHAF has no TAF
  };

  await new Promise((resolve) => {
    server = app.listen(0, () => { base = `http://localhost:${server.address().port}/api`; resolve(); });
  });
});
after(() => { server.close(); globalThis.fetch = originalFetch; });

// Uses the real fetch (captured before it's mocked below) to call our own local test server; the mock
// only needs to intercept the route's own outbound calls to aviationweather.gov.
const call = (method, path, body) =>
  originalFetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });

test('unknown airport returns 404 without ever calling the upstream API', async () => {
  const before2 = fetchCalls.length;
  const res = await call('GET', '/weather/ZZZZ');
  assert.equal(res.status, 404);
  assert.equal(fetchCalls.length, before2);
});

test('current conditions: decodes the METAR, flags the breached ceiling, and names the best runway', async () => {
  const res = await call('GET', '/weather/KPAO');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.airport.ident, 'KPAO');
  assert.equal(body.current.ceilingFt, 800);
  assert.equal(body.current.overall, 'outside');
  const ceiling = body.current.checks.find((c) => c.key === 'ceiling');
  assert.equal(ceiling.status, 'outside');
  assert.equal(ceiling.message, 'Ceiling 800 ft is below your 1000 ft minimum');
  assert.equal(body.current.runway.ident, '31'); // wind 300 is closer to runway 31 (312) than 13 (132)
  assert.equal(body.note.includes('not a substitute'), true);
});

test('forecast: a TEMPO period is merged and attributed by name; a plain period later is not', async () => {
  const res = await call('GET', '/weather/KPAO');
  const body = await res.json();
  const soon = body.forecast.periods[0]; // +3h, inside the TEMPO window
  const later = body.forecast.periods[body.forecast.periods.length - 1]; // +12h, base period only
  const visSoon = soon.checks.find((c) => c.key === 'visibility');
  assert.equal(visSoon.status, 'outside');
  assert.equal(visSoon.message, 'TEMPO -RA Visibility 2SM is below your 3SM minimum');
  const visLater = later.checks.find((c) => c.key === 'visibility');
  assert.equal(visLater.status, 'within'); // "10+" from the base period, no TEMPO active
});

test('a station with no TAF issued says so clearly instead of an empty forecast', async () => {
  const res = await call('GET', '/weather/KHAF');
  const body = await res.json();
  assert.equal(body.forecast.unavailable, true);
  assert.match(body.forecast.reason, /No TAF issued for KHAF/);
  // KHAF has no runways table row either — crosswind should say why, not silently omit the check.
  assert.equal(body.current.checks.find((c) => c.key === 'crosswind').reason, 'no runway data for this airport');
});

test('repeated requests within the cache window do not refetch from aviationweather.gov', async () => {
  await call('GET', '/weather/KPAO');
  const countBefore = fetchCalls.length;
  await call('GET', '/weather/KPAO');
  assert.equal(fetchCalls.length, countBefore); // served from cache, no new upstream calls
});

test('POST /weather/plan checks each leg at its own eta, and rejects a leg with a bad eta', async () => {
  const res = await call('POST', '/weather/plan', {
    legs: [
      { ident: 'KPAO', eta: new Date((nowSec + 3 * 3600) * 1000).toISOString() },
      { ident: 'KHAF', eta: new Date((nowSec + 3 * 3600) * 1000).toISOString() },
      { ident: 'KPAO', eta: 'not-a-date' },
    ],
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.legs[0].forecast.periods[0].checks.find((c) => c.key === 'visibility').status, 'outside');
  assert.equal(body.legs[1].forecast.unavailable, true);
  assert.equal(body.legs[2].error, 'Each leg needs an ident and a valid eta');
});
