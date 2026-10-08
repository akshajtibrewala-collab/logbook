# Word and style counts (measured, not estimated)

Measured by `client/scripts/check-words.mjs`: visible words in the first viewport (390 x 844 phone, 1440 x 900 desktop frame). A word is a token with a letter or digit, so "·" costs nothing but a unit like "h" counts. The top bar, tab bar, Add button, rail and the Flying tab strip are navigation chrome: reported in the "chrome" column, not charged. "Styles" = distinct size/weight/caps combinations; "sizes" = distinct small text sizes (numerals of 28px and up are free); "caps" = all-caps labels.

## 1. Logbook, current direction B vs B-min

| Screen | Words before | Words after | Styles before | after | Sizes before | after | Caps before | after |
|---|---|---|---|---|---|---|---|---|
| Phone list | 65 | **40** (budget 40) | 11 | 8 | 3 | 2 | 2 | 0 |
| Phone scrolled | 74 | 61 (not charged: it is a scroll position) | 6 | 3 | 2 | 2 | 0 | 0 |
| Phone ledger | 87 | 97 (dense by design, exempt) | 6 | 5 | 2 | 1 | 10 | 0 |
| Phone empty | 23 | **6** | 3 | 2 | 1 | 1 | 0 | 0 |
| Desktop list | 122 | **60** (budget 80) | 11 | 8 | 3 | 2 | 3 | 0 |
| Desktop ledger | 114 | exempt | 10 | | 3 | | 19 | |
| Desktop open flight | 84 | **65** (budget 80) | 11 | 6 | 3 | 2 | 5 | 0 |

New in B-min: loading (0 words, shapes only), month sheet (33), aircraft sheet (48). The Ledger is exempt from the word limit by design and was not tuned for it (97 words vs 87); what changed is its look: all-caps labels 10 to 0, calmer spacing, aligned columns.

### Phone list: every piece of text and what happens to it

| Text (before) | Words | Decision |
|---|---|---|
| "PRIVATE PILOT" (12px caps) | 2 | Stays, sentence case, 17px muted. This is the one-word scope. |
| "TOTAL TIME, PILOT FLIGHTS" (caps) | 4 | Goes: it is the bar's accessible name and tooltip. |
| "0 h" / "40 h minimum" / "each block is 2 h" | 2 + 3 + 5 | Becomes "0" and "40" (units live on the hero numeral); the block note goes with the blocks (smooth bar). |
| "8.60 h to go" | 4 | Shrinks to "8.60 left" between the two ends. |
| "1 of 6 requirements met" | 5 | Merges into a chip reading "1/6" that opens Milestones. |
| Chips "All 31.40 h", "N123AB 12.10 h", ... | 7 | Tail only; hours on tap (aircraft sheet) and in the tooltip. "All" becomes an icon. |
| "20 flights · 31.40 h · 6 ground sessions · 9.10 h" | 9 | Behind a tap (filter and month sheets, the Ledger totals row). |
| "September 2026" + "7.50 h" + "· 4 flights" | 6 | "September" + "7.50" (3); the count goes behind the month name. |
| "Ground 1.50 h · 1 session" | 5 | A dot beside the month name; hours in the month sheet. |
| "Local · KSUS" | 2 | "Local KSUS" (airport once). |
| "09/12/2026 · J. Rivera" | 3 | Date block shows the day numeral only; second line is the instructor (2). |
| "2.60 h" on each row | 2 | "2.60": unit omitted, the hero already says hours. |

## 2. The rest of the app: current app vs the minimal mockups

"Before" is the current app (production build) on the scratch placeholder data, so it carries real feature content; "after" is the mockup with the same placeholder data. The mockups show fewer items per list than a full page would, so read the after column as the shape of the first screen, not a promise for every dataset.

| Screen (phone, 390) | Words before | Words after | Budget | Styles before | after | Caps before | after |
|---|---|---|---|---|---|---|---|
| Home | 48 | 31 | 45 | 8 | 7 | 4 | 0 |
| Flight detail | not measured | 17 | 45 | | 5 | | 0 |
| Travel | 53 | 24 | 40 | 8 | 7 | 0 | 0 |
| Costs | 49 | 14 | 45 | 8 | 5 | 0 | 0 |
| Costs · Expenses / Spending | not measured | 21 / 13 | 45 | | 3 / 3 | | 0 |
| Currency | 70 | 16 | 45 | 5 | 3 | 0 | 0 |
| Milestones | 60 | 17 | 50 | 6 | 5 | 2 | 0 |
| Weather | 33 | 13 | 45 | 2 | 5 | 0 | 0 |
| Stats | 52 | 13 | 40 | 8 | 4 | 1 | 0 |
| Map | 5 | 5 | 25 | 2 | 2 | 0 | 0 |
| Aircraft | 32 | 6 | 40 | 5 | 2 | 0 | 0 |
| More | 52 | 10 | 40 | 5 | 1 | 3 | 0 |
| Log a flight (form, pilot / passenger) | 34 | 25 / 22 | 55 | 8 | 9 / 9 | 1 | 0 |

Desktop (1440) counts are in `docs/design/minimal-app.html` via `node client/scripts/check-words.mjs --mockups <url>`: Home 31, Flight detail 17, Travel 24, Costs 14, Currency 16, Milestones 17, Weather 13, Stats 13, Map 5, Aircraft 6, More 10, Log a flight 19 / 16, each under twice its phone budget.

## 3. What the minimal version makes slower or harder, and the offset

| Cost | Offset |
|---|---|
| One extra tap to see a month's ground hours, an aircraft's hours, the requirement list, or the counts line. | A dot marks only months that have ground time; the Ledger shows every number at once; tooltips and accessible names carry the hidden values. |
| The year is not on every row; the date shows as a day numeral. | The full MM/DD/YYYY is the row's accessible name and tooltip and is always in the Ledger and the print view; a year header appears when the list spans years. |
| Tail and aircraft type are not on the row. | Chips filter by tail; the flight detail and the Ledger carry them. Open question: put the tail on the row's second line when it fits (it would exceed the six-word limit). |
| The hero's "to go" figure and requirement count are smaller. | The 1/6 chip is a 44px target straight into Milestones; the bar's accessible name reads the full sentence. |
| Fewer visible labels can read as ambiguous. | Scope stays one word on every screen (Private Pilot, Passenger, All / Pilot / Passenger). |
