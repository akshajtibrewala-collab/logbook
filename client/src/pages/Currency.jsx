import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plane, Moon, Gauge, ClipboardCheck, HeartPulse, FileClock, Plus, ChevronRight } from 'lucide-react';
import { api } from '../lib/api.js';
import { passengerCurrency, instrumentCurrency, flightReviewStatus, medicalCurrency, customExpirations } from '../lib/currency.js';
import { pilotFlights } from '../lib/flightRoles.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorNote from '../components/ErrorNote.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Card from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import DatePicker from '../components/DatePicker.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import CurrencyStatusCard, { TONE, daysText } from '../components/CurrencyStatusCard.jsx';
import { formatDate as fmtDate } from '../lib/calendar.js';

const today = () => new Date().toLocaleDateString('en-CA');
const newestFirst = (a, b) => b.date.localeCompare(a.date) || b.id - a.id;

export default function Currency() {
  const navigate = useNavigate();
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
      .catch((err) => setError(err.message));
  }, []);
  useEffect(load, [load]);

  const data = useMemo(() => {
    if (!flights) return null;
    const pilotOnly = pilotFlights(flights);
    return {
      pax: passengerCurrency(pilotOnly, now),
      inst: instrumentCurrency(pilotOnly, now),
      review: flightReviewStatus(reviews, now),
      medical: medicalCurrency(expirations, now),
      custom: customExpirations(expirations, now),
    };
  }, [flights, reviews, expirations, now]);

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
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/')} className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy-800" aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold">Currency & expirations</h1>
      </div>

      {error && <ErrorNote message={error} onRetry={load} />}
      {!data && !error && (
        <><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></>
      )}

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <CurrencyStatusCard title="Day passenger currency" Icon={Plane} result={data.pax.day}
              detail={data.pax.day.count >= 3 ? `${data.pax.day.count} landings in the last 90 days` : `${data.pax.day.count} of 3 landings in the last 90 days`} />

            <CurrencyStatusCard title="Night passenger currency" Icon={Moon} result={data.pax.night}
              detail="3 night landings within the preceding 90 days" />

            <CurrencyStatusCard title="Instrument currency" Icon={Gauge} result={data.inst}
              detail={`${data.inst.approaches}/${data.inst.requiredApproaches} approaches · ${data.inst.holds}/${data.inst.requiredHolds} hold in 6 months`} />

            <CurrencyStatusCard title="Flight review" Icon={ClipboardCheck} result={data.review}
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
            </CurrencyStatusCard>

            <CurrencyStatusCard title="Medical certificate" Icon={HeartPulse} result={data.medical}
              detail={data.medical.item ? data.medical.item.label : 'No medical certificate logged'} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium text-slate-400">Other expirations</h2>
              <button onClick={() => navigate('/currency/new')} className="flex items-center gap-1 text-sm text-accent-strong">
                <Plus size={15} />Add
              </button>
            </div>

            {data.custom.length === 0 ? (
              <EmptyState icon={FileClock} title="Nothing else tracked"
                description="Add a passport, insurance renewal, or anything else with an expiry date." />
            ) : (
              <ul className="grid gap-2 md:grid-cols-2">
                {data.custom.map((r) => {
                  const tone = TONE[r.status];
                  const days = daysText(r);
                  return (
                    <li key={r.item.id}>
                      <Card as="button" onClick={() => navigate(`/currency/${r.item.id}`)} className="w-full text-left active:bg-navy-800">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium">{r.item.label}</div>
                            <div className={`mt-0.5 flex items-center gap-1.5 text-sm ${tone.textStrong}`}>
                              <tone.Icon size={14} />{tone.label} · {fmtDate(r.expires)}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <div className="text-right">
                              <div className={`stat-value text-lg ${tone.textStrong}`}>{days.big}</div>
                              <div className="text-xs text-slate-400">{days.small}</div>
                            </div>
                            <ChevronRight size={18} className="text-slate-600" />
                          </div>
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}

      <ConfirmDialog open={confirmRemove} title="Remove flight review?"
        description="This removes your most recently logged flight review. This cannot be undone."
        confirmLabel="Remove" busy={removing} onConfirm={removeReview} onClose={() => setConfirmRemove(false)} />
    </div>
  );
}
