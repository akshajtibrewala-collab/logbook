// One-time copy of your existing local logbook (flights + flight reviews) into Turso.
//   npm run db:copy-local:prod -w server              reads server/logbook.db, writes to production
//                                                      Turso, loading .env.production (docs/DEPLOY.md)
//   npm run db:copy-local:prod -w server -- path.db    reads a different local file instead
// Needs TURSO_DATABASE_URL and TURSO_AUTH_TOKEN — this only ever makes sense against Turso, so there is
// no local-only variant. The local file is only read, never changed. Refuses to run if the Turso
// database already has flights, so it can't create duplicates.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { client as target, isRemote } from '../src/db.js';
import { migrate } from '../src/migrate.js';

if (!isRemote) {
  console.error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN first (see .env.example). Nothing was copied.');
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(process.argv[2] ?? path.join(here, '..', 'logbook.db')).split(path.sep).join('/');
const source = createClient({ url: `file:${sourcePath}` });

await migrate();

const existing = Number((await target.execute('SELECT COUNT(*) AS n FROM flights')).rows[0][0]);
if (existing > 0) {
  console.error(`The Turso database already has ${existing} flights. Not copying, to avoid duplicates.`);
  process.exit(1);
}

async function copyTable(table) {
  const rs = await source.execute(`SELECT * FROM ${table} ORDER BY id`);
  if (!rs.rows.length) return 0;
  const sql = `INSERT INTO ${table} (${rs.columns.join(',')}) VALUES (${rs.columns.map(() => '?').join(',')})`;
  const statements = rs.rows.map((row) => ({ sql, args: rs.columns.map((_, i) => row[i]) }));
  for (let i = 0; i < statements.length; i += 200) await target.batch(statements.slice(i, i + 200), 'write');
  return rs.rows.length;
}

console.log(`Copying from ${sourcePath} ...`);
const flights = await copyTable('flights');
const reviews = await copyTable('flight_reviews');
console.log(`Copied ${flights} flights and ${reviews} flight reviews to Turso.`);
