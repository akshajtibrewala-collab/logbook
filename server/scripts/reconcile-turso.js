// One-time reconciliation for the incident documented in docs/TURSO_RECONCILE.md: production Turso has
// tables (aircraft, flight_stops, flight_approaches, ...) that another branch's preview builds created
// outside this migrations system, so it has no `_migrations` table — and migrate() now correctly refuses
// to run against any database in that state (see server/src/migrate.js), rather than silently layering
// new migrations onto an untracked schema.
//
// This script runs the REAL migration files (001 through the latest) in order, via their own up()
// functions — the same code `migrate()` would run, not a reimplementation — and only afterwards creates
// `_migrations` and records them as applied. It does this deliberately, once, only after first confirming
// (read-only) that the database is in exactly the shape docs/TURSO_RECONCILE.md describes, so it can't
// run against some other/unexpected database by mistake. Every migration file involved is already
// idempotent and guards its own changes (see 001_init.js, 003_flight_stops.js, 008_flight_details.js,
// 009_aircraft_column_reconcile.js), which is what makes this safe: each one is a no-op wherever its
// target schema already matches, and a real, additive change wherever it doesn't.
//
// Leaves the orphaned tables (certificates, certificate_requirements, requirement_completions,
// custom_expirations, pilot_profile) in place — dropping them is a separate, later, deliberate decision.
//
// Run against Turso only:  npm run db:reconcile   (loads ../.env, same convention as db:backup)
// BACK UP FIRST: npm run db:backup. This makes real schema changes; the backup script does not.
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { all, get, run, client, isRemote } from '../src/db.js';

if (!isRemote) {
  console.error('This only makes sense against Turso (TURSO_DATABASE_URL not set) — refusing.');
  process.exit(1);
}

const existingTables = (await all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")).map((r) => r.name);

if (existingTables.includes('_migrations')) {
  console.log('_migrations already exists — this database looks already reconciled (or never had the problem). Nothing to do.');
  process.exit(0);
}

// The exact shape docs/TURSO_RECONCILE.md describes, confirmed by a read-only check on 2026-09-22.
// If this doesn't match, the database isn't in the state this script's plan was written for — stop
// rather than guess.
const expectedTables = new Set([
  'aircraft', 'airports', 'certificate_requirements', 'certificates', 'custom_expirations',
  'flight_approaches', 'flight_reviews', 'flight_stops', 'flights', 'pilot_profile', 'requirement_completions',
]);
const unexpected = existingTables.filter((t) => !expectedTables.has(t));
if (unexpected.length) {
  console.error(`Unexpected table(s), this isn't the state docs/TURSO_RECONCILE.md describes: ${unexpected.join(', ')}. Refusing.`);
  process.exit(1);
}
const missing = [...expectedTables].filter((t) => !existingTables.includes(t));
if (missing.length) {
  console.error(`Missing expected table(s): ${missing.join(', ')}. Refusing.`);
  process.exit(1);
}

const flightCols = (await all("SELECT name FROM pragma_table_info('flights')")).map((c) => c.name);
for (const col of ['flight_number', 'dual_given', 'simulator_time', 'debrief_went_well', 'debrief_work_on', 'day_landings_full_stop', 'night_landings_full_stop']) {
  if (!flightCols.includes(col)) {
    console.error(`flights is missing ${col} — not the expected state (008_flight_details.js's columns should already be there). Refusing.`);
    process.exit(1);
  }
}

console.log(`Shape confirmed (${existingTables.length} tables, flights already has the 008 columns). Reconciling...`);

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'migrations');
const files = readdirSync(migrationsDir).filter((f) => /^\d+_.+\.js$/.test(f) && !f.endsWith('.test.js')).sort();

await client.executeMultiple(
  "CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, applied_at TEXT NOT NULL DEFAULT (datetime('now')));",
);

for (const file of files) {
  const mod = await import(pathToFileURL(path.join(migrationsDir, file)).href);
  console.log(` - running ${file}...`);
  await mod.default({ all, get, run, client });
  await run('INSERT INTO _migrations (name) VALUES (?)', [file]);
}

console.log(`Done. Applied and recorded ${files.length} migrations. Run the migration report next to verify.`);
