// Contrast model for the Liquid Glass recipe (glass lab v2, direction C).
// A glass bar is "nearly clear" (lo tint) and switches to a higher-tint scrim (hi) when the sampled luminance of the content
// behind it says the lo state would fail AA. Modelled exactly as painted: backdrop -> brightness() -> lo tint -> (hi scrim).
// Sweeps every gray 0..255 as the backdrop. Run: node docs/design/contrast2.mjs
export const G = {
  dark: { lo: [24, 24, 28, 0.10], pop: [12, 12, 16, 0.35], hi: [12, 12, 16, 0.7], bri: 1.06, text: '#FFFFFF', text2: '#EDEDF0', accent: '#7CC8FF', pax: '#C9B8FF', switchUp: 0.08, switchDown: 0.07 },
};
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const over = (c, a, bg) => bg.map((v, i) => c[i] * a + v * (1 - a));
const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

export function stateFor(theme, backdropLum) { // the rule the lab's sampler implements
  const g = G[theme];
  return backdropLum > g.switchUp ? 'hi' : 'lo'; // dark only
}
export function composite(theme, state, gray, kind = 'bar') { // kind 'pop' = menus/sheets (mid-tint floor)
  const g = G[theme]; let c = [gray, gray, gray].map((v) => Math.min(255, v * g.bri));
  const base = kind === 'pop' ? g.pop : g.lo;
  c = over(base.slice(0, 3), base[3], c);
  if (state === 'hi') c = over(g.hi.slice(0, 3), g.hi[3], c);
  return c;
}

export function sweep(missLum = 0, kind = 'bar') { // missLum: extra luminance the sampler failed to see (thin bright features)
  const out = {};
  for (const theme of ['dark']) {
    const g = G[theme]; const worst = {};
    for (let gray = 0; gray <= 255; gray += 1) {
      const st = stateFor(theme, Math.max(0, lum([gray, gray, gray]) - missLum));
      const bg = composite(theme, st, gray, kind);
      for (const [k, min] of [['text', 4.5], ['text2', 4.5], ['accent', 3], ['pax', 3]]) {
        const r = ratio(hex(g[k]), bg);
        if (!worst[k] || r < worst[k].r) worst[k] = { r, gray, st, min };
      }
    }
    out[theme] = worst;
  }
  return out;
}

if (process.argv[1].endsWith('contrast2.mjs')) {
  for (const miss of [0, 0.05]) {
    console.log(miss ? `\nSampler under-reads backdrop luminance by +${miss} (thin bright feature missed):` : 'Sampler exact:');
    const s = sweep(miss);
    for (const th of ['dark']) console.log(th, Object.entries(s[th]).map(([k, v]) => `${k} min ${v.r.toFixed(2)} (needs ${v.min}) at gray ${v.gray} [${v.st}]${v.r < v.min ? ' FAIL' : ''}`).join(' | '));
  }
  for (const miss of [0, 0.05]) { const s = sweep(miss, 'pop'); console.log(`
menus/sheets (mid-tint floor), sampler ${miss ? 'under-reads by ' + miss : 'exact'}:`); console.log('dark', Object.entries(s.dark).map(([k, v]) => `${k} min ${v.r.toFixed(2)} (needs ${v.min}) at gray ${v.gray} [${v.st}]${v.r < v.min ? ' FAIL' : ''}`).join(' | ')); }
  // Forced hi (sheets, menus, popovers) over every backdrop.
  for (const th of ['dark']) {
    let mt = 99, m2 = 99, ma = 99;
    for (let gr = 0; gr <= 255; gr++) { const bg = composite(th, 'hi', gr); mt = Math.min(mt, ratio(hex(G[th].text), bg)); m2 = Math.min(m2, ratio(hex(G[th].text2), bg)); ma = Math.min(ma, ratio(hex(G[th].accent), bg)); }
    console.log(`forced hi ${th}: text ${mt.toFixed(2)} text2 ${m2.toFixed(2)} accent ${ma.toFixed(2)}`);
  }
}
