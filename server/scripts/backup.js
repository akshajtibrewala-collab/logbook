// Dumps every table in the configured database (local file or Turso, whichever DB_FILE/TURSO_* currently
// point at — see server/src/db.js) to a timestamped JSON file. Read-only: never writes to the database.
//   npm run db:backup -w server            backs up whichever DB_FILE/.env currently point at
// Run this before any schema/migration change touches Turso. To restore, the JSON is human-readable and
// each table's rows can be re-inserted by hand or with a small script; there's no one-command restore
// yet, since a backup you actually have always beats a restore you don't.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { all, isRemote } from '../src/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '..', 'backups');
mkdirSync(outDir, { recursive: true });

const TABLES = ['flights', 'flight_stops', 'flight_reviews', 'aircraft', '_migrations']; // airports is re-seedable reference data, skipped

const dump = {};
for (const table of TABLES) {
  try {
    dump[table] = await all(`SELECT * FROM ${table}`);
  } catch {
    dump[table] = null; // table doesn't exist yet on this database (e.g. an older schema) — note it, don't fail
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const file = path.join(outDir, `backup-${isRemote ? 'turso' : 'local'}-${stamp}.json`);
writeFileSync(file, JSON.stringify(dump, null, 2));

const counts = Object.entries(dump).map(([t, rows]) => `${t}: ${rows ? rows.length : 'n/a'}`).join(', ');
console.log(`Backed up ${isRemote ? 'Turso' : 'the local database'} to ${file}\n(${counts})`);
