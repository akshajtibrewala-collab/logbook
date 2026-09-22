/**
 * Adds a real `aircraft` table (also used for simulators/training devices — see is_simulator) and links
 * `flights.aircraft_id` to it. Backfills one aircraft row per distinct tail number already logged (tail
 * numbers are trimmed and uppercased first, so "n123ab" and " N123AB " become the same aircraft, not
 * two) and links every existing flight to it. `flights.aircraft_type`/`tail_number` are left exactly as
 * they are — nothing is removed or rewritten, only linked.
 */
export default async function up({ all, get, run, client }) {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS aircraft (
      id                       INTEGER PRIMARY KEY AUTOINCREMENT,
      tail_number              TEXT,                       -- normalised (trimmed, uppercase); NULL for a simulator-only entry
      make                     TEXT,
      model                    TEXT,
      type_designator          TEXT,                       -- ICAO type designator, e.g. C172, B738
      category                 TEXT,                       -- airplane / rotorcraft / glider / ... (see client's aviationEnums.js)
      class                    TEXT,                       -- ASEL / AMEL / ASES / AMES / ...
      is_complex               INTEGER NOT NULL DEFAULT 0,
      is_high_performance      INTEGER NOT NULL DEFAULT 0,
      is_tailwheel             INTEGER NOT NULL DEFAULT 0,
      is_turbine               INTEGER NOT NULL DEFAULT 0,
      type_rating_required     INTEGER NOT NULL DEFAULT 0,
      type_rating_designation  TEXT,
      is_simulator             INTEGER NOT NULL DEFAULT 0,
      simulator_device_type    TEXT,                       -- FFS / FTD / AATD / BATD
      notes                    TEXT,
      archived_at              TEXT,                       -- set instead of ever deleting an aircraft flights reference
      created_at               TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at               TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_aircraft_tail ON aircraft(tail_number);
  `);

  const flightCols = await all("SELECT name FROM pragma_table_info('flights')");
  if (!flightCols.some((c) => c.name === 'aircraft_id')) {
    await run('ALTER TABLE flights ADD COLUMN aircraft_id INTEGER REFERENCES aircraft(id)');
  }

  const pairs = await all('SELECT DISTINCT tail_number, aircraft_type FROM flights WHERE aircraft_id IS NULL');
  for (const pair of pairs) {
    const tail = pair.tail_number ? pair.tail_number.trim().toUpperCase() : null;
    const type = pair.aircraft_type ? pair.aircraft_type.trim() : null;
    if (!tail && !type) continue; // nothing to key an aircraft on — leave aircraft_id null

    let aircraft = tail
      ? await get('SELECT id FROM aircraft WHERE tail_number = ?', [tail])
      : await get('SELECT id FROM aircraft WHERE tail_number IS NULL AND model = ?', [type]);
    if (!aircraft) {
      const { lastId } = await run(
        'INSERT INTO aircraft (tail_number, make, model, type_designator) VALUES (?, NULL, ?, ?)',
        [tail, type, type],
      );
      aircraft = { id: lastId };
    }

    // Link every flight matching this exact (unnormalised, as originally stored) pair.
    const where = [pair.tail_number ? 'tail_number = ?' : 'tail_number IS NULL', pair.aircraft_type ? 'aircraft_type = ?' : 'aircraft_type IS NULL'];
    const args = [aircraft.id, ...(pair.tail_number ? [pair.tail_number] : []), ...(pair.aircraft_type ? [pair.aircraft_type] : [])];
    await run(`UPDATE flights SET aircraft_id = ? WHERE aircraft_id IS NULL AND ${where.join(' AND ')}`, args);
  }
}
