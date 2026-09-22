/**
 * Milestone requirements for each certificate/rating, as editable data rather than JS logic. A row says
 * "sum this flight field (or fields) across flights matching this filter, and compare to this
 * threshold" — the milestones calc (client/src/lib/milestones.js) is a small, generic engine that reads
 * these rows; it has no certificate- or requirement-specific code of its own.
 *
 *   sum_field:     one flight column, or several comma-separated columns summed together
 *                  (e.g. "instrument_actual,instrument_simulated" for total instrument time)
 *   flight_filter: JSON array of clauses, ALL of which must hold for a flight to count (AND):
 *                    { field, op: '>'|'>='|'=', value }   a flight-column condition
 *                    { aircraft_flags: [...] }            true if the flight's aircraft has ANY of
 *                                                          these boolean flags set (OR) — this is the
 *                                                          "complex OR turbine OR TAA" mechanism; the
 *                                                          *set* of flags lives here in config, only the
 *                                                          ANY-of-them-true combinator is code.
 *   manual:        true for requirements this data model can't compute (e.g. "one solo cross-country
 *                  flight with landings at 3 points at least 50nm apart" is a single-flight geometric
 *                  condition, not a sum) — shown as "track manually" rather than silently guessed at.
 *
 * IMPORTANT: these are seeded as a reasonable approximation of common 14 CFR Part 61 hour-building
 * requirements (Private, Instrument, Commercial — single-engine airplane), NOT a certified or complete
 * restatement of the regulations. Several sub-requirements this data model cannot verify (specific
 * flight geometry, recency-within-2-months windows, towered-airport landings) are marked manual or
 * omitted rather than approximated with false precision. Verify against current 14 CFR 61 and your own
 * training provider before relying on this for checkride readiness — this is a progress tracker, not a
 * substitute for that. CFI, multi-engine and ATP are not seeded yet; add them the same way (a new
 * migration) when you're ready to track them.
 */
export default async function up({ run, client }) {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS milestones_config (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      certificate     TEXT NOT NULL,
      requirement_key TEXT NOT NULL,
      label           TEXT NOT NULL,
      min_value       REAL NOT NULL,
      unit            TEXT NOT NULL DEFAULT 'hours',
      sum_field       TEXT,
      flight_filter   TEXT,
      manual          INTEGER NOT NULL DEFAULT 0,
      notes           TEXT,
      sort_order      INTEGER NOT NULL DEFAULT 0,
      UNIQUE (certificate, requirement_key)
    );
  `);

  const xc = JSON.stringify([{ field: 'cross_country_time', op: '>', value: 0 }]);
  const night = JSON.stringify([{ field: 'night_time', op: '>', value: 0 }]);
  const taaGate = JSON.stringify([{ aircraft_flags: ['is_complex', 'is_turbine', 'is_taa'] }]);
  const dualGiven = JSON.stringify([{ field: 'dual_received', op: '>', value: 0 }]);

  const rows = [
    // ---- Private Pilot — Airplane (14 CFR 61.109(a)) ----
    ['private', 'total_time', 'Total time', 40, 'hours', 'total_time', null, 0, '61.109(a)', 1],
    ['private', 'dual_received', 'Flight training with an instructor', 20, 'hours', 'dual_received', null, 0, '61.109(a)', 2],
    ['private', 'dual_xc', 'Cross-country flight training', 3, 'hours', 'dual_received', xc, 0, '61.109(a)(2); approximated as dual time on a flight that also logged cross-country time', 3],
    ['private', 'dual_night', 'Night flight training', 3, 'hours', 'dual_received', night, 0, '61.109(a)(3); also requires one 100nm+ night cross-country and 10 night landings — track those yourself', 4],
    ['private', 'solo_time', 'Solo flight time', 10, 'hours', 'solo_time', null, 0, '61.109(a)(5)', 5],
    ['private', 'solo_xc', 'Solo cross-country time', 5, 'hours', 'solo_time', xc, 0, '61.109(a)(5)(ii)', 6],
    ['private', 'solo_xc_150nm', 'A solo cross-country flight of 150nm total distance, full-stop landings at 3 points, one leg 50nm+', 1, 'count', null, null, 1, '61.109(a)(5)(ii)', 7],
    ['private', 'checkride_prep', '3 hours of flight training within 2 calendar months before the checkride', 1, 'count', null, null, 1, '61.109(a)(4)', 8],

    // ---- Instrument Rating — Airplane (14 CFR 61.65) ----
    ['instrument', 'pic_xc', 'PIC cross-country time', 50, 'hours', 'pic_time', xc, 0, '61.65(d)(2)', 1],
    ['instrument', 'instrument_time', 'Instrument time (actual or simulated)', 40, 'hours', 'instrument_actual,instrument_simulated', null, 0, '61.65(d)(2)', 2],
    ['instrument', 'instrument_dual', 'Instrument flight training from an authorized instructor', 15, 'hours', 'instrument_actual,instrument_simulated', dualGiven, 0, '61.65(d)(2); approximated as instrument time logged on a dual-received flight', 3],
    ['instrument', 'instrument_xc', 'One instrument cross-country flight: 250nm along airways/ATC routing, an instrument approach at each of 3 airports', 1, 'count', null, null, 1, '61.65(d)(2)(iii)', 4],

    // ---- Commercial Pilot — Airplane, Single-engine (14 CFR 61.129(a)) ----
    ['commercial', 'total_time', 'Total time', 250, 'hours', 'total_time', null, 0, '61.129(a)(2)', 1],
    ['commercial', 'pic_time', 'PIC time', 100, 'hours', 'pic_time', null, 0, '61.129(a)(3)', 2],
    ['commercial', 'pic_xc', 'PIC cross-country time', 50, 'hours', 'pic_time', xc, 0, '61.129(a)(3)(ii)', 3],
    ['commercial', 'dual_received', 'Flight training with an instructor', 20, 'hours', 'dual_received', null, 0, '61.129(a)(3)(i)', 4],
    ['commercial', 'complex_turbine_taa', 'Training in a complex, turbine-powered, or technically advanced airplane', 10, 'hours', 'dual_received', taaGate, 0, '61.129(a)(3)(i); set an aircraft’s complex/turbine/TAA flag on the Aircraft screen for this to count', 5],
    ['commercial', 'solo_time', 'Solo (or PIC with an instructor aboard) flight time', 10, 'hours', 'solo_time', null, 0, '61.129(a)(3)(iii); PIC-with-instructor-aboard time isn’t separately tracked, so only solo time is counted here', 6],
    ['commercial', 'solo_xc_300nm', 'One VFR cross-country flight of 300nm total distance, landings at 3 points, one leg 250nm+ straight-line', 1, 'count', null, null, 1, '61.129(a)(3)(iii)', 7],
  ];

  for (const r of rows) {
    await run(
      `INSERT INTO milestones_config (certificate, requirement_key, label, min_value, unit, sum_field, flight_filter, manual, notes, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (certificate, requirement_key) DO NOTHING`,
      r,
    );
  }
}
