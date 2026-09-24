import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, PlaneTakeoff, Archive } from 'lucide-react';
import AddFab from '../components/AddFab.jsx';
import { api } from '../lib/api.js';
import Card from '../components/Card.jsx';
import Badge from '../components/Badge.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorNote from '../components/ErrorNote.jsx';
import EmptyState from '../components/EmptyState.jsx';

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

export default function Aircraft() {
  const navigate = useNavigate();
  const [aircraft, setAircraft] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api.listAircraft(showArchived).then(setAircraft).catch((e) => setError(e.message));
  }, [showArchived]);
  useEffect(load, [load]);

  return (
    <div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/logbook')} className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800" aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="min-w-0 flex-1 text-2xl font-semibold">Aircraft</h1>
        <button type="button" onClick={() => navigate('/aircraft/new')} className="hidden h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-ink md:flex">
          <Plus size={16} />Add aircraft
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button onClick={() => setShowArchived((v) => !v)}
          className={`flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm ${showArchived ? 'border-accent text-accent' : 'border-edge text-slate-400'}`}>
          <Archive size={15} />{showArchived ? 'Showing archived' : 'Show archived'}
        </button>
      </div>

      {error && <div className="mt-4"><ErrorNote message={error} onRetry={load} /></div>}
      {!aircraft && !error && <div className="mt-4 space-y-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>}

      <ul className="stagger mt-4 space-y-2">
        {aircraft?.map((a) => (
          <li key={a.id}>
            <Card as="button" onClick={() => navigate(`/aircraft/${a.id}`)} className="w-full text-left active:bg-navy-800">
              <div className="flex items-baseline justify-between">
                <span className="text-base font-semibold">
                  {a.is_simulator ? (a.model || 'Simulator') : (a.tail_number || a.model || 'Aircraft')}
                </span>
                {a.archived_at && <Badge tone="neutral">Archived</Badge>}
              </div>
              <div className="mt-0.5 text-sm text-slate-400">
                {[a.is_simulator ? a.simulator_device_type : a.tail_number && a.model, a.category, a.class].filter(Boolean).join(' · ') || 'No details yet'}
              </div>
              <FlagBadges a={a} />
            </Card>
          </li>
        ))}
      </ul>

      {aircraft && aircraft.length === 0 && (
        <EmptyState icon={PlaneTakeoff} title="No aircraft yet"
          description="Add the aircraft you fly, or add one straight from the flight form." />
      )}

      <AddFab onClick={() => navigate('/aircraft/new')} label="Add aircraft" />
    </div>
  );
}
