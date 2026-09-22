# AeroTrail

A pilot's flight logbook and career-tracking app: flights, aircraft, currency/expirations, milestone
progress toward certificates, a map and stats. React + Vite frontend, Express API, SQLite locally /
Turso (libSQL) in production.

## Stack

- `client/` — React + Vite + Tailwind, react-router-dom, lucide-react icons. Dark by default, `.light`
  class for light mode.
- `server/` — Express + `@libsql/client`. SQLite file locally (`server/logbook.db`), Turso when
  `TURSO_DATABASE_URL` is set (never set locally — see below).
- `api/` — the Vercel serverless function wrapping the Express app for production.
- Root `package.json` orchestrates both workspaces (`npm run dev`, `npm test`).
- Tests: `node:test` + `node:assert/strict` only. No DOM testing — JSX components aren't unit tested,
  only pure `lib/` functions (`client/src/lib/*.js`, `server/src/validate.js`, migrations).

## Folder structure

- `client/src/pages/` — one file per route. `client/src/components/` — shared UI (Button, Card, Badge,
  Modal, DatePicker, etc.). `client/src/lib/` — pure logic: currency, milestones, CSV, greeting, hours.
- `server/src/routes/` — one router per resource. `server/src/migrations/NNN_name.js` — versioned,
  numbered, never edited after merge; each ships its own `.test.js`.
- `docs/` — `DEPLOY.md` (Vercel + Turso setup), `CSV.md`, `TURSO_RECONCILE.md` (an open incident — see
  below).

## Running and testing locally

```bash
npm run dev     # both workspaces; server on :3001, client on :5173 (proxies /api)
npm test         # server tests, then client tests
```

Local dev **never touches Turso** — `server/.env` (repo-root `.env`) is only read by `db:*`/`migrate`
npm scripts, not by `npm run dev`. To poke at a real data copy without risk, copy `server/logbook.db` to
a scratch file and set `DB_FILE=<path>` when starting the server.

## Branch and deploy safety

- Never work directly on `main`. Create/use a feature branch, push that.
- Vercel builds (`npm run build:vercel`) run the schema migration on **every** build, preview or
  production — and Preview can hit the same real Turso database as Production if
  `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` are scoped to Preview in Vercel project settings. Check that
  scoping before assuming a preview build is safe.
- `migrate()` refuses to run against any database that has no `_migrations` table and tables it doesn't
  recognize (see `docs/TURSO_RECONCILE.md` — production Turso is currently in exactly that state from an
  earlier incident and still needs reconciling).
- Only commit when asked. Run the full test suite once before each commit; otherwise run just the tests
  for what changed.

## Phase 1 status

**Done:** aircraft table/picker/management, structured stops, milestones (config-driven), currency +
expirations + medical, AeroTrail rebrand + icon, rotating Dashboard greeting.

**Partial:** Airline/Operator section has `airline` but no `flight_number`; CSV export/import covers only
the original flat fields (no stops, no aircraft link).

**Missing:** `dual_given`, `simulator_time`, full-stop-vs-total landing split, typed approaches, debrief
fields, a `/logbook/review` screen, JSON export.
