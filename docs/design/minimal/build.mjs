// Builds the MINIMAL mockups (static HTML, NO app code, NO database):  node docs/design/minimal/build.mjs
//   docs/design/logbook-bmin.html   Logbook "B-min" (phone: list, scrolled, ledger, empty, loading, month sheet, aircraft sheet; desktop: list, open flight)
//   docs/design/minimal-app.html    the rest of the app with the same rules (Home, flight detail, Travel, Costs, Currency, Milestones, Weather, Stats,
//                                   Map, Aircraft, More, log-a-flight sheet for both roles), each at 390 and 1440
//   docs/design/minimal.html        overview + the rules in one place
// Every figure carries data-words-max (its word budget, client/src/lib/wordBudget.js) so client/scripts/check-words.mjs --mockups can fail it.
// DATA IS PLACEHOLDER (invented tails, instructors, airports). Serve with `node docs/design/serve.mjs`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dsCss, phone, desk, glass, FLIGHTS, GROUND, groups, fmt, dayMon, mdy, I, seg, flyTabs, PILOT_TOTAL, GROUND_TOTAL, PIC_TOTAL, LANDINGS, REQS } from '../logbook-revamp/lib.mjs';
import { ico } from '../calm/views.mjs';
import { BUDGETS } from '../../../client/src/lib/wordBudget.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const MOCK = fs.readFileSync(path.join(here, '..', 'logbook-revamp', 'mock.css'), 'utf8');
const MIN = fs.readFileSync(path.join(here, 'min.css'), 'utf8');
const write = (name, html) => fs.writeFileSync(path.join(here, '..', name), html.replace(/\r\n/g, '\n'));
const r2 = (n) => Math.round(n * 100) / 100;
const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

// ---------------------------------------------------------------- data (derived, never stored)
const FLEET = ['N123AB', 'N456CD', 'N789EF'].map((tail) => { const fl = FLIGHTS.filter((f) => f.tail === tail); return { tail, hours: r2(fl.reduce((s, f) => s + f.total, 0)), flights: fl.length }; });
const TOTAL = REQS.find((r) => r.k === 'total'); const NEED = r2(TOTAL.min - TOTAL.cur); const MET = REQS.filter((r) => r.cur >= r.min).length;
if (r2(FLEET.reduce((s, f) => s + f.hours, 0)) !== PILOT_TOTAL || r2(groups().reduce((s, g) => s + g.fh, 0)) !== PILOT_TOTAL) throw new Error('totals drifted');
const PAX = 60.95;

// ---------------------------------------------------------------- pieces
const gl = (n) => I(n, 'glyph');
const plane = '<svg class="glyph" viewBox="0 0 48 48" aria-hidden="true" style="width:100%;height:100%;stroke-width:1.5"><path d="M24 4c1.6 0 2.4 2 2.4 5v8l17 4v4l-17-1.2V36l5 3v3l-7.4-1.4L16.6 42v-3l5-3V20.8L4.6 22v-4l17-4V9c0-3 .8-5 2.4-5z"/></svg>';
const chev = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
const U = (u = 'h') => `<span class="u">${u}</span>`;
const hrs = (n, cls = 'n28') => `<span class="num ${cls}">${fmt(n)}</span>`;
const tabsW = (sel = 'Logbook', d = false) => flyTabs(sel).replace('class="gl-seg scroll fl-tabs"', `class="gl-seg scroll fl-tabs" style="${d ? 'width:100%' : ''}"`);
const iconBtn = (n, label) => `<button class="gl clear icon" aria-label="${label}" title="${label}">${gl(n)}</button>`;
const ctl = (view = 'List') => `<div class="ctl">${seg(['List', 'Ledger'], view)}<span style="display:flex">${iconBtn('search', 'Search')}${iconBtn('sliders', 'Filter and sort')}</span></div>`;
const chipsRow = (selected = 0) => `<div class="chips" role="group" aria-label="Aircraft">${['', ...FLEET.map((f) => f.tail)].map((t, i) => `<span role="button" tabindex="0" class="pill press" aria-pressed="${i === selected}" ${i ? `aria-label="${t}, ${fmt(FLEET[i - 1].hours)} hours, ${FLEET[i - 1].flights} flights" title="${fmt(FLEET[i - 1].hours)} h"` : 'aria-label="All aircraft" title="All aircraft"'}>${i ? t : gl('plane')}</span>`).join('')}</div>`;
const heroPilot = () => `<section class="hero rise" data-card><div class="top"><span class="lab">Private Pilot</span><a class="pill press" href="#" aria-label="${MET} of ${REQS.length} Private Pilot requirements met, open Milestones" title="${MET} of ${REQS.length} requirements met">${MET}/${REQS.length}${chev.replace('class="chev"', 'class="chev" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2"')}</a></div>
  <div><span class="num n56 pilot" data-count="${fmt(PILOT_TOTAL)}">${fmt(PILOT_TOTAL)}</span>${U()}</div>
  <div class="bar" role="img" aria-label="Pilot total time ${fmt(PILOT_TOTAL)} of ${TOTAL.min} hours toward the Private Pilot minimum"><i style="width:${(TOTAL.cur / TOTAL.min) * 100}%"></i></div>
  <div class="ends"><span>0</span><span>${fmt(NEED)} left</span><span>${TOTAL.min}</span></div></section>`;
const rowFor = (e, sel) => {
  const g = e.kind === 'ground'; const d = dayMon(e.date);
  const label = `${mdy(e.date)}, ${g ? 'ground session' : `${e.tail}, local KSUS`}, instructor ${e.instr}, ${fmt(e.total)} hours`;
  return `<a class="row press ${g ? 'ground' : ''} ${sel === e.id && !g ? 'sel' : ''}" data-row href="#" aria-label="${label}" title="${mdy(e.date)}"><span class="day">${d.day}</span><span class="t"><span class="pri">${g ? `${gl('cap')}Ground` : 'Local KSUS'}</span><span class="mut">${e.instr}</span></span><span class="v">${fmt(e.total)}</span></a>`;
};
const months = ({ sel = 0, limit = 99, focus = -1, skip = 0 } = {}) => groups().slice(skip, skip + limit).map((g, i) => `<section class="grp ${i === focus ? 'mk-focus' : ''}"><div class="gh"><button type="button" class="name" style="background:none;border:0;color:inherit;font:inherit;font-weight:650;min-height:44px;padding:0" aria-label="${g.label}: ${fmt(g.fh)} flight hours${g.grounds ? `, includes ${g.grounds} ground session${g.grounds > 1 ? 's' : ''}, open month details` : ''}">${g.label.split(' ')[0]}${g.grounds ? '<span class="dot" aria-hidden="true"></span>' : ''}</button><span>${hrs(g.fh)}</span></div>${g.rows.map((e) => rowFor(e, sel)).join('')}</section>`).join('');
const moreBtn = (n) => `<button class="gl clear more" type="button">${n} more months</button>`;
const empty = (title, btn, pax = false) => `<div class="empty"><div class="ill" style="${pax ? 'color:var(--ds-pax)' : ''}">${plane}</div><h3>${title}</h3><button class="gl ${pax ? 'pax' : 'pilot'} lg">${btn}</button></div>`;
const skeleton = () => `<div class="skel" aria-label="Loading" role="status"><i class="h"></i><i></i><i></i><i></i><i></i></div>`;

function ledger(narrow) {
  const head = narrow ? ['Date', 'Total', 'PIC', 'Dual', 'Ldg'] : ['Date', 'Aircraft', 'Tail', 'Route', 'Total', 'PIC', 'Dual', 'Solo', 'Night', 'XC', 'Ldg'];
  const cols = head.length; const z = '<td class="z">—</td>'; let body = '';
  for (const g of groups()) {
    const fl = g.rows.filter((r) => r.kind === 'flight');
    body += `<tr class="mo"><td colspan="${cols}">${g.label}</td></tr>`;
    for (const r of g.rows) {
      if (r.kind === 'ground') body += narrow ? `<tr class="g"><td class="l">${mdy(r.date)} Ground</td><td>${fmt(r.total)}</td>${z}${z}${z}</tr>` : `<tr class="g"><td class="l">${mdy(r.date)}</td><td class="l" colspan="3">Ground session</td><td>${fmt(r.total)}</td>${z.repeat(6)}</tr>`;
      else body += narrow ? `<tr><td class="l">${mdy(r.date)}</td><td class="t">${fmt(r.total)}</td><td>${fmt(r.pic)}</td><td>${fmt(r.dual)}</td><td>${r.ldg}</td></tr>`
        : `<tr><td class="l">${mdy(r.date)}</td><td class="l">${r.type}</td><td class="l">${r.tail}</td><td class="l">KSUS</td><td class="t">${fmt(r.total)}</td><td>${fmt(r.pic)}</td><td>${fmt(r.dual)}</td>${z}${z}${z}<td>${r.ldg}</td></tr>`;
    }
    const s = (k) => fmt(fl.reduce((a, r) => a + r[k], 0)); const ld = fl.reduce((a, r) => a + r.ldg, 0);
    body += narrow ? `<tr class="sub"><td class="l">Flights</td><td>${s('total')}</td><td>${s('pic')}</td><td>${s('dual')}</td><td>${ld}</td></tr>` : `<tr class="sub"><td class="l" colspan="4">${g.label.split(' ')[0]} flights</td><td>${s('total')}</td><td>${s('pic')}</td><td>${s('dual')}</td>${z}${z}${z}<td>${ld}</td></tr>`;
  }
  const foot = narrow ? `<tr><td class="l">Totals</td><td>${fmt(PILOT_TOTAL)}</td><td>${fmt(PIC_TOTAL)}</td><td>${fmt(PILOT_TOTAL)}</td><td>${LANDINGS}</td></tr>` : `<tr><td class="l" colspan="4">Pilot totals</td><td>${fmt(PILOT_TOTAL)}</td><td>${fmt(PIC_TOTAL)}</td><td>${fmt(PILOT_TOTAL)}</td>${z}${z}${z}<td>${LANDINGS}</td></tr>`;
  return `<div class="mk-focus" style="overflow:auto"><table class="led"><thead><tr>${head.map((x) => `<th${['Date', 'Aircraft', 'Tail', 'Route'].includes(x) ? ' class="l"' : ''}>${x}</th>`).join('')}</tr></thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table></div>`;
}

const detail = (f, d = false) => `<div class="detail">
  <div><div class="num n40">${fmt(f.total)}${U()}</div></div>
  <div><div class="pri" style="font-size:1.75rem;font-weight:800;letter-spacing:-.03em">Local KSUS</div><div class="mut" style="margin-top:8px">${mdy(f.date)} · ${f.tail}</div></div>
  <div class="trio"><div class="stat"><span class="num n28">${fmt(f.pic)}</span><span class="mut">PIC</span></div><div class="stat"><span class="num n28">${fmt(f.dual)}</span><span class="mut">Dual</span></div><div class="stat"><span class="num n28">${f.ldg}</span><span class="mut">Landings</span></div></div>
  <div class="list"><a class="li two press" href="#"><span class="pri">Instructor</span><span class="mut">${f.instr}</span></a>${f.debrief ? `<a class="li two press" href="#"><span class="pri">Debrief</span>${chev}</a>` : ''}<a class="li two press" href="#"><span class="pri">Photos</span>${chev}</a></div></div>`;

// ---------------------------------------------------------------- frames
const attr = (html, { name, max, exempt }) => html.replace('<figure class="mk-fig', `<figure data-name="${name}" ${max ? `data-words-max="${max}"` : ''} ${exempt ? `data-exempt="${exempt}"` : ''} class="mk-fig`);
const P = (name, max, body, o = {}) => attr(phone({ title: o.title ?? 'Logbook', body, tab: o.tab ?? 'Flying', cap: o.cap ?? '', sheet: o.sheet ?? '', scrim: Boolean(o.sheet), left: o.left ?? '', right: o.right ?? '' }), { name, max, exempt: o.exempt });
const D = (name, max, body, o = {}) => attr(desk({ tab: o.tab ?? 'Flying', title: o.title ?? 'Logbook', body, cap: o.cap ?? '', right: o.right ?? '' }), { name, max, exempt: o.exempt });
const M = (inner, d = false) => `<div class="m ${d ? 'd' : ''}">${inner}</div>`;
const sheet = (title, inner) => glass('div', 'ds-sheet ds-chrome is-open', `<span class="grab"></span><div class="ds-sheet-head"><h2 class="ds-title" style="margin:0">${title}</h2>${iconBtn('x', 'Close')}</div><div class="ds-sheet-body"><div class="m sheetbody" style="padding-inline:0">${inner}</div></div>`, 'data-role="pop" data-force');
const back = `<button class="ds-iconbtn" aria-label="Back" title="Back">${I('back')}</button>`;

const shell = (title, inner) => `<!doctype html><html lang="en" data-ds-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${title}</title><style>${dsCss}\n${MOCK}\n${MIN}\n.mpg h2.s{font-size:1.5rem;margin:48px 0 8px}.mpg .tbl{width:100%;border-collapse:collapse;margin:16px 0;font-size:.9375rem}.mpg .tbl th,.mpg .tbl td{padding:12px;text-align:left;vertical-align:top;line-height:1.45}.mpg .tbl tbody tr:nth-child(odd){background:var(--ds-surface)}.mpg .tbl thead th{color:var(--ds-text)}.mpg .tbl td.n,.mpg .tbl th.n{text-align:right;font-variant-numeric:tabular-nums}</style></head><body class="ds-root"><div class="pg mpg">${inner}</div><script>document.querySelectorAll('.ds-scroll').forEach(function(s){var f=s.querySelector('.mk-focus');if(f){s.scrollTop=f.getBoundingClientRect().top-s.getBoundingClientRect().top+s.scrollTop-90}});if(!matchMedia('(prefers-reduced-motion: reduce)').matches){document.querySelectorAll('[data-count]').forEach(function(el){var t=parseFloat(el.dataset.count),t0=performance.now(),n=el.firstChild;(function f(now){var p=Math.min(1,(now-t0)/700),e=1-Math.pow(1-p,3);n.nodeValue=(t*e).toFixed(2);if(p<1)requestAnimationFrame(f)})(t0)})}</script></body></html>`;
const NAV = `<nav class="topnav" aria-label="Mockups">${[['minimal.html', 'Overview'], ['logbook-bmin.html', 'Logbook B-min'], ['minimal-app.html', 'Rest of the app']].map(([h, l]) => `<a class="gl clear gl-chip" href="${h}">${l}</a>`).join('')}</nav>`;
const sec = (t, note = '') => `<h2 class="s">${t}</h2>${note ? `<p class="note">${note}</p>` : ''}`;
const strip = (...f) => `<div class="row" style="overflow-x:auto">${f.join('')}</div>`;

// ================================================================ LOGBOOK B-min
const lbList = (opts) => M(`${tabsW()}${heroPilot()}${chipsRow()}${ctl('List')}${months(opts)}${opts?.skip ? '' : moreBtn(2)}`);
const sideCol = () => `<aside class="side">${heroPilot()}${chipsRow()}</aside>`;
const lbDesk = (open) => M(`${tabsW('Logbook', true)}<div class="panes"><div style="display:grid;gap:24px;align-content:start">${ctl('List')}${months({ sel: 19, limit: 2 })}${moreBtn(2)}</div>${open ? detail(FLIGHTS.find((f) => f.id === 19), true) : sideCol()}</div>`, true);
const bFigs = [
  P('Phone · list', BUDGETS.logbook, lbList(), { cap: 'First screen. Navigation (the Flying tabs) is reported but not charged to the budget, like the bars.' }),
  P('Phone · scrolled', null, M(`${months({ skip: 1, limit: 2 })}`), { cap: 'Scrolled: one surface per month, no dividers, a dot marks a month with ground sessions.' }),
  P('Phone · ledger', null, M(`${tabsW()}${ctl('Ledger')}${ledger(true)}`), { exempt: 'ledger', cap: 'Ledger: dense by design, calm spacing, aligned columns.' }),
  P('Phone · empty', BUDGETS.logbook, M(`${tabsW()}${empty('Nothing logged yet', 'Log a flight')}`), { cap: 'Empty: one line and one action.' }),
  P('Phone · loading', BUDGETS.logbook, M(`${tabsW()}${skeleton()}`), { cap: 'Loading: the shapes of the content, no spinner text.' }),
  P('Phone · month details', null, M(`${months({ limit: 1 })}`), { sheet: sheet('September', `<div class="li two"><span class="pri">Flights</span><span>${hrs(7.5)}${U()}</span></div><div class="li two"><span class="pri">Ground</span><span>${hrs(1.5)}${U()}</span></div>`), cap: 'Tap the month name: flight hours, then ground hours, kept apart.' }),
  P('Phone · aircraft details', null, M(`${lbList().replace(/^<div class="m ">|<\/div>$/g, '')}`), { sheet: sheet('N123AB', `<div class="li two"><span class="pri">Hours</span><span>${hrs(FLEET[0].hours)}${U()}</span></div><div class="li two"><span class="pri">Flights</span><span class="num n28">${FLEET[0].flights}</span></div><button class="gl pilot lg block">Show flights</button>`), cap: 'Tap an aircraft chip for its hours; tap again to filter.' }),
  D('Desktop · list', BUDGETS.logbook * 2, lbDesk(false), { cap: '1440: one frame, the tabs span it; list left, summary right.' }),
  D('Desktop · open flight', BUDGETS.logbook * 2, lbDesk(true), { cap: 'A flight open: the summary column makes room for it. Debrief and photos are one tap away.' }),
];
write('logbook-bmin.html', shell('Logbook B-min', `${NAV}<h1 class="t">Logbook · B-min</h1><p class="lead">Direction B with the text taken out: a hero that does the talking, one surface per month, rows of at most six words. Dark only, placeholder data.</p>${sec('Phone · 390 px')}${strip(...bFigs.slice(0, 7))}${sec('Desktop · 1440 px')}${strip(...bFigs.slice(7))}`));

// ================================================================ REST OF THE APP
const G = (inner, d) => `<div class="m ${d ? 'd g3' : ''}">${inner}</div>`;
const sw = (cls, html) => `<div class="${cls}">${html}</div>`; // desktop span wrapper (phone ignores the class)
const statN = (items, n) => `<div class="stats" style="--n:${n}">${items.map(([v, l, c = '']) => `<div class="stat"><span class="num n28 ${c}">${v}</span><span class="mut">${l}</span></div>`).join('')}</div>`;
const home = (d) => G(`<p class="pri s3" style="margin:0">Good evening</p>${sw('s2', heroPilot())}
  ${sw('stack', `<div class="chips" style="margin:0;padding:0">${[['Day', ''], ['Night', ''], ['Medical', 'warn']].map(([t, c]) => `<a class="pill press" href="#"><span class="sdot ${c}"></span>${t}</a>`).join('')}</div>
  <a class="card press" href="#" data-card style="grid-template-columns:1fr auto;align-items:center"><span class="lab">Passenger</span><span><span class="num n28 pax">${fmt(PAX)}</span>${U()}</span></a>`)}
  ${sw('list s2', rowFor(FLIGHTS[0], 0))}${statN([[FLIGHTS.length, 'Flights'], [14, 'Airports'], [3, 'Countries'], ['8.3k', 'Miles']], d ? 2 : 4)}`, d);
const flightDetail = (d) => { const f = FLIGHTS.find((x) => x.id === 19); return G(`${sw('s2 detail', `<div class="num n40">${fmt(f.total)}${U()}</div><div><div class="pri" style="font-size:1.75rem;font-weight:800;letter-spacing:-.03em">Local KSUS</div><div class="mut" style="margin-top:8px">${mdy(f.date)} · ${f.tail}</div></div>${statN([[fmt(f.pic), 'PIC'], [fmt(f.dual), 'Dual'], [f.ldg, 'Landings']], 3)}`)}
  <div class="list"><a class="li two press" href="#"><span class="pri">Instructor</span><span class="mut">${f.instr}</span></a><a class="li two press" href="#"><span class="pri">Debrief</span>${chev}</a><a class="li two press" href="#"><span class="pri">Photos</span>${chev}</a></div>`, d); };
const travel = (d) => G(`${sw('', `<section class="hero rise" data-card><span class="lab">Passenger</span><div><span class="num n56 pax">${fmt(PAX)}</span>${U()}</div></section>`)}
  ${sw('s2 stack', `<div class="ctl">${seg(['List', 'Ledger'], 'List', 'pax')}<span style="display:flex">${iconBtn('search', 'Search')}${iconBtn('sliders', 'Filter and sort')}</span></div>
  <section class="grp"><div class="gh"><span class="name">September</span><span>${hrs(14.2)}</span></div>
  ${[['12', 'SFO JFK', 'Delta', 5.4], ['04', 'JFK LHR', 'British Airways', 6.9], ['02', 'LHR SFO', 'British Airways', 11.2]].map(([day, route, air, h]) => `<a class="row press" data-row href="#" aria-label="${route}, ${air}, ${h} hours"><span class="day">${day}</span><span class="t"><span class="pri">${route}</span><span class="mut">${air}</span></span><span class="v" style="color:var(--ds-pax)">${h.toFixed(1)}</span></a>`).join('')}</section>`)}`, d);
const costs = (d) => G(`${sw('s3', tabsW('Costs', d))}<section class="hero rise" data-card><span class="lab">Spent</span><div><span class="num n56">${money(10736)}</span></div></section>
  ${statN([['$342', 'per pilot hour'], [money(4138), 'to finish']], 2)}
  <div class="list">${['Spending', 'Training phases', 'Expenses', 'Projection'].map((t) => `<a class="li two press" href="#"><span class="pri">${t}</span>${chev}</a>`).join('')}</div>`, d);
const expenses = (d) => G(`${sw('s3', tabsW('Costs', d))}<div class="list s2">${[['Gear', 'Headset', 240], ['Exam', 'Written test', 175], ['Fee', 'Medical', 160], ['Gear', 'Charts', 45]].map(([tag, item, v]) => `<div class="li press" data-row style="grid-template-columns:auto minmax(0,1fr) auto"><span class="tag">${tag}</span><span class="pri">${item}</span><span class="num n28">${money(v)}</span></div>`).join('')}</div><p class="mut" style="margin:0">Swipe a row to delete; a confirmation follows.</p>`, d);
const spending = (d) => G(`${sw('s3', tabsW('Costs', d))}<section class="card s3"><span class="lab">Spent per month, pilot hours</span><div class="bars" role="img" aria-label="Spending by month">${[['Jun', 40], ['Jul', 62], ['Aug', 100], ['Sep', 78]].map(([m, p]) => `<div><b>${money(p * 40)}</b><i style="height:${p}%"></i><span>${m}</span></div>`).join('')}</div></section>`, d);
const currency = (d) => G(`${sw('s3', tabsW('Currency', d))}<div class="list s3 c2">${[['Day', '41 d', ''], ['Night', '12 d', 'warn'], ['Instrument', '90 d', ''], ['Flight review', '212 d', ''], ['Medical', '9 d', 'bad']].map(([n, v, c]) => `<a class="li press" href="#" data-row><span class="sdot ${c}"></span><span class="pri">${n}</span><span class="num n28 ${c}">${v.split(' ')[0]}<span class="u">${v.split(' ')[1]}</span></span></a>`).join('')}</div>`, d);
const milestones = (d) => G(`${sw('s3', tabsW('Milestones', d))}<section class="hero rise" data-card><span class="lab">Private Pilot</span><div><span class="num n56 pilot">${MET}</span><span class="num n28" style="color:var(--ds-text-2)">/${REQS.length}</span></div></section>
  <div class="list s2">${REQS.map((r) => `<a class="li two press" href="#" data-row><span style="display:grid;gap:8px"><span class="pri">${r.short ?? r.label}</span><span class="bar ${r.cur >= r.min ? 'ok' : ''}"><i style="width:${Math.min(100, (r.cur / r.min) * 100)}%"></i></span></span><span class="mut">${r.cur >= r.min ? '✓' : `${r.cur}/${r.min}`}</span></a>`).join('')}</div>`, d);
const weather = (d) => G(`${sw('s3', tabsW('Weather', d))}<section class="card" data-card><span class="lab">KSUS</span><span class="num n56 ok">Go</span></section>
  ${sw('stack s2', `${statN([[8, 'Wind kt'], [10, 'Vis sm'], ['Clr', 'Ceiling']], 3)}<button class="gl pilot lg" style="justify-self:start">Check an airport</button>`)}`, d);
const stats = (d) => G(`${sw('s3', seg(['Month', 'Aircraft', 'Type'], 'Month'))}<section class="card s3"><span class="lab">Pilot hours</span><div class="bars" role="img" aria-label="Pilot hours by month">${[['Jun', 3.2], ['Jul', 8.4], ['Aug', 22.8], ['Sep', 7.5]].map(([m, v]) => `<div><b>${v}</b><i style="height:${(v / 22.8) * 100}%"></i><span>${m}</span></div>`).join('')}</div></section>`, d);
const mapScr = (d) => G(`<div class="s2" style="height:${d ? 640 : 520}px;border-radius:24px;background:var(--ds-map-sea);position:relative;overflow:hidden"><svg viewBox="0 0 100 60" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"><path d="M0 40C20 30 30 44 50 34S80 24 100 30V60H0Z" fill="var(--ds-map-land)"/><path d="M20 38C40 14 66 20 82 32" stroke="var(--ds-pilot)" stroke-width=".5" fill="none"/></svg></div>
  ${sw('stack', `${seg(['All', 'Pilot', 'Passenger'], 'All')}<span class="pill" style="justify-self:start" aria-label="14 airports visited, expand statistics">14 airports</span>`)}`, d);
const aircraft = (d) => G(`<div class="list s3 c3">${FLEET.map((a) => `<a class="li press" href="#" data-row><span class="tile">${plane}</span><span class="pri">${a.tail}</span><span class="num n28">${fmt(a.hours)}</span></a>`).join('')}</div>`, d);
const moreScr = (d) => G(`<div class="list s3 c2">${[['gear', 'Settings'], ['swap', 'Import and export'], ['share', 'Share'], ['table', 'Print'], ['dollar', 'Cost settings'], ['target', 'Weather minimums']].map(([i, t]) => `<a class="li two press" href="#" data-row><span class="pri" style="display:flex;align-items:center;gap:16px">${i === 'gear' ? ico('gear', 'glyph') : gl(i)}${t}</span>${chev}</a>`).join('')}</div>`, d);
const logForm = (pax, d) => { const form = `<div class="ctl">${seg(['Pilot', 'Passenger'], pax ? 'Passenger' : 'Pilot', pax ? 'pax' : 'pilot')}</div>
  <div class="stats" style="--n:2"><span role="button" tabindex="0" class="pill" style="justify-content:space-between">Today</span><span role="button" tabindex="0" class="pill" style="justify-content:space-between">${pax ? 'Delta' : 'N123AB'}</span></div>
  <div class="stats" style="--n:2"><span role="button" tabindex="0" class="pill" style="justify-content:space-between">KSUS</span><span role="button" tabindex="0" class="pill" style="justify-content:space-between">KSUS</span></div>
  <div class="ctl" style="justify-content:center;gap:24px">${iconBtn('minus', 'Less time')}<span><span class="num n56 ${pax ? 'pax' : 'pilot'}">1.0</span>${U()}</span>${iconBtn('plus', 'More time')}</div>
  ${pax ? '' : '<span role="button" tabindex="0" class="pill" style="justify-content:space-between">J. Rivera</span>'}
  <button class="gl clear" type="button" style="justify-self:start">More details</button><button class="gl ${pax ? 'pax' : 'pilot'} lg block">Save</button>`;
  const summary = `<div class="card" data-card><span class="lab">${pax ? 'Passenger' : 'Private Pilot'}</span><div><span class="num n40 ${pax ? 'pax' : 'pilot'}">${fmt(pax ? PAX + 1 : PILOT_TOTAL + 1)}</span>${U()}</div><span class="mut">after saving</span></div>`;
  return d ? G(`${sw('s2 stack', form)}${sw('', summary)}`, true) : M(form, false); };

const SCREENS = [
  ['Home', BUDGETS[''], home, { title: 'Home', tab: 'Home' }],
  ['Flight detail', 45, flightDetail, { title: '', tab: 'Flying' }],
  ['Travel', BUDGETS.travel, travel, { title: 'Travel', tab: 'Travel' }],
  ['Costs', BUDGETS.costs, costs, { title: 'Costs' }],
  ['Costs · Expenses', BUDGETS.costs, expenses, { title: 'Costs' }],
  ['Costs · Spending', BUDGETS.costs, spending, { title: 'Costs' }],
  ['Currency', BUDGETS.currency, currency, { title: 'Currency' }],
  ['Milestones', BUDGETS.milestones, milestones, { title: 'Milestones' }],
  ['Weather', BUDGETS.weather, weather, { title: 'Weather' }],
  ['Stats', BUDGETS.stats, stats, { title: 'Stats', tab: 'More' }],
  ['Map', BUDGETS.map, mapScr, { title: 'Map', tab: 'Map' }],
  ['Aircraft', BUDGETS.aircraft, aircraft, { title: 'Aircraft', tab: 'More' }],
  ['More', BUDGETS.more, moreScr, { title: 'More', tab: 'More' }],
];
const appHtml = [];
for (const [name, max, fn, o] of SCREENS) appHtml.push(`<h3 class="u">${name}</h3>${strip(P(`${name} · phone`, max, fn(false), o), D(`${name} · desktop`, max * 2, fn(true), o))}`);
// log-a-flight: a sheet over the Logbook (phone) and a centred sheet over a dimmed Logbook (desktop)
for (const pax of [false, true]) {
  const nm = pax ? 'Log a flight · passenger' : 'Log a flight · pilot';
  const body = logForm(pax, false);
  appHtml.push(`<h3 class="u">${nm}</h3>${strip(
    P(`${nm} · phone`, 55, M(`${tabsW()}${heroPilot()}`), { sheet: sheet(pax ? 'Passenger flight' : 'Log a flight', body.replace(/^<div class="m ">|<\/div>$/g, '')) }),
    D(`${nm} · desktop`, 110, logForm(pax, true), { title: pax ? 'Passenger flight' : 'Log a flight', cap: 'Desktop: the same form in the frame; a live summary (route, hours, what it adds to the totals) sits beside it.' }),
  )}`);
}
write('minimal-app.html', shell('Minimal · the rest of the app', `${NAV}<h1 class="t">Minimal · the rest of the app</h1><p class="lead">The same rules on every screen, phone and 1440 px, dark only, placeholder data. Every capability and number is kept; detail moves one tap away.</p>${appHtml.join('')}`));
write('minimal.html', shell('Minimal · overview', `${NAV}<h1 class="t">Minimal</h1><p class="lead">Direction B, minimalist and modern, as the theme for the whole app. <a href="logbook-bmin.html">Logbook B-min</a> · <a href="minimal-app.html">the rest of the app</a>. The rules are in <code>docs/design/DESIGN_LANGUAGE.md</code>; the word counts are in <code>docs/design/minimal/COUNTS.md</code>.</p>`));
console.log('built minimal mockups:', bFigs.length, 'logbook figures,', SCREENS.length * 2 + 4, 'app figures');
