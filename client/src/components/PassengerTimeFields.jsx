import { useEffect, useId, useState } from 'react';
import { api } from '../lib/api.js';
import { passengerDuration, MAX_ARR_DAY_OFFSET } from '../lib/passengerDuration.js';
import { zoneSummary } from '../lib/timezone.js';
import { parseISO } from '../lib/calendar.js';
import HoursInput from './HoursInput.jsx';


const durationLabel = (hours) => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m ? `${h}h ${m}m` : `${h}h`;
};

/**
 * Local departure/arrival time entry for a passenger flight, MyFlightRadar24-style: type each airport's
 * own local clock time and the duration is computed (see client/src/lib/passengerDuration.js), or switch
 * to entering total time directly when an airport's time zone isn't known. `value` is the relevant slice
 * of FlightForm's state ({ date, departure_airport, arrival_airport, dep_time, arr_time, arr_day_offset,
 * total_time }); `onChange(patch)` merges a partial update into it, matching FlightForm's own `set()`.
 */
export default function PassengerTimeFields({ value, onChange, errors = {} }) {
  const [tz, setTz] = useState({}); // { KSTL: 'America/Chicago', ... }
  const uid = useId();
  const [manual, setManual] = useState(!value.dep_time && !value.arr_time && Boolean(value.total_time && Number(value.total_time) > 0));

  const depCode = value.departure_airport?.trim().toUpperCase();
  const arrCode = value.arrival_airport?.trim().toUpperCase();

  useEffect(() => {
    const codes = [...new Set([depCode, arrCode].filter((c) => c && c.length >= 3))];
    if (!codes.length) return;
    api.resolveAirports(codes).then((found) => {
      setTz((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(found).map(([c, a]) => [c, a.tz ?? null])) }));
    }).catch(() => {});
  }, [depCode, arrCode]);

  const depTz = depCode ? tz[depCode] : undefined; // undefined = not looked up yet, null = looked up, no zone
  const arrTz = arrCode ? tz[arrCode] : undefined;
  const day = parseISO(value.date);
  const refDate = day ? new Date(Date.UTC(day.y, day.m - 1, day.d, 12)) : new Date();
  const bothZonesKnown = depTz && arrTz;

  const offsetOverride = value.arr_day_offset === '' || value.arr_day_offset == null ? undefined : Number(value.arr_day_offset);
  const result = !manual && bothZonesKnown && value.dep_time && value.arr_time
    ? passengerDuration({ date: value.date, depTime: value.dep_time, arrTime: value.arr_time, depTz, arrTz, arrDayOffset: offsetOverride })
    : null;

  function setOffset(next) {
    const clamped = Math.max(0, Math.min(MAX_ARR_DAY_OFFSET, next));
    onChange({ arr_day_offset: String(clamped) });
  }

  function switchToManual() {
    setManual(true);
    onChange({ dep_time: '', arr_time: '', arr_day_offset: '' });
  }
  function switchToLocalTimes() {
    setManual(false);
  }

  if (manual) {
    return (
      <div className="col-span-2 space-y-2">
        <HoursInput label="Total time" value={value.total_time} onChange={(v) => onChange({ total_time: v })} error={errors.total_time} />
        {depCode && arrCode && depCode.length >= 3 && arrCode.length >= 3 && (
          <button type="button" onClick={switchToLocalTimes} className="gl link sm">
            Enter local departure/arrival times instead
          </button>
        )}
      </div>
    );
  }

  const depSummary = depCode ? (depTz === undefined ? 'looking up…' : depTz ? zoneSummary(depTz, refDate) : 'zone unknown') : null;
  const arrSummary = arrCode ? (arrTz === undefined ? 'looking up…' : arrTz ? zoneSummary(arrTz, refDate) : 'zone unknown') : null;

  return (
    <div className="col-span-2 pt-wrap">
      {/* Two equal columns while both fit at the current text size, one column below that (minmax in rem, so a larger text size stacks them). One-line labels keep the
          two inputs on the same line; the airport and zone sit under each input, where a long zone name wrapping cannot push one field lower than the other. */}
      <div className="pt-grid">
        <div className="pt-cell">
          <label className="pt-lab" htmlFor={`${uid}-dep`}>Departure time</label>
          <input id={`${uid}-dep`} type="time" value={value.dep_time || ''} onChange={(e) => onChange({ dep_time: e.target.value })} className="gl-field pt-time" />
          {depSummary && <span className="pt-hint">{depCode} local · {depSummary}</span>}
        </div>
        <div className="pt-cell">
          <label className="pt-lab" htmlFor={`${uid}-arr`}>Arrival time</label>
          <input id={`${uid}-arr`} type="time" value={value.arr_time || ''} onChange={(e) => onChange({ arr_time: e.target.value })} className="gl-field pt-time" />
          {arrSummary && <span className="pt-hint">{arrCode} local · {arrSummary}</span>}
        </div>
      </div>

      {value.dep_time && value.arr_time && bothZonesKnown && (
        <div className="pt-calc">
          <div className="pt-calc-t">
            {result && result.hours > 0 ? (
              <>
                <span className="pt-dur">Duration: {durationLabel(result.hours)}</span>
                <span className="pt-sub">
                  {result.arrDayOffset === 0 ? 'arrives same day' : `arrives +${result.arrDayOffset} day${result.arrDayOffset === 1 ? '' : 's'}`}
                </span>
                {result.warning === 'short' && <p className="pt-warn">That's under 20 minutes — double-check the times.</p>}
                {result.warning === 'long' && <p className="pt-warn">That's over 20 hours — double-check the arrival day.</p>}
              </>
            ) : (
              <span className="pt-bad">Arrival isn't after departure — adjust the arrival day.</span>
            )}
          </div>
          <div className="pt-step" role="group" aria-label="Arrival day">
            <button type="button" aria-label="Earlier arrival day" onClick={() => setOffset((offsetOverride ?? result?.arrDayOffset ?? 0) - 1)}
              className="gl clear icon sm">−</button>
            <span className="pt-off">+{offsetOverride ?? result?.arrDayOffset ?? 0}d</span>
            <button type="button" aria-label="Later arrival day" onClick={() => setOffset((offsetOverride ?? result?.arrDayOffset ?? 0) + 1)}
              className="gl clear icon sm">+</button>
          </div>
        </div>
      )}
      {value.dep_time && value.arr_time && !bothZonesKnown && (depTz !== undefined && arrTz !== undefined) && (
        <p className="pt-sub">One of these airports has no known time zone — enter the duration manually below instead.</p>
      )}
      {errors.arr_day_offset && <p className="pt-bad">{errors.arr_day_offset}</p>}

      <button type="button" onClick={switchToManual} className="gl link sm">
        Enter duration manually instead
      </button>
    </div>
  );
}
