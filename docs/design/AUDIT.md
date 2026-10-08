# AeroHub redesign — Phase 0: audit, IA, directions, glass lab

Branch `feature/redesign-v2` (off `main`, clean, equal to `origin/main` at `30f706f`). No app code changed in Phase 0.
Everything here lives under `docs/design/`. Screenshots of the current app (88 PNGs, real local data) are in
`docs/design/audit/` but are **git-excluded** (`.git/info/exclude`) so personal data never enters the repo.

## 1. Audit of the current app

### Routes (all in `client/src/App.jsx` unless noted)

| Route | Page | Notes |
|---|---|---|
| `/` | Home | pilot/passenger hero cards, alerts, map preview, recent activity, weather, add/quick buttons |
| `/logbook`, `/logbook/:id`, `/logbook/ground/:id` | Logbook (+ nested FlightDetail / GroundSessionDetail) | pilot-only list; passenger flights have their own page |
| `/travel`, `/travel/:id` | PassengerFlights (+ nested FlightDetail) | |
| `/logbook/new`, `/logbook/:id/edit`, `/logbook/quick` | FlightForm, QuickFlight | forms are full pages, sticky save bar |
| `/logbook/ground/new`, `/logbook/ground/:id/edit` | GroundSessionForm | |
| `/logbook/data` | ImportExport | CSV, JSON backup/restore, backup status |
| `/logbook/share`, `/logbook/print` | ShareSettings, PrintSummary | print stays solid white |
| `/aircraft`, `/aircraft/new`, `/aircraft/:id` | Aircraft, AircraftForm | |
| `/milestones` | Milestones | |
| `/currency`, `/currency/new`, `/currency/:id` | Currency, ExpirationForm | |
| `/weather`, `/weather/settings` | Weather, WeatherSettings | |
| `/costs`, `/costs/settings` | Costs, CostSettings | |
| `/map` | Map (Leaflet) | |
| `/stats` | Stats (+ `pages/stats/*`: Pilot, Travel, Places tabs, 12 chart/card files) | |
| `/share/:token` | PublicShare (`main.jsx`, outside the passcode gate) | public, narrow, revocable |
| `*` | redirect to `/` | login is `AuthGate` (not a route) |

### Shared components (45, `client/src/components/`)
Shell: BottomNav, SideNav, AddFab, OutboxBanner, AuthGate, ThemeToggle. Primitives: Button, Card, Badge, Modal,
ConfirmDialog, Disclosure, Select, TextField, Toggle, CountInput, HoursInput, DatePicker, ProgressBar, RingProgress,
Skeleton, EmptyState, ErrorNote. Domain: AircraftPicker, AirlineBadge, AirportSearchField, AlertsStrip,
ApproachesEditor, StopsEditor, PassengerTimeFields, BackupStatus, CurrencyStatusCard, FlightRoleTabs, RoleBadge,
RoleHeroCard, MapPreviewCard, PhotoGallery/Grid/Picker, RecentActivityList, SummaryDocument, WeatherConditions,
WeatherDashboardCard.

### Design tokens today (`client/src/index.css`, `tailwind.config.js`)
- Colour as space-separated RGB vars so Tailwind can add alpha: `navy-950/900/800/700` (page/card/raised/border-ish),
  `slate-100…600` (text scale), `accent` (sky), `--role-pax` (violet, plus `-dark`/`-strong`), `ok`/`warn`/`bad`, `ink`,
  `edge` hairlines. **Dark is a navy tint (`#07090d`, `#0e1117`, `#161a23`)**; light is `#f4f6fa` page with white cards.
- Type: Inter body, Space Grotesk for h1/h2/stat numbers. Radii: 2xl cards, 1.25/1.5rem elevated/hero.
- Existing glass-ish use: `backdrop-blur-xl` on BottomNav/SideNav (80% navy) — the only blur in the app.
- ~523 usages of `navy-*` / `slate-*` classes in JSX: the redesign replaces these with semantic tokens.
- Other conventions to keep: `.pressable`, `.safe-bottom`, `--bottom-nav-h`, `.role-pax-scope`, `form:focus-within .save-bar`,
  Leaflet marker CSS, print block, reduced-motion clamp.
- Already iOS-aware: viewport-fit=cover, apple-mobile-web-app-capable, `overscroll-behavior-y: contain`, dvh, safe-area
  bottom. Gaps vs the brief: status bar style is `black` (needs `black-translucent`), no visualViewport keyboard handling,
  no sheets with detents, no collapsing large title, no reduce-transparency control, icons need the new design.

### Observations from the screenshots (390px + 1280px, both themes, no console errors, 0 writes)
- Home is a stack of equal-weight cards; pilot and passenger read as two separate apps rather than one hub; the
  tab bar has 6 items with the passenger area hidden on phone (reachable only through the Logbook tab switcher).
- Nav is a flat 7-item list (Home, Logbook, Passenger, Milestones, Weather, Map, Stats) mixing destinations with sub-features.
- Aircraft, Currency, Costs, Import/export and Share have no top-level entry; they're reached from links inside pages.
- (My full-page screenshots show the fixed tab bar mid-page — a capture artifact of `fullPage`, not a bug.)

## 2. Proposed information architecture

**Phone: floating glass tab bar, 5 items.** Home · Flying · Travel · Map · More.
**More sheet** (medium detent): Stats, Aircraft, Airports (new, later), Import & export, Share link, Settings
(theme, reduce transparency, costs/weather settings). *Alternative if you'd rather have Stats one tap away: swap Stats in for More's
first slot and move the rest under a profile/gear button in the top bar — your call at the gate.*
**Desktop/iPad: left rail** (glass) with the same sections plus Stats visible (Home, Flying, Travel, Map, Stats, More).

| Section | Contents |
|---|---|
| **Home** | greeting, attention items (currency/expirations), pilot summary (as pilot), travel summary (as passenger), map preview, recent activity, weather, quick log |
| **Flying** (pilot only) | segmented: Logbook · Currency · Milestones · Costs · Weather. Logbook list, flight detail, add/edit/quick log, ground sessions |
| **Travel** (passenger) | passenger flights list/detail/add/edit |
| **Map** | unchanged data, glass overlays, role filter |
| **More** | Stats, Aircraft, Airports, Data, Share, Settings |

### Redirect map (every existing URL keeps working; no route is removed)

| Existing URL | New home | Behaviour |
|---|---|---|
| `/`, `/map`, `/stats`, `/travel`, `/travel/:id`, `/aircraft*`, `/share/:token` | same path | unchanged |
| `/logbook`, `/logbook/:id`, `/logbook/ground/:id`, `/logbook/new`, `/logbook/:id/edit`, `/logbook/quick`, `/logbook/ground/*` | same path | stays; Flying tab highlights for all of them |
| `/currency*`, `/milestones`, `/costs*`, `/weather*` | same path | stay; render inside the Flying section's segmented control |
| `/logbook/data`, `/logbook/share`, `/logbook/print` | same path | reached from More; print/share-link behaviour unchanged |
| `/flying` (new) | alias for `/logbook` | convenience |
| `/airports`, `/airports/:icao` (new) | not built yet | reserved; unknown paths still redirect to `/` |

Because every old path continues to resolve in place, no `Navigate` redirects are needed except the `/flying` alias; a
route-by-route test in Phase 2 will assert it.

### Where Airports fits (not built yet)
A "page per airport" at `/airports/:icao` (flights from/to, aircraft flown there, visits count, first/last visit, notes,
photos), reached from More → Airports (searchable list) and from map pins and flight rows. It needs `entity_links`/notes
storage later — a migration — so it is **not** part of this front-end-only redesign unless you decide otherwise; Phase 0 just
reserves the route and the More-sheet slot.

## 3. Three directions

Serve: `node docs/design/serve.mjs` (also regenerates nothing; `node docs/design/build.mjs` regenerates the HTML from
`tokens.mjs`). Each page has Home (phone and desktop), a scrolling passenger list under glass bars, a detail screen, a medium-detent
sheet over the map, the floating tab bar over the map — in dark and light — plus the full token set and measured contrast.

| | A — Meridian | B — Softbox | C — Large Type |
|---|---|---|---|
| Character | restrained, editorial, hairline grouped lists | soft 24px cards, tinted pilot/pax hero cards, glass quick-log action | big numerals, flat content, map-led Home with glass stat overlays |
| Radii (card/control/sheet) | 14 / 10 / 20 | 24 / 16 / 28 | 10 / 8 / 16 |
| Glass blur / saturate | 24px / 1.6 | 32px / 1.8 | 20px / 1.5 |
| Tab bar | thin capsule | taller capsule, bigger targets | squarer 22px bar |

All three use true black / white pages, monochrome content, sky for pilot and violet for passenger only, SF via
`system-ui` first with Inter fallback.

### Measured contrast (WCAG 2.x, `node docs/design/contrast.mjs`)
Glass is modelled as its tint composited over the blur-averaged backdrop, evaluated against seven worst cases: pure
black, pure white, bright light-tile map `#E8EDF1`, dark-tile map `#0A1522`, mid gray, and solid sky/violet chart fills.
312 pairs measured, **0 below target**. Worst case on glass per direction (text and secondary text AA 4.5; accent
icon/pill 3.0):

| Dir / theme | text | secondary text | sky accent | violet accent |
|---|---|---|---|---|
| A dark | 8.62 | 6.35 | 5.17 | 5.26 |
| A light | 12.89 | 7.40 | 4.46 | 5.27 |
| B dark | 7.51 | 5.29 | 4.49 | 4.44 |
| B light | 11.77 | 7.40 | 4.07 | 4.81 |
| C dark | 12.04 | 8.15 | 6.63 | 6.76 |
| C light | 14.48 | 8.02 | 4.69 | 5.54 |

Full per-backdrop tables are on each direction's page. Solid surfaces (text, secondary, tertiary, sky, violet, ok, warn, bad
on page/surface/raised, both themes) also all ≥ 4.5. Two light-theme semantic values were darkened during this pass to clear
AA on the raised surface (`ok #0A6B35`, `bad #B8222F`). Caveats: the model ignores `saturate()` and the specular highlight
(both tiny); it must be re-measured on the real app in Phase 1 with screenshots, which I'll do.

## 4. Glass lab and performance

`http://192.168.1.66:5180/lab.html` (same Wi-Fi; indexes at `/`). The lab is a full-viewport page: glass top bar and tab bar over a
400-row list (every 7th row is a saturated bright colour to stress legibility) or the map; A/B/C and theme switches, a
Reduce-transparency toggle, an auto-scroll button and a live FPS / worst-frame readout.

**Measured (headless-capable Edge on this PC, 390×844 @3x, scripted scroll for 4 s per run, 144 Hz display):** ~137–144 fps
average, p95 frame 7.1 ms for A, B and C with glass on; reduced-transparency identical; map view identical. The one 201 ms
frame in A's run is first-run warm-up. **This does not tell us how an iPhone behaves**: different compositor (WebKit, Metal),
different GPU cost for blur, ProMotion vs 60 Hz, thermal throttling. What I can't measure without your device: real scroll
smoothness, blur cost on large areas, keyboard + sheet behaviour, status bar, add-to-home-screen. Please open the lab, toggle
glass off/on, hit Auto-scroll, and tell me the fps readout and whether it feels smooth. Layer budget on the lab: 2 blurred
layers (top bar + tab bar); the real app caps at 3 (adds one sheet or popover); no blur on list rows or full-screen areas, and
blur radius is never animated.

## 5. What a web approximation can't do
- **No lensing/refraction** of what's behind the glass (no SVG displacement — doesn't work in Safari). We get blur, saturation,
  tint and an edge highlight only.
- **No native tab bar / large-title / sheet behaviour**: those are CSS + JS imitations (detents, grabber, drag to dismiss are ours).
- **No haptics.** Press feedback is visual only.
- **Safari support for `prefers-reduced-transparency` is uneven**, hence the in-app toggle; `-webkit-backdrop-filter` prefix is used.
- **Back-swipe in standalone PWAs** is browser-controlled; we can only keep history sane.
- **Dynamic Type**: we can scale with rem and `-apple-system-body`-style sizing, but iOS doesn't pass the system text size to PWAs,
  so it follows browser zoom / our own scale, not the Settings slider.

## 6. Things I chose that you didn't specify
- 5-item tab bar with **More** holding Stats (see alternative above); `/flying` alias route.
- Static mockups use illustrative placeholder numbers, not your real figures; mockups render an equirectangular land map from the
  existing `landOutline.json`.
- Playwright-core installed in a scratch folder (not the repo) driving the installed Edge for screenshots and the perf run;
  all audit browsing used the real local DB on `localhost:3001` with every non-GET `/api` call blocked (0 writes).
- Screenshots excluded from git via `.git/info/exclude`.

## 7. Gate — what I need from you
1. Open `http://192.168.1.66:5180/` on your iPhone (Safari), look at A/B/C and the **glass lab**; tell me the fps readout and whether it
   scrolls smoothly with glass on.
2. Pick a direction (or a mix).
3. Approve or change the IA (5 tabs; Stats under More vs a tab; Airports reserved but not built).
