// Recomputes the hours/landings/currency/milestone numbers a schema or data change must NOT affect, and
// diffs them against a saved baseline snapshot. Read-only: never writes to the database.
//
//   node server/scripts/verify-baseline.js --save server/backups/baseline-2026-09-30.json
//       Writes a fresh baseline from the current database.
//
//   node server/scripts/verify-baseline.js server/backups/baseline-2026-09-30.json
//       Recomputes and diffs against an existing baseline. Exits 1 (and prints every differing path) if
//       anything changed, exits 0 with "No differences" otherwise.
//
// Reuses the app's own client/src/lib/currency.js and client/src/lib/milestones.js rather than
// reimplementing their logic here, so this measures exactly what the UI shows — not a separate
// approximation of it that could quietly drift from a real regression. Currency results depend on
// "today" (days-remaining, expiring windows), so a saved baseline records the date it was computed with
// and every later diff recomputes against that *same* date — otherwise simply running this a day later
// would report a false difference from time passing, not from any real change.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { all } from '../src/db.js';
import {
  dayCurrency, nightCurrency, instrumentCurrency, flightReviewStatus, medicalCurrency, summarize,
} from '../../client/src/lib/currency.js';
import {
  computeMilestones, certificateSummary, completionsByKey, certificateLabel,
} from '../../client/src/lib/milestones.js';

const TIME_COLUMNS = [
  'total_time', 'pic_time', 'sic_time', 'dual_received', 'dual_given', 'solo_time', 'simulator_time',
  'night_time', 'instrument_actual', 'instrument_simulated', 'cross_country_time', 'ground_time',
];
const COUNT_COLUMNS = [
  'day_landings', 'day_landings_full_stop', 'night_landings', 'night_landings_full_stop', 'approaches', 'holds',
];
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * The actual number-crunching, given plain arrays already in hand — never fetches anything itself, so
 * it works identically whether those arrays came from a live `all()` query (computeBaseline, below) or
 * from an already-taken JSON backup file (baseline-from-backup.js), which matters when you want a
 * production baseline without a second live round trip to production.
 */
export function summarizeFlightData({ flights, reviews, expirations, aircraftRows, config, completions }, today) {
  const aircraftById = Object.fromEntries(aircraftRows.map((a) => [a.id, a]));
  const completionsIndex = completionsByKey(completions);

  const sum = (col) => round2(flights.reduce((s, f) => s + (Number(f[col]) || 0), 0));
  const totals = Object.fromEntries([...TIME_COLUMNS, ...COUNT_COLUMNS].map((c) => [c, sum(c)]));

  const milestones = {};
  for (const [cert, reqs] of computeMilestones(config, flights, aircraftById, completionsIndex)) {
    milestones[cert] = { label: certificateLabel(cert), ...certificateSummary(reqs) };
  }

  return {
    today,
    flight_count: flights.length,
    totals,
    currency: {
      day_passenger: dayCurrency(flights, today),
      night_passenger: nightCurrency(flights, today),
      instrument: instrumentCurrency(flights, today),
      flight_review: flightReviewStatus(reviews, today),
      medical: medicalCurrency(expirations, today),
      hours_summary: summarize(flights, today),
    },
    milestones,
  };
}

export async function computeBaseline(today = new Date().toISOString().slice(0, 10)) {
  const flights = await all('SELECT * FROM flights');
  const reviews = await all('SELECT * FROM flight_reviews');
  const expirations = await all('SELECT * FROM expirations');
  const aircraftRows = await all('SELECT * FROM aircraft');
  const config = await all('SELECT * FROM milestones_config ORDER BY certificate, sort_order');
  const completions = await all('SELECT * FROM milestone_completions');
  return summarizeFlightData({ flights, reviews, expirations, aircraftRows, config, completions }, today);
}

/** Every path where two plain-JSON-shaped values differ, e.g. "totals.night_time" or "milestones.private.metCount". */
function diffPaths(a, b, prefix = '') {
  if (a === b) return [];
  const bothObjects = a && b && typeof a === 'object' && typeof b === 'object';
  if (!bothObjects) return [`${prefix} : ${JSON.stringify(a)} -> ${JSON.stringify(b)}`];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const diffs = [];
  for (const key of keys) {
    diffs.push(...diffPaths(a[key], b[key], prefix ? `${prefix}.${key}` : key));
  }
  return diffs;
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--save') {
    const file = args[1];
    if (!file) throw new Error('Usage: verify-baseline.js --save <path>');
    const baseline = await computeBaseline();
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(baseline, null, 2));
    console.log(`Saved baseline (today=${baseline.today}, ${baseline.flight_count} flights) to ${file}`);
    return;
  }

  const file = args[0];
  if (!file) throw new Error('Usage: verify-baseline.js <path-to-baseline.json>  (or --save <path>)');
  const saved = JSON.parse(readFileSync(file, 'utf8'));
  const current = await computeBaseline(saved.today);
  const diffs = diffPaths(saved, current);
  if (diffs.length === 0) {
    console.log(`No differences from ${path.basename(file)} (recomputed as of its own reference date ${saved.today}).`);
  } else {
    console.log(`${diffs.length} difference(s) from ${path.basename(file)} (recomputed as of its own reference date ${saved.today}):`);
    for (const d of diffs) console.log(`  ${d}`);
    process.exitCode = 1;
  }
}

if (path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  await main();
}
