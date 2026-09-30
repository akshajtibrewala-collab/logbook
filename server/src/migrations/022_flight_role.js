/**
 * Flight roles: a flight is logged as 'pilot' (the only role that has ever existed here — the column's
 * own default means every existing row becomes this the instant it's added, with no separate backfill
 * UPDATE needed), 'passenger' (riding, not flying — e.g. a commercial flight taken as a fare-paying
 * passenger), or 'observer' (present but neither flying nor a fare-paying passenger, e.g. a jumpseat or
 * ride-along). Only role='pilot' flights count toward logbook hours, currency and milestone progress;
 * every role counts toward the map, airports/aircraft/routes visited, and distance — see CLAUDE.md's
 * "Flight roles" section.
 *
 * seat_class/confirmation_code are optional, passenger-oriented details (nullable, normally unused for
 * role='pilot'). Both the DEFAULT and the CHECK constraint are added as part of the same ADD COLUMN,
 * which SQLite (and libSQL, which is wire- and DDL-compatible) both support — an existing row satisfies
 * the CHECK immediately because its backfilled value ('pilot') is one of the allowed ones.
 */
export default async function up({ all, run }) {
  const cols = (await all("SELECT name FROM pragma_table_info('flights')")).map((c) => c.name);

  if (!cols.includes('role')) {
    await run("ALTER TABLE flights ADD COLUMN role TEXT NOT NULL DEFAULT 'pilot' CHECK (role IN ('pilot', 'passenger', 'observer'))");
  }
  if (!cols.includes('seat_class')) await run('ALTER TABLE flights ADD COLUMN seat_class TEXT');
  if (!cols.includes('confirmation_code')) await run('ALTER TABLE flights ADD COLUMN confirmation_code TEXT');

  await run('CREATE INDEX IF NOT EXISTS idx_flights_role ON flights(role)');
}
