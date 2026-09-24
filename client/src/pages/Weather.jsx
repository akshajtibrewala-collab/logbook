import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings, Plus, X, CloudSun } from 'lucide-react';
import { api } from '../lib/api.js';
import {
  blankLeg, changeAirport, applyResolved, setLegWall, legWall, legZone, legTimeLabel, tzNotice, planPayload,
} from '../lib/planlegs.js';
import AirportSearchField from '../components/AirportSearchField.jsx';
import WeatherConditions from '../components/WeatherConditions.jsx';
import DatePicker from '../components/DatePicker.jsx';
import Button from '../components/Button.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorNote from '../components/ErrorNote.jsx';

const NOTE = 'A personal planning aid, not a substitute for an official weather briefing. Conditions are shown as within, near, or outside your minimums — never as "safe".';

// "Thu 15:00 MDT / 21:00Z" — the airport's own zone plus Zulu, never the device's zone, since a device in
// one time zone checking weather for an airport in another would otherwise mislabel it. A missing zone
// is stated plainly (UTC) rather than guessed. See lib/planlegs.js.
const timeLabel = (instant, tz) => legTimeLabel({ etaUtc: new Date(instant).toISOString(), tz: tz ?? null });

function AirportCheck() {
  const [ident, setIdent] = useState('');
  const [defaultLoaded, setDefaultLoaded] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getSettings().then((s) => { if (s.home_airport_ident) setIdent(s.home_airport_ident); }).finally(() => setDefaultLoaded(true));
  }, []);

  // Every change of airport drops whatever was loaded for the previous one immediately (so its conditions
  // are never shown under the new airport's name) and ignores any answer that arrives late for an
  // airport the pilot has already moved on from.
  useEffect(() => {
    setData(null);
    setError('');
    if (!defaultLoaded || !ident.trim()) { setLoading(false); return undefined; }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      api.checkWeather(ident.trim())
        .then((d) => { if (!cancelled) setData(d); })
        .catch((e) => { if (!cancelled) setError(e.message); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [ident, defaultLoaded]);

  return (
    <div className="space-y-4">
      <AirportSearchField label="Airport" value={ident} onChange={setIdent} />
      {error && <ErrorNote message={error} />}
      {loading && !data && <><Skeleton className="h-40" /><Skeleton className="h-24" /></>}
      {data && (
        <>
          {!data.airport.tz && (
            <p role="status" className="rounded-xl bg-warn/10 p-3 text-xs text-warn">
              Time zone for {data.airport.ident} isn't available — forecast times are shown in UTC (Z).
            </p>
          )}
          <div>
            <h2 className="mb-2 text-sm font-medium text-slate-400">Current conditions{data.airport.name ? ` — ${data.airport.name}` : ''}</h2>
            <WeatherConditions data={data.current} />
          </div>
          <div>
            <h2 className="mb-2 text-sm font-medium text-slate-400">Forecast</h2>
            {data.forecast.unavailable
              ? <WeatherConditions data={data.forecast} />
              : (
                <div className="space-y-2">
                  {data.forecast.periods.map((p) => (
                    <WeatherConditions key={p.time} data={p} label={timeLabel(p.time, data.airport.tz)} />
                  ))}
                </div>
              )}
          </div>
        </>
      )}
    </div>
  );
}

function PlanFlight() {
  const [legs, setLegs] = useState([blankLeg(), blankLeg()]); // departure, destination
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Anything the pilot changes makes the last answer stale, so it is cleared rather than left on screen
  // next to inputs it no longer matches.
  const edit = (fn) => { setResults(null); setError(''); setLegs(fn); };
  const setLeg = (i, fn) => edit((ls) => ls.map((l, idx) => (idx === i ? fn(l) : l)));
  const addStop = () => edit((ls) => [...ls.slice(0, -1), blankLeg(), ls[ls.length - 1]]);
  const removeStop = (i) => edit((ls) => ls.filter((_, idx) => idx !== i));

  // Airport time zones are looked up as soon as an ident looks complete (debounced while typing). The
  // answer is applied only to a leg still waiting on that same ident, so a slow reply for an airport the
  // pilot has already changed can never land on the wrong leg. Times are UTC instants throughout — the
  // zone is used purely to read and display them.
  const pendingKey = legs.map((l) => (l.tzStatus === 'pending' ? l.ident.trim().toUpperCase() : '')).join(',');
  useEffect(() => {
    const idents = [...new Set(pendingKey.split(',').filter(Boolean))];
    if (!idents.length) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      api.resolveAirports(idents)
        .catch(() => ({}))
        .then((found) => {
          if (cancelled) return;
          setLegs((ls) => ls.map((l) => (l.tzStatus === 'pending' && idents.includes(l.ident.trim().toUpperCase()) ? applyResolved(l, found) : l)));
        });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [pendingKey]);

  async function check(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResults(null);
    try {
      const payload = planPayload(legs);
      if (!payload.length) { setError('Enter at least one airport and time.'); return; }
      setResults(await api.planWeather(payload));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const labels = legs.map((_, i) => (i === 0 ? 'Departure' : i === legs.length - 1 ? 'Destination' : `Stop ${i}`));

  return (
    <form onSubmit={check} className="space-y-4">
      {legs.map((leg, i) => {
        const notice = tzNotice(leg);
        const dateLabel = leg.tzStatus === 'unknown' ? 'Arrival date & time (UTC — zone unknown)'
          : leg.tzStatus === 'pending' ? 'Arrival date & time (looking up airport time zone…)'
          : 'Arrival date & time (airport local)';
        return (
          <div key={i} className="card space-y-2 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">{labels[i]}</span>
              {i > 0 && i < legs.length - 1 && (
                <button type="button" onClick={() => removeStop(i)} aria-label="Remove stop" className="flex h-11 w-11 items-center justify-center text-slate-500 active:text-bad"><X size={16} /></button>
              )}
            </div>
            <AirportSearchField value={leg.ident} onChange={(v) => setLeg(i, (l) => changeAirport(l, v))} />
            {/* The picker reads/writes the wall clock in THIS airport's zone; the value is derived from the
                stored UTC instant, so switching airports re-reads the same moment rather than moving it.
                `min` is a real UTC instant, compared in that same zone. */}
            <DatePicker label={dateLabel} withTime zone={legZone(leg)} min={new Date().toISOString()}
              value={legWall(leg)} onChange={(v) => setLeg(i, (l) => setLegWall(l, v))} />
            {leg.etaUtc && <p className="text-xs text-slate-400" data-testid={`leg-time-${i}`}>{legTimeLabel(leg)}</p>}
            {notice && <p role="status" className="text-xs text-warn">{notice}</p>}
          </div>
        );
      })}

      <Button type="button" variant="secondary" icon={Plus} onClick={addStop}>Add a stop</Button>
      {error && <ErrorNote message={error} />}
      <Button disabled={loading}>{loading ? 'Checking…' : 'Check forecast'}</Button>

      {results && (
        <div className="space-y-2 pt-2">
          {results.legs.map((leg, i) => {
            if (leg.error) return <p key={i} className="text-sm text-bad">{leg.ident}: {leg.error}</p>;
            const period = leg.forecast?.periods?.[0];
            return (
              <WeatherConditions key={i} data={period ?? leg.forecast}
                label={`${leg.airport?.ident ?? leg.ident} — ${timeLabel(leg.eta, leg.airport?.tz)}`} />
            );
          })}
        </div>
      )}
    </form>
  );
}

export default function Weather() {
  const [mode, setMode] = useState('airport');

  return (
    <div className="stagger space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><CloudSun size={22} className="text-accent" />Weather</h1>
        <Link to="/weather/settings" aria-label="Weather settings" className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-800 text-slate-300 active:text-accent">
          <Settings size={20} />
        </Link>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setMode('airport')}
          className={`h-10 flex-1 rounded-xl text-sm font-medium ${mode === 'airport' ? 'bg-accent text-ink' : 'border border-edge text-slate-400'}`}>
          This airport
        </button>
        <button type="button" onClick={() => setMode('plan')}
          className={`h-10 flex-1 rounded-xl text-sm font-medium ${mode === 'plan' ? 'bg-accent text-ink' : 'border border-edge text-slate-400'}`}>
          Plan a flight
        </button>
      </div>

      {mode === 'airport' ? <AirportCheck /> : <PlanFlight />}

      <p className="px-1 text-xs text-slate-500">{NOTE}</p>
    </div>
  );
}
