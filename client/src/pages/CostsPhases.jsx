import { Link } from 'react-router-dom';
import useCostsData from '../hooks/useCostsData.js';
import { moneyExact } from '../lib/costDisplay.js';
import { certificateLabel } from '../lib/milestones.js';
import { formatDate } from '../lib/calendar.js';
import ErrorNote from '../components/ErrorNote.jsx';
import Button from '../components/Button.jsx';
import { MnEmpty, MnSkeleton } from '../components/mn/Mn.jsx';
import '../ds/logbook.css';

/** Training phases: each phase's own spend (frozen once it ends), its dates, and whether its costs are tracked. */
export default function CostsPhases() {
  const { data, computed, error, load } = useCostsData('private');
  const phases = data ? [...data.phases].sort((a, b) => a.start_date.localeCompare(b.start_date)) : [];
  return (
    <div className="cl mn">
      {error && <ErrorNote message={error} onRetry={load} />}
      {!data && !error && <MnSkeleton rows={2} />}
      {computed && phases.length === 0 && <MnEmpty title="No training phases yet" action={<Button as={Link} to="/costs/settings" size="lg">Set one up</Button>} />}
      {computed && phases.length > 0 && (
        <>
          <div className="mn-card">
            {phases.map((p) => (
              <div key={p.certificate} className="mn-st" role="group" aria-label={`${certificateLabel(p.certificate)}, ${moneyExact(computed.perCert[p.certificate] ?? 0)}`}>
                <span />
                <span className="t">
                  <span className="pri">{certificateLabel(p.certificate)}</span>
                  <span className="mn-mut">{formatDate(p.start_date)} – {p.end_date ? formatDate(p.end_date) : 'ongoing'}{p.end_date ? ' · closed' : ''}{!p.track_costs ? ' · not tracked' : ''}</span>
                </span>
                <span className="v">{moneyExact(computed.perCert[p.certificate] ?? 0)}</span>
              </div>
            ))}
          </div>
          <Button as={Link} to="/costs/settings" variant="secondary">Rates and settings</Button>
        </>
      )}
    </div>
  );
}
