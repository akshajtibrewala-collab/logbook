import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useMatch, useNavigate } from 'react-router-dom';
import { Luggage, SlidersHorizontal } from 'lucide-react';
import { api } from '../lib/api.js';
import { fmtHours } from '../lib/hours.js';
import { flightCodes } from '../lib/flightpath.js';
import { buildMapData } from '../lib/mapdata.js';
import { visitedCounts } from '../lib/mapstyle.js';
import { labelFor, SEAT_CLASSES } from '../lib/aviationEnums.js';
import { formatDate as fmtDate } from '../lib/calendar.js';
import AirlineBadge from '../components/AirlineBadge.jsx';
import Card from '../components/Card.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorNote from '../components/ErrorNote.jsx';
import EmptyState from '../components/EmptyState.jsx';
import AddFab from '../components/AddFab.jsx';
import Button from '../components/Button.jsx';
import FlightRoleTabs from '../components/FlightRoleTabs.jsx';

const selectCls = 'h-12 w-full rounded-xl border border-edge bg-navy-800 px-3 text-base outline-none focus:border-accent';

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

export default function PassengerFlights() {
  const navigate = useNavigate();
  const flightMatch = useMatch('/travel/:id');
  const selected = flightMatch ? flightMatch.params.id : null;

  const [flights, setFlights] = useState(null);
  const [airports, setAirports] = useState({});
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ year: '', airline: '' });

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
      return true;
    });
  }, [flights, filters]);

  const grouped = useMemo(() => {
    const byYear = new Map();
    for (const f of [...visible].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)) {
      const y = f.date.slice(0, 4);
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y).push(f);
    }
    return [...byYear.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [visible]);

  const mapData = useMemo(() => buildMapData(visible, airports), [visible, airports]);
  const summary = useMemo(() => {
    const counts = visitedCounts(mapData.stops);
    return {
      flights: visible.length,
      hours: visible.reduce((s, f) => s + (Number(f.total_time) || 0), 0),
      airports: counts.airports,
      countries: counts.regionsKnown ? counts.countries : null,
      airlines: new Set(visible.map((f) => f.airline).filter(Boolean)).size,
      aircraft: new Set(visible.map((f) => f.aircraft_type).filter(Boolean)).size,
    };
  }, [visible, mapData]);

  const activeFilters = Object.values(filters).filter(Boolean).length;

  return (
    <div className="lg:flex lg:items-start lg:gap-6">
      <div className={`${selected ? 'hidden lg:block' : 'block'} lg:w-[380px] lg:shrink-0`}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Passenger flights</h1>
        </div>

        <FlightRoleTabs />

        {flights && flights.length > 0 && (
          <div className="mt-3 hidden md:flex">
            <Link to="/logbook/new?role=passenger&from=travel" className="flex h-11 flex-1 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-ink">Add flight</Link>
          </div>
        )}

        {flights && flights.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-3 card p-4">
            <Stat label="Flights" value={summary.flights} />
            <Stat label={summary.hours === 1 ? 'hour' : 'hours'} value={fmtHours(summary.hours)} />
            <Stat label={summary.airports === 1 ? 'airport' : 'airports'} value={summary.airports} />
            {summary.countries !== null && <Stat label={summary.countries === 1 ? 'country' : 'countries'} value={summary.countries} />}
            <Stat label={summary.airlines === 1 ? 'airline' : 'airlines'} value={summary.airlines} />
            <Stat label="aircraft types" value={summary.aircraft} />
          </div>
        )}

        {flights && flights.length > 0 && (
          <div className="mt-3 flex gap-2">
            <button onClick={() => setShowFilters((s) => !s)}
              className={`h-12 flex-1 rounded-xl border px-4 text-sm ${activeFilters ? 'border-accent text-accent' : 'border-edge text-slate-300'}`}>
              <SlidersHorizontal size={16} className="mr-2 inline" />Filter{activeFilters ? ` (${activeFilters})` : ''}
            </button>
          </div>
        )}

        {showFilters && flights && flights.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-3 card p-4">
            <label className="text-xs text-slate-400">Year
              <select value={filters.year} onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))} className={`${selectCls} mt-1`}>
                <option value="">All</option>{years.map((y) => <option key={y}>{y}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-400">Airline
              <select value={filters.airline} onChange={(e) => setFilters((f) => ({ ...f, airline: e.target.value }))} className={`${selectCls} mt-1`}>
                <option value="">All</option>{airlines.map((a) => <option key={a}>{a}</option>)}
              </select>
            </label>
            {activeFilters > 0 && (
              <button onClick={() => setFilters({ year: '', airline: '' })} className="col-span-2 h-10 text-sm text-accent">Clear filters</button>
            )}
          </div>
        )}

        {error && <div className="mt-4"><ErrorNote message={error} onRetry={load} /></div>}
        {!flights && !error && (
          <div className="mt-4 space-y-2"><Skeleton className="h-[4.5rem]" /><Skeleton className="h-[4.5rem]" /><Skeleton className="h-[4.5rem]" /></div>
        )}

        {flights && flights.length === 0 && (
          <EmptyState icon={Luggage} title="No passenger flights yet."
            description="Riding along, not flying — commercial trips, anything you weren't the pilot on. They show up here, on the map and in your travel history, but never in your logbook hours."
            action={<Button as={Link} to="/logbook/new?role=passenger&from=travel" size="md">Add flight</Button>} />
        )}
        {flights && flights.length > 0 && visible.length === 0 && (
          <EmptyState title="Nothing matches these filters." />
        )}

        <div className="stagger mt-4 space-y-4">
          {grouped.map(([year, yearFlights]) => (
            <div key={year}>
              <h2 className="mb-2 text-sm font-medium text-slate-400">{year}</h2>
              <ul className="space-y-2">
                {yearFlights.map((f) => (
                  <li key={f.id}>
                    <Card as="button" onClick={() => navigate(`/travel/${f.id}`)} aria-current={selected === String(f.id) ? 'true' : undefined}
                      className={`w-full text-left transition duration-150 active:scale-[0.985] active:bg-navy-800 ${selected === String(f.id) ? 'lg:border-accent' : ''}`}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-base font-medium">{f.departure_airport || '—'} → {f.arrival_airport || '—'}</span>
                        <span className="shrink-0 text-lg font-semibold text-accent">{fmtHours(f.total_time)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-sm text-slate-400">
                        <span className="flex min-w-0 items-center gap-1.5">
                          {f.airline && <AirlineBadge airline={f.airline} />}
                          <span className="truncate">{fmtDate(f.date)}{f.flight_number ? ` · ${f.flight_number}` : ''}</span>
                        </span>
                      </div>
                      {(f.aircraft_type || f.tail_number || f.seat_class || (f.dep_time && f.arr_time)) && (
                        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">
                          {(f.aircraft_type || f.tail_number) && <span>{[f.aircraft_type, f.tail_number].filter(Boolean).join(' · ')}</span>}
                          {f.seat_class && <span>{labelFor(SEAT_CLASSES, f.seat_class)}</span>}
                          {f.dep_time && f.arr_time && (
                            <span>{f.dep_time} → {f.arr_time}{f.arr_day_offset > 0 ? ` +${f.arr_day_offset}` : ''}</span>
                          )}
                        </div>
                      )}
                    </Card>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {flights && flights.length > 0 && (
          <AddFab onClick={() => navigate('/logbook/new?role=passenger&from=travel')} label="Add passenger flight" />
        )}
      </div>

      <div className={`${selected ? 'block' : 'hidden lg:block'} min-w-0 flex-1`}>
        {selected ? <Outlet /> : (
          <div className="sticky top-10 hidden flex-col items-center justify-center rounded-2xl border border-dashed border-edge p-12 text-center text-slate-500 lg:flex">
            <Luggage size={32} strokeWidth={1.5} className="mb-3 text-slate-600" />
            <p className="text-sm">Select a flight to see its details here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
