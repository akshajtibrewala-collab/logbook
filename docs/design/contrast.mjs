// Measured WCAG contrast. Glass is modelled as its tint composited over the (blur-averaged) backdrop; a
// backdrop is the extreme of what can scroll behind a bar. Run: node docs/design/contrast.mjs [--json]
import { directions, backdrops } from './tokens.mjs';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgba = (s) => { const m = s.match(/[\d.]+/g).map(Number); return { c: m.slice(0, 3), a: m[3] ?? 1 }; };
const over = (fg, a, bg) => fg.map((v, i) => v * a + bg[i] * (1 - a));
const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

export function measure() {
  const rows = [];
  for (const [key, d] of Object.entries(directions)) {
    for (const [theme, t] of Object.entries(d.theme)) {
      const g = t.glass; const tint = rgba(g.tint);
      const pairs = [['text', g.text, 4.5], ['secondary text', g.text2, 4.5], ['accent icon/pill (non-text)', g.accent, 3], ['passenger accent (non-text)', g.accentPax, 3]];
      for (const [bn, bh] of Object.entries(backdrops)) {
        const bg = over(tint.c, tint.a, hex(bh));
        for (const [label, fg, min] of pairs) rows.push({ dir: key, theme, backdrop: bn, label, ratio: ratio(hex(fg), bg), min });
      }
      for (const [sn, sv] of [['page', t.bg], ['surface', t.s1], ['raised', t.s2]]) {
        for (const [label, fg] of [['text', t.text], ['secondary', t.text2], ['tertiary', t.text3], ['sky text', t.sky], ['violet text', t.violet], ['ok text', t.ok], ['warn text', t.warn], ['bad text', t.bad]])
          rows.push({ dir: key, theme, backdrop: `solid ${sn}`, label, ratio: ratio(hex(fg), hex(sv)), min: 4.5 });
      }
    }
  }
  return rows;
}

if (process.argv[1].endsWith('contrast.mjs')) {
  const rows = measure();
  const fails = rows.filter((r) => r.ratio < r.min);
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows));
  else {
    for (const f of fails) console.log(`FAIL ${f.dir}/${f.theme} ${f.backdrop} ${f.label}: ${f.ratio.toFixed(2)} < ${f.min}`);
    console.log(`${rows.length} pairs measured, ${fails.length} below target`);
    const glass = rows.filter((r) => !r.backdrop.startsWith('solid'));
    for (const k of Object.keys(directions)) for (const th of ['dark', 'light']) {
      const mins = {};
      glass.filter((r) => r.dir === k && r.theme === th).forEach((r) => { mins[r.label] = Math.min(mins[r.label] ?? 99, r.ratio); });
      console.log(k, th, 'worst glass:', Object.entries(mins).map(([l, v]) => `${l} ${v.toFixed(2)}`).join(' | '));
    }
  }
}
