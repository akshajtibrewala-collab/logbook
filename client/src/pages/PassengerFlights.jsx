import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useMatch } from 'react-router-dom';
import { CalendarDays, Luggage, Search, SlidersHorizontal } from 'lucide-react';
import { api } from '../lib/api.js';
import { fmtHours } from '../lib/hours.js';
import { flightCodes } from '../lib/flightpath.js';
import { buildMapData } from '../lib/mapdata.js';
import { visitedCounts } from '../lib/mapstyle.js';
import { distinctAircraftTypeCount } from '../lib/aircraftTypes.js';
import { defaultOpenYears, groupByYear, matchesQuery, monthIsOpen, travelRowModel } from '../lib/logbookList.js';
import { formatDate as fmtDate, todayISO } from '../lib/calendar.js';
import ErrorNote from '../components/ErrorNote.jsx';
import Button from '../components/Button.jsx';
import { FilterChips, SearchField } from '../components/logbook/SearchBar.jsx';
import { BcHero, BcMonth, BcRow } from '../components/bc/Bc.jsx';
import { MnEmpty, MnKv, MnSkeleton } from '../components/mn/Mn.jsx';
import { Sheet } from '../ds/Overlays.jsx';
import '../ds/logbook.css';
import '../ds/bcalm.css';

const OPEN_KEY = 'aerohub-open-years'; // the years you opened, remembered for the session only
const loadOpen = () => { try { const s = sessionStorage.getItem(OPEN_KEY); return s ? new Set(JSON.parse(s)) : null; } catch { return null; } };
const saveOpen = (set) => { try { sessionStorage.setItem(OPEN_KEY, JSON.stringify([...set])); } catch { /* session memory is a nicety */ } };

/**
 * Travel (passenger flights) in the calm system: one hero (hours as passenger, a violet dot), one control row, one solid surface per year (the current year
 * open, earlier years one line each), three items per row. Passenger hours never count toward logbook hours. Year headers sum to the hero.
 */
export default function PassengerFlights() {
  const flightMatch = useMatch('/travel/:id');
  const selected = flightMatch ? flightMatch.params.id : null;

  const [flights, setFlights] = useState(null);
  const [airports, setAirports] = useState({});
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(false);
  const [totalsOpen, setTotalsOpen] = useState(false);
  const [jumpSheet, setJumpSheet] = useState(false);
  const [filters, setFilters] = useState({ year: '', airline: '' });
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [openKeys, setOpenKeys] = useState(loadOpen);
  const [closedUnderFilter, setClosedUnderFilter] = useState(() => new Set());
  const [scrollTo, setScrollTo] = useState(null);

  const load = useCallback(() => {
    setError('');
    (async () => {
      const list = await api.listFlights();
      const passenger = list.filter((f) => f.role === 'passenger');
      const codes = [...new Set(passenger.flatMap(flightCodes))];
      setAirports(codes.length ? await api.resolveAirports(codes) : {});
      setFlights(passenger);
    })().catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const years = useMemo(() => [...new Set((flights ?? []).map((f) => f.date.slice(0, 4)))].sort().reverse(), [flights]);
  const airlines = useMemo(() => [...new Set((flights ?? []).map((f) => f.airline).filter(Boolean))].sort(), [flights]);

  const visible = useMemo(() => {
    if (!flights) return [];
    return flights.filter((f) => {
      if (filters.year && f.date.slice(0, 4) !== filters.year) return false;
      if (filters.airline && f.airline !== filters.airline) return false;
      return matchesQuery({ kind: 'flight', data: f }, query);
    });
  }, [flights, filters, query]);

  const grouped = useMemo(() => groupByYear(visible), [visible]);

  const mapData = useMemo(() => buildMapData(visible, airports), [visible, airports]);
  const summary = useMemo(() => {
    const counts = visitedCounts(mapData.stops);
    return {
      flights: visible.length,
      hours: visible.reduce((s, f) => s + (Number(f.total_time) || 0), 0),
      airports: counts.airports,
      countries: counts.countries,
      airlines: new Set(visible.map((f) => f.airline).filter(Boolean)).size,
      aircraft: distinctAircraftTypeCount(visible),
    };
  }, [visible, mapData]);

  const chips = [
    ...(query.trim() ? [{ key: 'q', label: `“${query.trim()}”` }] : []),
    ...(filters.year ? [{ key: 'year', label: filters.year }] : []),
    ...(filters.airline ? [{ key: 'airline', label: filters.airline }] : []),
  ];
  const removeChip = (key) => { if (key === 'q') setQuery(''); else setFilters((f) => ({ ...f, [key]: '' })); };
  const clearAll = () => { setFilters({ year: '', airline: '' }); setQuery(''); setClosedUnderFilter(new Set()); };
  const filterCount = chips.filter((c) => c.key !== 'q').length;
  const filterActive = chips.length > 0;

  const openSet = openKeys ?? defaultOpenYears(grouped.map((g) => g.year), todayISO().slice(0, 4));
  const isOpen = (year) => monthIsOpen({ key: year, filterActive, openKeys: openSet, closedUnderFilter });
  const toggleYear = (year) => {
    if (filterActive) setClosedUnderFilter((s) => { const n = new Set(s); if (n.has(year)) n.delete(year); else n.add(year); return n; });
    else { const n = new Set(openSet); if (n.has(year)) n.delete(year); else n.add(year); setOpenKeys(n); saveOpen(n); }
  };
  const jumpTo = (year) => {
    if (filterActive) setClosedUnderFilter((s) => { const n = new Set(s); n.delete(year); return n; });
    else { const n = new Set(openSet); n.add(year); setOpenKeys(n); saveOpen(n); }
    setJumpSheet(false); setScrollTo(year);
  };
  useEffect(() => {
    if (!scrollTo) return undefined;
    const t = setTimeout(() => { document.getElementById(`y-${scrollTo}`)?.scrollIntoView({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); setScrollTo(null); }, 380);
    return () => clearTimeout(t);
  }, [scrollTo]);

  const fullDate = filterActive;
  const hero = flights && flights.length > 0 ? (
    <BcHero label="Passenger" dot="pax" number={summary.hours} ariaLabel={`Passenger: ${fmtHours(summary.hours)} hours as passenger. Open totals`} onClick={() => setTotalsOpen(true)} />
  ) : !error && !flights && <MnSkeleton rows={1} />;

  return (
    <div className="cl bc pax role-pax-scope">
      <div className={`bc-cols${selected ? ' has-sel' : ''}`}>
        <div className="bc-side">{selected ? <Outlet /> : hero}</div>

        <div className="bc-list">
          {flights && flights.length > 0 && (
            <div className="bc-ctl start">
              <span className="ic2">
                {grouped.length > 1 && <button type="button" className="gl clear icon" aria-label="Jump to a year" title="Jump to a year" onClick={() => setJumpSheet(true)}><CalendarDays className="ds-i" aria-hidden="true" /></button>}
                <button type="button" className="gl clear icon" aria-label="Search" title="Search" aria-pressed={searchOpen || Boolean(query)} onClick={() => setSearchOpen((o) => !o)}><Search className="ds-i" aria-hidden="true" /></button>
                <button type="button" className="gl clear icon" aria-label={`Filter${filterCount ? ` (${filterCount} active)` : ''}`} title="Filter" aria-pressed={filterCount > 0} onClick={() => setSheet(true)}><SlidersHorizontal className="ds-i" aria-hidden="true" /></button>
              </span>
            </div>
          )}
          {(searchOpen || query) && <SearchField query={query} onQuery={setQuery} autoFocus={searchOpen && !query} placeholder="Search flights" label="Search by route, airport, airline, flight number, aircraft type or tail number" />}
          <FilterChips chips={chips} onRemove={removeChip} pax />

          {error && <ErrorNote message={error} onRetry={load} />}
          {!flights && !error && <MnSkeleton />}

          {flights && flights.length === 0 && (
            <MnEmpty title="No passenger flights yet" icon={<Luggage />} action={<Button as={Link} to="/logbook/new?role=passenger&from=travel" variant="pax" size="lg">Add a flight</Button>} />
          )}
          {flights && flights.length > 0 && visible.length === 0 && (
            <MnEmpty title="No matches" icon={<Search />} action={<Button variant="secondary" onClick={clearAll}>Clear filters</Button>} />
          )}

          {grouped.map((g) => (
            <BcMonth key={g.year} id={`y-${g.year}`} name={g.year} hours={g.hours} unit="hours as passenger" extra={`${g.flights} flight${g.flights === 1 ? '' : 's'}`} surface open={isOpen(g.year)} onToggle={() => toggleYear(g.year)}>
              {g.list.map((f) => <BcRow key={f.id} to={`/travel/${f.id}`} row={travelRowModel(f, fmtDate)} wide fullDate={fullDate} selected={selected === String(f.id)} />)}
            </BcMonth>
          ))}
        </div>
      </div>

      <Sheet open={totalsOpen} onClose={() => setTotalsOpen(false)} title="Passenger totals" detent="medium">
        <div className="cl pax mn mn-sheet">
          <MnKv k="Hours" v={`${fmtHours(summary.hours)} h`} />
          <MnKv k="Flights" v={summary.flights} />
          <MnKv k={summary.airports === 1 ? 'Airport' : 'Airports'} v={summary.airports} />
          <MnKv k={summary.countries === 1 ? 'Country' : 'Countries'} v={summary.countries} />
          <MnKv k={summary.airlines === 1 ? 'Airline' : 'Airlines'} v={summary.airlines} />
          <MnKv k="Aircraft types" v={summary.aircraft} />
          <p className="mn-note">As passenger only. These hours never count toward your logbook, currency or milestones.</p>
          <Button as={Link} to="/map" variant="secondary" onClick={() => setTotalsOpen(false)}>See them on the map</Button>
        </div>
      </Sheet>

      <Sheet open={jumpSheet} onClose={() => setJumpSheet(false)} title="Jump to a year" detent="medium">
        <div className="cl pax mn mn-sheet">
          {grouped.map((g) => (
            <button key={g.year} type="button" className="bc-pickrow" aria-current={isOpen(g.year) ? 'true' : undefined} aria-label={`${g.year}, ${fmtHours(g.hours)} hours as passenger, ${g.flights} flight${g.flights === 1 ? '' : 's'}`} onClick={() => jumpTo(g.year)}>
              <span>{g.year}</span><span className="r">{fmtHours(g.hours)}</span>
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Filter" detent="medium">
        <div className="cl pax mn mn-sheet">
          <label className="mn-field"><span className="l">Year</span>
            <select value={filters.year} onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))} className="gl-select">
              <option value="">All</option>{years.map((y) => <option key={y}>{y}</option>)}
            </select>
          </label>
          <label className="mn-field"><span className="l">Airline</span>
            <select value={filters.airline} onChange={(e) => setFilters((f) => ({ ...f, airline: e.target.value }))} className="gl-select">
              <option value="">All</option>{airlines.map((a) => <option key={a}>{a}</option>)}
            </select>
          </label>
          <Button variant="pax" size="lg" onClick={() => setSheet(false)}>Show {visible.length}</Button>
          {chips.length > 0 && <Button variant="ghost" size="sm" onClick={clearAll}>Clear all</Button>}
        </div>
      </Sheet>
    </div>
  );
}
