# AeroTrail

A personal pilot logbook and career-tracking app: log flights with structured stops and typed
approaches, track aircraft and their complex/high-performance/tailwheel/turbine/TAA attributes, see
currency (day/night passenger, instrument, flight review) and expirations (medical, anything else with a
date) at a glance, and watch progress toward certificate requirements — all computed from the raw flight
data you log, never stored as totals that can drift out of sync.

Built as a phone-first web app (works great added to your home screen), with a full JSON backup/restore
and CSV import/export so your logbook is never locked into one tool.

## Features

- **Logbook**: flights with structured stops (full stop vs. touch-and-go), typed approach breakdowns,
  dual given/received, simulator time, flight number, and a two-field debrief (what went well / what to
  work on).
- **Aircraft**: a real aircraft list, linked to flights, with the flags (complex, high-performance,
  tailwheel, turbine, TAA, type rating, simulator) that feed the milestone calculations.
- **Dashboard**: a rotating aviation-themed greeting, and a data-driven subline that surfaces whatever
  matters most right now — an expiring medical, a logging gap, your last flight's debrief note, or
  milestone progress.
- **Currency & expirations**: passenger (day/night), instrument, and flight review currency; a medical
  certificate and any other custom expiration (passport, insurance, ...) you want reminders for.
- **Milestones**: progress toward Private/Instrument/Commercial (and easy to extend) requirements,
  computed from your actual logged flights against config-driven requirement definitions — not
  hardcoded, and not a certified restatement of 14 CFR Part 61.
- **Map & Stats**: every airport you've visited and every route you've flown, plus hours broken down by
  category and aircraft.
- **Backup**: a one-click full JSON export/restore (every table, with a format version so future
  versions can always read an old backup) for a real lifetime backup, plus CSV export/import compatible
  with ForeFlight and LogTen exports.

## Stack

React + Vite + Tailwind (client), Express + `@libsql/client` (server) — SQLite locally, hosted
[Turso](https://turso.tech) in production. See [CLAUDE.md](CLAUDE.md) for the folder layout and
conventions.

## Running it locally

```bash
npm install
npm run dev
```

Server on `:3001`, client on `:5173` (proxies `/api` to the server). This **never touches Turso** —
local dev always uses the SQLite file at `server/logbook.db`, created automatically on first run.

```bash
npm test
```

Runs the server test suite, then the client's. Both use `node:test` against an in-memory SQLite
database — no setup needed.

## Backing up your data

- **In the app**: Logbook → the swap icon → **Export everything**, under Import & export. Downloads one
  JSON file with every flight, stop, approach, aircraft, flight review and expiration.
- **From the command line**: `npm run db:backup` always dumps your local file to a timestamped JSON file
  under `server/backups/` — it never loads any `.env` file, so it can't touch Turso by accident. To back
  up production, use `npm run db:backup:prod` (loads `.env.production`, prints a warning naming the
  database first). See [DEPLOY.md](docs/DEPLOY.md) for setting up `.env.production`.
- **CSV**: also in Import & export, for opening your logbook in a spreadsheet, or for insurance/job
  applications. See [docs/CSV.md](docs/CSV.md) for exactly which columns are covered.

## Deploying

See [docs/DEPLOY.md](docs/DEPLOY.md) for the full Vercel + Turso walkthrough (free tier). Short version,
once it's set up once: `git push` to `main` builds and deploys automatically.

## Docs

- [CLAUDE.md](CLAUDE.md) — stack, folder structure, branch/deploy safety rules, current status.
- [docs/DEPLOY.md](docs/DEPLOY.md) — hosting on Vercel + Turso.
- [docs/CSV.md](docs/CSV.md) — every CSV column, and what ForeFlight/LogTen imports map to.
- [docs/ROADMAP.md](docs/ROADMAP.md) — what Phase 1 delivered, known follow-ups, Phase 2 ideas.
- [docs/TURSO_RECONCILE.md](docs/TURSO_RECONCILE.md) — a past incident's record; only relevant if you're
  touching the production database's schema directly.
