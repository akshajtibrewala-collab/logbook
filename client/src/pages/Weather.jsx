import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings, Plus, X, CloudSun } from 'lucide-react';
import { api } from '../lib/api.js';
import AirportSearchField from '../components/AirportSearchField.jsx';
import WeatherConditions from '../components/WeatherConditions.jsx';
import DatePicker from '../components/DatePicker.jsx';
import Button from '../components/Button.jsx';
import Skeleton from '../components/Skeleton.jsx';
import ErrorNote from '../components/ErrorNote.jsx';

const NOTE = 'A personal planning aid, not a substitute for an official weather briefing. Conditions are shown as within, near, or outside your minimums — never as "safe".';

const fmtTime = (iso) => new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });

function AirportCheck() {
  const [ident, setIdent] = useState('');
  const [defaultLoaded, setDefaultLoaded] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getSettings().then((s) => { if (s.home_airport_ident) setIdent(s.home_airport_ident); }).finally(() => setDefaultLoaded(true));
  }, []);

  useEffect(() => {
    if (!defaultLoaded || !ident.trim()) { setData(null); return undefined; }
    setLoading(true);
    setError('');
    const timer = setTimeout(() => {
      api.checkWeather(ident.trim()).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [ident, defaultLoaded]);

  return (
    <div className="space-y-4">
      <AirportSearchField label="Airport" value={ident} onChange={setIdent} />
      {error && <ErrorNote message={error} />}
      {loading && !data && <><Skeleton className="h-40" /><Skeleton className="h-24" /></>}
      {data && (
        <>
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
                    <WeatherConditions key={p.time} data={p} label={fmtTime(p.time)} />
                  ))}
                </div>
              )}
          </div>
        </>
      )}
    </div>
  );
}

function blankLeg() { return { ident: '', eta: '' }; }

function PlanFlight() {
  const [legs, setLegs] = useState([blankLeg(), blankLeg()]); // departure, destination
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setLeg = (i, patch) => setLegs((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addStop = () => setLegs((ls) => [...ls.slice(0, -1), blankLeg(), ls[ls.length - 1]]);
  const removeStop = (i) => setLegs((ls) => ls.filter((_, idx) => idx !== i));

  async function check(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResults(null);
    try {
      const valid = legs.filter((l) => l.ident.trim() && l.eta);
      if (!valid.length) { setError('Enter at least one airport and time.'); return; }
      const res = await api.planWeather(valid.map((l) => ({ ident: l.ident.trim(), eta: new Date(l.eta).toISOString() })));
      setResults(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const labels = legs.map((_, i) => (i === 0 ? 'Departure' : i === legs.length - 1 ? 'Destination' : `Stop ${i}`));

  return (
    <form onSubmit={check} className="space-y-4">
      {legs.map((leg, i) => (
        <div key={i} className="card space-y-2 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">{labels[i]}</span>
            {i > 0 && i < legs.length - 1 && (
              <button type="button" onClick={() => removeStop(i)} aria-label="Remove stop" className="text-slate-500 active:text-bad"><X size={16} /></button>
            )}
          </div>
          <AirportSearchField value={leg.ident} onChange={(v) => setLeg(i, { ident: v })} />
          <DatePicker label="Arrival date & time (local)" withTime value={leg.eta} onChange={(v) => setLeg(i, { eta: v })} />
        </div>
      ))}

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
                label={`${leg.airport?.ident ?? leg.ident} — ${fmtTime(leg.eta)}`} />
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
