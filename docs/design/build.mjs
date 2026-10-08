// Generates the Phase 0 design mockups (a.html, b.html, c.html) and the glass lab (lab.html) from
// tokens.mjs. Static HTML only — no app code. Run: node docs/design/build.mjs
// All figures and flights on the mockups are illustrative placeholders, not real logbook data.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { directions } from './tokens.mjs';
import { measure } from './contrast.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const land = JSON.parse(readFileSync(join(here, '../../client/src/lib/landOutline.json'), 'utf8'));

// ---------- tokens -> CSS ----------
const tokenCss = () => Object.entries(directions).flatMap(([k, d]) => Object.entries(d.theme).map(([th, t]) => `
.d-${k}.t-${th} {
  color-scheme: ${th};
  --bg:${t.bg}; --s1:${t.s1}; --s2:${t.s2}; --hair:${t.hair}; --text:${t.text}; --text2:${t.text2}; --text3:${t.text3};
  --sky:${t.sky}; --violet:${t.violet}; --ok:${t.ok}; --warn:${t.warn}; --bad:${t.bad}; --on:${t.onAccent};
  --g-tint:${t.glass.tint}; --g-edge:${t.glass.edge}; --g-shadow:${t.glass.shadow}; --g-text:${t.glass.text}; --g-text2:${t.glass.text2};
  --g-accent:${t.glass.accent}; --g-pax:${t.glass.accentPax}; --g-blur:${d.blur}px; --g-sat:${d.saturate};
  --r-card:${d.radius.card}px; --r-ctl:${d.radius.control}px; --r-sheet:${d.radius.sheet}px;
  --land:${th === 'dark' ? '#1D2128' : '#D9DFE6'}; --sea:${th === 'dark' ? '#0A1522' : '#EEF2F6'};
}`)).join('\n');

const GLASS_CSS = `
.glass { position: relative; background: var(--g-tint); color: var(--g-text);
  -webkit-backdrop-filter: blur(var(--g-blur)) saturate(var(--g-sat)); backdrop-filter: blur(var(--g-blur)) saturate(var(--g-sat));
  border: 1px solid var(--g-edge); box-shadow: var(--g-shadow), inset 0 1px 0 var(--g-edge); }
/* Soft top-edge highlight: the only gradient in the system, and only on glass. */
.glass::before { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: linear-gradient(to bottom, rgba(255,255,255,.14), rgba(255,255,255,0) 38%); }
.t-light .glass::before { background: linear-gradient(to bottom, rgba(255,255,255,.7), rgba(255,255,255,0) 40%); }
.glass .t2 { color: var(--g-text2); }
/* Fallbacks: no backdrop-filter, reduced transparency / more contrast, and the in-app toggle. */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { .glass { background: var(--s2); } }
@media (prefers-reduced-transparency: reduce) { .glass { background: var(--s2); -webkit-backdrop-filter: none; backdrop-filter: none; } .glass::before { display: none; } }
@media (prefers-contrast: more) { .glass { background: var(--s2); -webkit-backdrop-filter: none; backdrop-filter: none; border-color: var(--text3); } .glass::before { display: none; } }
.reduce .glass { background: var(--s2); -webkit-backdrop-filter: none; backdrop-filter: none; } .reduce .glass::before { display: none; }
`;

const COMMON_CSS = `
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; font: 400 17px/1.3 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, Inter, "Segoe UI", sans-serif; background: #1b1b1e; color: #eee; }
.doc { max-width: 1280px; margin: 0 auto; padding: 24px 16px 80px; }
.doc h1 { font-size: 30px; margin: 8px 0 4px; } .doc h2 { font-size: 22px; margin: 40px 0 12px; } .doc h3 { font-size: 15px; margin: 24px 0 8px; color: #bbb; text-transform: uppercase; letter-spacing: .06em; }
.doc p, .doc li { color: #c8c8cc; font-size: 15px; } .doc a { color: #8ad0ff; }
.nav { display: flex; gap: 12px; flex-wrap: wrap; margin: 8px 0 16px; font-size: 15px; }
.tog { display: flex; align-items: center; gap: 8px; font-size: 15px; color: #ddd; }
.tog input { width: 22px; height: 22px; }
.strip { display: flex; gap: 20px; overflow-x: auto; padding: 8px 4px 20px; scroll-snap-type: x mandatory; align-items: flex-start; }
.strip > figure { margin: 0; scroll-snap-align: start; flex: none; }
figcaption { font-size: 13px; color: #9a9aa0; margin: 0 0 8px; }
table.tok { border-collapse: collapse; font-size: 13px; width: 100%; } table.tok td, table.tok th { border-bottom: 1px solid #333; padding: 5px 8px; text-align: left; color: #ccc; vertical-align: middle; }
.sw { display: inline-block; width: 18px; height: 18px; border-radius: 5px; border: 1px solid #555; vertical-align: middle; margin-right: 6px; }
.scroll-x { overflow-x: auto; }
.pass { color: #5fd38d; } .fail { color: #ff7a7a; }

/* ---- device frames ---- */
.frame { position: relative; width: min(390px, calc(100vw - 32px)); height: 844px; overflow: hidden; border-radius: 44px; background: var(--bg); color: var(--text);
  border: 1px solid #333; font: 400 17px/1.3 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, Inter, sans-serif; }
.frame.desk { width: 1180px; height: 760px; border-radius: 14px; }
.sbar { position: absolute; top: 0; left: 0; right: 0; height: 47px; z-index: 5; display: flex; justify-content: space-between; align-items: flex-end; padding: 0 28px 8px; font-weight: 600; font-size: 15px; pointer-events: none; }
.scroll { position: absolute; inset: 0; overflow-y: auto; overscroll-behavior: contain; padding: 56px 16px 120px; }
.scroll::-webkit-scrollbar { display: none; }
.topbar { position: absolute; top: 0; left: 0; right: 0; z-index: 4; height: 96px; padding: 48px 16px 0; display: flex; align-items: center; justify-content: space-between; border-width: 0 0 1px; border-radius: 0; font-weight: 600; }
.topbar.cap { top: 50px; left: 12px; right: 12px; height: 46px; padding: 0 6px 0 16px; border-width: 1px; border-radius: 999px; }
.tabbar { position: absolute; left: 14px; right: 14px; bottom: 16px; z-index: 4; display: flex; padding: 6px; border-radius: 999px; }
.tabbar a { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 7px 0 6px; border-radius: 999px; font-size: 11px; font-weight: 600; color: var(--g-text2); min-height: 52px; text-decoration: none; }
.tabbar a svg { width: 24px; height: 24px; }
.tabbar a.on { background: rgba(127,127,127,.2); color: var(--g-text); } .tabbar a.on svg { color: var(--g-accent); } .tabbar a.on.pax svg { color: var(--g-pax); }
.ibtn { width: 44px; height: 44px; border-radius: 999px; display: grid; place-items: center; } .ibtn svg { width: 22px; height: 22px; }
.seg { display: inline-flex; padding: 3px; border-radius: 999px; gap: 2px; font-size: 14px; font-weight: 600; }
.seg span { padding: 8px 16px; border-radius: 999px; min-height: 36px; color: var(--g-text2); } .seg .on { background: rgba(127,127,127,.25); color: var(--g-text); }
.pill { background: var(--s2); border-radius: 999px; padding: 6px 12px; font-size: 13px; font-weight: 600; color: var(--text2); }
.large { font-size: 34px; line-height: 1.1; font-weight: 700; letter-spacing: -.02em; margin: 6px 0 2px; }
.sub { color: var(--text2); font-size: 15px; } .cap { font-size: 12px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--text2); }
.num { font-variant-numeric: tabular-nums; font-weight: 650; letter-spacing: -.02em; }
.sky { color: var(--sky); } .vio { color: var(--violet); } .ok { color: var(--ok); } .warn { color: var(--warn); } .bad { color: var(--bad); }
.card { background: var(--s1); border: 1px solid var(--hair); border-radius: var(--r-card); padding: 16px; margin-bottom: 12px; }
.group { background: var(--s1); border-radius: var(--r-card); overflow: hidden; margin-bottom: 16px; border: 1px solid var(--hair); }
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; min-height: 52px; border-top: 1px solid var(--hair); }
.row:first-child { border-top: 0; } .row .l { min-width: 0; } .row .t { font-weight: 600; } .row .s { color: var(--text2); font-size: 14px; }
.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); } .grid3 > div { padding: 12px 8px; text-align: center; border-left: 1px solid var(--hair); } .grid3 > div:first-child { border-left: 0; }
.yr { margin: 18px 4px 8px; } .map { display: block; width: 100%; height: 100%; } .map .land { fill: var(--land); } .map .sea { fill: var(--sea); }
.map .rp { fill: none; stroke: var(--sky); stroke-width: 1.4; stroke-linecap: round; opacity: .95; } .map .rv { fill: none; stroke: var(--violet); stroke-width: 1.4; stroke-linecap: round; opacity: .95; }
.map circle { fill: var(--text); }
.mapbox { border-radius: var(--r-card); overflow: hidden; height: 150px; border: 1px solid var(--hair); margin-bottom: 12px; }
.fullmap { position: absolute; inset: 0; }
.sheet { position: absolute; left: 8px; right: 8px; bottom: 8px; height: 52%; z-index: 6; border-radius: var(--r-sheet); padding: 8px 16px 96px; overflow: hidden; }
.grab { width: 38px; height: 5px; border-radius: 3px; background: var(--g-text2); opacity: .6; margin: 0 auto 12px; }
.chip { display: inline-block; padding: 8px 14px; border-radius: 999px; font-size: 14px; font-weight: 600; margin: 0 6px 8px 0; background: rgba(127,127,127,.22); } .chip.on { background: var(--g-accent); color: var(--on); }
.btn { display: block; text-align: center; padding: 14px; border-radius: var(--r-ctl); font-weight: 650; background: var(--sky); color: var(--on); min-height: 48px; }
.btn.pax { background: var(--violet); }
.zoom { position: absolute; right: 14px; top: 110px; z-index: 4; display: flex; flex-direction: column; border-radius: 22px; overflow: hidden; }
.zoom .ibtn { width: 44px; height: 44px; font-size: 22px; }
.fabglass { position: absolute; right: 18px; bottom: 98px; z-index: 4; height: 52px; padding: 0 20px; border-radius: 999px; display: flex; align-items: center; gap: 8px; font-weight: 650; }
.rail { position: absolute; left: 0; top: 0; bottom: 0; width: 220px; z-index: 4; padding: 24px 12px; border-width: 0 1px 0 0; border-radius: 0; } .rail a { display: flex; align-items: center; gap: 12px; padding: 11px 12px; border-radius: 12px; font-weight: 600; color: var(--g-text2); } .rail a svg { width: 22px; } .rail a.on { background: rgba(127,127,127,.2); color: var(--g-text); }
.dmain { position: absolute; left: 220px; right: 0; top: 0; bottom: 0; overflow: auto; padding: 32px 40px; } .dgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; } .dgrid .span2 { grid-column: span 2; }
svg.i { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }

/* ---- direction B: soft rounded cards, bigger glass controls ---- */
.d-B .card, .d-B .group { border: 0; } .d-B.t-light .card, .d-B.t-light .group { box-shadow: 0 1px 2px rgba(0,0,0,.05); } .d-B .large { font-weight: 700; }
.d-B .tabbar { padding: 8px; bottom: 18px; } .d-B .tabbar a { min-height: 58px; } .d-B .num { font-weight: 700; }
.d-B .hero { border-radius: 28px; padding: 20px; margin-bottom: 12px; background: var(--s1); }
/* ---- direction C: bold type, flat content, map-led ---- */
.d-C .card, .d-C .group { background: transparent; border: 0; border-top: 1px solid var(--text); border-radius: 0; padding-left: 0; padding-right: 0; }
.d-C .row { padding-left: 0; padding-right: 0; } .d-C .large { font-size: 44px; font-weight: 800; letter-spacing: -.035em; }
.d-C .bignum { font-size: 64px; line-height: .95; font-weight: 800; letter-spacing: -.04em; } .d-C .tabbar { border-radius: 22px; } .d-C .tabbar a { border-radius: 16px; }
.d-C .mapbox { border-radius: 0; border-width: 1px 0; }
.mapfull { position: relative; height: 340px; margin: -56px -16px 12px; } .mapfull .map { position: absolute; inset: 0; }
.ov { position: absolute; z-index: 3; padding: 10px 14px; border-radius: 14px; } .ov .n { font-size: 30px; font-weight: 800; letter-spacing: -.03em; line-height: 1; }
`;

// ---------- pieces ----------
const P = {
  home: 'M3 11l9-8 9 8M5 10v10h14V10', plane: 'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
  luggage: 'M6 7h12a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2zM9 7V4h6v3M9 11v6M15 11v6', map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  more: 'M5 12h.01M12 12h.01M19 12h.01', chev: 'M9 6l6 6-6 6', sun: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  plus: 'M12 5v14M5 12h14', bars: 'M5 20V10M12 20V4M19 20v-7', back: 'M15 6l-6 6 6 6', share: 'M12 3v12M8 7l4-4 4 4M5 12v7h14v-7', filter: 'M4 6h16M7 12h10M10 18h4',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3', warn: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
};
const ic = (n, sw) => `<svg class="i" viewBox="0 0 24 24"${sw ? ` style="stroke-width:${sw}"` : ''}><path d="${P[n]}"/></svg>`;

function mapSvg(routes, w = 400, h = 200) {
  const X = (lon) => ((lon + 180) / 360) * w, Y = (lat) => ((78 - lat) / 138) * h;
  const d = land.map((r) => { let s = ''; for (let i = 0; i < r.length; i += 2) s += `${i ? 'L' : 'M'}${X(r[i]).toFixed(1)} ${Y(r[i + 1]).toFixed(1)}`; return s + 'Z'; }).join('');
  const arcs = routes.map(([a, b, pax]) => {
    const [x1, y1, x2, y2] = [X(a[0]), Y(a[1]), X(b[0]), Y(b[1])]; const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.22;
    return `<path class="${pax ? 'rv' : 'rp'}" d="M${x1.toFixed(1)} ${y1.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}"/><circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="1.8"/><circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="1.8"/>`;
  }).join('');
  return `<svg class="map" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect class="sea" width="${w}" height="${h}"/><path class="land" d="${d}"/>${arcs}</svg>`;
}
const JFK = [-73.8, 40.6], LHR = [-0.5, 51.5], DXB = [55.4, 25.2], SIN = [103.99, 1.36], SFO = [-122.4, 37.6], NRT = [140.4, 35.8], LAX = [-118.4, 33.9], FRA = [8.6, 50.0], SUS = [-90.65, 38.66];
const ROUTES = [[JFK, LHR, 1], [LHR, DXB, 1], [DXB, SIN, 1], [SFO, NRT, 1], [LAX, JFK, 1], [FRA, JFK, 1], [SUS, [-88.2, 41.8]], [SUS, [-86.3, 39.7]]];
const MAP = () => mapSvg(ROUTES);

const status = () => '<div class="sbar"><span>9:41</span><span>●●● ▮</span></div>';
const TABS = [['home', 'Home', 'home'], ['plane', 'Flying', 'plane'], ['luggage', 'Travel', 'luggage'], ['map', 'Map', 'map'], ['more', 'More', 'more']];
const tabbar = (on) => `<nav class="tabbar glass" aria-label="Primary">${TABS.map(([i, l, k]) => `<a class="${k === on ? 'on' : ''}${k === on && k === 'luggage' ? ' pax' : ''}">${ic(i, i === 'more' ? 3 : 0)}${l}</a>`).join('')}</nav>`;
const topbar = (title, right = '', left = '') => `<header class="topbar glass">${left || '<span style="width:44px"></span>'}<span>${title}</span>${right || '<span style="width:44px"></span>'}</header>`;
const pax = [
  ['JFK', 'LHR', 'Speedbird 178', 'Boeing 777-300ER', '07/12/2026', '6.9'], ['LHR', 'DXB', 'Emirates 8', 'Airbus A380-800', '07/19/2026', '6.8'],
  ['DXB', 'SIN', 'Emirates 354', 'Airbus A380-800', '07/21/2026', '7.2'], ['SFO', 'NRT', 'Pacific 852', 'Boeing 787-9', '05/03/2026', '11.0'],
  ['LAX', 'JFK', 'Coastal 118', 'Airbus A321', '04/11/2026', '5.1'], ['FRA', 'JFK', 'Rhine 400', 'Boeing 747-8', '03/02/2026', '8.9'],
  ['ORD', 'SEA', 'Lakeshore 301', 'Boeing 737-800', '01/18/2026', '4.3'], ['SEA', 'ORD', 'Lakeshore 302', 'Boeing 737-800', '01/25/2026', '3.7'],
  ['BOS', 'DEN', 'Frontier 77', 'Airbus A320', '12/20/2025', '4.4'], ['DEN', 'BOS', 'Frontier 78', 'Airbus A320', '12/28/2025', '3.6'],
];
const paxRow = (r) => `<div class="row"><div class="l"><div class="t">${r[0]} → ${r[1]}</div><div class="s">${r[2]} · ${r[3]}</div><div class="s">${r[4]}</div></div><div class="num vio" style="font-size:20px">${r[5]}</div></div>`;
const hdr = `<div class="s"></div>`;

// ---------- screens ----------
function home(k) {
  const attn = `<div class="group"><div class="row"><div class="l"><div class="t warn">${ic('warn')} 2 need attention</div><div class="s">Medical in 38 days · Flight review in 61 days</div></div>${ic('chev')}</div></div>`;
  const pilot = `<div class="card"><div class="cap">Pilot · as pilot only</div><div class="num sky" style="font-size:44px;line-height:1.1">31.40<span class="sub" style="font-size:17px"> h</span></div><div class="grid3" style="margin-top:8px"><div><div class="num">31.4</div><div class="s sub">Last 12 mo</div></div><div><div class="num">31.4</div><div class="s sub">This year</div></div><div><div class="num ok">68 d</div><div class="s sub">Day currency</div></div></div></div>`;
  const paxC = `<div class="card"><div class="cap">Travel · as passenger only</div><div class="num vio" style="font-size:44px;line-height:1.1">238.2<span class="sub" style="font-size:17px"> h</span></div><div class="grid3" style="margin-top:8px"><div><div class="num">71</div><div class="s sub">Flights</div></div><div><div class="num">24</div><div class="s sub">Airports</div></div><div><div class="num">9</div><div class="s sub">Countries</div></div></div></div>`;
  const recent = `<div class="cap yr">Recent activity</div><div class="group">${pax.slice(0, 3).map(paxRow).join('')}</div>`;
  if (k === 'C') return `<div class="scroll"><div class="mapfull">${MAP()}<div class="ov glass" style="left:16px;bottom:16px"><div class="cap t2" style="color:var(--g-text2)">Pilot</div><div class="n" style="color:var(--g-accent)">31.4 h</div></div><div class="ov glass" style="right:16px;bottom:16px"><div class="cap t2" style="color:var(--g-text2)">Passenger</div><div class="n" style="color:var(--g-pax)">238.2 h</div></div></div>
    <div class="cap">Good afternoon, Akshaj</div><div class="large">Home</div>${attn}
    <div class="card"><div class="cap">As pilot</div><div class="bignum sky">31.40</div><div class="sub">hours · day currency 68 days</div></div>
    <div class="card"><div class="cap">As passenger</div><div class="bignum vio">238.20</div><div class="sub">71 flights · 24 airports · 9 countries</div></div>${recent}</div>${topbar('', ic('search'))}${tabbar('home')}`;
  if (k === 'B') return `<div class="scroll"><div class="sub" style="margin-top:8px">Saturday, 10/04</div><div class="large">Good afternoon, Akshaj</div><div style="height:14px"></div>
    <div class="hero" style="background:color-mix(in srgb, var(--sky) 14%, var(--s1))"><div class="cap">As pilot</div><div class="num sky" style="font-size:52px;line-height:1.05">31.40 <span class="sub" style="font-size:18px">h</span></div><div class="sub">Day currency 68 days · 75% to next goal</div></div>
    <div class="hero" style="background:color-mix(in srgb, var(--violet) 14%, var(--s1))"><div class="cap">As passenger</div><div class="num vio" style="font-size:52px;line-height:1.05">238.20 <span class="sub" style="font-size:18px">h</span></div><div class="sub">71 flights · 24 airports · 9 countries</div></div>
    ${attn}<div class="mapbox">${MAP()}</div>${recent}</div>${topbar('Home', ic('sun'))}${tabbar('home')}<div class="fabglass glass">${ic('plus')} Quick log</div>`;
  return `<div class="scroll"><div class="sub" style="margin-top:8px">Saturday, 10/04</div><div class="large">Good afternoon, Akshaj</div><div style="height:12px"></div>${attn}${pilot}${paxC}<div class="mapbox">${MAP()}</div>${recent}</div>${topbar('Home', ic('sun'))}${tabbar('home')}`;
}

function homeDesk(k) {
  const rail = `<aside class="rail glass"><div style="font-weight:700;font-size:20px;padding:4px 12px 20px">AeroHub</div>${[['home', 'Home', 1], ['plane', 'Flying'], ['luggage', 'Travel'], ['map', 'Map'], ['bars', 'Stats'], ['more', 'More']].map(([i, l, on]) => `<a class="${on ? 'on' : ''}">${ic(i)}${l}</a>`).join('')}</aside>`;
  const big = k === 'C';
  return `${rail}<main class="dmain"><div class="cap">Saturday, 10/04</div><div class="large">Good afternoon, Akshaj</div><div class="dgrid" style="margin-top:16px">
    <div class="card"><div class="cap">Pilot · as pilot only</div><div class="num sky" style="font-size:${big ? 72 : 48}px">31.40 h</div><div class="sub">Last 12 mo 31.4 · This year 31.4 · Day currency 68 days</div></div>
    <div class="card"><div class="cap">Travel · as passenger only</div><div class="num vio" style="font-size:${big ? 72 : 48}px">238.20 h</div><div class="sub">71 flights · 24 airports · 9 countries</div></div>
    <div class="mapbox span2" style="height:240px">${MAP()}</div>
    <div class="group span2">${pax.slice(0, 4).map(paxRow).join('')}</div></div></main>`;
}

function paxList() {
  let rows = '', yr = ['2026', '2025'];
  rows += `<div class="cap yr">2026</div><div class="group">${pax.slice(0, 6).map(paxRow).join('')}</div><div class="cap yr">2025</div><div class="group">${pax.slice(6).map(paxRow).join('')}</div><div class="group">${pax.map(paxRow).join('')}</div>`;
  return `<div class="scroll" style="padding-top:104px"><div class="large">Passenger flights</div><div class="sub" style="margin-bottom:10px">71 flights · 238.2 h · all as passenger</div>
    <div class="grid3 card" style="padding:4px 0"><div><div class="num vio">71</div><div class="sub s">Flights</div></div><div><div class="num vio">24</div><div class="sub s">Airports</div></div><div><div class="num vio">9</div><div class="sub s">Countries</div></div></div>${rows}</div>
    <header class="topbar glass" style="justify-content:center"><div class="seg glass" style="margin-top:2px"><span>Pilot log</span><span class="on">Passenger</span></div></header>${tabbar('luggage')}`;
}

function detail() {
  const kv = [['Date', '07/12/2026'], ['Airline', 'Speedbird'], ['Flight', '178'], ['Aircraft', 'Boeing 777-300ER'], ['Registration', 'G-STBA'], ['Seat', '34A'], ['Departed (local)', '19:10 EDT'], ['Arrived (local)', '07:05 BST +1'], ['Duration', '6.90 h']];
  return `<div class="scroll" style="padding-top:96px"><div class="cap vio">Passenger flight</div><div class="large">JFK → LHR</div><div class="sub">New York to London · 07/12/2026</div><div style="height:12px"></div>
    <div class="mapbox" style="height:170px">${mapSvg([[JFK, LHR, 1]])}</div>
    <div class="grid3 card" style="padding:4px 0"><div><div class="num vio">6.90</div><div class="sub s">Hours</div></div><div><div class="num">3,451</div><div class="sub s">Miles</div></div><div><div class="num">34A</div><div class="sub s">Seat</div></div></div>
    <div class="group">${kv.map(([a, b]) => `<div class="row"><span class="sub">${a}</span><span style="font-weight:600">${b}</span></div>`).join('')}</div>
    <div class="cap yr">Notes</div><div class="card"><div>Tailwinds all the way; landed 25 minutes early. Window seat on the left side for the sunrise over Ireland.</div></div></div>
    ${topbar('', `<span class="ibtn">${ic('share')}</span>`, `<span class="ibtn">${ic('back')}</span>`)}`;
}

function sheetOverMap() {
  return `<div class="fullmap">${MAP()}</div><div class="zoom glass"><span class="ibtn">+</span><span class="ibtn">−</span></div>
    <div class="sheet glass"><div class="grab"></div><div style="font-weight:700;font-size:20px;margin-bottom:10px">Filter flights</div>
    <div class="seg glass" style="width:100%;margin-bottom:12px"><span style="flex:1;text-align:center">All</span><span style="flex:1;text-align:center" class="on">Pilot</span><span style="flex:1;text-align:center">Passenger</span></div>
    <div><span class="chip on">2026</span><span class="chip">2025</span><span class="chip">2024</span><span class="chip">Heavy</span><span class="chip">Turbine</span></div>
    <div class="btn" style="margin-top:8px">Show 31 flights</div></div>${tabbar('map')}`;
}
function tabOverMap() {
  return `<div class="fullmap">${MAP()}</div><div class="topbar cap glass"><span style="font-weight:600">Map</span><span class="seg glass" style="padding:2px"><span>All</span><span class="on">Pilot</span><span>Pax</span></span></div>
    <div class="zoom glass"><span class="ibtn">+</span><span class="ibtn">−</span></div><div class="ov glass" style="left:14px;bottom:100px"><div class="cap" style="color:var(--g-text2)">31 airports · 12 states</div></div>${tabbar('map')}`;
}

// ---------- docs: tokens + contrast ----------
const rows = measure();
function tokenTable(k, d) {
  const colorKeys = ['bg', 's1', 's2', 'text', 'text2', 'text3', 'sky', 'violet', 'ok', 'warn', 'bad'];
  const head = '<tr><th>Token</th><th>Dark</th><th>Light</th></tr>';
  const sw = (v) => `<span class="sw" style="background:${v}"></span>${v}`;
  const body = colorKeys.map((c) => `<tr><td>${c}</td><td>${sw(d.theme.dark[c])}</td><td>${sw(d.theme.light[c])}</td></tr>`).join('') +
    `<tr><td>hairline</td><td>${d.theme.dark.hair}</td><td>${d.theme.light.hair}</td></tr>` +
    ['tint', 'edge', 'shadow', 'text', 'text2', 'accent', 'accentPax'].map((g) => `<tr><td>glass ${g}</td><td>${d.theme.dark.glass[g]}</td><td>${d.theme.light.glass[g]}</td></tr>`).join('') +
    `<tr><td>glass blur / saturate</td><td colspan="2">${d.blur}px / ${d.saturate}</td></tr>`;
  const ty = Object.entries(d.type).map(([n, v]) => `<tr><td>${n}</td><td colspan="2">${v} (size/line-height weight)</td></tr>`).join('');
  return `<h3>Tokens</h3><div class="scroll-x"><table class="tok">${head}${body}</table></div>
  <h3>Type scale (SF Pro via system-ui; Inter fallback; sizes in rem so 200% text works)</h3><table class="tok">${ty}</table>
  <h3>Radii, spacing, accents</h3><table class="tok"><tr><td>radius card / control / sheet / capsule</td><td>${d.radius.card} / ${d.radius.control} / ${d.radius.sheet} / 999px</td></tr><tr><td>spacing scale</td><td>4 · 8 · 12 · 16 · 24 · 32 (16px side gutter)</td></tr><tr><td>accent usage</td><td>Sky = pilot data only; violet = passenger data only; never both on one number. Semantic ok/warn/bad for status only. Everything else monochrome.</td></tr></table>`;
}
function contrastTable(k) {
  const glass = rows.filter((r) => r.dir === k && !r.backdrop.startsWith('solid'));
  const labels = [...new Set(glass.map((r) => r.label))];
  const bds = [...new Set(glass.map((r) => r.backdrop))];
  const cell = (th, lbl, bd) => { const r = glass.find((x) => x.theme === th && x.label === lbl && x.backdrop === bd); return `<td class="${r.ratio >= r.min ? 'pass' : 'fail'}">${r.ratio.toFixed(2)}</td>`; };
  const t = (th) => `<h3>Glass contrast, ${th} theme (tint composited over each backdrop; AA 4.5 text, 3.0 non-text)</h3><div class="scroll-x"><table class="tok"><tr><th>Backdrop</th>${labels.map((l) => `<th>${l}</th>`).join('')}</tr>${bds.map((b) => `<tr><td>${b}</td>${labels.map((l) => cell(th, l, b)).join('')}</tr>`).join('')}</table></div>`;
  const solid = rows.filter((r) => r.dir === k && r.backdrop.startsWith('solid') && r.theme);
  const st = (th) => { const s = solid.filter((r) => r.theme === th); const lab = [...new Set(s.map((r) => r.label))]; const sf = [...new Set(s.map((r) => r.backdrop))];
    return `<h3>Solid-surface contrast, ${th} (text on page / surface / raised, min 4.5)</h3><div class="scroll-x"><table class="tok"><tr><th>Surface</th>${lab.map((l) => `<th>${l}</th>`).join('')}</tr>${sf.map((b) => `<tr><td>${b}</td>${lab.map((l) => { const r = s.find((x) => x.label === l && x.backdrop === b); return `<td class="${r.ratio >= 4.5 ? 'pass' : 'fail'}">${r.ratio.toFixed(2)}</td>`; }).join('')}</tr>`).join('')}</table></div>`; };
  return t('dark') + t('light') + st('dark') + st('light');
}

function page(k) {
  const d = directions[k];
  const frames = (th) => `
  <h2>${th === 'dark' ? 'Dark' : 'Light'} — phone (390 × 844)</h2>
  <div class="strip d-${k} t-${th}">
    <figure><figcaption>Home</figcaption><div class="frame d-${k} t-${th}">${status()}${home(k)}</div></figure>
    <figure><figcaption>List: passenger flights (scrolls under the glass bars)</figcaption><div class="frame d-${k} t-${th}">${status()}${paxList()}</div></figure>
    <figure><figcaption>Detail: passenger flight</figcaption><div class="frame d-${k} t-${th}">${status()}${detail()}</div></figure>
    <figure><figcaption>Bottom sheet, medium detent, over the map</figcaption><div class="frame d-${k} t-${th}">${status()}${sheetOverMap()}</div></figure>
    <figure><figcaption>Floating tab bar over the map</figcaption><div class="frame d-${k} t-${th}">${status()}${tabOverMap()}</div></figure>
  </div>
  <h2>${th === 'dark' ? 'Dark' : 'Light'} — desktop</h2>
  <div class="strip"><figure><div class="frame desk d-${k} t-${th}">${homeDesk(k)}</div></figure></div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>AeroHub direction ${k} — ${d.name}</title><style>${GLASS_CSS}${COMMON_CSS}${tokenCss()}</style></head>
<body><div class="doc"><div class="nav"><a href="index.html">All directions</a><a href="a.html">A</a><a href="b.html">B</a><a href="c.html">C</a><a href="lab.html">Glass lab</a></div>
<h1>Direction ${k}: ${d.name}</h1><p>${d.tagline} Illustrative placeholder data only.</p>
<label class="tog"><input type="checkbox" id="rt"> Reduce transparency (solid fallback)</label>
<div id="root">${frames('dark')}${frames('light')}</div>
<h2>Design tokens</h2>${tokenTable(k, d)}<h2>Measured contrast</h2>${contrastTable(k)}</div>
<script>document.getElementById('rt').addEventListener('change',function(e){document.getElementById('root').classList.toggle('reduce',e.target.checked)});</script></body></html>`;
}

// ---------- glass lab ----------
function lab() {
  const items = Array.from({ length: 400 }, (_, i) => { const hue = (i * 47) % 360; const bright = i % 7 === 0; return `<div class="lrow" style="${bright ? `background:hsl(${hue} 90% 62%);color:#000` : ''}"><b>Row ${i + 1}</b> · ${['JFK → LHR', 'LAX → NRT', 'SUS → ORD', 'DXB → SIN'][i % 4]}<span>${(i % 9 + 1.3).toFixed(1)} h</span></div>`; }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><title>AeroHub glass lab</title>
<style>${COMMON_CSS}${tokenCss()}${GLASS_CSS}
body { background: var(--bg); color: var(--text); overscroll-behavior-y: contain; }
.lrow { display: flex; justify-content: space-between; padding: 16px; border-bottom: 1px solid var(--hair); font-size: 17px; background: var(--s1); }
#list { padding: calc(env(safe-area-inset-top) + 150px) 0 calc(env(safe-area-inset-bottom) + 120px); }
#map { position: fixed; inset: 0; display: none; } #map svg { width: 100%; height: 100%; } body.showmap #map { display: block; } body.showmap #list { visibility: hidden; }
.lt { position: fixed; top: 0; left: 0; right: 0; z-index: 10; padding: calc(env(safe-area-inset-top) + 8px) 12px 10px; border-width: 0 0 1px; border-radius: 0; }
.lt .ctl { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; font-size: 14px; } .lt button { font: inherit; font-weight: 600; min-height: 44px; padding: 0 14px; border-radius: 999px; border: 0; color: var(--g-text); background: rgba(127,127,127,.25); }
.lt button.on { background: var(--g-accent); color: var(--on); }
.ltab { position: fixed; z-index: 10; left: 14px; right: 14px; bottom: calc(env(safe-area-inset-bottom) + 10px); display: flex; padding: 6px; border-radius: 999px; }
.ltab a { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 7px 0 6px; border-radius: 999px; font-size: 11px; font-weight: 600; color: var(--g-text2); min-height: 52px; } .ltab a.on { background: rgba(127,127,127,.2); color: var(--g-text); } .ltab a svg { width: 24px; height: 24px; }
#fps { position: fixed; z-index: 11; right: 8px; top: calc(env(safe-area-inset-top) + 116px); font: 600 13px/1.3 ui-monospace, Menlo, monospace; background: #000c; color: #7CFFB0; padding: 6px 8px; border-radius: 8px; }
</style></head><body class="d-A t-dark" id="b">
<div id="map"></div><div id="list">${items}</div>
<div class="lt glass"><b>Glass lab</b> <span class="t2" id="info"></span><div class="ctl">
<button data-d="A" class="on">A Meridian</button><button data-d="B">B Softbox</button><button data-d="C">C Large Type</button>
<button id="th">Theme: dark</button><button id="rt">Reduce transparency: off</button><button id="mp">Show map</button><button id="auto">Auto-scroll test</button></div></div>
<nav class="ltab glass">${TABS.map(([i, l], n) => `<a class="${n === 0 ? 'on' : ''}">${ic(i, i === 'more' ? 3 : 0)}${l}</a>`).join('')}</nav>
<div id="fps">fps …</div>
<script>
const b=document.getElementById('b'); document.getElementById('map').innerHTML=${JSON.stringify(mapSvg(ROUTES, 800, 420))};
let d='A',t='dark';const cls=()=>{b.className='d-'+d+' t-'+t+(b.classList.contains('reduce')?' reduce':'')+(b.classList.contains('showmap')?' showmap':'')};
document.querySelectorAll('[data-d]').forEach(x=>x.onclick=()=>{d=x.dataset.d;document.querySelectorAll('[data-d]').forEach(y=>y.classList.toggle('on',y===x));cls()});
document.getElementById('th').onclick=e=>{t=t==='dark'?'light':'dark';e.target.textContent='Theme: '+t;cls()};
document.getElementById('rt').onclick=e=>{b.classList.toggle('reduce');e.target.textContent='Reduce transparency: '+(b.classList.contains('reduce')?'on':'off');cls()};
document.getElementById('mp').onclick=e=>{b.classList.toggle('showmap');e.target.textContent=b.classList.contains('showmap')?'Show list':'Show map';cls()};
document.getElementById('info').textContent='backdrop-filter: '+(CSS.supports('backdrop-filter','blur(1px)')||CSS.supports('-webkit-backdrop-filter','blur(1px)')?'supported':'NOT supported')+' · blurred layers: 2';
let last=performance.now(),frames=0,acc=0,worst=0,fpsEl=document.getElementById('fps');
function tick(n){const dt=n-last;last=n;frames++;acc+=dt;if(dt>worst)worst=dt;if(acc>=1000){fpsEl.textContent=Math.round(frames*1000/acc)+' fps · worst frame '+Math.round(worst)+' ms';frames=0;acc=0;worst=0}requestAnimationFrame(tick)}requestAnimationFrame(tick);
let run=false;document.getElementById('auto').onclick=()=>{run=!run;if(!run)return;let dir=1;const step=()=>{if(!run)return;scrollBy(0,14*dir);if(scrollY+innerHeight>=document.body.scrollHeight-2)dir=-1;if(scrollY<=0)dir=1;requestAnimationFrame(step)};step()};
</script></body></html>`;
}

function index() {
  const cards = Object.entries(directions).map(([k, d]) => `<li><a href="${k.toLowerCase()}.html"><b>Direction ${k}: ${d.name}</b></a><br>${d.tagline}</li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AeroHub redesign — Phase 0</title><style>${COMMON_CSS}</style></head><body><div class="doc"><h1>AeroHub redesign — Phase 0</h1><ul>${cards}<li><a href="lab.html"><b>Glass lab</b></a><br>Full-viewport stress test: glass tab bar and top bar over a 400-row list and a map, FPS meter, A/B/C and theme switches, reduce-transparency toggle. Open it on your iPhone.</li></ul><p>All data is illustrative placeholder content, not real logbook data.</p></div></body></html>`;
}

for (const k of Object.keys(directions)) writeFileSync(join(here, `${k.toLowerCase()}.html`), page(k));
writeFileSync(join(here, 'lab.html'), lab());
writeFileSync(join(here, 'index.html'), index());
console.log('built a.html b.html c.html lab.html index.html');
