// Builds the B-CALM mockups (static HTML, NO app code, NO database):   node docs/design/bcalm/build.mjs
//   docs/design/logbook-bcalm.html   the calm Logbook: phone list, scrolled with an older month open, month jumper, filter sheet, Flying switcher, Ledger, empty,
//                                    loading; desktop two-pane list and open flight; with the before/after numbers (docs/design/bcalm/measured.json)
//   docs/design/home-bcalm.html      Home in the same calm style, phone and desktop
// DATA IS PLACEHOLDER but REAL-SHAPED: 26 near-identical local flights over 8 months, 6 ground sessions, 3 tails, 2 instructors. Nothing comes from the database.
// Real design-system CSS and the real minimalist stylesheet are inlined, so glass bars, V-a buttons, sheets and the Ledger are the real ones.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dsCss, glass, phone, desk, I, seg, ib, topbar, tabbar } from '../logbook-revamp/lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (...p) => fs.readFileSync(path.join(here, ...p), 'utf8');
const MOCK = read('..', 'logbook-revamp', 'mock.css');
const MIN = fs.readFileSync(path.join(here, '..', '..', '..', 'client', 'src', 'ds', 'minimal.css'), 'utf8');
const CALM = read('bcalm.css');
const write = (name, html) => fs.writeFileSync(path.join(here, '..', name), html.replace(/\r\n/g, '\n'));
const r2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => n.toFixed(2);
const mdy = (d) => `${d.slice(5, 7)}/${d.slice(8)}/${d.slice(0, 4)}`;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ---------------------------------------------------------------- real-shaped placeholder data
const TAILS = ['N111AA', 'N222BB', 'N777GG']; const INSTR = ['P. Rivera', 'S. Ortiz'];
const PLAN = { '2026-10': [5, 4, 3, 2, 1, 1], '2026-09': [12, 10, 4, 2, 1], '2026-08': [28, 26, 24, 21, 19], '2026-07': [29, 22, 15], '2026-06': [24, 17, 9], '2026-05': [20, 6], '2026-04': [14], '2026-03': [11] };
const HOURS = [1.5, 1.3, 1.7, 1.6, 1.2, 2.1, 1.4, 1.1, 1.8, 1.6, 1.5, 1.3, 1.7, 1.6, 1.4, 1.2, 1.9, 1.5, 1.3, 1.6, 1.4, 1.7, 1.2, 1.5, 1.8, 1.3];
let seq = 0; const FLIGHTS = [];
for (const [ym, days] of Object.entries(PLAN)) for (const d of days) { const i = seq++; FLIGHTS.push({ kind: 'flight', id: 100 - i, date: `${ym}-${String(d).padStart(2, '0')}`, total: HOURS[i], tail: TAILS[i % 3], instr: INSTR[i % 5 === 4 ? 1 : 0] }); }
const GROUND = [['2026-10-02', 1.2, 'Weather'], ['2026-08-14', 1.0, 'Weight and balance'], ['2026-08-07', 1.5, 'Regulations'], ['2026-07-20', 1.6, 'Checklist'], ['2026-05-09', 1.4, 'Airspace'], ['2026-03-18', 1.1, 'Aerodynamics']]
  .map(([date, total, topics], i) => ({ kind: 'ground', id: 10 - i, date, total, topics, instr: INSTR[0] }));
const TOTAL = r2(FLIGHTS.reduce((s, f) => s + f.total, 0));
const groups = () => { const m = new Map(); for (const e of [...FLIGHTS, ...GROUND].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)) { const k = e.date.slice(0, 7); if (!m.has(k)) m.set(k, { key: k, name: MONTHS[+k.slice(5) - 1], flights: [], grounds: [], fh: 0, gh: 0 }); const g = m.get(k); if (e.kind === 'flight') { g.flights.push(e); g.fh = r2(g.fh + e.total); } else { g.grounds.push(e); g.gh = r2(g.gh + e.total); } } return [...m.values()]; };
const G = groups();
if (r2(G.reduce((s, g) => s + g.fh, 0)) !== TOTAL || FLIGHTS.length !== 26 || G.length !== 8 || GROUND.length !== 6) throw new Error('mock data shape drifted');
const MIN_HOURS = 40; const LEFT = r2(MIN_HOURS - TOTAL);

// ---------------------------------------------------------------- pieces
const ic = (n) => I(n, 'ic');
const loop = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>';
const calendar = '<svg class="ds-i" viewBox="0 0 24 24" aria-hidden="true"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
const chev = (up = false) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${up ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6'}"/></svg>`;
const chevR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
const iconBtn = (n, label) => `<button class="gl clear icon" aria-label="${label}" title="${label}">${I(n)}</button>`;
const jump = `<button class="gl clear icon" aria-label="Jump to a month" title="Jump to a month">${calendar}</button>`;
const ctl = (view = 'List', withJump = true) => `<div class="bc-ctl">${seg(['List', 'Ledger'], view)}<span class="ic2">${withJump ? jump : ''}${iconBtn('search', 'Search')}${iconBtn('sliders', 'Filter and sort')}</span></div>`;
const hero = () => `<button class="bc-hero" data-card aria-label="Private Pilot: ${fmt(TOTAL)} hours, ${fmt(LEFT)} to the ${MIN_HOURS} hour total-time minimum. Open details"><span class="lab">Private Pilot</span><span class="n">${fmt(TOTAL)}<small>h</small></span><span class="bc-line" role="img" aria-label="Pilot total time ${fmt(TOTAL)} of ${MIN_HOURS} hours toward the Private Pilot minimum"><i style="width:${(TOTAL / MIN_HOURS) * 100}%"></i></span></button>`;
const row = (f, { full = false, sel = false } = {}) => `<a class="bc-row ${full ? 'full' : ''} ${sel ? 'sel' : ''}" data-row href="#" aria-label="${mdy(f.date)}, local KSUS, ${f.tail}, instructor ${f.instr}, ${fmt(f.total)} hours" title="${mdy(f.date)}"><span class="day" aria-hidden="true">${full ? mdy(f.date) : f.date.slice(8)}</span><span class="t">${loop}<span>${f.tail}</span><em>${f.instr}</em></span><span class="v" aria-hidden="true">${fmt(f.total)}</span></a>`;
const groundLine = (g) => g.grounds.length ? `<button class="bc-ground" aria-label="${g.grounds.length} ground session${g.grounds.length === 1 ? '' : 's'} in ${g.name}, ${fmt(g.gh)} hours. Open"><span>${g.grounds.length} ground session${g.grounds.length === 1 ? '' : 's'}</span>${chevR}</button>` : '';
const month = (g, open, o = {}) => `<section class="bc-month ${open ? 'open' : ''} ${o.focus ? 'mk-focus' : ''}" aria-label="${g.name}, ${fmt(g.fh)} flight hours"><button class="bc-mh" aria-expanded="${open}" aria-label="${g.name}, ${fmt(g.fh)} flight hours"><span>${g.name}</span><span class="r">${fmt(g.fh)}${chev(open)}</span></button>${open ? `${g.flights.map((f, i) => row(f, { full: o.full, sel: o.sel === f.id })).join('')}${groundLine(g)}` : ''}</section>`;
const list = (opts = {}) => G.map((g, i) => month(g, opts.open ? opts.open.includes(g.key) : i === 0, { focus: opts.focus === g.key, sel: opts.sel })).join('');
const sheet = (title, inner, extra = '') => glass('div', 'ds-sheet ds-chrome is-open', `<span class="grab"></span><div class="ds-sheet-head"><h2 class="ds-title" style="margin:0">${title}</h2><button class="ds-iconbtn" aria-label="Close" title="Close">${I('x')}</button></div><div class="ds-sheet-body"><div class="bc bc-sheet" style="padding:0 0 24px">${inner}</div></div>${extra}`, 'data-role="pop" data-force');
const switcher = (open = false) => `<button class="bc-sw" aria-haspopup="menu" aria-expanded="${open}" aria-label="Flying pages: Logbook">Logbook${chev(open)}</button>`;
const flyMenu = () => glass('div', 'ds-menu ds-chrome is-open bc-flymenu', `<div role="menu">${['Logbook', 'Currency', 'Milestones', 'Costs', 'Weather'].map((t) => `<button class="mi" ${t === 'Logbook' ? 'aria-current="page"' : ''}>${t === 'Logbook' ? I('check') : '<span style="width:22px;flex:none"></span>'}${t}</button>`).join('')}</div>`);
const empty = (pax = false) => `<div class="bc-empty"><div class="ill"><svg viewBox="0 0 48 48"><path d="M24 4c1.6 0 2.4 2 2.4 5v8l17 4v4l-17-1.2V36l5 3v3l-7.4-1.4L16.6 42v-3l5-3V20.8L4.6 22v-4l17-4V9c0-3 .8-5 2.4-5z"/></svg></div><h3>Nothing logged yet</h3><button class="gl ${pax ? 'pax' : 'pilot'} lg">Log a flight</button></div>`;
const skeleton = () => `<div class="bc-skel" role="status" aria-label="Loading"><i class="n"></i><i class="b"></i><i class="h"></i><i></i><i></i><i></i><i></i></div>`;

// ---------------------------------------------------------------- frames
const attr = (html, name, kind) => html.replace('<figure class="mk-fig', `<figure data-name="${name}" ${kind ? `data-calm="${kind}"` : ''} class="mk-fig`);
const P = (name, kind, body, o = {}) => attr(phone({ title: o.title ?? switcher(), body: `<div class="bc">${body}</div>`, tab: o.tab ?? 'Flying', cap: o.cap ?? '', sheet: o.sheet ?? '', scrim: Boolean(o.sheet), menuHtml: o.menuHtml ?? '' }), name, kind);
const D = (name, kind, body, o = {}) => attr(desk({ tab: o.tab ?? 'Flying', title: o.title ?? switcher(), body: `<div class="bc d" style="width:100%">${body}</div>`, cap: o.cap ?? '', menuHtml: o.menuHtml ?? '' }), name, kind);

const lbFirst = () => `${hero()}${ctl('List')}${list()}`;
const detail = (f) => `<div class="bc-detail"><span class="mut">${mdy(f.date)} · ${f.tail}</span><h1>KSUS</h1><div class="big">${fmt(f.total)}<small>h</small></div><div class="bc-trio"><div><b>${fmt(f.total)}</b><span class="mut">PIC</span></div><div><b>${fmt(f.total)}</b><span class="mut">Dual</span></div><div><b>6</b><span class="mut">Landings</span></div></div><div class="bc-sheet"><div class="bc-kv"><span class="k">Instructor</span><span class="v">${f.instr}</span></div><div class="bc-kv"><span class="k">Aircraft</span><span class="v">C172S</span></div></div><button class="gl pilot lg">Edit flight</button></div>`;

const ledger = (narrow) => {
  const z = '<td class="z">—</td>'; let body = '';
  const head = narrow ? ['Date', 'Total', 'PIC', 'Dual', 'Ldg'] : ['Date', 'Aircraft', 'Tail', 'Route', 'Total', 'PIC', 'Dual', 'Solo', 'Night', 'XC', 'Ldg'];
  for (const g of G.slice(0, 2)) {
    body += `<tr class="mo"><td colspan="${head.length}">${g.name} 2026</td></tr>`;
    for (const f of g.flights) body += narrow ? `<tr><td class="l">${mdy(f.date)}</td><td class="t">${fmt(f.total)}</td><td>${fmt(f.total)}</td><td>${fmt(f.total)}</td><td>6</td></tr>` : `<tr><td class="l">${mdy(f.date)}</td><td class="l">C172S</td><td class="l">${f.tail}</td><td class="l">KSUS</td><td class="t">${fmt(f.total)}</td><td>${fmt(f.total)}</td><td>${fmt(f.total)}</td>${z}${z}${z}<td>6</td></tr>`;
    for (const x of g.grounds) body += narrow ? `<tr class="g"><td class="l">${mdy(x.date)} Ground</td><td>${fmt(x.total)}</td>${z}${z}${z}</tr>` : `<tr class="g"><td class="l">${mdy(x.date)}</td><td class="l" colspan="3">Ground session</td><td>${fmt(x.total)}</td>${z}${z}${z}${z}${z}${z}</tr>`;
    const sub = fmt(g.fh); body += narrow ? `<tr class="sub"><td class="l">Flights</td><td>${sub}</td><td>${sub}</td><td>${sub}</td><td>${g.flights.length * 6}</td></tr>` : `<tr class="sub"><td class="l" colspan="4">${g.name} flights</td><td>${sub}</td><td>${sub}</td><td>${sub}</td>${z}${z}${z}<td>${g.flights.length * 6}</td></tr>`;
  }
  const foot = narrow ? `<tr><td class="l">Totals</td><td>${fmt(TOTAL)}</td><td>${fmt(TOTAL)}</td><td>${fmt(TOTAL)}</td><td>${FLIGHTS.length * 6}</td></tr>` : `<tr><td class="l" colspan="4">Pilot totals</td><td>${fmt(TOTAL)}</td><td>${fmt(TOTAL)}</td><td>${fmt(TOTAL)}</td>${z}${z}${z}<td>${FLIGHTS.length * 6}</td></tr>`;
  return `<div class="cl mn" style="display:block"><div class="mn-led-wrap" style="overflow:auto"><table class="mn-led"><thead><tr>${head.map((h, i) => `<th${i < (narrow ? 1 : 4) ? ' class="l"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table></div></div>`;
};

const filterSheet = sheet('Filter and sort', `<div class="bc-field"><span class="l">Show</span>${seg(['All', 'Flights', 'Ground'], 'All')}</div><div class="bc-field"><span class="l">Aircraft</span><div class="bc-chips">${TAILS.map((t, i) => `<button class="gl clear gl-chip" aria-pressed="${i === 1}">${t}<span class="mut" style="margin-left:6px">${fmt(r2(FLIGHTS.filter((f) => f.tail === t).reduce((s, f) => s + f.total, 0)))}</span></button>`).join('')}</div></div><div class="bc-field"><span class="l">Sort</span><span class="gl-select" role="button">Newest first</span></div><div class="bc-two"><div class="bc-field"><span class="l">From</span><span class="gl-select" role="button">Any</span></div><div class="bc-field"><span class="l">To</span><span class="gl-select" role="button">Any</span></div></div><button class="gl pilot lg block">Show ${FLIGHTS.length}</button>`);
const jumpSheet = sheet('Jump to a month', G.map((g, i) => `<button class="bc-pickrow" ${i === 0 ? 'aria-current="true"' : ''}><span>${g.name}</span><span class="r">${fmt(g.fh)}</span></button>`).join(''));
const heroSheet = sheet('Private Pilot', `<div class="bc-kv"><span class="k">Total time</span><span class="v">${fmt(TOTAL)} h</span></div><div class="bc-kv"><span class="k">Total-time minimum</span><span class="v">${MIN_HOURS} h</span></div><div class="bc-kv"><span class="k">Requirements met</span><span class="v">1 of 11</span></div><div class="bc-kv"><span class="k">${FLIGHTS.length} flights</span><span class="v">${fmt(TOTAL)} h</span></div><div class="bc-kv"><span class="k">${GROUND.length} ground sessions</span><span class="v">${fmt(r2(GROUND.reduce((s, g) => s + g.total, 0)))} h</span></div><button class="gl clear lg">Milestones</button>`);
const groundSheet = sheet('August, ground', G.find((g) => g.key === '2026-08').grounds.map((x) => `<a class="bc-pickrow" href="#"><span>${x.topics}<span class="mut"> · ${x.instr}</span></span><span class="r">${mdy(x.date).slice(0, 5)} · ${fmt(x.total)}</span></a>`).join('') + '<p class="mut" style="margin:0 8px">Ground time is never part of flight time.</p>');

const NAV = `<nav class="topnav" aria-label="Mockups">${[['logbook-bcalm.html', 'Logbook B-calm'], ['home-bcalm.html', 'Home B-calm'], ['logbook-bmin.html', 'Logbook B-min (before)'], ['minimal-app.html', 'Rest of the app']].map(([h, l]) => `<a class="gl clear gl-chip" href="${h}">${l}</a>`).join('')}</nav>`;
const shell = (title, inner) => `<!doctype html><html lang="en" data-ds-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${title}</title><style>${dsCss}\n${MOCK}\n${MIN}\n${CALM}\n.mpg h2.s{font-size:1.5rem;margin:48px 0 8px}.mpg .tbl{width:100%;border-collapse:collapse;margin:16px 0;font-size:.9375rem}.mpg .tbl th,.mpg .tbl td{padding:12px;text-align:left;vertical-align:top;line-height:1.45}.mpg .tbl tbody tr:nth-child(odd){background:var(--ds-surface)}.mpg .tbl thead th{color:var(--ds-text)}.mpg .tbl td.n,.mpg .tbl th.n{text-align:right;font-variant-numeric:tabular-nums}.mpg ul.pt{max-width:60rem;line-height:1.55;color:var(--ds-text-2)}.mpg ul.pt b{color:var(--ds-text)}</style></head><body class="ds-root"><div class="pg mpg">${inner}</div><script>document.querySelectorAll('.ds-scroll').forEach(function(s){var f=s.querySelector('.mk-focus');if(f){s.scrollTop=f.getBoundingClientRect().top-s.getBoundingClientRect().top+s.scrollTop-90}})</script></body></html>`;
const sec = (t, note = '') => `<h2 class="s">${t}</h2>${note ? `<p class="note">${note}</p>` : ''}`;
const strip = (...f) => `<div class="row" style="overflow-x:auto">${f.join('')}</div>`;

// measured numbers (written by: node client/scripts/check-calm.mjs --table --json ...), optional
let measured = null; try { measured = JSON.parse(read('measured.json')); } catch { /* first build */ }
const cmpTable = () => {
  if (!measured) return '<p class="note">Run the measurement to fill this table.</p>';
  const cols = ['above', 'chrome', 'accent', 'accent %', 'rows', 'first row px', 'weights', 'shapes', 'lines', 'accent numerals'];
  const rowsHtml = measured.map((m) => `<tr><td>${m.set}</td><td>${m.screen}</td>${cols.map((c) => `<td class="n">${m[c]}</td>`).join('')}</tr>`).join('');
  return `<table class="tbl"><thead><tr><th>Data</th><th>Screen</th>${cols.map((c) => `<th class="n">${c}</th>`).join('')}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
};

const auditTable = () => {
  if (!measured) return '';
  const cols = ['above', 'chrome', 'accent', 'accent %', 'rows', 'weights', 'lines'];
  const rows = measured.filter((m) => m.set.startsWith('Phase B screens'));
  return `<table class="tbl"><thead><tr><th>Screen</th>${cols.map((c) => `<th class="n">${c}</th>`).join('')}</tr></thead><tbody>${rows.map((m) => `<tr><td>${m.screen}</td>${cols.map((c) => `<td class="n">${m[c]}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
};
const diagnosis = `<ul class="pt">
<li><b>The word budget passed (40 words); the overwhelm is visual.</b> Measured on your real data, phone: the first flight starts <b>586 px down an 844 px screen</b>, with <b>16 content elements and 17 bar and tab elements</b> above it, and only <b>3 rows</b> fit on the first screen.</li>
<li><b>Hours in the list are NOT accent-coloured</b> (0 of 26 numerals; they are white). That guess was wrong for the current build. The accent is on 6 elements: the 56 px hero number (4.4% of the phone screen is bright blue text, almost all of it that one number), its bar, the selected tab, the Add button, the selected List segment.</li>
<li><b>Confirmed:</b> every one of the 26 rows is the same shape (all 20 flights are local KSUS; one row design repeated), months are surfaces inside surfaces, and the controls stack up: title bar, five Flying tabs, hero with an info button and a 1/11 chip, three aircraft chips plus the plane chip, List / Ledger / search / filter, then the month header.</li>
<li><b>Confirmed in part:</b> 6 of the 26 rows are ground sessions, mixed among the flights month by month. Dividers are not the problem (1 border on screen). The per-month sublines were already gone.</li>
</ul>`;
const proposal = `<ul class="pt">
<li><b>One bright thing per screen.</b> The hero number is white; the thin progress line, the Add button and the selected tab carry the accent. Hours in lists are neutral at a medium weight. Accent elements on screen: 6 to 3. Accent text: 4.4% to 0%.</li>
<li><b>Collapsed history.</b> The current month is open; earlier months are one line each (month, flight hours, chevron). Search or a filter opens the matching months and shows the full date. A calendar icon (jump to a month) appears once there are more than six earlier months.</li>
<li><b>Ground sessions leave the flight list:</b> one muted line per month ("2 ground sessions") opens them in a sheet, dated. They stay in the Ledger and in the Show filter.</li>
<li><b>Fewer controls.</b> The five Flying tabs become the title menu (a switcher; every page is one tap away). Aircraft (with hours) and Show (All / Flights / Ground) move into the filter sheet. One control row: List / Ledger, jump, search, filter. The 1/11 chip, the 40 h minimum and the info button become one tap on the hero.</li>
<li><b>Rows:</b> day, tail with the instructor muted, hours. A local flight shows a small loop icon and no route; a flight whose airports differ shows its route. 72 px rows, no dividers, no month surfaces.</li>
<li><b>Honest costs.</b> Opening an older month is one extra tap, and the Flying tabs are one tap deeper (the title menu). Offsets: the current month is open, each collapsed line still shows its flight hours, the jumper and search reach any month directly, the Ledger shows everything at once, and the months you open stay open for the session. Home gets one hero, one status line, a quiet map and four items.</li>
</ul>`;
const limits = `<table class="tbl"><thead><tr><th>Measure</th><th class="n">List screens (Logbook, Travel)</th><th class="n">Home</th><th class="n">Other screens</th></tr></thead><tbody>
<tr><td>Elements above the first row</td><td class="n">at most 10</td><td class="n">at most 8</td><td class="n">at most 12</td></tr>
<tr><td>Accent-coloured elements</td><td class="n">at most 4</td><td class="n">at most 4</td><td class="n">at most 6</td></tr>
<tr><td>Accent text, % of the screen</td><td class="n">0.5</td><td class="n">0.5</td><td class="n">2.5</td></tr>
<tr><td>Rows on the first screen</td><td class="n">5 to 8</td><td class="n">n/a</td><td class="n">n/a</td></tr>
<tr><td>First row starts (phone)</td><td class="n">at most 400 px</td><td class="n">n/a</td><td class="n">n/a</td></tr>
<tr><td>Font weights / row shapes / lines</td><td class="n">3 / 2 / 3</td><td class="n">4 / n/a / 3</td><td class="n">4 / n/a / 6</td></tr>
<tr><td>Accent-coloured list numerals</td><td class="n">none</td><td class="n">none</td><td class="n">none</td></tr></tbody></table>`;

// ================================================================ LOGBOOK B-calm
const phoneFigs = [
  P('Logbook · phone list', 'list', lbFirst(), { cap: 'First screen. The title is the switcher for the other Flying pages. One hero, one control row, the current month open, earlier months one line each.' }),
  P('Logbook · scrolled, August open', null, list({ open: ['2026-10', '2026-08'], focus: '2026-08' }), { cap: 'Scrolled: an older month opened by its line. Ground sessions are one muted line per month.' }),
  P('Logbook · month jumper', null, lbFirst(), { sheet: jumpSheet, cap: 'The calendar icon appears when there are more than six earlier months. Tap a month to open it and scroll there.' }),
  P('Logbook · filter and sort', null, lbFirst(), { sheet: filterSheet, cap: 'Aircraft and Show (All / Flights / Ground) live here. Aircraft is a filter, with its hours.' }),
  P('Logbook · Flying switcher', null, lbFirst(), { menuHtml: flyMenu(), cap: 'The five Flying tabs became the title menu. Every page stays one tap away.' }),
  P('Logbook · Private Pilot details', null, lbFirst(), { sheet: heroSheet, cap: 'Tap the hero: the 40 h minimum, the requirement count, the flight and ground counts.' }),
  P('Logbook · ground sessions', null, lbFirst().replace('<section class="bc-month open"', '<section class="bc-month open"'), { sheet: groundSheet, cap: 'A month\'s ground sessions: dated, one line each, opened from the muted line.' }),
  P('Logbook · ledger', null, `${hero()}${ctl('Ledger')}${ledger(true)}`, { cap: 'Ledger: dense by design, calm spacing, aligned columns, neutral numerals.' }),
  P('Logbook · search "N222BB"', null, `${hero()}${ctl('List')}<p class="mut" style="margin:0 8px">Matching</p>${[G[0], G[1]].map((g) => month({ ...g, flights: g.flights.filter((f) => f.tail === 'N222BB') }, true, { full: true })).join('')}`, { cap: 'Search or a filter opens the matching months and shows the full date on each row.' }),
  P('Logbook · empty', null, empty(), { cap: 'Empty: one line and one action (the one bright thing).' }),
  P('Logbook · loading', null, skeleton(), { cap: 'Loading: the shapes of the content, no spinner and no words.' }),
];
const deskFigs = [
  D('Logbook · desktop list', 'list', `<div class="bc-cols"><div style="display:grid;gap:24px;align-content:start">${ctl('List')}${list()}</div><div class="bc-side">${hero()}</div></div>`, { cap: '1440: the list left; the summary right, bigger. The Flying switcher is the title.' }),
  D('Logbook · desktop, open flight', 'list', `<div class="bc-cols"><div style="display:grid;gap:24px;align-content:start">${ctl('List')}${list({ sel: FLIGHTS[1].id })}</div><div class="bc-side">${detail(FLIGHTS[1])}</div></div>`, { cap: 'A flight open beside the list.' }),
];
write('logbook-bcalm.html', shell('Logbook B-calm', `${NAV}<h1 class="t">Logbook · B-calm</h1><p class="lead">The calm pass: one bright thing per screen, neutral hours, collapsed history, ground sessions out of the flight list, fewer controls. Dark only. <b>Placeholder data, real-shaped</b>: 26 near-identical local flights over 8 months, 6 ground sessions.</p>
${sec('What is overwhelming, measured')}${diagnosis}${sec('B-calm: what changes')}${proposal}${sec('Measured: the Logbook before, and these mockups', 'Same measuring function on the real pages (before) and on these mockups (after), first screen. Phone is 390 x 844, desktop 1440 x 900. Fewer is calmer.')}${cmpTable()}
${sec('Phone · 390 px')}${strip(...phoneFigs)}${sec('Desktop · 1440 px')}${strip(...deskFigs)}${sec('Proposed limits (client/scripts/check-calm.mjs)')}${limits}${sec('Phase B screens against the same measures (report only, real data, now)')}${auditTable()}`));

// ================================================================ HOME B-calm
const mapSvg = `<svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><path class="land" d="M0 40C14 30 22 44 38 36S64 22 78 30 92 38 100 32V60H0Z"/><path class="rt" d="M52 34C58 24 66 22 74 26"/><path class="rt" d="M52 34C48 44 40 46 30 44"/><path class="rt" d="M52 34C56 30 60 29 64 30"/><circle class="home" cx="52" cy="34" r="3"/></svg>`;
const homeBody = (d) => {
  const left = `<p class="bc-greet">Good evening</p>${hero()}<a class="bc-status" href="#" aria-label="2 items need attention. Open Currency"><span class="mn-sdot warn" role="img" aria-label="Attention"></span><span>2 need attention</span><span class="r">${chevR}</span></a>`;
  const items = `<div class="bc-list"><a class="bc-item" href="#" data-row aria-label="Passenger, 120.50 hours, 41 flights"><span>Passenger</span><span class="r"><b>120.50</b>${chevR}</span></a><a class="bc-item" href="#" aria-label="Weather at KSUS, clear"><span>KSUS weather</span><span class="r">Clear${chevR}</span></a><a class="bc-item" href="#" aria-label="Quick log"><span>Quick log</span><span class="r">${chevR}</span></a><a class="bc-item" href="#" aria-label="Last flight 09/12/2026, N777GG, 1.10 hours"><span>09/12 · N777GG</span><span class="r"><b>1.10</b>${chevR}</span></a></div>`;
  const map = `<a class="bc-map" href="#" aria-label="Map: 25 airports, 9 countries. Open the map">${mapSvg}</a>`;
  return d ? `<div class="bc-home-cols"><div style="display:grid;gap:32px;align-content:start">${left}${items}</div>${map}</div>` : `${left}${map}${items}`;
};
const homeFigs = [
  attr(phone({ title: 'Home', body: `<div class="bc">${homeBody(false)}</div>`, tab: 'Home' }), 'Home · phone', 'home'),
  attr(desk({ tab: 'Home', title: 'Home', body: `<div class="bc d" style="width:100%">${homeBody(true)}</div>` }), 'Home · desktop', 'home'),
];
write('home-bcalm.html', shell('Home B-calm', `${NAV}<h1 class="t">Home · B-calm</h1><p class="lead">One hero, one status line, a quiet map, and four items. The airports, countries and distance sit behind the map and the Passenger line. Placeholder data.</p>${sec('Home · phone and desktop')}${strip(...homeFigs)}`));
console.log('built: logbook-bcalm.html (', phoneFigs.length, 'phone +', deskFigs.length, 'desktop figures ), home-bcalm.html');
