/**
 * Log of automatic/manual backup runs (date, status, size, error), so the app can show "last automatic
 * backup" and warn when one failed or is overdue. Operational bookkeeping only: it is deliberately not
 * part of the JSON backup itself. Pruned to the most recent 12 runs by the backup job.
 */
export default async function up({ client }) {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS backup_runs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      ran_at     TEXT NOT NULL,
      status     TEXT NOT NULL CHECK (status IN ('ok', 'failed')),
      trigger    TEXT NOT NULL CHECK (trigger IN ('cron', 'manual')),
      size_bytes INTEGER,
      gzipped    INTEGER NOT NULL DEFAULT 0,
      error      TEXT
    );
  `);
}
