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

## Phase 2 — in progress

- **Manual milestone completions**, delivered: "Track manually" requirements can be checked off with a
  date and optional note (tap to complete, tap again to undo), stored in `milestone_completions`
  (010), counted toward each certificate's "X of Y met" progress, and included in JSON backup/restore.
- **Weather go/no-go checker**, delivered: personal minimums (day and night ceiling/visibility/wind/
  gust/crosswind) and a home airport (`pilot_settings`, 011), current METAR + TAF forecast for any
  airport fetched server-side from aviationweather.gov with a short cache, decoded conditions compared
  against those minimums (TAF TEMPO/PROB merged as worst-case and attributed by name), crosswind
  computed per runway (`runways`, 012, seeded from OurAirports — see docs/DEPLOY.md for adding it to an
  existing production database) with magnetic variation via NOAA's WMM, day/night minimums chosen by
  real sunrise/sunset at the airport, a "Plan a flight" multi-leg forecast-at-ETA check, and a Dashboard
  card for the home airport. See `server/src/lib/weather.js`, `server/src/lib/magvar.js`, and
  `server/src/lib/daynight.js` for the pure logic, and `client/src/pages/Weather.jsx` /
  `WeatherSettings.jsx` for the UI. Not yet verified in the browser by a human — the person building this
  should click through it before relying on it.

## Known follow-ups

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

## Phase 2 ideas

- **Oral exam study mode** with spaced repetition, tied to certificate/rating progress.
- **Training cost tracker**: money spent per certificate/rating, cost per hour trends.
- **Document vault**: medical certificate, pilot certificate, endorsements — scanned/photographed and
  stored alongside the expirations they relate to.
- **Later**: CFI tools (student tracking, endorsement templates) and airline-career features (application
  tracking, interview prep, type-rating planning).
