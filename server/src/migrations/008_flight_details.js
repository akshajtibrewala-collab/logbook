/**
 * Adds the flight-detail fields from the original Phase 1 plan that hadn't been built yet: flight number
 * (paired with the existing `airline`), dual given and simulator time, full-stop landing counts (the
 * existing day_landings/night_landings stay as totals), debrief notes, and a typed-approach breakdown
 * table alongside the existing `approaches` total.
 *
 * Column and table names here (flight_number, dual_given, simulator_time, debrief_went_well,
 * debrief_work_on, day_landings_full_stop, night_landings_full_stop, flight_approaches with
 * flight_id/approach_type/count) match what a read-only check found already on production Turso from an
 * earlier, untracked branch (see docs/TURSO_RECONCILE.md) — chosen deliberately so reconciling that
 * database later is a data problem, not also a naming problem.
 */
export default async function up({ all, run, client }) {
  const flightCols = await all("SELECT name FROM pragma_table_info('flights')");
  const has = (name) => flightCols.some((c) => c.name === name);

  if (!has('flight_number')) await run('ALTER TABLE flights ADD COLUMN flight_number TEXT');
  if (!has('dual_given')) await run('ALTER TABLE flights ADD COLUMN dual_given REAL NOT NULL DEFAULT 0');
  if (!has('simulator_time')) await run('ALTER TABLE flights ADD COLUMN simulator_time REAL NOT NULL DEFAULT 0');
  if (!has('debrief_went_well')) await run('ALTER TABLE flights ADD COLUMN debrief_went_well TEXT');
  if (!has('debrief_work_on')) await run('ALTER TABLE flights ADD COLUMN debrief_work_on TEXT');
  if (!has('day_landings_full_stop')) await run('ALTER TABLE flights ADD COLUMN day_landings_full_stop INTEGER NOT NULL DEFAULT 0');
  if (!has('night_landings_full_stop')) await run('ALTER TABLE flights ADD COLUMN night_landings_full_stop INTEGER NOT NULL DEFAULT 0');

  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS flight_approaches (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      flight_id     INTEGER NOT NULL REFERENCES flights(id),
      approach_type TEXT NOT NULL,
      count         INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_flight_approaches_flight ON flight_approaches(flight_id);
  `);
}
