import { Router } from 'express';
import { get, run } from '../db.js';
import { parsePilotSettings, PILOT_SETTINGS_FIELDS } from '../validate.js';

const router = Router();

// Always exactly one row (id = 1) — created on first GET/PUT rather than by a migration seed, so a
// fresh database can tell "settings never touched" apart from "settings explicitly cleared".
async function ensureRow() {
  const row = await get('SELECT * FROM pilot_settings WHERE id = 1');
  if (row) return row;
  await run(`INSERT INTO pilot_settings (id, ${PILOT_SETTINGS_FIELDS.join(',')}) VALUES (1, ${PILOT_SETTINGS_FIELDS.map(() => 'NULL').join(',')})`);
  return get('SELECT * FROM pilot_settings WHERE id = 1');
}

router.get('/', async (_req, res) => {
  res.json(await ensureRow());
});

router.put('/', async (req, res) => {
  const { value, errors } = parsePilotSettings(req.body);
  if (errors) return res.status(400).json({ errors });
  await ensureRow();
  const set = PILOT_SETTINGS_FIELDS.map((c) => `${c} = :${c}`).join(', ');
  await run(`UPDATE pilot_settings SET ${set} WHERE id = 1`, value);
  res.json(await get('SELECT * FROM pilot_settings WHERE id = 1'));
});

export default router;
