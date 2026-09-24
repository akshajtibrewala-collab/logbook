import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { api } from '../lib/api.js';
import { computeMilestones, certificateLabel, certificateSummary, completionsByKey } from '../lib/milestones.js';
import SummaryDocument from '../components/SummaryDocument.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorNote from '../components/ErrorNote.jsx';
import Button from '../components/Button.jsx';

/** Printable / save-as-PDF logbook summary (browser print dialog → "Save as PDF"). */
export default function PrintSummary() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [milestones, setMilestones] = useState(null);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState(true);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    setError('');
    api.getShareSummary(notes).then(setSummary).catch((e) => setError(e.message));
  }, [notes, tries]);

  useEffect(() => {
    Promise.all([api.listMilestonesConfig(), api.listFlights(), api.listAircraft(true), api.listMilestoneCompletions()])
      .then(([config, flights, aircraft, completions]) => {
        const byId = Object.fromEntries(aircraft.map((a) => [a.id, a]));
        setMilestones(computeMilestones(config, flights, byId, completionsByKey(completions)));
      })
      .catch(() => setMilestones(new Map())); // progress is a bonus; the rest of the summary still prints
  }, []);

  const certificates = useMemo(() => {
    if (!milestones) return [];
    return [...milestones].map(([key, reqs]) => {
      const s = certificateSummary(reqs);
      return { key, label: certificateLabel(key), metCount: s.metCount, total: s.computableCount, percent: s.percent };
    });
  }, [milestones]);

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => navigate('/logbook')} className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800" aria-label="Back"><ArrowLeft size={20} /></button>
        <label className="flex min-h-11 items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={notes} onChange={(e) => setNotes(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--accent))]" />Include notes
        </label>
        <Button size="md" fullWidth={false} icon={Printer} iconSize={18} className="ml-auto" onClick={() => window.print()}>Print / Save as PDF</Button>
      </div>
      {error && <ErrorNote message={error} onRetry={() => setTries((t) => t + 1)} />}
      {!summary && !error && <><Skeleton className="h-16" /><Skeleton className="h-40" /></>}
      {summary && <SummaryDocument summary={summary} certificates={certificates} />}
    </div>
  );
}
