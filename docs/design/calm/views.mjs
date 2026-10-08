// Screens for the calm redesign of Logbook, Travel and Costs (static HTML strings, NO app code).
// DATA: every figure is a PLACEHOLDER from the scratch dataset (server/scripts/dev/seed-scratch.js): 31.40 h pilot, 60.95 h passenger; the corrected
// figures ($313.63 per hour, $3,974.10 / $3,489.87 estimates, 2.03 flights/week, 11/15/2026) are what the pilot-only fix will show.
// Per-flight rows (tails, instructors, routes, airlines) are placeholders in the shape of the logbook; nothing personal is copied.
import { FLIGHTS, GROUND, ENTRIES, PILOT_TOTAL, GROUND_TOTAL, LANDINGS, PIC_TOTAL, RUN, I, glass, phone, desk, flyTabs, seg, chip, fmt, mdy, groups } from '../logbook-revamp/lib.mjs';

const X = {
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  trend: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
};
export const ico = (n, cls = 'ds-i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${X[n] ?? ''}</svg>`;
export const chev = `<svg class="cl-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`;
const infoBtn = (cls = '') => `<button class="gl clear icon sm ${cls}" aria-label="How this is calculated">${ico('info')}</button>`;
export const h = (n) => `${fmt(n)}<span class="ds-unit">h</span>`;
const money = (n) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const s = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export const page = (inner, d = false, extra = '') => `<div class="cl cl-page ${d ? 'd' : ''} ${extra}">${inner}</div>`;
const plural = s;

// ---------------------------------------------------------------- shared pieces
export const heroPilot = () => `<a class="cl-card hero"><span class="cl-cap">As pilot</span><div class="cl-num pilot">${h(PILOT_TOTAL)}</div><div class="cl-sup">8.60 h to go for Private pilot</div><div class="cl-bar"><i style="width:${(PILOT_TOTAL / 40) * 100}%"></i></div>${infoBtn('info')}</a>`;
export const ctl = (view = 'List', extra = '') => `<div class="cl-ctl">${seg(['List', 'Ledger'], view)}<span class="ic"><button class="gl clear icon" aria-label="Search">${I('search')}</button><button class="gl clear icon" aria-label="Filter">${I('sliders')}</button></span></div>${extra}`;
export const counts = (m = false) => `<p class="cl-count">${m ? 'Matching: ' : ''}${FLIGHTS.length} flights · ${fmt(PILOT_TOTAL)} h · ${GROUND.length} ground sessions · ${fmt(GROUND_TOTAL)} h</p>`;
const mh = (g, pax = false) => `<div class="cl-mh ${pax ? 'pax' : ''}"><span class="a">${g.label}</span><span class="b">${fmt(g.fh)} h</span><span class="c">${s(g.flights, 'flight', 'flights')}</span><span class="d">${g.grounds ? `Ground ${fmt(g.gh)} h · ${s(g.grounds, 'session', 'sessions')}` : ''}</span></div>`;
export const flightRow = (f, sel = false) => `<a class="cl-row ${sel ? 'sel' : ''}"><span class="m"><span class="p">Local · KSUS</span><span class="s">${mdy(f.date)} · ${f.tail}</span></span><span class="t pilot">${fmt(f.total)}<span class="ds-unit">h</span></span></a>`;
export const groundRow = (g) => `<a class="cl-row"><span class="m"><span class="p"><span class="cl-gb">${I('cap', '')}</span>${g.topics}</span><span class="s">${mdy(g.date)} · Ground session</span></span><span class="t mute">${fmt(g.total)}<span class="ds-unit">h</span></span></a>`;
export const rowOf = (e, sel) => (e.kind === 'ground' ? groundRow(e) : flightRow(e, sel === e.id));
export const monthList = (entries = ENTRIES, sel = 0, limit = 99) => groups(entries).slice(0, limit).map((g) => `<section class="cl-month">${mh(g)}<div class="cl-rows">${g.rows.map((e) => rowOf(e, sel)).join('')}</div></section>`).join('');
export const showMore = (n) => `<button class="gl clear cl-more">Show ${n} more months</button>`;

export const logbookBody = ({ view = 'List', sel = 0, d = false, matching = false, entries = ENTRIES, tabs = true } = {}) => page(
  `${tabs ? flyTabs() : ''}${heroPilot()}<div class="cl-grp">${ctl(view)}${counts(matching)}</div>${view === 'Ledger' ? ledger({ phone: !d }) : monthList(entries, sel)}${view === 'List' ? showMore(2) : ''}`, d);

// ---------------------------------------------------------------- ledger
export const ledger = ({ phone: ph = true, sel = 19 } = {}) => {
  const head = ph ? ['Date', 'Total', 'PIC', 'Dual', 'Ldg'] : ['Date', 'Aircraft', 'Tail', 'Route', 'Total', 'PIC', 'Dual', 'Solo', 'Night', 'XC', 'Ldg'];
  const cols = head.length;
  let body = '';
  for (const g of groups()) {
    const fl = g.rows.filter((r) => r.kind === 'flight');
    body += `<tr class="m"><td colspan="${cols}" class="l">${g.label} · <b>${fmt(g.fh)} h</b> · ${s(g.flights, 'flight', 'flights')}${g.grounds ? ` · ground ${fmt(g.gh)} h` : ''}</td></tr>`;
    for (const r of g.rows) {
      if (r.kind === 'ground') body += ph ? `<tr class="g"><td>${mdy(r.date)}<br><span style="font-size:var(--fs-m)">Ground</span></td><td>${fmt(r.total)}</td><td class="z">—</td><td class="z">—</td><td class="z">—</td></tr>`
        : `<tr class="g"><td>${mdy(r.date)}</td><td class="l" colspan="3">Ground session · ${r.topics}</td><td>${fmt(r.total)}</td>${'<td class="z">—</td>'.repeat(6)}</tr>`;
      else body += ph ? `<tr class="${r.id === sel ? 'sel' : ''}"><td>${mdy(r.date)}</td><td class="t">${fmt(r.total)}</td><td>${fmt(r.pic)}</td><td>${fmt(r.dual)}</td><td>${r.ldg}</td></tr>`
        : `<tr class="${r.id === sel ? 'sel' : ''}"><td>${mdy(r.date)}</td><td class="l">${r.type}</td><td class="l">${r.tail}</td><td class="l">KSUS</td><td class="t">${fmt(r.total)}</td><td>${fmt(r.pic)}</td><td>${fmt(r.dual)}</td><td class="z">—</td><td class="z">—</td><td class="z">—</td><td>${r.ldg}</td></tr>`;
    }
    const sum = (k) => fmt(fl.reduce((a, r) => a + r[k], 0));
    body += ph ? `<tr class="sub"><td>Flights</td><td>${sum('total')}</td><td>${sum('pic')}</td><td>${sum('dual')}</td><td>${fl.reduce((a, r) => a + r.ldg, 0)}</td></tr>`
      : `<tr class="sub"><td colspan="4">${g.label} · flights only</td><td>${sum('total')}</td><td>${sum('pic')}</td><td>${sum('dual')}</td><td class="z">—</td><td class="z">—</td><td class="z">—</td><td>${fl.reduce((a, r) => a + r.ldg, 0)}</td></tr>`;
  }
  const foot = ph ? `<tr><td>Pilot totals</td><td>${fmt(PILOT_TOTAL)}</td><td>${fmt(PIC_TOTAL)}</td><td>${fmt(PILOT_TOTAL)}</td><td>${LANDINGS}</td></tr>`
    : `<tr><td colspan="4">Pilot totals · ${FLIGHTS.length} flights</td><td>${fmt(PILOT_TOTAL)}</td><td>${fmt(PIC_TOTAL)}</td><td>${fmt(PILOT_TOTAL)}</td><td class="z">—</td><td class="z">—</td><td class="z">—</td><td>${LANDINGS}</td></tr>`;
  return `<div class="cl-card flat" style="overflow:auto"><table class="cl-ledger ${ph ? 'cl-led-ph' : ''}"><thead><tr>${head.map((x) => `<th${['Aircraft', 'Tail', 'Route'].includes(x) ? ' class="l"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table></div><p class="cl-count">Ground time (${fmt(GROUND_TOTAL)} h) is shown on its own lines and never added to a flight subtotal.</p>`;
};

// ---------------------------------------------------------------- detail
const dl = (rows) => `<div class="cl-dl">${rows.map(([k, v]) => `<div><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}</div>`;
const link = (title, meta, trail = '', ic = '') => `<a class="cl-link"><span><div class="p">${title}</div><div class="s">${meta}</div></span><span class="t">${trail}${chev}</span></a>`;
export const flightDetail = (id = 19, d = false) => {
  const e = FLIGHTS.find((x) => x.id === id); const before = fmt(RUN.get(id) - e.total);
  return page(`<div class="cl-grp" style="gap:4px"><span class="cl-cap">${mdy(e.date)}</span><h1 class="cl-title">Local · KSUS</h1></div>
  <div class="cl-card hero"><span class="cl-cap">Flight time</span><div class="cl-num pilot">${h(e.total)}</div><div class="cl-sup">Dual received · ${s(e.ldg, 'landing', 'landings')}</div></div>
  <div class="cl-grp"><h2 class="cl-h">Aircraft</h2><div class="cl-card" style="padding-block:4px">${dl([['Aircraft', e.type], ['Tail number', e.tail], ['Instructor', e.instr]])}</div></div>
  <div class="cl-grp"><h2 class="cl-h">Times</h2><div class="cl-card" style="padding-block:4px">${dl([['Total', `${fmt(e.total)} h`], ['PIC', `${fmt(e.pic)} h`], ['Dual received', `${fmt(e.dual)} h`]])}<div class="cl-dl"><div style="border-top:1px solid var(--ds-hair)"><span class="k">All times</span><span class="v" style="color:var(--ds-text-3)">${I('chevD', 'cl-chev')}</span></div></div></div></div>
  ${e.debrief ? `<div class="cl-grp"><h2 class="cl-h">Debrief</h2><div class="cl-card"><p class="cl-quote"><span class="k">Went well</span>${e.debrief.well}</p><p class="cl-quote"><span class="k">Work on</span>${e.debrief.work}</p></div></div>` : ''}
  <div class="cl-grp"><h2 class="cl-h">More</h2>${link('Cost', 'Private pilot rates', `$${e.cost.toFixed(2)}`)}${link('Counts toward Private pilot', `Total time ${before} → ${fmt(RUN.get(id))} h`)}${link('Photos', 'None yet', 'Add')}</div>
  <div class="cl-actions"><button class="gl pilot lg block">Edit flight</button><button class="gl clear lg block">Copy as new flight</button></div>`, d);
};
export const groundDetail = (id = 6, d = false) => {
  const e = GROUND.find((x) => x.id === id);
  return page(`<div class="cl-grp" style="gap:4px"><span class="cl-cap">${mdy(e.date)}</span><h1 class="cl-title">${e.topics}</h1></div>
  <div class="cl-card hero"><span class="cl-cap">Ground session</span><div class="cl-num pilot">${h(e.total)}</div><div class="cl-sup">Not included in flight hours</div></div>
  <div class="cl-grp"><h2 class="cl-h">Session</h2><div class="cl-card" style="padding-block:4px">${dl([['Topics', e.topics], ['Instructor', e.instr]])}</div></div>
  <div class="cl-grp"><h2 class="cl-h">More</h2>${link('Cost', 'Ground rate for this phase', `$${e.cost.toFixed(2)}`)}</div>
  <div class="cl-actions"><button class="gl pilot lg block">Edit session</button></div>`, d);
};
export const totalsSheet = () => glass('div', 'ds-sheet ds-chrome is-open', `<span class="grab"></span><div class="ds-sheet-head"><h2 class="ds-title" style="margin:0">Your flight totals</h2><button class="gl plain sm">Done</button></div><div class="ds-sheet-body cl"><div class="cl-info-body"><div class="cl-card" style="padding-block:4px">${dl([['Flight time', `${fmt(PILOT_TOTAL)} h`], ['PIC', `${fmt(PIC_TOTAL)} h`], ['Dual received', `${fmt(PILOT_TOTAL)} h`], ['Landings', `${LANDINGS}`], ['Last 12 months', `${fmt(PILOT_TOTAL)} h`], ['Ground sessions', `${fmt(GROUND_TOTAL)} h`]])}</div><p class="cl-count">As pilot only. Passenger flights are never included.</p><a class="cl-link"><span><div class="p">Private pilot progress</div><div class="s">All requirements, Milestones tab</div></span><span class="t">${chev}</span></a></div></div>`, 'data-role="pop" data-force');

// ---------------------------------------------------------------- travel
const PAX = [['2026', [['2026-09-18', 'SFO', 'LHR', 'United', 9.85], ['2026-09-02', 'STL', 'ORD', 'American', 1.1], ['2026-08-21', 'JFK', 'SFO', 'Delta', 6.4], ['2026-08-09', 'LAX', 'STL', 'Southwest', 3.2]], 25.05, 6, 2],
  ['2025', [['2025-12-20', 'ORD', 'DEN', 'United', 2.6], ['2025-11-28', 'DEN', 'ORD', 'United', 2.4], ['2025-11-02', 'LHR', 'JFK', 'British Airways', 8.1]], 20.10, 4, 1]];
const paxRow = (r, sel = false) => `<a class="cl-row pax ${sel ? 'sel' : ''}"><span class="m"><span class="p">${r[1]} → ${r[2]}</span><span class="s">${mdy(r[0])} · ${r[3]}</span></span><span class="t pax">${fmt(r[4])}<span class="ds-unit">h</span></span></a>`;
export const heroPax = () => `<a class="cl-card hero"><span class="cl-cap">As passenger</span><div class="cl-num pax">60.95<span class="ds-unit">h</span></div><div class="cl-sup">14 flights across 4 years</div><span class="chev">${chev}</span></a>`;
export const travelBody = ({ sel = 0, d = false, matching = false } = {}) => page(`${heroPax()}<div class="cl-grp"><div class="cl-ctl"><span class="cl-count" style="font-size:var(--fs-b);color:var(--ds-text)">All years</span><span class="ic" style="display:flex;gap:8px"><button class="gl clear icon" aria-label="Search">${I('search')}</button><button class="gl clear icon" aria-label="Filter">${I('sliders')}</button></span></div><p class="cl-count">${matching ? 'Matching: ' : ''}14 flights · 60.95 h as passenger</p></div>${PAX.map(([y, rows, hrs, n, more]) => `<section class="cl-month"><div class="cl-mh pax"><span class="a">${y}</span><span class="b">${fmt(hrs)} h</span><span class="c">${s(n, 'flight', 'flights')}</span><span class="d"></span></div><div class="cl-rows">${rows.map((r, i) => paxRow(r, sel === 1 && y === '2026' && i === 0)).join('')}</div><button class="gl clear cl-more" style="margin-top:16px">Show ${more} more</button></section>`).join('')}`, d, 'pax');
export const travelDetail = (d = false) => page(`<div class="cl-grp" style="gap:4px"><span class="cl-cap">${mdy('2026-09-18')}</span><h1 class="cl-title">SFO → LHR</h1></div>
  <div class="cl-card hero"><span class="cl-cap">Flight time</span><div class="cl-num pax">${h(9.85)}</div><div class="cl-sup">United UA 934 · Economy</div></div>
  <div class="cl-grp"><h2 class="cl-h">Flight</h2><div class="cl-card" style="padding-block:4px">${dl([['Airline', 'United'], ['Flight number', 'UA 934'], ['Aircraft type', 'Boeing 777-200'], ['Seat class', 'Economy']])}</div></div>
  <div class="cl-grp"><h2 class="cl-h">Local times</h2><div class="cl-card" style="padding-block:4px">${dl([['Departs SFO', '17:05'], ['Arrives LHR', '11:10 +1']])}</div></div>
  <div class="cl-grp"><h2 class="cl-h">More</h2>${link('Confirmation code', 'Tap to show', '••••••')}${link('Remarks', 'None yet', 'Add')}</div>
  <div class="cl-actions"><button class="gl pax lg block">Edit flight</button><button class="gl clear lg block">Copy as new flight</button></div>`, d, 'pax');
export const travelStats = (d = false) => page(`<div class="cl-card hero"><span class="cl-cap">As passenger</span><div class="cl-num pax">60.95<span class="ds-unit">h</span></div><div class="cl-sup">14 flights across 4 years</div></div>
  <div class="cl-grp"><h2 class="cl-h">Places and carriers</h2><div class="cl-card" style="padding-block:4px">${dl([['Airports', '7'], ['Countries', '2'], ['Airlines', '5'], ['Aircraft types', '7']])}</div></div>
  <div class="cl-grp"><h2 class="cl-h">More</h2>${link('See them on the map', 'Map, passenger flights')}${link('Statistics', 'Hours by year and airline')}</div>`, d, 'pax');

// ---------------------------------------------------------------- costs
export const costsParts = ({ annot = false } = {}) => {
  const gap = (small) => (annot ? `<div class="cl-gapm ${small ? 's' : ''}">${small ? 16 : 32} px</div>` : '');
  const pad = (c) => (annot ? `${c} cl-padm" data-pad="20` : c);
  const g0 = annot ? 'gap:0' : '';
  const hero = `<div class="${pad('cl-card hero')}"><span class="cl-cap">Total spent</span><div class="cl-num">$9,848.00</div><div class="cl-sup">Private pilot · since 07/10/2026</div></div>`;
  const stat = (t, m, v) => `<div class="${pad('cl-stat')}"><span><div class="p">${t}</div><div class="s">${m}</div></span><span class="t">${v}</span></div>`;
  const stats = `<div class="cl-grp" style="${g0}">${stat('Cost per flight hour', 'As pilot, 31.40 h', '$313.63')}${gap(true)}${stat('Still to spend', 'Realistic estimate', '$3,974.10')}</div>`;
  const rows = [['Spending over time', 'Last 12 months', ''], ['Training phases', 'Private pilot · ongoing', '$9,848.00'], ['Expenses', '4 expenses', '$557.50'], ['Projection', 'Finish date and estimates', '']];
  const links = `<div class="cl-grp" style="${g0}"><h2 class="cl-h">Details</h2>${rows.map(([a, b, c], i) => `${i ? gap(true) : ''}<a class="${pad('cl-link')}"><span><div class="p">${a}</div><div class="s">${b}</div></span><span class="t">${c}${chev}</span></a>`).join('')}</div>`;
  const more = `<div class="cl-grp"><a class="cl-link"><span><div class="p">Rates and settings</div><div class="s">Aircraft, instructor and ground rates</div></span><span class="t">${chev}</span></a></div>`;
  return { hero, stats, links, more, gap };
};
export const costsSummary = ({ annot = false, d = false } = {}) => {
  const { hero, stats, links, more, gap } = costsParts({ annot });
  const parts = [flyTabs('Costs'), hero, stats, links, more];
  return annot ? `<div class="cl cl-page" style="gap:0">${parts.map((p, i) => (i ? gap(false) : '') + p).join('')}</div>` : page(parts.join(''), d);
};
export const MONTHS12 = [['N', 0], ['D', 0], ['J', 0], ['F', 0], ['M', 0], ['A', 0], ['M', 0], ['J', 0], ['J', 987], ['A', 6834], ['S', 2027], ['O', 0]];
export const spendingBody = (d = false, on = 9) => { const max = 6834; return page(`<div class="cl-card hero"><span class="cl-cap">Last 12 months</span><div class="cl-num">$9,848.00</div><div class="cl-sup">August was the highest month, $6,834.00</div></div>
  <div class="cl-card"><div class="cl-chart">${MONTHS12.map(([l, v], i) => `<div class="${i === on ? 'on' : ''}"><i style="height:${Math.max(2, (v / max) * 82)}%"></i><span>${l}</span></div>`).join('')}</div></div>
  <div class="cl-grp"><h2 class="cl-h">By month</h2><div class="cl-card flat"><div class="cl-rows">${[['September 2026', '2,027.00'], ['August 2026', '6,834.00'], ['July 2026', '987.00']].map(([m, v]) => `<div class="cl-row"><span class="m"><span class="p">${m}</span></span><span class="t">$${v}</span></div>`).join('')}</div></div></div>`, d); };
export const phasesBody = (d = false) => page(`<div class="cl-card hero"><span class="cl-cap">Private pilot · ongoing</span><div class="cl-num">$9,848.00</div><div class="cl-sup">07/10/2026 to today</div>${infoBtn('info')}</div>
  <div class="cl-grp"><h2 class="cl-h">This phase</h2><div class="cl-card" style="padding-block:4px">${dl([['Started', '07/10/2026'], ['Ends', 'Not set'], ['Ground instruction', '15.10 h']])}</div></div>
  <div class="cl-grp"><a class="cl-link"><span><div class="p">Rates for this phase</div><div class="s">Aircraft, instructor and ground</div></span><span class="t">${chev}</span></a></div>`, d);
export const EXPENSES = [['Books & materials', '07/10/2026', '350.00'], ['Headset', '07/10/2026', '150.00'], ['Other', '07/10/2026', '45.00'], ['Other', '09/12/2026', '12.50']];
export const expensesBody = (d = false) => page(`<div class="cl-card hero"><span class="cl-cap">Other expenses</span><div class="cl-num">$557.50</div><div class="cl-sup">4 expenses, not including flights or ground sessions</div></div>
  <div class="cl-card flat"><div class="cl-rows">${EXPENSES.map(([a, b, c]) => `<a class="cl-row"><span class="m"><span class="p">${a}</span><span class="s">${b}</span></span><span class="t">$${c}${chev}</span></a>`).join('')}</div></div>
  <div class="cl-actions"><button class="gl pilot lg block">Add expense</button></div>`, d);
export const projectionBody = (d = false) => page(`<div class="cl-grp"><div class="cl-ctl"><span class="cl-h" style="margin:0">Certificate</span><span class="gl-select" role="button" style="min-width:11rem">Private pilot</span></div></div>
  <div class="cl-card hero"><span class="cl-cap">Realistic estimate to finish</span><div class="cl-num">$3,974.10</div><div class="cl-sup">At a 50.00 h total</div>${infoBtn('info')}</div>
  <div class="cl-stat"><span><div class="p">FAA minimum</div><div class="s">Only the required hours</div></span><span class="t">$3,489.87</span></div>
  <div class="cl-card"><span class="cl-cap">Estimated finish</span><div class="cl-num" style="font-size:2rem">11/15/2026</div><div class="cl-sup">At your recent pace of 2.03 flights a week</div></div>
  <p class="cl-count">Estimates only, at current rates. Not a quote.</p>`, d);
export const projectionInfo = () => glass('div', 'ds-sheet ds-chrome is-open', `<span class="grab"></span><div class="ds-sheet-head"><h2 class="ds-title" style="margin:0">How this is calculated</h2><button class="gl plain sm">Done</button></div><div class="ds-sheet-body cl"><div class="cl-info-body"><p>Remaining hours come from your Private pilot milestones, split into dual and solo. Your pilot flights set the pace: average lesson length and ground time per lesson.</p><div class="cl-card" style="padding-block:4px"><div class="cl-eq"><div class="st"><span>Remaining, FAA minimum</span><b>6.00 h dual + 10.00 h solo</b></div><div class="st"><span>Remaining, realistic (50 h total)</span><b>6.00 h dual + 12.60 h solo</b></div><div><span>Average lesson</span><b>1.57 h</b></div><div><span>Ground per lesson</span><b>0.30 h</b></div><div><span>Lessons to finish</span><b>11.85</b></div></div></div><p>Aircraft, instructor and ground costs use your current rates. Passenger flights are never counted.</p></div></div>`, 'data-role="pop" data-force');

// ---------------------------------------------------------------- log a flight
const fld = (l, v, ph = false) => `<label class="ds-field"><span class="l">${l}</span><span class="gl-field cl-in ${ph ? 'ph' : ''}">${v}</span></label>`;
const sel = (l, v) => `<label class="ds-field"><span class="l">${l}</span><span class="gl-select" role="button">${v}</span></label>`;
const stepper = (v, l) => `<div class="ds-field"><span class="l">${l}</span><div class="gl-field gl-step"><button class="gl clear icon sm" aria-label="Fewer">${I('minus')}</button><span class="v">${v}</span><button class="gl clear icon sm" aria-label="More">${I('plus')}</button></div></div>`;
const disc = (t, open) => `<div class="cl-disc ${open ? 'open' : ''}"><span>${t}</span>${I(open ? 'chevU' : 'chevD', 'cl-chev')}</div>`;
const rolePick = (r) => `<div class="cl-grp">${seg(['Pilot', 'Passenger'], r === 'pilot' ? 'Pilot' : 'Passenger', r === 'pilot' ? 'pilot' : 'pax')}</div>`;
export const logBody = (role = 'pilot', more = false) => role === 'pilot' ? `<div class="cl-form">${rolePick('pilot')}
  <div class="cl-pre">${I('copy', '')}<span>Prefilled from your last flight on <b>09/12/2026</b>: C172S N123AB, J. Rivera, Local KSUS. Change anything.</span></div>
  <div class="cl-two">${fld('Date', '10/05/2026')}${sel('Aircraft', 'N123AB')}</div>
  <div class="cl-two">${fld('From', 'KSUS')}${fld('To', 'KSUS')}</div>
  ${fld('Instructor', 'J. Rivera')}
  <div class="f"><span class="ds-cap">Flight time</span><div class="cl-big"><button class="gl clear icon" aria-label="Less">${I('minus')}</button><div class="v">1.5<small>h</small></div><button class="gl clear icon" aria-label="More">${I('plus')}</button></div><div class="cl-quick">${['1.0', '1.5', '2.0', '+0.1'].map((t) => `<button class="gl clear gl-chip">${t}</button>`).join('')}</div></div>
  ${stepper(3, 'Landings')}
  <div class="f">${disc('More details', more)}${more ? `<div class="cl-open">${fld('PIC', '1.5 h')}${fld('Dual received', '1.5 h')}${fld('Solo', '0.0 h', true)}${fld('Night', '0.0 h', true)}${fld('Cross-country', '0.0 h', true)}${fld('Instrument', '0.0 h', true)}${fld('Ground time', '0.3 h')}${fld('Remarks', 'Optional', true)}${fld('Went well', 'Optional', true)}${fld('Work on', 'Optional', true)}${fld('Cost override', 'Optional', true)}</div>` : ''}</div></div>`
  : `<div class="cl-form">${rolePick('pax')}
  <div class="cl-pre pax">${I('luggage', '')}<span>Saves to <b>Travel</b>, never to logbook hours.</span></div>
  <div class="cl-two">${fld('Date', '10/05/2026')}${fld('Airline', 'United')}</div>
  <div class="cl-two">${fld('From', 'STL')}${fld('To', 'ORD')}</div>
  ${fld('Flight number', 'UA 4321')}
  <div class="f"><span class="ds-cap">Flight time</span><div class="cl-big"><button class="gl clear icon" aria-label="Less">${I('minus')}</button><div class="v">1.1<small>h</small></div><button class="gl clear icon" aria-label="More">${I('plus')}</button></div><p class="cl-count" style="text-align:center">Worked out from the local times. Edit it if the airline’s block time differs.</p></div>
  <div class="f">${disc('More details', false)}</div></div>`;
export const logSheet = (role = 'pilot', more = false, st = 0) => glass('div', 'ds-sheet ds-chrome is-open cl-log', `<span class="grab"></span><div class="ds-sheet-head"><h2 class="ds-title" style="margin:0">Log a flight</h2><button class="gl plain sm">Cancel</button></div><div class="ds-sheet-body cl" style="overflow:auto;flex:1" data-scrolltop="${st}">${logBody(role, more)}</div><div class="cl-sheetfoot"><button class="gl ${role === 'pilot' ? 'pilot' : 'pax'} lg block">${role === 'pilot' ? 'Save flight · 1.50 h' : 'Save flight'}</button></div>`, 'data-role="pop" data-force');

// ---------------------------------------------------------------- states
export const emptyBlock = (kind) => {
  const M = { log: ['plane', 'Nothing logged yet', 'Log your first flight or ground session. Your progress toward the checkride starts here.', 'Log your first flight', 'pilot'], pax: ['luggage', 'No passenger flights yet', 'Log a trip and your map, airlines and airports fill in. Never counted in your logbook hours.', 'Add flight', 'pax'], costs: [null, 'No costs yet', 'Turn on cost tracking for a training phase, add your rates, and your spending shows up here.', 'Set up rates', 'pilot'], none: ['search', 'Nothing matches these filters', 'Try a wider date range or clear the aircraft filter.', 'Clear filters', 'clear'] }[kind];
  return `<div class="cl-empty"><div class="ic">${M[0] ? I(M[0], '') : ico('receipt', '')}</div><h3>${M[1]}</h3><p>${M[2]}</p><button class="gl ${M[4]}">${M[3]}</button></div>`;
};
const sk = (n, h = 72) => Array.from({ length: n }, () => `<div class="cl-card cl-skel" style="height:${h}px"></div>`).join('');
export const loadingBlock = (kind) => `<div class="cl cl-page ${kind === 'pax' ? 'pax' : ''}">${kind === 'costs' ? flyTabs('Costs') + '<div class="cl-card cl-skel" style="height:150px"></div><div class="cl-grp">' + sk(2, 88) + '</div><div class="cl-grp">' + sk(4, 88) + '</div>' : (kind === 'log' ? flyTabs() : '') + '<div class="cl-card cl-skel" style="height:190px"></div><div class="cl-grp">' + sk(1, 48) + '</div><div class="cl-grp">' + sk(5, 72) + '</div>'}</div>`;
