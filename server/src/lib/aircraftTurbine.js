// Used only when findOrCreateAircraftBatch (server/src/routes/flights.js) auto-creates an aircraft record
// for a passenger flight, where there is no pilot to say whether the airplane is a turbine. A broad
// allowlist of known airliner/regional-turbine ICAO type designators lets that auto-creation default
// is_turbine correctly for the common case, without guessing for anything not on the list (those default
// to 0, same as before). Never applied to pilot flights or manual aircraft creation (POST /api/aircraft),
// which always take is_turbine from what the pilot actually entered — see parseAircraft in validate.js.
const TRAILING_PARENS = /\(([^()]+)\)\s*$/;

// Boeing jet airliners (717/727/737/747/757/767/777/787 families) mostly use 4-character ICAO designators
// starting with "B7" (e.g. B712, B738, B77W, B78X) — broad enough to cover every classic variant without
// listing each one. The 737 MAX line breaks that pattern (B37M/B38M/B39M/B3XM), so it gets its own pattern.
const TURBINE_PREFIXES = [/^B7/, /^B3[0-9X]M$/, /^A3/, /^CRJ/, /^AT[47]/, /^DH8/, /^MD[89]/];

// Designators the family-prefix patterns above miss: A220 (BCS1/BCS3, not an "A..." code), A320neo-family
// narrow-bodies (A19N/A20N/A21N, which start "A1"/"A2" not "A3"), Saab 340, the DC-9 the MD-80 was derived
// from, and the common Embraer regional-jet designators (ERJ135/145/170/175/190/195 and their E2 variants).
const TURBINE_DESIGNATORS = new Set([
  'BCS1', 'BCS3',
  'A19N', 'A20N', 'A21N',
  'SF34',
  'DC9',
  'E135', 'E35L', 'E140', 'E145', 'E45X',
  'E170', 'E75L', 'E75S', 'E190', 'E195',
  'E290', 'E295', 'E29X',
]);

/** The ICAO type designator parsed out of an aircraft_type string's trailing parens, or '' if there isn't one. */
export function icaoDesignator(aircraftType) {
  const m = TRAILING_PARENS.exec(String(aircraftType || '').trim());
  return m ? m[1].trim().toUpperCase() : '';
}

/** Whether an ICAO type designator (already extracted, e.g. "B738") is on the turbine allowlist. */
export function isTurbineDesignator(designator) {
  const d = String(designator || '').trim().toUpperCase();
  if (!d) return false;
  if (TURBINE_DESIGNATORS.has(d)) return true;
  return TURBINE_PREFIXES.some((re) => re.test(d));
}

/** Whether an aircraft_type label (e.g. "Boeing 737-800 (B738)") names a turbine airliner/regional type. */
export function isTurbineAircraftType(aircraftType) {
  return isTurbineDesignator(icaoDesignator(aircraftType));
}
