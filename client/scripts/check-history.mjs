// HISTORY SCAN (read-only, reports only; never rewrites anything). Walks `git log -p` and reports every commit and file whose ADDED lines contain the pilot's real
// values from the private local config (client/scripts/.local-expected.json): figures, instructor names, tail numbers, references, flight counts. It prints the commit,
// the file and the KIND of value, never the value itself.
//
//   node client/scripts/check-history.mjs --range main..HEAD                 every commit on the branch that main does not have
//   node client/scripts/check-history.mjs --refs origin/*  [--exclude main]  every remote branch: its commits not already in --exclude (default origin/main), per branch
//   node client/scripts/check-history.mjs --refs origin/main                 the full history of main (listed for the record)
// Exit code 1 when --range finds anything (so it can gate a push of that range); --refs always exits 0 (it is a report).
import { execFileSync } from 'node:child_process';
import { loadLocalExpected } from './lib/localExpected.mjs';
import { makeMatcher } from './lib/scrubMatch.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const cfg = loadLocalExpected();
if (!cfg || !Array.isArray(cfg.forbidden)) { console.log('No client/scripts/.local-expected.json: nothing to scan against.'); process.exit(0); }
const hit = makeMatcher(cfg);
const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'] });
const SKIP = /(^|\/)(package-lock\.json|landOutline\.json)$/;

function scan(rangeArgs) {
  const out = git(['log', '-p', '-U0', '--no-color', '--no-merges', '--format=@@C %h %s', ...rangeArgs, '--', '.', ':!package-lock.json', ':!client/src/lib/landOutline.json']);
  const commits = []; let cur = null, file = '';
  for (const l of out.split('\n')) {
    if (l.startsWith('@@C ')) { cur = { id: l.slice(4, 11), subject: l.slice(12), files: new Map() }; commits.push(cur); continue; }
    if (l.startsWith('+++ ')) { file = l.slice(6); continue; }
    if (!cur || !l.startsWith('+') || l.startsWith('+++') || SKIP.test(file)) continue;
    const kinds = hit(l.slice(1)); if (!kinds.length) continue;
    const f = cur.files.get(file) || new Set(); kinds.forEach((k) => f.add(k)); cur.files.set(file, f);
  }
  return commits.filter((c) => c.files.size);
}
const show = (list) => { for (const c of list) { console.log(`  ${c.id}  ${c.subject.slice(0, 80)}`); for (const [f, k] of c.files) console.log(`      ${f}  [${[...k].join(', ')}]`); } };

const range = arg('--range', '');
if (range) {
  const list = scan([range]); const total = Number(git(['rev-list', '--count', '--no-merges', range]).trim());
  console.log(`${range}: ${total} commits scanned, ${list.length} contain real values (added lines):`); show(list);
  process.exit(list.length ? 1 : 0);
}
const refs = arg('--refs', '');
if (refs) {
  const exclude = arg('--exclude', 'origin/main');
  const names = git(['for-each-ref', '--format=%(refname:short)', refs.includes('*') ? 'refs/remotes/origin' : `refs/remotes/${refs}`]).split('\n').filter((n) => n && !/\/HEAD$/.test(n));
  for (const r of names) {
    const rangeArgs = r === exclude || /main$/.test(r) ? [r] : [r, `^${exclude}`];
    const total = Number(git(['rev-list', '--count', '--no-merges', ...rangeArgs]).trim());
    const list = scan(rangeArgs);
    console.log(`\n${r}${r === exclude ? ' (full history)' : ` (commits not on ${exclude})`}: ${total} commits scanned, ${list.length} contain real values`); show(list);
  }
  process.exit(0);
}
console.error('Pass --range <a..b> or --refs origin/*'); process.exit(2);
