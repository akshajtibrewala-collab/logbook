import { Router } from 'express';
import { all } from '../db.js';

const router = Router();

// Read-only: requirements are editable as seed data (server/src/migrations/005_milestones.js), not
// through the app — see that file's header for why, and for the OR-gate ("aircraft_flags") mechanism.
router.get('/', async (_req, res) => {
  res.json(await all('SELECT * FROM milestones_config ORDER BY certificate, sort_order'));
});

export default router;
