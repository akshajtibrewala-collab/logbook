import { Router } from 'express';
import { all, get, run } from '../db.js';
import { buildBackup } from './backup.js';
import {
  cronAuthorized, packBackup, runsToPrune, backupStatus, emailContent, sendViaResend,
} from '../lib/backup-job.js';

const DEFAULT_FROM = 'AeroTrail Backup <onboarding@resend.dev>';

/**
 * Builds the full backup, emails it (gzipped if large), records the run, and prunes old run records.
 * Never throws: a failure is recorded as a failed run (so the app can warn) and returned.
 */
export async function runBackup(trigger, { send = sendViaResend, now = new Date() } = {}) {
  let record = { status: 'failed', size_bytes: null, gzipped: 0, error: null };
  try {
    const { RESEND_API_KEY: apiKey, BACKUP_EMAIL_TO: to, BACKUP_EMAIL_FROM: from } = process.env;
    if (!apiKey || !to) throw new Error('Email is not configured (RESEND_API_KEY / BACKUP_EMAIL_TO).');
    const backup = await buildBackup();
    const pack = packBackup(backup, now);
    const { subject, text } = emailContent(pack, backup, trigger, now);
    await send({ apiKey, from: from || DEFAULT_FROM, to, subject, text, filename: pack.filename, content: pack.content });
    record = { status: 'ok', size_bytes: pack.sentBytes, gzipped: pack.gzipped ? 1 : 0, error: null, rawBytes: pack.rawBytes };
  } catch (err) {
    record.error = String(err.message || err).slice(0, 300);
  }
  await run(
    'INSERT INTO backup_runs (ran_at, status, trigger, size_bytes, gzipped, error) VALUES (?, ?, ?, ?, ?, ?)',
    [now.toISOString(), record.status, trigger, record.size_bytes, record.gzipped, record.error],
  );
  const runs = await all('SELECT id, ran_at FROM backup_runs');
  for (const id of runsToPrune(runs)) await run('DELETE FROM backup_runs WHERE id = ?', [id]);
  return record;
}

/** GET /api/cron/backup — only the scheduled job (Authorization: Bearer CRON_SECRET) may call this. */
export const cronRouter = Router();
cronRouter.get('/backup', async (req, res) => {
  if (!cronAuthorized(req.get('authorization'), process.env.CRON_SECRET)) return res.status(401).json({ error: 'Unauthorized' });
  const result = await runBackup('cron');
  res.status(result.status === 'ok' ? 200 : 500).json({ status: result.status, error: result.error });
});

/** Behind the normal app passcode: the status card and the "Run backup now" button. */
export const backupJobRouter = Router();
backupJobRouter.get('/status', async (_req, res) => {
  const last = (await get('SELECT * FROM backup_runs ORDER BY ran_at DESC, id DESC LIMIT 1')) ?? null;
  res.json({ last, ...backupStatus(last) });
});
backupJobRouter.post('/run', async (_req, res) => {
  const result = await runBackup('manual');
  const last = await get('SELECT * FROM backup_runs ORDER BY ran_at DESC, id DESC LIMIT 1');
  res.status(result.status === 'ok' ? 200 : 502).json({ last, ...backupStatus(last) });
});
