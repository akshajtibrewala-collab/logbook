// Server-side half of the flight-role rule (see client/src/lib/flightRoles.js for the full explanation):
// logbook hours, currency, milestones and training costs count role='pilot' flights only. Any route
// building one of those must read through pilotFlights() rather than querying `flights` directly, so the
// rule lives in one place instead of being re-typed as WHERE role = 'pilot' at every call site.
import { all } from '../db.js';

export const PILOT_FLIGHTS_SQL = "SELECT * FROM flights WHERE role = 'pilot'";

/** Every pilot-role flight — the only ones that feed a public summary, print view, or logbook CSV export. */
export async function pilotFlights() {
  return all(PILOT_FLIGHTS_SQL);
}
