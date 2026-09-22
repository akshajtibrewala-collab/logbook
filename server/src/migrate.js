import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { all, client, get, run } from './db.js';

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

/**
 * Brings the database up to date by running any migrations in ./migrations that haven't been applied
 * yet, in numeric order, recording each one in `_migrations` as it completes. Safe to run any number of
 * times — already-applied migrations are skipped. Run at build/deploy time (npm run migrate) and on
 * local server startup; the hosted API itself never migrates. See migrations/README.md for the rules
 * migration files follow.
 */
export async function migrate() {
  await client.executeMultiple(
    "CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, applied_at TEXT NOT NULL DEFAULT (datetime('now')));",
  );
  const applied = new Set((await all('SELECT name FROM _migrations')).map((r) => r.name));
  // Excludes *.test.js — migration tests live alongside their migrations, in the same directory.
  const files = readdirSync(migrationsDir).filter((f) => /^\d+_.+\.(sql|js)$/.test(f) && !f.endsWith('.test.js')).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const full = path.join(migrationsDir, file);
    if (file.endsWith('.sql')) {
      await client.executeMultiple(readFileSync(full, 'utf8'));
    } else {
      const mod = await import(pathToFileURL(full).href);
      await mod.default({ all, get, run, client });
    }
    await run('INSERT INTO _migrations (name) VALUES (?)', [file]);
  }
}

/** Names of every migration that has been applied to this database, oldest first — mainly for tests. */
export async function appliedMigrations() {
  return (await all('SELECT name FROM _migrations ORDER BY id')).map((r) => r.name);
}
