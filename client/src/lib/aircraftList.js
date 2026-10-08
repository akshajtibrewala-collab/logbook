// Pure logic for the Aircraft list (B-calm): one row per aircraft with how it has been used, derived from the flights each time (never stored).
import { isPilotFlight } from './flightRoles.js';

const num = (v) => Number(v) || 0;
const round2 = (n) => Math.round(n * 100) / 100;

/** The name a row shows: a simulator by its name, an aircraft by its tail number, else its model. */
export const aircraftTitle = (a) => (a.is_simulator ? (a.model || 'Simulator') : (a.tail_number || a.model || 'Aircraft'));

/** The full type: make and model ("Airbus A380-800 (A388)"), or the simulator device type. Used in the accessible name. */
export const aircraftFull = (a) => (a.is_simulator ? (a.simulator_device_type || '') : [a.make, a.model].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim());

/** The short muted type on a row: the type designator ("A388", from the field or from "(A388)" in the model), else the model's own text, else the simulator device type. */
export function aircraftSub(a) {
  if (a.is_simulator) return a.simulator_device_type || '';
  if (!a.tail_number) return '';
  const inParens = /\(([A-Za-z0-9]{2,5})\)/.exec(a.model || '');
  return (a.type_designator || (inParens && inParens[1]) || a.model || '').trim();
}

/** Pilot and passenger flights and hours per aircraft id. */
export function usageByAircraft(flights) {
  const by = new Map();
  for (const f of flights) {
    if (f.aircraft_id == null) continue;
    const u = by.get(f.aircraft_id) ?? { pilot: 0, passenger: 0, pilotHours: 0, passengerHours: 0 };
    if (isPilotFlight(f)) { u.pilot += 1; u.pilotHours = round2(u.pilotHours + num(f.total_time)); } else { u.passenger += 1; u.passengerHours = round2(u.passengerHours + num(f.total_time)); }
    by.set(f.aircraft_id, u);
  }
  return by;
}

/**
 * The rows for a usage filter ('all' | 'pilot' | 'passenger'). Each row carries ONE role and its hours: the role it was flown in as pilot if it ever was,
 * else passenger (so an airliner added from a passenger flight reads violet and is never counted as something flown).
 */
export function aircraftRows(aircraft, flights, filter = 'all') {
  const usage = usageByAircraft(flights);
  return (aircraft || []).map((a) => {
    const u = usage.get(a.id) ?? { pilot: 0, passenger: 0, pilotHours: 0, passengerHours: 0 };
    const role = u.pilot > 0 ? 'pilot' : u.passenger > 0 ? 'passenger' : null;
    return { id: a.id, title: aircraftTitle(a), sub: aircraftSub(a), full: aircraftFull(a), role, hours: role === 'pilot' ? u.pilotHours : role === 'passenger' ? u.passengerHours : null, archived: Boolean(a.archived_at), a, u };
  }).filter((r) => filter === 'all' || (filter === 'pilot' ? r.u.pilot > 0 : r.u.passenger > 0 && r.u.pilot === 0));
}

/** The accessible name: title, type, the role the hours are in, archived. */
export function aircraftLabel(r, fmt) {
  const parts = [r.title, r.full];
  if (r.role) parts.push(`${fmt(r.hours)} hours as ${r.role}`);
  else parts.push('not flown yet');
  if (r.archived) parts.push('archived');
  return parts.filter(Boolean).join(', ');
}
