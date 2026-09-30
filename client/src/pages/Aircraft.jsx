import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, PlaneTakeoff, Archive } from 'lucide-react';
import AddFab from '../components/AddFab.jsx';
import { api } from '../lib/api.js';
import Card from '../components/Card.jsx';
import Badge from '../components/Badge.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorNote from '../components/ErrorNote.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { isPilotFlight } from '../lib/flightRoles.js';

function FlagBadges({ a }) {
  const flags = [
    a.is_complex && 'Complex', a.is_high_performance && 'High-perf', a.is_tailwheel && 'Tailwheel',
    a.is_turbine && 'Turbine', a.is_taa && 'TAA', a.type_rating_required && (a.type_rating_designation || 'Type rating'),
  ].filter(Boolean);
  if (!flags.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {flags.map((f) => <Badge key={f} tone="accent">{f}</Badge>)}
    </div>
  );
}

const USAGE_FILTERS = [['all', 'All'], ['flown', 'Flown'], ['ridden', 'Ridden']];

export default function Aircraft() {
  const navigate = useNavigate();
  const [aircraft, setAircraft] = useState(null);
  const [flights, setFlights] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [usageFilter, setUsageFilter] = useState('all');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    Promise.all([api.listAircraft(showArchived), api.listFlights()])
      .then(([a, f]) => { setAircraft(a); setFlights(f); })
      .catch((e) => setError(e.message));
  }, [showArchived]);
  useEffect(load, [load]);

  // How each aircraft has actually been used: flown as pilot, or only ridden as a passenger —
  // an airliner added from a passenger flight's aircraft picker should never look like something you fly.
  const usageById = useMemo(() => {
    const byId = new Map();
    for (const f of flights) {
      if (f.aircraft_id == null) continue;
      const u = byId.get(f.aircraft_id) ?? { flown: 0, ridden: 0 };
      if (isPilotFlight(f)) u.flown++; else u.ridden++;
      byId.set(f.aircraft_id, u);
    }
    return byId;
  }, [flights]);

  // Flown: ever flown as pilot. Ridden: linked to a flight but never as pilot — surfaces exactly the
  // "airliner added from a passenger flight" case the Aircraft list must not present as something you fly.
  const visible = useMemo(() => {
    if (!aircraft) return aircraft;
    if (usageFilter === 'all') return aircraft;
    return aircraft.filter((a) => {
      const u = usageById.get(a.id);
      if (usageFilter === 'flown') return Boolean(u?.flown);
      return Boolean(u?.ridden) && !u.flown;
    });
  }, [aircraft, usageById, usageFilter]);

  return (
    <div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/logbook')} className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800" aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="min-w-0 flex-1 text-2xl font-semibold">Aircraft</h1>
        <button type="button" onClick={() => navigate('/aircraft/new')} className="hidden h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-ink md:flex">
          <Plus size={16} />Add aircraft
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl bg-navy-800 p-1" role="group" aria-label="Filter by usage">
          {USAGE_FILTERS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setUsageFilter(k)} aria-pressed={usageFilter === k}
              className={`h-9 rounded-lg px-3 text-sm font-medium transition-colors ${usageFilter === k ? 'bg-accent text-ink' : 'text-slate-400'}`}>{l}</button>
          ))}
        </div>
        <button onClick={() => setShowArchived((v) => !v)}
          className={`flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm ${showArchived ? 'border-accent text-accent' : 'border-edge text-slate-400'}`}>
          <Archive size={15} />{showArchived ? 'Showing archived' : 'Show archived'}
        </button>
      </div>

      {error && <div className="mt-4"><ErrorNote message={error} onRetry={load} /></div>}
      {!aircraft && !error && <div className="mt-4 space-y-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>}

      <ul className="stagger mt-4 space-y-2">
        {visible?.map((a) => {
          const u = usageById.get(a.id);
          const riddenOnly = Boolean(u?.ridden) && !u?.flown;
          return (
          <li key={a.id}>
            <Card as="button" onClick={() => navigate(`/aircraft/${a.id}`)} className="w-full text-left active:bg-navy-800">
              <div className="flex items-baseline justify-between">
                <span className="text-base font-semibold">
                  {a.is_simulator ? (a.model || 'Simulator') : (a.tail_number || a.model || 'Aircraft')}
                </span>
                <div className="flex shrink-0 gap-1.5">
                  {riddenOnly && <Badge tone="neutral">Ridden only</Badge>}
                  {a.archived_at && <Badge tone="neutral">Archived</Badge>}
                </div>
              </div>
              <div className="mt-0.5 text-sm text-slate-400">
                {[a.is_simulator ? a.simulator_device_type : a.tail_number && a.model, a.category, a.class].filter(Boolean).join(' · ') || 'No details yet'}
              </div>
              {u && (
                <div className="mt-1.5 flex gap-3 text-xs text-slate-500">
                  {u.flown > 0 && <span>Flown {u.flown}×</span>}
                  {u.ridden > 0 && <span>Ridden {u.ridden}×</span>}
                </div>
              )}
              <FlagBadges a={a} />
            </Card>
          </li>
          );
        })}
      </ul>

      {aircraft && aircraft.length === 0 && (
        <EmptyState icon={PlaneTakeoff} title="No aircraft yet"
          description="Add the aircraft you fly, or add one straight from the flight form." />
      )}
      {aircraft && aircraft.length > 0 && visible.length === 0 && (
        <EmptyState title="Nothing matches this filter." />
      )}

      <AddFab onClick={() => navigate('/aircraft/new')} label="Add aircraft" />
    </div>
  );
}
