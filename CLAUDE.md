# AeroHub

AeroHub is my private, lifelong, one-stop personal aviation system — not just a logbook. It's meant to hold
everything aviation in my life over time: pilot logbook, passenger flights, a map, aircraft, airports, airlines,
photos, trips, pilot progress, a journal, knowledge, and a timeline. Currently built out: flights (with
structured stops and typed approaches), aircraft, currency/expirations, milestone progress toward certificates,
a map and stats, manual milestone completions, a weather go/no-go checker against personal minimums, a training
cost tracker (per-phase rates, ground-only sessions, expenses, projections, a cost cutoff date), fast logging
(Quick log, copy last flight, offline retry), photos/notes, stats charts, an animated map, and a read-only share
link/print view. Everything through migration 021 is merged and live — see `docs/ROADMAP.md` for details and
what's next.

**Aircraft Paradise is a separate, public aviation-photography website. Never merge it into this app.** AeroHub
is private data; nothing here becomes public unless a feature explicitly marks it published (today, only the
opt-in read-only share link at `/share/:token` — see "Sharing" below — exposes anything, and even that is a
deliberately narrow, revocable summary, never raw records).

## Flight roles

Every flight has a role: `pilot` or `passenger`. The `flights.role` column (migration 022) still has a CHECK
constraint that also allows `'observer'` at the database level, but the app no longer offers or accepts it —
no flight has ever used it, and an incoming role of `'observer'` (the API, CSV import) is rejected as an error
rather than falling back to `pilot`.

- **Logbook hours, currency, and pilot milestones count `role = 'pilot'` flights only.** Passenger flights must
  never contribute to these.
- **Map, airports visited, aircraft, countries, and distance count every role**, with a role filter the pilot can
  use to narrow the view. Whenever a stat is shown, it must be visually clear which role(s) it covers (e.g. "as
  pilot" vs. "all flights") — never an ambiguous number that silently mixes roles.
- **The Logbook page (`/logbook`) shows only `pilot` flights** (plus ground sessions); passenger flights live on
  their own page (`/travel`), with a two-tab switcher between the two.

## Data safety (highest priority)

The database holds real flight records, not sample data. This overrides convenience or speed every time:

- **Never delete, reset, reseed, or overwrite the database.** Never replace real data with demo/placeholder data,
  in any environment.
- **All schema changes go through numbered SQL migration files** (see "Folder structure") that work on both local
  SQLite and Turso — the existing `server/src/migrations/NNN_name.js`/`.sql` pattern, never a one-off script or a
  hand-run statement.
- **Before running any migration against a real database, back it up and show the migration SQL** — this is in
  addition to, not instead of, the existing `db:backup:prod`-before-merging rule under "Branch and deploy safety".
- **New columns are nullable or have a default.** Keep an old column in place until the pilot has confirmed a
  backfill is correct — don't drop or rename it as part of the same change (this matches the existing migration
  rule in `server/src/migrations/README.md`).
- **Derived stats are always computed, never stored.** Hours, flight counts, visit counts, distance, and anything
  else derivable from the underlying rows are computed by a query from the real relationships each time, never
  entered twice or cached as a stored total that could drift out of sync.

## Architecture

- **Extend what's here; don't rewrite it.** Reuse existing components, styling and the existing Leaflet map setup
  (`client/src/pages/Map.jsx`, `client/src/lib/mapstyle.js`, `mapdata.js`) rather than introducing a parallel
  version.
- **Normalized relationships with foreign keys.** Cross-entity links (e.g. a photo to a trip, a flight to a
  journal entry) go through a generic `entity_links` table rather than a bespoke join table per pair of entity
  types; tags go through `tags`/`entity_tags`. (Neither exists yet — add both as numbered migrations, following
  the rules above, when the feature that needs them is actually being built.)
- **Small, focused files.** Prefer reusable forms, entity pages and a shared search over one large page per
  feature — the existing `client/src/pages/`/`components/`/`lib/` split (see "Folder structure") is the pattern
  to keep following.
- **Every write endpoint validates server-side**, the same way `server/src/validate.js` does today — never trust
  client-side validation alone.
- **Every API route authenticates and scopes its queries to the owner.** AeroHub is currently single-pilot
  behind one shared passcode (`server/src/auth.js`); if real per-user accounts are ever added, every route must
  filter by the authenticated owner, not just check that a passcode was supplied.
- **Private photos are never served from a public URL.** `flight_photos` are served today only behind the app
  passcode or through the narrow, revocable public-share routes (`server/src/routes/share.js`) that already
  control exactly what a link can expose — any new photo-serving route must follow that same pattern, never a
  bare, guessable, or permanently-public URL.

## Workflow

- **Work one phase at a time.** After each phase: run the app, test the existing logbook features that phase
  touches, test the new feature, check phone width (~375px), verify database integrity (row counts/spot checks
  before and after, as already practiced for migrations — see "Branch and deploy safety"), fix errors, then
  summarize and stop rather than rolling straight into the next phase.
- **Don't invent features that aren't in the repo.** If unsure whether something exists or how it currently
  works, inspect the code first rather than assuming.
- **UI stays clean, minimal, and responsive**, following the existing design language — dark only (see "Theme")
  and the personalized greeting on the Dashboard (`client/src/lib/greeting.js`). No clutter, no
  filler stats, no HUD gimmicks (the map's stats panel was deliberately trimmed for this — see "Status"). The
  flight logbook must stay fast and usable on a phone above everything else.

## Stack

- `client/` — React + Vite + Tailwind, react-router-dom, lucide-react icons. Dark only (see "Theme"); the
  redesign's design system lives in `client/src/ds/` and is shown on the hidden `/design` route.
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
npm test         # server tests, then client tests (currently 216 server + 379 client, all passing)
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

## Standing plan

The current multi-task plan (release gates, restore, Logbook redesign mockups, bugs, one page frame) is saved
locally at `docs/design/_private/PLAN.md` (gitignored, private). Read it at the start of a session.

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
  never costs or debriefs) and a printable/PDF summary (`/logbook/print`). Dark on screen like the rest of the app,
  but **print output is always solid white with dark ink, no shadows or glass** (print stylesheet only), and the
  public share page and print view stay pilot-only.

## Theme (dark only)

**The redesign's design language is approved and frozen — read `docs/design/DESIGN_LANGUAGE.md` before touching any UI.**
Summary: direction C (Large Type), Liquid Glass V3, dark only on true black, `--ds-*` tokens only with no literal colours,
glass only on the floating navigation/control layer with solid content, layer budget of tab bar + top bar + one overlay,
quality levels Auto/Full/Lite/Solid, sky = pilot / violet = passenger, print stays white. It changes only when the owner asks.

AeroHub is **dark only**: true black page (`#000`), surfaces just above it, hairline borders, no navy tint; sky blue
for pilot and violet for passenger are the only accent colours (plus the semantic ok/warn/bad). There is no light
theme, no theme toggle and no theme setting, and the device's light/dark preference is ignored. The browser is told
(`color-scheme: dark` meta + CSS, black `theme-color`/manifest colours, `black-translucent` iOS status bar, black
`<html>` before the app mounts) so scrollbars, pickers, selects and the iOS keyboard are dark and nothing flashes white.
The old `logbook-theme` localStorage key is kept as an unused constant (`lib/theme.js`) so no stored data is touched.
The pre-redesign pages still carry the old navy/`.light` Tailwind tokens until the redesign replaces them.

- **Tokens:** every colour, shadow, radius, size and duration is a semantic `--ds-*` variable in
  `client/src/ds/tokens.css`; component CSS (`ds.css`, `glass.css`) uses only those names — no literal colours.
- **Adding a light theme later** = add one block, `[data-ds-theme="light"] { ... }`, to `tokens.css` that redefines the
  same `--ds-*` colour/glass/shadow variables (including the glass tint, text-on-glass and print values), set that
  attribute on `<html>`, and re-measure contrast on glass (`docs/design/contrast2.mjs` models it). No component changes.
- **Print:** `tokens.css` has an `@media print` block that swaps the tokens to white/dark ink and hides glass.
- **Every control** (buttons, round icon buttons, filter chips, segmented controls and tabs, selects, switches, steppers, text-action
  links and the Add button) uses the approved "V-a" lite-glass recipe below; text inputs stay solid with the same rim (`.gl-field`).
  `client/scripts/check-controls.mjs` fails when a visible control lacks the recipe marker (allowlist: `client/src/lib/controlAudit.js`)
  or a route exceeds the blur budget — run it on every route at 390px in every phase. The build id is shown in Settings and on `/design`.
- **Buttons, filter chips, segmented-control buttons and the Add button** use the approved "V-a" lite-glass recipe
  (`client/src/ds/buttons.css`, no `backdrop-filter`): clear glass with a thin coloured rim and a white label. Sky tint = pilot
  primary, violet = passenger primary, clear = secondary, restrained red only on a destructive confirm step (a delete trigger is a
  plain clear button), one primary per screen or sheet. Solid, Reduce transparency and unsupported browsers get solid tinted fills.
  The Add button is "option 3": a violet-to-sky ring around dark clear glass. Specimens at the hidden `/design/buttons`. This is an
  approved change to the design language; details in `docs/design/DESIGN_LANGUAGE.md` "Buttons".
- **Glass (Liquid Glass V3)** is only for the floating navigation/control layer (tab bar, top bar, one popover or sheet at
  a time); content stays solid. Quality levels Full / Lite / Solid (Auto steps down from measured frame times and never up;
  Reduce transparency, no `backdrop-filter` and `prefers-reduced-transparency` all mean Solid). See `client/src/ds/glass.js`.

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
