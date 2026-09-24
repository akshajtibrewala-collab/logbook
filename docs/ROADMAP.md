# Roadmap

## Phase 1 — delivered

The core lifelong-logbook app, complete:

- **Flights**: date, route, structured stops (full stop vs. touch-and-go), aircraft link, airline/flight
  number, every time category (including dual given, simulator time), day/night and full-stop landing
  counts, typed approach breakdowns, remarks, and a two-field debrief (what went well / what to work on).
- **Aircraft**: a real table with the complex/high-performance/tailwheel/turbine/TAA/type-rating/
  simulator flags that feed milestone calculations, a picker with quick-add, archive instead of delete.
- **Currency & expirations**: day/night passenger, instrument, and flight review currency computed live
  from flights; a medical certificate and any other custom expiration, with Dashboard nudges.
- **Milestones**: Private/Instrument/Commercial progress computed from raw flights against a config-
  driven requirement engine (no certificate-specific code) — collapsible per-certificate summaries,
  grouped requirement rows, regulation citations.
- **Dashboard**: a rotating aviation-themed headline plus a data-driven subline (expiring items → data
  needing review → logging gap → last flight's debrief note → milestone progress → calm currency nudge →
  a friendly stat), all pure and unit-tested.
- **Map & Stats**: every airport visited, every route flown, hours by category/aircraft.
- **Backup**: full JSON export/restore (every table, format-versioned, round-trip tested) and CSV
  export/import (ForeFlight/LogTen compatible, covering every field above).
- **Branding**: AeroTrail name, icon, PWA install.
- Full test suite (`node:test`), mobile-first UI with light/dark mode, a bottom-nav-aware layout.

## Phase 2 — delivered and deployed

Merged to `main` and live in production (2026-09-23): migrations 010–012 applied to production Turso,
runways seeded (39,566 rows), verified in the browser.

- **Manual milestone completions**: "Track manually" requirements can be checked off with a date and
  optional note (tap to complete, tap again to undo), stored in `milestone_completions` (010), counted
  toward each certificate's "X of Y met" progress, and included in JSON backup/restore.
- **Weather go/no-go checker**: personal minimums (day and night ceiling/visibility/wind/gust/crosswind)
  and a home airport (`pilot_settings`, 011), current METAR + TAF forecast for any airport fetched
  server-side from aviationweather.gov with a short cache, decoded conditions compared against those
  minimums (TAF TEMPO/PROB merged as worst-case and attributed by name), crosswind computed per runway
  (`runways`, 012, seeded from OurAirports) with magnetic variation via NOAA's WMM, day/night minimums
  chosen by real sunrise/sunset at the airport, a "Plan a flight" multi-leg forecast-at-ETA check, and a
  Dashboard card for the home airport. See `server/src/lib/weather.js`, `server/src/lib/magvar.js`, and
  `server/src/lib/daynight.js` for the pure logic, and `client/src/pages/Weather.jsx` /
  `WeatherSettings.jsx` for the UI.

## Phase 2 — UX polish (time zones, pickers, tablet) — delivered and deployed

Merged to `main` (2026-09-23). No migrations — nothing to back up before this one.

- **Time zone handling**: every weather time is now anchored to a real UTC instant and displayed in the
  airport's own IANA zone (resolved from lat/lon via `tz-lookup`, since the airports table has no zone
  column) with Zulu alongside, e.g. "15:00 MDT · 21:00Z" — never the device's zone and never a hardcoded
  offset. "Plan a flight" interprets each leg's entered time in that leg's own airport zone (previously a
  naive string comparison made a device and a planned airport in different zones give a wrong "is this in
  the past" answer). METARs show observed age and flag themselves stale past 90 minutes. See
  `client/src/lib/timezone.js` and `server/src/lib/timezone.js` (pure, DST-tested against several US
  zones including one with no DST) plus `server/src/routes/airports.js` (`tz` on every airport response).
- **Date/time picker**: `DatePicker` gained a `zone` prop so its displayed time, "Now" default, and `min`
  (a real UTC instant in that mode) all read in an airport's local time; footer buttons and the hour/minute
  spinner were already normalized to the shared `Button` component and 44px+ targets in an earlier pass.
- **Tablet/iPad layout**: a side nav rail (`SideNav.jsx`) replaces the bottom tab bar from the `md`
  breakpoint (768px) up; Logbook gets a real split view (list + detail side by side) via nested routing
  from `lg` up; Dashboard/Milestones/Currency use a two-column card grid at `md`+; forms are centered at a
  comfortable max width instead of stretching edge to edge; numeric `TextField`s default to
  `inputMode="decimal"`; the PWA manifest's `orientation: "portrait"` lock was removed so an installed
  iPad app can rotate. A narrow iPad Split View/Slide Over pane falls back to the phone layout automatically
  since it's the same `md`/`lg` breakpoints, not separate device logic. ("Costs" two-column treatment from
  the original request doesn't apply — there's no Costs page yet, see the Phase 2 idea below.)

## Phase 2b — training cost tracker and weekly backups — delivered and deployed

Merged to `main` and live in production (2026-09-23): migrations 013–017 applied and verified against a
backup-first baseline (20 flights, 29.90 h, 134 day landings, 8 aircraft unchanged), then the pilot's invoice
cost data applied by an idempotent atomic import; production shows $10,736.42 total spent and 14.40 ground
hours. The Logbook is now the single place flights *and* ground-only sessions get logged:
the + button offers "Log flight" or "Log ground session", both entry kinds show together in one date-
ordered list (a filter narrows to All/Flights/Ground), and tapping either opens a matching detail/edit view
(`GroundSessionForm.jsx`, `GroundSessionDetail.jsx`). `FlightForm`'s ground-instruction-hours field lives in
the main time section (auto-filled from a default briefing time on dual flights, editable), with the
calculated cost shown live and a manual override tucked behind a disclosure.

Costs are calculated per **training phase**, not globally: migration 013 adds `other_expenses`,
`ground_sessions`, `training_phases` (a certificate's own date range) and `ground_time`/`cost_override` on
`flights`; migration 014 adds `instructor`/`invoice_ref` (for idempotent external imports); migration 015
scopes every rate table (aircraft rental+fuel, instructor, ground, simulator) to one training phase's own
`certificate`, and gives each phase a `track_costs` toggle. A flight or ground session only gets a
calculated cost when its date falls inside a phase with cost tracking on, using *that phase's own* rates —
never a global "current rate" — so ending a phase (an end_date, e.g. a checkride date) freezes its totals
permanently: a later rate change is always a different phase's row and can never reach back in. Outside any
tracked phase, cost is `null` (shown as "Not tracked"), not $0, and excluded from totals/projections; a
manual cost override still applies anywhere, tracked or not. All of this — cost breakdown, phase lookup,
spend totals, spend per phase, average cost per flight hour, and a two-estimate remaining-cost projection
(FAA minimum vs. a settable "realistic" total-hours target) — lives in `client/src/lib/cost.js`, pure and
unit-tested against the plan's own worked examples ($442.50 for a 1.5hr dual lesson, $315 solo, $485 with
0.5hr ground). `Costs.jsx` (summary, per-phase totals, spending chart, projections, expenses) and
`CostSettings.jsx` (per-phase rate history editors, the track-costs toggle, default-ground-time and
realistic-hours-target settings) are reached from Logbook's header icon row. CSV, JSON backup/restore, and
their tests cover every new field/table.

Imported the pilot's Elite Aviation invoice history into the Private phase (effective 2026-07-10,
matching the phase's start) — 20 flights, 6 ground-only sessions, 6 expenses, matched idempotently by
invoice number (locally first, then production). That data lives only in the databases, never in this
repo.

Also delivered: the Costs page fixes (spending chart, total spent per flight hour = total ÷ all flight hours,
a data-driven projection — remaining hours from Milestones, current-phase rates, average lesson length and
ground time, a 50 h realistic target that auto-raises, an estimated finish date, and a "how this is
calculated" breakdown — with one-time planned costs as the only manual input, migration 016); ground-only
sessions in the CSV export/import (`entry_type` column); a default aircraft rate applied when a flight is
logged in an aircraft with none; MM/DD/YYYY date display everywhere (storage/CSV/backup unchanged); and the
automatic weekly backup (Vercel Cron + Resend email, `backup_runs` log from migration 017, status card,
"Run backup now", Dashboard warning when failed or over 8 days old). Verified end to end on production.

## Phase 3 — faster logging, charts, map polish, photos, sharing — delivered and deployed

- **Logging**: `/logbook/quick` (Quick log), Copy last flight (`/logbook/new?copy=last`), airport
  autocomplete with remembered airports (`AirportSearchField`), recent-first aircraft, client-side
  validation (`lib/flightDraft.js`), draft autosave and an offline outbox with automatic retry
  (`lib/outbox.js`, `OutboxBanner`).
- **Add button**: `AddFab` (hides on scroll down, clears the last row via a `.fab-clearance` spacer,
  not rendered from `md`); Logbook and Aircraft headers carry the Add action on desktop.
- **Stats**: hours by month, by tail number, cumulative line with a target (`lib/charts.js`, tested;
  target stored in `pilot_settings.hours_target` / `hours_target_label`, migration 018).
- **Map**: animated routes (draw-in, then flowing dashes; off by default under reduced motion and above
  120 routes), one theme-aware route colour (a by-year / by-aircraft colour mode was built and later
  removed), pin mini-summary, counters (`lib/mapstyle.js`, tested), tile cache (`public/sw.js`).
- **Weather planning time zones**: a leg's time is stored as a UTC instant (`lib/planlegs.js`, tested); the
  airport's zone only reads/displays it, so changing the airport never moves the moment. Missing zones
  fall back to UTC with a message.
  States visited needs `airports.region` (migration 018 adds the column; the seed script fills it — re-seed).
- **Photos**: `flight_photos` (migration 019), `routes/photos.js`, client-side compression
  (`lib/image.js`). Stored as base64 in the database rather than Vercel Blob so no extra service or token
  is needed. Not in the JSON backup on purpose (size) — a full restore leaves photos in place but a
  restore into a *fresh* database will not bring them back. Follow-up: move to object storage (e.g.
  Vercel Blob) if the photo volume grows.
- **Sharing**: `share_settings` (migration 020), `routes/share.js` (admin + public routers),
  `lib/share-summary.js` (the only thing that shapes what a public link can see; unit tested),
  `/share/:token` (outside the passcode gate) and `/logbook/print`. Also intentionally not in backups so
  restoring can't revive a revoked link.
- **Design/a11y**: system light/dark preference until the toggle is used, Space Grotesk headings, global
  focus ring, skip link, higher-contrast secondary text in dark mode, pagination ("Show more") in the logbook.

## Cost cutoff date

`pilot_settings.cost_cutoff_date` (migration 021; "Commercial certificate date" on Cost settings, optional). Flights and ground
sessions dated on or after it are excluded from every cost total, average, chart and projection, compared by
calendar day (`isPastCostCutoff` in `lib/cost.js`, tested). It rides on the rates object from `fetchAllRates` so every
cost function honours it. Stored cost fields are never changed; the flight/ground forms hide the cost fields past
the cutoff with a note. Hours, currency, stats, map and the logbook are unaffected. Other expenses are still counted.
Also fixed: the weather and cost settings pages each sent only their own fields and could blank the other's
settings; both now save via `saveSettingsMerged`.

## Known follow-ups

- **Photo and share gaps.** The public share page shows square photo thumbnails (it only gets photo ids); the logbook
  list shows just a camera icon; photos and the share link are excluded from backups; photos saved before sizes were
  recorded are measured on load.

- **Orphaned Turso tables.** `certificates`, `certificate_requirements`, `requirement_completions`,
  `custom_expirations`, `pilot_profile` are left over from the incident in `TURSO_RECONCILE.md` — created
  by another branch outside the migrations system, unused by current code. `pilot_profile` has one real
  row (medical info) worth checking before anything is dropped. **Back up production Turso first**
  (`npm run db:backup`), then decide table by table.
- **CSV can't express touch-and-go stops or ForeFlight's true full-stop semantics.** Every imported stop
  defaults to full-stop (disclosed, matches the original `003_flight_stops.js` migration's own
  precedent); ForeFlight's "Landing Full-Stop Day/Night" columns still map to the day/night *total* for
  backward compatibility rather than to this app's own full-stop count, so a ForeFlight import doesn't
  auto-populate full-stop counts — that's a manual fix-up in the flight's edit form.
- **StopsEditor's reorder arrows are 36px, not the 44px tap-target minimum** the rest of the app now
  meets. Two of them stacked in an already-44px-tall row can't both reach 44px without growing the row's
  height (and visual density) — a real design tradeoff, not an oversight, flagged rather than silently
  left inconsistent.
- **Edit-form loading states** (`AircraftForm`, `ExpirationForm`, `FlightForm`) show plain "Loading…"
  text rather than a `Skeleton`, unlike every list/detail page. Consistent across all three, low-impact
  (loads are near-instant), but worth revisiting in a future polish pass.
- **On-screen keyboard can still cover the field being edited or a Save button** on some device/keyboard
  combinations. Relies entirely on the browser's own scroll-into-view on focus rather than any explicit
  handling (e.g. resizing the viewport or scrolling the focused input above the keyboard) — usually enough
  in practice, but not guaranteed on every device.
- **No broader hover-state/focus-ring audit.** Trackpad/keyboard support added so far is limited to
  SideNav's focus ring and the Escape-to-close handling `Modal`/`DatePicker` already had; most buttons
  still only style `active:` (touch), not `hover:`/`focus-visible:`, so trackpad users get little visual
  feedback pointing at a control before clicking it.

## Ideas (remaining)

- **Oral exam study mode** with spaced repetition, tied to certificate/rating progress.
- **Document vault**: medical certificate, pilot certificate, endorsements — scanned/photographed and
  stored alongside the expirations they relate to.
- **Later**: CFI tools (student tracking, endorsement templates) and airline-career features (application
  tracking, interview prep, type-rating planning).
