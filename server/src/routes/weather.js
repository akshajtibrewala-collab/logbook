import { Router } from 'express';
import { all, get } from '../db.js';
import { resolveAirportRow } from './airports.js';
import { isNight } from '../lib/daynight.js';
import { decodeMetar, decodeTaf, conditionsAt, resolveRunwayEnds, bestRunway, compareToMinimums, overallStatus } from '../lib/weather.js';

const router = Router();

export const PERSONAL_MINIMUMS_NOTE =
  'A personal planning aid, not a substitute for an official weather briefing. Conditions are described as '
  + 'within, near, or outside your minimums — never as "safe".';

// Short in-memory cache: METAR/TAF don't change faster than this, and it keeps repeated dashboard/plan
// checks from hammering aviationweather.gov. Per warm server process only — fine for both local dev and
// a serverless instance that stays warm; a cold start just refetches, which is harmless.
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

async function fetchRaw(type, stationId) {
  const key = `${type}:${stationId}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.data;
  let data = null;
  try {
    const res = await fetch(`https://aviationweather.gov/api/data/${type}?ids=${encodeURIComponent(stationId)}&format=json`);
    if (res.ok) data = await res.json();
  } catch { /* network failure: fall through to stale cache below, or null */ }
  if (data == null) return hit ? hit.data : null; // upstream down: prefer a stale answer over none
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

async function pilotSettings() {
  return (await get('SELECT * FROM pilot_settings WHERE id = 1')) ?? {};
}

/** Runs the full checker (day/night, best runway, minimums) against one set of decoded conditions. */
function evaluate(conditions, source, airport, runwayEnds, settings, date) {
  const night = isNight(airport.lat, airport.lon, date);
  const runwayResult = bestRunway(runwayEnds, conditions.wind);
  const checks = compareToMinimums(conditions, settings, night, runwayResult, source);
  return {
    isNight: night, wind: conditions.wind, visibilitySm: conditions.visibilitySm, ceilingFt: conditions.ceilingFt,
    wxString: conditions.wxString, checks, overall: overallStatus(checks),
    runway: runwayResult.runway ? { ident: runwayResult.runway.ident, crosswindKt: Math.round(runwayResult.runway.crosswindKt) } : null,
    runwayReason: runwayResult.reason,
  };
}

/** Every 3 hours from `from` out to `hours` ahead, clipped to the TAF's own validity window. */
function forecastTimes(decodedTaf, from, hours = 12, stepHours = 3) {
  const times = [];
  for (let h = stepHours; h <= hours; h += stepHours) {
    const t = new Date(from.getTime() + h * 3600 * 1000);
    if (t >= decodedTaf.validFrom && t <= decodedTaf.validTo) times.push(t);
  }
  return times;
}

/** Resolves an airport, its runway ends, and current settings — the setup shared by both endpoints. */
async function loadAirportContext(code) {
  const airport = await resolveAirportRow(code);
  if (!airport) return null;
  const runwayRows = await all('SELECT * FROM runways WHERE airport_ident = ?', [airport.ident]);
  const settings = await pilotSettings();
  return { airport, runwayEnds: resolveRunwayEnds(runwayRows, airport.lat, airport.lon), settings };
}

async function checkAirport(code, at) {
  const ctx = await loadAirportContext(code);
  if (!ctx) return { error: `Unknown airport: ${code}` };
  const { airport, runwayEnds, settings } = ctx;
  const stationId = airport.icao || airport.ident;
  const now = new Date();

  const metarRaw = await fetchRaw('metar', stationId);
  let current;
  if (metarRaw?.[0]) {
    const decoded = decodeMetar(metarRaw[0]);
    current = { ...evaluate(decoded, {}, airport, runwayEnds, settings, now), obsTime: decoded.obsTime, rawText: decoded.rawText };
  } else {
    current = { unavailable: true, reason: `No current METAR available for ${stationId}` };
  }

  const tafRaw = await fetchRaw('taf', stationId);
  let forecast;
  if (!tafRaw?.[0]) {
    forecast = { unavailable: true, reason: `No TAF issued for ${stationId}` };
  } else {
    const decodedTaf = decodeTaf(tafRaw[0]);
    const times = at ? [at] : forecastTimes(decodedTaf, now);
    forecast = {
      rawText: tafRaw[0].rawTAF, issueTime: decodedTaf.issueTime, validFrom: decodedTaf.validFrom, validTo: decodedTaf.validTo,
      periods: times.map((t) => {
        const { conditions, source } = conditionsAt(decodedTaf, t);
        if (!conditions) return { time: t, unavailable: true, reason: 'Outside the TAF\'s valid period' };
        return { time: t, ...evaluate(conditions, source, airport, runwayEnds, settings, t) };
      }),
    };
  }

  return {
    airport: { ident: airport.ident, icao: airport.icao, name: airport.name, lat: airport.lat, lon: airport.lon },
    current, forecast, note: PERSONAL_MINIMUMS_NOTE,
  };
}

router.get('/:ident', async (req, res) => {
  const result = await checkAirport(req.params.ident);
  if (result.error) return res.status(404).json(result);
  res.json(result);
});

// POST /api/weather/plan { legs: [{ ident, eta }, ...] } -> per-leg forecast at each leg's own ETA.
router.post('/plan', async (req, res) => {
  const legs = Array.isArray(req.body?.legs) ? req.body.legs : [];
  if (!legs.length) return res.status(400).json({ error: 'Provide at least one leg: { ident, eta }' });

  const results = [];
  for (const leg of legs) {
    const eta = new Date(leg?.eta);
    if (!leg?.ident || Number.isNaN(eta.getTime())) { results.push({ ident: leg?.ident ?? null, error: 'Each leg needs an ident and a valid eta' }); continue; }
    const result = await checkAirport(leg.ident, eta);
    results.push({ ident: leg.ident, eta: eta.toISOString(), ...result });
  }
  res.json({ legs: results, note: PERSONAL_MINIMUMS_NOTE });
});

export default router;
