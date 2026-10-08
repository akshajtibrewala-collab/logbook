// Builds the static Logbook layout mockups (no app code): option-a.html, option-b.html and index.html in this folder.
//   node docs/design/logbook-layouts/build.mjs
// The mockups inline the real design-system CSS (tokens, glass, components, the V-a controls) from client/src/ds/, so the glass bars,
// buttons, chips, selects and sheet are the real ones. ALL DATA BELOW IS PLACEHOLDER — nothing here comes from the logbook database.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ds = path.join(here, '..', '..', '..', 'client', 'src', 'ds');
const css = ['tokens.css', 'glass.css', 'ds.css', 'buttons.css'].map((f) => fs.readFileSync(path.join(ds, f), 'utf8')).join('\n');

// ---------- icons (lucide paths) ----------
const P = {
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  luggage: '<path d="M6 20a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2"/><path d="M8 18V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14"/><path d="M10 20h4"/><circle cx="16" cy="20" r="2"/><circle cx="8" cy="20" r="2"/>',
  map: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>', chevR: '<path d="m9 18 6-6-6-6"/>', chevD: '<path d="m6 9 6 6 6-6"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  cap: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
  dollar: '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  swap: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  cal: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
};
const I = (n, cls = 'ds-i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;

// ---------- chrome ----------
const glass = (tag, cls, inner, attrs = '') => `<${tag} class="ds-glass ${cls}" ${attrs}><span class="g-core"></span><span class="g-lens"></span><span class="g-scrim"></span><div class="g-in">${inner}</div></${tag}>`;
const TABS = [['home', 'Home'], ['plane', 'Flying'], ['luggage', 'Travel'], ['map', 'Map'], ['more', 'More']];
const tabbar = (active, desk = false) => {
  const i = TABS.findIndex(([, l]) => l === active);
  const ind = desk ? `height:64px;transform:translateY(${6 + 4 + 72 * i}px)` : `width:62px;transform:translateX(${6 + 70 * i + 4}px)`;
  return glass('nav', 'ds-tabbar ds-chrome', `<div class="ds-tabs"><span class="ds-ind ds-lite" style="${ind}"></span>${TABS.map(([ic, l]) => `<a class="tab ${l === 'Travel' ? 'pax' : ''}" ${l === active ? 'aria-current="page"' : ''}>${I(ic, '')}<span>${l}</span></a>`).join('')}</div>`);
};
const topbar = ({ left = '', title = '', right = '', wide = false }) => glass('header', `ds-topbar ds-chrome ${wide ? 'mk-wide' : ''}`, `<div class="side">${left}</div><span class="ttl" style="--p:1">${title}</span><div class="side" style="justify-content:flex-end">${right ? `<span class="grp ds-lite" style="display:flex">${right}</span>` : ''}</div>`);
const ib = (n, label) => `<button class="ds-iconbtn" aria-label="${label}">${I(n)}</button>`;
const fab = (open = false) => `<button class="ds-fab gl gfab clear" aria-label="Add" aria-expanded="${open}">${I('plus', '')}</button>`;
const menu = (items, cls = '') => glass('div', `ds-menu ds-chrome is-open ${cls}`, `<div role="menu">${items.map(([ic, l, dot]) => `<button class="mi">${dot ? `<span class="dot" style="background:var(--ds-${dot})"></span>` : I(ic)}${l}</button>`).join('')}</div>`, 'data-role="pop"');
const ADD_ITEMS = [[null, 'Add flight · Pilot', 'pilot'], [null, 'Add flight · Passenger', 'pax'], ['zap', 'Quick log'], ['copy', 'Copy last flight'], ['cap', 'Log ground session']];
const MORE_ITEMS = [['share', 'Share and print'], ['dollar', 'Costs'], ['plane', 'Aircraft'], ['swap', 'Import and export']];

// ---------- sample data (PLACEHOLDER) ----------
const FL = [
  { m: 'October 2026', mh: '3.60', n: 3, rows: [
    { d: '03', mo: 'OCT', route: 'KSUS → KCPS', sub: 'C172S · N123AB · J. Rivera', h: '1.40', c: '$448.00' },
    { d: '03', mo: 'OCT', local: 'KSUS', sub: 'C172S · N123AB · J. Rivera', h: '1.10', c: '$352.00', note: 'pattern work' },
    { g: true, d: '01', mo: 'OCT', title: 'Ground session', sub: 'Instrument theory · M. Chen', h: '1.10', c: '$88.00' },
  ] },
  { m: 'September 2026', mh: '4.20', n: 4, rows: [
    { d: '28', mo: 'SEP', route: 'KSUS → KALN', via: 'KCPS', sub: 'C172S · N123AB · J. Rivera', h: '1.80', c: '$576.00' },
    { d: '21', mo: 'SEP', local: 'KSUS', sub: 'PA28 · N456CD · solo', h: '0.90', c: '$207.00' },
    { d: '14', mo: 'SEP', route: 'KCPS → KSUS', sub: 'C172S · N123AB · J. Rivera', h: '0.70', c: '$224.00' },
    { d: '12', mo: 'SEP', local: 'KSUS', sub: 'C172S · N123AB · J. Rivera', h: '0.80', c: '$256.00' },
  ] },
  { m: 'August 2026', mh: '2.90', n: 3, rows: [
    { d: '30', mo: 'AUG', route: 'KSUS → KJEF', sub: 'C172S · N123AB · M. Chen', h: '1.20', c: '$384.00' },
    { d: '22', mo: 'AUG', local: 'KSUS', sub: 'C172S · N123AB · M. Chen', h: '1.00', c: '$320.00' },
    { d: '09', mo: 'AUG', local: 'KSUS', sub: 'C172S · N123AB · M. Chen', h: '0.70', c: '$224.00' },
  ] },
];
const TRAVEL = [
  { m: '2026', mh: '41.20', n: 12, rows: [
    { d: '24', mo: 'SEP', route: 'LHR → DXB', air: 'EK', sub: 'Emirates 8 · Airbus A380-800 (A388)', t: '14:05 → 00:20 +1', cls: 'Economy', h: '6.80' },
    { d: '18', mo: 'SEP', route: 'JFK → LHR', air: 'VS', sub: 'Virgin Atlantic 4 · Airbus A350-1000', t: '19:30 → 07:25 +1', cls: 'Premium', h: '6.60' },
    { d: '02', mo: 'SEP', route: 'STL → ORD', air: 'UA', sub: 'United 4321 · Embraer E175', t: '09:10 → 10:30', cls: 'Economy', h: '1.10' },
  ] },
  { m: '2025', mh: '58.70', n: 14, rows: [
    { d: '19', mo: 'DEC', route: 'DXB → DEL', air: 'EK', sub: 'Emirates 512 · Boeing 777-300ER', t: '08:15 → 12:50', cls: 'Economy', h: '3.30' },
    { d: '11', mo: 'DEC', route: 'ORD → DXB', air: 'EK', sub: 'Emirates 236 · Airbus A380-800', t: '22:00 → 20:10 +1', cls: 'Economy', h: '13.20' },
  ] },
];

// ---------- row / block builders ----------
const hoursCls = (pax) => (pax ? 'pax' : 'pilot');
const rowA = (r, pax = false) => r.g
  ? `<a class="mk-row"><span class="mk-date icon">${I('cap')}</span><span class="mk-main"><strong>${r.title}</strong><span>${r.sub}</span></span><span class="mk-end"><b class="pilot">${r.h}</b><i>${r.c}</i></span></a>`
  : `<a class="mk-row"><span class="mk-date"><b>${r.d}</b><i>${r.mo}</i></span><span class="mk-main"><strong>${r.local ? `Local · ${r.local}` : r.route}${r.via ? `<em>via ${r.via}</em>` : ''}${r.air ? `<em class="air">${r.air}</em>` : ''}</strong><span>${r.sub}</span>${r.t ? `<span class="t">${r.t} · ${r.cls}</span>` : ''}</span><span class="mk-end"><b class="${hoursCls(pax)}">${r.h}</b>${r.c ? `<i>${r.c}</i>` : ''}</span></a>`;
const monthHdr = (m, h, n, pax) => `<div class="mk-month"><span>${m}</span><span><b class="${hoursCls(pax)}">${h} h</b> · ${n} ${pax ? 'flights' : 'entries'}</span></div>`;
const groups = (data, pax = false) => data.map((g) => monthHdr(g.m, g.mh, g.n, pax) + g.rows.map((r) => rowA(r, pax)).join('')).join('');
const search = (ph = 'Search route, airport, tail') => `<label class="mk-search gl-field">${I('search')}<span>${ph}</span></label>`;
const flyTabs = (sel = 'Logbook') => `<div class="gl-seg scroll" role="tablist" aria-label="Flying">${['Logbook', 'Currency', 'Milestones', 'Costs', 'Weather'].map((t) => `<button class="gl pilot" role="tab" aria-selected="${t === sel}">${t}</button>`).join('')}</div>`;
const chip = (t, pax) => `<button class="gl clear gl-chip ${pax ? 'pax' : ''}" aria-pressed="true">${t}${I('x')}</button>`;
const totals = (pax) => pax
  ? `<section class="mk-totals"><div><div class="ds-cap">As passenger</div><div class="mk-big pax">60.95<span class="ds-unit">h</span></div></div><div class="mk-s"><i>Flights</i><b>14</b></div><div class="mk-s"><i>Airports</i><b>7</b></div><div class="mk-s"><i>Countries</i><b>2</b></div></section>`
  : `<section class="mk-totals"><div><div class="ds-cap">As pilot · total</div><div class="mk-big pilot">31.40<span class="ds-unit">h</span></div></div><div class="mk-s"><i>Last 12 mo</i><b>31.40</b></div><div class="mk-s"><i>PIC</i><b>4.10</b></div><div class="mk-s"><i>Landings</i><b>41</b></div></section>`;

const phone = ({ title = '', left = '', right = '', body = '', tab = 'Flying', fabOpen = false, menuHtml = '', sheet = '', scrim = false, noFab = false, cap = '' }) => `
<figure class="mk-fig"><div class="ds-frame mk-phone"><div class="ds-edge top"></div>${topbar({ left, title, right })}<div class="ds-scroll">${body}</div><div class="ds-edge bot"></div>${scrim ? '<div class="ds-scrim-dim is-on"></div>' : ''}${noFab ? '' : fab(fabOpen)}${menuHtml}${tabbar(tab)}${sheet}</div><figcaption>${cap}</figcaption></figure>`;

const desk = ({ tab = 'Flying', title = '', right = '', body = '', menuHtml = '', cap = '' }) => `
<figure class="mk-fig mk-figd"><div class="mk-desk">${glass('nav', 'ds-tabbar ds-chrome mk-rail', `<div class="ds-tabs"><span class="ds-ind ds-lite" style="height:64px;transform:translateY(${6 + 4 + 72 * TABS.findIndex(([, l]) => l === tab)}px)"></span>${TABS.map(([ic, l]) => `<a class="tab ${l === 'Travel' ? 'pax' : ''}" ${l === tab ? 'aria-current="page"' : ''}>${I(ic, '')}<span>${l}</span></a>`).join('')}</div>`)}${topbar({ title, right: right, wide: true })}<button class="ds-fab gl gfab clear mk-dfab" aria-label="Add">${I('plus', '')}</button>${menuHtml}<div class="mk-dbody">${body}</div></div><figcaption>${cap}</figcaption></figure>`;

// ---------- detail ----------
const stat = (l, v, u = '') => `<div class="mk-st"><i>${l}</i><b>${v}${u ? `<span class="ds-unit">${u}</span>` : ''}</b></div>`;
const detailBody = (compact = false) => `
<div class="mk-dh"><div class="ds-cap">09/28/2026 · Cross-country</div><h1 class="mk-route">KSUS → KALN</h1><div class="mk-via">via KCPS · C172S · N123AB · J. Rivera</div></div>
<div class="mk-hero"><div class="mk-big pilot">1.80<span class="ds-unit">h</span></div><div class="mk-cost"><i>Cost</i><b>$576.00</b></div></div>
<section class="ds-section"><span class="ds-cap">Time</span><div class="mk-grid">${stat('Total', '1.80')}${stat('PIC', '0.00')}${stat('Dual received', '1.80')}${stat('Cross-country', '1.80')}${stat('Night', '0.00')}${stat('Instrument', '0.20')}</div></section>
<section class="ds-section"><span class="ds-cap">Landings and approaches</span><div class="mk-grid">${stat('Day landings', '2')}${stat('Night landings', '0')}${stat('Approaches', '1')}</div></section>
<section class="ds-section"><span class="ds-cap">Note</span><p class="ds-sub" style="margin:0;color:var(--ds-text)">Crosswind landings at KALN, good radio work. Placeholder text.</p></section>
${compact ? '' : `<section class="ds-section"><span class="ds-cap">Photos (2)</span><div class="mk-photos"><span></span><span></span></div></section>`}
<div class="mk-actions"><button class="gl clear sm">${I('pencil')}Edit</button><button class="gl clear sm">${I('copy')}Copy as new</button><button class="gl clear sm">${I('trash')}Delete</button></div>`;

// ---------- filter sheet ----------
const sel = (l, v) => `<label class="ds-field"><span class="l">${l}</span><span class="gl-select flexbox" role="button">${v}</span></label>`;
const filterSheetA = glass('div', 'ds-sheet ds-chrome is-open', `<span class="grab"></span><div class="ds-sheet-head"><h2 class="ds-title" style="margin:0">Filter and sort</h2><button class="gl plain sm">Clear all</button></div><div class="ds-sheet-body" style="overflow:hidden"><div class="mk-fs"><div class="ds-field"><span class="l">Show</span><div class="gl-seg" role="tablist"><button class="gl pilot" role="tab" aria-selected="false">All</button><button class="gl pilot" role="tab" aria-selected="true">Flights</button><button class="gl pilot" role="tab" aria-selected="false">Ground</button></div></div>${sel('Sort', 'Newest first')}<div class="mk-two">${sel('From', '01/01/2026')}${sel('To', 'Any date')}</div>${sel('Aircraft type', 'C172S')}${sel('Category', 'All categories')}<button class="gl pilot lg block">Show 18 entries</button></div></div>`, 'data-role="pop" data-force style="height:640px"');

// ---------- empty / loading ----------
const skeleton = (n = 4) => Array.from({ length: n }, () => '<div class="mk-row mk-skel"><span class="mk-date"></span><span class="mk-main"><strong></strong><span></span></span><span class="mk-end"><b></b></span></div>').join('');
const emptyBody = (pax = false) => `<div class="mk-empty"><div class="ic">${I(pax ? 'luggage' : 'plane')}</div><h3>${pax ? 'No passenger flights yet' : 'Nothing logged yet'}</h3><p class="ds-sub">${pax ? 'Log a trip and your map, airlines and airports fill in.' : 'Log your first flight or ground session to start your logbook.'}</p><button class="gl ${pax ? 'pax' : 'pilot'}">Add a flight</button></div>`;
const noMatch = `<div class="mk-empty"><div class="ic">${I('search')}</div><h3>Nothing matches these filters</h3><p class="ds-sub">Try a wider date range or clear the aircraft filter.</p><button class="gl clear">Clear filters</button></div>`;

// ---------- shared mock CSS ----------
const mockCss = `
*,*::before,*::after{box-sizing:border-box}
html{background:#000;color-scheme:dark} body{margin:0;background:#000;color:var(--ds-text);font-family:var(--ds-font)}
.pg{max-width:1500px;margin:0 auto;padding:2rem 1.25rem 6rem} .pg h1.t{font-size:2rem;margin:.25rem 0} .pg h2.s{margin:3rem 0 .25rem;font-size:1.5rem} .pg p.lead{max-width:52rem;color:var(--ds-text-2)}
.row{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start} .mk-fig{margin:0;flex:none} .mk-fig figcaption{max-width:390px;margin-top:.5rem;font-size:.8125rem;color:var(--ds-text-2)} .mk-figd figcaption{max-width:1440px}
.mk-phone{height:844px;width:390px;flex:none} .mk-phone .ds-scroll{padding-top:78px;padding-bottom:9rem}
.mk-phone .ds-topbar{left:12px;right:12px} .mk-phone .ds-fab{width:3.5rem;height:3.5rem;right:18px}
.mk-phone .ds-menu{width:15.5rem}
.mk-desk{position:relative;width:1440px;height:900px;overflow:hidden;background:#000;border:1px solid var(--ds-hair-strong);border-radius:12px;transform:translateZ(0)}
.mk-desk .ds-topbar{position:absolute;top:8px;left:200px;right:168px} .mk-desk .ds-topbar .side:last-child{padding-right:3.5rem}
.mk-rail{position:absolute!important;left:16px;top:50%;transform:translateY(-50%);width:5.5rem;--ds-g-r:30px} .mk-rail .ds-tabs{flex-direction:column;min-height:0} .mk-rail .ds-tabs .tab{flex:none;min-height:4.5rem} .mk-rail .ds-ind{left:4px;right:4px;top:0;width:auto}
.mk-dfab{position:absolute!important;top:11px;right:172px;width:3rem!important;height:3rem!important} .mk-desk .ds-menu{position:absolute;top:70px;right:168px;bottom:auto;transform-origin:100% 0}
.mk-dbody{position:absolute;left:200px;right:168px;top:76px;bottom:0;overflow:hidden;display:flex;gap:28px}
.mk-pane{width:420px;flex:none} .mk-main-pane{flex:1;min-width:0;border-left:1px solid var(--ds-hair);padding-left:28px}
.mk-wide{} .mk-row{display:grid;grid-template-columns:3.1rem 1fr auto;gap:12px;align-items:center;min-height:4.25rem;padding:.5rem 0;border-top:1px solid var(--ds-hair);color:inherit;text-decoration:none}
.mk-date{display:grid;justify-items:center;line-height:1} .mk-date b{font-size:1.375rem;font-weight:800;letter-spacing:-.02em} .mk-date i{font-style:normal;font-size:.6875rem;font-weight:700;letter-spacing:.08em;color:var(--ds-text-2);margin-top:3px} .mk-date.icon{width:2.5rem;height:2.5rem;border-radius:50%;background:var(--ds-surface-2);place-items:center;color:var(--ds-text-2);justify-self:center}
.mk-main{display:grid;gap:2px;min-width:0} .mk-main strong{font-size:1.0625rem;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} .mk-main em{font-style:normal;font-weight:500;font-size:.8125rem;color:var(--ds-text-2);margin-left:.5rem} .mk-main em.air{border:1px solid var(--ds-hair-strong);border-radius:6px;padding:0 .35rem;font-weight:700;font-size:.6875rem}
.mk-main span{font-size:.875rem;color:var(--ds-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis} .mk-main span.t{font-size:.8125rem}
.mk-end{display:grid;justify-items:end;gap:2px} .mk-end b{font-size:1.5rem;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1} .mk-end b.pilot{color:var(--ds-pilot)} .mk-end b.pax{color:var(--ds-pax)} .mk-end i{font-style:normal;font-size:.75rem;color:var(--ds-text-3)}
.mk-month{position:sticky;top:0;display:flex;justify-content:space-between;align-items:baseline;padding:.9rem 0 .4rem;font-size:.75rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ds-text-2);background:var(--ds-bg)} .mk-month b.pilot{color:var(--ds-pilot)} .mk-month b.pax{color:var(--ds-pax)} .mk-month span:last-child{letter-spacing:0;text-transform:none;font-weight:600}
.mk-totals{display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;gap:.5rem;align-items:end;padding:.75rem 0 .5rem;border-top:1px solid var(--ds-rule)} .mk-big{font-size:2.5rem;font-weight:800;letter-spacing:-.04em;line-height:1;font-variant-numeric:tabular-nums} .mk-big.pilot{color:var(--ds-pilot)} .mk-big.pax{color:var(--ds-pax)} .mk-s{display:grid;gap:2px} .mk-s i{font-style:normal;font-size:.6875rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ds-text-2)} .mk-s b{font-size:1.125rem;font-weight:750;font-variant-numeric:tabular-nums}
.mk-bar{display:flex;gap:.5rem;align-items:center;margin:.5rem 0} .mk-search{flex:1;min-width:0;display:flex;align-items:center;gap:.5rem;min-height:3rem;padding:0 .875rem;border-radius:999px;color:var(--ds-text-3);font-size:1rem} .mk-search svg{width:1.125rem;height:1.125rem;fill:none;stroke:currentColor;stroke-width:2}
.mk-chips{display:flex;gap:.5rem;overflow:hidden;margin:.25rem 0 .25rem} .mk-chips .gl-chip svg{width:.875rem;height:.875rem}
.gl-seg.scroll{margin:.25rem 0 .5rem} .mk-count{font-size:.8125rem;color:var(--ds-text-2);margin:.25rem 0}
.mk-empty{text-align:center;padding:3rem 1rem} .mk-empty .ic{width:3rem;height:3rem;margin:0 auto .75rem;display:grid;place-items:center;border-radius:50%;background:var(--ds-surface-2);color:var(--ds-text-2)} .mk-empty h3{margin:0 0 .25rem;font-size:1.375rem}
.mk-skel *{background:var(--ds-surface-2)!important;border-radius:6px;color:transparent!important} .mk-skel .mk-date{height:2rem;width:2.4rem} .mk-skel strong{height:1rem;width:70%} .mk-skel .mk-main span{height:.8rem;width:50%} .mk-skel .mk-end b{height:1.4rem;width:2.8rem}
.mk-dh h1.mk-route{font-size:2.25rem;margin:.1rem 0;letter-spacing:-.03em} .mk-via{color:var(--ds-text-2);font-size:.9375rem} .mk-hero{display:flex;justify-content:space-between;align-items:flex-end;margin:1rem 0 .25rem} .mk-cost i{display:block;font-style:normal;font-size:.6875rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ds-text-2)} .mk-cost b{font-size:1.5rem;font-weight:750}
.mk-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem 1rem} .mk-st i{display:block;font-style:normal;font-size:.6875rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--ds-text-2)} .mk-st b{font-size:1.375rem;font-weight:800;font-variant-numeric:tabular-nums}
.mk-photos{display:flex;gap:.5rem} .mk-photos span{width:5.5rem;height:5.5rem;border-radius:10px;background:linear-gradient(135deg,var(--ds-surface-3),var(--ds-surface-2));border:1px solid var(--ds-hair)} .mk-actions{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:1rem}
.mk-fs{display:grid;gap:.9rem} .mk-two{display:grid;grid-template-columns:1fr 1fr;gap:.75rem} .grab{display:block;width:2.5rem;height:5px;border-radius:3px;background:var(--ds-hair-strong);margin:2px auto 10px}
.mk-phone .ds-sheet{transform:none!important;height:auto!important;max-height:88%;visibility:visible}
.mk-row.sel{background:var(--ds-surface);box-shadow:inset 3px 0 0 var(--ds-pilot);padding-left:.5rem;margin-left:-.5rem;border-radius:0 8px 8px 0} .mk-phone .ds-sheet-body{padding-bottom:2rem}
.mk-cmp{width:100%;border-collapse:collapse;margin-top:1rem} .mk-cmp th,.mk-cmp td{border-top:1px solid var(--ds-hair);padding:.6rem .75rem;text-align:left;vertical-align:top;font-size:.9375rem} .mk-cmp th{color:var(--ds-text-2);font-weight:600;width:14rem}
.mk-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin:.5rem 0 .25rem;text-align:center} .mk-cal i{font-style:normal;font-size:.625rem;font-weight:700;letter-spacing:.06em;color:var(--ds-text-3)} .mk-cal span{height:2rem;display:grid;place-items:center;border-radius:50%;font-size:.8125rem;color:var(--ds-text-2);position:relative} .mk-cal span.f{color:var(--ds-text);font-weight:700;background:var(--ds-pilot-soft);box-shadow:inset 0 0 0 1px var(--ds-pilot)} .mk-cal span.f.p{background:var(--ds-pax-soft);box-shadow:inset 0 0 0 1px var(--ds-pax)} .mk-cal span.g{box-shadow:inset 0 0 0 1px var(--ds-hair-strong)}
.mk-pager{display:flex;align-items:center;justify-content:space-between;margin:.25rem 0} .mk-pager h2{margin:0;font-size:1.625rem;letter-spacing:-.02em} .mk-pager .gl{flex:none}
.mk-boarding{border:1px solid var(--ds-hair-strong);border-radius:18px;padding:1rem;background:linear-gradient(160deg,var(--ds-surface-3),var(--ds-surface));margin:.5rem 0} .mk-arc{display:flex;align-items:center;gap:.75rem;margin:.5rem 0} .mk-arc b{font-size:2rem;font-weight:800;letter-spacing:-.03em} .mk-arc svg{flex:1;height:34px;stroke:var(--ds-pilot);fill:none;stroke-width:1.6}
.mk-tabs{margin:.75rem 0}
`;

// ---------- page shell ----------
const page = (title, lead, sections) => `<!doctype html><html lang="en" data-glass="full"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${title}</title><style>${css}\n${mockCss}</style></head><body data-ds-theme="dark"><div class="pg"><p class="ds-cap"><a href="index.html" style="color:inherit">Logbook layout proposals</a> · static mockups · sample data only</p><h1 class="t">${title}</h1><p class="lead">${lead}</p>${sections}</div></body></html>`;
const section = (h, p, figs) => `<h2 class="s">${h}</h2><p class="lead" style="margin:.25rem 0 1rem">${p}</p><div class="row">${figs}</div>`;

// ================= OPTION A =================
const aPhoneList = phone({
  title: 'Flying', right: ib('more', 'More'),
  body: `${flyTabs()}${totals(false)}<div class="mk-bar">${search()}<button class="gl clear gl-chip" aria-pressed="false">${I('sliders')}Filter</button></div><div class="mk-chips">${chip('2026')}${chip('C172S')}</div><div class="mk-count">${'26 entries · 24.90 h'}</div>${groups(FL)}`,
  cap: 'A · Logbook list (shown with two active filters). Flying tabs, one totals strip, one search + Filter bar, active-filter chips, then months with their hours. With no filters the chips row disappears and the first entry sits about 75px higher (first entry at about 320px; the current screen has it at about 470px).',
});
const aPhoneMenus = phone({ title: 'Flying', right: ib('more', 'More'), body: `${flyTabs()}${totals(false)}<div class="mk-bar">${search()}<button class="gl clear gl-chip" aria-pressed="false">${I('sliders')}Filter</button></div>${groups(FL.slice(0, 1))}`, fabOpen: true, menuHtml: menu(ADD_ITEMS), cap: 'A · The Add menu: Add flight (Pilot or Passenger), Quick log, Copy last, Log ground session. Adding lives only here, so the list has no inline Add rows.' });
const aPhoneMore = phone({ title: 'Flying', right: ib('more', 'More'), body: `${flyTabs()}${totals(false)}<div class="mk-bar">${search()}<button class="gl clear gl-chip" aria-pressed="false">${I('sliders')}Filter</button></div>${groups(FL.slice(0, 1))}`, menuHtml: menu(MORE_ITEMS, 'mk-more'), cap: 'A · The “…” menu in the top bar keeps every old header destination: Share and print, Costs, Aircraft, Import and export.' });
const aPhoneSheet = phone({ title: 'Flying', right: ib('more', 'More'), body: `${flyTabs()}${totals(false)}<div class="mk-bar">${search()}<button class="gl clear gl-chip" aria-pressed="true">${I('sliders')}Filter · 2</button></div>${groups(FL.slice(0, 2))}`, scrim: true, noFab: true, sheet: filterSheetA, cap: 'A · Filter sheet: All / Flights / Ground, sort, date range, aircraft type, category. One primary: “Show 18 entries”.' });
const aPhoneDetail = phone({ title: '09/28/2026', left: ib('back', 'Back'), right: ib('pencil', 'Edit'), body: detailBody(), noFab: true, cap: 'A · Flight detail: route as the title, hours and cost as the two numbers, then flat sections. Edit / Copy as new / Delete at the end (delete confirms in a sheet).' });
const aPhoneTravel = phone({ title: 'Travel', right: ib('more', 'More'), tab: 'Travel', body: `${totals(true)}<div class="mk-bar">${search('Search route, airline, flight number')}<button class="gl clear gl-chip pax" aria-pressed="false">${I('sliders')}Filter</button></div>${groups(TRAVEL, true)}`, cap: 'A · Travel in the same style: grouped by year, airline badge + flight number, local times with the day offset, aircraft type, class. Violet scope.' });
const aPhoneEmpty = phone({ title: 'Flying', right: ib('more', 'More'), body: `${flyTabs()}${emptyBody()}`, cap: 'A · Empty logbook.' });
const aPhoneLoad = phone({ title: 'Flying', right: ib('more', 'More'), body: `${flyTabs()}<section class="mk-totals" style="opacity:.5"><div><div class="ds-cap">As pilot · total time</div><div class="mk-big" style="color:var(--ds-surface-3)">00.00</div></div></section>${skeleton(6)}`, cap: 'A · Loading: totals and rows as skeletons so nothing jumps.' });
const aPhoneNoMatch = phone({ title: 'Flying', right: ib('more', 'More'), body: `${flyTabs()}${totals(false)}<div class="mk-bar">${search()}<button class="gl clear gl-chip" aria-pressed="true">${I('sliders')}Filter · 3</button></div><div class="mk-chips">${chip('2019')}${chip('PA28')}${chip('Ground')}</div>${noMatch}`, cap: 'A · Filters that match nothing.' });

const selRow = (h) => h.replace('<a class="mk-row"><span class="mk-date"><b>28</b>', '<a class="mk-row sel"><span class="mk-date"><b>28</b>');
const deskList = (pax = false, withDetail = true) => selRow(`<div class="mk-pane">${pax ? '' : flyTabs()}${totals(pax)}<div class="mk-bar">${search(pax ? 'Search route, airline, flight number' : undefined)}<button class="gl clear gl-chip ${pax ? 'pax' : ''}" aria-pressed="false">${I('sliders')}Filter</button></div>${pax ? groups(TRAVEL, true) : groups(FL)}</div>${withDetail ? `<div class="mk-main-pane">${detailBody()}</div>` : ''}`);
const aDeskList = desk({ title: 'Flying', right: ib('more', 'More'), body: deskList(), cap: 'A · Desktop (1440): two panes. The list keeps its own scroll and sticky month headers; the detail pane shows the selected flight (the selected row is the one with the hairline).' });
const aDeskFilter = desk({ title: 'Flying', right: ib('more', 'More'), body: deskList(), menuHtml: '', cap: 'A · Desktop filter: the same sheet becomes a popover anchored under the Filter button (still the one overlay).' }).replace('</div></div><figcaption>', `<div class="ds-glass ds-menu ds-chrome is-open" data-role="pop" style="position:absolute;left:232px;top:312px;width:23rem;right:auto;bottom:auto"><span class="g-core"></span><span class="g-lens"></span><span class="g-scrim"></span><div class="g-in" style="padding:1rem"><div class="mk-fs"><div class="ds-field"><span class="l">Show</span><div class="gl-seg"><button class="gl pilot" aria-selected="false">All</button><button class="gl pilot" aria-selected="true">Flights</button><button class="gl pilot" aria-selected="false">Ground</button></div></div>${sel('Sort', 'Newest first')}<div class="mk-two">${sel('From', '01/01/2026')}${sel('To', 'Any date')}</div>${sel('Aircraft type', 'C172S')}<button class="gl pilot block">Show 18 entries</button></div></div></div></div><figcaption>`);
const aDeskTravel = desk({ tab: 'Travel', title: 'Travel', right: ib('more', 'More'), body: `<div class="mk-pane">${totals(true)}<div class="mk-bar">${search('Search route, airline, flight number')}<button class="gl clear gl-chip pax" aria-pressed="false">${I('sliders')}Filter</button></div>${groups(TRAVEL, true)}</div><div class="mk-main-pane"><div class="mk-dh"><div class="ds-cap">09/24/2026 · Emirates 8</div><h1 class="mk-route">LHR → DXB</h1><div class="mk-via">Airbus A380-800 (A388) · A6-EEX · Economy · seat 41K</div></div><div class="mk-hero"><div class="mk-big pax">6.80<span class="ds-unit">h</span></div></div><section class="ds-section"><span class="ds-cap">Times</span><div class="mk-grid">${stat('Departs', '14:05')}${stat('Arrives', '00:20', '+1')}${stat('Duration', '6.80', 'h')}</div></section><section class="ds-section"><span class="ds-cap">Note</span><p class="ds-sub" style="margin:0;color:var(--ds-text)">Placeholder note.</p></section></div>`, cap: 'A · Desktop Travel: same two-pane structure, violet scope.' });
const aDeskEmpty = desk({ title: 'Flying', right: ib('more', 'More'), body: `<div class="mk-pane">${flyTabs()}${skeleton(7)}</div><div class="mk-main-pane">${emptyBody()}</div>`, cap: 'A · Desktop loading (left) and the no-selection / empty state (right).' });

const optionA = page('Option A — recommended: one compact bar, grouped list, “…” menu',
  'Your recommended layout, kept as asked, with these refinements: (1) the “…” menu lives in the top bar, not on the page; (2) the totals strip shows the pilot-only total large and three small figures; (3) month headers carry hours and count so the list is scannable without opening anything; (4) rows use a date block, a route line with the scannable details under it, and the hours as the one big number; (5) the Flying section tabs scroll sideways; (6) the same row and header pattern is used on Travel (grouped by year).',
  section('Logbook list — phone (390)', 'List, the two menus, and the filter sheet.', aPhoneList + aPhoneMenus + aPhoneMore + aPhoneSheet)
  + section('Flight detail and Travel — phone', '', aPhoneDetail + aPhoneTravel)
  + section('Empty, loading, no matches — phone', '', aPhoneEmpty + aPhoneLoad + aPhoneNoMatch)
  + section('Desktop (1440) — two panes', 'List and detail side by side; the filter becomes a popover.', aDeskList + aDeskFilter + aDeskTravel + aDeskEmpty));

// ================= OPTION B =================
const cal = (flightDays, groundDays = [], pax = []) => {
  const lead = 3; // Oct 2026 starts on a Thursday (Mon-first grid: 3 blanks)
  const cells = Array.from({ length: lead }, () => '<span></span>').concat(Array.from({ length: 31 }, (_, i) => `<span class="${flightDays.includes(i + 1) ? 'f' : groundDays.includes(i + 1) ? 'g' : ''} ${pax.includes(i + 1) ? 'p' : ''}">${i + 1}</span>`));
  return `<div class="mk-cal">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<i>${d}</i>`).join('')}${cells.join('')}</div>`;
};
const pager = (m, sub, pax) => `<div class="mk-pager"><button class="gl clear icon sm" aria-label="Previous month">${I('chevL')}</button><div style="text-align:center"><h2>${m}</h2><div class="ds-sub" style="margin:0"><b class="${pax ? 'ds-pax' : 'ds-pilot'}">${sub}</b></div></div><button class="gl clear icon sm" aria-label="Next month">${I('chevR')}</button></div>`;
const dayRows = (rows, pax) => rows.map((r) => rowA(r, pax)).join('');
const mini = (pax) => (pax ? `<div class="mk-chips" style="margin:0 0 .25rem"><span class="gl clear sm gl-chip">60.95 h · 14 flights</span><span class="gl clear sm gl-chip">7 airports</span></div>` : `<div class="mk-chips" style="margin:0 0 .25rem"><span class="gl clear sm gl-chip">Total 31.40 h</span><span class="gl clear sm gl-chip">12 mo 31.40</span><span class="gl clear sm gl-chip">PIC 4.10</span></div>`);
const bPhoneList = phone({ title: 'Logbook', right: ib('search', 'Search') + ib('sliders', 'Filter') + ib('more', 'More'), body: `${flyTabs()}${mini(false)}${pager('October 2026', '3 entries · 3.60 h · $888', false)}${cal([3], [1])}${dayRows(FL[0].rows)}`, cap: 'B · Logbook as a month pager: swipe or tap ‹ › to move month by month; the calendar marks flying days (sky ring) and ground days (grey ring); tap a day to scroll to it. Search and Filter are top-bar icons.' });
const bPhoneOld = phone({ title: 'Logbook', right: ib('search', 'Search') + ib('sliders', 'Filter') + ib('more', 'More'), body: `${flyTabs()}${mini(false)}${pager('September 2026', '4 entries · 4.20 h · $1,263', false)}<div class="mk-cal">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<i>${d}</i>`).join('')}${['<span></span>', '<span></span>', '<span>1</span>', ...Array.from({ length: 29 }, (_, i) => `<span class="${[12, 14, 21, 28].includes(i + 2) ? 'f' : ''}">${i + 2}</span>`)].join('')}</div>${dayRows(FL[1].rows)}`, cap: 'B · A previous month. Older months are two taps away (month picker on the title); anything older than a few months is reached with Search or Filter.' });
const bFilter = glass('div', 'ds-sheet ds-chrome is-open', `<span class="grab"></span><div class="ds-sheet-head"><h2 class="ds-title" style="margin:0">Find flights</h2><button class="gl plain sm">Reset</button></div><div class="ds-sheet-body" style="overflow:hidden"><div class="mk-fs"><label class="mk-search gl-field">${I('search')}<span>Route, airport, tail, instructor</span></label><div class="ds-field"><span class="l">Range</span><div class="mk-chips" style="flex-wrap:wrap"><button class="gl clear gl-chip" aria-pressed="false">This month</button><button class="gl clear gl-chip" aria-pressed="true">Last 12 months</button><button class="gl clear gl-chip" aria-pressed="false">This year</button><button class="gl clear gl-chip" aria-pressed="false">All time</button><button class="gl clear gl-chip" aria-pressed="false">Custom…</button></div></div><div class="ds-field"><span class="l">Aircraft</span><div class="mk-chips" style="flex-wrap:wrap"><button class="gl clear gl-chip" aria-pressed="true">C172S</button><button class="gl clear gl-chip" aria-pressed="false">PA28</button><button class="gl clear gl-chip" aria-pressed="false">C182</button></div></div><div class="ds-field"><span class="l">Show</span><div class="gl-seg"><button class="gl pilot" aria-selected="true">All</button><button class="gl pilot" aria-selected="false">Flights</button><button class="gl pilot" aria-selected="false">Ground</button></div></div>${sel('Sort', 'Newest first')}<button class="gl pilot lg block">Show 18 entries</button></div></div>`, 'data-role="pop" data-force style="height:auto"');
const bPhoneSheet = phone({ title: 'Logbook', right: ib('search', 'Search') + ib('sliders', 'Filter') + ib('more', 'More'), body: `${flyTabs()}${mini(false)}${pager('October 2026', '3 entries · 3.60 h', false)}${cal([3], [1])}`, scrim: true, noFab: true, sheet: bFilter, cap: 'B · Filter sheet leads with search and quick ranges as chips (one tap for “last 12 months”); the menus are for the rare cases.' });
const bPhoneDetail = phone({ title: 'Flight', left: ib('back', 'Back'), right: ib('pencil', 'Edit'), noFab: true, body: `<div class="mk-boarding"><div class="ds-cap">09/28/2026 · Cross-country · C172S N123AB</div><div class="mk-arc"><b>KSUS</b><svg viewBox="0 0 100 34" preserveAspectRatio="none"><path d="M2 30 Q50 -14 98 30"/></svg><b>KALN</b></div><div class="mk-via">via KCPS · J. Rivera</div><div class="mk-hero"><div class="mk-big pilot">1.80<span class="ds-unit">h</span></div><div class="mk-cost"><i>Cost</i><b>$576.00</b></div></div></div><div class="gl-seg mk-tabs" role="tablist"><button class="gl pilot" role="tab" aria-selected="true">Overview</button><button class="gl pilot" role="tab" aria-selected="false">Time</button><button class="gl pilot" role="tab" aria-selected="false">Cost</button><button class="gl pilot" role="tab" aria-selected="false">Notes</button></div><section class="ds-section"><span class="ds-cap">Highlights</span><div class="mk-grid">${stat('Cross-country', '1.80')}${stat('Dual received', '1.80')}${stat('Landings', '2')}</div></section><section class="ds-section"><span class="ds-cap">Note</span><p class="ds-sub" style="margin:0;color:var(--ds-text)">Crosswind landings at KALN. Placeholder text.</p></section><div class="mk-actions"><button class="gl clear sm">${I('pencil')}Edit</button><button class="gl clear sm">${I('copy')}Copy as new</button><button class="gl clear sm">${I('trash')}Delete</button></div>`, cap: 'B · Detail as a “boarding pass” card (route arc, hours, cost) and tabs for the long tail of fields, so the first screen stays short.' });
const bPhoneTravel = phone({ title: 'Travel', tab: 'Travel', right: ib('search', 'Search') + ib('sliders', 'Filter') + ib('more', 'More'), body: `${mini(true)}${pager('2026', '12 flights · 41.20 h', true)}<div class="gl-seg" style="margin:.5rem 0"><button class="gl pax" aria-selected="true">Year</button><button class="gl pax" aria-selected="false">Airlines</button><button class="gl pax" aria-selected="false">Aircraft</button></div>${TRAVEL[0].rows.map((r) => rowA(r, true)).join('')}`, cap: 'B · Travel pages by year with the same pager; a Year / Airlines / Aircraft switch regroups the same flights.' });
const bPhoneEmpty = phone({ title: 'Logbook', right: ib('search', 'Search') + ib('sliders', 'Filter') + ib('more', 'More'), body: `${flyTabs()}${pager('October 2026', 'No entries', false)}${cal([])}<div class="mk-empty" style="padding:1.5rem 1rem"><h3>No flying this month</h3><p class="ds-sub">Jump to the last month with entries, or log one.</p><button class="gl clear">Go to September 2026</button></div>`, cap: 'B · A month with nothing in it (and the true empty state looks like A’s).' });
const bPhoneLoad = phone({ title: 'Logbook', right: ib('search', 'Search') + ib('sliders', 'Filter') + ib('more', 'More'), body: `${flyTabs()}${pager('October 2026', '— entries', false)}<div style="height:200px;border-radius:12px;background:var(--ds-surface-2);margin:.5rem 0"></div>${skeleton(4)}`, cap: 'B · Loading skeleton: pager, calendar block, rows.' });
const bDesk = desk({ title: 'Flying', right: ib('search', 'Search') + ib('sliders', 'Filter') + ib('more', 'More'), body: `<div style="width:300px;flex:none">${flyTabs()}${pager('Oct 2026', '3 · 3.60 h', false)}${cal([3], [1])}<div class="ds-cap" style="margin:1rem 0 .25rem">Months</div>${['September 2026 · 4.20 h', 'August 2026 · 2.90 h', 'July 2026 · 3.10 h', 'June 2026 · 2.40 h'].map((m) => `<a class="mk-row" style="grid-template-columns:1fr auto;min-height:3rem"><span>${m.split(' · ')[0]}</span><span class="ds-pilot" style="font-weight:700">${m.split(' · ')[1]}</span></a>`).join('')}</div><div style="width:400px;flex:none;border-left:1px solid var(--ds-hair);padding-left:24px">${monthHdr('October 2026', '3.60', 3, false)}${dayRows(FL[0].rows)}${monthHdr('September 2026', '4.20', 4, false)}${dayRows(FL[1].rows)}</div><div class="mk-main-pane">${detailBody(true)}</div>`, cap: 'B · Desktop: three columns — month navigator with the calendar, the month’s entries, the detail.' });
const bDeskTravel = desk({ tab: 'Travel', title: 'Travel', right: ib('search', 'Search') + ib('sliders', 'Filter') + ib('more', 'More'), body: `<div class="mk-pane">${mini(true)}${pager('2026', '12 flights · 41.20 h', true)}${TRAVEL[0].rows.map((r) => rowA(r, true)).join('')}</div><div class="mk-main-pane"><div class="mk-dh"><div class="ds-cap">09/24/2026 · Emirates 8</div><h1 class="mk-route">LHR → DXB</h1><div class="mk-via">Airbus A380-800 (A388) · Economy</div></div><div class="mk-hero"><div class="mk-big pax">6.80<span class="ds-unit">h</span></div></div></div>`, cap: 'B · Desktop Travel.' });
const optionB = page('Option B — month-first: a pager and calendar instead of one long list',
  'A meaningfully different structure: the Logbook is read month by month (a month pager with that month’s hours, a small calendar of flying days, then that month’s entries). Search and Filter are top-bar icons; totals are three chips. Detail opens as a boarding-pass card with tabs.',
  section('Logbook — phone (390)', 'Month pager, the filter sheet, and an older month.', bPhoneList + bPhoneOld + bPhoneSheet)
  + section('Detail and Travel — phone', '', bPhoneDetail + bPhoneTravel)
  + section('Empty and loading — phone', '', bPhoneEmpty + bPhoneLoad)
  + section('Desktop (1440) — three columns', 'Navigator, the month’s entries, the detail.', bDesk + bDeskTravel));

// ================= INDEX =================
const index = page('Logbook layout proposals', 'Two options for the Logbook, Flight detail and Travel screens, as static mockups at 390px and 1440px using the real tokens and the V-a glass controls. All numbers and names are placeholder data.',
  `<div class="row"><a class="gl pilot lg" href="option-a.html">Open Option A — recommended</a><a class="gl clear lg" href="option-b.html">Open Option B — month-first</a></div>
<table class="mk-cmp"><tr><th></th><th>A · one compact bar, grouped list</th><th>B · month-first pager</th></tr>
<tr><th>Idea</th><td>Your recommended layout, refined: tabs, totals strip, one search + Filter bar, list grouped by month with sticky headers.</td><td>Read the logbook month by month: a pager, a calendar of flying days, that month’s entries.</td></tr>
<tr><th>Best at</th><td>Scanning and searching across any span; one consistent list pattern shared with Travel; the fewest taps to any flight.</td><td>“What did I do this month?”, reviewing a training month, seeing gaps and streaks at a glance.</td></tr>
<tr><th>Weaker at</th><td>Less of a sense of rhythm over time; a very long list relies on the month headers and Filter.</td><td>Older history needs Search/Filter or many taps; the calendar costs ~150px of the first screen; more new components to build.</td></tr>
<tr><th>First entry on a 844px phone</th><td>About 390px with two filter chips showing and about 320px with none (measured in these mockups); today’s screen starts at about 470px</td><td>About 466px (the calendar comes first), but the month’s hours and its flying days are visible at a glance</td></tr>
<tr><th>Build cost</th><td>Lower: reuses the row, header and sheet patterns across Logbook and Travel.</td><td>Higher: pager, calendar, regrouping on Travel, tabbed detail.</td></tr>
<tr><th>Recommendation</th><td><b>Pick this.</b></td><td>Worth stealing later: the month totals chip and the calendar as an optional view.</td></tr></table>`);

fs.writeFileSync(path.join(here, 'option-a.html'), optionA.replace(/\r?\n/g, '\n'));
fs.writeFileSync(path.join(here, 'option-b.html'), optionB.replace(/\r?\n/g, '\n'));
fs.writeFileSync(path.join(here, 'index.html'), index.replace(/\r?\n/g, '\n'));
console.log('wrote option-a.html, option-b.html, index.html');
