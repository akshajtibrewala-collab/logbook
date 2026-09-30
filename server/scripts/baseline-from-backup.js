// Computes the same baseline verify-baseline.js does, but from an already-taken JSON backup file rather
// than a second live query — for production, where the point is exactly one read (the backup itself),
// never two. Uses the same summarizeFlightData() as verify-baseline.js, so this measures identically;
// the saved output is in the same shape, so verify-baseline.js can diff a *live* database against it
// later (e.g. once TURSO_* points at production) without any special-casing.
//
//   node server/scripts/baseline-from-backup.js <backup.json> <output-baseline.json> [today]
//
// Never touches any database — reads one file, writes another.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { summarizeFlightData } from './verify-baseline.js';

const [backupFile, outFile, todayArg] = process.argv.slice(2);
if (!backupFile || !outFile) {
  throw new Error('Usage: baseline-from-backup.js <backup.json> <output-baseline.json> [today]');
}

// scripts/backup.js's own dump shape: a flat object keyed directly by table name (not the app's
// routes/backup.js export shape, which nests everything under `.tables`) — this reads either.
const raw = JSON.parse(readFileSync(backupFile, 'utf8'));
const tables = raw.tables ?? raw;
const today = todayArg || new Date().toISOString().slice(0, 10);

const baseline = summarizeFlightData({
  flights: tables.flights ?? [],
  reviews: tables.flight_reviews ?? [],
  expirations: tables.expirations ?? [],
  aircraftRows: tables.aircraft ?? [],
  config: [...(tables.milestones_config ?? [])].sort((a, b) => a.certificate.localeCompare(b.certificate) || a.sort_order - b.sort_order),
  completions: tables.milestone_completions ?? [],
}, today);

mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(baseline, null, 2));
console.log(`Saved baseline from ${path.basename(backupFile)} (today=${baseline.today}, ${baseline.flight_count} flights) to ${outFile}`);
