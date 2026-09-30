// Every flight has a role: 'pilot' (the only role that existed before this), 'passenger' (riding, not
// flying), or 'observer' (present but neither flying nor a fare-paying passenger). Logbook hours,
// currency, milestones and training costs count pilot flights only; the map, airports/aircraft/routes
// visited and distance count every role. This file is the one place that line is drawn on the client —
// every consumer of "logbook/legal time" filters through pilotFlights() rather than re-checking
// f.role === 'pilot' itself, so the rule can't drift between pages. See CLAUDE.md's "Flight roles"
// section and server/src/lib/flightRoles.js for the server-side half of the same rule.

export const FLIGHT_ROLES = [
  { value: 'pilot', label: 'Pilot' },
  { value: 'passenger', label: 'Passenger' },
  { value: 'observer', label: 'Observer' },
];

// Old cached data (a draft saved before this feature, a stale test fixture) may have no `role` at all —
// treated as 'pilot' since that was the only role a flight could ever have been before this.
export const roleOf = (flight) => flight?.role ?? 'pilot';
export const isPilotFlight = (flight) => roleOf(flight) === 'pilot';

/** Only the flights that count toward hours, currency, milestones and training costs. */
export const pilotFlights = (flights) => (flights ?? []).filter(isPilotFlight);
