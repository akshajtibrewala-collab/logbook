import { flightStops } from './flightpath.js';
import { greatCircleDistanceNm } from './geo.js';

/**
 * Turns flights plus resolved airports into map-ready data.
 * `airports` maps an entered code (uppercase ICAO/IATA/local) to { ident, name, lat, lon }.
 * Airports are merged by `ident`, so KPAO and PAO count as the same place.
 * A visit is one flight touching an airport (a local flight KPAO -> KPAO counts once).
 */
export function buildMapData(flights, airports) {
  const stops = new Map();
  const routes = new Map();
  const unresolved = new Set();
  let unresolvedFlightCount = 0; // flights that named an airport but it couldn't be placed at all — invisible otherwise

  for (const f of flights) {
    const codes = flightStops(f);
    const ends = new Set([f.departure_airport, f.arrival_airport].map((c) => (c || '').trim().toUpperCase()).filter(Boolean));
    const path = []; // resolved airports in order, immediate repeats merged (PAO then KPAO is one stop)
    for (const code of codes) {
      const ap = airports[code];
      if (!ap) { if (ends.has(code)) unresolved.add(code); continue; } // only departure/arrival typos are worth reporting
      if (path.length && path[path.length - 1].ident === ap.ident) continue;
      path.push(ap);
    }
    if (!path.length && ends.size) unresolvedFlightCount++;

    const touched = new Map(path.map((ap) => [ap.ident, ap]));
    for (const ap of touched.values()) {
      if (!stops.has(ap.ident)) stops.set(ap.ident, { ...ap, visits: 0, flights: [] });
      const s = stops.get(ap.ident);
      s.visits++;
      s.flights.push({ id: f.id, date: f.date, from: f.departure_airport || '—', to: f.arrival_airport || '—', hours: Number(f.total_time) || 0, note: f.remarks || null });
    }

    // Each leg between consecutive stops; a leg flown out and back on one flight counts once for that flight.
    const legs = new Set();
    for (let i = 1; i < path.length; i++) {
      if (path[i - 1].ident === path[i].ident) continue;
      const [x, y] = [path[i - 1].ident, path[i].ident].sort();
      const key = `${x}|${y}`;
      if (legs.has(key)) continue;
      legs.add(key);
      const r = routes.get(key) ?? { a: touched.get(x), b: touched.get(y), count: 0, hours: 0, flights: [], origin: null, originDate: '' };
      // Direction: which end the most recent flight on this leg started from (used to animate the line
      // departure -> destination). Ties keep the first seen.
      if (f.date > r.originDate) { r.origin = path[i - 1].ident; r.originDate = f.date; }
      r.count++;
      r.hours += Number(f.total_time) || 0;
      r.flights.push({ id: f.id, date: f.date, aircraft: [f.aircraft_type, f.tail_number].filter(Boolean).join(' · '), hours: Number(f.total_time) || 0 });
      routes.set(key, r);
    }
  }

  const stopList = [...stops.values()];
  for (const s of stopList) {
    s.flights.sort((x, y) => y.date.localeCompare(x.date) || y.id - x.id);
    s.last = s.flights[0].date;
    s.first = s.flights[s.flights.length - 1].date;
  }
  const routeList = [...routes.values()];
  let totalDistanceNm = 0;
  for (const r of routeList) {
    r.flights.sort((x, y) => y.date.localeCompare(x.date) || y.id - x.id);
    r.hours = Math.round(r.hours * 100) / 100;
    r.last = r.flights[0].date;
    r.first = r.flights[r.flights.length - 1].date;
    r.distanceNm = Math.round(greatCircleDistanceNm([r.a.lat, r.a.lon], [r.b.lat, r.b.lon]));
    totalDistanceNm += r.distanceNm * r.count;
  }
  return {
    stops: stopList.sort((x, y) => y.visits - x.visits),
    routes: routeList,
    unresolved: [...unresolved].sort(),
    unresolvedFlightCount,
    totalDistanceNm: Math.round(totalDistanceNm),
  };
}

/**
 * Drops stops/routes whose airport has no coordinates — the airport resolved by code (it's a real row in
 * the airports table), but that row's own lat/lon is blank, a data-quality gap distinct from an unknown
 * code (`unresolved` above). Nothing with missing coordinates can be placed on either map. A flight is
 * counted in `omittedFlightCount` only when NONE of its stops could be placed — if at least one stop is
 * placeable, that flight still shows as a dot, just missing a leg to/from the unplaceable airport.
 */
export function placeableMapData(data) {
  const stops = data.stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon));
  const placeableIdents = new Set(stops.map((s) => s.ident));
  const routes = data.routes.filter((r) => placeableIdents.has(r.a.ident) && placeableIdents.has(r.b.ident));

  const omittedFlightIds = new Set();
  for (const s of data.stops) {
    if (placeableIdents.has(s.ident)) continue;
    for (const f of s.flights) omittedFlightIds.add(f.id);
  }
  for (const s of stops) for (const f of s.flights) omittedFlightIds.delete(f.id);

  return { ...data, stops, routes, omittedFlightCount: omittedFlightIds.size };
}
