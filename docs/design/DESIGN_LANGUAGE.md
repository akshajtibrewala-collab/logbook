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
one open overlay blur), `client/scripts/check-layout.mjs` (primary navigation visible at 920 to 1920px and 1 to 1.5 device pixel ratio, no horizontal scroll, no clipped search placeholder or Flying tab at 320 to 430px and 100 to 200% text, full-height divider, a date on every row, badges at least 4px from adjacent text), `client/scripts/check-words.mjs` (word budget, see Minimalism rules) and `client/scripts/check-contrast.mjs` (switch knob against its track on real pixels at every glass level). The build id (git short hash, build time) is shown in Settings and on `/design` so it is clear which build is on screen. `client/scripts/check-home-numbers.mjs` (read-only, on real data) proves that Home, Travel, Stats and Map agree: pilot hours (the Logbook total), passenger hours, passenger flights, airports and countries, the all-flights distance Home uses and the passenger-only distance Stats uses (the difference is the pilot routes), the greeting with the name, the status line, and that the year headers on Travel sum to the Travel total. `verify-baseline.js` is pilot-only, so run both. `client/scripts/check-scrub.mjs` fails when anything this branch added contains the real figures, names, tails or references listed in the private, gitignored `client/scripts/.local-expected.json` (which also holds the real and production expectations the Home numbers, invariants and `check-prod-shape.mjs` checks read). `check-prod-shape.mjs` is run against a scratch copy restored from a production backup (never against production): total spent, cost per pilot hour, the blank-instructor flights (no false "Solo"), the usual instructor showing nothing on a row and the others as an initial.

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
