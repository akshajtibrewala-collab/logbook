import path from 'node:path';
import { fileURLToPath } from 'node:url';

// One database layer for every environment (libSQL is SQLite-compatible):
//   * TURSO_DATABASE_URL set  -> the hosted Turso database (production). Uses the fetch-based web client,
//                                so there is no native code to build or bundle on serverless hosts.
//   * otherwise               -> a local SQLite file (server/logbook.db, or DB_FILE; ":memory:" in tests).
const here = path.dirname(fileURLToPath(import.meta.url));

function connection() {
  const remote = process.env.TURSO_DATABASE_URL;
  if (remote) {
    return { remote: true, url: remote.replace(/^libsql:/, 'https:'), authToken: process.env.TURSO_AUTH_TOKEN };
  }
  const file = process.env.DB_FILE || path.join(here, '..', 'logbook.db');
  return { remote: false, url: file === ':memory:' ? ':memory:' : `file:${file.split(path.sep).join('/')}` };
}

const conn = connection();
const { createClient } = conn.remote ? await import('@libsql/client/web') : await import('@libsql/client');

export const client = createClient({ url: conn.url, authToken: conn.authToken });
export const isRemote = conn.remote;

// libSQL rows are array-like; plain objects are what the routes want to send as JSON.
const toObjects = (rs) => rs.rows.map((row) => Object.fromEntries(rs.columns.map((name, i) => [name, row[i]])));
const stmt = (s) => (typeof s === 'string' ? { sql: s } : s);

/** Rows as plain objects. `args` is an array (for ?) or an object (for :name). */
export async function all(sql, args = []) {
  return toObjects(await client.execute({ sql, args }));
}

export async function get(sql, args = []) {
  return (await all(sql, args))[0];
}

/** For INSERT/UPDATE/DELETE: { changes, lastId }. */
export async function run(sql, args = []) {
  const rs = await client.execute({ sql, args });
  return { changes: rs.rowsAffected, lastId: rs.lastInsertRowid == null ? null : Number(rs.lastInsertRowid) };
}

/** Several read queries in one round trip; resolves to an array of row arrays. */
export async function batchAll(statements) {
  return (await client.batch(statements.map(stmt), 'read')).map(toObjects);
}

/** Several writes in one round trip, atomically (all or nothing). */
export async function batchRun(statements) {
  return client.batch(statements.map(stmt), 'write');
}
