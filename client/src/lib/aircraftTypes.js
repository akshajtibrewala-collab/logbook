// An aircraft_type string like "Airbus A321neo (A21N)" carries the real ICAO type designator in its
// trailing parens. Two differently-worded strings for the same real type ("Airbus A321LR (A21N)" and
// "Airbus A321neo (A21N)", or "Airbus A320 (A320)" and "Airbus A320-200 (A320)") share that designator and
// must count as one type, even though stats.js's hoursByAircraft() groups by the raw string on purpose (it
// shows a bar per label the pilot actually sees). Any surface that reports a *count* of aircraft types —
// not a chart of hours per label — should go through distinctAircraftTypeCount() instead.
const TRAILING_PARENS = /\(([^()]+)\)\s*$/;

/** The ICAO type designator parsed out of an aircraft_type string's trailing parens, or '' if there isn't one. */
export function icaoDesignator(aircraftType) {
  const m = TRAILING_PARENS.exec((aircraftType || '').trim());
  return m ? m[1].trim().toUpperCase() : '';
}

/** Count of distinct ICAO type designators across flights. A blank/unparseable aircraft_type isn't counted. */
export function distinctAircraftTypeCount(flights) {
  const designators = new Set();
  for (const f of flights) {
    const d = icaoDesignator(f.aircraft_type);
    if (d) designators.add(d);
  }
  return designators.size;
}
