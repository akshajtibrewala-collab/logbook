import { Router } from 'express';
import { all, get, run } from '../db.js';
import { parseExpiration, EXPIRATION_FIELDS } from '../validate.js';

const router = Router();
const INSERT = `INSERT INTO expirations (${EXPIRATION_FIELDS.join(',')}) VALUES (${EXPIRATION_FIELDS.map((c) => ':' + c).join(',')})`;

router.get('/', async (_req, res) => {
  res.json(await all('SELECT * FROM expirations ORDER BY expires_date'));
});

router.post('/', async (req, res) => {
  const { value, errors } = parseExpiration(req.body);
  if (errors) return res.status(400).json({ errors });
  const { lastId } = await run(INSERT, value);
  res.status(201).json(await get('SELECT * FROM expirations WHERE id = ?', [lastId]));
});

router.put('/:id', async (req, res) => {
  const { value, errors } = parseExpiration(req.body);
  if (errors) return res.status(400).json({ errors });
  const set = EXPIRATION_FIELDS.map((c) => `${c} = :${c}`).join(', ');
  const { changes } = await run(`UPDATE expirations SET ${set}, updated_at = datetime('now') WHERE id = :id`, { ...value, id: req.params.id });
  if (!changes) return res.status(404).json({ error: 'Expiration not found' });
  res.json(await get('SELECT * FROM expirations WHERE id = ?', [req.params.id]));
});

router.delete('/:id', async (req, res) => {
  const { changes } = await run('DELETE FROM expirations WHERE id = ?', [req.params.id]);
  if (!changes) return res.status(404).json({ error: 'Expiration not found' });
  res.status(204).end();
});

export default router;
