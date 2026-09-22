import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plane, Gauge, ClipboardCheck, HeartPulse, ChevronRight } from 'lucide-react';
import { api } from '../lib/api.js';
import ThemeToggle from '../components/ThemeToggle.jsx';
import DatePicker from '../components/DatePicker.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorNote from '../components/ErrorNote.jsx';
import Button from '../components/Button.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import CurrencyStatusCard, { TONE } from '../components/CurrencyStatusCard.jsx';
import { fmtHours } from '../lib/hours.js';
import { greeting } from '../lib/greeting.js';
import { passengerCurrency, instrumentCurrency, flightReviewStatus, medicalCurrency, summarize } from '../lib/currency.js';

const today = () => new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD

const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const StatusCard = CurrencyStatusCard;

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
  const [expirations, setExpirations] = useState([]);
  const [error, setError] = useState('');
  const [reviewDate, setReviewDate] = useState(today);
  const [logging, setLogging] = useState(false);
  const [editingId, setEditingId] = useState(null); // id of the review being re-dated, or null when adding
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const now = today();

  const load = useCallback(() => {
    setError('');
    Promise.all([api.listFlights(), api.listReviews(), api.listExpirations()])
      .then(([f, r, e]) => { setFlights(f); setReviews(r); setExpirations(e); })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const data = useMemo(() => {
    if (!flights) return null;
    return {
      pax: passengerCurrency(flights, now),
      inst: instrumentCurrency(flights, now),
      review: flightReviewStatus(reviews, now),
      medical: medicalCurrency(expirations, now),
      stats: summarize(flights, now),
    };
  }, [flights, reviews, expirations, now]);

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
    setRemoving(true);
    try {
      await api.deleteReview(reviews[0].id);
      setReviews((rs) => rs.slice(1));
      setConfirmRemove(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="stagger space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{greeting()}</h1>
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
            <Button as={Link} to="/logbook/new" size="md">Add your first flight</Button>
            <Button as={Link} to="/logbook/data" size="md" variant="secondary">Import a CSV</Button>
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
                  <Button size="md" fullWidth={false} className="flex-1">Save</Button>
                  <Button type="button" variant="ghost" size="md" fullWidth={false} onClick={cancelReview}>Cancel</Button>
                </div>
              </form>
            ) : (
              <div className="space-y-1">
                <Button variant="secondary" size="md" onClick={startAdd}>Log a flight review</Button>
                {reviews.length > 0 && (
                  <div className="flex justify-center gap-2 text-sm">
                    <Button variant="ghost" size="sm" fullWidth={false} onClick={startEdit}>Change date</Button>
                    <Button variant="danger" size="sm" fullWidth={false} onClick={() => setConfirmRemove(true)}>Remove</Button>
                  </div>
                )}
              </div>
            )}
          </StatusCard>

          <StatusCard title="Medical certificate" Icon={HeartPulse} result={data.medical}
            detail={data.medical.item ? data.medical.item.label : 'No medical certificate logged'} />

          <Link to="/currency" className="flex items-center justify-between rounded-xl px-1 py-1 text-sm text-accent active:opacity-70">
            See all currency & expirations<ChevronRight size={16} />
          </Link>

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

      <ConfirmDialog open={confirmRemove} title="Remove flight review?"
        description="This removes your most recently logged flight review. This cannot be undone."
        confirmLabel="Remove" busy={removing} onConfirm={removeReview} onClose={() => setConfirmRemove(false)} />
    </div>
  );
}
