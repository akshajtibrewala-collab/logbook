import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, EyeOff, GraduationCap, Info, ListChecks } from 'lucide-react';
import { api } from '../lib/api.js';
import { computeMilestones, certificateLabel, groupRequirements, certificateSummary } from '../lib/milestones.js';
import { fmtHours } from '../lib/hours.js';
import Card from '../components/Card.jsx';
import Badge from '../components/Badge.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import RingProgress from '../components/RingProgress.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorNote from '../components/ErrorNote.jsx';
import EmptyState from '../components/EmptyState.jsx';

// A note is seeded as "§citation" or "§citation; longer explanation" (see 006_milestone_citations.js) —
// split so the citation can sit as a small muted label and the rest stays tucked behind an info toggle.
function splitNote(notes) {
  if (!notes) return { citation: null, extra: null };
  const i = notes.indexOf(';');
  return i === -1 ? { citation: notes, extra: null } : { citation: notes.slice(0, i).trim(), extra: notes.slice(i + 1).trim() };
}

function Citation({ notes }) {
  const [open, setOpen] = useState(false);
  const { citation, extra } = splitNote(notes);
  if (!citation) return null;
  return (
    <div className="mt-1">
      <div className="flex items-center gap-1 text-[11px] text-slate-500">
        <span>{citation}</span>
        {extra && (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="More info"
            className="flex h-4 w-4 items-center justify-center text-slate-500 active:text-accent">
            <Info size={12} />
          </button>
        )}
      </div>
      {open && extra && <p className="mt-0.5 text-xs text-slate-500">{extra}</p>}
    </div>
  );
}

function Requirement({ req }) {
  if (req.manual) {
    return (
      <li className="py-2.5">
        <div className="flex items-start justify-between gap-3">
          <span className="min-w-0 text-sm">{req.label}</span>
          <Badge tone="neutral" className="shrink-0">Manual</Badge>
        </div>
        <Citation notes={req.notes} />
      </li>
    );
  }
  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm">{req.label}</span>
        <span className="shrink-0 text-sm text-slate-400">
          {req.unit === 'hours' ? `${fmtHours(req.current)} / ${fmtHours(req.min_value)} h` : `${req.current} / ${req.min_value}`}
        </span>
      </div>
      <div className="mt-1.5">
        {req.met
          ? <CheckCircle2 size={16} className="text-ok" />
          : <ProgressBar value={req.current} max={req.min_value} tone={req.percent >= 75 ? 'accent' : 'neutral'} />}
      </div>
      <Citation notes={req.notes} />
    </li>
  );
}

function RequirementGroup({ title, requirements, hideCompleted }) {
  const visible = hideCompleted ? requirements.filter((r) => !r.met) : requirements;
  if (!visible.length) return null;
  return (
    <div>
      <h3 className="mb-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">{title}</h3>
      <ul className="divide-y divide-white/5">
        {visible.map((r) => <Requirement key={r.requirement_key} req={r} />)}
      </ul>
    </div>
  );
}

function CertificateCard({ certificate, requirements, expanded, onToggle, hideCompleted }) {
  const { metCount, computableCount, percent, complete } = certificateSummary(requirements);
  const tone = complete ? 'ok' : percent >= 50 ? 'accent' : 'neutral';
  const groups = groupRequirements(requirements);

  return (
    <Card padded={false}>
      <button type="button" onClick={onToggle} aria-expanded={expanded}
        className="flex w-full items-center gap-3 p-4 text-left active:bg-navy-800">
        <RingProgress percent={percent} tone={tone}>{Math.round(percent)}%</RingProgress>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-base font-semibold">
            <GraduationCap size={18} className="text-accent shrink-0" />
            <span className="truncate">{certificateLabel(certificate)}</span>
          </div>
          <div className="mt-0.5 text-sm text-slate-400">{metCount} of {computableCount} requirements met</div>
        </div>
        <ChevronDown size={18} className={`shrink-0 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-edge px-4 pb-4 pt-3">
          {Object.entries(groups).map(([title, reqs]) => (
            <RequirementGroup key={title} title={title} requirements={reqs} hideCompleted={hideCompleted} />
          ))}
        </div>
      )}
    </Card>
  );
}

export default function Milestones() {
  const [config, setConfig] = useState(null);
  const [flights, setFlights] = useState(null);
  const [aircraft, setAircraft] = useState(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(new Set());
  const [hideCompleted, setHideCompleted] = useState(false);
  const autoExpandedRef = useRef(false);

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

  // Auto-expand the first certificate (in config order) that isn't fully complete — once. After that,
  // expand/collapse is entirely up to the user, including re-collapsing that same card.
  useEffect(() => {
    if (!grouped || autoExpandedRef.current) return;
    autoExpandedRef.current = true;
    for (const [certificate, requirements] of grouped) {
      if (!certificateSummary(requirements).complete) { setExpanded(new Set([certificate])); return; }
    }
  }, [grouped]);

  const toggle = (certificate) => setExpanded((s) => {
    const next = new Set(s);
    if (next.has(certificate)) next.delete(certificate); else next.add(certificate);
    return next;
  });

  return (
    <div className="stagger space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Milestones</h1>
        {grouped && grouped.size > 0 && (
          <button onClick={() => setHideCompleted((v) => !v)}
            className={`flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm ${hideCompleted ? 'border-accent text-accent' : 'border-edge text-slate-400'}`}>
            <EyeOff size={15} />{hideCompleted ? 'Hiding completed' : 'Hide completed'}
          </button>
        )}
      </div>

      {error && <ErrorNote message={error} onRetry={load} />}
      {!grouped && !error && <><Skeleton className="h-20" /><Skeleton className="h-20" /></>}

      {grouped && grouped.size === 0 && (
        <EmptyState icon={ListChecks} title="No milestones configured yet" description="Requirements are seeded as editable data — see server/src/migrations." />
      )}

      {grouped && [...grouped.entries()].map(([certificate, requirements]) => (
        <CertificateCard key={certificate} certificate={certificate} requirements={requirements}
          expanded={expanded.has(certificate)} onToggle={() => toggle(certificate)} hideCompleted={hideCompleted} />
      ))}

      {grouped && grouped.size > 0 && (
        <p className="px-1 text-xs text-slate-500">Approximate 14 CFR Part 61 totals, not certified — verify with your instructor.</p>
      )}
    </div>
  );
}
