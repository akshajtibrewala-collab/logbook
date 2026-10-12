/**
 * Provenance for automatically filled aircraft registrations (see CLAUDE.md, "Automatic registration").
 *
 * flights.reg_source        NULL = typed by the pilot (or never filled); a provider name = filled by the daily job.
 * flights.reg_filled_at     ISO UTC time of the fill.
 * flights.reg_cleared_at    set when the pilot removes a registration; non-null means the job never refills it.
 * flights.reg_checked_at    last provider lookup (so quiet rows are not re-queried every day).
 * flights.reg_check_count   lookups so far (the job gives up after a few).
 * aircraft.auto_created_at  set only on an aircraft row the job created, so clearing a wrong match can remove
 *                           that now-empty row and nothing the pilot made.
 *
 * Additive only: every column is nullable, nothing is backfilled, dropped or renamed, and every existing row
 * gets NULL, so no existing behaviour changes. Each ADD COLUMN is guarded so a retry after a partial failure
 * is safe.
 */
export default async function up({ all, run }) {
  const has = async (table, name) => (await all(`SELECT name FROM pragma_table_info('${table}')`)).some((c) => c.name === name);

  if (!(await has('flights', 'reg_source'))) {
    await run("ALTER TABLE flights ADD COLUMN reg_source TEXT CHECK (reg_source IS NULL OR reg_source IN ('aerodatabox'))");
  }
  for (const col of ['reg_filled_at', 'reg_cleared_at', 'reg_checked_at']) {
    if (!(await has('flights', col))) await run(`ALTER TABLE flights ADD COLUMN ${col} TEXT`);
  }
  if (!(await has('flights', 'reg_check_count'))) await run('ALTER TABLE flights ADD COLUMN reg_check_count INTEGER');
  if (!(await has('aircraft', 'auto_created_at'))) await run('ALTER TABLE aircraft ADD COLUMN auto_created_at TEXT');
}
