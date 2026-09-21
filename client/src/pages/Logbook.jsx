import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Plane, SlidersHorizontal, ArrowLeftRight } from 'lucide-react';
import { api } from '../lib/api.js';
import { fmtHours } from '../lib/hours.js';
import AirlineBadge from '../components/AirlineBadge.jsx';
import DatePicker from '../components/DatePicker.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorNote from '../components/ErrorNote.jsx';

const CATEGORIES = [
  ['pic_time', 'PIC'], ['sic_time', 'SIC'], ['dual_received', 'Dual'], ['solo_time', 'Solo'],
  ['night_time', 'Night'], ['cross_country_time', 'Cross-country'],
  ['instrument_actual', 'Instrument (actual)'], ['instrument_simulated', 'Instrument (sim)'],
];
const SORTS = {
  newest: (a, b) => b.date.localeCompare(a.date) || b.id - a.id,
  oldest: (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
  longest: (a, b) => b.total_time - a.total_time,
};

const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const selectCls = 'h-12 w-full rounded-xl border border-edge bg-navy-800 px-3 text-base outline-none focus:border-accent';

export default function Logbook() {
  const navigate = useNavigate();
  const [flights, setFlights] = useState(null);
  const [error, setError] = useState('');
  const [sort, setSort] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ from: '', to: '', type: '', category: '' });

  const load = useCallback(() => {
    setError('');
    api.listFlights().then(setFlights).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const types = useMemo(() => [...new Set((flights ?? []).map((f) => f.aircraft_type).filter(Boolean))].sort(), [flights]);

  const visible = useMemo(() => {
    if (!flights) return [];
    const { from, to, type, category } = filters;
    return flights
      .filter((f) => (!from || f.date >= from) && (!to || f.date <= to) && (!type || f.aircraft_type === type) && (!category || f[category] > 0))
      .sort(SORTS[sort]);
  }, [flights, filters, sort]);

  const activeFilters = Object.values(filters).filter(Boolean).length;
  const total = visible.reduce((s, f) => s + f.total_time, 0);
  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Logbook</h1>
        <Link to="/logbook/data" aria-label="Import and export" className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800 text-slate-300 active:text-accent">
          <ArrowLeftRight size={20} />
        </Link>
      </div>

      <div className="mt-4 flex gap-2">
        <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectCls} aria-label="Sort">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="longest">Longest first</option>
        </select>
        <button onClick={() => setShowFilters((s) => !s)}
          className={`h-12 shrink-0 rounded-xl border px-4 text-sm ${activeFilters ? 'border-accent text-accent' : 'border-edge text-slate-300'}`}>
          <SlidersHorizontal size={16} className="mr-2 inline" />Filter{activeFilters ? ` (${activeFilters})` : ''}
        </button>
      </div>

      {showFilters && (
        <div className="mt-3 grid grid-cols-2 gap-3 card p-4">
          <DatePicker label="From" clearable placeholder="Any" value={filters.from} onChange={(v) => setFilters((f) => ({ ...f, from: v }))} />
          <DatePicker label="To" clearable placeholder="Any" value={filters.to} onChange={(v) => setFilters((f) => ({ ...f, to: v }))} />
          <label className="text-xs text-slate-400">Aircraft
            <select value={filters.type} onChange={setFilter('type')} className={`${selectCls} mt-1`}>
              <option value="">All</option>{types.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400">Category
            <select value={filters.category} onChange={setFilter('category')} className={`${selectCls} mt-1`}>
              <option value="">All</option>{CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          {activeFilters > 0 && (
            <button onClick={() => setFilters({ from: '', to: '', type: '', category: '' })} className="col-span-2 h-10 text-sm text-accent">Clear filters</button>
          )}
        </div>
      )}

      {error && <div className="mt-4"><ErrorNote message={error} onRetry={load} /></div>}
      {!flights && !error && (
        <div className="mt-4 space-y-2"><Skeleton className="h-[4.5rem]" /><Skeleton className="h-[4.5rem]" /><Skeleton className="h-[4.5rem]" /></div>
      )}
      {flights && (
        <p className="mt-4 text-sm text-slate-400">{visible.length} flight{visible.length === 1 ? '' : 's'} · {fmtHours(total)} h</p>
      )}

      <ul className="stagger mt-2 space-y-2">
        {visible.map((f) => (
          <li key={f.id}>
            <button onClick={() => navigate(`/logbook/${f.id}`)}
              className="w-full card p-4 text-left transition duration-150 active:scale-[0.985] active:bg-navy-800">
              <div className="flex items-baseline justify-between">
                <span className="text-base font-medium">{f.departure_airport || '—'} → {f.arrival_airport || '—'}</span>
                <span className="text-lg font-semibold text-accent">{fmtHours(f.total_time)}</span>
              </div>
              <div className="mt-1 flex justify-between text-sm text-slate-400">
                <span>{fmtDate(f.date)}{f.route ? ` · via ${f.route}` : ''}</span>
                <span className="flex items-center gap-2">
                  {f.airline && <AirlineBadge airline={f.airline} />}
                  {[f.aircraft_type, f.tail_number].filter(Boolean).join(' · ')}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {flights && flights.length === 0 && (
        <div className="mt-16 text-center text-slate-400">
          <Plane size={40} strokeWidth={1.5} className="mx-auto text-slate-600" />
          <p className="mt-3">No flights logged yet.</p>
          <p className="text-sm">Tap the + button to add your first one.</p>
        </div>
      )}
      {flights && flights.length > 0 && visible.length === 0 && (
        <p className="mt-10 text-center text-slate-400">No flights match these filters.</p>
      )}

      <Link to="/logbook/new" aria-label="Add flight"
        className="fixed bottom-24 right-5 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-ink shadow-lg shadow-accent/30 active:scale-95 active:bg-accent-dark">
        <Plus size={28} strokeWidth={2.25} />
      </Link>
    </div>
  );
}
