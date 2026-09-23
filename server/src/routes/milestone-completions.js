import { Router } from 'express';
import { all, run } from '../db.js';
import { parseMilestoneCompletion } from '../validate.js';

const router = Router();

router.get('/', async (_req, res) => {
  res.json(await all('SELECT * FROM milestone_completions'));
});

router.put('/:certificate/:requirementKey', async (req, res) => {
  const { value, errors } = parseMilestoneCompletion(req.body);
  if (errors) return res.status(400).json({ errors });
  const { certificate, requirementKey } = req.params;
  await run(
    'INSERT OR REPLACE INTO milestone_completions (certificate, requirement_key, completed_at, note) VALUES (:certificate, :requirement_key, :completed_at, :note)',
    { certificate, requirement_key: requirementKey, ...value },
  );
  res.json({ certificate, requirement_key: requirementKey, ...value });
});

router.delete('/:certificate/:requirementKey', async (req, res) => {
  const { certificate, requirementKey } = req.params;
  await run('DELETE FROM milestone_completions WHERE certificate = ? AND requirement_key = ?', [certificate, requirementKey]);
  res.status(204).end();
});

export default router;
