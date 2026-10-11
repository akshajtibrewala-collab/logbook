// Builds the HUB HOME mockups (static HTML, NO app code, NO database):   node docs/design/hub/build.mjs   ->   docs/design/home-hub.html
//   Option A "Board": greeting, the hero, one status line, then module tiles (each with one live line), then the quiet map.
//   Option B "Map first": the map is the top of the page with the hero over it, a compact module row, then "Recently".
// Phone (390) and desktop (1440) for each. PLACEHOLDER DATA ONLY (invented numbers and names); the real design-system CSS is inlined, so glass bars, tab bar,
// Add button and the calm hero and rows are the real ones. Nothing here is built into the app: the owner picks first.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dsCss, phone, desk, I } from '../logbook-revamp/lib.mjs';
import { buildProjection } from '../../../client/src/lib/routeProjection.js';
import { buildLandPath } from '../../../client/src/lib/landPath.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '..', '..', '..');
const MOCK = fs.readFileSync(path.join(here, '..', 'logbook-revamp', 'mock.css'), 'utf8');
const APP = ['minimal.css', 'bcalm.css'].map((f) => fs.readFileSync(path.join(repo, 'client', 'src', 'ds', f), 'utf8')).join('\n');
const HUB = fs.readFileSync(path.join(here, 'hub.css'), 'utf8');

// ---------------------------------------------------------------- placeholder data (invented)
const D = { name: 'Alex', pilot: 31.4, goal: 50, min: 40, paxH: 120.5, paxN: 41, flights: 26, airports: 14, countries: 5, aircraft: 3, spent: '$9,640', met: 3, reqs: 11, wx: 'Go at KSUS' };
const f2 = (n) => n.toFixed(2);
const chevR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';

// ---------------------------------------------------------------- the pieces (the real app's classes)
const greet = `<p class="bc-greet">Good evening, ${D.name}</p>`;
const hero = (compact = false) => `<button class="bc-hero ${compact ? 'on-map' : ''}" data-card aria-label="Private Pilot: ${f2(D.pilot)} hours of your ${D.goal} hour goal; the ${D.min} hour FAA minimum is marked"><span class="lab"><span class="bc-dot pilot"></span>Private Pilot</span><span class="nrow"><span class="n">${f2(D.pilot)}<small>h</small></span><span class="of">of ${D.goal} h</span></span><span class="bc-line" role="img" aria-label="Progress"><i style="width:${(D.pilot / D.goal) * 100}%"></i><b class="tick" style="left:${(D.min / D.goal) * 100}%"></b></span></button>`;
const status = `<a class="bc-status" href="#" aria-label="All clear. Open Currency"><span class="bc-dot ok"></span><span>All clear</span><span class="r">${chevR}</span></a>`;
const ico = (n) => (n === 'sun' ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>' : I(n, ''));
const tile = (icon, name, live, dot = '') => `<a class="hub-t" href="#" data-row aria-label="${name}, ${live}"><span class="top"><span class="ic">${ico(icon)}</span>${dot ? `<span class="bc-dot ${dot}"></span>` : ''}</span><span class="nm">${name}</span><span class="v">${live}</span></a>`;
const TILES = [
  ['plane', 'Logbook', `${D.flights} flights`, 'pilot'], ['luggage', 'Travel', `${D.paxN} flights`, 'pax'], ['map', 'Map', `${D.airports} airports`], ['grid', 'Aircraft', `${D.aircraft} aircraft`],
  ['shield', 'Currency', 'All clear', 'ok'], ['target', 'Milestones', `${D.met} of ${D.reqs}`], ['sun', 'Weather', D.wx], ['dollar', 'Costs', `${D.spent} spent`],
];
const tiles = (n = 8) => `<div class="hub-grid" role="list">${TILES.slice(0, n).map((t) => tile(...t)).join('')}</div>`;
const miniTile = (icon, name, dot = '') => `<a class="hub-m" href="#" data-row aria-label="${name}"><span class="ic">${ico(icon)}</span><span class="nm">${name}</span>${dot ? `<span class="bc-dot ${dot}"></span>` : ''}</a>`;
const miniTiles = `<div class="hub-mini" role="list">${TILES.map(([i, n, , d]) => miniTile(i, n, d)).join('')}</div>`;
// the app's real land outline and projection, with invented placeholder routes between well-known airports (pilot: sky, passenger: violet)
const LAND = JSON.parse(fs.readFileSync(path.join(repo, 'client', 'src', 'lib', 'landOutline.json'), 'utf8'));
const AP = { SUS: [38.66, -90.65], ORD: [41.98, -87.9], DEN: [39.86, -104.67], SFO: [37.62, -122.38], JFK: [40.64, -73.78], MIA: [25.79, -80.29], LHR: [51.47, -0.45], CDG: [49.01, 2.55], DXB: [25.25, 55.36], BOM: [19.09, 72.87] };
const ROUTES = [['SUS', 'ORD', 'p'], ['SUS', 'DEN', 'p'], ['SUS', 'SFO', 'v'], ['SUS', 'JFK', 'v'], ['JFK', 'LHR', 'v'], ['LHR', 'CDG', 'v'], ['SUS', 'MIA', 'v'], ['DXB', 'BOM', 'v'], ['LHR', 'DXB', 'v']];
const mapSvgFor = (W, H) => {
  const pts = Object.values(AP); const project = buildProjection(pts, W, H, { outlierRadiusDeg: Infinity }); const land = buildLandPath(LAND, project);
  const paths = ROUTES.map(([x, y, k]) => { const [x1, y1] = project(AP[x]), [x2, y2] = project(AP[y], AP[x][1]); const my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.18; return `<path class="${k === 'v' ? 'rv' : 'rp'}" d="M${x1} ${y1}Q${(x1 + x2) / 2} ${my} ${x2} ${y2}"/>`; }).join('');
  const dots = pts.map((p) => { const [x, y] = project(p); return `<circle cx="${x}" cy="${y}" r="1.8"/>`; }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect class="sea" width="${W}" height="${H}"/><path class="land" d="${land}"/>${paths}${dots}</svg>`;
};
const map = (tall = false, size = [358, 192]) => `<a class="bc-map ${tall ? 'tall' : ''}" href="#" aria-label="Map: ${D.airports} airports, ${D.countries} countries. Open the map"><div class="ds-map">${mapSvgFor(...size)}</div></a>`;
const mapChips = `<span class="hub-chips"><span>${D.airports} airports</span><span>${D.countries} countries</span></span>`;
const recent = `<div class="bc-items"><p class="hub-h">Recently</p>${[['10/05', 'N222BB', '1.50', 'pilot'], ['10/04', 'N111AA', '1.30', 'pilot'], ['09/28', 'SFO → LHR', '9.80', 'pax']].map(([d, t, h, dot]) => `<a class="bc-item" href="#" data-row><span class="l"><span class="bc-dot ${dot}"></span>${d} ${t}</span><span class="r"><b>${h}</b>${chevR}</span></a>`).join('')}</div>`;

// ---------------------------------------------------------------- the four screens
const A_phone = `<div class="bc">${greet}${hero()}${status}${tiles()}${map(false, [358, 192])}</div>`;
const A_desk = `<div class="bc d"><div class="hub-cols"><div class="hub-l">${greet}${hero()}${status}${tiles()}</div><div class="hub-r">${map(true, [520, 576])}</div></div></div>`;
const B_phone = `<div class="bc"><div class="hub-mapcard">${map(true, [358, 336])}<div class="over">${greet}${hero(true)}</div>${mapChips}</div>${status}${miniTiles}${recent}</div>`;
const B_desk = `<div class="bc d"><div class="hub-cols b"><div class="hub-mapcard big">${map(true, [600, 640])}<div class="over">${greet}${hero(true)}</div>${mapChips}</div><div class="hub-l">${status}${tiles()}${recent}</div></div></div>`;

const figs = (cap, ...f) => `<div class="row">${f.join('')}</div>`;
const cap = (html, c) => html.replace('</figure>', `<figcaption>${c}</figcaption></figure>`).replace(/<figcaption><\/figcaption>/, '');
const aP = cap(phone({ title: 'Home', body: A_phone, tab: 'Home' }), 'A, phone: the hero, one status line, eight module tiles (each one live line), the quiet map last. About 38 words.');
const aD = desk({ tab: 'Home', title: 'Home', body: A_desk, cap: 'A, 1440: tiles four across on the left, the map tall on the right.' });
const bP = cap(phone({ title: 'Home', body: B_phone, tab: 'Home' }), 'B, phone: the map is the top of the page with the hero on it; a compact module row (name only); "Recently" last. About 34 words.');
const bD = desk({ tab: 'Home', title: 'Home', body: B_desk, cap: 'B, 1440: the map large on the left with the hero over it; status, tiles and recent flights on the right.' });

const rules = `<ul class="pt">
<li><b>One screen, one story.</b> Where I stand (the hero), what needs me (one status line), where I can go (module tiles). Nothing else competes.</li>
<li><b>Every tile is a real destination.</b> A module appears on Home only when its page exists: no "Soon" tiles, no dead taps. New modules (airports, airlines, photos, trips, journal) join the grid when they are built; the grid grows by one tile each.</li>
<li><b>One live line per tile, at most four words:</b> the one number or word that tells you whether to open it (flights, airports, "All clear", "Go at KSUS"). Detail lives in the module.</li>
<li><b>Same numbers as everywhere.</b> Every figure comes from the same lib function as its module (Logbook total, Travel total, Costs). Presentation only: no new stored data, no new calculation.</li>
<li><b>Role colour is the only accent.</b> Sky dot = pilot, violet dot = passenger, green/amber dot = status. Tiles are neutral; the hero line is the one bright thing.</li>
<li><b>Solid tiles, no glass.</b> Glass stays on the bars; tiles are surfaces at 104px or more, two across on a phone, four across on desktop, and at most eight (the rest stay in More).</li>
<li><b>Word budget unchanged:</b> at most 45 words on the first screen, at most 4 text sizes, one all-caps label (none here). Both options pass today's calm and word checks on paper; the build is checked with the same scripts.</li>
<li><b>Never lies about scope:</b> "Private Pilot" and Logbook are pilot-only; Travel is passenger-only; the map says "airports" for all roles.</li>
</ul>`;
const compare = `<table class="tbl"><thead><tr><th></th><th>A: Board</th><th>B: Map first</th></tr></thead><tbody>
<tr><td>Feels like</td><td>A dashboard of modules: it reads as a hub at a glance.</td><td>A flight deck: your flying world first, modules second.</td></tr>
<tr><td>Modules on the first screen</td><td>All 8, with a live line each.</td><td>All 8 as a compact row (name only); live lines are one tap away.</td></tr>
<tr><td>Adding the next module</td><td>One more tile; the grid grows to 10 or 12 without redesign.</td><td>One more compact tile; the map stays the star.</td></tr>
<tr><td>Cost</td><td>Low: tiles use the existing rows' data; no new fetch.</td><td>Low: needs the map above the fold, which loads the land outline first (already lazy).</td></tr>
<tr><td>Risk</td><td>Many tiles can feel like a menu; the live line keeps it informative.</td><td>Hero over a map needs the scrim to keep the numerals readable on any backdrop.</td></tr>
</tbody></table>`;

const page = `<!doctype html><html lang="en" data-ds-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>Home hub</title><style>${dsCss}\n${MOCK}\n${APP}\n${HUB}\n.mpg h2.s{font-size:1.5rem;margin:48px 0 8px}.mpg .tbl{width:100%;max-width:60rem;border-collapse:collapse;margin:16px 0;font-size:.9375rem}.mpg .tbl th,.mpg .tbl td{padding:12px;text-align:left;vertical-align:top;line-height:1.45}.mpg .tbl tbody tr:nth-child(odd){background:var(--ds-surface)}.mpg ul.pt{max-width:60rem;line-height:1.55;color:var(--ds-text-2)}.mpg ul.pt b{color:var(--ds-text)}</style></head><body class="ds-root"><div class="pg mpg"><h1 class="t">Home as an aviation hub</h1><p class="lead">Two directions, mockups only (placeholder data, nothing built). <b>Pick A or B</b> (or tell me what to mix) and I build it with the same checks as the rest of the app. Dark only, real tokens and glass, real tab bar and Add button.</p>
<h2 class="s">Hub rules (both options)</h2>${rules}
<h2 class="s">Option A: Board</h2><p class="note">The page is a board of modules. The hero and the status line first, then the tiles, the map as a quiet closing image.</p>${figs('', aP, aD)}
<h2 class="s">Option B: Map first</h2><p class="note">Your flying world (the map) is the top of the page; the hero sits on it. The modules are a compact row; the last flights close the page.</p>${figs('', bP, bD)}
<h2 class="s">Side by side</h2>${compare}</div></body></html>`;
fs.writeFileSync(path.join(here, '..', 'home-hub.html'), page.replace(/\r\n/g, '\n'));
console.log('built docs/design/home-hub.html: 2 options x (phone + desktop), placeholder data only');
