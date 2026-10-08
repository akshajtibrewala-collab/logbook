import { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { Chip } from '../ds/Controls.jsx';
import '../ds/bcalm.css';
import { api } from '../lib/api.js';
import { computeMilestones, certificateLabel, certificateSummary, completionsByKey } from '../lib/milestones.js';
import { pilotFlights } from '../lib/flightRoles.js';
import SummaryDocument from '../components/SummaryDocument.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorNote from '../components/ErrorNote.jsx';
import Button from '../components/Button.jsx';

/** Printable / save-as-PDF logbook summary (browser print dialog → "Save as PDF"). */
export default function PrintSummary() {
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
        setMilestones(computeMilestones(config, pilotFlights(flights), byId, completionsByKey(completions)));
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
    <div className="cl bc"><div className="bc-stack">
      <div className="no-print bc-ctl">
        <Chip pressed={notes} onClick={() => setNotes((v) => !v)} aria-label={notes ? 'Notes included. Tap to leave them out' : 'Notes left out. Tap to include them'}>{notes ? 'Notes on' : 'Notes off'}</Chip>
        <Button size="md" fullWidth={false} icon={Printer} iconSize={18} onClick={() => window.print()}>Print / Save as PDF</Button>
      </div>
      {error && <ErrorNote message={error} onRetry={() => setTries((t) => t + 1)} />}
      {!summary && !error && <><Skeleton className="h-16" /><Skeleton className="h-40" /></>}
      {summary && <SummaryDocument summary={summary} certificates={certificates} />}
    </div></div>
  );
}
