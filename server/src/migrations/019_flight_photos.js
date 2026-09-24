/**
 * Photos attached to a flight. Stored in the database (as a base64 data URL of an already client-side
 * compressed JPEG, a few hundred KB at most) rather than on local disk, because Vercel's serverless
 * filesystem is read-only — the same table works on local SQLite and on Turso with no extra service or
 * env var. Deliberately not part of the JSON backup (see routes/backup.js): the weekly backup email
 * would balloon. Deleted with their flight (explicitly, in routes/flights.js).
 */
export default async function up({ client }) {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS flight_photos (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      flight_id  INTEGER NOT NULL,
      data_url   TEXT NOT NULL,
      width      INTEGER,
      height     INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_flight_photos_flight ON flight_photos(flight_id);
  `);
}
