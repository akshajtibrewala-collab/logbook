import { Router } from 'express';
import { all, batchRun, get, run } from '../db.js';
import { ensureAircraftRate, pickDefaultAircraftRate } from '../lib/default-rate.js';
import { parseFlight, parseStops, parseApproaches, parseAircraft, AIRCRAFT_FIELDS, FLIGHT_FIELDS } from '../validate.js';
import { resolveAirportRow, resolveAirportRows } from './airports.js';
import { passengerDuration } from '../lib/passengerDuration.js';
import { isTurbineAircraftType } from '../lib/aircraftTurbine.js';
import { mergeOntoStored } from '../lib/merge-update.js';

const INSERT_AIRCRAFT = `INSERT INTO aircraft (${AIRCRAFT_FIELDS.join(',')}) VALUES (${AIRCRAFT_FIELDS.map((c) => ':' + c).join(',')})`;
const normTail = (t) => (t ? String(t).trim().toUpperCase() : null);
const lastIdOf = (rs) => (rs.lastInsertRowid == null ? null : Number(rs.lastInsertRowid));

/**
 * The actual duration math, given the two airports already resolved (or null) — shared by the single-
 * flight applyPassengerDuration (which resolves them itself) and the bulk route (which resolves every
 * distinct airport across the whole request in one or two round trips, then calls this per row). Mutates
 * `value` in place; returns an error string, or null on success/no-op.
 */
function computeDurationInto(value, dep, arr) {
  if (value.role !== 'passenger' || !value.dep_time || !value.arr_time) return null;
  if (!dep?.tz || !arr?.tz) return null; // no usable time zone on one end: keep the manually-entered total_time
  const result = passengerDuration({
    date: value.date, depTime: value.dep_time, arrTime: value.arr_time,
    depTz: dep.tz, arrTz: arr.tz, arrDayOffset: value.arr_day_offset,
  });
  if (!result) return null;
  if (result.hours <= 0) return 'Arrival must be after departure — adjust the arrival day';
  value.total_time = result.hours;
  value.arr_day_offset = result.arrDayOffset;
  return null;
}

/**
 * For a passenger flight with both dep_time and arr_time set, recomputes total_time (and resolves
 * arr_day_offset if the caller left it blank) from those local times — the server-side half of "Server-
 * side validation must enforce the same rules and recompute total_time from the times on save" (see
 * client/src/lib/passengerDuration.js for the shared calculation). Either time blank means manual
 * total_time entry: left alone.
 */
export async function applyPassengerDuration(value) {
  if (value.role !== 'passenger' || !value.dep_time || !value.arr_time) return null;
  const [dep, arr] = await Promise.all([resolveAirportRow(value.departure_airport), resolveAirportRow(value.arrival_airport)]);
  return computeDurationInto(value, dep, arr);
}

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

/**
 * Batched aircraft find-or-create for the bulk route: one SELECT for every distinct tail number across the
 * whole import (an IN clause, not one query per tail), then — only for tails that don't already exist — one
 * atomic batch of INSERTs. Mutates each row's `value.aircraft_id` in place. Passenger rows only (see the
 * comment at its call site for why pilot rows are never auto-linked). A newly-created aircraft's
 * is_turbine defaults to 1 only when its type is on the isTurbineAircraftType allowlist — there's no
 * pilot here to say otherwise, unlike manual creation (POST /api/aircraft), which always takes it from
 * what was actually entered.
 */
async function findOrCreateAircraftBatch(rows) {
  const tailsNeeded = [...new Set(
    rows.filter((r) => r.value.role === 'passenger' && !r.value.aircraft_id && r.value.tail_number)
      .map((r) => normTail(r.value.tail_number)),
  )];
  if (!tailsNeeded.length) return;

  const placeholders = tailsNeeded.map(() => '?').join(',');
  const existingRows = await all(`SELECT id, tail_number FROM aircraft WHERE UPPER(TRIM(tail_number)) IN (${placeholders})`, tailsNeeded);
  const idByTail = new Map(existingRows.map((r) => [normTail(r.tail_number), r.id]));

  const toCreate = tailsNeeded.filter((t) => !idByTail.has(t));
  if (toCreate.length) {
    const typeForTail = new Map();
    for (const { value } of rows) {
      const t = normTail(value.tail_number);
      if (t && value.aircraft_type && !typeForTail.has(t)) typeForTail.set(t, value.aircraft_type);
    }
    const inserts = toCreate.map((tail) => {
      const type = typeForTail.get(tail) || '';
      return { sql: INSERT_AIRCRAFT, args: parseAircraft({ tail_number: tail, model: type, is_turbine: isTurbineAircraftType(type) }).value };
    });
    const results = await batchRun(inserts);
    toCreate.forEach((tail, i) => idByTail.set(tail, lastIdOf(results[i])));
  }

  for (const { value } of rows) {
    if (value.role === 'passenger' && !value.aircraft_id && value.tail_number) {
      value.aircraft_id = idByTail.get(normTail(value.tail_number)) ?? null;
    }
  }
}

/**
 * Batched equivalent of ensureAircraftRate for the bulk route: fetches every cost-tracked phase and every
 * existing rate once (not once per row), works out in JS which (aircraft, certificate) pairs still need a
 * default rate, then writes them all in one atomic batch. One difference from calling ensureAircraftRate
 * per row: if two different *new* aircraft in the same import both need a default rate for the same
 * certificate, both get the same default (the latest rate that already existed before this import), rather
 * than the second picking up the first's just-inserted rate — a predictable, documented simplification for
 * the batched path, not a correctness issue (either default is equally "made up" until edited).
 */
async function ensureAircraftRatesBatch(values) {
  const withAircraft = values.filter((v) => v.aircraft_id);
  if (!withAircraft.length) return;
  const phases = await all('SELECT * FROM training_phases WHERE track_costs = 1');
  if (!phases.length) return;
  const phaseFor = (date) => phases.find((p) => p.start_date <= date && (!p.end_date || p.end_date >= date));

  const needed = new Map(); // `${aircraftId}|${certificate}` -> { aircraftId, certificate, phase }
  for (const v of withAircraft) {
    const phase = phaseFor(v.date);
    if (phase) needed.set(`${v.aircraft_id}|${phase.certificate}`, { aircraftId: v.aircraft_id, certificate: phase.certificate, phase });
  }
  if (!needed.size) return;

  const certificates = [...new Set([...needed.values()].map((n) => n.certificate))];
  const placeholders = certificates.map(() => '?').join(',');
  const existingRates = await all(`SELECT * FROM aircraft_rates WHERE certificate IN (${placeholders})`, certificates);
  const hasRate = new Set(existingRates.map((r) => `${r.aircraft_id}|${r.certificate}`));
  const ratesByCert = new Map(certificates.map((c) => [c, existingRates.filter((r) => r.certificate === c)]));

  const inserts = [];
  for (const { aircraftId, certificate, phase } of needed.values()) {
    if (hasRate.has(`${aircraftId}|${certificate}`)) continue;
    const rate = pickDefaultAircraftRate(ratesByCert.get(certificate) ?? []);
    inserts.push({
      sql: 'INSERT INTO aircraft_rates (certificate, aircraft_id, effective_date, rental_rate_per_hr, fuel_surcharge_per_hr) VALUES (?, ?, ?, ?, ?)',
      args: [certificate, aircraftId, phase.start_date, rate.rental_rate_per_hr, rate.fuel_surcharge_per_hr],
    });
  }
  if (inserts.length) await batchRun(inserts);
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
  const durationError = await applyPassengerDuration(value);
  if (durationError) return res.status(400).json({ errors: { arr_day_offset: durationError } });
  const { lastId } = await run(INSERT, value);
  await ensureAircraftRate(value.aircraft_id, value.date);
  if (stops) await saveStops(lastId, stops);
  if (approachTypes) await saveApproaches(lastId, approachTypes);
  const created = await get('SELECT * FROM flights WHERE id = ?', [lastId]);
  created.stops = await all(STOPS_SELECT, [lastId]);
  created.approach_types = await all(APPROACHES_SELECT, [lastId]);
  res.status(201).json(created);
});

// Bulk insert for CSV import. Everything is batched so the round-trip count to the database stays roughly
// constant no matter how many rows are imported — critical on Turso (a real network hop per round trip)
// under a serverless function's time limit: airport resolution, aircraft find-or-create and default cost
// rates are each one or two round trips for the WHOLE request (see the helpers above), and the flight rows
// themselves are inserted as a single atomic batch (all rows land, or none do — see STEP 0 of the
// passenger-times release notes) with a second atomic batch for their stops/approaches. Only shape/duration
// validation failures are reported per row and skipped; everything that validates is inserted together.
router.post('/bulk', async (req, res) => {
  const list = req.body?.flights;
  if (!Array.isArray(list) || list.length === 0) return res.status(400).json({ error: 'Send { flights: [...] } with at least one flight' });
  if (list.length > 5000) return res.status(400).json({ error: 'Too many flights in one import (max 5000)' });

  const failed = [];
  const valid = [];
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
    valid.push({ index, value, stops, approachTypes });
  }

  // One batch to resolve every distinct airport any passenger row's duration calc needs, instead of two
  // lookups per row (146 round trips for 73 rows would otherwise be typical).
  const airportCodes = new Set();
  for (const { value } of valid) {
    if (value.role === 'passenger' && value.dep_time && value.arr_time) {
      if (value.departure_airport) airportCodes.add(value.departure_airport);
      if (value.arrival_airport) airportCodes.add(value.arrival_airport);
    }
  }
  const airports = airportCodes.size ? await resolveAirportRows([...airportCodes]) : {};

  const ready = [];
  for (const row of valid) {
    const durationError = computeDurationInto(row.value, airports[row.value.departure_airport], airports[row.value.arrival_airport]);
    if (durationError) { failed.push({ index: row.index, errors: { arr_day_offset: durationError } }); continue; }
    ready.push(row);
  }
  if (!ready.length) return res.status(201).json({ inserted: 0, failed });

  await findOrCreateAircraftBatch(ready);
  await ensureAircraftRatesBatch(ready.map((r) => r.value));

  // The critical atomic step: every ready row's flight row lands in one batch, or (on any failure) none do.
  let flightResults;
  try {
    flightResults = await batchRun(ready.map((r) => ({ sql: INSERT, args: r.value })));
  } catch (err) {
    return res.status(500).json({ error: 'Bulk insert failed; nothing was written.', detail: err.message });
  }

  const linkedStatements = [];
  ready.forEach((r, i) => {
    const flightId = lastIdOf(flightResults[i]);
    r.stops?.forEach((s, seq) => linkedStatements.push({
      sql: 'INSERT INTO flight_stops (flight_id, sequence, airport_code, stop_type) VALUES (?, ?, ?, ?)',
      args: [flightId, seq, s.airport_code, s.stop_type],
    }));
    r.approachTypes?.forEach((a) => linkedStatements.push({
      sql: 'INSERT INTO flight_approaches (flight_id, approach_type, count) VALUES (?, ?, ?)',
      args: [flightId, a.approach_type, a.count],
    }));
  });
  if (linkedStatements.length) await batchRun(linkedStatements);

  res.status(201).json({ inserted: ready.length, failed });
});

// Fields whose change invalidates a stored arrival-day offset (it is derived from them), so an update that
// moves one of them without sending a new offset has the server work the offset out again.
const OFFSET_INPUTS = ['date', 'dep_time', 'arr_time', 'departure_airport', 'arrival_airport'];

// PUT and PATCH behave the same: only the fields sent change (see lib/merge-update.js). Omitting a field
// keeps what is stored; sending null or '' clears it.
async function updateFlight(req, res) {
  const stored = await get('SELECT * FROM flights WHERE id = ?', [req.params.id]);
  if (!stored) return res.status(404).json({ error: 'Flight not found' });
  const body = mergeOntoStored(stored, req.body, FLIGHT_FIELDS);
  if (OFFSET_INPUTS.some((k) => Object.hasOwn(req.body ?? {}, k)) && !Object.hasOwn(req.body ?? {}, 'arr_day_offset')) {
    body.arr_day_offset = null;
  }
  const { value, errors } = parseFlight(body);
  const { value: stops, errors: stopErrors } = parseStops(req.body?.stops);
  const { value: approachTypes, errors: approachErrors } = parseApproaches(req.body?.approach_types);
  if (errors || stopErrors || approachErrors) {
    return res.status(400).json({ errors: { ...errors, ...(stopErrors && { stops: stopErrors }), ...(approachErrors && { approach_types: approachErrors }) } });
  }
  if (stops) value.route = stops.length ? stops.map((s) => s.airport_code).join(' ') : null;
  const durationError = await applyPassengerDuration(value);
  if (durationError) return res.status(400).json({ errors: { arr_day_offset: durationError } });
  const set = FLIGHT_FIELDS.map((c) => `${c} = :${c}`).join(', ');
  const { changes } = await run(`UPDATE flights SET ${set}, updated_at = datetime('now') WHERE id = :id`, { ...value, id: req.params.id });
  if (!changes) return res.status(404).json({ error: 'Flight not found' });
  await ensureAircraftRate(value.aircraft_id, value.date);
  if (stops) await saveStops(req.params.id, stops);
  if (approachTypes) await saveApproaches(req.params.id, approachTypes);
  const updated = await get('SELECT * FROM flights WHERE id = ?', [req.params.id]);
  updated.stops = await all(STOPS_SELECT, [req.params.id]);
  updated.approach_types = await all(APPROACHES_SELECT, [req.params.id]);
  res.json(updated);
}
router.put('/:id', updateFlight);
router.patch('/:id', updateFlight);

router.delete('/:id', async (req, res) => {
  // Explicit cleanup rather than relying on ON DELETE CASCADE, which SQLite only enforces when
  // "PRAGMA foreign_keys = ON" is set on the connection — not guaranteed across every environment.
  await run('DELETE FROM flight_stops WHERE flight_id = ?', [req.params.id]);
  await run('DELETE FROM flight_approaches WHERE flight_id = ?', [req.params.id]);
  await run('DELETE FROM flight_photos WHERE flight_id = ?', [req.params.id]);
  const { changes } = await run('DELETE FROM flights WHERE id = ?', [req.params.id]);
  if (!changes) return res.status(404).json({ error: 'Flight not found' });
  res.status(204).end();
});

export default router;
