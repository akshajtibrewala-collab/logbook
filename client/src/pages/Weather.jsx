import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, Plus, Settings, X } from 'lucide-react';
import { api } from '../lib/api.js';
import {
  blankLeg, changeAirport, applyResolved, setLegWall, legWall, legZone, legTimeLabel, legDateLabel, tzNotice, planPayload,
} from '../lib/planlegs.js';
import AirportSearchField from '../components/AirportSearchField.jsx';
import WeatherConditions from '../components/WeatherConditions.jsx';
import DatePicker from '../components/DatePicker.jsx';
import Button from '../components/Button.jsx';
import ErrorNote from '../components/ErrorNote.jsx';
import { Sheet } from '../ds/Overlays.jsx';
import { Segmented } from '../ds/Controls.jsx';
import { MnSkeleton } from '../components/mn/Mn.jsx';
import '../ds/logbook.css';

const NOTE = 'A personal planning aid, not a substitute for an official weather briefing. Conditions are shown as within, near, or outside your minimums, never as "safe".';
const MODES = [{ value: 'airport', label: 'Airport' }, { value: 'plan', label: 'Plan' }];

// "Thu 15:00 MDT / 21:00Z": the airport's own zone plus Zulu, never the device's zone, since a device in one time zone checking weather for an airport in
// another would otherwise mislabel it. A missing zone is stated plainly (UTC) rather than guessed. See lib/planlegs.js.
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

  // Every change of airport drops whatever was loaded for the previous one immediately (so its conditions are never shown under the new airport's name)
  // and ignores any answer that arrives late for an airport the pilot has already moved on from.
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
    <div className="mn mn-form">
      <AirportSearchField label="Airport" value={ident} onChange={setIdent} />
      {error && <ErrorNote message={error} />}
      {loading && !data && <MnSkeleton rows={2} />}
      {data && (
        <>
          {!data.airport.tz && (
            <p role="status" className="mn-err">Time zone for {data.airport.ident} isn't available. Forecast times are shown in UTC (Z).</p>
          )}
          <h2 className="mn-sub">Now{data.airport.name ? `, ${data.airport.name}` : ''}</h2>
          <WeatherConditions data={data.current} />
          <h2 className="mn-sub">Forecast</h2>
          {data.forecast.unavailable
            ? <WeatherConditions data={data.forecast} />
            : data.forecast.periods.map((p) => <WeatherConditions key={p.time} data={p} label={timeLabel(p.time, data.airport.tz)} />)}
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

  // Anything the pilot changes makes the last answer stale, so it is cleared rather than left on screen next to inputs it no longer matches.
  const edit = (fn) => { setResults(null); setError(''); setLegs(fn); };
  const setLeg = (i, fn) => edit((ls) => ls.map((l, idx) => (idx === i ? fn(l) : l)));
  const addStop = () => edit((ls) => [...ls.slice(0, -1), blankLeg(), ls[ls.length - 1]]);
  const removeStop = (i) => edit((ls) => ls.filter((_, idx) => idx !== i));

  // Airport time zones are looked up as soon as an ident looks complete (debounced while typing). The answer is applied only to a leg still waiting on that
  // same ident, so a slow reply for an airport the pilot has already changed can never land on the wrong leg. Times are UTC instants throughout; the zone is
  // used purely to read and display them.
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
    <form onSubmit={check} className="mn mn-form">
      {legs.map((leg, i) => {
        const notice = tzNotice(leg);
        const dateLabel = legDateLabel(i, leg);
        return (
          <div key={i} className="mn-card" style={{ padding: 20, gap: 16 }}>
            <div className="mn-ctl">
              <span className="mn-lab">{labels[i]}</span>
              {i > 0 && i < legs.length - 1 && (
                <button type="button" onClick={() => removeStop(i)} aria-label="Remove stop" title="Remove stop" className="gl plain icon"><X className="ds-i" aria-hidden="true" /></button>
              )}
            </div>
            <AirportSearchField value={leg.ident} onChange={(v) => setLeg(i, (l) => changeAirport(l, v))} />
            {/* The picker reads/writes the wall clock in THIS airport's zone; the value is derived from the stored UTC instant, so switching airports
                re-reads the same moment rather than moving it. `min` is a real UTC instant, compared in that same zone. */}
            <DatePicker label={dateLabel} withTime zone={legZone(leg)} min={new Date().toISOString()}
              value={legWall(leg)} onChange={(v) => setLeg(i, (l) => setLegWall(l, v))} />
            {leg.etaUtc && <p className="mn-mut" data-testid={`leg-time-${i}`}>{legTimeLabel(leg)}</p>}
            {notice && <p role="status" className="mn-mut" style={{ color: 'var(--ds-warn)' }}>{notice}</p>}
          </div>
        );
      })}

      <Button type="button" variant="secondary" icon={Plus} onClick={addStop}>Add a stop</Button>
      {error && <ErrorNote message={error} />}
      <Button size="lg" disabled={loading}>{loading ? 'Checking…' : 'Check forecast'}</Button>

      {results && results.legs.map((leg, i) => {
        if (leg.error) return <p key={i} className="mn-err">{leg.ident}: {leg.error}</p>;
        const period = leg.forecast?.periods?.[0];
        return <WeatherConditions key={i} data={period ?? leg.forecast} label={`${leg.airport?.ident ?? leg.ident}, ${timeLabel(leg.eta, leg.airport?.tz)}`} />;
      })}
    </form>
  );
}

/** Weather (minimalist system): the verdict against your personal minimums, the numbers, and the detail one tap down. The planning-aid note is behind the info button. */
export default function Weather() {
  const [mode, setMode] = useState('airport');
  const [note, setNote] = useState(false);

  return (
    <div className="cl mn">
      <div className="mn-ctl">
        <Segmented label="Weather check" scope="pilot" options={MODES} value={mode} onChange={setMode} />
        <span className="ic">
          <button type="button" className="gl clear icon" aria-label="About this check" title="About this check" onClick={() => setNote(true)}><Info className="ds-i" aria-hidden="true" /></button>
          <Link to="/weather/settings" className="gl clear icon" aria-label="Weather settings" title="Weather settings"><Settings className="ds-i" aria-hidden="true" /></Link>
        </span>
      </div>

      {mode === 'airport' ? <AirportCheck /> : <PlanFlight />}

      <p className="mn-note">{NOTE}</p>

      <Sheet open={note} onClose={() => setNote(false)} title="About this check" detent="medium">
        <div className="cl mn mn-sheet"><p className="mn-note" style={{ fontSize: 'var(--fs-p)' }}>{NOTE}</p></div>
      </Sheet>
    </div>
  );
}
