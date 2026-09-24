/**
 * Scopes every rate table to a training phase (by certificate) instead of one flat, global rate history,
 * and gives each training phase its own "track costs" toggle. A flight or ground session's cost is now
 * computed from whichever phase's own rates cover its date — never a global "current rate" — so ending a
 * phase (setting its end_date once a checkride is done) naturally freezes that phase's totals: a later
 * rate change belongs to a *different* phase's rate rows and can never reach back into an ended phase's
 * flights. `certificate TEXT NOT NULL DEFAULT 'private'` backfills every existing rate row to the Private
 * phase in the same statement that adds the column, since every rate this app has seeded or imported so
 * far belongs to it.
 *
 * Also ensures the Private training phase itself exists (start_date 2026-07-10, matching the cost
 * tracker's seeded/imported starting rates, no end_date, track_costs on) — training_phases previously had
 * no seed data of its own; a pilot who's never opened the cost settings screen would otherwise have zero
 * phases, and every flight/ground session would silently show no cost at all once phase-gating lands.
 */
export default async function up({ all, get, run }) {
  for (const table of ['aircraft_rates', 'instructor_rates', 'ground_rates', 'simulator_rates']) {
    const cols = await all(`SELECT name FROM pragma_table_info('${table}')`);
    if (!cols.some((c) => c.name === 'certificate')) {
      await run(`ALTER TABLE ${table} ADD COLUMN certificate TEXT NOT NULL DEFAULT 'private'`);
    }
  }

  const phaseCols = await all("SELECT name FROM pragma_table_info('training_phases')");
  if (!phaseCols.some((c) => c.name === 'track_costs')) {
    await run('ALTER TABLE training_phases ADD COLUMN track_costs INTEGER NOT NULL DEFAULT 1');
  }

  const privatePhase = await get("SELECT id FROM training_phases WHERE certificate = 'private'");
  if (!privatePhase) {
    await run("INSERT INTO training_phases (certificate, start_date, end_date, track_costs) VALUES ('private', '2026-07-10', NULL, 1)");
  }
}
