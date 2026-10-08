// Pure logic for the Logbook list (docs/design/logbook-layouts, Option A): search, month grouping, row labels, filter chips and the
// pilot-only totals strip. Entries are { kind: 'flight' | 'ground', id, date: 'YYYY-MM-DD', hours, data }. Nothing here changes a stored
// number; every figure is derived from the rows it is given.
import { addDays } from './currency.js';
import { flightStops } from './flightpath.js';
import { countWords, ROW_MAX_WORDS } from './wordBudget.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const num = (v) => Number(v) || 0;
const round2 = (n) => Math.round(n * 100) / 100;

/** Everything a search can match for one entry, lower-cased: route and every stop, tail, aircraft type, airports, remarks, instructor. */
export function entrySearchText(e) {
  const d = e.data || {};
  if (e.kind === 'ground') return [d.instructor, d.topics, d.notes, 'ground session'].filter(Boolean).join(' ').toLowerCase();
  return [d.departure_airport, d.arrival_airport, d.route, ...flightStops(d), d.tail_number, d.aircraft_type, d.remarks, d.instructor, d.airline, d.flight_number]
    .filter(Boolean).join(' ').toLowerCase();
}

/** Every whitespace-separated word of the query must appear somewhere in the entry ("ksus c172s" narrows; an empty query matches all). */
export function matchesQuery(e, query) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = entrySearchText(e);
  return words.every((w) => hay.includes(w));
}

/** "2026-10" -> "October 2026". */
export function monthLabel(key) {
  const [y, m] = key.split('-');
  return `${MONTHS[Number(m) - 1] || key} ${y}`;
}

/** Flight hours and ground-session hours are never mixed: `flightHours` counts flights only (it is what a logbook total means), ground time is its own figure. */
export function summarize(entries) {
  let flights = 0, grounds = 0, flightHours = 0, groundHours = 0;
  for (const e of entries) {
    if (e.kind === 'ground') { grounds += 1; groundHours += num(e.hours); } else { flights += 1; flightHours += num(e.hours); }
  }
  return { flights, grounds, flightHours: round2(flightHours), groundHours: round2(groundHours) };
}

/** Groups entries (already sorted) into consecutive months. `hours` is FLIGHT hours only; ground time is `groundHours`, counted separately. Order is preserved. */
export function groupByMonth(entries) {
  const groups = [];
  for (const e of entries) {
    const key = e.date.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) { g = { key, label: monthLabel(key), hours: 0, flights: 0, groundHours: 0, grounds: 0, entries: [] }; groups.push(g); }
    if (e.kind === 'ground') { g.groundHours = round2(g.groundHours + num(e.hours)); g.grounds += 1; } else { g.hours = round2(g.hours + num(e.hours)); g.flights += 1; }
    g.entries.push(e);
  }
  return groups;
}

/** Shows only the first `limit` entries ("Show more" paging) but keeps every month's header totals computed from ALL of its entries, so a month cut in half by the page still reads its true hours. */
export function limitGroups(groups, limit) {
  let left = limit;
  const out = [];
  for (const g of groups) {
    if (left <= 0) break;
    out.push({ ...g, entries: g.entries.slice(0, left) });
    left -= g.entries.length;
  }
  return out;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** "6.00 h · 4 flights" plus, only when there are ground sessions, " · 1.80 h ground" — the header text for a month (or a run of rows). */
export function headerParts(g) {
  const h = (n) => n.toFixed(2);
  return { flight: `${h(g.hours)} h`, flights: plural(g.flights, 'flight', 'flights'), ground: g.grounds ? `${h(g.groundHours)} h ground · ${plural(g.grounds, 'session', 'sessions')}` : '' };
}

/** The one line under the totals strip, in explicit parts: "20 flights · 31.40 h · 6 ground sessions · 9.10 h" (ground part only when present). */
export function countsLine(entries, matching = false) {
  const t = summarize(entries), h = (n) => n.toFixed(2);
  const parts = [`${plural(t.flights, 'flight', 'flights')} · ${h(t.flightHours)} h`];
  if (t.grounds) parts.push(`${plural(t.grounds, 'ground session', 'ground sessions')} · ${h(t.groundHours)} h`);
  return (matching ? 'Matching: ' : '') + parts.join(' · ');
}

/** Passenger flights grouped by year (newest first), each with its hours and flight count. Passenger-only: ground sessions never appear here. */
export function groupByYear(passengerFlights) {
  const by = new Map();
  for (const f of [...passengerFlights].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)) {
    const y = f.date.slice(0, 4);
    if (!by.has(y)) by.set(y, { year: y, hours: 0, flights: 0, list: [] });
    const g = by.get(y); g.hours = round2(g.hours + num(f.total_time)); g.flights += 1; g.list.push(f);
  }
  return [...by.values()].sort((a, b) => b.year.localeCompare(a.year));
}

/** The row's headline and scannable details. A flight whose departure and arrival are the same airport is "Local · KSUS". */
export function rowLabels(e) {
  const d = e.data || {};
  if (e.kind === 'ground') return { title: 'Ground session', local: false, via: '', details: [d.topics, d.instructor].filter(Boolean).join(' · ') };
  const dep = (d.departure_airport || '').trim(), arr = (d.arrival_airport || '').trim();
  const local = Boolean(dep) && dep.toUpperCase() === arr.toUpperCase();
  const stops = flightStops(d).filter((s, i, a) => i > 0 && i < a.length - 1);
  return {
    title: local ? `Local · ${dep.toUpperCase()}` : `${dep || '—'} → ${arr || '—'}`,
    local,
    via: !local && stops.length ? stops.join(' · ') : '',
    details: [d.aircraft_type, d.tail_number, d.instructor ? `with ${d.instructor}` : ''].filter(Boolean).join(' · '),
  };
}

/**
 * What a calm list row shows: three pieces of information and no more. Primary (route or topics), secondary (the date, always, then the
 * tail or aircraft type) and one trailing value (the hours). Cost, instructor, landings and photos live in the detail.
 */
export function calmRow(e, fmtDate) {
  const d = e.data || {};
  if (e.kind === 'ground') {
    return { primary: d.topics?.trim() || 'Ground session', secondary: `${fmtDate(e.date)} · Ground session`, hours: num(e.hours), ground: true };
  }
  const l = rowLabels(e);
  return { primary: l.title, secondary: [fmtDate(e.date), d.tail_number || d.aircraft_type].filter(Boolean).join(' · '), hours: num(e.hours), ground: false };
}

/** Day and month abbreviation for the date block: "2026-09-28" -> { day: '28', mon: 'SEP' } (string based, never a Date). */
export function dateBlock(date) {
  const [, m, day] = date.split('-');
  return { day, mon: (MONTHS[Number(m) - 1] || '').slice(0, 3).toUpperCase() };
}

/** The removable chips for whatever is active: search text, date range, aircraft type, category, kind. */
export function activeChips(filters, query, categoryLabels = {}) {
  const chips = [];
  const q = String(query || '').trim();
  if (q) chips.push({ key: 'q', label: `“${q}”` });
  if (filters.kind && filters.kind !== 'all') chips.push({ key: 'kind', label: filters.kind === 'flight' ? 'Flights' : 'Ground' });
  if (filters.from || filters.to) chips.push({ key: 'range', label: `${filters.from || 'Any'} – ${filters.to || 'Any'}` });
  if (filters.tail) chips.push({ key: 'tail', label: filters.tail });
  if (filters.instructor) chips.push({ key: 'instructor', label: filters.instructor === SOLO_FILTER ? 'Solo' : initialSurname(filters.instructor) });
  if (filters.type) chips.push({ key: 'type', label: filters.type });
  if (filters.category) chips.push({ key: 'category', label: categoryLabels[filters.category] || filters.category });
  return chips;
}

/** What removing a chip does to the filters / query (returns the new { filters, query }). */
export function clearChip(key, filters, query) {
  const f = { ...filters };
  let q = query;
  if (key === 'q') q = '';
  if (key === 'kind') f.kind = 'all';
  if (key === 'range') { f.from = ''; f.to = ''; }
  if (key === 'tail') f.tail = '';
  if (key === 'instructor') f.instructor = '';
  if (key === 'type') f.type = '';
  if (key === 'category') f.category = '';
  return { filters: f, query: q };
}

/** The summary strip: pilot-only, flights only (ground sessions are not flight time), derived from the rows. Same total as Home. */
export function pilotTotals(pilotFlights, today) {
  const upTo = pilotFlights.filter((f) => f.date <= today);
  const cutoff = addDays(today, -365);
  return {
    total: round2(upTo.reduce((s, f) => s + num(f.total_time), 0)),
    last12: round2(pilotFlights.filter((f) => f.date >= cutoff && f.date <= today).reduce((s, f) => s + num(f.total_time), 0)),
    pic: round2(upTo.reduce((s, f) => s + num(f.pic_time), 0)),
    dual: round2(upTo.reduce((s, f) => s + num(f.dual_received), 0)),
    landings: upTo.reduce((s, f) => s + num(f.day_landings) + num(f.night_landings), 0),
  };
}

/** The value of the instructor filter that means "no instructor" (solo flights). */
export const SOLO_FILTER = '__solo';

/** Instructor names compare ignoring case and extra spaces. */
const nameKey = (n) => String(n || '').trim().replace(/\s+/g, ' ').toLowerCase();

/** Every instructor used in the rows (flights and ground sessions), most frequent first, then alphabetical; each with its count. Derived, never stored. */
export function instructorCounts(entries) {
  const by = new Map();
  for (const e of entries) {
    const name = String(e.data?.instructor || '').trim().replace(/\s+/g, ' ');
    if (!name) continue;
    const c = by.get(nameKey(name)) ?? { name, count: 0 };
    c.count += 1; by.set(nameKey(name), c);
  }
  return [...by.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** The usual instructor: the most frequent one in the data ('' when there is none). A row shows its instructor only when it differs from this. */
export const usualInstructor = (entries) => instructorCounts(entries)[0]?.name || '';

/** Does a row pass the instructor filter? '' passes everything, SOLO_FILTER passes flights with solo time (what a row's "Solo" means), otherwise the name must match. */
export function matchesInstructor(e, filter) {
  if (!filter) return true;
  const name = nameKey(e.data?.instructor);
  if (filter === SOLO_FILTER) return e.kind === 'flight' && num(e.data?.solo_time) > 0;
  return name === nameKey(filter);
}

/** "Pat Rivera" -> "P. Rivera" (first initial and surname, so two instructors sharing a surname can't be confused); a single name stays as it is. */
export function initialSurname(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || '';
  return `${parts[0][0].toUpperCase()}. ${parts[parts.length - 1]}`;
}

/**
 * A row of the minimalist list (docs/design/DESIGN_LANGUAGE.md "Minimalism rules"): at most six words (primary, secondary, trailing hours).
 * The date block shows the day numeral under its month header, or the full date when `fullDate` (search, filters, a sort that is not by date);
 * either way `label` (the accessible name) and `date` carry the full MM/DD/YYYY. The second line is the tail number (the "which airplane" cue)
 * and the instructor. A flight from and to the same airport shows the airport once with a loop icon ("local KSUS" in the accessible name).
 */
export function minimalRow(e, formatDate) {
  const d = e.data || {};
  const date = formatDate(e.date);
  const day = e.date.slice(8, 10);
  const hours = num(e.hours);
  const instructor = (d.instructor || '').trim();
  // The instructor reads "P. Rivera" when the row stays within its six words (primary, secondary, hours; the date block is not charged), else the
  // surname alone. The full name is in the accessible name and the detail.
  const surname = instructor.split(/\s+/).filter(Boolean).slice(-1)[0] || '';
  const fits = (primary, tail) => countWords(primary) + countWords([tail, initialSurname(instructor)].filter(Boolean).join(' · ')) + 1 <= ROW_MAX_WORDS;
  if (e.kind === 'ground') {
    return {
      day, date, primary: 'Ground', secondary: fits('Ground', '') ? initialSurname(instructor) : surname, hours, ground: true,
      label: [date, 'ground session', (d.topics || '').trim(), instructor && `instructor ${instructor}`, `${hours.toFixed(2)} hours`].filter(Boolean).join(', '),
    };
  }
  const l = rowLabels(e);
  const dep = (d.departure_airport || '').trim().toUpperCase(), arr = (d.arrival_airport || '').trim().toUpperCase();
  const tail = (d.tail_number || '').trim() || (d.aircraft_type || '').trim();
  // A local flight shows the airport once, with a loop icon (the row's `local` flag) instead of the word "Local": the same meaning, no words.
  const primary = l.local ? dep : l.title;
  return {
    day, date, hours, ground: false, local: l.local,
    primary,
    secondary: [tail, fits(primary, tail) ? initialSurname(instructor) : surname].filter(Boolean).join(' · '),
    label: [date, l.local ? `local ${dep}` : `${dep || 'unknown'} to ${arr || 'unknown'}`, tail, instructor && `instructor ${instructor}`, `${hours.toFixed(2)} hours`].filter(Boolean).join(', '),
  };
}

/** The tail numbers flown (blank tails skipped), alphabetical, each with its flight hours, flight count and last flight date: derived from the rows, never stored. */
export function fleetChips(pilotFlights) {
  const by = new Map();
  for (const f of pilotFlights) {
    const tail = (f.tail_number || '').trim();
    if (!tail) continue;
    const c = by.get(tail) ?? { tail, hours: 0, flights: 0, last: '' };
    c.hours = round2(c.hours + num(f.total_time)); c.flights += 1; if ((f.date || '') > c.last) c.last = f.date || ''; by.set(tail, c);
  }
  return [...by.values()].sort((a, b) => a.tail.localeCompare(b.tail));
}

/** The few aircraft shown as chips (the word budget): the `n` most recently flown, alphabetical, plus the one currently filtered on. The rest are one tap away. */
export function recentFleet(fleet, n = 3, selectedTail = '') {
  const keep = new Set([...fleet].sort((a, b) => b.last.localeCompare(a.last) || a.tail.localeCompare(b.tail)).slice(0, n).map((c) => c.tail));
  if (selectedTail) keep.add(selectedTail);
  return fleet.filter((c) => keep.has(c.tail));
}

/** True when the list should show the full date on each row instead of the bare day numeral: any search or filter, or a sort that is not by date. */
export const showsFullDate = (query, filters, sort) => Boolean(String(query || '').trim()) || sort === 'longest'
  || Boolean(filters && (filters.from || filters.to || filters.type || filters.category || filters.tail || filters.instructor || (filters.kind && filters.kind !== 'all')));

/**
 * A row of the calm list (B-calm): the day (or the full date), the tail, the instructor muted as "P. Rivera" only when it differs from the usual one (the most
 * frequent in the data; "Solo" when a flight has none), the route (muted) only when departure and arrival differ, and the hours. A local flight is the default and carries no marker; its accessible name says "Local flight at KSUS". The accessible name
 * always carries the full MM/DD/YYYY, the instructor's full name and the hours.
 */
export function calmRowModel(e, formatDate, usual = '') {
  const d = e.data || {};
  const date = formatDate(e.date);
  const hours = num(e.hours);
  const instructor = (d.instructor || '').trim();
  const h = `${hours.toFixed(2)} hours`;
  if (e.kind === 'ground') {
    return { day: e.date.slice(8, 10), date, tail: '', who: instructor && nameKey(instructor) !== nameKey(usual) ? initialSurname(instructor) : '', route: '', hours, ground: true, local: false,
      label: [date, 'ground session', (d.topics || '').trim(), instructor && `instructor ${instructor}`, h].filter(Boolean).join(', ') };
  }
  const l = rowLabels(e);
  const dep = (d.departure_airport || '').trim().toUpperCase(), arr = (d.arrival_airport || '').trim().toUpperCase();
  const tail = (d.tail_number || '').trim() || (d.aircraft_type || '').trim();
  return {
    day: e.date.slice(8, 10), date, tail, who: instructor ? (nameKey(instructor) !== nameKey(usual) ? initialSurname(instructor) : '') : num(d.solo_time) > 0 ? 'Solo' : '', route: l.local ? '' : l.title, hours, ground: false, local: l.local,
    label: [date, l.local ? `Local flight at ${dep}` : `${dep || 'unknown'} to ${arr || 'unknown'}`, tail, instructor && `instructor ${instructor}`, h].filter(Boolean).join(', '),
  };
}

/**
 * A row of the calm Travel list: three items only, the date (MM/DD under its year header, the full date in search results and the accessible name), the route and
 * the hours. The airline and flight number stay in the accessible name and the detail. Passenger hours are never mixed into the logbook.
 */
export function travelRowModel(f, formatDate) {
  const date = formatDate(f.date);
  const from = (f.departure_airport || '').trim().toUpperCase() || '—', to = (f.arrival_airport || '').trim().toUpperCase() || '—';
  const hours = num(f.total_time);
  return {
    day: date.slice(0, 5), date, tail: `${from} → ${to}`, who: '', route: '', hours, ground: false, local: false,
    label: [date, `${from} to ${to}`, [f.airline, f.flight_number].filter(Boolean).join(' '), `${hours.toFixed(2)} hours as passenger`].filter(Boolean).join(', '),
  };
}

/** Which years are open: with a search or filter every matching year (unless closed), else the ones opened this session, else the current year (or the newest year if there is no flight in it). */
export function defaultOpenYears(years, currentYear) {
  if (!years.length) return new Set();
  return new Set([years.includes(currentYear) ? currentYear : years[0]]);
}

/** The name on a month's line: just the month, with the year added only when the list spans more than one year. */
export const monthLineName = (group, multiYear) => (multiYear ? group.label : group.label.split(' ')[0]);

/** Is a month open? With a search or filter active every matching month is open unless the person closed it; otherwise only the months they opened (the newest by default). */
export function monthIsOpen({ key, filterActive, openKeys, closedUnderFilter }) {
  return filterActive ? !closedUnderFilter.has(key) : openKeys.has(key);
}

/** "Good evening, Akshaj": one calm line (morning 5 to 12, afternoon 12 to 17, otherwise evening). */
export function calmGreeting(date, name) {
  const h = date.getHours();
  const part = h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : 'evening';
  return `Good ${part}${name ? `, ${name}` : ''}`;
}
