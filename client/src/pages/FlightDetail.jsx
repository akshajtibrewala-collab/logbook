import { useCallback, useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { api, fetchAllRates } from '../lib/api.js';
import { fmtHours } from '../lib/hours.js';
import { computeFlightCost, fmtMoney } from '../lib/cost.js';
import Button from '../components/Button.jsx';
import ErrorNote from '../components/ErrorNote.jsx';
import PhotoGallery from '../components/PhotoGallery.jsx';
import { MnFold, MnKv, MnSkeleton } from '../components/mn/Mn.jsx';
import { formatDate as fmtDate, parseISO } from '../lib/calendar.js';
import { isPilotFlight } from '../lib/flightRoles.js';
import { labelFor, SEAT_CLASSES } from '../lib/aviationEnums.js';
import { zonedToUtc, zuluHHMM } from '../lib/timezone.js';
import '../ds/logbook.css';

// Every non-zero time beyond PIC and Dual sits behind "All times".
const MAIN_TIMES = [['pic_time', 'PIC'], ['dual_received', 'Dual received']];
const MORE_TIMES = [
  ['sic_time', 'SIC'], ['dual_given', 'Dual given'], ['solo_time', 'Solo'], ['simulator_time', 'Simulator'], ['ground_time', 'Ground instruction'], ['night_time', 'Night'],
  ['cross_country_time', 'Cross-country'], ['instrument_actual', 'Instrument (actual)'], ['instrument_simulated', 'Instrument (simulated)'],
];
const COUNT_FIELDS = [['day_landings', 'Day landings'], ['night_landings', 'Night landings'], ['approaches', 'Approaches'], ['holds', 'Holds']];

// The number of photos on this flight (the Photos row appears only when there are some).
function usePhotoCount(flightId) {
  const [count, setCount] = useState(0);
  useEffect(() => { api.photoCounts().then((c) => setCount(c[flightId] || 0)).catch(() => {}); }, [flightId]);
  return count;
}

/** A flight or passenger flight in the minimalist detail layout: the hours numeral, three headline figures, a short card, and everything else one tap down. */
export default function FlightDetail() {
  const { id } = useParams();
  // Nested under either /logbook or /travel (App.jsx) — reused as-is for both, so back/edit stay on
  // whichever page the flight was opened from rather than always returning to the pilot logbook.
  const base = useLocation().pathname.startsWith('/travel') ? '/travel' : '/logbook';
  const [flight, setFlight] = useState(null);
  const [error, setError] = useState('');
  const [rates, setRates] = useState(null);
  const [phases, setPhases] = useState(null);
  const [tz, setTz] = useState({});
  const [open, setOpen] = useState({});
  const [showCode, setShowCode] = useState(false);
  const photoCount = usePhotoCount(Number(id));
  const fold = (k) => ({ open: Boolean(open[k]), onToggle: () => setOpen((o) => ({ ...o, [k]: !o[k] })) });

  const load = useCallback(() => {
    setError('');
    setFlight(null);
    api.getFlight(id).then(setFlight).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);
  useEffect(() => { fetchAllRates().then(setRates).catch(() => {}); }, []);
  useEffect(() => { api.listTrainingPhases().then(setPhases).catch(() => {}); }, []);
  // Local departure/arrival times are stored in wall-clock form (dep_time/arr_time); the airports' zones
  // are only looked up here to also show the UTC instant, same as the flight form's live preview.
  useEffect(() => {
    if (!flight?.dep_time || !flight?.arr_time) return;
    const codes = [...new Set([flight.departure_airport, flight.arrival_airport].filter(Boolean))];
    if (!codes.length) return;
    api.resolveAirports(codes).then((found) => {
      setTz(Object.fromEntries(Object.entries(found).map(([c, a]) => [c, a.tz ?? null])));
    }).catch(() => {});
  }, [flight?.dep_time, flight?.arr_time, flight?.departure_airport, flight?.arrival_airport]);

  const cost = flight && rates && phases ? computeFlightCost(flight, rates, phases) : null;

  const route = flight ? [flight.departure_airport, ...flight.stops.map((s) => s.airport_code), flight.arrival_airport].filter(Boolean) : [];
  const pilot = !flight || isPilotFlight(flight);
  const routeTitle = route.length > 1 ? route.join(' → ') : (flight?.departure_airport || flight?.arrival_airport || 'Local flight');
  const local = Boolean(flight) && flight.stops.length === 0 && Boolean(flight.departure_airport) && flight.departure_airport.trim().toUpperCase() === (flight.arrival_airport || '').trim().toUpperCase();
  const moreTimes = flight ? MORE_TIMES.filter(([k]) => Number(flight[k]) > 0) : [];
  const counts = flight ? COUNT_FIELDS.filter(([k]) => Number(flight[k]) > 0) : [];

  const utcLine = () => {
    if (!flight?.dep_time || !flight?.arr_time) return null;
    const depTz = tz[flight.departure_airport];
    const arrTz = tz[flight.arrival_airport];
    if (!depTz || !arrTz) return null;
    const day = parseISO(flight.date);
    if (!day) return null;
    const [dh, dm] = flight.dep_time.split(':').map(Number);
    const [ah, am] = flight.arr_time.split(':').map(Number);
    const depUtc = zonedToUtc({ ...day, hour: dh, minute: dm }, depTz);
    const arrDay = new Date(Date.UTC(day.y, day.m - 1, day.d + (flight.arr_day_offset || 0)));
    const arrUtc = zonedToUtc({ y: arrDay.getUTCFullYear(), m: arrDay.getUTCMonth() + 1, d: arrDay.getUTCDate(), hour: ah, minute: am }, arrTz);
    const dayDiff = Math.round((Date.UTC(arrDay.getUTCFullYear(), arrDay.getUTCMonth(), arrDay.getUTCDate()) - Date.UTC(day.y, day.m - 1, day.d)) / 86400000);
    return `UTC: ${zuluHHMM(depUtc)}Z → ${zuluHHMM(arrUtc)}${dayDiff > 0 ? `+${dayDiff}` : ''}Z`;
  };

  if (error) return <div className="cl mn"><ErrorNote message={error} onRetry={load} /></div>;
  if (!flight) return <div className={`cl mn ${pilot ? '' : 'pax'}`}><MnSkeleton rows={3} /></div>;

  const utc = utcLine();
  const landings = flight.day_landings + flight.night_landings;
  const title = local ? `Local ${flight.departure_airport.trim().toUpperCase()}` : routeTitle;
  const tailOrType = flight.tail_number || flight.aircraft_type || '';
  const trio = pilot
    ? [['PIC', fmtHours(flight.pic_time)], ['Dual', fmtHours(flight.dual_received)], ['Landings', landings]]
    : [['Airline', flight.airline], ['Flight', flight.flight_number], ['Class', flight.seat_class ? labelFor(SEAT_CLASSES, flight.seat_class) : '']].filter(([, v]) => v);

  return (
    <div className={`cl mn ${pilot ? '' : 'pax'}`}>
      <div className="mn-detail">
        <div className="head">
          <span className="mn-mut">{[fmtDate(flight.date), tailOrType].filter(Boolean).join(' · ')}</span>
          <h1>{title}</h1>
          <div className="num-row" role="img" aria-label={`${fmtHours(flight.total_time)} hours`}><span className="mn-num accent">{fmtHours(flight.total_time)}</span><span className="mn-u">h</span></div>
        </div>

        {trio.length > 0 && (
          <div className="mn-trio">
            {trio.map(([k, v]) => <div key={k} className="stat"><span className="mn-num">{v}</span><span className="mn-mut">{k}</span></div>)}
          </div>
        )}

        <div className="mn-card">
          {pilot && <MnKv k="Instructor" v={flight.instructor} />}
          <MnKv k="Aircraft" v={flight.aircraft_type} />
          {flight.tail_number && flight.aircraft_type && <MnKv k="Tail" v={flight.tail_number} />}

          {pilot && moreTimes.length > 0 && (
            <MnFold label="All times" value={`${moreTimes.length + 3}`} {...fold('times')}>
              <div>{[['total_time', 'Total'], ...MAIN_TIMES, ...moreTimes].map(([k, label]) => <MnKv key={k} k={label} v={`${fmtHours(flight[k])} h`} />)}</div>
            </MnFold>
          )}
          {pilot && counts.length > 0 && (
            <MnFold label="Landings and approaches" value={`${landings}`} {...fold('counts')}>
              <div>
                {counts.map(([k, label]) => (
                  <MnKv key={k} v={flight[k]}
                    k={`${label}${k === 'day_landings' && flight.day_landings_full_stop > 0 ? ` (${flight.day_landings_full_stop} full stop)` : ''}${k === 'night_landings' && flight.night_landings_full_stop > 0 ? ` (${flight.night_landings_full_stop} full stop)` : ''}`} />
                ))}
                {flight.approach_types?.map((a) => <MnKv key={a.approach_type} k={a.approach_type} v={`×${a.count}`} />)}
              </div>
            </MnFold>
          )}
          {flight.stops.length > 0 && (
            <MnFold label="Stops" value={flight.stops.length} {...fold('stops')}>
              <div>{flight.stops.map((s, i) => <MnKv key={i} k={`${i + 1}. ${s.airport_code}`} v={s.stop_type === 'touch_and_go' ? 'Touch & go' : 'Full stop'} />)}</div>
            </MnFold>
          )}
          {!pilot && flight.dep_time && flight.arr_time && (
            <MnFold label="Local times" value="" {...fold('local')}>
              <div>
                <MnKv k={`Departs ${flight.departure_airport || ''}`.trim()} v={flight.dep_time} />
                <MnKv k={`Arrives ${flight.arrival_airport || ''}`.trim()} v={`${flight.arr_time}${flight.arr_day_offset > 0 ? ` +${flight.arr_day_offset}` : ''}`} />
                {utc && <p className="mn-note">{utc}</p>}
              </div>
            </MnFold>
          )}
          {!pilot && flight.confirmation_code && (
            <MnFold label="Booking" value="" {...fold('booking')}>
              <div><button type="button" className="gl link sm" aria-pressed={showCode} onClick={() => setShowCode((s) => !s)}>{showCode ? flight.confirmation_code : 'Show confirmation code'}</button></div>
            </MnFold>
          )}
          {flight.remarks && <MnFold label="Note" value="" {...fold('note')}><p>{flight.remarks}</p></MnFold>}
          {pilot && (flight.debrief_went_well || flight.debrief_work_on) && (
            <MnFold label="Debrief" value="" {...fold('debrief')}>
              {flight.debrief_went_well && <p><span className="k">What went well</span>{flight.debrief_went_well}</p>}
              {flight.debrief_work_on && <p><span className="k">What to work on</span>{flight.debrief_work_on}</p>}
            </MnFold>
          )}
          {photoCount > 0 && <MnFold label="Photos" value={photoCount} {...fold('photos')}><PhotoGallery flightId={flight.id} /></MnFold>}
          {pilot && cost && (cost.total > 0 || cost.override) && (
            <MnFold label="Cost" value={fmtMoney(cost.total)} {...fold('cost')}>
              <div>
                <MnKv k="Cost" v={fmtMoney(cost.total)} />
                {cost.override && <p className="mn-note">Manual override{cost.computedTotal !== null ? ` · calculated was ${fmtMoney(cost.computedTotal)}` : ' · outside a cost-tracked phase'}</p>}
                {cost.missingRate && <p className="mn-note" style={{ color: 'var(--ds-bad)' }}>A rate wasn't set for part of this flight. See Costs settings.</p>}
              </div>
            </MnFold>
          )}
        </div>

        <div className="mn-actions">
          <Button as={Link} to={`/logbook/${id}/edit${base === '/travel' ? '?from=travel' : ''}`} variant={pilot ? 'primary' : 'pax'} size="lg" icon={Pencil}>Edit flight</Button>
        </div>
      </div>
    </div>
  );
}
