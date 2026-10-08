// SCRUB CHECK. No tracked file on this branch may contain the pilot's real figures, instructor names, tail numbers or invoice references. The strings to look for
// are read from the private, untracked config (client/scripts/.local-expected.json: "forbidden" and "forbiddenRegex"), so the repository itself never holds them.
//
//   node client/scripts/check-scrub.mjs [--base main] [--list-main]
//
// It scans the lines this branch ADDED relative to the base (git diff <base>, tracked files, working tree included). Values that were already on main are
// not scanned (history is never rewritten); `--list-main` prints exactly where those still are (file:line), for the record. A figure is matched only as a
// standalone number (not inside a longer number or path data such as "L12.5 3.2"), and very long lines (SVG path data) only where it sits in prose or markup.
// Without the private config the check says so and exits 0 (nothing can be checked), so it never breaks a fresh clone.
import { execFileSync } from 'node:child_process';
import { loadLocalExpected } from './lib/localExpected.mjs';
import { makeMatcher } from './lib/scrubMatch.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'main');
const cfg = loadLocalExpected();
if (!cfg || !Array.isArray(cfg.forbidden)) { console.log('No client/scripts/.local-expected.json: nothing to check against (the private config is not on this machine).'); process.exit(0); }

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
const SKIP = /(^|\/)(package-lock\.json|landOutline\.json)$/;
const hit = makeMatcher(cfg); // the shared rules (lib/scrubMatch.mjs); returns the kinds of real value on a line, never the value

// 1. what this branch added
const diff = git(['diff', BASE, '-U0', '--no-color', '--', '.', ':!package-lock.json', ':!client/src/lib/landOutline.json']);
let file = '', lineNo = 0; const bad = [];
for (const l of diff.split('\n')) {
  if (l.startsWith('+++ ')) { file = l.slice(6); continue; }
  const h = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(l); if (h) { lineNo = Number(h[1]) - 1; continue; }
  if (l.startsWith('+') && !l.startsWith('+++')) { lineNo += 1; if (SKIP.test(file)) continue; const f = hit(l.slice(1)); if (f.length) bad.push(`${file}:${lineNo}  ${f.join(', ')}`); }
}

// 2. what is already on main (listed, never failed)
if (process.argv.includes('--list-main')) {
  const files = git(['ls-tree', '-r', '--name-only', BASE]).split('\n').filter((f) => f && !SKIP.test(f));
  console.log(`Already on ${BASE} (not scanned as failures, listed for the record):`);
  for (const f of files) {
    let text; try { text = git(['show', `${BASE}:${f}`]); } catch { continue; }
    if (text.includes('\u0000')) continue;
    text.split('\n').forEach((line, i) => { const found = hit(line); if (found.length) console.log(`  ${f}:${i + 1}  ${line.trim().slice(0, 110)}`); });
  }
}

if (bad.length) { console.log(`\n${bad.length} line(s) added on this branch contain real values (nothing printed here that is private):\n - ${bad.slice(0, 60).join('\n - ')}`); process.exit(1); }
console.log(`No real figures, names, tails or references in anything this branch added (scanned against ${BASE}, ${cfg.forbidden.length} strings + ${(cfg.forbiddenRegex || []).length} patterns from the private config).`);
