import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { all, client, run } from './db.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Brings the database up to date. Safe to run any number of times.
 * Run at build/deploy time (npm run migrate) and on local startup; the hosted API never runs it.
 */
export async function migrate() {
  // The airports table was reshaped (ident primary key + local codes). It is reference data that
  // gets re-seeded, so an old-shaped table is dropped rather than migrated.
  const airportCols = await all("SELECT name FROM pragma_table_info('airports')");
  if (airportCols.length && !airportCols.some((c) => c.name === 'ident')) await run('DROP TABLE airports');

  await client.executeMultiple(readFileSync(path.join(here, 'schema.sql'), 'utf8'));

  // Older databases predate these flights columns.
  const flightCols = await all("SELECT name FROM pragma_table_info('flights')");
  for (const col of ['route', 'airline']) {
    if (!flightCols.some((c) => c.name === col)) await run(`ALTER TABLE flights ADD COLUMN ${col} TEXT`);
  }
}
