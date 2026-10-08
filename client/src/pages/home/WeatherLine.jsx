import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { BcItem } from '../../components/bc/Bc.jsx';

/**
 * One-tap weather row for the home airport (same data and calls as before: the settings, then the weather check against your personal minimums). It opens
 * Weather; with no home airport it opens the weather settings. A quiet row: the airport, and the ceiling in a word or two. Presentation only.
 */
export default function WeatherLine() {
  const [state, setState] = useState('loading'); // 'loading' | 'unset' | the /api/weather/:ident response
  useEffect(() => {
    let cancelled = false;
    api.getSettings()
      .then((s) => {
        if (!s.home_airport_ident) { if (!cancelled) setState('unset'); return undefined; }
        return api.checkWeather(s.home_airport_ident).then((d) => { if (!cancelled) setState(d); });
      })
      .catch(() => { if (!cancelled) setState('unset'); });
    return () => { cancelled = true; };
  }, []);

  if (state === 'loading') return <div style={{ minHeight: 64 }} aria-hidden="true" />;
  if (state === 'unset') return <BcItem to="/weather/settings" title="Weather" value="Set up" />;
  const { current, airport } = state;
  const value = current.unavailable ? 'Unavailable' : current.ceilingFt == null ? 'Clear' : `${current.ceilingFt} ft`;
  return <BcItem to="/weather" title={`${airport.ident} weather`} value={value} />;
}
