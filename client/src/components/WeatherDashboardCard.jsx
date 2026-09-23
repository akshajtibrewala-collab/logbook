import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CloudSun, ChevronRight } from 'lucide-react';
import { api } from '../lib/api.js';
import Badge from './Badge.jsx';

const STATUS_TONE = { outside: 'bad', near: 'warn', unavailable: 'neutral', within: 'ok' };
const STATUS_LABEL = { outside: 'Outside minimums', near: 'Near a limit', unavailable: 'Data unavailable', within: 'Within minimums' };

/**
 * Dashboard's home-airport weather summary. Always renders a tappable card once settings have loaded —
 * even with no home airport set yet — so the weather checker has a permanent entry point from the
 * Dashboard regardless of setup state (previously this returned null until a home airport was set,
 * which meant a first-time user had no way to discover the feature at all).
 */
export default function WeatherDashboardCard() {
  const [state, setState] = useState('loading'); // 'loading' | 'unset' | the /api/weather/:ident response

  useEffect(() => {
    let cancelled = false;
    api.getSettings()
      .then((s) => {
        if (!s.home_airport_ident) { if (!cancelled) setState('unset'); return; }
        return api.checkWeather(s.home_airport_ident).then((data) => { if (!cancelled) setState(data); });
      })
      .catch(() => { if (!cancelled) setState('unset'); });
    return () => { cancelled = true; };
  }, []);

  if (state === 'loading') return null; // avoid a flash of the "set up" prompt while settings are loading

  if (state === 'unset') {
    return (
      <Link to="/weather/settings" className="card flex items-center justify-between gap-3 p-4 active:bg-navy-800">
        <div className="flex min-w-0 items-center gap-3">
          <CloudSun size={22} className="shrink-0 text-accent" />
          <div className="min-w-0">
            <div className="text-sm font-medium">Weather checker</div>
            <div className="truncate text-xs text-slate-400">Set a home airport and your minimums to see conditions here</div>
          </div>
        </div>
        <ChevronRight size={16} className="shrink-0 text-slate-500" />
      </Link>
    );
  }

  const { current, airport } = state;

  return (
    <Link to="/weather" className="card flex items-center justify-between gap-3 p-4 active:bg-navy-800">
      <div className="flex min-w-0 items-center gap-3">
        <CloudSun size={22} className="shrink-0 text-accent" />
        <div className="min-w-0">
          <div className="text-sm font-medium">{airport.ident}</div>
          <div className="truncate text-xs text-slate-400">
            {current.unavailable ? current.reason
              : `${current.ceilingFt == null ? 'Unlimited ceiling' : `${current.ceilingFt} ft ceiling`} · ${current.visibilitySm ?? '—'} SM`}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!current.unavailable && current.overall && <Badge tone={STATUS_TONE[current.overall]}>{STATUS_LABEL[current.overall]}</Badge>}
        <ChevronRight size={16} className="text-slate-500" />
      </div>
    </Link>
  );
}
