import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { passengerDuration, MAX_ARR_DAY_OFFSET } from '../lib/passengerDuration.js';
import { zoneAbbreviation, tzOffsetMinutes } from '../lib/timezone.js';
import { parseISO } from '../lib/calendar.js';
import HoursInput from './HoursInput.jsx';

const timeInputCls = 'h-12 w-full rounded-xl border border-edge bg-navy-800 px-3 text-base outline-none focus:border-accent';

/** "CDT, UTC-5" for a zone at a reference instant, or null if the zone isn't known yet. */
function zoneSummary(tz, refDate) {
  if (!tz) return null;
  const offset = tzOffsetMinutes(refDate, tz); // e.g. -300 for CDT (UTC-5)
  const sign = offset < 0 ? '-' : '+';
  const hours = Math.abs(offset) / 60;
  const offsetLabel = Number.isInteger(hours) ? `${hours}` : hours.toFixed(1);
  return `${zoneAbbreviation(refDate, tz)}, UTC${sign}${offsetLabel}`;
}

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
          <button type="button" onClick={switchToLocalTimes} className="text-xs text-accent underline">
            Enter local departure/arrival times instead
          </button>
        )}
      </div>
    );
  }

  const depSummary = depCode ? (depTz === undefined ? 'looking up…' : depTz ? zoneSummary(depTz, refDate) : 'zone unknown') : null;
  const arrSummary = arrCode ? (arrTz === undefined ? 'looking up…' : arrTz ? zoneSummary(arrTz, refDate) : 'zone unknown') : null;

  return (
    <div className="col-span-2 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="mb-1 block text-xs text-slate-400">Departure time{depSummary ? ` (${depCode} local, ${depSummary})` : ''}</span>
          <input type="time" value={value.dep_time || ''} onChange={(e) => onChange({ dep_time: e.target.value })} className={timeInputCls} />
        </div>
        <div>
          <span className="mb-1 block text-xs text-slate-400">Arrival time{arrSummary ? ` (${arrCode} local, ${arrSummary})` : ''}</span>
          <input type="time" value={value.arr_time || ''} onChange={(e) => onChange({ arr_time: e.target.value })} className={timeInputCls} />
        </div>
      </div>

      {value.dep_time && value.arr_time && bothZonesKnown && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-navy-800 p-3">
          <div className="text-sm">
            {result && result.hours > 0 ? (
              <>
                <span className="font-medium">Duration: {durationLabel(result.hours)}</span>
                <span className="ml-1 text-slate-400">
                  ({result.arrDayOffset === 0 ? 'arrives same day' : `arrives +${result.arrDayOffset} day${result.arrDayOffset === 1 ? '' : 's'}`})
                </span>
                {result.warning === 'short' && <p className="mt-0.5 text-xs text-warn">That's under 20 minutes — double-check the times.</p>}
                {result.warning === 'long' && <p className="mt-0.5 text-xs text-warn">That's over 20 hours — double-check the arrival day.</p>}
              </>
            ) : (
              <span className="text-bad">Arrival isn't after departure — adjust the arrival day.</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" aria-label="Earlier arrival day" onClick={() => setOffset((offsetOverride ?? result?.arrDayOffset ?? 0) - 1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-900 text-lg text-slate-300">−</button>
            <span className="w-14 text-center text-xs text-slate-400">+{offsetOverride ?? result?.arrDayOffset ?? 0}d</span>
            <button type="button" aria-label="Later arrival day" onClick={() => setOffset((offsetOverride ?? result?.arrDayOffset ?? 0) + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-900 text-lg text-slate-300">+</button>
          </div>
        </div>
      )}
      {value.dep_time && value.arr_time && !bothZonesKnown && (depTz !== undefined && arrTz !== undefined) && (
        <p className="text-xs text-slate-500">One of these airports has no known time zone — enter the duration manually below instead.</p>
      )}
      {errors.arr_day_offset && <p className="text-xs text-bad">{errors.arr_day_offset}</p>}

      <button type="button" onClick={switchToManual} className="text-xs text-accent underline">
        Enter duration manually instead
      </button>
    </div>
  );
}
