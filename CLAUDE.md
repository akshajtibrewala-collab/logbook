# AeroTrail

A personal pilot flight logbook and career-tracking app: flights (with structured stops and typed
approaches), aircraft, currency/expirations, milestone progress toward certificates, a map and stats.
Phase 1 is complete — see `docs/ROADMAP.md` for what's next.

## Stack

- `client/` — React + Vite + Tailwind, react-router-dom, lucide-react icons. Dark by default, `.light`
  class for light mode.
- `server/` — Express + `@libsql/client`. SQLite file locally (`server/logbook.db`), Turso (hosted
  libSQL) when `TURSO_DATABASE_URL` is set — **never set locally**, only in Vercel/`.env`.
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
npm test         # server tests, then client tests
```

Local dev **never touches Turso** — `.env` (repo root) is only read by `db:*`/`migrate` npm scripts, not
by `npm run dev`. To poke at a real data copy without risk, copy `server/logbook.db` to a scratch file
and set `DB_FILE=<path>` when starting the server.

## Backing up data

- In the app: Logbook → the swap icon → **Export everything** — a full JSON dump (every table, format-
  versioned) via `GET /api/backup/export`, restorable via `POST /api/backup/restore`.
- From the command line: `npm run db:backup` dumps whatever database you're currently pointed at (local
  file by default) to a timestamped JSON file under `server/backups/`. **Always run this before any
  migration or schema change touches Turso** — see `docs/DEPLOY.md` for pointing it at Turso.

## Branch and deploy safety

- **Never work directly on `main`.** Create a feature branch, do the work there, merge to `main` only
  when told to. Merging to `main` and pushing **triggers the Vercel production deploy** — treat that
  push as the deploy step itself, not a routine git action.
- Vercel builds (`npm run build:vercel`) run the schema migration on **every** build, preview or
  production — and Preview can hit the same real Turso database as Production if
  `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` are scoped to Preview in Vercel project settings. `TURSO_*`
  should stay **Production-only**; check that scoping before assuming a preview build is safe, and never
  change it yourself without being asked.
- Before merging a branch that adds new migrations: back up production Turso (`npm run db:backup`),
  verify the backup file, and say so explicitly — don't just merge silently.
- `migrate()` refuses to run against any database that has no `_migrations` table and tables it doesn't
  recognize — the safety net for the incident recorded in `docs/TURSO_RECONCILE.md`. Production Turso
  was reconciled (migrations 001–009 applied, verified before/after) and is current as of this writing.
- Only commit when asked. Run the full test suite once before each commit; otherwise run just the tests
  for what changed.

## Status

Phase 1 is complete. See `docs/ROADMAP.md` for what was delivered, known follow-ups, and Phase 2 ideas.
