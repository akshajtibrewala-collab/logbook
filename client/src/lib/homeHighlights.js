import { flightCodes } from './flightpath.js';
import { countryOf } from './mapstyle.js';
import { resolveAirline } from './airlines.js';
import { completionKey } from './milestones.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const identsOf = (flights, airports) =>
  new Set(flights.flatMap((f) => flightCodes(f).map((c) => airports[c]?.ident).filter(Boolean)));

const countriesOf = (idents, airportByIdent) =>
  new Set([...idents].map((id) => countryOf(airportByIdent.get(id))).filter((c) => c !== 'Unknown'));

/**
 * Real, meaningful facts about this year's flying for the Home highlights row — every role, since a first
 * trip to a new country or a milestone finally checked off is worth celebrating regardless of who was
 * flying. Only ever reports something true and non-trivial: with no prior year to compare against, "new"
 * counts are skipped entirely (a first year's airports aren't meaningfully "new"), and an empty year
 * returns nothing rather than a row of zeros. Capped at 4 so this never turns into a second stats page.
 *
 * `completions` is the flat list from GET /milestone-completions; `config` is GET /milestones (used only
 * to look up a completed requirement's human label).
 */
export function homeHighlights({ flights, airports, completions = [], config = [], now }) {
  const year = now.slice(0, 4);
  const thisYear = flights.filter((f) => f.date?.slice(0, 4) === year);
  if (!thisYear.length) return [];
  const before = flights.filter((f) => f.date?.slice(0, 4) < year);

  const items = [];
  const airportByIdent = new Map(Object.values(airports).map((a) => [a.ident, a]));

  if (before.length) {
    const beforeAirports = identsOf(before, airports);
    const yearAirports = identsOf(thisYear, airports);
    const newAirports = [...yearAirports].filter((id) => !beforeAirports.has(id));
    if (newAirports.length) items.push({ id: 'airports', text: `${plural(newAirports.length, 'new airport')} this year` });

    const newCountries = [...countriesOf(yearAirports, airportByIdent)].filter((c) => !countriesOf(beforeAirports, airportByIdent).has(c));
    if (newCountries.length) items.push({ id: 'countries', text: `${newCountries.length} new countr${newCountries.length === 1 ? 'y' : 'ies'} this year` });

    const beforeAirlines = new Set(before.map((f) => resolveAirline(f.airline)?.name).filter(Boolean));
    const newAirlines = [...new Set(thisYear.map((f) => resolveAirline(f.airline)?.name).filter(Boolean))].filter((a) => !beforeAirlines.has(a));
    if (newAirlines.length) {
      items.push({ id: 'airlines', text: newAirlines.length === 1 ? `First flight with ${newAirlines[0]} this year` : `${newAirlines.length} new airlines this year` });
    }
  }

  const longest = [...thisYear].sort((a, b) => (Number(b.total_time) || 0) - (Number(a.total_time) || 0))[0];
  if (longest && Number(longest.total_time) > 0) {
    items.push({ id: 'longest', text: `Longest flight this year: ${longest.departure_airport || '—'} → ${longest.arrival_airport || '—'}, ${longest.total_time}h` });
  }

  const labelByKey = new Map(config.map((r) => [completionKey(r.certificate, r.requirement_key), r.label]));
  const recentCompletion = [...completions]
    .filter((c) => c.completed_at?.slice(0, 4) === year)
    .sort((a, b) => b.completed_at.localeCompare(a.completed_at))[0];
  if (recentCompletion) {
    const label = labelByKey.get(completionKey(recentCompletion.certificate, recentCompletion.requirement_key)) ?? recentCompletion.requirement_key;
    items.push({ id: 'milestone', text: `Completed: ${label}` });
  }

  return items.slice(0, 4);
}
