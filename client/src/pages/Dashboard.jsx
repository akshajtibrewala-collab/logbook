import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, XCircle, Plane, Gauge, ClipboardCheck } from 'lucide-react';
import { api } from '../lib/api.js';
import ThemeToggle from '../components/ThemeToggle.jsx';
import DatePicker from '../components/DatePicker.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorNote from '../components/ErrorNote.jsx';
import { fmtHours } from '../lib/hours.js';
import { passengerCurrency, instrumentCurrency, flightReviewStatus, summarize } from '../lib/currency.js';

const today = () => new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD

const TONE = {
  current: { Icon: CheckCircle2, text: 'text-ok', bar: 'bg-ok', label: 'Current' },
  expiring: { Icon: AlertTriangle, text: 'text-warn', bar: 'bg-warn', label: 'Expiring soon' },
  expired: { Icon: XCircle, text: 'text-bad', bar: 'bg-bad', label: 'Not current' },
};

const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function daysText(r) {
  if (r.daysRemaining === null) return { big: '—', small: 'no qualifying history' };
  if (r.daysRemaining < 0) return { big: Math.abs(r.daysRemaining), small: `day${r.daysRemaining === -1 ? '' : 's'} overdue` };
  return { big: r.daysRemaining, small: `day${r.daysRemaining === 1 ? '' : 's'} left` };
}

function StatusCard({ title, Icon, result, detail, children }) {
  const tone = TONE[result.status];
  const days = daysText(result);
  return (
    <section className="card relative overflow-hidden p-4">
      <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} />
      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-slate-400"><Icon size={16} strokeWidth={1.75} />{title}</div>
          <div className={`mt-2 flex items-center gap-1.5 text-sm font-medium ${tone.text}`}>
            <tone.Icon size={16} />{tone.label}
          </div>
          <p className="mt-1 text-sm text-slate-400">{detail}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-4xl font-semibold leading-none ${tone.text}`}>{days.big}</div>
          <div className="mt-1 text-xs text-slate-400">{days.small}</div>
        </div>
      </div>
      {children && <div className="mt-3 pl-2">{children}</div>}
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="card p-3 text-center">
      <div className="text-xl font-semibold">{fmtHours(value)}</div>
      <div className="mt-0.5 text-xs text-slate-400">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const [flights, setFlights] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState('');
  const [reviewDate, setReviewDate] = useState(today);
  const [logging, setLogging] = useState(false);
  const [editingId, setEditingId] = useState(null); // id of the review being re-dated, or null when adding
  const now = today();

  const load = useCallback(() => {
    setError('');
    Promise.all([api.listFlights(), api.listReviews()])
      .then(([f, r]) => { setFlights(f); setReviews(r); })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const data = useMemo(() => {
    if (!flights) return null;
    return {
      pax: passengerCurrency(flights, now),
      inst: instrumentCurrency(flights, now),
      review: flightReviewStatus(reviews, now),
      stats: summarize(flights, now),
    };
  }, [flights, reviews, now]);

  const newestFirst = (x, y) => y.date.localeCompare(x.date) || y.id - x.id;

  function startAdd() { setEditingId(null); setReviewDate(today()); setLogging(true); }
  function startEdit() { setEditingId(reviews[0].id); setReviewDate(reviews[0].date); setLogging(true); }
  function cancelReview() { setLogging(false); setEditingId(null); }

  async function logReview(e) {
    e.preventDefault();
    try {
      const saved = editingId ? await api.updateReview(editingId, reviewDate) : await api.addReview(reviewDate);
      setReviews((rs) => [saved, ...rs.filter((r) => r.id !== saved.id)].sort(newestFirst));
      cancelReview();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeReview() {
    if (!window.confirm('Remove your most recent flight review? This cannot be undone.')) return;
    try {
      await api.deleteReview(reviews[0].id);
      setReviews((rs) => rs.slice(1));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stagger space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-400">{fmtDate(now)}</p>
        </div>
        <ThemeToggle />
      </div>

      {error && <ErrorNote message={error} onRetry={load} />}
      {!data && !error && (
        <>
          <Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-36" />
        </>
      )}

      {data && flights.length === 0 && (
        <section className="card p-5 text-center">
          <Plane size={36} strokeWidth={1.5} className="mx-auto text-slate-600" />
          <h2 className="mt-3 text-lg font-semibold">Welcome to your logbook</h2>
          <p className="mt-1 text-sm text-slate-400">Log a flight or import a CSV and your currency status, hours and map fill in here.</p>
          <div className="mt-4 grid gap-2">
            <Link to="/logbook/new" className="flex h-12 items-center justify-center rounded-xl bg-accent font-semibold text-ink active:bg-accent-dark">Add your first flight</Link>
            <Link to="/logbook/data" className="flex h-12 items-center justify-center rounded-xl border border-edge-strong text-accent active:bg-navy-800">Import a CSV</Link>
          </div>
        </section>
      )}

      {data && (
        <>
          <StatusCard title="Passenger currency" Icon={Plane} result={data.pax.day}
            detail={data.pax.day.count >= 3 ? `${data.pax.day.count} landings in the last 90 days` : `${data.pax.day.count} of 3 landings in the last 90 days`}>
            <div className={`flex items-center justify-between rounded-xl bg-navy-800 px-3 py-2 text-sm ${TONE[data.pax.night.status].text}`}>
              <span>Night</span>
              <span>{data.pax.night.daysRemaining === null ? 'Not current'
                : data.pax.night.daysRemaining < 0 ? `Lapsed ${-data.pax.night.daysRemaining}d ago`
                : `${data.pax.night.daysRemaining} days left`}</span>
            </div>
          </StatusCard>

          <StatusCard title="Instrument currency" Icon={Gauge} result={data.inst}
            detail={`${data.inst.approaches}/${data.inst.requiredApproaches} approaches · ${data.inst.holds}/${data.inst.requiredHolds} hold in 6 months`} />

          <StatusCard title="Flight review" Icon={ClipboardCheck} result={data.review}
            detail={data.review.lastReview ? `Last review ${fmtDate(data.review.lastReview)} · due ${fmtDate(data.review.expires)}` : 'No flight review logged'}>
            {logging ? (
              <form onSubmit={logReview} className="space-y-2">
                <DatePicker label={editingId ? 'Change review date' : 'Flight review date'} value={reviewDate} onChange={setReviewDate} />
                <div className="flex gap-2">
                  <button className="h-12 flex-1 rounded-xl bg-accent px-4 font-semibold text-ink active:bg-accent-dark">Save</button>
                  <button type="button" onClick={cancelReview} className="h-12 rounded-xl px-4 text-sm text-slate-400 active:bg-navy-800">Cancel</button>
                </div>
              </form>
            ) : (
              <div className="space-y-1">
                <button onClick={startAdd} className="h-12 w-full rounded-xl border border-edge-strong text-sm text-accent active:bg-navy-800">
                  Log a flight review
                </button>
                {reviews.length > 0 && (
                  <div className="flex justify-center gap-2 text-sm">
                    <button onClick={startEdit} className="h-10 rounded-lg px-3 text-slate-400 active:bg-navy-800">Change date</button>
                    <button onClick={removeReview} className="h-10 rounded-lg px-3 text-bad active:bg-navy-800">Remove</button>
                  </div>
                )}
              </div>
            )}
          </StatusCard>

          <div>
            <h2 className="mb-2 text-sm font-medium text-slate-400">Hours flown</h2>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="This month" value={data.stats.month} />
              <Stat label="This year" value={data.stats.year} />
              <Stat label="Total" value={data.stats.total} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
