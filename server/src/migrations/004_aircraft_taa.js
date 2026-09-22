/**
 * Adds aircraft.is_taa (technically advanced airplane) — for the commercial certificate's complex/
 * turbine/TAA time requirement (14 CFR 61.129), which the milestones config (see migration 005) can
 * satisfy with any one of those three flags rather than requiring is_complex specifically.
 */
export default async function up({ all, run }) {
  const cols = await all("SELECT name FROM pragma_table_info('aircraft')");
  if (!cols.some((c) => c.name === 'is_taa')) {
    await run('ALTER TABLE aircraft ADD COLUMN is_taa INTEGER NOT NULL DEFAULT 0');
  }
}
