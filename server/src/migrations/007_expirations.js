/**
 * Adds `expirations`: general personal expiration-tracked items (medical certificate, passport, renter's
 * insurance, whatever else you add later). Deliberately NOT a fixed set of named columns on a singleton
 * settings row — a new kind of expiring thing is a new row, not a new migration. Flight review currency
 * keeps living in the existing flight_reviews table (it has real history semantics: every past review
 * date matters), which this table doesn't try to replace; a medical certificate is different — there's
 * only ever one *current* expiry that matters, so it's a simple dated item, one row per kind.
 */
export default async function up({ client }) {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS expirations (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      kind         TEXT NOT NULL,            -- 'medical' | 'custom' | ... (free text; 'medical' is the only one the app treats specially)
      label        TEXT NOT NULL,            -- display name, e.g. "3rd Class Medical", "Passport"
      issued_date  TEXT,
      expires_date TEXT NOT NULL,
      notes        TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_expirations_kind ON expirations(kind);
  `);
}
