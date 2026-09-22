/**
 * Reconciles the `aircraft` table's column names on any database where it was created outside this
 * migrations system with different names for two columns (found on production Turso: `icao_type` where
 * current code expects `type_designator`, and `type_designation` where it expects
 * `type_rating_designation`), and adds `archived_at` for a database that predates archiving aircraft
 * instead of deleting them. See docs/TURSO_RECONCILE.md for the incident this fixes.
 *
 * A no-op everywhere else: 002_aircraft.js already creates `aircraft` with the current names and
 * `archived_at`, so a normal database has nothing for this migration to do.
 */
export default async function up({ all, run }) {
  const cols = (await all("SELECT name FROM pragma_table_info('aircraft')")).map((c) => c.name);

  if (cols.includes('icao_type') && !cols.includes('type_designator')) {
    await run('ALTER TABLE aircraft RENAME COLUMN icao_type TO type_designator');
  }
  if (cols.includes('type_designation') && !cols.includes('type_rating_designation')) {
    await run('ALTER TABLE aircraft RENAME COLUMN type_designation TO type_rating_designation');
  }
  if (!cols.includes('archived_at')) {
    await run('ALTER TABLE aircraft ADD COLUMN archived_at TEXT');
  }
}
