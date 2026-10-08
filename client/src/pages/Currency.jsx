import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { api } from '../lib/api.js';
import { passengerCurrency, instrumentCurrency, flightReviewStatus, medicalCurrency, customExpirations } from '../lib/currency.js';
import { pilotFlights } from '../lib/flightRoles.js';
import ErrorNote from '../components/ErrorNote.jsx';
import Button from '../components/Button.jsx';
import DatePicker from '../components/DatePicker.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { daysText } from '../components/CurrencyStatusCard.jsx';
import { Sheet } from '../ds/Overlays.jsx';
import { MnDot, MnEmpty, MnKv, MnSkeleton } from '../components/mn/Mn.jsx';
import { formatDate as fmtDate } from '../lib/calendar.js';
import '../ds/logbook.css';

const today = () => new Date().toLocaleDateString('en-CA');
const newestFirst = (a, b) => b.date.localeCompare(a.date) || b.id - a.id;
const TONE = { current: { dot: 'ok', label: 'Current' }, expiring: { dot: 'warn', label: 'Expiring soon' }, expired: { dot: 'bad', label: 'Not current' } };

/** One status line: a dot (colour is never the only signal: the status is also written), the name, the status, and the days left or overdue. */
function StatusRow({ title, result, onOpen, to }) {
  const tone = TONE[result.status];
  const days = daysText(result);
  const Tag = to ? Link : 'button';
  const props = to ? { to } : { type: 'button', onClick: onOpen };
  return (
    <Tag {...props} className="mn-st" aria-label={`${title}: ${tone.label}, ${days.big} ${days.small}`}>
      <MnDot tone={tone.dot} label={tone.label} />
      <span className="t"><span className="pri">{title}</span><span className="mn-mut">{tone.label}</span></span>
      <span className="v" aria-hidden="true">{days.big}{typeof days.big === 'number' && <small>d</small>}</span>
    </Tag>
  );
}

/** Currency (minimalist system): one calm row per currency or expiration, the working behind a tap (a sheet), the flight review logged from its sheet. */
export default function Currency() {
  const navigate = useNavigate();
  const [flights, setFlights] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [expirations, setExpirations] = useState([]);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(null); // 'day' | 'night' | 'instrument' | 'review' | 'medical'
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

  const detail = data && {
    day: ['Day passenger currency', data.pax.day, data.pax.day.count >= 3 ? `${data.pax.day.count} landings in the last 90 days` : `${data.pax.day.count} of 3 landings in the last 90 days`],
    night: ['Night passenger currency', data.pax.night, '3 night landings within the preceding 90 days'],
    instrument: ['Instrument currency', data.inst, `${data.inst.approaches}/${data.inst.requiredApproaches} approaches · ${data.inst.holds}/${data.inst.requiredHolds} hold in 6 months`],
    review: ['Flight review', data.review, data.review.lastReview ? `Last review ${fmtDate(data.review.lastReview)} · due ${fmtDate(data.review.expires)}` : 'No flight review logged'],
    medical: ['Medical certificate', data.medical, data.medical.item ? data.medical.item.label : 'No medical certificate logged'],
  };
  const open = sheet && detail ? detail[sheet] : null;

  return (
    <div className="cl mn">
      {error && <ErrorNote message={error} onRetry={load} />}
      {!data && !error && <MnSkeleton rows={5} />}

      {data && (
        <>
          <div className="mn-card mn-rise">
            {Object.entries(detail).map(([k, [title, result]]) => <StatusRow key={k} title={title} result={result} onOpen={() => setSheet(k)} />)}
          </div>

          <div className="mn-ctl">
            <h2 className="mn-sub">Other expirations</h2>
            <button type="button" onClick={() => navigate('/currency/new')} className="gl clear gl-chip" aria-label="Add an expiration" title="Add an expiration"><Plus aria-hidden="true" />Add</button>
          </div>
          {data.custom.length === 0 ? (
            <MnEmpty title="Nothing else tracked" compact />
          ) : (
            <div className="mn-card">
              {data.custom.map((r) => (
                <StatusRow key={r.item.id} title={r.item.label} result={r} to={`/currency/${r.item.id}`} />
              ))}
            </div>
          )}
        </>
      )}

      <Sheet open={Boolean(open)} onClose={() => { setSheet(null); cancelReview(); }} title={open ? open[0] : 'Currency'} detent="medium">
        {open && (
          <div className="cl mn mn-sheet">
            <MnKv k="Status" v={TONE[open[1].status].label} />
            <MnKv k={daysText(open[1]).small === 'no qualifying history' ? 'History' : 'Days'} v={daysText(open[1]).small === 'no qualifying history' ? 'None qualifying' : `${daysText(open[1]).big} ${daysText(open[1]).small}`} />
            <p className="mn-note">{open[2]}</p>
            {sheet === 'review' && (logging ? (
              <form onSubmit={logReview} className="mn-sheet" style={{ padding: 0 }}>
                <DatePicker label={editingId ? 'Change review date' : 'Flight review date'} value={reviewDate} onChange={setReviewDate} />
                <Button size="lg">Save</Button>
                <Button type="button" variant="ghost" onClick={cancelReview}>Cancel</Button>
              </form>
            ) : (
              <>
                <Button size="lg" onClick={startAdd}>Log a flight review</Button>
                {reviews.length > 0 && (
                  <>
                    <Button variant="secondary" onClick={startEdit}>Change date</Button>
                    <Button variant="danger" onClick={() => setConfirmRemove(true)}>Remove last review</Button>
                  </>
                )}
              </>
            ))}
            {sheet === 'medical' && !data.medical.item && <Button as={Link} to="/currency/new" size="lg">Add a medical</Button>}
          </div>
        )}
      </Sheet>

      <ConfirmDialog open={confirmRemove} title="Remove flight review?"
        description="This removes your most recently logged flight review. This cannot be undone."
        confirmLabel="Remove" busy={removing} onConfirm={removeReview} onClose={() => setConfirmRemove(false)} />
    </div>
  );
}
