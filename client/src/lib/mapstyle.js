// Pure map helpers: route colouring (by year or by aircraft) with a matching legend, the counters
// ("airports visited", "states visited") and a per-airport summary. The map component only renders this.

export const ROUTE_PALETTE = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#2dd4bf', '#fb923c', '#94a3b8', '#f472b6', '#84cc16'];
export const NEUTRAL_ROUTE = '#38bdf8';

const yearOf = (date) => String(date).slice(0, 4);
const aircraftOf = (flight) => (flight.aircraft || '').trim() || 'Unknown';

/** The key a route is coloured by: its most recent flight's year, or its most recent flight's aircraft. */
export function routeKey(route, mode) {
  const latest = route.flights[0]; // buildMapData keeps route.flights newest-first
  if (!latest) return null;
  return mode === 'year' ? yearOf(latest.date) : mode === 'aircraft' ? aircraftOf(latest) : null;
}

/**
 * Assigns each distinct key a stable colour and returns { colorOf(route), legend: [{key, color, count}] }.
 * Years are ordered newest first; aircraft by number of routes. `mode: 'none'` colours everything alike.
 */
export function buildRouteColors(routes, mode) {
  if (mode !== 'year' && mode !== 'aircraft') return { colorOf: () => NEUTRAL_ROUTE, legend: [] };
  const counts = new Map();
  for (const r of routes) {
    const k = routeKey(r, mode);
    if (k !== null) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const keys = [...counts.keys()].sort(mode === 'year'
    ? (a, b) => b.localeCompare(a)
    : (a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b));
  const colors = new Map(keys.map((k, i) => [k, ROUTE_PALETTE[i % ROUTE_PALETTE.length]]));
  return {
    colorOf: (route) => colors.get(routeKey(route, mode)) ?? NEUTRAL_ROUTE,
    legend: keys.map((key) => ({ key, color: colors.get(key), count: counts.get(key) })),
  };
}

/** US state / country region code of an airport ("US-CA" -> "CA"); null when unknown or outside the US. */
export function usState(airport) {
  const m = /^US-([A-Z]{2})$/.exec(airport?.region ?? '');
  return m ? m[1] : null;
}

/**
 * Counters for the map header. `regionsKnown` is false when none of the airports carry region data yet
 * (the airports table hasn't been re-seeded), so the UI can hide the states counter instead of showing 0.
 */
export function visitedCounts(stops) {
  const states = new Set();
  const countries = new Set();
  let regionsKnown = false;
  for (const s of stops) {
    if (s.region) regionsKnown = true;
    const st = usState(s);
    if (st) states.add(st);
    if (s.country) countries.add(s.country);
  }
  return { airports: stops.length, states: states.size, stateCodes: [...states].sort(), countries: countries.size, regionsKnown };
}

/** Mini-summary for an airport pin: visits, total hours (of flights touching it), last visit. */
export function airportSummary(stop) {
  const hours = Math.round(stop.flights.reduce((s, f) => s + (Number(f.hours) || 0), 0) * 100) / 100;
  return { visits: stop.visits, hours, last: stop.last, first: stop.first };
}

/** Whether animated dashed routes are affordable: many routes get a cheap static style instead. */
export const ANIMATE_ROUTE_LIMIT = 120;
export const shouldAnimateRoutes = (routeCount, reducedMotion) => !reducedMotion && routeCount > 0 && routeCount <= ANIMATE_ROUTE_LIMIT;
