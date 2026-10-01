import { roleOf } from './flightRoles.js';

/**
 * The most recent flights across both roles, newest first, for the Home "Recent activity" feed. Unlike
 * the Logbook/Travel lists (which stay within one role), this merges pilot and passenger flights by date
 * so the feed reads as "what's happened in my aviation life lately" — each row carries its own role so
 * the UI can still badge and link it correctly (Logbook vs. Passenger flights, sky blue vs. violet).
 */
export function recentActivity(flights, limit = 6) {
  return [...(flights ?? [])]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    .slice(0, limit)
    .map((f) => ({
      id: f.id,
      role: roleOf(f),
      date: f.date,
      from: f.departure_airport || null,
      to: f.arrival_airport || null,
      hours: f.total_time,
      airline: f.airline || null,
      aircraft_type: f.aircraft_type || null,
      tail_number: f.tail_number || null,
    }));
}
