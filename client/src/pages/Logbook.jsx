import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useMatch, useNavigate } from 'react-router-dom';
import { Plus, Plane, SlidersHorizontal, ArrowLeftRight, PlaneTakeoff, BookOpen, DollarSign, GraduationCap } from 'lucide-react';
import { api, fetchAllRates } from '../lib/api.js';
import { fmtHours } from '../lib/hours.js';
import { computeFlightCost, computeGroundSessionCost, fmtMoney } from '../lib/cost.js';
import AirlineBadge from '../components/AirlineBadge.jsx';
import DatePicker from '../components/DatePicker.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorNote from '../components/ErrorNote.jsx';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';
import { formatDate as fmtDate } from '../lib/calendar.js';

const CATEGORIES = [
  ['pic_time', 'PIC'], ['sic_time', 'SIC'], ['dual_received', 'Dual'], ['solo_time', 'Solo'],
  ['night_time', 'Night'], ['cross_country_time', 'Cross-country'],
  ['instrument_actual', 'Instrument (actual)'], ['instrument_simulated', 'Instrument (sim)'],
];
const KINDS = [['all', 'All'], ['flight', 'Flights'], ['ground', 'Ground']];
const SORTS = {
  newest: (a, b) => b.date.localeCompare(a.date) || b.id - a.id,
  oldest: (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
  longest: (a, b) => b.hours - a.hours,
};


const selectCls = 'h-12 w-full rounded-xl border border-edge bg-navy-800 px-3 text-base outline-none focus:border-accent';

function LogChoiceModal({ open, onClose }) {
  const navigate = useNavigate();
  return (
    <Modal open={open} onClose={onClose} title="Log">
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => navigate('/logbook/new')}
          className="flex flex-col items-center gap-2 rounded-2xl border border-edge p-5 active:bg-navy-800">
          <Plane size={28} className="text-accent" />
          <span className="text-sm font-medium">Log flight</span>
        </button>
        <button type="button" onClick={() => navigate('/logbook/ground/new')}
          className="flex flex-col items-center gap-2 rounded-2xl border border-edge p-5 active:bg-navy-800">
          <GraduationCap size={28} className="text-accent" />
          <span className="text-sm font-medium">Log ground session</span>
        </button>
      </div>
    </Modal>
  );
}

export default function Logbook() {
  const navigate = useNavigate();
  const flightMatch = useMatch('/logbook/:id');
  const groundMatch = useMatch('/logbook/ground/:id');
  const selected = groundMatch ? { kind: 'ground', id: groundMatch.params.id } : flightMatch ? { kind: 'flight', id: flightMatch.params.id } : null;
  const [flights, setFlights] = useState(null);
  const [groundSessions, setGroundSessions] = useState(null);
  const [rates, setRates] = useState(null);
  const [phases, setPhases] = useState(null);
  const [error, setError] = useState('');
  const [sort, setSort] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ from: '', to: '', type: '', category: '', kind: 'all' });
  const [showLogChoice, setShowLogChoice] = useState(false);

  const load = useCallback(() => {
    setError('');
    Promise.all([api.listFlights(), api.listGroundSessions()])
      .then(([f, g]) => { setFlights(f); setGroundSessions(g); })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);
  useEffect(() => { fetchAllRates().then(setRates).catch(() => {}); }, []);
  useEffect(() => { api.listTrainingPhases().then(setPhases).catch(() => {}); }, []);

  const types = useMemo(() => [...new Set((flights ?? []).map((f) => f.aircraft_type).filter(Boolean))].sort(), [flights]);

  const entries = useMemo(() => {
    if (!flights || !groundSessions) return null;
    return [
      ...flights.map((f) => ({ kind: 'flight', id: f.id, date: f.date, hours: f.total_time, data: f })),
      ...groundSessions.map((g) => ({ kind: 'ground', id: g.id, date: g.date, hours: g.hours, data: g })),
    ];
  }, [flights, groundSessions]);

  const visible = useMemo(() => {
    if (!entries) return [];
    const { from, to, type, category, kind } = filters;
    return entries
      .filter((e) => {
        if (kind !== 'all' && e.kind !== kind) return false;
        if (from && e.date < from) return false;
        if (to && e.date > to) return false;
        if (type && (e.kind !== 'flight' || e.data.aircraft_type !== type)) return false;
        if (category && (e.kind !== 'flight' || !(e.data[category] > 0))) return false;
        return true;
      })
      .sort(SORTS[sort]);
  }, [entries, filters, sort]);

  const costFor = (e) => (rates && phases
    ? (e.kind === 'flight' ? computeFlightCost(e.data, rates, phases) : computeGroundSessionCost(e.data, rates, phases))
    : null);

  const activeFilters = Object.entries(filters).filter(([k, v]) => v && !(k === 'kind' && v === 'all')).length;
  const total = visible.reduce((s, e) => s + e.hours, 0);
  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="lg:flex lg:items-start lg:gap-6">
    <div className={`${selected ? 'hidden lg:block' : 'block'} lg:w-[380px] lg:shrink-0`}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Logbook</h1>
        <div className="flex gap-2">
          <Link to="/costs" aria-label="Costs" className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800 text-slate-300 active:text-accent">
            <DollarSign size={20} />
          </Link>
          <Link to="/aircraft" aria-label="Aircraft" className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800 text-slate-300 active:text-accent">
            <PlaneTakeoff size={20} />
          </Link>
          <Link to="/logbook/data" aria-label="Import and export" className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800 text-slate-300 active:text-accent">
            <ArrowLeftRight size={20} />
          </Link>
        </div>
      </div>

      <div className="mt-4 flex gap-1 rounded-xl bg-navy-800 p-1">
        {KINDS.map(([k, label]) => (
          <button key={k} onClick={() => setFilters((f) => ({ ...f, kind: k }))}
            className={`h-9 flex-1 rounded-lg text-sm font-medium transition-colors ${filters.kind === k ? 'bg-accent text-ink' : 'text-slate-400'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
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
            <button onClick={() => setFilters((f) => ({ ...f, from: '', to: '', type: '', category: '' }))} className="col-span-2 h-10 text-sm text-accent">Clear filters</button>
          )}
        </div>
      )}

      {error && <div className="mt-4"><ErrorNote message={error} onRetry={load} /></div>}
      {!entries && !error && (
        <div className="mt-4 space-y-2"><Skeleton className="h-[4.5rem]" /><Skeleton className="h-[4.5rem]" /><Skeleton className="h-[4.5rem]" /></div>
      )}
      {entries && (
        <p className="mt-4 text-sm text-slate-400">{visible.length} entr{visible.length === 1 ? 'y' : 'ies'} · {fmtHours(total)} h</p>
      )}

      <ul className="stagger mt-2 space-y-2">
        {visible.map((e) => {
          const isSelected = selected && selected.kind === e.kind && String(e.id) === selected.id;
          const cost = costFor(e);
          const to = e.kind === 'flight' ? `/logbook/${e.id}` : `/logbook/ground/${e.id}`;
          return (
            <li key={`${e.kind}-${e.id}`}>
              <Card as="button" onClick={() => navigate(to)} aria-current={isSelected ? 'true' : undefined}
                className={`w-full text-left transition duration-150 active:scale-[0.985] active:bg-navy-800 ${isSelected ? 'lg:border-accent' : ''}`}>
                {e.kind === 'flight' ? (
                  <>
                    <div className="flex items-baseline justify-between">
                      <span className="text-base font-medium">{e.data.departure_airport || '—'} → {e.data.arrival_airport || '—'}</span>
                      <span className="text-lg font-semibold text-accent">{fmtHours(e.data.total_time)}</span>
                    </div>
                    <div className="mt-1 flex justify-between text-sm text-slate-400">
                      <span>{fmtDate(e.date)}{e.data.route ? ` · via ${e.data.route}` : ''}</span>
                      <span className="flex items-center gap-2">
                        {e.data.airline && <AirlineBadge airline={e.data.airline} />}
                        {[e.data.aircraft_type, e.data.tail_number].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline justify-between">
                      <span className="flex items-center gap-1.5 text-base font-medium">
                        <GraduationCap size={16} className="shrink-0 text-accent" />Ground session
                      </span>
                      <span className="text-lg font-semibold text-accent">{fmtHours(e.data.hours)}</span>
                    </div>
                    <div className="mt-1 flex justify-between text-sm text-slate-400">
                      <span>{fmtDate(e.date)}{e.data.instructor ? ` · ${e.data.instructor}` : ''}</span>
                      {cost?.total !== null && cost?.total !== undefined && <span>{fmtMoney(cost.total)}</span>}
                    </div>
                  </>
                )}
                {e.kind === 'flight' && cost?.total !== null && cost?.total !== undefined && (
                  <div className="mt-1 text-right text-xs text-slate-500">{fmtMoney(cost.total)}</div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>

      {entries && entries.length === 0 && (
        <EmptyState icon={Plane} title="Nothing logged yet." description="Tap the + button to log your first flight or ground session." />
      )}
      {entries && entries.length > 0 && visible.length === 0 && (
        <EmptyState title="Nothing matches these filters." />
      )}

      <button onClick={() => setShowLogChoice(true)} aria-label="Log flight or ground session"
        style={{ bottom: 'calc(var(--bottom-nav-h) + 1rem)' }}
        className="fixed right-5 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-ink shadow-lg shadow-accent/30 active:scale-95 active:bg-accent-dark md:bottom-6">
        <Plus size={28} strokeWidth={2.25} />
      </button>
      <LogChoiceModal open={showLogChoice} onClose={() => setShowLogChoice(false)} />
    </div>

    {/* Detail pane: full-screen (via the nested /logbook/:id or /logbook/ground/:id routes) below lg, a
        persistent side panel with a placeholder when nothing's selected from lg up — never just a
        stretched phone layout. */}
    <div className={`${selected ? 'block' : 'hidden lg:block'} min-w-0 flex-1`}>
      {selected ? <Outlet /> : (
        <div className="sticky top-10 hidden flex-col items-center justify-center rounded-2xl border border-dashed border-edge p-12 text-center text-slate-500 lg:flex">
          <BookOpen size={32} strokeWidth={1.5} className="mb-3 text-slate-600" />
          <p className="text-sm">Select an entry to see its details here.</p>
        </div>
      )}
    </div>
    </div>
  );
}
