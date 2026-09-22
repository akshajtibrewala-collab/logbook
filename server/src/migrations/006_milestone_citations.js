/**
 * Corrects and completes the regulation citations in the 005 seed data, and adds the manual
 * (single-flight/recency-window) requirements that were missing entirely. Checked against the current
 * text of 14 CFR 61.109, 61.65 and 61.129 (via a mirror of the eCFR) rather than from memory alone —
 * several of 005's citations turned out to be genuinely wrong, not just missing a "§":
 *   - private "dual_xc"/"dual_night" were off by one subsection ((a)(2)/(a)(3) instead of (a)(1)/(a)(2))
 *   - private "solo_xc" cited (a)(5)(ii) (the 150nm flight) instead of (a)(5)(i) (the plain 5-hour total)
 *   - commercial was the most wrong: "pic_time" and "complex_turbine_taa" were cited under (a)(3), but
 *     PIC time is actually (a)(2) and complex/turbine/TAA training is (a)(3)(ii), not (a)(3)(i) — (a)(3)(i)
 *     is actually 10 hours of *instrument* training, which 005 never seeded as its own requirement
 *
 * This is still not a certified restatement of the regulations — it's one careful pass against a mirror
 * of the eCFR, not the eCFR itself, and rules change. Verify each row yourself; that's the point of
 * adding the citations.
 */
export default async function up({ run, get }) {
  const setNotes = async (certificate, requirement_key, notes) => {
    await run('UPDATE milestones_config SET notes = ? WHERE certificate = ? AND requirement_key = ?', [notes, certificate, requirement_key]);
  };

  // ---- Private Pilot — Airplane (14 CFR 61.109(a)) — citation corrections ----
  await setNotes('private', 'total_time', '§61.109(a)');
  await setNotes('private', 'dual_received', '§61.109(a)');
  await setNotes('private', 'dual_xc', '§61.109(a)(1); approximated as dual time on a flight that also logged cross-country time');
  await setNotes('private', 'dual_night', '§61.109(a)(2); also requires one 100nm+ night cross-country flight and 10 towered takeoffs/landings — see the two rows below');
  await setNotes('private', 'solo_time', '§61.109(a)(5)');
  await setNotes('private', 'solo_xc', '§61.109(a)(5)(i)');
  await setNotes('private', 'solo_xc_150nm', '§61.109(a)(5)(ii)');
  await setNotes('private', 'checkride_prep', '§61.109(a)(4)');

  // ---- Instrument Rating — Airplane (14 CFR 61.65(d)) — citation corrections ----
  await setNotes('instrument', 'pic_xc', '§61.65(d)(1)');
  await setNotes('instrument', 'instrument_time', '§61.65(d)(2)');
  await setNotes('instrument', 'instrument_dual', '§61.65(d)(2)');
  await run(
    "UPDATE milestones_config SET label = ?, notes = ? WHERE certificate = 'instrument' AND requirement_key = 'instrument_xc'",
    [
      'One IFR cross-country flight: 250nm along airways or ATC-directed routing, an instrument approach at each airport, 3 different kinds of approaches',
      '§61.65(d)(2)(ii)(A)-(C)',
    ],
  );

  // ---- Commercial Pilot — Airplane, Single-engine (14 CFR 61.129(a)) — citation corrections ----
  // total_time is 61.129(a)'s own opening clause, not a numbered subsection.
  await setNotes('commercial', 'total_time', '§61.129(a)');
  await setNotes('commercial', 'pic_time', '§61.129(a)(2)');
  await setNotes('commercial', 'pic_xc', '§61.129(a)(2)(ii)');
  await setNotes('commercial', 'dual_received', '§61.129(a)(3)');
  await setNotes(
    'commercial', 'complex_turbine_taa',
    '§61.129(a)(3)(ii); set an aircraft’s complex/turbine/TAA flag on the Aircraft screen for this to count',
  );
  await setNotes(
    'commercial', 'solo_time',
    '§61.129(a)(4); PIC-with-instructor-aboard time isn’t separately tracked, so only solo time is counted here',
  );
  await setNotes('commercial', 'solo_xc_300nm', '§61.129(a)(4)(i)');

  // ---- New rows: real sub-requirements 005 was missing entirely, not just mis-cited ----
  const dualGiven = JSON.stringify([{ field: 'dual_received', op: '>', value: 0 }]);
  const missing = [
    // Private — the towered-airport landing counts within night and solo training (61.109(a)(2)(ii), (a)(5)(iii))
    // can't be verified as "towered" from logged data, and the night cross-country and solo 150nm flight
    // are single-flight geometry — all four stay manual.
    ['private', 'night_xc_100nm', 'One night cross-country flight of over 100nm total distance', 1, 'count', null, null, 1, '§61.109(a)(2)(i)', 9],
    ['private', 'night_towered_landings', '10 takeoffs and 10 landings to a full stop at a towered airport (night)', 1, 'count', null, null, 1, '§61.109(a)(2)(ii)', 10],
    ['private', 'solo_towered_landings', '3 takeoffs and 3 landings to a full stop at a towered airport (solo)', 1, 'count', null, null, 1, '§61.109(a)(5)(iii)', 11],

    // Instrument — the checkride-prep window is a recency condition, not a sum.
    ['instrument', 'checkride_prep', '3 hours of instrument flight training within 2 calendar months before the checkride', 1, 'count', null, null, 1, '§61.65(d)(2)(i)', 5],

    // Commercial — instrument training (61.129(a)(3)(i)) is computable the same way as the instrument
    // rating's own dual-instrument requirement; the day/night cross-country flights, checkride-prep
    // window, and night-VFR/towered-landings clause are single-flight or recency conditions.
    ['commercial', 'instrument_training', 'Instrument training', 10, 'hours', 'instrument_actual,instrument_simulated', dualGiven, 0, '§61.129(a)(3)(i); at least 5 of the 10 hours must be in a single-engine airplane — not separately tracked', 4.5],
    ['commercial', 'day_xc_100nm', 'One 2-hour daytime cross-country flight of over 100nm straight-line distance', 1, 'count', null, null, 1, '§61.129(a)(3)(iii)', 5.5],
    ['commercial', 'night_xc_100nm', 'One 2-hour nighttime cross-country flight of over 100nm straight-line distance', 1, 'count', null, null, 1, '§61.129(a)(3)(iv)', 5.6],
    ['commercial', 'checkride_prep', '3 hours of flight training within 2 calendar months before the checkride', 1, 'count', null, null, 1, '§61.129(a)(3)(v)', 5.7],
    ['commercial', 'night_vfr_towered', '5 hours of night VFR, including 10 takeoffs and 10 landings to a full stop at a towered airport', 1, 'count', null, null, 1, '§61.129(a)(4)(ii)', 7.5],
  ];

  for (const r of missing) {
    await run(
      `INSERT INTO milestones_config (certificate, requirement_key, label, min_value, unit, sum_field, flight_filter, manual, notes, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (certificate, requirement_key) DO NOTHING`,
      r,
    );
  }
}
