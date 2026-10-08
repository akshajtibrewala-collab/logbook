// Shared pieces for the Logbook revamp mockups (static HTML, no app code). Real design-system CSS is inlined, so glass bars, V-a buttons,
// chips, selects, switches and sheets are the real ones. DATA IS PLACEHOLDER: names, tails and airports are invented; the hours and
// landings only mirror the SHAPE of the pilot's logbook (20 flights, mostly local KSUS, 6 ground sessions) so that the invariants can be
// shown: month FLIGHT hours add up to the pilot total, ground hours are separate. Nothing here comes from the database.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const here = path.dirname(fileURLToPath(import.meta.url));
const ds = path.join(here, '..', '..', '..', 'client', 'src', 'ds');
export const dsCss = ['tokens.css', 'glass.css', 'ds.css', 'buttons.css'].map((f) => fs.readFileSync(path.join(ds, f), 'utf8')).join('\n');

// ---------- placeholder data ----------
const TAILS = ['N123AB', 'N456CD', 'N789EF'];
const INSTR = ['J. Rivera', 'M. Chen'];
// [id, date, total, day landings] — newest first. All are dual; PIC is logged on most of them as the student acting as PIC.
const RAW = [[20, '2026-09-12', 2.6, 3], [19, '2026-09-10', 1.7, 14], [18, '2026-09-04', 1.6, 8], [17, '2026-09-02', 1.6, 13], [16, '2026-08-28', 1.4, 4], [15, '2026-08-26', 1.5, 8],
  [14, '2026-08-25', 1.7, 10], [13, '2026-08-24', 1.7, 9], [12, '2026-08-21', 1.3, 14], [11, '2026-08-20', 1.6, 10], [10, '2026-08-19', 1.6, 14], [9, '2026-08-18', 1.5, 12],
  [8, '2026-08-17', 1.7, 6], [7, '2026-08-13', 1.5, 2], [6, '2026-08-12', 1.5, 2], [5, '2026-08-11', 1.6, 1], [4, '2026-08-05', 1.6, 1], [3, '2026-08-04', 1.3, 1],
  [2, '2026-08-03', 1.3, 1], [1, '2026-07-28', 1.1, 1]];
export const FLIGHTS = RAW.map(([id, date, total, ldg], i) => ({
  kind: 'flight', id, date, total, ldg, tail: TAILS[i % 3], instr: INSTR[i % 7 === 3 ? 1 : 0], type: 'C172S', pic: id === 20 ? 0 : total, dual: total, cost: Math.round(total * 318 * 100) / 100,
  debrief: id === 20 ? { well: 'Smooth crosswind landings on 17.', work: 'Flare timing, power-off 180.' } : id === 19 ? { well: 'Steady pattern altitude.', work: 'Go-around call-outs.' } : id === 14 ? { well: 'First unassisted radio calls.', work: 'Stay ahead on checklists.' } : null,
}));
export const GROUND = [[6, '2026-08-25', 1.8, 'Airspace and weather'], [5, '2026-08-14', 1.2, 'Weight and balance'], [4, '2026-08-07', 1.5, 'Regulations review'], [3, '2026-08-02', 1.5, 'Navigation and charts'],
  [2, '2026-08-01', 1.5, 'Aerodynamics'], [1, '2026-07-20', 1.6, 'Intro to the checklist']].map(([id, date, hours, topics]) => ({ kind: 'ground', id, date, total: hours, topics, instr: 'M. Chen', cost: Math.round(hours * 62 * 100) / 100 }));
export const ENTRIES = [...FLIGHTS, ...GROUND].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
const r2 = (n) => Math.round(n * 100) / 100;
export const PILOT_TOTAL = r2(FLIGHTS.reduce((s, f) => s + f.total, 0));
export const GROUND_TOTAL = r2(GROUND.reduce((s, g) => s + g.total, 0));
export const LANDINGS = FLIGHTS.reduce((s, f) => s + f.ldg, 0);
export const PIC_TOTAL = r2(FLIGHTS.reduce((s, f) => s + f.pic, 0));
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = (k) => `${MONTHS[+k.slice(5) - 1]} ${k.slice(0, 4)}`;
export const fmt = (n) => n.toFixed(2);
export const mdy = (d) => `${d.slice(5, 7)}/${d.slice(8)}/${d.slice(0, 4)}`;
export const dayMon = (d) => ({ day: d.slice(8), mon: MONTHS[+d.slice(5, 7) - 1].slice(0, 3).toUpperCase() });
// Grouping: month FLIGHT hours and ground hours kept apart (the invariant the build must keep).
export function groups(entries = ENTRIES) {
  const out = [];
  for (const e of entries) {
    const k = e.date.slice(0, 7); let g = out[out.length - 1];
    if (!g || g.key !== k) { g = { key: k, label: monthName(k), fh: 0, flights: 0, gh: 0, grounds: 0, rows: [] }; out.push(g); }
    if (e.kind === 'ground') { g.gh = r2(g.gh + e.total); g.grounds++; } else { g.fh = r2(g.fh + e.total); g.flights++; }
    g.rows.push(e);
  }
  return out;
}
// running pilot total after each flight (chronological), for "counted toward" lines
const chrono = [...FLIGHTS].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id); let run = 0;
export const RUN = new Map(chrono.map((f) => [f.id, (run = r2(run + f.total))]));
{ // build-time invariants: fail loudly rather than ship a mockup that contradicts the rules
  const g = groups(); const sum = r2(g.reduce((s, x) => s + x.fh, 0));
  if (sum !== PILOT_TOTAL || sum !== 31.4) throw new Error(`month flight hours ${sum} != pilot total ${PILOT_TOTAL}`);
  if (g.some((x) => x.fh > PILOT_TOTAL)) throw new Error('a month exceeds the total');
  if (GROUND_TOTAL !== 9.1 || FLIGHTS.length !== 20 || GROUND.length !== 6) throw new Error('placeholder shape drifted');
}
// Requirement progress shaped like the milestone engine's output for the Private certificate (label, current, min, unit). Placeholder values.
export const REQS = [
  { k: 'total', label: 'Total time', cur: 31.4, min: 40 }, { k: 'dual', label: 'Flight training with an instructor', short: 'Dual', cur: 31.4, min: 20 },
  { k: 'xc', label: 'Cross-country flight training', short: 'Cross-country', cur: 0, min: 3 }, { k: 'night', label: 'Night flight training', short: 'Night', cur: 0, min: 3 },
  { k: 'solo', label: 'Solo flight time', short: 'Solo', cur: 0, min: 10 }, { k: 'sxc', label: 'Solo cross-country time', short: 'Solo XC', cur: 0, min: 5 },
];

// ---------- icons (lucide paths) ----------
const P = {
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  luggage: '<path d="M6 20a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2"/><path d="M8 18V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14"/><path d="M10 20h4"/><circle cx="16" cy="20" r="2"/><circle cx="8" cy="20" r="2"/>',
  map: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>', minus: '<path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>', chevL: '<path d="m15 18-6-6 6-6"/>', chevR: '<path d="m9 18 6-6-6-6"/>', chevD: '<path d="m6 9 6 6 6-6"/>', chevU: '<path d="m18 15-6-6-6 6"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', check: '<path d="M20 6 9 17l-5-5"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  cap: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
  dollar: '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  swap: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>', clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  calc: '<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', table: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
};
export const I = (n, cls = 'ds-i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;

// ---------- chrome (the real glass markup) ----------
export const glass = (tag, cls, inner, attrs = '') => `<${tag} class="ds-glass ${cls}" ${attrs}><span class="g-core"></span><span class="g-lens"></span><span class="g-scrim"></span><div class="g-in">${inner}</div></${tag}>`;
export const TABS = [['home', 'Home'], ['plane', 'Flying'], ['luggage', 'Travel'], ['map', 'Map'], ['more', 'More']];
export const tabbar = (active) => { const i = TABS.findIndex(([, l]) => l === active);
  return glass('nav', 'ds-tabbar ds-chrome', `<div class="ds-tabs"><span class="ds-ind ds-lite" style="width:62px;transform:translateX(${6 + 70 * i + 4}px)"></span>${TABS.map(([ic, l]) => `<a class="tab ${l === 'Travel' ? 'pax' : ''}" ${l === active ? 'aria-current="page"' : ''}>${I(ic, '')}<span>${l}</span></a>`).join('')}</div>`); };
export const rail = (active) => { const i = TABS.findIndex(([, l]) => l === active);
  return glass('nav', 'ds-tabbar ds-chrome mk-rail', `<div class="ds-tabs"><span class="ds-ind ds-lite" style="height:64px;transform:translateY(${6 + 4 + 72 * i}px)"></span>${TABS.map(([ic, l]) => `<a class="tab ${l === 'Travel' ? 'pax' : ''}" ${l === active ? 'aria-current="page"' : ''}>${I(ic, '')}<span>${l}</span></a>`).join('')}</div>`); };
export const topbar = ({ left = '', title = '', right = '', mark = false, wide = false }) => glass('header', `ds-topbar ds-chrome ${wide ? 'mk-wide' : ''}`,
  `<div class="side">${left || (mark ? '<span class="mark" style="padding-left:.875rem;font-weight:800;font-size:.9375rem">AeroHub</span>' : '')}</div><span class="ttl" style="--p:1">${title}</span><div class="side" style="justify-content:flex-end">${right ? `<span class="grp ds-lite" style="display:flex">${right}</span>` : ''}</div>`);
export const ib = (n, label) => `<button class="ds-iconbtn" aria-label="${label}">${I(n)}</button>`;
export const fab = (open = false, cls = '') => `<button class="ds-fab gl gfab clear ${cls}" aria-label="Add" aria-expanded="${open}">${I('plus', '')}</button>`;
export const menu = (items, cls = '') => glass('div', `ds-menu ds-chrome is-open ${cls}`, `<div role="menu">${items.map(([ic, l, dot]) => `<button class="mi">${dot ? `<span class="dot" style="background:var(--ds-${dot})"></span>` : I(ic)}${l}</button>`).join('')}</div>`, 'data-role="pop"');
export const ADD_ITEMS = [['zap', 'Quick log'], ['copy', 'Copy last flight'], ['plane', 'Add flight'], ['cap', 'Log ground session']];

// ---------- frames ----------
export const phone = ({ title = '', left = '', right = '', body = '', tab = 'Flying', fabOpen = false, menuHtml = '', sheet = '', scrim = false, noFab = false, noTabs = false, mark = false, cap = '', after = '' }) => `
<figure class="mk-fig"><div class="ds-frame mk-phone"><div class="ds-edge top"></div>${topbar({ left, title, right, mark })}<div class="ds-scroll">${body}</div><div class="ds-edge bot"></div>${scrim ? '<div class="ds-scrim-dim is-on"></div>' : ''}${noFab ? '' : fab(fabOpen)}${menuHtml}${noTabs ? '' : tabbar(tab)}${sheet}${after}</div><figcaption>${cap}</figcaption></figure>`;
export const desk = ({ tab = 'Flying', title = '', right = '', body = '', menuHtml = '', cap = '', extra = '', h = 900 }) => `
<figure class="mk-fig mk-figd"><div class="mk-desk" style="height:${h}px">${rail(tab)}${topbar({ title, right, wide: true, mark: true })}${fab(false, 'mk-dfab')}${menuHtml}<div class="mk-dbody" style="bottom:0">${body}</div>${extra}</div><figcaption>${cap}</figcaption></figure>`;

// ---------- small building blocks ----------
export const flyTabs = (sel = 'Logbook') => `<div class="gl-seg scroll fl-tabs" role="tablist" aria-label="Flying">${['Logbook', 'Currency', 'Milestones', 'Costs', 'Weather'].map((t) => `<button class="gl pilot" role="tab" aria-selected="${t === sel}">${t}</button>`).join('')}</div>`;
export const search = (ph = 'Search flights') => `<label class="mk-search gl-field">${I('search')}<span>${ph}</span></label>`;
export const filterBtn = (n = 0) => `<button class="gl clear gl-chip" ${n ? 'aria-pressed="true"' : ''}>${I('sliders', '')}Filter${n ? ` · ${n}` : ''}</button>`;
export const chip = (t, pax) => `<button class="gl clear gl-chip ${pax ? 'pax' : ''}" aria-pressed="true">${t}${I('x')}</button>`;
export const seg = (opts, sel, scope = 'pilot') => `<div class="gl-seg" role="tablist">${opts.map((o) => `<button class="gl ${scope}" role="tab" aria-selected="${o === sel}">${o}</button>`).join('')}</div>`;
export const unit = (u) => `<span class="ds-unit">${u}</span>`;
export const stat = (l, v, u = '') => `<div class="mk-st"><i>${l}</i><b>${v}${u ? unit(u) : ''}</b></div>`;
export const bar = (pct, cls = '') => `<div class="mk-pb ${cls}"><i style="width:${Math.min(100, pct)}%"></i></div>`;
// "20 flights · 31.40 h · 6 ground sessions · 9.10 h": what each number counts, never one blended figure
export const countsLine = (matching = false) => `${matching ? 'Matching: ' : ''}${FLIGHTS.length} flights · ${fmt(PILOT_TOTAL)} h · ${GROUND.length} ground sessions · ${fmt(GROUND_TOTAL)} h`;
export const monthHdr = (g) => `<div class="mk-month"><span>${g.label}</span><span><b class="pilot">${fmt(g.fh)} h</b> · ${g.flights} flight${g.flights === 1 ? '' : 's'}${g.grounds ? ` <em class="gr"> · ${fmt(g.gh)} h ground · ${g.grounds} session${g.grounds === 1 ? '' : 's'}</em>` : ''}</span></div>`;
export const badgeGround = `<span class="mk-gb" aria-label="Ground session">${I('cap', '')}</span>`;
export const skeleton = (n = 4) => Array.from({ length: n }, () => '<div class="mk-row mk-skel"><span class="mk-date"></span><span class="mk-main"><strong></strong><span></span></span><span class="mk-end"><b></b></span></div>').join('');
export const emptyState = (pax = false) => `<div class="mk-empty"><div class="ic">${I(pax ? 'luggage' : 'plane')}</div><h3>${pax ? 'No passenger flights yet' : 'Nothing logged yet'}</h3><p class="ds-sub">${pax ? 'Log a trip and your map, airlines and airports fill in.' : 'Log your first flight or ground session. Your progress toward the checkride starts here.'}</p><button class="gl ${pax ? 'pax' : 'pilot'}">${pax ? 'Add flight' : 'Log your first flight'}</button></div>`;
export const noMatch = `<div class="mk-empty"><div class="ic">${I('search')}</div><h3>Nothing matches these filters</h3><p class="ds-sub">Try a wider date range or clear the aircraft filter.</p><button class="gl clear">Clear filters</button></div>`;
export const sel = (l, v) => `<label class="ds-field"><span class="l">${l}</span><span class="gl-select" role="button">${v}</span></label>`;
export const filterSheet = (cta = `Show ${FLIGHTS.length} flights`) => glass('div', 'ds-sheet ds-chrome is-open', `<span class="grab"></span><div class="ds-sheet-head"><h2 class="ds-title" style="margin:0">Filter and sort</h2><button class="gl plain sm">Clear all</button></div><div class="ds-sheet-body" style="overflow:hidden"><div class="mk-fs"><div class="ds-field"><span class="l">Show</span>${seg(['All', 'Flights', 'Ground'], 'All')}</div>${sel('Sort', 'Newest first')}<div class="mk-two">${sel('From', '07/01/2026')}${sel('To', 'Any date')}</div>${sel('Aircraft type', 'C172S')}${sel('Category', 'Dual received')}<button class="gl pilot lg block">${cta}</button></div></div>`, 'data-role="pop" data-force');
export const kbd = () => `<div class="mk-kbd" aria-hidden="true">${['q w e r t y u i o p', 'a s d f g h j k l', '⇧ z x c v b n m ⌫', '123 ␣ return'].map((r) => `<div>${r.split(' ').map((k) => `<span>${k}</span>`).join('')}</div>`).join('')}</div>`;

// ---------- page shell + CSS ----------
const MOCK_CSS = fs.readFileSync(path.join(here, 'mock.css'), 'utf8');
export const page = ({ title, body, nav = '' }) => `<!doctype html><html lang="en" data-ds-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${title}</title><style>${dsCss}\n${MOCK_CSS}</style></head><body class="ds-root"><div class="pg">${nav}${body}</div><script>document.querySelectorAll('.ds-scroll').forEach(function(s){var f=s.querySelector('.mk-focus');if(f){s.scrollTop=f.getBoundingClientRect().top-s.getBoundingClientRect().top+s.scrollTop-230}})</script></body></html>`;
export const write = (name, html) => fs.writeFileSync(path.join(here, '..', name), html.replace(/\r\n/g, '\n'));
export const fig = (html) => html;
