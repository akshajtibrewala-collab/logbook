// Pure map helpers: the route colour, the counters ("airports visited", "states visited"), a per-airport
// summary, and the animation preference. The map component only renders this.

// One route colour, tuned per theme: the dark map tiles want a bright sky blue; the light-gray tiles need
// a deeper blue or the line washes out (this is the app's own accent in each theme).
const ROUTE_COLORS = { dark: '#38bdf8', light: '#0369a1' };
export const routeColorFor = (theme) => (theme === 'light' ? ROUTE_COLORS.light : ROUTE_COLORS.dark);

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
  return { airports: stops.length, states: states.size, countries: countries.size, regionsKnown };
}

/** Mini-summary for an airport pin: visits, total hours (of flights touching it), last visit. */
export function airportSummary(stop) {
  const hours = Math.round(stop.flights.reduce((s, f) => s + (Number(f.hours) || 0), 0) * 100) / 100;
  return { visits: stop.visits, hours, last: stop.last, first: stop.first };
}

/** Animating hundreds of SVG lines costs frame rate, so above this many routes they stay static. */
export const ANIMATE_ROUTE_LIMIT = 120;

/** Whether route animation runs: the pilot's setting is on and the route count is affordable. */
export const shouldAnimateRoutes = (routeCount, enabled) => Boolean(enabled) && routeCount > 0 && routeCount <= ANIMATE_ROUTE_LIMIT;

const ANIMATE_KEY = 'aerotrail-map-animate';
const defaultStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

/**
 * The remembered "Animate routes" choice. A saved choice always wins (so someone with reduced motion on
 * can still switch it on and have that stick); with nothing saved it defaults to on, or off when the
 * device asks for reduced motion.
 */
export function loadAnimatePref(reducedMotion, storage = defaultStorage()) {
  try {
    const saved = storage?.getItem(ANIMATE_KEY);
    if (saved === '1') return true;
    if (saved === '0') return false;
  } catch { /* storage blocked: use the default */ }
  return !reducedMotion;
}

export function saveAnimatePref(enabled, storage = defaultStorage()) {
  try { storage?.setItem(ANIMATE_KEY, enabled ? '1' : '0'); } catch { /* remembering is a nicety */ }
}

/**
 * Orients a route's points along the direction it was most recently flown, so animated dashes travel
 * departure -> destination. `route.origin` is the ident it started from on that flight.
 */
export function orientedPositions(route, positions) {
  return route.origin && route.origin === route.b.ident ? [...positions].reverse() : positions;
}
