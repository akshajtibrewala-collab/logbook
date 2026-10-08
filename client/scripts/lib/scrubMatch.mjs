// The matching rules shared by check-scrub.mjs (what this branch added) and check-history.mjs (every commit): which strings from the PRIVATE local config
// (client/scripts/.local-expected.json) count as "real values", and how a line is tested. A figure only matches as a standalone number (not glued to other
// digits or signs), and very long lines (SVG path data) only where the figure sits in prose or markup. Nothing here ever prints a value.
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const numeric = (v) => /^[\d,.]+$/.test(v);

export function makeMatcher(cfg) {
  const matchers = [
    ...cfg.forbidden.map((v) => ({ v, num: numeric(v), kind: numeric(v) ? 'figure' : 'name/tail/reference', re: new RegExp(numeric(v) ? `(?<![\\d.,\\-])${esc(v)}(?![\\d]|[.,]\\d)` : esc(v), 'i') })),
    ...(cfg.forbiddenRegex || []).map((r) => ({ v: `/${r}/`, num: false, kind: 'count', re: new RegExp(r, 'i') })),
  ];
  /** The kinds of real value found on one line ('figure', 'name/tail/reference', 'count'); empty when none. */
  return (line) => {
    const found = new Set(); const long = line.length > 800;
    for (const m of matchers) {
      const x = m.re.exec(line); if (!x) continue;
      if (long && m.num) {
        const i = x.index, pre = line[i - 1] || '', post = line.slice(i + x[0].length, i + x[0].length + 10);
        if (!((pre === '>' && /^</.test(post)) || (pre === ' ' && /^ ?(hours|h\b|flights|nm)/.test(post)))) continue;
      }
      found.add(m.kind);
    }
    return [...found];
  };
}
