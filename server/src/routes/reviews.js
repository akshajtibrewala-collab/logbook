import { Router } from 'express';
import { all, get, run } from '../db.js';
import { isIsoDate } from '../validate.js';

const router = Router();

router.get('/', async (_req, res) => {
  res.json(await all('SELECT * FROM flight_reviews ORDER BY date DESC, id DESC'));
});

router.post('/', async (req, res) => {
  const { date, notes } = req.body ?? {};
  if (!isIsoDate(date)) return res.status(400).json({ errors: { date: 'Date must be YYYY-MM-DD' } });
  const { lastId } = await run('INSERT INTO flight_reviews (date, notes) VALUES (?, ?)', [date, notes || null]);
  res.status(201).json(await get('SELECT * FROM flight_reviews WHERE id = ?', [lastId]));
});

router.put('/:id', async (req, res) => {
  const { date, notes } = req.body ?? {};
  if (!isIsoDate(date)) return res.status(400).json({ errors: { date: 'Date must be YYYY-MM-DD' } });
  const { changes } = await run('UPDATE flight_reviews SET date = ?, notes = ? WHERE id = ?', [date, notes || null, req.params.id]);
  if (!changes) return res.status(404).json({ error: 'Review not found' });
  res.json(await get('SELECT * FROM flight_reviews WHERE id = ?', [req.params.id]));
});

router.delete('/:id', async (req, res) => {
  const { changes } = await run('DELETE FROM flight_reviews WHERE id = ?', [req.params.id]);
  if (!changes) return res.status(404).json({ error: 'Review not found' });
  res.status(204).end();
});

export default router;
