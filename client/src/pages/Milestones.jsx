import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, GraduationCap, ListChecks } from 'lucide-react';
import { api } from '../lib/api.js';
import { computeMilestones, certificateLabel } from '../lib/milestones.js';
import { fmtHours } from '../lib/hours.js';
import Card from '../components/Card.jsx';
import Badge from '../components/Badge.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorNote from '../components/ErrorNote.jsx';
import EmptyState from '../components/EmptyState.jsx';

function Requirement({ req }) {
  if (req.manual) {
    return (
      <li className="flex items-start justify-between gap-3 py-2.5">
        <div className="min-w-0">
          <div className="text-sm">{req.label}</div>
          {req.notes && <div className="mt-0.5 text-xs text-slate-500">{req.notes}</div>}
        </div>
        <Badge tone="neutral" className="shrink-0">Track manually</Badge>
      </li>
    );
  }
  const tone = req.met ? 'ok' : req.percent >= 75 ? 'accent' : 'neutral';
  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm">{req.label}</span>
        <span className="shrink-0 text-sm text-slate-400">
          {req.unit === 'hours' ? fmtHours(req.current) : req.current}
          {' / '}{req.unit === 'hours' ? fmtHours(req.min_value) : req.min_value}
          {req.unit === 'hours' ? ' h' : ''}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <ProgressBar value={req.current} max={req.min_value} tone={tone} />
        {req.met && <CheckCircle2 size={16} className="shrink-0 text-ok" />}
      </div>
      {req.notes && <div className="mt-1 text-xs text-slate-500">{req.notes}</div>}
    </li>
  );
}

function CertificateCard({ certificate, requirements }) {
  const computable = requirements.filter((r) => !r.manual);
  const metCount = computable.filter((r) => r.met).length;
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold"><GraduationCap size={18} className="text-accent" />{certificateLabel(certificate)}</h2>
        <span className="text-sm text-slate-400">{metCount}/{computable.length} met</span>
      </div>
      <ul className="mt-2 divide-y divide-white/5">
        {requirements.map((r) => <Requirement key={r.requirement_key} req={r} />)}
      </ul>
    </Card>
  );
}

export default function Milestones() {
  const [config, setConfig] = useState(null);
  const [flights, setFlights] = useState(null);
  const [aircraft, setAircraft] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    Promise.all([api.listMilestonesConfig(), api.listFlights(), api.listAircraft(true)])
      .then(([c, f, a]) => { setConfig(c); setFlights(f); setAircraft(a); })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const grouped = useMemo(() => {
    if (!config || !flights || !aircraft) return null;
    const aircraftById = Object.fromEntries(aircraft.map((a) => [a.id, a]));
    return computeMilestones(config, flights, aircraftById);
  }, [config, flights, aircraft]);

  return (
    <div className="stagger space-y-4">
      <h1 className="text-2xl font-semibold">Milestones</h1>

      {error && <ErrorNote message={error} onRetry={load} />}
      {!grouped && !error && <><Skeleton className="h-48" /><Skeleton className="h-48" /></>}

      {grouped && grouped.size === 0 && (
        <EmptyState icon={ListChecks} title="No milestones configured yet" description="Requirements are seeded as editable data — see server/src/migrations." />
      )}

      {grouped && [...grouped.entries()].map(([certificate, requirements]) => (
        <CertificateCard key={certificate} certificate={certificate} requirements={requirements} />
      ))}

      {grouped && grouped.size > 0 && (
        <p className="px-1 text-xs text-slate-500">
          These are approximate 14 CFR Part 61 hour totals, not a certified restatement of the regulations —
          verify against the current rules and your instructor before relying on them for checkride readiness.
        </p>
      )}
    </div>
  );
}
