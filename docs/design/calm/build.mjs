// Builds the calm-redesign mockups (static HTML, NO app code):  node docs/design/calm/build.mjs
// Writes calm.html (overview, before/after, capabilities, recommendation), calm-logbook.html, calm-travel.html, calm-costs.html and
// calm-log.html into docs/design/. Serve with `node docs/design/serve.mjs` (phone-reachable on the Wi-Fi).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dsCss, phone, desk, glass, I, flyTabs, menu, ADD_ITEMS, filterSheet, ENTRIES, FLIGHTS } from '../logbook-revamp/lib.mjs';
import * as v from './views.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const MOCK = fs.readFileSync(path.join(here, '..', 'logbook-revamp', 'mock.css'), 'utf8');
const CALM = fs.readFileSync(path.join(here, 'calm.css'), 'utf8');
const write = (name, html) => fs.writeFileSync(path.join(here, '..', name), html.replace(/\r\n/g, '\n'));
const shell = (title, body) => `<!doctype html><html lang="en" data-ds-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${title}</title><style>${dsCss}\n${MOCK}\n${CALM}</style></head><body class="ds-root"><div class="pg">${body}</div><script>document.querySelectorAll('[data-scrolltop]').forEach(function(e){e.scrollTop=+e.dataset.scrolltop})</script></body></html>`;
const NAV = [['calm.html', 'Overview'], ['calm-logbook.html', 'Logbook'], ['calm-travel.html', 'Travel'], ['calm-costs.html', 'Costs'], ['calm-log.html', 'Log a flight']];
const nav = (cur) => `<nav class="topnav" aria-label="Mockups">${NAV.map(([h, l]) => `<a class="gl ${h === cur ? 'pilot' : 'clear'} gl-chip" href="${h}">${l}</a>`).join('')}</nav>`;
const sec = (id, t, note = '') => `<h2 class="s" id="${id}">${t}</h2>${note ? `<p class="note">${note}</p>` : ''}`;
const row = (...f) => `<div class="row">${f.join('')}</div>`;
const sc = (h) => `<div class="scrollx">${h}</div>`;
const back = `<button class="ds-iconbtn" aria-label="Back">${I('back')}</button>`;
const more = `<button class="ds-iconbtn" aria-label="More">${I('more')}</button>`;
const addMenu = menu(ADD_ITEMS);
const P = (o) => phone({ noFab: false, ...o });
const body = (html) => html; // phone() puts it inside the real .ds-scroll

// ---------- frames
const dk = (o) => desk({ h: 900, ...o });
const pane = (inner, extra = '') => `<div class="mk-pane cl d" style="width:416px;overflow:auto;height:100%;padding-bottom:6rem;${extra}">${inner}</div>`;
const mainPane = (inner) => `<div class="mk-main-pane cl d" style="overflow:auto;height:100%;padding-bottom:6rem">${inner}</div>`;
const tabsDesk = (t) => flyTabs(t).replace('class="gl-seg scroll fl-tabs"', 'class="gl-seg scroll fl-tabs" style="width:32rem"');
const stackD = (inner) => `<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:24px;height:100%">${inner}</div>`;

// =============================================================================== LOGBOOK
const logbookPage = () => {
  const phoneList = P({ title: 'Logbook', right: more, body: v.logbookBody(), cap: 'List view. One number (31.40 h as pilot) with one supporting line, then the controls, then the months. 20 px card padding, 32 px between sections, rows 72 px tall with a date on every row.' });
  const phoneLedger = P({ title: 'Logbook', right: more, body: v.logbookBody({ view: 'Ledger' }), cap: 'Ledger view: the same controls and counts; the table keeps month subtotals (flights only), muted ground lines, and a Pilot totals footer. Rows are 56 px, columns trimmed to Total, PIC, Dual and Landings.' });
  const phoneMenu = P({ title: 'Logbook', right: more, body: v.logbookBody(), fabOpen: true, menuHtml: addMenu, scrim: true, cap: 'The Add menu is unchanged: Quick log, Copy last flight, Add flight (Pilot or Passenger), Log ground session.' });
  const phoneTotals = P({ title: 'Logbook', right: more, body: v.logbookBody(), sheet: v.totalsSheet(), scrim: true, cap: 'The hero’s info button opens the totals that used to be a four-column strip: flight time, PIC, dual, landings, last 12 months, ground. Always “as pilot”.' });
  const phoneFilter = P({ title: 'Logbook', right: more, body: v.logbookBody({ matching: true, entries: FLIGHTS.filter((x) => x.date >= '2026-09-01') }), sheet: filterSheet(), scrim: true, cap: 'Filter and sort stays the existing glass sheet (date range, aircraft type, category, All / Flights / Ground, sort). Search is the icon beside it.' });
  const phoneFlight = P({ title: 'Flight', left: back, right: more, noFab: true, noTabs: true, body: v.flightDetail(19), cap: 'Flight detail (c). Hero hours, then grouped cards, 56 px label / value rows, with the rest (all times, cost, progress, photos) one tap away.' });
  const phoneFlight2 = P({ title: 'Flight', left: back, right: more, noFab: true, noTabs: true, body: v.flightDetail(20), cap: 'A flight with no debrief shows no empty debrief card.' });
  const phoneGround = P({ title: 'Ground session', left: back, right: more, noFab: true, noTabs: true, body: v.groundDetail(6), cap: 'Ground session detail (d): labelled as not part of flight hours, with its own date, topics, instructor and cost.' });
  const states = [
    P({ title: 'Logbook', right: more, body: `<div class="cl cl-page">${flyTabs()}${v.emptyBlock('log')}</div>`, cap: 'Empty (h): one sentence, one primary action.' }),
    P({ title: 'Logbook', right: more, body: v.loadingBlock('log'), cap: 'Loading (h): skeletons in the final layout (hero, controls, rows) so nothing jumps.' }),
    P({ title: 'Logbook', right: more, body: `<div class="cl cl-page">${flyTabs()}${v.heroPilot()}<div class="cl-grp">${v.ctl()}${v.counts(true).replace('20 flights', '0 flights').replace('31.40 h', '0.00 h')}</div>${v.emptyBlock('none')}</div>`, cap: 'No match (h): the controls stay so a filter can be undone.' }),
  ];
  const compact = P({ title: 'Logbook', right: more, body: `<div class="cl cl-page cl-compact">${flyTabs()}${v.heroPilot()}<div class="cl-grp">${v.ctl()}${v.counts()}</div>${v.monthList()}</div>`, cap: 'Compact density (proposal only, not built): rows 56 px, card padding 16 px, section gaps 24 px. About 30% more rows per screen.' });

  const dList = dk({ title: 'Logbook', right: '', body: stackD(`${tabsDesk('Logbook')}<div style="display:flex;gap:28px;flex:1;min-height:0">${pane(`<div class="cl-page cl d">${v.heroPilot()}<div class="cl-grp">${v.ctl()}${v.counts()}</div>${v.monthList(ENTRIES, 19, 2)}</div>`)}${mainPane(v.flightDetail(19, true))}</div>`), cap: 'Desktop, List view: a 416 px list pane and the selected flight beside it (24 px card padding, 40 px section gaps).' });
  const dLedger = dk({ title: 'Logbook', body: stackD(`${tabsDesk('Logbook')}<div class="cl d" style="overflow:auto;height:100%;padding-bottom:6rem"><div class="cl-page d">${v.heroPilot().replace('cl-card hero', 'cl-card hero" style="max-width:520px')}<div class="cl-grp">${v.ctl('Ledger')}${v.counts()}</div>${v.ledger({ phone: false })}</div></div>`), cap: 'Desktop, Ledger view: the full table with Aircraft, Tail, Route, Total, PIC, Dual, Solo, Night, Cross-country and Landings. Sticky header and footer; month subtotals count flights only.' });
  const dGround = dk({ title: 'Logbook', body: stackD(`${tabsDesk('Logbook')}<div style="display:flex;gap:28px;flex:1;min-height:0">${pane(`<div class="cl-page cl d">${v.heroPilot()}<div class="cl-grp">${v.ctl()}${v.counts()}</div>${v.monthList(ENTRIES.filter((e) => e.date >= '2026-08-01' && e.date < '2026-09-01'), 0, 1).replace(/<section class="cl-month">/, '<section class="cl-month">')}</div>`)}${mainPane(v.groundDetail(6, true))}</div>`), cap: 'Desktop, ground session selected.' });

  return shell('Calm Logbook mockups', `${nav('calm-logbook.html')}<h1 class="t">Logbook, calm</h1>
  <p class="lead">The approved Hybrid, Progress-first with a List / Ledger switch, redone with the calm system: one idea per card, rows of three pieces of information, 8 px grid spacing. Every number is the one the app already computes; month and year headers show <b>flight hours only</b>, ground time is separate and labelled, counts say what they count and every row has its date.</p>
  ${sec('a', 'a · List view and the Add menu')}${sc(row(phoneList, phoneMenu, phoneTotals))}
  ${sec('b', 'b · Ledger view', 'The Ledger is the dense, examiner-style view. It stays one tap away (List / Ledger switch) and remembers your last choice.')}${sc(row(phoneLedger, phoneFilter))}${sc(row(dLedger))}
  ${sec('c', 'c · Flight detail')}${sc(row(phoneFlight, phoneFlight2))}${sc(row(dList))}
  ${sec('d', 'd · Ground session detail')}${sc(row(phoneGround))}${sc(row(dGround))}
  ${sec('h', 'h · Empty and loading states')}${sc(row(...states))}
  ${sec('dens', 'Proposal: Comfortable / Compact density', 'Default Comfortable (everything above). A Compact setting in Settings → Appearance for people who prefer denser lists. <b>Cost if you approve it:</b> one stored setting (browser only, no API change), a CSS-variable switch on the root, a second pass of the layout and control checks at 200% text, and a bit more documentation; the Ledger already is the dense view, so this mostly matters for the List. <b>Not built until you say so.</b>')}${sc(row(compact))}`);
};

// =============================================================================== TRAVEL
const travelPage = () => {
  const list = P({ title: 'Passenger flights', right: more, tab: 'Travel', body: v.travelBody(), cap: 'Travel list, grouped by year in the same calm system. Violet is the only accent. The hero says “As passenger” and the header hours are that year’s hours (the example rows and totals are placeholders).' });
  const stats = P({ title: 'Travel stats', left: back, tab: 'Travel', noFab: true, noTabs: true, body: v.travelStats(), cap: 'The strip of airports, countries, airlines and aircraft types moves behind one tap on the hero (placeholder counts).' });
  const detail = P({ title: 'Flight', left: back, right: more, tab: 'Travel', noFab: true, noTabs: true, body: v.travelDetail(), cap: 'Passenger flight detail (e): airline, flight number, aircraft type and seat class in one card, local times in another, confirmation code behind a tap.' });
  const filt = P({ title: 'Passenger flights', right: more, tab: 'Travel', body: v.travelBody({ matching: true }), sheet: glass('div', 'ds-sheet ds-chrome is-open', `<span class="grab"></span><div class="ds-sheet-head"><h2 class="ds-title" style="margin:0">Filter</h2><button class="gl plain sm">Clear all</button></div><div class="ds-sheet-body cl" style="overflow:hidden"><div class="cl-form" style="gap:24px"><label class="ds-field"><span class="l">Year</span><span class="gl-select" role="button">All</span></label><label class="ds-field"><span class="l">Airline</span><span class="gl-select" role="button">All</span></label><button class="gl pax lg block">Show 14 flights</button></div></div>`, 'data-role="pop" data-force'), scrim: true, cap: 'The existing Year and Airline filter, unchanged.' });
  const states = [
    P({ title: 'Passenger flights', right: more, tab: 'Travel', body: `<div class="cl cl-page pax">${v.emptyBlock('pax')}</div>`, cap: 'Empty (h).' }),
    P({ title: 'Passenger flights', right: more, tab: 'Travel', body: v.loadingBlock('pax'), cap: 'Loading (h).' }),
  ];
  const dList = dk({ title: 'Passenger flights', tab: 'Travel', body: stackD(`<div style="display:flex;gap:28px;flex:1;min-height:0">${pane(v.travelBody({ sel: 1, d: true }))}${mainPane(v.travelDetail(true))}</div>`), cap: 'Desktop: list pane and the selected flight (2026, first row).' });
  return shell('Calm Travel mockups', `${nav('calm-travel.html')}<h1 class="t">Travel (passenger flights), calm</h1>
  <p class="lead">The same calm system, grouped by year, in violet. Passenger flights never touch logbook hours, currency or milestones. The stat strip is now one tap, the rows carry date, route, airline and hours, and the flight number, aircraft type, times and seat class live in the detail.</p>
  ${sec('e', 'e · Travel list, filter and flight detail')}${sc(row(list, filt, detail, stats))}${sc(row(dList))}
  ${sec('h', 'h · Empty and loading states')}${sc(row(...states))}`);
};

// =============================================================================== COSTS
const costsPage = () => {
  const summary = P({ title: 'Costs', right: more, body: v.costsSummary(), cap: 'Costs summary (f): three figures (total spent, cost per flight hour, still to spend), then four section cards that each open their own screen. Corrected figures shown: cost per hour is pilot hours only.' });
  const spending = P({ title: 'Spending over time', left: back, noFab: true, noTabs: true, body: v.spendingBody(), cap: 'Spending over time: the same 12-month chart, one number, and the months as 72 px rows. They add up to the total.' });
  const phases = P({ title: 'Training phases', left: back, noFab: true, noTabs: true, body: v.phasesBody(), cap: 'Training phases: the phase total and the ground instruction hours (14.40 h, the old “Total ground hours” tile).' });
  const expenses = P({ title: 'Expenses', left: back, noFab: true, noTabs: true, body: v.expensesBody(), cap: 'Expenses: rows of category, date and amount. Tap a row to edit or delete it; Add expense is the one primary.' });
  const proj = P({ title: 'Projection', left: back, noFab: true, noTabs: true, body: v.projectionBody(), cap: 'Projection: realistic estimate first, FAA minimum second, finish date third. “How this is calculated” is the small info button.' });
  const info = P({ title: 'Projection', left: back, noFab: true, noTabs: true, body: v.projectionBody(), sheet: v.projectionInfo(), scrim: true, cap: 'The info sheet holds the long labels and the fine print that used to sit under every number.' });
  const states = [
    P({ title: 'Costs', right: more, body: `<div class="cl cl-page">${flyTabs('Costs')}${v.emptyBlock('costs')}</div>`, cap: 'Empty (h): no cost tracking yet.' }),
    P({ title: 'Costs', right: more, body: v.loadingBlock('costs'), cap: 'Loading (h).' }),
  ];
  const { hero, stats, links, more: settings } = v.costsParts();
  const dSummary = dk({ title: 'Costs', body: stackD(`${tabsDesk('Costs')}<div class="cl d" style="overflow:auto;height:100%;padding-bottom:6rem"><div class="cl-page d" style="max-width:1100px"><div class="cl-dcols"><div class="cl-grp" style="gap:32px">${hero}${stats}${settings}</div>${links}</div></div></div>`), cap: 'Desktop summary: the three figures on the left, the four sections on the right, 24 px padding and 32 px gaps.' });
  const dSpending = dk({ title: 'Spending over time', body: stackD(`<div class="cl d" style="overflow:auto;height:100%;padding-bottom:6rem"><div class="cl-page d" style="max-width:760px">${v.spendingBody(true).replace(/^<div class="cl cl-page d ">|<\/div>$/g, '')}</div></div>`), cap: 'Desktop sub-screen (Spending over time) in a 760 px column; sub-screens use the top bar’s back button.' });
  return shell('Calm Costs mockups', `${nav('calm-costs.html')}<h1 class="t">Costs, calm</h1>
  <p class="lead">A short summary and four sections that each open their own screen, instead of one long scroll. The figures below are placeholders from the scratch dataset; cost per hour, the estimates, the pace and the finish date are the <b>corrected, pilot-only values</b> (before the fix, passenger hours leaked into them).</p>
  ${sec('f', 'f · Summary and sub-screens')}${sc(row(summary, spending, phases))}${sc(row(expenses, proj, info))}${sc(row(dSummary))}${sc(row(dSpending))}
  ${sec('h', 'h · Empty and loading states')}${sc(row(...states))}`);
};

// =============================================================================== LOG A FLIGHT
const logPage = () => {
  const mk = (role, more, cap, st = 0) => P({ title: 'Logbook', body: v.logbookBody(), sheet: v.logSheet(role, more, st), scrim: true, noFab: true, cap });
  const dlg = (role, cap) => dk({ title: 'Logbook', body: stackD(`<div class="cl d" style="overflow:hidden;height:100%"><div class="cl-page d">${v.logbookBody({ d: true }).replace(/^<div class="cl cl-page d ">|<\/div>$/g, '')}</div></div>`), extra: `<div class="ds-scrim-dim is-on"></div>${glass('div', 'ds-sheet ds-chrome is-open cl-dlog', `<span class="grab"></span><div class="ds-sheet-head"><h2 class="ds-title" style="margin:0">Log a flight</h2><button class="gl plain sm">Cancel</button></div><div class="ds-sheet-body cl d" style="overflow:auto;flex:1">${v.logBody(role)}</div><div class="cl-sheetfoot"><button class="gl ${role === 'pilot' ? 'pilot' : 'pax'} lg block">${role === 'pilot' ? 'Save flight · 1.50 h' : 'Save flight'}</button></div>`, 'data-role="pop" data-force')}`, cap });
  return shell('Calm log-a-flight mockups', `${nav('calm-log.html')}<h1 class="t">Log a flight, calm</h1>
  <p class="lead">A focused sheet that rises from the Add button, prefilled from your last flight (aircraft, instructor, route), with the glass Save button always in reach. <b>One shared form for both roles</b>: the Pilot / Passenger switch at the top swaps the fields and the accent (sky or violet) and nothing else. The first screen asks only for what changes flight to flight (date, route, time, landings); everything else is behind “More details”, using the same fields the form has today.</p>
  ${sec('g', 'g · Pilot and passenger')}${sc(row(mk('pilot', false, 'Pilot, prefilled from the last flight: date, aircraft, route and instructor are already filled in. Save shows what it is saving (1.50 h).'), mk('pilot', false, 'The same sheet scrolled: the big flight-time control with quick values, the landings stepper, and “More details” collapsed.', 330), mk('pilot', true, 'Pilot with “More details” open: PIC, dual, solo, night, cross-country, instrument, ground time, remarks, debrief and cost override: the same fields as today, one tap down.', 640), mk('passenger', false, 'Passenger: same sheet, violet, with airline, flight number and the From / To pair. Flight time comes from the local times as it does today; local times, seat class, aircraft and confirmation code sit under “More details”.')))}
  ${sc(row(dlg('pilot', 'Desktop: the same sheet as a centred 640 px dialog over the Logbook.'), dlg('passenger', 'Desktop, passenger.')))}
  <p class="note"><b>Step-light:</b> there is no wizard. Quick log (Add menu) stays as the one-tap path; this sheet is the fuller path. “Copy last flight” still creates the prefilled flight directly.</p>`);
};

// =============================================================================== OVERVIEW
const overview = () => {
  const before = `<figure class="mk-fig"><div class="cl-before"><img src="calm/before-costs.png" alt="Current /costs screen at 390 px"></div><figcaption>Before: today’s /costs at 390 px (screenshot of the current app on placeholder data). Card padding 16 px, 12 px between cards, 8 text sizes from 9 px to 20 px, 17 size / weight / colour combinations on one screen, six cards in one long scroll, small blue titles, gray captions and fine print competing.</figcaption></figure>`;
  const after = `<figure class="mk-fig"><div class="cl-after"><div class="cl d0" style="--pad:20px">${v.costsSummary({ annot: true })}</div></div><figcaption>After: the new summary with the spacing drawn on. Hatched bands are the gaps (32 px between sections, 16 px inside a group), dashed outlines are the 20 px card padding. Three text sizes per card (44 / 17 / 14 px), rows and cards at least 72 to 88 px tall.</figcaption></figure>`;
  const MK = (a, b, c) => `<div><b>${a}</b><span>${b}</span></div>`;
  const table = (heads, rows) => `<table class="mk-cmp"><thead><tr>${heads.map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(([a, ...r]) => `<tr><th>${a}</th>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const CAPS = [
    ['Logbook: search, filters, sort, All / Flights / Ground', 'Search icon and Filter icon beside the List / Ledger switch (Filter opens the existing sheet).', 'Search is one tap away instead of always showing a field.'],
    ['Logbook: totals strip (PIC, dual, landings, last 12 months)', 'The info button on the hero card opens “Your flight totals”.', 'One tap away instead of always visible.'],
    ['Logbook: per-row cost, instructor, aircraft type, landings, badges', 'Flight detail (cost, instructor, aircraft, landings) and the Ledger (landings, aircraft, tail).', 'The list row shows route, date and tail only: cost and instructor need a tap into the flight.'],
    ['Logbook: currency chips (Hybrid)', 'The Currency tab (unchanged) and Home. The chips are dropped from the Logbook top to keep one idea per screen.', 'One extra tap from the Logbook to see currency.'],
    ['Month headers, counts line, ground time', 'Kept: flight hours only in the header, ground shown apart and labelled, “20 flights · 31.40 h · 6 ground sessions · 9.10 h”.', 'Nothing.'],
    ['Ledger (examiner view, subtotals, totals footer)', 'List / Ledger switch; remembered. The table has full columns on desktop and the four key columns on a phone.', 'Phone Ledger drops Aircraft, Route, Solo, Night and Cross-country columns (still in detail).'],
    ['Flight and ground-session detail, edit, copy, delete, photos', 'Tap a row (right-hand pane on desktop). Edit and Copy as new are buttons; Delete stays in the “…” menu; photos are a row.', 'Times beyond total, PIC and dual are behind “All times”.'],
    ['Add menu (Quick log, Copy last, Add flight, Ground session)', 'The same Add button and menu.', 'Nothing.'],
    ['Share, Print, Import and export, JSON backup', 'Unchanged: the “…” menu on the Flying pages and More → Data.', 'Nothing.'],
    ['Travel: totals strip (airports, countries, airlines, aircraft types)', 'Tap the hero card.', 'One tap away.'],
    ['Travel: search, Year and Airline filter, year grouping', 'Search and Filter icons; year headers kept.', 'Search is one tap away.'],
    ['Travel: flight number, aircraft type, times, seat class on the row', 'Flight detail.', 'Rows show route, date, airline and hours only.'],
    ['Costs: total spent, cost per flight hour, total ground hours', 'Summary shows total and cost per hour; ground instruction hours are on Training phases.', 'Ground hours are one tap deeper.'],
    ['Costs: spend per training phase', 'Training phases card, then the phase.', 'One tap.'],
    ['Costs: last-12-months chart', 'Spending over time card.', 'One tap.'],
    ['Costs: projection (estimates, finish date, “How this is calculated”)', 'Projection card; the long text is the info sheet. The certificate picker is at the top of that screen.', 'Two taps to the fine print, as before but quieter.'],
    ['Costs: other expenses (add, edit, delete)', 'Expenses card; Add expense button; tap a row to edit or delete.', 'One tap to reach, and delete moves behind the row.'],
    ['Costs: Log ground session, Rates and settings, cost cutoff note', 'Ground session from the Add menu; Rates and settings row on the summary; the cutoff note shows under the hero when set.', 'Log ground session is no longer a button on the Costs page.'],
    ['Log a flight (pilot and passenger)', 'Add menu → Add flight opens one sheet with a Pilot / Passenger switch. “Copy last flight” and Quick log are unchanged.', 'Rarely used fields are behind “More details”.'],
    ['URLs and deep links', 'Every existing URL keeps working; new sub-screens would be sub-routes of /costs (for example /costs/expenses).', 'Nothing.'],
  ];
  return shell('Calm redesign: Logbook, Travel, Costs', `${nav('calm.html')}<h1 class="t">Calm, uncrammed Logbook, Travel and Costs</h1>
  <p class="lead">Static mockups at 390 px and 1440 px, dark only, with the real design tokens and V-a buttons. <b>No app code, no calculation or API changes.</b> Pick one, or ask for changes, before anything is built. Pages: <a href="calm-logbook.html">Logbook</a> (a to d, h), <a href="calm-travel.html">Travel</a> (e), <a href="calm-costs.html">Costs</a> (f), <a href="calm-log.html">Log a flight</a> (g).</p>
  ${sec('why', 'What was wrong, and the system that replaces it', 'Cards had 16 px padding with 12 px between them; five small text styles competed; everything was one long scroll; secondary details sat beside primary ones.')}
  ${table(['Principle', 'Rule'], [
    ['Spacing on an 8 px grid', 'Card padding 20 px (phone) or 24 px (desktop); 32 px between sections (40 px desktop); 16 px inside a group; list rows at least 72 px; line height 1.45.'],
    ['One idea per card', 'A headline number with at most one supporting line. Everything else sits behind a tap: a sheet, an expandable “More details”, or a sub-screen.'],
    ['Rows carry three things', 'Primary, secondary and one trailing value. The date is always in the secondary line (MM/DD/YYYY).'],
    ['Three text sizes per card', 'Number 44 px, body 17 px, meta 14 px. No 9 to 12 px text. One accent per role: sky = pilot, violet = passenger.'],
    ['Fine print goes in an info sheet', '“How this is calculated” is a small info button that opens a sheet.'],
    ['Costs is a summary plus sections', 'Total spent, cost per hour and still to spend, then four cards that each open their own screen.'],
    ['Sub-screens, not scroll', 'A list that is not the main job (expenses, phases, months) is its own screen with the back button.'],
    ['Glass stays on the navigation layer', 'Top bar, tab bar, one sheet. Cards, rows and charts are solid; V-a buttons everywhere.'],
    ['My additions', 'Quiet “counts” lines say what is counted; no card ever shows two accent colours; destructive actions never share a row with a primary.'],
  ])}
  ${sec('i', 'i · Before and after: Costs at 390 px')}${sc(`<div class="cl-ba">${before}${after}</div>`)}
  <div class="cl-metrics"><div><b>16 → 20 px</b><span>card padding</span></div><div><b>12 → 32 px</b><span>between sections (16 px inside a group)</span></div><div><b>8 → 3</b><span>text sizes (9 to 20 px before; 44 / 17 / 14 now)</span></div><div><b>17 → 5</b><span>text style combinations on the screen</span></div><div><b>1,565 → 1,070 px</b><span>page height at 390 px: 3 figures and 4 sections instead of 6 cards in a scroll</span></div></div>
  ${sec('cap', 'How every existing capability is reached, and what gets slower or harder')}
  ${table(['Capability', 'How you reach it', 'What gets slower or harder'], CAPS)}
  ${sec('rec', 'Recommendation')}
  <div class="mk-reco"><p style="margin:0 0 .5rem"><b>Take the calm system for all three areas, and keep the Hybrid Logbook.</b> It fixes the real problem (priority and breathing room) without removing a single capability. The Ledger stays as the dense, examiner-style view, so the List can afford generous rows.</p>
  <p style="margin:0 0 .5rem"><b>What it costs you:</b> search and the totals are one tap away, costs sections are one tap deeper, and the row loses cost and instructor (they are in the detail). The Costs page is about 1,070 px tall at 390 px instead of about 1,565 px (measured on the placeholder-data page), and its first screen shows the three figures that matter.</p>
  <p style="margin:0"><b>Density:</b> ship Comfortable only first. Add Compact later if the List ever feels too airy; it is a one-setting follow-up. <b>Build order if you approve:</b> shared tokens and row components, Logbook, Travel, then Costs (after the Part 1 fix is in), one phase at a time with the phone, control and layout checks.</p></div>
  <p class="note">All figures here are placeholders from the scratch dataset. They are the corrected pilot-only figures.</p>`);
};

write('calm.html', overview());
write('calm-logbook.html', logbookPage());
write('calm-travel.html', travelPage());
write('calm-costs.html', costsPage());
write('calm-log.html', logPage());
console.log('built calm*.html');
