import { Router } from 'express';
import { all, get, run } from '../db.js';

// Photos are stored as base64 data URLs in the database (see migrations/019_flight_photos.js) because a
// serverless deployment has no writable disk. The client compresses each one to roughly 1280px JPEG
// before upload; the caps here are a backstop, not the primary size control.
export const MAX_PHOTOS_PER_FLIGHT = 8;
export const MAX_DATA_URL_CHARS = 900_000;
const DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

export function parsePhoto(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = {};
  if (typeof b.data_url !== 'string' || !DATA_URL.test(b.data_url)) errors.data_url = 'Send a JPEG, PNG or WebP image as a base64 data URL';
  else if (b.data_url.length > MAX_DATA_URL_CHARS) errors.data_url = 'Photo is too large — it should be compressed before upload';
  const dim = (k) => {
    if (b[k] == null || b[k] === '') return null;
    const n = Number(b[k]);
    if (!Number.isInteger(n) || n < 1 || n > 20000) { errors[k] = 'Invalid dimension'; return null; }
    return n;
  };
  const value = { data_url: b.data_url, width: dim('width'), height: dim('height') };
  return { value, errors: Object.keys(errors).length ? errors : null };
}

const router = Router();

// GET /api/photos/counts -> { "<flightId>": n } for flights that have photos (list badges, map pins).
router.get('/counts', async (_req, res) => {
  const rows = await all('SELECT flight_id, COUNT(*) AS n FROM flight_photos GROUP BY flight_id');
  res.json(Object.fromEntries(rows.map((r) => [r.flight_id, r.n])));
});

router.get('/flight/:flightId', async (req, res) => {
  res.json(await all('SELECT id, data_url, width, height, created_at FROM flight_photos WHERE flight_id = ? ORDER BY id', [req.params.flightId]));
});

router.post('/flight/:flightId', async (req, res) => {
  const flightId = Number(req.params.flightId);
  if (!Number.isInteger(flightId) || !(await get('SELECT id FROM flights WHERE id = ?', [flightId]))) {
    return res.status(404).json({ error: 'Flight not found' });
  }
  const { value, errors } = parsePhoto(req.body);
  if (errors) return res.status(400).json({ errors });
  const { n } = await get('SELECT COUNT(*) AS n FROM flight_photos WHERE flight_id = ?', [flightId]);
  if (n >= MAX_PHOTOS_PER_FLIGHT) return res.status(400).json({ error: `A flight can have at most ${MAX_PHOTOS_PER_FLIGHT} photos` });
  const { lastId } = await run('INSERT INTO flight_photos (flight_id, data_url, width, height) VALUES (?, ?, ?, ?)', [flightId, value.data_url, value.width, value.height]);
  res.status(201).json({ id: lastId, width: value.width, height: value.height });
});

router.delete('/:id', async (req, res) => {
  const { changes } = await run('DELETE FROM flight_photos WHERE id = ?', [req.params.id]);
  if (!changes) return res.status(404).json({ error: 'Photo not found' });
  res.status(204).end();
});

export default router;
