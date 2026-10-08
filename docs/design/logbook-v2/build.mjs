// Builds the Logbook v2 mockups (static HTML, NO app code, NO database):  node docs/design/logbook-v2/build.mjs
// Writes docs/design/logbook-v2.html (overview + what differs from Stage 1), logbook-v2-a.html (Panel) and logbook-v2-b.html (Timeline).
// DATA IS PLACEHOLDER (see docs/design/logbook-revamp/lib.mjs): invented tails, instructors and airports; month flight hours add up to the pilot
// total, the fleet strip adds up to the same total, ground time is separate. Serve with `node docs/design/serve.mjs`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dsCss, phone, desk, FLIGHTS, GROUND, ENTRIES, groups, fmt, mdy, dayMon, I, seg, flyTabs, PILOT_TOTAL, GROUND_TOTAL, PIC_TOTAL, LANDINGS, REQS } from '../logbook-revamp/lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(here, f), 'utf8');
const MOCK = read('../logbook-revamp/mock.css');
const V2 = read('v2.css');
const write = (name, html) => fs.writeFileSync(path.join(here, '..', name), html.replace(/\r\n/g, '\n'));
const r2 = (n) => Math.round(n * 100) / 100;
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

// ---------- data derived from the placeholder logbook (never stored, always computed)
const FLEET = ['N123AB', 'N456CD', 'N789EF'].map((tail) => {
  const fl = FLIGHTS.filter((f) => f.tail === tail);
  return { tail, type: 'C172S', hours: r2(fl.reduce((s, f) => s + f.total, 0)), flights: fl.length };
});
const MET = REQS.filter((r) => r.cur >= r.min).length;
const TOTAL_REQ = REQS.find((r) => r.k === 'total');
{ // build-time invariants
  if (r2(FLEET.reduce((s, f) => s + f.hours, 0)) !== PILOT_TOTAL) throw new Error('fleet strip hours != pilot total');
  if (r2(groups().reduce((s, g) => s + g.fh, 0)) !== PILOT_TOTAL) throw new Error('month hours != pilot total');
}
const NEED = r2(TOTAL_REQ.min - TOTAL_REQ.cur);

// ---------- pieces
const plane = '<svg class="plane" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4c1.6 0 2.4 2 2.4 5v8l17 4v4l-17-1.2V36l5 3v3l-7.4-1.4L16.6 42v-3l5-3V20.8L4.6 22v-4l17-4V9c0-3 .8-5 2.4-5z"/></svg>';
const cap = '<svg class="plane" viewBox="0 0 24 24" aria-hidden="true"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>';
const thumb = (g) => `<span class="thumb" aria-hidden="true">${g ? cap : plane}</span>`;
const chevR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
const ctl = (view = 'List') => `<div class="ctl">${seg(['List', 'Ledger'], view)}<span class="ic"><button class="gl clear icon" aria-label="Search">${I('search')}</button><button class="gl clear icon" aria-label="Filter and sort">${I('sliders')}</button></span></div>`;
const counts = `${plural(FLIGHTS.length, 'flight', 'flights')} · ${fmt(PILOT_TOTAL)} h · ${plural(GROUND.length, 'ground session', 'ground sessions')} · ${fmt(GROUND_TOTAL)} h`;
const countsP = `<p class="count">${counts}</p>`;
const tabsW = (w) => flyTabs('Logbook').replace('class="gl-seg scroll fl-tabs"', `class="gl-seg scroll fl-tabs" style="${w}"`);
const hrs = (n, big = '') => `${fmt(n)}<span class="u">h</span>`;

// ---------- Ledger (both directions; Ledger totals = strip totals = month sums)
function ledger({ narrow }) {
  const head = narrow ? ['Date', 'Total', 'PIC', 'Dual', 'Ldg'] : ['Date', 'Aircraft', 'Tail', 'Route', 'Total', 'PIC', 'Dual', 'Solo', 'Night', 'XC', 'Ldg'];
  const cols = head.length;
  const dash = '<td class="z">—</td>';
  let body = '';
  for (const g of groups()) {
    const fl = g.rows.filter((r) => r.kind === 'flight');
    body += `<tr class="m"><td colspan="${cols}">${g.label} · <b>${fmt(g.fh)} h</b> flights · ${plural(g.flights, 'flight', 'flights')}${g.grounds ? ` · ground ${fmt(g.gh)} h` : ''}</td></tr>`;
    for (const r of g.rows) {
      if (r.kind === 'ground') body += narrow ? `<tr class="g"><td class="l">${mdy(r.date)} · Ground</td><td>${fmt(r.total)}</td>${dash}${dash}${dash}</tr>`
        : `<tr class="g"><td class="l">${mdy(r.date)}</td><td class="l" colspan="3">Ground session · ${r.topics}</td><td>${fmt(r.total)}</td>${dash.repeat(6)}</tr>`;
      else body += narrow ? `<tr><td class="l">${mdy(r.date)}</td><td class="t">${fmt(r.total)}</td><td>${fmt(r.pic)}</td><td>${fmt(r.dual)}</td><td>${r.ldg}</td></tr>`
        : `<tr><td class="l">${mdy(r.date)}</td><td class="l">${r.type}</td><td class="l">${r.tail}</td><td class="l">KSUS</td><td class="t">${fmt(r.total)}</td><td>${fmt(r.pic)}</td><td>${fmt(r.dual)}</td>${dash}${dash}${dash}<td>${r.ldg}</td></tr>`;
    }
    const sum = (k) => fmt(fl.reduce((a, r) => a + r[k], 0)); const ld = fl.reduce((a, r) => a + r.ldg, 0);
    body += narrow ? `<tr class="sub"><td class="l">Flights</td><td>${sum('total')}</td><td>${sum('pic')}</td><td>${sum('dual')}</td><td>${ld}</td></tr>`
      : `<tr class="sub"><td class="l" colspan="4">${g.label} · flights only</td><td>${sum('total')}</td><td>${sum('pic')}</td><td>${sum('dual')}</td>${dash}${dash}${dash}<td>${ld}</td></tr>`;
  }
  const foot = narrow ? `<tr><td class="l">Pilot totals</td><td>${fmt(PILOT_TOTAL)}</td><td>${fmt(PIC_TOTAL)}</td><td>${fmt(PILOT_TOTAL)}</td><td>${LANDINGS}</td></tr>`
    : `<tr><td class="l" colspan="4">Pilot totals · ${FLIGHTS.length} flights</td><td>${fmt(PILOT_TOTAL)}</td><td>${fmt(PIC_TOTAL)}</td><td>${fmt(PILOT_TOTAL)}</td>${dash}${dash}${dash}<td>${LANDINGS}</td></tr>`;
  return `<div class="${narrow ? 'mk-focus' : ''}" style="overflow:auto"><table class="led"><thead><tr>${head.map((x) => `<th${['Date', 'Aircraft', 'Tail', 'Route'].includes(x) ? ' class="l"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table></div>
  <p class="count">Ground time (${fmt(GROUND_TOTAL)} h) sits on its own lines and is never added to a flight subtotal. The totals row equals the month sums, the fleet strip and the print view.</p>`;
}

const emptyState = (btn = 'Log your first flight') => `<div class="empty"><div class="ill">${plane}</div><h3>Nothing logged yet</h3><p>Log your first flight or ground session. Your progress toward the Private Pilot checkride starts here.</p><button class="gl pilot lg">${btn}</button></div>`;

const detail = (f) => `<div class="detail"><div><span class="cap">${mdy(f.date)} · ${f.tail}</span><h1>Local · KSUS</h1><p class="meta" style="margin:8px 0 0">${f.type} · Instructor ${f.instr}</p></div>
  <div class="num" style="font-size:2.5rem;color:var(--ds-pilot)">${hrs(f.total)}</div>
  <div class="grid"><div><span class="cap">PIC</span><i class="num" style="font-size:1.75rem">${fmt(f.pic)}</i></div><div><span class="cap">Dual</span><i class="num" style="font-size:1.75rem">${fmt(f.dual)}</i></div><div><span class="cap">Landings</span><i class="num" style="font-size:1.75rem">${f.ldg}</i></div></div>
  ${f.debrief ? `<div><span class="cap">Debrief</span><p style="margin:8px 0 0;font-size:1.0625rem;line-height:1.45">${f.debrief.well} <span class="meta">To work on: ${f.debrief.work}</span></p></div>` : ''}
  <div class="meta">Cost stays on the Costs tab, not in the Logbook.</div></div>`;

// =========================================================== DIRECTION A: Panel
const A = {};
const gaugeLen = 301.6; // 270 degrees of a 64px radius circle
A.hero = ({ wide = false } = {}) => {
  const pct = TOTAL_REQ.cur / TOTAL_REQ.min; const on = r2(gaugeLen * pct);
  return `<div class="hero rise" style="${wide ? 'grid-template-columns:auto 1fr;' : ''}">
    <div class="gauge" role="img" aria-label="Total time ${fmt(PILOT_TOTAL)} h of the 40 h Private Pilot minimum">
      <svg viewBox="0 0 148 148" aria-hidden="true"><circle class="track" cx="74" cy="74" r="64" stroke-dasharray="${gaugeLen} 999"/><circle class="arc" cx="74" cy="74" r="64" stroke-dasharray="${on} 999"/></svg>
      <div class="mid"><span class="num" data-count="${fmt(PILOT_TOTAL)}">${fmt(PILOT_TOTAL)}</span><span class="meta">h pilot time</span></div>
      <span class="e l">0 h</span><span class="e r">${TOTAL_REQ.min} h</span>
    </div>
    <div class="txt"><span class="cap">Private Pilot</span><b>${fmt(NEED)} h to the ${TOTAL_REQ.min} h total-time minimum</b>
      <a class="link" href="#">${MET} of ${REQS.length} requirements met ${chevR}</a>
      <div class="segs" role="img" aria-label="${MET} of ${REQS.length} requirements met">${REQS.map((r) => `<i class="${r.cur >= r.min ? 'on' : ''}"></i>`).join('')}</div>
      <span class="meta">Total time only counts pilot flights. Passenger time never counts.</span></div></div>`;
};
A.fleet = () => `<div class="fleet" role="group" aria-label="Aircraft flown, pilot hours">${FLEET.map((a, i) => `<button class="fleet-card" aria-pressed="${i === 0}" type="button">${thumb()}<b>${a.tail}</b><span class="m">${fmt(a.hours)} h · ${plural(a.flights, 'flight', 'flights')}</span></button>`).join('')}</div>`;
A.row = (e, sel) => {
  const d = dayMon(e.date); const g = e.kind === 'ground';
  return `<a class="row ${g ? 'ground' : ''} ${sel === e.id && !g ? 'sel' : ''}" href="#" aria-label="${mdy(e.date)}"><span class="dateblk"><b>${d.day}</b><i>${d.mon}</i></span>${thumb(g)}
    <span class="m"><span class="p">${g ? e.topics : `${e.tail} · KSUS`}</span><span class="s">${mdy(e.date)} · ${e.instr}</span></span><span class="t">${fmt(e.total)}<span class="u">h</span></span></a>`;
};
A.months = ({ sel = 0, limit = 99, focusIdx = -1 } = {}) => groups().slice(0, limit).map((g, i) => `<section><div class="mh ${i === focusIdx ? 'mk-focus' : ''}"><span class="a">${g.label}</span><span class="b">${fmt(g.fh)} h</span><span class="c">${plural(g.flights, 'flight', 'flights')}</span>${g.grounds ? `<span class="g" style="grid-column:1">Ground ${fmt(g.gh)} h · ${plural(g.grounds, 'session', 'sessions')}</span>` : ''}</div><div class="rows">${g.rows.map((e) => A.row(e, sel)).join('')}</div></section>`).join('');
A.phoneBody = ({ view = 'List', focusIdx = -1 } = {}) => `<div class="v2 A">${tabsW('')}${A.hero()}<span class="cap" style="margin-bottom:-12px">Aircraft · pilot hours</span>${A.fleet()}${ctl(view)}${countsP}${view === 'Ledger' ? ledger({ narrow: true }) : A.months({ focusIdx })}</div>`;
A.deskBody = ({ view = 'List' } = {}) => `<div class="v2 A d" style="width:100%">${tabsW('width:100%')}
  <div class="top2">${A.hero({ wide: true })}<div style="display:grid;gap:12px;align-content:center"><span class="cap">Aircraft · pilot hours</span>${A.fleet()}</div></div>
  ${view === 'Ledger' ? `<div style="display:grid;gap:16px">${ctl('Ledger')}${countsP}${ledger({ narrow: false })}</div>`
    : `<div class="panes"><div style="display:grid;gap:8px">${ctl('List')}${countsP}${A.months({ sel: 19, limit: 2 })}<button class="gl clear" style="justify-self:start">Show 2 more months</button></div><div style="border-left:1px solid var(--ds-hair);padding-left:32px">${detail(ENTRIES.find((e) => e.id === 19 && e.kind === 'flight'))}</div></div>`}</div>`;

// =========================================================== DIRECTION B: Timeline
const B = {};
B.hero = () => {
  const blocks = 20; const per = TOTAL_REQ.min / blocks; const filled = TOTAL_REQ.cur / per; const full = Math.floor(filled); const part = filled - full;
  return `<div class="hero rise"><div class="big"><div><span class="cap">Private Pilot</span><div class="num" data-count="${fmt(PILOT_TOTAL)}" style="margin-top:8px">${hrs(PILOT_TOTAL)}</div></div><span class="cap">Total time, pilot flights</span></div>
    <div class="blocks" role="img" aria-label="Total time ${fmt(PILOT_TOTAL)} h of ${TOTAL_REQ.min} h">${Array.from({ length: blocks }, (_, i) => `<i class="${i < full ? 'on' : ''}" ${i === full ? `style="background:linear-gradient(90deg,var(--ds-pilot) ${Math.round(part * 100)}%,var(--ds-surface-3) ${Math.round(part * 100)}%)"` : ''}></i>`).join('')}</div>
    <div class="ends"><span>0 h</span><span>each block is 2 h</span><span>${TOTAL_REQ.min} h minimum</span></div>
    <div class="reqline"><b>${fmt(NEED)} h to go</b><a class="link" href="#">${MET} of ${REQS.length} requirements met ${chevR}</a></div></div>`;
};
B.chips = () => `<div class="chips" role="group" aria-label="Filter by aircraft"><button class="chip" aria-pressed="true" type="button"><b>All</b> ${fmt(PILOT_TOTAL)} h</button>${FLEET.map((a) => `<button class="chip" aria-pressed="false" type="button"><span class="thumb">${plane}</span><b>${a.tail}</b> ${fmt(a.hours)} h</button>`).join('')}</div>`;
B.card = (e, sel) => {
  const g = e.kind === 'ground';
  return `<a class="card ${g ? 'ground' : ''} ${sel === e.id && !g ? 'sel' : ''}" href="#">${thumb(g)}<span class="m"><span class="p">${g ? e.topics : 'Local · KSUS'}</span><span class="s">${mdy(e.date)} · ${e.instr}${g ? ' · Ground session' : `<span class="tl-tail"> · ${e.tail}</span>`}</span></span><span class="t">${fmt(e.total)}<span class="u">h</span></span></a>`;
};
B.months = ({ sel = 0, limit = 99, focusIdx = -1 } = {}) => `<div class="tl">${groups().slice(0, limit).map((g, i) => `<div class="mnode ${i === focusIdx ? 'mk-focus' : ''}"><span class="a">${g.label}</span><span class="b"><strong>${fmt(g.fh)} h</strong> · ${plural(g.flights, 'flight', 'flights')}${g.grounds ? `<span class="g">Ground ${fmt(g.gh)} h · ${plural(g.grounds, 'session', 'sessions')}</span>` : ''}</span></div>${g.rows.map((e) => B.card(e, sel)).join('')}`).join('')}</div>`;
B.phoneBody = ({ view = 'List', focusIdx = -1 } = {}) => `<div class="v2 B">${tabsW('')}${B.hero()}${B.chips()}${ctl(view)}${countsP}${view === 'Ledger' ? ledger({ narrow: true }) : B.months({ focusIdx })}</div>`;
B.side = () => `<aside class="side" aria-label="Summary"><div class="panel">${B.hero().replace('class="hero rise"', 'class="hero rise" style="padding:0"')}</div>
  <div class="panel"><span class="cap">Aircraft · pilot hours (tap to filter)</span><div class="flist">${FLEET.map((a) => `<a href="#"><span class="thumb">${plane}</span><b>${a.tail}<br><span class="meta" style="font-weight:500">${a.type} · ${plural(a.flights, 'flight', 'flights')}</span></b><span class="num">${fmt(a.hours)} h</span></a>`).join('')}</div></div></aside>`;
B.deskBody = ({ view = 'List' } = {}) => `<div class="v2 B d" style="width:100%">${tabsW('width:100%')}
  ${view === 'Ledger' ? `<div style="display:grid;gap:16px">${B.hero()}${ctl('Ledger')}${countsP}${ledger({ narrow: false })}</div>`
    : `<div class="twocol"><div style="display:grid;gap:16px;align-content:start">${ctl('List')}${countsP}${B.months({ sel: 19, limit: 2 })}<button class="gl clear" style="justify-self:start">Show 2 more months</button></div>${B.side()}</div>`}</div>`;
B.deskDetail = () => `<div class="v2 B d" style="width:100%">${tabsW('width:100%')}<div class="twocol"><div style="display:grid;gap:16px;align-content:start">${ctl('List')}${countsP}${B.months({ sel: 19, limit: 1 })}</div><div class="panel">${detail(ENTRIES.find((e) => e.id === 19 && e.kind === 'flight'))}</div></div></div>`;

// ---------- artboards
const P = (body, cap2) => phone({ title: 'Logbook', body, tab: 'Flying', cap: cap2 });
const D = (body, cap2) => desk({ tab: 'Flying', title: 'Logbook', body, cap: cap2 });
const shell = (title, inner) => `<!doctype html><html lang="en" data-ds-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${title}</title><style>${dsCss}\n${MOCK}\n${V2}</style></head><body class="ds-root"><div class="pg v2pg">${inner}</div><script>document.querySelectorAll('.ds-scroll').forEach(function(s){var f=s.querySelector('.mk-focus');if(f){s.scrollTop=f.getBoundingClientRect().top-s.getBoundingClientRect().top+s.scrollTop-90}});
/* count-up on the hero number (explanatory motion; skipped under reduced motion) */
if(!matchMedia('(prefers-reduced-motion: reduce)').matches){document.querySelectorAll('[data-count]').forEach(function(el){var t=parseFloat(el.dataset.count),t0=performance.now(),n=el.firstChild;(function f(now){var p=Math.min(1,(now-t0)/700),e=1-Math.pow(1-p,3);n.nodeValue=(t*e).toFixed(2);if(p<1)requestAnimationFrame(f)})(t0)})}</script></body></html>`;
const NAV = `<nav class="topnav" aria-label="Mockups">${[['logbook-v2.html', 'Overview'], ['logbook-v2-a.html', 'A · Panel'], ['logbook-v2-b.html', 'B · Timeline']].map(([h, l]) => `<a class="gl clear gl-chip" href="${h}">${l}</a>`).join('')}</nav>`;
const sec = (t, note = '') => `<h2 class="s">${t}</h2>${note ? `<p class="note">${note}</p>` : ''}`;
const rowsOf = (...f) => `<div class="row">${f.join('')}</div>`;

const pageFor = (key, title, lead, M) => shell(`Logbook v2 · ${title}`, `${NAV}<h1 class="t">Logbook v2 · ${title}</h1><p class="lead">${lead}</p>
  ${sec('Phone, 390 px', 'List first screen, the same list scrolled to the month groups, the Ledger, and the empty state.')}
  ${rowsOf(P(M.phoneBody(), 'List: hero, aircraft, controls, then months.'), P(M.phoneBody({ focusIdx: 1 }), 'Scrolled: months with flight hours only; ground on its own muted line.'), P(M.phoneBody({ view: 'Ledger' }), 'Ledger: same switch. Totals row = month sums = fleet strip.'), P(`<div class="v2 ${key}">${tabsW('')}${emptyState()}</div>`, 'Empty state: one primary action, no zero tiles.'))}
  ${sec('Desktop, 1440 px', 'One frame under the top bar (rail clear on the left, bar edge on the right); the Flying tab strip spans it.')}
  ${rowsOf(D(M.deskBody(), 'List with the open entry beside it.'))}${rowsOf(D(M.deskBody({ view: 'Ledger' }), 'Ledger: full frame.'))}
  ${M.extra ? rowsOf(M.extra()) : ''}`);
B.extra = () => D(B.deskDetail(), 'With a flight open, the summary column gives way to the flight.');
write('logbook-v2-a.html', pageFor('A', 'A · Panel', 'A gauge hero, an aircraft strip, and rows with a date block and a type illustration. Dense, scannable, instrument-like.', A));
write('logbook-v2-b.html', pageFor('B', 'B · Timeline', 'A segmented total-time bar, aircraft as filter chips, and flight cards hung on a month timeline. Roomier and more narrative; the summary lives in a side column on desktop.', B));

// ---------- overview with the differences table
const rowsT = [
  ['Hero', 'Flat card: “As pilot”, big number, one line, thin bar.', 'Gauge ring (270°) with 0 h and 40 h at its ends, number inside, a six-segment requirement strip under it.', 'No card. Big number over a 20-block bar (2 h per block) with 0 h / 40 h ends; the same on desktop in a side column.'],
  ['Rows', 'Text only: route, “date · tail”, hours on the right.', 'Date block (day / month), type illustration, “tail · route”, second line “date · instructor”, hours.', 'Each flight is a card: illustration, route, second line “date · tail · instructor”, large hours.'],
  ['Aircraft strip', 'None.', 'Horizontal cards: illustration, tail, hours · flights. Tap filters the list.', 'Chips (phone) or a list in the side column (desktop): tail, type, flights, hours. Tap filters.'],
  ['Thumbnails', 'Camera icon only.', 'Type illustration now; the aircraft photo slots into the same 48 px square later (Task 5).', 'Same 48 px square on the card; larger on the desktop flight view.'],
  ['Month grouping', 'Header line per month.', 'Month label left, flight hours as the big figure right, ground on a muted second line.', 'Timeline spine with a node per month; flight hours inline, ground muted below.'],
  ['Frame (1440)', 'Tabs and list in a 416 px column, detail beside.', 'Full-width tab strip, hero + aircraft band across the frame, then list and detail panes.', 'Full-width tab strip, list left, sticky summary column right (a flight replaces it).'],
  ['Empty states', 'Icon, title, text, button.', 'Larger illustration, one action; the gauge is hidden until there is a flight.', 'Same illustration; the bar starts at zero with its labels so the goal is visible.'],
  ['Motion', 'Press feedback only.', 'Gauge draws in, number counts up, rows spring on press, View Transition into the flight.', 'Blocks fill in, cards rise in, spring press, View Transition from card to flight. All off under reduced motion.'],
];
write('logbook-v2.html', shell('Logbook v2 · Overview', `${NAV}<h1 class="t">Logbook v2</h1>
  <p class="lead">Two clearly different directions for the Logbook, dark only, real tokens, placeholder data. Both keep the List / Ledger switch, month headers that show <b>flight hours only</b>, three pieces per row (primary, a second line with the date and the instructor, one value), and every capability and number of the current Logbook.</p>
  <h2 class="s">What differs from Stage 1</h2>
  <table class="tbl"><thead><tr><th></th><th>Stage 1 (now)</th><th><a href="logbook-v2-a.html">A · Panel</a></th><th><a href="logbook-v2-b.html">B · Timeline</a></th></tr></thead><tbody>${rowsT.map(([a, b, c, d]) => `<tr><th>${a}</th><td>${b}</td><td>${c}</td><td>${d}</td></tr>`).join('')}</tbody></table>
  <h2 class="s">Choose by feel</h2><p class="note"><b>A</b> if you scan many flights and want the answer to “how close am I?” in one glance with the list close behind. <b>B</b> if you want each flight to feel like an entry in a book, with the summary kept to the side.</p>
  <h2 class="s">Open questions</h2><p class="note">Rows carry the date twice in A (date block and “MM/DD/YYYY” on the second line): it keeps every row’s full date as the rules ask. Say if you would rather keep the block only.</p>`));
console.log('built logbook-v2*.html');
