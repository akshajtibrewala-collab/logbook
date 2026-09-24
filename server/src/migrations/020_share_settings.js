/**
 * The single read-only public share link (one row, id = 1). `token` is an unguessable random string;
 * revoking sets enabled = 0, regenerating replaces the token (which invalidates every old link).
 * The show_* flags decide what the public summary may include. Not part of the JSON backup: restoring an
 * old backup must never silently revive a link that has since been revoked or regenerated.
 */
export default async function up({ client }) {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS share_settings (
      id                 INTEGER PRIMARY KEY CHECK (id = 1),
      token              TEXT NOT NULL,
      enabled            INTEGER NOT NULL DEFAULT 1,
      show_notes         INTEGER NOT NULL DEFAULT 0,
      show_photos        INTEGER NOT NULL DEFAULT 0,
      show_recent_flights INTEGER NOT NULL DEFAULT 1,
      show_aircraft      INTEGER NOT NULL DEFAULT 1,
      created_at         TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}
