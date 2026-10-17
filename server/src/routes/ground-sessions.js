import { Router } from 'express';
import { all, get, run } from '../db.js';
import { parseGroundSession } from '../validate.js';
import { mergeOntoStored } from '../lib/merge-update.js';

const GROUND_SESSION_FIELDS = ['date', 'hours', 'instructor', 'topics', 'notes', 'cost_override', 'invoice_ref'];

const router = Router();

router.get('/', async (_req, res) => {
  res.json(await all('SELECT * FROM ground_sessions ORDER BY date DESC, id DESC'));
});
router.get('/:id', async (req, res) => {
  const row = await get('SELECT * FROM ground_sessions WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Ground session not found' });
  res.json(row);
});
router.post('/', async (req, res) => {
  const { value, errors } = parseGroundSession(req.body);
  if (errors) return res.status(400).json({ errors });
  const { lastId } = await run(
    'INSERT INTO ground_sessions (date, hours, instructor, topics, notes, cost_override, invoice_ref) VALUES (:date, :hours, :instructor, :topics, :notes, :cost_override, :invoice_ref)',
    value,
  );
  res.status(201).json(await get('SELECT * FROM ground_sessions WHERE id = ?', [lastId]));
});
router.put('/:id', async (req, res) => {
  const stored = await get('SELECT * FROM ground_sessions WHERE id = ?', [req.params.id]);
  if (!stored) return res.status(404).json({ error: 'Ground session not found' });
  // Only the fields sent change (see lib/merge-update.js): a form that leaves out the instructor or the
  // invoice reference must not erase them.
  const { value, errors } = parseGroundSession(mergeOntoStored(stored, req.body, GROUND_SESSION_FIELDS));
  if (errors) return res.status(400).json({ errors });
  const { changes } = await run(
    'UPDATE ground_sessions SET date = :date, hours = :hours, instructor = :instructor, topics = :topics, notes = :notes, cost_override = :cost_override, invoice_ref = :invoice_ref WHERE id = :id',
    { ...value, id: req.params.id },
  );
  if (!changes) return res.status(404).json({ error: 'Ground session not found' });
  res.json(await get('SELECT * FROM ground_sessions WHERE id = ?', [req.params.id]));
});
router.delete('/:id', async (req, res) => {
  const { changes } = await run('DELETE FROM ground_sessions WHERE id = ?', [req.params.id]);
  if (!changes) return res.status(404).json({ error: 'Ground session not found' });
  res.status(204).end();
});

export default router;
