import { Router } from 'express';
import { all, batchAll } from '../db.js';

const router = Router();

const COLUMNS = 'ident, icao, iata, local_code, name, city, country, lat, lon';
// Larger airports win when a short code is ambiguous (e.g. a local code shared worldwide).
const TYPE_RANK = "CASE type WHEN 'large_airport' THEN 0 WHEN 'medium_airport' THEN 1 WHEN 'small_airport' THEN 2 ELSE 3 END";

const BY_CODE = `SELECT ${COLUMNS} FROM airports
  WHERE icao = :c OR ident = :c OR iata = :c OR local_code = :c
  ORDER BY CASE WHEN icao = :c OR ident = :c THEN 0 WHEN iata = :c THEN 1 ELSE 2 END, ${TYPE_RANK}
  LIMIT 1`;

// US airports written as K + the 3-character FAA code (KFYG) may only be stored under their local code (FYG).
const BY_US_LOCAL = `SELECT ${COLUMNS} FROM airports WHERE country = 'US' AND local_code = :local ORDER BY ${TYPE_RANK} LIMIT 1`;

// Single-airport lookup, sharing the same K+local-code fallback as /resolve — used by other routes
// (server/src/routes/weather.js) that need one airport's row rather than a batch of them.
export async function resolveAirportRow(code) {
  const c = String(code ?? '').trim().toUpperCase();
  if (!c) return null;
  const [row] = await all(BY_CODE, { c });
  if (row) return row;
  if (/^K[A-Z0-9]{3}$/.test(c)) {
    const [fallback] = await all(BY_US_LOCAL, { local: c.slice(1) });
    return fallback || null;
  }
  return null;
}

// GET /api/airports/resolve?codes=KPAO,KSQL,SFO -> { KPAO: {...}, SFO: {...} } (unknown codes omitted).
// Lookups are batched, so any number of codes costs one or two round trips to the database.
router.get('/resolve', async (req, res) => {
  const codes = [...new Set(String(req.query.codes ?? '').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean))].slice(0, 500);
  const out = {};
  if (!codes.length) return res.json(out);

  const first = await batchAll(codes.map((c) => ({ sql: BY_CODE, args: { c } })));
  const retry = [];
  codes.forEach((c, i) => {
    if (first[i][0]) out[c] = first[i][0];
    else if (/^K[A-Z0-9]{3}$/.test(c)) retry.push(c);
  });
  if (retry.length) {
    const second = await batchAll(retry.map((c) => ({ sql: BY_US_LOCAL, args: { local: c.slice(1) } })));
    retry.forEach((c, i) => { if (second[i][0]) out[c] = second[i][0]; });
  }
  res.json(out);
});

// GET /api/airports/search?q=palo -> up to 10 matches by code or name (for autocomplete).
// Note: the name/city match scans the table, so prefer code lookups where possible.
router.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) return res.json([]);
  res.json(await all(
    `SELECT ${COLUMNS} FROM airports
      WHERE icao LIKE :prefix OR iata LIKE :prefix OR local_code LIKE :prefix OR name LIKE :like OR city LIKE :like
      ORDER BY CASE WHEN icao LIKE :prefix OR iata LIKE :prefix THEN 0 ELSE 1 END, ${TYPE_RANK}, name
      LIMIT 10`,
    { prefix: `${q}%`, like: `%${q}%` },
  ));
});

export default router;
