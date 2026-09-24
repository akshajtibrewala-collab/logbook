/**
 * Training cost tracker: effective-dated rate tables (aircraft rental+fuel surcharge, instructor, ground
 * instruction, simulator), one-off other expenses, ground-only training sessions (no flight logged), and
 * training phases (a certificate's own date range, for splitting spend per certificate — a flight's hours
 * can count toward more than one certificate's milestones, but it only happened during one phase of
 * training). Also adds `ground_time` (billed at the ground rate, separate from any in-flight category)
 * and an optional `cost_override` to `flights` itself.
 *
 * Rates are effective-dated (not a single current value) so an old flight keeps the cost it actually had
 * when a rate later changes — `cost.js` always picks the latest rate with effective_date <= the flight's
 * own date, never "the current rate". Every rate table starts empty except aircraft/instructor/ground,
 * which this migration seeds with the pilot's actual starting rates, effective 2026-07-10 (the start of
 * their actual training, predating their earliest logged flight by a few weeks — chosen so it also covers
 * their earliest ground-only session and supply expenses from that date): aircraft rental $195/hr + $15/hr
 * fuel surcharge per aircraft, instructor $85/hr, ground instruction $85/hr (same as the instructor rate,
 * until changed). Simulator rate is left unseeded (blank) — sim time simply doesn't get an aircraft rate,
 * unlike real aircraft time.
 */
const SEED_EFFECTIVE_DATE = '2026-07-10';
export default async function up({ all, get, run, client }) {
  const flightCols = await all("SELECT name FROM pragma_table_info('flights')");
  const hasFlightCol = (name) => flightCols.some((c) => c.name === name);
  if (!hasFlightCol('ground_time')) await run('ALTER TABLE flights ADD COLUMN ground_time REAL NOT NULL DEFAULT 0');
  if (!hasFlightCol('cost_override')) await run('ALTER TABLE flights ADD COLUMN cost_override REAL');

  const settingsCols = await all("SELECT name FROM pragma_table_info('pilot_settings')");
  const hasSettingsCol = (name) => settingsCols.some((c) => c.name === name);
  if (!hasSettingsCol('default_ground_time')) await run('ALTER TABLE pilot_settings ADD COLUMN default_ground_time REAL');
  if (!hasSettingsCol('private_realistic_total_hours')) await run('ALTER TABLE pilot_settings ADD COLUMN private_realistic_total_hours REAL');

  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS aircraft_rates (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      aircraft_id           INTEGER NOT NULL REFERENCES aircraft(id),
      effective_date        TEXT NOT NULL,
      rental_rate_per_hr    REAL NOT NULL,
      fuel_surcharge_per_hr REAL NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_aircraft_rates_aircraft ON aircraft_rates(aircraft_id, effective_date);

    CREATE TABLE IF NOT EXISTS instructor_rates (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      effective_date TEXT NOT NULL,
      hourly_rate    REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ground_rates (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      effective_date TEXT NOT NULL,
      hourly_rate    REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS simulator_rates (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      effective_date TEXT NOT NULL,
      hourly_rate    REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS other_expenses (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      date     TEXT NOT NULL,
      amount   REAL NOT NULL,
      note     TEXT
    );

    CREATE TABLE IF NOT EXISTS ground_sessions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      date       TEXT NOT NULL,
      hours      REAL NOT NULL,
      instructor TEXT,
      topics     TEXT,
      notes      TEXT
    );

    CREATE TABLE IF NOT EXISTS training_phases (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      certificate TEXT NOT NULL UNIQUE,
      start_date  TEXT NOT NULL,
      end_date    TEXT
    );
  `);

  const anyInstructorRate = await get('SELECT id FROM instructor_rates LIMIT 1');
  if (!anyInstructorRate) {
    await run('INSERT INTO instructor_rates (effective_date, hourly_rate) VALUES (?, 85)', [SEED_EFFECTIVE_DATE]);
    await run('INSERT INTO ground_rates (effective_date, hourly_rate) VALUES (?, 85)', [SEED_EFFECTIVE_DATE]);

    const aircraft = await all('SELECT id FROM aircraft WHERE is_simulator = 0');
    for (const a of aircraft) {
      await run(
        'INSERT INTO aircraft_rates (aircraft_id, effective_date, rental_rate_per_hr, fuel_surcharge_per_hr) VALUES (?, ?, 195, 15)',
        [a.id, SEED_EFFECTIVE_DATE],
      );
    }
  }
}
