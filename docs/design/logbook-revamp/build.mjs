// Builds the Logbook revamp mockups (static HTML, NO app code):  node docs/design/logbook-revamp/build.mjs
// Writes revamp.html (overview, comparison, recommendation) and revamp-a.html, revamp-b.html, revamp-c.html, revamp-hybrid.html into docs/design/.
// Serve them with `node docs/design/serve.mjs` (phone-reachable on the Wi-Fi). All data is placeholder (see lib.mjs).
import { FLIGHTS, GROUND, PILOT_TOTAL, GROUND_TOTAL, I, phone, desk, menu, ADD_ITEMS, page, write, filterSheet, noMatch, fmt, countsLine, flyTabs } from './lib.mjs';
import * as v from './views.mjs';

const back = `<button class="ds-iconbtn" aria-label="Back">${I('back')}</button>`;
const pf = (o) => phone(o);
const nav = (cur) => `<nav class="topnav" aria-label="Mockups">${[['revamp.html', 'Overview', 'o'], ['revamp-a.html', 'A · Progress-first', 'a'], ['revamp-b.html', 'B · Ledger', 'b'], ['revamp-c.html', 'C · Flight cards', 'c'], ['revamp-hybrid.html', 'Hybrid (recommended)', 'h']]
  .map(([h, l, k]) => `<a class="gl ${k === cur ? 'pilot' : 'clear'} gl-chip" href="${h}">${l}</a>`).join('')}</nav>`;
const sec = (id, title, note = '') => `<h2 class="s" id="${id}">${title}</h2>${note ? `<p class="note">${note}</p>` : ''}`;
const row = (...figs) => `<div class="row">${figs.join('')}</div>`;
const sc = (html) => `<div class="scrollx">${html}</div>`;
const addMenu = menu(ADD_ITEMS);

function direction(key, { name, tagline, logbook, detailFn, detailTitle, filter, empty, loading, listFn, deskFigs, notes, truths }) {
  const body = `${nav(key)}<h1 class="t">${name}</h1><p class="lead">${tagline}</p>
  <p class="note"><b>Placeholder data.</b> Names, tails and airports are invented. The hours mirror the shape of the real logbook: ${FLIGHTS.length} flights (${fmt(PILOT_TOTAL)} h, almost all local KSUS) and ${GROUND.length} ground sessions (${fmt(GROUND_TOTAL)} h, shown separately). Every frame scrolls; phone frames are 390 px wide, desktop frames 1440 px (scroll sideways).</p>
  ${sec('logbook', '1 · The logbook screen', truths.logbook)}
  ${sc(row(pf({ title: 'Logbook', body: logbook, cap: 'Top of the screen at 390 px.' }), pf({ title: 'Logbook', body: logbook, cap: 'Add menu open (Quick log, Copy last flight, Add flight, Log ground session).', fabOpen: true, menuHtml: addMenu, scrim: true }), ...(listFn ? [listFn()] : [])))}
  ${sc(row(...deskFigs))}
  ${sec('filter', '2 · Filter and search', 'Date range, aircraft type, category, All / Flights / Ground, sort and text search are all kept. The Filter sheet is the existing glass sheet.')}
  ${sc(row(pf({ title: 'Logbook', body: filter, sheet: filterSheet(), scrim: true, cap: 'Filter and sort sheet.' }), pf({ title: 'Logbook', body: filter, cap: 'Filtered result: removable chips, and the counts line names what it counts (“Matching: …”).' }), pf({ title: 'Logbook', body: flyTabs() + '<div class="mk-bar">' + `<label class="mk-search gl-field">${I('search')}<span>zzz</span></label>` + '</div>' + noMatch, cap: 'No matches.' })))}
  ${sec('detail', '3 · Flight detail and ground-session detail')}
  ${sc(row(pf({ title: 'Flight', left: back, body: detailFn(19), cap: detailTitle }), pf({ title: 'Flight', left: back, body: detailFn(20), cap: 'A flight with no debrief logged shows no empty debrief block.' }), pf({ title: 'Ground session', left: back, body: v.groundDetail(6), cap: 'Ground session detail: it has a date, and its hours are labelled as ground time, never as flight time.' })))}
  ${sec('states', '4 · Empty and loading states')}
  ${sc(row(pf({ title: 'Logbook', body: empty, cap: 'Empty: nothing logged yet.' }), pf({ title: 'Logbook', body: loading, cap: 'Loading: skeletons in the final layout, so nothing jumps.' })))}
  ${sec('log', '5 · Log a flight', 'A focused screen (forms hide the tab bar) with the Save bar as real glass in the tab bar’s slot. It is prefilled from the last flight (aircraft, instructor, route), has fast time entry, landing steppers, category chips and the debrief notes. There is no Hobbs field; the calculator is a scratch tool and saves nothing.')}
  ${sc(row(v.logPhone({ dir: key.toUpperCase() }), v.logPhone({ dir: key.toUpperCase(), kb: true }), v.logPhone({ dir: key.toUpperCase(), pax: true })))}
  ${sc(row(v.logDesk({ dir: key.toUpperCase() })))}
  ${sec('cap', '6 · How every capability is reached, and what gets slower')}${notes}`;
  write(`revamp-${key === 'h' ? 'hybrid' : key}.html`, page({ title: `Logbook revamp · ${name}`, body }));
}

const CAPS_HEAD = '<thead><tr><th>Capability</th><th>How you reach it</th><th>What gets slower or harder</th></tr></thead>';
const table = (rows) => `<table class="mk-cmp">${CAPS_HEAD}<tbody>${rows.map(([a, b, c]) => `<tr><th>${a}</th><td>${b}</td><td>${c}</td></tr>`).join('')}</tbody></table>`;
const COMMON = [
  ['Add menu: Quick log, Copy last flight, Add flight, Log ground session', 'The same Add button (floating on phone, in the top bar on desktop) and the same four items.', 'Nothing. It is not touched.'],
  ['Share, Costs, Aircraft, Import / export', 'Unchanged: the “…” menu on the Flying pages (Share, Import & export), the Costs tab, and More → Aircraft.', 'Nothing.'],
  ['Flight review form (Currency)', 'Flying → Currency tab, unchanged. Direction A adds currency chips on the Logbook that jump straight to it.', 'Nothing.'],
  ['Passenger flights', 'Travel tab, its own page with its own violet scope, unchanged.', 'Nothing.'],
  ['Routes and links', 'Every URL keeps working: /logbook, /logbook/:id, /logbook/ground/:id, /logbook/new, /logbook/quick, /logbook/print, /logbook/share, /logbook/data, /flying and the rest. Any new view state is a query parameter on /logbook (for example ?view=ledger), never a new path.', 'Nothing.'],
];

direction('a', {
  name: 'Direction A · Progress-first',
  tagline: 'The top of the screen answers “how close am I to the checkride?” using the existing milestone engine (nothing recomputed): requirement bars with what is still needed, and currency chips. Below, the same list grouped by month, where each row shows what the flight counted toward.',
  logbook: v.aLogbook(), detailFn: v.aDetail, detailTitle: 'Detail adds “Counted toward your checkride”: the before and after for total time, the instructor-training requirement, and landings.',
  filter: v.aFilter(), empty: v.aEmpty(), loading: v.aLoading(),
  listFn: () => pf({ title: 'Logbook', body: v.aLogbook({ open: true }), cap: 'All requirements expanded (the “All 6 requirements” link).' }),
  deskFigs: [v.aDesk()],
  truths: '<b>Honest note on the data:</b> the engine’s Private rows are total time, instructor training, cross-country training, night training, solo and solo cross-country; the manual ones (checkride-prep hours, takeoffs and landings to a full stop) are checkbox items. Instrument time appears for the Instrument rating and Commercial; “landings” is a count, not an hours requirement. The certificate chip switches which certificate the bars show. With 26 near-identical local flights a per-row “counted toward” line would be noise, so rows show only dual, landings and a running total; the real information is in the bars.',
  notes: `<p class="note"><b>Month headers show flight hours only</b> (“6.00 h · 4 flights”); ground time sits beside it, muted (“· 1.80 h ground · 1 session”). The counts line reads “${countsLine()}”. Ground rows carry a date and a ground badge.</p>${table([
    ['Date range, aircraft type, category, text search, sort, All / Flights / Ground', 'The Filter sheet and search bar under the progress block, exactly as today.', 'The progress block pushes the first row down about 250 px on a phone. Mitigation: it collapses to three bars, and scrolls away like any content.'],
    ['Per-row cost', 'Small under the hours on every row, as today.', 'Nothing.'],
    ['Tap a row for detail', 'Opens detail (full screen on phone, right pane on desktop).', 'Nothing.'],
    ...COMMON])}
  <p class="note"><b>Honest assessment.</b> Best at job 2 (progress) and good at job 1 (the Add flow shows what saving will add). Job 3 (reading it like an examiner) is only as good as the list: there are no columns to compare PIC, dual, solo side by side.</p>`,
});

direction('b', {
  name: 'Direction B · Ledger',
  tagline: 'A real logbook page: one line per flight with date, aircraft and tail, route, total, PIC, dual, solo, night, cross-country and landings. Sticky header, month subtotals, a running “totals to date” footer. Phone rows are compact and expand to every column.',
  logbook: v.bLogbook(), detailFn: v.bDetail, detailTitle: 'Detail as a ledger line: every column as a label / value row, with previous and next entry arrows to read down the book.',
  filter: v.bFilter(), empty: v.bEmpty(), loading: v.bLoading(),
  deskFigs: [desk({ title: 'Logbook', body: v.bDesk(19), extra: '', cap: 'Desktop ledger: a table, sticky header, month subtotals (flight totals only), a “totals to date” footer. Click a row to open the drawer; click a column to sort.' }),
    desk({ title: 'Logbook', body: v.bDesk(19) + v.bDrawer(19), cap: 'The row’s detail opens as a drawer over the right side, so you can keep reading the table.' })],
  truths: '<b>Relation to the print view.</b> The print view (/logbook/print) stays a separate, always-white page, but the ledger is its on-screen twin: the same columns and the same “flight totals” rows, so what you see is what an examiner gets. A later step could make both render from one component. The share link stays a narrow summary and is not touched. <b>Honest note:</b> with 26 local flights the Route column says “KSUS–KSUS” on every line, so it is narrow and grey; the Aircraft / tail and Instructor are what differ.',
  notes: `<p class="note"><b>Month headers show flight hours only</b>; ground sessions are grey ledger lines marked “Ground” with their hours in the Total column of their own row only, and are excluded from every subtotal. The footer reads “Pilot totals to date (flights only)”.</p>${table([
    ['Date range, aircraft type, category, text search, sort, All / Flights / Ground', 'Desktop: search and an All / Flights / Ground switch sit above the table, Filter opens the same sheet, and column headers sort. Phone: the same Filter sheet.', 'Sorting by clicking columns is new; “Longest first” stays in the sheet. On a phone only the total is visible until a row is expanded, so scanning PIC or night means expanding rows.'],
    ['Per-row cost', 'Phone: inside the expanded row. Desktop: a “Cost” column can be switched on from Filter.', 'Cost is no longer visible on every line by default.'],
    ['Tap a row for detail', 'Phone: tap expands, “Open flight” goes to detail. Desktop: click opens the drawer, double-click or Enter opens the page.', 'One extra tap on a phone to reach the full detail.'],
    ...COMMON])}
  <p class="note"><b>Honest assessment.</b> Best at job 3 (history the way an examiner reads it) and good for totals. Weakest at job 2 (no “what is missing” without adding a progress block) and the least pleasant on a phone, where a table is a compromise.</p>`,
});

direction('c', {
  name: 'Direction C · Flight cards',
  tagline: 'Each flight is a card: big hours, aircraft, instructor, a debrief line when there is one, and a small pattern glyph for local flights (the dot sits further along the circuit with more landings). Cards group by month under the same flight-hours-only headers.',
  logbook: v.cLogbook(), detailFn: v.cDetail, detailTitle: 'Detail is the expanded card: hero hours, the circuit glyph, debrief panels, then the time grid.',
  filter: v.cFilter(), empty: v.cEmpty(), loading: v.cLoading(),
  listFn: () => pf({ title: 'Logbook', body: v.cDense(), cap: 'Compact density: flights without a debrief collapse to one slim line; ground sessions are always slim. This is the honest answer to 26 near-identical flights.' }),
  deskFigs: [v.cDesk()],
  truths: '<b>Honest note on 26 near-identical local flights:</b> in full-card mode they are 26 almost identical tiles, each ~150 px tall, so about four per phone screen against eight rows today. The circuit glyph only varies with the landing count, and most flights have no debrief to show. Cards earn their space on the few flights with a debrief, photos or a different route; so the screen defaults to Compact when most entries are plain, and offers Cards as a density option.',
  notes: `<p class="note"><b>Month headers show flight hours only</b>; ground sessions are slim cards with the ground badge, a date, and their hours in grey.</p>${table([
    ['Date range, aircraft type, category, text search, sort, All / Flights / Ground', 'The same Filter sheet and search bar; “Has debrief” is a natural extra chip.', 'Scanning by number is slower: nothing aligns in columns.'],
    ['Per-row cost', 'Small under the hours on the card.', 'Nothing.'],
    ['Tap a row for detail', 'Tap the card.', 'Nothing.'],
    ...COMMON])}
  <p class="note"><b>Honest assessment.</b> The prettiest, the weakest for this logbook’s data and for all three jobs: it adds the most scrolling and answers no progress question. I would not build it as the main view.</p>`,
});

direction('h', {
  name: 'Hybrid · A by default, with a List / Ledger switch',
  tagline: 'Direction A is the default. A List / Ledger switch beside the search brings in B’s table (compact expandable rows on phone, the full table on desktop). Cards are dropped, apart from the existing detail layout.',
  logbook: v.hybridPhone('List').match(/<div class="ds-scroll">([\s\S]*?)<\/div><div class="ds-edge bot">/)[1], detailFn: v.aDetail, detailTitle: 'Detail is A’s (with “Counted toward your checkride”), plus the ledger’s previous / next arrows when you arrived from the Ledger view.',
  filter: v.aFilter(), empty: v.aEmpty(), loading: v.aLoading(),
  listFn: () => v.hybridPhone('Ledger'),
  deskFigs: [v.hybridDesk('Ledger')],
  truths: 'The first frame is the List view, the third is the Ledger view; below, the desktop Ledger view. The choice is remembered per device, and is a query parameter (?view=ledger) so a link to the ledger works.',
  notes: `${table([
    ['Date range, aircraft type, category, text search, sort, All / Flights / Ground', 'One Filter sheet, one search bar, shared by both views (the same state, so switching view keeps your filters).', 'Nothing beyond A.'],
    ['Per-row cost', 'List: under the hours. Ledger: inside the expanded row, or a Cost column on desktop.', 'Cost is not on every ledger line by default.'],
    ['Examiner view and print', 'Ledger view, and /logbook/print unchanged.', 'None.'],
    ...COMMON])}
  <p class="note"><b>What it costs in complexity.</b> One extra view component (the ledger table and its expandable phone row), one shared grouping and totals module so both views show identical month and total numbers, one remembered preference, and one more thing to keep in step with the print view. The progress block reuses the Milestones engine as is. Roughly a third more UI than A alone, and nothing in the server or data. The invariants (month flight hours sum to the pilot total, ground separate, counts say what they count) live once in the shared module and are tested once.</p>`,
});

// ---------------------------------------------------------------- overview
const over = `${nav('o')}<h1 class="t">Logbook revamp · four directions</h1>
<p class="lead">Static mockups, no app code. Every frame uses the real design system (true black, Liquid Glass on the floating layer only, V-a buttons, the split-ring Add button, sky = pilot, violet = passenger, tokens only). Phone frames are 390 px, desktop frames 1440 px. <b>Everything is placeholder data</b> that mirrors the logbook’s shape.</p>
<div class="row" style="gap:12px;margin:1rem 0">${[['revamp-a.html', 'A · Progress-first', 'Checkride progress on top, rows say what they counted toward.'], ['revamp-b.html', 'B · Ledger', 'A paper-logbook page: columns, subtotals, expandable rows.'], ['revamp-c.html', 'C · Flight cards', 'Rich cards; honest about 26 near-identical flights.'], ['revamp-hybrid.html', 'Hybrid (recommended)', 'A by default, B one tap away.']].map(([h, t, d]) => `<a href="${h}" class="mk-reco" style="width:300px;text-decoration:none;color:inherit"><b style="font-size:1.125rem">${t}</b><p class="ds-sub" style="margin:.4rem 0 0">${d}</p></a>`).join('')}</div>
${sec('inv', 'Rules every direction keeps', '')}
<table class="mk-cmp"><tbody>
<tr><th>Month and year headers show FLIGHT hours only</th><td>The August header that read 30.30 h (22.80 flight hours plus 7.50 ground hours) mixed in ground hours. Here a month reads “22.80 h · 15 flights”, with ground time beside it, muted and labelled (“· 7.50 h ground · 5 sessions”).</td></tr>
<tr><th>The sum of all month flight hours equals the pilot total</th><td>${fmt(PILOT_TOTAL)} h in the strip, ${fmt(PILOT_TOTAL)} h across the headers (1.10 + 22.80 + 6.00). This is asserted when these pages are built, and becomes a test in the build.</td></tr>
<tr><th>Entry counts say what they count</th><td>“${countsLine()}”, never “26 entries · 38.40 h”.</td></tr>
<tr><th>Ground sessions show a date and a badge</th><td>No row lacks a date block.</td></tr>
<tr><th>Pilot-only</th><td>The Logbook is pilot flights plus ground sessions; Travel is its own page. Cost, share and print behave as today.</td></tr></tbody></table>
${sec('cmp', 'Side by side')}
<table class="mk-cmp"><thead><tr><th></th><th>A · Progress-first</th><th>B · Ledger</th><th>C · Cards</th><th>Hybrid</th></tr></thead><tbody>
<tr><th>1 · Log a flight in seconds</th><td>Good: save shows what it adds</td><td>Good: same form</td><td>Good: same form</td><td>Good (as A)</td></tr>
<tr><th>2 · Checkride progress</th><td><b>Best</b></td><td>Weak</td><td>None</td><td><b>Best</b></td></tr>
<tr><th>3 · Look up and present history</th><td>Fair</td><td><b>Best</b></td><td>Fair</td><td>Good (Ledger view)</td></tr>
<tr><th>Phone, 26 near-identical flights</th><td>Good</td><td>Fair</td><td>Poor</td><td>Good</td></tr>
<tr><th>Build size</th><td>Medium</td><td>Medium</td><td>Medium</td><td>Medium+ (about 1.3 × A)</td></tr></tbody></table>
<div class="mk-reco" style="margin-top:1.5rem"><b>Recommendation: the Hybrid.</b> Your three jobs are answered by two different shapes, progress and a ledger, and they do not fight: the same grouped data and filters feed both. I would make A’s List the default on phone (where a table is a compromise) and offer the Ledger as the default on a wide desktop. I would not build C as a main view; its pattern glyph and debrief line can live inside A’s detail. The cost is one extra view component and a shared totals module, with no server or data change.</div>
${sec('log', 'The log-a-flight redesign (shared by all directions)', 'One focused screen: prefilled from the last flight, a big time stepper with quick chips, PIC / Dual / Solo switches that match the total, a scratch calculator that saves nothing (no Hobbs field), day and night landing steppers, category chips, notes and debrief, a glass Save bar that stays above the keyboard. The passenger variant shares the form: local times, arrival-day control, seat class, confirmation code; ?role= preselects it and ?from= decides where Save returns. Each direction page shows the pilot, keyboard-open and passenger versions plus a desktop version with a live “what this will add” panel.')}
${sc(row(v.logPhone({ dir: 'A' }), v.logPhone({ dir: 'A', kb: true }), v.logPhone({ dir: 'A', pax: true })))}
${sec('empty', 'Empty detail pane on wide desktop (proposal, not built)', 'Today the right pane shows an icon and one line when nothing is selected, about 60% of the width. Proposal: show an overview instead. For the Logbook: the flight-hours-by-month bars (flights only), what is still missing, and the latest flight. For Travel: the passenger route map and flights per year. Both are display-only and use numbers that already exist (passenger-only on Travel, pilot-only on the Logbook). Cheaper alternatives: (1) auto-open the newest entry, which is simplest but means the pane is never empty and hides the overview; (2) a plain full-width list with no pane until you pick, which loses the two-pane feel.')}
${sc(row(v.emptyPaneDesk('logbook'), v.emptyPaneDesk('travel')))}`;
write('revamp.html', page({ title: 'Logbook revamp · overview', body: over }));
console.log('built revamp.html, revamp-a/b/c/hybrid.html');
