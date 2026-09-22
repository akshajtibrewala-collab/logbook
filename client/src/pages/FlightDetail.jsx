import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Plane } from 'lucide-react';
import { api } from '../lib/api.js';
import { fmtHours } from '../lib/hours.js';
import Skeleton from '../components/Skeleton.jsx';
import ErrorNote from '../components/ErrorNote.jsx';
import AirlineBadge from '../components/AirlineBadge.jsx';
import Badge from '../components/Badge.jsx';

const TIME_FIELDS = [
  ['pic_time', 'PIC'], ['sic_time', 'SIC'], ['dual_received', 'Dual received'], ['dual_given', 'Dual given'],
  ['solo_time', 'Solo'], ['simulator_time', 'Simulator'], ['night_time', 'Night'], ['cross_country_time', 'Cross-country'],
  ['instrument_actual', 'Instrument (actual)'], ['instrument_simulated', 'Instrument (simulated)'],
];
const COUNT_FIELDS = [
  ['day_landings', 'Day landings'], ['night_landings', 'Night landings'],
  ['approaches', 'Approaches'], ['holds', 'Holds'],
];

const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

function Section({ title, children }) {
  return (
    <section className="card p-4">
      <h2 className="mb-3 text-sm font-medium text-accent">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-lg font-semibold">{fmtHours(value)}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

export default function FlightDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [flight, setFlight] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    setFlight(null);
    api.getFlight(id).then(setFlight).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  const route = flight ? [flight.departure_airport, ...flight.stops.map((s) => s.airport_code), flight.arrival_airport].filter(Boolean) : [];
  const times = flight ? TIME_FIELDS.filter(([k]) => Number(flight[k]) > 0) : [];
  const counts = flight ? COUNT_FIELDS.filter(([k]) => Number(flight[k]) > 0) : [];

  return (
    <div className="stagger space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/logbook')} className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800" aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold">Flight</h1>
        {flight && (
          <Link to={`/logbook/${id}/edit`} aria-label="Edit flight" className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800 text-slate-300 active:text-accent">
            <Pencil size={18} />
          </Link>
        )}
      </div>

      {error && <ErrorNote message={error} onRetry={load} />}
      {!flight && !error && (
        <><Skeleton className="h-24" /><Skeleton className="h-32" /><Skeleton className="h-24" /></>
      )}

      {flight && (
        <>
          <section className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-lg font-semibold">{route.length > 1 ? route.join(' → ') : (flight.departure_airport || flight.arrival_airport || 'Local flight')}</div>
                <div className="mt-0.5 text-sm text-slate-400">{fmtDate(flight.date)}</div>
              </div>
              <div className="shrink-0 text-right text-3xl font-semibold text-accent">{fmtHours(flight.total_time)}</div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {flight.airline && <AirlineBadge airline={flight.airline} />}
              {flight.flight_number && <Badge tone="neutral">{flight.flight_number}</Badge>}
              {(flight.aircraft_type || flight.tail_number) && (
                <Badge tone="neutral" icon={Plane}>{[flight.aircraft_type, flight.tail_number].filter(Boolean).join(' · ')}</Badge>
              )}
            </div>
            {flight.stops.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-edge pt-3 text-sm">
                {flight.stops.map((s, i) => (
                  <li key={i} className="flex items-center justify-between text-slate-300">
                    <span>{s.airport_code}</span>
                    <span className="text-slate-400">{s.stop_type === 'touch_and_go' ? 'Touch & go' : 'Full stop'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {times.length > 0 && (
            <Section title="Time">
              <div className="grid grid-cols-2 gap-3">
                {times.map(([k, label]) => <Stat key={k} label={label} value={flight[k]} />)}
              </div>
            </Section>
          )}

          {counts.length > 0 && (
            <Section title="Landings & approaches">
              <div className="grid grid-cols-4 gap-3">
                {counts.map(([k, label]) => (
                  <div key={k}>
                    <div className="text-lg font-semibold">{flight[k]}</div>
                    <div className="text-xs text-slate-400">
                      {label}
                      {k === 'day_landings' && flight.day_landings_full_stop > 0 && ` (${flight.day_landings_full_stop} full stop)`}
                      {k === 'night_landings' && flight.night_landings_full_stop > 0 && ` (${flight.night_landings_full_stop} full stop)`}
                    </div>
                  </div>
                ))}
              </div>
              {flight.approach_types?.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-edge pt-3 text-sm">
                  {flight.approach_types.map((a) => (
                    <li key={a.id} className="flex items-center justify-between text-slate-300">
                      <span>{a.approach_type}</span>
                      <span className="text-slate-400">×{a.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          {flight.remarks && (
            <Section title="Remarks">
              <p className="whitespace-pre-wrap text-sm text-slate-300">{flight.remarks}</p>
            </Section>
          )}

          {(flight.debrief_went_well || flight.debrief_work_on) && (
            <Section title="Debrief">
              <div className="space-y-3">
                {flight.debrief_went_well && (
                  <div>
                    <div className="text-xs text-slate-400">What went well</div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-300">{flight.debrief_went_well}</p>
                  </div>
                )}
                {flight.debrief_work_on && (
                  <div>
                    <div className="text-xs text-slate-400">What to work on</div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-300">{flight.debrief_work_on}</p>
                  </div>
                )}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
