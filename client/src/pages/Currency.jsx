import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plane, Moon, Gauge, ClipboardCheck, HeartPulse, FileClock, Plus, ChevronRight } from 'lucide-react';
import { api } from '../lib/api.js';
import { passengerCurrency, instrumentCurrency, flightReviewStatus, medicalCurrency, customExpirations } from '../lib/currency.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorNote from '../components/ErrorNote.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Card from '../components/Card.jsx';
import CurrencyStatusCard, { TONE, daysText } from '../components/CurrencyStatusCard.jsx';
import { formatDate as fmtDate } from '../lib/calendar.js';

const today = () => new Date().toLocaleDateString('en-CA');

export default function Currency() {
  const navigate = useNavigate();
  const [flights, setFlights] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [expirations, setExpirations] = useState([]);
  const [error, setError] = useState('');
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
    return {
      pax: passengerCurrency(flights, now),
      inst: instrumentCurrency(flights, now),
      review: flightReviewStatus(reviews, now),
      medical: medicalCurrency(expirations, now),
      custom: customExpirations(expirations, now),
    };
  }, [flights, reviews, expirations, now]);

  return (
    <div className="stagger space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/')} className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800" aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-semibold">Currency & expirations</h1>
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
              detail={data.review.lastReview ? `Last review ${fmtDate(data.review.lastReview)}` : 'No flight review logged'} />

            <CurrencyStatusCard title="Medical certificate" Icon={HeartPulse} result={data.medical}
              detail={data.medical.item ? data.medical.item.label : 'No medical certificate logged'} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium text-slate-400">Other expirations</h2>
              <button onClick={() => navigate('/currency/new')} className="flex items-center gap-1 text-sm text-accent">
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
                            <div className={`mt-0.5 flex items-center gap-1.5 text-sm ${tone.text}`}>
                              <tone.Icon size={14} />{tone.label} · {fmtDate(r.expires)}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <div className="text-right">
                              <div className={`text-lg font-semibold leading-none ${tone.text}`}>{days.big}</div>
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
    </div>
  );
}
