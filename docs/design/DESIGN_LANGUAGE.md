# AeroHub design language (approved and frozen)

Approved at the Phase 1 gate. **It changes only when the owner asks for a change.** Every later phase follows it as written; if
something seems to need a deviation, stop and ask. Source of truth in code: `client/src/ds/` (tokens, glass, components) and the
hidden `/design` route. Background and measurements: `AUDIT.md`, `GLASS_V2.md`, `contrast2.mjs`.

## Direction
- **Direction C, "Large Type":** big numerals, flat content with a strong top rule opening each section, hairline-bordered solid
  cards, restrained radii (card 10px), map-led Home. System font stack first (SF Pro on Apple), Inter fallback.
- **Dark only, on true black.** Page `#000`, surfaces just above it, hairline borders, no navy tint. No light theme, no toggle,
  the device preference is ignored.
- **Accents:** sky blue = pilot data only; violet = passenger data only; semantic ok/warn/bad for status only. Everything else is
  monochrome. Neutral ramp for categories inside one role. A number never silently mixes roles: always say "as pilot" /
  "as passenger" / "all flights".

## Tokens
- Every colour, shadow, radius, size and duration is a semantic `--ds-*` variable in `client/src/ds/tokens.css`.
- **No literal colours** in components, pages or CSS outside `tokens.css` (the only exceptions are the `/design` contrast-probe
  fixtures in `design.css`, and `#000` alpha masks). No hard-coded hex/rgb in JSX.
- A second theme would be one `[data-ds-theme="..."]` block redefining the same names (see CLAUDE.md "Theme").

## Glass (Liquid Glass V3)
- **Glass only on the floating navigation and control layer:** the tab bar, the top bar, one popover/menu/sheet, and (as no-blur
  "lite" glass) map overlay chips and grouped capsules. **Content is solid:** cards, list rows, forms, charts, tables, stat tiles,
  print and share pages.
- **Recipe:** nearly clear core (about 10% tint, 6px blur, saturate 1.9, brightness 1.06), specular rim light, thin inner highlight
  and glow, soft shadow with colour bleed, 9px edge-lens ring (less blur, brighter), adaptive scrim, sliding glass selection
  capsule on the tab bar, tab bar that collapses on scroll down and expands on scroll up, large title that collapses into the glass
  top bar, scroll-edge fade, Add menu and sheets that grow out of the control that opened them (View Transitions, CSS fallback).
- **Only transform and opacity are animated.** Never animate blur radius. Respect reduced motion.
- **Adaptive scrim:** the default state is the nearly clear one. The higher-tint scrim (70%) appears only where the sampled
  backdrop luminance needs it (threshold 0.08, hysteresis 0.07). Menus and sheets carry text, so they sit on a 35% mid-tint
  floor and also scrim to 70% only over bright content. Text on glass must stay WCAG AA over worst-case backdrops (measured on
  rendered pixels: bars text >= 7.5:1, secondary >= 6.7:1, accent icons >= 4.1:1; menus/sheets text >= 9.2:1).
- **Layer budget:** tab bar + top bar + one popover/menu/sheet at a time (`overlayRegistry.js` enforces one overlay). No blur on
  list rows, scrolling content or large areas. The edge-lens ring is a second backdrop layer, which is why Lite drops it.
- **Quality levels:** Auto / Full / Lite / Solid, plus a Reduce transparency toggle. Lite keeps the ring on the tab bar and top
  bar only. Solid = no blur, opaque high-contrast surfaces; Reduce transparency, a browser without `backdrop-filter`,
  `prefers-reduced-transparency` and `prefers-contrast: more` all mean Solid. Auto only ever steps down (never up) and remembers.
- **The Add button** is one circle above the tab bar (at the right end of the top bar on desktop) that opens the one popover menu;
  see "Buttons" below. Chromium-only refraction is a desktop enhancement, never required.
- **Rim light** (tab bar, rail, top bar, menus, sheets) is a *varying* specular rim: bright pools at the top-left and bottom-right
  corners that fall away along each edge over a very dim base, plus a faint inner highlight. Never a uniform bright outline.

## Buttons (approved change: variant "V-a" and Add button option 3)
Applies to **every control**: buttons, round icon buttons (clear glass, 44px circle), filter chips, segmented controls and tabs (a glass
track with a tinted glass selected segment: sky in pilot scope, violet in passenger scope, neutral clear elsewhere), selects (a glass
button with a chevron; the native picker still opens), switches, steppers, text-action links (`.gl.link`) and the Add button. Text
inputs and textareas stay **solid** but share the rim language (`.gl-field`). Cards, list rows, stat tiles, charts, tables and the
print and share pages stay solid. A control that is not a recipe control must be on the explicit allowlist in
`client/src/lib/controlAudit.js`, and `client/scripts/check-controls.mjs` fails when one is not (run it on every route at 390px in every
phase's verification; it also counts blur layers). It does **not** apply to the tab bar, top bar,
sheets or menus (they keep their blur) or to content surfaces. Source: `client/src/ds/buttons.css`. Specimens: the hidden,
passcode-gated `/design/buttons`. The three candidate recipes that were compared are kept in `docs/design/buttons.html`.
- **"Lite glass", no `backdrop-filter` at all**, so buttons cost nothing against the blur-layer budget. Recipe: a translucent tint
  over a dark underlay (a route line or list text behind never hurts the label), a curved specular rim (bright pools top-left and
  bottom-right over a dim base, 1.25px), a thin inner highlight, a soft inner glow and a soft outer shadow.
- **Roles:** pilot primary = sky tint; passenger primary = violet tint (inside the passenger scope); secondary = clear glass with a
  white rim; plain = text only; destructive = restrained red, **only on the confirm step** (the button that opens a confirm is an
  ordinary clear button). **One primary per screen or sheet.** The label is white on every glass fill. The primary tint is 46% to 28%
  so primary against secondary is unmistakable at a glance.
- **States:** rest; hover (desktop, a faint highlight); pressed (a gentle squash, `scale(1.015, .955)`, of the whole control, with the
  highlight sliding down and brightening); focus (2px white ring at a 3px offset, distinct from the thin resting rim); disabled (42%);
  loading (a spinner in the label). Only transform and opacity animate; reduced motion removes the motion. Sizes: large 56px,
  regular 48px, small, chip and icon at least 44px; capsule shapes.
- **Add button (option 3):** one 56px circle (48px in the desktop top bar): dark-underlaid clear glass inside a violet-to-sky ring.
  The two halves of the ring carry no role meaning (the menu holds Pilot, Passenger and Quick log). It squashes as a whole.
- **Fallbacks:** Solid quality, Reduce transparency, `prefers-reduced-transparency`, `prefers-contrast: more` and a browser
  without `backdrop-filter` switch every glass layer off (`--gb-m` and `--gb-fx` in `glass.css`) and use solid tinted fills: solid
  sky or violet with dark ink, a solid surface with a hairline border for clear, solid deep red for destructive. Same contrast or better.
- **Measured on rendered pixels** (worst case over black, the map and a sheet; rest, hover and pressed): label contrast pilot 7.1,
  passenger 7.1, secondary 13, destructive 8.7 (targets: 4.5, and 5.5 for destructive); icons 6.6 (target 3); the rim against its
  backdrop is at least 3:1 along the whole outline (a route line crossing right outside a button is the one measured exception).

## Layout and behaviour
- **IA:** tab bar Home · Flying · Travel · Map · More; Stats, Aircraft, Airports (reserved, not built), Data, Share, Settings
  under More. Add flight (Pilot or Passenger) and Quick log are one tap from Home; Home has a one-tap Weather shortcut.
- iOS details: `viewport-fit=cover`, safe-area insets on every edge, `dvh`, inputs >= 16px, 44px minimum tap targets, no tap
  highlight, selection off on chrome and on in content, keyboard never covers the focused field.
- A unit after a big numeral (h, nm, ft) is a smaller, muted unit a thin space away with a lifted baseline (`.ds-unit`), never plain text.
- **Home:** the glass top bar spans the content column (same edges as the content); the map card sits below it (phone 14rem,
  tablet 22rem, desktop 24rem) and fits every airport and route, with the home airport ringed in sky. From 1280px: greeting on top,
  map on the left (about 60%), the two role numbers stacked on the right (about 40%); tablet and phone stay one column. Each number
  appears once on Home.
- **Calm, uncrammed system (approved; supersedes the row and totals-strip details of Option A below):** an 8px grid; card padding 20px (24px from
  1024px); 32px between sections (40px wide) and 16px inside a group; list rows at least 72px; at most three text sizes per card (number 44px, body
  17px, meta 14px, nothing under 14px); rows show at most three pieces of information (primary, secondary that always carries the date, one trailing
  value); one idea per card (a headline number with at most one supporting line, the rest behind a tap: an info sheet, an expandable "More details", a
  sub-screen); fine print lives in a small info button that opens a sheet. The Logbook is the Hybrid: a hero (pilot hours with progress toward the Private
  pilot minimum), a List / Ledger switch (remembered) with search and filter icons, months with FLIGHT hours only. Travel is the same system in violet, by
  year. Detail screens are grouped label / value cards. Log a flight is one focused, step-light screen for both roles, prefilled from the last flight, with
  the glass Save bar always in reach and everything else under "More details". Comfortable density only. Specimens: `docs/design/calm*.html`; code:
  `client/src/ds/calm.css` and `client/src/components/calm/`.
- **Glass over a busy backdrop (approved):** a neutral higher-tint state with a heavier blur and no saturation boost when the sampled backdrop is busy or
  colourful (the Map); see `docs/design/GLASS_BUSY.md` and `client/scripts/check-glass-spread.mjs`.
- **Logbook and Travel (Option A, approved):** the top bar owns the page title (no second heading, no in-page Back button); the Flying
  pages share a scrollable glass tab control (Logbook, Currency, Milestones, Costs, Weather); a totals strip (pilot-only on the Logbook,
  display only); one search + Filter bar with removable chips (search covers route, via stops, tail, aircraft type, airport, remarks and
  instructor); rows grouped by month (Travel: by year) with that group's hours; rows are a date block, the route or "Local · KSUS" with
  aircraft, tail and instructor, the hours as the one big number and the cost small and muted. The Add menu lists Quick log, Copy last
  (the most recent pilot flight), Add flight (Pilot or Passenger), Log ground session. Forms are focused screens (no tab bar; the Save bar
  is real glass in the slot the tab bar leaves free, `components/SaveBar.jsx`, and stops sticking while the keyboard is up; on Aircraft edit, which keeps its tab bar, it is a solid floor so the blur budget holds).
  Month and year headers show FLIGHT hours only (ground time is separate and labelled), the counts line names what it counts ("20 flights · 31.40 h ·
  6 ground sessions · 9.10 h"), ground rows carry a date and a badge, and a month cut by "Show more" keeps its full-month header. The Flying tabs
  all fit the 416px list column at normal text, otherwise they scroll with an edge fade and the selected tab kept in view. The list/detail divider is
  the detail pane's full-height left border. Rows are a fixed three lines (route + flight number; badge, gap, aircraft; times and class). Search
  placeholders are "Search flights" with a full accessible label, falling back to "Search" when even that would clip. On tab roots the top bar shows the
  AeroHub wordmark at scroll-top and hands over to the page title. The wide-screen rail is anchored under the top bar (not centred on the viewport).
  The Stats tabs are a lite-glass strip (dark underlay and rim, no blur). Mockups: `docs/design/logbook-layouts/` (Option A, approved), and the
  proposed revamp directions in `docs/design/revamp*.html` (built by `docs/design/logbook-revamp/build.mjs`; awaiting a pick).
- Text scales with rem; display sizes are capped by viewport width so nothing breaks mid-word at 200%.

## Print
- **Print stays solid white with dark ink, no shadows, no glass** (print stylesheet only; `tokens.css` `@media print` plus the
  `html, body` rule in `index.css`). The public share page and the print view show dark on screen but print white, and stay
  pilot-only.

## Minimalism rules (v2, approved 2026-10-05; applied phase by phase: Phase A = Logbook, Travel, flight and ground detail, the log-a-flight form)
Owner's pick: Logbook direction B, minimalist and modern, as the theme of the whole app. Mockups: `docs/design/logbook-bmin.html`, `docs/design/minimal-app.html`; word counts in `docs/design/minimal/COUNTS.md`. Visual only: no calculation changes. Code: `client/src/ds/minimal.css` and `client/src/components/mn/Mn.jsx` (the `cl mn` page wrapper; `pax` for a passenger page).

**Owner's approvals and changes (2026-10-05):** (a) rows keep the day numeral under the month header (Travel: month/day under the year header); search results, filtered lists and a sort that is not by date show the full date, and the accessible name is always the full MM/DD/YYYY; (b) the tail number sits on a row's second line beside the instructor (the "which airplane" cue): to keep a row at six words the instructor shows as a surname there, the full name is in the accessible name, the tooltip and the detail; (c) the Flying tab strip stays outside the word count and is reported both ways; (d) on desktop the space is used by a larger hero (72px numeral), a second column (the summary, or the open entry) and bigger type, not more text; (e) chips and pills are real V-a controls; (f) the Ledger stays dense with calm spacing and aligned columns; (g) minimalism never hides meaning: every shortened or icon-only control keeps an accessible name and a tooltip, the scope stays one word, contrast stays AA. Every open overlay owns a history entry, so Back closes it (`ds/overlayRegistry.js`).
- **Text budget** (enforced by `client/scripts/check-words.mjs`, numbers in `client/src/lib/wordBudget.js`): first-viewport words at 390px (Logbook 40, Home 45, Costs 45, Currency 45, Milestones 50, Weather 45, Stats 40, Travel 40, Aircraft 40, More 40, Map 25, forms 55); a row at most 6 words (primary, secondary, trailing value); a card one headline numeral plus one supporting line and at most 3 text sizes; at most 4 small text sizes per screen plus the large numerals (28px and up); secondary text in one muted tone (`--ds-text-2`, never `--ds-text-3` for words); at most one all-caps label per screen; units shown once and small. The Flying tab strip counts as navigation chrome, like the bars: reported, not charged.
- **One scale:** 17px primary, 14px secondary, numerals 28 / 40 / 56px. Everything on the 8px grid; card padding 24px; rows at least 64px; group gap 24px.
- **Surfaces over borders:** a month is one surface (`--ds-surface`); rows inside it are separated by space and a hover/selected step to `--ds-surface-2`, not by hairlines. Outlines only on focus and on the V-a controls. One accent per role (sky = pilot, violet = passenger); semantic colours only for status.
- **Behind a tap, not on the page:** the flights/hours/ground counts line, per-month entry counts and ground hours (a dot beside the month name marks a month with ground sessions; the month sheet shows flight hours, then ground hours), the "X of N requirements met" line (a chip reading 1/6 that opens Milestones), per-row cost, per-aircraft hours (a chip shows the tail; the aircraft sheet shows hours), anything the detail view repeats.
- **Shorthand:** same departure and arrival reads "Local KSUS" (airport once); the date is shown once, as the day numeral in the row's date block (the month header gives the month, a year header appears only when the list spans years; the full MM/DD/YYYY is the row's accessible name and tooltip, and the Ledger shows it in full); units live on the hero numeral and the sheets, not on rows or month headers; the instructor is the second line (initials only if the full name does not fit).
- **List minimal, Ledger dense:** the Ledger is the examiner's paper-logbook view and keeps every column, with calm spacing and aligned columns; it is exempt from the word, size and caps limits (not from the tone rule). Print and the public share page are unchanged.
- **Accessibility:** every shortened or icon-only control keeps an `aria-label` and a tooltip (`title`, long-press on touch); contrast stays AA; targets at least 44px; scope stays one word at a glance (the hero reads "Private Pilot", the Travel hero "Passenger", the Map filter All / Pilot / Passenger). Nothing a calculation or the pilot-only rule needs is removed, only moved.
- **Motion that explains:** number count-up on the hero, bar fill, rows spring on press, View Transition from row to detail; all off under reduced motion.
- **What it costs (honest):** reading a month's ground hours, an aircraft's hours or the requirement list is one extra tap; the year is not on every row. Offsets: the dot flags months that have ground time, so you only tap when it matters; the Ledger keeps every number visible at once; rows' accessible names carry the full date, tail and hours; the month and aircraft sheets close by swipe, X, scrim, Escape and Back; search stays one tap away.

## Verification expected of every phase
Dark only at 320/390/430px and text sizes 100/130/150/200% with the bounding-box checker (not just page `scrollWidth`), 44px
tap targets, contrast re-measured on rendered glass over worst-case backdrops, reduced motion respected, both test suites, and the
control check (`client/scripts/check-controls.mjs`: every control has the recipe or an allowlist entry; at most the tab bar, top bar and
one open overlay blur), `client/scripts/check-layout.mjs` (primary navigation visible at 920 to 1920px and 1 to 1.5 device pixel ratio, no horizontal scroll, no clipped search placeholder or Flying tab at 320 to 430px and 100 to 200% text, full-height divider, a date on every row, badges at least 4px from adjacent text), `client/scripts/check-words.mjs` (word budget, see Minimalism rules) and `client/scripts/check-contrast.mjs` (switch knob against its track on real pixels at every glass level). The build id (git short hash, build time) is shown in Settings and on `/design` so it is clear which build is on screen. `client/scripts/check-home-numbers.mjs` (read-only, on real data) proves that Home, Travel, Stats and Map agree: pilot hours (the Logbook total), passenger hours, passenger flights, airports and countries, the all-flights distance Home uses and the passenger-only distance Stats uses (the difference is the pilot routes), the greeting with the name, the status line, and that the year headers on Travel sum to the Travel total. `verify-baseline.js` is pilot-only, so run both. `client/scripts/check-scrub.mjs` fails when anything this branch added contains the real figures, names, tails or references listed in the private, gitignored `client/scripts/.local-expected.json` (which also holds the real and production expectations the Home numbers, invariants and `check-prod-shape.mjs` checks read). `check-wrap.mjs` (WebKit with an iPhone profile and Chromium, 360/390/430px, real fonts loaded, a widening factor of 1.0, 1.1 and 1.2) fails on a word broken mid-word, a stranded unit or number on the last line, overlapping text, text off the screen, an over-long control label, truncated rows and anything hidden behind the bars at the end of a page; `check-phone.mjs` (WebKit, iPhone profile) fails on fields under 16px, tap targets under 44px, controls covered, the Add button over a row's trailing value, a see-through sheet, the keyboard covering a focused field, and a font fetched from another site. `check-prod-shape.mjs` is run against a scratch copy restored from a production backup (never against production): total spent, cost per pilot hour, the blank-instructor flights (no false "Solo"), the usual instructor showing nothing on a row and the others as an initial.

## Visual calm (approved 2026-10-06; applied to the Logbook and Home)
The word budget limits how much there is to READ; visual calm limits how much there is to LOOK at. `client/scripts/check-calm.mjs` measures the first viewport of a real page (or of a static mockup with `--mockups`) and fails a screen over its limits: content elements above the first list row, accent-coloured elements, accent text as a share of the screen, rows on the first screen, font weights, row shapes, dividers, how far down the first row starts, and any accent-coloured list numeral. Limits: list screens (Logbook, Travel) at most 10 elements above the first row, 4 accent elements, 0.5% accent text, 3 to 8 rows (history is collapsed to month lines, so a month can hold only a few), 3 weights, 2 row shapes, 3 lines, first row within 400px, no accent numerals; Home at most 8 elements, 4 accents, 0.5% accent text; other screens 12 / 6 / 2.5%. Mockups: `docs/design/logbook-bcalm.html`, `docs/design/home-bcalm.html` (built by `docs/design/bcalm/build.mjs`); the measured before and after numbers are in `docs/design/bcalm/measured.json`.


### B-calm as built (Logbook and Home)
Hero with a thin line toward the 40 h total-time minimum; Flying pages sit behind the "Logbook ⌄" title menu (no tab strip); only the current month is open (the rest are one-line month headers, remembered for the session; the calendar button jumps to any month); ground sessions stay behind a one-line dot and a sheet; the Add button hides while scrolling down and the Ledger scroller stops short of it. Checks: check-logbook.mjs (behaviour), check-invariants.mjs (totals), check-calm.mjs, check-words.mjs, check-boxes.mjs.

## Calm Phase C and Travel (2026-10-07)
Travel, Stats, More, Aircraft, Settings and Import/export follow the B-calm style. **Travel:** one hero ("Passenger", violet dot, hours), a control row (year jumper, search, filter), one solid surface per year with the current year open and earlier years one line each (hours neutral white), three items per row (date, route, hours; the airline and flight number stay in the accessible name). Year headers sum to the hero. **Rows show the instructor only when it differs from the usual one** (the most frequent in the data), "Solo" when a flight has none; the full name is always in the accessible name and the detail, and the filter sheet has an instructor filter. **Stats:** a role-scoped figure per tab (not a button), one segmented control for the tabs, flat chart sections that are collapsed on a phone except the first; a collapsed card does not render its body (no zero-size controls). **More:** every row leads somewhere (the reserved Airports row was a dead tap). **Aircraft:** one list, tail and short type, hours in the role they were flown (sky or violet dot). **Settings:** the Reduce transparency switch is a 44px control. A tap on the active tab scrolls to the top and focuses the content. A tap outside an open menu only dismisses it (the click is swallowed once).

## Changes to the checks (B-calm and Phase C), with reasons
Every change to a check since the Phase B gate. None lowers a protection without saying so.
- **Calm check, minimum rows on a list screen: 5 to 3** (`check-calm.mjs`, `LIMITS.list.rowsMin`). Why: the B-calm hero plus 72px rows and collapsed months leave about four rows on a phone's first screen. Still enforced: at most 8 rows, at most 10 elements above the first row, 4 accent elements, 0.5% accent text, 3 font weights, 2 row shapes, 3 lines, the first row within 400px, no accent numerals. The lower bound only guarded against a nearly empty list; a layout that crowded the list out is still caught by "above the first row" and "first row px". Real data measures 4 rows at 390px, which would fail a minimum of 5.
- **Desktop rows 72px to 80px** (a design change, not a check change) so that no more than 8 rows fit the 1440px first screen; the maximum of 8 is unchanged.
- **Interaction audit, wait for the Add button** (`check-interactions.mjs`): before testing a control, if the Add button is hidden by scrolling, wait 1.1 s for it to come back. Threshold unchanged (no time limit was added or loosened); the button hides on scroll down by design and returns when idle, and without the wait the audit reported a covered control that was only momentarily hidden.
- **Interaction audit, scrim tap position:** 24px (before) to 3px (a change in `9bfc6df`) and back to 24px (now). The 3px tap landed above the top bar and so never exercised the bar; at 24px it found a real defect (a tap on the bar while a menu was open also opened the Flying switcher). Fixed in the overlay layer (an outside tap only dismisses a menu), and the audit stays at 24px.
- **Control allowlist** (`controlAudit.js`, `content-row`): before, the calm list rows; added in `91ee62a`: `bc-hero`, `bc-mh`, `bc-row`, `bc-item`, `bc-status`, `bc-ground`, `bc-grow`, `bc-pickrow`, `bc-map`; added with Phase C: `bc-hd` (the Stats section header). All are whole-row solid content links or disclosure rows, like the already allowed `mn-row` and `mn-fold`; none is a glass control, and tap size is checked separately by the interaction audit.
- **Stricter, not looser:** `check-glass-spread.mjs` now also scrolls Logbook and Home under the top bar and applies the colour-spread limits there; `check-sheet-drag.mjs` (new) covers closing a sheet by drag; `check-home-numbers.mjs` (new) covers the passenger side that `verify-baseline.js` does not.
- **Adapted to the new structure (same thresholds):** `check-topbar.mjs` checks for the Flying switcher in the bar instead of the removed tab strip; `check-invariants.mjs` reads month lines and the hero sheet; `check-layout.mjs` reads the calm row classes on Logbook and Travel.

## Phone polish (2026-10-09)
- **The hour goal.** The Logbook and Home hero read "of 50 h": the goal is the existing goal setting (`pilot_settings.hours_target`, typed on Stats, Pilot tab, "Progress toward your goal", Set a target), default 50 h until one is typed. The 40 h FAA total-time minimum stays in the milestone engine untouched and is shown as a tick on the same line (and in the hero sheet).
- **One self-hosted font.** Inter (variable, latin, OFL) from `/fonts`, preloaded, with a metrics-matched fallback so nothing re-wraps when it arrives. It replaces the system font on iPhone, Inter and Space Grotesk from Google, so a wrapped line measured in a test is the line on the phone. `text-size-adjust: 100%` on the page; `overflow-wrap: break-word` (never `anywhere`, which shrinks a flex item's minimum width and breaks words early); balanced headings and short labels; a number and its unit do not part.
- **Legible glass.** The bars' tint floor is 50% (was 10%) and menus and sheets 92% (was 35%), blur 10px (was 6px): text scrolling under a bar no longer ghosts through its title and a sheet never lets rows show through where a browser paints no blur. This is a token change to the approved glass; it keeps the same look on a calm backdrop.
  **Approved by the owner 2026-10-09 (accepted for now).** Exact values, `tokens.css`: `--ds-g-tint-lo` `rgb(24 24 28 / 0.10)` → `rgb(12 12 16 / 0.50)`; `--ds-g-tint-pop` `rgb(12 12 16 / 0.35)` → `rgb(12 12 16 / 0.92)`; blur 6px → 10px. Reason: text ghosted through the bars.
  **Proposed, not built: a stronger scroll-edge fade.** `.ds-edge` already fades the top 120px (50% → 22% → 0) and the bottom 150px (60% → 25% → 0). If the top edge were solid page-black behind the bar's own height and then fell to 0 over about 40px (and the bottom the same behind the tab bar), content would already be hidden where a bar sits, so the bar tint could return toward 25–30% without ghosting and the glass would show more of the page's colour. Costs: one gradient change in `glass.css`, then re-run `check-contrast`, `check-glass-spread` and `check-scroll`; the page's first row would need the same 40px of room it has now. Decision for the owner.
- **More** is three grouped surfaces (Explore, Your data, App): an icon tile, a title, one short line and a chevron at the row's own edge; every row is a real destination; the Add button is hidden there and on Settings (a menu page has nothing to add).
- **Phone rules** (checked by `check-phone.mjs`): every field is at least 16px on a touch screen (Safari zooms the page on focus otherwise); rows with a trailing value keep clear of the Add button by `--fab-clear` (60px at 100% text, 52px on a surface), which is the button's own rem width plus its edge gap less the page gutter, so it grows with the text size instead of staying at a fixed 60px.

## Scroll behaviour and the phone viewport (2026-10-09)
- **One rule for every scroll-linked piece:** the same scroll position always gives the same state, and position 0 is always the initial state. The logic is pure (`lib/scrollstate.js`, tested with negative, NaN and huge values): scroll is clamped to `[0, max]` first, so an iOS rubber-band (negative at the top, past the end at the bottom) can never flip the tab bar, the Add button, the title progress or the keyboard flag.
- **Glass tint is re-sampled when scrolling settles and when a bar's own transition ends** (`glass.js`). The tab bar used to be sampled mid-collapse and never again, so after scrolling away and back to the top it could stay "clear" and rows ghosted through it. `check-scroll.mjs` compares load and round trip, flags and pixels.
- **Keyboard inset** counts only with a focused text field, an unzoomed page and a keyboard-sized gap; a negative `visualViewport.offsetTop` (rubber-band) and pinch-zoom are never a keyboard.
- **Viewport units:** `svh` (not `dvh`, never `vh`) for page min-height and the sheet height, so the page's scroll extent and the sheet do not change while Safari's toolbar slides. Side safe areas (`--ds-side`) keep the gutter, tab bar, Add button, menu and sheets out from under a landscape notch.
- **Backgrounds:** `html` is `#000` inline before anything loads, `body` and `.ds-root` are black, `theme-color` and the manifest colours are `#000000`; nothing paints white or gray behind a rubber-banded page. There is no `background-attachment: fixed` (iOS ignores it and repaints slowly).
- **Overscroll:** `overscroll-behavior-y: contain` stays on `html, body`. Per the spec `contain` keeps the native bounce and only stops scroll chaining; `none` would also remove the bounce. WebKit still ignores both for the root in places (bugs 275947, 176454), so changing it gains nothing. Pull-to-refresh and the bounce are not disabled by this app.
- **Diagnostics:** `?debug=1` on any URL shows a small panel (scrollY and max, innerHeight, visualViewport height, width, offsetTop and scale, safe-area insets, standalone or browser, glass level, title progress, bar tint, Add button, tab bar, month header stuck, keyboard flag, build id) with a copy button; `?debug=0` turns it off. It reads nothing from the app and makes no request.

## Home hub (2026-10-09, direction A "Board")
Greeting, the hero (Private Pilot, out of the hour goal, the 40 h FAA minimum as a tick), one status line, a short band of the map directly under the hero (9rem on a phone, 13rem from 1024px; tap opens the Map), then one tile per module that exists: Logbook, Travel, Map, Aircraft, Currency, Milestones, Weather, Costs. Hub rules: at most 8 tiles on the first two screens; a tile is its name and one value (the same number its own page shows); one accent number per tile; at most 70 visible words on the first two screens; every tile a real link, at least 72px tall (92px built) with a 44px target; no tile for a module with no page. Dots tell the scope: sky = pilot only (Logbook, Milestones, Costs), violet = passenger (Travel), none = all roles (Map, Aircraft); Currency carries its ok / warn status dot. The Map tile counts the airports of every flight (the Map's own "All"); the passenger-only airport count is on Travel and Stats.

## Aircraft photos (2026-10-11)
A real photo of the aircraft, by registration, where the app shows one aircraft: the aircraft's own page and the flight detail (pilot and passenger). One component (`components/AircraftPhoto.jsx`, pure logic in `lib/aircraftPhoto.js`, styles in `ds/aircraftphoto.css`). It is the only place the app asks a third party for anything other than map tiles.
- **Source and terms.** The free public Planespotters photo API (`api.planespotters.net/pub/photos/reg/<REG>`), called from the browser only, with the terms at planespotters.net/photo/api applied: the photographer is credited in text on the photo ("Photo: <name> / Planespotters.net"); the whole photo is a plain link (new tab, `rel="noopener"`, never nofollow) to the page URL the API returned, used unchanged; image and link URLs are used exactly as given (never proxied, rewritten or re-hosted); nothing is written to storage and the image is never kept after it leaves the screen; JSON may be cached at most 24 hours (here: the page session only, in memory).
- **Nothing stored, nothing shared.** No database, no localStorage, no file, no service-worker cache, no export or backup, no print or share page (`@media print` hides it; the print summary and the public share page do not contain it). A reload starts empty. A response is accepted only if its URLs are https on a planespotters.net or plnspttrs.net host.
- **Third-party privacy.** The request carries the registration and nothing else: `credentials: 'omit'` (no cookies), the referrer trimmed to the origin (`referrerPolicy: 'origin'`, which also satisfies the API's Origin-or-Referer rule), no custom headers, no query. It never fires without a registration (a passenger flight with none does nothing; a simulator is skipped), under Save-Data, or while offline.
- **It never gets in the way.** The request starts only when the frame is within 200px of the screen, nothing waits on it, and it is abandoned after 8 seconds. Any failure (no photo, an error, a bad answer, an image that will not load, offline, slow) leaves the drawing and shows no text at all.
- **Layout.** A 3:2 frame (max 26rem wide) is reserved from the first paint, so the page never moves when the photo arrives (`check-aircraft-photos.mjs` asserts the frame and the content under it do not move and the layout shift on them is 0). The photo is `object-fit: cover`; its corners follow the card radius (`--mn-r` on the minimalist pages, 1.25rem on the aircraft form via `.ap-card`); the credit sits on a 72% to 0 black scrim so it reads on any photo; the credit is sentence case, never caps; tokens only.
- **The drawing.** One calm line drawing per type class (single-engine piston, twin piston, jet airliner, generic), chosen by the aircraft's class and ICAO designator (`chooseIllustration`); unknown means generic, never a guess.
- **Words.** The only words added are the credit: two fixed words ("Photo:", "Planespotters.net") plus the photographer's name, shown only when a photo is. Nothing else, no error text and no label.
- **Checks.** `check-aircraft-photos.mjs` (mocked answers: photo, none, error, 500, malformed, bad JSON, image 404, slow, offline, Save-Data; WebKit and Chromium at 390 and 1440). `check-fonts.mjs` lists the photo hosts explicitly as the only third-party hosts besides map tiles. `client/scripts/lib/playwright-photo-stub` is a drop-in `PLAYWRIGHT_CORE` that answers the photo hosts with a stub, so no verification run ever contacts the real service.

## Rows inside a card, and the device matrix (2026-10-13)

- **One inset for every row in a card** (`.mn-card`): a key/value row, a disclosure row (`.mn-fold`, which includes "All times", "Landings and approaches",
  "Cost", "Local times") and an opened block all sit 8px in from the card's padding, so labels share one left edge and values and chevrons share one right
  edge, and every row equals the card's inner width. Before this a disclosure was inset 16px and, on phones and iPads below 1024px, a further Add-button
  clearance on its right, so it read narrower than the card. The Add button's clearance stays on list rows, ledger and status rows (`bcalm.css`); a row in
  a card clears it by the page's bottom padding and because the button hides while the page scrolls. A value that wraps under its label keeps the right edge.
- **Layout modes by width:** below 1024px the floating bottom tab bar (phones, iPad mini and iPad portrait up to 1023px; the content column is the top bar's
  own width, at most 72rem at 768 to 1023px); from 1024px the side rail (iPad Pro portrait, iPad landscape, desktop). The map is full-bleed under the rail
  by design. There is no intermediate layout.
- **Viewport settle:** if the visual viewport is left offset or inset with no text field focused and no pinch zoom (iOS can do this after a keyboard closes),
  the shell scrolls to the position it is already at after the page settles, which re-anchors the fixed bars. `?debug=1` shows the tab bar's bottom offset
  (CSS and visual), the keyboard inset, the open overlay count and how many corrections were made.
- **Checks added:** `check-card-width.mjs` (rows equal the card's inner width and share their label and value edges), `check-tabbar.mjs` (the tab bar's
  layout offset never changes across navigation, tab, form, keyboard, sheet and Back sequences; a stuck viewport is corrected, a pinch zoom is left alone),
  `check-matrix.mjs` (every device in `lib/devices.mjs` by route category: no horizontal overflow, the right layout mode, nothing under the bar or Add
  button, no phone column floating in a tablet, touch targets of 44px). The interaction audit now closes any popup tab at once: a link that opens a new tab
  (the aircraft photo credit) takes focus from the audited page, and a backgrounded page never finishes opening a sheet, which left the next sheet covering
  every control after it.

## Keyboard frame (while a text field has focus)

iOS Safari resizes and pans the visual viewport the moment a field is focused and re-rasterises every fixed element that carries a `backdrop-filter`
each frame, while the glass sampler, the scroll-linked collapse handlers and CSS transitions all fire at once: the whole screen flashes. So the frame
is **calm and solid while a field is being typed into**, and the glass returns afterwards.

- **State:** `html.kb-open`, set by `ds/keyboard.js` from the pure rules in `lib/keyboardState.js` (focusin/focusout on input, textarea, select,
  contenteditable; debounced 150 ms so a field-to-field move never flickers). It clears on blur, when the visual viewport is full height again, on a
  tap away from the field, on a route change, when a sheet closes and on pagehide/hidden; a 1 s reality check clears it if no text field is
  actually active (hard cap 10 min). It can never stick.
- **While set (`ds/keyboard.css`):** no `backdrop-filter` on any element (the glass layers go through the Solid tokens and the property is also
  forced off), no transitions or animations on glass/fixed layers, the tab bar, the Add button, its menu and the bottom edge fade are hidden
  (`visibility`, so nothing re-measures on return), the glass sampler, the collapse/title/Add-button scroll handlers and the Auto quality frame
  monitor pause, and the form's Save bar keeps sticking, lifted by `--kb-inset` (visual-viewport measure).
- **Rule for new UI:** a fixed or sticky element with a blur must be a `.ds-glass` (so the frame can solidify it); never add a bare
  `backdrop-filter`, a permanent `will-change: transform` on something always on screen, or a transition on a fixed layer outside the frame's list.
- **Debug:** `?debug=1` shows the frame state, the count of backdrop-filtered elements and the last focus event.
- **Checks:** `client/scripts/check-keyboard.mjs` (fails on the pre-fix build). It cannot see real iOS: `docs/design/_private/PHONE_TEST.md` is the
  real-phone list.

## Passenger time fields and the Ledger on a phone

- Departure/arrival times: one-line labels, equal-width boxes (two columns while both fit at the current text size, one column below that), hints
  under the box; native date/time inputs share one recipe (`.gl-field[type=time|date]`: block, `min-width: 0`, 48px, left-aligned, 16px).
- The phone Ledger is the B-min five columns (Date, Total, PIC, Dual, Ldg) at 13px figures and 4px cell padding so they fit before the Add
  button's clearance at 100% text from 360px; the month line carries only the month name (the Flights subtotal row carries the figures); a ground
  session says Ground in the columns it does not use; the header and the totals row are not sticky (the mockup's are not, and sticky inside a
  sideways scroller never worked). Larger text scrolls sideways.
- Checked by `client/scripts/check-phone-forms.mjs`.
