import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Pencil, GraduationCap } from 'lucide-react';
import { api, fetchAllRates } from '../lib/api.js';
import { fmtHours } from '../lib/hours.js';
import { computeGroundSessionCost, fmtMoney } from '../lib/cost.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorNote from '../components/ErrorNote.jsx';
import { formatDateWithWeekday as fmtDate } from '../lib/calendar.js';


function Section({ title, children }) {
  return (
    <section className="card p-4">
      <h2 className="mb-3 text-sm font-medium text-accent">{title}</h2>
      {children}
    </section>
  );
}

export default function GroundSessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [rates, setRates] = useState(null);
  const [phases, setPhases] = useState(null);

  const load = useCallback(() => {
    setError('');
    setSession(null);
    api.getGroundSession(id).then(setSession).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);
  useEffect(() => { fetchAllRates().then(setRates).catch(() => {}); }, []);
  useEffect(() => { api.listTrainingPhases().then(setPhases).catch(() => {}); }, []);

  const cost = session && rates && phases ? computeGroundSessionCost(session, rates, phases) : null;

  return (
    <div className="stagger space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/logbook')} className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800 lg:hidden" aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold">Ground session</h1>
        {session && (
          <Link to={`/logbook/ground/${id}/edit`} aria-label="Edit ground session" className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800 text-slate-300 active:text-accent">
            <Pencil size={18} />
          </Link>
        )}
      </div>

      {error && <ErrorNote message={error} onRetry={load} />}
      {!session && !error && <><Skeleton className="h-24" /><Skeleton className="h-32" /></>}

      {session && (
        <>
          <section className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-lg font-semibold"><GraduationCap size={18} className="text-accent" />Ground instruction</div>
                <div className="mt-0.5 text-sm text-slate-400">{fmtDate(session.date)}</div>
              </div>
              <div className="shrink-0 text-right text-3xl font-semibold text-accent">{fmtHours(session.hours)}</div>
            </div>
            {session.instructor && <p className="mt-3 border-t border-edge pt-3 text-sm text-slate-300">Instructor: {session.instructor}</p>}
          </section>

          {cost && (cost.total > 0 || cost.override) && (
            <Section title="Cost">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold">{fmtMoney(cost.total)}</span>
                {cost.override && (
                  <span className="text-xs text-slate-400">
                    Manual override{cost.computedTotal !== null ? ` · calculated was ${fmtMoney(cost.computedTotal)}` : ' · outside a cost-tracked phase'}
                  </span>
                )}
              </div>
              {cost.missingRate && <p className="mt-1 text-xs text-bad">The ground rate wasn't set for this date — see Costs settings.</p>}
            </Section>
          )}

          {session.topics && (
            <Section title="Topics covered">
              <p className="whitespace-pre-wrap text-sm text-slate-300">{session.topics}</p>
            </Section>
          )}

          {session.notes && (
            <Section title="Notes">
              <p className="whitespace-pre-wrap text-sm text-slate-300">{session.notes}</p>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
