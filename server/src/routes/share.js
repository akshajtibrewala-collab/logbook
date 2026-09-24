import { Router } from 'express';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { all, get, run } from '../db.js';
import { buildShareSummary, recentFlights } from '../lib/share-summary.js';

const FLAGS = ['show_notes', 'show_photos', 'show_recent_flights', 'show_aircraft'];
const newToken = () => randomBytes(24).toString('base64url'); // 192 bits: not guessable
const digest = (s) => createHash('sha256').update(String(s)).digest();

const view = (row) => (row ? {
  exists: true, enabled: Boolean(row.enabled), token: row.enabled ? row.token : null, ...Object.fromEntries(FLAGS.map((f) => [f, Boolean(row[f])])),
} : { exists: false, enabled: false, token: null, show_notes: false, show_photos: false, show_recent_flights: true, show_aircraft: true });

// ---- Managed by the pilot (behind the app passcode) -------------------------------------------------
export const shareAdminRouter = Router();

shareAdminRouter.get('/', async (_req, res) => {
  res.json(view(await get('SELECT * FROM share_settings WHERE id = 1')));
});

// Turn sharing on. Always issues a fresh token unless a link is already active, so a previously
// revoked link can never come back to life.
shareAdminRouter.post('/', async (_req, res) => {
  const row = await get('SELECT * FROM share_settings WHERE id = 1');
  if (!row) await run('INSERT INTO share_settings (id, token) VALUES (1, ?)', [newToken()]);
  else if (!row.enabled) await run('UPDATE share_settings SET enabled = 1, token = ? WHERE id = 1', [newToken()]);
  res.status(201).json(view(await get('SELECT * FROM share_settings WHERE id = 1')));
});

shareAdminRouter.put('/', async (req, res) => {
  const row = await get('SELECT * FROM share_settings WHERE id = 1');
  if (!row) return res.status(404).json({ error: 'Sharing is not turned on' });
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  const sets = [];
  const args = [];
  for (const f of FLAGS) {
    if (f in b) {
      if (typeof b[f] !== 'boolean') return res.status(400).json({ errors: { [f]: 'Must be true or false' } });
      sets.push(`${f} = ?`);
      args.push(b[f] ? 1 : 0);
    }
  }
  if (sets.length) await run(`UPDATE share_settings SET ${sets.join(', ')} WHERE id = 1`, args);
  res.json(view(await get('SELECT * FROM share_settings WHERE id = 1')));
});

// The pilot's own printable summary (behind the passcode): the same builder as the public link, with
// every section on except what the query turns off, and a longer recent-flights list.
shareAdminRouter.get('/summary', async (req, res) => {
  const flights = await all('SELECT * FROM flights');
  const settings = await get('SELECT hours_target, hours_target_label FROM pilot_settings WHERE id = 1');
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const share = { show_recent_flights: 1, show_aircraft: 1, show_notes: req.query.notes === '0' ? 0 : 1, show_photos: 0 };
  res.json(buildShareSummary({ flights, share, settings, recentLimit: limit }));
});

shareAdminRouter.post('/regenerate', async (_req, res) => {
  const { changes } = await run('UPDATE share_settings SET token = ?, enabled = 1 WHERE id = 1', [newToken()]);
  if (!changes) return res.status(404).json({ error: 'Sharing is not turned on' });
  res.json(view(await get('SELECT * FROM share_settings WHERE id = 1')));
});

// Revoke: disables the link and rotates the token so the old URL is dead for good.
shareAdminRouter.delete('/', async (_req, res) => {
  await run('UPDATE share_settings SET enabled = 0, token = ? WHERE id = 1', [newToken()]);
  res.status(204).end();
});

// ---- Public, read-only (no passcode; guarded by the unguessable token). GET only, by construction. ---
export const publicRouter = Router();

async function activeShare(token) {
  const row = await get('SELECT * FROM share_settings WHERE id = 1');
  if (!row || !row.enabled) return null;
  return timingSafeEqual(digest(token), digest(row.token)) ? row : null;
}

publicRouter.get('/:token', async (req, res) => {
  const share = await activeShare(req.params.token);
  if (!share) return res.status(404).json({ error: 'This link is not valid.' });
  const flights = await all('SELECT * FROM flights');
  const settings = await get('SELECT hours_target, hours_target_label FROM pilot_settings WHERE id = 1');
  const photoIdsByFlight = {};
  if (share.show_photos) {
    const ids = recentFlights(flights).map((f) => f.id);
    if (ids.length) {
      const rows = await all(`SELECT id, flight_id FROM flight_photos WHERE flight_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`, ids);
      for (const r of rows) (photoIdsByFlight[r.flight_id] ??= []).push(r.id);
    }
  }
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.json(buildShareSummary({ flights, share, settings, photoIdsByFlight }));
});

// A single photo as an image, only when photos are shared and it belongs to one of the listed flights.
publicRouter.get('/:token/photos/:id', async (req, res) => {
  const share = await activeShare(req.params.token);
  if (!share || !share.show_photos) return res.status(404).end();
  const photo = await get('SELECT flight_id, data_url FROM flight_photos WHERE id = ?', [req.params.id]);
  if (!photo) return res.status(404).end();
  const listed = recentFlights(await all('SELECT id, date FROM flights')).some((f) => f.id === photo.flight_id);
  if (!listed) return res.status(404).end();
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(photo.data_url);
  if (!m) return res.status(404).end();
  res.set('Content-Type', m[1]);
  res.set('Cache-Control', 'private, max-age=300');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.send(Buffer.from(m[2], 'base64'));
});
