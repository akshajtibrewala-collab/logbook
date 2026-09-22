# Reconciling the production Turso schema

**Status: unresolved.** Do not run `npm run migrate` (directly, via `db:setup`, or via a Vercel build)
against production Turso until this is done. `migrate()` will now refuse on its own if it finds this —
see "The safety net" below — but the underlying schema mismatch still needs a real fix.

## What happened

On 2026-09-22, checking Vercel's env var scoping turned up that `TURSO_DATABASE_URL` and
`TURSO_AUTH_TOKEN` were set for the **Preview** environment as well as Production. A branch called
`claude/festive-volta-nn03om` had preview builds running against the same Turso database production
uses (there is only one). That branch appears to have shipped its own milestones/expirations design
straight to that database, outside of, and before, the numbered-migration system (`server/src/migrations/`)
that now exists on `main`.

A read-only report against Turso (`SELECT` only — nothing was run) found:

```
aircraft, airports, certificate_requirements, certificates, custom_expirations,
flight_approaches, flight_reviews, flight_stops, flights, pilot_profile,
requirement_completions, sqlite_sequence
```

**No `_migrations` table exists at all.** None of `001_init.js` through `007_expirations.js` have ever
run against this database — the tables above were created some other way.

### Table-by-table

| Turso has | Current code expects | Status |
| --- | --- | --- |
| `flights`, `aircraft`, `flight_stops`, `flight_reviews`, `airports` | same | matches |
| `certificates`, `certificate_requirements`, `requirement_completions` (6 / 39 / 0 rows) | `milestones_config` | **different design, different name** |
| `custom_expirations` (0 rows) | `expirations` | **different design, different name** |
| `flight_approaches` (0 rows) | — (no counterpart) | orphaned, no current code reads it |
| `pilot_profile` (1 row) | — (no counterpart) | orphaned, no current code reads it — **has 1 row, don't drop it before checking** |

### Flight data itself looks intact

20 flights, 29.9 total hours, 134 day landings, 0 night landings, dates 2026-07-28 to 2026-09-12,
8 aircraft, 1 flight review — matches the local `logbook.db` copy exactly. This incident is about the
milestones/expirations schema, not the core logbook data.

## The safety net

`migrate()` (`server/src/migrate.js`) now checks, before doing anything else: if a database has no
`_migrations` table, every existing table must be one that `001_init.js`'s baseline (`flights`,
`flight_reviews`, `airports`) creates. If it finds any other table, it throws instead of migrating —
so a production deploy (or anyone running `npm run migrate` locally against Turso) cannot silently
layer new migrations onto a database whose schema history isn't tracked. See
`server/src/migrate.reconcile.test.js`.

This makes the situation loud instead of silent. It does not fix the schema mismatch.

## Reconciliation plan (not yet done)

1. **Decide what to do with `pilot_profile`'s one row and anything in `flight_stops`/`custom_expirations`
   worth keeping.** Pull them out with a read-only `SELECT` (same pattern as the report above) and look
   at the actual values before touching anything.
2. **Write a new numbered migration** (the next one after `007_expirations.js`) that, against Turso
   specifically:
   - Creates `_migrations` and backfills it with `001_init.js` through `007_expirations.js` as applied
     (their target tables already exist and match, except for milestones/expirations — see next steps),
     so future `migrate()` runs treat this database as caught up rather than re-running everything.
   - Creates `milestones_config` and `expirations` (idempotent `CREATE TABLE IF NOT EXISTS`, same as
     005/007 already do).
   - If anything from step 1 is worth keeping, copies it into the new tables' shape.
   - Leaves `certificates`, `certificate_requirements`, `requirement_completions`, `custom_expirations`,
     `flight_approaches` in place rather than dropping them — they're unused by current code but dropping
     data should be its own deliberate, reviewed step, not folded into a schema-reconciliation migration.
3. **Run the new migration against a copy of the Turso data first** (export via `db:backup`, restore to
   a scratch/dev Turso database or a local file), not against production directly.
4. Once verified, run it against production Turso deliberately (not via an automatic Preview/Production
   build) and confirm with a read-only report afterward.
5. Only after that, decide separately whether the orphaned tables (`certificates`,
   `certificate_requirements`, `requirement_completions`, `custom_expirations`, `flight_approaches`) are
   safe to drop.
