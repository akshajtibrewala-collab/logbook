# AeroTrail

A personal pilot flight logbook and career-tracking app: flights (with structured stops and typed
approaches), aircraft, currency/expirations, milestone progress toward certificates, a map and stats,
manual milestone completions, a weather go/no-go checker against personal minimums, and a training cost
tracker (per-phase rates, ground-only sessions, expenses, projections), plus fast logging (Quick log, copy last
flight, offline retry), photos/notes, stats charts, an animated map, and a read-only share link/print view.
Everything through migration 021 is merged and live — see `docs/ROADMAP.md` for details and what's next.

## Stack

- `client/` — React + Vite + Tailwind, react-router-dom, lucide-react icons. Dark by default, `.light`
  class for light mode.
- `server/` — Express + `@libsql/client`. SQLite file locally (`server/logbook.db`), Turso (hosted
  libSQL) when `TURSO_DATABASE_URL` is set — in Vercel, or in `.env.production` for the `:prod` npm
  scripts (see "Running and testing locally" below). **Never** in the plain root `.env`/`.env.local`.
- `api/` — the Vercel serverless function wrapping the Express app for production.
- Root `package.json` orchestrates both workspaces (`npm run dev`, `npm test`).
- Tests: `node:test` + `node:assert/strict` only. No DOM testing — JSX components aren't unit tested,
  only pure `lib/` functions (`client/src/lib/*.js`, `server/src/validate.js`, migrations).

## Folder structure

- `client/src/pages/` — one file per route. `client/src/components/` — shared UI (Button, Card, Badge,
  Modal, DatePicker, etc.). `client/src/lib/` — pure logic: currency, milestones, CSV, greeting, hours.
- `server/src/routes/` — one router per resource. `server/src/migrations/NNN_name.js` — versioned,
  numbered, never edited after merge; each ships its own `.test.js`.
- `docs/` — `DEPLOY.md` (Vercel + Turso setup), `CSV.md` (every CSV column), `ROADMAP.md` (what's done,
  known follow-ups, Phase 2 ideas), `TURSO_RECONCILE.md` (a past incident's record).

## Running and testing locally

```bash
npm run dev     # both workspaces; server on :3001, client on :5173 (proxies /api)
npm test         # server tests, then client tests (currently 156 server + 196 client, all passing)
```

There is no DOM/component testing: put logic in pure `client/src/lib/*.js` functions and test those. UI changes
are checked by hand or with a real headed browser (Playwright), never assumed.

Local dev **never touches Turso** — `npm run dev` loads no `.env` file at all. Every plain `db:*`/
`migrate`/`seed*` npm script (`npm run migrate -w server`, `npm run db:backup`, ...) also never loads any
`.env` file, so it always runs against the local SQLite file, on purpose — production can't be touched by
accident. To poke at a real data copy without risk, copy `server/logbook.db` to a scratch file and set
`DB_FILE=<path>` when starting the server.

Each of those has a **`:prod` counterpart** (`migrate:prod`, `seed:prod`, `seed:runways:prod`,
`db:backup:prod`, `db:reconcile:prod`, `db:copy-local:prod`, all run with `-w server`) that loads
`.env.production` (repo root, gitignored, copy from `.env.production.example`) and prints a `⚠ PRODUCTION
TURSO ⚠` warning naming the database URL before doing anything. These are the only commands that can ever
reach Turso from your machine — never run one without meaning to. Each `:prod` script
(`server/scripts/prod/*.js`) spawns its target script as a real child process
(`server/scripts/lib/run-target.js`) rather than `import`ing it — `seed-airports.js`/`seed-runways.js`
guard their own side effects on `process.argv[1]` being their own path, which only holds true for a real
subprocess; an earlier version of these wrappers used `import` and silently did nothing.

## Backing up data

- In the app: Logbook → the swap icon → **Export everything** — a full JSON dump (every table, format-
  versioned) via `GET /api/backup/export`, restorable via `POST /api/backup/restore`.
- From the command line: `npm run db:backup` dumps the local file to a timestamped JSON file under
  `server/backups/`. **Always run `npm run db:backup:prod` before any migration or schema change touches
  Turso** — see `docs/DEPLOY.md`.

- **Automatic weekly backup (production):** a Vercel Cron Job (`vercel.json`, Mondays 12:00 UTC) calls
  `/api/cron/backup`, which emails the same JSON as "Export everything" (never airports/runways; gzipped
  only at 1 MB+) via Resend to `BACKUP_EMAIL_TO`. That route is guarded by `CRON_SECRET` (`Bearer`, fails
  closed if unset), not the app passcode. Runs are logged in `backup_runs` (last 12 kept); Import & export
  shows the status and a **Run backup now** button, and the Dashboard warns if the last run failed or is
  over 8 days old. Production-only env vars: `RESEND_API_KEY`, `BACKUP_EMAIL_TO`, `CRON_SECRET`
  (optional `BACKUP_EMAIL_FROM`; default sender is `onboarding@resend.dev`, which only delivers to the
  Resend account owner's address).

## Branch and deploy safety

- **Never work directly on `main`.** Create a feature branch, do the work there, merge to `main` only
  when told to. Merging to `main` and pushing **triggers the Vercel production deploy** — treat that
  push as the deploy step itself, not a routine git action.
- Vercel builds (`npm run build:vercel`) run the schema migration on **every** build, preview or
  production — and Preview can hit the same real Turso database as Production if
  `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` are scoped to Preview in Vercel project settings. `TURSO_*`
  should stay **Production-only**; check that scoping before assuming a preview build is safe, and never
  change it yourself without being asked.
- Migrations run on **every** Vercel build (previews too). The latest is **021**. Before merging a branch that
  adds one: back up production Turso (`npm run db:backup:prod -w server`), verify the backup file, and say so
  explicitly — don't just merge silently. Don't push a migration branch unless the Turso env vars are confirmed
  Production-only, since a preview build would run it against the real database.
- `migrate()` refuses to run against any database that has no `_migrations` table and tables it doesn't
  recognize — the safety net for the incident recorded in `docs/TURSO_RECONCILE.md`. Production Turso
  was reconciled and is current as of this writing: migrations 001–021 applied and verified (flights,
  hours, landings, and aircraft counts checked unchanged before/after each deploy), runways seeded
  (39,566 rows). Production's Phase 2b cost data (20 invoiced flights, 6 ground sessions, expenses) was
  applied once with a separate, idempotent, atomic import (keyed on `invoice_ref`); that data is personal and
  lives only in the databases, never in the repo.
- Only commit when asked. Run the full test suite once before each commit; otherwise run just the tests
  for what changed.

## Conventions worth knowing

- **Dates display as MM/DD/YYYY** everywhere, via the one string-based `formatDate` in
  `client/src/lib/calendar.js` (never a `Date` conversion that could shift a day). Storage, the JSON backup
  and CSV exports stay `YYYY-MM-DD`.
- **Costs are per training phase.** A flight/ground session only gets a calculated cost inside a phase with
  cost tracking on, using that phase's own rates (`client/src/lib/cost.js`); outside one, cost is `null`
  ("Not tracked"), never $0. Ending a phase freezes its totals. A manual cost override applies anywhere.
- Hours always display with two decimals (`fmtHours`).

## Status

All merged to `main` and deployed. Phases 1, 2, 2b and 3 are complete; details in `docs/ROADMAP.md`.

**Recent features**
- **Logging:** Quick log (`/logbook/quick`), copy last flight, airport autocomplete with remembered airports, draft
  autosave, and an offline retry queue (`lib/outbox.js`) so a failed save never loses an entry.
- **Stats:** hours by month / aircraft type or tail / category, and a cumulative-hours line toward a goal you set.
- **Map:** one theme-aware route colour (the by-year/aircraft colour modes were removed); routes draw in then flow
  along the flight direction, with an "Animate routes" toggle (remembered; off by default under reduced motion)
  and a replay button; a compact "airports · states" chip that expands to fuller stats; pin popups with visits,
  hours, last visit, note and photo; tile-caching service worker (`public/sw.js`, tiles only).
- **Photos and notes:** up to 8 photos per flight, resized in the browser (EXIF rotation applied), stored in the
  database (`flight_photos`) at their natural orientation; the note is the flight's existing remarks field.
- **Sharing:** a revocable read-only public link (`/share/:token`, unguessable token, notes/photos off by default,
  never costs or debriefs) and a printable/PDF summary (`/logbook/print`). Dark by default, follows the device
  setting until the toggle is used.

**Behaviours to preserve**
- **Weather planning:** each leg stores a UTC instant (`lib/planlegs.js`); the airport's time zone only reads and
  displays it. Changing an airport keeps the same moment and clears stale results; a missing zone falls back to UTC
  with a message.
- **Cost cutoff:** the optional "Commercial certificate date" setting (`pilot_settings.cost_cutoff_date`) excludes
  flights and ground sessions on or after that calendar day from every cost total, average, chart and projection.
  Stored cost data is untouched; other expenses still count. It travels on `rates.cost_cutoff_date` from
  `fetchAllRates`.
- **Settings:** the settings endpoint replaces the whole row, so pages save via `saveSettingsMerged` (merged into
  the current settings) — never send a partial form, or one page blanks another's fields.

**Manual steps after deploys that need them:** `npm run seed:prod -w server` (back up first) fills airport regions
for the states counter; the public link is turned on from Logbook → share icon.

**Known gaps:** the public share page shows square photo thumbnails (it only receives photo ids, not sizes); the
logbook list shows only a camera icon, not photo thumbnails; photos and the share link are left out of the JSON and
weekly backups (size, and so a restore can't revive a revoked link); older photos saved without a size are measured
on load. Also open: no on-screen-keyboard-covers-Save handling and no broader hover/focus audit; study mode and the
document vault (with auth hardening) are next.
