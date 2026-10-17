import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { api } from '../lib/api.js';
import { fmtHours } from '../lib/hours.js';
import ErrorNote from '../components/ErrorNote.jsx';
import Button from '../components/Button.jsx';
import { MnFold, MnKv, MnSkeleton } from '../components/mn/Mn.jsx';
import { formatDate as fmtDate } from '../lib/calendar.js';
import '../ds/logbook.css';

/** A ground session in the minimalist detail layout: its hours (never part of flight hours), topics, instructor and notes. */
export default function GroundSessionDetail() {
  const { id } = useParams();
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState({});
  const fold = (k) => ({ open: Boolean(open[k]), onToggle: () => setOpen((o) => ({ ...o, [k]: !o[k] })) });

  const load = useCallback(() => {
    setError('');
    setSession(null);
    api.getGroundSession(id).then(setSession).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);


  if (error) return <div className="cl mn"><ErrorNote message={error} onRetry={load} /></div>;
  if (!session) return <div className="cl mn"><MnSkeleton rows={2} /></div>;

  return (
    <div className="cl mn">
      <div className="mn-detail">
        <div className="head">
          <span className="mn-mut">{fmtDate(session.date)} · Ground</span>
          <h1>{session.topics?.trim() ? session.topics : 'Ground instruction'}</h1>
          <div className="num-row" role="img" aria-label={`${fmtHours(session.hours)} ground hours, not part of flight hours`}><span className="mn-num accent">{fmtHours(session.hours)}</span><span className="mn-u">h</span></div>
        </div>

        <div className="mn-card">
          <MnKv k="Instructor" v={session.instructor} />
          <MnKv k="Counts toward" v="Ground time only" />
          {session.notes && <MnFold label="Notes" value="" {...fold('notes')}><p>{session.notes}</p></MnFold>}
        </div>

        <div className="mn-actions">
          <Button as={Link} to={`/logbook/ground/${id}/edit`} variant="primary" size="lg" icon={Pencil}>Edit ground session</Button>
        </div>
      </div>
    </div>
  );
}
