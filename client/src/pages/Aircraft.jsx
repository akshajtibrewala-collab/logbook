import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, PlaneTakeoff } from 'lucide-react';
import { api } from '../lib/api.js';
import { aircraftLabel, aircraftRows } from '../lib/aircraftList.js';
import { fmtHours } from '../lib/hours.js';
import ErrorNote from '../components/ErrorNote.jsx';
import Button from '../components/Button.jsx';
import { MnEmpty, MnSkeleton } from '../components/mn/Mn.jsx';
import { Chip, Segmented } from '../ds/Controls.jsx';
import '../ds/bcalm.css';

const USAGE_FILTERS = [{ value: 'all', label: 'All' }, { value: 'pilot', label: 'Pilot' }, { value: 'passenger', label: 'Passenger' }];

/**
 * Aircraft (B-calm): one calm list, a tail number with its type muted and the hours in the role they were flown (a sky or violet dot says which). Complex,
 * turbine and similar flags live on the aircraft's own page. The global top bar owns the title and Back; the global Add menu owns "Add aircraft".
 */
export default function Aircraft() {
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

  const rows = useMemo(() => (aircraft ? aircraftRows(aircraft, flights, usageFilter) : null), [aircraft, flights, usageFilter]);

  return (
    <div className="cl bc"><div className="bc-stack">
      <div className="bc-ctl">
        <Segmented label="Filter by usage" scope="pilot" options={USAGE_FILTERS} value={usageFilter} onChange={setUsageFilter} />
        <span className="ic2">
          <Chip pressed={showArchived} onClick={() => setShowArchived((v) => !v)} aria-label={showArchived ? 'Showing archived aircraft' : 'Show archived aircraft'}><Archive aria-hidden="true" />{showArchived ? 'Archived shown' : 'Archived'}</Chip>
        </span>
      </div>

      {error && <ErrorNote message={error} onRetry={load} />}
      {!aircraft && !error && <MnSkeleton />}

      {rows && rows.length > 0 && (
        <div className="bc-items">
          {rows.map((r) => (
            <Link key={r.id} to={`/aircraft/${r.id}`} className="bc-item" data-row aria-label={aircraftLabel(r, fmtHours)} title={aircraftLabel(r, fmtHours)}>
              <span className="l">
                {r.role && <span className={`bc-dot ${r.role === 'passenger' ? 'pax' : 'pilot'}`} aria-hidden="true" />}
                <b>{r.title}</b>{r.sub && <span className="mut">{r.sub}</span>}
              </span>
              <span className="r">{r.hours != null && <b>{fmtHours(r.hours)}</b>}</span>
            </Link>
          ))}
        </div>
      )}

      {aircraft && aircraft.length === 0 && (
        <MnEmpty title="No aircraft yet" icon={<PlaneTakeoff />} action={<Button as={Link} to="/aircraft/new" size="lg">Add aircraft</Button>} />
      )}
      {rows && aircraft.length > 0 && rows.length === 0 && <MnEmpty title="No matches" icon={<PlaneTakeoff />} />}
    </div></div>
  );
}
