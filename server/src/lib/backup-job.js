import { createHash, timingSafeEqual } from 'node:crypto';
import { gzipSync } from 'node:zlib';

export const KEEP_RUNS = 12;
export const STALE_DAYS = 8;
export const GZIP_THRESHOLD_BYTES = 1024 * 1024; // a backup this large or larger is gzipped before emailing

const digest = (s) => createHash('sha256').update(String(s)).digest();

/** True only when a secret is configured AND the Authorization header is exactly `Bearer <secret>` — fails closed with no secret. */
export function cronAuthorized(authorizationHeader, secret) {
  if (!secret) return false;
  const given = typeof authorizationHeader === 'string' && authorizationHeader.startsWith('Bearer ') ? authorizationHeader.slice(7) : '';
  return timingSafeEqual(digest(given), digest(secret));
}

export const backupFilename = (now, gzipped) => `aerotrail-backup-${now.toISOString().replace(/[:.]/g, '-')}.json${gzipped ? '.gz' : ''}`;

/** Serializes a backup and gzips it only if it has grown past the threshold. */
export function packBackup(backup, now = new Date()) {
  const json = Buffer.from(JSON.stringify(backup));
  const gzipped = json.length >= GZIP_THRESHOLD_BYTES;
  const content = gzipped ? gzipSync(json) : json;
  return { content, rawBytes: json.length, sentBytes: content.length, gzipped, filename: backupFilename(now, gzipped) };
}

/** Ids of runs to delete so only the newest `keep` remain. */
export function runsToPrune(runs, keep = KEEP_RUNS) {
  return [...runs].sort((a, b) => b.ran_at.localeCompare(a.ran_at) || b.id - a.id).slice(keep).map((r) => r.id);
}

/**
 * What the app shows for the latest run: never run, failed, stale (older than STALE_DAYS), or ok.
 * `lastRun` is the newest backup_runs row (any trigger) or null.
 */
export function backupStatus(lastRun, now = new Date()) {
  if (!lastRun) return { state: 'never', warn: true, message: 'No backup has run yet.' };
  const ageDays = (now.getTime() - new Date(lastRun.ran_at).getTime()) / 86400000;
  if (lastRun.status === 'failed') return { state: 'failed', warn: true, ageDays, message: `The last backup failed: ${lastRun.error || 'unknown error'}` };
  if (ageDays > STALE_DAYS) return { state: 'stale', warn: true, ageDays, message: `The last backup is ${Math.floor(ageDays)} days old.` };
  return { state: 'ok', warn: false, ageDays, message: 'Backups are up to date.' };
}

export function emailContent(pack, backup, trigger, now = new Date()) {
  const counts = Object.entries(backup.tables).map(([t, rows]) => `${t}: ${rows.length}`).join(', ');
  return {
    subject: `AeroTrail backup ${now.toISOString().slice(0, 10)}${trigger === 'manual' ? ' (manual)' : ''}`,
    text: `Full AeroTrail backup attached (${pack.filename}, ${pack.sentBytes} bytes${pack.gzipped ? ', gzipped' : ''}).\n\nRows: ${counts}\n\nRestore it from Logbook > Import & export > Restore${pack.gzipped ? ' (gunzip it first)' : ''}.`,
  };
}

/** Sends through Resend's HTTP API. Throws with the API's message on failure. */
export async function sendViaResend({ apiKey, from, to, subject, text, filename, content }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text, attachments: [{ filename, content: content.toString('base64') }] }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
