// Builds lab2.html (glass lab v2: the Liquid Glass recipe on direction C) from lab2.src.html + contrast2.mjs tokens.
// Run: node docs/design/lab2.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { G } from './contrast2.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const land = JSON.parse(readFileSync(join(here, '../../client/src/lib/landOutline.json'), 'utf8'));
const rgba = ([r, g, b, a]) => `rgba(${r},${g},${b},${a})`;

const JFK = [-73.8, 40.6], LHR = [-0.5, 51.5], DXB = [55.4, 25.2], SIN = [103.99, 1.36], SFO = [-122.4, 37.6], NRT = [140.4, 35.8], LAX = [-118.4, 33.9], FRA = [8.6, 50.0], SUS = [-90.65, 38.66];
const ROUTES = [[JFK, LHR, 1], [LHR, DXB, 1], [DXB, SIN, 1], [SFO, NRT, 1], [LAX, JFK, 1], [FRA, JFK, 1], [SUS, [-88.2, 41.8]], [SUS, [-86.3, 39.7]]];
function mapSvg(w, h) {
  const X = (lon) => ((lon + 180) / 360) * w, Y = (lat) => ((78 - lat) / 138) * h;
  const d = land.map((r) => { let s = ''; for (let i = 0; i < r.length; i += 2) s += `${i ? 'L' : 'M'}${X(r[i]).toFixed(1)} ${Y(r[i + 1]).toFixed(1)}`; return s + 'Z'; }).join('');
  const arcs = ROUTES.map(([a, b, pax]) => { const [x1, y1, x2, y2] = [X(a[0]), Y(a[1]), X(b[0]), Y(b[1])]; const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.22;
    return `<path class="${pax ? 'rv' : 'rp'}" d="M${x1.toFixed(1)} ${y1.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}"/><circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="2"/><circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="2"/>`; }).join('');
  return `<svg class="map" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect class="sea" width="${w}" height="${h}"/><path class="land" d="${d}"/>${arcs}</svg>`;
}

const t = (th) => {
  const g = G[th], dark = th === 'dark';
  return `.t-${th} { color-scheme: ${th}; --bg:${dark ? '#000' : '#fff'}; --bg-rgb:${dark ? '0 0 0' : '255 255 255'}; --s1:${dark ? '#0A0A0B' : '#F4F4F6'}; --s2:${dark ? '#151517' : '#E9E9ED'};
  --hair:${dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.12)'}; --text:${dark ? '#F5F5F7' : '#0B0B0D'}; --text2:${dark ? '#A1A1AA' : '#55555D'};
  --sky:${dark ? '#5BB9FF' : '#0A66B8'}; --violet:${dark ? '#B7A0FF' : '#6A3FD0'}; --ok:${dark ? '#3DD68C' : '#0A6B35'}; --on:${dark ? '#001A2E' : '#FFFFFF'};
  --land:${dark ? '#1D2128' : '#D9DFE6'}; --sea:${dark ? '#0A1522' : '#EEF2F6'};
  --tint-lo:${rgba(g.lo)}; --tint-hi:${rgba(g.hi)}; --bri:${g.bri}; --sat:1.9; --g-text:${g.text}; --g-text2:${g.text2}; --g-accent:${g.accent}; --g-pax:${g.pax};
  --rim-a:${dark ? 'rgba(255,255,255,.42)' : 'rgba(255,255,255,.95)'}; --rim-b:${dark ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.7)'}; --glow:${dark ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.55)'};
  --hair-out:${dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.10)'}; --lite:${dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.06)'}; --lens-fill:${dark ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.18)'}; --bleed:rgba(0,0,0,.4);
  --rim-grad:${dark
    ? 'linear-gradient(135deg, rgba(255,255,255,.95), rgba(255,255,255,.16) 28%, rgba(255,255,255,.04) 52%, rgba(255,255,255,.2) 76%, rgba(255,255,255,.7))'
    : 'linear-gradient(135deg, rgba(255,255,255,1), rgba(255,255,255,.55) 28%, rgba(0,0,0,.07) 54%, rgba(255,255,255,.75) 80%, rgba(255,255,255,1))'}; }`;
};
const tokens = `${t('dark')}\nbody { --lens: 9px; --blur: 6px; --ins: 9px; } body.v1 { --blur: 8px; --ins: 0px; }`;

const gjson = JSON.stringify({ dark: { up: G.dark.switchUp, down: G.dark.switchDown } }); // dark only
const out = readFileSync(join(here, 'lab2.src.html'), 'utf8')
  .replace('/*TOKENS*/', tokens).replace('/*MAPHERO*/', mapSvg(800, 420)).replace('/*MAPFULL*/', mapSvg(800, 1000)).replace('/*GJSON*/', gjson);
writeFileSync(join(here, 'lab2.html'), out);
console.log('built lab2.html');
