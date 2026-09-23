import { flightStops, airportCode } from './flightpath.js';
import { resolveAirline } from './airlines.js';

const round2 = (n) => Math.round(n * 100) / 100;

export const CATEGORIES = [
  ['pic_time', 'PIC'],
  ['dual_received', 'Dual received'],
  ['sic_time', 'SIC'],
  ['solo_time', 'Solo'],
  ['night_time', 'Night'],
  ['cross_country_time', 'Cross-country'],
  ['instrument_actual', 'Instrument (actual)'],
  ['instrument_simulated', 'Instrument (simulated)'],
  ['ground_time', 'Ground instruction'],
];

/** Hours per category. Categories overlap (e.g. night PIC), so slices need not sum to total time. */
export function hoursByCategory(flights) {
  return CATEGORIES
    .map(([key, label]) => ({ key, label, hours: round2(flights.reduce((s, f) => s + (Number(f[key]) || 0), 0)) }))
    .filter((c) => c.hours > 0);
}

/** Total hours per aircraft type, largest first. Blank types are grouped as "Unknown". */
export function hoursByAircraft(flights) {
  const totals = new Map();
  for (const f of flights) {
    const type = (f.aircraft_type || '').trim().toUpperCase() || 'Unknown';
    totals.set(type, (totals.get(type) ?? 0) + (Number(f.total_time) || 0));
  }
  return [...totals]
    .map(([type, hours]) => ({ type, hours: round2(hours) }))
    .sort((a, b) => b.hours - a.hours || a.type.localeCompare(b.type));
}

// Resolved airports merge alternate codes (PAO / KPAO); unknown codes stand on their own.
const identOf = (code, airports) => {
  const c = (code || '').trim().toUpperCase();
  return c ? airports[c]?.ident ?? c : null;
};
const labelOf = (ident, airports) => {
  const a = Object.values(airports).find((x) => x.ident === ident);
  return a ? airportCode(a) : ident;
};

// A flight's stops as merged identifiers, in order (departure, via airports, arrival).
const stopIdents = (f, airports) => {
  const ids = flightStops(f).map((c) => airports[c]?.ident ?? c);
  return ids.filter((id, i) => i === 0 || id !== ids[i - 1]);
};

/**
 * Most-flown routes, direction-agnostic ("KPAO ↔ KSQL"). A flight via other airports counts once for each
 * leg (KSUS -> KFYG -> KSUS is the leg KFYG ↔ KSUS). A flight that stays at one airport is "KPAO local".
 */
export function topRoutes(flights, airports = {}, limit = 10) {
  const routes = new Map();
  const add = (key, from, to, hours) => {
    const r = routes.get(key) ?? { from, to, count: 0, hours: 0 };
    r.count++;
    r.hours += hours;
    routes.set(key, r);
  };
  for (const f of flights) {
    const ids = stopIdents(f, airports);
    if (!ids.length || !f.departure_airport || !f.arrival_airport) continue;
    const hours = Number(f.total_time) || 0;
    if (ids.length === 1) { add(ids[0], ids[0], ids[0], hours); continue; }
    const legs = new Set();
    for (let i = 1; i < ids.length; i++) {
      const key = [ids[i - 1], ids[i]].sort().join('|');
      if (legs.has(key)) continue;
      legs.add(key);
      add(key, ids[i - 1], ids[i], hours);
    }
  }
  return [...routes.values()]
    .map((r) => {
      const [a, b] = [labelOf(r.from, airports), labelOf(r.to, airports)].sort();
      return { label: r.from === r.to ? `${a} local` : `${a} ↔ ${b}`, count: r.count, hours: round2(r.hours) };
    })
    .sort((x, y) => y.count - x.count || y.hours - x.hours || x.label.localeCompare(y.label))
    .slice(0, limit);
}

/** Most-visited airports; a flight counts once per distinct airport it touches (including via airports). */
export function topAirports(flights, airports = {}, limit = 10) {
  const visits = new Map();
  for (const f of flights) {
    for (const id of new Set(stopIdents(f, airports))) visits.set(id, (visits.get(id) ?? 0) + 1);
  }
  return [...visits]
    .map(([ident, count]) => {
      const a = Object.values(airports).find((x) => x.ident === ident);
      return { code: labelOf(ident, airports), name: a?.name ?? null, count };
    })
    .sort((x, y) => y.count - x.count || x.code.localeCompare(y.code))
    .slice(0, limit);
}

/** Commercial flights grouped by airline (spellings like "Delta" and "DL" merge), most hours first. GA flights are ignored. */
export function hoursByAirline(flights) {
  const totals = new Map();
  for (const f of flights) {
    const a = resolveAirline(f.airline);
    if (!a) continue;
    const t = totals.get(a.name) ?? { name: a.name, code: a.code, color: a.color, fg: a.fg, flights: 0, hours: 0 };
    t.flights++;
    t.hours += Number(f.total_time) || 0;
    totals.set(a.name, t);
  }
  return [...totals.values()]
    .map((t) => ({ ...t, hours: round2(t.hours) }))
    .sort((x, y) => y.hours - x.hours || x.name.localeCompare(y.name));
}
