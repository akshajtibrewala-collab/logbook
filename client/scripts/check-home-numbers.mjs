// HOME NUMBERS CHECK (read-only). verify-baseline.js only knows the pilot numbers; this one covers the passenger side too and proves that Home, Travel,
// Stats and Map tell the same story on the same data. It only loads pages (GETs) and never writes, so it is safe on the real local data (:4173 / :3001).
//
//   PLAYWRIGHT_CORE=<playwright-core folder> BROWSER_EXE=<chromium> node client/scripts/check-home-numbers.mjs [--base http://localhost:4173] [--api http://localhost:3001]
//        [--profile real|production]   the expected figures come from the private local config (client/scripts/.local-expected.json, never committed)
//        [--expect pilot=<h>,passenger=<h>,flights=<n>,airports=<n>,countries=<n>,nm=<n>]   or give them on the command line; --expect none checks only that the screens agree
//
// The expected figures:  pilot = the Logbook total (pilot flights only);  passenger = hours as passenger;  flights / airports / countries = passenger flights, the
// places they touch;  nm = the distance of ALL flights (Home's own total, pilot and passenger routes together). The passenger-only distance is a separate figure.
//
// Two layers:  (1) a MODEL built in Node from the API with the app's own lib functions (the same ones useHomeData uses), compared to the expected figures;
//              (2) the SCREENS: Home (greeting with the name, the pilot hero, the passenger item, the status line), Travel (hero, totals sheet, year headers sum),
//                  Stats > Travel and Map (All and Passenger), each compared to the model and to each other.
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { buildMapData, placeableMapData } from '../src/lib/mapdata.js';
import { visitedCounts } from '../src/lib/mapstyle.js';
import { flightCodes } from '../src/lib/flightpath.js';
import { profileExpected } from './lib/localExpected.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', process.env.BASE_URL || 'http://localhost:4173');
const API = arg('--api', process.env.API_URL || 'http://localhost:3001');
const PROFILE = arg('--profile', 'real');
const EXPECT_ARG = arg('--expect', '');
const fromConfig = profileExpected(PROFILE);
let EXPECT = null;
if (EXPECT_ARG === 'none') EXPECT = null;
else if (EXPECT_ARG) EXPECT = Object.fromEntries(EXPECT_ARG.split(',').map((kv) => kv.split('=')).map(([k, v]) => [k, Number(v)]));
else if (fromConfig) EXPECT = Object.fromEntries(Object.entries(fromConfig).filter(([k, v]) => ['pilot', 'passenger', 'flights', 'airports', 'countries', 'nm', 'paxNm'].includes(k) && v != null));
else console.log('(no client/scripts/.local-expected.json and no --expect: checking only that the screens agree with each other)');
const NAME = arg('--name', 'Akshaj');
if (!process.env.PLAYWRIGHT_CORE || !process.env.BROWSER_EXE) { console.error('Set PLAYWRIGHT_CORE and BROWSER_EXE (see check-controls.mjs).'); process.exit(2); }
const { chromium } = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);

const rows = []; const fails = [];
const r2 = (n) => Math.round(n * 100) / 100;
const num = (s) => Number(String(s).replace(/[^\d.-]/g, ''));
const compare = (what, a, b, tol = 0.0051) => { const ok = Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol; rows.push({ check: what, found: a, expected: b, result: ok ? 'pass' : 'FAIL' }); if (!ok) fails.push(`${what}: found ${a}, expected ${b}`); };
const truthy = (what, ok, found = '') => { rows.push({ check: what, found: found || ok, expected: 'yes', result: ok ? 'pass' : 'FAIL' }); if (!ok) fails.push(`${what}: ${found || 'no'}`); };

// ---- 1. the model, from the API with the app's own lib functions
const get = async (p) => (await fetch(`${API}/api${p}`)).json();
const flights = await get('/flights');
const codes = [...new Set(flights.flatMap(flightCodes))];
const airports = codes.length ? await get(`/airports/resolve?codes=${encodeURIComponent(codes.join(','))}`) : {};
const pilot = flights.filter((f) => f.role === 'pilot'), pax = flights.filter((f) => f.role === 'passenger');
const hours = (list) => r2(list.reduce((s, f) => s + (Number(f.total_time) || 0), 0));
const paxMap = buildMapData(pax, airports), counts = visitedCounts(paxMap.stops);
const model = {
  pilot: hours(pilot), passenger: hours(pax), flights: pax.length, airports: counts.airports, countries: counts.countries,
  nm: Math.round(placeableMapData(buildMapData(flights, airports)).totalDistanceNm), paxNm: Math.round(placeableMapData(paxMap).totalDistanceNm),
};
console.log(`API ${API}: ${flights.length} flights (${pilot.length} pilot, ${pax.length} passenger). Model: ${JSON.stringify(model)}`);
if (EXPECT) for (const k of Object.keys(EXPECT)) compare(`model ${k}`, model[k], EXPECT[k], k === 'nm' ? 0.5 : 0.0051);

// ---- 2. the screens
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXE });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, reducedMotion: 'reduce' });
await ctx.route(/arcgisonline|basemaps\.cartocdn|tile\.openstreetmap/, (r) => r.abort());
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const load = async (route) => { await p.goto(`${BASE}${route}`, { waitUntil: 'networkidle' }); await p.evaluate(() => { try { sessionStorage.clear(); } catch { /* ignore */ } }); await p.waitForTimeout(1200); };

// Home
await load('/');
const greeting = (await p.locator('.bc-greet').first().innerText()).trim();
truthy('Home greeting names the pilot', new RegExp(`^Good (morning|afternoon|evening), ${NAME}$`).test(greeting), greeting);
compare('Home pilot hero (h)', num(await p.locator('.bc-hero .n [data-final]').first().getAttribute('data-final')), model.pilot);
const paxItem = await p.locator('.bc-item', { hasText: 'Passenger' }).first().innerText();
compare('Home passenger item (h)', num(paxItem.replace('Passenger', '')), model.passenger);
const status = (await p.locator('.bc-status').first().innerText()).trim();
truthy('Home status line reads "All clear" or "N need(s) attention"', /^(All clear|\d+ needs? attention)$/.test(status), status);
rows.push({ check: 'Home status line (reported)', found: status, expected: '-', result: 'info' });

// Travel
await load('/travel');
compare('Travel hero (h)', num(await p.locator('.bc-hero .n [data-final]').first().getAttribute('data-final')), model.passenger);
await p.locator('.bc-hero').first().click(); await p.waitForTimeout(700);
const sheet = await p.locator('.ds-sheet').first().innerText();
const kv = (label) => { const m = sheet.match(new RegExp(`${label}s?\\s+([\\d,.]+)`, 'i')); return m ? num(m[1]) : NaN; };
compare('Travel sheet flights', kv('Flight'), model.flights); compare('Travel sheet airports', kv('Airport'), model.airports); compare('Travel sheet countries', kv('Countr(?:y|ie)'), model.countries);
await p.keyboard.press('Escape'); await p.waitForTimeout(500);
const closed = p.locator('.bc-mh[aria-expanded="false"]');
for (let i = 0; i < 20 && (await closed.count()); i++) { await closed.first().click(); await p.waitForTimeout(80); }
const yearHours = (await p.locator('.bc-mh .r').allTextContents()).map(num);
compare(`Travel year headers (${yearHours.length}) sum to the total (h)`, r2(yearHours.reduce((a, b) => a + b, 0)), model.passenger, 0.011);
truthy('Travel is passenger-only: one-word scope "Passenger"', (await p.locator('.bc-hero .lab').first().innerText()).trim() === 'Passenger');

// Stats > Travel
await load('/stats');
await p.getByRole('tab', { name: /^Travel/ }).click(); await p.waitForTimeout(900);
const st = (await p.locator('#main').innerText()).replace(/\s+/g, ' ');
const sm = st.match(/Passenger ([\d.]+) ?h .*?Flights (\d+) · Airports (\d+) · Countries (\d+)/i);
truthy('Stats > Travel totals found', Boolean(sm), sm ? '' : st.slice(0, 80));
if (sm) { compare('Stats hours', num(sm[1]), model.passenger); compare('Stats flights', num(sm[2]), model.flights); compare('Stats airports', num(sm[3]), model.airports); compare('Stats countries', num(sm[4]), model.countries); }
const sd = st.match(/([\d,]+) nm flown in total/i);
compare('Stats distance (nm, passenger flights)', sd ? num(sd[1]) : NaN, model.paxNm, 0.5);

// Map: All, then Passenger
await load('/map'); await p.waitForTimeout(800);
await p.locator('button[aria-controls="map-stats"]').click(); await p.waitForTimeout(500);
const mapStats = async () => {
  const lines = (await p.locator('#map-stats').innerText()).split('\n').map((s) => s.trim()).filter(Boolean); const out = {};
  for (let i = 0; i + 1 < lines.length; i++) if (/^[\d,.]+(nm)?$/.test(lines[i]) && /^[a-z ]+$/i.test(lines[i + 1])) out[lines[i + 1].toLowerCase()] = num(lines[i]);
  return out;
};
const button = (re) => p.locator('[aria-label="Filter by role"] button', { hasText: re });
await button(/^All$/).click(); await p.waitForTimeout(900);
const all = await mapStats();
compare('Map (All) distance (nm) = Home total', all.distance, model.nm, 0.5);
compare('Map (All) flights', all.flights, flights.length);
await button(/^Passenger$/).click(); await p.waitForTimeout(900);
const mp = await mapStats();
compare('Map (Passenger) airports', mp.airports, model.airports); compare('Map (Passenger) countries', mp.countries, model.countries); compare('Map (Passenger) flights', mp.flights, model.flights);
compare('Map (Passenger) hours', mp['passenger hours'], model.passenger); compare('Map (Passenger) distance = Stats distance (nm)', mp.distance, model.paxNm, 0.5);
await button(/^Pilot$/).click(); await p.waitForTimeout(900);
const mpi = await mapStats();
compare('Map (Pilot) flights', mpi.flights, pilot.length); compare('Map (Pilot) distance + passenger distance = All (nm)', (mpi.distance || 0) + (mp.distance || 0), all.distance, 1.5);
truthy('no page errors while loading Home, Travel, Stats and Map', errs.length === 0, errs.slice(0, 2).join(' | '));
await browser.close();

console.table(rows);
console.log(fails.length ? `\n${fails.length} Home-number failure(s):\n - ${fails.join('\n - ')}` : `\nAll ${rows.filter((r) => r.result !== 'info').length} Home, Travel, Stats and Map numbers agree.`);
process.exit(fails.length ? 1 : 0);
