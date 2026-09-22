import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'schema.sql');

/**
 * Baseline migration: brings any database — a brand-new one, or one that predates this migrations
 * system entirely — up to the schema this app shipped with before migrations were tracked. It reproduces
 * exactly what the old, untracked migrate() used to do, so it is a safe no-op catch-up for the databases
 * already running in production (your local file and Turso). Every schema change after this one ships as
 * its own new numbered migration instead of editing this file.
 */
export default async function up({ all, run, client }) {
  // The airports table was reshaped early on (ident primary key + local codes). It is pure reference
  // data that gets re-seeded from OurAirports, so an old-shaped table is dropped rather than migrated.
  const airportCols = await all("SELECT name FROM pragma_table_info('airports')");
  if (airportCols.length && !airportCols.some((c) => c.name === 'ident')) await run('DROP TABLE airports');

  await client.executeMultiple(readFileSync(schemaPath, 'utf8'));

  // Older databases predate these two flights columns.
  const flightCols = await all("SELECT name FROM pragma_table_info('flights')");
  for (const col of ['route', 'airline']) {
    if (!flightCols.some((c) => c.name === col)) await run(`ALTER TABLE flights ADD COLUMN ${col} TEXT`);
  }
}
