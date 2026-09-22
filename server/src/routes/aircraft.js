import { Router } from 'express';
import { all, get, run } from '../db.js';
import { parseAircraft, AIRCRAFT_FIELDS } from '../validate.js';

const router = Router();
const INSERT = `INSERT INTO aircraft (${AIRCRAFT_FIELDS.join(',')}) VALUES (${AIRCRAFT_FIELDS.map((c) => ':' + c).join(',')})`;

// GET /api/aircraft — active aircraft by default; ?archived=1 includes archived ones too.
router.get('/', async (req, res) => {
  const includeArchived = req.query.archived === '1';
  res.json(await all(
    `SELECT * FROM aircraft ${includeArchived ? '' : 'WHERE archived_at IS NULL'} ORDER BY tail_number IS NULL, tail_number, model`,
  ));
});

router.get('/:id', async (req, res) => {
  const row = await get('SELECT * FROM aircraft WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Aircraft not found' });
  res.json(row);
});

router.post('/', async (req, res) => {
  const { value, errors } = parseAircraft(req.body);
  if (errors) return res.status(400).json({ errors });
  const { lastId } = await run(INSERT, value);
  res.status(201).json(await get('SELECT * FROM aircraft WHERE id = ?', [lastId]));
});

router.put('/:id', async (req, res) => {
  const { value, errors } = parseAircraft(req.body);
  if (errors) return res.status(400).json({ errors });
  const set = AIRCRAFT_FIELDS.map((c) => `${c} = :${c}`).join(', ');
  const { changes } = await run(`UPDATE aircraft SET ${set}, updated_at = datetime('now') WHERE id = :id`, { ...value, id: req.params.id });
  if (!changes) return res.status(404).json({ error: 'Aircraft not found' });
  res.json(await get('SELECT * FROM aircraft WHERE id = ?', [req.params.id]));
});

// Aircraft are archived, never hard-deleted while flights reference them — see DELETE below.
router.post('/:id/archive', async (req, res) => {
  const { changes } = await run("UPDATE aircraft SET archived_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND archived_at IS NULL", [req.params.id]);
  if (!changes) return res.status(404).json({ error: 'Aircraft not found, or already archived' });
  res.json(await get('SELECT * FROM aircraft WHERE id = ?', [req.params.id]));
});

router.post('/:id/unarchive', async (req, res) => {
  const { changes } = await run("UPDATE aircraft SET archived_at = NULL, updated_at = datetime('now') WHERE id = ?", [req.params.id]);
  if (!changes) return res.status(404).json({ error: 'Aircraft not found' });
  res.json(await get('SELECT * FROM aircraft WHERE id = ?', [req.params.id]));
});

// Only allowed when no flight references it — archive instead of reassigning/deleting flight history.
router.delete('/:id', async (req, res) => {
  const { n } = await get('SELECT COUNT(*) AS n FROM flights WHERE aircraft_id = ?', [req.params.id]);
  if (n > 0) {
    return res.status(409).json({ error: `${n} flight${n === 1 ? '' : 's'} reference this aircraft — archive it instead, or reassign those flights first.` });
  }
  const { changes } = await run('DELETE FROM aircraft WHERE id = ?', [req.params.id]);
  if (!changes) return res.status(404).json({ error: 'Aircraft not found' });
  res.status(204).end();
});

export default router;
