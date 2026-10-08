// The Logbook's Ledger view as pure data: months of flight lines with FLIGHT subtotals, ground sessions listed apart and never summed into a
// flight figure, and the pilot totals. Entries are the Logbook's own { kind, id, date, hours, data } rows (pilot flights and ground sessions).
// Every figure is derived from the rows it is given, so the totals here equal the totals strip and the print view for the same flights.
import { groupByMonth } from './logbookList.js';

const num = (v) => Number(v) || 0;
const round2 = (n) => Math.round(n * 100) / 100;
const landings = (d) => num(d.day_landings) + num(d.night_landings);

const sumFlights = (flights) => ({
  total: round2(flights.reduce((s, e) => s + num(e.data.total_time), 0)),
  pic: round2(flights.reduce((s, e) => s + num(e.data.pic_time), 0)),
  dual: round2(flights.reduce((s, e) => s + num(e.data.dual_received), 0)),
  solo: round2(flights.reduce((s, e) => s + num(e.data.solo_time), 0)),
  night: round2(flights.reduce((s, e) => s + num(e.data.night_time), 0)),
  xc: round2(flights.reduce((s, e) => s + num(e.data.cross_country_time), 0)),
  landings: flights.reduce((s, e) => s + landings(e.data), 0),
});

/** One ledger line for a flight. */
export const flightLine = (e) => ({
  kind: 'flight', id: e.id, date: e.date, aircraft: e.data.aircraft_type || '', tail: e.data.tail_number || '',
  route: e.data.departure_airport && e.data.departure_airport === e.data.arrival_airport ? e.data.departure_airport : [e.data.departure_airport, e.data.arrival_airport].filter(Boolean).join(' → '),
  total: num(e.data.total_time), pic: num(e.data.pic_time), dual: num(e.data.dual_received), solo: num(e.data.solo_time), night: num(e.data.night_time), xc: num(e.data.cross_country_time), landings: landings(e.data),
});

/**
 * { months: [{ key, label, flights, grounds, groundHours, subtotal, lines }], totals, groundHours, grounds }.
 * `subtotal` and `totals` sum FLIGHTS only; each ground session is a line of its own with its hours in `hours`.
 */
export function ledgerModel(entries) {
  const months = groupByMonth(entries).map((g) => {
    const flights = g.entries.filter((e) => e.kind === 'flight');
    return {
      key: g.key, label: g.label, flights: g.flights, grounds: g.grounds, groundHours: g.groundHours, subtotal: sumFlights(flights),
      lines: g.entries.map((e) => (e.kind === 'ground'
        ? { kind: 'ground', id: e.id, date: e.date, topics: e.data.topics || '', hours: num(e.hours) }
        : flightLine(e))),
    };
  });
  const allFlights = entries.filter((e) => e.kind === 'flight');
  const grounds = entries.filter((e) => e.kind === 'ground');
  return { months, totals: { ...sumFlights(allFlights), flights: allFlights.length }, grounds: grounds.length, groundHours: round2(grounds.reduce((s, e) => s + num(e.hours), 0)) };
}
