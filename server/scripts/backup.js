// Dumps every table in the configured database (local file or Turso, whichever DB_FILE/TURSO_* currently
// point at — see server/src/db.js and "Pointing this at Turso vs local" below) to a timestamped JSON
// file. Read-only: never writes to the database. The table list is read from sqlite_master at run time,
// not hardcoded, so a table added by a future migration is backed up automatically without editing this
// file — including reference data (airports) and the migrations ledger (_migrations).
//
// Run this before any schema/migration change touches Turso.
//
//   npm run db:backup                       Turso, IF ../.env has TURSO_DATABASE_URL/TURSO_AUTH_TOKEN set
//                                            (this repo's existing convention: migrate/seed/db:setup all
//                                            auto-load ../.env the same way — see docs/DEPLOY.md)
//   node server/scripts/backup.js            the LOCAL file (server/logbook.db, or $DB_FILE) — run
//                                            directly with plain `node`, NOT the npm script, so ../.env
//                                            is never loaded and TURSO_DATABASE_URL can't be picked up
//
// To restore: the JSON is one row array per table, human-readable, and can be re-inserted by hand or
// with a small script. There's no one-command restore yet — a backup you actually have always beats a
// restore you don't.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { all, isRemote } from '../src/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '..', 'backups');
mkdirSync(outDir, { recursive: true });

const tables = (await all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"))
  .map((t) => t.name)
  .sort();

const dump = {};
for (const table of tables) dump[table] = await all(`SELECT * FROM "${table}"`);

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const file = path.join(outDir, `backup-${isRemote ? 'turso' : 'local'}-${stamp}.json`);
writeFileSync(file, JSON.stringify(dump, null, 2));

const counts = Object.entries(dump).map(([t, rows]) => `${t}: ${rows.length}`).join(', ');
console.log(`Backed up ${isRemote ? 'Turso' : 'the local database'} (${tables.length} tables) to ${file}\n(${counts})`);
