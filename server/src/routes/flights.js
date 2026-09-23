import { Router } from 'express';
import { all, batchRun, get, run } from '../db.js';
import { parseFlight, parseStops, parseApproaches, FLIGHT_FIELDS } from '../validate.js';

const STOPS_SELECT = 'SELECT airport_code, stop_type FROM flight_stops WHERE flight_id = ? ORDER BY sequence';
const APPROACHES_SELECT = 'SELECT id, approach_type, count FROM flight_approaches WHERE flight_id = ? ORDER BY id';

/** Replaces a flight's stops with `stops` (an array, already validated) — full replace, not a diff. */
async function saveStops(flightId, stops) {
  await run('DELETE FROM flight_stops WHERE flight_id = ?', [flightId]);
  if (stops.length) {
    await batchRun(stops.map((s, i) => ({
      sql: 'INSERT INTO flight_stops (flight_id, sequence, airport_code, stop_type) VALUES (?, ?, ?, ?)',
      args: [flightId, i, s.airport_code, s.stop_type],
    })));
  }
}

/** Replaces a flight's typed-approach breakdown with `approaches` (already validated) — full replace. */
async function saveApproaches(flightId, approaches) {
  await run('DELETE FROM flight_approaches WHERE flight_id = ?', [flightId]);
  if (approaches.length) {
    await batchRun(approaches.map((a) => ({
      sql: 'INSERT INTO flight_approaches (flight_id, approach_type, count) VALUES (?, ?, ?)',
      args: [flightId, a.approach_type, a.count],
    })));
  }
}

const router = Router();

const INSERT = `INSERT INTO flights (${FLIGHT_FIELDS.join(',')}) VALUES (${FLIGHT_FIELDS.map((c) => ':' + c).join(',')})`;

const SORTABLE = new Set(['date', 'total_time', 'aircraft_type', 'departure_airport', 'arrival_airport']);
const CATEGORY_COLUMNS = new Set([
  'pic_time', 'sic_time', 'dual_received', 'solo_time', 'night_time',
  'instrument_actual', 'instrument_simulated', 'cross_country_time',
]);

router.get('/', async (req, res) => {
  const { from, to, aircraft_type, category, q, sort = 'date', dir = 'desc' } = req.query;
  const where = [];
  const params = [];
  if (from) { where.push('date >= ?'); params.push(from); }
  if (to) { where.push('date <= ?'); params.push(to); }
  if (aircraft_type) { where.push('aircraft_type = ?'); params.push(aircraft_type); }
  if (category) {
    if (!CATEGORY_COLUMNS.has(category)) return res.status(400).json({ error: 'Unknown category' });
    where.push(`${category} > 0`);
  }
  if (q) {
    where.push('(departure_airport LIKE ? OR arrival_airport LIKE ? OR tail_number LIKE ? OR remarks LIKE ?)');
    params.push(...Array(4).fill(`%${q}%`));
  }
  const col = SORTABLE.has(sort) ? sort : 'date';
  const direction = String(dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const sql = `SELECT * FROM flights ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY ${col} ${direction}, id ${direction}`;
  const rows = await all(sql, params);

  // Batched, not per-row: one extra query for the whole (personal-scale) approaches table, grouped in
  // JS, rather than an N+1 query per flight. `route` already carries the via-airports text for the list
  // view, so `stops` (with each one's full-stop/touch-and-go type) stays a detail-view/export-only fetch.
  const approaches = await all('SELECT flight_id, approach_type, count FROM flight_approaches ORDER BY id');
  const approachesByFlight = new Map();
  for (const a of approaches) {
    if (!approachesByFlight.has(a.flight_id)) approachesByFlight.set(a.flight_id, []);
    approachesByFlight.get(a.flight_id).push({ approach_type: a.approach_type, count: a.count });
  }
  for (const f of rows) f.approach_types = approachesByFlight.get(f.id) ?? [];

  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const row = await get('SELECT * FROM flights WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Flight not found' });
  row.stops = await all(STOPS_SELECT, [req.params.id]);
  row.approach_types = await all(APPROACHES_SELECT, [req.params.id]);
  res.json(row);
});

router.post('/', async (req, res) => {
  const { value, errors } = parseFlight(req.body);
  const { value: stops, errors: stopErrors } = parseStops(req.body?.stops);
  const { value: approachTypes, errors: approachErrors } = parseApproaches(req.body?.approach_types);
  if (errors || stopErrors || approachErrors) {
    return res.status(400).json({ errors: { ...errors, ...(stopErrors && { stops: stopErrors }), ...(approachErrors && { approach_types: approachErrors }) } });
  }
  if (stops) value.route = stops.length ? stops.map((s) => s.airport_code).join(' ') : null;
  const { lastId } = await run(INSERT, value);
  if (stops) await saveStops(lastId, stops);
  if (approachTypes) await saveApproaches(lastId, approachTypes);
  const created = await get('SELECT * FROM flights WHERE id = ?', [lastId]);
  created.stops = await all(STOPS_SELECT, [lastId]);
  created.approach_types = await all(APPROACHES_SELECT, [lastId]);
  res.status(201).json(created);
});

// Bulk insert for CSV import. Each valid row is inserted individually (not one atomic batch) because
// linking its stops/approaches needs that row's own new id back — a batch's statements don't hand those
// back per-statement. Invalid rows (any of the flight, stops or approaches shape) are reported by index
// and simply skipped, same partial-success contract as before; valid rows ahead of a bad one still land.
router.post('/bulk', async (req, res) => {
  const list = req.body?.flights;
  if (!Array.isArray(list) || list.length === 0) return res.status(400).json({ error: 'Send { flights: [...] } with at least one flight' });
  if (list.length > 5000) return res.status(400).json({ error: 'Too many flights in one import (max 5000)' });
  const failed = [];
  let inserted = 0;
  for (let index = 0; index < list.length; index++) {
    const item = list[index];
    const { value, errors } = parseFlight(item);
    const { value: stops, errors: stopErrors } = parseStops(item?.stops);
    const { value: approachTypes, errors: approachErrors } = parseApproaches(item?.approach_types);
    if (errors || stopErrors || approachErrors) {
      failed.push({ index, errors: { ...errors, ...(stopErrors && { stops: stopErrors }), ...(approachErrors && { approach_types: approachErrors }) } });
      continue;
    }
    if (stops) value.route = stops.length ? stops.map((s) => s.airport_code).join(' ') : value.route;
    const { lastId } = await run(INSERT, value);
    if (stops) await saveStops(lastId, stops);
    if (approachTypes) await saveApproaches(lastId, approachTypes);
    inserted++;
  }
  res.status(201).json({ inserted, failed });
});

router.put('/:id', async (req, res) => {
  const { value, errors } = parseFlight(req.body);
  const { value: stops, errors: stopErrors } = parseStops(req.body?.stops);
  const { value: approachTypes, errors: approachErrors } = parseApproaches(req.body?.approach_types);
  if (errors || stopErrors || approachErrors) {
    return res.status(400).json({ errors: { ...errors, ...(stopErrors && { stops: stopErrors }), ...(approachErrors && { approach_types: approachErrors }) } });
  }
  if (stops) value.route = stops.length ? stops.map((s) => s.airport_code).join(' ') : null;
  const set = FLIGHT_FIELDS.map((c) => `${c} = :${c}`).join(', ');
  const { changes } = await run(`UPDATE flights SET ${set}, updated_at = datetime('now') WHERE id = :id`, { ...value, id: req.params.id });
  if (!changes) return res.status(404).json({ error: 'Flight not found' });
  if (stops) await saveStops(req.params.id, stops);
  if (approachTypes) await saveApproaches(req.params.id, approachTypes);
  const updated = await get('SELECT * FROM flights WHERE id = ?', [req.params.id]);
  updated.stops = await all(STOPS_SELECT, [req.params.id]);
  updated.approach_types = await all(APPROACHES_SELECT, [req.params.id]);
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  // Explicit cleanup rather than relying on ON DELETE CASCADE, which SQLite only enforces when
  // "PRAGMA foreign_keys = ON" is set on the connection — not guaranteed across every environment.
  await run('DELETE FROM flight_stops WHERE flight_id = ?', [req.params.id]);
  await run('DELETE FROM flight_approaches WHERE flight_id = ?', [req.params.id]);
  const { changes } = await run('DELETE FROM flights WHERE id = ?', [req.params.id]);
  if (!changes) return res.status(404).json({ error: 'Flight not found' });
  res.status(204).end();
});

export default router;
