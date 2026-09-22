# Migrations

Every schema change ships as a new numbered file here. `server/src/migrate.js` runs whichever of these
haven't been applied yet (tracked in the `_migrations` table), in numeric order, and never runs an
already-applied one again.

**Rules:**
- Never edit a migration that has already shipped (and especially one that has already run against the
  real database) — add a new one instead. This is what keeps existing data safe: once a migration is out,
  it's a historical fact, not a draft.
- Only add columns/tables, or backfill data. Don't rename or drop an existing column — if a column is
  superseded by something better, leave it in place (documented as deprecated) rather than removing it.
  Storage is cheap; a silent data loss from a bad migration is not recoverable.
- Prefer writing bodies so a retry after a partial failure doesn't error (`CREATE TABLE IF NOT EXISTS`,
  checking `pragma_table_info` before an `ALTER TABLE ADD COLUMN`) — a migration is only marked applied
  after it completes without throwing, so a failed one is retried on the next `migrate()` run.

**File naming:** `NNN_short_description.sql` or `.js`, zero-padded to 3 digits (`002_aircraft.sql`).

**`.sql` files** are run verbatim — use these for plain DDL (`CREATE TABLE`, `ALTER TABLE ... ADD COLUMN`).

**`.js` files** default-export `async ({ all, get, run, client }) => { ... }` (the same helpers as
`server/src/db.js`) — use these when a migration needs conditional logic or has to backfill data by
reading and transforming existing rows (e.g. turning free-text `aircraft_type`/`tail_number` on existing
flights into real `aircraft` rows).
