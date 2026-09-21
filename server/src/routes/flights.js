import { Router } from 'express';
import { all, batchRun, get, run } from '../db.js';
import { parseFlight, FLIGHT_FIELDS } from '../validate.js';

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
  res.json(await all(sql, params));
});

router.get('/:id', async (req, res) => {
  const row = await get('SELECT * FROM flights WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Flight not found' });
  res.json(row);
});

router.post('/', async (req, res) => {
  const { value, errors } = parseFlight(req.body);
  if (errors) return res.status(400).json({ errors });
  const { lastId } = await run(INSERT, value);
  res.status(201).json(await get('SELECT * FROM flights WHERE id = ?', [lastId]));
});

// Bulk insert for CSV import. Valid rows go in as one atomic batch; invalid ones are reported by index.
router.post('/bulk', async (req, res) => {
  const list = req.body?.flights;
  if (!Array.isArray(list) || list.length === 0) return res.status(400).json({ error: 'Send { flights: [...] } with at least one flight' });
  if (list.length > 5000) return res.status(400).json({ error: 'Too many flights in one import (max 5000)' });
  const failed = [];
  const statements = [];
  list.forEach((item, index) => {
    const { value, errors } = parseFlight(item);
    if (errors) failed.push({ index, errors });
    else statements.push({ sql: INSERT, args: value });
  });
  if (statements.length) await batchRun(statements);
  res.status(201).json({ inserted: statements.length, failed });
});

router.put('/:id', async (req, res) => {
  const { value, errors } = parseFlight(req.body);
  if (errors) return res.status(400).json({ errors });
  const set = FLIGHT_FIELDS.map((c) => `${c} = :${c}`).join(', ');
  const { changes } = await run(`UPDATE flights SET ${set}, updated_at = datetime('now') WHERE id = :id`, { ...value, id: req.params.id });
  if (!changes) return res.status(404).json({ error: 'Flight not found' });
  res.json(await get('SELECT * FROM flights WHERE id = ?', [req.params.id]));
});

router.delete('/:id', async (req, res) => {
  const { changes } = await run('DELETE FROM flights WHERE id = ?', [req.params.id]);
  if (!changes) return res.status(404).json({ error: 'Flight not found' });
  res.status(204).end();
});

export default router;
