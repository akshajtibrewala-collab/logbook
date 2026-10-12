import { Router } from 'express';
import { cronAuthorized } from '../lib/backup-job.js';

/**
 * GET /api/cron/registrations: the scheduled "fill blank registrations" job. Authenticates with CRON_SECRET only
 * (Vercel Cron sends it as a Bearer token), never the app passcode, and fails closed when no secret is set.
 * The response and the log carry counts only. Without FLIGHT_DATA_API_KEY the job does nothing at all.
 *
 * `runJob` is injected so tests never reach the provider. `budget` turns the environment into the per-run call
 * cap and reserve.
 */
export function makeRegistrationCronRouter({ runJob, budget }) {
  const router = Router();
  router.get('/registrations', async (req, res) => {
    if (!cronAuthorized(req.get('authorization'), process.env.CRON_SECRET)) return res.status(401).json({ error: 'Unauthorized' });
    const key = process.env.FLIGHT_DATA_API_KEY;
    if (!key) return res.json({ status: 'idle', reason: 'provider-key-not-set' });
    const plan = budget(process.env);
    try {
      const result = await runJob({ key, maxCalls: plan.maxCalls, reserve: plan.reserve });
      const { configured, ...counts } = result;
      return res.json({ status: 'ok', ...counts });
    } catch {
      // never echo the error text: it could carry a request URL
      return res.status(500).json({ status: 'failed' });
    }
  });
  return router;
}
