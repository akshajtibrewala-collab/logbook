/**
 * Adds `flight_stops`: an ordered list of intermediate airports for a flight (between departure and
 * arrival), each flagged full-stop or touch-and-go — replacing the flat, order-only `route` text column
 * as the structured source going forward. `flights.route` is left exactly as it is and kept in sync by
 * the flights route handler from here on (so the Logbook list, Map and Stats, which all read it, keep
 * working unchanged); it is not rewritten by this migration.
 *
 * Backfill: every flight with a non-empty `route` gets one flight_stops row per airport already listed
 * there, defaulted to **full_stop**. That default is a real, disclosed guess, not a fact: `route` never
 * recorded whether a stop was a full stop or a touch-and-go, so there's no way to know from the existing
 * data. Full-stop was chosen because a bare "via" airport, entered as free text on a cross-country before
 * this feature existed, most often means an actual stop (fuel, a break) rather than a pattern touch-and-
 * go — but every affected flight should be checked and corrected if that guess is wrong, since full-stop
 * landings matter for cross-country requirements. See the migration/deploy notes for the exact list this
 * produced against the real database.
 */
export default async function up({ all, run, client }) {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS flight_stops (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      flight_id     INTEGER NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
      sequence      INTEGER NOT NULL,
      airport_code  TEXT NOT NULL,
      stop_type     TEXT NOT NULL DEFAULT 'full_stop' CHECK (stop_type IN ('full_stop', 'touch_and_go')),
      UNIQUE (flight_id, sequence)
    );
    CREATE INDEX IF NOT EXISTS idx_flight_stops_flight ON flight_stops(flight_id);
  `);

  // Mirrors the token rules in client/src/lib/flightpath.js's routeTokens: split on whitespace/,;>/- and
  // keep only plausible 3-4 character airport codes (drops airway/fix names that occasionally slipped in).
  const tokenize = (route) => route.toUpperCase().split(/[\s,;>/-]+/).filter((t) => /^[A-Z0-9]{3,4}$/.test(t));

  const flights = await all("SELECT id, route FROM flights WHERE route IS NOT NULL AND trim(route) != ''");
  for (const f of flights) {
    const tokens = tokenize(f.route);
    if (!tokens.length) continue;
    const existing = await all('SELECT 1 FROM flight_stops WHERE flight_id = ?', [f.id]);
    if (existing.length) continue; // already backfilled (e.g. migrate() run again)
    for (let i = 0; i < tokens.length; i++) {
      await run('INSERT INTO flight_stops (flight_id, sequence, airport_code, stop_type) VALUES (?, ?, ?, ?)', [f.id, i, tokens[i], 'full_stop']);
    }
  }
}
